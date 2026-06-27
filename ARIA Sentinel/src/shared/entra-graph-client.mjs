// entra-graph-client — thin, read-only Microsoft Graph scaffold for Azure AD / Entra ID.
// Slice 1: credential DETECTION only (no token, no network). Slice 2 wires a client-credentials
// token + a single read-only GET /users?$top=1 to verify connectivity. NO write scopes are ever
// requested; app registration + admin consent is Ahmad's tenant-admin action. No paid SDK —
// node fetch only. 🔒 R11 — no filesystem, no PII.

/** True only when all three directory credentials are present. */
export function hasEntraCredentials(env = process.env) {
  const e = env || {};
  return Boolean(
    String(e.DIRECTORY_TENANT_ID || "").trim() &&
    String(e.DIRECTORY_CLIENT_ID || "").trim() &&
    String(e.DIRECTORY_CLIENT_SECRET || "").trim()
  );
}

/** Non-secret config snapshot (never returns the client secret). */
export function getDirectoryConfig(env = process.env) {
  const e = env || {};
  return {
    configured: hasEntraCredentials(e),
    tenantId: String(e.DIRECTORY_TENANT_ID || "").trim(),
    clientId: String(e.DIRECTORY_CLIENT_ID || "").trim()
  };
}

const LOGIN_HOST = "https://login.microsoftonline.com";
const GRAPH_HOST = "https://graph.microsoft.com/v1.0";

/**
 * Acquire a client-credentials token for the .default app scope. The app's GRANTED permissions are
 * Ahmad's tenant-admin decision (registration + consent); this client only ever issues GET requests,
 * so the lane is read-only by HTTP method regardless of what was consented. Never throws.
 * `options.fetch` is injectable for tests. Returns { ok, token } or { ok:false, message }.
 */
