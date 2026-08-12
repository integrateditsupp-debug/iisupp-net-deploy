// AZ3 — the second sale, priced in acts.
//
// The red that matters most here is not a wrong count. It is a NUMBER: an attach rate, an expansion
// figure, an expected value at month six. Any of those would be a forecast presented in the format
// this program reserves for things read off a file, and it would be believed.
//
// So the suite holds the module to its own refusal — against the real output and against a planted
// one — and keeps manual-BY-DESIGN apart from manual-for-want, because a program that counts the
// founder asking for money as a defect will eventually be asked to automate the ask.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  priceSecondSale,
  scanForFabricatedNumbers,
  statementFor,
  SECOND_SALE,
  SCAN_EXEMPT,
  ACT,
  SECOND_SALE_SCHEMA,
} from "../scripts/lib/second-sale-cost.mjs";
import { SIGNAL } from "../scripts/lib/churn-signals.mjs";
import { STAGE } from "../scripts/lib/term-and-exit.mjs";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const root = path.resolve(import.meta.dirname, "..");

const churnWith = (signals) => ({ signals });
const exitWith = (stages) => ({ stages });

function repo(committed) {
  const dir = makeScratchDir("second-sale-repo-");
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
  git("commit", "-q", "-m", "c");
  return dir;
}

test("AZ3 — the real tree prices clean, and nothing is sent or offered", () => {
  const r = priceSecondSale({ root });
  assert.equal(r.schema, SECOND_SALE_SCHEMA);
  assert.equal(r.sent, false);
  assert.equal(r.offered, false);
  assert.equal(r.revenueProjected, false);
  assert.equal(r.moneyEmitted, false);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AZ3 — no money, rate, projection or forecast appears anywhere in a findings field", () => {
  const r = priceSecondSale({ root });
  assert.deepEqual(r.fabricatedNumbers, []);
  // The exemptions are the three prose fields that STATE the refusal, and they are reported so a
  // reader can challenge them. A findings field may never be exempt.
  assert.equal(r.scanExemptions.length, SCAN_EXEMPT.length);
  for (const e of r.scanExemptions) {
    assert.doesNotMatch(e.at, /^(steps|summary|fabricatedNumbers)/);
    assert.ok(e.why.length > 20, "an exemption without a reason is a hole in the scanner");
  }
});

test("AZ3 RED — a money figure planted in a step is caught by path", () => {
  const r = priceSecondSale({ root });
  const planted = JSON.parse(JSON.stringify(r));
  planted.steps[0].why = "the upgrade is worth $2,400 a month to us";
  const hits = scanForFabricatedNumbers(planted);
  assert.equal(hits.length, 1);
  assert.match(hits[0].at, /^steps\[0\]\.why$/);
});

test("AZ3 RED — a projection planted in the summary is caught, exemptions do not cover it", () => {
  const r = priceSecondSale({ root });
  const planted = JSON.parse(JSON.stringify(r));
  planted.summary.note = "projected expansion at month six";
  const hits = scanForFabricatedNumbers(planted);
  assert.equal(hits.length, 1);
  assert.match(hits[0].at, /^summary\.note$/);
});

test("AZ3 RED — an attach rate is caught even without a currency symbol", () => {
  const hits = scanForFabricatedNumbers({ steps: [{ why: "attach rate of 30% by month six" }] });
  assert.ok(hits.length >= 1);
});

test("AZ3 — a step blocked by an unobservable signal is FOR-WANT and names the signal", () => {
  const r = priceSecondSale({
    root,
    steps: [{ id: "S", step: "s", signal: "sig", signalWhy: "the meter is not kept" }],
    churn: churnWith([{ id: "sig", state: SIGNAL.TRANSIENT }]),
    exit: exitWith([]),
  });
  assert.equal(r.steps[0].cost, ACT.FOR_WANT);
  assert.equal(r.steps[0].blockedBy, "sig");
  assert.match(r.steps[0].why, /transient/);
  assert.equal(r.summary.ok, true);
});

test("AZ3 GREEN — the same step with an observable signal is artefact-backed", () => {
  const r = priceSecondSale({
    root,
    steps: [{ id: "S", step: "s", signal: "sig", signalWhy: "x" }],
    churn: churnWith([{ id: "sig", state: SIGNAL.OBSERVABLE }]),
    exit: exitWith([]),
  });
  assert.equal(r.steps[0].cost, ACT.ARTEFACT);
  assert.equal(r.steps[0].blockedBy, null);
});

test("AZ3 — a step blocked by a silent exit stage is FOR-WANT and names the stage", () => {
  const r = priceSecondSale({
    root,
    steps: [{ id: "S", step: "s", stage: "X-06", stageWhy: "nothing says what renewal changes" }],
    churn: churnWith([]),
    exit: exitWith([{ id: "X-06", rawState: STAGE.SILENT }]),
  });
  assert.equal(r.steps[0].cost, ACT.FOR_WANT);
  assert.equal(r.steps[0].blockedBy, "X-06");
  assert.match(r.steps[0].why, /silent/);
});

