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
// FAULT LAB 2026-10-14 (defect 4) — THE VENDOR FLOOR (green only). The owner's Autonomous rule — "advise three times,
// then act" — could never complete on a fresh install: every recipe starts at 0 local vetted runs (Tier 2), and Tier 2
// is never allowed unattended, so the third unanswered notice always ended with "tell the IT contact". The exact rule now:
//   · A GREEN recipe that SHIPS in the registry with a GATING verify probe and a declared rollback / inverse
//     (recipe-runner.mjs isVendorVetted) is VENDOR-VETTED: vettedTier() treats the shipped catalogue as its floor,
//     Tier 1 — the minimum this policy needs before anything runs unattended. The caller must say so explicitly
//     (`vendorVetted: true` AND `color: "green"` AND — REVIEW P1-1 — `track: "autonomous-advisory"`); without all three
//     the answer is exactly the old one.
//   · YELLOW never takes the floor: it still needs 10 locally vetted runs (and recipe-runner still never lets a yellow
//     fix fire on its own). RED never runs on its own at all (approval-policy red-never-automated).
//   · The local counters are kept: they still raise trust (≥100 → Tier 0 = auto-fire eligible), still gate yellow, and
//     still move ±1 per live success / veto / abort — the floor only stops a fresh install from reading as "unproven".
//   · No other gate moves: the supervisor, the countdown, Ctrl+Alt+K, the restore point for yellow, needsAdmin (an
//     admin-needing fix is still never run unattended) and red-never-automated are all enforced downstream, unchanged.
//
//
// REVIEW P1-1 (2026-10-14) — THE FLOOR IS AUTONOMOUS-ADVISORY ONLY. The owner's decision: Confirmed asks once, every time,
// and never executes unattended; unattended execution exists only in Autonomous mode through the advise-three-times rule.
// The floor was taken by EVERY caller, so on a fresh install a vendor-vetted green fix ran on its own in Confirmed. Now
// the floor applies only when the caller names the track: `track: VENDOR_FLOOR_TRACK` ("autonomous-advisory") — main
// passes it from the advisory track (advisoryTrackFor) and that track's final step (source "detection:advisory") and
// nowhere else. Without it the answer is the local count alone, exactly as before the floor existed.
// 🔒 R11 — outcomes for an off-limits recipe id are never recorded.
import { isBlockedPath } from "../shared/path-guard.mjs";

const MODE_RANK = { manual: 0, confirmed: 1, autonomous: 2 };

/** The tier the shipped catalogue guarantees a vendor-vetted GREEN recipe (Tier 1: Confirmed minimum, may run unattended). */
export const VENDOR_VETTED_TIER = 1;
/** The ONE track the vendor floor applies to (REVIEW P1-1): Autonomous mode's advise-three-times rule. */
export const VENDOR_FLOOR_TRACK = "autonomous-advisory";

/**
 * Vetted tier from a success count. With `{ color: "green", vendorVetted: true, track: VENDOR_FLOOR_TRACK }` the shipped
 * catalogue is the floor (never worse than VENDOR_VETTED_TIER); any other colour, no flag, or any other track is the
 * local count alone (unchanged).
 */
export function vettedTier(count, { color, vendorVetted = false, track } = {}) {
  const n = Number(count) || 0;
  const local = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  if (vendorVetted === true && color === "green" && track === VENDOR_FLOOR_TRACK) return Math.min(local, VENDOR_VETTED_TIER);
  return local;
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
export function executionPolicy({ vettedCount = 0, mode = "manual", dryRunCheckbox, supervisorVerdict, humanInitiated = false, approved = false, color, vendorVetted = false, track } = {}) {
  const tier = vettedTier(vettedCount, { color, vendorVetted, track });
  // Where the tier came from (informational, for the audit + tests): the local ledger, or the vendor floor (defect 4).
  const trust = tier < vettedTier(vettedCount) ? "vendor-vetted" : (Number(vettedCount) || 0) >= 10 ? "locally-vetted" : "not-yet-vetted";
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
    trust,
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
