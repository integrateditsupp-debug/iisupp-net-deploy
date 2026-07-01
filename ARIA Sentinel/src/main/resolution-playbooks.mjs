// STAGE 3 S1 — the 3 authored playbooks for top compound issues, built ONLY from recipes that have a
// live Tier-0 executor binding today (flush-dns → flush-dns-cache · restart-print-spooler ·
// restart-audio-service → restart-audio). Rule 14 honesty notes:
//   - network-recovery ships WITHOUT reset-network-stack: that catalog recipe has no executor binding
//     yet (netsh winsock reset is a bigger hammer) — it joins in S2 once its binding is vetted.
//   - print-recovery ships WITHOUT a clear-print-queue step for the same reason.
//   - S1 goalProbes are read-only Get-Service / Get-DnsClientCache checks that pass the existing
//     Tier-0 allowlist. Each description states exactly what the probe proves — no more. Deeper
//     end-to-end probes (DNS resolve test, test-page print) are S2 work because they need new
//     allowlisted capability, which is a safety-reviewed change.
// Steps carry expectedImpact matching the catalog commands' `-Name <svc>` side-effects so the
// supervisor's side-effect check passes honestly (declared = actual).
import { resolveExecutorId } from "./tier-0-executor.mjs";
import { validatePlan } from "../shared/resolution-plan.mjs";

export const PLAYBOOKS = Object.freeze({
  "network-recovery": Object.freeze({
    id: "network-recovery",
    title: "Network recovery — flush DNS cache",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "no-internet / dns-failure detector cluster" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "flush-dns", risk: "low", expectedImpact: Object.freeze([]), onFail: "escalate" })
    ]),
    goalProbe: Object.freeze({
      command: "(Get-Service Dnscache).Status",
      interpret: "service-running",
      description: "DNS Client service is running after the flush (S1 probe; an end-to-end resolve test arrives in S2)"
    }),
    riskEnvelope: Object.freeze({ level: "low", touchesSystemState: false }),
    rollbackPolicy: "reverse-order"
  }),
  "print-recovery": Object.freeze({
    id: "print-recovery",
    title: "Print recovery — restart the print spooler",
    trigger: Object.freeze({ kind: "detector-cluster", detail: "printer-issues detector cluster (stuck queue / spooler down)" }),
    steps: Object.freeze([
      Object.freeze({ recipeId: "restart-print-spooler", risk: "medium", expectedImpact: Object.freeze(["Spooler"]), onFail: "rollback-plan" })
    ]),
    goalProbe: Object.freeze({
      command: "(Get-Service Spooler).Status",
      interpret: "service-running",
      description: "Print Spooler service is running after the restart (S1 probe; a test-page probe arrives in S2)"
    }),
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
      command: "(Get-Service Audiosrv).Status",
      interpret: "service-running",
      description: "Windows Audio service is running after the restart (S1 probe; an output-device probe arrives in S2)"
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
