// ab1-moves-without-us.test.mjs — RUN-AB. Covers AB1 passive-outcomes, AB2 passive-surface,
// AB3 moves-without-us.
//
// The point of this suite is to make the three refusals in RUN-AB structurally impossible to remove:
//   1. `delivered` can never become a number (AB1).
//   2. A passive signal can never be manufactured from a proxy, and "nothing measurable" must be the
//      PRIMARY output rather than a footnote (AB2).
//   3. Software progress can never move an item into the "moves on its own" column, and an empty column
//      renders empty with no consolation (AB3).

import assert from "node:assert/strict";
import test from "node:test";

import {
  measureOutcomes, renderOutcomes, computeRates,
  UNOBSERVED, UNVERIFIED, LEGAL_DENOMINATORS, OBSERVED_KINDS,
  SENDS as OUT_SENDS, HAS_TRANSPORT as OUT_TRANSPORT, PERSISTS as OUT_PERSISTS,
} from "../src/shared/passive-outcomes.mjs";

import {
  assessPassiveSurface, renderPassiveSurface, SIGNAL_CATALOGUE,
  FORBIDDEN_PROXIES, NOT_MEASURABLE, MEASURABLE, REFUSAL_HEADLINE,
  FETCHES,
} from "../src/shared/passive-surface.mjs";

import {
  classifyItem, splitItems, renderSplit,
  COL_HUMAN, COL_SELF, REJECTED_MECHANISMS, REJECTED_VOCABULARY, CONSOLATION_PATTERNS,
  EMPTY_SELF_COLUMN_LINE,
} from "../src/shared/moves-without-us.mjs";

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────
const REAL_SHAPE = {
  schema: "outbound-record.v1",
  readAt: "2026-07-29T06:00:00Z",
  completeness:
    "Every event below was observed directly. Sends outside the 3-day window are a floor, not a total.",
  events: [
    ...Array.from({ length: 45 }, (_, i) => ({ kind: "sent", at: "2026-07-28T20:00:00Z", handle: `OB-S${i}` })),
    ...Array.from({ length: 4 }, (_, i) => ({ kind: "undeliverable", at: "2026-07-24T21:00:00Z", handle: `OB-U${i}`, reason: "address not found" })),
    ...Array.from({ length: 11 }, (_, i) => ({ kind: "auto-reply", at: "2026-07-28T19:00:00Z", handle: `OB-A${i}`, reason: "out of office" })),
    { kind: "personal-reply", at: "2026-07-22T14:39:32Z", handle: "OB-P01", disposition: "declined", reason: "not looking for an MSP" },
  ],
};

// ── AB1 ─────────────────────────────────────────────────────────────────────────────────────────────

test("AB1 purity flags", () => {
  assert.equal(OUT_SENDS, false);
  assert.equal(OUT_TRANSPORT, false);
  assert.equal(OUT_PERSISTS, false);
});

test("AB1 measures the whole record, not a 3-day window", () => {
  const m = measureOutcomes(REAL_SHAPE);
  assert.equal(m.sent, 45);
  assert.equal(m.undeliverable, 4);
  assert.equal(m.autoReplied, 11);
  assert.equal(m.personallyReplied, 1);
});

test("AB1 delivered is unobserved and NEVER a number, at every volume", () => {
  for (const n of [0, 1, 45, 1000]) {
    const rec = { ...REAL_SHAPE, events: Array.from({ length: n }, (_, i) => ({ kind: "sent", at: "2026-07-28T20:00:00Z", handle: `H${i}` })) };
    const m = measureOutcomes(rec);
    assert.equal(m.delivered, UNOBSERVED, `delivered became a value at n=${n}`);
    assert.equal(typeof m.delivered, "string");
    assert.equal(Number.isFinite(Number(m.delivered)), false);
  }
});

test("AB1 opened / read / forwarded are unobserved too", () => {
  const m = measureOutcomes(REAL_SHAPE);
  for (const k of ["opened", "read", "forwarded"]) assert.equal(m[k], UNOBSERVED, k);
});

test("AB1 an unobserved outcome renders `unobserved`, never 0", () => {
  const txt = renderOutcomes(measureOutcomes(REAL_SHAPE));
  assert.match(txt, /delivered:\s+unobserved/);
  assert.doesNotMatch(txt, /delivered:\s+0\b/);
});

test("AB1 no record means unverified everywhere — not zero", () => {
  const m = measureOutcomes(null);
  assert.equal(m.state, UNVERIFIED);
  for (const k of ["sent", "undeliverable", "autoReplied", "personallyReplied", "silent"]) {
    assert.equal(m[k], UNVERIFIED, `${k} collapsed to a number with no record`);
  }
  assert.equal(m.delivered, UNOBSERVED);
});

