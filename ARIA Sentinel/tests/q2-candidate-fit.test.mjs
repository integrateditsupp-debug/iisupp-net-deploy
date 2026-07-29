// q2-candidate-fit.test.mjs — RUN-Q Q2 exit criteria, test-locked.
// Scoring is deterministic and reproducible; a missing dimension is STATED, never averaged; the top
// of the list explains itself; unscoreable candidates stay visible.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CANDIDATE_FIT_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, UNKNOWN,
  DIMENSIONS, DIMENSION_KEYS, MAX_SCORE, EMPTY_STATEMENT, NO_GUESSING_NOTE,
  scoreCandidate, rankCandidates, candidateFitMarkdown,
} from "../src/shared/candidate-fit.mjs";
import { recordCandidate, buildCandidateList } from "../src/shared/candidate-record.mjs";
import { UNKNOWN as TRUTH_UNKNOWN, momentumSafe } from "../src/shared/program-truth.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function candidate(key, over = {}) {
  const r = recordCandidate({
    key,
    enteredBy: "Ahmad",
    name: { value: `Org ${key}`, source: "i met their ops manager at the Whitby chamber breakfast on 2026-07-14" },
    contact: { value: `ops@${key}.example`, source: "printed on the business card he handed me at that breakfast" },
    problemBasis: { value: "their two-person IT team is on call overnight", source: "he said it out loud at that breakfast, unprompted" },
  }, { now: NOW });
  assert.equal(r.refused, false, "fixture setup must record");
  return { ...r.candidate, ...over };
}

const FULL = { ...candidate("cand-001"), observed: { seats: 40, currentSpendCad: 2200 } };

test("Q2: belt-and-braces — scoring sends nothing and guesses nothing", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(UNKNOWN, TRUTH_UNKNOWN, "Q2 uses program-truth's OWN unknown vocabulary, never its own");
  assert.equal(scoreCandidate(FULL).guessing, false);
  assert.equal(rankCandidates([FULL]).guessing, false);
});

test("Q2: a fully recorded candidate scores, and the score is built only from recorded facts", () => {
  const s = scoreCandidate(FULL);
  assert.equal(s.schema, CANDIDATE_FIT_SCHEMA);
  assert.equal(s.scoreable, true);
  assert.equal(s.score, MAX_SCORE);
  assert.equal(s.display, `${MAX_SCORE}/${MAX_SCORE}`);
  assert.deepEqual(s.notEstablished, []);
  for (const d of s.dimensions) {
    assert.ok(DIMENSION_KEYS.includes(d.key));
    assert.equal(d.established, true);
    assert.ok(d.reason.length > 10, "every dimension explains itself in words");
  }
});

test("Q2: a missing dimension reads 'not established' and REFUSES the whole score — never averaged", () => {
  // No size facts observed at all.
  const s = scoreCandidate(candidate("cand-002"));
  assert.equal(s.scoreable, false);
  assert.equal(s.score, null, "there is no partial number, not even a low one");
  assert.equal(s.display, UNKNOWN);
  assert.deepEqual(s.notEstablished, ["sizeKnown"]);
  const dim = s.dimensions.find((d) => d.key === "sizeKnown");
  assert.equal(dim.established, false);
  assert.equal(dim.points, null);
  assert.equal(dim.display, UNKNOWN);
  assert.ok(s.reason.includes("refused rather than averaged"));
  // The refusal names the dimension, so a human knows which hole to fill.
  assert.ok(s.reason.includes(dim.label));
});

test("Q2: an empty candidate refuses on every dimension and invents nothing", () => {
  const s = scoreCandidate({ key: "cand-000" });
  assert.equal(s.scoreable, false);
  assert.equal(s.score, null);
  assert.deepEqual(s.notEstablished.slice().sort(), DIMENSION_KEYS.slice().sort());
  const nothing = scoreCandidate(undefined);
  assert.equal(nothing.scoreable, false);
  assert.equal(nothing.score, null);
  assert.equal(nothing.key, null);
});

test("Q2: scoring is deterministic and reproducible — same input, same output, any input order", () => {
  const a = candidate("cand-a", { observed: { seats: 10, currentSpendCad: 900 } });
  const b = candidate("cand-b", { observed: { seats: 80, currentSpendCad: 4000 } });
  const c = candidate("cand-c");
  const one = rankCandidates([a, b, c]);
  const two = rankCandidates([c, b, a]);
  assert.deepEqual(JSON.parse(JSON.stringify(one)), JSON.parse(JSON.stringify(two)),
    "input order may not change the ranking");
  assert.deepEqual(scoreCandidate(a), scoreCandidate(a), "the same candidate scores identically twice");
  // Ties break on the stable local handle, never on iteration order.
  assert.deepEqual(one.ranked.map((r) => r.key), ["cand-a", "cand-b"]);
});

