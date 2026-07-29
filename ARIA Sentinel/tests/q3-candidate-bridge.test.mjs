// q3-candidate-bridge.test.mjs — RUN-Q Q3 exit criteria, test-locked.
// The bridge carries a candidate into N1 intake losslessly; it cannot assert a real account;
// `candidates` is a FOURTH distinct number on all three surfaces; zero renders as zero everywhere;
// the drift lock proves the three surfaces agree — about the zero case AND the first-candidate case.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CANDIDATE_BRIDGE_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT,
  CAN_ASSERT_REAL_ACCOUNT, HAS_TRANSPORT, REAL_ACCOUNT_REFUSAL, NO_CANDIDATE_STATEMENT,
  CANDIDATE_CANNOT_SUPPLY, GATE_KEYS,
  bridgeCandidateToIntake, assertRealAccount, candidatesCountFrom, candidateBridgeMarkdown,
} from "../src/shared/candidate-bridge.mjs";
import { recordCandidate, buildCandidateList } from "../src/shared/candidate-record.mjs";
import { scoreCandidate } from "../src/shared/candidate-fit.mjs";
import { buildAccountIntake } from "../src/shared/account-intake.mjs";
import {
  normalizeProgramTruth, factsOf, momentumSafe, ZERO_CANDIDATES_STATEMENT, ZERO_STAGED_STATEMENT,
  ZERO_ASKS_STATEMENT, ZERO_REVENUE_STATEMENT,
} from "../src/shared/program-truth.mjs";
import { buildOperatorBrief, operatorBriefFacts, operatorBriefMarkdown, briefIsMomentumSafe } from "../src/shared/operator-brief.mjs";
import { buildLedgerHead, ledgerHeadFacts, ledgerHeadIsMomentumSafe } from "../src/shared/ledger-head.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const LATER = Date.parse("2026-07-29T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function realCandidate(key = "cand-001") {
  const r = recordCandidate({
    key,
    enteredBy: "Ahmad",
    name: { value: "Northline Logistics", source: "i met their ops manager at the Whitby chamber breakfast on 2026-07-14" },
    contact: { value: "ops@northline.example", source: "printed on the business card he handed me at that breakfast" },
    problemBasis: { value: "their two-person IT team is on call overnight", source: "he said it out loud at that breakfast, unprompted" },
  }, { now: NOW });
  assert.equal(r.refused, false, "fixture setup must record a real candidate");
  return r.candidate;
}

const rawZero = {
  program: { series: "CLIENT-READY", sequence: "RUN-Q", tasksMerged: 3, tasksTotal: 3, exitCriteriaMet: true },
  tests: { green: 308, total: 308, effectiveGreen: 308, effectiveTotal: 308 },
  mainRef: { value: "40fa4aa4", source: "last-known local tracking ref", liveConfirmed: false },
  unpushed: { commits: 44, headDescribed: "RUN-Q line" },
  revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0 },
};

function surfaces(raw) {
  const truth = normalizeProgramTruth(raw, { now: NOW });
  const brief = buildOperatorBrief({ truth: raw }, { now: NOW });
  const head = buildLedgerHead(raw, { now: NOW });
  return { truth, brief, head, axisFacts: factsOf(truth), briefFacts: operatorBriefFacts(brief), headFacts: ledgerHeadFacts(head) };
}

test("Q3: belt-and-braces — the bridge sends nothing and cannot promote anything", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(CAN_ASSERT_REAL_ACCOUNT, false);
  assert.equal(HAS_TRANSPORT, false);
});

test("Q3: the bridge carries every recorded fact AND its provenance across, unchanged", () => {
  const c = realCandidate();
  const b = bridgeCandidateToIntake({ candidate: c }, { now: NOW });
  assert.equal(b.schema, CANDIDATE_BRIDGE_SCHEMA);
  assert.equal(b.bridged, true);
  assert.equal(b.refused, false);
  for (const k of ["name", "contact", "problemBasis"]) {
    assert.equal(b.carried[k].value, c[k].value, `${k} value crosses unchanged`);
    assert.equal(b.carried[k].source, c[k].source, `${k} provenance crosses unchanged`);
  }
  assert.equal(b.carried.enteredBy, c.enteredBy);
  assert.equal(b.carried.recordedAt, c.recordedAt);
  // Nobody retypes anything: the demand signal is built from the candidate's OWN recorded words.
  assert.equal(b.accountInput.demandSignal.source, c.problemBasis.source);
  assert.equal(b.accountInput.demandSignal.email, c.contact.value);
  assert.equal(b.accountInput.demandSignal.company, c.name.value);
  assert.equal(b.accountInput.demandSignal.firstSeenAt, c.recordedAt, "nothing is backdated in transit");
  // The input candidate is not mutated (Rule 15).
  assert.equal(c.realAccount, false);
  assert.equal(Object.prototype.hasOwnProperty.call(c, "bridged"), false);
});

