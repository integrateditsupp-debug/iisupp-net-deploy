// r3-conversations-held.test.mjs — RUN-R R3 exit criteria, test-locked.
// conversations-held is a FIFTH distinct number on all three surfaces and is stated FIRST; zero
// renders as zero; the drift lock proves five independent numbers.
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProgramTruth, factsOf, momentumSafe,
  ZERO_CONVERSATIONS_STATEMENT, ZERO_CANDIDATES_STATEMENT, ZERO_STAGED_STATEMENT,
  ZERO_ASKS_STATEMENT, ZERO_REVENUE_STATEMENT,
} from "../src/shared/program-truth.mjs";
import { buildOperatorBrief, operatorBriefFacts, operatorBriefMarkdown, briefIsMomentumSafe } from "../src/shared/operator-brief.mjs";
import { buildLedgerHead, ledgerHeadFacts, ledgerHeadIsMomentumSafe } from "../src/shared/ledger-head.mjs";
import { recordOutcome, buildOutcomeLog, conversationsHeldFrom } from "../src/shared/conversation-outcome.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");

const rawZero = {
  program: { series: "CLIENT-READY", sequence: "RUN-R", tasksMerged: 3, tasksTotal: 3, exitCriteriaMet: true },
  tests: { green: 311, total: 311, effectiveGreen: 311, effectiveTotal: 311 },
  mainRef: { value: "40fa4aa4", source: "last-known local tracking ref", liveConfirmed: false },
  unpushed: { commits: 61, headDescribed: "RUN-R line" },
  revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 0 },
};

function surfaces(raw) {
  const truth = normalizeProgramTruth(raw, { now: NOW });
  const brief = buildOperatorBrief({ truth: raw }, { now: NOW });
  const head = buildLedgerHead(raw, { now: NOW });
  return {
    truth, brief, head,
    axisFacts: factsOf(truth), briefFacts: operatorBriefFacts(brief), headFacts: ledgerHeadFacts(head),
  };
}

test("R3: conversations held is a FIFTH distinct number, never merged into the other four", () => {
  const t = normalizeProgramTruth({ revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 7, conversationsHeld: 4 } }, { now: NOW });
  assert.equal(t.revenue.conversationsHeld, 4);
  assert.equal(t.revenue.candidates, 7, "four conversations do not record a candidate");
  assert.equal(t.revenue.asksStaged, 0, "four conversations do not stage an ask");
  assert.equal(t.revenue.asksSent, 0, "four conversations do not send an ask");
  assert.equal(t.revenue.receivedCad, 0, "four conversations are not a dollar");
  // Five separate sentences, no two the same.
  const said = [
    t.revenue.conversationsStatement, t.revenue.candidatesStatement,
    t.revenue.stagedStatement, t.revenue.asksStatement, t.revenue.revenueStatement,
  ];
  assert.equal(new Set(said).size, 5, "five numbers, five sentences");
  assert.ok(/being in front of someone is not asking them/.test(t.revenue.conversationsStatement));
});

test("R3: it is STATED FIRST — before the sequence and before the suite", () => {
  const s = surfaces(rawZero);
  // Ledger head: the very first line.
  // RUN-S S3 added hours spent as line two, so the head is TEN lines. Asserted by name and by index
  // so a further line stays a deliberate decision made in this file rather than drift.
  assert.equal(s.head.lines.length, 11); // RUN-T T2: eleven lines, deliberately.
  assert.ok(s.head.lines[1].startsWith("- **Hours spent:**"), "hours spent sits immediately beneath it");
  assert.ok(s.head.lines[0].startsWith("- **Conversations held:**"), "first line of the head");
  const idxConv = s.head.lines.findIndex((l) => l.startsWith("- **Conversations held:**"));
  const idxSeq = s.head.lines.findIndex((l) => l.startsWith("- **Sequence:**"));
  const idxTests = s.head.lines.findIndex((l) => l.startsWith("- **Tests:**"));
  assert.ok(idxConv < idxSeq && idxConv < idxTests, "before the sequence count and before the suite count");
  // Program-truth facts: first key, so a surface reading the fact set in order reads it first.
  assert.equal(Object.keys(s.axisFacts)[0], "conversationsHeld");
  // Operator brief markdown: the conversations line precedes the candidates line.
  const md = operatorBriefMarkdown(s.brief);
  assert.ok(md.indexOf("0 conversations held") >= 0);
  assert.ok(md.indexOf("0 conversations held") < md.indexOf("0 candidates recorded"), "stated before candidates");
});

test("R3: zero renders as zero in plain words on all three surfaces", () => {
  const s = surfaces(rawZero);
  for (const f of [s.axisFacts, s.briefFacts, s.headFacts]) {
    assert.equal(f.conversationsHeld, 0);
    assert.equal(f.conversationsStatement, ZERO_CONVERSATIONS_STATEMENT);
  }
  assert.ok(ZERO_CONVERSATIONS_STATEMENT.startsWith("0 conversations held"), "zero reads as zero, first");
  assert.ok(/not a slow start, not early days, zero/.test(ZERO_CONVERSATIONS_STATEMENT));
  assert.ok(/a fact about us, not about the market/.test(ZERO_CONVERSATIONS_STATEMENT),
    "the surfaces say plainly whose fact the zero is");
  assert.ok(s.head.text.includes("0 conversations held"));
  assert.ok(operatorBriefMarkdown(s.brief).includes("0 conversations held"));
});

