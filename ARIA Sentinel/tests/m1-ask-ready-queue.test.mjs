// m1-ask-ready-queue.test.mjs — RUN-M M1 exit criteria, test-locked.
// empty / one-ready / many-ready all reachable from real fixtures; every inclusion traces to real
// artifact ids; ranking is deterministic; a below-floor quote can never enter the queue;
// nothing sends (static-scan locked).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ASK_READY_QUEUE_SCHEMA, SENT, NOTHING_SENT, GATE_KEYS, EMPTY_STATEMENT,
  buildAskReadyQueue, topAskReady, askReadyQueueMarkdown,
} from "../src/shared/ask-ready-queue.mjs";
import { buildConveyor } from "../src/shared/demand-to-ask-conveyor.mjs";
import { buildDemandIntake } from "../src/shared/demand-intake.mjs";
import { computePricingFloor, checkQuoteAgainstFloor } from "../src/shared/pricing-floor.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -- real demand intake: three live accounts + one already paid ------------------------------------
const signals = [
  { id: "s-a", kind: "referral", source: "partner intro", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "cio@northline.example", company: "Northline Logistics", seats: 55, message: "pilot done, quote us", contactName: "C" },
  { id: "s-b", kind: "site-enquiry", source: "iisupp.net form", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "it@harbor.example", company: "Harbor", seats: 30, message: "endpoint mess", contactName: "B" },
  { id: "s-c", kind: "site-enquiry", source: "iisupp.net form", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "ops@northwind.example", company: "Northwind", seats: 40, message: "need managed IT", contactName: "A" },
  { id: "s-d", kind: "tender-hit", source: "bids portal", firstSeenAt: "2026-07-01T00:00:00Z",
    email: "proc@delta.example", company: "Delta", seats: 60, message: "awarded", contactName: "D" },
];
const intake = buildDemandIntake(signals, { now: NOW });
const keyOf = (frag) => intake.rows.find((r) => r.key.includes(frag)).key;
const K_A = keyOf("northline"), K_B = keyOf("harbor"), K_C = keyOf("northwind"), K_PAID = keyOf("delta");

// -- real chain artifacts ---------------------------------------------------------------------------
const eng = (id, at) => ({ records: [{ id, at }] });
const closePacket = (c) => ({ schema: "close-packet.v1", rendered: true, customer: c });
const billingHandoff = (c) => ({ schema: "billing-handoff.v1", produced: true, customer: c });
const onePageAsk = (c) => ({ schema: "one-page-ask.v1", rendered: true, customer: c });
const ledger = { schema: "payment-receipt-ledger.v1", verified: [{ id: "rcpt-9", processor: "cheque", reference: "chq-114" }] };

// Proof packs with a DIFFERENT number of evidenced claims so ranking is observable.
const packStrong = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A", claims: [{ c: 1 }, { c: 2 }, { c: 3 }, { c: 4 }, { c: 5 }] };
const packWeaker = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-B", claims: [{ c: 1 }, { c: 2 }, { c: 3 }] };
const packNotEarned = { schema: "proof-pack.v1", earned: false, pilotId: null, claims: [] };

const artifactsByKey = {
  [K_A]: { ...eng("eng-a", "2026-06-01T00:00:00Z"), proofPack: packStrong, closePacket: closePacket("Northline Logistics"), billingHandoff: billingHandoff("Northline Logistics"), onePageAsk: onePageAsk("Northline Logistics") },
  [K_B]: { ...eng("eng-b", "2026-06-05T00:00:00Z"), proofPack: packWeaker, closePacket: closePacket("Harbor"), billingHandoff: billingHandoff("Harbor"), onePageAsk: onePageAsk("Harbor") },
  [K_C]: {}, // nothing real past intake
  [K_PAID]: { ...eng("eng-d", "2026-06-01T00:00:00Z"), proofPack: packStrong, closePacket: closePacket("Delta"), billingHandoff: billingHandoff("Delta"), onePageAsk: onePageAsk("Delta"), ledger },
};
const conveyor = buildConveyor({ intake, artifactsByKey }, { now: NOW });

// -- real L3 floor: 4000 CAD / 8000 min = 0.5 CAD per delivered minute -----------------------------
const floorResult = computePricingFloor({
  costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
  accounts: [
    // A: 800 min over 2 months = 400/mo => floor 200
    { key: K_A, months: 2, records: [{ id: "a-1", durationMinutes: 300 }, { id: "a-2", durationMinutes: 300 }, { id: "a-3", durationMinutes: 200 }] },
    // B: 300 min over 2 months = 150/mo => floor 75 (CHEAPER to deliver than A)
    { key: K_B, months: 2, records: [{ id: "b-1", durationMinutes: 100 }, { id: "b-2", durationMinutes: 100 }, { id: "b-3", durationMinutes: 100 }] },
  ],
}, { now: NOW });

