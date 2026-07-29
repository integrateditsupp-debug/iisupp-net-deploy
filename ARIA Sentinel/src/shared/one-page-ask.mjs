// RUN-K K3 — THE ONE-PAGE ASK (pure, local-only, Rule 14 real-or-empty).
// ONE page a buyer can say yes to: the real proof (H1), the real close packet (H3), and the real
// capacity verdict (J2) composed into a single ask. If any input is missing or unproven the page
// REFUSES to render and names what is missing — exactly like H3. It never promises delivery we
// cannot staff.
//
// Honesty invariants (Rule 14):
//   - REFUSAL IS A FIRST-CLASS OUTCOME. Missing proof, an unrendered packet, or an absent capacity
//     report => `rendered:false` plus the named missing input. No template filler ever renders.
//   - NO OVER-COMMITMENT. A capacity verdict of "over" REFUSES the page. We do not ask for a signature
//     on delivery we have already proven we cannot staff.
//   - EVERY CLAIM TRACES TO A RECORD ID. Proof lines carry the citations they came from; a claim with
//     no citation is dropped, not softened.
//   - NO INVENTED REFERENCE CUSTOMER. There is no "companies like yours" line and no case-study
//     placeholder - the only customer named is the one the packet is for.
//   - NO GUARANTEE LANGUAGE. Terms are screened with the same H3 screen before anything can render.
//   - STRUCTURALLY UNSENDABLE. No network client, no mailer, no signing SDK, no disk access
//     (static-scanned). Sending and signing stay Ahmad's one-click.
//   - Rule 15 additive: proof-pack / close-packet / delivery-capacity-truth are read-only inputs.

import { FORBIDDEN_TERMS, screenTerms } from "./close-packet.mjs";

export const ONE_PAGE_ASK_SCHEMA = "one-page-ask.v1";

/** Structural, not stateful. */
export const SENT = false;
export const SIGNED = false;

export const REFUSAL_PREFIX = "One-page ask not rendered - missing real input:";

export const OVER_CAPACITY_REFUSAL =
  "over observed delivery capacity - we do not ask a buyer to sign for delivery we have already measured that we cannot staff";

export const CAPACITY_UNKNOWN_LINE =
  "Delivery headroom is not yet measurable from our own observed minutes, so this page makes no delivery-volume promise.";

export const ONE_CLICK_NOTE =
  "This page is staged only. It has not been sent and has not been signed - this module has no transport and no signing path. Sending it, signing it, and taking payment are Ahmad's one-click actions.";

export const TRACE_NOTE =
  "Every line above is traceable to a record id from your own pilot. Ask us to show any of them.";

export { FORBIDDEN_TERMS };

// -- 1. What must be real before a buyer sees anything -------------------------------------------------
export function validateAsk(input = {}) {
  const src = input && typeof input === "object" ? input : {};
  const missing = [];

  const pack = src.proofPack && src.proofPack.schema === "proof-pack.v1" ? src.proofPack : null;
  if (!pack || pack.earned !== true || !Array.isArray(pack.claims) || pack.claims.length === 0) {
    missing.push("proofPack (an EARNED proof pack - the page is written from what was actually delivered)");
  }

  const packet = src.closePacket && src.closePacket.schema === "close-packet.v1" ? src.closePacket : null;
  if (!packet || packet.rendered !== true) {
    missing.push("closePacket (a RENDERED close packet - price, scope and start date come from it, never from a template)");
  }

  const capacity = src.capacity && src.capacity.schema === "delivery-capacity-truth.v1" ? src.capacity : null;
  if (!capacity) {
    missing.push("capacity (a real delivery-capacity report - we do not ask for a commitment we have not checked we can staff)");
  }

  return { missing, pack, packet, capacity };
}

// -- 2. Proof lines - a claim without a citation is dropped --------------------------------------------
export function provenLines(pack) {
  if (!pack || pack.earned !== true || !Array.isArray(pack.claims)) return [];
  const out = [];
  for (const c of pack.claims) {
    const cites = Array.isArray(c.citations) ? c.citations.map((x) => x && x.recordId).filter(Boolean) : [];
    if (!cites.length) continue; // unciteable => omitted, never softened into a vague claim
    out.push({ label: c.label, value: c.value, records: cites });
  }
  return out;
}

