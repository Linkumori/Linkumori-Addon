#!/usr/bin/env node

/*
 * ============================================================
 * Linkumori — linkumori-cli-tool.js
 * ============================================================
 * Copyright (c) 2025–2026 Subham Mahesh
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
 * 2026-03-14   Subham Mahesh   Fourth modification
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
import { execSync } from "node:child_process";
import readline from "node:readline";

// ============================================================
// CLI argument parsing
// ============================================================

const args = process.argv.slice(2);

const CLI = {
  maxCommits: 0,       // 0 = auto (resolved later to total commit count)
  dryRun: false,
  help: false,
  interactive: false,
  verbose: false,
  noColor: false,
  changelogPath: null, // null = auto-discover
  repoUrl: null,       // null = auto-detect from git remote
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--help" || arg === "-h") { CLI.help = true; }
  else if (arg === "--dry-run" || arg === "-d") { CLI.dryRun = true; }
  else if (arg === "--interactive" || arg === "-i") { CLI.interactive = true; }
  else if (arg === "--verbose" || arg === "-v") { CLI.verbose = true; }
  else if (arg === "--no-color") { CLI.noColor = true; }
  else if (arg === "--changelog" || arg === "-c") { CLI.changelogPath = args[++i] || null; }
  else if (arg === "--repo-url" || arg === "-r") { CLI.repoUrl = args[++i] || null; }
  else if (/^\d+$/.test(arg)) { CLI.maxCommits = Number.parseInt(arg, 10); }
}

// ============================================================
// Terminal colours (gracefully disabled with --no-color)
// ============================================================

const C = CLI.noColor
  ? { reset: "", bold: "", dim: "", red: "", green: "", yellow: "", blue: "", cyan: "", magenta: "" }
  : {
      reset:   "\x1b[0m",
      bold:    "\x1b[1m",
      dim:     "\x1b[2m",
      red:     "\x1b[31m",
      green:   "\x1b[32m",
      yellow:  "\x1b[33m",
      blue:    "\x1b[34m",
      cyan:    "\x1b[36m",
      magenta: "\x1b[35m",
    };

function log(msg)         { process.stdout.write(msg + "\n"); }
function info(msg)        { log(`${C.cyan}ℹ${C.reset}  ${msg}`); }
function success(msg)     { log(`${C.green}✔${C.reset}  ${msg}`); }
function warn(msg)        { log(`${C.yellow}⚠${C.reset}  ${msg}`); }
function verbose(msg)     { if (CLI.verbose) log(`${C.dim}  ${msg}${C.reset}`); }

// ============================================================
// Help text
// ============================================================

if (CLI.help) {
  log(`
${C.bold}linkumori-cli-tool${C.reset} — Intelligent CHANGELOG.md updater

${C.bold}USAGE${C.reset}
  node linkumori-cli-tool.js [options] [maxCommits]

${C.bold}OPTIONS${C.reset}
  -h, --help              Show this help message and exit
  -d, --dry-run           Preview changes without writing CHANGELOG.md
  -i, --interactive       Launch interactive menu (Generate Commit History, etc.)
  -v, --verbose           Print extra debug information
      --no-color          Disable ANSI colour output
  -c, --changelog <path>  Path to changelog file (default: CHANGELOG.md)
  -r, --repo-url  <url>   Repository base URL for commit/compare hyperlinks
                          e.g. https://github.com/owner/repo

  [maxCommits]            Positional integer — how many recent commits to scan
                          (default: 80)

${C.bold}CONVENTIONAL COMMITS SUPPORT${C.reset}
  The tool fully parses the Conventional Commits spec:
    feat:, fix:, docs:, style:, refactor:, perf:, test:, build:, ci:, chore:, revert:
  Breaking changes (feat!, fix!, or "BREAKING CHANGE:" footer) are highlighted
  under a dedicated "Breaking Changes" section.

${C.bold}CONFIG FILE${C.reset}
  Create a ${C.cyan}.changelogrc.json${C.reset} in your project root to set defaults:
    {
      "maxCommits": 120,
      "repoUrl":    "https://github.com/owner/repo",
      "changelogPath": "CHANGELOG.md"
    }

${C.bold}EXAMPLES${C.reset}
  node linkumori-cli-tool.js                  # fully automatic best run (zero config)
  node linkumori-cli-tool.js --dry-run        # preview only, nothing written
  node linkumori-cli-tool.js 120              # override scan depth to 120 commits
  node linkumori-cli-tool.js -i               # interactive menu
  node linkumori-cli-tool.js -r https://github.com/foo/bar  # override repo URL

${C.bold}AUTO-INTELLIGENCE (zero-config defaults)${C.reset}
  • Repo URL    — parsed from ${C.cyan}git remote get-url origin${C.reset} (GitHub/GitLab/Bitbucket)
  • Changelog   — searched as CHANGELOG.md › CHANGES.md › HISTORY.md › changelog.md
                  created automatically with a proper header if none exists
  • Scan depth  — set to total commit count so no commit is ever missed
  • Dedup       — short + full hashes both tracked; re-runs never duplicate entries
  • Release IDs — detected via git tags AND commit messages (chore(release):, bump, etc.)
  • Noise       — release/version-bump commits excluded from entry lists
  • Ordering    — release sections sorted by semver, newest first
`);
  process.exit(0);
}

// ============================================================
// Auto-intelligence: config, repo URL, changelog path, scan depth
// ============================================================

/**
 * Parse a git remote URL into a canonical https:// base URL.
 * Supports GitHub, GitLab, Bitbucket in both https and git+ssh forms.
 */
