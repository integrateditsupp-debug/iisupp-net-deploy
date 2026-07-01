// RUN-B B6 — REGRESSION SWEEP LOCK. B6 is the sequence exit gate: it turns the one-time "run the whole
// suite" sweep into a PERMANENT, re-runnable guard so the RUN-B value/trust moat can't silently regress.
// It locks four invariants that a careless future edit (or a merge of a stale pre-honesty branch) would break:
//   1. Every RUN-B shared module is present on disk.
//   2. Every RUN-B feature gate + the public funnel/pricing guards + the classifier gate stay REGISTERED in
//      run-all.mjs (nobody can quietly unregister a gate to make the suite "green").
//   3. The B3 honesty moat is live: the over-claim guard still catches an affirmative cert claim, still lets
//      honest negation through, and the assembled buyer surface is over-claim clean.
//   4. Real-or-empty holds at the sweep level (B1 deflection + B2 value-proof are null/empty until a real fix,
//      never a fabricated 0/$0-as-a-win) AND the four inflated Trust pages deleted for honesty STAY deleted
//      (direct guard against resurrecting the superseded pre-honesty RUN-A/B branches — a Rule 14 regression).
// Pure node, no electron. Rule 14: asserts only real on-disk / real-module facts.
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findOverclaims, assertNoOverclaim, trustPostureText, buildTrustSummary } from "../src/shared/trust-posture.mjs";
import { deflectionRate, deflectionStats } from "../src/shared/resolution-outcome.mjs";
import { valueProof, valueProofKpis, VALUE_PROOF_EMPTY } from "../src/shared/value-proof.mjs";

const SENTINEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(SENTINEL, "..");
const exists = (p) => fs.existsSync(p);

// ── 1. RUN-B shared modules present on disk ─────────────────────────────────────────────────────────
const RUN_B_MODULES = [
  "src/shared/resolution-outcome.mjs", // B1 deflection
  "src/shared/value-proof.mjs",        // B2 real ROI $/hours
  "src/shared/globe-confirmation.mjs", // B5 under-globe confirmation
  "src/shared/trust-posture.mjs",      // B3 honest trust surface
  "src/shared/roi.mjs",                // the audited ROI model B2 reads
];
for (const rel of RUN_B_MODULES) {
  assert.ok(exists(path.join(SENTINEL, rel)), `RUN-B module missing on disk: ${rel}`);
}

// ── 2. Every RUN-B gate + public/classifier guards stay REGISTERED in run-all.mjs ──────────────────
const runAll = fs.readFileSync(path.join(SENTINEL, "tests/run-all.mjs"), "utf8");
const REQUIRED_GATES = [
  "./resolution-outcome.test.mjs", // B1
  "./value-proof.test.mjs",        // B2
  "./b5-globe-confirmation.test.mjs", // B5
  "./b3-trust-posture.test.mjs",   // B3
  "./funnel-link-guard.test.mjs",  // public funnel integrity
  "./site-pricing-guard.test.mjs", // no unpriced/over-claim pricing drift
  "./classifier-accuracy.test.mjs",// the routing floor
];
for (const spec of REQUIRED_GATES) {
  assert.ok(runAll.includes(spec), `RUN-B/guard gate unregistered from run-all.mjs: ${spec}`);
  assert.ok(exists(path.join(SENTINEL, "tests", spec.replace("./", ""))), `registered gate file missing: ${spec}`);
}

// ── 3. B3 honesty moat is live ───────────────────────────────────────────────────────────────────
assert.ok(findOverclaims("We are SOC 2 certified.").includes("soc 2 certified"), "over-claim guard must still catch an affirmative cert claim");
assert.deepStrictEqual(findOverclaims("ARIA is not SOC 2 certified and not HIPAA compliant."), [], "honest negation must NOT trip the guard");
assertNoOverclaim(trustPostureText(buildTrustSummary())); // the assembled buyer surface stays clean

// ── 4a. Real-or-empty holds (no fabricated numbers until a real fix) ───────────────────────────────
assert.equal(deflectionRate([]), null, "B1: deflection is null until a real outcome (never a fabricated %)");
assert.equal(deflectionStats([]).deflectionPct, null, "B1: stats null until a real conversation");
const vpEmpty = valueProof({ fixes: 0, outcomeEvents: [] });
assert.equal(vpEmpty.hoursSaved, null, "B2: hoursSaved null with zero real fixes");
assert.equal(vpEmpty.dollarsSaved, null, "B2: dollarsSaved null with zero real fixes (no $0-as-a-win)");
assert.equal(vpEmpty.hasData, false, "B2: empty-state until real data");
assert.ok(typeof VALUE_PROOF_EMPTY === "string" && /real fix/i.test(VALUE_PROOF_EMPTY), "B2: honest empty-state copy present");
const kpis = valueProofKpis(vpEmpty);
assert.ok(kpis && typeof kpis === "object", "B2: kpis render even in empty-state");

// ── 4b. The four inflated Trust pages deleted for honesty STAY deleted (anti-supersede-regression) ──
// Merging any stale pre-honesty RUN-A/RUN-B branch would resurrect these; this gate would go red first.
const INFLATED_TRUST_PAGES = [
  "trust/perf.html", "trust/routing-accuracy.html", "trust/ai-evals.html", "trust/methodology.html",
];
for (const rel of INFLATED_TRUST_PAGES) {
  assert.ok(!exists(path.join(REPO, rel)), `inflated Trust page resurrected (Rule 14 regression): ${rel}`);
}
// ...and the honest Trust surface it was replaced with is still live.
assert.ok(exists(path.join(REPO, "trust/index.html")), "honest Trust Center (trust/index.html) must stay live");

console.log("b6-regression-sweep (RUN-B B6) test passed (RUN-B modules present · all gates registered · over-claim guard live · real-or-empty locked · inflated Trust pages stay deleted · honest Trust Center live).");
