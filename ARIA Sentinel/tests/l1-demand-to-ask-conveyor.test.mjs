// l1-demand-to-ask-conveyor.test.mjs — RUN-L L1 exit criteria, test-locked.
// not-started / mid-chain / ask-ready / paid all reachable from fixtures; every stage advance
// traces to a real artifact id; nothing sends (static-scan locked); honest empty.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CONVEYOR_SCHEMA, SENT, NOTHING_SENT, CHAIN, buildConveyor, conveyorMarkdown,
} from "../src/shared/demand-to-ask-conveyor.mjs";
import { buildDemandIntake } from "../src/shared/demand-intake.mjs";

const NOW = Date.parse("2026-07-22T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -- real demand intake fixture: four accounts, each sourced + qualified honestly ------------------
const signals = [
  { id: "s-not", kind: "site-enquiry", source: "iisupp.net form", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "ops@northwind.example", company: "Northwind", seats: 40, message: "need managed IT", contactName: "A" },
  { id: "s-mid", kind: "site-enquiry", source: "iisupp.net form", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "it@harbor.example", company: "Harbor", seats: 30, message: "endpoint mess", contactName: "B" },
  { id: "s-ask", kind: "referral", source: "partner intro", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "cio@northline.example", company: "Northline Logistics", seats: 55, message: "pilot done, quote us", contactName: "C" },
  { id: "s-paid", kind: "tender-hit", source: "bids portal", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "proc@delta.example", company: "Delta", seats: 60, message: "awarded", contactName: "D" },
];
const intake = buildDemandIntake(signals, { now: NOW });
assert.equal(intake.schema, "demand-intake.v1", "fixture intake is real");
assert.equal(intake.rows.length, 4, "four unique accounts");

const keyOf = (companyFrag) => intake.rows.find((r) => r.key.includes(companyFrag)).key;
const K_NOT = keyOf("northwind"), K_MID = keyOf("harbor"), K_ASK = keyOf("northline"), K_PAID = keyOf("delta");

// -- real chain artifacts, honest schema+flag on each ----------------------------------------------
const engagement = { records: [{ id: "eng-1", at: "2026-06-01T00:00:00Z" }] };
const proofPack = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-1", generatedAt: "2026-06-10T00:00:00Z" };
const closePacket = { schema: "close-packet.v1", rendered: true, customer: "Northline Logistics", generatedAt: "2026-06-20T00:00:00Z" };
const billingHandoff = { schema: "billing-handoff.v1", produced: true, customer: "Northline Logistics", generatedAt: "2026-06-25T00:00:00Z" };
const onePageAsk = { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" };
const ledger = { schema: "payment-receipt-ledger.v1", verified: [{ id: "rcpt-9", processor: "stripe", reference: "ch_ABC" }], firstReceivedAt: "2026-07-05T00:00:00Z" };

const artifactsByKey = {
  // not-started: intake only, no engagement artifact
  [K_NOT]: {},
  // mid-chain: engagement + evidence + packet, but no ask
  [K_MID]: { records: [{ id: "eng-h", at: "2026-06-05T00:00:00Z" }], proofPack, closePacket: { ...closePacket, customer: "Harbor" } },
  // ask-ready: through the ask, no verified payment
  [K_ASK]: { ...engagement, proofPack, closePacket, billingHandoff, onePageAsk },
  // paid: full chain incl a verified receipt
  [K_PAID]: { ...engagement, proofPack, closePacket: { ...closePacket, customer: "Delta" }, billingHandoff: { ...billingHandoff, customer: "Delta" }, onePageAsk: { ...onePageAsk, customer: "Delta" }, ledger },
};

const conv = buildConveyor({ intake, artifactsByKey }, { now: NOW });

test("schema + all four buckets reachable from real fixtures", () => {
  assert.equal(conv.schema, CONVEYOR_SCHEMA);
  assert.equal(conv.counts.total, 4);
  assert.equal(conv.counts["not-started"], 1);
  assert.equal(conv.counts["mid-chain"], 1);
  assert.equal(conv.counts["ask-ready"], 1);
  assert.equal(conv.counts.paid, 1);
});

test("not-started: intake only reports not-started, never in progress", () => {
  const r = conv.rows.find((x) => x.key === K_NOT);
  assert.equal(r.bucket, "not-started");
  assert.equal(r.stage, "intake");
  assert.equal(r.reached.length, 0);
  assert.equal(r.nextStep.stage, "engagement");
});

test("every reached stage traces to a real artifact id — no empty advances", () => {
  for (const r of conv.rows) {
    for (const stage of r.reached) {
      assert.ok(stage.artifactId, `${r.key}/${stage.key} advanced without an artifact id`);
    }
  }
  const paid = conv.rows.find((x) => x.key === K_PAID);
  assert.equal(paid.bucket, "paid");
  assert.ok(paid.reached.find((s) => s.key === "payment").artifactId.includes("rcpt-9"));
});

test("mid-chain stops at the first missing stage; ask-ready is truly pre-payment", () => {
  const mid = conv.rows.find((x) => x.key === K_MID);
  assert.equal(mid.bucket, "mid-chain");
  assert.equal(mid.stage, "packet");
  assert.equal(mid.nextStep.stage, "handoff");
  const ask = conv.rows.find((x) => x.key === K_ASK);
  assert.equal(ask.bucket, "ask-ready");
  assert.equal(ask.stage, "ask");
  assert.equal(ask.nextStep.stage, "payment");
});

test("integrity gap: a downstream artifact over a missing upstream one is flagged, not promoted", () => {
  // ask + ledger present but NO engagement -> break at engagement, gap true, bucket not-started
  const gappy = buildConveyor({
    intake,
    artifactsByKey: { [K_NOT]: { onePageAsk, ledger }, [K_MID]: {}, [K_ASK]: {}, [K_PAID]: {} },
  }, { now: NOW });
  const r = gappy.rows.find((x) => x.key === K_NOT);
  assert.equal(r.gap, true);
  assert.equal(r.bucket, "not-started");
  assert.equal(r.stage, "intake");
  assert.ok(/integrity gap/.test(r.nextStep.label));
  assert.equal(gappy.counts.gaps, 1);
});

test("honest empty: no real intake -> refusal, no invented pipeline", () => {
  const e = buildConveyor({}, { now: NOW });
  assert.equal(e.empty, true);
  assert.equal(e.rows.length, 0);
  assert.ok(/report(s)? nothing|No real demand-intake/.test(e.refusal));
});

test("nothing sends: flags + deterministic order + markdown carries no send verb", () => {
  assert.equal(SENT, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(conv.sent, false);
  assert.equal(conv.nothingSent, true);
  for (const r of conv.rows) assert.equal(r.nextStep.executed, false, "every next step is staged, never executed");
  // deterministic furthest-first
  assert.deepEqual(conv.rows.map((r) => r.bucket), ["paid", "ask-ready", "mid-chain", "not-started"]);
  const md = conveyorMarkdown(conv);
  assert.ok(/cannot send, sign, or charge/.test(md));
});

test("STATIC-SCAN LOCK: the source has no send/network/exec class at all", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/demand-to-ask-conveyor.mjs"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /\bhttps?:\/\//, /nodemailer/, /sendmail/i,
    /child_process/, /\bexec(Sync)?\s*\(/, /\bspawn\s*\(/, /net\.(connect|Socket)/, /\brequest\s*\(/,
    /\.post\s*\(/, /\.send\s*\(/,
  ];
  for (const re of forbidden) {
    assert.equal(re.test(src), false, `conveyor source must not contain ${re}`);
  }
});

test("chain is the K-chain in order", () => {
  assert.deepEqual(CHAIN.map((s) => s.key), ["engagement", "evidence", "packet", "handoff", "ask", "payment"]);
});
