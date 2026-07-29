// RUN-K K3 - the one-page ask. Locks: refuses / renders honestly / refuses on over-capacity are ALL
// reachable, every claim traces to a real record id, and no guarantee or invented-customer language
// can survive to a buyer's page.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildOnePageAsk, onePageAskMarkdown, validateAsk, provenLines, capacityLine,
  ONE_PAGE_ASK_SCHEMA, REFUSAL_PREFIX, OVER_CAPACITY_REFUSAL, CAPACITY_UNKNOWN_LINE,
  FORBIDDEN_TERMS, ONE_CLICK_NOTE, TRACE_NOTE, SENT, SIGNED,
} from "../src/shared/one-page-ask.mjs";
import { buildProofPack } from "../src/shared/proof-pack.mjs";
import { buildClosePacket } from "../src/shared/close-packet.mjs";
import { buildCapacityTruth } from "../src/shared/delivery-capacity-truth.mjs";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const RECORDS = [
  { id: "T-601", at: ago(28), durationMinutes: 60 },
  { id: "T-602", at: ago(21), durationMinutes: 60 },
  { id: "T-603", at: ago(14), durationMinutes: 60 },
  { id: "T-604", at: ago(7), durationMinutes: 60 },
];
const PACK = buildProofPack({ pilotId: "pilot-k3", startedAt: ago(28), records: RECORDS }, { now: NOW });
assert.equal(PACK.earned, true, "fixture proof pack is really earned");
const PACKET = buildClosePacket({
  customer: "Northline Logistics",
  proofPack: PACK,
  plan: { name: "Managed IT - Core", priceCad: 1450, published: true },
  proposedStartDate: "2026-08-01T00:00:00Z",
  terms: ["30 days written notice", "guaranteed 100% uptime"],
}, { now: NOW });
assert.equal(PACKET.rendered, true, "fixture close packet really rendered");
assert.equal(PACKET.rejectedTerms.length, 1, "H3 already refused the guarantee term upstream");

const ACCOUNT = { customer: "Northline Logistics", records: RECORDS };
const UNDER = buildCapacityTruth({ accounts: [ACCOUNT], operatorWeeklyMinutes: 600 }, { now: NOW });
const OVER = buildCapacityTruth({ accounts: [ACCOUNT], operatorWeeklyMinutes: 10 }, { now: NOW });
const UNKNOWN = buildCapacityTruth({ accounts: [ACCOUNT] }, { now: NOW });
assert.equal(UNDER.verdict, "under", "fixture under-capacity is real");
assert.equal(OVER.verdict, "over", "fixture over-capacity is real");
assert.equal(UNKNOWN.verdict, "not-enough-data", "fixture unknown-capacity is real");

// -- 1. REFUSAL IS A FIRST-CLASS OUTCOME, AND IT NAMES WHAT IS MISSING --------------------------------
const nothing = buildOnePageAsk({}, { now: NOW });
assert.equal(nothing.schema, ONE_PAGE_ASK_SCHEMA, "schema is explicit");
assert.equal(nothing.rendered, false, "with nothing real, nothing renders");
assert.equal(nothing.missing.length, 3, "and all three missing inputs are named");
assert.ok(nothing.refusal.startsWith(REFUSAL_PREFIX), "the refusal says it is a refusal");
assert.ok(/proofPack/.test(nothing.refusal) && /closePacket/.test(nothing.refusal) && /capacity/.test(nothing.refusal), "each by name");
const nothingMd = onePageAskMarkdown(nothing);
assert.ok(nothingMd.includes(nothing.refusal), "the page renders the refusal, not filler");
assert.equal(/Managed IT/.test(nothingMd), false, "and no plan, price, or scope leaks into a refused page");

// An unearned pack cannot buy its way in.
const unearned = buildOnePageAsk({ proofPack: buildProofPack({ records: [] }, { now: NOW }), closePacket: PACKET, capacity: UNDER }, { now: NOW });
assert.equal(unearned.rendered, false, "an unearned proof pack refuses the page");
// A refused close packet cannot either.
const refusedPacket = buildClosePacket({ customer: "Nobody" }, { now: NOW });
assert.equal(refusedPacket.rendered, false, "fixture refused packet is really refused");
assert.equal(buildOnePageAsk({ proofPack: PACK, closePacket: refusedPacket, capacity: UNDER }, { now: NOW }).rendered, false, "a refused packet refuses the page");
// And no capacity report at all means we have not checked we can staff it.
assert.equal(buildOnePageAsk({ proofPack: PACK, closePacket: PACKET }, { now: NOW }).rendered, false, "no capacity check, no ask");

// -- 2. OVER CAPACITY REFUSES - WE DO NOT ASK FOR WORK WE CANNOT STAFF -------------------------------
const overAsk = buildOnePageAsk({ proofPack: PACK, closePacket: PACKET, capacity: OVER }, { now: NOW });
assert.equal(overAsk.rendered, false, "over observed capacity refuses the ask");
assert.ok(overAsk.refusal.includes(OVER_CAPACITY_REFUSAL), "and says exactly why");
assert.equal(capacityLine(OVER).ok, false, "the capacity line itself blocks it");

