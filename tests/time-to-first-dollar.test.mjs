// time-to-first-dollar.test.mjs — RUN-AT / AT3.
//
// The claim under test: the distance between a yes and money is COUNTED from artefacts, the two
// kinds of manual are kept apart, and anything unreadable is reported as uncounted with a reason.
//
// RED-FIRST:
//   · a step manual by design is manual and is NOT counted as a gap
//   · a step manual because nothing exists IS counted as a gap
//   · a step with no artefact is UNCOUNTED with its reason, never estimated to zero
//   · the longest step is named from the counts, and when nothing has blanks that is SAID
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countTimeToFirstDollar, statementFor, REASONS, TTFD_SCHEMA } from "../scripts/lib/time-to-first-dollar.mjs";
import { CLASSES } from "../scripts/lib/yes-path.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const step = (id, cls, { manual = false, artefacts = [] } = {}) => ({
  id, name: id, class: cls,
  manualByDesign: manual,
  manualBecause: manual ? "a person must do this" : null,
  artefacts, blocks: null,
});
const art = (p, cls, inputs) => ({ path: p, class: cls, detail: "", findings: [], handInputs: inputs });

const walk = (steps) => ({ schema: "yes-path/1", trackedReadable: true, contact: {}, steps, summary: {} });

test("AT3 · a step manual BY DESIGN is manual and is not a gap", () => {
  const r = countTimeToFirstDollar({
    path: walk([step("sign", CLASSES.PRESENT, { manual: true, artefacts: [art("a.md", CLASSES.PRESENT, 4)] })]),
  });
  assert.equal(r.schema, TTFD_SCHEMA);
  assert.equal(r.summary.manualSteps, 1);
  assert.equal(r.summary.manualByDesign, 1);
  assert.equal(r.summary.manualBecauseNothingCarriesIt, 0);
  assert.match(r.steps[0].manualBecause, /a person must do this/);
});

test("AT3 · a step manual because nothing carries it IS a gap, and says so", () => {
  const r = countTimeToFirstDollar({
    path: walk([step("scope", CLASSES.MISSING, { artefacts: [art("gone.md", CLASSES.MISSING, null)] })]),
  });
  assert.equal(r.summary.manualByDesign, 0);
  assert.equal(r.summary.manualBecauseNothingCarriesIt, 1);
  assert.match(r.steps[0].manualBecause, /nothing carried does this step/);
});

test("AT3 · a step with no readable artefact is UNCOUNTED with its reason, never zero", () => {
  const r = countTimeToFirstDollar({
    path: walk([step("scope", CLASSES.MISSING, { artefacts: [art("gone.md", CLASSES.MISSING, null)] })]),
  });
  assert.equal(r.steps[0].handInputs, null);
  assert.equal(r.summary.handInputsCounted, 0);
  assert.equal(r.summary.stepsUncounted, 1);
  assert.equal(r.summary.uncounted[0].reason, REASONS.NO_ARTEFACT);
});

test("AT3 · the longest step is named from the counts", () => {
  const r = countTimeToFirstDollar({
    path: walk([
      step("book", CLASSES.PRESENT, { artefacts: [art("book.html", CLASSES.PRESENT, 8)] }),
      step("sign", CLASSES.PRESENT, { manual: true, artefacts: [art("agreement.md", CLASSES.PRESENT, 12)] }),
    ]),
  });
  assert.equal(r.summary.longestStep.id, "sign");
  assert.equal(r.summary.longestStep.handInputs, 12);
  assert.equal(r.summary.longestStep.countedFrom, "agreement.md");
  assert.equal(r.summary.handInputsCounted, 20);
  assert.match(statementFor(r), /longest is "sign" at 12 blanks/);
});

test("AT3 · when nothing has a blank, that is stated instead of a silent null", () => {
  const r = countTimeToFirstDollar({
    path: walk([step("pay", CLASSES.PRESENT, { artefacts: [art("webhook.js", CLASSES.PRESENT, 0)] })]),
  });
  assert.equal(r.summary.longestStep, null);
  assert.match(r.summary.longestStepReason, /no counted step has a blank/);
  assert.match(statementFor(r), /no counted step has a blank/);
});

test("AT3 · an untracked artefact still counts as carried for effort, and stays non-present", () => {
  const r = countTimeToFirstDollar({
    path: walk([step("sign", CLASSES.UNTRACKED, { manual: true, artefacts: [art("local/a.md", CLASSES.UNTRACKED, 5)] })]),
  });
  assert.equal(r.steps[0].carried, true);
  assert.equal(r.steps[0].handInputs, 5);
  assert.equal(r.summary.manualBecauseNothingCarriesIt, 0, "untracked is a delivery problem, not an improvised step");
});

test("AT3 · the real tree: the count runs and every step is counted or explained", () => {
  const r = countTimeToFirstDollar({ root: REPO });
  assert.ok(r.summary.totalSteps >= 6);
  assert.equal(
    r.summary.stepsCounted + r.summary.stepsUncounted,
    r.summary.totalSteps,
    "every step is either counted or carries a reason it is not",
  );
  for (const u of r.summary.uncounted) assert.ok(u.reason && u.reason.length > 10, `${u.id} explains itself`);
  assert.ok(r.summary.manualByDesign >= 2, "the signature and the payment stay human");
  assert.equal(typeof statementFor(r), "string");
});
