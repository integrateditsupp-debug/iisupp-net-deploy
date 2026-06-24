// RUN 15 §2 — globe v3 anchor math + teleport-back + greeting schedule.
import assert from "node:assert/strict";
import { anchorTarget, tickAnchored, atAnchor, IDLE_TELEPORT_MS } from "../src/shared/globe-anchor.mjs";
import { dueGreeting, jitteredPeriod, GREET_MIN_GAP_MS, CHAT_BUBBLE_MS } from "../src/shared/globe-greetings.mjs";

// Anchor = top-centre of the focused window.
const bounds = { x: 100, y: 50, width: 1280, height: 820 };
const target = anchorTarget(bounds, 104, 12);
assert.equal(target.x, Math.round(100 + (1280 - 104) / 2));
assert.equal(target.y, 62);

// Cursor near the globe pushes it away.
let s = { x: target.x, y: target.y, vx: 0, vy: 0, lastNearMs: -Infinity };
const cursorOnGlobe = { x: target.x + 70, y: target.y + 52 }; // near, off-centre so there's a push direction
const pushed = tickAnchored(s, { cursor: cursorOnGlobe, target, now: 1000, size: 104 });
assert.ok(pushed.x !== target.x || pushed.y !== target.y, "globe moves away from a near cursor");
assert.equal(pushed.lastNearMs, 1000);

// After 2s with no nearby cursor → teleports back toward the anchor.
let drift = { x: target.x + 200, y: target.y + 120, vx: 0, vy: 0, lastNearMs: 0 };
for (let t = IDLE_TELEPORT_MS; t < IDLE_TELEPORT_MS + 4000; t += 16) {
  drift = tickAnchored(drift, { cursor: { x: 9999, y: 9999 }, target, now: t, size: 104 });
}
assert.ok(atAnchor(drift, target), `globe returns to anchor (${drift.x},${drift.y} vs ${target.x},${target.y})`);

// Greeting schedule.
// Launch "Hi" after the 2s grace, once.
const hi = dueGreeting({ launchedMs: 0, now: 2500, lastGreetMs: -Infinity, saidHi: false });
assert.equal(hi.type, "hi");
// Rate limit: nothing within 60s of the last greeting.
assert.equal(dueGreeting({ launchedMs: 0, now: 2500 + 30000, lastGreetMs: 2500, saidHi: true }), null, "≤1 message / 60s");
// Autonomous + low-power stay quiet after hi.
assert.equal(dueGreeting({ launchedMs: 0, now: 9_999_999, lastGreetMs: 0, saidHi: true }, { mode: "autonomous" }), null);
assert.equal(dueGreeting({ launchedMs: 0, now: 9_999_999, lastGreetMs: 0, saidHi: true }, { lowPower: true }), null);
// 10-min chat bubble in manual.
const chat = dueGreeting({ launchedMs: 0, now: CHAT_BUBBLE_MS + 1, lastGreetMs: 0, lastChatBubbleMs: -Infinity, saidHi: true }, { mode: "manual" });
assert.equal(chat.type, "chat-bubble");
// Jittered period is in the 18–22 min band.
assert.ok(jitteredPeriod(0) >= 18 * 60 * 1000 && jitteredPeriod(1) <= 22 * 60 * 1000);

console.log("Globe-anchor test passed (top-centre anchor · cursor repel · 2s teleport-back · greeting schedule + rate-limit).");
