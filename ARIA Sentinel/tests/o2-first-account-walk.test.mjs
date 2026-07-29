// o2-first-account-walk.test.mjs — RUN-O O2 exit criteria, test-locked.
// A first-time operator goes from nothing to either a complete packet or a named gap list without
// reading the ledger; every refusal names its gate; every module in the chain is send-incapable.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  FIRST_ACCOUNT_WALK_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, OUTCOMES,
  NOTHING_RECORDED_STATEMENT, FIXTURE_WARNING, NEARLY_WORDS, WALK_FIELDS, CHAIN_MODULES,
  runFirstAccountWalk, walkSteps, firstAccountWalkMarkdown,
} from "../src/shared/first-account-walk.mjs";
import { GATE_KEYS } from "../src/shared/ask-ready-queue.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const account = {
  key: "northline-logistics", seats: 40, region: "Ontario", need: "managed IT support",
  demandSignal: { id: "sig-1", kind: "site-enquiry", source: "iisupp.net contact form",
    firstSeenAt: "2026-06-02T09:00:00Z", email: "cio@northline.example", company: "Northline Logistics" },
  engagements: [
    { id: "eng-1", at: "2026-06-10T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-2", at: "2026-06-24T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-3", at: "2026-07-08T13:00:00Z", durationMinutes: 200, source: "ticket log" },
  ],
  costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
  quoteCad: 1200, quoteSource: "quote-2026-07-20 (operator)",
};
const proofPack = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A", claims: [
  { label: "Tickets resolved without escalation", value: "17 of 19", recordIds: ["t-1", "t-2"] },
  { label: "Observed delivery minutes", value: 800, recordIds: ["eng-1", "eng-2", "eng-3"] },
] };
const artifacts = { proofPack,
  closePacket: { schema: "close-packet.v1", rendered: true, customer: "Northline Logistics" },
  billingHandoff: { schema: "billing-handoff.v1", produced: true, customer: "Northline Logistics" },
  onePageAsk: { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" } };

const full = { account, artifacts, recipient: { name: "C. Okafor", address: "cio@northline.example" }, costAccountMonths: 2 };

test("O2: belt-and-braces — nothing is sent, signed or charged", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
});

test("O2: the walk runs with zero records and says so plainly", () => {
  const w = runFirstAccountWalk({}, { now: NOW });
  assert.equal(w.schema, FIRST_ACCOUNT_WALK_SCHEMA);
  assert.equal(w.outcome, "nothing-recorded");
  assert.equal(w.statement, NOTHING_RECORDED_STATEMENT);
  assert.equal(w.packet, null);
  assert.equal(w.packetLocation, null);
  assert.ok(w.steps.length >= 3, "the guide exists before any data does");
});

test("O2: every asked-for field names where its value comes from and refuses rather than defaults", () => {
  assert.ok(WALK_FIELDS.length >= 6);
  for (const f of WALK_FIELDS) {
    assert.ok(f.field && f.asks && f.source, `${f.field} must name its source`);
    assert.equal(f.refuseIfUnknown, true, `${f.field} must refuse rather than default`);
  }
  const steps = walkSteps();
  assert.equal(steps[0].fields.length, WALK_FIELDS.length);
});

test("O2: a complete real account produces a packet — staged, never sent", () => {
  const w = runFirstAccountWalk({ ...full, realAccount: true }, { now: NOW });
  assert.equal(w.outcome, "packet");
  assert.ok(w.packet);
  assert.equal(w.packetLocation.staged, true);
  assert.equal(w.packetLocation.sent, false);
  assert.deepEqual(w.gaps, []);
  assert.equal(w.fixture, false);
});

test("O2: an incomplete account produces a NAMED gap list in the gates' own vocabulary", () => {
  const { costBasis, ...noCost } = account;
  const w = runFirstAccountWalk({ ...full, account: noCost, realAccount: true }, { now: NOW });
  assert.equal(w.outcome, "gaps");
  assert.equal(w.packet, null);
  assert.ok(w.gaps.length > 0, "a gap list must actually name gaps");
  for (const g of w.gaps) assert.ok(g.text, "every gap carries the gate's own words");
  for (const g of w.gaps) if (g.gate) assert.ok(GATE_KEYS.includes(g.gate), `${g.gate} must be a real gate key`);
});

test("O2: the outcome is binary — a packet XOR gaps, never both, never neither, never 'nearly there'", () => {
  const cases = [
    runFirstAccountWalk({}, { now: NOW }),
    runFirstAccountWalk({ ...full, realAccount: true }, { now: NOW }),
    runFirstAccountWalk({ account: { key: "bare" }, realAccount: true }, { now: NOW }),
  ];
  for (const w of cases) {
    assert.ok(OUTCOMES.includes(w.outcome));
    const hasPacket = !!w.packet;
    const hasGaps = Array.isArray(w.gaps) && w.gaps.length > 0;
    assert.ok(!(hasPacket && hasGaps), "never both");
    if (w.outcome === "packet") assert.ok(hasPacket && !hasGaps);
    if (w.outcome === "gaps") assert.ok(hasGaps && !hasPacket);
    const md = firstAccountWalkMarkdown(w).toLowerCase();
    for (const bad of NEARLY_WORDS) assert.ok(!md.includes(bad), `must never say "${bad}"`);
  }
});

test("O2: a fixture is not a buyer — an unasserted account is marked and warned", () => {
  const w = runFirstAccountWalk(full, { now: NOW });
  assert.equal(w.fixture, true);
  assert.equal(w.fixtureWarning, FIXTURE_WARNING);
  assert.match(w.statement, /not a buyer/i);
  const md = firstAccountWalkMarkdown(w);
  assert.match(md, /not a buyer/i);
});

test("O2: every refusal is reported as a refusal, never as a filled default", () => {
  const { quoteCad, ...noQuote } = account;
  const w = runFirstAccountWalk({ ...full, account: noQuote, realAccount: true }, { now: NOW });
  for (const r of w.refusals) assert.equal(r.refusedRatherThanDefaulted, true);
  if (w.outcome === "gaps") assert.ok(w.gaps.length > 0);
});

test("O2: static-scan — EVERY module in the chain is send-incapable", () => {
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/];
  assert.ok(CHAIN_MODULES.length >= 5);
  for (const mod of CHAIN_MODULES) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});
