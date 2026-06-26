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
