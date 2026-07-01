#!/usr/bin/env node
// tests/deploy-safety-denylist.test.mjs — SECURITY LOCKDOWN 2026-07-01
// publish dir = "." → every git-tracked path ships to clones AND the live deploy.
// This test walks `git ls-files` and FAILS if any internal path is tracked, making
// the CLAUDE.md/vault leak class impossible to reintroduce silently.
// Packet: documents/product-engineering/SECURITY-LOCKDOWN-PACKET-CC-2026-07-01.md
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
const files = out.toString("utf8").split("\0").filter(Boolean);

// ARIA Sentinel is the one exception: its recipe/build scripts (*.ps1/*.bat) and CLAUDE.md
// are desktop-product source that must stay in git; the whole tree is force-404'd live
// via the /ARIA Sentinel/* redirect, so it never serves.
const SENTINEL_PREFIX = "ARIA Sentinel/";

const DENY_PREFIXES = [
  "aria-vault/",
  "senior-director-state/",
  "documents/",
  "ARIA-Vault-Backups/",
  "backups/",
  "_vault-backups",
];

const violations = files.filter((f) => {
  if (DENY_PREFIXES.some((p) => f.startsWith(p))) return true;
  if (f.startsWith(SENTINEL_PREFIX)) return false;
  if (f === "CLAUDE.md" || f.endsWith("/CLAUDE.md")) return true;
  if (/\.(cmd|bat|ps1)$/i.test(f)) return true;
  if (f.toLowerCase().endsWith(".tar.gz")) return true;
  return false;
});

if (violations.length) {
  console.error(`DEPLOY-SAFETY DENYLIST — ${violations.length} internal path(s) tracked by git (must NEVER ship):`);
  for (const v of violations.slice(0, 50)) console.error("  " + v);
  if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`);
  throw new Error(`deploy-safety-denylist: ${violations.length} denylisted path(s) tracked — run \`git rm --cached\` on them before committing.`);
}

console.log(`deploy-safety-denylist: OK — 0 of ${files.length} tracked paths match the internal denylist.`);
