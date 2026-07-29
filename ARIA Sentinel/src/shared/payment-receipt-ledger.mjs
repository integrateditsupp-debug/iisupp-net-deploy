// RUN-K K1 — PAYMENT RECEIPT LEDGER (pure, local-only, Rule 14 real-or-empty).
// ONE place a real received payment is recorded, and the ONLY place downstream revenue reporting is
// allowed to learn that money landed. A payment without a processor reference is NOT received — it is
// recorded as CLAIMED, UNVERIFIED and counted separately, on its own line, forever.
//
// Honesty invariants (Rule 14):
//   - NO REFERENCE, NO RECEIPT. A payment can never be created as received without a real processor
//     reference. There is no flag, option, or override that relaxes this — test-locked.
//   - CLAIMED IS NOT RECEIVED. Unverified claims are counted in their own total (`claimedCad`) and are
//     structurally incapable of reaching `verifiedCad`, the truth board, or the weekly digest.
//   - ONE ENTRY, EVERY REPORT. `toBoardPayments()` is the single adapter into the I3 truth board (and
//     therefore the J3 digest). Recording a payment once moves the board and the digest with no second
//     entry and no manual sync — test-locked against duplicate ids.
//   - NOTHING CHARGES. This module has no network client, no payment SDK, no process spawn, no disk
//     access. It cannot take money; it can only record money someone else already took (static-scanned).
//   - Rule 15 additive: revenue-truth-board / weekly-truth-digest / billing-handoff are read-only
//     consumers and inputs; none are renamed, replaced, or wrapped away.

export const RECEIPT_LEDGER_SCHEMA = "payment-receipt-ledger.v1";

/** Structural, not stateful — this module cannot move money. */
export const CHARGED = false;
export const REFUNDED = false;

export const NO_REFERENCE_REASON =
  "no processor reference - recorded as CLAIMED, UNVERIFIED and counted separately, never as received";

export const EMPTY_NOTE =
  "No payment has been recorded. Real money in reads CAD $0 because CAD $0 is true.";

export const CLAIMED_NOTE =
  "Claimed but unverified. It is not revenue, it is not on the board, and it is not in the digest until a real processor reference exists.";

export const ONE_ENTRY_NOTE =
  "Recorded once here. The revenue truth board and the weekly digest read this ledger - there is no second entry to keep in sync.";

/** Accepted processors. An unrecognised processor is a rejection, not a silent 'other'. */
export const PROCESSORS = ["stripe", "paypal", "square", "e-transfer", "cheque", "wire", "cash"];

function str(v) { return typeof v === "string" && v.trim() ? v.trim() : null; }

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

// -- 1. Classify one entry. Received, claimed, or rejected - never guessed ------------------------------
export function classifyEntry(entry = {}) {
  const src = entry && typeof entry === "object" ? entry : {};
  const id = str(src.id);
  const customer = str(src.customer);
  const amountCad = money(src.amountCad);
  const t = src.receivedAt ? Date.parse(src.receivedAt) : NaN;

  // Identity/amount/date are required to record ANYTHING at all - a nameless or dateless payment is
  // not a record, it is a rumour.
  const missing = [];
  if (!id) missing.push("id");
  if (!customer) missing.push("customer");
  if (amountCad === null) missing.push("amountCad (> 0)");
  if (Number.isNaN(t)) missing.push("receivedAt (a real date)");
  if (missing.length) {
    return { state: "rejected", id: id || "(missing id)", missing, why: "cannot be recorded - missing: " + missing.join(", ") };
  }

  const reference = str(src.reference);
  const processor = str(src.processor) ? String(src.processor).trim().toLowerCase() : null;

  if (!reference) {
    return {
      state: "claimed",
      id, customer, amountCad,
      receivedAt: new Date(t).toISOString(),
      processor: processor && PROCESSORS.includes(processor) ? processor : null,
      reference: null,
      why: NO_REFERENCE_REASON,
    };
  }
  if (!processor || !PROCESSORS.includes(processor)) {
    return {
      state: "claimed",
      id, customer, amountCad,
      receivedAt: new Date(t).toISOString(),
      processor: null,
      reference,
      why: "reference given but the processor is missing or unrecognised - unverifiable, so counted as claimed",
    };
  }
  return {
    state: "verified",
    id, customer, amountCad,
    receivedAt: new Date(t).toISOString(),
    processor,
    reference,
    why: null,
  };
}

