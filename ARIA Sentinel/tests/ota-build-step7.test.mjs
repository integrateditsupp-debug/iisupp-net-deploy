// RUN 23c §7 → RUN 23e — ota-build.bat is parameterized by %VERSION% (Step 0 bump) and auto-publishes,
// with failure paths that don't abort earlier steps. RUN 23e collapsed the admin build, so the OTA
// publish moved from Step 7 to Step 6 (single build).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bat = fs.readFileSync(path.join(root, "ota-build.bat"), "utf8");

// Step 0 — version bump drives %VERSION%; an empty VERSION is a hard stop (fail-closed).
assert.match(bat, /Step 0:.*version bump/i);
assert.match(bat, /node scripts\\version-bump\.mjs/);
assert.match(bat, /if not defined VERSION/i, "abort if the bump failed");

// The build is fully parameterized — no hardcoded 0.1.0 left.
assert.doesNotMatch(bat, /0\.1\.0/, "no hardcoded version remains");
assert.match(bat, /ARIA-Sentinel-%VERSION%-unsigned\.exe/);

// RUN 23e — single build: exactly one electron-builder invocation (no separate admin build step).
assert.match(bat, /npm run package:win\b/, "builds via package:win");
assert.doesNotMatch(bat, /package:win:admin/, "no separate admin build step");

// Auto-publish to GitHub Release + manifest, non-blocking (a failure jumps to :continue, keeping dist).
assert.match(bat, /Step 6:.*publish/i, "OTA publish is now Step 6 (single build)");
assert.match(bat, /node scripts\\publish-github-release\.mjs %VERSION%/);
assert.match(bat, /node scripts\\publish-manifest\.mjs %VERSION%/);
assert.match(bat, /goto :continue/, "github publish failure does not abort the build");
assert.match(bat, /:continue/);

console.log("Ota-build-step7 test passed (RUN 23e: Step 0 bump → %VERSION% · single package:win build · Step 6 auto-publish · non-blocking failure).");
