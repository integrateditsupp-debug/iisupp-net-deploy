// 🔒 R11 (RUN 23c) — the OTA publish pipeline can never carry the off-limits folder. Versions are strict
// semver (a private string can't become a version — fail-closed), the version record + manifest only ever
// embed a semver version + the signed dist .exe name, and the publishers read only the fixed dist artifact.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bumpPatch, buildVersionRecord, githubAssetUrl, assetName, isSemver } from "../src/shared/ota-release.mjs";
import { buildLatestYml } from "../src/shared/update-manifest.mjs";

const re = /private pics and vids/i;
const PRIV = "C:/Users/bob/Private pics and Vids";

// A private string can never become a version (strict semver gate, fail-closed).
assert.equal(isSemver(PRIV), false);
assert.throws(() => bumpPatch(PRIV), /not a valid/);
assert.throws(() => buildVersionRecord({ version: PRIV, sha512: "x" }), /bad version/);

// A valid record / manifest only embeds the semver version + the signed asset name — never a user path.
const rec = buildVersionRecord({ version: "0.1.1", sha512: "abc", size: 1, releaseNotes: "RUN 23c" });
assert.doesNotMatch(JSON.stringify(rec), re);
assert.doesNotMatch(buildLatestYml({ ...rec, path: assetName("0.1.1") }), re);
assert.doesNotMatch(githubAssetUrl("0.1.1"), re);

// The publishers + the bridge dist-info read ONLY the fixed dist artifact (no arbitrary path interpolation).
const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
for (const f of ["scripts/publish-github-release.mjs", "scripts/publish-manifest.mjs"]) {
  const src = read(f);
  assert.match(src, /assetName\(/, `${f} reads the canonical dist artifact name`);
  assert.doesNotMatch(src, re);
}
// readDistInfo builds the path from package.json version + assetName only.
assert.match(read("src", "main", "main.mjs"), /path\.join\(root, "dist", otaAssetName\(version\)\)/);

console.log("R11-publish-paths test passed (semver fail-closed · record/manifest clean · publishers read only the signed dist artifact).");
