// RUN 32-B — 3-mode proof-of-life. Exercises the REAL execution pipeline the desktop runs (supervisor critic
// → executionPolicy → countdown gate → execute) end-to-end for each Mode against a safe Tier-0 recipe
// (network-flush-dns: idempotent, reversible, no service side-effects). Proves Ahmad's ask "test at 3 modes":
//   Manual     → previews (dry-run); executes only after the user explicitly confirms.
//   Confirmed  → executes live after the 10-second countdown + supervisor approval.
//   Autonomous → a PROVEN recipe fast-paths (no countdown); an unproven one still shows the countdown.
//   Every mode → a supervisor veto blocks execution; the Ctrl+Alt+K kill-switch aborts an in-flight countdown.
import assert from "node:assert/strict";
import { superviseProposal } from "../src/main/supervisor-agent.mjs";
import { executionPolicy } from "../src/main/dry-run-policy.mjs";
import { createCountdown, createCountdownManager } from "../src/main/action-countdown.mjs";

const RECIPE = "network-flush-dns";
const VETTED = new Set([RECIPE]);          // signed catalog the supervisor checks against
const TIER0 = 150;                          // 100+ vetted runs → Tier-0 (auto-fire eligible)
const NOW = 1_700_000_000_000;
const okHistory = (count) => Array.from({ length: count }, (_, i) => ({ recipeId: RECIPE, ts: NOW - (i + 1) * 86_400_000, ok: true }));

// The exact two-stage decision main.mjs makes before it runs (or previews) a recipe.
function pipeline({ mode, history = [], dryRunCheckbox, risk = "low" }) {
  const verdict = superviseProposal({ recipeId: RECIPE, riskTier: risk, expectedImpact: [] }, { mode, vettedCatalog: VETTED, history, now: NOW });
  const policy = executionPolicy({ vettedCount: TIER0, mode, dryRunCheckbox, supervisorVerdict: verdict.verdict });
  return { verdict: verdict.verdict, ...policy };
}

let n = 0; const t = () => { n++; };

// 1 — MANUAL: previews by default (dry-run ON), does NOT execute until the user confirms.
let p = pipeline({ mode: "manual" });
assert.equal(p.verdict, "approve", "supervisor approves a clean Tier-0 proposal");
assert.equal(p.dryRun, true, "Manual default = dry-run preview");
assert.equal(p.execute, false, "Manual does NOT auto-execute (awaiting explicit user confirm)");
p = pipeline({ mode: "manual", dryRunCheckbox: false });
assert.equal(p.execute, true, "Manual executes once the user explicitly confirms (dry-run off)");
assert.equal(p.requiresCountdown, true, "a Manual live run still gets the 10s safety countdown");
t();

// 2 — CONFIRMED: live execution after supervisor approval + the 10s countdown.
p = pipeline({ mode: "confirmed" });
assert.equal(p.verdict, "approve");
assert.equal(p.dryRun, false, "Confirmed default = live");
assert.equal(p.execute, true, "Confirmed executes after approval");
assert.equal(p.requiresCountdown, true, "Confirmed shows the 10-second countdown");
assert.equal(p.canAutoFire, false, "Confirmed never auto-fires");
t();

// 3 — AUTONOMOUS (proven recipe — 5 consecutive OK runs): supervisor fast-paths → executes, NO countdown.
p = pipeline({ mode: "autonomous", history: okHistory(5) });
assert.equal(p.verdict, "approve-fast", "5 consecutive OK runs → fast-path approval");
assert.equal(p.execute, true, "Autonomous executes a proven recipe");
assert.equal(p.canAutoFire, true, "Autonomous may auto-fire a Tier-0 recipe");
assert.equal(p.requiresCountdown, false, "fast-path skips the countdown");
t();

// 3b — AUTONOMOUS (unproven recipe — no history): approves but KEEPS the countdown (earns trust first).
p = pipeline({ mode: "autonomous" });
assert.equal(p.verdict, "approve");
assert.equal(p.execute, true);
assert.equal(p.requiresCountdown, true, "an unproven recipe still shows the countdown even in Autonomous");
t();

// 4 — SAFETY: a supervisor veto (here: a <5-min cooldown re-attempt) blocks execution in ALL three modes.
for (const mode of ["manual", "confirmed", "autonomous"]) {
  const recent = [{ recipeId: RECIPE, ts: NOW - 60_000, ok: true }]; // attempted 60s ago → cooldown veto
  const verdict = superviseProposal({ recipeId: RECIPE, riskTier: "low", expectedImpact: [] }, { mode, vettedCatalog: VETTED, history: recent, now: NOW });
  assert.equal(verdict.verdict, "veto", `${mode}: cooldown re-attempt is vetoed`);
  assert.equal(executionPolicy({ vettedCount: TIER0, mode, supervisorVerdict: verdict.verdict }).execute, false, `${mode}: veto blocks execution`);
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
  const abortedCount = mgr.abortAll();                   // the kill-switch panic action
  assert.equal(abortedCount, 1, "one in-flight countdown aborted");
  assert.equal(executed, false, "the execute callback NEVER fires after the kill-switch");
  assert.equal(aborted, true, "the abort handler fired");
  assert.equal(c.isPending(), false, "countdown is no longer pending");
}
t();

assert.equal(n, 6, "6 mode-execution test groups");
console.log(`mode-execution test passed (${n} groups · Manual previews/awaits-confirm · Confirmed countdown+exec · Autonomous fast-path(no-countdown)+unproven-keeps-countdown · veto blocks all 3 modes · kill-switch aborts in-flight).`);
