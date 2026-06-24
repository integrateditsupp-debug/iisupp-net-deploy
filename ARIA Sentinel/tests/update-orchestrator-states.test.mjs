// RUN 21 §2 — 3-strike state machine: FRESH → STRIKE1 → STRIKE2 → STRIKE3 → AUTO, with the window
// elapsing between each, and state surviving a restart (HMAC seal/open round-trip).
import assert from "node:assert/strict";
import { detect, advance, isNoticeDue, userChoice } from "../src/main/update-orchestrator.mjs";
import { sealState, openState, STRIKE_WINDOW_MS, MANDATORY_WINDOW_MS } from "../src/shared/update-state.mjs";

const DAY = 24 * 60 * 60 * 1000;
let now = Date.parse("2026-06-21T20:00:00.000Z");

// Detect → FRESH (first notice, strike 0).
let s = detect(null, "0.3.0", now);
assert.equal(s.phase, "FRESH");
assert.equal(s.strike, 0);
assert.equal(s.version, "0.3.0");

// Not due before the window elapses.
assert.equal(isNoticeDue(s, now + 1000), false);

// Each 24h window advances one phase + bumps the strike counter.
const expect = [["STRIKE1", 1], ["STRIKE2", 2], ["STRIKE3", 3], ["AUTO", 3]];
for (const [phase, strike] of expect) {
  now += DAY + 1000;
  assert.equal(isNoticeDue(s, now), true, `due before ${phase}`);
  s = advance(s, now);
  assert.equal(s.phase, phase);
  assert.equal(s.strike, strike);
}
// AUTO is terminal for the strike walk (no further advance).
assert.equal(isNoticeDue(s, now + DAY), false, "AUTO does not keep striking");

// State persists across a restart via the signed seal.
const reopened = openState(sealState(s, "device-key"), "device-key");
assert.equal(reopened.phase, "AUTO");
assert.equal(reopened.strike, 3);
assert.equal(reopened.version, "0.3.0");
// A tampered seal falls back to the safe default (can't be edited to dodge the patch).
assert.equal(openState(sealState(s, "device-key").replace("AUTO", "IDLE"), "device-key").phase, "IDLE");

// "Install" at any phase ends in INSTALLED; "later" just re-arms the timer.
assert.equal(userChoice(detect(null, "0.3.0", now), "install", now).phase, "INSTALLED");
const later = userChoice(detect(null, "0.3.0", now), "later", now + 5000);
assert.equal(later.phase, "FRESH");
assert.equal(later.lastNoticeAt, new Date(now + 5000).toISOString());

// Mandatory updates use the compressed 3h window, not 24h.
assert.equal(MANDATORY_WINDOW_MS, 3 * 60 * 60 * 1000);
assert.equal(STRIKE_WINDOW_MS, 24 * 60 * 60 * 1000);
let m = detect(null, "0.4.0", now, { mandatory: true });
assert.equal(isNoticeDue(m, now + 2 * 60 * 60 * 1000), false, "mandatory not due at 2h");
assert.equal(isNoticeDue(m, now + 3 * 60 * 60 * 1000 + 1000), true, "mandatory due at 3h");

console.log("Update-orchestrator-states test passed (FRESH→S1→S2→S3→AUTO · persists across restart · mandatory 3h window).");
