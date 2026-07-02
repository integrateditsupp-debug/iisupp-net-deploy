// STAGE 3 S2 (packet slice 1, audit F5) — the 2 new Tier-0 bindings are SAFE before they are useful:
// reset-network-stack + clear-print-queue run only through the existing pre→exec→post→rollback wrapper,
// R11 stays check #1, the allowlist boundary holds (no web-request verbs sneak in), dry-run never spawns
// the remediation, no-op-neutral is never a fix, and one-way steps say honestly that no rollback exists.
// Pure + injectable: nothing real spawns.
import assert from "node:assert/strict";
import {
  executeTier0, resolveExecutorId, validateTier0Command, TIER0_COMMANDS, TIER0_EXECUTOR_IDS
} from "../src/main/tier-0-executor.mjs";
import { recipes } from "../src/main/recipes/tier-0/catalog.mjs";
import { validateTier0 } from "../src/main/recipes/tier-0/index.mjs";

function spoolRun(state, calls) {
  return async (cmd) => {
    const c = String(cmd); if (calls) calls.push(c);
    if (/Remove-PrintJob/i.test(c)) { state.jobs = state.clearFails ? state.jobs : 0; return { stdout: "", stderr: "", exitCode: state.clearFails ? 1 : 0 }; }
    if (/Get-PrintJob/i.test(c)) return { stdout: String(state.jobs) + "\r\n", stderr: "", exitCode: 0 };
    if (/winsock/i.test(c)) return { stdout: "Winsock reset completed", stderr: "", exitCode: state.netshExit ?? 0 };
    if (/Get-NetAdapter/i.test(c)) return { stdout: String(state.adapters ?? 1), stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

// 1 — both S2 bindings resolve canonically and live in the executor id set.
assert.equal(resolveExecutorId("reset-network-stack"), "reset-network-stack");
assert.equal(resolveExecutorId("clear-print-queue"), "clear-print-queue");
assert.ok(TIER0_EXECUTOR_IDS.includes("reset-network-stack") && TIER0_EXECUTOR_IDS.includes("clear-print-queue"));

// 2 — command + probe strings pass the allowlist; the deny boundary still holds elsewhere.
for (const id of ["reset-network-stack", "clear-print-queue"]) {
  const spec = TIER0_COMMANDS[id];
  assert.equal(validateTier0Command(spec.command), true, `${id} command allowlisted`);
  assert.equal(validateTier0Command(spec.probe), true, `${id} probe allowlisted`);
  // probes are read-only in shape: a probe must never mutate.
  assert.match(spec.probe, /^\(Get-/, `${id} probe starts read-only`);
  assert.doesNotMatch(spec.probe, /Remove-|Restart-|Stop-|Start-|Set-|winsock/i, `${id} probe contains no mutation verb`);
}
assert.equal(validateTier0Command("diskpart /s evil.txt"), false, "deny list intact");
assert.equal(validateTier0Command("reg add HKLM\\x /v y"), false, "reg add still denied");
assert.equal(validateTier0Command("Invoke-WebRequest https://x.example"), false, "no web-request verb was allowlisted (F2 probes use Resolve-DnsName/Test-NetConnection only)");
assert.equal(validateTier0Command("Format-Volume -DriveLetter C"), false, "format still denied");

// 3 — 🔒 R11 is check #1: a private-laden id never executes; nothing spawns.
{
  const calls = [];
  const res = await executeTier0("fix C:\\Users\\a\\Private pics and Vids\\net", { run: spoolRun({ jobs: 0 }, calls) });
  assert.equal(res.outcome, "unbound"); // never resolves to a binding
  assert.equal(calls.length, 0, "no command spawned for a private-laden id");
  assert.doesNotMatch(res.recipeId, /private pics and vids/i, "id redacted in the result");
}

// 4 — dry-run NEVER spawns the remediation and never claims success.
{
  const calls = [];
  const res = await executeTier0("reset-network-stack", { dryRun: true, run: spoolRun({ adapters: 2 }, calls) });
  assert.equal(res.outcome, "dry-run");
  assert.equal(calls.some((c) => /winsock/i.test(c)), false, "netsh never ran in dry-run");
  assert.equal(calls.some((c) => /Remove-PrintJob/i.test(c)), false);
}
{
  const calls = [];
  const res = await executeTier0("clear-print-queue", { dryRun: true, run: spoolRun({ jobs: 4 }, calls) });
  assert.equal(res.outcome, "dry-run");
  assert.equal(calls.some((c) => /Remove-PrintJob/i.test(c)), false, "clear never ran in dry-run");
}

// 5 — netsh kind: exit 0 = the one-way reset really applied (success); exit ≠ 0 = fail with an HONEST
// no-rollback message (one-way; nothing pretends to undo a winsock reset).
{
  const res = await executeTier0("reset-network-stack", { run: spoolRun({ adapters: 2 }) });
  assert.equal(res.outcome, "success");
  assert.ok(res.events.some((e) => e.event === "TIER0.EXEC"));
}
{
  const res = await executeTier0("reset-network-stack", { run: spoolRun({ adapters: 2, netshExit: 1 }) });
  assert.equal(res.outcome, "fail");
  assert.equal(res.rolledBack, false);
  assert.match(res.message, /manual intervention/i);
  const rb = res.events.find((e) => e.event === "TIER0.ROLLBACK");
  assert.ok(rb && /no rollback applicable/i.test(rb.text), "one-way step admits no rollback exists");
}

// 6 — spool kind: drained queue = success; already-empty = no-op-neutral (NEVER a fix); still-queued = fail.
{
  const res = await executeTier0("clear-print-queue", { run: spoolRun({ jobs: 3 }) });
  assert.equal(res.outcome, "success");
  assert.equal(res.before, 3); assert.equal(res.after, 0);
}
{
  const res = await executeTier0("clear-print-queue", { run: spoolRun({ jobs: 0 }) });
  assert.equal(res.outcome, "no-op-neutral");
  assert.match(res.message, /No change needed/i);
}
{
  const state = { jobs: 2, clearFails: true };
  const res = await executeTier0("clear-print-queue", { run: spoolRun(state) });
  assert.equal(res.outcome, "fail", "jobs still queued = fail, never success");
}

// 7 — catalog honesty: the new recipe validates as Tier-0 (confirm + dry-run defaults, no user-data
// deletion — print JOBS are transient spool state; documents are untouched and the copy says so).
{
  const r = recipes["clear-print-queue"];
  assert.ok(r, "clear-print-queue registered in the catalog");
  const v = validateTier0(r);
  assert.deepEqual(v.errors, []); assert.equal(v.ok, true);
  assert.equal(r.deletesUserData, false);
  assert.match(r.whatItDoes, /untouched/i, "whatItDoes states documents are untouched");
  assert.equal(validateTier0(recipes["reset-network-stack"]).ok, true, "existing recipe still valid");
}

console.log("s2-tier0-bindings-safety test passed (F5 bindings live · allowlist boundary held · R11 first · dry-run honest · no-op never a fix · one-way rollback honesty).");
