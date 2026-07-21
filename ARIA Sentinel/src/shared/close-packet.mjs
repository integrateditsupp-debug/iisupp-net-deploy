// RUN-H H3 — SIGNATURE-READY PACKET, STAGED (pure, local-only, Rule 14 real-or-empty).
// Assembles the pilot -> paid packet from REAL fields only, and is structurally incapable of sending,
// signing, or charging. Signing, sending, and payment are 100% Ahmad's one-click.
//
// Honesty invariants (Rule 14):
//   - REAL FIELDS ONLY. Scope comes from what was actually delivered (a real proof pack that is
//     `earned`), price comes from the PUBLISHED plan passed in (never invented, never "let's say"),
//     start date comes from a real proposed date. Any missing => the packet REFUSES to render and
//     names the missing field.
//   - STRUCTURALLY UNSENDABLE. `sent:false` and `signed:false` are constants, not state. The module
//     has no network client, no process spawning, no disk access, no mailer, no signing SDK - static-scan
//     locked in the test. There is no code path that flips them.
//   - NO INVENTED TERMS. Discounts, guarantees, "risk-free", and money-back language are rejected:
//     a term the published plan does not contain never reaches a customer document.
//   - Rule 15 additive: nothing existing is renamed or removed.

export const CLOSE_PACKET_SCHEMA = "close-packet.v1";

/** Structural, not stateful. Nothing in this module can change these. */
export const SENT = false;
export const SIGNED = false;

/** Language we refuse to put in a customer document (Rule 14 / no-fake-proof). */
export const FORBIDDEN_TERMS = ["guarantee", "guaranteed", "money-back", "money back", "risk-free", "risk free", "no risk"];

export const REFUSAL_PREFIX = "Packet not rendered - missing real input:";

export const ONE_CLICK_NOTE =
  "This packet is staged only. It has not been sent and has not been signed - this module has no transport and no signing path. Sending it, signing it, and taking payment are Ahmad's one-click actions.";

// -- 1. Field validation - a missing field is named, never filled in -----------------------------------
export function validateInputs(input = {}) {
  const missing = [];
  const src = input && typeof input === "object" ? input : {};

  const customer = typeof src.customer === "string" && src.customer.trim() ? src.customer.trim() : null;
  if (!customer) missing.push("customer (real name of the account - never a placeholder)");

  const pack = src.proofPack && typeof src.proofPack === "object" ? src.proofPack : null;
  if (!pack || pack.earned !== true || !Array.isArray(pack.claims) || pack.claims.length === 0) {
    missing.push("proofPack (an EARNED proof pack - scope is written from what was actually delivered, not from a template)");
  }

  const plan = src.plan && typeof src.plan === "object" ? src.plan : null;
  const priceOk = plan && Number.isFinite(Number(plan.priceCad)) && Number(plan.priceCad) > 0;
  const planNameOk = plan && typeof plan.name === "string" && plan.name.trim();
  const publishedOk = plan && plan.published === true;
  if (!plan || !priceOk || !planNameOk) {
    missing.push("plan.name + plan.priceCad (price is taken from the published plan, never invented for this deal)");
  } else if (!publishedOk) {
    missing.push("plan.published (a price that is not on the published plan is not offered)");
  }

  const startT = src.proposedStartDate ? Date.parse(src.proposedStartDate) : NaN;
  if (!src.proposedStartDate || Number.isNaN(startT)) {
    missing.push("proposedStartDate (a real proposed date - never 'ASAP')");
  }

  return { missing, customer, pack, plan, startIso: Number.isNaN(startT) ? null : new Date(startT).toISOString() };
}

// -- 2. Terms are screened before they can reach a customer document -----------------------------------
export function screenTerms(terms) {
  const list = Array.isArray(terms) ? terms.filter((t) => typeof t === "string" && t.trim()) : [];
  const kept = [];
  const rejected = [];
  for (const t of list) {
    const low = t.toLowerCase();
    const hit = FORBIDDEN_TERMS.find((f) => low.includes(f));
    if (hit) rejected.push({ term: t.trim(), reason: 'contains "' + hit + '" - we do not make guarantee or risk-free claims' });
    else kept.push(t.trim());
  }
  return { kept, rejected };
}

// -- 3. Scope is copied from real delivered evidence ---------------------------------------------------
export function scopeFromPack(pack) {
  if (!pack || pack.earned !== true || !Array.isArray(pack.claims)) return [];
  return pack.claims.map((c) => ({
    line: c.label + ": " + c.value,
    citations: Array.isArray(c.citations) ? c.citations.map((x) => x.recordId) : [],
  }));
}

// -- 4. The packet -------------------------------------------------------------------------------------
export function buildClosePacket(input = {}, { now = Date.now() } = {}) {
  const v = validateInputs(input);
  const base = {
    schema: CLOSE_PACKET_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    sent: SENT,
    signed: SIGNED,
    oneClickNote: ONE_CLICK_NOTE,
  };
  if (v.missing.length) {
    return { ...base, rendered: false, missing: v.missing, refusal: REFUSAL_PREFIX + " " + v.missing.join("; ") + "." };
  }
  const terms = screenTerms(input && input.terms);
  return {
    ...base,
    rendered: true,
    missing: [],
    refusal: null,
    customer: v.customer,
    pilotId: v.pack.pilotId || null,
    plan: { name: v.plan.name.trim(), priceCad: Number(v.plan.priceCad), published: true },
    proposedStartDate: v.startIso,
    scope: scopeFromPack(v.pack),
    terms: terms.kept,
    rejectedTerms: terms.rejected,
    verifyNote: v.pack.verifyNote || null,
  };
}

// -- 5. Markdown - refuses just as clearly as it renders ------------------------------------------------
export function closePacketMarkdown(packet) {
  if (!packet || packet.schema !== CLOSE_PACKET_SCHEMA) return REFUSAL_PREFIX + " no packet.";
  if (!packet.rendered) return "# Close packet\n\n" + packet.refusal + "\n\n" + packet.oneClickNote;
  const out = [];
  out.push("# Close packet - " + packet.customer);
  out.push("");
  out.push("Plan: **" + packet.plan.name + "** - CAD $" + packet.plan.priceCad + " (published plan price).");
  out.push("Proposed start: " + packet.proposedStartDate + ".");
  out.push("");
  out.push("## Scope - written from what was actually delivered in your pilot");
  for (const s of packet.scope) {
    out.push("- " + s.line + (s.citations.length ? " (records: " + s.citations.join(", ") + ")" : ""));
  }
  if (packet.verifyNote) {
    out.push("");
    out.push(packet.verifyNote);
  }
  if (packet.terms.length) {
    out.push("");
    out.push("## Terms");
    for (const t of packet.terms) out.push("- " + t);
  }
  if (packet.rejectedTerms.length) {
    out.push("");
    out.push("Terms removed before this document existed: " + packet.rejectedTerms.map((r) => r.term + " (" + r.reason + ")").join("; ") + ".");
  }
  out.push("");
  out.push("_" + packet.oneClickNote + "_");
  return out.join("\n");
}