test("AB1 silence is derived by absence and is labelled as derived", () => {
  const m = measureOutcomes(REAL_SHAPE);
  assert.equal(m.silent, 45 - (4 + 11 + 1));
  assert.equal(m.silentIsDerived, true);
  const txt = renderOutcomes(m);
  assert.match(txt, /silent \(derived by absence\)/);
  assert.match(txt, /Silent is an absence of observation, not an observed event/);
});

test("AB1 silence never goes negative when observed outcomes exceed observed sends", () => {
  const rec = { ...REAL_SHAPE, events: [
    { kind: "sent", at: "2026-07-28T20:00:00Z", handle: "A" },
    ...Array.from({ length: 9 }, (_, i) => ({ kind: "auto-reply", at: "2026-07-28T20:00:00Z", handle: `B${i}` })),
  ] };
  assert.equal(measureOutcomes(rec).silent, 0);
});

test("AB1 no rate is computed against delivered", () => {
  const m = measureOutcomes(REAL_SHAPE);
  const overDelivered = m.rates.find((r) => /delivered/i.test(r.denominator));
  assert.ok(overDelivered, "the delivered denominator must be named, not omitted");
  assert.equal(overDelivered.value, UNOBSERVED);
  assert.equal(overDelivered.observed, false);
});

test("AB1 every computed rate carries its denominator and it is a legal one", () => {
  const m = measureOutcomes(REAL_SHAPE);
  for (const r of m.rates.filter((x) => x.observed === true)) {
    assert.ok(r.denominator && /sent/.test(r.denominator), `illegal denominator: ${r.denominator}`);
  }
  assert.deepEqual(LEGAL_DENOMINATORS, ["sent"]);
  assert.equal(LEGAL_DENOMINATORS.includes("delivered"), false);
});

test("AB1 zero sends produces no rate at all, not a 0% rate", () => {
  const rates = computeRates({ sent: 0, undeliverable: 0, autoReplied: 0, personallyReplied: 0 });
  assert.equal(rates.length, 1);
  assert.equal(rates[0].value, UNVERIFIED);
});

test("AB1 the completeness note survives verbatim into the rendering", () => {
  const m = measureOutcomes(REAL_SHAPE);
  assert.equal(m.completeness, REAL_SHAPE.completeness);
  assert.ok(renderOutcomes(m).includes(REAL_SHAPE.completeness), "floor-not-total note was dropped");
});

test("AB1 a missing completeness note is unverified, not silently absent", () => {
  const { completeness, ...noNote } = REAL_SHAPE;
  assert.equal(measureOutcomes(noNote).completeness, UNVERIFIED);
});

test("AB1 a decline is counted as a personal reply and its disposition is reported separately", () => {
  const m = measureOutcomes(REAL_SHAPE);
  assert.equal(m.personallyReplied, 1);
  assert.equal(m.dispositions.length, 1);
  assert.equal(m.dispositions[0].disposition, "declined");
  const txt = renderOutcomes(m);
  assert.match(txt, /personally replied \(obs\.\):\s+1/);
  assert.match(txt, /declined/);
});

test("AB1 an auto-reply is never counted as a personal reply, and a bounce is never a landing", () => {
  const m = measureOutcomes(REAL_SHAPE);
  assert.notEqual(m.autoReplied, m.personallyReplied);
  assert.equal(m.personallyReplied, 1);
  assert.equal(m.delivered, UNOBSERVED); // 4 bounces did not turn 41 into "delivered"
});

test("AB1 an unrecognised kind is carried, never silently discarded", () => {
  const rec = { ...REAL_SHAPE, events: [...REAL_SHAPE.events, { kind: "opened", at: "2026-07-28T20:00:00Z", handle: "X" }] };
  const m = measureOutcomes(rec);
  assert.equal(m.unrecognised.length, 1);
  assert.match(m.unrecognised[0].reason, /unrecognised kind: opened/);
  assert.equal(OBSERVED_KINDS.includes("opened"), false);
});

test("AB1 build counters cannot move a single number", () => {
  const base = measureOutcomes(REAL_SHAPE);
  const poisoned = measureOutcomes({
    ...REAL_SHAPE, sequencesCompleted: 28, testsGreen: 999, commits: 100, tasksMerged: 50,
  });
  assert.deepEqual(poisoned.sent, base.sent);
  assert.deepEqual(poisoned.silent, base.silent);
  assert.equal(renderOutcomes(poisoned), renderOutcomes(base));
});

test("AB1 renders no identity", () => {
  const txt = renderOutcomes(measureOutcomes(REAL_SHAPE));
  assert.doesNotMatch(txt, /[\w.+-]+@[\w-]+\.[\w.]+/, "an address reached the rendering");
});

