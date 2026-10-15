// PROD 2026-10-14 (audit R1 / R2 / R14 / R10) — ONE honest sentence for what the gated fix pipeline actually did.
// PURE + browser-safe. Every "Resolve it for me" (recipe card, chat chip, fix offer, walk-through fallback, globe
// "Open fix") and the Approve toast hand the supervised-fix result here, so the words always match the result:
//   · policy / veto / blocked / notify-only  → the main process's own copy (why nothing ran), never "Running now"
//   · needs-admin                             → says Windows will ask for administrator approval (UAC)
//   · countdown                               → "Applying in Ns" with the Cancel affordance the card shows
//   · approval-requested / deferred           → where the fix is waiting
//   · preview (policy.dryRun !== false)       → "Previewed — nothing changed" + how to turn live fixes on
//   · running (policy.dryRun === false)       → "Fixing it now" — the only case allowed to say it
// Rule 14: "done" is never claimed from here; the audit log / fix history carry the verified outcome.

export const FIX_KINDS = Object.freeze(["unavailable", "blocked", "policy", "veto", "needs-admin", "countdown", "approval", "deferred", "preview", "running", "declined", "failed", "acknowledged", "done"]);

const LIVE_OFF_HINT = "Turn on Live fixes in Settings → Autonomy to apply it for real.";

function cleanReason(r) { return String(r || "").trim().replace(/[-_]+/g, " "); }

/**
 * @param {object|null} r  the supervisedFix / approveFix result (main.mjs runSupervisedFix shape)
 * @param {object} ctx     { liveFixes:{enabled}, title } — liveFixes.enabled picks the preview hint
 * @returns {{ kind:string, text:string, ok:boolean, cancelable:boolean, seconds:number|null, countdownId:string|null }}
 */
export function describeSupervisedResult(r, ctx = {}) {
  const live = ctx.liveFixes && typeof ctx.liveFixes === "object" ? ctx.liveFixes.enabled === true : undefined;
  const base = { ok: false, cancelable: false, seconds: null, countdownId: null };
  if (!r) return { ...base, kind: "unavailable", text: "Couldn't reach the fix pipeline — nothing was changed. Try again, or restart ARIA Sentinel." };
  if (r.error === "r11_blocked") return { ...base, kind: "blocked", text: r.copy || "This fix touches an excluded folder, so ARIA will not run it. Nothing was changed." };
  if (r.error === "bridge_unavailable") return { ...base, kind: "unavailable", text: "The desktop bridge is unavailable — nothing was changed. Restart ARIA Sentinel." };
  if (r.ok === false) {
    if (r.verdict === "veto") return { ...base, kind: "veto", text: r.copy || `The safety supervisor stopped this fix${r.reason ? ": " + cleanReason(r.reason) : ""}. Nothing was changed.` };
    if (r.verdict === "blocked") return { ...base, kind: "blocked", text: r.copy || "Fixes are paused on this device right now, so nothing was changed." };
    if (r.verdict === "notify-only") return { ...base, kind: "declined", text: r.copy || "Found it and flagged it — nothing was changed in this autonomy level." };
    if (r.verdict === "policy") {
      const admin = r.policy && (r.policy.needsAdmin || /admin/i.test(String(r.reason || "")));
      return { ...base, kind: admin ? "needs-admin" : "policy", text: r.copy || r.policy?.copy || (r.reason ? `Not run: ${cleanReason(r.reason)}. Nothing was changed.` : "This fix was held by the execution policy. Nothing was changed.") };
    }
    const why = r.copy || (r.reason ? `${cleanReason(r.reason)}.` : "");
    return { ...base, kind: "failed", text: why ? `Couldn't start this fix — ${why.replace(/\.$/, "")}. Nothing was changed.` : "Couldn't start this fix. Nothing was changed." };
  }
  if (r.bypass) return { ...base, ok: true, kind: "acknowledged", text: "Low-risk action acknowledged — nothing was changed on this device." };
  if (r.countdown) {
    const seconds = Number(r.seconds) || 10;
    const needsAdmin = Boolean(r.decision && r.decision.needsAdmin);
    return { ...base, ok: true, kind: "countdown", cancelable: true, seconds, countdownId: r.countdownId || null, text: `Applying in ${seconds}s — press Cancel on the countdown card${needsAdmin ? "; Windows will ask for administrator approval (UAC) when it runs" : ""}.` };
  }
  if (r.verdict === "approval-requested") {
    const needsAdmin = Boolean(r.decision && r.decision.needsAdmin);
    return { ...base, ok: true, kind: needsAdmin ? "needs-admin" : "approval", text: r.copy || "Waiting for approval — see Control Center → Approvals (and your email). Nothing runs until someone says yes." };
  }
  if (r.verdict === "deferred") return { ...base, ok: true, kind: "deferred", text: r.copy || "Queued for your next maintenance window — nothing changes until then." };
  const dryRun = !(r.policy && r.policy.dryRun === false);
  if (dryRun) {
    const held = r.policy && r.policy.copy;
    const hint = live === true ? "The global dry-run safety is on for this device." : LIVE_OFF_HINT;
    return { ...base, ok: true, kind: "preview", text: held || `Previewed safely — nothing was changed. ${hint}` };
  }
  const needsAdmin = Boolean(r.decision && r.decision.needsAdmin);
  return { ...base, ok: true, kind: needsAdmin ? "needs-admin" : "running", text: r.copy || (needsAdmin ? "Fixing it now — Windows will ask for administrator approval (UAC) first. The verified outcome lands in Dashboard → What I did." : "Fixing it now — the verified outcome lands in Dashboard → What I did.") };
}

/**
 * The Approve-button toast: branches on the EXECUTION result (r.result.ok), never on the ledger write alone.
 * approveFix returns { ok, approval, result } where result is the supervised-fix result (or null when denied/expired).
 */
export function approveToast(r, ctx = {}) {
  if (!r || r.ok === false) return { title: "Couldn't approve", body: (r && r.reason) ? `${cleanReason(r.reason)}.` : "Already decided or expired.", danger: true };
  const outcome = describeSupervisedResult(r.result, ctx);
  if (!r.result) return { title: "Approved", body: "Recorded — the fix did not run from this approval. Check Control Center → Approvals.", danger: true };
  if (outcome.ok === false) return { title: "Approved, but the fix did not run", body: outcome.text, danger: true };
  if (outcome.kind === "preview") return { title: "Approved — previewed only", body: outcome.text };
  return { title: outcome.kind === "needs-admin" ? "Approved — needs administrator approval" : "Approved", body: outcome.text };
}

/** The Dry-run button feedback (runRecipe({dryRun:true}) result shape: { ok, dryRun, message, recipe }). */
export function describeDryRun(r) {
  if (!r) return "Couldn't run the preview just now. Nothing was changed.";
  if (r.ok === false) return `Preview failed${r.message ? ": " + r.message : ""}. Nothing was changed.`;
  return `${r.message || "Previewed."} Nothing was changed on this device.`;
}

/** The kill-switch toast — only the main process knows whether an undo ran; use its sentence, never a default claim. */
export function killSwitchToast(info = {}) {
  const body = info && typeof info.toast === "string" && info.toast.trim() ? info.toast.trim() : `ARIA stopped${Number.isFinite(Number(info && info.killedCount)) ? ` · ${Number(info.killedCount)} process(es) terminated` : ""}. ${info && info.undoAvailable ? "An undo is available via System Restore (not applied automatically)." : "Nothing was undone automatically."}`;
  return { title: "ARIA stopped", body, danger: true };
}
