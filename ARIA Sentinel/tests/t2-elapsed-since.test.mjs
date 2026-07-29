// t2-elapsed-since.test.mjs — RUN-T T2 exit criteria, test-locked.
// The counter reads from real logs; `never` is distinct from zero on all three surfaces; the ratio
// renders in plain words; a test proves software progress cannot move it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildElapsed, elapsedSince, elapsedFacts, elapsedMarkdown, elapsedIsMomentumSafe,
  ELAPSED_SINCE_SCHEMA, NEVER, TRACKED_EVENTS, TRACKED_EVENT_KEYS,
  NEVER_VS_ZERO_NOTE, IMMUNITY_NOTE, NOT_A_SCOLD_NOTE,
  SENT, HAS_TRANSPORT, PERSISTS,
} from "../src/shared/elapsed-since.mjs";
import {
  normalizeProgramTruth, factsOf, NEVER as TRUTH_NEVER, NEVER_STATEMENT,
} from "../src/shared/program-truth.mjs";
import { buildOperatorBrief, operatorBriefFacts, operatorBriefMarkdown } from "../src/shared/operator-brief.mjs";
import { buildLedgerHead, ledgerHeadFacts } from "../src/shared/ledger-head.mjs";
import { recordOutcome, buildOutcomeLog } from "../src/shared/conversation-outcome.mjs";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const SRC = "src/shared/elapsed-since.mjs";

function realOutcome(heldAt, outcome = "engaged") {
  return recordOutcome({
    candidateKey: "cand-001",
    heldAt,
    who: "the practice owner",
    said: "he confirmed the servers are unpatched and asked what it would cost to fix",
    outcome,
    enteredBy: "Ahmad",
  }, { now: NOW });
}

test("T2: with nothing recorded, all three counters read `never` - not 0", () => {
  const e = buildElapsed({}, { now: NOW });
  assert.equal(e.schema, ELAPSED_SINCE_SCHEMA);
  assert.equal(e.neverCount, TRACKED_EVENTS.length);

  for (const key of TRACKED_EVENT_KEYS) {
    assert.equal(e.counters[key].never, true, `${key} has never happened`);
    assert.equal(e.counters[key].days, NEVER, `${key} reads the string "never", not 0`);
    assert.notEqual(e.counters[key].days, 0, `${key} is NOT a zero`);
    assert.equal(e.counters[key].lastAt, null, "and no timestamp was invented for it");
  }

  const md = elapsedMarkdown(e);
  assert.ok(md.includes("NEVER"), "the rendered surface shouts never");
  // No COUNTER line claims a day count. (The explanatory note mentions "0 days" on purpose — that is
  // the sentence explaining the distinction, not a counter reporting one.)
  for (const l of e.lines) {
    assert.ok(!/\b\d+ day/.test(l.statement), `the ${l.key} line reports no day count for an empty history`);
  }
});

test("T2: `0 days` and `never` are DIFFERENT facts, rendered differently", () => {
  const today = buildElapsed({
    hourLog: [{ spentAt: "2026-07-28T09:00:00Z" }],
  }, { now: NOW });

  assert.equal(today.counters.hourSpent.never, false);
  assert.equal(today.counters.hourSpent.days, 0, "spent today = 0 days");
  assert.ok(today.lines.find((l) => l.key === "hourSpent").statement.includes("TODAY"));
  assert.ok(
    today.lines.find((l) => l.key === "hourSpent").statement.includes("not the same fact as never"),
    "the 0-day line says out loud that it is not a never",
  );

  // The one that never happened, in the same object, still reads never.
  assert.equal(today.counters.conversationHeld.days, NEVER);
  assert.notEqual(today.counters.hourSpent.days, today.counters.conversationHeld.days);
  assert.ok(NEVER_VS_ZERO_NOTE.includes("different facts"));
});