// ── AB2 ─────────────────────────────────────────────────────────────────────────────────────────────

test("AB2 cannot fetch anything and does not pretend to", () => {
  assert.equal(FETCHES, false);
});

test("AB2 today's honest answer is a refusal, and it is the PRIMARY output", () => {
  const a = assessPassiveSurface({ now: "2026-07-29T06:00:00Z" });
  assert.equal(a.isRefusal, true);
  assert.equal(a.anyMeasurable, false);
  assert.equal(a.headline, REFUSAL_HEADLINE);
  const txt = renderPassiveSurface(a);
  const firstContentLine = txt.split("\n").filter((l) => l.trim())[1];
  assert.ok(firstContentLine.startsWith("No passive signal is measurable today"), `refusal was demoted: ${firstContentLine}`);
});

test("AB2 the refusal is dated", () => {
  const txt = renderPassiveSurface(assessPassiveSurface({ now: "2026-07-29T06:00:00Z" }));
  assert.match(txt, /as at 2026-07-29/);
});

test("AB2 a refusal is explicitly not a zero", () => {
  const a = assessPassiveSurface({ now: "2026-07-29T06:00:00Z" });
  assert.match(renderPassiveSurface(a), /This is a refusal, not a zero/);
});

test("AB2 every unobservable signal is NAMED and marked, never omitted", () => {
  const a = assessPassiveSurface({ now: "2026-07-29T06:00:00Z" });
  assert.equal(a.signals.length, SIGNAL_CATALOGUE.length);
  const txt = renderPassiveSurface(a);
  for (const s of SIGNAL_CATALOGUE) {
    assert.ok(txt.includes(s.label), `signal omitted from rendering: ${s.label}`);
    assert.equal(a.signals.find((x) => x.id === s.id).state, NOT_MEASURABLE);
  }
});

test("AB2 every unobservable signal states what would make it measurable", () => {
  for (const s of assessPassiveSurface({ now: "2026-07-29T06:00:00Z" }).signals) {
    assert.ok(s.whatWouldMakeItMeasurable.length > 20, `vague unblock for ${s.id}`);
    assert.doesNotMatch(s.whatWouldMakeItMeasurable, /^add analytics\.?$/i);
  }
});

test("AB2 no forbidden proxy can be promoted into a measurable signal", () => {
  const a = assessPassiveSurface({ now: "2026-07-29T06:00:00Z", reachableRecords: FORBIDDEN_PROXIES.slice() });
  assert.equal(a.anyMeasurable, false, "a proxy was promoted into a passive signal");
  assert.equal(a.isRefusal, true);
  for (const p of FORBIDDEN_PROXIES) {
    assert.equal(SIGNAL_CATALOGUE.some((s) => s.id === p), false, `${p} is in the signal catalogue`);
  }
});

test("AB2 a signal only becomes measurable when a named reachable record backs it", () => {
  const a = assessPassiveSurface({ now: "2026-07-29T06:00:00Z", reachableRecords: ["form-submissions"] });
  assert.equal(a.anyMeasurable, true);
  assert.equal(a.measurableCount, 1);
  assert.equal(a.isRefusal, false);
  assert.equal(a.signals.find((s) => s.id === "form-submissions").state, MEASURABLE);
  assert.equal(a.signals.find((s) => s.id === "site-visits").state, NOT_MEASURABLE);
});

test("AB2 an undated assessment says unverified rather than inventing today", () => {
  assert.equal(assessPassiveSurface({}).assessedAt, "unverified");
});

// ── AB3 ─────────────────────────────────────────────────────────────────────────────────────────────

const GOOD_MECH = {
  handle: "IT-01", label: "an item with a real mechanism",
  mechanism: { name: "an autoresponder stating a return date", observedAt: "2026-07-28T19:53:03Z", observable: true, observableVia: "the outbound mail record" },
};

test("AB3 an item with a named, dated, observable mechanism goes right", () => {
  assert.equal(classifyItem(GOOD_MECH).column, COL_SELF);
});

test("AB3 every rejected software mechanism fails to move an item right", () => {
  for (const bad of REJECTED_MECHANISMS) {
    const c = classifyItem({
      handle: "IT-X", label: "software progress",
      mechanism: { name: `the module was ${bad}`, observedAt: "2026-07-29T00:00:00Z", observable: true, observableVia: "the repo" },
    });
    assert.equal(c.column, COL_HUMAN, `"${bad}" moved an item into the second column`);
    assert.ok(c.missing.some((m) => /software progress/.test(m)));
  }
});

