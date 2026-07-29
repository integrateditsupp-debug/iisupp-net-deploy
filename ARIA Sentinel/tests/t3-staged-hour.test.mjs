// t3-staged-hour.test.mjs — RUN-T T3 exit criteria, test-locked.
// The staged hour renders from a real plan; static scan proves no calendar write, no transport and no
// scheduler; the record path closes the loop back into R2; an unwalked hour is recorded as unwalked and
// is never silently rolled over.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  stageHour, walkStagedHour, recordUnwalkedHour, stagedHourMarkdown, stagedHourIsMomentumSafe,
  STAGED_HOUR_SCHEMA, HOUR_STATE_KEYS, STAGED_NOT_SCHEDULED, NO_ROLLOVER_NOTE, ONE_DECISION_NOTE,
  SENT, HAS_TRANSPORT, HAS_SCHEDULER, WRITES_CALENDAR, PERSISTS, ROLLS_OVER, UNKNOWN,
} from "../src/shared/staged-hour.mjs";
import { buildHourPlan, HOUR_PLAN_SCHEMA } from "../src/shared/hour-plan.mjs";
import { recordCandidate } from "../src/shared/candidate-record.mjs";
import { buildOpening } from "../src/shared/honest-opening.mjs";
import { CONVERSATION_OUTCOME_SCHEMA } from "../src/shared/conversation-outcome.mjs";
import { buildElapsed, NEVER } from "../src/shared/elapsed-since.mjs";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const SRC = "src/shared/staged-hour.mjs";

const PLAN = buildHourPlan({}, { now: NOW });

const RECORD = recordCandidate({
  key: "cand-001",
  enteredBy: "Ahmad",
  name: { value: "Northline Logistics", source: "i met their ops manager at the Whitby chamber breakfast on 2026-07-14" },
  contact: { value: "ops@northline.example", source: "printed on the business card he handed me at that breakfast" },
  problemBasis: {
    value: "their two-person IT team is on call overnight",
    source: "he said it out loud at that breakfast, unprompted",
  },
}, { now: NOW });
// Guard the fixture itself: a test built on a refused record proves nothing.
if (RECORD.recorded !== true) throw new Error("T3 fixture: Q1 refused the candidate — fix the fixture, not the assertion");
const CANDIDATE = RECORD.candidate;

function outcomeInput(kind) {
  return {
    heldAt: "2026-07-28",
    who: "the practice owner",
    said: kind === "could-not-reach"
      ? "nothing - the office line rang out three times and no one called back"
      : "he confirmed the servers are unpatched and asked what it would cost to fix",
    outcome: kind,
    enteredBy: "Ahmad",
  };
}

test("T3: the hour stages from a REAL plan, with every decision already made", () => {
  const staged = stageHour({ plan: PLAN, when: "Thursday 9-10am" }, { now: NOW });
  assert.equal(staged.schema, STAGED_HOUR_SCHEMA);
  assert.equal(staged.staged, true);
  assert.equal(staged.refused, false);
  assert.equal(staged.state, "staged");
  assert.equal(staged.planSchema, HOUR_PLAN_SCHEMA, "it came from R1, not from a literal here");
  assert.equal(staged.when, "Thursday 9-10am");
  assert.equal(staged.durationMinutes, 60);
  assert.ok(staged.errand.label.length > 20, "there is a specific errand, not a category");
  assert.ok(ONE_DECISION_NOTE.includes("only decision left"));
  assert.ok(HOUR_STATE_KEYS.includes(staged.state));

  // With no chosen slot it says so rather than inventing a time.
  const noSlot = stageHour({ plan: PLAN }, { now: NOW });
  assert.equal(noSlot.when, UNKNOWN);
});

test("T3: with NO candidate it still stages an hour - 'go get the first name'", () => {
  const staged = stageHour({ plan: PLAN }, { now: NOW });
  assert.equal(staged.staged, true, "an empty candidate list does not block the hour");
  assert.equal(staged.hasCandidate, false);
  assert.equal(staged.candidateKey, null);
  assert.equal(staged.errand.key, "go-get-the-first-name");
  assert.equal(staged.errand.fromFirstNameErrand, true, "R1's own errand, not a placeholder");
  assert.equal(staged.opening, null);
  assert.ok(staged.openingStatement.includes("no name yet"));
  assert.ok(stagedHourMarkdown(staged).includes("this hour is for getting one"));
});

test("T3: with a candidate and a real basis, the opening is carried in verbatim", () => {
  const opening = buildOpening(CANDIDATE, { now: NOW });
  assert.equal(opening.refused, false, "S2 rendered an opening from the recorded basis");
  const staged = stageHour({ plan: PLAN, candidate: CANDIDATE, opening, when: "Thursday 9-10am" }, { now: NOW });

  assert.equal(staged.hasCandidate, true);
  assert.equal(staged.candidateKey, CANDIDATE.key);
  assert.equal(staged.errand.key, "spend-the-hour-on-a-recorded-name");
  if (!opening.refused) {
    assert.equal(staged.opening, opening.opening, "the S2 sentence, unmodified");
    assert.ok(stagedHourMarkdown(staged).includes(opening.opening));
  }

  // A REFUSED opening is never smuggled in as if it existed.
  const refused = stageHour({ plan: PLAN, candidate: CANDIDATE, opening: { refused: true } }, { now: NOW });
  assert.equal(refused.opening, null);
  assert.ok(refused.openingStatement.includes("fabrication"));
});

test("T3: with no plan it REFUSES to stage an hour rather than inventing an errand", () => {
  const none = stageHour({}, { now: NOW });
  assert.equal(none.staged, false);
  assert.equal(none.refused, true);
  assert.ok(none.refusedReason.includes("no real errand"));
  assert.ok(stagedHourMarkdown(none).includes("No hour staged"));
});

