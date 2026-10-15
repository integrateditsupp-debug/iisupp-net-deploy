// PROD 2026-10-14 (audit R1 / R2 / R14 / R10 / R9) — what a fix REALLY did, in words. The one describer every
// Resolve / Approve / overlay "Open fix" surface uses must: carry main's own policy copy (why nothing ran), say
// needs-admin, declined, failed, countdown (cancelable, with the id), approval, deferred, preview — and say
// "Fixing it now" ONLY for a result whose policy says dryRun:false. The Approve toast branches on result.ok;
// the kill toast is main's sentence, never a default "last action undone".
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describeSupervisedResult, approveToast, describeDryRun, killSwitchToast, FIX_KINDS } from "../src/shared/fix-outcome.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let n = 0; const t = () => { n++; };
const OFF = { liveFixes: { enabled: false } };

// 1 — nothing ran: the real reason, never "Running".
const cases = [
  [null, "unavailable", /Couldn't reach the fix pipeline — nothing was changed/],
  [{ ok: false, error: "r11_blocked", copy: "This fix touches an excluded folder, so ARIA will not run it." }, "blocked", /excluded folder/],
  [{ ok: false, error: "bridge_unavailable" }, "unavailable", /desktop bridge is unavailable/],
  [{ ok: false, verdict: "veto", reason: "proposal names a private path", copy: "The safety supervisor stopped this fix: proposal names a private path" }, "veto", /safety supervisor stopped/],
  [{ ok: false, verdict: "policy", reason: "Tier-2 recipe runs only in Manual mode", copy: "Tier-2 recipe runs only in Manual mode", policy: {} }, "policy", /Tier-2 recipe runs only in Manual mode/],
  [{ ok: false, verdict: "policy", reason: "needs-admin-unavailable", policy: { needsAdmin: true } }, "needs-admin", /needs admin unavailable/],
  [{ ok: false, verdict: "blocked", copy: "Fixes are paused on this device right now, so nothing was changed." }, "blocked", /paused on this device/],
  [{ ok: false, verdict: "notify-only", copy: "Found it and flagged it — I'm in observe mode, so nothing was changed." }, "declined", /observe mode/],
  [{ ok: false, reason: "spawn_failed" }, "failed", /Couldn't start this fix — spawn failed\. Nothing was changed\./]
];
for (const [r, kind, re] of cases) {
  const o = describeSupervisedResult(r, OFF);
  assert.equal(o.kind, kind, `kind for ${JSON.stringify(r)}`);
  assert.equal(o.ok, false); assert.match(o.text, re); assert.doesNotMatch(o.text, /Running now|Fixing it now|applied/i, `never claims a run: ${o.text}`);
}
t();

// 2 — it may run: countdown (cancelable, carries the id), approval, deferred, preview, running, needs-admin.
const cd = describeSupervisedResult({ ok: true, verdict: "approve", countdown: true, countdownId: "cd-1", seconds: 10, policy: { dryRun: false }, decision: { action: "execute", needsAdmin: true } }, OFF);
assert.equal(cd.kind, "countdown"); assert.equal(cd.cancelable, true); assert.equal(cd.countdownId, "cd-1"); assert.equal(cd.seconds, 10); assert.match(cd.text, /Applying in 10s — press Cancel on the countdown card; Windows will ask for administrator approval/);
const ap = describeSupervisedResult({ ok: true, verdict: "approval-requested", copy: "I've asked for approval before touching anything." }, OFF);
assert.equal(ap.kind, "approval"); assert.match(ap.text, /asked for approval/);
const apAdmin = describeSupervisedResult({ ok: true, verdict: "approval-requested", decision: { needsAdmin: true }, copy: "This fix needs administrator approval (UAC)…" }, OFF);
assert.equal(apAdmin.kind, "needs-admin");
const df = describeSupervisedResult({ ok: true, verdict: "deferred", copy: "Queued for your next maintenance window — nothing changes until then." }, OFF);
assert.equal(df.kind, "deferred"); assert.match(df.text, /maintenance window/);
const pv = describeSupervisedResult({ ok: true, verdict: "approve", countdown: false, policy: { dryRun: true } }, OFF);
assert.equal(pv.kind, "preview"); assert.match(pv.text, /Previewed safely — nothing was changed\. Turn on Live fixes in Settings → Autonomy/);
const pvHeld = describeSupervisedResult({ ok: true, verdict: "approve", countdown: false, policy: { dryRun: true, heldBy: "live-fixes-off", copy: "Preview only — live fixes are off. Turn them on in Settings → Fixes to apply this for real." } }, OFF);
assert.equal(pvHeld.kind, "preview"); assert.match(pvHeld.text, /^Preview only — live fixes are off/, "main's own held copy wins");
const pvOn = describeSupervisedResult({ ok: true, policy: { dryRun: true } }, { liveFixes: { enabled: true } });
assert.match(pvOn.text, /global dry-run safety is on/, "with live fixes ON the preview names the other switch");
const run = describeSupervisedResult({ ok: true, verdict: "approve", countdown: false, policy: { dryRun: false }, decision: { action: "execute" }, copy: "Fixing it now — I'll tell you when it's done." }, OFF);
assert.equal(run.kind, "running"); assert.match(run.text, /^Fixing it now/);
const runAdmin = describeSupervisedResult({ ok: true, countdown: false, policy: { dryRun: false }, decision: { action: "execute", needsAdmin: true } }, OFF);
assert.equal(runAdmin.kind, "needs-admin"); assert.match(runAdmin.text, /administrator approval \(UAC\)/);
assert.equal(describeSupervisedResult({ ok: true, bypass: true, action: "info" }).kind, "acknowledged");
for (const k of ["unavailable", "blocked", "policy", "veto", "needs-admin", "countdown", "approval", "deferred", "preview", "running", "declined", "failed", "acknowledged"]) assert.ok(FIX_KINDS.includes(k));
t();

// 3 — the Approve toast branches on the EXECUTION result, and the dry-run / kill toasts are honest.
assert.deepEqual(approveToast({ ok: false, reason: "already-decided" }), { title: "Couldn't approve", body: "already decided.", danger: true });
const held = approveToast({ ok: true, approval: {}, result: { ok: false, verdict: "policy", copy: "Preview only — live fixes are off." } }, OFF);
assert.equal(held.title, "Approved, but the fix did not run"); assert.equal(held.danger, true); assert.match(held.body, /live fixes are off/);
assert.match(approveToast({ ok: true, approval: {}, result: null }).body, /did not run from this approval/);
assert.equal(approveToast({ ok: true, approval: {}, result: { ok: true, policy: { dryRun: true } } }, OFF).title, "Approved — previewed only");
assert.equal(approveToast({ ok: true, approval: {}, result: { ok: true, policy: { dryRun: false }, decision: { action: "execute" }, copy: "Fixing it now — a restore point is in place so it can be undone." } }, OFF).title, "Approved");
assert.equal(approveToast({ ok: true, approval: {}, result: { ok: true, policy: { dryRun: false }, decision: { action: "execute", needsAdmin: true } } }, OFF).title, "Approved — needs administrator approval");
assert.match(describeDryRun({ ok: true, dryRun: true, message: "Would restart the Print Spooler service." }), /^Would restart the Print Spooler service\. Nothing was changed on this device\.$/);
assert.match(describeDryRun(null), /Couldn't run the preview/); assert.match(describeDryRun({ ok: false, message: "denied" }), /Preview failed: denied/);
assert.deepEqual(killSwitchToast({ toast: "ARIA terminated — nothing to undo." }), { title: "ARIA stopped", body: "ARIA terminated — nothing to undo.", danger: true });
assert.doesNotMatch(killSwitchToast({ killedCount: 2 }).body, /last action undone/, "no 'last action undone' without main saying so");
assert.match(killSwitchToast({ killedCount: 2 }).body, /Nothing was undone automatically/);
assert.match(killSwitchToast({ killedCount: 2, undoAvailable: true }).body, /undo is available via System Restore \(not applied automatically\)/);
t();

// 4 — wiring: every resolve surface + the approve toast + the kill toast go through the describer (never local "Running now" copy).
const renderer = rd("src", "renderer", "renderer.js");
const overlay = rd("src", "renderer", "overlay.js");
assert.equal((renderer.match(/describeSupervisedResult\(/g) || []).length >= 3, true, "recipe card / chat chip / fix offer use the describer");
assert.match(renderer, /showToast\(approveToast\(r, \{ liveFixes: next && next\.liveFixes \}\)\)/, "Control Center Approve toast branches on result.ok");
assert.match(renderer, /showToast\(killSwitchToast\(info \|\| \{\}\)\)/, "the kill toast uses main's sentence");
assert.doesNotMatch(renderer, /\|\| "last action undone"/, "no default 'last action undone' fallback");
assert.doesNotMatch(renderer, /Running through the gated pipeline now/, "no unconditional 'Running' toast");
assert.doesNotMatch(renderer, /Running now — the verified outcome/, "no unconditional 'Running now' status");
assert.match(overlay, /sentinel\.supervisedFix\(\{ recipeId: currentDetection\.recipeId, mode: "confirmed", source: "overlay"/, "overlay 'Open fix' goes through the supervised pipeline");
assert.doesNotMatch(overlay, /runRecipe\(currentDetection\.recipeId, \{ dryRun: true \}\)/, "…never a bare dry-run that reads 'DRY-RUN COMPLETE'");
assert.match(overlay, /describeSupervisedResult\(r\)/, "overlay card copy = the real outcome");
assert.match(renderer, /sentinel\.onCountdownTick\?\.\(\(info\) => \{ if \(info\) showCountdownCard\(info\); \}\)/, "the in-app countdown card subscribes to ticks");
assert.match(renderer, /sentinel\.cancelCountdown\(cur\.id\)/, "Cancel aborts the countdown by id");
assert.match(renderer, /describeDryRun\(r\)/, "Dry-run gives visible feedback");
t();

assert.equal(n, 4, "4 fix-outcome-copy groups");
console.log(`fix-outcome-copy test passed (${n} groups · nothing-ran reasons · countdown/approval/deferred/preview/running/needs-admin · approve toast on result.ok + honest dry-run/kill toasts · every surface wired to the describer).`);
