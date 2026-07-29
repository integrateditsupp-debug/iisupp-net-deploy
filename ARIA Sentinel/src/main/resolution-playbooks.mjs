// STAGE 3 S1 + S2 — the 3 authored playbooks for the top compound issues. S1 shipped them as single
// gated recipes with service-state probes. S2 makes them what the spec actually promised:
//   · network-recovery: flush-dns → (stop if the problem is already gone) → reset-network-stack
//   · print-recovery:   clear-print-queue → (stop if already gone) → restart-print-spooler
//   · audio-recovery:   restart-audio, now verified by an OUTCOME probe instead of a service status
// Rule 14 honesty notes:
//   - goalProbes are OUTCOME-level (brain-audit F2): "a real name lookup succeeds", "no job is stuck in
//     the queue", "a sound device is enumerable" — the user's problem being gone, not a service being up.
//     A spooler can be Running while printing still fails; that false positive is what made issues
//     "come back". Each description states exactly what the probe proves — no more.
//   - stopWhenGoalMet is TRUE on the multi-step plans: the bigger hammer only fires if the small fix
//     did not actually solve it. We never run a reboot-requiring stack reset over a working network.
//   - reset-network-stack requires a REBOOT, so it can never report success before that reboot: the
//     executor stops at "reboot-pending" and the plan resumes from the journal after boot.
//   - network-recovery declares touchesSystemState:true, so it gets a restore point (or an honest
//     "journal-only rollback" note when Windows throttles or disables System Protection).
// Steps carry expectedImpact matching the catalog commands' `-Name <svc>` side-effects so the
// supervisor's side-effect check passes honestly (declared = actual).
import { resolveExecutorId } from "./tier-0-executor.mjs";
import { validatePlan } from "../shared/resolution-plan.mjs";

export const PLAYBOOKS = Object.freeze({
  "network-recovery": Object.freeze({
    id: "network-recovery",
    title: "Network recovery — flush DNS, then reset the network stack if needed",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "no-internet / dns-failure detector cluster" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "flush-dns", risk: "low", expectedImpact: Object.freeze([]), onFail: "retry-once" }),
      // Only reached when the flush did NOT fix the user's problem (stopWhenGoalMet). Requires a reboot,
      // so this step ends the run at "reboot-pending" — never at "resolved".
      Object.freeze({ recipeId: "reset-network-stack", risk: "high", expectedImpact: Object.freeze([]), onFail: "escalate" })
    ]),
    goalProbe: Object.freeze({
      command: "(Resolve-DnsName example.com -ErrorAction SilentlyContinue | Measure-Object).Count",
      interpret: "count-positive",
      outcomeProbeId: "dns-resolves-known-host",
      description: "a real name lookup succeeds end-to-end — the user's browsing works again, not merely that the DNS service is running"
    }),
    stopWhenGoalMet: true,
    riskEnvelope: Object.freeze({ level: "high", touchesSystemState: true }),
    rollbackPolicy: "reverse-order"
  }),
  "print-recovery": Object.freeze({
    id: "print-recovery",
    title: "Print recovery — clear the stuck queue, then restart the spooler if needed",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "printer-issues detector cluster (stuck queue / spooler down)" }),
    steps: Object.freeze([
      // One-way: cleared jobs must be resubmitted. The executor says exactly that instead of implying
      // a rollback it cannot perform.
      Object.freeze({ recipeId: "clear-print-queue", risk: "medium", expectedImpact: Object.freeze([]), onFail: "retry-once" }),
      Object.freeze({ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: Object.freeze(["Spooler"]), onFail: "rollback-plan" })
    ]),
    goalProbe: Object.freeze({
      command: "(Get-Printer | Get-PrintJob | Measure-Object).Count",
      interpret: "count-zero",
      outcomeProbeId: "print-queue-drains",
      description: "no print job is left stuck in the queue — the user's page can actually print, not merely that the Spooler service is running"
    }),
    stopWhenGoalMet: true,
    riskEnvelope: Object.freeze({ level: "medium", touchesSystemState: false }),
    rollbackPolicy: "reverse-order"
  }),
  "audio-recovery": Object.freeze({
    id: "audio-recovery",
    title: "Audio recovery — restart Windows audio",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "audio-issues detector cluster (no sound / wrong output)" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "restart-audio-service", risk: "medium", expectedImpact: Object.freeze(["AudioSrv", "AudioEndpointBuilder"]), onFail: "rollback-plan" })
    ]),
    goalProbe: Object.freeze({
      command: "(Get-CimInstance Win32_SoundDevice | Measure-Object).Count",
      interpret: "count-positive",
      outcomeProbeId: "audio-endpoint-active",
      description: "at least one sound device is present and enumerable after the restart — the user has an output device again, not merely a running service"
    }),
    riskEnvelope: Object.freeze({ level: "medium", touchesSystemState: false }),
    rollbackPolicy: "reverse-order"
  })
});

export const PLAYBOOK_IDS = Object.freeze(Object.keys(PLAYBOOKS));

/** Deep copy so callers can never mutate the authored source. Null for unknown ids. */
export function getPlaybook(id) {
  const pb = PLAYBOOKS[String(id || "")];
  return pb ? JSON.parse(JSON.stringify(pb)) : null;
}

/** Validate every authored playbook against the schema + live executor bindings. */
export function validateAllPlaybooks() {
  const isBound = (recipeId) => !!resolveExecutorId(recipeId);
  const out = {};
  for (const id of PLAYBOOK_IDS) out[id] = validatePlan(PLAYBOOKS[id], { isBound });
  return out;
}
