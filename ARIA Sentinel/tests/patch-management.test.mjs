// RUN 11 — patch management. Vendor version checks are pinned to an official-host allowlist, carry
// 0 user content, and a patch plan ALWAYS requires a restore point before install.
import assert from "node:assert/strict";
import {
  PATCH_VENDOR_ALLOWLIST,
  SUPPORTED_VENDORS,
  isVendorHostAllowed,
  patchNeeded,
  buildPatchPlan
} from "../src/shared/patch-management.mjs";

// 6 vendors ship: Chrome, Edge, Firefox, Adobe, Zoom, Java.
assert.deepEqual(SUPPORTED_VENDORS.sort(), ["adobe", "chrome", "edge", "firefox", "java", "zoom"]);
assert.equal(Object.keys(PATCH_VENDOR_ALLOWLIST).length, 6);

// Allowlist enforcement — only the pinned official hosts (and subdomains) pass.
assert.equal(isVendorHostAllowed("versionhistory.googleapis.com"), true);
assert.equal(isVendorHostAllowed("product-details.mozilla.org"), true);
assert.equal(isVendorHostAllowed("evil.com"), false);
assert.equal(isVendorHostAllowed("versionhistory.googleapis.com.evil.com"), false, "suffix spoof rejected");

// Version comparison.
assert.equal(patchNeeded("120.0.1", "121.0.0"), true);
assert.equal(patchNeeded("121.0.0", "121.0.0"), false);
assert.equal(patchNeeded("122.0.0", "121.0.0"), false, "ahead = no patch");
assert.equal(patchNeeded("garbage", "121"), false, "garbage never reports needs-update");

// Patch plan: anything behind → one PATCH.AVAILABLE signal + restore-point required.
const plan = buildPatchPlan({
  vendors: { chrome: { installed: "120.0.0", latest: "121.0.0" }, zoom: { installed: "5.0", latest: "5.0" } },
  windowsMissing: 2
});
assert.deepEqual(plan.signals, [{ signal: "PATCH.AVAILABLE", hint: "patch-available" }]);
assert.equal(plan.vendors.length, 1, "only the behind vendor is listed (chrome)");
assert.equal(plan.vendors[0].vendor, "chrome");
assert.equal(plan.windowsMissing, 2);
assert.equal(plan.requiresRestorePoint, true, "a restore point is required before any install");

// Nothing behind → no signal, no restore point.
const clean = buildPatchPlan({ vendors: { chrome: { installed: "121.0.0", latest: "121.0.0" } }, windowsMissing: 0 });
assert.deepEqual(clean.signals, []);
assert.equal(clean.requiresRestorePoint, false);

// 0 user content: the plan carries only vendor names + version numbers (no path/host/user data).
assert.ok(!/@|C:\\|http/.test(JSON.stringify(plan)), "patch plan is content-blind");

console.log("Patch-management test passed (6 vendors · pinned allowlist · version compare · restore-point-before-install · content-blind).");
