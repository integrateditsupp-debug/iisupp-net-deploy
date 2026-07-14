// STAGE 3 S2 — ESCALATION EVIDENCE PACKET. "Couldn't fix this safely — escalated to IIS" is only
// worth anything if a HUMAN can act on it. This builds the packet that goes with that line:
// content-blind (sanitizeToSignature + contentSafeContext + R11 redaction), tamper-evident (the plan
// journal's hash-chain head + verification verdict), and honest about what was tried and why we stopped.
//
// This escalation path IS the MSP retainer story: "AI resolves what it can, IIS humans catch the rest."
// So the packet must be good enough for an L2 to start work — and must never leak a byte of content.
//
// Rule 14 / real-or-empty:
//   · ticketRef appears ONLY when a bridge actually filed one. No bridge → { staged: true } and the
//     packet waits for Ahmad's one-click. Nothing is auto-sent, ever ($0, no new upload path).
//   · The packet asserts content-safety on itself (assertContentSafePayload); if it can't prove it is
//     clean it refuses to exist — an unsafe packet is dropped, not "best-effort" sent.
//   · A tampered journal is REPORTED as tampered, never quietly smoothed over.
// 🔒 R11 is check #1 at the evidence layer. Pure + node-safe.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { sanitizeToSignature, contentSafeContext, assertContentSafePayload } from "../shared/safety.mjs";
import { verifyChain } from "../shared/plan-journal.mjs";

export const PACKET_VERSION = "escalation-packet-v1";
export const ESCALATION_REASONS = Object.freeze([
  "goal-probe-failed", "step-failed", "supervisor-veto", "recurrence-ladder-exhausted",
  "interrupted-unsafe", "kill-switch", "unknown"
]);

const EVENT_MAX = 40;   // journal tail carried in the packet
const TEXT_MAX = 200;

function reasonOf(value) {
  const r = String(value || "unknown");
  return ESCALATION_REASONS.includes(r) ? r : "unknown";
}

/** One journal entry → a content-blind step record an L2 can read. */
function stepRecord(e) {
  return {
    seq: Number(e.seq) || 0,
    ts: String(e.ts || ""),
    event: String(e.event || ""),
    stepIndex: e.stepIndex == null ? null : Number(e.stepIndex),
    recipeId: redactPrivate(String(e.recipeId || "")),
    detail: redactPrivate(String(e.detail || "")).slice(0, TEXT_MAX),
    outcome: e.extra && e.extra.outcome ? String(e.extra.outcome) : "",
    code: e.extra && e.extra.code ? String(e.extra.code) : ""
  };
}

/**
 * Build the escalation evidence packet.
 * @param {{plan:object, planRunId:string, journal:Array, reason:string, probeEvidence?:string,
 *          issue?:object, signature?:object, durability?:object, restorePoint?:object, now?:number}} args
 * @returns {{ok:boolean, blocked?:boolean, packet?:object, surfaced?:string, reason?:string}}
 */
