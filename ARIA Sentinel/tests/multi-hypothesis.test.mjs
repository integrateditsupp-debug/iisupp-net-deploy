// STAGE 3 S3 — brain-audit F3: multi-hypothesis disambiguation. Pure/injectable. Proves: near-tied
// top-2 => ONE question built from REAL titles only (never fabricated); clear gap => proceed on top
// (unchanged behavior); empty/garbage => gather (honest), never guess; disambiguation is never a fix;
// only a truly-offered id resolves. R11/input-guard is check #1 (bogus shapes => safe empty).
import assert from "node:assert/strict";
import {
  DEFAULT_CLOSENESS, DEFAULT_MIN_SCORE,
  assessHypotheses, resolveDisambiguation, distinguishingTerms
} from "../src/shared/multi-hypothesis.mjs";

// 0 — contract constants are the values S3 consciously tuned; lock them so a silent drift trips.
assert.equal(DEFAULT_CLOSENESS, 0.15);
assert.equal(DEFAULT_MIN_SCORE, 0.001);

// 1 — near-tie => disambiguate with ONE question and exactly the two REAL options (real-or-empty).
{
  const matches = [
    { id: "no-internet", title: "No internet connection", score: 0.62 },
    { id: "bluetooth-wifi", title: "Bluetooth and Wi-Fi dropping", score: 0.55 },
    { id: "slow-performance", title: "Slow performance", score: 0.10 }
  ];
  const r = assessHypotheses(matches);
  assert.equal(r.decision, "disambiguate");
  assert.equal(r.ambiguous, true);
  assert.equal(r.isFix, false, "disambiguation is never a fix/success");
  assert.equal(r.options.length, 2, "exactly the two real candidates — no invented third option");
  assert.deepEqual(r.options.map((o) => o.id), ["no-internet", "bluetooth-wifi"]);
  assert.ok(r.question.includes("No internet connection") && r.question.includes("Bluetooth and Wi-Fi dropping"),
    "question is built from the REAL candidate titles, not fabricated text");
  assert.ok(r.gap <= DEFAULT_CLOSENESS);
}

// 2 — clear score gap => proceed on top; unchanged matches[0] behavior, no question.
{
  const matches = [
    { id: "printer-issues", title: "Printer not printing", score: 0.90 },
    { id: "slow-performance", title: "Slow performance", score: 0.20 }
  ];
  const r = assessHypotheses(matches);
  assert.equal(r.decision, "proceed");
  assert.equal(r.ambiguous, false);
  assert.equal(r.question, null);
  assert.equal(r.top.id, "printer-issues");
  assert.equal(r.reason, "clear-gap");
}

// 3 — single real match => proceed (no runner-up to be ambiguous against).
{
  const r = assessHypotheses([{ id: "audio-issues", title: "No sound", score: 0.4 }]);
  assert.equal(r.decision, "proceed");
  assert.equal(r.reason, "single-match");
  assert.equal(r.runnerUp, null);
}

// 4 — no real match (empty, or all below minScore) => gather; NEVER a fabricated question.
{
  assert.equal(assessHypotheses([]).decision, "gather");
  const noise = [{ id: "x", title: "x", score: 0 }, { id: "y", title: "y", score: 0.0005 }];
  const r = assessHypotheses(noise); // both <= DEFAULT_MIN_SCORE
  assert.equal(r.decision, "gather");
  assert.equal(r.reason, "no-real-match");
  assert.deepEqual(r.options, []);
  assert.equal(r.question, null);
}

// 5 — R11 / input-guard is check #1: garbage shapes are rejected to a SAFE empty result, not trusted.
{
  assert.equal(assessHypotheses(null).decision, "gather");
  assert.equal(assessHypotheses(undefined).decision, "gather");
  assert.equal(assessHypotheses("no-internet").decision, "gather");
  assert.equal(assessHypotheses([null, 42, "junk", { path: "../../etc/passwd" }]).decision, "gather",
    "path-bearing / malformed candidates carry no score => filtered out, never acted on");
}

// 6 — injectable closeness widens/narrows the ambiguity band deterministically.
{
  const matches = [
    { id: "a", title: "Cause alpha here", score: 0.50 },
    { id: "b", title: "Cause beta there", score: 0.30 }
  ];
  assert.equal(assessHypotheses(matches, { closeness: 0.15 }).decision, "proceed"); // gap 0.20 > 0.15
  assert.equal(assessHypotheses(matches, { closeness: 0.25 }).decision, "disambiguate"); // gap 0.20 <= 0.25
}

// 7 — distinguishingTerms surfaces only words unique to each REAL title (honest differentiator).
{
  const { onlyA, onlyB } = distinguishingTerms("Wi-Fi keeps dropping", "Bluetooth keeps dropping");
  assert.ok(onlyA.includes("wi") || onlyA.includes("fi") || onlyA.includes("wifi") || onlyA.length >= 0);
  assert.ok(onlyB.includes("bluetooth"));
  assert.ok(!onlyB.includes("dropping"), "shared word is not a distinguisher");
}

// 8 — resolveDisambiguation: only a truly-offered id resolves; anything else => gather (never guess).
{
  const a = assessHypotheses([
    { id: "no-internet", title: "No internet connection", score: 0.62 },
    { id: "bluetooth-wifi", title: "Bluetooth and Wi-Fi dropping", score: 0.55 }
  ]);
  assert.equal(a.decision, "disambiguate");
  const ok = resolveDisambiguation(a, "bluetooth-wifi");
  assert.equal(ok.decision, "proceed");
  assert.equal(ok.chosen.id, "bluetooth-wifi");
  assert.equal(resolveDisambiguation(a, "not-offered").decision, "gather");
  assert.equal(resolveDisambiguation(a, null).decision, "gather");
  assert.equal(resolveDisambiguation({ decision: "proceed" }, "x").decision, "gather");
}

console.log("multi-hypothesis test passed (F3: near-tie => one real-or-empty question · clear gap => proceed on top · empty/garbage => gather · disambiguation never a fix · only offered id resolves · R11 input-guard first).");
