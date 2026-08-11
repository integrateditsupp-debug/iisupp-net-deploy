// AU3 — the yes-path held at 6/6, with the regression wired.
//
// AT1 found the gap. AU1 closed it. This is the part that decides whether it STAYS closed: a suite
// that fails the moment any step on the path from a reply to a first dollar falls back to untracked,
// unusable or missing.
//
// Why a separate suite from tests/yes-path.test.mjs: that one proves the WALKER is correct (classes,
// ranking, blocking, the manual-by-design rule) against fixtures. This one asserts a fact about THIS
// REPOSITORY as it stands, which is a different claim and deserves to go red for a different reason.
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { resolveYesPath, statementFor, STEPS, CLASSES } from "../scripts/lib/yes-path.mjs";

const root = path.resolve(import.meta.dirname, "..");
const result = resolveYesPath({ root });

test("git is readable, so every 'carried' verdict below is a read and not a guess", () => {
  assert.equal(result.trackedReadable, true,
    "if git cannot be read, this suite proves nothing and must say so rather than pass");
});

test("the path is still the whole path — six steps, none quietly dropped", () => {
  assert.equal(STEPS.length, 6);
  assert.equal(result.summary.total, 6,
    "a step removed from the walk is a step that can never fail again; Rule 15 keeps the count fixed");
  const ids = result.steps.map((s) => s.id);
  assert.deepEqual(ids, ["reply-received", "call-booked", "scope-agreed", "agreement-signed", "invoice-raised", "payment-received"]);
});

test("6/6 — every step is backed by an artefact the shared line carries", () => {
  const broken = result.steps.filter((s) => s.class !== CLASSES.PRESENT);
  assert.deepEqual(
    broken.map((s) => `${s.id}=${s.class} (${s.artefacts.map((a) => `${a.path}:${a.class}`).join(", ")})`),
    [],
    "any step below PRESENT re-opens the gap AT1 found: " + statementFor(result),
  );
  assert.equal(result.summary.present, 6);
  assert.equal(result.summary.complete, true);
  assert.equal(result.summary.firstGap, null);
});

test("no step regresses to UNTRACKED — a clone must be able to produce every artefact", () => {
  const untracked = result.steps.filter((s) => s.class === CLASSES.UNTRACKED);
  assert.deepEqual(untracked.map((s) => s.id), [],
    "an artefact on one machine only is the state that made the agreement unreachable for twenty-five cycles");
  assert.equal(result.summary.untracked, 0);
});

test("no step regresses to UNUSABLE — nothing carried but wrong reaches a client", () => {
  const findings = result.steps.flatMap((s) => s.artefacts.flatMap((a) => a.findings.map((f) => `${a.path}: ${f.kind}${f.found ? ` "${f.found}"` : ""}`)));
  assert.deepEqual(findings, [], "a document a client would be met by, carrying a detail that contradicts the tree");
  assert.equal(result.summary.unusable, 0);
});

test("no step regresses to MISSING", () => {
  assert.equal(result.summary.missing, 0);
});

test("the agreement step is carried by the TRACKED document, not only the operator copy", () => {
  const step = result.steps.find((s) => s.id === "agreement-signed");
  const tracked = step.artefacts.find((a) => a.path === "legal/Pilot-Agreement-TEMPLATE.md");
  assert.ok(tracked, "the client-facing agreement must be one of this step's artefacts");
  assert.equal(tracked.class, CLASSES.PRESENT,
    `the tracked agreement is ${tracked.class}: ${tracked.detail}`);
  const operatorCopy = step.artefacts.find((a) => a.path.startsWith("documents/"));
  assert.ok(operatorCopy, "the operator copy is KEPT and still walked (Rule 15) — it simply stops being the only one");
});

test("the two manual steps are still declared manual-by-design, with reasons", () => {
  const manual = result.steps.filter((s) => s.manualByDesign);
  assert.deepEqual(manual.map((s) => s.id), ["agreement-signed", "payment-received"],
    "the signature and the payment are the two acts that must stay human; a cycle that automated them would be the defect");
  for (const s of manual) {
    assert.ok(s.manualBecause && s.manualBecause.length > 20,
      `${s.id}: manual-by-design without a stated reason is how a gap hides`);
  }
});

test("a step that regresses is DETECTED — proven by pointing one at a file that does not exist", () => {
  const sabotaged = STEPS.map((s) => (s.id !== "agreement-signed" ? s : {
    ...s, artefacts: [{ path: "legal/this-file-does-not-exist.md", kind: "doc", must: ["nonEmpty", "contact"] }],
  }));
  const regressed = resolveYesPath({ root, steps: sabotaged });
  assert.equal(regressed.summary.complete, false, "the gate must go red when a step loses its artefact");
  assert.equal(regressed.summary.firstGap, "agreement-signed");
  assert.equal(regressed.summary.missing, 1);
  assert.deepEqual(regressed.steps.find((s) => s.id === "agreement-signed").blocks, ["invoice-raised", "payment-received"],
    "the cost of a broken step is the steps below it, and that is the sentence the operator needs");
});

test("the statement an operator reads says end to end, and names the gap when there is one", () => {
  assert.match(statementFor(result), /resolves end to end/);
});
