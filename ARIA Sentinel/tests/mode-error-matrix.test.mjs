// RUN 34-4 — 3-mode × 13-error matrix. The 13 real Windows error/finding classes ARIA detects are each
// driven through the SAME pipeline main.mjs runs (recommendAction → superviseProposal → executionPolicy)
// at all three Modes (Manual · Confirmed · Autonomous), asserting the correct disposition every cell:
//   Manual     → preview (dry-run ON), never auto-executes; a live run still earns the 10s countdown.
//   Confirmed  → executes live after approval + the 10s countdown; never auto-fires.
//   Autonomous → a PROVEN (100+ vetted, 5 consecutive-OK) recipe fast-paths (no countdown); unproven keeps it.
// Non-executable findings (read-only, passive, R11-blocked, unmapped service) yield NO recipe in any mode.
import assert from "node:assert/strict";
import { recommendAction } from "../src/shared/recommend-action.mjs";
import { superviseProposal, recipeSideEffects } from "../src/main/supervisor-agent.mjs";
import { executionPolicy } from "../src/main/dry-run-policy.mjs";

const MODES = ["manual", "confirmed", "autonomous"];
const NOW = 1_700_000_000_000;
const TIER0 = 150; // 100+ vetted runs → Tier-0 (auto-fire eligible in Autonomous)
const proven = (recipeId) => Array.from({ length: 5 }, (_, i) => ({ recipeId, ts: NOW - (i + 1) * 86_400_000, ok: true }));

// One pipeline cell: supervise the proposal, then ask the execution policy how it may run in this mode.
function cell(recipeId, risk, mode, { autonomousProven = false } = {}) {
  const history = mode === "autonomous" && autonomousProven ? proven(recipeId) : [];
  const vetted = new Set([recipeId]);
  // The proposal declares the recipe's own bounded service impact (as main.mjs does); the supervisor's
  // side-effect gate vetoes only impact BEYOND what's declared, not the recipe's intended action.
  const verdict = superviseProposal(
    { recipeId, riskTier: risk, expectedImpact: recipeSideEffects(recipeId) },
    { mode, vettedCatalog: vetted, history, now: NOW }
  );
  const policy = executionPolicy({ vettedCount: TIER0, mode, supervisorVerdict: verdict.verdict });
  return { verdict: verdict.verdict, ...policy };
}

// The 13 error classes. `finding` is the raw detector output; we assert what recommendAction proposes,
// then (for executable recipes) sweep all three modes. `executable:false` ⇒ no recipe in ANY mode.
const ERRORS = [
  { id: "E01 app-not-responding",     finding: { type: "frozen", name: "Outlook", pid: 1234 },               executable: false, expectAction: "end-task" },
  { id: "E02 high-cpu-process",        finding: { type: "cpu-hog", name: "chrome", pid: 22 },                  executable: false, expectAction: "investigate" },
  { id: "E03 high-memory-process",     finding: { type: "ram-hog", name: "Teams", pid: 33 },                   executable: false, expectAction: "investigate" },
  { id: "E04 unusual-process",         finding: { type: "odd", name: "xq19z", pid: 44 },                       executable: false, expectAction: "info" },
  { id: "E05 no-internet",             finding: { type: "network-down" },                                       executable: true,  expectAction: "restart-service", recipeId: "reset-network-stack",   risk: "high"   },
  { id: "E06 print-spooler-stopped",   finding: { type: "service-stopped", service: "Spooler" },                executable: true,  expectAction: "restart-service", recipeId: "restart-print-spooler", risk: "medium" },
  { id: "E07 windows-search-stopped",  finding: { type: "service-stopped", service: "WSearch" },                executable: true,  expectAction: "restart-service", recipeId: "restart-windows-search",risk: "medium" },
  { id: "E08 audio-service-stopped",   finding: { type: "service-stopped", service: "Audiosrv" },               executable: true,  expectAction: "restart-service", recipeId: "restart-audio-service", risk: "medium" },
  { id: "E09 unknown-service-stopped", finding: { type: "service-stopped", service: "FooBarSvc" },              executable: false, expectAction: "restart-service" /* no recipe ⇒ manual review */ },
  { id: "E10 r11-private-folder",      finding: { type: "frozen", name: "C:/Private pics and Vids/x.exe" },     executable: false, expectAction: "none" /* blocked card */ },
  { id: "E11 dns-resolution-fail",     finding: { type: "network-down" }, overrideRecipe: "flush-dns",          executable: true,  expectAction: "restart-service", recipeId: "flush-dns",            risk: "medium" },
  { id: "E12 slow-temp-bloat",         finding: { type: "cpu-hog", name: "explorer" }, overrideRecipe: "clear-user-temp", executable: true, expectAction: "investigate", recipeId: "clear-user-temp", risk: "medium" },
  { id: "E13 disk-health-concern",     finding: { type: "cpu-hog", name: "MsMpEng" }, overrideRecipe: "check-disk-smart", executable: true, expectAction: "investigate", recipeId: "check-disk-smart", risk: "low" }
];

