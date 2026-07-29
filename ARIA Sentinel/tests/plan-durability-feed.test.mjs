// STAGE 3 · F1 × FEEDS JOIN — the DURABLE autonomous-resolution feed (RUN-B B1 / Stage-4 Trust Center).
// The law under test (Rule 14): the joined headline may only ever move the number DOWN. A plan counts only
// when plan-deflection says the run was an honest attempt AND the durability ledger says the fix actually
// HELD through the quiet monitoring window. Journals are built with the REAL appendEntry (genuine hash chain)
// and ledgers with the REAL durability-ledger writers, so every guard is exercised against real structures.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendEntry } from "../src/shared/plan-journal.mjs";
import { emptyLedger, recordResolution, observeRecurrence, QUIET_WINDOW_MS, RECURRENCE_WINDOW_MS } from "../src/shared/durability-ledger.mjs";
import { planDeflectionStats, planProofFeed } from "../src/shared/plan-deflection.mjs";
import {
  gradeDurability, journalPlanId, durableDeflectionStats, durableProofFeed,
  durabilityHeadline, durabilityTile, DURABILITY_FEED_SCHEMA, DURABILITY_GRADE
} from "../src/shared/plan-durability-feed.mjs";

const HOUR = 3600000;
const NOW = Date.UTC(2026, 6, 21, 12, 0, 0);
let SEQ = 0;
const clk = () => Date.UTC(2026, 6, 21, 0, 0, SEQ++); // deterministic, monotonic

function build(events) { let j = []; for (const e of events) j = appendEntry(j, e, clk); return j; }

const resolvedFix = (planId) => build([
  { event: "PLAN.PROPOSED", planId, detail: "t" },
  { event: "PLAN.APPROVED", detail: "ok" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0, recipeId: "restart-print-spooler" },
  { event: "PLAN.STEP.POST", stepIndex: 0, extra: { probe: true, pass: true } },
  { event: "PLAN.RESOLVED", detail: "goalProbe passed", extra: { noChange: false } }
]);
const alreadyHealthy = (planId) => build([
  { event: "PLAN.PROPOSED", planId }, { event: "PLAN.APPROVED" },
  { event: "PLAN.RESOLVED", detail: "already healthy", extra: { noChange: true } }
]);
const escalated = (planId) => build([
  { event: "PLAN.PROPOSED", planId }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0 },
  { event: "PLAN.ESCALATED", detail: "goalProbe failed", extra: { code: "GOAL_PROBE_FAILED" } }
]);
const dryRun = (planId) => build([
  { event: "PLAN.PROPOSED", planId }, { event: "PLAN.APPROVED", extra: { dryRun: true } },
  { event: "PLAN.ABORTED", extra: { code: "DRY_RUN" } }
]);

// A ledger where `planId` was resolved `agoMs` ago (and optionally came back since).
function ledgerWith(planId, agoMs, { recurred = false } = {}) {
  let L = recordResolution(emptyLedger(), { planId, fixApplied: "restart-print-spooler" }, NOW - agoMs);
  if (recurred) L = observeRecurrence(L, planId, NOW - Math.floor(agoMs / 2)).ledger;
  return L;
}

// ---- 1. Grade table — exactly one grade per run, and only "durable" may score -----------------------
{
  const g = (j, L) => gradeDurability({ journal: j, ledger: L, now: NOW }).grade;

  assert.equal(g(resolvedFix("print-recovery"), ledgerWith("print-recovery", 48 * HOUR)), "durable",
    "resolved + quiet for 48h (past the 24h window) with no recurrence => durable");
  assert.equal(g(resolvedFix("print-recovery"), ledgerWith("print-recovery", 2 * HOUR)), "monitoring",
    "resolved 2h ago is still inside the 24h quiet window => monitoring, never counted early");
  assert.equal(g(resolvedFix("print-recovery"), ledgerWith("print-recovery", 48 * HOUR, { recurred: true })), "recurred",
    "the issue came back after the fix => demoted out of the numerator");
  assert.equal(g(resolvedFix("print-recovery"), emptyLedger()), "unrecorded",
    "no ledger record => durability unknown, never assumed");
  assert.equal(g(resolvedFix("print-recovery"), null), "unrecorded", "a missing ledger is never optimistic");
  assert.equal(g(alreadyHealthy("print-recovery"), ledgerWith("print-recovery", 48 * HOUR)), "not-a-resolution",
    "no-op-neutral is never a fix, however good the ledger looks");
  assert.equal(g(escalated("print-recovery"), ledgerWith("print-recovery", 48 * HOUR)), "not-a-resolution");
  assert.equal(g(dryRun("print-recovery"), ledgerWith("print-recovery", 48 * HOUR)), "not-a-resolution",
    "a rehearsal claims nothing, ledger or no ledger");
  assert.equal(g([], emptyLedger()), "not-a-resolution");

  for (const grade of ["durable", "recurred", "monitoring", "unrecorded", "r11-unverifiable", "not-a-resolution"]) {
    assert.ok(DURABILITY_GRADE.includes(grade), `${grade} is a declared grade`);
  }
  assert.ok(Object.isFrozen(DURABILITY_GRADE), "the grade vocabulary is frozen");
}

