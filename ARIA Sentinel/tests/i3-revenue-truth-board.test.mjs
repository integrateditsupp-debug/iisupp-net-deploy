// RUN-I I3 - one honest revenue truth board. Locks: empty / partial / full fixtures all render
// honestly, $0 is printed as $0, every figure is traceable to a real source, staged is never counted
// as money, and there is no weighted-pipeline or projected-ARR figure anywhere.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTruthBoard, truthBoardMarkdown, realPayment, pipelineEntry,
  TRUTH_BOARD_SCHEMA, ZERO_NOTE, EMPTY_SECTION, NO_WEIGHTING_NOTE,
} from "../src/shared/revenue-truth-board.mjs";
import { buildBillingHandoff } from "../src/shared/billing-handoff.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";
import { assessRenewals } from "../src/shared/renewal-readiness.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const PACK = buildProofPack({
  pilotId: "pilot-a",
  startedAt: ago(10),
  records: [
    { id: "T-201", at: ago(9), durationMinutes: 25 },
    { id: "T-202", at: ago(7), durationMinutes: 15 },
    { id: "T-203", at: ago(5), durationMinutes: 40 },
  ],
}, { now: NOW });
const PACKET = buildClosePacket(
  { customer: "Northline Logistics", proofPack: PACK, plan: { name: "Managed IT - Core", priceCad: 1450, published: true }, proposedStartDate: "2026-08-01T00:00:00Z" },
  { now: NOW }
);
const HANDOFF = buildBillingHandoff(PACKET, { now: NOW });
assert.equal(HANDOFF.produced, true, "fixture handoff is real");

// -- 1. EMPTY IS EMPTY, AND $0 PRINTS AS $0 ----------------------------------------------------------
const empty = buildTruthBoard({}, { now: NOW });
assert.equal(empty.schema, TRUTH_BOARD_SCHEMA, "schema is explicit");
assert.equal(empty.realRevenueCad, 0, "no payments => zero, not blank, not 'TBD'");
assert.deepEqual(empty.payments, [], "no payment is invented");
assert.deepEqual(empty.pipeline, [], "no pipeline entry is invented");
assert.equal(empty.sectionsEmpty.revenue, true, "the empty revenue section is flagged as empty");
const emptyMd = truthBoardMarkdown(empty);
assert.ok(emptyMd.includes("CAD $0"), "$0 is printed as $0");
assert.ok(emptyMd.includes(ZERO_NOTE), "and it says plainly that no money has landed");
assert.equal(emptyMd.split(EMPTY_SECTION).length - 1, 3, "each empty non-revenue section renders the honest empty line, not filler");
assert.equal(/Renewals/.test(emptyMd), false, "with no renewal report there is no renewals section at all");

// -- 2. ONLY A RECORDED, RECEIVED PAYMENT IS REVENUE -------------------------------------------------
assert.equal(realPayment({ id: "P-1", customer: "X", amountCad: 100, receivedAt: ago(1) }), null, "received must be explicitly true");
assert.equal(realPayment({ id: "P-1", customer: "X", amountCad: 100, received: true }), null, "no received date => not money");
assert.equal(realPayment({ id: "P-1", customer: "X", amountCad: 0, received: true, receivedAt: ago(1) }), null, "a zero payment is not revenue");
assert.equal(realPayment({ customer: "X", amountCad: 100, received: true, receivedAt: ago(1) }), null, "an untraceable payment with no id is not counted");
assert.equal(realPayment({ id: "P-1", amountCad: 100, received: true, receivedAt: ago(1) }), null, "a payment with no real customer is not counted");
const good = realPayment({ id: "P-9", customer: "Northline Logistics", amountCad: 1450, received: true, receivedAt: ago(2) });
assert.equal(good.amountCad, 1450, "a fully real payment counts, exactly as recorded");

