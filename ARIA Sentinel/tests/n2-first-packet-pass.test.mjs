// n2-first-packet-pass.test.mjs — RUN-N N2 exit criteria, test-locked.
// the end-to-end pass produces EITHER a complete packet OR a named gap list — never both, never
// neither, never a partial draft; every module in the chain is static-scanned send-incapable.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  FIRST_PACKET_PASS_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, OUTCOMES, CHAIN_MODULES,
  runFirstPacketPass, firstPacketPassMarkdown,
} from "../src/shared/first-packet-pass.mjs";
import { GATE_KEYS } from "../src/shared/ask-ready-queue.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const account = {
  key: "northline-logistics",
  seats: 40,
  region: "Ontario",
  need: "managed IT support",
  demandSignal: {
    id: "sig-1", kind: "site-enquiry", source: "iisupp.net contact form",
    firstSeenAt: "2026-06-02T09:00:00Z", email: "cio@northline.example", company: "Northline Logistics",
  },
  engagements: [
    { id: "eng-1", at: "2026-06-10T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-2", at: "2026-06-24T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-3", at: "2026-07-08T13:00:00Z", durationMinutes: 200, source: "ticket log" },
  ],
  costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
  quoteCad: 1200,
  quoteSource: "quote-2026-07-20 (operator)",
};

const proofPack = {
  schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A",
  claims: [
    { label: "Tickets resolved without escalation", value: "17 of 19", recordIds: ["t-1", "t-2", "t-3"] },
    { label: "Observed delivery minutes", value: 800, recordIds: ["eng-1", "eng-2", "eng-3"] },
    { label: "Repeat incidents closed at source", value: 4, recordIds: ["t-7", "t-9"] },
  ],
};

const artifacts = {
  proofPack,
  closePacket: { schema: "close-packet.v1", rendered: true, customer: "Northline Logistics" },
  billingHandoff: { schema: "billing-handoff.v1", produced: true, customer: "Northline Logistics" },
  onePageAsk: { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" },
};

const recipient = { name: "C. Okafor", address: "cio@northline.example", role: "CIO" };

const fullInput = { account, artifacts, recipient, costAccountMonths: 2 };

test("N2: belt-and-braces flags — nothing is sent, signed or charged", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  const out = runFirstPacketPass(fullInput, { now: NOW });
  assert.equal(out.sent, false);
  assert.equal(out.charged, false);
});

test("N2: a complete real account produces a complete packet and an EMPTY gap list", () => {
  const out = runFirstPacketPass(fullInput, { now: NOW });
  assert.equal(out.schema, FIRST_PACKET_PASS_SCHEMA);
  assert.equal(out.outcome, "packet");
  assert.ok(out.packet);
  assert.equal(out.packet.refused, false);
  assert.equal(out.packet.packet.account, "northline-logistics");
  assert.equal(out.packet.packet.recipient.address, "cio@northline.example");
  assert.deepEqual(out.gaps, []);
  assert.deepEqual(out.gatesCleared, GATE_KEYS);
  assert.equal(out.stages.intake && out.stages.queue && out.stages.packet, true);
});

test("N2: the packet shows the floor so the price is defensible (Rule 17 + Rule 14)", () => {
  const out = runFirstPacketPass(fullInput, { now: NOW });
  const price = out.packet.packet.price;
  assert.equal(price.quoteCad, 1200);
  assert.equal(price.floorShown, true);
  assert.ok(price.observedFloorCad > 0);
  assert.ok(price.quoteCad > price.observedFloorCad);
});

test("N2: exactly one outcome — packet XOR gaps, never both, never neither", () => {
  const cases = [
    fullInput,
    { ...fullInput, artifacts: { ...artifacts, proofPack: undefined } },
    { ...fullInput, recipient: { name: "TBD", address: "tbd" } },
    { ...fullInput, account: { ...account, quoteCad: undefined, quoteSource: undefined } },
    { ...fullInput, account: { ...account, engagements: [] } },
    {},
  ];
  for (const c of cases) {
    const out = runFirstPacketPass(c, { now: NOW });
    assert.ok(OUTCOMES.includes(out.outcome), "outcome must be one of the two");
    const hasPacket = out.outcome === "packet";
    assert.equal(hasPacket, out.packet !== null, "packet present iff outcome is packet");
    assert.equal(hasPacket, out.gaps.length === 0, "gaps empty iff outcome is packet");
    if (!hasPacket) assert.ok(out.gaps.length > 0, "a gaps outcome must name at least one gap");
  }
});

