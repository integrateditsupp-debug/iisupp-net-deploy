// MODULE 3 — supported-case orchestration. Locks the RULE-14 spine: outcome is 'resolved' ONLY on a
// verified remediation (+ confirmed incident resolve); a not-authorized remediation → 'escalated' (the
// email says escalated, never fixed); ticket numbers come only from real writes; needs-approval runs
// nothing; a missing ServiceNow instance is flagged (no fake ticket) while a verified on-device fix can
// still resolve.
import assert from "node:assert/strict";
import { runSupportCase } from "../src/shared/case-orchestrator.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// A monotonically increasing injected clock so SLA timestamps are real + ordered.
function clock() { let t = 1_000; return () => (t += 1000); }

// Fake ServiceNow that records calls and returns verified-looking results.
function fakeSN(overrides = {}) {
  const calls = [];
  const rec = (name) => (...a) => { calls.push({ name, args: a }); };
  const sn = {
    calls,
    createInteraction: overrides.createInteraction || (async (i) => { calls.push({ name: "createInteraction", args: [i] }); return { ok: true, number: "IMS1", sysId: "ia1" }; }),
    createIncidentFromInteraction: overrides.createIncidentFromInteraction || (async (i) => { calls.push({ name: "createIncident", args: [i] }); return { ok: true, number: "INC1", sysId: "in1" }; }),
    resolveIncident: overrides.resolveIncident || (async (id) => { calls.push({ name: "resolveIncident", args: [id] }); return { ok: true, resolvedConfirmed: true, record: { state: "6" } }; }),
    closeInteraction: overrides.closeInteraction || (async (id) => { calls.push({ name: "closeInteraction", args: [id] }); return { ok: true }; })
  };
  return sn;
}
function fakeEntra(result) {
  const calls = [];
  return { calls, remediateUser: async (i) => { calls.push(i); return result; } };
}
function sender() { const sent = []; const fn = async (r) => { sent.push(r); return { ok: true }; }; fn.sent = sent; return fn; }

const VERIFIED_REMEDIATION = { ok: true, verified: true, action: "revokeSignInSessions", label: "Revoke sign-in sessions …", rollbackNote: "Not reversible" };

// ── 1 · Full happy path → resolved, real tickets, email sent ──
{
  const sn = fakeSN(); const entra = fakeEntra(VERIFIED_REMEDIATION); const send = sender();
  const r = await runSupportCase(
    { issue: "Cannot sign in", symbolicCode: "SIGNIN.FAIL", approved: true, target: { userId: "11111111-1111-1111-1111-111111111111", action: "revokeSignInSessions" }, profile: { firstName: "Test", email: "u@example.com" } },
    { serviceNow: sn, entra, sendReport: send, now: clock() }
  );
  assert.equal(r.outcome, "resolved");
  assert.equal(r.ticket.incidentNumber, "INC1", "real incident number threaded through");
  assert.ok(sn.calls.some((c) => c.name === "resolveIncident"), "incident resolved");
  assert.ok(sn.calls.some((c) => c.name === "closeInteraction"), "interaction closed");
  assert.equal(send.sent.length, 1, "session-end email fired once");
  assert.equal(send.sent[0].case.resolved, true);
  ok("happy path: Interaction→Incident→remediate→resolve→close→email, outcome resolved");
}

// ── 2 · Remediation NOT authorized → escalated, incident NOT resolved, email says escalated ──
{
  const sn = fakeSN(); const entra = fakeEntra({ ok: false, notAuthorized: true, message: "Not authorized (HTTP 403)" }); const send = sender();
  const r = await runSupportCase(
    { issue: "Cannot sign in", approved: true, target: { userId: "11111111-1111-1111-1111-111111111111", action: "revokeSignInSessions" } },
    { serviceNow: sn, entra, sendReport: send, now: clock() }
  );
  assert.equal(r.outcome, "escalated", "no verified fix → escalated");
  assert.ok(!sn.calls.some((c) => c.name === "resolveIncident"), "incident is NOT resolved without a verified fix");
  assert.equal(send.sent[0].case.resolved, false, "email reports escalated, not fixed");
  const remStep = r.steps.find((s) => s.step === "remediation");
  assert.equal(remStep.status, "not-authorized");
  ok("not-authorized remediation → escalated (no fake resolve), email honest");
}

// ── 3 · Needs approval → nothing runs (no SN/Entra calls), no email of a fix ──
{
  const sn = fakeSN(); const entra = fakeEntra(VERIFIED_REMEDIATION); const send = sender();
  const r = await runSupportCase(
    { issue: "x", approved: false, target: { userId: "11111111-1111-1111-1111-111111111111" } },
    { serviceNow: sn, entra, sendReport: send, now: clock() }
  );
  assert.equal(r.outcome, "needs-approval");
  assert.equal(sn.calls.length, 0, "no ServiceNow writes without approval");
  assert.equal(entra.calls.length, 0, "no remediation without approval");
  ok("needs-approval: gate blocks every write/remediation");
}

// ── 4 · ServiceNow not configured but the on-device fix verifies → resolved, ticket flagged null ──
{
  const sn = fakeSN({ createInteraction: async () => ({ ok: false, notConfigured: true, message: "ServiceNow not configured" }) });
  const entra = fakeEntra(VERIFIED_REMEDIATION); const send = sender();
  const r = await runSupportCase(
    { issue: "x", approved: true, target: { userId: "test@contoso.com", action: "revokeSignInSessions" } },
    { serviceNow: sn, entra, sendReport: send, now: clock() }
  );
  assert.equal(r.outcome, "resolved", "verified fix resolves even without a ticket");
  assert.equal(r.ticket.incidentNumber, "", "no fake ticket number");
  assert.equal(r.report.case.ticket.incident, null, "summary shows null ticket, honestly");
  const iStep = r.steps.find((s) => s.step === "interaction");
  assert.equal(iStep.status, "not-configured", "ServiceNow gap is flagged");
  ok("ServiceNow missing → flagged (null ticket), verified fix still resolves");
}

// ── 5 · No remediation target → nothing 'unlocked', escalated ──
{
  const sn = fakeSN(); const entra = fakeEntra(VERIFIED_REMEDIATION); const send = sender();
  const r = await runSupportCase({ issue: "x", approved: true }, { serviceNow: sn, entra, sendReport: send, now: clock() });
  assert.equal(entra.calls.length, 0, "no remediation attempted without a target");
  assert.equal(r.outcome, "escalated");
  const remStep = r.steps.find((s) => s.step === "remediation");
  assert.equal(remStep.status, "skipped");
  ok("no target → no fake unlock, case escalated");
}

assert.equal(tests, 5, "case-orchestrator runs exactly 5 cases");
console.log(`Case-orchestrator test passed (${tests}/5 · resolved only on verified fix · escalated honesty · gated · real tickets · SN-gap flagged).`);
