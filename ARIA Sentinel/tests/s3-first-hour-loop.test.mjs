// s3-first-hour-loop.test.mjs — RUN-S S3 exit criteria, test-locked.
// The four-module loop runs end to end on real recorded input; conversations-held moves 0->1 from the
// real log; a nothing-hour is recorded as prominently as a good one; hours-spent renders beside
// conversations-held on all three surfaces; the drift lock is extended and still proves independence.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  walkFirstHour, loopRevenueFacts, loopIsMomentumSafe, firstHourMarkdown,
  FIRST_HOUR_LOOP_SCHEMA, STEP_KEYS, NOTHING_HOUR_NOTE, NO_HAND_COUNT_NOTE,
  HAS_TRANSPORT, HAS_SCHEDULER, PERSISTS, SENT,
} from "../src/shared/first-hour-loop.mjs";
import {
  normalizeProgramTruth, factsOf, momentumSafe, ZERO_HOURS_STATEMENT, ZERO_CONVERSATIONS_STATEMENT,
} from "../src/shared/program-truth.mjs";
import { buildOperatorBrief, operatorBriefFacts, operatorBriefMarkdown } from "../src/shared/operator-brief.mjs";
import { buildLedgerHead, ledgerHeadFacts, ledgerHeadIsMomentumSafe } from "../src/shared/ledger-head.mjs";
import { conversationsHeldFrom } from "../src/shared/conversation-outcome.mjs";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const SRC = "src/shared/first-hour-loop.mjs";

const ENTRY = {
  name: "the owner of a two-server accounting practice",
  nameSource: "he introduced himself at the chamber breakfast on 2026-07-20",
  contact: "the address on the card he handed over",
  contactSource: "he handed me a card at that breakfast and I read it off the card",
  problemBasis: "both servers are out of warranty and nobody has patched them since the bookkeeper left",
  problemBasisSource: "he said it in that conversation, unprompted",
};

function outcomeFor(kind) {
  return {
    candidateKey: "cand-001",
    heldAt: "2026-07-28",
    who: "the practice owner",
    said: kind === "could-not-reach"
      ? "nothing - the office line rang out three times and no one called back"
      : "he confirmed the servers are unpatched and asked what it would cost to fix",
    outcome: kind,
    enteredBy: "Ahmad",
  };
}

test("S3: the four steps run END TO END in one pass, on real recorded input", () => {
  const walk = walkFirstHour({
    operator: "Ahmad",
    entry: ENTRY,
    heardFrom: "me",
    outcome: outcomeFor("engaged"),
  }, { now: NOW });

  assert.equal(walk.schema, FIRST_HOUR_LOOP_SCHEMA);
  assert.deepEqual(walk.walked, [...STEP_KEYS], "plan -> enter -> say -> record, all four");
  assert.equal(walk.complete, true);
  assert.equal(walk.candidate.key, "cand-001", "the name was entered through S1, not retyped");
  assert.equal(walk.opening.refused, false, "S2 produced the sentence from the entered basis");
  assert.ok(walk.opening.opening.includes(ENTRY.problemBasis), "and it is the same basis, verbatim");
  assert.equal(walk.outcome.recorded, true, "R2 recorded what happened");
  const md = firstHourMarkdown(walk);
  for (const s of walk.steps) assert.ok(md.includes(s.label));
});

test("S3: conversations held moves 0 -> 1 FROM THE REAL LOG, with no hand-typed count in the path", () => {
  const before = walkFirstHour({ operator: "Ahmad" }, { now: NOW });
  assert.equal(before.conversationsHeld, 0);
  assert.equal(before.hoursSpent, 0);

  const after = walkFirstHour({
    operator: "Ahmad", entry: ENTRY, outcome: outcomeFor("engaged"),
  }, { now: NOW });
  assert.equal(after.conversationsHeld, 1, "one, because one conversation was recorded");
  assert.equal(after.hoursSpent, 1);
  // The number is READ from the log, not accumulated by the loop.
  assert.equal(after.conversationsHeld, conversationsHeldFrom(after.log));
  assert.equal(after.hoursSpent, after.log.count);

  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  assert.ok(!/conversationsHeld\s*[+]{2}|conversationsHeld\s*\+=/.test(body), "nothing increments the count by hand");
  assert.ok(!/hoursSpent\s*[+]{2}|hoursSpent\s*\+=/.test(body), "nor the hours");
});

