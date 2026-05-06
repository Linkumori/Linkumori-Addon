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
 * 2026-03-31 Subham Mahes     Secound modificication
  2026-03-31 Subham Mahes     Third modification 
  2026-03-31 Subham Mahes     Fourth modification 
 * Note: Due to inline constraints, subsequent modifications may
 * not appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file
 * listing all modifications by file, author, and date.
 *
 * IMPORTANT NOTES
 * ---------------
 * - git clone is required before running "Generate Commit History";
 *   otherwise commit history generation will not work.
 * - Older modifications may not appear in the generated
 *   COMMIT_HISTORY.md.
 * - If a file's inline notice is limited, check for a separate
 *   file-specific notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the inline notice as the final modification record.
 * - If a separate file-specific notice is provided, check the
 *   file's inline notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the separate notice as the final modification record.
 * - Review individual modified source files for earlier notices.
 * - Some files may not contain notices within the file itself or
 *   may not be listed in COMMIT_HISTORY.md; a separate notice
 *   file may be provided instead.
 * - Not all source files have been modified, but review notices
 *   in all source files and any separate notice files (.md or .txt).
 * ============================================================
 */



import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { execSync } from "child_process";

const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;

// Find .xpi artifact using Bun's built-in Glob
const glob = new Bun.Glob("web-ext-artifacts/*.xpi");
const artifacts = await Array.fromAsync(glob.scan("."));

if (artifacts.length === 0) {
  console.error("ERROR: No .xpi artifact found in web-ext-artifacts/");
  process.exit(1);
}

// Extract release notes for this version from CHANGELOG.md
const changelog = readFileSync("CHANGELOG.md", "utf8");
const versionHeader = `## [v${version}]`;
const lines = changelog.split("\n");
const start = lines.findIndex((l) => l.startsWith(versionHeader));
if (start === -1) {
  console.error(`ERROR: No changelog section found for v${version}`);
  process.exit(1);
}
const notes = [];
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith("## [")) break;
  notes.push(lines[i]);
}
const releaseNotes = notes.join("\n").trim();

// Write version-metadata.json for --amo-metadata flag
const metadata = {
  version: {
    release_notes: {
      "en-US": releaseNotes,
    },
  },
};
writeFileSync("version-metadata.json", JSON.stringify(metadata, null, 2));
console.log(`Release notes for v${version}:\n${releaseNotes}\n`);

// Create source code zip from all git-tracked files
const sourceZip = "source-code.zip";
console.log("Creating source code zip from git-tracked files...");
execSync(`git archive --format=zip HEAD -o ${sourceZip}`, { stdio: "inherit" });

// Sign and upload to AMO
const artifact = artifacts[0];
console.log(`Uploading ${artifact} (v${version}) to AMO with source code...`);

try {
  execSync(
    `web-ext sign \
      --source-dir . \
      --artifacts-dir web-ext-artifacts \
      --channel ${process.env.WEB_EXT_CHANNEL} \
      --api-key ${process.env.WEB_EXT_API_KEY} \
      --api-secret ${process.env.WEB_EXT_API_SECRET} \
      --amo-metadata ./version-metadata.json \
      --upload-source-code ./${sourceZip} \
      --approval-timeout 0`,
    { stdio: "inherit" }
  );
} finally {
  if (existsSync(sourceZip)) unlinkSync(sourceZip);
}
