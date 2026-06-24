// RUN 10 — auto-update manifest parse + version compare.
import assert from "node:assert/strict";
import { parseUpdateManifest, updateAvailable } from "../src/shared/auto-update.mjs";

// GitHub Releases-style listing → latest .exe.
const releases = [
  { tag_name: "v0.1.0", assets: [{ name: "ARIA-Sentinel-0.1.0-unsigned.exe", browser_download_url: "https://example.com/0.1.0.exe" }] },
  { tag_name: "v0.2.0", assets: [{ name: "ARIA-Sentinel-0.2.0-unsigned.exe", browser_download_url: "https://example.com/0.2.0.exe" }] },
  { tag_name: "v0.1.5", draft: true, assets: [{ name: "x.exe", browser_download_url: "u" }] }
];
const latest = parseUpdateManifest(releases);
assert.equal(latest.version, "0.2.0", "picks the highest non-draft version");
assert.match(latest.downloadUrl, /0\.2\.0\.exe$/, "resolves the .exe asset");

// Version compare.
assert.equal(updateAvailable("0.1.0", latest), true, "0.1.0 < 0.2.0 → update available");
assert.equal(updateAvailable("0.2.0", latest), false, "current = latest → none");
assert.equal(updateAvailable("0.3.0", latest), false, "ahead of latest → none");

// Single-object manifest + no assets.
const single = parseUpdateManifest({ version: "1.0.0", html_url: "https://example.com/r" });
assert.equal(single.version, "1.0.0");
assert.equal(single.downloadUrl, "https://example.com/r", "falls back to release page when no .exe asset");

// Garbage / empty.
assert.equal(parseUpdateManifest([]), null);
assert.equal(parseUpdateManifest([{ tag_name: "not-a-version" }]), null);
assert.equal(updateAvailable("0.1.0", null), false);

console.log("Auto-update test passed (manifest parse · .exe asset · version compare · garbage-safe).");
