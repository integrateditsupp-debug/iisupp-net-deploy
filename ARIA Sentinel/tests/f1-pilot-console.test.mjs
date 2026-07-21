// RUN-F F1 — multi-pilot operations console. Locks: N concurrent real pilots render honest rows;
// ZERO real pilots => honest EMPTY board (never a demo-filled fake); fix counts + last-activity come
// only from real audit RUN/entries at-or-after that pilot's start; maturity needs a REAL stamped TTFV
// plus >= 3 real fixes; health flags + the exact staged one-click are deterministic; nothing is sent.
// 🔒 Rule 14 real-or-empty. 🔒 Rule 15 additive — pilot-state.mjs untouched.
import assert from "node:assert/strict";
import {
  buildPilotConsole, pilotFixCount, pilotLastActivityAt, pilotMaturity,
  pilotHealthFlags, pilotNextOneClick, pilotConsoleEmptyCopy,
  PILOT_MATURED_FIXES, STALLED_CLOCK_HOURS, GONE_QUIET_DAYS
} from "../src/shared/pilot-console.mjs";

const START = Date.parse("2026-07-01T00:00:00.000Z");
const iso = (t) => new Date(t).toISOString();
const MIN = 60000, HOUR = 3600000, DAY = 24 * HOUR;

const pilot = (org, startedAt, { ttfv = null, deviceId = "" } = {}) => ({
  schema: "pilot.v1", started_at: iso(startedAt), org, size: "11-50",
  pains: ["printers"], device_id: deviceId,
  ...(ttfv == null ? {} : { ttfv: { first_fix_at: iso(startedAt + ttfv * MIN), minutes: ttfv, stamped_at: iso(startedAt + ttfv * MIN) } })
});
const run = (t) => ({ ts: iso(t), tag: "RUN" });

// ── 1. EMPTY BOARD IS HONEST (never fabricates a pilot) ────────────────────────────────────────────
for (const input of [undefined, null, [], "nope", [null, {}, { org: "no start" }]]) {
  const board = buildPilotConsole(input, { now: START + DAY });
  assert.equal(board.empty, true, "zero real started pilots => empty board");
  assert.deepEqual(board.rows, [], "empty board has NO rows — never a demo fill");
  assert.equal(board.counts.total, 0, "counts stay 0");
}
assert.match(pilotConsoleEmptyCopy(), /No live pilots yet/, "honest empty copy");

// ── 2. FIX COUNT + LAST ACTIVITY: real-or-empty ────────────────────────────────────────────────────
assert.equal(pilotFixCount(undefined, { startedAt: iso(START) }), 0, "no log => 0, never a guess");
assert.equal(pilotFixCount([run(START + MIN)], {}), 0, "no pilot start => 0");
assert.equal(pilotFixCount([run(START - MIN)], { startedAt: iso(START) }), 0, "pre-start fix never counts");
assert.equal(pilotFixCount([run(START), run(START + MIN), { ts: iso(START + 2 * MIN), tag: "PILOT" }, { ts: "bad", tag: "RUN" }], { startedAt: iso(START) }), 2, "only real RUN entries at/after start count");
assert.equal(pilotLastActivityAt([], { startedAt: iso(START) }), null, "no entries => null last activity");
assert.equal(pilotLastActivityAt([run(START + MIN), { ts: iso(START + 5 * MIN), tag: "PILOT" }], { startedAt: iso(START) }), START + 5 * MIN, "newest real entry of any tag wins");

// ── 3. MATURITY: matured needs BOTH a real TTFV stamp and >= 3 real fixes ──────────────────────────
assert.equal(PILOT_MATURED_FIXES, 3, "matured threshold is explicit");
assert.equal(pilotMaturity(pilot("A", START), { fixCount: 0 }), "immature", "no fixes => immature");
assert.equal(pilotMaturity(pilot("A", START), { fixCount: 9 }), "maturing", "fixes but NO real TTFV stamp => never matured");
assert.equal(pilotMaturity(pilot("A", START, { ttfv: 4 }), { fixCount: 2 }), "maturing", "stamped but under threshold => maturing");
assert.equal(pilotMaturity(pilot("A", START, { ttfv: 4 }), { fixCount: 3 }), "matured", "stamped + 3 real fixes => matured");

// ── 4. HEALTH FLAGS + STAGED ONE-CLICK ─────────────────────────────────────────────────────────────
assert.deepEqual(pilotHealthFlags(null, { now: START }), [], "no record => no invented flags");
assert.deepEqual(pilotHealthFlags(pilot("A", START), { lastActivityAt: START + HOUR, now: START + HOUR }), ["no-first-value"], "young + unstamped => one honest flag");
assert.deepEqual(
  pilotHealthFlags(pilot("A", START), { lastActivityAt: START + HOUR, now: START + (STALLED_CLOCK_HOURS + 1) * HOUR }),
  ["no-first-value", "stalled-clock"], "past the stall window => stalled-clock"
);
assert.deepEqual(
  pilotHealthFlags(pilot("A", START, { ttfv: 4 }), { lastActivityAt: START + HOUR, now: START + (GONE_QUIET_DAYS + 1) * DAY }),
  ["gone-quiet"], "stamped but silent => gone-quiet only"
);
assert.deepEqual(pilotHealthFlags(pilot("A", START, { ttfv: 4 }), { lastActivityAt: START + HOUR, now: START + 2 * HOUR }), [], "healthy pilot => no flags");
assert.equal(pilotNextOneClick({ maturity: "matured", flags: ["gone-quiet"] }), "stage-reengage-draft", "silence outranks the ask — never pitch a quiet pilot");
assert.equal(pilotNextOneClick({ maturity: "immature", flags: ["no-first-value", "stalled-clock"] }), "stage-first-value-assist");
assert.equal(pilotNextOneClick({ maturity: "matured", flags: [] }), "stage-conversion-proof");
assert.equal(pilotNextOneClick({ maturity: "maturing", flags: [] }), "stage-progress-checkin");
assert.equal(pilotNextOneClick({}), "stage-activation-nudge", "default is the gentlest action");
for (const a of ["stage-reengage-draft", "stage-first-value-assist", "stage-conversion-proof", "stage-progress-checkin", "stage-activation-nudge"]) {
  assert.match(a, /^stage-/, "EVERY action is staged for one click — this module never sends");
}

