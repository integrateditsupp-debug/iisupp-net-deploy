// ask-ledger.mjs — RUN-M M3: THE ASK LEDGER
//
// WHY (RUN-M, 2026-07-28): M1 says who is ask-ready. M2 stages the packet. M3 is the only place
// that records what ACTUALLY happened after a human clicked send — and it is deliberately hostile
// to optimism. Twelve runs of machinery with zero dollars received is a fact this ledger will keep
// stating in exactly those words until a real receipt exists.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - "PAID" REQUIRES A REAL K1 RECEIPT. An outcome of paid with no verified payment-receipt-ledger.v1
//     entry behind it is REFUSED and reported as unsubstantiated. Never accepted, never downgraded quietly.
//   - ZERO SENT IS REPORTED AS ZERO SENT. Never "pipeline", never "in motion", never "warm".
//   - STAGED IS NOT SENT. A packet sitting on disk is counted separately and never folded into sent.
//   - APPEND-ONLY IN SPIRIT. An outcome may be CORRECTED, but the prior value stays visible in the
//     entry's history with its own timestamp. Nothing is silently overwritten.
//   - CLOCKS ARE OBSERVED, NEVER PROJECTED. A duration exists only when both real timestamps exist.
//   - Nothing sends, signs, or charges. No network, no spawn, no filesystem reach.
//   - Rule 15 additive: the K1 receipt ledger is a read-only input, untouched.

export const ASK_LEDGER_SCHEMA = "ask-ledger.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const ZERO_SENT_STATEMENT =
  "Zero asks sent. Not pipeline, not in motion, not warm - zero sent.";

export const NO_REVENUE_STATEMENT =
  "No ask has been paid. Revenue received to date on this ledger: none.";

// The only outcomes that exist. Anything else is rejected rather than mapped to the nearest.
export const OUTCOMES = ["no-reply", "declined", "negotiating", "paid"];

export const OUTCOME_LABELS = {
  "no-reply": "Sent, no reply",
  declined: "Declined",
  negotiating: "Negotiating",
  paid: "Paid (receipt verified)",
};

function ts(x) {
  if (typeof x !== "string") return null;
  const t = Date.parse(x);
  return Number.isNaN(t) ? null : t;
}
function iso(t) { return t === null ? null : new Date(t).toISOString(); }
function days(fromT, toT) {
  if (fromT === null || toT === null || toT < fromT) return null;
  return Math.round(((toT - fromT) / 86400000) * 100) / 100;
}
function verifiedReceiptIds(receiptLedger) {
  const l = receiptLedger;
  if (!l || l.schema !== "payment-receipt-ledger.v1" || !Array.isArray(l.verified)) return new Set();
  return new Set(l.verified.map((r) => r && r.id).filter((i) => typeof i === "string" && i.length));
}

/**
 * events: append-only records, each { askId, account, at, type, ... }
 *   type "staged"   -> { packetRefused?: boolean }
 *   type "sent"     -> {}
 *   type "outcome"  -> { outcome, reason?, receiptId?, corrects?: true }
 * Later events with type "outcome" for the same askId are CORRECTIONS: the prior outcome is kept
 * in history, visible, with its own timestamp.
 *
 * input: { events, receiptLedger }
 */