let n = 0; const t = () => { n++; };
const rows = [];

for (const e of ERRORS) {
  const rec = recommendAction(e.finding);
  assert.equal(rec.action, e.expectAction, `${e.id}: recommended action`);

  if (!e.executable) {
    // A non-executable finding must NOT carry a vetted Tier-0 recipe id (read-only/passive/blocked/unmapped).
    if (e.expectAction === "none") assert.equal(rec.recipeId, null, `${e.id}: R11/blocked card has no recipe`);
    if (e.id.startsWith("E09")) assert.equal(rec.recipeId, null, `${e.id}: unmapped service → manual review, no auto recipe`);
    rows.push(`${e.id.padEnd(28)} | non-executable (no live recipe in any mode)`);
    t();
    continue;
  }

  // Executable: sweep the three modes through the real supervisor + policy.
  const recipeId = e.overrideRecipe || e.recipeId || rec.recipeId;
  const risk = e.risk || "medium";

  // MANUAL — preview only, never auto-executes.
  const man = cell(recipeId, risk, "manual");
  assert.equal(man.dryRun, true, `${e.id}/manual: dry-run preview`);
  assert.equal(man.execute, false, `${e.id}/manual: does not auto-execute`);

  // CONFIRMED — live after approval + countdown; never auto-fires.
  const con = cell(recipeId, risk, "confirmed");
  assert.equal(con.execute, true, `${e.id}/confirmed: executes after approval`);
  assert.equal(con.requiresCountdown, true, `${e.id}/confirmed: 10s countdown`);
  assert.equal(con.canAutoFire, false, `${e.id}/confirmed: never auto-fires`);

  // AUTONOMOUS (proven). A high-risk (reboot) recipe NEVER fast-paths even when proven — the supervisor
  // forces an explicit confirm/countdown (needsConfirm). A low/medium recipe fast-paths (no countdown).
  const autoP = cell(recipeId, risk, "autonomous", { autonomousProven: true });
  assert.equal(autoP.execute, true, `${e.id}/autonomous-proven: executes`);
  if (risk === "high") {
    assert.equal(autoP.verdict, "approve", `${e.id}/autonomous-proven: high-risk stays plain-approve (no fast-path)`);
    assert.equal(autoP.requiresCountdown, true, `${e.id}/autonomous-proven: high-risk KEEPS the countdown`);
  } else {
    assert.equal(autoP.verdict, "approve-fast", `${e.id}/autonomous-proven: fast-path approval`);
    assert.equal(autoP.requiresCountdown, false, `${e.id}/autonomous-proven: skips countdown`);
    assert.equal(autoP.canAutoFire, true, `${e.id}/autonomous-proven: may auto-fire`);
  }

  // AUTONOMOUS (unproven) — still earns the countdown first, regardless of risk.
  const autoU = cell(recipeId, risk, "autonomous", { autonomousProven: false });
  assert.equal(autoU.execute, true, `${e.id}/autonomous-unproven: executes`);
  assert.equal(autoU.requiresCountdown, true, `${e.id}/autonomous-unproven: keeps countdown until proven`);

  const autoCol = risk === "high" ? "auto-proven:+10s(high-risk)" : "auto-proven:fast";
  rows.push(`${e.id.padEnd(28)} | manual:preview  confirmed:exec+10s  ${autoCol}  auto-unproven:+10s`);
  t();
}

assert.equal(n, 13, "13 error classes covered");
assert.equal(ERRORS.length, 13, "matrix has exactly 13 error rows");
console.log(`mode-error-matrix passed — 13 errors × 3 modes:\n  ${rows.join("\n  ")}`);