function parseRemoteUrl(raw) {
  if (!raw) return null;
  // SSH form: git@github.com:owner/repo.git
  const ssh = raw.match(/^git@([^:]+):([^/]+\/[^.]+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  // HTTPS form: https://github.com/owner/repo[.git]
  const https = raw.match(/^https?:\/\/([^/]+\/[^/]+\/[^/.]+?)(?:\.git)?$/);
  if (https) return `https://${https[1]}`;
  // Bare path like github.com/owner/repo
  const bare = raw.match(/([a-z0-9.-]+\.[a-z]{2,})\/([^/]+\/[^/.]+?)(?:\.git)?$/i);
  if (bare) return `https://${bare[1]}/${bare[2]}`;
  return null;
}

/** Try every common remote name to find a hosting URL. */
function autoDetectRepoUrl() {
  for (const remote of ["origin", "upstream", "github", "gitlab"]) {
    try {
      const raw = run(`git remote get-url ${remote} 2>/dev/null`);
      const url = parseRemoteUrl(raw);
      if (url) { verbose(`Auto-detected repoUrl from remote "${remote}": ${url}`); return url; }
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Search for an existing changelog file using common names.
 * Returns the found path, or null if none exist.
 */
function findExistingChangelog() {
  const candidates = [
    "CHANGELOG.md", "CHANGES.md", "HISTORY.md",
    "changelog.md", "changes.md", "history.md",
    "CHANGELOG", "CHANGES", "HISTORY",
  ];
  for (const name of candidates) {
    if (fs.existsSync(path.resolve(name))) {
      verbose(`Found existing changelog: ${name}`);
      return name;
    }
  }
  return null;
}

/** Bootstrap a brand-new CHANGELOG.md with a proper Keep a Changelog header. */
function bootstrapChangelog(filePath) {
  const projectName = autoDetectProjectName();
  const today = new Date().toISOString().slice(0, 10);
  const repoLine = CLI.repoUrl
    ? `\nProject: ${CLI.repoUrl}\n`
    : "";

  const content = [
    `# Changelog`,
    ``,
    `All notable changes to ${projectName} will be documented in this file.`,
    ``,
    `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)`,
    `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).${repoLine}`,
    ``,
    `## [Unreleased]`,
    ``,
    `### Changed`,
    ``,
    `- No unreleased commit entries.`,
    ``,
  ].join("\n");

  fs.writeFileSync(filePath, content);
  info(`Created ${filePath} with Keep a Changelog header`);
}

/** Try to determine the project name (package.json name, or directory name). */
function autoDetectProjectName() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
    if (pkg.name) return pkg.name;
  } catch { /* ignore */ }
  return path.basename(path.resolve("."));
}

/** Return the total number of commits in the repo (used to set scan depth). */
function getTotalCommitCount() {
  try {
    return Number.parseInt(run("git rev-list --count HEAD"), 10) || 500;
  } catch { return 500; }
}

/**
 * Load config from .changelogrc.json and package.json, then resolve all
 * auto-intelligence defaults (URL, changelog path, scan depth).
 */
function loadConfig() {
  // 1 — .changelogrc.json (highest priority config file)
  const rcPath = path.resolve(".changelogrc.json");
  if (fs.existsSync(rcPath)) {
    try {
      const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
      if (rc.maxCommits && CLI.maxCommits === 0) CLI.maxCommits = rc.maxCommits;
      if (rc.repoUrl    && !CLI.repoUrl)         CLI.repoUrl   = rc.repoUrl;
      if (rc.changelogPath && !CLI.changelogPath) CLI.changelogPath = rc.changelogPath;
      verbose(`Loaded config from ${rcPath}`);
    } catch { warn(`Failed to parse .changelogrc.json — using auto-defaults.`); }
  }

  // 2 — package.json "changelog" key + repository field
  const pkgPath = path.resolve("package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.changelog) {
        const c = pkg.changelog;
        if (c.maxCommits    && CLI.maxCommits === 0)  CLI.maxCommits    = c.maxCommits;
        if (c.repoUrl       && !CLI.repoUrl)           CLI.repoUrl       = c.repoUrl;
        if (c.changelogPath && !CLI.changelogPath)     CLI.changelogPath = c.changelogPath;
        verbose(`Loaded changelog config from package.json`);
      }
      if (!CLI.repoUrl && pkg.repository) {
        const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository.url || "";
        CLI.repoUrl = parseRemoteUrl(repo);
        if (CLI.repoUrl) verbose(`Repo URL from package.json: ${CLI.repoUrl}`);
      }
    } catch { /* ignore */ }
  }

  // 3 — Auto-detect repo URL from git remote (if still unknown)
  if (!CLI.repoUrl) CLI.repoUrl = autoDetectRepoUrl();

  // 4 — Auto-discover / bootstrap changelog file
  if (!CLI.changelogPath) {
    const found = findExistingChangelog();
    if (found) {
      CLI.changelogPath = found;
    } else {
      CLI.changelogPath = "CHANGELOG.md";
      bootstrapChangelog(CLI.changelogPath);
    }
  } else if (!fs.existsSync(CLI.changelogPath)) {
    bootstrapChangelog(CLI.changelogPath);
  }

  // 5 — Auto-compute scan depth (total commit count so nothing is missed)
  if (CLI.maxCommits === 0) {
    CLI.maxCommits = getTotalCommitCount();
    verbose(`Auto scan depth: ${CLI.maxCommits} commits (full history)`);
  }

  if (CLI.repoUrl) verbose(`Repo URL: ${CLI.repoUrl}`);
  verbose(`Changelog: ${CLI.changelogPath}`);
  verbose(`Scan depth: ${CLI.maxCommits}`);
}

// ============================================================
// Git helpers
// ============================================================

function run(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function isGitRepo() {
  try { run("git rev-parse --is-inside-work-tree"); return true; }
  catch { return false; }
}

/**
 * Normalise any hash length to 7 chars (what git log --abbrev outputs).
 * Used to reliably match hashes already recorded in the changelog.
 */
function shortHash(h) { return (h || "").trim().toLowerCase().slice(0, 7); }

/**
 * Return true if this commit is a release/version-bump commit that should
 * be excluded from the human-readable entry list (but still used as a
 * boundary marker).
 */
function isReleaseNoise(commit) {
  // 1. Bare "push" commits
  if (/^push$/i.test(commit.subject)) return true;

  // 2. Conventional commits where type=chore and scope=release (e.g. "chore(release): 2.0.0")
  if (commit.type === "chore" && commit.scope === "release") return true;

  // 3. Subject-level patterns: "release X.Y", "version bump", "bump to X.Y", etc.
  if (/^(release|version bump|bump version|bump to|prepare release|cut release)\b/i.test(commit.subject)) return true;

  // 4. Conventional chore: release/bump/version prefix  e.g. "chore: bump version to 2.0"
  if (/^chore(\([^)]*\))?!?\s*:\s*(release|bump|version)\b/i.test(commit.subject)) return true;

  return false;
}

/**
 * Compare two semver strings (with or without leading "v").
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareSemver(a, b) {
  const parse = (v) => (v || "0").replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [aMaj, aMin, aPat = 0] = parse(a);
  const [bMaj, bMin, bPat = 0] = parse(b);
  return (bMaj - aMaj) || (bMin - aMin) || (bPat - aPat); // newest first
}

/**
 * Parse a raw commit line (hash\x1fsubject\x1fbody\x1fdate\x1frefs)
 * into a rich commit object.
 */
function parseCommitLine(line) {
  const [hash, subject, body, date, refs] = line.split("\x1f");
  if (!hash || !subject) return null;

  const parsed = parseConventionalCommit(subject.trim());
  const issues  = extractIssueRefs(subject + "\n" + (body || ""));
  const breaking = detectBreakingChange(subject.trim(), body || "");
  const isMerge  = /^Merge (pull request|branch|remote|tag)/i.test(subject.trim());
  const isRevert = parsed.type === "revert" || /^Revert "/i.test(subject.trim());

  // Extract reverted commit hash if available
  let revertedHash = null;
  if (isRevert && body) {
    const m = body.match(/This reverts commit ([0-9a-f]{7,40})/i);
    if (m) revertedHash = m[1].slice(0, 7);
  }

  return {
    hash:        hash.trim(),
    subject:     subject.trim(),
    body:        (body || "").trim(),
    date:        (date || "").trim(),
    refs:        refs ? refs.trim() : "",
    ...parsed,
    issues,
    breaking,
    isMerge,
    isRevert,
    revertedHash,
  };
}

/**
 * Full Conventional Commits parser.
 * Supports: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
 * Plus breaking-change indicator with ! (e.g. feat!: ..., feat(scope)!: ...)
 */
function parseConventionalCommit(subject) {
  // Pattern: type(scope)!: description  OR  type!: description  OR  type: description
  const ccRe = /^([a-z]+)(\([^)]*\))?(!)?\s*:\s*(.+)$/i;
  const m = subject.match(ccRe);
  if (m) {
    return {
      type:         m[1].toLowerCase(),
      scope:        m[2] ? m[2].slice(1, -1) : null,  // strip parens
      breakingMark: !!m[3],
      description:  m[4].trim(),
      conventional: true,
    };
  }

  // Fallback: keyword-based inference (backwards compat with old commit style)
  return {
    type:         inferTypeFromKeyword(subject),
    scope:        null,
    breakingMark: false,
    description:  subject,
    conventional: false,
  };
}