const evidenceByKey = {
  [K_A]: { proofPack: packStrong, quoteCad: 1200 },
  [K_B]: { proofPack: packWeaker, quoteCad: 900 },
  [K_C]: { proofPack: packNotEarned, quoteCad: 0 },
};

const q = buildAskReadyQueue({ conveyor, floorResult, evidenceByKey, floorCheck: checkQuoteAgainstFloor }, { now: NOW });

test("MANY-READY: two accounts clear all four gates; the paid account is not an ask", () => {
  assert.equal(q.schema, ASK_READY_QUEUE_SCHEMA);
  assert.equal(q.empty, false);
  assert.equal(q.counts.ready, 2);
  assert.deepEqual(q.ready.map((r) => r.key), [K_A, K_B], "strongest evidence first");
  assert.ok(!q.ready.some((r) => r.key === K_PAID), "a paid account never appears as an ask");
  assert.ok(!q.nearMisses.some((n) => n.key === K_PAID), "a paid account is not a near-miss either");
});

test("every inclusion traces to real artifact ids and a real proof pack id", () => {
  for (const r of q.ready) {
    assert.ok(r.artifactIds.length > 0, `${r.key} must cite real artifact ids`);
    assert.ok(r.artifactIds.every((id) => typeof id === "string" && id.length > 0));
    assert.ok(typeof r.proofPackId === "string" && r.proofPackId.length > 0, "real earned pack id");
    assert.deepEqual(r.gates, GATE_KEYS);
  }
  const a = q.ready.find((r) => r.key === K_A);
  assert.equal(a.quoteCad, 1200);
  assert.equal(a.floorCad, 200);
  assert.equal(a.marginCad, 1000);
});

test("RANKING IS DETERMINISTIC: same inputs, same order, every time", () => {
  for (let i = 0; i < 5; i += 1) {
    const again = buildAskReadyQueue({ conveyor, floorResult, evidenceByKey, floorCheck: checkQuoteAgainstFloor }, { now: NOW });
    assert.deepEqual(again.ready.map((r) => r.key), q.ready.map((r) => r.key));
    assert.deepEqual(again.nearMisses.map((r) => r.key), q.nearMisses.map((r) => r.key));
  }
});

test("RANKING TIE-BREAK: equal evidence => the CHEAPER observed delivery cost ranks first (never deal size)", () => {
  // Both accounts get the SAME pack strength; A quotes far higher but costs more to deliver.
  const tie = buildAskReadyQueue({
    conveyor, floorResult,
    evidenceByKey: {
      [K_A]: { proofPack: packWeaker, quoteCad: 5000 },   // bigger deal, floor 200
      [K_B]: { proofPack: packWeaker, quoteCad: 900 },    // smaller deal, floor 75
    },
    floorCheck: checkQuoteAgainstFloor,
  }, { now: NOW });
  assert.equal(tie.counts.ready, 2);
  assert.deepEqual(tie.ready.map((r) => r.key), [K_B, K_A], "cheapest to deliver wins the tie, not the biggest quote");
});

test("BELOW-FLOOR QUOTE CAN NEVER ENTER THE QUEUE — it is a named near-miss", () => {
  const below = buildAskReadyQueue({
    conveyor, floorResult,
    evidenceByKey: {
      [K_A]: { proofPack: packStrong, quoteCad: 150 },  // floor is 200 — loses money
      [K_B]: { proofPack: packWeaker, quoteCad: 900 },
    },
    floorCheck: checkQuoteAgainstFloor,
  }, { now: NOW });
  assert.ok(!below.ready.some((r) => r.key === K_A), "below-floor account is excluded");
  assert.equal(below.counts.blockedByFloor, 1);
  const nm = below.nearMisses.find((n) => n.key === K_A);
  assert.ok(nm, "it appears as a near-miss");
  assert.ok(nm.missing.includes("priced"));
  assert.ok(/above the observed delivery floor/.test(nm.missingText.join(" ")));
});

test("A QUOTE EXACTLY AT THE FLOOR IS ALSO REFUSED — at-floor is not above-floor", () => {
  const atFloor = buildAskReadyQueue({
    conveyor, floorResult,
    evidenceByKey: { [K_A]: { proofPack: packStrong, quoteCad: 200 } },
    floorCheck: checkQuoteAgainstFloor,
  }, { now: NOW });
  assert.ok(!atFloor.ready.some((r) => r.key === K_A));
});

test("UNKNOWN FLOOR IS REFUSED — we never ask before we know our own delivery cost", () => {
  const noBasis = computePricingFloor({ accounts: [] }, { now: NOW });
  const res = buildAskReadyQueue({
    conveyor, floorResult: noBasis,
    evidenceByKey: { [K_A]: { proofPack: packStrong, quoteCad: 1200 } },
    floorCheck: checkQuoteAgainstFloor,
  }, { now: NOW });
  assert.equal(res.counts.ready, 0);
  assert.equal(res.empty, true);
});

