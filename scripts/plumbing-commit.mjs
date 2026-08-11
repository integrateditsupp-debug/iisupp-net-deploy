#!/usr/bin/env node
// plumbing-commit.mjs — RUN-AU / AU4 support.
//
// AR3 recorded this environment's git boundary as a FACT rather than a failure: the mount's `.git`
// accepts create and overwrite and REFUSES unlink, so `.git/index.lock` is permanent and every
// porcelain write (`git add`, `git commit`) is blocked for the life of the environment. Three cycles
// have re-derived the same workaround by hand at the end of a long run, which is exactly when a
// mistake costs the most. This makes it a script.
//
// The path, verified and unchanged: a PRIVATE index file (never `.git/index`) → read-tree HEAD →
// add the named paths → write-tree → commit-tree → overwrite `.git/refs/heads/<branch>`.
//
// The safety that matters most is at the end: HEAD is re-read immediately before the ref is
// overwritten, and the write ABORTS if it moved. RUN-AT had a concurrent commit land mid-cycle; it
// was parented onto rather than clobbered because of this check. Keep it.
//
//   node scripts/plumbing-commit.mjs --message "..." --file a --file b [--branch main] [--dry-run]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const git = (args, opts = {}) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
  ...opts,
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...(opts.env || {}) },
}).trim();

export function plumbingCommit({ message, files, branch = "main", dryRun = false }) {
  if (!message || !message.trim()) throw new Error("a commit without a message is a commit nobody can review");
  if (!files || !files.length) throw new Error("no files named; a commit that guesses its own contents is not a commit");

  const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length) throw new Error(`named but not on disk: ${missing.join(", ")}`);

  const ref = `refs/heads/${branch}`;
  const before = git(["rev-parse", ref]);
  const indexFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "plumbing-index-")), "index");
  const env = { GIT_INDEX_FILE: indexFile };

  try {
    git(["read-tree", before], { env });
    // Chunked so a long file list cannot overflow the argument limit and silently drop a path.
    for (let i = 0; i < files.length; i += 40) git(["add", "--", ...files.slice(i, i + 40)], { env });
    const tree = git(["write-tree"], { env });

    if (tree === git(["rev-parse", `${before}^{tree}`])) {
      return { ok: true, wrote: false, reason: "the tree is identical to HEAD; nothing to commit", before, tree };
    }

    const commit = git(["commit-tree", tree, "-p", before, "-m", message], { env });
    if (dryRun) return { ok: true, wrote: false, reason: "dry run", before, tree, commit };

    // Re-read HEAD immediately before the overwrite. If it moved, abort rather than clobber.
    const now = git(["rev-parse", ref]);
    if (now !== before) {
      return { ok: false, wrote: false, before, now, commit, reason: `${ref} moved during this cycle (${before} → ${now}); refusing to clobber a concurrent commit` };
    }

    fs.writeFileSync(path.join(root, ".git", ref), `${commit}\n`);
    const landed = git(["rev-parse", ref]);
    if (landed !== commit) return { ok: false, wrote: false, before, commit, landed, reason: "the ref did not take the write" };

    return { ok: true, wrote: true, before, tree, commit, files: files.length };
  } finally {
    fs.rmSync(path.dirname(indexFile), { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const take = (flag) => { const i = argv.indexOf(flag); return i === -1 ? null : argv[i + 1]; };
  const files = argv.reduce((acc, a, i) => (a === "--file" ? [...acc, argv[i + 1]] : acc), []);
  const listFile = take("--file-list");
  const all = listFile ? [...files, ...fs.readFileSync(listFile, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)] : files;
  const res = plumbingCommit({ message: take("--message"), files: all, branch: take("--branch") || "main", dryRun: argv.includes("--dry-run") });
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}
