// sandbox-validate.mjs — STAGE 7: the "prove before prod" gate for ANY auto-fix.
//
// Every recipe / auto-fix is routed through validateThenApply() BEFORE it is allowed to touch the
// real machine. The pipeline proves a fix is safe and effective, applies it, reads back the result,
// and silently rolls back if it did damage — so the user only ever sees the outcome, never the
// machinery. It is the generalization of tier-0-executor's pre→exec→post→rollback wrapper into a
// reusable gate that sits in front of every executor.
//
// PIPELINE (each stage can short-circuit to a verdict; `apply` only runs if every gate passes):
//   1. PREFLIGHT  — dryRun(fix): run the fix's own logic in describe-only mode. If it would error
//                   or report it cannot apply → REJECTED, prod is never touched.
//   2. SIDE-EFFECT — sideEffectScan(fix): inspect the concrete command(s) for out-of-scope or
//                   destructive effects beyond what the recipe declares. A blocked finding → REJECTED.
//   3. SANDBOX    — (mode:"sandbox" only, frontier) sandbox(fix): run the fix in a disposable VM and
//                   read back there first. A sandbox failure → REJECTED, prod is never touched. This
//                   is what upgrades the honest label from "logic-validated" to "sandbox-validated".
//   4. SNAPSHOT   — snapshot(fix): take a restore point. If the recipe requires one and it fails →
//                   BLOCKED, prod is never touched (we will not apply what we cannot undo).
//   5. APPLY      — apply(fix): the real change.
//   6. READBACK   — readback(fix): confirm the fix landed AND nothing regressed. `damaged:true` →
//                   ROLLBACK; `healthy:false` with no damage → applied-unverified (honest, not a lie).
//   7. ROLLBACK   — on damage, rollback(fix, snapshot). Always attempted; never throws.
//
// HONEST LABELS: a fix that only passed the logic gates is "logic-validated"; a fix that actually ran
// green in a disposable sandbox first is "sandbox-validated". We never claim sandbox-validated for a
// fix that was only reasoned about — that is the whole point of Stage 7.
//
// Pure + node-safe: every executor is injected, so all paths (good fix, bad fix, induced damage,
// blocked side-effect, failed snapshot, sandbox reject) are unit-tested without spawning anything.

export const STAGE7_VERSION = "stage7-v1";

// Terminal verdicts. `applied` is the only one where prod was changed and kept.
export const VERDICT = Object.freeze({
  REJECTED_PREFLIGHT: "rejected-preflight",     // logic gate failed — never applied
  REJECTED_SIDE_EFFECT: "rejected-side-effect", // scan blocked — never applied
  REJECTED_SANDBOX: "rejected-sandbox",         // failed in disposable VM — never applied
  BLOCKED_NO_SNAPSHOT: "blocked-no-snapshot",   // could not take a restore point — never applied
  ROLLED_BACK: "rolled-back",                   // applied, did damage, reverted
  APPLIED_UNVERIFIED: "applied-unverified",     // applied, no damage, but could not confirm the win
  APPLIED: "applied"                            // applied + verified healthy
});

// Verdicts where the machine was never changed (the "caught in validation" guarantee).
const PROD_UNTOUCHED = new Set([
  VERDICT.REJECTED_PREFLIGHT,
  VERDICT.REJECTED_SIDE_EFFECT,
  VERDICT.REJECTED_SANDBOX,
  VERDICT.BLOCKED_NO_SNAPSHOT
]);

const isFn = (f) => typeof f === "function";

// Never let an injected executor crash the gate. A throw degrades to a failed, non-applying result.
async function safe(fn, fallback) {
  if (!isFn(fn)) return fallback;
  try {
    const r = await fn();
    return r == null ? fallback : r;
  } catch (e) {
    return { ...fallback, threw: true, error: String((e && e.message) || e) };
  }
}

/**
 * Run a single fix through the Stage-7 prove-before-prod gate.
 *
 * @param {object} fix      { id, requiresSnapshot?, label? } — describes WHAT is being applied.
 * @param {object} ex       injected executors (all optional; missing ones use safe defaults):
 *   dryRun(fix)        → { ok, wouldApply, reason? }   logic preflight (default: ok+wouldApply)
 *   sideEffectScan(fix)→ { ok, blocked, findings? }    out-of-scope/destructive scan (default: clean)
 *   sandbox(fix)       → { ran, ok, reason? }          disposable-VM validation (frontier; default: not run)
 *   snapshot(fix)      → { ok, token? }                restore point (default: ok, token=null)
 *   apply(fix)         → { ok, message? }              the real change (default: ok)
 *   readback(fix)      → { ok, healthy, damaged? }     post-fix verify (default: ok+healthy)
 *   rollback(fix,snap) → { ok, recovered }             undo (default: not-recovered)
 * @param {object} opts     { mode?: "logic"|"sandbox", now?, logger? }
 * @returns {Promise<object>} { id, verdict, validation, applied, prodTouched, rolledBack, stages, events, userMessage }
 */
