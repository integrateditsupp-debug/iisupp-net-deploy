// RUN-B B1 — "Was this fixed?" feedback loop -> a real, defensible deflection %. Rule 14: real-or-empty —
// the metric is null until a real outcome exists, moves ONLY on a real *resolved* outcome, and is never a
// fabricated default. Also proves the wiring: pure module -> main IPC + dashboard tile + D2 proof feed ->
// preload bridge -> renderer confidence badge + feedback control -> registered in run-all.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  deflectionRate, deflectionStats, deflectionTile, firstTouchResolution,
  buildOutcomeEvent, recordOutcome, normalizeOutcome, normalizeScore,
  confidenceBadge, pilotProofMetrics, scrubField, OUTCOME_KINDS
} from "../src/shared/resolution-outcome.mjs";
import { deflectionRate as csDeflectionRate } from "../src/shared/case-study.mjs";

// ── Real-or-empty: no events => null (NEVER 0% or 100%) ─────────────────────────────────────────────
assert.equal(deflectionRate([]), null, "no events => null deflection (empty-state, not a fake number)");
assert.equal(deflectionStats([]).deflectionPct, null, "stats: null until a real conversation exists");
assert.equal(deflectionStats([]).conversations, 0);
assert.equal(deflectionTile([]).value, null, "dashboard tile shows the empty-state (--), never a fabricated %");

// ── The metric moves ONLY on a real resolved outcome; an unresolved one does not increment it ───────
let ev = recordOutcome([], { outcome: "not-yet", sessionId: "s1" }).events;
assert.equal(deflectionStats(ev).resolved, 0, "a 'not-yet' NEVER increments the resolved numerator");
assert.equal(deflectionRate(ev), 0, "one real 'not-yet' => a real 0% (measured, not fabricated)");
ev = recordOutcome(ev, { outcome: "resolved", sessionId: "s2" }).events;
assert.equal(deflectionStats(ev).resolved, 1, "a real 'resolved' increments the numerator");
assert.equal(deflectionRate(ev), 50, "1 resolved of 2 conversations => 50%");
assert.equal(firstTouchResolution(ev), 50, "first-touch-resolution is the SAME real number");
ev = recordOutcome(ev, { outcome: "resolved", sessionId: "s3" }).events;
assert.equal(deflectionRate(ev), 67, "2 of 3 => 67% (rounded), still real");

// ── Cannot be gamed: idempotent per session_id (first real outcome wins) ────────────────────────────
const before = ev.length;
const dup = recordOutcome(ev, { outcome: "resolved", sessionId: "s3" });
assert.equal(dup.deduped, true, "same session_id => deduped");
assert.equal(dup.events.length, before, "spamming thumbs cannot inflate the metric");

// ── Invalid input records NOTHING (real-or-empty at the source) ─────────────────────────────────────
assert.equal(normalizeOutcome("maybe"), null);
assert.equal(buildOutcomeEvent({ outcome: "maybe" }).ok, false, "unknown kind => not ok");
assert.equal(recordOutcome(ev, { outcome: "maybe" }).ok, false, "unknown kind records nothing");
assert.deepEqual([...OUTCOME_KINDS].sort(), ["not-yet", "resolved"]);

// ── Confidence badge derived from the REAL match score (accepts 0..1 and 0..100); no score => null ──
assert.equal(confidenceBadge(0.92).level, "high");
assert.equal(confidenceBadge(60).level, "uncertain", "0..100 form accepted (60 => 0.6)");
assert.equal(confidenceBadge(0.1).level, "low");
assert.equal(confidenceBadge(null), null, "no measured score => no fabricated confidence");
assert.equal(confidenceBadge(NaN), null);
assert.equal(normalizeScore(150), 1, "clamped to 1");

// ── R11: a path-like session id is scrubbed before it is ever persisted ─────────────────────────────
const scrubbed = buildOutcomeEvent({ outcome: "yes", sessionId: "C:\\Users\\Ahmad\\notes.txt" }).record.session_id;
assert.ok(!/Users|notes\.txt/.test(scrubbed), "session id is path-scrubbed (R11)");
assert.equal(scrubField("/home/ahmad/x").includes("home"), false);

// ── Feeds the RUN-D D2 pilot->paid proof with the SAME real deflection (via case-study.deflectionRate) ─
assert.equal(pilotProofMetrics([], { fixes: 3 }).conversations, null, "no outcomes => conversations null => D2 deflection null");
assert.equal(csDeflectionRate(pilotProofMetrics([], { fixes: 3 })), null, "case-study reads it as null (real-or-empty)");
const pm = pilotProofMetrics(ev, { fixes: 3 });
assert.equal(pm.fixes, 3);
assert.equal(pm.conversations, 3);
assert.equal(pm.resolvedNoEscalation, 2);
assert.equal(csDeflectionRate(pm), 67, "the D2 proof shows the SAME real 67% deflection, not just a fix count");

// ── Wiring proof: pure module -> main (IPC + dashboard tile + D2 feed) -> preload -> renderer -> run-all ─
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
const runAll = fs.readFileSync(path.join(root, "tests", "run-all.mjs"), "utf8");

assert.match(main, /from "\.\.\/shared\/resolution-outcome\.mjs"/, "main imports the resolution-outcome module");
assert.match(main, /function recordResolutionOutcome\(/, "main defines recordResolutionOutcome");
assert.match(main, /function resolutionStatsNow\(/, "main defines resolutionStatsNow");
assert.match(main, /pilotProofMetrics\(store\.get\("resolutionOutcomes"\)/, "pilotMetricsNow feeds the D2 proof with REAL outcomes");
assert.match(main, /deflection:\s*resolutionStatsNow\(\)\.deflectionPct/, "dashboard tile fed real-or-empty deflection");
assert.match(main, /sentinel:resolution-outcome/, "main exposes the resolution-outcome IPC");
assert.match(main, /sentinel:resolution-stats/, "main exposes the resolution-stats IPC");
assert.match(main, /logEvent\("FEEDBACK"/, "a real outcome is recorded to the audit log");
assert.match(preload, /resolutionOutcome:/, "preload bridges resolutionOutcome");
assert.match(preload, /sentinel:resolution-outcome/, "preload wires the resolution-outcome channel");
assert.match(preload, /resolutionStats:/, "preload bridges resolutionStats");
assert.match(renderer, /from "\.\.\/shared\/resolution-outcome\.mjs"/, "renderer imports confidenceBadge from the shared module");
assert.match(renderer, /window\.sentinel\.resolutionOutcome\(/, "renderer records the outcome via the bridge (thumbs)");
assert.match(renderer, /aria-chat-confidence/, "renderer renders the per-answer confidence badge");
assert.match(renderer, /Did this fix it\?/, "renderer surfaces the 'Was this fixed?' feedback");
assert.match(runAll, /resolution-outcome\.test\.mjs/, "run-all registers this test");

console.log("resolution-outcome (RUN-B B1) test passed (real-or-empty deflection; moves only on real resolved; dedupe can't game it; confidence from real score; R11-scrubbed; feeds D2 proof; main IPC + dashboard tile + preload + renderer confidence/feedback wired).");