export function buildEscalationPacket({ plan, planRunId, journal = [], reason, probeEvidence = "", issue, signature, durability, restorePoint, now = Date.now() } = {}) {
  // 1 — 🔒 R11: check #1 at the evidence layer, before anything is assembled.
  let blob = "";
  try { blob = JSON.stringify({ plan, planRunId, journal, probeEvidence, issue }); } catch { blob = String(planRunId); }
  if (isBlockedPath(blob)) return { ok: false, blocked: true, surfaced: R11_SURFACE, reason: "R11" };

  const sig = signature && signature.code ? signature : sanitizeToSignature(issue || { issue: (plan && plan.title) || "" });
  const chain = verifyChain(journal);
  const entries = (Array.isArray(journal) ? journal : []).slice(-EVENT_MAX).map(stepRecord);
  const attempted = entries
    .filter((e) => e.event === "PLAN.STEP.EXEC" && e.recipeId)
    .map((e) => e.recipeId);

  const packet = {
    v: PACKET_VERSION,
    createdAt: new Date(Number(now)).toISOString(),
    // WHAT broke — symbolic only.
    issue: {
      code: String(sig.code || "UNKNOWN.SIGNAL"),
      family: String(sig.family || "UNKNOWN"),
      confidence: Number(sig.confidence) || 0,
      context: contentSafeContext(issue || {})
    },
    // WHAT ARIA tried.
    plan: {
      id: redactPrivate(String((plan && plan.id) || "")),
      title: redactPrivate(String((plan && plan.title) || "")).slice(0, TEXT_MAX),
      planRunId: redactPrivate(String(planRunId || "")),
      steps: (plan && Array.isArray(plan.steps) ? plan.steps : []).map((s) => ({ recipeId: redactPrivate(String(s.recipeId || "")), risk: String(s.risk || ""), onFail: String(s.onFail || "") })),
      recipesAttempted: [...new Set(attempted)],
      rollbackPolicy: String((plan && plan.rollbackPolicy) || "")
    },
    // WHY it stopped — and the probe evidence that says so (already redacted + capped upstream).
    outcome: {
      reason: reasonOf(reason),
      goalProbe: {
        description: redactPrivate(String((plan && plan.goalProbe && plan.goalProbe.description) || "")).slice(0, TEXT_MAX),
        passed: false,
        evidence: redactPrivate(String(probeEvidence || "")).slice(0, TEXT_MAX)
      },
      restorePoint: {
        created: !!(restorePoint && restorePoint.created),
        // Honest: when there is no snapshot we SAY the rollback was journal-only.
        rollback: restorePoint && restorePoint.created ? "system-restore-point + reverse-order" : "journal-only (reverse-order)"
      }
    },
    // DURABILITY (F1) — an L2 must know this is the 2nd/3rd time, and which rung we are on.
    durability: durability
      ? {
        occurrences: Number(durability.occurrences) || 0,
        rung: String(durability.rung || ""),
        recurred: !!durability.recurred,
        note: redactPrivate(String(durability.reason || "")).slice(0, TEXT_MAX)
      }
      : { occurrences: 0, rung: "", recurred: false, note: "first sighting of this issue signature" },
    // PROOF the record wasn't edited.
    journal: {
      entries,
      chainIntact: chain.ok === true,
      tampered: chain.tampered === true,
      headHash: journal.length ? String(journal[journal.length - 1].hash || "") : "",
      entryCount: Array.isArray(journal) ? journal.length : 0
    }
  };

  // 2 — refuse to exist if content-safety can't be proven. The assertion runs over the packet's
  // CONTENT view — every field that could ever carry user text — and deliberately excludes the machine
  // identifiers we generate ourselves (planRunId, chain hashes, ISO timestamps): a 13-digit epoch and a
  // 64-char hex hash are structurally not user content, but they trip the payment-card/token heuristics.
  if (!assertContentSafePayload(contentViewOf(packet))) {
    return { ok: false, blocked: true, reason: "content-safety-assertion-failed" };
  }
  return { ok: true, packet };
}

/** Every field of the packet that could ever carry user-authored text (what content-safety must clear). */
export function contentViewOf(packet) {
  const p = packet || {};
  return {
    issue: p.issue || {},
    planTitle: (p.plan && p.plan.title) || "",
    planId: (p.plan && p.plan.id) || "",
    recipeIds: (p.plan && p.plan.recipesAttempted) || [],
    steps: ((p.plan && p.plan.steps) || []).map((s) => s.recipeId),
    goalProbe: (p.outcome && p.outcome.goalProbe) || {},
    durabilityNote: (p.durability && p.durability.note) || "",
    details: ((p.journal && p.journal.entries) || []).map((e) => `${e.event} ${e.recipeId} ${e.detail}`)
  };
}

/**
 * Route the packet. NOTHING is auto-sent: a configured bridge may file a ticket (and only then does a
 * ticketRef exist — real-or-empty); with no bridge the packet is STAGED for Ahmad's one-click.
 * @param {{packet:object, bridge?:{fileTicket:Function}|null}} args
 */
export async function deliverEscalation({ packet, bridge } = {}) {
  if (!packet) return { delivered: false, staged: false, ticketRef: "", line: "No evidence packet — nothing escalated." };
  if (!bridge || typeof bridge.fileTicket !== "function") {
    return {
      delivered: false, staged: true, ticketRef: "",
      line: "Couldn't fix this safely — the evidence packet is ready and staged for IIS (no ticket bridge is configured on this machine, so nothing was sent)."
    };
  }
  try {
    const res = await bridge.fileTicket(packet);
    const ref = redactPrivate(String((res && res.ticketRef) || "")).trim();
    if (!ref) {
      return { delivered: false, staged: true, ticketRef: "", line: "Couldn't fix this safely — the bridge returned no ticket reference, so the packet is staged rather than claimed as filed." };
    }
    return { delivered: true, staged: false, ticketRef: ref, line: `Couldn't fix this safely — escalated to IIS · ticket ${ref}` };
  } catch {
    return { delivered: false, staged: true, ticketRef: "", line: "Couldn't fix this safely — the ticket bridge failed, so the evidence packet is staged for IIS." };
  }
}