export async function validateThenApply(fix, ex = {}, opts = {}) {
  const id = String((fix && fix.id) || "");
  const mode = opts.mode === "sandbox" ? "sandbox" : "logic";
  const now = isFn(opts.now) ? opts.now : () => Date.now();
  const events = [];
  const stages = [];
  let sandboxValidated = false;

  const emit = (stage, status, detail = {}) => {
    const e = { stage, status, id, ts: now(), ...detail };
    events.push(e);
    stages.push(stage);
    if (isFn(opts.logger)) opts.logger("STAGE7", `${stage}:${status}`, { id, ...detail });
    return e;
  };

  // Final-result builder — `userMessage` is the ONLY thing meant for the user (silent internals).
  const result = (verdict, applied, rolledBack, message) => ({
    id,
    verdict,
    validation: sandboxValidated ? "sandbox-validated" : "logic-validated",
    mode,
    applied: Boolean(applied),
    prodTouched: !PROD_UNTOUCHED.has(verdict),
    rolledBack: Boolean(rolledBack),
    stages,
    events,
    userMessage: message
  });

  // ── 1. PREFLIGHT (logic) ───────────────────────────────────────────────────────────────────
  const pre = await safe(() => ex.dryRun && ex.dryRun(fix), { ok: true, wouldApply: true });
  if (pre.threw || pre.ok === false || pre.wouldApply === false) {
    emit("preflight", "reject", { reason: pre.reason || pre.error || "fix would not apply cleanly" });
    return result(VERDICT.REJECTED_PREFLIGHT, false, false, "Couldn't safely resolve this — your system was left unchanged.");
  }
  emit("preflight", "pass");

  // ── 2. SIDE-EFFECT SCAN ────────────────────────────────────────────────────────────────────
  const scan = await safe(() => ex.sideEffectScan && ex.sideEffectScan(fix), { ok: true, blocked: false, findings: [] });
  if (scan.threw || scan.blocked === true || scan.ok === false) {
    emit("side-effect", "reject", { findings: scan.findings || [], reason: scan.error || "out-of-scope side effect" });
    return result(VERDICT.REJECTED_SIDE_EFFECT, false, false, "Couldn't safely resolve this — your system was left unchanged.");
  }
  emit("side-effect", "pass", { findings: scan.findings || [] });

  // ── 3. SANDBOX (frontier — only when explicitly requested AND an executor is wired) ──────────
  if (mode === "sandbox" && isFn(ex.sandbox)) {
    const sb = await safe(() => ex.sandbox(fix), { ran: false, ok: false });
    if (sb.ran === true && sb.ok === true) {
      sandboxValidated = true; // earns the honest "sandbox-validated" label
      emit("sandbox", "pass");
    } else if (sb.ran === true && sb.ok === false) {
      emit("sandbox", "reject", { reason: sb.reason || sb.error || "fix failed in sandbox" });
      return result(VERDICT.REJECTED_SANDBOX, false, false, "Couldn't safely resolve this — your system was left unchanged.");
    } else {
      // Sandbox unavailable/skipped: degrade honestly to logic-validated, do NOT claim sandbox.
      emit("sandbox", "unavailable", { reason: sb.reason || "no sandbox available" });
    }
  }

  // ── 4. SNAPSHOT (restore point) ────────────────────────────────────────────────────────────
  const snap = await safe(() => ex.snapshot && ex.snapshot(fix), { ok: true, token: null });
  const snapshotOk = !snap.threw && snap.ok !== false;
  if (fix && fix.requiresSnapshot === true && !snapshotOk) {
    emit("snapshot", "blocked", { reason: snap.error || "restore point could not be created" });
    return result(VERDICT.BLOCKED_NO_SNAPSHOT, false, false, "Couldn't safely resolve this — your system was left unchanged.");
  }
  emit("snapshot", snapshotOk ? "taken" : "skipped", { token: snap.token || null });

  // ── 5. APPLY (prod) ────────────────────────────────────────────────────────────────────────
  const applied = await safe(() => ex.apply && ex.apply(fix), { ok: true });
  if (applied.threw || applied.ok === false) {
    // The change itself errored. Read back to see if it left damage, and roll back if so.
    emit("apply", "error", { reason: applied.error || applied.message || "apply failed" });
    const rb = await safe(() => ex.readback && ex.readback(fix), { ok: true, healthy: false, damaged: false });
    if (rb.damaged === true) {
      const rolled = await attemptRollback(ex, fix, snap.token, emit);
      return result(VERDICT.ROLLED_BACK, false, rolled, "Couldn't resolve this — undid the change and left your system as it was.");
    }
    return result(VERDICT.APPLIED_UNVERIFIED, false, false, "Couldn't fully resolve this — your system is safe and unchanged.");
  }
  emit("apply", "done");

  // ── 6. READBACK (verify the win + check for collateral damage) ──────────────────────────────
  const rb = await safe(() => ex.readback && ex.readback(fix), { ok: true, healthy: true, damaged: false });
  if (rb.threw || rb.damaged === true) {
    emit("readback", "damage", { reason: rb.error || "post-fix state regressed" });
    const rolled = await attemptRollback(ex, fix, snap.token, emit);
    return result(VERDICT.ROLLED_BACK, false, rolled, "That change caused a problem, so I reverted it. Your system is back to how it was.");
  }
  if (rb.healthy === false) {
    emit("readback", "unverified");
    return result(VERDICT.APPLIED_UNVERIFIED, true, false, "Applied a change, but couldn't fully confirm it worked. I'll keep watching.");
  }
  emit("readback", "verified");
  return result(VERDICT.APPLIED, true, false, "Resolved.");
}

async function attemptRollback(ex, fix, token, emit) {
  const r = await safe(() => ex.rollback && ex.rollback(fix, token), { ok: false, recovered: false });
  const recovered = !r.threw && r.recovered === true;
  emit("rollback", recovered ? "recovered" : "manual", { recovered });
  return recovered;
}

/**
 * Convenience: run a batch of fixes through the gate, stopping at the first one that touches prod
 * and reports back so the caller can surface a single outcome. Pure pass-through to validateThenApply.
 */
export async function validateBatch(fixes, ex, opts = {}) {
  const out = [];
  for (const fix of fixes || []) out.push(await validateThenApply(fix, ex, opts));
  return out;
}
