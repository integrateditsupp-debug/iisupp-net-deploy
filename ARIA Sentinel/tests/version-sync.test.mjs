// PROD 2026-10-14 (audit M4) — ONE version, everywhere.
//
// src/shared/recipes.mjs carried a hand-typed SENTINEL_VERSION that went stale twice ("0.1.0" while 0.1.16
// shipped; "0.1.16" while 0.2.0 shipped), so the About tab, /health, the heartbeat, the user-agent, the update
// check (?version=…), the evidence pack and "What's new" all reported the wrong build. Now the registry DERIVES it
// from package.json (literal fallback only when the manifest is unreadable) and main.mjs reads app.getVersion(),
// which Electron takes from the same package.json in dev and in the packaged app.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SENTINEL_VERSION } from "../src/shared/recipes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const recipesSrc = fs.readFileSync(path.join(root, "src/shared/recipes.mjs"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");

// 1 — the exported constant equals package.json.version, and is a real semver-ish string.
assert.equal(SENTINEL_VERSION, pkg.version, `SENTINEL_VERSION (${SENTINEL_VERSION}) must equal package.json version (${pkg.version})`);
assert.match(SENTINEL_VERSION, /^\d+\.\d+\.\d+/);

// 2 — it is DERIVED, not typed: the source reads package.json through createRequire and keeps only a fallback literal.
assert.match(recipesSrc, /createRequire\(import\.meta\.url\)\("\.\.\/\.\.\/package\.json"\)\.version/, "derived from package.json");
assert.match(recipesSrc, /export const SENTINEL_VERSION = readPackageVersion\(\);/, "the export is the derived value");
assert.doesNotMatch(recipesSrc, /export const SENTINEL_VERSION = "\d/, "no hand-typed exported literal");
// The fallback literal is allowed to exist but must not be the thing that is exported — and it is kept current.
const fallback = (recipesSrc.match(/const SENTINEL_VERSION_FALLBACK = "([^"]+)"/) || [])[1];
assert.ok(fallback, "a fallback literal exists for an unreadable manifest");
assert.match(fallback, /^\d+\.\d+\.\d+$/, "the fallback is a plain semver");
const cmp = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
assert.ok(cmp(fallback, pkg.version) <= 0, "the fallback literal never claims a version NEWER than package.json");

// 3 — main.mjs reports app.getVersion() (Electron's read of package.json) with the registry value as its fallback.
assert.match(main, /SENTINEL_VERSION as REGISTRY_VERSION/, "main imports the registry version under a fallback name");
assert.match(main, /const SENTINEL_VERSION = \(\(\) => \{ try \{ const v = app\.getVersion\(\);/, "main derives its version from app.getVersion()");
assert.doesNotMatch(main, /["']0\.1\.\d+["']/, "no stale 0.1.x literal anywhere in main");

// 4 — nothing in the main process or the shared registry still hard-codes a different version string.
for (const rel of ["src/main/main.mjs", "src/shared/recipes.mjs", "src/main/heartbeat.mjs", "src/shared/auto-update.mjs"]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const literals = [...src.matchAll(/["'](\d+\.\d+\.\d+)["']/g)].map((m) => m[1]).filter((v) => v !== pkg.version);
  // Test fixtures inside comments are fine; an executable literal that differs from the shipped version is not.
  const executable = literals.filter((v) => !new RegExp(`//[^\\n]*["']${v.replace(/\./g, "\\.")}["']`).test(src));
  assert.deepEqual(executable, [], `${rel} carries a version literal that is not the shipped version: ${executable.join(", ")}`);
}

console.log(`version-sync test passed (SENTINEL_VERSION ${SENTINEL_VERSION} == package.json · derived via createRequire · main uses app.getVersion() · no stale literals).`);
