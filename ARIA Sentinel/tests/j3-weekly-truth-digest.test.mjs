// RUN-J J3 - sixty-second weekly truth digest. Locks: empty / partial / full weeks all render honestly,
// "nothing moved" is reachable, staged is never reported as done, and no vanity language survives.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWeeklyDigest, weeklyDigestMarkdown, highestValueAction, weekPayments,
  DIGEST_SCHEMA, NOTHING_MOVED, NOTHING_MOVED_NOTE, BANNED_LANGUAGE, MONEY_ZERO_NOTE, ACTION_NONE,
} from "../src/shared/weekly-truth-digest.mjs";
import { buildTruthBoard } from "../src/shared/revenue-truth-board.mjs";
import { buildAutopsy } from "../src/shared/deal-blocker-autopsy.mjs";
import { buildCapacityTruth } from "../src/shared/delivery-capacity-truth.mjs";
import { buildBillingHandoff } from "../src/shared/billing-handoff.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const RECORDS = [
  { id: "T-401", at: ago(28), durationMinutes: 60 },
  { id: "T-402", at: ago(21), durationMinutes: 60 },
  { id: "T-403", at: ago(14), durationMinutes: 60 },
  { id: "T-404", at: ago(1), durationMinutes: 60 },
];
const PACK = buildProofPack({ pilotId: "pilot-w", startedAt: ago(28), records: RECORDS }, { now: NOW });
const PACKET = buildClosePacket({ customer: "Northline Logistics", proofPack: PACK, plan: { name: "Managed IT - Core", priceCad: 1450, published: true }, proposedStartDate: "2026-08-01T00:00:00Z" }, { now: NOW });
const HANDOFF = buildBillingHandoff(PACKET, { now: NOW });
assert.equal(HANDOFF.produced, true, "fixture handoff is real");

