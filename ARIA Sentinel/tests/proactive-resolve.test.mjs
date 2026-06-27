// MODULE 4 — proactive silent resolution + user summary. Locks: only 'green' + non-destructive +
// Confirmed/Autonomous is silent-eligible (risky/destructive NEVER auto-run); Manual mode runs nothing
// silently; the summary counts ONLY what actually ran (failed ≠ fixed; no fake ticket); the payload is
// content-safe.
import assert from "node:assert/strict";
import {
  isSafeRisk, canResolveSilently, selectSilentlyResolvable, runProactiveSweep, buildUserSummary, summaryIsContentSafe
} from "../src/shared/proactive-resolve.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── 1 · isSafeRisk: only green ──
assert.equal(isSafeRisk("green"), true);
for (const r of ["yellow", "orange", "red", "", "GREENish"]) assert.equal(isSafeRisk(r), false, `${r} not safe`);
ok("safe risk == green only");

// ── 2 · canResolveSilently gating matrix ──
assert.equal(canResolveSilently({ risk: "green" }, "confirmed").ok, true);
assert.equal(canResolveSilently({ risk: "green" }, "autonomous").ok, true);
assert.equal(canResolveSilently({ risk: "green" }, "manual").ok, false, "manual never silent");
assert.equal(canResolveSilently({ risk: "yellow" }, "autonomous").ok, false, "yellow needs confirmation");
assert.equal(canResolveSilently({ risk: "green", destructive: true }, "autonomous").ok, false, "destructive never silent");
ok("gating matrix: green+confirmed/autonomous only; manual/risky/destructive excluded");

// ── 3 · selectSilentlyResolvable splits eligible vs must-prompt with reasons ──
{
  const issues = [
    { id: "clock-drift", risk: "green" },
    { id: "temp-bloat", risk: "green" },
    { id: "disk-wipe", risk: "red", destructive: true },
    { id: "driver-rollback", risk: "orange" }
  ];
  const { eligible, skipped } = selectSilentlyResolvable(issues, "autonomous");
  assert.deepEqual(eligible.map((e) => e.id), ["clock-drift", "temp-bloat"]);
  assert.equal(skipped.length, 2);
  assert.ok(skipped.find((s) => s.id === "disk-wipe").reason.includes("destructive"));
  ok("select: only safe issues eligible; risky/destructive returned for the prompted path");
}

// ── 4 · runProactiveSweep executes ONLY eligible, logs tickets, records honestly ──
{
  const executed = [];
  const issues = [
    { id: "clock-drift", risk: "green", kind: "resolved" },
    { id: "temp-bloat", risk: "green", kind: "prevented" },
    { id: "driver-rollback", risk: "orange" }
  ];
  const deps = {
    mode: "autonomous",
    execute: async (issue) => { executed.push(issue.id); return { ok: true, outcome: issue.kind }; },
    logTicket: async (issue) => ({ number: "INC-" + issue.id })
  };
  const { records, skipped } = await runProactiveSweep(issues, deps);
  assert.deepEqual(executed, ["clock-drift", "temp-bloat"], "risky issue never executed silently");
  assert.equal(skipped.length, 1);
  assert.equal(records.find((r) => r.id === "clock-drift").ticketNumber, "INC-clock-drift", "logs a real ticket per resolution");
  ok("sweep: executes only safe issues, logs a ServiceNow ticket per resolution");
}

// ── 5 · A failed silent fix is recorded as failed, never counted as resolved ──
{
  const issues = [{ id: "clock-drift", risk: "green", kind: "resolved" }, { id: "stale-dns", risk: "green", kind: "resolved" }];
  const deps = { mode: "confirmed", execute: async (i) => ({ ok: i.id !== "stale-dns", outcome: "resolved" }) };
  const { records } = await runProactiveSweep(issues, deps);
  assert.equal(records.find((r) => r.id === "stale-dns").outcome, "failed");
  const summary = buildUserSummary(records, {});
  assert.equal(summary.counts.resolved, 1, "only the real success counts as resolved");
  assert.equal(summary.counts.needsAttention, 1, "the failure is surfaced honestly");
  ok("honest counts: a failed silent fix is 'needsAttention', not 'resolved'");
}

// ── 6 · Manual mode → nothing runs silently ──
{
  const executed = [];
  const { records, skipped } = await runProactiveSweep([{ id: "clock-drift", risk: "green" }], { mode: "manual", execute: async (i) => { executed.push(i.id); return { ok: true, outcome: "resolved" }; } });
  assert.equal(executed.length, 0, "manual mode executes nothing silently");
  assert.equal(records.length, 0);
  assert.equal(skipped.length, 1);
  ok("manual mode: zero silent execution");
}

// ── 7 · buildUserSummary headline + content-safety ──
{
  const records = [
    { id: "clock-drift", label: "Clock drift corrected", risk: "green", outcome: "resolved", ticketNumber: "INC1" },
    { id: "temp-bloat", label: "Temp bloat cleared", risk: "green", outcome: "prevented", ticketNumber: "INC2" }
  ];
  const summary = buildUserSummary(records, { firstName: "Ada", email: "ada@example.com" }, { period: "today" });
  assert.match(summary.headline, /resolved 1 and prevented 1/i);
  assert.match(summary.headline, /weren't bothered/i);
  assert.equal(summaryIsContentSafe(summary), true, "summary payload is content-safe");
  ok("user summary: truthful headline ('resolved X / prevented Y'), content-safe");
}

// ── 8 · Empty period → honest 'nothing needed fixing' (no fabricated wins) ──
{
  const summary = buildUserSummary([], {});
  assert.match(summary.headline, /nothing needed fixing/i);
  assert.equal(summary.counts.resolved, 0);
  ok("empty sweep: honest 'nothing needed fixing', no fabricated wins");
}

assert.equal(tests, 8, "proactive-resolve runs exactly 8 cases");
console.log(`Proactive-resolve test passed (${tests}/8 · green-only silent · manual/risky/destructive excluded · failed≠fixed · content-safe summary).`);
