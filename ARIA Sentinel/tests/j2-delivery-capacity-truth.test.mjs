// RUN-J J2 - deliverable capacity truth. Locks: under / at / over / not-enough-data are ALL reachable,
// every minute traces to a real record id, and no fix time is ever modelled or assumed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCapacityTruth, capacityMarkdown, accountLoad, usableMinutes,
  CAPACITY_SCHEMA, MIN_RECORDS_FOR_LOAD, VERDICTS, NO_CAPACITY_NOTE, OBSERVED_ONLY_NOTE, OVER_NOTE,
} from "../src/shared/delivery-capacity-truth.mjs";
import { buildBillingHandoff } from "../src/shared/billing-handoff.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

// Four real weeks of observed delivery for one account: 60 min/week, all traceable.
const NORTHLINE = {
  customer: "Northline Logistics",
  records: [
    { id: "T-301", at: ago(28), durationMinutes: 60 },
    { id: "T-302", at: ago(21), durationMinutes: 60 },
    { id: "T-303", at: ago(14), durationMinutes: 60 },
    { id: "T-304", at: ago(0), durationMinutes: 60 },
  ],
};

// A real staged handoff built from the real modules.
const PACK = buildProofPack({ pilotId: "pilot-n", startedAt: ago(28), records: NORTHLINE.records }, { now: NOW });
const PACKET = buildClosePacket({ customer: "Northline Logistics", proofPack: PACK, plan: { name: "Managed IT - Core", priceCad: 1450, published: true }, proposedStartDate: "2026-08-01T00:00:00Z" }, { now: NOW });
const HANDOFF = buildBillingHandoff(PACKET, { now: NOW });
assert.equal(HANDOFF.produced, true, "fixture handoff is real");

// -- 1. ONLY OBSERVED MINUTES COUNT -------------------------------------------------------------------
assert.equal(usableMinutes({ id: "T-1", at: ago(1) }), null, "no recorded duration => contributes nothing");
assert.equal(usableMinutes({ id: "T-1", at: ago(1), durationMinutes: 0 }), null, "zero minutes is not delivery");
assert.equal(usableMinutes({ at: ago(1), durationMinutes: 30 }), null, "an untraceable record is not counted");
assert.equal(usableMinutes({ id: "T-1", durationMinutes: 30 }), null, "a record with no real date is not counted");
assert.equal(usableMinutes({ id: "T-1", at: ago(1), durationMinutes: 30 }).minutes, 30, "a real record counts exactly as recorded");

// -- 2. NOT ENOUGH HISTORY IS NOT PROJECTED -----------------------------------------------------------
const thin = accountLoad({ customer: "Thin Co", records: [{ id: "T-9", at: ago(2), durationMinutes: 30 }] }, { now: NOW });
assert.equal(thin.known, false, "one record is not a weekly load");
assert.equal(thin.weeklyMinutes, null, "and no number is invented for it");
assert.ok(thin.why.includes(String(MIN_RECORDS_FOR_LOAD)), "the bar it failed is stated");

// -- 3. A REAL LOAD IS MEASURED AND FULLY TRACEABLE ---------------------------------------------------
const load = accountLoad(NORTHLINE, { now: NOW });
assert.equal(load.known, true, "four real records over four real weeks is measurable");
assert.equal(load.totalMinutes, 240, "the total is the sum of the real records, nothing else");
assert.equal(load.weeklyMinutes, 60, "60 observed minutes a week - measured from the real span, not modelled");
assert.deepEqual(load.recordIds, ["T-301", "T-302", "T-303", "T-304"], "every minute traces to a record id");

// A same-day burst is never inflated into an impossible weekly rate.
const burst = accountLoad({ customer: "Burst Co", records: [
  { id: "B-1", at: ago(0), durationMinutes: 30 },
  { id: "B-2", at: ago(0), durationMinutes: 30 },
  { id: "B-3", at: ago(0), durationMinutes: 30 },
] }, { now: NOW });
assert.equal(burst.weeklyMinutes, 90, "a one-day burst is floored at one week, not multiplied up");

