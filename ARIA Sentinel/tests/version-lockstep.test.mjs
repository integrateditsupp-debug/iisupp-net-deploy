// F4 2026-10-14 (audit B20 / M4) — ONE version, in lockstep, everywhere it is written down.
//
// Three versions were in play on 2026-10-14: package.json 0.2.0, a hand-typed 0.1.16 in the registry, a served 0.1.0
// binary. This suite pins the places the version lives and proves the bump script moves all of them together:
//   package.json · package-lock.json (root, both copies) · src/shared/recipes.mjs fallback literal ·
//   docs/RELEASE_NOTES_<version>.md (customer-facing, must exist for the shipped version) · the sales one-pager footer.
// The build scripts never hard-code a version (they read package.json); the .bat files are parameterised.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { planBump, nextPackageLock, nextRecipesFallback, releaseNotesStub, releaseNotesPath, VERSION_FILES } from "../scripts/version-bump.mjs";
import { SENTINEL_VERSION } from "../src/shared/recipes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const pkg = JSON.parse(read("package.json"));
const V = pkg.version;
assert.match(V, /^\d+\.\d+\.\d+$/, "package.json carries a plain semver");

// 1 — every place agrees with package.json.
const lock = JSON.parse(read("package-lock.json"));
assert.equal(lock.version, V, "package-lock.json root version");
assert.equal(lock.packages[""].version, V, 'package-lock.json packages[""] version');
assert.equal(SENTINEL_VERSION, V, "the registry derives the same version");
const fallback = (read("src/shared/recipes.mjs").match(/const SENTINEL_VERSION_FALLBACK = "([^"]+)"/) || [])[1];
assert.equal(fallback, V, "the recipes.mjs fallback literal is bumped with the version (version-sync requires equality)");
assert.ok(fs.existsSync(path.join(root, releaseNotesPath(V))), `docs/RELEASE_NOTES_${V}.md exists for the shipped version`);
const notes = read(releaseNotesPath(V));
assert.match(notes, new RegExp(`^# ARIA Sentinel ${V.replace(/\./g, "\\.")} Release Notes`), "the release notes title names the version");
assert.doesNotMatch(notes, /Audience: DRAFT/, "the shipped version's notes are not the bump stub");
assert.match(notes, /What is NOT in this release/i, "Rule 14: the notes say what the build does not do");
assert.match(notes, /unsigned/i, "the notes state the signing status");
const onePager = read("sales/ARIA-Sentinel-Sales-One-Pager.md");
assert.ok(onePager.includes(`ARIA Sentinel ${V}`), "the sales one-pager footer carries the current version");
assert.doesNotMatch(onePager, /v?0\.1\.\d+/, "no stale 0.1.x version in the one-pager");
assert.deepEqual([...VERSION_FILES], ["package.json", "package-lock.json", "src/shared/recipes.mjs"], "the bump script's file list is the one this suite checks");

