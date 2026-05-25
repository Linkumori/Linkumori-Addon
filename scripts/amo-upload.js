#!/usr/bin/env bun

/*
 * ============================================================
 * Linkumori
 * ============================================================
 * Copyright (c) 2026 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2026-03-31  Subham Mahesh   First modification
 * 2026-03-31 Subham Mahesh    Secound modificication
  2026-03-31 Subham Mahesh    Third modification 
  2026-03-31 Subham Mahesh    Fourth modification
 * 2026-05-26 Subham Mahesh   Fifth modification: upload pre-built .zip via
 *                             AMO REST API directly; fix source files being
 *                             bundled into the extension package.
 * Note: Due to inline constraints, subsequent modifications may
 * not appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file
 * listing all modifications by file, author, and date.
 *
 * ============================================================
 *
 * WHY DIRECT API INSTEAD OF `web-ext sign`
 * -----------------------------------------
 * `web-ext sign --source-dir <dir>` always re-packages the extension from
 * the source directory before uploading. It cannot upload a pre-built .zip
 * artifact. This caused two problems:
 *
 *   1. The re-packaging step ran without any --ignore-files patterns, so
 *      source-only files (docs/, scripts/, tests/, .build-ignore, etc.)
 *      were embedded inside the uploaded extension package — AMO reviewers
 *      and end users would receive source code mixed with extension code.
 *
 *   2. The --upload-source-code flag also attached a separate source code
 *      archive, meaning source files appeared both inside the extension
 *      package and as the dedicated source submission ("in both cases").
 *
 * Uploading via the AMO v5 REST API lets us submit the already-built,
 * already-tested .zip from web-ext-artifacts/ directly, with no extra
 * packaging step. Source code is submitted separately as a PATCH after the
 * version is created, which is the correct split between extension and
 * sources that AMO expects.
 *
 * AMO API v5 FLOW
 * ---------------
 * 1. POST   /api/v5/addons/upload/
 *      Upload the pre-built .zip; receive a UUID.
 *      Poll until { processed: true, valid: true }.
 *
 * 2. POST   /api/v5/addons/addon/{addon_id}/versions/
 *      Create a new version, referencing the upload UUID.
 *      Include release notes in the request body.
 *
 * 3. PATCH  /api/v5/addons/addon/{addon_id}/versions/{version_id}/
 *      Attach the source code zip as a multipart `source` field.
 *
 * Authentication uses short-lived JWTs (HS256, 60-second expiry) signed
 * with the WEB_EXT_API_SECRET and issued by WEB_EXT_API_KEY, matching the
 * scheme used internally by web-ext.
 *
 * ============================================================
 */

import { readFileSync, existsSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { createHmac, randomBytes } from "crypto";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AMO_BASE = "https://addons.mozilla.org/api/v5";
const UPLOAD_POLL_INTERVAL_MS = 5_000;
const UPLOAD_POLL_MAX_ATTEMPTS = 36; // 3 minutes

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const API_KEY    = process.env.WEB_EXT_API_KEY;
const API_SECRET = process.env.WEB_EXT_API_SECRET;
const CHANNEL    = process.env.WEB_EXT_CHANNEL;

if (!API_KEY || !API_SECRET || !CHANNEL) {
    console.error("ERROR: WEB_EXT_API_KEY, WEB_EXT_API_SECRET, and WEB_EXT_CHANNEL must be set.");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Manifest — version + addon ID
// ---------------------------------------------------------------------------

const manifest  = JSON.parse(readFileSync("manifest.json", "utf8"));
const version   = manifest.version;
const ADDON_ID  = manifest.browser_specific_settings?.gecko?.id
               ?? manifest.applications?.gecko?.id;

if (!ADDON_ID) {
    console.error("ERROR: Could not read gecko.id from manifest.json.");
    process.exit(1);
}

console.log(`Addon : ${ADDON_ID}`);
console.log(`Version: ${version}`);
console.log(`Channel: ${CHANNEL}`);

// ---------------------------------------------------------------------------
// Find pre-built .zip artifact
// web-ext build produces  web-ext-artifacts/<name>-<version>.zip
// Never a .xpi at build time — .xpi is only produced by AMO after signing.
// ---------------------------------------------------------------------------

const glob      = new Bun.Glob("web-ext-artifacts/*.xpi");
const artifacts = await Array.fromAsync(glob.scan("."));

if (artifacts.length === 0) {
    console.error("ERROR: No .zip artifact found in web-ext-artifacts/.");
    console.error("       Run `bun run linkumori-cli-tool.js build` first.");
    process.exit(1);
}

// If multiple zips exist pick the one whose name contains the current version.
const artifact =
    artifacts.find(f => f.includes(version)) ?? artifacts.sort().at(-1);
console.log(`\nArtifact: ${artifact}`);

// ---------------------------------------------------------------------------
// Release notes from CHANGELOG.md
// ---------------------------------------------------------------------------

const changelog     = readFileSync("CHANGELOG.md", "utf8");
const versionHeader = `## [v${version}]`;
const lines         = changelog.split("\n");
const start         = lines.findIndex(l => l.startsWith(versionHeader));

if (start === -1) {
    console.error(`ERROR: No changelog section found for ${versionHeader}`);
    process.exit(1);
}

const noteLines = [];
for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## [")) break;
    noteLines.push(lines[i]);
}
const releaseNotes = noteLines.join("\n").trim();
console.log(`\nRelease notes for v${version}:\n${releaseNotes}\n`);

// ---------------------------------------------------------------------------
// JWT helper  (HS256, 60-second lifetime)
// ---------------------------------------------------------------------------

function makeJwt() {
    const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: API_KEY,
        jti: randomBytes(8).toString("hex"),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
    })).toString("base64url");
    const sig = createHmac("sha256", API_SECRET)
        .update(`${header}.${payload}`)
        .digest("base64url");
    return `${header}.${payload}.${sig}`;
}