test("T3: walking the hour closes the loop back into R2", () => {
  const staged = stageHour({ plan: PLAN, candidate: CANDIDATE }, { now: NOW });
  const walked = walkStagedHour(staged, outcomeInput("engaged"), { now: NOW });

  assert.equal(walked.walked, true);
  assert.equal(walked.state, "walked");
  assert.equal(walked.hourCounted, true);
  assert.equal(walked.outcome.schema, CONVERSATION_OUTCOME_SCHEMA, "R2 recorded it, not this module");
  assert.equal(walked.outcome.recorded, true);
  assert.equal(walked.outcome.candidateKey, CANDIDATE.key, "the candidate carried across without retyping");
  assert.ok(walked.spentAt, "the hour has a real timestamp");

  // A nothing-hour still spends the hour and still records - it just holds no conversation.
  const nothing = walkStagedHour(staged, outcomeInput("could-not-reach"), { now: NOW });
  assert.equal(nothing.walked, true, "an unreachable prospect still cost the hour");
  assert.equal(nothing.hourCounted, true);
  assert.equal(nothing.outcome.countsAsConversationHeld, false, "but it is not a conversation held");

  // An outcome R2 refuses does not become a walked hour.
  const bad = walkStagedHour(staged, { heldAt: "2026-07-28" }, { now: NOW });
  assert.equal(bad.walked, false);
  assert.equal(bad.refused, true);
});

test("T3: an UNWALKED hour is a finding - not counted, not re-staged, not rolled over", () => {
  const staged = stageHour({ plan: PLAN, candidate: CANDIDATE, when: "Thursday 9-10am" }, { now: NOW });
  const missed = recordUnwalkedHour(staged, { reason: "the day filled up with a client escalation", now: NOW });

  assert.equal(missed.recorded, true);
  assert.equal(missed.state, "not-walked");
  assert.equal(missed.walked, false);
  // The three properties this task exists for.
  assert.equal(missed.hourCounted, false, "an hour not spent is not an hour spent");
  assert.equal(missed.spentAt, null);
  assert.equal(missed.reStaged, false, "it does NOT quietly re-stage itself");
  assert.equal(missed.rollsOver, false);
  assert.equal(missed.conversationHeld, false);
  assert.ok(missed.statement.includes("did not happen"));
  assert.ok(missed.statement.includes("not been re-staged"));
  assert.ok(NO_ROLLOVER_NOTE.includes("rolls over forever"));

  // No reason recorded is itself the finding, stated - not silently blank.
  const noReason = recordUnwalkedHour(staged, { now: NOW });
  assert.equal(noReason.reason, null);
  assert.ok(noReason.statement.includes("nobody looked at why"));

  // AND the elapsed counter is untouched by a missed hour: it still reads never.
  const elapsed = buildElapsed({ hourLog: [] }, { now: NOW });
  assert.equal(elapsed.counters.hourSpent.days, NEVER, "a missed hour does not age the counter into looking recent");
});

test("T3: a walked hour is what feeds the elapsed counter - and only a walked one", () => {
  const staged = stageHour({ plan: PLAN, candidate: CANDIDATE }, { now: NOW });
  const walked = walkStagedHour(staged, outcomeInput("could-not-reach"), { now: NOW });
  const missed = recordUnwalkedHour(staged, { reason: "did not get to it", now: NOW });

  const hourLog = [walked, missed].filter((h) => h.hourCounted).map((h) => ({ spentAt: h.spentAt }));
  assert.equal(hourLog.length, 1, "exactly one of the two counted");

  const elapsed = buildElapsed({ hourLog }, { now: NOW });
  assert.equal(elapsed.counters.hourSpent.never, false);
  assert.equal(elapsed.counters.hourSpent.days, 0, "spent today");
});

test("T3: STAGED, NOT SCHEDULED - no calendar write, no transport, no scheduler", () => {
  const staged = stageHour({ plan: PLAN, candidate: CANDIDATE }, { now: NOW });
  assert.equal(staged.writesCalendar, false);
  assert.equal(staged.hasScheduler, false);
  assert.equal(staged.hasTransport, false);
  assert.equal(staged.persists, false);
  assert.equal(staged.rollsOver, false);
  assert.equal(staged.sent, false);
  assert.equal(staged.signed, false);
  assert.equal(staged.charged, false);
  assert.equal(staged.nothingSent, true);
  assert.equal(WRITES_CALENDAR, false);
  assert.equal(HAS_SCHEDULER, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(PERSISTS, false);
  assert.equal(ROLLS_OVER, false);
  assert.equal(SENT, false);

  // It says so in the FIRST rendered line, not in a footnote.
  const md = stagedHourMarkdown(staged);
  assert.ok(md.includes(STAGED_NOT_SCHEDULED));
  assert.ok(md.indexOf(STAGED_NOT_SCHEDULED) < md.indexOf("- When:"), "before anything actionable");
  assert.equal(stagedHourIsMomentumSafe(staged), true);
  assert.equal(stagedHourMarkdown(null), "_no staged hour_");

  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const bad of [
    "node:fs", "writeFile", "readFile", "node:http", "fetch(", "XMLHttpRequest",
    "node:child_process", "spawn(", "execSync", "execFile", "process.env",
    "setInterval", "setTimeout", "cron", "nodemailer", "sendMail", "smtp",
    "ics", "calendar.google", "graph.microsoft", "createEvent", "VEVENT",
  ]) {
    assert.ok(!body.includes(bad), `no ${bad} in ${SRC}`);
  }
});
