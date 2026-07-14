// STAGE 3 S3 — INVARIANT LOCK + END-TO-END FEED WIRING.
// The safety stack is the product. This battery is the tripwire that fires if S3 ever quietly loosened it:
//   • supervisor-agent / action-countdown / tier-0-executor are REUSED, not modified — they must not
//     import a single S3 module, and their public API must still be there;
//   • every new S3 module checks 🔒 R11 (imports path-guard) — R11 is check #1 at every new layer;
//   • the honest chain runs end to end: plan → goalProbe → durability ledger → deflection feed → B1 tile,
//     and the tile stays EMPTY until a resolution has actually earned its 24h of quiet.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executePlan } from "../src/main/plan-executor.mjs";
import { emptyDurabilityLedger, QUIET_WINDOW_MS } from "../src/shared/durability-ledger.mjs";
import { buildDeflectionFeed, deflectionKpi } from "../src/shared/deflection-feed.mjs";
import { superviseProposal } from "../src/main/supervisor-agent.mjs";
import { createCountdown, COUNTDOWN_SECONDS } from "../src/main/action-countdown.mjs";
import { executeTier0, TIER0_COMMANDS } from "../src/main/tier-0-executor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = (rel) => fs.readFileSync(path.join(HERE, "..", "src", rel), "utf8");

// 1 — the control plane is UNCHANGED: it does not know S3 exists (no back-edges, no new coupling).
const S3_MODULES = ["maintenance-window", "deflection-feed", "multi-hypothesis", "root-cause-correlation", "escalation-policy", "plan-executor", "plan-autonomy-ladder"];
for (const f of ["main/supervisor-agent.mjs", "main/action-countdown.mjs", "main/tier-0-executor.mjs"]) {
  const text = src(f);
  for (const m of S3_MODULES) {
    assert.ok(!text.includes(`${m}.mjs`), `${f} must not import ${m}.mjs — the control plane is reused UNCHANGED`);
  }
}
// …and it still works: the API S3 leans on is all still there.
assert.equal(typeof superviseProposal, "function");
assert.equal(typeof createCountdown, "function");
assert.ok(COUNTDOWN_SECONDS >= 1);
assert.equal(typeof executeTier0, "function");
assert.ok(TIER0_COMMANDS["restart-audio"], "the Tier-0 allowlist is intact");

// 2 — 🔒 R11 is check #1 at every new S3 layer: each module imports the path-guard.
for (const f of ["main/maintenance-window.mjs", "shared/deflection-feed.mjs", "shared/multi-hypothesis.mjs", "shared/root-cause-correlation.mjs", "shared/escalation-policy.mjs"]) {
  assert.ok(/from ".*path-guard\.mjs"/.test(src(f)), `${f} must check R11`);
}

// 3 — END TO END: a real (injected) plan run feeds the number the whole proof chain hangs on.
const NOW = 1_770_000_000_000;
const plan = {
  id: "print-recovery",
  title: "Print recovery",
  trigger: { kind: "detector-cluster", detail: "printer" },
  steps: [{ recipeId: "clear-print-queue", risk: "low", expectedImpact: ["print queue"], onFail: "retry-once" }],
  goalProbe: { command: "(Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name } | Measure-Object).Count", interpret: "count-zero", description: "no stuck print jobs left" },
  riskEnvelope: { level: "low", touchesSystemState: false },
  rollbackPolicy: "reverse-order"
};
const r = await executePlan(plan, {
  mode: "confirmed",
  confirmPlan: async () => true,
  countdownGate: async () => true,
  supervise: () => ({ verdict: "approve", code: "OK", reason: "ok" }),
  executeStep: async () => ({ outcome: "success", recipeId: "clear-print-queue" }),
  run: async () => ({ stdout: "0", stderr: "", exitCode: 0 }),   // the OUTCOME probe: zero stuck jobs
  issue: { symptomId: "printer-issues", subsystem: "spooler" },
  durabilityLedger: emptyDurabilityLedger(),
  now: () => NOW
});
assert.equal(r.outcome, "resolved");
assert.ok(r.durabilityLedger, "a resolution is recorded against the issue signature");

// The tile is EMPTY the moment after the fix — "resolved" is not yet "durably resolved".
const fresh = buildDeflectionFeed({ ledger: r.durabilityLedger, journalEntries: r.journal, now: NOW + 1000 });
assert.equal(fresh.durableResolutions, 0);
assert.equal(deflectionKpi(fresh).value, null, "we do not bank a deflection the instant we claim a fix");
assert.equal(fresh.journal.attempts, 1);
assert.equal(fresh.journal.resolved, 1);

// After 24h of quiet, and only then, the number is EARNED.
const durable = buildDeflectionFeed({ ledger: r.durabilityLedger, journalEntries: r.journal, now: NOW + QUIET_WINDOW_MS + 1 });
assert.equal(durable.durableResolutions, 1);
assert.equal(deflectionKpi(durable).value, "100%");
assert.ok(!/Private pics and Vids/i.test(JSON.stringify(durable)));

console.log("s3-invariants-and-feed-wiring test passed (control plane unchanged + uncoupled · R11 at every new layer · plan → ledger → feed → B1 tile, earned not claimed).");