test("T2: every counter reads a REAL log - dates come from records, never from `now`", () => {
  const e = buildElapsed({
    hourLog: [{ spentAt: "2026-07-21T09:00:00Z" }, { spentAt: "2026-07-14T09:00:00Z" }],
    outcomes: [realOutcome("2026-07-18"), realOutcome("2026-07-11")],
    candidateList: [{ recordedAt: "2026-07-27T10:00:00Z" }],
  }, { now: NOW });

  assert.equal(e.counters.hourSpent.days, 7, "reads the LATEST hour, not the first");
  assert.equal(e.counters.conversationHeld.days, 10, "reads the latest real heldAt from R2's record");
  assert.equal(e.counters.candidateRecorded.days, 1);
  assert.equal(e.neverCount, 0);

  // A record with no usable date contributes nothing rather than defaulting to now.
  const junk = buildElapsed({ hourLog: [{ spentAt: "sometime last week" }] }, { now: NOW });
  assert.equal(junk.counters.hourSpent.days, NEVER, "an unparseable date is not a recent date");
});

test("T2: SHIPPING SOFTWARE CANNOT MOVE THE COUNTERS", () => {
  const logs = {
    hourLog: [{ spentAt: "2026-07-21T09:00:00Z" }],
    outcomes: [realOutcome("2026-07-18")],
    candidateList: [{ recordedAt: "2026-07-27T10:00:00Z" }],
  };

  const before = buildElapsed({ ...logs, sequencesShipped: 19 }, { now: NOW });

  // Ship a sequence, add suites, add commits, merge a branch. Everything a green cycle produces.
  const after = buildElapsed({
    ...logs,
    sequencesShipped: 20,
    suitesGreen: 400,
    commits: 999,
    merged: true,
    tasksMerged: 3,
    tasksTotal: 3,
    exitCriteriaMet: true,
  }, { now: NOW });

  assert.deepEqual(after.counters, before.counters, "not one counter moved");
  assert.deepEqual(
    { ...elapsedFacts(after), ratioStatement: null },
    { ...elapsedFacts(before), ratioStatement: null },
    "and no elapsed fact moved either",
  );
  // The ratio - and ONLY the ratio - notices the new sequence.
  assert.notEqual(after.ratio.statement, before.ratio.statement);
  assert.ok(after.ratio.statement.includes("20 sequence(s) shipped"));
  assert.ok(IMMUNITY_NOTE.includes("structurally incapable"));

  // Belt and braces: the module never READS any of them off the input. (The immunity note names them
  // in prose on purpose — naming what cannot move the counter is the point of the note.)
  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const bad of ["suitesGreen", "commits", "merged", "tasksMerged", "tasksTotal", "exitCriteriaMet", "testsGreen"]) {
    assert.ok(!body.includes(`src.${bad}`), `the counter path never reads src.${bad}`);
    assert.ok(!body.includes(`.${bad}`) || bad === "merged", `no property read of ${bad}`);
  }
});

test("T2: the ratio is a plain number with no interpretation attached", () => {
  const e = buildElapsed({ sequencesShipped: 19 }, { now: NOW });
  assert.equal(e.ratio.sequencesShipped, 19);
  assert.equal(e.ratio.hoursSpent, 0);
  assert.equal(e.ratio.conversationsHeld, 0);
  assert.ok(e.ratio.statement.includes("19 sequence(s) shipped"));
  assert.ok(e.ratio.statement.includes("0 hour(s) spent"));
  assert.ok(e.ratio.statement.includes("0 conversation(s) held"));

  // Not a scold: no imperative, no target, no encouragement.
  const lowered = e.ratio.statement.toLowerCase();
  for (const bad of ["should", "must", "need to", "target", "goal", "keep going", "you can", "let's"]) {
    assert.ok(!lowered.includes(bad), `the ratio does not say "${bad}"`);
  }
  assert.ok(NOT_A_SCOLD_NOTE.includes("no interpretation attached"));

  // An unknown sequence count says so rather than inventing one to make the sentence scan.
  const unknown = buildElapsed({}, { now: NOW });
  assert.equal(unknown.ratio.sequencesShipped, null);
  assert.ok(unknown.ratio.statement.includes("not stated"));
});

