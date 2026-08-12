// AY2 — the support and availability commitments, read together.
//
// Red-first against fixtures built to fail the exact class claimed. The reds that matter here are the
// ones that prove the module cannot go green by not asking: a disagreement nobody wrote down must go
// red, a declaration that has rotted must go red, and a rubber-stamp reason must be refused. And the
// one that proves the module never oversteps: it must not pick which promise is right.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  auditSupportCommitments, auditCommitment, statementsFor, statementFor,
  COMMITMENTS, SUPPORT_REGISTER, SUPPORT_COMMITMENT_SCHEMA,
} from "../scripts/lib/support-commitments.mjs";
import { VERDICT } from "../scripts/lib/pack-answer-consistency.mjs";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const root = path.resolve(import.meta.dirname, "..");

function fixture(files) {
  const dir = makeScratchDir("support-fixture-");
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return dir;
}

const TOPIC = {
  id: "p1-response",
  commitment: "How fast do we respond to a P1?",
  who: "the customer with production down",
  costs: "the most quoted number in an IT services contract",
  normalise: "duration",
  tier: "Enterprise",
  sources: [
    { file: "contract.md", re: /P1 response time \| ([\d.]+\s*(?:min|minutes|hours?|hrs?))/i },
    { file: "questionnaire.md", re: /P1 within ([\d.]+\s*(?:min|minutes|hours?|hrs?))/i, unqualified: true },
  ],
};

const REGISTER = "docs/REG.md";
const declare = (id, reason, who = "Ahmad") =>
  `| Topic | State | Reason | Who |\n|---|---|---|---|\n| ${id} | open | ${reason} | ${who} |\n`;

test("AY2 — the real surfaces are read, and every commitment carries its citation", () => {
  const r = auditSupportCommitments({ root });
  assert.equal(r.schema, SUPPORT_COMMITMENT_SCHEMA);
  assert.ok(r.summary.commitments >= 8, "this reads a real body of commitments, not a token one");
  for (const c of r.commitments) {
    for (const s of c.statements) {
      assert.ok(s.file && s.line > 0, `${c.id} must carry file and line`);
      assert.ok(s.source && s.source.length > 0, `${c.id} must carry the source text it read`);
    }
  }
});

