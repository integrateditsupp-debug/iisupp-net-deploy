// o1-operator-brief.test.mjs — RUN-O O1 exit criteria, test-locked.
// The brief renders truthfully from an empty staging area and from a populated one; it names
// exactly one current script; superseded scripts carry an in-place marker; zero hand-written state.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  OPERATOR_BRIEF_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, INTERNAL_ONLY, PUBLIC_SAFE,
  NOTHING_STAGED, NO_CURRENT_SCRIPT, SUPERSEDED_MARKER, HUMAN_GATES,
  buildOperatorBrief, operatorBriefFacts, operatorBriefMarkdown, briefIsMomentumSafe,
} from "../src/shared/operator-brief.mjs";
import { normalizeProgramTruth, factsOf } from "../src/shared/program-truth.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const truthRaw = {
  program: { series: "CLIENT-READY", sequence: "RUN-O", tasksMerged: 3, tasksTotal: 3, exitCriteriaMet: true },
  tests: { green: 299, total: 302, effectiveGreen: 302, effectiveTotal: 302 },
  mainRef: { value: "abc1234", source: "last-known local tracking ref", liveConfirmed: false },
  unpushed: { commits: 36 },
  revenue: { receivedCad: 0, asksSent: 0 },
};

const populated = {
  truth: truthRaw,
  staging: [
    { id: "run-o-2026-07-28", path: "_staged/run-o", suiteResult: "302/302", stagedAt: "2026-07-28", current: true },
    { id: "run-n-2026-07-28", path: "_staged/run-n", suiteResult: "299/299", stagedAt: "2026-07-28" },
  ],
  scripts: [
    { name: "PUSH-CURRENT", purpose: "publish the verified line", refuses: "refuses to publish if the suite is red", forRun: "RUN-L..O", current: true },
    { name: "PUSH-OLD-A", purpose: "an earlier line" },
    { name: "PUSH-OLD-B", purpose: "an earlier line" },
  ],
  blocked: [
    { gate: "push", what: "a credential for the build sandbox", why: "the sandbox cannot authenticate to the remote" },
    { gate: "publish", what: "the public site deploy" },
    { gate: "vibes", what: "something without a real gate" },
    { gate: "send", what: null },
  ],
};

test("O1: belt-and-braces — nothing is sent, signed or charged; the brief is internal", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(INTERNAL_ONLY, true);
  assert.equal(PUBLIC_SAFE, false);
});

test("O1: the empty state reads as nothing staged, never as momentum", () => {
  const b = buildOperatorBrief({}, { now: NOW });
  assert.equal(b.schema, OPERATOR_BRIEF_SCHEMA);
  assert.equal(b.empty, true);
  assert.equal(b.headline, NOTHING_STAGED);
  assert.deepEqual(b.whatIsStaged, []);
  assert.equal(b.currentScript, null);
  assert.deepEqual(b.supersededScripts, []);
  assert.equal(b.counts.staged, 0);
  assert.ok(briefIsMomentumSafe(b), "the empty brief must not wear momentum language");
  const md = operatorBriefMarkdown(b);
  assert.match(md, /nothing is staged/i);
});

test("O1: exactly one current script; every other is marked SUPERSEDED in place with a pointer", () => {
  const b = buildOperatorBrief(populated, { now: NOW });
  assert.ok(b.currentScript, "a current script must be identified");
  assert.equal(b.currentScript.name, "PUSH-CURRENT");
  assert.equal(b.counts.superseded, 2);
  for (const s of b.supersededScripts) {
    assert.equal(s.status, SUPERSEDED_MARKER);
    assert.equal(s.supersededBy, "PUSH-CURRENT");
    assert.equal(s.current, false);
    assert.ok(s.name, "Rule 15 — a superseded script keeps its name; it is marked, never deleted or renamed");
  }
});

test("O1: two current scripts (or none) is stated, never guessed", () => {
  const two = buildOperatorBrief({ ...populated, scripts: [
    { name: "A", current: true }, { name: "B", current: true },
  ] }, { now: NOW });
  assert.equal(two.currentScript, null);
  assert.equal(two.headline, NO_CURRENT_SCRIPT);

  const none = buildOperatorBrief({ ...populated, scripts: [{ name: "A" }, { name: "B" }] }, { now: NOW });
  assert.equal(none.currentScript, null);
  assert.equal(none.headline, NO_CURRENT_SCRIPT);
});

test("O1: the current script says what it does AND what it refuses to do", () => {
  const b = buildOperatorBrief(populated, { now: NOW });
  assert.ok(b.currentScript.purpose);
  assert.ok(b.currentScript.willRefuse);
  const md = operatorBriefMarkdown(b);
  assert.match(md, /What it refuses to do/);
});

test("O1: only real named human gates survive; a vague wait is dropped and counted", () => {
  const b = buildOperatorBrief(populated, { now: NOW });
  assert.equal(b.blockedOnAHuman.length, 2);
  for (const item of b.blockedOnAHuman) assert.ok(HUMAN_GATES.includes(item.gate));
  assert.equal(b.counts.droppedUnnamedGates, 2, "an unnamed gate and a gate with no subject are dropped, not softened");
});

test("O1: zero hand-written state — every program fact traces to program-truth", () => {
  const b = buildOperatorBrief(populated, { now: NOW });
  assert.deepEqual(operatorBriefFacts(b), factsOf(normalizeProgramTruth(truthRaw, { now: NOW })));
  // change the truth, the brief changes — nothing is hardcoded
  const changed = buildOperatorBrief({ ...populated, truth: { ...truthRaw, revenue: { receivedCad: 500, asksSent: 2 } } }, { now: NOW });
  assert.notEqual(changed.revenueStatement, b.revenueStatement);
  assert.notEqual(changed.asksStatement, b.asksStatement);
});

test("O1: zero revenue and zero asks render in the ledger's own words", () => {
  const b = buildOperatorBrief(populated, { now: NOW });
  const t = normalizeProgramTruth(truthRaw, { now: NOW });
  assert.equal(b.revenueStatement, t.revenue.revenueStatement);
  assert.equal(b.asksStatement, t.revenue.asksStatement);
  assert.ok(briefIsMomentumSafe(b));
});

test("O1: static-scan — the brief is send-incapable and cannot reach the filesystem", () => {
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/];
  for (const mod of ["operator-brief.mjs", "program-truth.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});
