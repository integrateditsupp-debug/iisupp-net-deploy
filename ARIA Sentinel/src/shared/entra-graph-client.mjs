// entra-graph-client.mjs — the LIVE Microsoft Graph adapter for the DirectoryProvider (Q-DIR slice 2).
//
// Implements the read-only `client` interface that directory.mjs consumes ({ findUsers, getUser,
// getMemberGroups, getDevices }). App ID + Tenant ID + client secret are read from secure env/config and
// NEVER hardcoded, logged, or returned in any result. Token is acquired via the OAuth2 client-credentials
// flow with the LEAST-PRIVILEGE read scope (Graph .default, which resolves to the app's admin-consented
// read scopes). WRITES are intentionally NOT enabled in this slice — they require write scopes + admin
// consent (a later, separately-gated slice) and throw until then. Pure + injectable (fetch/now) so it is
// unit-tested without touching a live tenant.

const GRAPH = "https://graph.microsoft.com/v1.0";
const LOGIN = "https://login.microsoftonline.com";

/** Read tenant/app creds from env. configured===true only when ALL three are present. Secret is never echoed. */
export function getGraphConfig(env = process.env) {
  const tenantId = String(env.DIRECTORY_TENANT_ID || "").trim();
  const clientId = String(env.DIRECTORY_CLIENT_ID || "").trim();
  const hasSecret = Boolean(env.DIRECTORY_CLIENT_SECRET);
  return { tenantId, clientId, configured: Boolean(tenantId && clientId && hasSecret) };
}

function odata(s) {
  return String(s).replace(/'/g, "''"); // OData single-quote escaping (prevents filter injection)
}

/**
 * Build the live Graph DirectoryProvider client. Returns null when creds are not configured (caller then
 * stays on mock/dry-run). opts.fetch / opts.now are injectable for tests.
 */
export function createGraphClient(env = process.env, opts = {}) {
  const cfg = getGraphConfig(env);
  if (!cfg.configured) return null;
  const fetchImpl = opts.fetch || globalThis.fetch;
  const now = opts.now || (() => Date.now());
  const secret = String(env.DIRECTORY_CLIENT_SECRET || ""); // held in closure only; never returned/logged
  let token = null, tokenExp = 0;

  async function accessToken() {
    if (token && now() < tokenExp) return token;
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const res = await fetchImpl(`${LOGIN}/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`graph_token_failed_${res.status}`);
    const j = await res.json();
    if (!j || !j.access_token) throw new Error("graph_token_missing");
    token = j.access_token;
    tokenExp = now() + (Math.max(60, Number(j.expires_in) || 3600) - 60) * 1000;
    return token;
  }

  async function get(pathQuery) {
    const t = await accessToken();
    const res = await fetchImpl(`${GRAPH}${pathQuery}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${t}`, Accept: "application/json", ConsistencyLevel: "eventual" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`graph_get_failed_${res.status}`);
    return res.json();
  }

  const writeGate = (op) => { throw new Error(`directory_write_not_enabled:${op} — write scopes + admin consent required (later slice)`); };

  return {
    provider: "entra",
    // ---- READ-ONLY ops (shape matches directory.mjs) ----
    async findUsers(q) {
      const f = `startswith(displayName,'${odata(q)}') or startswith(userPrincipalName,'${odata(q)}') or startswith(mail,'${odata(q)}')`;
      const j = await get(`/users?$filter=${encodeURIComponent(f)}&$select=id,displayName&$expand=manager($select=id)&$top=10`);
      const rows = (j && j.value) || [];
      return rows.map((u) => ({ id: u.id, displayName: u.displayName, managerId: u.manager ? u.manager.id : null }));
    },
    async getUser(id) {
      const u = await get(`/users/${encodeURIComponent(id)}?$select=id,displayName,accountEnabled`);
      if (!u) return null;
      // Entra cloud accounts have no AD-style "lockedOut" flag (that is on-prem AD DS, a hybrid concern);
      // a disabled account is accountEnabled:false. Report lockedOut:false here; AD-DS lockout is a later seam.
      return { id: u.id, displayName: u.displayName, accountEnabled: u.accountEnabled !== false, lockedOut: false };
    },
    async getMemberGroups(id) {
      const j = await get(`/users/${encodeURIComponent(id)}/memberOf/microsoft.graph.group?$select=id,displayName&$top=50`);
      return ((j && j.value) || []).map((g) => ({ id: g.id, displayName: g.displayName }));
    },
    async getDevices(id) {
      const j = await get(`/users/${encodeURIComponent(id)}/registeredDevices?$select=id,operatingSystem,isCompliant&$top=50`);
      return ((j && j.value) || []).map((d) => ({ id: d.id, os: d.operatingSystem || "", compliant: d.isCompliant === true }));
    },
    // ---- WRITES (gated until a later slice; never silently no-op) ----
    async setLocked() { return writeGate("setLocked"); },
    async setEnabled() { return writeGate("setEnabled"); },
    async addGroupMember() { return writeGate("addGroupMember"); },
    async removeGroupMember() { return writeGate("removeGroupMember"); },
    async resetPassword() { return writeGate("resetPassword"); },
  };
}

/** Read-only connectivity smoke: acquire a token + one cheap read. Returns a flag-friendly status object. */
export async function graphReadOnlySmoke(env = process.env, opts = {}) {
  const cfg = getGraphConfig(env);
  if (!cfg.configured) {
    return { ok: false, configured: false, reason: "creds_not_configured", needs: ["DIRECTORY_TENANT_ID", "DIRECTORY_CLIENT_ID", "DIRECTORY_CLIENT_SECRET"] };
  }
  const client = createGraphClient(env, opts);
  try {
    const sample = await client.findUsers(opts.sampleQuery || "a");
    return { ok: true, configured: true, sampleCount: sample.length };
  } catch (e) {
    return { ok: false, configured: true, reason: String(e && e.message || e).slice(0, 80) };
  }
}