// -- 1. AN EMPTY WEEK SAYS NOTHING MOVED, AND RENDERS NOTHING ELSE ------------------------------------
const empty = buildWeeklyDigest({}, { now: NOW });
assert.equal(empty.schema, DIGEST_SCHEMA, "schema is explicit");
assert.equal(empty.nothingMoved, true, "an empty week is reachable and is the honest default");
assert.equal(empty.empty, true, "and with no real input at all it is a truly empty week");
assert.equal(empty.moneyInCad, 0, "no money is invented");
const emptyMd = weeklyDigestMarkdown(empty);
assert.ok(emptyMd.includes(NOTHING_MOVED), "it says 'Nothing moved this week.' in those words");
assert.ok(emptyMd.includes(NOTHING_MOVED_NOTE), "and explains what that means");
assert.equal(/## What moved/.test(emptyMd), false, "and renders no sections at all - no filler");

// -- 2. A STAGED PACKET IS NOT MONEY AND IS NEVER 'DONE' ---------------------------------------------
const stagedBoard = buildTruthBoard({ handoffs: [HANDOFF] }, { now: NOW });
const stagedDigest = buildWeeklyDigest({ board: stagedBoard }, { now: NOW });
assert.equal(stagedDigest.moneyInCad, 0, "a staged packet adds ZERO to the money line");
assert.equal(stagedDigest.nothingMoved, true, "staged work moving nowhere is still nothing moved");
assert.equal(stagedDigest.empty, false, "but the week is not empty - there is real staged state to state");
const stagedMd = weeklyDigestMarkdown(stagedDigest);
assert.ok(stagedMd.includes("CAD $0"), "$0 prints as $0");
assert.ok(/staged, not earned, not booked/.test(stagedMd), "staged is labelled staged");
assert.ok(stagedMd.includes("Waiting on one click"), "and it sits under waiting-on-one-click, never under what moved");
assert.ok(stagedMd.includes(NOTHING_MOVED), "a week of pure staging still says nothing moved");
assert.equal(/## What moved/.test(stagedMd), false, "and renders no what-moved section at all");
assert.equal(/## What moved[\s\S]*Northline Logistics: CAD \$1450 received/.test(stagedMd), false,
  "the staged amount is never reported as received");

// -- 3. ONLY A PAYMENT RECEIVED INSIDE THE WEEK COUNTS -------------------------------------------------
const oldPay = { id: "P-OLD", customer: "Old Co", amountCad: 500, received: true, receivedAt: ago(30) };
const newPay = { id: "P-NEW", customer: "Northline Logistics", amountCad: 1450, received: true, receivedAt: ago(2) };
const paidBoard = buildTruthBoard({ payments: [oldPay, newPay] }, { now: NOW });
assert.equal(paidBoard.realRevenueCad, 1950, "the board still holds all-time real revenue");
const thisWeek = weekPayments(paidBoard, { now: NOW });
assert.equal(thisWeek.length, 1, "but only the payment inside the week is this week's money");
const paidDigest = buildWeeklyDigest({ board: paidBoard }, { now: NOW });
assert.equal(paidDigest.moneyInCad, 1450, "the weekly figure is the real in-window amount, exactly");
assert.equal(paidDigest.nothingMoved, false, "a real payment means the week moved");
assert.ok(weeklyDigestMarkdown(paidDigest).includes("P-NEW"), "and it is traceable to the payment id");

// -- 4. THE ONE ACTION IS DERIVED, NEVER INVENTED -----------------------------------------------------
assert.equal(highestValueAction({}).action, ACTION_NONE, "with no real input there is no action to claim");

const overCapacity = buildCapacityTruth({
  accounts: [{ customer: "A Co", records: RECORDS }, { customer: "B Co", records: RECORDS.map((r, i) => ({ ...r, id: "S-" + i })) }],
  operatorWeeklyMinutes: 90,
}, { now: NOW });
assert.equal(overCapacity.verdict, "over", "fixture is genuinely over capacity");
const overAction = highestValueAction({ board: stagedBoard, capacity: overCapacity });
assert.ok(/Do not close more delivery work/.test(overAction.action), "over-capacity outranks chasing another deal");
assert.equal(overAction.source, overCapacity.schema, "and cites the report it came from");

const patternAutopsy = buildAutopsy({ opportunities: [
  { id: "O-31", customer: "A Co", closed: true, missingArtifact: "SOC 2 report" },
  { id: "O-32", customer: "B Co", closed: true, missingArtifact: "SOC 2 report" },
  { id: "O-33", customer: "C Co", closed: true, missingArtifact: "SOC 2 report" },
] }, { now: NOW });
const patternAction = highestValueAction({ board: stagedBoard, autopsy: patternAutopsy });
assert.ok(/missing-artifact/.test(patternAction.action), "a real pattern is the next most valuable fix");
assert.ok(/O-31, O-32, O-33/.test(patternAction.action), "and it names every deal behind the claim");

const clickAction = highestValueAction({ board: stagedBoard });
assert.ok(/One click from Ahmad/.test(clickAction.action), "otherwise the staged invoice is the action");

const unknownOnly = buildAutopsy({ opportunities: [{ id: "O-41", customer: "Quiet Co", closed: true }] }, { now: NOW });
assert.ok(/Record the real blocker/.test(highestValueAction({ autopsy: unknownOnly }).action),
  "with only unknowns, closing the evidence gap is the action");

// -- 5. A FULL WEEK COMPOSES ALL THREE REAL REPORTS ---------------------------------------------------
const capacity = buildCapacityTruth({ accounts: [{ customer: "Northline Logistics", records: RECORDS }], operatorWeeklyMinutes: 600 }, { now: NOW });
const full = buildWeeklyDigest({ board: paidBoard, autopsy: patternAutopsy, capacity }, { now: NOW });
assert.deepEqual(full.inputs, { board: true, autopsy: true, capacity: true }, "all three real inputs are declared");
const fullMd = weeklyDigestMarkdown(full);
assert.ok(fullMd.includes("## What moved") && fullMd.includes("## What did not"), "both halves are rendered");
assert.ok(fullMd.includes("The one thing worth doing"), "and exactly one action closes the page");
assert.equal(fullMd.split("## The one thing worth doing").length - 1, 1, "one action, not a list of five");

// -- 6. NO VANITY LANGUAGE, EVER ----------------------------------------------------------------------
for (const md of [emptyMd, stagedMd, weeklyDigestMarkdown(paidDigest), fullMd]) {
  for (const word of BANNED_LANGUAGE) {
    assert.equal(md.toLowerCase().includes(word), false, "digest never says '" + word + "'");
  }
}
const src = readFileSync(new URL("../src/shared/weekly-truth-digest.mjs", import.meta.url), "utf8");
const code = src.replace(/^\s*\/\/.*$/gm, "").replace(/BANNED_LANGUAGE[\s\S]*?\];/, "");
assert.equal(/streak|momentum/i.test(code), false, "and no streak or momentum counter exists in code");

// -- 7. EVERY FIGURE ON THE DIGEST IS TRACEABLE -------------------------------------------------------
for (const m of full.moved) assert.ok(m.source, "every moved line cites its source");
for (const d of full.didNotMove) assert.ok(d.source, "every did-not-move line cites its source");
assert.equal(full.moneyInCad, thisWeek.reduce((s, p) => s + p.amountCad, 0), "the money line equals the real in-window payments");
assert.ok(MONEY_ZERO_NOTE.includes("Staged work is not money"), "the zero note states the staged rule");

console.log("# J3: weekly truth digest - 7 assertion groups green");
