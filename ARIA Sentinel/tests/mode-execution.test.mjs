// RUN 32-B — 3-mode proof-of-life. Exercises the REAL execution pipeline the desktop runs (supervisor critic
// → executionPolicy → countdown gate → execute) end-to-end for each Mode.
//
// PROD 2026-10-14 (audit M1 / §4 "honest smoke test") — this suite used to prove the pipeline with vettedCount:150
// and a recipe id ("network-flush-dns") that exists in no catalog, and docs/3-mode-smoke-results.md reported "ALL
// MODES PASS" from it. It now runs against a REAL executor id with the vetted count a FRESH INSTALL has (0 → Tier-2)
// and tells that truth:
//   Manual     → previews (dry-run); executes only after the user explicitly confirms (dry-run off).
//   Confirmed  → a PERSON-started run executes live after the 10-second countdown + supervisor approval;
//                an UNATTENDED (watcher) run of the same fresh recipe is refused with honest copy.
//   Autonomous → a fresh (Tier-2) recipe never auto-fires; a PROVEN Tier-0 recipe (100+ vetted, 5 OK runs)
//                fast-paths (no countdown); an unproven Tier-0 one still shows the countdown.
//   Every mode → a supervisor veto blocks execution; the Ctrl+Alt+K kill-switch aborts an in-flight countdown.
import assert from "node:assert/strict";
import { superviseProposal } from "../src/main/supervisor-agent.mjs";
import { executionPolicy } from "../src/main/dry-run-policy.mjs";
import { createCountdown, createCountdownManager } from "../src/main/action-countdown.mjs";
import { TIER0_EXECUTOR_IDS } from "../src/main/tier-0-executor.mjs";

const RECIPE = "flush-dns-cache";              // a REAL Tier-0 executor binding (no admin rights needed)
assert.ok(TIER0_EXECUTOR_IDS.includes(RECIPE), "the smoke recipe is a real executor id");
const VETTED = new Set(TIER0_EXECUTOR_IDS);     // signed catalog the supervisor checks against
const FRESH = 0;                                // a fresh install: 0 vetted runs → Tier-2
const TIER0 = 150;                              // 100+ vetted runs → Tier-0 (auto-fire eligible)
const NOW = 1_700_000_000_000;
const okHistory = (count) => Array.from({ length: count }, (_, i) => ({ recipeId: RECIPE, ts: NOW - (i + 1) * 86_400_000, ok: true }));

// The exact two-stage decision main.mjs makes before it runs (or previews) a recipe.
function pipeline({ mode, history = [], dryRunCheckbox, risk = "low", vettedCount = FRESH, humanInitiated = true }) {
  const verdict = superviseProposal({ recipeId: RECIPE, riskTier: risk, expectedImpact: [] }, { mode, vettedCatalog: VETTED, history, now: NOW });
  const policy = executionPolicy({ vettedCount, mode, dryRunCheckbox, supervisorVerdict: verdict.verdict, humanInitiated });
  return { verdict: verdict.verdict, ...policy };
}

let n = 0; const t = () => { n++; };

// 1 — MANUAL (fresh install): previews by default (dry-run ON), does NOT execute until the user confirms.
let p = pipeline({ mode: "manual" });
assert.equal(p.verdict, "approve", "supervisor approves a clean Tier-0 proposal");
assert.equal(p.tier, 2, "a fresh install is Tier-2");
assert.equal(p.dryRun, true, "Manual default = dry-run preview");
assert.equal(p.execute, false, "Manual does NOT auto-execute (awaiting explicit user confirm)");
assert.match(p.copy, /preview/i, "the preview says it is a preview");
p = pipeline({ mode: "manual", dryRunCheckbox: false });
assert.equal(p.execute, true, "Manual executes once the user explicitly confirms (dry-run off)");
assert.equal(p.requiresCountdown, true, "a Manual live run still gets the 10s safety countdown");
t();