function authHeaders() {
    return { Authorization: `JWT ${makeJwt()}` };
}

// ---------------------------------------------------------------------------
// Step 1 — Upload pre-built .zip  →  receive upload UUID
// ---------------------------------------------------------------------------

console.log("Step 1/3: Uploading extension package to AMO...");

const zipBytes   = readFileSync(artifact);
const uploadForm = new FormData();
uploadForm.append(
    "upload",
    new Blob([zipBytes], { type: "application/zip" }),
    path.basename(artifact)
);
uploadForm.append("channel", CHANNEL);

const uploadRes = await fetch(`${AMO_BASE}/addons/upload/`, {
    method: "POST",
    headers: authHeaders(),
    body: uploadForm,
});

if (!uploadRes.ok) {
    const body = await uploadRes.text();
    console.error(`ERROR: Upload failed (${uploadRes.status}): ${body}`);
    process.exit(1);
}

const uploadData = await uploadRes.json();
const uploadUuid = uploadData.uuid;
console.log(`       Upload UUID: ${uploadUuid}`);

// ---------------------------------------------------------------------------
// Poll until AMO has validated the package
// ---------------------------------------------------------------------------

console.log("       Waiting for AMO validation...");
let validated = false;

for (let i = 0; i < UPLOAD_POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, UPLOAD_POLL_INTERVAL_MS));

    const pollRes  = await fetch(`${AMO_BASE}/addons/upload/${uploadUuid}/`, {
        headers: authHeaders(),
    });
    const pollData = await pollRes.json();

    if (pollData.processed) {
        if (!pollData.valid) {
            console.error("ERROR: AMO validation failed:");
            console.error(JSON.stringify(pollData.validation?.messages ?? pollData, null, 2));
            process.exit(1);
        }
        console.log("       Validation passed.");
        validated = true;
        break;
    }

    process.stdout.write(`       Polling... (${i + 1}/${UPLOAD_POLL_MAX_ATTEMPTS})\r`);
}

if (!validated) {
    console.error(`\nERROR: Timed out waiting for AMO validation after ${UPLOAD_POLL_MAX_ATTEMPTS} attempts.`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2 — Create version, referencing the upload UUID
// ---------------------------------------------------------------------------

console.log("\nStep 2/3: Creating version on AMO...");

const versionRes = await fetch(
    `${AMO_BASE}/addons/addon/${encodeURIComponent(ADDON_ID)}/versions/`,
    {
        method: "POST",
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            upload: uploadUuid,
            release_notes: { "en-US": releaseNotes },
        }),
    }
);

if (!versionRes.ok) {
    const body = await versionRes.text();
    console.error(`ERROR: Version creation failed (${versionRes.status}): ${body}`);
    process.exit(1);
}

const versionData = await versionRes.json();
const versionId   = versionData.id;
console.log(`       Version ${version} created (AMO id: ${versionId})`);

// ---------------------------------------------------------------------------
// Step 3 — Attach source code as a separate PATCH
// Source files are only in this dedicated archive — NOT inside the extension.
// ---------------------------------------------------------------------------

console.log("\nStep 3/3: Uploading source code archive...");

const sourceZip = "source-code.zip";
execSync(`git archive --format=zip HEAD -o ${sourceZip}`, { stdio: "inherit" });

try {
    const sourceBytes = readFileSync(sourceZip);
    const sourceForm  = new FormData();
    sourceForm.append(
        "source",
        new Blob([sourceBytes], { type: "application/zip" }),
        sourceZip
    );

    const sourceRes = await fetch(
        `${AMO_BASE}/addons/addon/${encodeURIComponent(ADDON_ID)}/versions/${versionId}/`,
        {
            method: "PATCH",
            headers: authHeaders(),
            body: sourceForm,
        }
    );

    if (!sourceRes.ok) {
        const body = await sourceRes.text();
        // Non-fatal: extension is already submitted; warn but do not exit.
        console.warn(`WARN: Source code upload failed (${sourceRes.status}): ${body}`);
    } else {
        console.log("       Source code uploaded successfully.");
    }
} finally {
    if (existsSync(sourceZip)) unlinkSync(sourceZip);
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log(`\nDone. Extension v${version} submitted to AMO (${CHANNEL} channel).`);
if (CHANNEL === "listed") {
    console.log("      The extension will be signed once AMO review is complete.");
} else {
    console.log("      The extension will be auto-signed by AMO shortly.");
}
