// RUN-I I3 — ONE HONEST REVENUE TRUTH BOARD (pure, local-only, Rule 14 real-or-empty).
// Reads the real F/G/H/I outputs and states, in ten seconds: real money invoiced (or zero), real
// pipeline with the evidence behind each entry, what is blocked on Ahmad's one click, what is blocked
// on us. Zero prints as zero. There is no weighted-pipeline theatre and no "potential ARR" headline.
//
// Honesty invariants (Rule 14):
//   - NO NUMBER WITHOUT A SOURCE. Every figure carries the record/packet/handoff it came from.
//   - REAL MONEY ONLY. `realRevenueCad` counts payments that were actually recorded as received. A
//     staged billing handoff is explicitly NOT revenue - it is listed as blocked on Ahmad.
//   - EMPTY SECTIONS SAY SO AND RENDER NOTHING. No filler, no placeholder pipeline entry.
//   - NO WEIGHTING. Pipeline is a list of real, evidenced entries - never a probability-multiplied total.
//   - Rule 15 additive: revenue-board / pilot-console / conversion-digest / acquisition-funnel and every
//     F/G/H/I module are read-only inputs here; none are renamed, wrapped away, or replaced.

export const TRUTH_BOARD_SCHEMA = "revenue-truth-board.v1";

export const NO_WEIGHTING_NOTE =
  "No weighted pipeline, no projected ARR. Every line is a real, evidenced entry or it is not on this board.";

export const ZERO_NOTE =
  "No money has actually landed. Real revenue reads $0 because $0 is true.";

export const EMPTY_SECTION = "Nothing real here yet - this section renders nothing rather than filler.";

// -- 1. Only a recorded, received payment is revenue ---------------------------------------------------
export function realPayment(payment = {}) {
  if (!payment || typeof payment !== "object") return null;
  if (payment.received !== true) return null;
  const amount = Number(payment.amountCad);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const id = typeof payment.id === "string" ? payment.id.trim() : "";
  if (!id) return null;
  const t = payment.receivedAt ? Date.parse(payment.receivedAt) : NaN;
  if (Number.isNaN(t)) return null;
  const customer = typeof payment.customer === "string" && payment.customer.trim() ? payment.customer.trim() : null;
  if (!customer) return null;
  return { id, customer, amountCad: Math.round(amount * 100) / 100, receivedAt: new Date(t).toISOString() };
}

// -- 2. A pipeline entry must carry its evidence -------------------------------------------------------
export function pipelineEntry(handoff) {
  if (!handoff || typeof handoff !== "object") return null;
  if (handoff.schema !== "billing-handoff.v1" || handoff.produced !== true) return null;
  const p = handoff.payload || {};
  if (!Number.isFinite(Number(p.amount)) || Number(p.amount) <= 0) return null;
  return {
    customer: handoff.customer,
    amountCad: Number(p.amount),
    planName: p.planName,
    startDate: p.startDate,
    evidence: Array.isArray(p.scopeLines) ? p.scopeLines.slice() : [],
    invoiced: handoff.invoiced === true,
    charged: handoff.charged === true,
    status: "staged - waiting on Ahmad's one click to invoice",
  };
}

