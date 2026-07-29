// RUN-K K1 - payment receipt ledger. Locks: verified / claimed-unverified / none-at-all are ALL
// reachable, a payment can never be recorded as received without a real processor reference, and one
// recorded payment moves the revenue truth board AND the weekly digest with no second entry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildReceiptLedger, receiptLedgerMarkdown, classifyEntry, toBoardPayments,
  RECEIPT_LEDGER_SCHEMA, EMPTY_NOTE, CLAIMED_NOTE, NO_REFERENCE_REASON, ONE_ENTRY_NOTE, PROCESSORS,
  CHARGED, REFUNDED,
} from "../src/shared/payment-receipt-ledger.mjs";
import { buildTruthBoard } from "../src/shared/revenue-truth-board.mjs";
import { buildWeeklyDigest } from "../src/shared/weekly-truth-digest.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

// -- 1. NONE AT ALL IS REACHABLE AND SAYS SO ----------------------------------------------------------
const none = buildReceiptLedger({}, { now: NOW });
assert.equal(none.schema, RECEIPT_LEDGER_SCHEMA, "schema is explicit");
assert.equal(none.empty, true, "no entries => honestly empty");
assert.equal(none.noneReceived, true, "and nothing is recorded as received");
assert.equal(none.verifiedCad, 0, "zero prints as zero");
assert.equal(none.claimedCad, 0, "and no claim is invented either");
assert.equal(none.firstReceivedAt, null, "there is no first dollar to point at");
assert.ok(receiptLedgerMarkdown(none).includes(EMPTY_NOTE), "the empty ledger says CAD $0 because CAD $0 is true");

// -- 2. NO REFERENCE => CLAIMED, UNVERIFIED - NEVER RECEIVED ------------------------------------------
const noRef = classifyEntry({ id: "P-1", customer: "Northline Logistics", amountCad: 1450, receivedAt: ago(2) });
assert.equal(noRef.state, "claimed", "a payment with no processor reference is NOT received");
assert.equal(noRef.reference, null, "and no reference is invented for it");
assert.equal(noRef.why, NO_REFERENCE_REASON, "the reason is stated in the record itself");

const claimLedger = buildReceiptLedger({ entries: [{ id: "P-1", customer: "Northline Logistics", amountCad: 1450, receivedAt: ago(2) }] }, { now: NOW });
assert.equal(claimLedger.verified.length, 0, "an unverified claim never reaches the verified list");
assert.equal(claimLedger.verifiedCad, 0, "and adds nothing to real revenue");
assert.equal(claimLedger.claimed.length, 1, "it is counted - separately");
assert.equal(claimLedger.claimedCad, 1450, "in its own total");
assert.equal(claimLedger.noneReceived, true, "with a claim only, still nothing has been received");
assert.equal(claimLedger.empty, false, "but the ledger is not empty - the claim is on the record");
const claimMd = receiptLedgerMarkdown(claimLedger);
assert.ok(claimMd.includes(CLAIMED_NOTE), "the page says plainly that a claim is not revenue");
assert.ok(claimMd.includes("**Verified received: CAD $0**"), "and the headline number stays zero");

// A reference with no recognisable processor is still unverifiable.
const badProc = classifyEntry({ id: "P-2", customer: "X", amountCad: 10, receivedAt: ago(1), reference: "abc123", processor: "mystery-bank" });
assert.equal(badProc.state, "claimed", "an unrecognised processor cannot verify a reference");
assert.ok(PROCESSORS.includes("stripe") && PROCESSORS.includes("e-transfer"), "the accepted processors are explicit, not open-ended");

// -- 3. A REAL REFERENCE IS THE ONLY WAY IN -----------------------------------------------------------
const REAL = { id: "P-100", customer: "Northline Logistics", amountCad: 1450, receivedAt: ago(2), processor: "stripe", reference: "pi_3RealRef000" };
const ledger = buildReceiptLedger({ entries: [REAL] }, { now: NOW });
assert.equal(ledger.verified.length, 1, "a referenced payment is recorded as received");
assert.equal(ledger.verifiedCad, 1450, "and counts, exactly as recorded");
assert.equal(ledger.noneReceived, false, "money has landed");
assert.equal(ledger.firstReceivedAt, new Date(Date.parse(REAL.receivedAt)).toISOString(), "the first dollar has a real timestamp");
assert.ok(receiptLedgerMarkdown(ledger).includes("pi_3RealRef000"), "the evidence is printed, not summarised away");