test("AB3 REPHRASED software progress is still rejected (the defect this suite caught)", () => {
  // "the suite is green" is three characters away from "suite green" and slipped through a substring
  // match on first run. Any wording of our own building must fail.
  const rephrasings = [
    "the suite is green", "all tests are passing", "the code exists and is deployed",
    "we shipped the module", "the branch has been merged", "the site is up and reachable",
    "twenty-eight sequences are complete", "version 2 was released", "the repo builds cleanly",
  ];
  for (const name of rephrasings) {
    const c = classifyItem({
      handle: "IT-R", label: "rephrased software progress",
      mechanism: { name, observedAt: "2026-07-29T00:00:00Z", observable: true, observableVia: "the repo" },
    });
    assert.equal(c.column, COL_HUMAN, `"${name}" was promoted into the second column`);
  }
  assert.ok(REJECTED_VOCABULARY.length > 20);
});

test("AB3 a real prospect-side mechanism still passes after the vocabulary tightening", () => {
  // The tightening must not become a blanket refusal — that would be honest-looking and useless.
  assert.equal(classifyItem(GOOD_MECH).column, COL_SELF);
  assert.equal(classifyItem({
    handle: "IT-Z", label: "a stated return date",
    mechanism: { name: "a prospect stated a date on which they return", observedAt: "2026-07-28T19:00:00Z", observable: true, observableVia: "the outbound mail record" },
  }).column, COL_SELF);
});

test("AB3 a mechanism with no date falls left, with the missing piece stated", () => {
  const c = classifyItem({ ...GOOD_MECH, mechanism: { ...GOOD_MECH.mechanism, observedAt: null } });
  assert.equal(c.column, COL_HUMAN);
  assert.ok(c.missing.includes("no date on which it was observed"));
});

test("AB3 a mechanism with no way to observe it falls left", () => {
  const c = classifyItem({ ...GOOD_MECH, mechanism: { ...GOOD_MECH.mechanism, observable: false } });
  assert.equal(c.column, COL_HUMAN);
  assert.ok(c.missing.includes("no stated way to observe it"));
});

test("AB3 an aspiration is not a mechanism", () => {
  const c = classifyItem({ handle: "IT-Y", label: "the site should generate leads", mechanism: null });
  assert.equal(c.column, COL_HUMAN);
  assert.equal(c.missing.length, 3);
});

test("AB3 an unparseable date is not a date", () => {
  const c = classifyItem({ ...GOOD_MECH, mechanism: { ...GOOD_MECH.mechanism, observedAt: "soon" } });
  assert.equal(c.column, COL_HUMAN);
});

test("AB3 every item lands in exactly one column, never both, never neither", () => {
  const items = [GOOD_MECH, { handle: "A", label: "a", mechanism: null }, { handle: "B", label: "b" }];
  const s = splitItems(items, { now: "2026-07-29T06:00:00Z" });
  assert.equal(s.human.length + s.self.length, s.total);
  assert.equal(s.total, items.length);
  const handles = [...s.human, ...s.self].map((c) => c.handle);
  assert.equal(new Set(handles).size, handles.length);
});

test("AB3 an empty right column renders empty, with no consolation", () => {
  const s = splitItems([{ handle: "A", label: "waits on the hour", mechanism: null }], { now: "2026-07-29T06:00:00Z" });
  assert.equal(s.selfIsEmpty, true);
  const txt = renderSplit(s);
  assert.ok(txt.includes(EMPTY_SELF_COLUMN_LINE));
  for (const p of CONSOLATION_PATTERNS) {
    assert.doesNotMatch(txt, p, `consolation vocabulary in the empty-column rendering: ${p}`);
  }
});

test("AB3 the today answer for this program: nothing moves on its own", () => {
  // The real open items as at 2026-07-29. Every one of them waits on a person.
  const real = [
    { handle: "OPEN-01", label: "follow-ups drafted and not sent", mechanism: null },
    { handle: "OPEN-02", label: "warm routes handed back by prospects", mechanism: null },
    { handle: "OPEN-03", label: "the live site", mechanism: { name: "the site is up", observedAt: "2026-07-29T00:00:00Z", observable: true, observableVia: "the browser" } },
    { handle: "OPEN-04", label: "twenty-eight built sequences", mechanism: { name: "the suite is green", observedAt: "2026-07-29T00:00:00Z", observable: true, observableVia: "the runner" } },
  ];
  const s = splitItems(real, { now: "2026-07-29T06:00:00Z" });
  assert.equal(s.selfIsEmpty, true, "an item claimed to move on its own — check its evidence before believing it");
  assert.equal(s.human.length, 4);
});

test("AB3 renders no identity", () => {
  const txt = renderSplit(splitItems([GOOD_MECH], { now: "2026-07-29T06:00:00Z" }));
  assert.doesNotMatch(txt, /[\w.+-]+@[\w-]+\.[\w.]+/);
});