/**
 * Legacy keyword-based type inference — only used when conventional commit
 * format is not detected.
 */
function inferTypeFromKeyword(subject) {
  const s = subject.toLowerCase();
  // More comprehensive than the original
  if (/^(feat|feature|add|introduce|implement|new)\b/.test(s)) return "feat";
  if (/^(fix|bug|hotfix|patch|resolve|correct|repair)\b/.test(s)) return "fix";
  if (/^(remove|delete|drop|deprecate)\b/.test(s)) return "remove";
  if (/^(docs?|document|readme|comment|jsdoc)\b/.test(s)) return "docs";
  if (/^(refactor|rework|reorganize|restructure|cleanup|clean up)\b/.test(s)) return "refactor";
  if (/^(perf|performance|optim|speed|faster)\b/.test(s)) return "perf";
  if (/^(test|spec|coverage)\b/.test(s)) return "test";
  if (/^(build|bundle|webpack|rollup|compile)\b/.test(s)) return "build";
  if (/^(ci|pipeline|workflow|action|github action)\b/.test(s)) return "ci";
  if (/^(style|format|lint|prettier|eslint)\b/.test(s)) return "style";
  if (/^(revert)\b/.test(s)) return "revert";
  if (/^(release|version|bump|tag)\b/.test(s)) return "release";
  return "chore";
}