export async function acquireToken(env = process.env, options = {}) {
  const cfg = getDirectoryConfig(env);
  if (!cfg.configured) return { ok: false, message: "Not configured" };
  const fetchImpl = options.fetch || globalThis.fetch;
  const secret = String((env || {}).DIRECTORY_CLIENT_SECRET || "");
  try {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: secret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default"
    });
    const res = await fetchImpl(`${LOGIN_HOST}/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    if (!res.ok) return { ok: false, message: `Token request failed (HTTP ${res.status})` };
    const json = await res.json().catch(() => ({}));
    const token = json && json.access_token;
    if (!token) return { ok: false, message: "Token response missing access_token" };
    return { ok: true, token };
  } catch {
    return { ok: false, message: "Could not reach Microsoft sign-in" };
  }
}

/**
 * Read-only connectivity probe: one GET that lists at most a single user id. NO write verb is ever
 * issued. Returns { ok, message } and never throws. Without creds → { ok:false, "Not configured" }.
 */
export async function readOnlyProbe(env = process.env, options = {}) {
  if (!hasEntraCredentials(env)) return { ok: false, message: "Not configured" };
  const fetchImpl = options.fetch || globalThis.fetch;
  const auth = await acquireToken(env, options);
  if (!auth.ok) return { ok: false, message: auth.message };
  try {
    const res = await fetchImpl(`${GRAPH_HOST}/users?$top=1&$select=id`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" }
    });
    if (res.ok) return { ok: true, message: "Directory reachable — read-only token verified" };
    if (res.status === 401 || res.status === 403) return { ok: false, message: `Read scope not granted (HTTP ${res.status})` };
    return { ok: false, message: `Directory read failed (HTTP ${res.status})` };
  } catch {
    return { ok: false, message: "Could not reach Microsoft Graph" };
  }
}

// ===========================================================================
// MODULE 2 — gated Entra (cloud) remediation. HONEST FRAMING: a cloud Entra account is not "locked"
// the way an on-prem AD account is, so there is no fake "unlocked". The cloud-equivalent remediations are:
//   • revokeSignInSessions — POST /users/{id}/revokeSignInSessions → invalidates refresh tokens, forcing
//     re-authentication on every device. (Not reversible; the user simply signs in again.)
//   • forcePasswordChange  — PATCH /users/{id} passwordProfile.forceChangePasswordNextSignIn=true → the
//     user must set a new password at next sign-in. (Reversible by clearing the flag.)
// Each remediation is: GATED (approved===true or refuse) · TARGET-CERTAIN (exact GUID/UPN or STOP) ·
// EXECUTED only via the consented write scope (a 401/403 → "Not authorized", never a fake success) ·
// READ-BACK VERIFIED (GET the user) · AUDITED · carries a truthful rollback note. NEVER autonomous.
// ===========================================================================

export const ENTRA_REMEDIATIONS = ["revokeSignInSessions", "forcePasswordChange"];

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPN_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Target certainty: a remediation may ONLY run against an exact user — a GUID object id or a UPN. */
export function isExactTarget(userId) {
  const id = String(userId || "").trim();
  return GUID_RE.test(id) || UPN_RE.test(id);
}

/** Honest, human-readable label for a remediation action (never implies a fake "unlock"). */
export function remediationLabel(action) {
  if (action === "revokeSignInSessions") {
    return "Revoke sign-in sessions (forces re-authentication on all devices) — the cloud-Entra equivalent of an AD unlock; the account was never 'locked'.";
  }
  if (action === "forcePasswordChange") {
    return "Force password change at next sign-in (sets forceChangePasswordNextSignIn).";
  }
  return "Unknown remediation.";
}

function rollbackNote(action) {
  if (action === "revokeSignInSessions") return "Not reversible — the user simply re-authenticates. No data changed.";
  if (action === "forcePasswordChange") return "Reversible — clear passwordProfile.forceChangePasswordNextSignIn to undo.";
  return "";
}

/** READ-BACK GET — confirm the target user is reachable and return its real, non-secret state. */
export async function getUser(userId, env = process.env, options = {}) {
  if (!hasEntraCredentials(env)) return { ok: false, message: "Not configured" };
  if (!isExactTarget(userId)) return { ok: false, message: "Target not certain" };
  const fetchImpl = options.fetch || globalThis.fetch;
  const auth = options.token ? { ok: true, token: options.token } : await acquireToken(env, options);
  if (!auth.ok) return { ok: false, message: auth.message };
  try {
    const res = await fetchImpl(`${GRAPH_HOST}/users/${encodeURIComponent(userId)}?$select=id,userPrincipalName,accountEnabled,signInSessionsValidFromDateTime`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" }
    });
    if (res.status === 401 || res.status === 403) return { ok: false, notAuthorized: true, status: res.status, message: `Read scope not granted (HTTP ${res.status})` };
    if (res.status === 404) return { ok: false, notFound: true, message: "User not found" };
    if (!res.ok) return { ok: false, status: res.status, message: `User read failed (HTTP ${res.status})` };
    const user = await res.json().catch(() => ({}));
    return { ok: true, user };
  } catch {
    return { ok: false, message: "Could not reach Microsoft Graph" };
  }
}

/**
 * Gated, read-back-verified Entra remediation. PRECONDITIONS (each refuses honestly, never fakes):
 *   approved !== true            → { ok:false, needsApproval:true }
 *   !hasEntraCredentials         → { ok:false, notConfigured:true }
 *   !isExactTarget(userId)       → { ok:false, targetUncertain:true }  (STOP — never guess a user)
 *   Graph 401/403 on the write   → { ok:false, notAuthorized:true }   (write scope + admin consent absent)
 * On success: executes → READ-BACK GET → { ok:true, action, label, rollbackNote, verified, user }.
 * NEVER autonomous: the caller must pass an explicit approval from the gate.
 */
export async function remediateUser(input = {}, options = {}) {
  const env = options.env || process.env;
  const action = String(input.action || "");
  const userId = String(input.userId || "").trim();
  const log = typeof options.logger === "function" ? options.logger : () => {};
  const audit = (type, message, data = {}) => { try { log({ type, message, ts: new Date().toISOString(), ...data }); } catch { /* never throw */ } };

  if (!ENTRA_REMEDIATIONS.includes(action)) return { ok: false, badAction: true, message: `Unknown remediation '${action}'` };
  if ((input.approved === true || options.approved === true) !== true) {
    audit("ENTRA.REMEDIATE.BLOCKED", `${action}: awaiting approval`);
    return { ok: false, needsApproval: true, message: "Awaiting approval (gated remediation)" };
  }
  if (!hasEntraCredentials(env)) {
    audit("ENTRA.REMEDIATE.UNCONFIGURED", `${action}: directory not configured`);
    return { ok: false, notConfigured: true, message: "Entra directory credentials not configured" };
  }
  if (!isExactTarget(userId)) {
    audit("ENTRA.REMEDIATE.TARGET", `${action}: target not certain — STOP`);
    return { ok: false, targetUncertain: true, message: "Target not certain — provide an exact user (GUID or UPN). STOP." };
  }

  const fetchImpl = options.fetch || globalThis.fetch;
  const auth = await acquireToken(env, options);
  if (!auth.ok) {
    audit("ENTRA.REMEDIATE.TOKEN", `${action}: ${auth.message}`);
    return { ok: false, tokenFailed: true, message: auth.message };
  }

  // Execute the chosen cloud remediation via the consented write scope.
  let execStatus = 0;
  try {
    if (action === "revokeSignInSessions") {
      const res = await fetchImpl(`${GRAPH_HOST}/users/${encodeURIComponent(userId)}/revokeSignInSessions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }
      });
      execStatus = res.status;
    } else { // forcePasswordChange
      const res = await fetchImpl(`${GRAPH_HOST}/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ passwordProfile: { forceChangePasswordNextSignIn: true } })
      });
      execStatus = res.status;
    }
  } catch {
    audit("ENTRA.REMEDIATE.ERROR", `${action}: could not reach Graph`);
    return { ok: false, message: "Could not reach Microsoft Graph" };
  }

  if (execStatus === 401 || execStatus === 403) {
    audit("ENTRA.REMEDIATE.FORBIDDEN", `${action}: not authorized (HTTP ${execStatus})`, { status: execStatus });
    return { ok: false, notAuthorized: true, status: execStatus, action, label: remediationLabel(action),
      message: `Not authorized (HTTP ${execStatus}) — needs the write scope + admin consent (revokeSignInSessions: User.RevokeSessions.All/Directory write; forcePasswordChange: User.ReadWrite.All). Flagging instead of faking.` };
  }
  if (!(execStatus >= 200 && execStatus < 300)) {
    audit("ENTRA.REMEDIATE.FAIL", `${action}: HTTP ${execStatus}`, { status: execStatus });
    return { ok: false, status: execStatus, action, message: `Remediation failed (HTTP ${execStatus})` };
  }

  // READ-BACK VERIFY — confirm the user is reachable post-write and return the real state.
  const verified = await getUser(userId, env, { ...options, token: auth.token });
  audit("ENTRA.REMEDIATE.OK", `${action}: applied + read-back ${verified.ok ? "confirmed" : "unconfirmed"}`, { status: execStatus });
  return {
    ok: true,
    action,
    label: remediationLabel(action),
    rollbackNote: rollbackNote(action),
    status: execStatus,
    verified: Boolean(verified.ok),
    user: verified.ok ? { id: verified.user.id, userPrincipalName: verified.user.userPrincipalName, signInSessionsValidFromDateTime: verified.user.signInSessionsValidFromDateTime } : null,
    message: `${remediationLabel(action)} Applied; ${verified.ok ? "user read-back confirmed" : "read-back not confirmed"}.`
  };
}
