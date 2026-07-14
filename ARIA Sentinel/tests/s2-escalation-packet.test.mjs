// STAGE 3 S2 — ESCALATION EVIDENCE PACKET ("Couldn't fix this safely — escalated to IIS").
// This escalation path IS the MSP retainer story, so the packet must be (a) good enough for a human L2
// to start work, (b) content-blind — not one byte of user content leaves the machine, (c) tamper-evident
// (it carries the journal's hash-chain verdict), and (d) NEVER auto-sent: with no ticket bridge it is
// STAGED for Ahmad's one-click, and a ticket reference is only ever claimed when a bridge really filed one.
// Pure — nothing spawns, nothing is sent.
import assert from "node:assert/strict";
import { buildEscalationPacket, deliverEscalation, contentViewOf, ESCALATION_REASONS } from "../src/main/escalation-packet.mjs";
import { assertContentSafePayload } from "../src/shared/safety.mjs";
import { appendEntry } from "../src/shared/plan-journal.mjs";
import { executePlan } from "../src/main/plan-executor.mjs";

const T0 = 1_760_000_000_000;
const plan = {
  id: "print-recovery", title: "Print recovery — clear the stuck queue, then restart the spooler",
  trigger: { kind: "detector-cluster", detail: "printer-issues" },
  steps: [
    { recipeId: "clear-print-queue", risk: "medium", expectedImpact: [], onFail: "retry-once" },
    { recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "rollback-plan" }
  ],
  goalProbe: { command: "(Get-Printer | Measure-Object).Count", interpret: "count-zero", description: "no stuck jobs remain" },
  riskEnvelope: { level: "medium", touchesSystemState: false }, rollbackPolicy: "reverse-order"
};

function journalOf(now = () => T0) {
  let j = [];
  const add = (f) => { j = appendEntry(j, { planId: plan.id, planRunId: "run-1", ...f }, now); };
  add({ event: "PLAN.PROPOSED", detail: plan.title });
  add({ event: "PLAN.APPROVED" });
  add({ event: "PLAN.STEP.EXEC", stepIndex: 0, recipeId: "clear-print-queue", detail: "exit=0" });
  add({ event: "PLAN.STEP.POST", stepIndex: 0, recipeId: "clear-print-queue", detail: "step outcome: success", extra: { outcome: "success", stepComplete: true } });
  add({ event: "PLAN.ESCALATED", detail: "goalProbe failed", extra: { code: "GOAL_PROBE_FAILED" } });
  return j;
}

// 1 — a real packet: symbolic issue, what was tried, why it stopped, tamper-evident chain head.
{
  const j = journalOf();
  const b = buildEscalationPacket({
    plan, planRunId: "run-1", journal: j, reason: "goal-probe-failed",
    probeEvidence: "2", issue: { issue: "printer queue stuck, nothing prints" }, now: T0
  });
  assert.equal(b.ok, true);
  const p = b.packet;
  assert.equal(p.issue.code, "PRINT.SPOOLER.STUCK");
  assert.equal(p.outcome.reason, "goal-probe-failed");
  assert.equal(p.outcome.goalProbe.passed, false, "a packet exists BECAUSE the goal was not met — it never claims success");
  assert.deepEqual(p.plan.recipesAttempted, ["clear-print-queue"]);
  assert.equal(p.journal.chainIntact, true);
  assert.equal(p.journal.tampered, false);
  assert.equal(p.journal.headHash, j[j.length - 1].hash);
  assert.equal(p.durability.occurrences, 0);
  assert.match(p.durability.note, /first sighting/);
  assert.equal(p.outcome.restorePoint.rollback, "journal-only (reverse-order)");
  // content-blind: the whole content view is clean.
  assert.ok(assertContentSafePayload(contentViewOf(p)));
  for (const r of ESCALATION_REASONS) assert.equal(typeof r, "string");
}

// 2 — user content NEVER survives: emails, URLs, paths, card numbers are gone from the packet.
{
  const dirty = { issue: "printing broken — mail bob@acme.com, see https://intranet.acme.com/tix and C:\\Users\\bob\\payroll.xlsx (card 4111 1111 1111 1111)" };
  const b = buildEscalationPacket({ plan, planRunId: "run-1", journal: journalOf(), reason: "goal-probe-failed", issue: dirty, now: T0 });
  assert.equal(b.ok, true);
  const text = JSON.stringify(contentViewOf(b.packet));
  assert.ok(!/bob@acme\.com/.test(text), "no email");
  assert.ok(!/intranet\.acme\.com/.test(text), "no URL");
  assert.ok(!/payroll\.xlsx/.test(text), "no file path");
  assert.ok(!/4111/.test(text), "no card number");
  assert.ok(assertContentSafePayload(contentViewOf(b.packet)));
}