test("N2: gates not cleared => NO draft, NO preview, NO partial packet object", () => {
  const out = runFirstPacketPass({ ...fullInput, artifacts: { ...artifacts, proofPack: undefined } }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
  const json = JSON.stringify(out);
  assert.ok(!/"draft"/.test(json) && !/"preview"/.test(json), "no draft/preview escape hatch");
  assert.ok(!/nearly|almost|80%/i.test(json), "no flattering progress language");
});

test("N2: a missing proof pack is a named gap in M1's own words", () => {
  // Nothing downstream of the pack, so the chain simply stops at evidence — no integrity break.
  const out = runFirstPacketPass({
    ...fullInput,
    artifacts: { closePacket: undefined, billingHandoff: undefined, onePageAsk: undefined },
  }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
  assert.ok(out.gaps.some((g) => /EARNED/.test(g.text)), "the missing pack must be named as EARNED, not softened");
});

test("N2: a CLAIMED-not-earned pack under rendered downstream artifacts is an integrity gap, not a pass", () => {
  const claimedNotEarned = { schema: "proof-pack.v1", earned: false, pilotId: "PILOT-A", claims: proofPack.claims };
  const out = runFirstPacketPass({ ...fullInput, artifacts: { ...artifacts, proofPack: claimedNotEarned } }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
  assert.ok(out.gaps.some((g) => g.gate === "integrity"),
    "a rendered ask sitting on an unearned pack is an out-of-order chain and must be reported as one");
});

test("N2: the packet carries the operator's account key, not a real email address (vault Rule 11)", () => {
  const out = runFirstPacketPass(fullInput, { now: NOW });
  assert.equal(out.outcome, "packet");
  assert.equal(out.accountKey, "northline-logistics");
  assert.match(out.chainKey, /^email:/);
  assert.equal(out.packet.packet.account, "northline-logistics");
  // the address appears only in the recipient block, where it belongs — never as an identifier
  assert.ok(!/@/.test(out.packet.packet.trace.chainArtifactIds.join(" ")));
});

test("N2: a placeholder recipient refuses the packet by name", () => {
  const out = runFirstPacketPass({ ...fullInput, recipient: { name: "TBD", address: "tbd@" } }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
  assert.ok(out.gaps.some((g) => g.gate === "recipient"));
  assert.ok(out.gaps.some((g) => /placeholder/.test(g.text)));
});

test("N2: a below-floor quote can never produce a packet", () => {
  // floor = 4000/8000 = 0.5 CAD/min * 800 min = 400 over 2 months => 200/mo basis; 50 CAD is below.
  const out = runFirstPacketPass({ ...fullInput, account: { ...account, quoteCad: 50 } }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
  assert.ok(out.gaps.some((g) => /floor/.test(g.text)));
});

test("N2: an unknown floor (no observed months) can never produce a packet", () => {
  const out = runFirstPacketPass({ ...fullInput, costAccountMonths: undefined }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
});

test("N2: no account at all is an honest gaps outcome, never a crash and never a packet", () => {
  const out = runFirstPacketPass({}, { now: NOW });
  assert.equal(out.outcome, "gaps");
  assert.equal(out.packet, null);
  assert.equal(out.gaps.length, 1);
  assert.match(out.statement, /Nothing is staged/);
});

test("N2: the gap list speaks M1's gate vocabulary", () => {
  const out = runFirstPacketPass({ ...fullInput, account: { ...account, engagements: [] } }, { now: NOW });
  assert.equal(out.outcome, "gaps");
  for (const g of out.gaps) {
    assert.ok([...GATE_KEYS, "integrity", "recipient", "onePageAsk", "proofPack", "quote", "askReady"].includes(g.gate),
      `unexpected gate vocabulary: ${g.gate}`);
  }
});

test("N2: deterministic — same input, same output", () => {
  assert.deepEqual(runFirstPacketPass(fullInput, { now: NOW }), runFirstPacketPass(fullInput, { now: NOW }));
});

test("N2: markdown never renders a packet for a gaps outcome", () => {
  const md = firstPacketPassMarkdown(runFirstPacketPass({}, { now: NOW }));
  assert.match(md, /Named gaps/);
  assert.ok(!/Packet staged/.test(md));
});

test("N2: static-scan — EVERY module in the chain is send-incapable", () => {
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/];
  assert.ok(CHAIN_MODULES.length >= 4);
  for (const mod of CHAIN_MODULES) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});
