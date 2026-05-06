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
 * 2026-03-14   Subham Mahesh   First modification
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
import { execSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output, argv } from "node:process";

function run(command, options = {}) {
  return execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...options }).trim();
}

function runStreaming(command) {
  execSync(command, { stdio: "inherit" });
}

function tryRunStreaming(command) {
  try {
    runStreaming(command);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

function ensureGitRepo() {
  try {
    run("git rev-parse --git-dir");
  } catch {
    console.error("Not inside a git repository.");
    process.exit(1);
  }
}

function getCurrentBranch() {
  return run("git rev-parse --abbrev-ref HEAD");
}

function hasChanges() {
  const status = run("git status --porcelain");
  return status.length > 0;
}

function hasStash() {
  try {
    const top = run("git stash list -n 1");
    return top.length > 0;
  } catch {
    return false;
  }
}

function getRemotes() {
  const remotes = run("git remote").split("\n").map((item) => item.trim()).filter(Boolean);
  return remotes;
}

function getLocalBranches() {
  return run("git for-each-ref refs/heads --format='%(refname:short)'")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRemoteBranches() {
  try {
    return run("git for-each-ref refs/remotes --format='%(refname:short)'")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((name) => !name.endsWith("/HEAD"));
  } catch {
    return [];
  }
}

function getAllBranchEntries() {
  const locals = getLocalBranches().map((name) => ({
    type: "local",
    name,
    ref: name,
    display: `local: ${name}`
  }));

  const remotes = getRemoteBranches().map((full) => {
    const slash = full.indexOf("/");
    const remote = slash === -1 ? full : full.slice(0, slash);
    const name = slash === -1 ? full : full.slice(slash + 1);
    return {
      type: "remote",
      name,
      remote,
      ref: full,
      display: `remote: ${full}`
    };
  });

  return [...locals, ...remotes];
}

async function chooseBranchEntry(rl, title, entries, defaultIndex = 0) {
  if (!entries.length) {
    throw new Error(`No branches available for: ${title}`);
  }
  const selectedDisplay = await chooseFromList(
    rl,
    title,
    entries.map((entry) => entry.display),
    defaultIndex
  );
  const selected = entries.find((entry) => entry.display === selectedDisplay);
  if (!selected) {
    throw new Error("Invalid branch selection.");
  }
  return selected;
}

async function ask(rl, question) {
  const value = await rl.question(question);
  return value.trim();
}

async function chooseFromList(rl, title, items, defaultIndex = 0) {
  if (!items.length) {
    throw new Error(`No options available for: ${title}`);
  }

  console.log(`\n${title}`);
  for (let i = 0; i < items.length; i += 1) {
    const marker = i === defaultIndex ? " (default)" : "";
    console.log(`${i + 1}. ${items[i]}${marker}`);
  }

  while (true) {
    const answer = await ask(rl, `Select [1-${items.length}] (enter for ${defaultIndex + 1}): `);
    if (!answer) return items[defaultIndex];
    const index = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= items.length) {
      return items[index - 1];
    }
    console.log("Invalid selection. Try again.");
  }
}

async function chooseRemote(rl) {
  const remotes = getRemotes();
  if (!remotes.length) {
    console.error("No git remotes configured. Add a remote first.");
    process.exit(1);
  }
  const defaultIndex = remotes.includes("origin") ? remotes.indexOf("origin") : 0;
  return chooseFromList(rl, "Choose remote:", remotes, defaultIndex);
}

async function choosePushMode(rl, defaultMode = "normal") {
  const options = [
    { key: "normal", label: "normal" },
    { key: "set-upstream", label: "set-upstream (-u)" },
    { key: "force-with-lease", label: "force-with-lease" }
  ];
  const labels = options.map((item) => item.label);
  const defaultIndex = Math.max(options.findIndex((item) => item.key === defaultMode), 0);
  const selectedLabel = await chooseFromList(rl, "Choose push mode:", labels, defaultIndex);
  return options.find((item) => item.label === selectedLabel)?.key || "normal";
}

function pushBranch(remote, branch, pushMode) {
  if (pushMode === "set-upstream") {
    runStreaming(`git push -u ${remote} ${branch}`);
    return;
  }
  if (pushMode === "force-with-lease") {
    runStreaming(`git push --force-with-lease ${remote} ${branch}`);
    return;
  }
  runStreaming(`git push ${remote} ${branch}`);
}

async function askDetachedDestinationBranch(rl) {
  let branch = "";
  while (!branch) {
    const answer = await ask(rl, "Detached HEAD: push to remote branch name (e.g. main or gitea-beta): ");
    const cleaned = answer.trim();
    if (!cleaned) {
      console.log("Branch name is required.");
      continue;
    }
    if (/\s/.test(cleaned)) {
      console.log("Branch name cannot contain spaces.");
      continue;
    }
    branch = cleaned;
  }
  return branch;
}

function pushDetachedHead(remote, destinationBranch, pushMode) {
  const dst = `HEAD:refs/heads/${destinationBranch}`;
  if (pushMode === "set-upstream") {
    runStreaming(`git push -u ${remote} ${dst}`);
    return;
  }
  if (pushMode === "force-with-lease") {
    runStreaming(`git push --force-with-lease ${remote} ${dst}`);
    return;
  }
  runStreaming(`git push ${remote} ${dst}`);
}

async function getCommitMessage(rl) {
  let message = "";
  while (!message) {
    message = await ask(rl, "Commit message: ");
    if (!message) {
      console.log("Commit message is required.");
    }
  }
  return message;
}

async function commitAndPushFlow(rl) {
  const branch = getCurrentBranch();
  const detached = branch === "HEAD";
  console.log(`Current branch: ${branch}`);

  const remote = await chooseRemote(rl);
  console.log(`Selected remote: ${remote}`);

  if (!detached) {
    const hadLocalChanges = hasChanges();
    let stashed = false;
    if (hadLocalChanges) {
      runStreaming('git stash push --include-untracked -m "git-workflow-temp-stash"');
      stashed = hasStash();
    }

    try {
      runStreaming(`git pull --rebase ${remote} ${branch}`);
    } finally {
      if (stashed) {
        runStreaming("git stash pop");
      }
    }
  } else {
    console.log("Detached HEAD detected: skipping pull --rebase step.");
  }

  if (!hasChanges()) {
    console.log("No changes to commit.");
    return;
  }

  const message = await getCommitMessage(rl);
  runStreaming("git add -A");
  runStreaming(`git commit -m ${JSON.stringify(message)}`);

  const pushMode = await choosePushMode(rl, "normal");
  if (detached) {
    const destinationBranch = await askDetachedDestinationBranch(rl);
    pushDetachedHead(remote, destinationBranch, pushMode);
    return;
  }
  pushBranch(remote, branch, pushMode);
}

async function createBranchFlow(rl) {
  const current = getCurrentBranch();
  const branches = getAllBranchEntries();
  const defaultBaseIndex = Math.max(
    branches.findIndex((branch) => branch.type === "local" && branch.name === current),
    0
  );
  const base = await chooseBranchEntry(rl, "Choose base branch for new branch:", branches, defaultBaseIndex);

  let newBranch = "";
  while (!newBranch) {
    newBranch = await ask(rl, "New branch name: ");
    if (!newBranch) {
      console.log("Branch name cannot be empty.");
    }
  }

  runStreaming(`git switch -c ${newBranch} ${base.ref}`);
  console.log(`Created and switched to branch: ${newBranch}`);

  const pushNow = (await ask(rl, "Push this branch now? (y/N): ")).toLowerCase();
  if (pushNow === "y" || pushNow === "yes") {
    const remote = await chooseRemote(rl);
    const pushMode = await choosePushMode(rl, "set-upstream");
    pushBranch(remote, newBranch, pushMode);
  }
}

async function pushFlow(rl) {
  const branch = getCurrentBranch();
  const detached = branch === "HEAD";
  console.log(`Current branch: ${branch}`);
  const remote = await chooseRemote(rl);
  const pushMode = await choosePushMode(rl, "normal");
  if (detached) {
    const destinationBranch = await askDetachedDestinationBranch(rl);
    pushDetachedHead(remote, destinationBranch, pushMode);
    return;
  }
  pushBranch(remote, branch, pushMode);
}

async function checkoutFlow(rl) {
  const current = getCurrentBranch();
  const branches = getAllBranchEntries();
  const defaultIndex = Math.max(
    branches.findIndex((branch) => branch.type === "local" && branch.name === current),
    0
  );
  const selected = await chooseBranchEntry(rl, "Choose branch to checkout:", branches, defaultIndex);

  if (selected.type === "local" && selected.name === current) {
    console.log(`Already on branch: ${selected.name}`);
    return;
  }

  if (selected.type === "local") {
    runStreaming(`git switch ${selected.name}`);
    return;
  }

  const localBranches = getLocalBranches();
  if (localBranches.includes(selected.name)) {
    runStreaming(`git switch ${selected.name}`);
    return;
  }
  runStreaming(`git switch --track ${selected.ref}`);
}

async function deleteBranchFlow(rl) {
  const current = getCurrentBranch();
  const allBranches = getAllBranchEntries().filter(
    (branch) => !(branch.type === "local" && branch.name === current)
  );
  if (!allBranches.length) {
    console.log("No branches available to delete.");
    return;
  }

  const selected = await chooseBranchEntry(rl, "Choose branch to delete:", allBranches, 0);
  if (selected.type === "remote") {
    const confirm = (await ask(
      rl,
      `Delete remote branch "${selected.ref}" from remote "${selected.remote}"? (y/N): `
    )).toLowerCase();
    if (confirm !== "y" && confirm !== "yes") {
      console.log("Delete cancelled.");
      return;
    }
    runStreaming(`git push ${selected.remote} --delete ${selected.name}`);
    return;
  }

  const deleteMode = await chooseFromList(rl, "Delete mode:", ["safe (-d)", "force (-D)"], 0);
  if (deleteMode === "safe (-d)") {
    const result = tryRunStreaming(`git branch -d ${selected.name}`);
    if (!result.ok) {
      console.log(`Safe delete failed for "${selected.name}" (usually because it is not fully merged).`);
      const confirmForce = (await ask(rl, "Force delete with -D instead? (y/N): ")).toLowerCase();
      if (confirmForce === "y" || confirmForce === "yes") {
        runStreaming(`git branch -D ${selected.name}`);
      } else {
        console.log("Delete cancelled.");
      }
    }
  } else {
    runStreaming(`git branch -D ${selected.name}`);
  }
}

async function checkoutManagerFlow(rl) {
  const selected = await chooseFromList(
    rl,
    "Checkout manager:",
    ["checkout branch", "delete branch", "back"],
    0
  );
  if (selected === "checkout branch") {
    await checkoutFlow(rl);
    return;
  }
  if (selected === "delete branch") {
    await deleteBranchFlow(rl);
    return;
  }
  console.log("Exit.");
}

function printHelp() {
  console.log("Interactive Git Workflow CLI");
  console.log("");
  console.log("Usage:");
  console.log("  bun ./scripts/git-workflow.js                # full interactive menu");
  console.log("  bun ./scripts/git-workflow.js commit-push    # commit + push flow");
  console.log("  bun ./scripts/git-workflow.js branch-create  # create branch flow");
  console.log("  bun ./scripts/git-workflow.js push           # push flow");
  console.log("  bun ./scripts/git-workflow.js checkout       # checkout flow");
  console.log("  bun ./scripts/git-workflow.js checkout-menu  # checkout + delete flow");
  console.log("  bun ./scripts/git-workflow.js delete         # delete branch flow");
}

async function menuFlow(rl) {
  const selected = await chooseFromList(
    rl,
    "Choose action:",
    ["commit + push", "create branch", "push", "checkout", "delete branch", "exit"],
    0
  );

  if (selected === "commit + push") return commitAndPushFlow(rl);
  if (selected === "create branch") return createBranchFlow(rl);
  if (selected === "push") return pushFlow(rl);
  if (selected === "checkout") return checkoutFlow(rl);
  if (selected === "delete branch") return deleteBranchFlow(rl);
  console.log("Exit.");
}

async function main() {
  ensureGitRepo();
  const command = (argv[2] || "").trim();
  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    if (!command) {
      await menuFlow(rl);
      return;
    }
    if (command === "branch-create") {
      await createBranchFlow(rl);
      return;
    }
    if (command === "commit-push") {
      await commitAndPushFlow(rl);
      return;
    }
    if (command === "push") {
      await pushFlow(rl);
      return;
    }
    if (command === "checkout") {
      await checkoutFlow(rl);
      return;
    }
    if (command === "checkout-menu") {
      await checkoutManagerFlow(rl);
      return;
    }
    if (command === "delete") {
      await deleteBranchFlow(rl);
      return;
    }

    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