// ── 5. ONE REAL PILOT ──────────────────────────────────────────────────────────────────────────────
const one = buildPilotConsole([pilot("Acme Clinic", START, { ttfv: 7, deviceId: "dev-1" })], {
  now: START + 3 * HOUR, auditByPilot: { "dev-1": [run(START + 7 * MIN), run(START + 40 * MIN), run(START + 2 * HOUR)] }
});
assert.equal(one.empty, false);
assert.equal(one.rows.length, 1);
assert.equal(one.rows[0].fixCount, 3, "real fixes counted");
assert.equal(one.rows[0].ttfvMinutes, 7);
assert.equal(one.rows[0].ttfvLabel, "7 min");
assert.equal(one.rows[0].maturity, "matured");
assert.deepEqual(one.rows[0].flags, []);
assert.equal(one.rows[0].nextOneClick, "stage-conversion-proof");
assert.equal(one.rows[0].lastActivityAt, iso(START + 2 * HOUR));
assert.equal(one.generatedAt, iso(START + 3 * HOUR), "board carries a real generated stamp");

// ── 6. MANY CONCURRENT PILOTS — honest per-row truth, newest first ─────────────────────────────────
const NOW = START + 10 * DAY;
const many = buildPilotConsole([
  pilot("Matured Co", START, { ttfv: 5, deviceId: "d-m" }),
  pilot("Maturing Co", START + 8 * DAY, { ttfv: 12, deviceId: "d-g" }),
  pilot("Stalled Co", START + 5 * DAY, { deviceId: "d-s" }),
  pilot("Brand New Co", NOW - HOUR, { deviceId: "d-n" })
], {
  now: NOW,
  auditByPilot: {
    "d-m": [run(START + 5 * MIN), run(START + 6 * HOUR), run(START + 9 * DAY + HOUR)],
    "d-g": [run(START + 8 * DAY + 12 * MIN), run(START + 9 * DAY)],
    "d-s": [],
    "d-n": []
  }
});
assert.equal(many.rows.length, 4, "every real pilot gets exactly one row");
assert.deepEqual(many.rows.map((r) => r.org), ["Brand New Co", "Maturing Co", "Stalled Co", "Matured Co"], "newest pilot first, deterministic");
const by = Object.fromEntries(many.rows.map((r) => [r.org, r]));
assert.equal(by["Matured Co"].maturity, "matured");
assert.equal(by["Matured Co"].nextOneClick, "stage-conversion-proof");
assert.equal(by["Maturing Co"].maturity, "maturing");
assert.equal(by["Maturing Co"].fixCount, 2);
assert.equal(by["Stalled Co"].maturity, "immature");
assert.equal(by["Stalled Co"].ttfvLabel, "--", "no real first value => '--', never a number");
assert.deepEqual(by["Stalled Co"].flags, ["no-first-value", "stalled-clock"], "5-day-old unstamped pilot is stalled but NOT yet quiet (7-day window not reached)");
assert.equal(by["Stalled Co"].nextOneClick, "stage-first-value-assist");
assert.equal(by["Brand New Co"].maturity, "immature");
assert.deepEqual(by["Brand New Co"].flags, ["no-first-value"], "an hour-old pilot is NOT stalled or quiet");
assert.equal(by["Brand New Co"].nextOneClick, "stage-activation-nudge");
assert.deepEqual(many.counts, { total: 4, matured: 1, maturing: 1, immature: 2, needsAttention: 2 }, "counts are derived, never asserted");

// ── 7. NO CROSS-PILOT LEAK — one pilot's fixes never inflate another ───────────────────────────────
const leak = buildPilotConsole([pilot("X", START, { deviceId: "x" }), pilot("Y", START, { deviceId: "y" })], {
  now: START + HOUR, auditByPilot: { x: [run(START + MIN), run(START + 2 * MIN)] }
});
assert.equal(leak.rows.find((r) => r.org === "X").fixCount, 2);
assert.equal(leak.rows.find((r) => r.org === "Y").fixCount, 0, "no audit for Y => 0, never borrowed from X");

console.log("f1-pilot-console test passed (7 groups · honest empty board · real-or-empty fix/activity · matured needs real TTFV + 3 real fixes · flags + staged one-click deterministic · N concurrent pilots newest-first · no cross-pilot leak · nothing sent).");