test("Q2: every position explains itself AND carries the single fact that would most change it", () => {
  const r = rankCandidates([FULL, candidate("cand-002")]);
  for (const s of r.ranked) {
    assert.ok(s.position >= 1, "a scored candidate has a position");
    assert.ok(s.reason.length > 20, "the position explains itself");
  }
  const unscoreable = r.needsOneFact[0];
  assert.ok(unscoreable.mostChangingFact, "an unscoreable candidate names its one lever");
  assert.equal(unscoreable.mostChangingFact.dimension, "sizeKnown");
  assert.ok(unscoreable.mostChangingFact.findOut.length > 15, "the lever is a concrete errand, not advice");
  // The lever is always the HEAVIEST thing missing, so the cheapest hour is the top one.
  const both = scoreCandidate({ key: "cand-x" });
  const weights = DIMENSIONS.reduce((m, d) => ({ ...m, [d.key]: d.weight }), {});
  const heaviest = Math.max(...both.notEstablished.map((k) => weights[k]));
  assert.equal(both.mostChangingFact.weight, heaviest);
});

test("Q2: an unscoreable candidate is VISIBLE and surfaces FIRST — never buried at the bottom", () => {
  const r = rankCandidates([FULL, candidate("cand-002"), candidate("cand-003")]);
  assert.equal(r.unscoreableCount, 2);
  assert.equal(r.scoredCount, 1);
  for (const s of r.needsOneFact) {
    assert.equal(s.visible, true);
    assert.equal(s.position, null, "it is not given a rank it did not earn");
    assert.ok(s.queuePosition >= 1, "but it has its own place in a queue a human works");
  }
  const md = candidateFitMarkdown(r);
  assert.ok(md.indexOf("One fact away") < md.indexOf("### Scored"),
    "the work-to-do section renders ABOVE the ranked list");
  for (const s of r.needsOneFact) assert.ok(md.includes(s.key), `${s.key} is named on the surface`);
});

test("Q2: zero candidates ranks to nothing, and that is the correct output — not an error", () => {
  const r = rankCandidates([]);
  assert.equal(r.empty, true);
  assert.equal(r.total, 0);
  assert.equal(r.scoredCount, 0);
  assert.equal(r.unscoreableCount, 0);
  assert.equal(r.statement, EMPTY_STATEMENT);
  assert.ok(r.statement.startsWith("0 candidates"), "zero reads as zero, first");
  assert.ok(momentumSafe(r.statement), "an empty ranking may not wear movement language");
  assert.equal(candidateFitMarkdown(null), "_no ranking_\n");
});

test("Q2: no ranking statement on any path may wear momentum language over a zero series", () => {
  for (const r of [rankCandidates([]), rankCandidates([FULL]), rankCandidates([FULL, candidate("cand-002")])]) {
    assert.ok(momentumSafe(r.statement), `statement must be momentum-safe: ${r.statement}`);
    assert.ok(momentumSafe(r.note));
    for (const s of r.ranked) assert.ok(momentumSafe(s.reason));
    for (const s of r.needsOneFact) assert.ok(momentumSafe(s.reason));
  }
});

test("Q2: the ranking reads the Q1 list count rather than counting for itself", () => {
  const list = buildCandidateList([FULL], { now: NOW });
  const r = rankCandidates([FULL], list);
  assert.equal(r.sourceListCount, 1);
  assert.equal(rankCandidates([FULL], null).sourceListCount, null, "an absent list is stated, not assumed");
});

test("Q2: static-scan — no clock, no randomness, no network, no model call in the scoring chain", () => {
  const bad = [
    /Math\.random/, /Date\.now\s*\(/, /new Date\s*\(\s*\)/, /\bfetch\s*\(/, /XMLHttpRequest/,
    /child_process/, /node:fs/, /node:net/, /node:http/, /process\.env/,
    /anthropic/i, /openai/i, /\bllm\b/i, /completion/i, /setInterval\s*\(/, /setTimeout\s*\(/,
  ];
  const src = readFileSync(path.join(__dirname, "../src/shared/candidate-fit.mjs"), "utf8");
  for (const re of bad) assert.ok(!re.test(src), `candidate-fit.mjs must not contain ${re}`);
  // And no path that manufactures a score where a fact is missing.
  assert.ok(!/established\s*:\s*true\s*,\s*points\s*:\s*null/.test(src));
});