// 3 — 🔒 R11 is check #1 at the evidence layer: a blocked reference produces NO packet at all.
{
  const b = buildEscalationPacket({
    plan: { ...plan, title: "fix C:\\Users\\x\\Private pics and Vids\\a.png" },
    planRunId: "run-1", journal: journalOf(), reason: "step-failed", now: T0
  });
  assert.equal(b.ok, false);
  assert.equal(b.blocked, true);
  assert.equal(b.surfaced, "1 personal folder excluded");
}

// 4 — a TAMPERED journal is reported as tampered, never smoothed over.
{
  const j = journalOf();
  const t = j.map((e) => ({ ...e }));
  t[2].detail = "exit=0 (edited)";
  const b = buildEscalationPacket({ plan, planRunId: "run-1", journal: t, reason: "step-failed", now: T0 });
  assert.equal(b.ok, true);
  assert.equal(b.packet.journal.chainIntact, false);
  assert.equal(b.packet.journal.tampered, true);
}

// 5 — DELIVERY. No bridge → staged for Ahmad's one-click; nothing sent, no ticket claimed.
{
  const p = buildEscalationPacket({ plan, planRunId: "run-1", journal: journalOf(), reason: "goal-probe-failed", now: T0 }).packet;
  const staged = await deliverEscalation({ packet: p, bridge: null });
  assert.equal(staged.delivered, false);
  assert.equal(staged.staged, true);
  assert.equal(staged.ticketRef, "");
  assert.match(staged.line, /nothing was sent/i);

  // a bridge that files a real ticket → and ONLY then is a ticket reference shown (real-or-empty).
  const ok = await deliverEscalation({ packet: p, bridge: { fileTicket: async () => ({ ticketRef: "IIS-1042" }) } });
  assert.equal(ok.delivered, true);
  assert.equal(ok.ticketRef, "IIS-1042");
  assert.match(ok.line, /ticket IIS-1042/);

  // a bridge that returns nothing must NEVER be reported as filed.
  const empty = await deliverEscalation({ packet: p, bridge: { fileTicket: async () => ({}) } });
  assert.equal(empty.delivered, false);
  assert.equal(empty.staged, true);
  assert.equal(empty.ticketRef, "");

  // a bridge that throws degrades to staged — the user still gets an honest line.
  const broken = await deliverEscalation({ packet: p, bridge: { fileTicket: async () => { throw new Error("down"); } } });
  assert.equal(broken.staged, true);
  assert.equal(broken.ticketRef, "");
}

// 6 — EXECUTOR INTEGRATION: a failed goalProbe escalates WITH the packet, staged (no auto-send).
{
  const run = async (cmd) => {
    const c = String(cmd);
    if (/Get-Service Spooler/i.test(c)) return { stdout: "Running", stderr: "", exitCode: 0 };
    if (/Get-Printer/i.test(c)) return { stdout: "3", stderr: "", exitCode: 0 };   // 3 stuck jobs remain → goal NOT met
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const p2 = { ...plan, id: "print-recovery-esc", steps: [{ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "escalate" }] };
  const sent = [];
  const r = await executePlan(p2, {
    mode: "confirmed", run, now: () => T0,
    confirmPlan: async () => true, countdownGate: async () => true,
    issue: { issue: "printer queue stuck" },
    escalationBridge: { fileTicket: async (pk) => { sent.push(pk); return {}; } }   // bridge files nothing
  });
  assert.equal(r.outcome, "escalated");
  assert.equal(r.escalation.ok, true);
  assert.equal(r.escalation.staged, true, "bridge returned no ref → staged, never claimed as filed");
  assert.equal(r.escalation.ticketRef, "");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].issue.code, "PRINT.SPOOLER.STUCK");
  assert.equal(sent[0].outcome.reason, "goal-probe-failed");
  assert.ok(sent[0].journal.entryCount > 0 && sent[0].journal.chainIntact);
}

console.log("s2-escalation-packet test passed (L2-actionable · content-blind · tamper-evident · staged for Ahmad, never auto-sent · ticket ref only when a bridge really filed one · R11 first).");
