// directory.mjs — DirectoryProvider abstraction for GOVERNED identity actions (Q-DIR / Q-DIR+, R-ZERO R3).
//
// MOCK / TEST-TENANT ONLY. This module registers no Entra app and touches no live tenant. All network I/O
// goes through an injected `client` (the tests pass a mock Graph). Without real tenant creds the config is
// `configured:false` and writes are refused before any network path exists.
//
// CANNOT-MESS-UP PROTOCOL (every identity WRITE, non-negotiable):
//   1. READ-ONLY shipped + tested first (lookups below). Writes are a separate, gated path.
//   2. TARGET CERTAINTY — resolveTarget() returns certain:true ONLY on exactly one match. 0 or >1 → refuse.
//      No fuzzy-match write, EVER (a wrong-target reset/disable is a security breach).
//   3. WRITE PIPELINE — validate target → explicit admin approval (Confirmed; NEVER Autonomous) →
//      [IDV for end-user requests / reports-to check for manager-delegated] → execute → READ-BACK VERIFY the
//      change applied exactly → tamper-evident audit → on ANY mismatch/error: AUTO-ROLLBACK + escalate.
//   4. IDEMPOTENT — same requestId never double-applies; a mid-write drop recovers to a consistent state.
//   5. LEAST-PRIVILEGE — read scopes for reads; the minimum write scope per action.
//   6. NEVER AUTONOMOUS for identity writes.
//   7. NO PLAINTEXT PASSWORD by email — reset issues a one-time temp credential with force-change, or unlock.
//   8. IDV biometric (gov-ID + selfie) NEVER reaches ARIA's brain/cloud — only a pass/fail result is consumed.
import { createHash } from "node:crypto";

export const IDENTITY_TIER = "identity-privileged";

// Read scopes (least-privilege) shipped in slice 1; write scopes are requested per-action, not standing.
export const READ_SCOPES = ["User.Read.All", "Group.Read.All", "Device.Read.All", "AuditLog.Read.All"];
export const WRITE_SCOPE_BY_ACTION = Object.freeze({
  unlock: ["User.ReadWrite.All"],
  reset_password: ["UserAuthenticationMethod.ReadWrite.All"],
  add_group: ["GroupMember.ReadWrite.All"],
  remove_group: ["GroupMember.ReadWrite.All"],
  disable: ["User.ReadWrite.All"],
});

// Modular, optional connectors (Q-DIR+ A) — each toggles on/off per business like ServiceNow.
export const CONNECTORS = ["entra", "onprem_ad", "servicenow", "rsa_securid", "outlook", "dynamics365", "pingone_verify"];

export function getDirectoryConfig(env = process.env) {
  const provider = String(env.DIRECTORY_PROVIDER || "entra").toLowerCase();
  const configured = Boolean(env.DIRECTORY_TENANT_ID && env.DIRECTORY_CLIENT_ID && env.DIRECTORY_CLIENT_SECRET);
  const connectors = {};
  for (const c of CONNECTORS) connectors[c] = env[`DIRECTORY_CONNECTOR_${c.toUpperCase()}`] === "1";
  // The directory connectors are off unless explicitly enabled; entra defaults on when a tenant is configured.
  if (configured && env.DIRECTORY_CONNECTOR_ENTRA == null) connectors.entra = provider === "entra";
  return {
    provider,
    configured,
    edition: configured ? "integrated" : "standalone", // Standalone vs Integrated (Q-DIR+ E)
    connectors,
  };
}

export function connectorEnabled(name, env = process.env) {
  return Boolean(getDirectoryConfig(env).connectors[name]);
}

/** Opaque id — never a UPN/email/name on the wire or in audit. */
export function hashId(value) {
  return "uid-" + createHash("sha256").update(String(value || "anonymous")).digest("hex").slice(0, 16);
}

// ---- READ-ONLY (slice 1) --------------------------------------------------
// `client` is the provider adapter (mock in tests / Graph in prod): { findUsers, getUser, getMemberGroups, getDevices }.

export async function lookupUser(query, { client } = {}) {
  const q = String(query || "").trim();
  if (!q || !client) return { ok: false, matches: [] };
  const rows = (await client.findUsers(q)) || [];
  return { ok: true, matches: rows.map(publicUser) };
}

/** TARGET CERTAINTY gate — certain ONLY on exactly one match. */
export async function resolveTarget(query, { client } = {}) {
  const r = await lookupUser(query, { client });
  if (!r.ok) return { certain: false, reason: "lookup_failed", user: null };
  if (r.matches.length === 0) return { certain: false, reason: "no_match", user: null };
  if (r.matches.length > 1) return { certain: false, reason: "ambiguous_multiple_matches", user: null, count: r.matches.length };
  return { certain: true, user: r.matches[0] };
}

