// STAGE 3 S2 — the escalation evidence packet. When a plan cannot honestly finish, the user gets
// "Couldn't fix this safely — escalated to IIS", and a HUMAN gets everything they need to take over.
// That handoff is the MSP retainer story: AI resolves what it can, IIS humans catch the rest.
//
// Hard rules baked in here:
//   · content-blind by construction — every string goes through sanitizeToSignature / redactPrivate
//   · 🔒 R11 is check #1: any off-limits reference and the packet is REFUSED, not redacted-and-sent
//   · the hash chain is verified and reported honestly (a tampered journal is disclosed, not hidden)
//   · NO transport. This module builds a packet; it never sends. External send stays Ahmad's one-click.
// Pure + node-safe.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { verifyChain } from "../shared/plan-journal.mjs";
import { sanitizeToSignature } from "../shared/safety.mjs";

export const PACKET_VERSION = "escalation-packet-v1";
export const DELIVERY = Object.freeze({ staged: true, sent: false, note: "staged for review — external send is a one-click, never automatic" });

const EVIDENCE_CAP = 200;
const safe = (v) => redactPrivate(String(v == null ? "" : v)).slice(0, EVIDENCE_CAP);

/**
 * Build the packet from a finished (failed/aborted) plan run.
 * @param {{planRun:object, journalEntries:Array, durability?:object, issue?:object|string, now?:Function}} args
 * @returns {object} packet, or { blocked:"R11", surfaced } when anything off-limits is referenced
 */
export function buildEscalationPacket({ planRun = {}, journalEntries = [], durability = null, issue = null, now = Date.now } = {}) {
  const ts = typeof now === "function" ? now() : Number(now) || 0;

  // 1 — 🔒 R11, check #1, across the whole input. Refuse; never "clean it up and send anyway".
  let blob = "";
  try { blob = JSON.stringify({ planRun, journalEntries, issue }); } catch { blob = String(planRun && planRun.planRunId); }
  if (isBlockedPath(blob)) return { blocked: "R11", surfaced: R11_SURFACE, version: PACKET_VERSION, ts };

  const entries = Array.isArray(journalEntries) ? journalEntries : [];
  const chain = verifyChain(entries);
  const sig = issue ? sanitizeToSignature(issue) : null;

  const steps = entries
    .filter((e) => e && typeof e.event === "string" && e.event.startsWith("PLAN.STEP."))
    .map((e) => ({
      seq: Number(e.seq) || 0,
      phase: String(e.event).replace("PLAN.STEP.", "").toLowerCase(),
      stepIndex: e.stepIndex == null ? null : Number(e.stepIndex),
      recipeId: safe(e.recipeId),
      detail: safe(e.detail),
      pass: e.extra && typeof e.extra.pass === "boolean" ? e.extra.pass : null
    }));

  const terminal = entries.length ? entries[entries.length - 1] : null;
  const probeEvidence = entries
    .filter((e) => e && e.extra && typeof e.extra.evidence === "string" && e.extra.evidence)
    .map((e) => ({ event: e.event, evidence: safe(e.extra.evidence) }));

  return {
    version: PACKET_VERSION,
    ts,
    planId: safe(planRun.planId || (entries[0] && entries[0].planId) || ""),
    planRunId: safe(planRun.planRunId || (entries[0] && entries[0].planRunId) || ""),
    outcome: String(planRun.outcome || (terminal && terminal.event) || "unknown"),
    // Content-blind symbolic identity of the issue — never the user's words.
    signature: sig ? { code: sig.code, family: sig.family, confidence: sig.confidence } : null,
    stepsAttempted: steps.length,
    steps,
    probeEvidence,
    rollback: {
      attempted: entries.some((e) => e.event === "PLAN.STEP.ROLLBACK"),
      recovered: entries.filter((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.recovered === true).length,
      manualNeeded: entries.filter((e) => e.event === "PLAN.STEP.ROLLBACK" && e.extra && e.extra.recovered === false).length
    },
    durability: durability
      ? { recurrences: Number(durability.recurrences) || 0, rung: String(durability.rung || ""), withinH: durability.withinH == null ? null : Number(durability.withinH) }
      : null,
    journal: { entries: entries.length, hashChainOk: chain.ok, tampered: chain.tampered, brokenAt: chain.brokenAt },
    // Honest human-facing line. No ticket ref is invented here: the bridge fills it in ONLY if it
    // actually files one (real-or-empty, exactly like the B5 surface).
    humanLine: "Couldn't fix this safely — escalated to IIS.",
    ticketRef: "",
    delivery: { ...DELIVERY }
  };
}

/** One-line summary for the under-globe surface. Never claims a ticket that does not exist. */
export function packetSummaryLine(packet) {
  if (!packet || packet.blocked) return "Couldn't fix this safely — escalated to IIS.";
  const ref = String(packet.ticketRef || "").trim();
  const steps = `${packet.stepsAttempted} step${packet.stepsAttempted === 1 ? "" : "s"} attempted`;
  return ref
    ? `Couldn't fix this safely — escalated to IIS · ${steps} · ticket ${ref}`
    : `Couldn't fix this safely — escalated to IIS · ${steps} · evidence packet staged`;
}
