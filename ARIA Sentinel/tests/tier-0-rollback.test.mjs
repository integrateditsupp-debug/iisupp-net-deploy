// RUN 23b §1 — rollback safety: a fix that leaves a service worse triggers a recovery attempt; recovery
// either restores Running (rolledBack=true) or stops with a "manual intervention needed" note. NEVER throws.
import assert from "node:assert/strict";
import { executeTier0 } from "../src/main/tier-0-executor.mjs";

function svcRun({ start, afterRestart, afterRollback, restartExit = 0, calls } = {}) {
  let status = start;
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/^Restart-Service/i.test(c)) { status = afterRestart; return { stdout: status, stderr: "", exitCode: restartExit }; }
    if (/^Start-Service/i.test(c)) { status = afterRollback; return { stdout: status, stderr: "", exitCode: 0 }; }
    if (/Get-Service/i.test(c)) return { stdout: status + "\r\n", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

// Worse: was Running → restart left it Stopped → rollback Start-Service brings it back → recovered.
let calls = [];
let r = await executeTier0("restart-print-spooler", { run: svcRun({ start: "Running", afterRestart: "Stopped", afterRollback: "Running", calls }) });
assert.equal(r.outcome, "fail");
assert.equal(r.rolledBack, true);
assert.match(r.message, /recovered/i);
assert.ok(calls.some((c) => /^Start-Service/i.test(c)), "rollback issued Start-Service");
assert.ok(r.events.some((e) => e.event === "TIER0.ROLLBACK" && e.recovered === true));

// Worse + unrecoverable: rollback can't restore Running → manual intervention, never throws.
r = await executeTier0("restart-audio", { run: svcRun({ start: "Stopped", afterRestart: "Stopped", afterRollback: "Stopped" }) });
assert.equal(r.outcome, "fail");
assert.equal(r.rolledBack, false);
assert.match(r.message, /manual intervention/i);
assert.ok(r.events.some((e) => e.event === "TIER0.ROLLBACK" && e.manual === true));

// A throwing runner during the fix must not crash the executor.
r = await executeTier0("restart-bluetooth", { run: async (cmd) => { if (/^Restart-Service/i.test(cmd)) throw new Error("boom"); return { stdout: "Stopped", stderr: "", exitCode: 0 }; } }).catch(() => ({ outcome: "threw" }));
assert.notEqual(r.outcome, "threw", "executor swallows runner errors gracefully");

// DNS failure has no service to roll back — reported as not-applicable, never throws.
r = await executeTier0("flush-dns-cache", { run: async (cmd) => (/flushdns/i.test(cmd) ? { stdout: "", stderr: "err", exitCode: 1 } : { stdout: "5", stderr: "", exitCode: 0 }) });
assert.equal(r.outcome, "fail");
assert.equal(r.rolledBack, false);

console.log("Tier-0-rollback test passed (worse→recover · worse→manual · runner-throw safe · dns no-rollback).");