export function buildAskLedger(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: ASK_LEDGER_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    appendOnly: true,
  };

  const events = Array.isArray(input && input.events) ? input.events : [];
  const receipts = verifiedReceiptIds(input && input.receiptLedger);

  const byId = new Map();
  const rejected = [];

  // Stable order: by timestamp, then by the order the caller supplied them. Never re-sorted by outcome.
  const ordered = events
    .map((e, i) => ({ e, i, t: ts(e && e.at) }))
    .filter((x) => {
      if (!x.e || typeof x.e.askId !== "string" || !x.e.askId.length) { rejected.push({ why: "event has no real askId", event: x.e || null }); return false; }
      if (x.t === null) { rejected.push({ why: "event has no real timestamp - never inferred", event: x.e }); return false; }
      return true;
    })
    .sort((a, b) => (a.t - b.t) || (a.i - b.i));

  for (const { e, t } of ordered) {
    let rec = byId.get(e.askId);
    if (!rec) {
      rec = {
        askId: e.askId,
        account: typeof e.account === "string" && e.account.length ? e.account : null,
        stagedAt: null, sentAt: null,
        outcome: null, outcomeAt: null, reason: null, receiptId: null,
        history: [], unsubstantiated: false,
      };
      byId.set(e.askId, rec);
    }
    if (!rec.account && typeof e.account === "string" && e.account.length) rec.account = e.account;

    if (e.type === "staged") {
      if (rec.stagedAt === null) rec.stagedAt = t;
      continue;
    }
    if (e.type === "sent") {
      if (rec.sentAt === null) rec.sentAt = t;
      continue;
    }
    if (e.type === "outcome") {
      const outcome = typeof e.outcome === "string" ? e.outcome : null;
      if (!OUTCOMES.includes(outcome)) {
        rejected.push({ askId: e.askId, why: `unknown outcome "${outcome}" - never mapped to the nearest one`, event: e });
        continue;
      }
      if (rec.sentAt === null) {
        rejected.push({ askId: e.askId, why: "an outcome cannot exist for an ask that was never sent", event: e });
        continue;
      }
      // "paid" is the one outcome that must be earned by a real receipt.
      if (outcome === "paid") {
        const rid = typeof e.receiptId === "string" ? e.receiptId : null;
        if (!rid || !receipts.has(rid)) {
          rejected.push({ askId: e.askId, why: "paid refused - no verified K1 receipt behind it", event: e });
          rec.unsubstantiated = true;
          continue;
        }
        rec.receiptId = rid;
      }
      // A correction keeps the prior value visible, with its own timestamp.
      if (rec.outcome !== null) {
        rec.history.push({ outcome: rec.outcome, at: iso(rec.outcomeAt), reason: rec.reason, receiptId: rec.receiptId, correctedAt: iso(t) });
      }
      rec.outcome = outcome;
      rec.outcomeAt = t;
      rec.reason = typeof e.reason === "string" && e.reason.trim() ? e.reason.trim() : null;
      if (outcome !== "paid") rec.receiptId = null;
      continue;
    }
    rejected.push({ askId: e.askId, why: `unknown event type "${e.type}"`, event: e });
  }

  const asks = [...byId.values()].map((r) => ({
    askId: r.askId,
    account: r.account,
    stagedAt: iso(r.stagedAt),
    sentAt: iso(r.sentAt),
    outcome: r.outcome,
    outcomeAt: iso(r.outcomeAt),
    reason: r.reason,
    receiptId: r.receiptId,
    corrected: r.history.length > 0,
    history: r.history,
    unsubstantiated: r.unsubstantiated,
    // Observed clocks only: both ends must be real timestamps.
    daysStagedToSent: days(r.stagedAt, r.sentAt),
    daysSentToOutcome: days(r.sentAt, r.outcomeAt),
  })).sort((a, b) => a.askId.localeCompare(b.askId));

  const staged = asks.filter((a) => a.stagedAt !== null).length;
  const sentCount = asks.filter((a) => a.sentAt !== null).length;
  const replied = asks.filter((a) => a.outcome && a.outcome !== "no-reply").length;
  const declined = asks.filter((a) => a.outcome === "declined").length;
  const negotiating = asks.filter((a) => a.outcome === "negotiating").length;
  const paid = asks.filter((a) => a.outcome === "paid").length;

  const sentToOutcomeClocks = asks.map((a) => a.daysSentToOutcome).filter((d) => d !== null);
  const medianDaysSentToOutcome = sentToOutcomeClocks.length
    ? (() => { const s = [...sentToOutcomeClocks].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 100) / 100; })()
    : null;

  const counts = {
    staged, sent: sentCount, replied, declined, negotiating, paid,
    stagedNotSent: staged - sentCount,
    rejectedEvents: rejected.length,
    unsubstantiatedPaidClaims: asks.filter((a) => a.unsubstantiated).length,
  };

  const statement = sentCount === 0
    ? ZERO_SENT_STATEMENT + " " + NO_REVENUE_STATEMENT + (staged ? ` ${staged} packet(s) are staged and waiting on a human click - staged is not sent.` : "")
    : paid === 0
      ? `${sentCount} ask(s) sent, ${replied} repl${replied === 1 ? "y" : "ies"}. ` + NO_REVENUE_STATEMENT
      : `${sentCount} ask(s) sent, ${replied} repl${replied === 1 ? "y" : "ies"}, ${paid} paid - each paid outcome carries a verified receipt.`;

  return {
    ...base,
    empty: asks.length === 0,
    asks,
    counts,
    rejected,
    medianDaysSentToOutcome,
    statement,
  };
}

export function askLedgerMarkdown(ledger) {
  if (!ledger || ledger.schema !== ASK_LEDGER_SCHEMA) return "_no ask ledger_";
  const lines = ["## Ask ledger", "", ledger.statement, ""];
  if (ledger.empty) {
    lines.push("_No ask has been staged or sent. Nothing is recorded because nothing happened._");
    return lines.join("\n") + "\n";
  }
  const c = ledger.counts;
  lines.push(`_staged ${c.staged} · sent ${c.sent} · replies ${c.replied} · declined ${c.declined} · negotiating ${c.negotiating} · **paid ${c.paid}**_`, "");
  lines.push("| Ask | Account | Sent | Outcome | Days sent to outcome | Receipt |", "| --- | --- | --- | --- | --- | --- |");
  for (const a of ledger.asks) {
    lines.push(`| ${a.askId} | ${a.account || "(unnamed)"} | ${a.sentAt || "not sent"} | ${a.outcome ? OUTCOME_LABELS[a.outcome] : "-"}${a.corrected ? " (corrected)" : ""} | ${a.daysSentToOutcome === null ? "-" : a.daysSentToOutcome} | ${a.receiptId || "-"} |`);
  }
  const corrected = ledger.asks.filter((a) => a.corrected);
  if (corrected.length) {
    lines.push("", "### Corrections — the prior value stays visible");
    for (const a of corrected) {
      for (const h of a.history) lines.push(`- **${a.askId}** was "${h.outcome}" (recorded ${h.at}), corrected ${h.correctedAt}`);
    }
  }
  if (c.unsubstantiatedPaidClaims) {
    lines.push("", `### Refused`, `- ${c.unsubstantiatedPaidClaims} "paid" claim(s) refused for want of a verified receipt. A paid outcome without money we can point at is not a paid outcome.`);
  }
  lines.push("", "_Observed clocks only. Staged is never counted as sent. Nothing here sends, signs, or charges._");
  return lines.join("\n") + "\n";
}
