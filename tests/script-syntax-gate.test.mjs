#!/usr/bin/env node
// tests/script-syntax-gate.test.mjs — DEFECT-106 guard (Sentinel watcher, 2026-07-28)
//
// DEFECT-106: scripts/regenerate-sitemap.mjs shipped with a mangled PAGES array
// (`{ path: '/compliance/',` on one line, `'/privacy', ... },` on the next) and
// therefore did not parse at all. Nothing in the battery caught it because no test
// ever imported that script.
//
// This gate runs `node --check` over every non-archive .mjs/.js under scripts/,
// netlify/ and the repo root, so an unparseable script can never ship silently again.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Directories we never syntax-gate: vendored code, build output, archived/legacy copies.
const SKIP_DIR = /^(node_modules|\.git|dist|build|coverage|archive|archives|_archive|vendor|backups)$/i;
const SCAN_DIRS = ["scripts", "netlify"];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIR.test(entry)) continue;
      walk(full, out);
    } else if (/\.(mjs|js)$/i.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function rootLevelScripts() {
  return readdirSync(repoRoot)
    .filter((f) => /\.(mjs|js)$/i.test(f))
    .map((f) => path.join(repoRoot, f))
    .filter((f) => {
      try { return statSync(f).isFile(); } catch { return false; }
    });
}

const targets = [
  ...SCAN_DIRS.flatMap((d) => walk(path.join(repoRoot, d))),
  ...rootLevelScripts(),
];

test("every scripts/, netlify/ and root-level JS file parses (node --check)", () => {
  assert.ok(targets.length > 0, "syntax gate found no files to check — scan config is wrong");

  const broken = [];
  for (const file of targets) {
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (err) {
      const detail = (err.stderr?.toString() || err.message || "").split("\n").slice(0, 4).join(" | ");
      broken.push(`${path.relative(repoRoot, file)} -> ${detail}`);
    }
  }

  assert.deepEqual(broken, [], `unparseable script(s):\n  ${broken.join("\n  ")}`);
});
