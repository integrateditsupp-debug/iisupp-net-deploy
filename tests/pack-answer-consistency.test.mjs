// AX1 — the pack read together, not one document at a time.
//
// Red-first throughout. The reds that matter here are the ones about SMOOTHING: a gate that returns
// agreed while two documents disagree, a normaliser clever enough to make different sentences match,
// a register that goes green on a reason nobody wrote, and a register that rots. Each is planted and
// asserted to fail BY NAME.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  auditPack, auditTopic, answersFor, readDeclarations, statementFor,
  TOPICS, NORMALISE, VERDICT, CONFLICT_REGISTER,
} from "../scripts/lib/pack-answer-consistency.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A throwaway pack. Nothing is read from the real tree in the planted cases. */
function pack(files) {
  const dir = makeScratchDir("pack-answers-");
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

const TOPIC = {
  topic: "widget-retention",
  question: "How long do you keep widgets?",
  asks: "a reviewer",
  costs: "a customer told one number and given another",
  normalise: "days",
  sources: [
    { file: "a.md", re: /Widget retention:\s*([\d.]+\s*days?)/i },
    { file: "b.md", re: /widgets for\s*([\d.]+\s*days?)/i },
  ],
};

const REGISTER = "reg.md";
const HEADER = "| Topic | State | Reason | Who |\n|---|---|---|---|\n";
const GOOD_REASON = "two client-facing documents state different windows and only one of them is what a customer actually receives";

test("AX1 — two documents agreeing is AGREED, and it is read out of both", () => {
  const dir = pack({ "a.md": "Widget retention: 30 days.", "b.md": "We keep widgets for 30 days." });
  const r = auditTopic(TOPIC, { root: dir });
  assert.equal(r.verdict, VERDICT.AGREED);
  assert.equal(r.answers.length, 2);
  assert.deepEqual(r.distinctValues, ["30"]);
  // Citations, always — a claim a reader cannot look up is a rumour.
  for (const a of r.answers) {
    assert.ok(a.line > 0, "every answer carries the line it was read from");
    assert.match(a.source, /widget/i, "every answer carries the source text that produced it");
  }
});

test("AX1 — RED: two documents disagreeing can never be AGREED, and both citations survive", () => {
  const dir = pack({ "a.md": "Widget retention: 7 days.", "b.md": "We keep widgets for 90 days." });
  const r = auditTopic(TOPIC, { root: dir });
  assert.notEqual(r.verdict, VERDICT.AGREED);
  assert.equal(r.verdict, VERDICT.UNDECLARED, "a disagreement nobody has written down is the state that goes red");
  assert.deepEqual(r.distinctValues.sort(), ["7", "90"].sort());
  assert.equal(r.answers.length, 2);
  assert.equal(r.resolvedHere, false, "this module never resolves a disagreement");
});

test("AX1 — RED: a disagreement INSIDE ONE DOCUMENT is a conflict like any other", () => {
  // The likeliest person to find this is a reviewer reading one file top to bottom.
  const dir = pack({ "a.md": "Widget retention: 7 days.\nLater on: Widget retention: 90 days.", "b.md": "no answer here" });
  const r = auditTopic(TOPIC, { root: dir });
  assert.equal(r.verdict, VERDICT.UNDECLARED);
  assert.equal(r.filesAnswering.length, 1, "one file, two answers, still a conflict");
  assert.equal(r.answers.length, 2);
});

test("AX1 — one document answering is SINGLE-SOURCE: never rounded up, never rounded down", () => {
  const dir = pack({ "a.md": "Widget retention: 30 days.", "b.md": "silent" });
  const r = auditTopic(TOPIC, { root: dir });
  assert.equal(r.verdict, VERDICT.SINGLE_SOURCE);
  assert.notEqual(r.verdict, VERDICT.AGREED, "one voice is not a consensus");
  assert.notEqual(r.verdict, VERDICT.UNDECLARED, "one voice is not a contradiction");
});

test("AX1 — RED: a question NO document answers is UNANSWERED and fails the pack", () => {
  const dir = pack({ "a.md": "nothing", "b.md": "nothing" });
  const r = auditPack({ root: dir, topics: [TOPIC], registerFile: REGISTER });
  assert.equal(r.topics[0].verdict, VERDICT.UNANSWERED);
  assert.equal(r.summary.ok, false);
});

test("AX1 — RED: an unreadable source fails rather than reading as agreement", () => {
  const dir = pack({ "a.md": "Widget retention: 30 days." }); // b.md absent
  const r = auditPack({ root: dir, topics: [TOPIC], registerFile: REGISTER });
  assert.equal(r.topics[0].unreadableSources.length, 1);
  assert.equal(r.summary.ok, false);
});

test("AX1 — normalisers compare the FACT, and refuse to make different facts match", () => {
  assert.equal(NORMALISE.duration("4 hours").value, 240);
  assert.equal(NORMALISE.duration("240 min").value, 240, "same fact, two spellings");
  assert.notEqual(NORMALISE.duration("4 hours").value, NORMALISE.duration("4 days").value);
  // "7 years" must never quietly become 7.
  assert.equal(NORMALISE.days("7 years").value, 2555);
  assert.notEqual(NORMALISE.days("7 years").value, NORMALISE.days("7 days").value);
  assert.equal(NORMALISE.duration("soon"), null, "prose does not normalise into a number");
});

test("AX1 — RED: a matched value that will not normalise is a conflict, never dropped", () => {
  // A silently discarded answer is an answer that cannot conflict with anything.
  const T = { ...TOPIC, sources: [{ file: "a.md", re: /Widget retention:\s*(\S+)/i }, { file: "b.md", re: /widgets for\s*(\S+)/i }] };
  const dir = pack({ "a.md": "Widget retention: 30 days", "b.md": "We keep widgets for ever" });
  const r = auditTopic(T, { root: dir });
  assert.ok(r.answers.some((a) => a.unnormalisable), "the unreadable value is reported");
  assert.equal(r.verdict, VERDICT.UNDECLARED);
});

test("AX1 — a declared disagreement is reported, staged, and does not hold the registry red", () => {
  const dir = pack({
    "a.md": "Widget retention: 7 days.", "b.md": "We keep widgets for 90 days.",
    [REGISTER]: `${HEADER}| widget-retention | open | ${GOOD_REASON} | Ahmad |\n`,
  });
  const r = auditPack({ root: dir, topics: [TOPIC], registerFile: REGISTER });
  assert.equal(r.topics[0].verdict, VERDICT.DECLARED_OPEN);
  assert.equal(r.summary.ok, true);
  assert.equal(r.summary.conflicts, 1, "declared is not the same as gone");
  assert.equal(r.decisionsStaged[0].declared, true);
  assert.equal(r.decisionsStaged[0].citations.length, 2, "both citations, in the staged decision");
});

test("AX1 — RED: a rubber-stamp reason is REFUSED and fails", () => {
  const dir = pack({
    "a.md": "Widget retention: 7 days.", "b.md": "We keep widgets for 90 days.",
    [REGISTER]: `${HEADER}| widget-retention | open | tbd | Ahmad |\n`,
  });
  const r = auditPack({ root: dir, topics: [TOPIC], registerFile: REGISTER });
  assert.equal(r.summary.refusedDeclarations, 1);
  assert.equal(r.summary.ok, false);
});

test("AX1 — RED: a declaration with no named decider is parked, not staged", () => {
  const dir = pack({
    "a.md": "Widget retention: 7 days.", "b.md": "We keep widgets for 90 days.",
    [REGISTER]: `${HEADER}| widget-retention | open | ${GOOD_REASON} |  |\n`,
  });
  const r = auditPack({ root: dir, topics: [TOPIC], registerFile: REGISTER });
  assert.equal(r.summary.refusedDeclarations, 1);
  assert.equal(r.summary.ok, false);
});

test("AX1 — RED: a declaration that matches nothing is STALE and fails", () => {
  // A register that rots reads as diligence and is worse than no register.
  const dir = pack({
    "a.md": "Widget retention: 30 days.", "b.md": "We keep widgets for 30 days.",
    [REGISTER]: `${HEADER}| widget-retention | open | ${GOOD_REASON} | Ahmad |\n`,
  });
  const r = auditPack({ root: dir, topics: [TOPIC], registerFile: REGISTER });
  assert.equal(r.summary.staleDeclarations, 1);
  assert.equal(r.summary.ok, false);
});

test("AX1 — a topic naming an unknown normaliser throws instead of silently passing", () => {
  assert.throws(() => answersFor({ ...TOPIC, normalise: "vibes" }, { root }), /unknown normaliser/);
});

test("AX1 — every shipped topic is well formed and says who asks it and what it costs", () => {
  const seen = new Set();
  for (const t of TOPICS) {
    assert.ok(!seen.has(t.topic), `topic ids are unique: ${t.topic}`);
    seen.add(t.topic);
    assert.ok(typeof NORMALISE[t.normalise] === "function", `${t.topic} names a real normaliser`);
    assert.ok(t.sources.length >= 2, `${t.topic} is a CROSS-document question or it does not belong here`);
    assert.ok(t.asks && t.asks.length > 10, `${t.topic} says who asks it`);
    assert.ok(t.costs && t.costs.length > 20, `${t.topic} says what a disagreement costs`);
    for (const s of t.sources) assert.ok(s.re instanceof RegExp && s.re.source.includes("("), `${t.topic} exposes the value in a capture group`);
  }
});

test("AX1 — the real pack: no reviewer question is answered two ways in silence", () => {
  const r = auditPack({ root });
  assert.equal(r.summary.undeclared, 0, statementFor(r));
  assert.equal(r.summary.unanswered, 0, "every shipped topic is answered by the real pack");
  assert.equal(r.summary.staleDeclarations, 0, "the conflict register has not rotted");
  assert.equal(r.summary.refusedDeclarations, 0, "no rubber-stamp declaration");
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AX1 — the real register exists and every declaration in it is answerable", () => {
  const reg = readDeclarations({ root });
  assert.equal(reg.present, true, `${CONFLICT_REGISTER} is part of the shared line`);
  assert.equal(reg.refused.length, 0);
  for (const d of reg.declarations.values()) {
    assert.ok(d.whoDecides, "every declaration names a decider");
    assert.ok(d.reason.split(/\s+/).length >= 12, "a real reason, not a shrug");
  }
});