test("NEAR-MISSES NAME THE EXACT MISSING ARTIFACT — never 'almost ready'", () => {
  const c = q.nearMisses.find((n) => n.key === K_C);
  assert.ok(c, "the bare-intake account is a near-miss");
  assert.ok(c.missing.includes("engagement") && c.missing.includes("evidence") && c.missing.includes("priced"));
  for (const nm of q.nearMisses) {
    assert.equal(nm.missing.length, nm.missingText.length);
    for (const t of nm.missingText) assert.ok(t.length > 20, "the gap is spelled out, not abbreviated");
    assert.ok(!/almost|nearly|warm|soon/i.test(nm.missingText.join(" ")), "no optimism language");
  }
});

test("A CLAIMED (NOT EARNED) PROOF PACK NEVER PASSES THE EVIDENCE GATE", () => {
  const claimed = buildAskReadyQueue({
    conveyor, floorResult,
    evidenceByKey: { [K_A]: { proofPack: { schema: "proof-pack.v1", earned: false, pilotId: "PILOT-A", claims: [] }, quoteCad: 1200 } },
    floorCheck: checkQuoteAgainstFloor,
  }, { now: NOW });
  assert.equal(claimed.counts.ready, 0);
  const nm = claimed.nearMisses.find((n) => n.key === K_A);
  assert.ok(nm.missing.includes("evidence"));
});

test("AN INTEGRITY GAP DISQUALIFIES REGARDLESS OF GATE COUNT", () => {
  // ask + evidence present but NO engagement artifact => the conveyor reports a gap
  const gapArtifacts = {
    ...artifactsByKey,
    [K_A]: { proofPack: packStrong, closePacket: closePacket("Northline Logistics"), billingHandoff: billingHandoff("Northline Logistics"), onePageAsk: onePageAsk("Northline Logistics") },
  };
  const gapConv = buildConveyor({ intake, artifactsByKey: gapArtifacts }, { now: NOW });
  const gapRow = gapConv.rows.find((r) => r.key === K_A);
  assert.equal(gapRow.gap, true, "fixture really does produce an integrity gap");
  const res = buildAskReadyQueue({ conveyor: gapConv, floorResult, evidenceByKey, floorCheck: checkQuoteAgainstFloor }, { now: NOW });
  assert.ok(!res.ready.some((r) => r.key === K_A));
  const nm = res.nearMisses.find((n) => n.key === K_A);
  assert.deepEqual(nm.missing, ["integrity"]);
});

test("EMPTY IS A VALID OUTPUT and names the single commonest gap — never padded", () => {
  const bare = buildConveyor({ intake, artifactsByKey: { [K_A]: {}, [K_B]: {}, [K_C]: {}, [K_PAID]: {} } }, { now: NOW });
  const res = buildAskReadyQueue({ conveyor: bare, floorResult, evidenceByKey: {}, floorCheck: checkQuoteAgainstFloor }, { now: NOW });
  assert.equal(res.empty, true);
  assert.equal(res.ready.length, 0);
  assert.ok(res.statement.startsWith(EMPTY_STATEMENT));
  assert.ok(res.commonestGap, "the one thing to go fix is named");
  assert.equal(res.commonestGap.gate, "engagement");
  assert.equal(res.commonestGap.count, 4);
  assert.equal(topAskReady(res), null);
});

test("NO CONVEYOR AT ALL => honest refusal, never an invented buyer", () => {
  const res = buildAskReadyQueue({}, { now: NOW });
  assert.equal(res.empty, true);
  assert.ok(/invent a buyer/.test(res.refusal));
  assert.equal(res.counts.total, 0);
  assert.equal(topAskReady(res), null);
  assert.equal(topAskReady(null), null);
});

test("nothing sends: flags + markdown carry the law", () => {
  assert.equal(SENT, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(q.sent, false);
  assert.equal(q.nothingSent, true);
  const md = askReadyQueueMarkdown(q);
  assert.ok(/Ask-ready queue/.test(md));
  assert.ok(/Near-misses/.test(md));
  assert.ok(/Never by recency, deal size, or optimism/.test(md));
  assert.ok(/sends, signs, or charges/.test(md));
  assert.equal(askReadyQueueMarkdown(null), "_no ask-ready queue_");
});

test("STATIC-SCAN LOCK: the source has no send/network/exec class at all", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/ask-ready-queue.mjs"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /\bhttps?:\/\//, /nodemailer/, /sendmail/i,
    /child_process/, /\bexec(Sync)?\s*\(/, /\bspawn\s*\(/, /net\.(connect|Socket)/, /\brequest\s*\(/,
    /readFileSync/, /writeFileSync/, /stripe/i, /invoice\s*\(/,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src), `ask-ready-queue.mjs must not contain ${re}`);
  }
});