test("R3: the drift lock — all three surfaces agree, at zero AND at one", () => {
  const zero = surfaces(rawZero);
  assert.deepEqual(zero.briefFacts, zero.axisFacts, "brief agrees with AXIS at zero");
  assert.deepEqual(zero.headFacts, zero.axisFacts, "ledger head agrees with AXIS at zero");

  const one = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 1 } });
  assert.deepEqual(one.briefFacts, one.axisFacts, "brief agrees with AXIS at one");
  assert.deepEqual(one.headFacts, one.axisFacts, "ledger head agrees with AXIS at one");
  for (const f of [one.axisFacts, one.briefFacts, one.headFacts]) {
    assert.equal(f.conversationsHeld, 1);
    assert.notEqual(f.conversationsStatement, ZERO_CONVERSATIONS_STATEMENT);
    // The other four did NOT move with it.
    assert.equal(f.candidates, 0);
    assert.equal(f.asksStaged, 0);
    assert.equal(f.asksSent, 0);
    assert.equal(f.revenueReceivedCad, 0);
    assert.equal(f.candidatesStatement, ZERO_CANDIDATES_STATEMENT);
    assert.equal(f.stagedStatement, ZERO_STAGED_STATEMENT);
    assert.equal(f.asksStatement, ZERO_ASKS_STATEMENT);
    assert.equal(f.revenueStatement, ZERO_REVENUE_STATEMENT);
  }
});

test("R3: the drift lock proves FIVE independent numbers, one at a time", () => {
  const base = { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 0 };
  const keys = ["conversationsHeld", "candidates", "asksStaged", "asksSent", "receivedCad"];
  for (const moved of keys) {
    const f = factsOf(normalizeProgramTruth({ ...rawZero, revenue: { ...base, [moved]: 3 } }, { now: NOW }));
    const read = {
      conversationsHeld: f.conversationsHeld, candidates: f.candidates,
      asksStaged: f.asksStaged, asksSent: f.asksSent, receivedCad: f.revenueReceivedCad,
    };
    for (const k of keys) {
      assert.equal(read[k], k === moved ? 3 : 0, `moving ${moved} must not move ${k}`);
    }
  }
});

test("R3: no momentum vocabulary over a zero series, on any surface", () => {
  const s = surfaces(rawZero);
  assert.equal(momentumSafe(s.truth.revenue.conversationsStatement), true);
  assert.equal(momentumSafe(ZERO_CONVERSATIONS_STATEMENT), true);
  assert.equal(ledgerHeadIsMomentumSafe(s.head), true);
  assert.equal(briefIsMomentumSafe(s.brief), true);
  const one = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 1 } });
  assert.equal(momentumSafe(one.axisFacts.conversationsStatement), true);
  assert.equal(ledgerHeadIsMomentumSafe(one.head), true);
});

test("R3: the number the surfaces show comes from R2's real log, not from a hand-typed count", () => {
  const base = { candidateKey: "cand-001", heldAt: "2026-07-28", who: "their ops manager", enteredBy: "Ahmad",
    said: "he said the overnight on-call is the thing that makes people quit" };
  const log = buildOutcomeLog([
    recordOutcome({ ...base, outcome: "engaged" }, { now: NOW }),
    recordOutcome({ ...base, outcome: "no" }, { now: NOW }),
    recordOutcome({ ...base, outcome: "could-not-reach" }, { now: NOW }),
  ], { now: NOW });
  const held = conversationsHeldFrom(log);
  assert.equal(held, 2, "an hour that reached nobody is an hour spent, not a conversation held");

  const s = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: held } });
  for (const f of [s.axisFacts, s.briefFacts, s.headFacts]) assert.equal(f.conversationsHeld, 2);
  // And an empty log puts a real zero on the surfaces, not an unknown.
  const emptyHeld = conversationsHeldFrom(buildOutcomeLog([], { now: NOW }));
  const z = surfaces({ ...rawZero, revenue: { ...rawZero.revenue, conversationsHeld: emptyHeld } });
  assert.equal(z.axisFacts.conversationsHeld, 0);
  assert.equal(z.axisFacts.conversationsStatement, ZERO_CONVERSATIONS_STATEMENT);
});

test("R3: an absent or junk count is zero, and is never defaulted into something flattering", () => {
  for (const bad of [undefined, null, "seven", -4, NaN, {}, []]) {
    const t = normalizeProgramTruth({ revenue: { conversationsHeld: bad } }, { now: NOW });
    assert.equal(t.revenue.conversationsHeld, 0, `${JSON.stringify(bad)} counts zero`);
    assert.equal(t.revenue.conversationsStatement, ZERO_CONVERSATIONS_STATEMENT);
  }
});
