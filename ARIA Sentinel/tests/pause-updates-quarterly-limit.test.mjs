// RUN 21 §7 — "Pause updates 7 days" is allowed at most ONCE per calendar quarter (vacation / critical
// period), and extends each strike window by 7 days while active.
import assert from "node:assert/strict";
import { canPause, recordPause, quarterOf, pauseExtensionMs } from "../src/main/update-orchestrator.mjs";
import { defaultUpdateState } from "../src/shared/update-state.mjs";

const q2 = Date.parse("2026-05-10T00:00:00Z"); // Q2
const q2b = Date.parse("2026-06-20T00:00:00Z"); // still Q2
const q3 = Date.parse("2026-07-10T00:00:00Z"); // Q3

assert.equal(quarterOf(q2), "2026-Q2");
assert.equal(quarterOf(q3), "2026-Q3");

let s = defaultUpdateState();
// First pause this quarter → allowed.
assert.equal(canPause(s, q2), true);
const r1 = recordPause(s, q2);
assert.equal(r1.ok, true);
s = r1.state;
assert.equal(s.pauses.length, 1);

// Second pause SAME quarter → blocked.
assert.equal(canPause(s, q2b), false);
const r2 = recordPause(s, q2b);
assert.equal(r2.ok, false);
assert.match(r2.reason, /quarter/i);
assert.equal(r2.state.pauses.length, 1, "blocked pause is not recorded");

// New quarter → allowed again.
assert.equal(canPause(s, q3), true);
assert.equal(recordPause(s, q3).ok, true);

// An active pause extends the strike window (≈7 days of extra slack right after the pause).
const fresh = recordPause(defaultUpdateState(), q3).state;
assert.ok(pauseExtensionMs(fresh, q3 + 1000) > 6 * 24 * 60 * 60 * 1000, "active pause adds ~7d");
assert.equal(pauseExtensionMs(fresh, q3 + 8 * 24 * 60 * 60 * 1000), 0, "expired pause adds nothing");

console.log("Pause-updates-quarterly-limit test passed (1 per quarter · extends strike window 7d · resets next quarter).");