test("Q3: a bridged candidate lands in N1 and N1's OWN gates refuse it — the bridge papers over nothing", () => {
  const b = bridgeCandidateToIntake({ candidate: realCandidate() }, { now: NOW });
  const intake = buildAccountIntake({ account: b.accountInput }, { now: LATER });
  assert.equal(intake.counts.recorded, 1, "the account records end to end without retyping");
  assert.equal(intake.counts.complete, 0, "but it is NOT complete — a candidate is not an account");
  const rec = intake.records[0];
  assert.deepEqual(rec.missing.slice().sort(), CANDIDATE_CANNOT_SUPPLY.map((g) => g.gate).slice().sort(),
    "N1 names exactly the three gates a candidate structurally cannot supply");
  assert.deepEqual(rec.missing.slice().sort(), b.missingGates.slice().sort(),
    "and the bridge said so up front, in the same vocabulary");
  assert.equal(rec.demandSignal.source, b.carried.problemBasis.source, "the provenance survived the crossing");
  assert.deepEqual(rec.engagements, [], "no engagement was invented");
  assert.equal(rec.costBasis, null, "no cost basis was invented");
  assert.equal(rec.quoteCad, null, "no price was invented");
  for (const g of b.missingGates) assert.ok(GATE_KEYS.includes(g), `${g} is one of M1's own gate keys`);
});

test("Q3: the bridge cannot assert a real account — the function exists only to refuse", () => {
  const r = assertRealAccount({ key: "cand-001" });
  assert.equal(r.refused, true);
  assert.equal(r.realAccount, false);
  assert.equal(r.canAssertRealAccount, false);
  assert.equal(r.refusal, REAL_ACCOUNT_REFUSAL);
  assert.ok(r.refusal.includes("asserted by a human"));
  const b = bridgeCandidateToIntake({ candidate: realCandidate() }, { now: NOW });
  assert.equal(b.accountInput.realAccount, false);
  assert.equal(b.canAssertRealAccount, false);
});

test("Q3: an absent, fixture or half-recorded candidate is never bridged", () => {
  for (const bad of [{}, { candidate: null }, { candidate: { key: "cand-9" } },
    { candidate: { ...realCandidate(), contact: { value: "x@y.example" } } }]) {
    const b = bridgeCandidateToIntake(bad, { now: NOW });
    assert.equal(b.bridged, false);
    assert.equal(b.refused, true);
    assert.equal(b.accountInput, null);
    assert.equal(b.carried, null);
    assert.equal(b.refusal, NO_CANDIDATE_STATEMENT);
    assert.deepEqual(b.missingGates.slice().sort(), GATE_KEYS.slice().sort(), "with nothing carried, every gate is open");
  }
  assert.ok(candidateBridgeMarkdown(bridgeCandidateToIntake({}, { now: NOW })).includes(NO_CANDIDATE_STATEMENT));
});

test("Q3: a Q2 score rides along without ever becoming a claim about the account", () => {
  const c = realCandidate();
  const fit = scoreCandidate(c);
  const b = bridgeCandidateToIntake({ candidate: c, fit }, { now: NOW });
  assert.equal(b.carried.fitScore, fit.score);
  assert.equal(b.carried.fitScoreable, fit.scoreable);
  // An unscoreable candidate crosses with a null score stated, never a filled-in one.
  assert.equal(fit.scoreable, false, "this fixture has no size facts, so it is unscoreable");
  assert.equal(b.carried.fitScore, null);
  assert.equal(JSON.stringify(b.accountInput).includes("fitScore"), false,
    "a fit score is never smuggled into what N1 reads as fact");
});

test("Q3: candidates is a FOURTH distinct number, never derived from or merged into the other three", () => {
  const t = normalizeProgramTruth({ revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 7 } }, { now: NOW });
  assert.equal(t.revenue.candidates, 7);
  assert.equal(t.revenue.asksStaged, 0, "seven candidates do not stage one ask");
  assert.equal(t.revenue.asksSent, 0, "seven candidates do not send one ask");
  assert.equal(t.revenue.receivedCad, 0, "seven candidates are not a dollar");
  assert.equal(t.revenue.stagedStatement, ZERO_STAGED_STATEMENT);
  assert.equal(t.revenue.asksStatement, ZERO_ASKS_STATEMENT);
  assert.equal(t.revenue.revenueStatement, ZERO_REVENUE_STATEMENT);
  assert.ok(t.revenue.candidatesStatement.includes("none asked"));
  // Four distinct sentences, no two the same.
  const said = [t.revenue.candidatesStatement, t.revenue.stagedStatement, t.revenue.asksStatement, t.revenue.revenueStatement];
  assert.equal(new Set(said).size, 4, "four numbers, four sentences");
});

