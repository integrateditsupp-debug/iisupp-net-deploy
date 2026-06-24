// RUN 14 — auto-update feed URL carries the license key, and the privacy path-allowlist grows by
// EXACTLY two (manifest + binary prefix) with nothing else from iisupp.net getting through.
import assert from "node:assert/strict";
import { buildFeedUrl, UPDATE_MANIFEST_PATH } from "../src/shared/auto-update.mjs";
import { isUpdatePathAllowed, UPDATE_OUTBOUND_PATHS, CAPTURE_HOST_ALLOWLIST } from "../src/shared/network-capture.mjs";
import { ALLOWED_OUTBOUND_PATHS } from "../src/shared/recipes.mjs";

// Feed URL: generic provider URL on iisupp.net with the license key as a query param.
const url = buildFeedUrl("LIC-KEY-123");
assert.match(url, /^https:\/\/iisupp\.net\/\.netlify\/functions\/aria-sentinel-update-manifest\?license=LIC-KEY-123$/);
assert.ok(url.includes(UPDATE_MANIFEST_PATH));
// Keys are URL-encoded.
assert.match(buildFeedUrl("a b/c"), /license=a%20b%2Fc/);

// EXACTLY two update paths in the allowlist.
assert.equal(UPDATE_OUTBOUND_PATHS.length, 2, "exactly +2 paths");
assert.equal(isUpdatePathAllowed("/.netlify/functions/aria-sentinel-update-manifest"), true);
assert.equal(isUpdatePathAllowed("/sentinel-binaries/ARIA-Sentinel-0.1.1-unsigned.exe"), true, "binary prefix allowed");
// Nothing else from iisupp.net is an allowed UPDATE path.
assert.equal(isUpdatePathAllowed("/.netlify/functions/aria-chat"), false);
assert.equal(isUpdatePathAllowed("/sentinel-admin/secrets"), false);
assert.equal(isUpdatePathAllowed("/"), false);

// The two paths are recorded in ALLOWED_OUTBOUND_PATHS for the verifier/registry.
const ids = ALLOWED_OUTBOUND_PATHS.map((p) => p.id);
assert.ok(ids.includes("update-manifest") && ids.includes("update-binary"), "both update paths documented");

// The runtime 6-host telemetry verifier allowlist is UNCHANGED (still 6 hosts).
assert.equal(CAPTURE_HOST_ALLOWLIST.length, 6, "6-host verifier untouched");

console.log("Update-feedurl test passed (license in feed URL · exactly +2 paths · 6-host verifier unchanged).");