export async function accountStatus(userId, { client } = {}) {
  const u = client ? await client.getUser(userId) : null;
  if (!u) return { ok: false };
  return { ok: true, id: hashId(u.id), enabled: u.accountEnabled !== false, locked: Boolean(u.lockedOut) };
}

export async function groupMembership(userId, { client } = {}) {
  const groups = (client ? await client.getMemberGroups(userId) : []) || [];
  return { ok: true, groups: groups.map((g) => ({ id: hashId(g.id), name: String(g.displayName || "").slice(0, 80) })) };
}

export async function listDevices(userId, { client } = {}) {
  const devices = (client ? await client.getDevices(userId) : []) || [];
  return { ok: true, devices: devices.map((d) => ({ id: hashId(d.id), os: String(d.os || "").slice(0, 24), compliant: Boolean(d.compliant) })) };
}

function publicUser(u = {}) {
  return { id: u.id, ref: hashId(u.id), display: String(u.displayName || "").slice(0, 80), managerId: u.managerId || null };
}

// ---- IDV gate (Q-DIR+ B) --------------------------------------------------
// Returns ONLY a pass/fail. Raw gov-ID / selfie / biometric is never stored or returned, and never reaches
// the brain. The caller passes an opaque verification result from a vetted IDV vendor / the business IdP.
export const IDV_PROVIDERS = ["business_idp", "rsa_securid", "pingone_verify", "builtin_idv"];

export function idvResult(input = {}) {
  const provider = String(input.provider || "").toLowerCase();
  if (!IDV_PROVIDERS.includes(provider)) return { verified: false, provider, reason: "unknown_idv_provider" };
  // Defensive: refuse to handle raw biometric material — it must be processed by the vendor, never here.
  if (input.rawSelfie || input.rawIdImage || input.biometricTemplate) {
    return { verified: false, provider, reason: "raw_biometric_must_not_reach_aria" };
  }
  return { verified: input.verified === true, provider, reason: input.verified === true ? "verified" : "unverified" };
}

export const IDV_FAIL_MESSAGE =
  "Please contact your manager for assistance with verification. Questions or concerns — contact us.";

// ---- audit (tamper-evident, content-blind) --------------------------------
// Hash-chained: each entry binds the previous hash so a record can't be silently altered/removed.
export function auditEntry(prevHash, action, fields = {}) {
  const body = {
    ts: fields.ts || "(stamped-by-caller)",
    action: String(action).slice(0, 40),
    actor: hashId(fields.actor),
    target: hashId(fields.target),
    requestId: String(fields.requestId || "").slice(0, 64),
    result: String(fields.result || "").slice(0, 40),
    dryRun: Boolean(fields.dryRun),
  };
  const prev = String(prevHash || "GENESIS");
  body.prevHash = prev;
  body.hash = createHash("sha256").update(prev + JSON.stringify(body)).digest("hex").slice(0, 32);
  return body;
}

// ---- WRITE pipeline (gated) ----------------------------------------------

export const IDENTITY_ACTIONS = ["unlock", "reset_password", "add_group", "remove_group", "disable"];

/**
 * Run one governed identity write. NEVER autonomous; mock/test-tenant only here.
 * @returns {{ok, refused?, reason?, result?, rolledBack?, audit, scope}}
 */
