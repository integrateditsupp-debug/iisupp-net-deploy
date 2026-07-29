// RUN-H H3 - signature-ready packet, staged. Locks: real fields only, refusal (naming the missing
// field) instead of a rendered document, scope copied from an EARNED proof pack, guarantee/risk-free
// language rejected before it can reach a customer, and a module with no transport and no signing
// path - sent:false / signed:false are structural.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildClosePacket, closePacketMarkdown, validateInputs, screenTerms, scopeFromPack,
  CLOSE_PACKET_SCHEMA, SENT, SIGNED, FORBIDDEN_TERMS, REFUSAL_PREFIX, ONE_CLICK_NOTE,
} from "../src/shared/close-packet.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const EARNED = buildProofPack({
  pilotId: "pilot-a",
  startedAt: ago(10),
  records: [
    { id: "T-101", at: ago(9), durationMinutes: 25 },
    { id: "T-102", at: ago(7), durationMinutes: 15 },
    { id: "T-103", at: ago(5), durationMinutes: 40 },
  ],
}, { now: NOW });
assert.equal(EARNED.earned, true, "fixture pack is genuinely earned");
const PLAN = { name: "Managed IT - Core", priceCad: 1450, published: true };
const GOOD = { customer: "Northline Logistics", proofPack: EARNED, plan: PLAN, proposedStartDate: "2026-08-01T00:00:00Z" };

// -- 1. SENT AND SIGNED ARE STRUCTURAL ----------------------------------------------------------------
assert.equal(SENT, false, "SENT is a false constant");
assert.equal(SIGNED, false, "SIGNED is a false constant");
for (const input of [undefined, {}, GOOD]) {
  const p = buildClosePacket(input, { now: NOW });
  assert.equal(p.schema, CLOSE_PACKET_SCHEMA, "schema is explicit");
  assert.equal(p.sent, false, "nothing is ever sent");
  assert.equal(p.signed, false, "nothing is ever signed");
  assert.ok(p.oneClickNote.includes("Ahmad's one-click"), "the human step is named on every packet");
}

// -- 2. A MISSING REAL FIELD REFUSES, AND SAYS WHICH --------------------------------------------------
const cases = [
  [{ ...GOOD, customer: "  " }, /customer/],
  [{ ...GOOD, proofPack: null }, /proofPack/],
  [{ ...GOOD, proofPack: buildProofPack({ pilotId: "pilot-z", records: [] }, { now: NOW }) }, /EARNED proof pack/],
  [{ ...GOOD, plan: { name: "Core", published: true } }, /priceCad/],
  [{ ...GOOD, plan: { name: "Core", priceCad: 0, published: true } }, /priceCad/],
  [{ ...GOOD, plan: { name: "Core", priceCad: 1450, published: false } }, /published/],
  [{ ...GOOD, proposedStartDate: "whenever" }, /proposedStartDate/],
  [{ ...GOOD, proposedStartDate: null }, /never 'ASAP'/],
];
for (const [input, re] of cases) {
  const p = buildClosePacket(input, { now: NOW });
  assert.equal(p.rendered, false, "a missing real field refuses to render");
  assert.ok(p.refusal.startsWith(REFUSAL_PREFIX), "the refusal is explicit");
  assert.match(p.refusal, re, "the refusal names the missing field");
  assert.equal(closePacketMarkdown(p).includes("## Scope"), false, "a refused packet renders no scope section");
}
assert.equal(validateInputs({}).missing.length, 4, "an empty input names every missing field, none filled in");

// -- 3. PRICE COMES FROM THE PUBLISHED PLAN -----------------------------------------------------------
const ok = buildClosePacket(GOOD, { now: NOW });
assert.equal(ok.rendered, true, "all real fields present => the packet renders");
assert.equal(ok.plan.priceCad, 1450, "the price is the published plan price, unchanged");
assert.equal(ok.plan.published, true, "only a published plan price is offered");
assert.equal(ok.proposedStartDate, "2026-08-01T00:00:00.000Z", "the real proposed date");

// -- 4. SCOPE IS COPIED FROM WHAT WAS ACTUALLY DELIVERED ----------------------------------------------
assert.deepEqual(scopeFromPack(null), [], "no pack => no scope");
assert.deepEqual(scopeFromPack(buildProofPack({ pilotId: "p", records: [] }, { now: NOW })), [], "an unearned pack yields no scope");
assert.equal(ok.scope.length, EARNED.claims.length, "one scope line per evidenced claim, no extras");
for (const line of ok.scope) {
  assert.ok(line.citations.length > 0, "every scope line carries the record ids behind it");
  assert.ok(line.citations.every((c) => ["T-101", "T-102", "T-103"].includes(c)), "citations are the real pilot records");
}

// -- 5. GUARANTEE / RISK-FREE LANGUAGE NEVER REACHES A CUSTOMER DOCUMENT ------------------------------
const screened = screenTerms([
  "30-day notice period, either side.",
  "Money-back if you are not happy",
  "Guaranteed uptime",
  "Risk-free trial",
  "Monthly invoicing, net 15.",
  42,
]);
assert.deepEqual(screened.kept, ["30-day notice period, either side.", "Monthly invoicing, net 15."], "only supportable terms survive");
assert.equal(screened.rejected.length, 3, "every unsupportable term is rejected and logged");
const withTerms = buildClosePacket({ ...GOOD, terms: ["Guaranteed same-day response", "30-day notice period."] }, { now: NOW });
assert.deepEqual(withTerms.terms, ["30-day notice period."], "the guarantee term never enters the packet");
const md = closePacketMarkdown(withTerms);
// The offer itself must be clean. The rejected term is quoted ONLY in the disclosure line, so the
// customer can see exactly what we refused to claim - transparency, not a claim.
const offerPart = md.split("Terms removed before this document existed")[0];
for (const banned of FORBIDDEN_TERMS) {
  assert.ok(!offerPart.toLowerCase().includes(banned), `the offer must never assert "${banned}"`);
}
assert.ok(md.includes("Terms removed before this document existed"), "the removal is disclosed, not hidden");
assert.ok(md.includes("Guaranteed same-day response"), "the refused term is quoted in the disclosure so nothing is hidden");

// -- 6. THE RENDERED DOCUMENT SHOWS THE VERIFY PATH AND THE ONE-CLICK BOUNDARY ------------------------
assert.ok(md.includes("T-101"), "record ids stay in the customer document for verification");
assert.ok(md.includes(ONE_CLICK_NOTE), "the document states it is unsent and unsigned");
assert.ok(md.includes("CAD $1450"), "the published price is printed as-is");

// -- 7. STATIC SCAN: NO TRANSPORT, NO SIGNING PATH ----------------------------------------------------
const src = readFileSync(new URL("../src/shared/close-packet.mjs", import.meta.url), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "child_process", "node:fs", "require(", "exec(", "spawn(", "nodemailer", "sendmail", "docusign", "stripe"]) {
  assert.ok(!src.toLowerCase().includes(forbidden.toLowerCase()), `close-packet must not reference ${forbidden}`);
}
assert.ok(!/sent:\s*true/.test(src), "no code path can mark a packet sent");
assert.ok(!/signed:\s*true/.test(src), "no code path can mark a packet signed");
assert.ok(/export const SENT = false/.test(src), "sent is a structural constant");
assert.ok(/export const SIGNED = false/.test(src), "signed is a structural constant");

console.log("h3-close-packet: 7 assertion groups PASSED");