// ---- 2. 🔒 R11 is check #1 on the durability layer ---------------------------------------------------
{
  const blocked = "C:/Users/a/Private pics and Vids/plan-1";

  // Defence in depth, layer 1 (already true, asserted here so it can never silently regress): the journal
  // redacts every string AT THE SOURCE, so an off-limits id physically cannot reach the durability layer.
  const j = resolvedFix(blocked);
  assert.equal(journalPlanId(j), "<private-folder>", "the journal redacted the id before we ever saw it");
  const viaJournal = gradeDurability({ journal: j, ledger: ledgerWith(blocked, 48 * HOUR), now: NOW });
  assert.equal(viaJournal.durable, false,
    "a redacted id cannot match the ledger entry written under the real id => never a durable win");
  assert.ok(!JSON.stringify(viaJournal).toLowerCase().includes("private pics"),
    "the private folder name never leaks through the grade result");

  // Defence in depth, layer 2 (this module's own guard): no signature => durability is unknowable.
  assert.equal(ledgerWith(blocked, 48 * HOUR).issues && Object.keys(ledgerWith(blocked, 48 * HOUR).issues).length, 0,
    "the ledger itself refuses to record a blocked id");
  const unattributable = gradeDurability({ journal: resolvedFix(undefined), ledger: emptyLedger(), now: NOW });
  assert.equal(unattributable.grade, "r11-unverifiable",
    "a run with no attributable id earns no signature => unknowable, never optimistic");
  assert.equal(unattributable.durable, false);
  assert.equal(unattributable.planId, "");
  assert.equal(unattributable.attempted, true, "it was still a real attempt — the denominator stays honest");
}

// ---- 3. The monotonic law: the join may only move the number DOWN -----------------------------------
{
  const ids = ["a", "b", "c", "d"];
  const journals = [
    resolvedFix("a"), resolvedFix("b"), resolvedFix("c"), resolvedFix("d"),
    escalated("e"), alreadyHealthy("f"), dryRun("g")
  ];
  // Every combination of durable / monitoring / recurred / unrecorded across the four resolved runs.
  const states = [48 * HOUR, 2 * HOUR, null];
  let checked = 0;
  for (const s0 of states) for (const s1 of states) for (const s2 of states) for (const s3 of states) {
    for (const rec of [false, true]) {
      let L = emptyLedger();
      [s0, s1, s2, s3].forEach((ago, i) => {
        if (ago === null) return;
        L = recordResolution(L, { planId: ids[i], fixApplied: "f" }, NOW - ago);
        if (rec) L = observeRecurrence(L, ids[i], NOW - Math.floor(ago / 2)).ledger;
      });
      const joined = durableDeflectionStats(journals, L, NOW);
      const raw = planDeflectionStats(journals);
      assert.equal(joined.attempted, raw.attempted, "the denominator is never widened by the join");
      assert.ok(joined.durableResolved <= raw.resolved, "durable count can never exceed first-pass count");
      assert.ok(joined.durableResolutionPct <= raw.deflectionPct,
        `durable ${joined.durableResolutionPct}% must never exceed first-pass ${raw.deflectionPct}%`);
      checked++;
    }
  }
  assert.equal(checked, 162, "all 162 durability-state combinations were checked");
}

// ---- 4. Real-or-empty: nothing is fabricated when there is no data ----------------------------------
{
  const st = durableDeflectionStats([], emptyLedger(), NOW);
  assert.equal(st.attempted, 0);
  assert.equal(st.durableResolutionPct, null, "no attempts => null, never a flattering 0% or 100%");
  assert.equal(st.firstPassPct, null);

  const feed = durableProofFeed([], emptyLedger(), NOW);
  assert.equal(feed.durableResolutionPct, null);
  assert.equal(feed.plansDurablyFixed, null, "real-or-empty: null, not 0");
  assert.equal(feed.plansAttempted, null);
  assert.equal(durabilityHeadline(feed), "No completed resolution plans yet — nothing to report.");

  const tile = durabilityTile([], emptyLedger(), NOW);
  assert.equal(tile.value, null, 'the tile renders "--", never a fabricated %');
  assert.equal(tile.id, "plan-durable-deflection");

  // Excluded-only input must still not manufacture a rate.
  const excludedOnly = durableDeflectionStats([alreadyHealthy("x"), dryRun("y")], emptyLedger(), NOW);
  assert.equal(excludedOnly.attempted, 0);
  assert.equal(excludedOnly.durableResolutionPct, null);
}