// -- 4. ONE ENTRY MOVES EVERY DOWNSTREAM REPORT, WITH NO SECOND ENTRY ---------------------------------
const boardPayments = toBoardPayments(ledger);
assert.equal(boardPayments.length, 1, "exactly one payment crosses into reporting");
assert.equal(boardPayments[0].received, true, "shaped for the board without a manual re-key");
const board = buildTruthBoard({ payments: boardPayments }, { now: NOW });
assert.equal(board.realRevenueCad, 1450, "the revenue truth board moves on its own");
assert.equal(board.payments.length, 1, "with no duplicate entry");
const digest = buildWeeklyDigest({ board }, { now: NOW });
assert.equal(digest.moneyInCad, 1450, "and so does the weekly digest - from the same single record");
assert.equal(digest.nothingMoved, false, "a real payment is real movement");
assert.equal(digest.payments.length, 1, "counted once, not once per report");

// An unverified claim is structurally incapable of reaching either report.
assert.equal(toBoardPayments(claimLedger).length, 0, "a claim cannot cross into the board");
assert.equal(buildTruthBoard({ payments: toBoardPayments(claimLedger) }, { now: NOW }).realRevenueCad, 0, "so revenue stays $0");
assert.deepEqual(toBoardPayments(null), [], "a non-ledger yields no payments");
assert.deepEqual(toBoardPayments({ schema: "something-else" }), [], "and neither does a foreign object");

// -- 5. A DUPLICATE ID IS A BOOKKEEPING ERROR, NOT A SECOND PAYMENT -----------------------------------
const dup = buildReceiptLedger({ entries: [REAL, { ...REAL }] }, { now: NOW });
assert.equal(dup.verified.length, 1, "the same payment is recorded once");
assert.equal(dup.verifiedCad, 1450, "real revenue is not doubled");
assert.equal(dup.rejected.length, 1, "and the repeat is reported, not swallowed");
assert.ok(/duplicate id/.test(dup.rejected[0].why), "with the reason named");

// -- 6. AN INCOMPLETE RECORD IS REJECTED AND NAMED ----------------------------------------------------
const junk = buildReceiptLedger({ entries: [
  { customer: "No Id", amountCad: 10, receivedAt: ago(1), processor: "stripe", reference: "r" },
  { id: "P-3", amountCad: 10, receivedAt: ago(1), processor: "stripe", reference: "r" },
  { id: "P-4", customer: "No Amount", receivedAt: ago(1), processor: "stripe", reference: "r" },
  { id: "P-5", customer: "No Date", amountCad: 10, processor: "stripe", reference: "r" },
  { id: "P-6", customer: "Negative", amountCad: -5, receivedAt: ago(1), processor: "stripe", reference: "r" },
] }, { now: NOW });
assert.equal(junk.verified.length, 0, "none of these are receipts");
assert.equal(junk.rejected.length, 5, "each is rejected on its own line");
assert.ok(junk.rejected.every((r) => Array.isArray(r.missing) && r.missing.length > 0), "and each names what was missing");
assert.ok(receiptLedgerMarkdown(junk).includes("fix the record, do not fake the receipt"), "the fix is stated as fixing data, not softening the number");

// -- 7. THIS MODULE CANNOT MOVE MONEY (structural, static-scanned) ------------------------------------
assert.equal(CHARGED, false, "nothing here charges");
assert.equal(REFUNDED, false, "nothing here refunds");
const SRC = readFileSync(new URL("../src/shared/payment-receipt-ledger.mjs", import.meta.url), "utf8");
for (const forbidden of ["node:child_process", "node:fs", "node:net", "node:http", "fetch(", "XMLHttpRequest", "stripe.", "require("]) {
  assert.equal(SRC.includes(forbidden), false, "receipt ledger has no capability to " + forbidden);
}
assert.ok(SRC.includes(ONE_ENTRY_NOTE.slice(0, 20)), "the one-entry promise is in the module, not just the test");

console.log("k1-payment-receipt-ledger: 7 assertion groups green");
