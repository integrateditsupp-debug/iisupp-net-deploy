// RUN-K K2 - time-to-first-dollar clock. Locks: still-running / completed / not-enough-data are ALL
// reachable, every interval traces to two real timestamps, and no projected close date exists anywhere.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFirstDollarClock, firstDollarMarkdown, chainTimestamps,
  CLOCK_SCHEMA, STATUSES, STAGES, NOT_ENOUGH_DATA_NOTE, STILL_RUNNING_PREFIX, NO_PAYMENT_NOTE, MEASURED_ONLY_NOTE,
} from "../src/shared/time-to-first-dollar.mjs";
import { buildReceiptLedger } from "../src/shared/payment-receipt-ledger.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildBillingHandoff } from "../src/shared/billing-handoff.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const RECORDS = [
  { id: "T-501", at: ago(30), durationMinutes: 60 },
  { id: "T-502", at: ago(23), durationMinutes: 60 },
  { id: "T-503", at: ago(16), durationMinutes: 60 },
  { id: "T-504", at: ago(9), durationMinutes: 60 },
];
const PACK = buildProofPack({ pilotId: "pilot-k", startedAt: ago(30), records: RECORDS }, { now: NOW - 8 * 86400000 });
assert.equal(PACK.earned, true, "fixture proof pack is really earned");
const PACKET = buildClosePacket({ customer: "Northline Logistics", proofPack: PACK, plan: { name: "Managed IT - Core", priceCad: 1450, published: true }, proposedStartDate: "2026-08-01T00:00:00Z" }, { now: NOW - 6 * 86400000 });
assert.equal(PACKET.rendered, true, "fixture close packet really rendered");
const HANDOFF = buildBillingHandoff(PACKET, { now: NOW - 5 * 86400000 });
assert.equal(HANDOFF.produced, true, "fixture handoff is real");

// -- 1. NO REAL ENGAGEMENT => NO CLOCK, AND NOTHING IN ITS PLACE --------------------------------------
const none = buildFirstDollarClock({}, { now: NOW });
assert.equal(none.schema, CLOCK_SCHEMA, "schema is explicit");
assert.equal(none.status, "not-enough-data", "not-enough-data is reachable");
assert.ok(STATUSES.includes(none.status), "and is one of the declared statuses");
assert.equal(none.elapsedDays, null, "no elapsed time is invented");
assert.equal(none.headline, NOT_ENOUGH_DATA_NOTE, "it says why, plainly");
assert.deepEqual(none.intervals, [], "and measures nothing");
assert.equal(none.stagesMissing.length, STAGES.length, "every stage is named as missing");

// -- 2. STILL RUNNING IS AN HONEST ANSWER, NOT A PROMISE ---------------------------------------------
const running = buildFirstDollarClock({ records: RECORDS, proofPack: PACK, closePacket: PACKET, billingHandoff: HANDOFF }, { now: NOW });
assert.equal(running.status, "still-running", "with no payment the clock is still running");
assert.equal(running.elapsedDays, 30, "measured from the real first engagement record");
assert.ok(running.headline.startsWith(STILL_RUNNING_PREFIX), "and it says 'still running' in those words");
assert.ok(running.headline.includes(NO_PAYMENT_NOTE), "with no implication that money is coming");
assert.equal(running.stagesMissing.length, 1, "the one stage that has not happened is named");
assert.equal(running.stagesMissing[0].key, "payment", "and it is the payment");

// -- 3. EVERY INTERVAL COMES FROM TWO REAL TIMESTAMPS -------------------------------------------------
for (const i of running.intervals) {
  assert.ok(!Number.isNaN(Date.parse(i.fromAt)), i.label + " starts at a real timestamp");
  assert.ok(!Number.isNaN(Date.parse(i.toAt)), i.label + " ends at a real timestamp");
  assert.equal(Math.round((Date.parse(i.toAt) - Date.parse(i.fromAt)) / 86400000 * 10) / 10, i.days, i.label + " is the real difference, not a rounding of a guess");
  assert.ok(i.fromSource && i.toSource, i.label + " names both artifacts it came from");
}
assert.ok(running.longestGap, "the slowest real step is identified");
assert.equal(running.longestGap.from, "engagement", "here it is the run-up to earned evidence");
assert.equal(running.longestGap.to, "evidence", "named by both endpoints, not guessed");

