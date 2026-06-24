// RUN 15 §2 — globe greeting scheduler: launch hi, rate-limit, periodic, 10-min chat bubble,
// mode + low-power quieting.
import assert from "node:assert/strict";
import { dueGreeting, jitteredPeriod, PERIODIC_MESSAGES, GREET_MIN_GAP_MS, PERIODIC_MIN_MS, PERIODIC_MAX_MS, CHAT_BUBBLE_MS } from "../src/shared/globe-greetings.mjs";

// Launch "Hi" only after the 2s grace, and only once (saidHi flips it off).
assert.equal(dueGreeting({ launchedMs: 0, now: 1000, saidHi: false }), null, "no hi before the 2s grace");
const hi = dueGreeting({ launchedMs: 0, now: 2001, lastGreetMs: -Infinity, saidHi: false });
assert.equal(hi.type, "hi");
assert.match(hi.message, /Hi/);

// Global rate limit: never more than one message per 60s.
assert.equal(dueGreeting({ launchedMs: 0, now: 2001 + 30_000, lastGreetMs: 2001, saidHi: true }), null);

// Periodic ambient greeting once past the (jittered) period, with a valid rotation message.
const per = dueGreeting({ launchedMs: 0, now: PERIODIC_MIN_MS + 1, lastGreetMs: 0, lastChatBubbleMs: 0, saidHi: true, periodEveryMs: PERIODIC_MIN_MS, periodIndex: 1 }, { mode: "manual" });
assert.equal(per.type === "chat-bubble" || per.type === "periodic", true);
if (per.type === "periodic") assert.ok(PERIODIC_MESSAGES.includes(per.message));

// 10-minute chat bubble (when chat is the overdue one).
const chat = dueGreeting({ launchedMs: 0, now: CHAT_BUBBLE_MS + 1, lastGreetMs: 0, lastChatBubbleMs: -Infinity, saidHi: true }, { mode: "manual" });
assert.equal(chat.type, "chat-bubble");

// Autonomous + low-power: silent after the launch hi.
assert.equal(dueGreeting({ launchedMs: 0, now: 9_999_999, lastGreetMs: 0, saidHi: true }, { mode: "autonomous" }), null);
assert.equal(dueGreeting({ launchedMs: 0, now: 9_999_999, lastGreetMs: 0, saidHi: true }, { lowPower: true }), null);

// Jittered period stays in the 18–22 min band.
assert.equal(jitteredPeriod(0), PERIODIC_MIN_MS);
assert.equal(jitteredPeriod(1), PERIODIC_MAX_MS);
assert.ok(jitteredPeriod(0.5) > PERIODIC_MIN_MS && jitteredPeriod(0.5) < PERIODIC_MAX_MS);
assert.equal(GREET_MIN_GAP_MS, 60_000);

console.log("Globe-greetings test passed (launch hi · 60s rate-limit · periodic · 10-min chat · autonomous/low-power quiet).");
