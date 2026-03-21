#!/usr/bin/env node

/*
 * ============================================================
 * Linkumori
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh
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
 * 2025-06-14   Subham Mahesh   First modification
 * 2025-08-21   Subham Mahesh   Second modification
 * 2025-09-05   Subham Mahesh   Third modification
 *
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
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");

const repoRoot = process.cwd();
const localesRoot = path.join(repoRoot, "_locales");

function walkFiles(startDir) {
  const out = [];
  const stack = [startDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && /\.(js|html|json)$/.test(entry.name)) {
        const normalized = fullPath.split(path.sep).join("/");
        // Avoid self-matching locale message catalogs, which would mark all keys as "used".
        if (normalized.includes("/_locales/")) {
          continue;
        }
        out.push(fullPath);
      }
    }
  }

  return out;
}

function readSourceContent(files) {
  let merged = "";
  for (const filePath of files) {
    merged += fs.readFileSync(filePath, "utf8");
    merged += "\n";
  }
  return merged;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function discoverLocalePairs() {
  if (!fs.existsSync(localesRoot)) {
    return [];
  }

  const entries = fs.readdirSync(localesRoot, { withFileTypes: true });
  const pairs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (!/^[A-Za-z0-9_-]+$/.test(entry.name)) {
      continue;
    }

    const mainPath = path.join(localesRoot, entry.name, "messages.json");
    const extraPath = path.join(localesRoot, entry.name, "messages.extra.json");

    if (fs.existsSync(mainPath) && fs.existsSync(extraPath)) {
      pairs.push({ locale: entry.name, mainPath, extraPath });
    }
  }

  return pairs;
}

function main() {
  const sourceFiles = walkFiles(repoRoot);
  const sourceContent = readSourceContent(sourceFiles);
  const localePairs = discoverLocalePairs();
  let totalUsedKeys = 0;
  let totalAdded = 0;
  let totalMissing = 0;

  if (localePairs.length === 0) {
    console.log("No locale pairs found with both messages.json and messages.extra.json.");
    process.exitCode = checkOnly ? 1 : 0;
    return;
  }

  for (const pair of localePairs) {
    const mainMessages = readJson(pair.mainPath);
    const extraMessages = readJson(pair.extraPath);

    const mainKeys = new Set(Object.keys(mainMessages));
    const extraKeys = Object.keys(extraMessages);
    const usedKeys = new Set(extraKeys.filter((key) => sourceContent.includes(key)));
    const toAdd = extraKeys
      .filter((key) => usedKeys.has(key) && !mainKeys.has(key))
      .sort();

    if (toAdd.length > 0 && !checkOnly) {
      for (const key of toAdd) {
        mainMessages[key] = extraMessages[key];
      }
      fs.writeFileSync(pair.mainPath, `${JSON.stringify(mainMessages, null, 2)}\n`);
    }

    totalUsedKeys += usedKeys.size;
    totalAdded += checkOnly ? 0 : toAdd.length;
    totalMissing += toAdd.length;

    console.log(`Locale: ${pair.locale}`);
    console.log(`Used i18n keys: ${usedKeys.size}`);
    console.log(`Referenced keys added from extra: ${checkOnly ? 0 : toAdd.length}`);
    console.log(`Referenced keys missing in main but present in extra: ${toAdd.length}`);
    if (toAdd.length > 0) {
      console.log("Keys:");
      for (const key of toAdd) {
        console.log(`- ${key}`);
      }
    }
    console.log("");
  }

  console.log(`Scanned source files: ${sourceFiles.length}`);
  console.log(`Locales checked: ${localePairs.length}`);
  console.log(`Total used i18n keys (sum per locale): ${totalUsedKeys}`);
  console.log(`Total referenced keys added from extra: ${totalAdded}`);
  console.log(`Total referenced keys missing in main but present in extra: ${totalMissing}`);

  if (checkOnly && totalMissing > 0) {
    process.exitCode = 1;
  }
}

main();