// A chain with a hole reports the hole instead of interpolating across it.
const holed = buildFirstDollarClock({ records: RECORDS, billingHandoff: HANDOFF }, { now: NOW });
assert.equal(holed.stagesMissing.map((m) => m.key).includes("evidence"), true, "a missing stage is named as missing");
assert.equal(holed.intervals[0].spansMissingStage, true, "and the interval that jumps it is flagged, not silently smoothed");

// -- 4. COMPLETED IS REACHABLE, FROM A REAL VERIFIED RECEIPT -----------------------------------------
const LEDGER = buildReceiptLedger({ entries: [
  { id: "P-500", customer: "Northline Logistics", amountCad: 1450, receivedAt: ago(2), processor: "stripe", reference: "pi_3K2Real" },
] }, { now: NOW });
assert.equal(LEDGER.verified.length, 1, "fixture receipt is really verified");
const done = buildFirstDollarClock({ records: RECORDS, proofPack: PACK, closePacket: PACKET, billingHandoff: HANDOFF, ledger: LEDGER }, { now: NOW });
assert.equal(done.status, "completed", "completed is reachable");
assert.equal(done.elapsedDays, 28, "28 real days from first engagement to first dollar");
assert.equal(done.stagesMissing.length, 0, "with the whole chain present");
assert.ok(done.headline.includes("28"), "and the number is stated");

// An unverified claim does NOT stop the clock - only a verified receipt does.
const CLAIM_ONLY = buildReceiptLedger({ entries: [{ id: "P-501", customer: "Northline Logistics", amountCad: 1450, receivedAt: ago(2) }] }, { now: NOW });
const stillRunning = buildFirstDollarClock({ records: RECORDS, ledger: CLAIM_ONLY }, { now: NOW });
assert.equal(stillRunning.status, "still-running", "a claimed, unverified payment is not a first dollar");

// -- 5. NO FORECAST ANYWHERE - IN ANY REACHABLE OUTPUT -----------------------------------------------
const FORECAST_WORDS = ["projected", "forecast", "expected close", "estimated close", "close date of", "on track to close"];
for (const md of [firstDollarMarkdown(none), firstDollarMarkdown(running), firstDollarMarkdown(done), firstDollarMarkdown(holed)]) {
  const low = md.toLowerCase();
  for (const w of FORECAST_WORDS) assert.equal(low.includes(w), false, 'the clock never says "' + w + '"');
}
assert.ok(firstDollarMarkdown(running).includes(MEASURED_ONLY_NOTE), "and it states that every interval is measured, not modelled");
assert.ok(firstDollarMarkdown(none) === "# Time to first dollar\n\n**" + NOT_ENOUGH_DATA_NOTE + "**", "with no data it renders one honest line and stops");

// -- 6. THE CLOCK ONLY READS - IT HAS NO CAPABILITY TO ACT -------------------------------------------
const SRC = readFileSync(new URL("../src/shared/time-to-first-dollar.mjs", import.meta.url), "utf8");
for (const forbidden of ["node:child_process", "node:fs", "node:net", "node:http", "fetch(", "require("]) {
  assert.equal(SRC.includes(forbidden), false, "the clock has no capability to " + forbidden);
}
for (const id of ["projectedClose", "forecastDate", "estimatedClose", "expectedCloseDate"]) {
  assert.equal(SRC.includes(id), false, "no forecast field named " + id + " exists");
}

// -- 7. CHAIN EXTRACTION IGNORES UNEARNED / UNRENDERED / UNPRODUCED ARTIFACTS -------------------------
const weak = chainTimestamps({
  records: RECORDS,
  proofPack: { schema: "proof-pack.v1", earned: false, generatedAt: ago(20) },
  closePacket: { schema: "close-packet.v1", rendered: false, generatedAt: ago(19) },
  billingHandoff: { schema: "billing-handoff.v1", produced: false, generatedAt: ago(18) },
});
assert.equal(weak.evidence, null, "an unearned pack contributes no timestamp");
assert.equal(weak.packet, null, "a refused packet contributes no timestamp");
assert.equal(weak.handoff, null, "an unproduced handoff contributes no timestamp");
assert.ok(weak.engagement, "but the real engagement record still counts");

console.log("k2-time-to-first-dollar: 7 assertion groups green");