// -- 2. The ledger --------------------------------------------------------------------------------------
export function buildReceiptLedger(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const entries = Array.isArray(src.entries) ? src.entries : [];

  const verified = [];
  const claimed = [];
  const rejected = [];
  const seen = new Set();

  for (const e of entries) {
    const c = classifyEntry(e);
    if (c.state === "rejected") { rejected.push({ id: c.id, missing: c.missing, why: c.why }); continue; }
    // A duplicate id is a bookkeeping error, not a second payment. Counting it twice would inflate
    // real revenue - the one number we are least allowed to inflate.
    if (seen.has(c.id)) { rejected.push({ id: c.id, missing: [], why: "duplicate id - a payment is recorded once; the repeat is not counted" }); continue; }
    seen.add(c.id);
    if (c.state === "verified") verified.push(c);
    else claimed.push(c);
  }

  verified.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
  claimed.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));

  const verifiedCad = Math.round(verified.reduce((s, p) => s + p.amountCad, 0) * 100) / 100;
  const claimedCad = Math.round(claimed.reduce((s, p) => s + p.amountCad, 0) * 100) / 100;

  return {
    schema: RECEIPT_LEDGER_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    charged: CHARGED,
    refunded: REFUNDED,
    verified,
    claimed,
    rejected,
    verifiedCad,
    claimedCad,
    firstReceivedAt: verified.length ? verified[0].receivedAt : null,
    empty: verified.length === 0 && claimed.length === 0,
    noneReceived: verified.length === 0,
    note: ONE_ENTRY_NOTE,
  };
}

// -- 3. The ONLY bridge into downstream reporting -------------------------------------------------------
// Shapes verified receipts for buildTruthBoard({ payments }) — which the J3 digest already reads. One
// recorded payment therefore moves the board AND the digest with no second entry anywhere.
export function toBoardPayments(ledger) {
  if (!ledger || ledger.schema !== RECEIPT_LEDGER_SCHEMA) return [];
  return ledger.verified.map((p) => ({
    id: p.id,
    customer: p.customer,
    amountCad: p.amountCad,
    receivedAt: p.receivedAt,
    received: true,
  }));
}

// -- 4. Say it plainly ----------------------------------------------------------------------------------
export function receiptLedgerMarkdown(ledger) {
  if (!ledger || ledger.schema !== RECEIPT_LEDGER_SCHEMA) return "No payment receipt ledger.";
  const out = [];
  out.push("# Payment receipt ledger");
  out.push("");
  out.push("**Verified received: CAD $" + ledger.verifiedCad + "**");
  // An empty ledger still shows what was REJECTED - a record we refused to count is part of the truth,
  // not something to hide behind a clean zero.
  if (ledger.empty && ledger.rejected.length === 0) {
    out.push("");
    out.push(EMPTY_NOTE);
    return out.join("\n");
  }
  if (ledger.noneReceived) {
    out.push("");
    out.push(EMPTY_NOTE);
  } else {
    out.push("");
    for (const p of ledger.verified) {
      out.push("- " + p.customer + ": CAD $" + p.amountCad + " received " + p.receivedAt +
        " - " + p.processor + " ref " + p.reference + " (" + p.id + ")");
    }
  }
  if (ledger.claimed.length) {
    out.push("");
    out.push("## Claimed, unverified - CAD $" + ledger.claimedCad + " (NOT revenue)");
    out.push(CLAIMED_NOTE);
    for (const p of ledger.claimed) {
      out.push("- " + p.customer + ": CAD $" + p.amountCad + " claimed " + p.receivedAt + " - " + p.why + " (" + p.id + ")");
    }
  }
  if (ledger.rejected.length) {
    out.push("");
    out.push("## Not recorded (fix the record, do not fake the receipt)");
    for (const r of ledger.rejected) out.push("- " + r.id + ": " + r.why);
  }
  out.push("");
  out.push("_" + ledger.note + "_");
  return out.join("\n");
}
