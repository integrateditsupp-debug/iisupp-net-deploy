// RUN-I I1 - one-click billing handoff. Locks: a handoff exists ONLY from a rendered close packet,
// every missing real field is named instead of filled in, money is copied from the published plan,
// and the module is structurally incapable of invoicing, charging, or sending.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildBillingHandoff, billingHandoffMarkdown, validatePacket, handoffSteps,
  BILLING_HANDOFF_SCHEMA, CHARGED, INVOICED, SENT, STEP_KEYS, REFUSAL_PREFIX, ONE_CLICK_NOTE,
} from "../src/shared/billing-handoff.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const EARNED = buildProofPack({
  pilotId: "pilot-a",
  startedAt: ago(10),
  records: [
    { id: "T-201", at: ago(9), durationMinutes: 25 },
    { id: "T-202", at: ago(7), durationMinutes: 15 },
    { id: "T-203", at: ago(5), durationMinutes: 40 },
  ],
}, { now: NOW });
assert.equal(EARNED.earned, true, "fixture pack is genuinely earned");

const PLAN = { name: "Managed IT - Core", priceCad: 1450, published: true };
const PACKET = buildClosePacket(
  { customer: "Northline Logistics", proofPack: EARNED, plan: PLAN, proposedStartDate: "2026-08-01T00:00:00Z" },
  { now: NOW }
);
assert.equal(PACKET.rendered, true, "fixture packet renders");

// -- 1. CHARGED / INVOICED / SENT ARE STRUCTURAL ------------------------------------------------------
assert.equal(CHARGED, false, "CHARGED is a false constant");
assert.equal(INVOICED, false, "INVOICED is a false constant");
assert.equal(SENT, false, "SENT is a false constant");
for (const input of [undefined, null, {}, PACKET]) {
  const h = buildBillingHandoff(input, { now: NOW });
  assert.equal(h.schema, BILLING_HANDOFF_SCHEMA, "schema is explicit on every result");
  assert.equal(h.charged, false, "nothing is ever charged");
  assert.equal(h.invoiced, false, "nothing is ever invoiced");
  assert.equal(h.sent, false, "nothing is ever sent");
  assert.ok(h.oneClickNote.includes("Ahmad's one-click"), "the human step is named every time");
}

// -- 2. A PACKET THAT DID NOT RENDER PRODUCES NO HANDOFF AT ALL ---------------------------------------
const refused = buildClosePacket({ customer: "Nobody" }, { now: NOW });
assert.equal(refused.rendered, false, "fixture refusal is a real refusal");
const noHandoff = buildBillingHandoff(refused, { now: NOW });
assert.equal(noHandoff.produced, false, "a refused packet produces no handoff");
assert.deepEqual(noHandoff.steps, [], "no steps are invented for a packet that does not exist");
assert.equal(noHandoff.payload, null, "no payload is invented");
assert.match(noHandoff.refusal, /packet\.rendered/, "the refusal names why");
assert.ok(billingHandoffMarkdown(noHandoff).includes(REFUSAL_PREFIX), "the markdown refuses just as plainly");
assert.equal(billingHandoffMarkdown(noHandoff).includes("One-click steps"), false, "a refused handoff renders no checklist");

// -- 3. EVERY MISSING REAL FIELD IS NAMED, NEVER FILLED IN --------------------------------------------
const cases = [
  [null, /packet \(a rendered close-packet/],
  [{ schema: "something-else.v1", rendered: true }, /close-packet/],
  [{ ...PACKET, customer: "   " }, /packet\.customer/],
  [{ ...PACKET, plan: { name: "Core", priceCad: 1450, published: false } }, /plan\.published/],
  [{ ...PACKET, plan: { name: "Core", priceCad: 0, published: true } }, /priceCad/],
  [{ ...PACKET, plan: { name: "  ", priceCad: 1450, published: true } }, /plan\.name/],
  [{ ...PACKET, proposedStartDate: "ASAP" }, /never 'ASAP'/],
];
for (const [input, re] of cases) {
  const h = buildBillingHandoff(input, { now: NOW });
  assert.equal(h.produced, false, "a missing real field refuses");
  assert.ok(h.refusal.startsWith(REFUSAL_PREFIX), "the refusal is explicit");
  assert.match(h.refusal, re, "the refusal names the missing field");
}
assert.equal(validatePacket({ schema: "close-packet.v1", rendered: false }).missing.length, 1, "an unrendered packet reports exactly one honest reason");

// -- 4. MONEY IS COPIED FROM THE PUBLISHED PLAN, NEVER COMPUTED INTO EXISTENCE ------------------------
const ok = buildBillingHandoff(PACKET, { now: NOW });
assert.equal(ok.produced, true, "a rendered packet produces the handoff");
assert.equal(ok.payload.amount, 1450, "the amount is the published plan price, unchanged");
assert.equal(ok.payload.currency, "CAD", "currency is explicit");
assert.equal(ok.payload.planName, "Managed IT - Core", "the real plan name");
assert.equal(ok.payload.startDate, "2026-08-01T00:00:00.000Z", "the real proposed start date");
assert.equal(ok.customer, "Northline Logistics", "the real account");
assert.equal(ok.payload.charged, false, "the payload itself carries charged:false");
assert.equal(ok.payload.invoiced, false, "the payload itself carries invoiced:false");
assert.ok(ok.payload.scopeLines.length === PACKET.scope.length, "scope is carried through from the packet, not rewritten");
assert.equal(Object.keys(ok.payload).some((k) => /tax|discount|fee/i.test(k)), false, "no tax, discount, or fee is invented");

// -- 5. THE STEPS ARE HUMAN STEPS, IN ORDER, NONE OF THEM DONE ---------------------------------------
assert.deepEqual(ok.steps.map((s) => s.key), STEP_KEYS, "the real-world steps, in order");
assert.equal(ok.steps.every((s) => s.done === false), true, "nothing is pre-ticked - no step has actually happened");
const md = billingHandoffMarkdown(ok);
assert.ok(md.includes("CAD $1450"), "the real amount is on the face of it");
assert.ok(md.includes("Invoiced: false"), "invoiced:false is stated, not hidden");
assert.ok(md.includes("Charged: false"), "charged:false is stated, not hidden");
assert.equal(ok.steps.find((s) => s.key === "record-payment").action.includes("$0"), true, "until money lands the account is $0");
assert.deepEqual(handoffSteps({ customer: "X", planName: "Y", priceCad: 1, startIso: "2026-01-01T00:00:00.000Z" }).length, 5, "five steps, no more");

// -- 6. STATIC SCAN - NO TRANSPORT, NO SPAWN, NO DISK, NO PAYMENT SDK --------------------------------
const SRC = readFileSync(new URL("../src/shared/billing-handoff.mjs", import.meta.url), "utf8");
const FORBIDDEN = [
  "fetch(", "XMLHttpRequest", "node:http", "node:https", "node:net", "node:fs", "node:dgram",
  "child_process", "require(", "import(", "WebSocket", "nodemailer", "stripe", "Stripe",
  "paypal", "PayPal", "checkout.session", "createCharge", "process.env",
];
for (const bad of FORBIDDEN) {
  assert.equal(SRC.includes(bad), false, "billing-handoff has no " + bad + " - it cannot reach the outside world");
}
assert.equal(/\bcharged\s*=\s*true\b/.test(SRC), false, "no code path sets charged true");
assert.equal(/\binvoiced\s*=\s*true\b/.test(SRC), false, "no code path sets invoiced true");
assert.equal(SRC.split("import ").length - 1, 0, "the module imports nothing at all");

console.log("i1-billing-handoff: OK");
