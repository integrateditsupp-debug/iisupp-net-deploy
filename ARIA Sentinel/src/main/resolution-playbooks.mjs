// STAGE 3 S1→S2 — authored playbooks for top compound issues. S2 (packet slices 1+2) upgrades:
//   F5 — network-recovery and print-recovery are now TRUE multi-step plans: the two missing Tier-0
//        bindings (reset-network-stack, clear-print-queue) went live in tier-0-executor this slice.
//   F2 — goalProbes are OUTCOME-level: a real DNS lookup (Resolve-DnsName) for the network plan and a
//        drained, error-free queue for the print plan — success means the USER'S problem is gone, not
//        that a service shows "Running". Service-state checks remain step-level concerns only.
//   Quality — stopEarlyOnGoal: multi-step plans stop at the smallest effective hammer (if the DNS flush
//        alone fixes resolution, the winsock reset is skipped — and journaled as skipped).
// Rule 14 honesty notes:
//   - print goalProbe verifies the queue is drained and error-free through live spooler cmdlets. It
//     does NOT prove a page physically printed — a true test-page probe is future S2 work (packet's
//     pre-approved honest cut) and the description says exactly that.
//   - reset-network-stack is one-way and catalog-flagged requiresReboot: full effect can need a reboot.
//     If the outcome probe still fails post-reset, the plan escalates honestly (reboot-resume = slice 5).
//   - audio goalProbe upgraded to device-level: at least one sound device reports OK (Get-CimInstance,
//     already allowlisted) — closer to outcome than service state; a playback probe is future work.
// Steps carry expectedImpact matching the catalog commands' `-Name <svc>` side-effects so the
// supervisor's side-effect check passes honestly (declared = actual; netsh/print-job commands name none).
import { resolveExecutorId } from "./tier-0-executor.mjs";
import { validatePlan } from "../shared/resolution-plan.mjs";

export const PLAYBOOKS = Object.freeze({
  "network-recovery": Object.freeze({
    id: "network-recovery",
    title: "Network recovery — flush DNS, then reset the network stack",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "no-internet / dns-failure detector cluster" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "flush-dns", risk: "low", expectedImpact: Object.freeze([]), onFail: "retry-once" }),
      Object.freeze({
        recipeId: "reset-network-stack", risk: "medium", expectedImpact: Object.freeze([]), onFail: "escalate",
        successProbe: Object.freeze({
          command: "Test-NetConnection -ComputerName microsoft.com -Port 443 -InformationLevel Quiet",
          interpret: "boolean-true",
          description: "TCP 443 to a known public host connects after the stack reset (reachability check; a reboot can be needed for the reset's full effect)"
        })
      })
    ]),
    goalProbe: Object.freeze({
      command: "(Resolve-DnsName -Name microsoft.com -DnsOnly -ErrorAction Stop | Measure-Object).Count",
      interpret: "count-positive",
      description: "a real DNS lookup for a known public host returns records — the user's 'no internet / DNS failure' problem is actually gone (outcome probe, not service state)"
    }),
    riskEnvelope: Object.freeze({ level: "medium", touchesSystemState: true }),
    rollbackPolicy: "reverse-order",
    stopEarlyOnGoal: true
  }),
  "print-recovery": Object.freeze({
    id: "print-recovery",
    title: "Print recovery — clear the stuck queue, then restart the spooler",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "printer-issues detector cluster (stuck queue / spooler down)" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "clear-print-queue", risk: "medium", expectedImpact: Object.freeze([]), onFail: "retry-once" }),
      Object.freeze({ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: Object.freeze(["Spooler"]), onFail: "rollback-plan" })
    ]),
    goalProbe: Object.freeze({
      command: "(Get-Printer | ForEach-Object { Get-PrintJob -PrinterName $_.Name } | Where-Object { $_.JobStatus -match 'Error|Blocked|Paused' } | Measure-Object).Count",
      interpret: "count-zero",
      description: "no stuck, blocked or errored jobs remain in any print queue (read through live spooler cmdlets) — queue-health outcome; honest cut: this does NOT prove a page physically printed, a test-page probe is future work"
    }),
    riskEnvelope: Object.freeze({ level: "medium", touchesSystemState: false }),
    rollbackPolicy: "reverse-order",
    stopEarlyOnGoal: true
  }),
  "audio-recovery": Object.freeze({
    id: "audio-recovery",
    title: "Audio recovery — restart Windows audio",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "audio-issues detector cluster (no sound / wrong output)" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "restart-audio-service", risk: "medium", expectedImpact: Object.freeze(["AudioSrv", "AudioEndpointBuilder"]), onFail: "rollback-plan" })
    ]),
    goalProbe: Object.freeze({
      command: "(Get-CimInstance Win32_SoundDevice | Where-Object { $_.Status -eq 'OK' } | Measure-Object).Count",
      interpret: "count-positive",
      description: "at least one sound device reports status OK after the restart — device-level outcome (not just service state); a playback probe is future work"
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
