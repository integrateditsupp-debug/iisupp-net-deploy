// AY3 — the first week of a paying customer, priced in acts.
//
// The reds that matter here are the ones that keep the UNIT honest: no hour may appear anywhere in
// the output, a step forced onto a person must name the artefact that would have carried it, and
// manual-BY-DESIGN must never be counted as a defect — because a program that treats the founder's
// welcome call as a gap will eventually be asked to automate it.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { priceFirstWeek, statementFor, FIRST_WEEK, ACT, FIRST_WEEK_SCHEMA } from "../scripts/lib/first-week-cost.mjs";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const root = path.resolve(import.meta.dirname, "..");

function repo(committed) {
  const dir = makeScratchDir("first-week-repo-");
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

test("AY3 — the first week is priced against the real tree and nothing is sent or scheduled", () => {
  const r = priceFirstWeek({ root });
  assert.equal(r.schema, FIRST_WEEK_SCHEMA);
  assert.equal(r.sent, false);
  assert.equal(r.scheduled, false);
  assert.equal(r.mailPathTouched, false);
  assert.equal(r.summary.ok, true, statementFor(r));
});

test("AY3 — the unit is acts and artefacts, never hours", () => {
  const r = priceFirstWeek({ root });
  assert.match(r.unit, /never hours/);
  // The whole output, so a duration cannot creep in through a `why` string somebody wrote later.
  const blob = JSON.stringify(r);
  assert.doesNotMatch(blob, /\b\d+(\.\d+)?\s*(hour|hours|hr|hrs|minute|minutes|min)\b/i,
    "an hour figure nobody timed is a fabricated metric under Rule 14, however reasonable it sounds");
  assert.doesNotMatch(blob, /\bman-?(hour|day)s?\b/i);
});

test("AY3 — nothing is uncounted: a cost silently assigned is a cost nobody will check", () => {
  const r = priceFirstWeek({ root });
  assert.equal(r.summary.uncounted, 0);
  assert.equal(r.summary.total, r.summary.artefactBacked + r.summary.personByDesign + r.summary.personForWant);
});

test("AY3 — every step either names the artefacts that carry it or states why a person must do it", () => {
  for (const s of FIRST_WEEK) {
    assert.ok(s.id && /^W-\d\d$/.test(s.id), "steps are identified so a change to the week is reviewable");
    assert.ok(Number.isInteger(s.day) && s.day >= 1 && s.day <= 5, `${s.id} sits on a working day`);
    assert.ok(s.step && s.step.split(/\s+/).length >= 5, `${s.id} must describe what happens`);
    const backed = Array.isArray(s.needs) && s.needs.length > 0;
    const byDesign = typeof s.byDesign === "string" && s.byDesign.split(/\s+/).length >= 10;
    assert.ok(backed !== byDesign, `${s.id} must be exactly one of artefact-backed or by-design, and by-design must argue for itself`);
  }
});

test("AY3 — manual-BY-DESIGN is kept apart from manual-for-want, and is never a defect", () => {
  const r = priceFirstWeek({ root });
  const byDesign = r.steps.filter((s) => s.cost === ACT.BY_DESIGN);
  assert.ok(byDesign.length > 0, "some of this week is a person, and should be");
  for (const s of byDesign) {
    assert.deepEqual(s.missing, [], "a by-design act is never blocked by a missing artefact");
    assert.ok(s.why.length > 40, "it argues for itself rather than being asserted");
  }
  assert.equal(r.ifGapsClosed.personActs, byDesign.length, "closing every gap does not move it, and should not");
  assert.match(r.ifGapsClosed.note, /should not/);
});

test("AY3 RED — remove an artefact and the step moves to person-for-want, naming what is missing", () => {
  const step = [{ id: "W-01", day: 1, step: "the administrator is handed the integration guide", needs: ["guides/entra.md"] }];
  const withIt = repo({ "guides/entra.md": "how to connect" });
  const without = repo({ "other.md": "x" });
  try {
    const a = priceFirstWeek({ root: withIt, steps: step });
    assert.equal(a.steps[0].cost, ACT.ARTEFACT);
    assert.equal(a.summary.ok, true);

    const b = priceFirstWeek({ root: without, steps: step });
    assert.equal(b.steps[0].cost, ACT.FOR_WANT);
    assert.deepEqual(b.steps[0].missing, ["guides/entra.md"], "named, so closing the gap and moving the number are the same act");
    assert.match(b.steps[0].why, /only because/);
    assert.equal(b.summary.personForWant, 1);
  } finally {
    fs.rmSync(withIt, { recursive: true, force: true });
    fs.rmSync(without, { recursive: true, force: true });
  }
});

test("AY3 — every for-want act names its missing artefact; forWantUnnamed is the state that refuses", () => {
  const dir = repo({ "x.md": "x" });
  try {
    const r = priceFirstWeek({
      root: dir,
      steps: [{ id: "W-01", day: 1, step: "the administrator is handed the integration guide", needs: ["gone.md"] }],
    });
    assert.equal(r.steps[0].cost, ACT.FOR_WANT);
    assert.ok(r.steps[0].missing.length > 0, "a person-act with nothing named is a cost nobody can close");
    assert.equal(r.summary.forWantUnnamed, 0);
    // And on the real week: every person-act is either argued by-design or names what is missing.
    const real = priceFirstWeek({ root });
    for (const s of real.steps.filter((x) => x.cost !== ACT.ARTEFACT)) {
      assert.ok(s.why && s.why.length > 20, `${s.id} must say why a person is doing this`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY3 RED — an unreadable HEAD makes every artefact step UNCOUNTED, never assumed fine", () => {
  const dir = makeScratchDir("not-a-repo-");
  try {
    const r = priceFirstWeek({ root: dir, steps: [{ id: "W-01", day: 1, step: "the tenant is set up for the customer", needs: ["a.md"] }] });
    assert.equal(r.steps[0].cost, ACT.UNCOUNTED);
    assert.equal(r.summary.ok, false);
    assert.match(statementFor(r), /uncounted rather than assumed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY3 — HEAD's tree is the source, so an artefact only on this machine does not carry a step", () => {
  const dir = repo({ "x.md": "x" });
  try {
    fs.writeFileSync(path.join(dir, "ghost.md"), "exists on disk only");
    const r = priceFirstWeek({ root: dir, steps: [{ id: "W-01", day: 1, step: "the customer is handed the ghost guide", needs: ["ghost.md"] }] });
    assert.equal(r.steps[0].cost, ACT.FOR_WANT, "a document a clone cannot produce does not carry a promise");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY3 — the week is reported day by day, because a week is not a single number", () => {
  const r = priceFirstWeek({ root });
  const days = Object.keys(r.byDay).map(Number).sort((a, b) => a - b);
  assert.deepEqual(days, [1, 2, 3, 4, 5]);
  const total = days.reduce((n, d) => n + r.byDay[d].steps, 0);
  assert.equal(total, r.summary.total, "every step lands on exactly one day");
  assert.ok(r.byDay[1].steps > 0, "day one is the day the customer decides whether they were right to pay");
});

test("AY3 — ifGapsClosed is computed from what was read, not asserted", () => {
  const step = [
    { id: "W-01", day: 1, step: "the administrator is handed the integration guide", needs: ["gone.md"] },
    { id: "W-02", day: 1, step: "the founder welcomes the customer by name", byDesign: "a customer who just paid a one-person company wants to know a person received it" },
  ];
  const dir = repo({ "x.md": "x" });
  try {
    const r = priceFirstWeek({ root: dir, steps: step });
    assert.equal(r.summary.artefactBacked, 0);
    assert.equal(r.summary.personForWant, 1);
    assert.equal(r.ifGapsClosed.artefactBacked, 1, "closing the named gap is what would move it");
    assert.equal(r.ifGapsClosed.personActs, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AY3 — the window is named, so nobody reads this as the whole relationship", () => {
  const r = priceFirstWeek({ root });
  assert.match(r.window, /second one/, "the point of the week is whether there is a second invoice");
});
