// m3-ask-ledger.test.mjs — RUN-M M3 exit criteria, test-locked.
// zero-sent / sent-no-reply / declined / paid all reachable; a "paid" without a K1 receipt is
// refused; corrections are visible; nothing sends (static-scan locked).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ASK_LEDGER_SCHEMA, SENT, NOTHING_SENT, OUTCOMES, ZERO_SENT_STATEMENT, NO_REVENUE_STATEMENT,
  buildAskLedger, askLedgerMarkdown,
} from "../src/shared/ask-ledger.mjs";

const NOW = Date.parse("2026-08-15T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// A real K1 verified receipt ledger — the ONLY thing that can substantiate a "paid".
const receiptLedger = {
  schema: "payment-receipt-ledger.v1",
  verified: [{ id: "rcpt-1", processor: "e-transfer", reference: "et-88213" }],
};

test("EMPTY: nothing staged, nothing sent — reported as exactly that", () => {
  const l = buildAskLedger({ events: [], receiptLedger }, { now: NOW });
  assert.equal(l.schema, ASK_LEDGER_SCHEMA);
  assert.equal(l.empty, true);
  assert.equal(l.counts.sent, 0);
  assert.ok(l.statement.startsWith(ZERO_SENT_STATEMENT));
  assert.ok(l.statement.includes(NO_REVENUE_STATEMENT));
  assert.ok(/nothing happened/.test(askLedgerMarkdown(l)));
});

test("ZERO SENT IS ZERO SENT — staged packets are never folded into sent or called pipeline", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-1", account: "northline", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-2", account: "harbor", type: "staged", at: "2026-08-02T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.counts.staged, 2);
  assert.equal(l.counts.sent, 0);
  assert.equal(l.counts.stagedNotSent, 2);
  assert.ok(l.statement.startsWith(ZERO_SENT_STATEMENT));
  assert.ok(/staged is not sent/.test(l.statement));
  assert.ok(!/pipeline|warm|in motion/i.test(l.statement.replace(ZERO_SENT_STATEMENT, "")));
});

test("SENT, NO REPLY is reachable and carries an observed staged-to-sent clock", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-1", account: "northline", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-1", type: "sent", at: "2026-08-03T00:00:00Z" },
      { askId: "ask-1", type: "outcome", outcome: "no-reply", at: "2026-08-13T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  const a = l.asks[0];
  assert.equal(a.outcome, "no-reply");
  assert.equal(a.daysStagedToSent, 2);
  assert.equal(a.daysSentToOutcome, 10);
  assert.equal(l.counts.sent, 1);
  assert.equal(l.counts.replied, 0, "no-reply is not a reply");
  assert.equal(l.counts.paid, 0);
  assert.ok(l.statement.includes(NO_REVENUE_STATEMENT));
});

test("DECLINED is reachable and keeps the real reason verbatim", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-2", account: "harbor", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-2", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "ask-2", type: "outcome", outcome: "declined", reason: "renewed with incumbent through March", at: "2026-08-06T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.counts.declined, 1);
  assert.equal(l.counts.replied, 1);
  assert.equal(l.asks[0].reason, "renewed with incumbent through March");
  assert.equal(l.asks[0].daysSentToOutcome, 4);
});

test("NEGOTIATING is reachable and is never counted as a close", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-3", account: "delta", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-3", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "ask-3", type: "outcome", outcome: "negotiating", reason: "wants 3-month term", at: "2026-08-05T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.counts.negotiating, 1);
  assert.equal(l.counts.paid, 0);
  assert.ok(l.statement.includes(NO_REVENUE_STATEMENT));
});

test("PAID is reachable ONLY with a verified K1 receipt behind it", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-4", account: "delta", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-4", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "ask-4", type: "outcome", outcome: "paid", receiptId: "rcpt-1", at: "2026-08-09T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.counts.paid, 1);
  assert.equal(l.asks[0].receiptId, "rcpt-1");
  assert.equal(l.asks[0].daysSentToOutcome, 7);
  assert.ok(/each paid outcome carries a verified receipt/.test(l.statement));
});

test("A 'PAID' WITHOUT A REAL RECEIPT IS REFUSED — never accepted, never quietly downgraded", () => {
  for (const bad of [
    { askId: "ask-5", type: "outcome", outcome: "paid", at: "2026-08-09T00:00:00Z" },                      // no receiptId
    { askId: "ask-5", type: "outcome", outcome: "paid", receiptId: "rcpt-does-not-exist", at: "2026-08-09T00:00:00Z" },
  ]) {
    const l = buildAskLedger({
      events: [
        { askId: "ask-5", account: "delta", type: "staged", at: "2026-08-01T00:00:00Z" },
        { askId: "ask-5", type: "sent", at: "2026-08-02T00:00:00Z" },
        bad,
      ],
      receiptLedger,
    }, { now: NOW });
    assert.equal(l.counts.paid, 0, "an unsubstantiated paid never counts");
    assert.equal(l.asks[0].outcome, null, "and it is not quietly recorded as something else");
    assert.equal(l.counts.unsubstantiatedPaidClaims, 1);
    assert.ok(l.rejected.some((r) => /no verified K1 receipt/.test(r.why)));
    assert.ok(/refused for want of a verified receipt/.test(askLedgerMarkdown(l)));
  }
});

