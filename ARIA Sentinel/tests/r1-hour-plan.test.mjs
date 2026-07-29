// r1-hour-plan.test.mjs — RUN-R R1 exit criteria, test-locked.
// An hour plan renders from a real ranking and refuses to pad; the zero case produces exactly one
// honest item; the plan names what it is not; a static scan proves no transport and no scheduler.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  HOUR_PLAN_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT,
  HAS_TRANSPORT, HAS_SCHEDULER, MACHINE_CONSUMABLE,
  ERRANDS_PER_HOUR, IS_NOT, NO_PADDING_NOTE, ZERO_STATEMENT, FIRST_NAME_ERRAND,
  buildHourPlan, hourPlanIsMomentumSafe, hourPlanMarkdown,
} from "../src/shared/hour-plan.mjs";
import { recordCandidate, buildCandidateList, REQUIRED_KEYS } from "../src/shared/candidate-record.mjs";
import { rankCandidates } from "../src/shared/candidate-fit.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function candidate(key, extra = {}) {
  const r = recordCandidate({
    key,
    enteredBy: "Ahmad",
    name: { value: `Org ${key}`, source: `i met their ops manager at the Whitby chamber breakfast on 2026-07-14 (${key})` },
    contact: { value: `ops@${key}.example`, source: "printed on the business card he handed me at that breakfast" },
    problemBasis: { value: "their two-person IT team is on call overnight", source: "he said it out loud at that breakfast, unprompted" },
    ...extra,
  }, { now: NOW });
  assert.equal(r.refused, false, `fixture must record: ${r.reason || ""}`);
  return r.candidate;
}

test("R1: belt-and-braces — the plan sends nothing and no machine may consume it", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(HAS_SCHEDULER, false);
  assert.equal(MACHINE_CONSUMABLE, false);
});

test("R1: an hour plan renders from a real ranking, unscoreable candidates first", () => {
  const cands = [candidate("cand-001"), candidate("cand-002")];
  const rank = rankCandidates(cands, buildCandidateList(cands, { now: NOW }));
  const plan = buildHourPlan({ rank, list: buildCandidateList(cands, { now: NOW }) }, { now: NOW });

  assert.equal(plan.schema, HOUR_PLAN_SCHEMA);
  assert.equal(plan.empty, false);
  assert.equal(plan.padded, false);
  assert.equal(plan.itemCount, plan.items.length);
  assert.equal(plan.itemCount, Math.min(rank.total, ERRANDS_PER_HOUR));
  // Every item carries a concrete errand and a stated reason — never advice, never a mood.
  for (const item of plan.items) {
    assert.ok(item.errand && item.errand.length > 10, "every item is a concrete errand");
    assert.ok(item.why && item.why.length > 5, "every item explains itself");
    assert.equal(item.fromRanking, true);
  }
  // Q2 puts unscoreable candidates first; the hour plan must not quietly re-sort them to the back.
  if (rank.needsOneFact.length) {
    assert.equal(plan.items[0].kind, "find-one-fact");
    assert.equal(plan.items[0].key, rank.needsOneFact[0].key);
  }
});

test("R1: it REFUSES to pad — two errands' worth of work makes a two-item plan that says so", () => {
  const cands = [candidate("cand-001"), candidate("cand-002")];
  const rank = rankCandidates(cands, null);
  const plan = buildHourPlan({ rank }, { now: NOW });

  assert.equal(plan.itemCount, 2, "exactly as long as the real work");
  assert.ok(plan.itemCount < ERRANDS_PER_HOUR, "an hour could hold more; the plan does not invent more");
  assert.equal(plan.deferredCount, 0);
  assert.ok(plan.statement.includes("2 errand"), "the plan states its real length");
  assert.ok(/not filled out to look full/.test(plan.statement), "and states that it was not padded");
  assert.ok(NO_PADDING_NOTE.includes("padded hour is the same lie as a padded score"));
});

test("R1: more real work than an hour holds is DEFERRED and named, never squeezed in", () => {
  const cands = Array.from({ length: ERRANDS_PER_HOUR + 3 }, (_, i) => candidate(`cand-10${i}`));
  const rank = rankCandidates(cands, null);
  const plan = buildHourPlan({ rank }, { now: NOW });

  assert.equal(plan.itemCount, ERRANDS_PER_HOUR, "an hour is an hour");
  assert.equal(plan.realWorkCount, ERRANDS_PER_HOUR + 3);
  assert.equal(plan.deferredCount, 3);
  assert.ok(plan.statement.includes("belong to a different hour"), "the overflow is stated, not hidden");
});

