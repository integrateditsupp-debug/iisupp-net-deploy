// RUN 21 §4 — keeping ARIA out of startup requires TWO explicit confirmations.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { requiresSecondConfirm, secondConfirmModel, resolveKeepOff } from "../src/main/startup-watchdog.mjs";

// "Keep off" always demands a second confirm; "re-enable" does not.
assert.equal(requiresSecondConfirm("keep-off"), true);
assert.equal(requiresSecondConfirm("re-enable"), false);

// Only when BOTH steps are confirmed does ARIA stay off.
assert.deepEqual(resolveKeepOff(["re-enable"]), { keptOff: false, confirmedSteps: 0, reEnabled: true });
assert.deepEqual(resolveKeepOff(["keep-off"]), { keptOff: false, confirmedSteps: 1, reEnabled: false }, "one confirm is not enough");
assert.deepEqual(resolveKeepOff(["keep-off", "cancel"]), { keptOff: false, confirmedSteps: 1, reEnabled: false }, "cancel at step 2 → stays on");
assert.deepEqual(resolveKeepOff(["keep-off", "yes-keep-off"]), { keptOff: true, confirmedSteps: 2, reEnabled: false }, "two confirms → kept off");

// Second modal copy.
const m = secondConfirmModel();
assert.match(m.title, /will not auto-start/i);
assert.deepEqual(m.actions, ["Cancel", "Yes, keep off"]);

// The renderer implements the two-step confirm on the auto-start toggle.
const renderer = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "renderer", "renderer.js"), "utf8");
assert.match(renderer, /startupDisableDoubleConfirm/, "renderer has the double-confirm flow");
const fn = renderer.match(/function startupDisableDoubleConfirm[\s\S]*?\n\}/);
assert.ok(fn && (fn[0].match(/ctaAction/g) || []).length >= 2, "two confirmation steps before disabling");

console.log("Startup-disable-double-confirm test passed (two confirmations required to keep ARIA off).");