test("AY2 — every commitment states who measures us against it and what disagreeing costs", () => {
  for (const c of COMMITMENTS) {
    assert.ok(c.who && c.who.split(/\s+/).length >= 3, `${c.id} must say who`);
    assert.ok(c.costs && c.costs.split(/\s+/).length >= 8, `${c.id} must say what a disagreement costs`);
    assert.ok(c.sources.length > 0, `${c.id} must name at least one surface`);
    for (const s of c.sources) assert.ok(s.re instanceof RegExp && /\(/.test(String(s.re)), `${c.id} must capture a value`);
  }
});

test("AY2 — no undeclared disagreement, no rotted declaration, no unreadable surface", () => {
  const r = auditSupportCommitments({ root });
  const undeclared = r.commitments.filter((c) => c.verdict === VERDICT.UNDECLARED)
    .map((c) => `${c.id}: ${c.distinctValues.join(" vs ")} — ${c.statements.map((s) => `${s.file}:${s.line}`).join(", ")}`);
  assert.deepEqual(undeclared, [], `a disagreement nobody has written down:\n${undeclared.join("\n")}`);
  assert.equal(r.summary.staleDeclarations, 0, "a register that rots reads as diligence");
  assert.equal(r.summary.refusedDeclarations, 0);
  assert.deepEqual(r.commitments.flatMap((c) => c.unreadableSources), []);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AY2 — every open disagreement is staged with BOTH citations and a named decider", () => {
  const r = auditSupportCommitments({ root });
  for (const d of r.decisionsStaged) {
    assert.ok(d.citations.length >= 2, "a conflict a reader cannot look up is a rumour");
    assert.ok(d.whoDecides && d.whoDecides.length > 0);
    assert.equal(d.declared, true, "every conflict on the real tree is declared or the audit is red");
  }
});

test("AY2 RED — a disagreement NOBODY wrote down is undeclared and goes red", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
  });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(r.commitments[0].verdict, VERDICT.UNDECLARED);
    assert.deepEqual(r.commitments[0].distinctValues, ["15", "60"]);
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 — a declared disagreement is reported forever and does NOT hold the registry red", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
    [REGISTER]: declare("p1-response", "The contract commits fifteen minutes to an Enterprise customer while the questionnaire states one hour with no tier written beside it, so one buyer can be handed both in the same week."),
  });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(r.commitments[0].verdict, VERDICT.DECLARED_OPEN);
    assert.equal(r.summary.ok, true, "a decision must not hold the gate red — red on a decision teaches people to ignore red");
    assert.equal(r.summary.declaredOpen, 1);
    assert.equal(r.decisionsStaged[0].citations.length, 2, "still reported, with both citations, on every run");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — a declaration pointing at a commitment that no longer disagrees is STALE", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 15 min to Customer.",
    [REGISTER]: declare("p1-response", "A reason long enough to be a real one, written by a person, about a disagreement that has since been resolved in the documents."),
  });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(r.commitments[0].verdict, VERDICT.AGREED);
    assert.equal(r.summary.staleDeclarations, 1);
    assert.equal(r.summary.ok, false, "a rotted register is worse than none, because it reads as diligence");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — a rubber-stamp declaration is REFUSED, not accepted", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
    [REGISTER]: declare("p1-response", "TBD"),
  });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(r.summary.refusedDeclarations, 1);
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — a declaration with no named decider is parked, not staged", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
    [REGISTER]: declare("p1-response", "A perfectly reasonable and sufficiently long explanation of why these two numbers differ today.", ""),
  });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(r.summary.refusedDeclarations, 1);
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 — a tiered promise disagreeing with an UNQUALIFIED one is reported as its own fact", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
  });
  try {
    const one = auditCommitment(TOPIC, { root: dir });
    assert.equal(one.tierMismatch, true, "two audiences being told different things is not a typo");
    assert.ok(one.statements.some((s) => s.unqualified), "the unqualified statement is marked as such");
    assert.ok(one.statements.some((s) => !s.unqualified));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 — the module never picks which promise is right", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 15 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
  });
  try {
    const one = auditCommitment(TOPIC, { root: dir });
    assert.equal(one.resolvedHere, false);
    assert.deepEqual(one.distinctValues.sort(), ["15", "60"], "both values survive; neither is chosen");
    const before = fs.readFileSync(path.join(dir, "contract.md"), "utf8");
    auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(fs.readFileSync(path.join(dir, "contract.md"), "utf8"), before, "nothing is edited to make a count green");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — TWO statements inside ONE document that disagree are a conflict like any other", () => {
  const solo = { ...TOPIC, sources: [{ file: "contract.md", re: /P1 response time \| ([\d.]+\s*(?:min|minutes|hours?|hrs?))/i }] };
  const dir = fixture({ "contract.md": "| P1 response time | 15 min |\nlater on: | P1 response time | 4 hours |" });
  try {
    const one = auditCommitment(solo, { root: dir });
    assert.equal(one.statements.length, 2, "ALL matching lines are collected, never the first");
    assert.equal(one.verdict, VERDICT.UNDECLARED);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 — a commitment stated in exactly one place is single-source, its own class", () => {
  const solo = { ...TOPIC, sources: [{ file: "contract.md", re: /P1 response time \| ([\d.]+\s*(?:min|minutes|hours?|hrs?))/i }] };
  const dir = fixture({ "contract.md": "| P1 response time | 15 min |" });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [solo], registerFile: REGISTER });
    assert.equal(r.commitments[0].verdict, VERDICT.SINGLE_SOURCE);
    assert.equal(r.summary.ok, true, "one voice is not a contradiction");
    assert.equal(r.summary.singleSource, 1, "and it is counted, because one voice is not a consensus either");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — a commitment stated NOWHERE fails; silence is not agreement", () => {
  const dir = fixture({ "contract.md": "nothing about response times at all" });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [{ ...TOPIC, sources: [TOPIC.sources[0]] }], registerFile: REGISTER });
    assert.equal(r.commitments[0].verdict, VERDICT.UNANSWERED);
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — an unreadable surface is reported, never treated as agreement", () => {
  const dir = fixture({ "contract.md": "| P1 response time | 15 min |" });
  try {
    const r = auditSupportCommitments({ root: dir, commitments: [TOPIC], registerFile: REGISTER });
    assert.equal(r.commitments[0].unreadableSources.length, 1);
    assert.equal(r.commitments[0].unreadableSources[0].file, "questionnaire.md");
    assert.equal(r.summary.ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 RED — a value that matched but will not normalise is reported, never silently dropped", () => {
  const junk = { ...TOPIC, sources: [{ file: "contract.md", re: /P1 response time \| (.+?) \|/i }] };
  const dir = fixture({ "contract.md": "| P1 response time | as soon as possible |" });
  try {
    const one = auditCommitment(junk, { root: dir });
    assert.equal(one.statements[0].unnormalisable, true, "a silently discarded statement cannot conflict with anything");
    assert.equal(one.disagrees, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 — units are compared, not strings: 60 minutes and 1 hour are the same promise", () => {
  const dir = fixture({
    "contract.md": "| P1 response time | 60 min |",
    "questionnaire.md": "P1 within 1 hour to Customer.",
  });
  try {
    const one = auditCommitment(TOPIC, { root: dir });
    assert.equal(one.verdict, VERDICT.AGREED);
    assert.deepEqual(one.distinctValues, ["60"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY2 — an unknown normaliser throws rather than quietly comparing nothing", () => {
  assert.throws(
    () => statementsFor({ ...TOPIC, normalise: "vibes" }, { root }),
    /unknown normaliser/,
  );
});

test("AY2 — the register is kept apart from the AX1 pack register, deliberately", () => {
  assert.equal(SUPPORT_REGISTER, "docs/SUPPORT-COMMITMENT-CONFLICTS.md");
  assert.notEqual(SUPPORT_REGISTER, "docs/PACK-ANSWER-CONFLICTS.md");
  const text = fs.readFileSync(path.join(root, SUPPORT_REGISTER), "utf8");
  assert.match(text, /PACK-ANSWER-CONFLICTS/, "the register states why it is separate rather than leaving a reader to guess");
  assert.match(text, /silently/i, "and states the failure mode this class has");
});