// -- 3. The board --------------------------------------------------------------------------------------
export function buildTruthBoard(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};

  const payments = (Array.isArray(src.payments) ? src.payments : []).map(realPayment).filter(Boolean);
  const realRevenueCad = payments.reduce((s, p) => s + p.amountCad, 0);

  const handoffs = Array.isArray(src.handoffs) ? src.handoffs : [];
  const pipeline = handoffs.map(pipelineEntry).filter(Boolean);
  const pipelineCad = pipeline.reduce((s, e) => s + e.amountCad, 0);

  const blockedOnAhmad = [];
  for (const e of pipeline) {
    blockedOnAhmad.push({
      item: "Invoice " + e.customer + " - CAD $" + e.amountCad + " (" + e.planName + ")",
      why: "this system has no payment client and cannot invoice or charge",
    });
  }
  for (const b of Array.isArray(src.blockedOnAhmad) ? src.blockedOnAhmad : []) {
    if (b && typeof b === "object" && typeof b.item === "string" && b.item.trim()) {
      blockedOnAhmad.push({ item: b.item.trim(), why: typeof b.why === "string" && b.why.trim() ? b.why.trim() : "human-only action" });
    }
  }

  const blockedOnUs = [];
  for (const b of Array.isArray(src.blockedOnUs) ? src.blockedOnUs : []) {
    if (b && typeof b === "object" && typeof b.item === "string" && b.item.trim()) {
      blockedOnUs.push({ item: b.item.trim(), why: typeof b.why === "string" && b.why.trim() ? b.why.trim() : "build work outstanding" });
    }
  }

  const renewals = src.renewals && src.renewals.schema === "renewal-readiness.v1" ? src.renewals : null;

  return {
    schema: TRUTH_BOARD_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    realRevenueCad: Math.round(realRevenueCad * 100) / 100,
    payments,
    pipeline,
    pipelineCad: Math.round(pipelineCad * 100) / 100,
    weightedPipelineCad: null,
    projectedArrCad: null,
    blockedOnAhmad,
    blockedOnUs,
    renewalCounts: renewals ? renewals.counts : null,
    renewalBookedCad: renewals ? renewals.bookedRevenueCad : null,
    sectionsEmpty: {
      revenue: payments.length === 0,
      pipeline: pipeline.length === 0,
      blockedOnAhmad: blockedOnAhmad.length === 0,
      blockedOnUs: blockedOnUs.length === 0,
      renewals: !renewals,
    },
    note: NO_WEIGHTING_NOTE,
  };
}

// -- 4. Ten seconds of truth ----------------------------------------------------------------------------
export function truthBoardMarkdown(board) {
  if (!board || board.schema !== TRUTH_BOARD_SCHEMA) return "No revenue truth board.";
  const out = [];
  out.push("# Revenue truth board");
  out.push("");
  out.push("**Real money in: CAD $" + board.realRevenueCad + "**");
  if (board.sectionsEmpty.revenue) {
    out.push("");
    out.push(ZERO_NOTE);
  } else {
    for (const p of board.payments) {
      out.push("- " + p.customer + ": CAD $" + p.amountCad + " received " + p.receivedAt + " (" + p.id + ")");
    }
  }

  out.push("");
  out.push("## Pipeline - real, evidenced, unweighted");
  if (board.sectionsEmpty.pipeline) {
    out.push(EMPTY_SECTION);
  } else {
    out.push("Staged total CAD $" + board.pipelineCad + " - staged, not earned, not booked.");
    for (const e of board.pipeline) {
      out.push("- " + e.customer + ": CAD $" + e.amountCad + " - " + e.planName + " - " + e.status);
      for (const ev of e.evidence) out.push("  - evidence: " + ev);
    }
  }

  out.push("");
  out.push("## Blocked on Ahmad (one click)");
  if (board.sectionsEmpty.blockedOnAhmad) out.push(EMPTY_SECTION);
  else for (const b of board.blockedOnAhmad) out.push("- " + b.item + " - " + b.why);

  out.push("");
  out.push("## Blocked on us");
  if (board.sectionsEmpty.blockedOnUs) out.push(EMPTY_SECTION);
  else for (const b of board.blockedOnUs) out.push("- " + b.item + " - " + b.why);

  if (board.renewalCounts) {
    out.push("");
    out.push("## Renewals");
    out.push(
      board.renewalCounts.healthy + " healthy / " + board.renewalCounts["at-risk"] + " at risk / " +
      board.renewalCounts["not-enough-data"] + " not enough data. Booked renewal revenue: CAD $" + board.renewalBookedCad + "."
    );
  }

  out.push("");
  out.push("_" + board.note + "_");
  return out.join("\n");
}