test("R1: zero candidates produces EXACTLY ONE item, in Q1's own vocabulary", () => {
  const rank = rankCandidates([], buildCandidateList([], { now: NOW }));
  const plan = buildHourPlan({ rank, list: buildCandidateList([], { now: NOW }) }, { now: NOW });

  assert.equal(plan.empty, true);
  assert.equal(plan.itemCount, 1, "exactly one — no second item invented beneath it");
  assert.equal(plan.items[0].kind, "get-the-first-name");
  assert.equal(plan.items[0].key, null);
  assert.equal(plan.statement, ZERO_STATEMENT);
  // Q1's own field vocabulary, not a paraphrase that could drift from it.
  for (const key of REQUIRED_KEYS) {
    assert.ok(FIRST_NAME_ERRAND.errand.includes(key), `the zero errand names Q1's field: ${key}`);
  }
  assert.ok(/Nothing may be inferred/.test(FIRST_NAME_ERRAND.errand));
});

test("R1: a foreign or absent shape is the zero case, never treated as 'some work'", () => {
  for (const bad of [null, undefined, {}, { rank: { schema: "not-a-ranking", ranked: [{ key: "x" }] } }, { rank: [] }]) {
    const plan = buildHourPlan(bad || {}, { now: NOW });
    assert.equal(plan.empty, true, "a shape we do not recognise carries no work");
    assert.equal(plan.itemCount, 1);
    assert.equal(plan.sourceRankTotal, 0);
  }
});

test("R1: the plan states what it is NOT, and forbids automation", () => {
  const plan = buildHourPlan({ rank: rankCandidates([], null) }, { now: NOW });
  for (const phrase of ["not a call list", "not a sequence", "not a campaign"]) {
    assert.ok(plan.isNot.includes(phrase), `the plan says it is ${phrase}`);
  }
  assert.ok(plan.isNot.includes("not an automation input"));
  assert.ok(plan.noAutomationNote && plan.noAutomationNote.length > 20);
  assert.deepEqual(IS_NOT.slice(0, 3), ["not a call list", "not a sequence", "not a campaign"]);
  const md = hourPlanMarkdown(plan);
  assert.ok(md.includes("not a call list"), "the rendered plan carries it where a human reads it");
});

test("R1: no momentum vocabulary over an empty or a real plan", () => {
  assert.equal(hourPlanIsMomentumSafe(buildHourPlan({ rank: rankCandidates([], null) }, { now: NOW })), true);
  const cands = [candidate("cand-001")];
  assert.equal(hourPlanIsMomentumSafe(buildHourPlan({ rank: rankCandidates(cands, null) }, { now: NOW })), true);
  assert.equal(hourPlanIsMomentumSafe(null), false);
});

test("R1: deterministic — same ranking in, byte-identical plan out", () => {
  const cands = [candidate("cand-003"), candidate("cand-001"), candidate("cand-002")];
  const a = buildHourPlan({ rank: rankCandidates(cands, null) }, { now: NOW });
  const b = buildHourPlan({ rank: rankCandidates(cands.slice().reverse(), null) }, { now: NOW });
  assert.deepEqual(a.items.map((i) => i.key), b.items.map((i) => i.key), "input order cannot change the hour");
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("R1: static-scan — no fs, no net, no spawn, no scheduler in the hour plan", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/hour-plan.mjs"), "utf8");
  for (const forbidden of [
    "node:fs", "readFileSync", "writeFileSync", "node:child_process", "spawn(", "exec(",
    "fetch(", "node:http", "node:https", "process.env", "setInterval", "setTimeout", "cron",
    "sendMail", "transport(",
  ]) {
    assert.ok(!src.includes(forbidden), `hour-plan must not reference ${forbidden}`);
  }
});

test("R1: static-scan — the plan cannot be wired into a sender or a queue", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/hour-plan.mjs"), "utf8");
  assert.ok(src.includes("MACHINE_CONSUMABLE = false"));
  assert.ok(src.includes("HAS_SCHEDULER = false"));
  for (const forbidden of ["markSent", "enqueue", "dispatch(", "emailer", "sequenceStep"]) {
    assert.ok(!src.includes(forbidden), `hour-plan must not reference ${forbidden}`);
  }
});
