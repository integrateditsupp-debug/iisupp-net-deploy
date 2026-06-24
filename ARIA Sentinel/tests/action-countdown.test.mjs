// RUN 23 §4 — 10s pre-execution countdown gate. Covers the low-risk bypass, the per-second ticks, the
// complete path, every abort path (button / Stop / kill-switch → abort()), the manager's abortAll, and R11.
import assert from "node:assert/strict";
import { shouldCountdown, countdownChatLine, countdownBannerText, createCountdown, createCountdownManager, COUNTDOWN_SECONDS } from "../src/main/action-countdown.mjs";

assert.equal(COUNTDOWN_SECONDS, 10);

// Low-risk no-confirm bypasses the countdown; anything that needs confirm or is medium/high does not.
assert.equal(shouldCountdown({ risk: "low", confirmRequired: false }), false);
assert.equal(shouldCountdown({ risk: "medium", confirmRequired: true }), true);
assert.equal(shouldCountdown({ risk: "high", confirmRequired: true }), true);
assert.equal(shouldCountdown(null), true);

// Copy.
assert.match(countdownChatLine("restart-print-spooler", 8), /About to run `restart-print-spooler` in 8s/);
assert.match(countdownChatLine("restart-print-spooler", 8), /click Stop to abort/);
assert.equal(countdownBannerText("restart-print-spooler", 8), "RUNNING: restart-print-spooler (8s)");

// Injected timer so ticks are deterministic.
function fakeTimer() {
  let cb = null;
  return { set: (fn) => { cb = fn; return 1; }, clear: () => { cb = null; }, fire: () => cb && cb() };
}

// Completes after `seconds` ticks; onTick sees the live remaining each second.
let t = fakeTimer();
const ticks = [];
let completed = false;
const c = createCountdown({ seconds: 3, setIntervalFn: t.set, clearIntervalFn: t.clear, onTick: (r) => ticks.push(r), onComplete: () => { completed = true; } });
c.start();
assert.deepEqual(ticks, [3]);
t.fire(); t.fire(); // 2, 1
assert.deepEqual(ticks, [3, 2, 1]);
t.fire();          // → 0 → complete
assert.equal(completed, true);
assert.equal(c.isPending(), false);

// Abort before completion fires onAbort + aborts the AbortSignal; onComplete never runs.
let t2 = fakeTimer();
let aborted = false, done = false;
const c2 = createCountdown({ seconds: 10, setIntervalFn: t2.set, clearIntervalFn: t2.clear, onAbort: () => { aborted = true; }, onComplete: () => { done = true; } });
c2.start();
t2.fire(); // 9
c2.abort();
assert.equal(aborted, true);
assert.equal(done, false);
assert.equal(c2.signal.aborted, true);
assert.equal(c2.isPending(), false);
// A second abort is a no-op.
c2.abort();
assert.equal(aborted, true);

// Manager aborts all pending countdowns at once (the Ctrl+Alt+K panic path).
const mgr = createCountdownManager();
const a = createCountdown({ seconds: 10, setIntervalFn: fakeTimer().set }).start();
const b = createCountdown({ seconds: 10, setIntervalFn: fakeTimer().set }).start();
mgr.register(a); mgr.register(b);
assert.equal(mgr.size(), 2);
assert.equal(mgr.abortAll(), 2);
assert.equal(a.signal.aborted, true);
assert.equal(b.signal.aborted, true);
assert.equal(mgr.size(), 0);

// 🔒 R11 — a private path inside a recipe id is redacted in the chat line.
assert.doesNotMatch(countdownChatLine("C:/Users/bob/Private pics and Vids/x", 5), /private pics and vids/i);

console.log("Action-countdown test passed (bypass · ticks · complete · abort paths · manager abortAll · R11).");
