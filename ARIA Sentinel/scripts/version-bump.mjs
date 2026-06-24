// RUN 23c §2 — auto version bump. Pre-build Step 0 of ota-build.bat: read package.json, bump the patch
// (0.1.0 → 0.1.1), write it back, git-tag the bump, and print the new VERSION for downstream steps. Ahmad
// can skip with [no-bump] in the commit message (hotfix retry). Pure logic (nextPackageJson) is unit-tested;
// the fs write + git tag run only when the script is invoked directly. 🔒 R11 — touches only the version.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bumpPatch, shouldBump } from "../src/shared/ota-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_PATH = path.join(ROOT, "package.json");

/** Parse package.json text, bump the patch, return {from, to, text}. Throws on a bad version (fail-closed). */
export function nextPackageJson(pkgText, bump = bumpPatch) {
  const pkg = JSON.parse(pkgText);
  const from = pkg.version;
  const to = bump(from);
  pkg.version = to;
  return { from, to, text: JSON.stringify(pkg, null, 2) + "\n" };
}

/** Read the HEAD commit message (for the [no-bump] opt-out). Best-effort; empty on failure. */
function headCommitMessage() {
  try {
    const r = spawnSync("git", ["log", "-1", "--pretty=%B"], { cwd: ROOT, encoding: "utf8" });
    return r.status === 0 ? String(r.stdout || "").trim() : "";
  } catch { return ""; }
}

export function runBump({ commitMessage } = {}) {
  const msg = commitMessage != null ? commitMessage : headCommitMessage();
  const pkgText = fs.readFileSync(PKG_PATH, "utf8");
  const current = JSON.parse(pkgText).version;
  if (!shouldBump(msg)) {
    process.stdout.write(`VERSION=${current}\n`);
    console.error(`[version-bump] [no-bump] found — keeping ${current}.`);
    return { bumped: false, version: current };
  }
  const { from, to, text } = nextPackageJson(pkgText);
  fs.writeFileSync(PKG_PATH, text);
  try { spawnSync("git", ["add", "package.json"], { cwd: ROOT }); } catch { /* staging best-effort */ }
  try { spawnSync("git", ["commit", "-m", `[sentinel] bump v${to}`], { cwd: ROOT }); } catch { /* commit best-effort */ }
  try { spawnSync("git", ["tag", `sentinel-v${to}`], { cwd: ROOT }); } catch { /* tag best-effort */ }
  process.stdout.write(`VERSION=${to}\n`);
  console.error(`[version-bump] ${from} → ${to} (tagged sentinel-v${to}).`);
  return { bumped: true, from, version: to };
}

// CLI: `node scripts/version-bump.mjs`  → bumps + prints VERSION=x.y.z on stdout (for FOR /F in the .bat).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runBump(); } catch (err) { console.error(`[version-bump] FAILED: ${err.message}`); process.exit(1); }
}