/** Detect breaking change from subject bang-notation or body BREAKING CHANGE footer */
function detectBreakingChange(subject, body) {
  if (/^[a-z]+(\([^)]*\))?!\s*:/i.test(subject)) return true;
  if (/^BREAKING[- ]CHANGE\s*:/m.test(body)) return true;
  return false;
}

/** Extract GitHub issue/PR references like #123 or GH-123 */
function extractIssueRefs(text) {
  const refs = new Set();
  for (const m of text.matchAll(/#(\d+)/g)) refs.add(m[1]);
  for (const m of text.matchAll(/GH-(\d+)/gi)) refs.add(m[1]);
  return [...refs];
}

/** Map a commit type to a CHANGELOG category heading */
function typeToCategory(type, breaking) {
  if (breaking) return "Breaking Changes";
  switch (type) {
    case "feat":     return "Added";
    case "fix":      return "Fixed";
    case "remove":   return "Removed";
    case "docs":     return "Documentation";
    case "perf":     return "Performance";
    case "revert":   return "Reverted";
    case "refactor":
    case "style":
    case "test":
    case "build":
    case "ci":
    case "chore":
    default:         return "Changed";
  }
}

const CATEGORY_ORDER = [
  "Breaking Changes", "Added", "Changed", "Fixed",
  "Performance", "Removed", "Reverted", "Documentation",
];

// ============================================================
// Commit fetching
// ============================================================

function getRecentCommits(limit) {
  // %h=short hash, %s=subject, %b=body, %ad=author date, %D=ref names
  const fmt = "%h%x1f%s%x1f%b%x1f%ad%x1f%D%x1e";
  const output = run(
    `git log -n ${limit} --date=short --pretty=format:${JSON.stringify(fmt)}`
  );
  if (!output) return [];
  return output
    .split("\x1e")
    .map((block) => parseCommitLine(block.trim()))
    .filter(Boolean);
}

function getCommitRange(fromExclusiveHash, toInclusiveHash) {
  const fmt = "%h%x1f%s%x1f%b%x1f%ad%x1f%D%x1e";
  const range = fromExclusiveHash
    ? `${fromExclusiveHash}..${toInclusiveHash}`
    : toInclusiveHash;
  const output = run(
    `git log --reverse --date=short --pretty=format:${JSON.stringify(fmt)} ${range}`
  );
  if (!output) return [];
  return output
    .split("\x1e")
    .map((block) => parseCommitLine(block.trim()))
    .filter(Boolean);
}

function getChangedFilesForCommit(hash) {
  const output = run(`git show --name-only --pretty=format: ${hash}`);
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// ============================================================
// Git tag & release detection
// ============================================================

/**
 * Return all version tags as {tag, hash, date, version} sorted newest first.
 * Supports vX.Y, vX.Y.Z, X.Y, X.Y.Z.
 */
function getVersionTags() {
  try {
    const raw = run("git tag --list --sort=-version:refname");
    const tags = raw.split("\n").filter(Boolean);
    const result = [];
    for (const tag of tags) {
      if (!/^v?\d+\.\d+/.test(tag)) continue;
      try {
        const hash = run(`git rev-list -n 1 ${tag}`).slice(0, 7);
        const date = run(`git log -1 --format=%ad --date=short ${tag}`);
        const version = tag.startsWith("v") ? tag : `v${tag}`;
        result.push({ tag, hash, date, version });
      } catch { /* skip bad tags */ }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Extract a semver string from a commit subject that indicates a release.
 * Handles: "release 1.2", "chore(release): 1.2.3", "bump to v2.0", etc.
 */
function extractVersionFromSubject(subject) {
  // Conventional: chore(release): 1.2.3  or  chore: bump to 1.2.3
  const patterns = [
    /(?:release|bump(?:\s+(?:to|version)?)?|version(?:\s+to)?)\s+v?(\d+\.\d+(?:\.\d+)?)/i,
    /^chore(?:\([^)]*\))?!?\s*:\s*(?:release|bump|version[^:]*)\s+v?(\d+\.\d+(?:\.\d+)?)/i,
    /v?(\d+\.\d+\.\d+)/,  // bare version in subject as last resort
  ];
  for (const re of patterns) {
    const m = subject.match(re);
    if (m) return `v${m[1]}`;
  }
  return null;
}

/**
 * Detect release commits by either:
 * 1. Git version tags pointing at a commit  (authoritative)
 * 2. Commit subject matching known release patterns (fallback)
 * Returns array sorted newest-first by semver.
 */
function detectReleaseCommits(allCommits) {
  const taggedVersions = getVersionTags();
  // Build lookup: short hash → tag info
  const taggedHashes = new Map(taggedVersions.map((t) => [shortHash(t.hash), t]));
  const seen = new Set();
  const releases = [];

  for (const commit of allCommits) {
    const sh = shortHash(commit.hash);

    // Tag-based detection (authoritative)
    if (taggedHashes.has(sh)) {
      const tag = taggedHashes.get(sh);
      if (!seen.has(tag.version.toLowerCase())) {
        releases.push({ ...commit, version: tag.version, source: "tag" });
        seen.add(tag.version.toLowerCase());
      }
      continue;
    }

    // Subject-based detection (multiple patterns)
    const version = extractVersionFromSubject(commit.subject);
    if (version && !seen.has(version.toLowerCase())) {
      releases.push({ ...commit, version, source: "commit" });
      seen.add(version.toLowerCase());
    }
  }

  // Sort newest-first by semver so section insertion is always correct
  releases.sort((a, b) => compareSemver(a.version, b.version));
  return releases;
}

// ============================================================
// CHANGELOG parsing helpers
// ============================================================

function readChangelog() {
  if (!fs.existsSync(CLI.changelogPath)) {
    throw new Error(`${CLI.changelogPath} not found`);
  }
  return fs.readFileSync(CLI.changelogPath, "utf8");
}

/**
 * Collect every hash already recorded in the changelog.
 * Stores both the raw form AND the 7-char short form so we match
 * regardless of which length was written.
 */
function collectLoggedHashes(changelog) {
  const hashes = new Set();
  for (const m of changelog.matchAll(/hash:\s*\[?`?([0-9a-f]{7,40})`?\]?/gi)) {
    const h = m[1].toLowerCase();
    hashes.add(h);
    hashes.add(h.slice(0, 7)); // also store 7-char prefix
  }
  return hashes;
}

function getExistingVersionSet(changelog) {
  const versions = new Set();
  for (const m of changelog.matchAll(/^## \[(v[0-9]+\.[0-9]+(?:\.[0-9]+){0,2})\]/gm)) {
    versions.add(m[1].toLowerCase());
  }
  return versions;
}

// ============================================================
// Entry formatting
// ============================================================

/**
 * Format a single commit as a CHANGELOG list item.
 * Example:
 *   - **auth**: add OAuth2 PKCE flow (`2025-08-01`, hash: `a1b2c3d`) [#42]
 */
function formatEntry(commit) {
  let desc = commit.description || commit.subject;

  // Revert commits: annotate with reverted hash
  if (commit.isRevert && commit.revertedHash) {
    desc = `${desc} (reverts \`${commit.revertedHash}\`)`;
  }

  // Scope prefix
  const scopePart = commit.scope ? `**${commit.scope}**: ` : "";

  // Issue/PR links
  let issuePart = "";
  if (commit.issues.length > 0 && CLI.repoUrl) {
    issuePart = " " + commit.issues
      .map((n) => `[#${n}](${CLI.repoUrl}/issues/${n})`)
      .join(" ");
  } else if (commit.issues.length > 0) {
    issuePart = " " + commit.issues.map((n) => `[#${n}]`).join(" ");
  }

  // Commit link
  let hashPart;
  if (CLI.repoUrl) {
    hashPart = `hash: [\`${commit.hash}\`](${CLI.repoUrl}/commit/${commit.hash})`;
  } else {
    hashPart = `hash: \`${commit.hash}\``;
  }

  return `- ${scopePart}${desc} (\`${commit.date}\`, ${hashPart})${issuePart}`;
}

// ============================================================
// Section builders
// ============================================================

function buildGroups(commits) {
  /** @type {Record<string, string[]>} */
  const groups = {};
  for (const cat of CATEGORY_ORDER) groups[cat] = [];

  for (const commit of commits) {
    // Skip merge commits, release/version-bump noise
    if (commit.isMerge) { verbose(`Skipping merge commit ${commit.hash}`); continue; }
    if (isReleaseNoise(commit)) { verbose(`Skipping noise commit ${commit.hash}: ${commit.subject}`); continue; }

    const cat = typeToCategory(commit.type, commit.breaking || commit.breakingMark);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(formatEntry(commit));
  }

  // Sort entries within each category alphabetically (by description)
  for (const cat of Object.keys(groups)) {
    groups[cat].sort();
  }

  return groups;
}

function renderGroups(groups) {
  const lines = [];
  for (const heading of CATEGORY_ORDER) {
    if (groups[heading] && groups[heading].length > 0) {
      lines.push(`### ${heading}`);
      lines.push(...groups[heading]);
      lines.push("");
    }
  }
  return lines;
}

function buildUnreleasedSection(commits) {
  const groups = buildGroups(commits);
  const lines  = ["## [Unreleased]"];
  const rendered = renderGroups(groups);

  if (rendered.length === 0) {
    lines.push("### Changed");
    lines.push("- No unreleased commit entries.");
    lines.push("");
  } else {
    lines.push(...rendered);
  }

  return lines.join("\n").trimEnd();
}

function buildReleaseSection(releaseCommit, previousReleaseCommit) {
  const rangeCommits = getCommitRange(
    previousReleaseCommit?.hash || "",
    releaseCommit.hash
  );

  const groups  = buildGroups(rangeCommits);
  const rendered = renderGroups(groups);

  // Compare link between tags
  let compareLink = "";
  if (CLI.repoUrl && previousReleaseCommit) {
    compareLink = ` ([compare](${CLI.repoUrl}/compare/${previousReleaseCommit.version}...${releaseCommit.version}))`;
  }

  const lines = [`## [${releaseCommit.version}] - ${releaseCommit.date}${compareLink}`];

  if (rendered.length === 0) {
    // Fallback: list changed files
    const files = getChangedFilesForCommit(releaseCommit.hash);
    lines.push("### Changed");
    lines.push(`- Release ${releaseCommit.version} (hash: \`${releaseCommit.hash}\`).`);
    if (files.length > 0) {
      lines.push("- Updated files:");
      for (const file of files) lines.push(`  - \`${file}\``);
    }
    lines.push("");
  } else {
    lines.push(...rendered);
  }

  return lines.join("\n").trimEnd();
}

// ============================================================
// Changelog surgery
// ============================================================

function replaceUnreleasedSection(changelog, unreleasedSection) {
  const start = changelog.indexOf("## [Unreleased]");
  if (start !== -1) {
    const rest            = changelog.slice(start + "## [Unreleased]".length);
    const nextVersionRel  = rest.search(/\n## \[(?!Unreleased\])/);
    const end             = nextVersionRel === -1
      ? changelog.length
      : start + "## [Unreleased]".length + nextVersionRel + 1;
    const before = changelog.slice(0, start).trimEnd();
    const after  = changelog.slice(end).trimStart();
    return `${before}\n\n${unreleasedSection}\n\n${after}`;
  }

  const firstVersionIndex = changelog.search(/^## \[/m);
  if (firstVersionIndex === -1) {
    return `${changelog.trimEnd()}\n\n${unreleasedSection}\n`;
  }

  const before = changelog.slice(0, firstVersionIndex).trimEnd();
  const after  = changelog.slice(firstVersionIndex).trimStart();
  return `${before}\n\n${unreleasedSection}\n\n${after}`;
}

function insertReleaseSections(changelog, releaseSections) {
  if (releaseSections.length === 0) return changelog;

  const firstReleasedHeading = changelog.search(/^## \[(?!Unreleased\]).+\]/m);
  if (firstReleasedHeading === -1) {
    return `${changelog.trimEnd()}\n\n${releaseSections.join("\n\n")}\n`;
  }

  const before = changelog.slice(0, firstReleasedHeading).trimEnd();
  const after  = changelog.slice(firstReleasedHeading).trimStart();
  return `${before}\n\n${releaseSections.join("\n\n")}\n\n${after}`;
}

// ============================================================
// Commit history generator (interactive "Generate Commit History")
// ============================================================

function generateCommitHistory() {
  info("Generating COMMIT_HISTORY.md …");
  const fmt  = "%h%x1f%an%x1f%ad%x1f%s%x1f%b%x1e";
  const raw  = run(`git log --date=short --pretty=format:${JSON.stringify(fmt)} --name-only`);
  const blocks = raw.split("\x1e").map((b) => b.trim()).filter(Boolean);

  /** @type {Map<string, {author: string, date: string, hashes: string[]}[]>} */
  const byFile = new Map();

  for (const block of blocks) {
    const lines = block.split("\n");
    const header = lines[0];
    const [hash, author, date, subject] = header.split("\x1f");
    if (!hash) continue;
    const files = lines.slice(1).map((l) => l.trim()).filter((l) => l && !l.includes("\x1f"));
    for (const file of files) {
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push({ hash: hash.slice(0, 7), author, date, subject });
    }
  }

  const sortedFiles = [...byFile.keys()].sort();
  const mdLines = [
    "# Commit History",
    "",
    `_Generated on ${new Date().toISOString().slice(0, 10)}_`,
    "",
  ];

  for (const file of sortedFiles) {
    mdLines.push(`## \`${file}\``, "");
    mdLines.push("| Date | Hash | Author | Description |");
    mdLines.push("|------|------|--------|-------------|");
    for (const entry of byFile.get(file)) {
      const hashCell = CLI.repoUrl
        ? `[\`${entry.hash}\`](${CLI.repoUrl}/commit/${entry.hash})`
        : `\`${entry.hash}\``;
      mdLines.push(`| ${entry.date} | ${hashCell} | ${entry.author} | ${entry.subject || ""} |`);
    }
    mdLines.push("");
  }

  const outPath = "COMMIT_HISTORY.md";
  fs.writeFileSync(outPath, mdLines.join("\n"));
  success(`Commit history written to ${outPath} (${sortedFiles.length} files)`);
}

// ============================================================
// Interactive menu
// ============================================================

async function interactiveMenu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  log(`\n${C.bold}linkumori-cli-tool — Interactive Mode${C.reset}\n`);
  log("  1) Update CHANGELOG.md (default)");
  log("  2) Preview CHANGELOG changes (dry run)");
  log("  3) Generate Commit History (COMMIT_HISTORY.md)");
  log("  4) Show recent commits");
  log("  5) Exit\n");

  const choice = (await ask("Select an option [1-5]: ")).trim();
  rl.close();

  switch (choice) {
    case "1": await runUpdate(false); break;
    case "2": await runUpdate(true);  break;
    case "3": generateCommitHistory();   break;
    case "4": showRecentCommits();       break;
    case "5": log("Bye!"); process.exit(0); break;
    default:  warn(`Unknown choice "${choice}", running default update.`); await runUpdate(false);
  }
}

function showRecentCommits() {
  const commits = getRecentCommits(20);
  log(`\n${C.bold}Last ${commits.length} commits:${C.reset}\n`);
  for (const c of commits) {
    const typeLabel = `${C.cyan}[${c.type}]${C.reset}`;
    const scopeLabel = c.scope ? ` ${C.magenta}(${c.scope})${C.reset}` : "";
    const breakLabel = c.breaking || c.breakingMark ? ` ${C.red}BREAKING${C.reset}` : "";
    log(`  ${C.dim}${c.hash}${C.reset} ${typeLabel}${scopeLabel}${breakLabel} ${c.description || c.subject}`);
  }
  log("");
}

// ============================================================
// Core update logic
// ============================================================

async function runUpdate(dryRun) {
  const changelogOriginal = readChangelog();
  const allCommits        = getRecentCommits(CLI.maxCommits);

  if (allCommits.length === 0) {
    warn("No commits found. Is this a git repository with commits?");
    return;
  }

  verbose(`Scanned ${allCommits.length} commits`);

  // ── Release detection (tags + commit messages, semver-sorted newest first) ──
  const releaseCommits        = detectReleaseCommits(allCommits);
  const existingVersions      = getExistingVersionSet(changelogOriginal);
  const missingReleaseCommits = releaseCommits.filter(
    (r) => !existingVersions.has(r.version.toLowerCase())
  );

  verbose(`Found ${releaseCommits.length} release(s), ${missingReleaseCommits.length} new`);

  // Build each missing release section; find its predecessor by semver position
  const generatedReleaseSections = missingReleaseCommits.map((releaseCommit) => {
    const idx = releaseCommits.findIndex((r) => shortHash(r.hash) === shortHash(releaseCommit.hash));
    const previousReleaseCommit = idx >= 0 ? releaseCommits[idx + 1] : null;
    return buildReleaseSection(releaseCommit, previousReleaseCommit);
  });

  let changelog = insertReleaseSections(changelogOriginal, generatedReleaseSections);

  // ── Unreleased section ────────────────────────────────────────────────────
  const loggedHashes = collectLoggedHashes(changelog);

  // Commits AFTER the most recent release boundary (HEAD → latest release)
  const latestReleaseIdx = allCommits.findIndex((c) =>
    releaseCommits.some((r) => shortHash(r.hash) === shortHash(c.hash))
  );
  const candidateCommits = latestReleaseIdx === -1
    ? allCommits
    : allCommits.slice(0, latestReleaseIdx);

  // Exclude: already logged (by short OR full hash), and release-noise commits
  const unreleasedCommits = candidateCommits.filter((c) => {
    const sh = shortHash(c.hash);
    return !loggedHashes.has(sh) && !loggedHashes.has(c.hash.toLowerCase());
  });

  const unreleasedSection = buildUnreleasedSection(unreleasedCommits);
  const updated           = replaceUnreleasedSection(changelog, unreleasedSection);

  // ── Statistics ─────────────────────────────────────────────────────────────
  const breakingCount = unreleasedCommits.filter((c) => c.breaking || c.breakingMark).length;
  const mergeCount    = allCommits.filter((c) => c.isMerge).length;
  const noiseCount    = allCommits.filter((c) => isReleaseNoise(c)).length;

  if (dryRun) {
    log(`\n${C.bold}--- DRY RUN: CHANGELOG preview ---${C.reset}\n`);
    log(updated);
    log(`\n${C.dim}--- end of preview ---${C.reset}`);
  } else {
    fs.writeFileSync(CLI.changelogPath, updated);
    success(`${CLI.changelogPath} updated`);
  }

  log("");
  info(`Commits scanned:          ${allCommits.length}  (full history)`);
  info(`Merge/noise commits skipped: ${mergeCount + noiseCount}`);
  info(`Release sections added:   ${generatedReleaseSections.length}`);
  info(`Unreleased commits added: ${unreleasedCommits.length}`);
  if (releaseCommits.length > 0) {
    info(`Latest release:           ${releaseCommits[0].version} (${releaseCommits[0].date})`);
  }
  if (breakingCount > 0) {
    log(`${C.red}${C.bold}⚠  Breaking changes:       ${breakingCount}${C.reset}`);
  }
  if (dryRun) {
    log(`\n${C.yellow}Dry-run mode — ${CLI.changelogPath} was NOT modified.${C.reset}`);
  }
}

// ============================================================
// Entry point
// ============================================================

async function main() {
  loadConfig();

  if (!isGitRepo()) {
    process.stderr.write(
      `${C.red}Error:${C.reset} Not inside a git repository.\n` +
      `Run ${C.cyan}git clone${C.reset} first, then try again.\n`
    );
    process.exit(1);
  }

  if (CLI.interactive) {
    await interactiveMenu();
  } else {
    await runUpdate(CLI.dryRun);
  }
}

main().catch((err) => {
  process.stderr.write(`${C.red}Fatal:${C.reset} ${err.message}\n`);
  if (CLI.verbose) process.stderr.write(err.stack + "\n");
  process.exit(1);
});