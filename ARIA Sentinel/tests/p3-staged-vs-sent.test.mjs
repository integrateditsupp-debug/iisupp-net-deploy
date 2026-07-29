// p3-staged-vs-sent.test.mjs — RUN-P P3 exit criteria, test-locked.
// "Asks staged" and "asks sent" are separate numbers on every surface — AXIS spoken status, operator
// brief, ledger head. Zero renders as zero everywhere. The lock proves both the zero case and the
// first-sent case: when the first ask IS sent, all three surfaces change together or this goes red.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  normalizeProgramTruth, factsOf, momentumSafe,
  ZERO_ASKS_STATEMENT, ZERO_REVENUE_STATEMENT, ZERO_STAGED_STATEMENT,
} from "../src/shared/program-truth.mjs";
import { buildOperatorBrief, operatorBriefFacts, operatorBriefMarkdown, briefIsMomentumSafe } from "../src/shared/operator-brief.mjs";
import { buildLedgerHead, ledgerHeadFacts, ledgerHeadIsMomentumSafe } from "../src/shared/ledger-head.mjs";
import { ZERO_SENT_STATEMENT } from "../src/shared/ask-ledger.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawZero = {
  program: { series: "CLIENT-READY", sequence: "RUN-P", tasksMerged: 3, tasksTotal: 3, exitCriteriaMet: true },
  tests: { green: 305, total: 305, effectiveGreen: 305, effectiveTotal: 305 },
  mainRef: { value: "40fa4aa4", source: "last-known local tracking ref", liveConfirmed: false },
  unpushed: { commits: 41, headDescribed: "RUN-P line" },
  revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0 },
};

function surfaces(raw) {
  const truth = normalizeProgramTruth(raw, { now: NOW });
  const brief = buildOperatorBrief({ truth: raw }, { now: NOW });
  const head = buildLedgerHead(raw, { now: NOW });
  return { truth, brief, head, axisFacts: factsOf(truth), briefFacts: operatorBriefFacts(brief), headFacts: ledgerHeadFacts(head) };
}

test("P3: staged and sent are separate fields, and staged is never derived from sent", () => {
  const t = normalizeProgramTruth({ revenue: { asksSent: 0, asksStaged: 4 } }, { now: NOW });
  assert.equal(t.revenue.asksSent, 0);
  assert.equal(t.revenue.asksStaged, 4);
  assert.notEqual(t.revenue.stagedStatement, t.revenue.asksStatement);
  assert.ok(t.revenue.stagedStatement.includes("staged is not sent"));
  assert.equal(t.revenue.asksStatement, ZERO_ASKS_STATEMENT, "four staged does not make one sent");
});

test("P3: zero staged and zero sent each render as zero, in their own words", () => {
  const { truth } = surfaces(rawZero);
  assert.equal(truth.revenue.asksStaged, 0);
  assert.equal(truth.revenue.stagedStatement, ZERO_STAGED_STATEMENT);
  assert.equal(truth.revenue.asksStatement, ZERO_ASKS_STATEMENT);
  assert.equal(truth.revenue.asksStatement, ZERO_SENT_STATEMENT, "sent-zero is M3's sentence verbatim");
  assert.equal(truth.revenue.revenueStatement, ZERO_REVENUE_STATEMENT);
});

test("P3: all three surfaces agree on the fact set, staged and sent included", () => {
  const s = surfaces(rawZero);
  assert.equal(s.axisFacts.asksStaged, 0);
  assert.equal(s.axisFacts.asksSent, 0);
  assert.ok("stagedStatement" in s.axisFacts);
  assert.deepEqual(s.briefFacts, s.axisFacts);
  assert.deepEqual(s.headFacts, s.axisFacts);
  assert.deepEqual(s.headFacts, s.briefFacts);
});

test("P3: the ledger head carries staged and sent as two distinct lines", () => {
  const { head } = surfaces(rawZero);
  // RUN-Q Q3 added a fourth revenue number (candidates), RUN-R R3 added a fifth (conversations held,
  // stated FIRST because it is the constraint) and RUN-S S3 added a sixth (hours spent, stated
  // immediately beside it because a zero above with no hours beneath it is ambiguous), so the head is
  // TEN lines. The count is asserted explicitly rather than loosely, so an eleventh line has to be a
  // deliberate decision made in this file rather than something that drifts in unnoticed.
  assert.equal(head.lines.length, 11); // RUN-T T2: eleven lines, deliberately.
  assert.ok(head.lines[1].startsWith("- **Hours spent:**"), "hours spent has its own line, immediately beneath the number it qualifies");
  assert.ok(head.lines.some((l) => l.includes("Candidates recorded")), "candidates has its own line");
  assert.ok(head.lines.some((l) => l.startsWith("- **Conversations held:**")), "conversations held has its own line");
  assert.ok(head.lines[0].startsWith("- **Conversations held:**"), "conversations held is stated FIRST - before the sequence and before the suite");
  const stagedLine = head.lines.find((l) => l.includes("Asks staged"));
  const sentLine = head.lines.find((l) => l.startsWith("- **Asks sent:**"));
  assert.ok(stagedLine, "the head has a staged line");
  assert.ok(sentLine, "the head has a sent line");
  assert.notEqual(stagedLine, sentLine);
  assert.ok(stagedLine.includes(ZERO_STAGED_STATEMENT));
  assert.ok(sentLine.includes(ZERO_ASKS_STATEMENT));
});

