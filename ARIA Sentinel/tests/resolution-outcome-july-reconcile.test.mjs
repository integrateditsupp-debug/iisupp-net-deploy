// JULY PORT 2026-10-14 (af5e03ab) — the July resolution-outcome ledger, reconciled as a DIFF against the production
// module (tests/resolution-outcome.test.mjs keeps every RUN-B B1 contract; this suite pins what July added):
// `id` as the dedupe key · "not_resolved" accepted · "escalated" as a third, counted-but-never-resolved outcome ·
// escalated/notResolved/realOrEmpty on the stats · hours_saved + hasProof on the pilot proof — hours from the SAME
// roi.mjs minutes-per-fix the value proof uses (July's private 47-minute constant was dropped on purpose).
import assert from "node:assert/strict";
import { recordOutcome, deflectionStats, pilotProofMetrics, normalizeOutcome, OUTCOMES, OUTCOME_KINDS, ESCALATED_OUTCOME } from "../src/shared/resolution-outcome.mjs";
import { computeRoi } from "../src/shared/roi.mjs";

// ── July test, verbatim semantics ──
let events = [];
let r = recordOutcome(events, { id: "s1", outcome: "resolved" }, { now: 1000 });
assert.equal(r.ok, true);
events = r.events;
r = recordOutcome(events, { id: "s2", outcome: "escalated" }, { now: 2000 });
assert.equal(r.ok, true, "an escalation is a real recorded outcome");
events = r.events;
r = recordOutcome(events, { id: "s1", outcome: "resolved" }, { now: 3000 });
assert.equal(r.deduped, true, "same outcome id is deduped");

const stats = deflectionStats(events);
assert.equal(stats.conversations, 2, "an escalation counts as a conversation (denominator)");
assert.equal(stats.resolved, 1);
assert.equal(stats.escalated, 1, "…and is reported as escalated");
assert.equal(stats.notResolved, 0);
assert.equal(stats.notYet, 0, "notYet excludes escalations");
assert.equal(stats.realOrEmpty, true);
assert.equal(stats.deflectionPct, 50, "escalated conversations lower the real deflection, never raise it");

const bad = recordOutcome(events, { id: "x", outcome: "fixed maybe" });
assert.equal(bad.ok, false);
assert.ok(bad.errors.includes("outcome-invalid"));

const proof = pilotProofMetrics(events, { fixes: 2 });
assert.equal(proof.fixes, 2);
assert.equal(proof.hours_saved, computeRoi({ fixes: 2 }).hoursSaved, "hours_saved uses the ROI model's minutes-per-fix (one number across surfaces)");
assert.equal(proof.hasProof, true);
assert.equal(proof.resolvedNoEscalation, 1, "the D2 numerator never counts an escalation");

// ── Production contracts untouched ──
assert.deepEqual([...OUTCOME_KINDS].sort(), ["not-yet", "resolved"], "the two thumbs stay the only OUTCOME_KINDS");
assert.deepEqual([...OUTCOMES], ["resolved", "not-yet", ESCALATED_OUTCOME], "OUTCOMES = thumbs + escalated");
assert.equal(normalizeOutcome("not_resolved"), "not-yet", "July's not_resolved maps to not-yet");
assert.equal(normalizeOutcome("escalated"), "escalated");
assert.equal(normalizeOutcome("maybe"), null, "unknown kinds still record nothing");
assert.equal(deflectionStats([]).realOrEmpty, false, "real-or-empty: false with no conversation");
assert.equal(deflectionStats([]).deflectionPct, null, "…and null deflection, never 0% or 100%");
const empty = pilotProofMetrics([], { fixes: 0 });
assert.equal(empty.hours_saved, null, "no fixes => no hours (never 0-as-a-win)");
assert.equal(empty.hasProof, false);
// R11: an id that looks like a path is scrubbed; a source tag is a label, never a measured confidence.
const tagged = recordOutcome([], { id: "browser:C:\\Users\\jdoe\\x", outcome: "resolved", confidence: { level: "browser-extension" } }).record;
assert.ok(!/Users|jdoe/.test(tagged.session_id), "path-shaped ids are scrubbed");
assert.equal(tagged.confidence, null, "a source tag never becomes a confidence badge");
assert.equal(tagged.source, "browser-extension", "…it is kept as the content-blind source label");
assert.equal(tagged.escalated, false);
// dedupe still keys on the (scrubbed) id
const dup = recordOutcome([tagged], { id: "browser:C:\\Users\\jdoe\\x", outcome: "resolved" });
assert.equal(dup.deduped, true);

console.log("resolution-outcome July reconcile passed (id dedupe · not_resolved · escalated counted never resolved · stats fields · hours_saved from roi.mjs · hasProof · B1 contracts intact).");