// 2 — CONFIRMED (fresh install, a PERSON clicked Resolve): live execution after supervisor approval + the countdown.
p = pipeline({ mode: "confirmed", humanInitiated: true });
assert.equal(p.verdict, "approve");
assert.equal(p.allowed, true, "a person may run a fresh (Tier-2) recipe in Confirmed");
assert.equal(p.dryRun, false, "Confirmed default = live");
assert.equal(p.execute, true, "Confirmed executes after approval");
assert.equal(p.requiresCountdown, true, "Confirmed shows the 10-second countdown");
assert.equal(p.canAutoFire, false, "Confirmed never auto-fires");
// …and the SAME fresh recipe, started by a watcher with nobody present, is refused with plain copy.
p = pipeline({ mode: "confirmed", humanInitiated: false });
assert.equal(p.allowed, false, "an unattended Tier-2 run is refused");
assert.equal(p.execute, false);
assert.match(p.copy, /person/i, "the refusal says a person has to start or approve it");
t();

// 3 — AUTONOMOUS: a FRESH recipe never auto-fires, whatever the history says.
p = pipeline({ mode: "autonomous", history: okHistory(5), humanInitiated: false });
assert.equal(p.allowed, false, "a fresh (Tier-2) recipe is not allowed to run unattended in Autonomous");
assert.equal(p.canAutoFire, false, "a fresh recipe never auto-fires");
// A PROVEN Tier-0 recipe (100+ vetted, 5 consecutive OK runs) fast-paths → executes with NO countdown.
p = pipeline({ mode: "autonomous", history: okHistory(5), vettedCount: TIER0, humanInitiated: false });
assert.equal(p.verdict, "approve-fast", "5 consecutive OK runs → fast-path approval");
assert.equal(p.execute, true, "Autonomous executes a proven recipe");
assert.equal(p.canAutoFire, true, "Autonomous may auto-fire a Tier-0 recipe");
assert.equal(p.requiresCountdown, false, "fast-path skips the countdown");
t();

// 3b — AUTONOMOUS (Tier-0 but no recent history): approves but KEEPS the countdown (earns trust first).
p = pipeline({ mode: "autonomous", vettedCount: TIER0, humanInitiated: false });
assert.equal(p.verdict, "approve");
assert.equal(p.execute, true);
assert.equal(p.requiresCountdown, true, "an unproven recipe still shows the countdown even in Autonomous");
t();

// 4 — SAFETY: a supervisor veto (here: a <5-min cooldown re-attempt) blocks execution in ALL three modes.
for (const mode of ["manual", "confirmed", "autonomous"]) {
  const recent = [{ recipeId: RECIPE, ts: NOW - 60_000, ok: true }]; // attempted 60s ago → cooldown veto
  const verdict = superviseProposal({ recipeId: RECIPE, riskTier: "low", expectedImpact: [] }, { mode, vettedCatalog: VETTED, history: recent, now: NOW });
  assert.equal(verdict.verdict, "veto", `${mode}: cooldown re-attempt is vetoed`);
  assert.equal(executionPolicy({ vettedCount: TIER0, mode, supervisorVerdict: verdict.verdict, humanInitiated: true }).execute, false, `${mode}: veto blocks execution`);
}
t();

// 5 — KILL-SWITCH (Ctrl+Alt+K): aborting an in-flight countdown means the execute callback NEVER fires.
{
  const mgr = createCountdownManager();
  let executed = false, aborted = false;
  const c = createCountdown({
    recipeId: RECIPE, seconds: 10,
    onComplete: () => { executed = true; },
    onAbort: () => { aborted = true; },
    setIntervalFn: () => 1, clearIntervalFn: () => {}    // injected timer — never auto-ticks
  });
  mgr.register(c).start();
  assert.equal(c.isPending(), true, "countdown is running");
  assert.equal(mgr.list().length, 1, "the manager lists the pending countdown (cancel-by-id path)");
  const abortedCount = mgr.abortAll();                   // the kill-switch panic action
  assert.equal(abortedCount, 1, "one in-flight countdown aborted");
  assert.equal(executed, false, "the execute callback NEVER fires after the kill-switch");
  assert.equal(aborted, true, "the abort handler fired");
  assert.equal(c.isPending(), false, "countdown is no longer pending");
}
t();

assert.equal(n, 6, "6 mode-execution test groups");
console.log(`mode-execution test passed (${n} groups · fresh install Tier-2 · Manual previews/awaits-confirm · Confirmed person-started exec+10s / unattended refused · Autonomous fresh never auto-fires, proven Tier-0 fast-paths · veto blocks all 3 modes · kill-switch aborts in-flight).`);