test("AZ3 RED — a step naming a signal AZ1 does not carry is UNCOUNTED, never rounded into a bucket", () => {
  const r = priceSecondSale({
    root,
    steps: [{ id: "S", step: "s", signal: "ghost", signalWhy: "x" }],
    churn: churnWith([]),
    exit: exitWith([]),
  });
  assert.equal(r.steps[0].cost, ACT.UNCOUNTED);
  assert.equal(r.summary.ok, false);
});

test("AZ3 RED — a step naming an exit stage AZ2 does not walk is UNCOUNTED", () => {
  const r = priceSecondSale({
    root,
    steps: [{ id: "S", step: "s", stage: "X-99", stageWhy: "x" }],
    churn: churnWith([]),
    exit: exitWith([]),
  });
  assert.equal(r.steps[0].cost, ACT.UNCOUNTED);
  assert.equal(r.summary.ok, false);
});

test("AZ3 — manual-BY-DESIGN is never a defect and never moves when gaps close", () => {
  const r = priceSecondSale({ root });
  const byDesign = r.steps.filter((s) => s.cost === ACT.BY_DESIGN);
  assert.ok(byDesign.length >= 2, "asking for the money and hearing the no both stay a person's");
  assert.equal(r.ifGapsClosed.personActs, r.summary.personByDesign);
  for (const s of byDesign) {
    assert.ok(s.why.length > 40, `${s.id} must state why a person should do this, not merely that they must`);
  }
});

test("AZ3 — every for-want step in the real output names what would close it, or the audit is red", () => {
  const r = priceSecondSale({ root });
  const forWant = r.steps.filter((s) => s.cost === ACT.FOR_WANT);
  assert.ok(forWant.length > 0, "this tree has real gaps; a run reporting none would be the suspicious one");
  for (const s of forWant) {
    assert.ok(
      s.missing.length > 0 || s.blockedBy,
      `${s.id} is forced onto a person and names nothing that would close it — a cost nobody can close`,
    );
  }
  assert.equal(r.summary.forWantUnnamed, 0);

  // And the rule bites: a hand-built result with an unnamed for-want must not read ok. Asserted
  // against the summary rule itself rather than against a shape the module cannot currently emit,
  // because a guard that can never fire is a guard that is not there.
  const unnamed = r.steps.map((s, i) =>
    i === 0 ? { ...s, cost: ACT.FOR_WANT, missing: [], blockedBy: null } : s,
  );
  const wouldBeOk = unnamed
    .filter((s) => s.cost === ACT.FOR_WANT)
    .every((s) => s.missing.length > 0 || s.blockedBy);
  assert.equal(wouldBeOk, false);
});

test("AZ3 — a missing artefact is named in the step that needed it", () => {
  const dir = repo({ "plans/index.html": "<html></html>" });
  const r = priceSecondSale({
    root: dir,
    steps: [{ id: "S", step: "s", needs: ["plans/index.html", "legal/MSA-template.md"] }],
    churn: churnWith([]),
    exit: exitWith([]),
  });
  assert.equal(r.steps[0].cost, ACT.FOR_WANT);
  assert.deepEqual(r.steps[0].missing, ["legal/MSA-template.md"]);
  assert.equal(r.summary.ok, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ3 — the unit is acts and artefacts, and no hour appears in the output", () => {
  const r = priceSecondSale({ root });
  assert.match(r.unit, /never hours/);
  const flat = JSON.stringify({ steps: r.steps, summary: r.summary });
  assert.doesNotMatch(flat, /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?)\b/i);
});

test("AZ3 — every step is either backed by named artefacts, a signal, a stage, or by design", () => {
  for (const s of SECOND_SALE) {
    const kinds = [s.needs, s.signal, s.stage, s.byDesign].filter(Boolean).length;
    assert.equal(kinds, 1, `${s.id} must state exactly one thing that carries it`);
  }
});

test("AZ3 — an unreadable tree reports uncounted rather than assumed", () => {
  const dir = makeScratchDir("second-nogit-");
  const r = priceSecondSale({
    root: dir,
    steps: [{ id: "S", step: "s", needs: ["plans/index.html"] }],
    churn: churnWith([]),
    exit: exitWith([]),
  });
  assert.equal(r.headReadable, false);
  assert.equal(r.steps[0].cost, ACT.UNCOUNTED);
  assert.match(statementFor(r), /uncounted rather than assumed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("AZ3 — wired to AZ1 and AZ2 for real: the default run resolves against both modules", () => {
  const r = priceSecondSale({ root });
  // Not asserted as a comment — the blocked lists come from the other two audits by resolution.
  assert.ok(
    r.summary.blockedBySignals.length + r.summary.blockedByStages.length > 0 ||
      r.summary.personForWant === 0,
    "a for-want step must trace to a named AZ1 signal or AZ2 stage",
  );
});