test("S3: a NOTHING-HOUR is recorded with the same prominence as a good one", () => {
  const nothing = walkFirstHour({
    operator: "Ahmad", entry: ENTRY, outcome: outcomeFor("could-not-reach"),
  }, { now: NOW });

  assert.equal(nothing.complete, true, "the hour was fully walked - it simply reached nobody");
  assert.equal(nothing.nothingHour, true);
  assert.equal(nothing.hoursSpent, 1, "the hour was spent");
  assert.equal(nothing.conversationsHeld, 0, "and no conversation was held - the two do not move together");
  assert.ok(nothing.statement.includes("reached nobody"));
  assert.ok(nothing.statement.includes(NOTHING_HOUR_NOTE), "stated in full, not shortened to an absence");
  assert.ok(nothing.statement.length >= 80, "as many words as a success gets");
  assert.ok(momentumSafe(nothing.statement) && loopIsMomentumSafe(nothing));
});

test("S3: five unreachable hours read as five hours spent and zero conversations held", () => {
  let prior = [];
  for (let i = 0; i < 5; i++) {
    const w = walkFirstHour({
      operator: "Ahmad", pick: { key: "cand-001" }, priorOutcomes: prior, outcome: outcomeFor("could-not-reach"),
    }, { now: NOW });
    prior = [...prior, w.outcome];
  }
  const log = walkFirstHour({ operator: "Ahmad", priorOutcomes: prior }, { now: NOW });
  assert.equal(log.hoursSpent, 5);
  assert.equal(log.conversationsHeld, 0, "an ambiguous absence is now a stated finding");
  assert.deepEqual(loopRevenueFacts(log), { conversationsHeld: 0, hoursSpent: 5 });
});

test("S3: hours spent renders BESIDE conversations held on all three surfaces", () => {
  const raw = {
    program: { series: "CLIENT-READY", sequence: "RUN-S", tasksMerged: 3, tasksTotal: 3, exitCriteriaMet: true },
    tests: { green: 314, total: 314, effectiveGreen: 314, effectiveTotal: 314 },
    mainRef: { value: "40fa4aa4", source: "last-known local tracking ref", liveConfirmed: false },
    unpushed: { commits: 63, headDescribed: "RUN-S line" },
    revenue: { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 0, hoursSpent: 0 },
  };
  const truth = normalizeProgramTruth(raw, { now: NOW });
  const brief = buildOperatorBrief({ truth: raw }, { now: NOW });
  const head = buildLedgerHead(raw, { now: NOW });

  // The head is now TEN lines, and hours-spent is line two — immediately beneath the number it qualifies.
  assert.equal(head.lines.length, 11); // RUN-T T2: eleven lines, deliberately.
  assert.ok(head.lines[0].startsWith("- **Conversations held:**"));
  assert.ok(head.lines[1].startsWith("- **Hours spent:**"), "beside it, not buried below the suite count");

  // Same fact set on all three surfaces, hours included.
  for (const f of [factsOf(truth), operatorBriefFacts(brief), ledgerHeadFacts(head)]) {
    assert.equal(f.conversationsHeld, 0);
    assert.equal(f.hoursSpent, 0);
    assert.equal(f.hoursStatement, ZERO_HOURS_STATEMENT);
  }
  const md = operatorBriefMarkdown(brief);
  assert.ok(md.indexOf("0 conversations held") < md.indexOf("0 hours spent"), "conversations first, hours immediately after");
  assert.ok(head.text.includes("0 hours spent"));
  assert.ok(ledgerHeadIsMomentumSafe(head));
});

