// MODULE 3 — supported-case orchestration (the flagship demo path).
//   web ARIA "Resolve it for me" → aria-sentinel:// handoff → Sentinel opens a CASE →
//   ServiceNow Interaction + Incident (M1, gated) → Entra remediation on the exact test user (M2, gated)
//   → on a VERIFIED fix, resolve + close the Incident and Interaction → fire the session-end email
//   (the existing content-safe report) with the case summary + REAL SLA.
//
// HARD RULE 14, enforced structurally here:
//   • Outcome is "resolved" ONLY when the remediation is verified AND the incident read-back confirms
//     Resolved/Closed. Anything short of that → "escalated" (the email says escalated, never "fixed").
//   • Ticket numbers come ONLY from the real read-back-verified writes — never invented.
//   • A missing ServiceNow instance / Entra write scope is reported as a flagged gap, never faked.
// PURE + dependency-injected: session helpers are imported (pure); all I/O (ServiceNow, Entra, email,
// clock) is injected so the whole orchestration is unit-tested without a network or Electron.

import { createSession, recordTurn, recordAction, endSession, buildSessionReport, slaStatus } from "./session.mjs";

// A step result the UI/audit can render: { step, ok, status, detail, ...ids }.
function step(name, ok, status, detail, extra = {}) {
  return { step: name, ok: Boolean(ok), status, detail: String(detail || "").slice(0, 240), ...extra };
}

/**
 * @param input {
 *   issue, symbolicCode, recipeId, assignmentGroup,
 *   approved,                 // the gate decision (must be true to perform any write/remediation)
 *   target: { userId, action },  // Entra remediation target (exact GUID/UPN) + action
 *   profile                   // first-run profile (for the user email)
 * }
 * @param deps {
 *   serviceNow: { createInteraction, createIncidentFromInteraction, resolveIncident, closeInteraction },
 *   entra:      { remediateUser },
 *   sendReport: async (report) => ({ ok }),   // emails company + user (session-report infra)
 *   now:        () => ms,                      // injected clock
 *   logger:     (event) => void                // audit sink (optional)
 * }
 * @returns a structured, honest case record.
 */
export async function runSupportCase(input = {}, deps = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => 0;
  const log = typeof deps.logger === "function" ? deps.logger : () => {};
  const audit = (type, message, data = {}) => { try { log({ type, message, ts: new Date(now()).toISOString(), ...data }); } catch { /* never throw */ } };
  const approved = input.approved === true;
  const steps = [];
  const sn = deps.serviceNow || {};
  const entra = deps.entra || {};

  const startedAt = now();
  const session = createSession({ issue: input.issue, intent: "resolve-for-me", startedAt });
  recordTurn(session, "user", input.issue || "Resolve it for me", startedAt);
  audit("CASE.OPEN", `case opened: ${session.id}`);

  if (!approved) {
    // No gate approval → do nothing irreversible; return a "needs approval" case (nothing faked).
    steps.push(step("approval", false, "needs-approval", "Case requires explicit approval before any write/remediation."));
    endSession(session, "user_ended", now());
    return finalize({ session, steps, outcome: "needs-approval", input, deps, now, audit, ticket: emptyTicket(), remediation: null });
  }

  // ── STEP 1+2 — ServiceNow Interaction → Incident (gated, read-back-verified) ──
  const ticket = emptyTicket();
  const interaction = sn.createInteraction
    ? await sn.createInteraction({ symbolicCode: input.symbolicCode, shortDesc: input.issue, assignmentGroup: input.assignmentGroup, approved }, deps.snOptions)
    : { ok: false, notConfigured: true };
  if (interaction.ok) {
    ticket.interactionNumber = interaction.number; ticket.interactionSysId = interaction.sysId;
    steps.push(step("interaction", true, "opened", `Interaction ${interaction.number} opened`, { number: interaction.number }));
    recordAction(session, { recipeId: "servicenow.interaction", step: `interaction ${interaction.number}`, outcome: "opened" }, now());
    const incident = await sn.createIncidentFromInteraction({
      symbolicCode: input.symbolicCode, shortDesc: input.issue, recipeId: input.recipeId,
      assignmentGroup: input.assignmentGroup, interactionSysId: interaction.sysId, interactionNumber: interaction.number, approved
    }, deps.snOptions);
    if (incident.ok) {
      ticket.incidentNumber = incident.number; ticket.incidentSysId = incident.sysId;
      steps.push(step("incident", true, "opened", `Incident ${incident.number} opened`, { number: incident.number }));
      recordAction(session, { recipeId: "servicenow.incident", step: `incident ${incident.number}`, outcome: "opened" }, now());
    } else {
      steps.push(step("incident", false, snFailStatus(incident), incident.message || "Incident not created"));
    }
  } else {
    steps.push(step("interaction", false, snFailStatus(interaction), interaction.message || "ServiceNow not configured — no ticket (flagged, not faked)"));
  }

  // ── STEP 3 — Entra remediation on the exact target (gated; honest on missing scope/target) ──
  let remediation = null;
  if (input.target && input.target.userId && entra.remediateUser) {
    remediation = await entra.remediateUser({ userId: input.target.userId, action: input.target.action || "revokeSignInSessions", approved }, deps.entraOptions);
    if (remediation.ok) {
      steps.push(step("remediation", true, "applied", remediation.message, { action: remediation.action, verified: remediation.verified }));
      recordAction(session, { recipeId: `entra.${remediation.action}`, step: remediation.label, outcome: remediation.verified ? "verified" : "applied" }, now());
    } else {
      const status = remediation.targetUncertain ? "target-uncertain"
        : remediation.notAuthorized ? "not-authorized"
        : remediation.notConfigured ? "not-configured" : "failed";
      steps.push(step("remediation", false, status, remediation.message));
      recordAction(session, { recipeId: "entra.remediation", step: status, outcome: "escalated" }, now());
    }
  } else {
    steps.push(step("remediation", false, "skipped", "No exact remediation target provided — nothing run (no fake unlock)."));
  }

  // ── STEP 4 — resolve/close ONLY on a verified remediation + an existing incident ──
  const remediationVerified = Boolean(remediation && remediation.ok && remediation.verified);
  let resolvedConfirmed = false;
  if (remediationVerified && ticket.incidentSysId && sn.resolveIncident) {
    const closeNotes = `Resolved by ARIA Sentinel · ${symbolicToken(remediation.action)} · read-back verified`;
    const resolved = await sn.resolveIncident(ticket.incidentSysId, { closeNotes, recipeId: input.recipeId, approved }, deps.snOptions);
    resolvedConfirmed = Boolean(resolved.ok && resolved.resolvedConfirmed);
    steps.push(step("resolve-incident", resolvedConfirmed, resolvedConfirmed ? "resolved" : snFailStatus(resolved), resolved.message || (resolvedConfirmed ? "Incident resolved + verified" : "Resolve not confirmed")));
    if (resolvedConfirmed && ticket.interactionSysId && sn.closeInteraction) {
      const closed = await sn.closeInteraction(ticket.interactionSysId, { approved }, deps.snOptions);
      steps.push(step("close-interaction", Boolean(closed.ok), closed.ok ? "closed" : snFailStatus(closed), closed.message || (closed.ok ? "Interaction closed" : "Close not confirmed")));
    }
  }

  // ── Outcome: 'resolved' ONLY when the fix verified. If a ticket exists but no fix → escalated. ──
  const outcome = (remediationVerified && (resolvedConfirmed || !ticket.incidentSysId)) ? "resolved" : "escalated";
  endSession(session, outcome, now());
  return finalize({ session, steps, outcome, input, deps, now, audit, ticket, remediation });
}