test("T2: conversations held comes from R2's own log, never re-implemented here", () => {
  const held = realOutcome("2026-07-18", "engaged");
  const missed = realOutcome("2026-07-19", "could-not-reach");
  const log = buildOutcomeLog([held, missed], { now: NOW });

  const e = buildElapsed({ outcomeLog: log, outcomes: [held, missed] }, { now: NOW });
  assert.equal(e.ratio.conversationsHeld, log.conversationsHeld, "R2's number, verbatim");
  assert.equal(e.ratio.conversationsHeld, 1, "the unreachable hour is not a conversation");
  // ...but it IS an hour, and the elapsed counter sees its date.
  assert.equal(e.counters.conversationHeld.days, 9, "the latest recorded attempt dates the counter");
});

test("T2: `never` survives onto all THREE surfaces, and never as a zero", () => {
  const raw = {
    program: { series: "RUN", sequence: "RUN-T", tasksMerged: 3, tasksTotal: 3 },
    tests: { green: 317, total: 317 },
    revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 0, hoursSpent: 0 },
    // Deliberately absent: nothing has ever happened.
    elapsed: {},
  };

  const truth = normalizeProgramTruth(raw, { now: NOW });
  assert.equal(truth.elapsed.daysSinceHourSpent, TRUTH_NEVER);
  assert.equal(truth.elapsed.neverCount, 3);
  assert.ok(truth.elapsed.hourStatement.includes("NEVER"));
  assert.ok(NEVER_STATEMENT.includes("different facts"));

  const brief = buildOperatorBrief({ truth: raw }, { now: NOW });
  const head = buildLedgerHead(raw, { now: NOW });

  // Surface 1 (AXIS/program truth), surface 2 (operator brief), surface 3 (ledger head) - one fact set.
  assert.deepEqual(operatorBriefFacts(brief), factsOf(truth), "brief agrees with truth");
  assert.deepEqual(ledgerHeadFacts(head), factsOf(truth), "ledger head agrees with truth");
  assert.equal(factsOf(truth).daysSinceHourSpent, TRUTH_NEVER);

  // And each one RENDERS it as never, not as 0.
  const briefMd = operatorBriefMarkdown(brief);
  assert.ok(briefMd.includes("NEVER"), "operator brief renders never");
  assert.ok(head.text.includes("NEVER"), "ledger head renders never");
  assert.ok(head.lines.some((l) => l.includes("How long since an hour was spent")));

  // A REAL zero-day is rendered as a zero-day, on the same surfaces, and is not confused with never.
  const today = normalizeProgramTruth({ ...raw, elapsed: { daysSinceHourSpent: 0 } }, { now: NOW });
  assert.equal(today.elapsed.daysSinceHourSpent, 0);
  assert.ok(today.elapsed.hourStatement.includes("0 days"));
  assert.ok(today.elapsed.hourStatement.includes("not the same fact as never"));
  assert.equal(today.elapsed.neverCount, 2, "the other two are still never");
});

test("T2: a future timestamp clamps to 0 and says it clamped, rather than going negative", () => {
  const c = elapsedSince("2026-07-30T12:00:00Z", { now: NOW });
  assert.equal(c.days, 0);
  assert.equal(c.clamped, true);
  assert.equal(c.never, false);
});

test("T2: the module sends nothing, persists nothing and wears no momentum language", () => {
  const e = buildElapsed({}, { now: NOW });
  assert.equal(e.sent, false);
  assert.equal(e.signed, false);
  assert.equal(e.charged, false);
  assert.equal(e.nothingSent, true);
  assert.equal(SENT, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(PERSISTS, false);
  assert.equal(elapsedIsMomentumSafe(e), true);
  assert.equal(elapsedMarkdown(null), "_no elapsed counter_");
  assert.equal(elapsedFacts(null), null);

  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const bad of [
    "node:fs", "writeFile", "readFile", "node:http", "fetch(", "XMLHttpRequest",
    "node:child_process", "spawn(", "execSync", "execFile", "process.env",
    "setInterval", "cron", "nodemailer", "sendMail", "smtp",
  ]) {
    assert.ok(!body.includes(bad), `no ${bad} in ${SRC}`);
  }
});