// -- 4. NO DECLARED CAPACITY => NOT-ENOUGH-DATA, NEVER A SAFE 'UNDER' ---------------------------------
const noCap = buildCapacityTruth({ accounts: [NORTHLINE] }, { now: NOW });
assert.equal(noCap.verdict, "not-enough-data", "without recorded operator minutes there is no verdict");
assert.equal(noCap.capacityMinutes, null, "and no 40-hour week is assumed");
assert.equal(noCap.headline, NO_CAPACITY_NOTE, "it says exactly why");
assert.ok(VERDICTS.includes(noCap.verdict), "the verdict is one of the declared verdicts");

// -- 5. UNDER / AT / OVER ARE ALL REACHABLE FROM REAL FIXTURES ---------------------------------------
const under = buildCapacityTruth({ accounts: [NORTHLINE], operatorWeeklyMinutes: 600 }, { now: NOW });
assert.equal(under.verdict, "under", "60 of 600 observed minutes is under capacity");
assert.equal(under.freeMinutes, 540, "the free room is real subtraction, not a percentage story");

const at = buildCapacityTruth({ accounts: [NORTHLINE], operatorWeeklyMinutes: 60 }, { now: NOW });
assert.equal(at.verdict, "at", "60 of 60 is at capacity");

const over = buildCapacityTruth({ accounts: [NORTHLINE, { customer: "Second Co", records: NORTHLINE.records.map((r, i) => ({ ...r, id: "S-" + i })) }], operatorWeeklyMinutes: 90 }, { now: NOW });
assert.equal(over.verdict, "over", "120 committed against 90 observed is over capacity");
assert.equal(over.headline, OVER_NOTE, "and it warns BEFORE more work is closed");
assert.ok(over.committedMinutes > over.capacityMinutes, "the overage is arithmetic, not a feeling");

// -- 6. A STAGED CUSTOMER WITH NO OBSERVED HISTORY IS EXCLUDED, NOT ESTIMATED -------------------------
const staged = buildCapacityTruth({ accounts: [NORTHLINE], operatorWeeklyMinutes: 600, handoffs: [HANDOFF] }, { now: NOW });
assert.equal(staged.staged.length, 1, "the staged customer with real history is listed");
assert.deepEqual(staged.staged[0].basis, load.recordIds, "and its basis is the real record ids");

const stagedUnknown = buildCapacityTruth({
  accounts: [NORTHLINE], operatorWeeklyMinutes: 600,
  handoffs: [{ ...HANDOFF, customer: "Never Delivered Co" }],
}, { now: NOW });
assert.equal(stagedUnknown.staged.length, 0, "a staged customer we have never delivered to adds NO minutes");
assert.ok(stagedUnknown.excludedAccounts.some((e) => e.customer === "Never Delivered Co"), "it is excluded by name");

// -- 7. RECORDS WITHOUT MINUTES ARE EXCLUDED AND LISTED ----------------------------------------------
const withJunk = buildCapacityTruth({
  accounts: [{ customer: "Mixed Co", records: [...NORTHLINE.records, { id: "T-999", at: ago(3) }] }],
  operatorWeeklyMinutes: 600,
}, { now: NOW });
assert.equal(withJunk.accounts[0].totalMinutes, 240, "the unrecorded record adds nothing at all");
assert.ok(withJunk.excludedRecords.some((e) => e.id === "T-999"), "and it is listed as excluded, not silently dropped");
assert.ok(capacityMarkdown(withJunk).includes("T-999"), "the exclusion is visible on the report");

// -- 8. NO MODELLED TIME ANYWHERE IN THE MODULE -------------------------------------------------------
const src = readFileSync(new URL("../src/shared/delivery-capacity-truth.mjs", import.meta.url), "utf8");
const code = src.replace(/^\s*\/\/.*$/gm, "");
assert.equal(/typicalMinutes|estimatedMinutes|assumedMinutes|DEFAULT_MINUTES/i.test(code), false,
  "no modelled, estimated, assumed or default fix time exists in code");
assert.ok(capacityMarkdown(under).includes(OBSERVED_ONLY_NOTE), "the observed-only rule prints with the report");

console.log("# J2: delivery capacity truth - 8 assertion groups green");