test("AN EMPTY RECEIPT LEDGER CANNOT SUBSTANTIATE ANYTHING", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-6", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-6", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "ask-6", type: "outcome", outcome: "paid", receiptId: "rcpt-1", at: "2026-08-09T00:00:00Z" },
    ],
    receiptLedger: { schema: "payment-receipt-ledger.v1", verified: [] },
  }, { now: NOW });
  assert.equal(l.counts.paid, 0);
  assert.equal(l.counts.unsubstantiatedPaidClaims, 1);
});

test("CORRECTIONS ARE VISIBLE — the prior value is kept with its own timestamp, never overwritten", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-7", account: "harbor", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-7", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "ask-7", type: "outcome", outcome: "no-reply", at: "2026-08-12T00:00:00Z" },
      { askId: "ask-7", type: "outcome", outcome: "declined", reason: "budget frozen", at: "2026-08-14T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  const a = l.asks[0];
  assert.equal(a.outcome, "declined");
  assert.equal(a.corrected, true);
  assert.equal(a.history.length, 1);
  assert.equal(a.history[0].outcome, "no-reply");
  assert.equal(a.history[0].at, "2026-08-12T00:00:00.000Z");
  assert.equal(a.history[0].correctedAt, "2026-08-14T00:00:00.000Z");
  const md = askLedgerMarkdown(l);
  assert.ok(/Corrections — the prior value stays visible/.test(md));
  assert.ok(/was "no-reply"/.test(md));
});

test("AN OUTCOME FOR AN ASK THAT WAS NEVER SENT IS REFUSED", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-8", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-8", type: "outcome", outcome: "declined", at: "2026-08-05T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.asks[0].outcome, null);
  assert.ok(l.rejected.some((r) => /never sent/.test(r.why)));
});

test("UNKNOWN OUTCOMES AND UNDATED EVENTS ARE REFUSED, NEVER MAPPED TO THE NEAREST", () => {
  const l = buildAskLedger({
    events: [
      { askId: "ask-9", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "ask-9", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "ask-9", type: "outcome", outcome: "verbal yes", at: "2026-08-05T00:00:00Z" },
      { askId: "ask-9", type: "outcome", outcome: "declined", at: "not-a-date" },
      { type: "sent", at: "2026-08-02T00:00:00Z" },
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.asks[0].outcome, null);
  assert.ok(l.rejected.some((r) => /unknown outcome/.test(r.why)));
  assert.ok(l.rejected.some((r) => /no real timestamp/.test(r.why)));
  assert.ok(l.rejected.some((r) => /no real askId/.test(r.why)));
  assert.ok(!OUTCOMES.includes("verbal yes"));
});

test("CONVERSION TRUTH across a mixed real set, with an observed median clock", () => {
  const l = buildAskLedger({
    events: [
      { askId: "a", account: "northline", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "a", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "a", type: "outcome", outcome: "paid", receiptId: "rcpt-1", at: "2026-08-08T00:00:00Z" },   // 6 days
      { askId: "b", account: "harbor", type: "staged", at: "2026-08-01T00:00:00Z" },
      { askId: "b", type: "sent", at: "2026-08-02T00:00:00Z" },
      { askId: "b", type: "outcome", outcome: "declined", reason: "no budget", at: "2026-08-06T00:00:00Z" }, // 4 days
      { askId: "c", account: "delta", type: "staged", at: "2026-08-03T00:00:00Z" },                          // staged only
    ],
    receiptLedger,
  }, { now: NOW });
  assert.equal(l.counts.staged, 3);
  assert.equal(l.counts.sent, 2);
  assert.equal(l.counts.stagedNotSent, 1);
  assert.equal(l.counts.replied, 2);
  assert.equal(l.counts.paid, 1);
  assert.equal(l.medianDaysSentToOutcome, 5);
  assert.deepEqual(l.asks.map((x) => x.askId), ["a", "b", "c"], "stable ordering by ask id");
});

test("nothing sends: flags + markdown carry the law", () => {
  assert.equal(SENT, false);
  assert.equal(NOTHING_SENT, true);
  const l = buildAskLedger({ events: [{ askId: "z", type: "staged", at: "2026-08-01T00:00:00Z" }], receiptLedger }, { now: NOW });
  assert.equal(l.sent, false);
  assert.equal(l.nothingSent, true);
  assert.equal(l.appendOnly, true);
  const md = askLedgerMarkdown(l);
  assert.ok(/Ask ledger/.test(md));
  assert.ok(/Staged is never counted as sent/.test(md));
  assert.ok(/sends, signs, or charges/.test(md));
  assert.equal(askLedgerMarkdown(null), "_no ask ledger_");
});

test("STATIC-SCAN LOCK: the source has no send/network/exec class at all", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/ask-ledger.mjs"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /\bhttps?:\/\//, /nodemailer/, /sendmail/i,
    /child_process/, /\bexec(Sync)?\s*\(/, /\bspawn\s*\(/, /net\.(connect|Socket)/, /\brequest\s*\(/,
    /readFileSync/, /writeFileSync/, /stripe/i, /invoice\s*\(/, /smtp/i,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `ask-ledger.mjs must not contain ${re}`);
  }
});
