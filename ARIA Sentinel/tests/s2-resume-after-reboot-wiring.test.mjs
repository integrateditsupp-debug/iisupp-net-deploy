// STAGE 3 S2 — RESUME-AFTER-REBOOT, WIRED. S1 shipped the pure decision; this proves the boot watchdog
// USES it: a plan interrupted at a SAFE step boundary is picked up at the next step (same hash-chain,
// consent re-asked — a reboot is not consent); a plan interrupted MID-step, or with a tampered chain, is
// ROLLED BACK in reverse order and escalated with an evidence packet — never resumed, never half-applied.
// Pure + injectable (listJournals/readJournal/run are all passed in) — nothing spawns, no fs.
import assert from "node:assert/strict";
import { scanInterruptedPlans, rollbackInterrupted, resumeContext, runBootRecovery, completedStepsOf } from "../src/main/plan-resume.mjs";
import { appendEntry, toJsonl, verifyChain } from "../src/shared/plan-journal.mjs";
import { executePlan } from "../src/main/plan-executor.mjs";

const T0 = 1_760_000_000_000;
let clock = T0;
const now = () => (clock += 1000);

const plan = {
  id: "print-recovery", title: "print recovery", trigger: { kind: "detector-cluster", detail: "print" },
  steps: [
    { recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv"], onFail: "escalate" },
    { recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "escalate" }
  ],
  goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler running" },
  riskEnvelope: { level: "medium", touchesSystemState: false }, rollbackPolicy: "reverse-order"
};

function build(events) {
  let j = [];
  for (const e of events) j = appendEntry(j, { planId: plan.id, planRunId: "run-boot", ...e }, now);
  return j;
}
const safeBoundary = () => build([
  { event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0, recipeId: "restart-audio" },
  { event: "PLAN.STEP.POST", stepIndex: 0, recipeId: "restart-audio", detail: "step outcome: success", extra: { outcome: "success", stepComplete: true } }
]);
const midStep = () => build([
  { event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.EXEC", stepIndex: 0, recipeId: "restart-audio" },
  { event: "PLAN.STEP.POST", stepIndex: 0, recipeId: "restart-audio", detail: "step outcome: success", extra: { outcome: "success", stepComplete: true } },
  { event: "PLAN.STEP.EXEC", stepIndex: 1, recipeId: "restart-print-spooler" }   // ← power cut HERE
]);

// 1 — scan classifies what it finds on disk (JSONL in, decisions out).
{
  const files = { "safe.jsonl": toJsonl(safeBoundary()), "mid.jsonl": toJsonl(midStep()), "done.jsonl": toJsonl(build([{ event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" }, { event: "PLAN.RESOLVED" }])) };
  const found = scanInterruptedPlans({ listJournals: () => Object.keys(files), readJournal: (id) => files[id] });
  assert.equal(found.length, 2, "terminal journals are settled — only the interrupted ones surface");
  const safe = found.find((f) => f.action === "resume");
  const mid = found.find((f) => f.action === "rollback-escalate");
  assert.equal(safe.nextStepIndex, 1);
  assert.equal(safe.reason, "safe-step-boundary");
  assert.equal(mid.reason, "interrupted-mid-step");
  assert.equal(mid.chainIntact, true);
}
// 1b — 🔒 R11: a journal whose id references the off-limits folder is never even read.
{
  let read = 0;
  const found = scanInterruptedPlans({ listJournals: () => ["C:\\Users\\x\\Private pics and Vids\\p.jsonl"], readJournal: () => { read += 1; return ""; } });
  assert.equal(found.length, 0);
  assert.equal(read, 0, "R11 is check #1 — the file is not opened at all");
}

// 2 — MID-STEP interruption → reverse-order rollback of the PROVEN-completed steps + escalation. Never resumed.
{
  const found = scanInterruptedPlans({ listJournals: () => ["mid"], readJournal: () => toJsonl(midStep()) })[0];
  assert.deepEqual(completedStepsOf(found.entries).map((c) => c.stepIndex), [0], "only steps with a proven POST boundary are rolled back");
  const calls = [];
  const run = async (cmd) => {
    calls.push(String(cmd));
    if (/Get-Service/i.test(String(cmd))) return { stdout: "Running", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const journaled = [];
  const res = await rollbackInterrupted(found, { plan, run, bridge: null, appendJournal: (e) => journaled.push(e), now: () => T0 });
  assert.equal(res.rolledBack.length, 1);
  assert.equal(res.rolledBack[0].recovered, true, "the audio service is brought back to Running");
  assert.ok(calls.some((c) => /^Start-Service Audiosrv/i.test(c)), "rollback starts the service it stopped");
  assert.ok(!calls.some((c) => /^Restart-Service/i.test(c)), "a remediation step is NEVER re-run at boot");
  assert.equal(journaled[0].event, "PLAN.STEP.ROLLBACK");
  assert.equal(journaled[journaled.length - 1].event, "PLAN.ESCALATED");
  assert.equal(journaled[journaled.length - 1].extra.code, "INTERRUPTED_UNSAFE");
  assert.equal(res.escalation.ok, true);
  assert.equal(res.escalation.staged, true, "no bridge → the evidence packet is staged, never auto-sent");
  assert.match(res.line, /not left half-changed/i);
}

// 3 — a TAMPERED journal is never trusted for resume → rollback + escalate.
{
  const t = midStep().map((e) => ({ ...e }));
  t[2].recipeId = "swapped";
  assert.equal(verifyChain(t).ok, false);
  const found = scanInterruptedPlans({ listJournals: () => ["t"], readJournal: () => toJsonl(t) })[0];
  assert.equal(found.action, "rollback-escalate");
  assert.equal(found.reason, "journal-tampered");
}

// 4 — SAFE boundary → resume context: same chain, skip the proven step, and consent is asked AGAIN.
{
  const found = scanInterruptedPlans({ listJournals: () => ["safe"], readJournal: () => toJsonl(safeBoundary()) })[0];
  const rc = resumeContext(found);
  assert.equal(rc.resumeFrom, 1);
  assert.equal(rc.priorEntries.length, 4);
  assert.match(rc.line, /nothing runs until you say go/i);

  let confirms = 0;
  const executed = [];
  const run = async (cmd) => {
    const c = String(cmd);
    executed.push(c);
    if (/Get-Service Spooler/i.test(c)) return { stdout: "Running", stderr: "", exitCode: 0 };
    if (/Get-Service Audiosrv/i.test(c)) return { stdout: "Running", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const r = await executePlan(plan, {
    mode: "confirmed", run, now: () => T0,
    confirmPlan: async () => { confirms += 1; return true; },
    countdownGate: async () => true,
    ...rc
  });
  assert.equal(confirms, 1, "a reboot is NOT consent — the user confirms the resumed plan");
  assert.equal(r.outcome, "resolved");
  assert.equal(r.planRunId, "run-boot", "same run id");
  // step 0 (audio) is NOT re-run; step 1 (spooler) is.
  assert.ok(!executed.some((c) => /Restart-Service Audiosrv/i.test(c)), "a completed step is never re-executed");
  assert.ok(executed.some((c) => /Restart-Service Spooler/i.test(c)), "the plan picks up at the next step");
  // one unbroken hash-chain across the reboot.
  assert.equal(verifyChain(r.journal).ok, true);
  assert.ok(r.journal.length > 4);
  assert.equal(r.journal[0].event, "PLAN.PROPOSED");
  assert.equal(r.journal.find((e) => e.event === "PLAN.APPROVED" && e.extra && e.extra.resumedFrom === 1) != null, true);
}

// 5 — boot entry point: classify everything, roll back the unsafe, hand back the resumable.
{
  const files = { "safe.jsonl": toJsonl(safeBoundary()), "mid.jsonl": toJsonl(midStep()) };
  const out = await runBootRecovery(
    { listJournals: () => Object.keys(files), readJournal: (id) => files[id] },
    { plan, run: async () => ({ stdout: "Running", stderr: "", exitCode: 0 }), bridge: null, now: () => T0 }
  );
  assert.equal(out.scanned, 2);
  assert.equal(out.resumable.length, 1);
  assert.equal(out.recovered.length, 1);
  assert.match(out.line, /rolled back/i);
}
// 5b — nothing interrupted → an honest "nothing to do" (real-or-empty; no invented recovery).
{
  const out = await runBootRecovery({ listJournals: () => [], readJournal: () => "" }, {});
  assert.equal(out.scanned, 0);
  assert.deepEqual(out.resumable, []);
  assert.match(out.line, /No interrupted fixes/i);
}

console.log("s2-resume-after-reboot-wiring test passed (safe boundary resumes on one chain · mid-step + tampered roll back and escalate · a completed step is never re-run · a reboot is not consent · R11 first).");