// -- 3. STAGED IS NOT MONEY --------------------------------------------------------------------------
const staged = buildTruthBoard({ handoffs: [HANDOFF] }, { now: NOW });
assert.equal(staged.realRevenueCad, 0, "a staged handoff adds ZERO to real revenue");
assert.equal(staged.pipeline.length, 1, "it is pipeline, and it is listed as pipeline");
assert.equal(staged.pipelineCad, 1450, "the pipeline figure is the real packet amount");
assert.equal(staged.pipeline[0].invoiced, false, "the entry states it has not been invoiced");
assert.ok(staged.pipeline[0].status.includes("staged"), "its status says staged, in that word");
assert.ok(staged.pipeline[0].evidence.length > 0, "the entry carries the evidence behind it");
assert.equal(staged.blockedOnAhmad.length, 1, "an uninvoiced entry becomes a blocked-on-Ahmad item automatically");
assert.match(staged.blockedOnAhmad[0].why, /no payment client/, "and says why we cannot do it ourselves");
const stagedMd = truthBoardMarkdown(staged);
assert.ok(stagedMd.includes("**Real money in: CAD $0**"), "real money still reads zero with pipeline on the board");
assert.ok(stagedMd.includes("staged, not earned, not booked"), "the pipeline total is labelled honestly");
assert.equal(pipelineEntry({ schema: "billing-handoff.v1", produced: false }), null, "an unproduced handoff is not pipeline");
assert.equal(pipelineEntry(null), null, "nothing is not pipeline");

// -- 4. NO WEIGHTING, NO PROJECTED ARR ---------------------------------------------------------------
for (const b of [empty, staged]) {
  assert.equal(b.weightedPipelineCad, null, "there is no weighted pipeline number");
  assert.equal(b.projectedArrCad, null, "there is no projected ARR number");
  assert.ok(b.note === NO_WEIGHTING_NOTE, "and the board says so on its face");
}
assert.equal(/potential ARR|weighted pipeline of|expected revenue/i.test(stagedMd.replace(NO_WEIGHTING_NOTE, "")), false, "no projection theatre in the rendered board");

// -- 5. FULL BOARD - EVERY FIGURE TRACEABLE ----------------------------------------------------------
const renewals = assessRenewals([
  { customer: "Northline Logistics", records: [{ id: "T-601", at: ago(9) }, { id: "T-602", at: ago(6) }, { id: "T-603", at: ago(3) }] },
  { customer: "Gone Quiet Ltd", records: [{ id: "T-301", at: ago(80) }] },
], { now: NOW });
const full = buildTruthBoard({
  payments: [
    { id: "P-9", customer: "Northline Logistics", amountCad: 1450, received: true, receivedAt: ago(2) },
    { id: "P-10", customer: "Ghost Co", amountCad: 5000, received: false, receivedAt: ago(1) },
  ],
  handoffs: [HANDOFF],
  renewals,
  blockedOnUs: [{ item: "Second pilot instrumentation", why: "build work outstanding" }],
  blockedOnAhmad: [{ item: "Netlify publish of the updated proof page", why: "public deploy is a human one-click" }],
}, { now: NOW });
assert.equal(full.realRevenueCad, 1450, "only the received payment counts - the unreceived one is excluded, not counted");
assert.equal(full.payments.length, 1, "the unreceived payment does not appear as money");
assert.equal(full.payments[0].id, "P-9", "the figure is traceable to its payment id");
assert.equal(full.blockedOnAhmad.length, 2, "auto-derived and explicit Ahmad blockers are both listed");
assert.equal(full.blockedOnUs.length, 1, "what is on us is stated as plainly as what is on Ahmad");
assert.deepEqual(full.renewalCounts, { healthy: 1, "at-risk": 1, "not-enough-data": 0 }, "renewal truth is carried through unchanged");
assert.equal(full.renewalBookedCad, 0, "renewal revenue is still zero on the board");
const fullMd = truthBoardMarkdown(full);
assert.ok(fullMd.includes("CAD $1450 received"), "the received payment is shown with its date and id");
assert.ok(fullMd.includes("P-9"), "the source id is printed for the reader to check");
assert.equal(fullMd.includes("Ghost Co"), false, "a payment that never landed appears nowhere");
assert.ok(fullMd.includes("Booked renewal revenue: CAD $0"), "booked renewal revenue prints as zero");
assert.equal(fullMd.includes(EMPTY_SECTION), false, "with real data in every section, no empty line is rendered");

// -- 6. STATIC SCAN - THE BOARD ONLY READS -----------------------------------------------------------
const SRC = readFileSync(new URL("../src/shared/revenue-truth-board.mjs", import.meta.url), "utf8");
for (const bad of ["fetch(", "node:http", "node:net", "node:fs", "child_process", "require(", "process.env", "Math.random"]) {
  assert.equal(SRC.includes(bad), false, "revenue-truth-board has no " + bad);
}
assert.equal(/weightedPipelineCad\s*[:=]\s*[^n]/.test(SRC.replace("weightedPipelineCad: null", "")), false, "weighted pipeline is null in the source, with no path to a number");

console.log("i3-revenue-truth-board: OK");
