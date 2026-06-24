// RUN 23 §6 — Mode-tier vetted-recipe execution policy. Today EVERY system fix is blocked by the dry-run
// flag. New policy: a recipe EARNS a vetted tier by accumulating successful dry-runs + supervisor approvals,
// which is tracked per-recipe in ~/.aria-sentinel/recipe-history.json (incremented per success, decremented
// per veto/abort). Higher vetted-tier → more autonomy is permitted, but the supervisor (D5) still has the
// final say and the 10s countdown (D4) still applies (except on a fast-path approval).
//
//   Tier 0  (100+ vetted)  → may auto-execute in Autonomous mode IF the supervisor approves
//   Tier 1  (10-99 vetted) → Confirmed mode minimum + countdown + supervisor approval
//   Tier 2  (<10 vetted)   → Manual mode only, never auto + countdown + supervisor + Ahmad prompt
//
// 🔒 R11 — outcomes for an off-limits recipe id are never recorded.
import { isBlockedPath } from "../shared/path-guard.mjs";

const MODE_RANK = { manual: 0, confirmed: 1, autonomous: 2 };

/** Vetted tier from a success count. */
export function vettedTier(count) {
  const n = Number(count) || 0;
  if (n >= 100) return 0;
  if (n >= 10) return 1;
  return 2;
}

/**
 * Resolve the effective dry-run flag. The "Keep system fixes in dry-run mode" checkbox always wins.
 * RUN 29-A — when left at default the flag is now MODE-based: Manual keeps the dry-run safety ON (a fix only
 * previews unless the user opts in), while Confirmed and Autonomous default to REAL execution. Real exec is
 * still fully gated downstream by allowed-tier + supervisor approval + the 10s countdown + Ctrl+Alt+K — this
 * flag only decides the *default*, never whether the safety gates run. (`vettedCount` kept for call-site
 * compatibility; it no longer affects the default — tier still governs `allowed`/auto-fire in executionPolicy.)
 */
export function resolveDryRun({ mode = "manual", dryRunCheckbox } = {}) {
  if (dryRunCheckbox === true) return true;   // user kept the safety on → always dry-run
  if (dryRunCheckbox === false) return false; // user turned it off → live (still gated below)
  return mode === "manual";                   // default: Manual ON · Confirmed/Autonomous OFF
}

/**
 * Decide whether (and how) a recipe may execute given its vetted count, the current Mode, the dry-run
 * checkbox, and the supervisor verdict. Pure — returns the full gate, never executes.
 */
export function executionPolicy({ vettedCount = 0, mode = "manual", dryRunCheckbox, supervisorVerdict } = {}) {
  const tier = vettedTier(vettedCount);
  const m = MODE_RANK[mode] ?? 0;
  const dryRun = resolveDryRun({ mode, dryRunCheckbox });
  const approved = supervisorVerdict === "approve" || supervisorVerdict === "approve-fast";

  let allowed = true;
  let canAutoFire = false;
  let reason = "";
  if (tier === 0) {
    canAutoFire = m === 2;                 // Tier-0 may auto-fire in Autonomous
  } else if (tier === 1) {
    allowed = m >= MODE_RANK.confirmed;    // Confirmed minimum
    if (!allowed) reason = "Tier-1 recipe requires Confirmed mode minimum.";
  } else {
    allowed = m === MODE_RANK.manual;      // Tier-2 manual-only, never auto
    if (!allowed) reason = "Tier-2 recipe runs only in Manual mode with explicit approval.";
  }

  const execute = allowed && approved && !dryRun;
  return {
    tier,
    dryRun,
    allowed,
    execute,
    canAutoFire: canAutoFire && approved && !dryRun,
    // A Tier-0 fast-path skips the countdown; everything else shows the 10s gate.
    requiresCountdown: !(tier === 0 && supervisorVerdict === "approve-fast"),
    requiresSupervisor: true,
    requiresAhmadPrompt: tier === 2,
    reason
  };
}

/**
 * Slice B — resolve the ACTUAL dry-run flag at the execution boundary (runRecipe / runTier0Fix in main).
 * Precedence: (1) system fixes not allowed (dev/unsigned, or env =0) → ALWAYS preview; (2) an explicit
 * caller decision wins — this is how the mode-policy drives execution: Manual passes true (preview),
 * Confirmed/Autonomous pass false (LIVE); (3) no caller decision → the legacy global "dryRun" toggle.
 * Pure. Real execution is still independently gated by supervisor + countdown + restore point + kill-switch.
 */
export function resolveActualDryRun({ allowSystemFixes = false, optionDryRun, globalDryRun = false } = {}) {
  if (!allowSystemFixes) return true;
  if (optionDryRun === false) return false;
  if (optionDryRun === true) return true;
  return Boolean(globalDryRun);
}

// ── recipe-history.json (vetted-count ledger) ───────────────────────────────────────────────────────────
export function emptyHistory() { return { recipes: {} }; }

/** Record a recipe outcome. success → +1 vetted; veto/abort → −1 (floored at 0). Returns a NEW ledger. */
export function recordOutcome(history, recipeId, outcome, now = Date.now()) {
  if (isBlockedPath(recipeId)) return history && history.recipes ? history : emptyHistory(); // 🔒 R11
  const base = history && history.recipes ? { recipes: { ...history.recipes } } : emptyHistory();
  const cur = base.recipes[recipeId] || { vetted: 0, runs: [], lastTs: 0 };
  let vetted = cur.vetted || 0;
  if (outcome === "success") vetted += 1;
  else if (outcome === "veto" || outcome === "abort") vetted = Math.max(0, vetted - 1);
  const runs = [...(cur.runs || []), { ts: now, outcome }].slice(-20);
  base.recipes[recipeId] = { vetted, runs, lastTs: now, tier: vettedTier(vetted) };
  return base;
}

export function vettedCountOf(history, recipeId) {
  return (history && history.recipes && history.recipes[recipeId] && history.recipes[recipeId].vetted) || 0;
}