// -- 3. The capacity line - honest in all three reachable states ---------------------------------------
export function capacityLine(capacity) {
  if (!capacity) return null;
  if (capacity.verdict === "over") return { ok: false, line: capacity.headline };
  if (capacity.verdict === "not-enough-data") return { ok: true, line: CAPACITY_UNKNOWN_LINE };
  if (capacity.verdict === "at") {
    return { ok: true, line: "We are at our observed delivery capacity (" + capacity.committedMinutes +
      " of " + capacity.capacityMinutes + " recorded minutes/week). This engagement is offered on that basis, not on top of it." };
  }
  return { ok: true, line: "We have " + capacity.freeMinutes +
    " observed minutes/week of real delivery room (" + capacity.committedMinutes + " of " +
    capacity.capacityMinutes + " recorded minutes/week committed)." };
}

// -- 4. The page ----------------------------------------------------------------------------------------
export function buildOnePageAsk(input = {}, { now = Date.now() } = {}) {
  const v = validateAsk(input);
  const base = {
    schema: ONE_PAGE_ASK_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    sent: SENT,
    signed: SIGNED,
    oneClickNote: ONE_CLICK_NOTE,
  };

  if (v.missing.length) {
    return { ...base, rendered: false, missing: v.missing, refusal: REFUSAL_PREFIX + " " + v.missing.join("; ") + "." };
  }

  const cap = capacityLine(v.capacity);
  if (!cap.ok) {
    return {
      ...base,
      rendered: false,
      missing: [OVER_CAPACITY_REFUSAL],
      refusal: REFUSAL_PREFIX + " " + OVER_CAPACITY_REFUSAL + ".",
    };
  }

  const proof = provenLines(v.pack);
  if (proof.length === 0) {
    const why = "proofPack claims with at least one record id (an unciteable claim is omitted, so nothing is left to show)";
    return { ...base, rendered: false, missing: [why], refusal: REFUSAL_PREFIX + " " + why + "." };
  }

  const screened = screenTerms(v.packet.terms);

  return {
    ...base,
    rendered: true,
    missing: [],
    refusal: null,
    customer: v.packet.customer,
    pilotId: v.pack.pilotId || null,
    plan: v.packet.plan,
    proposedStartDate: v.packet.proposedStartDate,
    proof,
    scope: Array.isArray(v.packet.scope) ? v.packet.scope.slice() : [],
    capacity: { verdict: v.capacity.verdict, line: cap.line },
    terms: screened.kept,
    rejectedTerms: screened.rejected,
    verifyNote: v.packet.verifyNote || null,
  };
}

// -- 5. One page ----------------------------------------------------------------------------------------
export function onePageAskMarkdown(ask) {
  if (!ask || ask.schema !== ONE_PAGE_ASK_SCHEMA) return REFUSAL_PREFIX + " no page.";
  if (!ask.rendered) return "# The ask\n\n" + ask.refusal + "\n\n" + ask.oneClickNote;

  const out = [];
  out.push("# " + ask.customer + " - the ask");
  out.push("");
  out.push("**" + ask.plan.name + " - CAD $" + ask.plan.priceCad + "/month, starting " +
    String(ask.proposedStartDate).slice(0, 10) + ".**");
  out.push("");
  out.push("## What we already did for you");
  for (const p of ask.proof) out.push("- " + p.label + ": " + p.value + " (records: " + p.records.join(", ") + ")");
  out.push("");
  out.push("## What you get from here");
  for (const s of ask.scope) out.push("- " + s.line + (s.citations && s.citations.length ? " (records: " + s.citations.join(", ") + ")" : ""));
  out.push("");
  out.push("## What we can actually staff");
  out.push(ask.capacity.line);
  if (ask.terms.length) {
    out.push("");
    out.push("## Terms");
    for (const t of ask.terms) out.push("- " + t);
  }
  if (ask.rejectedTerms.length) {
    out.push("");
    // The removed term is COUNTED, never reprinted - echoing it back would put the very language we
    // refuse to make onto the buyer's page.
    out.push(ask.rejectedTerms.length + " proposed term(s) were removed before this page existed - we do not make promises about outcomes we cannot evidence.");
  }
  out.push("");
  if (ask.verifyNote) { out.push(ask.verifyNote); out.push(""); }
  out.push(TRACE_NOTE);
  out.push("");
  out.push("_" + ask.oneClickNote + "_");
  return out.join("\n");
}