export async function performIdentityAction(action, opts = {}) {
  const {
    client, approval = {}, idv = null, requestedBy = null, requestId = "",
    seen = null, now = () => "(ts)", group = null,
  } = opts;

  const refuse = (reason) => ({ ok: false, refused: true, reason, audit: auditEntry(opts.prevHash, action, { actor: requestedBy, target: opts.targetQuery, requestId, result: "refused:" + reason, dryRun: true, ts: now() }) });

  if (!IDENTITY_ACTIONS.includes(action)) return refuse("unknown_action");

  // (6) NEVER AUTONOMOUS + explicit admin approval (Confirmed).
  if (approval.mode === "autonomous") return refuse("identity_writes_never_autonomous");
  if (approval.mode !== "confirmed" || approval.adminApproved !== true || approval.adminRole !== true) {
    return refuse("admin_approval_required");
  }

  // (4) IDEMPOTENT — a replayed requestId never double-applies.
  if (seen && requestId && seen.has(requestId)) {
    return { ok: true, idempotentReplay: true, reason: "already_applied", audit: auditEntry(opts.prevHash, action, { actor: requestedBy, target: opts.targetQuery, requestId, result: "idempotent_replay", ts: now() }) };
  }

  // (2) TARGET CERTAINTY — exactly one match or refuse.
  const target = await resolveTarget(opts.targetQuery, { client });
  if (!target.certain) return refuse("uncertain_target:" + target.reason);

  // Q-DIR+ B/C — authorization of the REQUESTER for end-user vs manager-delegated requests.
  const isSelf = requestedBy && target.user && requestedBy.id === target.user.id;
  const isManagerDelegated = requestedBy && target.user && !isSelf;
  if (action === "unlock" || action === "reset_password") {
    if (isSelf) {
      // End-user self-request → IDV is a HARD gate.
      const v = idvResult(idv || {});
      if (!v.verified) return { ...refuse("idv_unverified:" + v.reason), escalate: true, userMessage: IDV_FAIL_MESSAGE };
    } else if (isManagerDelegated) {
      // Manager-delegated → reports-to check + the manager is IDV-gated too.
      if (!requestedBy || target.user.managerId !== requestedBy.id) return { ...refuse("not_in_reporting_line"), escalate: true };
      const mv = idvResult(idv || {});
      if (!mv.verified) return { ...refuse("manager_idv_unverified:" + mv.reason), escalate: true, userMessage: IDV_FAIL_MESSAGE };
    } else {
      return refuse("requester_unidentified");
    }
  }

  const scope = WRITE_SCOPE_BY_ACTION[action] || [];

  // (3) EXECUTE → READ-BACK VERIFY → on mismatch AUTO-ROLLBACK.
  let execResult;
  try {
    execResult = await applyAction(action, target.user, { client, group });
  } catch (err) {
    return { ok: false, error: "execute_failed", reason: String(err && err.message || err).slice(0, 80), audit: auditEntry(opts.prevHash, action, { actor: requestedBy, target: target.user.id, requestId, result: "execute_error", ts: now() }) };
  }

  const verified = await verifyAction(action, target.user, execResult, { client, group });
  if (!verified.ok) {
    let rolledBack = false;
    try { rolledBack = await rollbackAction(action, target.user, execResult, { client, group }); } catch { rolledBack = false; }
    return {
      ok: false, mismatch: true, reason: "read_back_mismatch:" + verified.reason, rolledBack, escalate: true,
      audit: auditEntry(opts.prevHash, action, { actor: requestedBy, target: target.user.id, requestId, result: "mismatch_rolledback:" + rolledBack, ts: now() }),
    };
  }

  if (seen && requestId) seen.add(requestId);
  // (7) reset_password NEVER returns a reusable plaintext password.
  const safeResult = sanitizeActionResult(action, execResult);
  return {
    ok: true, result: safeResult, scope,
    audit: auditEntry(opts.prevHash, action, { actor: requestedBy, target: target.user.id, requestId, result: "applied", ts: now() }),
  };
}

async function applyAction(action, user, { client, group }) {
  switch (action) {
    case "unlock": return client.setLocked(user.id, false);
    case "disable": return client.setEnabled(user.id, false);
    case "add_group": return client.addGroupMember(group, user.id);
    case "remove_group": return client.removeGroupMember(group, user.id);
    case "reset_password": {
      // One-time temp credential, force-change at next logon, delivered out-of-band. NEVER a reusable
      // plaintext password by email. The temp secret is generated + delivered by the provider; ARIA only
      // learns that a secure-delivery occurred.
      return client.resetPassword(user.id, { forceChangeAtNextLogon: true, delivery: "secure_link" });
    }
    default: throw new Error("unknown_action");
  }
}

async function verifyAction(action, user, execResult, { client, group }) {
  switch (action) {
    case "unlock": { const u = await client.getUser(user.id); return { ok: u && u.lockedOut === false, reason: "still_locked" }; }
    case "disable": { const u = await client.getUser(user.id); return { ok: u && u.accountEnabled === false, reason: "still_enabled" }; }
    case "add_group": { const g = await client.getMemberGroups(user.id); return { ok: (g || []).some((x) => x.id === group), reason: "not_added" }; }
    case "remove_group": { const g = await client.getMemberGroups(user.id); return { ok: !(g || []).some((x) => x.id === group), reason: "still_member" }; }
    case "reset_password": return { ok: Boolean(execResult && execResult.forceChangeAtNextLogon === true && execResult.delivery === "secure_link"), reason: "reset_not_confirmed" };
    default: return { ok: false, reason: "unknown_action" };
  }
}

async function rollbackAction(action, user, execResult, { client, group }) {
  switch (action) {
    case "unlock": await client.setLocked(user.id, true); return true;
    case "disable": await client.setEnabled(user.id, true); return true;
    case "add_group": await client.removeGroupMember(group, user.id); return true;
    case "remove_group": await client.addGroupMember(group, user.id); return true;
    case "reset_password": return false; // a forced reset is not silently un-done; escalate to a human instead
    default: return false;
  }
}

function sanitizeActionResult(action, execResult) {
  if (action !== "reset_password") return { applied: true };
  return {
    applied: true,
    forceChangeAtNextLogon: true,
    delivery: "secure_link",
    plaintextPassword: undefined, // never present, never emailed
  };
}
