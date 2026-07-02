// RUN 23b §1 — Tier-0 executor: pre→exec→post wrapper, classify, dry-run, allowlist, alias, unbound.
// `run` is injected (a stateful fake service/dns runner) so no PowerShell spawns during tests.
import assert from "node:assert/strict";
import { executeTier0, resolveExecutorId, validateTier0Command, TIER0_COMMANDS, TIER0_EXECUTOR_IDS } from "../src/main/tier-0-executor.mjs";

// Stateful fake for a service: Restart-Service sets status, Get-Service reports it, Start-Service recovers.
function svcRun({ start = "Stopped", afterRestart = "Running", restartExit = 0, afterRollback = "Running", calls } = {}) {
  let status = start;
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/^Restart-Service/i.test(c)) { status = afterRestart; return { stdout: status, stderr: "", exitCode: restartExit }; }
    if (/^Start-Service/i.test(c)) { status = afterRollback; return { stdout: status, stderr: "", exitCode: 0 }; }
    if (/Get-Service/i.test(c)) return { stdout: status + "\r\n", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}
function dnsRun({ start = 50, exit = 0, calls } = {}) {
  let count = start;
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/flushdns/i.test(c)) { count = 0; return { stdout: "", stderr: "", exitCode: exit }; }
    if (/Get-DnsClientCache/i.test(c)) return { stdout: String(count), stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

// 5 bindings present + ids stable.
assert.deepEqual(TIER0_EXECUTOR_IDS, ["restart-print-spooler", "restart-windows-update", "flush-dns-cache", "reset-network-stack", "clear-print-queue", "restart-bluetooth", "restart-audio"]); // S2 slice 1 (F5) added the 2 missing bindings

// 1 — service success (was Stopped → now Running).
let r = await executeTier0("restart-print-spooler", { run: svcRun({ start: "Stopped", afterRestart: "Running" }) });
assert.equal(r.outcome, "success");
assert.equal(r.before, "Stopped");
assert.equal(r.after, "Running");
assert.ok(r.events.some((e) => e.event === "TIER0.PRE"));
assert.ok(r.events.some((e) => e.event === "TIER0.EXEC"));
assert.ok(r.events.some((e) => e.event === "TIER0.POST"));

// 2 — service no-op-neutral (already Running).
r = await executeTier0("restart-windows-update", { run: svcRun({ start: "Running", afterRestart: "Running" }) });
assert.equal(r.outcome, "no-op-neutral");

// 3 — the other two service recipes succeed too.
assert.equal((await executeTier0("restart-bluetooth", { run: svcRun({ start: "Stopped" }) })).outcome, "success");
assert.equal((await executeTier0("restart-audio", { run: svcRun({ start: "Stopped" }) })).outcome, "success");

// 4 — DNS flush success + neutral.
assert.equal((await executeTier0("flush-dns-cache", { run: dnsRun({ start: 50 }) })).outcome, "success");
assert.equal((await executeTier0("flush-dns-cache", { run: dnsRun({ start: 0 }) })).outcome, "no-op-neutral");

// 5 — exitCode≠0 → fail (and a rollback attempt for a service).
r = await executeTier0("restart-print-spooler", { run: svcRun({ start: "Stopped", afterRestart: "Stopped", restartExit: 1 }) });
assert.equal(r.outcome, "fail");

// 6 — DRY-RUN never spawns the remediation command (no Restart-Service in the call log).
const calls = [];
r = await executeTier0("restart-print-spooler", { dryRun: true, run: svcRun({ start: "Stopped", calls }) });
assert.equal(r.outcome, "dry-run");
assert.ok(!calls.some((c) => /Restart-Service/i.test(c)), "dry-run must not restart");
assert.ok(r.events.some((e) => e.event === "TIER0.EXEC" && e.dryRun === true));

// 7 — alias + unbound.
assert.equal(resolveExecutorId("restart-audio-service"), "restart-audio");
assert.equal((await executeTier0("restart-audio-service", { run: svcRun({ start: "Stopped" }) })).outcome, "success");
assert.equal((await executeTier0("totally-unknown", {})).outcome, "unbound");

// 8 — logger receives every step.
const logged = [];
await executeTier0("restart-print-spooler", { run: svcRun({ start: "Stopped" }), logger: (ev) => logged.push(ev) });
assert.ok(logged.includes("TIER0.PRE") && logged.includes("TIER0.EXEC") && logged.includes("TIER0.POST"));

// 9 — allowlist validation: every catalog command + probe passes; a destructive deny-listed command fails.
for (const id of TIER0_EXECUTOR_IDS) {
  assert.ok(validateTier0Command(TIER0_COMMANDS[id].command), `${id} command allowlisted`);
  if (TIER0_COMMANDS[id].probe) assert.ok(validateTier0Command(TIER0_COMMANDS[id].probe), `${id} probe allowlisted`);
}
assert.equal(validateTier0Command("bcdedit /set x"), false);
assert.equal(validateTier0Command("Restart-Service Spooler; diskpart"), false);

console.log("Tier-0-executor test passed (5 bindings · success/neutral/fail · dry-run no-spawn · alias · unbound · logger · allowlist).");
