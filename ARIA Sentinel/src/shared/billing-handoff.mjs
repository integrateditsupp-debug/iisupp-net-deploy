// RUN-I I1 — ONE-CLICK BILLING HANDOFF (pure, local-only, Rule 14 real-or-empty).
// Turns a RENDERED H3 close packet into the exact thing Ahmad executes in one click to invoice a real
// customer. It is structurally incapable of charging: no payment client, no key handling, no transport.
//
// Honesty invariants (Rule 14):
//   - A packet that did not render produces NO handoff at all. There is no "draft" fallback, no
//     placeholder customer, no assumed price. The missing field is named instead.
//   - `charged:false` / `invoiced:false` / `sent:false` are CONSTANTS, not state. No code path flips
//     them. Static-scan locked in the test: no transport, spawn, disk, or payment SDK symbol appears.
//   - Every money figure is copied from the published plan on the packet. Nothing is computed into
//     existence, no tax is invented, no discount is applied that the packet did not carry.
//   - Rule 15 additive: close-packet / proof-pack / objection-ledger / the F+G modules are untouched.

export const BILLING_HANDOFF_SCHEMA = "billing-handoff.v1";

/** Structural, not stateful. Nothing in this module can change these. */
export const CHARGED = false;
export const INVOICED = false;
export const SENT = false;

export const REFUSAL_PREFIX = "Billing handoff not produced - missing real input:";

export const ONE_CLICK_NOTE =
  "This handoff is staged only. Nothing has been invoiced, nothing has been charged, nothing has been sent - " +
  "this module has no payment client and no transport. Raising the invoice and taking payment are Ahmad's one-click actions.";

/** The real-world steps, in order. Each is a human action - none of them happen here. */
export const STEP_KEYS = ["create-invoice", "set-line-item", "set-start-date", "send-invoice", "record-payment"];

// -- 1. The packet is the only source of truth --------------------------------------------------------
export function validatePacket(packet) {
  const missing = [];
  if (!packet || typeof packet !== "object" || packet.schema !== "close-packet.v1") {
    return { missing: ["packet (a rendered close-packet.v1 - a handoff is never built from anything else)"] };
  }
  if (packet.rendered !== true) {
    missing.push("packet.rendered (the close packet refused to render, so there is nothing to invoice)");
    return { missing };
  }
  if (!packet.customer || !String(packet.customer).trim()) missing.push("packet.customer (the real account)");
  const plan = packet.plan && typeof packet.plan === "object" ? packet.plan : null;
  if (!plan || plan.published !== true) missing.push("packet.plan.published (only a published plan price is invoiced)");
  const price = plan ? Number(plan.priceCad) : NaN;
  if (!Number.isFinite(price) || price <= 0) missing.push("packet.plan.priceCad (the real published price)");
  if (!plan || !String((plan && plan.name) || "").trim()) missing.push("packet.plan.name (the real plan name)");
  const t = packet.proposedStartDate ? Date.parse(packet.proposedStartDate) : NaN;
  if (Number.isNaN(t)) missing.push("packet.proposedStartDate (a real start date - never 'ASAP')");
  return { missing, price: Number.isFinite(price) ? price : null, startIso: Number.isNaN(t) ? null : new Date(t).toISOString() };
}

// -- 2. The checklist a human executes -----------------------------------------------------------------
export function handoffSteps({ customer, planName, priceCad, startIso }) {
  return [
    { key: "create-invoice", action: "Create one invoice for " + customer + " in the billing tool Ahmad already uses.", done: false },
    { key: "set-line-item", action: 'Single line item: "' + planName + '" - CAD $' + priceCad + " (published plan price, copied from the packet).", done: false },
    { key: "set-start-date", action: "Service start date: " + startIso + " (the date proposed in the packet).", done: false },
    { key: "send-invoice", action: "Send the invoice to the customer. This tool cannot send it.", done: false },
    { key: "record-payment", action: "When - and only when - the money actually lands, record it. Until then this account is $0.", done: false },
  ];
}

// -- 3. The handoff ------------------------------------------------------------------------------------
export function buildBillingHandoff(packet, { now = Date.now() } = {}) {
  const base = {
    schema: BILLING_HANDOFF_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    charged: CHARGED,
    invoiced: INVOICED,
    sent: SENT,
    oneClickNote: ONE_CLICK_NOTE,
  };
  const v = validatePacket(packet);
  if (v.missing.length) {
    return { ...base, produced: false, missing: v.missing, refusal: REFUSAL_PREFIX + " " + v.missing.join("; ") + ".", steps: [], payload: null };
  }
  const customer = String(packet.customer).trim();
  const planName = String(packet.plan.name).trim();
  const priceCad = v.price;
  const startIso = v.startIso;
  return {
    ...base,
    produced: true,
    missing: [],
    refusal: null,
    customer,
    pilotId: packet.pilotId || null,
    steps: handoffSteps({ customer, planName, priceCad, startIso }),
    payload: {
      currency: "CAD",
      customer,
      planName,
      amount: priceCad,
      startDate: startIso,
      scopeLines: Array.isArray(packet.scope) ? packet.scope.map((s) => s.line) : [],
      sourceSchema: packet.schema,
      charged: CHARGED,
      invoiced: INVOICED,
    },
  };
}

// -- 4. Markdown - refuses as plainly as it produces ----------------------------------------------------
export function billingHandoffMarkdown(handoff) {
  if (!handoff || handoff.schema !== BILLING_HANDOFF_SCHEMA) return REFUSAL_PREFIX + " no handoff.";
  if (!handoff.produced) return "# Billing handoff\n\n" + handoff.refusal + "\n\n" + handoff.oneClickNote;
  const out = [];
  out.push("# Billing handoff - " + handoff.customer);
  out.push("");
  out.push("Amount: **CAD $" + handoff.payload.amount + "** - " + handoff.payload.planName + " (published plan price).");
  out.push("Start: " + handoff.payload.startDate + ".");
  out.push("");
  out.push("## One-click steps (all human - none of these run here)");
  for (const s of handoff.steps) out.push("- [ ] " + s.action);
  out.push("");
  out.push("Invoiced: " + handoff.invoiced + ". Charged: " + handoff.charged + ". Sent: " + handoff.sent + ".");
  out.push("");
  out.push("_" + handoff.oneClickNote + "_");
  return out.join("\n");
}
