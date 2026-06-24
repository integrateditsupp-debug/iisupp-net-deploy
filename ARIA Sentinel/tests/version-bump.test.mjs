// RUN 23c §2 — version bump + shared OTA-release helpers. Pure logic only (no fs/git side effects fire on
// import — the script's runBump is behind an import.meta.url guard).
import assert from "node:assert/strict";
import { isSemver, bumpPatch, shouldBump, releaseTag, assetName, githubAssetUrl, buildVersionRecord, GITHUB_OWNER, GITHUB_REPO } from "../src/shared/ota-release.mjs";
import { nextPackageJson } from "../scripts/version-bump.mjs";

// semver guard + patch bump.
assert.equal(isSemver("0.1.0"), true);
assert.equal(isSemver("0.1"), false);
assert.equal(isSemver("v0.1.0"), false);
assert.equal(bumpPatch("0.1.0"), "0.1.1");
assert.equal(bumpPatch("0.1.9"), "0.1.10");
assert.equal(bumpPatch("1.2.34"), "1.2.35");
assert.throws(() => bumpPatch("0.1"), /not a valid/, "fail-closed on bad version");
assert.throws(() => bumpPatch("nope"), /not a valid/);

// [no-bump] opt-out.
assert.equal(shouldBump("[sentinel] RUN 24: feature"), true);
assert.equal(shouldBump("hotfix retry [no-bump]"), false);
assert.equal(shouldBump("[NO-BUMP] case-insensitive"), false);
// RUN 23e hotfix — [no-bump] is SUBJECT-LINE-ONLY (a body mention must not silently skip the bump).
assert.equal(shouldBump("[sentinel] hotfix [no-bump]"), false, "subject [no-bump] → skip");
assert.equal(shouldBump("[sentinel] RUN 23c: feature\n\nThe body documents the [no-bump] flag for hotfixes."), true, "body mention → still bumps");
assert.equal(shouldBump(""), true, "empty message → bumps");

// release tag / asset / GitHub url.
assert.equal(releaseTag("0.1.1"), "sentinel-v0.1.1");
assert.equal(assetName("0.1.1"), "ARIA-Sentinel-0.1.1-unsigned.exe");
assert.equal(githubAssetUrl("0.1.1"), `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/sentinel-v0.1.1/ARIA-Sentinel-0.1.1-unsigned.exe`);

// version record posted to /aria-sentinel-update-publish.
const rec = buildVersionRecord({ version: "0.1.2", sha512: "abc", size: 123, releaseNotes: "notes", mandatory: true, releaseDate: "2026-06-21T00:00:00.000Z" });
assert.equal(rec.version, "0.1.2");
assert.equal(rec.sha512, "abc");
assert.equal(rec.size, 123);
assert.match(rec.url, /github\.com.*sentinel-v0\.1\.2.*ARIA-Sentinel-0\.1\.2-unsigned\.exe/);
assert.equal(rec.mandatory, true);
assert.throws(() => buildVersionRecord({ version: "bad" }), /bad version/);

// nextPackageJson bumps the version + stays valid JSON, preserving other fields.
const pkgText = JSON.stringify({ name: "aria-sentinel", version: "0.1.0", dependencies: { "electron-store": "^8.2.0" } }, null, 2);
const { from, to, text } = nextPackageJson(pkgText);
assert.equal(from, "0.1.0");
assert.equal(to, "0.1.1");
const parsed = JSON.parse(text);
assert.equal(parsed.version, "0.1.1");
assert.equal(parsed.name, "aria-sentinel", "other fields preserved");
assert.ok(text.endsWith("\n"), "trailing newline");

console.log("Version-bump test passed (semver guard · patch bump · [no-bump] · tag/asset/url · version record · package.json rewrite).");