// ---- 5. A worked, honest example end-to-end ---------------------------------------------------------
{
  // 4 live attempts: 2 resolved (one held, one came back), 1 escalated, 1 mid-exec abort.
  const abortedMidExec = build([
    { event: "PLAN.PROPOSED", planId: "z" }, { event: "PLAN.APPROVED" },
    { event: "PLAN.STEP.EXEC", stepIndex: 0 }, { event: "PLAN.STEP.ROLLBACK", stepIndex: 0 },
    { event: "PLAN.ABORTED", extra: { code: "KILL_SWITCH" } }
  ]);
  const journals = [resolvedFix("held"), resolvedFix("cameback"), escalated("esc"), abortedMidExec];
  let L = recordResolution(emptyLedger(), { planId: "held", fixApplied: "f" }, NOW - 48 * HOUR);
  L = recordResolution(L, { planId: "cameback", fixApplied: "f" }, NOW - 48 * HOUR);
  L = observeRecurrence(L, "cameback", NOW - 6 * HOUR).ledger;

  const raw = planProofFeed(journals);
  const feed = durableProofFeed(journals, L, NOW);
  assert.equal(feed.plansAttempted, 4);
  assert.equal(raw.autonomousResolutionPct, 50, "first-pass rate counts both resolutions");
  assert.equal(feed.durableResolutionPct, 25, "only the fix that HELD counts as durable");
  assert.equal(feed.plansDurablyFixed, 1);
  assert.equal(feed.plansRecurred, 1, "the fix that did not hold is reported, not hidden");
  assert.equal(feed.firstPassResolutionPct, 50, "the first-pass number stays visible beside the headline");
  assert.equal(feed.schema, DURABILITY_FEED_SCHEMA);
  assert.equal(feed.plansEscalated, 1, "the escalation -> retainer story survives the join");
  assert.equal(durabilityHeadline(feed), "25% of 4 attempted plans were fixed and stayed fixed.");

  // Same data, but the fix is still inside the quiet window: pending is disclosed, never counted.
  let L2 = recordResolution(emptyLedger(), { planId: "held", fixApplied: "f" }, NOW - 2 * HOUR);
  const pending = durableProofFeed(journals, L2, NOW);
  assert.equal(pending.durableResolutionPct, 0, "nothing durable yet");
  assert.equal(pending.plansMonitoring, 1);
  assert.ok(durabilityHeadline(pending).includes("1 more still inside the monitoring window."));
}

// ---- 6. A tampered chain can never become a durable win ---------------------------------------------
{
  const forged = resolvedFix("t").map((e, i) => (i === 0 ? { ...e, detail: "MUTATED" } : e));
  const L = ledgerWith("t", 48 * HOUR);
  assert.equal(gradeDurability({ journal: forged, ledger: L, now: NOW }).grade, "not-a-resolution",
    "the hash chain is checked before durability is ever consulted");
  const st = durableDeflectionStats([forged], L, NOW);
  assert.equal(st.durableResolutionPct, null, "a forged RESOLVED cannot inflate the durable rate");
  assert.equal(st.untrusted, 1, "it is disclosed as untrusted rather than dropped silently");
}

// ---- 7. Window boundaries are respected exactly ------------------------------------------------------
{
  const g = (ago) => gradeDurability({ journal: resolvedFix("w"), ledger: ledgerWith("w", ago), now: NOW }).grade;
  assert.equal(g(QUIET_WINDOW_MS - 1), "monitoring", "one ms short of the quiet window is NOT durable");
  assert.equal(g(QUIET_WINDOW_MS), "durable", "exactly the quiet window is durable");
  assert.ok(RECURRENCE_WINDOW_MS > QUIET_WINDOW_MS, "the recurrence window outlives the quiet window");
  assert.equal(journalPlanId(resolvedFix("w")), "w");
  assert.equal(journalPlanId([]), "");
  assert.equal(journalPlanId(null), "");
}

// ---- 8. Purity — this module can never touch the machine --------------------------------------------
{
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, "..", "src", "shared", "plan-durability-feed.mjs"), "utf8");
  for (const banned of ["node:fs", "node:child_process", "node:os", "electron", "require(", "localStorage"]) {
    assert.ok(!src.includes(banned), `plan-durability-feed must stay pure — found "${banned}"`);
  }
  assert.ok(!/\bdocument\.[A-Za-z]/.test(src), "no DOM access");
  assert.ok(!/\bwindow\.[A-Za-z]/.test(src), "no browser globals");
  // The clock is INJECTED: every Date.now() in the file is a default parameter value, never an implicit read.
  const clocks = src.match(/Date\.now\(\)/g) || [];
  const injected = src.match(/now = Date\.now\(\)/g) || [];
  assert.equal(clocks.length, injected.length, "the clock is injected, never read implicitly");
  assert.ok(injected.length >= 3, "the injectable clock is offered on every public entry point");
}

console.log("plan-durability-feed: durable resolution feed is honest (join only ever lowers the number) — 8 groups passed.");
