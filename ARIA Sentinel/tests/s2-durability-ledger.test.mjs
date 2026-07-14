// STAGE 3 S2 — F1 DURABILITY LEDGER (the headline brain-audit gap: "resolve with QUALITY so the issue
// does not return"). Proves: content-blind signatures · same fix is NEVER repeated inside the 72h
// recurrence window (escalate ONE rung instead) · "durably resolved" is EARNED by a 24h quiet window,
// never claimed at fix time · deflection counts durable resolutions only and is real-or-empty.
// Pure — nothing spawns.
import assert from "node:assert/strict";
import {
  emptyDurabilityLedger, issueSignature, recordResolution, decideOnRecurrence, durabilityState,
  deflectionMetrics, nextRung, FIX_LADDER, RECURRENCE_WINDOW_MS, QUIET_WINDOW_MS
} from "../src/shared/durability-ledger.mjs";
import { executePlan } from "../src/main/plan-executor.mjs";
import { assertContentSafePayload } from "../src/shared/safety.mjs";

const T0 = 1_760_000_000_000;
const HOUR = 3600000;

// 1 — signatures are CONTENT-BLIND: raw user text (with PII) never survives into the ledger.
{
  const sig = issueSignature({ issue: "printer stuck, email me at bob@acme.com about C:\\Users\\bob\\secret.docx" });
  assert.ok(sig && sig.hash && sig.hash.length === 32);
  assert.equal(sig.code, "PRINT.SPOOLER.STUCK");
  assert.ok(assertContentSafePayload(sig), "signature carries no email/path/url content");
  // Same issue phrased differently → same signature (that is what makes recurrence detectable).
  assert.equal(issueSignature({ issue: "the print queue is stuck again" }).hash, sig.hash);
  // 🔒 R11 — an off-limits reference is never hashed at all.
  assert.equal(issueSignature({ issue: "C:\\Users\\x\\Private pics and Vids\\a.png won't open" }), null);
}

// 2 — first sighting → bottom rung, no recurrence.
{
  const sig = issueSignature({ issue: "no internet, dns lookup failed" });
  let led = emptyDurabilityLedger();
  assert.deepEqual(decideOnRecurrence(led, sig.hash, T0).recurred, false);
  led = recordResolution(led, { signature: sig, planId: "network-recovery", fixApplied: "network-recovery", resolved: true, evidence: "3", now: T0 });
  assert.equal(led.issues[sig.hash].rung, FIX_LADDER[0]);
  assert.equal(led.issues[sig.hash].resolved, true);
  // A fix NEVER writes "durably resolved" at fix time — that is the whole point.
  assert.equal(led.issues[sig.hash].durablyResolvedAt, 0);
  assert.equal(durabilityState(led, sig.hash, T0 + HOUR).state, "monitoring");

  // 3 — RECURRENCE inside 72h → same fix is refused, ladder climbs one rung.
  const d = decideOnRecurrence(led, sig.hash, T0 + 5 * HOUR);
  assert.equal(d.recurred, true);
  assert.equal(d.rung, "deeper-recipe");
  assert.equal(d.lastFixPlanId, "network-recovery");
  assert.match(d.reason, /will NOT be repeated/);

  // climbing: deeper-recipe → root-cause-investigation → human-escalation (terminal, never past it).
  assert.equal(nextRung("deeper-recipe"), "root-cause-investigation");
  assert.equal(nextRung("root-cause-investigation"), "human-escalation");
  assert.equal(nextRung("human-escalation"), "human-escalation");
  const d2 = decideOnRecurrence(recordResolution(led, { signature: sig, planId: "network-deep", resolved: true, now: T0 + 5 * HOUR }), sig.hash, T0 + 9 * HOUR);
  assert.equal(d2.rung, "root-cause-investigation");

  // 4 — outside the 72h window the fix HELD → back to the bottom rung, not an escalation.
  const late = decideOnRecurrence(led, sig.hash, T0 + RECURRENCE_WINDOW_MS + HOUR);
  assert.equal(late.recurred, false);
  assert.equal(late.rung, FIX_LADDER[0]);
  assert.equal(late.reason, "outside-recurrence-window");
}