// -- 3. IT RENDERS HONESTLY WHEN EVERYTHING IS REAL --------------------------------------------------
const ask = buildOnePageAsk({ proofPack: PACK, closePacket: PACKET, capacity: UNDER }, { now: NOW });
assert.equal(ask.rendered, true, "renders when proof, packet and capacity are all real");
assert.equal(ask.customer, "Northline Logistics", "for the real customer on the packet");
assert.equal(ask.plan.priceCad, 1450, "at the published plan price, unchanged");
assert.equal(ask.capacity.verdict, "under", "carrying the real capacity verdict");
assert.ok(ask.proof.length >= 1, "with real proof lines");
for (const p of ask.proof) assert.ok(p.records.length > 0, '"' + p.label + '" cites at least one real record id');
const md = onePageAskMarkdown(ask);
assert.ok(md.includes("T-601") || md.includes("T-604"), "and the record ids are printed for the buyer to check");
assert.ok(md.includes("CAD $1450"), "the price is on the page");
assert.ok(md.includes(TRACE_NOTE), "with an open invitation to verify any line");
assert.ok(md.includes(ONE_CLICK_NOTE), "and the honest statement that nothing has been sent or signed");

// A claim with no citation is omitted rather than softened.
assert.deepEqual(provenLines({ schema: "proof-pack.v1", earned: true, claims: [{ label: "L", value: "V", citations: [] }] }), [], "an unciteable claim is dropped");
const uncitable = buildOnePageAsk({ proofPack: { ...PACK, claims: PACK.claims.map((c) => ({ ...c, citations: [] })) }, closePacket: PACKET, capacity: UNDER }, { now: NOW });
assert.equal(uncitable.rendered, false, "and if nothing is citeable, there is nothing to ask with");

// -- 4. UNKNOWN CAPACITY RENDERS - BUT PROMISES NOTHING ----------------------------------------------
const unknownAsk = buildOnePageAsk({ proofPack: PACK, closePacket: PACKET, capacity: UNKNOWN }, { now: NOW });
assert.equal(unknownAsk.rendered, true, "unmeasurable capacity does not block a truthful ask");
assert.equal(unknownAsk.capacity.line, CAPACITY_UNKNOWN_LINE, "but the page makes no delivery-volume promise");
assert.ok(onePageAskMarkdown(unknownAsk).includes(CAPACITY_UNKNOWN_LINE), "and says so to the buyer's face");

// -- 5. NO GUARANTEE LANGUAGE REACHES A BUYER, EVER --------------------------------------------------
for (const page of [md, onePageAskMarkdown(unknownAsk), onePageAskMarkdown(overAsk), nothingMd]) {
  const low = page.toLowerCase();
  for (const term of FORBIDDEN_TERMS) assert.equal(low.includes(term), false, 'no page ever contains "' + term + '"');
}
// K3 runs its own screen - it does not merely trust the upstream packet.
const smuggled = buildOnePageAsk({
  proofPack: PACK,
  capacity: UNDER,
  closePacket: { ...PACKET, terms: ["risk-free first month", "30 days written notice"] },
}, { now: NOW });
assert.equal(smuggled.rendered, true, "the page still renders");
assert.equal(smuggled.terms.length, 1, "but only the clean term survives");
assert.equal(smuggled.rejectedTerms.length, 1, "and the forbidden one is recorded as removed");
assert.equal(onePageAskMarkdown(smuggled).toLowerCase().includes("risk-free"), false, "it never reaches the page");

// -- 6. NO INVENTED REFERENCE CUSTOMER, NO TEMPLATE FILLER -------------------------------------------
for (const bad of ["companies like yours", "case study", "trusted by", "industry-leading", "lorem", "[name]", "xyz corp"]) {
  assert.equal(md.toLowerCase().includes(bad), false, 'the page never says "' + bad + '"');
}
assert.equal((md.match(/Northline Logistics/g) || []).length >= 1, true, "the only customer named is the real one");

// -- 7. STRUCTURALLY UNSENDABLE (static-scanned) ------------------------------------------------------
assert.equal(SENT, false, "nothing here sends");
assert.equal(SIGNED, false, "nothing here signs");
const SRC = readFileSync(new URL("../src/shared/one-page-ask.mjs", import.meta.url), "utf8");
for (const forbidden of ["node:child_process", "node:fs", "node:net", "node:http", "fetch(", "nodemailer", "docusign", "require("]) {
  assert.equal(SRC.includes(forbidden), false, "the ask has no capability to " + forbidden);
}
assert.deepEqual(validateAsk({}).missing.length, 3, "validation is exported and honest on its own");

console.log("k3-one-page-ask: 7 assertion groups green");
