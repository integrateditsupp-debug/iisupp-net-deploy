// m2-send-packet.test.mjs — RUN-M M2 exit criteria, test-locked.
// a complete packet builds from a real ask-ready fixture; a record missing any artifact produces a
// packet-refused result naming the gap; static-scan proves no send class exists in the source.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  SEND_PACKET_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, PART_KEYS, REFUSAL_PREFIX,
  buildSendPacket, sendPacketMarkdown,
} from "../src/shared/send-packet.mjs";
import { checkQuoteAgainstFloor, computePricingFloor } from "../src/shared/pricing-floor.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KEY = "northline-logistics";

// A real L3 floor for this account: 4000/8000 = 0.5 CAD/min; 800 min over 2 months => floor 200.
const floorResult = computePricingFloor({
  costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
  accounts: [{ key: KEY, months: 2, records: [
    { id: "d-1", durationMinutes: 300 }, { id: "d-2", durationMinutes: 300 }, { id: "d-3", durationMinutes: 200 },
  ] }],
}, { now: NOW });
const floorCheckResult = checkQuoteAgainstFloor(floorResult, KEY, 1200);

const askReady = {
  key: KEY, stage: "ask", evidenceClaims: 3, stagesWithArtifact: 5, evidenceScore: 8,
  quoteCad: 1200, floorCad: 200, marginCad: 1000, deliveryCostCad: 200,
  artifactIds: ["eng-1", "proof-pack:PILOT-A", "close-packet:Northline Logistics", "billing-handoff:Northline Logistics", "one-page-ask:Northline Logistics"],
  proofPackId: "PILOT-A", gates: ["demand", "engagement", "evidence", "priced"],
};
const recipient = { name: "C. Okafor", address: "cio@northline.example", role: "CIO" };
const onePageAsk = { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" };
const proofPack = {
  schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A",
  claims: [
    { label: "Tickets resolved without escalation", value: "17 of 19", recordIds: ["t-1", "t-2", "t-3"] },
    { label: "Median time to first response", value: "4 min", recordIds: ["t-1", "t-4"] },
    { label: "Operator minutes we actually spent", value: "800", recordIds: ["d-1", "d-2", "d-3"] },
  ],
};

const good = { askReady, recipient, onePageAsk, proofPack, floorCheckResult };
const res = buildSendPacket(good, { now: NOW });

test("COMPLETE PACKET builds from a real ask-ready fixture", () => {
  assert.equal(res.schema, SEND_PACKET_SCHEMA);
  assert.equal(res.refused, false);
  assert.equal(res.refusal, null);
  assert.deepEqual(res.missing, []);
  assert.equal(res.packet.account, KEY);
  assert.equal(res.packet.recipient.address, "cio@northline.example");
  assert.equal(res.packet.recipient.role, "CIO");
});

test("EVERY CLAIM TRACES to a real record id; the price shows the floor", () => {
  const p = res.packet;
  assert.equal(p.evidence.claims.length, 3);
  for (const c of p.evidence.claims) assert.ok(c.recordIds.length > 0);
  assert.equal(p.evidence.proofPackId, "PILOT-A");
  assert.equal(p.price.quoteCad, 1200);
  assert.equal(p.price.observedFloorCad, 200);
  assert.equal(p.price.marginCad, 1000);
  assert.equal(p.price.floorShown, true);
  assert.equal(p.price.floorCheckStatus, "above-floor");
  assert.ok(p.trace.chainArtifactIds.length >= 5);
  assert.ok(p.trace.claimRecordIds.includes("d-1"));
});

test("VALUE-FIRST (Rule 17): the packet leads with what the buyer gets, from evidenced claims only", () => {
  assert.equal(res.packet.valueFirst.length, 3);
  assert.ok(res.packet.valueFirst[0].startsWith("Tickets resolved without escalation"));
});

test("AN UNEVIDENCED CLAIM IS OMITTED, NEVER SOFTENED", () => {
  const withJunk = buildSendPacket({
    ...good,
    proofPack: { ...proofPack, claims: [
      ...proofPack.claims,
      { label: "Estimated annual savings", value: "$40,000" },        // no record ids
      { label: "Downtime avoided", value: "lots", recordIds: [] },     // empty ids
    ] },
  }, { now: NOW });
  assert.equal(withJunk.refused, false);
  assert.equal(withJunk.packet.evidence.claims.length, 3, "only the evidenced three survive");
  assert.equal(withJunk.packet.evidence.omittedClaims.length, 2, "the omissions are visible, not silent");
  const md = sendPacketMarkdown(withJunk);
  assert.ok(!/40,000/.test(md), "an unevidenced number never reaches the buyer-facing text");
  assert.ok(/left out for want of a record id, not softened/.test(md));
});

test("MISSING ANY PART => packet-refused NAMING the gap (each part, individually)", () => {
  for (const part of PART_KEYS) {
    const broken = { ...good };
    if (part === "quote") broken.floorCheckResult = null; else broken[part === "askReady" ? "askReady" : part] = null;
    const r = buildSendPacket(broken, { now: NOW });
    assert.equal(r.refused, true, `${part} missing must refuse`);
    assert.equal(r.packet, null);
    assert.ok(r.missing.includes(part), `${part} must be named`);
    assert.ok(r.refusal.startsWith(REFUSAL_PREFIX));
    assert.ok(r.missingText.join(" ").length > 20);
  }
});

test("A PLACEHOLDER RECIPIENT IS REFUSED — we never stage a send to 'TBD'", () => {
  for (const bad of [
    { name: "TBD", address: "cio@northline.example" },
    { name: "C. Okafor", address: "" },
    { name: "C. Okafor", address: "not-an-address" },
    { name: "", address: "cio@northline.example" },
  ]) {
    const r = buildSendPacket({ ...good, recipient: bad }, { now: NOW });
    assert.equal(r.refused, true);
    assert.ok(r.missing.includes("recipient"));
  }
});

test("A BELOW-FLOOR OR UNKNOWN-FLOOR QUOTE CANNOT BE PACKETED", () => {
  const below = buildSendPacket({ ...good, floorCheckResult: checkQuoteAgainstFloor(floorResult, KEY, 150) }, { now: NOW });
  assert.equal(below.refused, true);
  assert.ok(below.missing.includes("quote"));

  const noBasis = computePricingFloor({ accounts: [] }, { now: NOW });
  const unknown = buildSendPacket({ ...good, floorCheckResult: checkQuoteAgainstFloor(noBasis, KEY, 1200) }, { now: NOW });
  assert.equal(unknown.refused, true);
  assert.ok(unknown.missing.includes("quote"));
});

test("A FLOOR CHECK FOR A DIFFERENT ACCOUNT IS REFUSED, NEVER SILENTLY RECONCILED", () => {
  const other = computePricingFloor({
    costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
    accounts: [{ key: "harbor", months: 2, records: [
      { id: "h-1", durationMinutes: 100 }, { id: "h-2", durationMinutes: 100 }, { id: "h-3", durationMinutes: 100 },
    ] }],
  }, { now: NOW });
  const r = buildSendPacket({ ...good, floorCheckResult: checkQuoteAgainstFloor(other, "harbor", 900) }, { now: NOW });
  assert.equal(r.refused, true);
  assert.ok(/different account/.test(r.refusal));
});

test("A CLAIMED (NOT EARNED) PACK IS REFUSED", () => {
  const r = buildSendPacket({ ...good, proofPack: { schema: "proof-pack.v1", earned: false, pilotId: "PILOT-A", claims: [] } }, { now: NOW });
  assert.equal(r.refused, true);
  assert.ok(r.missing.includes("proofPack"));
});

test("AN EARNED PACK WITH NO TRACEABLE CLAIM IS REFUSED — nothing defensible to send", () => {
  const r = buildSendPacket({
    ...good,
    proofPack: { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A", claims: [{ label: "Savings", value: "big" }] },
  }, { now: NOW });
  assert.equal(r.refused, true);
  assert.ok(/no claim with a record id behind it/.test(r.refusal));
});

test("STRUCTURALLY INCAPABLE OF SENDING: flags stay false and the packet is staged, not executed", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(res.sent, false);
  assert.equal(res.signed, false);
  assert.equal(res.charged, false);
  assert.equal(res.staged, true);
  assert.equal(res.executed, false);
  const md = sendPacketMarkdown(res);
  assert.ok(/cannot send, sign, or charge/.test(md));
  assert.ok(/Nothing leaves this machine without that click/.test(md));
  assert.ok(/Send packet — northline-logistics/.test(md));
  assert.ok(/1200 CAD\/mo/.test(md));
  assert.equal(sendPacketMarkdown(null), "_no send packet_");
  assert.ok(/never passed off as complete/.test(sendPacketMarkdown(buildSendPacket({}, { now: NOW }))));
});

test("STATIC-SCAN LOCK: the source has no send/network/exec class at all", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/send-packet.mjs"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /\bhttps?:\/\//, /nodemailer/, /sendmail/i,
    /child_process/, /\bexec(Sync)?\s*\(/, /\bspawn\s*\(/, /net\.(connect|Socket)/, /\brequest\s*\(/,
    /readFileSync/, /writeFileSync/, /stripe/i, /invoice\s*\(/, /smtp/i, /\bmailto:/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `send-packet.mjs must not contain ${re}`);
  }
});
