// RUN 23 §6 — Mode-tier vetted-recipe execution policy. Today EVERY system fix is blocked by the dry-run
// flag. New policy: a recipe EARNS a vetted tier by accumulating successful dry-runs + supervisor approvals,
// which is tracked per-recipe in ~/.aria-sentinel/recipe-history.json (incremented per success, decremented
// per veto/abort). Higher vetted-tier → more autonomy is permitted, but the supervisor (D5) still has the
// final say and the 10s countdown (D4) still applies (except on a fast-path approval).
//
//   Tier 0  (100+ vetted)  → may auto-execute in Autonomous mode IF the supervisor approves
//   Tier 1  (10-99 vetted) → Confirmed mode minimum + countdown + supervisor approval
//   Tier 2  (<10 vetted)   → Manual mode, OR Confirmed/Approve-first when a PERSON started or approved it
//                            (PROD 2026-10-14 / audit M1). Never auto-fires; countdown + supervisor + operator prompt.
//
// PROD 2026-10-14 (audit M1) — a fresh install has 0 vetted runs for EVERY recipe, and every "Resolve it for
// me" button sends mode:"confirmed". Under the old rule ("Tier-2 manual-only") no fix could ever run live on a
// customer machine, and a completed dry-run was recorded as "abort" (−1), so the tier could never rise. Now:
//   · a human-initiated / human-approved Tier-2 run is allowed in Confirmed (the visible countdown or the
//     approval IS the consent); an unattended (watcher / deep-link / bridge) Tier-2 run is still refused;
//   · a completed dry-run is recorded as "preview" — it neither raises nor lowers the vetted count;
//   · every refusal carries a plain `copy` string the UI can show instead of "Couldn't start this fix."
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

/** Plain-language copy for a policy verdict (Rule 14: says what will actually happen, never "done"). */
export function policyCopy({ allowed, dryRun, reason, humanInitiated } = {}) {
  if (allowed === false) return reason || "This fix is held by the execution policy.";
  if (dryRun) return "Preview only — I'll show every step, but nothing on this device changes until live fixes are turned on.";
  return humanInitiated ? "Ready to run — a 10-second countdown lets you stop it first." : "Cleared to run under the current autonomy level.";
}

/**
 * Decide whether (and how) a recipe may execute given its vetted count, the current Mode, the dry-run
 * checkbox, the supervisor verdict and WHO asked (a person, an approval, or an unattended source).
 * Pure — returns the full gate, never executes.
 */
export function executionPolicy({ vettedCount = 0, mode = "manual", dryRunCheckbox, supervisorVerdict, humanInitiated = false, approved = false } = {}) {
  const tier = vettedTier(vettedCount);
  const m = MODE_RANK[mode] ?? 0;
  const dryRun = resolveDryRun({ mode, dryRunCheckbox });
  const supervisorApproved = supervisorVerdict === "approve" || supervisorVerdict === "approve-fast";
  const person = humanInitiated === true || approved === true;

  let allowed = true;
  let canAutoFire = false;
  let reason = "";
  if (tier === 0) {
    canAutoFire = m === 2;                 // Tier-0 may auto-fire in Autonomous
  } else if (tier === 1) {
    allowed = m >= MODE_RANK.confirmed;    // Confirmed minimum
    if (!allowed) reason = "Tier-1 recipe requires Confirmed mode minimum.";
  } else {
    // Tier-2: Manual always; Confirmed only when a person started or approved it. Never unattended.
    allowed = m === MODE_RANK.manual || (m === MODE_RANK.confirmed && person);
    if (!allowed) {
      reason = person
        ? "This fix is not yet vetted for Autonomous — run it from Confirmed or Manual mode so you can watch it."
        : "This fix is not yet vetted to run on its own — a person needs to start or approve it (Confirmed or Manual mode).";
    }
  }

  const execute = allowed && supervisorApproved && !dryRun;
  const policy = {
    tier,
    dryRun,
    allowed,
    execute,
    canAutoFire: canAutoFire && supervisorApproved && !dryRun,
    // A Tier-0 fast-path skips the countdown; everything else shows the 10s gate.
    requiresCountdown: !(tier === 0 && supervisorVerdict === "approve-fast"),
    requiresSupervisor: true,
    requiresOperatorPrompt: tier === 2,
    humanInitiated: person,
    reason,
    copy: policyCopy({ allowed, dryRun, reason, humanInitiated: person })
  };
  // Legacy name (RUN 23) kept for callers — NON-enumerable so it never leaks into an IPC/JSON result (audit M32).
  Object.defineProperty(policy, "requiresAhmadPrompt", { value: policy.requiresOperatorPrompt, enumerable: false });
  return policy;
}

// ── recipe-history.json (vetted-count ledger) ───────────────────────────────────────────────────────────
export function emptyHistory() { return { recipes: {} }; }

/**
 * Record a recipe outcome. success → +1 vetted; veto/abort → −1 (floored at 0); preview (a completed dry-run)
 * → recorded in the run list, vetted count UNCHANGED. Returns a NEW ledger.
 */
export function recordOutcome(history, recipeId, outcome, now = Date.now()) {
  if (isBlockedPath(recipeId)) return history && history.recipes ? history : emptyHistory(); // 🔒 R11
  const base = history && history.recipes ? { recipes: { ...history.recipes } } : emptyHistory();
  const cur = base.recipes[recipeId] || { vetted: 0, runs: [], lastTs: 0 };
  let vetted = cur.vetted || 0;
  if (outcome === "success") vetted += 1;
  else if (outcome === "veto" || outcome === "abort") vetted = Math.max(0, vetted - 1);
  // "preview": neither up nor down — a dry-run proves nothing about the live command, but it is not a failure.
  const runs = [...(cur.runs || []), { ts: now, outcome }].slice(-20);
  base.recipes[recipeId] = { vetted, runs, lastTs: now, tier: vettedTier(vetted) };
  return base;
}

export function vettedCountOf(history, recipeId) {
  return (history && history.recipes && history.recipes[recipeId] && history.recipes[recipeId].vetted) || 0;
}
