// RUN-CU / CU4 — approval policy truth table. Every row the wizard cards promise is proven here, plus the
// two invariants that matter most: red is never automated, and a yellow never executes without a REAL
// restore point. Pure module, no Electron.
import assert from "node:assert/strict";
import { decideExecution, describeDecision, LEVELS, COLORS, ACTIONS, APPROVER_MODES } from "../src/shared/approval-policy.mjs";

let n = 0; const t = () => { n++; };

// 1 — kill switch / blocked win over everything, at every level, every colour, every approver mode.
for (const level of LEVELS) for (const color of COLORS) for (const approverMode of APPROVER_MODES) {
  assert.equal(decideExecution({ level, color, approverMode, inWindow: true, hasRestorePoint: true, killed: true }).action, "blocked", `${level}/${color}: killed → blocked`);
  assert.equal(decideExecution({ level, color, approverMode, inWindow: true, hasRestorePoint: true, blocked: true }).action, "blocked", `${level}/${color}: blocked → blocked`);
}
assert.equal(decideExecution({ level: "full-auto", color: "green", killed: true }).reason, "kill-switch");
assert.equal(decideExecution({ level: "full-auto", color: "green", blocked: true }).reason, "agent-blocked");
t();

// 2 — observe: notify-only for every colour ("I find it, I tell you, I touch nothing").
for (const color of COLORS) {
  const d = decideExecution({ level: "observe", color, inWindow: true, hasRestorePoint: true });
  assert.equal(d.action, "notify-only", `observe/${color} → notify-only`);
  assert.equal(d.notifyBefore, true);
}
t();

// 3 — red is NEVER automated at any level (even full-auto, in window, with a restore point).
// 2026-10-14 (review P1-1) — EXPECTATION CHANGED ON PURPOSE for safe-auto only: Confirmed asks once for EVERY colour, so a
// red detection there is an approval request (a person decides; nothing red ever executes) instead of notify-only.
for (const level of LEVELS) {
  const d = decideExecution({ level, color: "red", inWindow: true, hasRestorePoint: true });
  assert.notEqual(d.action, "execute", `${level}/red is never executed`);
  if (level === "safe-auto") { assert.equal(d.action, "request-approval", "safe-auto/red → asked once"); assert.equal(d.reason, "confirmed-asks-once"); continue; }
  assert.equal(d.action, "notify-only", `${level}/red → notify-only`);
  if (level !== "observe") assert.equal(d.reason, "red-never-automated");
}
t();

// 4 — approve-first asks before every fix (green and yellow).
for (const color of ["green", "yellow"]) {
  const d = decideExecution({ level: "approve-first", color, inWindow: true, hasRestorePoint: true });
  assert.equal(d.action, "request-approval", `approve-first/${color} → request-approval`);
  assert.equal(d.reason, "level-approve-first");
}
t();

// 5 — safe-auto (Confirmed): asks ONCE for every colour; it never executes on its own.
// 2026-10-14 (review P1-1) — EXPECTATION CHANGED ON PURPOSE. The owner's decision: "Confirmed = asks once, every time; it
// never executes unattended. Unattended execution exists only in Autonomous mode via the 3-notice rule." safe-auto used to
// EXECUTE a green fix on its own ("I fix the safe things myself and tell you after") while Settings said "applies the fix
// only after you approve" — now the table does what Settings says.
for (const color of COLORS) for (const inWindow of [true, false]) for (const hasRestorePoint of [true, false]) {
  const d = decideExecution({ level: "safe-auto", color, inWindow, hasRestorePoint, tier: 0 });
  assert.equal(d.action, "request-approval", `safe-auto/${color}/${inWindow}/${hasRestorePoint} → request-approval`);
  assert.equal(d.reason, "confirmed-asks-once");
  assert.equal(d.notifyBefore, true); assert.equal(d.notifyAfter, false);
  assert.equal(d.requiresRestorePoint, color === "yellow", "a yellow fix still needs its restore point when it runs");
}
assert.match(describeDecision(decideExecution({ level: "safe-auto", color: "green" })), /asks once per fix: approve it on the card \(one click\)/);
t();

// 6 — full-auto: green executes any time; yellow executes only in window WITH a real restore point; else defers.
{
  const g = decideExecution({ level: "full-auto", color: "green", inWindow: false });
  assert.equal(g.action, "execute"); assert.equal(g.reason, "full-auto-green");
  const yIn = decideExecution({ level: "full-auto", color: "yellow", inWindow: true, hasRestorePoint: true });
  assert.equal(yIn.action, "execute"); assert.equal(yIn.requiresRestorePoint, true); assert.equal(yIn.notifyAfter, true);
  const yOut = decideExecution({ level: "full-auto", color: "yellow", inWindow: false, hasRestorePoint: true });
  assert.equal(yOut.action, "defer-window"); assert.equal(yOut.reason, "outside-maintenance-window");
}
t();

// 7 — a yellow execute WITHOUT a real restore point degrades to request-approval ('restore-point-unavailable').
{
  const d = decideExecution({ level: "full-auto", color: "yellow", inWindow: true, hasRestorePoint: false });
  assert.equal(d.action, "request-approval");
  assert.equal(d.reason, "restore-point-unavailable");
  assert.equal(d.requiresRestorePoint, true);
  // a store record is not a restore point: anything but `true` reads as unavailable.
  for (const v of ["yes", 1, {}, null, undefined]) {
    assert.equal(decideExecution({ level: "full-auto", color: "yellow", inWindow: true, hasRestorePoint: v }).reason, "restore-point-unavailable", `hasRestorePoint=${JSON.stringify(v)} is not real`);
  }
}
t();

// 8 — unknown inputs fall to the SAFE side: unknown level asks, unknown colour is red, output shape is stable.
{
  assert.equal(decideExecution({ level: "yolo", color: "green" }).action, "request-approval", "unknown level → approve-first behaviour");
  assert.equal(decideExecution({ level: "full-auto", color: "purple", inWindow: true, hasRestorePoint: true }).action, "notify-only", "unknown colour → red");
  const d = decideExecution({});
  assert.deepEqual(Object.keys(d).sort(), ["action", "approverMode", "color", "level", "notifyAfter", "notifyBefore", "reason", "requiresRestorePoint", "tier"].sort());
  assert.ok(ACTIONS.includes(d.action));
  // every (level × colour × window × restore point) combination yields a known action
  for (const level of LEVELS) for (const color of COLORS) for (const inWindow of [true, false]) for (const hasRestorePoint of [true, false]) {
    assert.ok(ACTIONS.includes(decideExecution({ level, color, inWindow, hasRestorePoint }).action), `${level}/${color}/${inWindow}/${hasRestorePoint}`);
  }
}
t();

// 9 — describeDecision gives plain, honest copy for every action (never claims a change that was not made).
for (const action of ACTIONS) {
  const copy = describeDecision({ action, reason: "", requiresRestorePoint: false });
  assert.ok(copy.length > 10, `${action} has copy`);
}
assert.match(describeDecision({ action: "notify-only", reason: "red-never-automated" }), /nothing was changed/i);
assert.match(describeDecision({ action: "request-approval", reason: "restore-point-unavailable" }), /restore point/i);
assert.match(describeDecision({ action: "defer-window" }), /maintenance window/i);
t();

assert.equal(n, 9, "9 approval-policy groups");
console.log(`approval-policy test passed (${n} groups · killed/blocked first · observe notify-only · red never automated · approve-first asks · safe-auto (Confirmed) asks once for every colour · full-auto window + real restore point · safe defaults · honest copy).`);
