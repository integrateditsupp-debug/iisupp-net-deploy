// RUN 23c §2 — auto version bump. Pre-build Step 0 of ota-build.bat: read package.json, bump the patch
// (0.1.0 → 0.1.1), write it back, git-tag the bump, and print the new VERSION for downstream steps. Ahmad
// can skip with [no-bump] in the commit SUBJECT (hotfix retry). Pure logic (nextPackageJson) is unit-tested;
// the fs write + git tag run only when the script is invoked directly. 🔒 R11 — touches only the version.
//
// F4 2026-10-14 (audit B20 / M4) — ONE bump, EVERY place. The version lives in exactly these files and this script
// moves all of them together (tests/version-lockstep.test.mjs holds the list):
//   package.json            "version"                       — what Electron's app.getVersion() and the registry read
//   package-lock.json       root "version" (both copies)    — what `npm ci` / `npm version` keep in step
//   src/shared/recipes.mjs  SENTINEL_VERSION_FALLBACK        — the literal used only when package.json is unreadable;
//                                                             tests/version-sync.test.mjs requires it to equal the shipped
//                                                             version (the export itself is DERIVED at runtime, audit M4)
//   docs/RELEASE_NOTES_<v>.md                               — the customer-facing notes for THAT version; a DRAFT stub is
//                                                             created when none exists so "What's new" and the release
//                                                             publishers never point at a file that is not there
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bumpPatch, shouldBump, isSemver } from "../src/shared/ota-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_PATH = path.join(ROOT, "package.json");
const LOCK_PATH = path.join(ROOT, "package-lock.json");
const RECIPES_PATH = path.join(ROOT, "src", "shared", "recipes.mjs");

/** Every file the version is written into, relative to the app root (release notes are per-version). */
export const VERSION_FILES = Object.freeze(["package.json", "package-lock.json", "src/shared/recipes.mjs"]);
export function releaseNotesPath(version) { return `docs/RELEASE_NOTES_${version}.md`; }

const FALLBACK_RE = /(const SENTINEL_VERSION_FALLBACK = ")(\d+\.\d+\.\d+)(")/;

/** Move the fallback literal in src/shared/recipes.mjs TEXT; throws when the literal is not where the test expects it. */
export function nextRecipesFallback(recipesText, to) {
  if (!isSemver(to)) throw new Error(`nextRecipesFallback: bad version "${to}"`);
  if (!FALLBACK_RE.test(recipesText)) throw new Error("recipes.mjs has no SENTINEL_VERSION_FALLBACK literal to bump");
  return recipesText.replace(FALLBACK_RE, `$1${to}$3`);
}

/** Parse package.json text, bump the patch, return {from, to, text}. Throws on a bad version (fail-closed). */
export function nextPackageJson(pkgText, bump = bumpPatch) {
  const pkg = JSON.parse(pkgText);
  const from = pkg.version;
  const to = bump(from);
  pkg.version = to;
  return { from, to, text: JSON.stringify(pkg, null, 2) + "\n" };
}

/** Set the root version in a package-lock.json TEXT (top-level and packages[""]); other content untouched. */
export function nextPackageLock(lockText, to) {
  if (!isSemver(to)) throw new Error(`nextPackageLock: bad version "${to}"`);
  const lock = JSON.parse(lockText);
  lock.version = to;
  if (lock.packages && lock.packages[""] && typeof lock.packages[""] === "object") lock.packages[""].version = to;
  return JSON.stringify(lock, null, 2) + "\n";
}

/** The DRAFT release-notes stub for a version that has none yet (clearly marked; never customer-ready by itself). */
export function releaseNotesStub(version, { from = "", date = new Date().toISOString().slice(0, 10) } = {}) {
  return [
    `# ARIA Sentinel ${version} Release Notes`,
    "",
    `Date: ${date}  `,
    "Audience: DRAFT — written by scripts/version-bump.mjs; replace this stub before the build is published.",
    "",
    "## Status",
    "",
    `DRAFT. This file exists so the ${version} build, its update manifest and the in-app "What's new" point at real notes.`,
    from ? `Start from docs/RELEASE_NOTES_${from}.md: what changed since ${from}, what is NOT in this release, known limits.` : "",
    "",
    "## What changed",
    "",
    "- (fill in)",
    "",
    "## What is NOT in this release",
    "",
    "- (fill in — Rule 14: say what the build does not do)",
    "",
    "## Known limits",
    "",
    "- (fill in)",
    ""
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

/**
 * Pure plan for one bump: given the current texts, return every write. `notesExists` tells whether a notes file for the
 * NEW version already exists (then no stub is written).
 */
export function planBump({ pkgText, lockText = null, recipesText = null, notesExists = false, bump = bumpPatch } = {}) {
  const { from, to, text } = nextPackageJson(pkgText, bump);
  const writes = [{ file: "package.json", text }];
  if (lockText != null) writes.push({ file: "package-lock.json", text: nextPackageLock(lockText, to) });
  if (recipesText != null) writes.push({ file: "src/shared/recipes.mjs", text: nextRecipesFallback(recipesText, to) });
  if (!notesExists) writes.push({ file: releaseNotesPath(to), text: releaseNotesStub(to, { from }) });
  return { from, to, writes };
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
  const lockText = fs.existsSync(LOCK_PATH) ? fs.readFileSync(LOCK_PATH, "utf8") : null;
  const recipesText = fs.existsSync(RECIPES_PATH) ? fs.readFileSync(RECIPES_PATH, "utf8") : null;
  const probe = nextPackageJson(pkgText);
  const notesExists = fs.existsSync(path.join(ROOT, releaseNotesPath(probe.to)));
  const { from, to, writes } = planBump({ pkgText, lockText, recipesText, notesExists });
  for (const w of writes) {
    const abs = path.join(ROOT, w.file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, w.text);
  }
  const touched = writes.map((w) => w.file);
  try { spawnSync("git", ["add", ...touched], { cwd: ROOT }); } catch { /* staging best-effort */ }
  try { spawnSync("git", ["commit", "-m", `[sentinel] bump v${to}`], { cwd: ROOT }); } catch { /* commit best-effort */ }
  try { spawnSync("git", ["tag", `sentinel-v${to}`], { cwd: ROOT }); } catch { /* tag best-effort */ }
  process.stdout.write(`VERSION=${to}\n`);
  console.error(`[version-bump] ${from} → ${to} (tagged sentinel-v${to}) — wrote ${touched.join(", ")}${notesExists ? "" : " (release notes DRAFT stub — fill it in before publishing)"}.`);
  return { bumped: true, from, version: to, files: touched };
}

// CLI: `node scripts/version-bump.mjs`  → bumps + prints VERSION=x.y.z on stdout (for FOR /F in the .bat).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runBump(); } catch (err) { console.error(`[version-bump] FAILED: ${err.message}`); process.exit(1); }
}