// 2 — the build/publish scripts and .bat files read the version; none hard-codes one.
for (const rel of ["scripts/package-win.mjs", "scripts/publish-manifest.mjs", "scripts/publish-github-release.mjs", "scripts/release-artifacts.mjs", "scripts/customer-build-manifest.mjs"]) {
  const src = read(rel);
  const literals = [...src.matchAll(/["'](\d+\.\d+\.\d+)["']/g)].map((m) => m[1]);
  // Only comment/example literals are allowed; an executable literal would pin a version in a script.
  const executable = literals.filter((v) => !new RegExp(`//[^\\n]*["']${v.replace(/\./g, "\\.")}["']`).test(src) && !new RegExp(`\\*[^\\n]*["']${v.replace(/\./g, "\\.")}["']`).test(src));
  assert.deepEqual(executable, [], `${rel} hard-codes a version: ${executable.join(", ")}`);
}
for (const rel of ["scripts/package-win.mjs", "scripts/publish-manifest.mjs", "scripts/publish-github-release.mjs"]) {
  assert.match(read(rel), /package\.json/, `${rel} reads package.json for the version`);
}
for (const rel of ["build-installer.bat", "force-rebuild-installer.bat", "ota-build.bat", "scripts/backup-current-build.bat", "scripts/package-win.ps1"]) {
  const src = read(rel);
  assert.doesNotMatch(src, /\d+\.\d+\.\d+-(unsigned|setup)\.(exe|msi)/, `${rel} names no versioned artifact literal (parameterised by %VERSION% / package.json)`);
  assert.doesNotMatch(src, /0\.1\.0/, `${rel} carries no 0.1.0 leftover`);
}
// build-installer.bat is self-verifying and honest: every gate is present, and the final message is not a foregone conclusion.
const bat = read("build-installer.bat");
for (const [what, re] of [
  ["node version check", /process\.versions\.node/],
  ["refuses Node < 22", /LSS 22/],
  ["npm ci", /call npm ci/],
  ["npm test gate", /call npm test/],
  ["prints the suite census", /suites taken/],
  ["stops on a red suite", /not allowed to continue on a red suite/i],
  ["package:win (nsis + msi)", /call npm run package:win\s/],
  ["verification step", /package:win:verify/],
  ["certutil SHA-256", /certutil -hashfile/],
  ["signtool verify when present", /signtool verify \/pa/],
  ["signed/unsigned verdict comes from the verifier", /signed\/unsigned verdict/i],
  ["next step: publish", /publish-manifest\.mjs/],
  ["optional signing env outside the repo", /\.aria-sentinel-signing\.bat/],
  ["unsigned builds are named as such", /UNSIGNED pilot build/]
]) assert.match(bat, re, `build-installer.bat: ${what}`);
assert.ok(!/BUILD COMPLETE/.test(bat.split("Step 5/5")[0]), "no 'complete' message before verification");
const ota = read("ota-build.bat");
assert.match(ota, /RELEASE_NOTES_%VERSION%\.md/, "ota-build.bat checks the release notes for the bumped version");
assert.match(ota, /Audience: DRAFT/, "…and warns when they are still the stub");
assert.match(ota, /call npm test/, "ota-build.bat runs the suite before building");
assert.match(ota, /SENTINEL_COPY_TO_PUBLIC/, "copying the installer under public/ is opt-in (installers are not committed)");
assert.match(ota, /ARIA-Sentinel-%VERSION%-setup\.exe/, "the OTA path accepts the signed artifact name");
assert.match(ota, /ARIA-Sentinel-%VERSION%-unsigned\.exe/, "…and the unsigned one");

// 3 — planBump moves every place at once (on fixtures; nothing is written).
const pkgText = JSON.stringify({ name: "aria-sentinel", version: "0.2.1", scripts: { test: "x" }, build: { files: ["package.json"] } }, null, 2) + "\n";
const lockText = JSON.stringify({ name: "aria-sentinel", version: "0.2.1", lockfileVersion: 3, packages: { "": { name: "aria-sentinel", version: "0.2.1" }, "node_modules/x": { version: "1.0.0" } } }, null, 2) + "\n";
const recipesText = 'import { createRequire } from "node:module";\nconst SENTINEL_VERSION_FALLBACK = "0.2.1";\nexport const X = 1;\n';
const plan = planBump({ pkgText, lockText, recipesText, notesExists: false });
assert.equal(plan.from, "0.2.1");
assert.equal(plan.to, "0.2.2");
assert.deepEqual(plan.writes.map((w) => w.file), ["package.json", "package-lock.json", "src/shared/recipes.mjs", "docs/RELEASE_NOTES_0.2.2.md"]);
const w = Object.fromEntries(plan.writes.map((x) => [x.file, x.text]));
assert.equal(JSON.parse(w["package.json"]).version, "0.2.2");
assert.deepEqual(JSON.parse(w["package.json"]).build, { files: ["package.json"] }, "other keys preserved");
const newLock = JSON.parse(w["package-lock.json"]);
assert.equal(newLock.version, "0.2.2");
assert.equal(newLock.packages[""].version, "0.2.2");
assert.equal(newLock.packages["node_modules/x"].version, "1.0.0", "dependency versions untouched");
assert.match(w["src/shared/recipes.mjs"], /const SENTINEL_VERSION_FALLBACK = "0\.2\.2";/);
assert.match(w["src/shared/recipes.mjs"], /export const X = 1;/, "the rest of the file is untouched");
assert.match(w["docs/RELEASE_NOTES_0.2.2.md"], /^# ARIA Sentinel 0\.2\.2 Release Notes/);
assert.match(w["docs/RELEASE_NOTES_0.2.2.md"], /Audience: DRAFT/, "a generated stub is marked DRAFT so it can never pass as customer-ready");
assert.match(w["docs/RELEASE_NOTES_0.2.2.md"], /RELEASE_NOTES_0\.2\.1\.md/, "the stub points at the previous notes");
assert.deepEqual(planBump({ pkgText, notesExists: true }).writes.map((x) => x.file), ["package.json"], "no lock/recipes text → only package.json; existing notes → no stub");
assert.throws(() => nextPackageLock("{}", "nope"), /bad version/);
assert.throws(() => nextRecipesFallback("export const Y = 2;", "0.2.2"), /no SENTINEL_VERSION_FALLBACK/);
assert.throws(() => planBump({ pkgText: JSON.stringify({ version: "bad" }) }), /not a valid/);
assert.match(releaseNotesStub("1.0.0", { from: "0.9.9", date: "2026-01-01" }), /Date: 2026-01-01/);
assert.equal(releaseNotesPath("0.2.1"), "docs/RELEASE_NOTES_0.2.1.md");

console.log(`version-lockstep test passed (${V} in package.json · package-lock · recipes fallback · release notes · one-pager · scripts read package.json · bats parameterised · planBump moves all 4 places).`);