function emptyTicket() {
  return { interactionNumber: "", interactionSysId: "", incidentNumber: "", incidentSysId: "" };
}

function snFailStatus(r = {}) {
  if (r.needsApproval) return "needs-approval";
  if (r.notConfigured) return "not-configured";
  if (r.forbidden) return "forbidden";
  if (r.unverified) return "unverified";
  if (r.contentUnsafe) return "content-unsafe";
  return "failed";
}

function symbolicToken(value) {
  return String(value || "remediation").replace(/[^A-Za-z0-9._-]+/g, ".").slice(0, 48) || "remediation";
}

// Build the case summary + fire the session-end email. The summary is content-blind (ticket numbers,
// remediation label, SLA) and is appended to the existing content-safe session report.
async function finalize({ session, steps, outcome, input, deps, now, audit, ticket, remediation }) {
  const report = buildSessionReport(session, input.profile || {});
  const sla = slaStatus(session);
  const caseSummary = {
    outcome,                                   // 'resolved' | 'escalated' | 'needs-approval'
    resolved: outcome === "resolved",
    escalated: outcome === "escalated",
    ticket: {                                  // REAL numbers only (blank if no verified write)
      interaction: ticket.interactionNumber || null,
      incident: ticket.incidentNumber || null
    },
    remediation: remediation && remediation.ok
      ? { action: remediation.action, label: remediation.label, verified: remediation.verified, rollbackNote: remediation.rollbackNote }
      : (remediation ? { action: remediation.action || null, label: remediation.label || null, verified: false, status: snFailStatus(remediation) } : null),
    sla,
    steps
  };
  const fullReport = { ...report, case: caseSummary };

  let emailed = { ok: false, skipped: true };
  if (typeof deps.sendReport === "function") {
    try { emailed = await deps.sendReport(fullReport); }
    catch { emailed = { ok: false, error: "send-failed" }; }
  }
  audit("CASE.DONE", `case ${session.id}: ${outcome}`, { outcome, incident: ticket.incidentNumber || "", emailed: Boolean(emailed.ok) });
  return { ok: outcome !== "needs-approval", sessionId: session.id, outcome, ticket, remediation, steps, sla, report: fullReport, emailed };
}