test("Q3: zero candidates renders as zero in plain words on all three surfaces", () => {
  const { truth, brief, head, axisFacts, briefFacts, headFacts } = surfaces(rawZero);
  assert.equal(truth.revenue.candidates, 0);
  assert.equal(truth.revenue.candidatesStatement, ZERO_CANDIDATES_STATEMENT);
  assert.ok(ZERO_CANDIDATES_STATEMENT.startsWith("0 candidates recorded"), "zero reads as zero, first");
  for (const f of [axisFacts, briefFacts, headFacts]) {
    assert.equal(f.candidates, 0);
    assert.equal(f.candidatesStatement, ZERO_CANDIDATES_STATEMENT);
  }
  assert.ok(operatorBriefMarkdown(brief).includes(ZERO_CANDIDATES_STATEMENT), "the operator brief says it out loud");
  assert.ok(head.text.includes(ZERO_CANDIDATES_STATEMENT), "the ledger head says it out loud");
  assert.ok(momentumSafe(ZERO_CANDIDATES_STATEMENT), "an empty list may not wear movement language");
  assert.equal(briefIsMomentumSafe(brief), true);
  assert.equal(ledgerHeadIsMomentumSafe(head), true);
});

test("Q3: the drift lock — all three surfaces agree about candidates, at zero AND at one", () => {
  const zero = surfaces(rawZero);
  assert.deepEqual(zero.briefFacts, zero.axisFacts, "brief may not drift from the AXIS facts");
  assert.deepEqual(zero.headFacts, zero.axisFacts, "ledger head may not drift from the AXIS facts");

  // The honest inverse: when the FIRST candidate is recorded, all three move together — and asks
  // staged, asks sent and revenue do NOT quietly move with it.
  const one = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 1 } });
  assert.deepEqual(one.briefFacts, one.axisFacts);
  assert.deepEqual(one.headFacts, one.axisFacts);
  for (const f of [one.axisFacts, one.briefFacts, one.headFacts]) {
    assert.equal(f.candidates, 1);
    assert.notEqual(f.candidatesStatement, ZERO_CANDIDATES_STATEMENT);
    assert.equal(f.asksStaged, 0);
    assert.equal(f.asksSent, 0);
    assert.equal(f.revenueReceivedCad, 0);
    assert.equal(f.stagedStatement, ZERO_STAGED_STATEMENT);
    assert.equal(f.asksStatement, ZERO_ASKS_STATEMENT);
    assert.equal(f.revenueStatement, ZERO_REVENUE_STATEMENT);
  }
  assert.ok(momentumSafe(one.axisFacts.candidatesStatement));
});

test("Q3: the count comes from the Q1 list, never typed by hand on a surface", () => {
  assert.equal(candidatesCountFrom(buildCandidateList([], { now: NOW })), 0);
  assert.equal(candidatesCountFrom(buildCandidateList([realCandidate("cand-001"), realCandidate("cand-002")], { now: NOW })), 2);
  assert.equal(candidatesCountFrom(null), 0, "an absent list counts zero, never unknown-as-something");
  assert.equal(candidatesCountFrom({ schema: "not-a-candidate-list", count: 99 }), 0, "a foreign shape counts zero");
});

test("Q3: static-scan — no transport, no persistence, and no path that promotes a candidate", () => {
  const bad = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/,
    /node:fs/, /node:net/, /node:http/, /process\.env/, /setInterval\s*\(/, /setTimeout\s*\(/,
    /writeFileSync/, /localStorage/,
  ];
  for (const mod of ["candidate-bridge.mjs", "candidate-record.mjs", "candidate-fit.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
    assert.ok(!/\brealAccount\s*[:=]\s*true/.test(src), `${mod} must contain no path that asserts a real account`);
    assert.ok(!/\bsent\s*[:=]\s*true/.test(src), `${mod} must contain no path that sets sent true`);
    assert.ok(!/\bcharged\s*[:=]\s*true/.test(src), `${mod} must contain no path that sets charged true`);
    assert.ok(!/\bsigned\s*[:=]\s*true/.test(src), `${mod} must contain no path that sets signed true`);
  }
});