test("S3: the drift lock now proves SIX independent numbers, moved one at a time", () => {
  const base = { receivedCad: 0, asksSent: 0, asksStaged: 0, candidates: 0, conversationsHeld: 0, hoursSpent: 0 };
  const keys = Object.keys(base);
  for (const k of keys) {
    const t = normalizeProgramTruth({ revenue: { ...base, [k]: 3 } }, { now: NOW });
    const got = {
      receivedCad: t.revenue.receivedCad, asksSent: t.revenue.asksSent, asksStaged: t.revenue.asksStaged,
      candidates: t.revenue.candidates, conversationsHeld: t.revenue.conversationsHeld, hoursSpent: t.revenue.hoursSpent,
    };
    for (const other of keys) {
      assert.equal(got[other], other === k ? 3 : 0, `moving ${k} must not move ${other}`);
    }
  }
  // Six numbers, six distinct sentences.
  const t = normalizeProgramTruth({ revenue: { receivedCad: 1, asksSent: 2, asksStaged: 3, candidates: 4, conversationsHeld: 5, hoursSpent: 6 } }, { now: NOW });
  const said = [
    t.revenue.conversationsStatement, t.revenue.hoursStatement, t.revenue.candidatesStatement,
    t.revenue.stagedStatement, t.revenue.asksStatement, t.revenue.revenueStatement,
  ];
  assert.equal(new Set(said).size, 6);
  assert.ok(/an hour spent is not a conversation held/.test(t.revenue.hoursStatement));
});

test("S3: zero hours reads as zero, and says why the zero above is not yet evidence about the market", () => {
  assert.ok(ZERO_HOURS_STATEMENT.startsWith("0 hours spent"));
  assert.ok(/not yet evidence about the market/.test(ZERO_HOURS_STATEMENT));
  assert.ok(momentumSafe(ZERO_HOURS_STATEMENT));
  assert.ok(ZERO_CONVERSATIONS_STATEMENT.startsWith("0 conversations held"));
});

test("S3: an incomplete hour counts nothing that did not happen", () => {
  const noOutcome = walkFirstHour({ operator: "Ahmad", entry: ENTRY }, { now: NOW });
  assert.equal(noOutcome.complete, false);
  assert.deepEqual(noOutcome.walked, ["plan", "enter", "say"]);
  assert.equal(noOutcome.hoursSpent, 0, "an hour with no recorded outcome is not an hour spent");
  assert.equal(noOutcome.conversationsHeld, 0);
  assert.ok(/Nothing is counted that did not happen/.test(noOutcome.statement));
});

test("S3: a refused entry stops at the entry — no opening, no outcome, no number moves", () => {
  const walk = walkFirstHour({
    operator: "Ahmad",
    entry: { ...ENTRY, contactSource: "guessed from the company domain" },
  }, { now: NOW });
  assert.equal(walk.submission.refused, true);
  assert.equal(walk.candidate, null);
  assert.equal(walk.opening, null, "no basis reaches S2 because nothing was recorded");
  assert.equal(walk.conversationsHeld, 0);
  assert.equal(walk.hoursSpent, 0);
});

test("S3: the loop sends nothing, schedules nothing and persists nothing", () => {
  const walk = walkFirstHour({ operator: "Ahmad", entry: ENTRY, outcome: outcomeFor("engaged") }, { now: NOW });
  assert.equal(walk.sent, false);
  assert.equal(walk.signed, false);
  assert.equal(walk.charged, false);
  assert.equal(walk.nothingSent, true);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(HAS_SCHEDULER, false);
  assert.equal(PERSISTS, false);
  assert.equal(SENT, false);
  assert.ok(NO_HAND_COUNT_NOTE.includes("read from the recorded outcome log"));

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