test("P3: the operator brief carries staged and sent as two distinct lines", () => {
  const { brief } = surfaces(rawZero);
  assert.equal(brief.stagedStatement, ZERO_STAGED_STATEMENT);
  assert.equal(brief.asksStatement, ZERO_ASKS_STATEMENT);
  assert.notEqual(brief.stagedStatement, brief.asksStatement);
  const md = operatorBriefMarkdown(brief);
  assert.ok(md.includes(ZERO_STAGED_STATEMENT));
  assert.ok(md.includes(ZERO_ASKS_STATEMENT));
});

test("P3: a staged ask cannot be counted, phrased, or rounded into a sent one", () => {
  const s = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 7 } });
  // Counted:
  assert.equal(s.axisFacts.asksSent, 0);
  assert.equal(s.axisFacts.asksStaged, 7);
  // Phrased: the sent sentence is still M3's zero sentence, unchanged by seven staged.
  assert.equal(s.truth.revenue.asksStatement, ZERO_SENT_STATEMENT);
  // Rendered on every surface without a sent claim anywhere.
  const head = s.head.text;
  const brief = operatorBriefMarkdown(s.brief);
  for (const text of [head, brief]) {
    assert.ok(text.includes("7 ask(s) staged and not sent"));
    assert.ok(text.includes(ZERO_SENT_STATEMENT), "sent still reads zero beside seven staged");
    assert.ok(!/7 ask\(s\) sent/.test(text));
  }
});

test("P3: no surface wears momentum language over a zero series, staged or not", () => {
  for (const raw of [rawZero, { ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 7 } }]) {
    const s = surfaces(raw);
    assert.ok(momentumSafe(s.head.text));
    assert.ok(ledgerHeadIsMomentumSafe(s.head));
    assert.ok(briefIsMomentumSafe(s.brief));
    assert.ok(momentumSafe(s.truth.revenue.stagedStatement));
  }
});

test("P3: THE HONEST INVERSE — when the first ask is sent, all three surfaces change together", () => {
  const before = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 1 } });
  const after = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 1, asksStaged: 1 } });

  // Every surface moved off zero-sent, and moved identically.
  assert.equal(before.axisFacts.asksSent, 0);
  assert.equal(after.axisFacts.asksSent, 1);
  assert.deepEqual(after.briefFacts, after.axisFacts);
  assert.deepEqual(after.headFacts, after.axisFacts);
  assert.notDeepEqual(after.axisFacts, before.axisFacts);

  assert.equal(after.truth.revenue.asksStatement, "1 ask(s) sent.");
  assert.ok(after.head.text.includes("1 ask(s) sent."));
  assert.ok(operatorBriefMarkdown(after.brief).includes("1 ask(s) sent."));
  // And no surface quietly upgrades revenue along with it.
  assert.equal(after.truth.revenue.revenueStatement, ZERO_REVENUE_STATEMENT);
  // Staged does not decrement itself into sent — they are independent observations.
  assert.equal(after.axisFacts.asksStaged, 1);
});

test("P3: a surface that renders only one of the two numbers is a drift, and drift is red", () => {
  const s = surfaces(rawZero);
  const mutilated = { ...s.axisFacts };
  delete mutilated.stagedStatement;
  assert.notDeepEqual(s.briefFacts, mutilated,
    "a surface dropping the staged sentence must not deep-equal the others");
  const withStaged = surfaces({ ...rawZero, revenue: { receivedCad: 0, asksSent: 0, asksStaged: 7 } });
  const foldedIn = { ...withStaged.axisFacts, asksSent: withStaged.axisFacts.asksStaged };
  assert.notDeepEqual(withStaged.headFacts, foldedIn,
    "folding staged into sent must not deep-equal the others");
});

test("P3: static-scan — the truth surfaces stay pure (no fs, net or spawn)", () => {
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /child_process/, /\bspawn\s*\(/, /node:fs/, /node:net/, /node:http/, /process\.env/];
  for (const mod of ["program-truth.mjs", "ledger-head.mjs", "operator-brief.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});
