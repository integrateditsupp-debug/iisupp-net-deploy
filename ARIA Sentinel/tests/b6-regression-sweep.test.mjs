// RUN-B B6 - regression lock for RUN-B/RUN-D modules and wiring.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
for (const rel of [
  "src/shared/resolution-outcome.mjs",
  "src/shared/value-proof.mjs",
  "src/shared/trust-posture.mjs",
  "src/shared/globe-confirmation.mjs",
  "src/shared/case-study.mjs"
]) assert.equal(existsSync(join(root, rel)), true, `${rel} exists`);

const main = readFileSync(join(root, "src", "main", "main.mjs"), "utf8");
assert.match(main, /recordResolutionOutcome/, "resolution feedback remains wired");
assert.match(main, /valueProofNow/, "value proof remains wired");
assert.match(main, /trustPostureNow/, "trust posture remains wired");
assert.match(main, /emitGlobeConfirmation/, "globe confirmation path remains present");
assert.doesNotMatch(main, /100%\s+sanitization[\s\S]{0,80}certified/i, "no inflated trust certificate copy");

console.log("B6 regression-sweep test passed (RUN-B modules present, gates wired, honesty moat live).");
