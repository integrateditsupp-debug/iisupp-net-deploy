// AX3 — the cost of answering a reviewer, counted rather than felt.
//
// Red-first. The reds that matter are about the UNIT: an hour nobody timed is a fabricated metric
// (Rule 14), and composed-by-design collapsed into composed-for-want would push this program toward
// automating the judgement that wins the deal.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { priceFollowUp, statementFor, FOLLOW_UP, COST } from "../scripts/lib/answer-cost.mjs";
import { readGapDeclarations } from "../scripts/lib/answer-citations.mjs";

const root = path.resolve(import.meta.dirname, "..");

function repo({ committed = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "answer-cost-repo-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  for (const [rel, text] of Object.entries(committed)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "c", "--allow-empty");
  return dir;
}

const GAPS = "gaps.md";
const GHEAD = "| Artefact | State | Reason | Who |\n|---|---|---|---|\n";
const GREASON = "the artefact has never been written and whether to write it or stop promising it is a decision";

const Q_POINT = { id: "T-1", asks: "Send the policy.", points: ["p/policy.md"] };
const Q_DESIGN = { id: "T-2", asks: "Why trust a one-person company?", byDesign: "a founder answers this in his own voice and a generated paragraph reads as evasive" };

test("AX3 — a question backed by an artefact in the shared line is POINTABLE", () => {
  const dir = repo({ committed: { "p/policy.md": "x" } });
  const r = priceFollowUp({ root: dir, questions: [Q_POINT], gapsFile: GAPS });
  assert.equal(r.summary.pointable, 1);
  assert.equal(r.summary.ok, true);
});

test("AX3 — RED: the artefact missing turns the SAME question into a composition", () => {
  const dir = repo({ committed: { "other.md": "x" } });
  const r = priceFollowUp({ root: dir, questions: [Q_POINT], gapsFile: GAPS });
  assert.equal(r.summary.pointable, 0);
  assert.equal(r.summary.composedForWant, 1);
  assert.deepEqual(r.questions[0].missing, ["p/policy.md"]);
  assert.equal(r.summary.ok, false, "a composition forced by an artefact nobody has acknowledged is the failure");
});

test("AX3 — a composition forced by a DECLARED gap is a cost, carried and reported", () => {
  const dir = repo({ committed: { [GAPS]: `${GHEAD}| \`p/policy.md\` | open | ${GREASON} | Ahmad |\n` } });
  const r = priceFollowUp({ root: dir, questions: [Q_POINT], gapsFile: GAPS });
  assert.equal(r.summary.composedForWant, 1);
  assert.equal(r.summary.forWantUndeclared, 0);
  assert.equal(r.questions[0].blockedByGap.artefact, "p/policy.md");
  assert.equal(r.summary.ok, true);
});

test("AX3 — COMPOSED-BY-DESIGN is never a defect and never moves when a gap closes", () => {
  const dir = repo({ committed: { "p/policy.md": "x" } });
  const r = priceFollowUp({ root: dir, questions: [Q_POINT, Q_DESIGN], gapsFile: GAPS });
  assert.equal(r.summary.composedByDesign, 1);
  assert.equal(r.summary.ok, true, "a founder's judgement is not a gap");
  assert.equal(r.ifGapsClosed.composed, 1, "closing every gap does not automate the answers that win the deal");
});

test("AX3 — by-design and for-want are never collapsed into one number", () => {
  const dir = repo({ committed: { [GAPS]: `${GHEAD}| \`p/policy.md\` | open | ${GREASON} | Ahmad |\n` } });
  const r = priceFollowUp({ root: dir, questions: [Q_POINT, Q_DESIGN], gapsFile: GAPS });
  assert.equal(r.summary.composedForWant, 1);
  assert.equal(r.summary.composedByDesign, 1);
  assert.notEqual(r.summary.composedForWant + r.summary.composedByDesign, r.summary.composedForWant);
  const forWant = r.questions.find((q) => q.cost === COST.COMPOSED_FOR_WANT);
  const byDesign = r.questions.find((q) => q.cost === COST.COMPOSED_BY_DESIGN);
  assert.notEqual(forWant.cost, byDesign.cost);
});

test("AX3 — RED: an unreadable HEAD leaves the cost UNCOUNTED, never assigned", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "answer-cost-norepo-"));
  const r = priceFollowUp({ root: dir, questions: [Q_POINT], gapsFile: GAPS });
  assert.equal(r.summary.uncounted, 1);
  assert.equal(r.summary.pointable, 0, "a cost silently assigned is a cost nobody will check");
  assert.equal(r.summary.ok, false);
});

test("AX3 — the unit is acts, never hours: no shipped question or statement invents a duration", () => {
  const r = priceFollowUp({ root });
  assert.match(r.unit, /never hours/i);
  const text = JSON.stringify({ u: r.unit, q: FOLLOW_UP, s: statementFor(r) });
  assert.doesNotMatch(text, /\b\d+(\.\d+)?\s*(hours?|hrs?|minutes?|mins?|days?)\b/i,
    "an hour nobody timed is a fabricated metric no matter how reasonable it sounds");
});

test("AX3 — nothing is sent, attached, or mailed, and the module says so out loud", () => {
  const r = priceFollowUp({ root });
  assert.equal(r.sent, false);
  assert.equal(r.attached, false);
  assert.equal(r.mailPathTouched, false);
});

test("AX3 — every shipped question is well formed and exclusive about how it is answered", () => {
  const seen = new Set();
  for (const q of FOLLOW_UP) {
    assert.ok(!seen.has(q.id), `question ids are unique: ${q.id}`);
    seen.add(q.id);
    assert.ok(q.asks && q.asks.length > 10, `${q.id} states what the reviewer actually asks`);
    const hasPoints = Array.isArray(q.points) && q.points.length > 0;
    assert.ok(hasPoints !== Boolean(q.byDesign), `${q.id} is answered by pointing OR by a person, never declared as both or neither`);
    if (q.byDesign) assert.ok(q.byDesign.split(/\s+/).length >= 8, `${q.id} says WHY a person must answer it`);
  }
});

test("AX3 — the real follow-up: every composition is traced to a gap somebody wrote down", () => {
  const r = priceFollowUp({ root });
  assert.equal(r.headReadable, true);
  assert.equal(r.summary.uncounted, 0, statementFor(r));
  assert.equal(r.summary.forWantUndeclared, 0, statementFor(r));
  assert.equal(r.summary.ok, true, statementFor(r));
  // Wired to AX2: closing the declared gaps and moving this number are the same act.
  const gaps = readGapDeclarations({ root });
  for (const q of r.questions.filter((x) => x.cost === COST.COMPOSED_FOR_WANT)) {
    assert.ok(gaps.declarations.has(q.blockedByGap.artefact), `${q.id} waits on a gap in the AX2 register`);
  }
});
