// RUN-G G3 - delivery leverage. Locks: observed minutes only (never modelled), honest "not enough
// data", a WORSENING trend reported as plainly as an improving one, projected savings labelled
// projected, thin sinks never promoted, and a module that cannot reach the network or the disk.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDeliveryLeverage, deliveryLeverageMarkdown, observedMinutes, sinkKey, aggregate,
  minutesPerPilot, topSinks, DELIVERY_LEVERAGE_SCHEMA, LEVERAGE_EMPTY,
  MIN_OCCURRENCES_FOR_SINK, MIN_RECORDS_FOR_TREND,
} from "../src/shared/delivery-leverage.mjs";

const NOW = Date.parse("2026-07-21T08:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();
const rec = (id, pilotId, minutes, days, category) => ({ id, pilotId, durationMinutes: minutes, at: ago(days), category });

// -- 1. EMPTY IS HONEST ------------------------------------------------------------------------------
for (const input of [undefined, null, [], "nope", { records: [] }]) {
  const b = buildDeliveryLeverage(input, { now: NOW });
  assert.equal(b.schema, DELIVERY_LEVERAGE_SCHEMA, "schema is explicit");
  assert.equal(b.enoughData, false, "no usable records => honestly not enough data");
  assert.equal(b.current.perPilot, null, "no invented per-pilot number");
  assert.deepEqual(b.sinks, [], "no invented sinks");
}
const emptyMd = deliveryLeverageMarkdown(buildDeliveryLeverage([], { now: NOW }));
assert.ok(emptyMd.includes(LEVERAGE_EMPTY), "empty markdown states it honestly");
assert.ok(!emptyMd.includes("| Sink |"), "empty board renders no sink table");

// -- 2. OBSERVED MINUTES ONLY - NEVER MODELLED --------------------------------------------------------
assert.equal(observedMinutes({}), null, "no time data => null, never a typical fix time");
assert.equal(observedMinutes({ durationMinutes: 0 }), null, "zero is not an observation");
assert.equal(observedMinutes({ durationMinutes: -5 }), null, "negative is not an observation");
assert.equal(observedMinutes({ startedAt: ago(1), endedAt: "nope" }), null, "half a stamp is not an observation");
assert.equal(observedMinutes({ startedAt: "2026-07-20T10:00:00Z", endedAt: "2026-07-20T10:45:00Z" }), 45, "real stamps => real minutes");
assert.equal(observedMinutes({ durationMinutes: 22 }), 22, "a recorded duration counts");
assert.equal(sinkKey({}), null, "uncategorized work is not a sink");
assert.equal(sinkKey({ category: "  Printer   Driver " }), "printer driver", "sink labels normalize");

const agg = aggregate([
  null,
  { id: "x1" },                                   // no pilotId
  { id: "x2", pilotId: "p1" },                    // no time
  { id: "x3", pilotId: "p1", durationMinutes: 10 }, // no date
  rec("ok", "p1", 30, 2, "vpn"),
]);
assert.equal(agg.usable.length, 1, "only the fully-evidenced record is usable");
assert.equal(agg.excluded.length, 4, "every unusable record is logged, never estimated");
assert.match(agg.excluded.find((e) => e.id === "x2").reason, /never estimated/, "missing time is stated, not filled in");

// -- 3. MINUTES PER PILOT IS ARITHMETIC ON REAL MINUTES ----------------------------------------------
assert.equal(minutesPerPilot([]).perPilot, null, "no records => null, not 0");
const mpp = minutesPerPilot([{ pilotId: "p1", minutes: 60 }, { pilotId: "p1", minutes: 30 }, { pilotId: "p2", minutes: 30 }]);
assert.equal(mpp.pilots, 2, "distinct pilots counted");
assert.equal(mpp.totalMinutes, 120, "minutes summed");
assert.equal(mpp.perPilot, 60, "120 observed minutes over 2 pilots = 60");

// -- 4. THIN EVIDENCE IS NEVER PROMOTED TO A "REPEATABLE" SINK ---------------------------------------
const thin = topSinks([{ id: "a", pilotId: "p1", minutes: 90, at: ago(1), sink: "vpn" }, { id: "b", pilotId: "p1", minutes: 90, at: ago(2), sink: "vpn" }]);
assert.deepEqual(thin, [], `${MIN_OCCURRENCES_FOR_SINK - 1} occurrences is not repeatable`);
const real = topSinks([
  { id: "a", pilotId: "p1", minutes: 30, at: ago(1), sink: "vpn" },
  { id: "b", pilotId: "p2", minutes: 40, at: ago(2), sink: "vpn" },
  { id: "c", pilotId: "p1", minutes: 50, at: ago(3), sink: "vpn" },
  { id: "d", pilotId: "p1", minutes: 5, at: ago(3), sink: null },
]);
assert.equal(real.length, 1, "only the genuinely repeated sink is surfaced");
assert.equal(real[0].occurrences, 3, "real occurrence count");
assert.equal(real[0].observedMinutes, 120, "real observed minutes");
assert.equal(real[0].projectedSavingIfAutomated.projected, true, "saving is labelled projected");
assert.equal(real[0].projectedSavingIfAutomated.observed, false, "saving is NOT presented as observed/achieved");
assert.match(real[0].projectedSavingIfAutomated.basis, /NOT money already saved/, "the basis says so in plain words");
assert.equal(real[0].action.executed, false, "building the automation is staged, never executed");
assert.equal(real[0].action.kind, "ahmad-one-click", "greenlight is Ahmad's click");

// -- 5. NO TREND ON THIN DATA -------------------------------------------------------------------------
const oneSided = buildDeliveryLeverage([rec("a", "p1", 30, 2, "vpn"), rec("b", "p2", 30, 3, "vpn")], { now: NOW });
assert.equal(oneSided.enoughForTrend, false, "one period of data is not a trend");
assert.equal(oneSided.trend.direction, "unknown", "direction stays honestly unknown");
assert.equal(oneSided.trend.deltaPerPilot, null, "no invented delta");
assert.match(oneSided.trend.honest, new RegExp(String(MIN_RECORDS_FOR_TREND)), "the bar for a trend is stated");

// -- 6. A WORSENING TREND IS REPORTED, NOT SPUN -------------------------------------------------------
// prior period (>30d): 6 records, 2 pilots, 60 min total => 30 min/pilot
// this period (<30d): 6 records, 2 pilots, 240 min total => 120 min/pilot  => WORSE by 90
const worse = buildDeliveryLeverage([
  ...[45, 50, 55].map((m, i) => rec(`n${i}`, "p1", m, 3 + i, "vpn")),
  ...[30, 30, 30].map((m, i) => rec(`n2${i}`, "p2", m, 3 + i, "printer driver")),
  ...[10, 10, 10].map((m, i) => rec(`o${i}`, "p1", m, 60 + i, "vpn")),
  ...[10, 10, 10].map((m, i) => rec(`o2${i}`, "p2", m, 60 + i, "vpn")),
], { now: NOW });
assert.equal(worse.enoughForTrend, true, "both periods clear the bar");
assert.equal(worse.current.perPilot, 120, "this period measured from real minutes");
assert.equal(worse.previous.perPilot, 30, "prior period measured from real minutes");
assert.equal(worse.trend.direction, "WORSE", "a regression is called WORSE");
assert.equal(worse.trend.deltaPerPilot, 90, "the real delta is shown");
assert.match(worse.trend.honest, /not spun/, "the honesty is explicit");
assert.ok(deliveryLeverageMarkdown(worse).includes("WORSE"), "markdown does not hide the regression");

// -- 7. AN IMPROVING TREND USES THE SAME PLAIN WORDS --------------------------------------------------
const better = buildDeliveryLeverage([
  ...[10, 10, 10].map((m, i) => rec(`n${i}`, "p1", m, 3 + i, "vpn")),
  ...[10, 10, 10].map((m, i) => rec(`n2${i}`, "p2", m, 3 + i, "vpn")),
  ...[45, 50, 55].map((m, i) => rec(`o${i}`, "p1", m, 60 + i, "vpn")),
  ...[30, 30, 30].map((m, i) => rec(`o2${i}`, "p2", m, 60 + i, "vpn")),
], { now: NOW });
assert.equal(better.trend.direction, "better", "an improvement is called better");
assert.ok(better.trend.deltaPerPilot < 0, "the delta is negative");
assert.equal(better.observedOnly, true, "board asserts observed-only");

// -- 8. STATIC SCAN: no network, no spawn, no disk ----------------------------------------------------
const src = readFileSync(new URL("../src/shared/delivery-leverage.mjs", import.meta.url), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "child_process", "node:fs", "require(", "exec(", "spawn("]) {
  assert.ok(!src.includes(forbidden), `delivery-leverage must not reference ${forbidden}`);
}
assert.ok(!/executed:\s*true/.test(src), "no code path can mark an action executed");
assert.ok(!/observed:\s*true/.test(src), "no projected number is ever relabelled observed");

console.log("g3-delivery-leverage: 8 assertion groups PASSED");