// 5 — "durably resolved" is EARNED by silence: only after the 24h quiet window, and a return breaks it.
{
  const sig = issueSignature({ issue: "audio no sound from speaker" });
  let led = recordResolution(emptyDurabilityLedger(), { signature: sig, planId: "audio-recovery", resolved: true, now: T0 });
  assert.equal(durabilityState(led, sig.hash, T0 + QUIET_WINDOW_MS - HOUR).state, "monitoring");
  assert.equal(durabilityState(led, sig.hash, T0 + QUIET_WINDOW_MS).state, "durably-resolved");
  // it came back during the window → state flips to recurred, and no durable claim is ever made.
  led = recordResolution(led, { signature: sig, planId: "audio-recovery", resolved: false, now: T0 + 2 * HOUR });
  assert.equal(durabilityState(led, sig.hash, T0 + 3 * HOUR).state, "recurred");
  assert.equal(deflectionMetrics(led, T0 + 3 * HOUR).durableResolutions, 0);
}

// 6 — deflection metric: real-or-empty, durable-only. No data → null rate, NEVER a flattering 0/100%.
{
  const empty = deflectionMetrics(emptyDurabilityLedger(), T0);
  assert.equal(empty.hasData, false);
  assert.equal(empty.deflectionRate, null);
  assert.equal(empty.attempts, 0);
  assert.match(empty.line, /No resolution attempts recorded/);

  const a = issueSignature({ issue: "printer queue stuck" });
  const b = issueSignature({ issue: "dns lookup failed" });
  let led = recordResolution(emptyDurabilityLedger(), { signature: a, planId: "print-recovery", resolved: true, now: T0 });
  led = recordResolution(led, { signature: b, planId: "network-recovery", resolved: false, now: T0 });
  const m = deflectionMetrics(led, T0 + QUIET_WINDOW_MS + HOUR);
  assert.equal(m.hasData, true);
  assert.equal(m.attempts, 2);
  assert.equal(m.durableResolutions, 1);      // only the one that stayed gone through the quiet window
  assert.equal(m.deflectionRate, 0.5);
}

// 7 — EXECUTOR INTEGRATION: the same plan is REFUSED for a recurring issue and escalated one rung.
{
  const run = async (cmd) => {
    const c = String(cmd);
    if (/Get-Service Spooler/i.test(c)) return { stdout: "Running\r\n", stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const plan = {
    id: "print-recovery-test", title: "print recovery", trigger: { kind: "detector-cluster", detail: "printing" },
    steps: [{ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: ["Spooler"], onFail: "escalate" }],
    goalProbe: { command: "(Get-Service Spooler).Status", interpret: "service-running", description: "spooler running" },
    riskEnvelope: { level: "medium", touchesSystemState: false }, rollbackPolicy: "reverse-order"
  };
  const issue = { issue: "print spooler stuck again" };
  const sig = issueSignature(issue);
  const ledger = recordResolution(emptyDurabilityLedger(), { signature: sig, planId: "print-recovery-test", resolved: true, now: T0 });

  let confirmed = 0;
  const r = await executePlan(plan, {
    mode: "confirmed", run, now: () => T0 + 6 * HOUR,
    confirmPlan: async () => { confirmed += 1; return true; },
    countdownGate: async () => true,
    issue, durabilityLedger: ledger, wantEscalationPacket: true
  });
  assert.equal(r.outcome, "escalated", "a fix that did not hold is NOT repeated");
  assert.equal(confirmed, 0, "we never even ask the user to re-run the failed fix");
  const last = r.journal[r.journal.length - 1];
  assert.equal(last.event, "PLAN.ESCALATED");
  assert.equal(last.extra.code, "RECURRENCE_LADDER");
  assert.equal(last.extra.rung, "deeper-recipe");
  assert.equal(r.escalation.ok, true);
  assert.equal(r.escalation.staged, true, "no bridge configured → staged for Ahmad, never auto-sent");
  assert.equal(r.escalation.ticketRef, "", "real-or-empty: no ticket was filed, so no ticket ref is claimed");
  assert.equal(r.escalation.packet.durability.recurred, true);
}

console.log("s2-durability-ledger test passed (F1: content-blind signature · same fix never repeated in 72h · ladder climbs · durable = earned by 24h quiet · deflection real-or-empty · executor refuses the repeat).");
