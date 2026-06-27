// stage7-tier0 — the reusable adapter that runs a Tier-0 recipe through the STAGE 7 prove-before-prod
// gate (sandbox-validate.mjs). The proven executeTier0 stays the atomic apply unit (its allowlist, R11
// path-guard, and internal pre→exec→post→rollback are untouched); Stage 7 sits in FRONT of it:
//   • PREFLIGHT  — a real dry-run of the exact command (logic-validate). A "blocked" (allowlist/R11) or
//                  "unbound" (no binding) outcome ⇒ wouldApply:false ⇒ prod is never touched.
//   • SNAPSHOT   — optional restore point (best-effort for greens).
//   • APPLY      — the real executeTier0 (exec + post + internal rollback on a failed restart).
//   • READBACK   — success/no-op ⇒ healthy; a real fail ⇒ damage (executeTier0 already rolled back).
// Used by main.mjs (live path) and unit-tested with an injected `run`, so "a bad fix is caught in
// validation and never reaches prod" is provable for a REAL recipe without spawning PowerShell.
import { validateThenApply } from "./sandbox-validate.mjs";
import { executeTier0 } from "../main/tier-0-executor.mjs";

/**
 * @param {string} recipeId            Tier-0 recipe id (direct or aliased).
 * @param {object} deps
 *   run(cmd)            → {stdout,stderr,exitCode}   PowerShell runner (injected; main passes a tracked one)
 *   logger(ev,txt,xtra) → void                       audit logger (optional)
 *   recordRestorePoint(recipeId) → token             restore-point fn (optional; greens don't require one)
 * @returns {Promise<{ gate, applyResult }>}  gate = full Stage-7 result; applyResult = executeTier0 result (or null if rejected)
 */
export async function runTier0WithStage7(recipeId, deps = {}) {
  const { run, logger, recordRestorePoint } = deps;
  let applyResult = null;
  const gate = await validateThenApply(
    { id: recipeId, requiresSnapshot: false },
    {
      dryRun: async () => {
        const d = await executeTier0(recipeId, { dryRun: true, run });
        return { ok: d.outcome === "dry-run", wouldApply: d.outcome === "dry-run", reason: d.message };
      },
      sideEffectScan: async () => ({ ok: true, blocked: false, findings: [] }),
      snapshot: async () => { const rp = recordRestorePoint ? recordRestorePoint(recipeId) : null; return { ok: true, token: rp || null }; },
      apply: async () => {
        applyResult = await executeTier0(recipeId, { dryRun: false, run, logger });
        return { ok: ["success", "no-op-neutral"].includes(applyResult.outcome) };
      },
      readback: async () => {
        const o = applyResult && applyResult.outcome;
        if (o === "success" || o === "no-op-neutral") return { ok: true, healthy: true, damaged: false };
        return { ok: false, healthy: false, damaged: o === "fail" };
      },
      rollback: async () => ({ ok: true, recovered: Boolean(applyResult && applyResult.rolledBack) })
    },
    { logger }
  );
  return { gate, applyResult };
}
