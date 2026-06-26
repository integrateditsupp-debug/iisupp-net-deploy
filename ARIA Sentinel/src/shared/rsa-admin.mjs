// rsa-admin — RSA ID verification / token admin. ARIA is a MIDDLEMAN only: NEVER biometrics, never storing
// identity material. There is NO free public RSA read sandbox, so 🔒 HARD RULE 14 keeps this honestly
// "Not configured" — we never bake in or fake an RSA endpoint. A customer can wire a REAL read-only health
// endpoint (RSA_HEALTH_URL + RSA_API_KEY); only then does Test connection attempt a single GET, and it only
// reports success on a real 2xx. READ-ONLY (GET only) — never writes, never throws.

export function rsaConfig(env = process.env) {
  const e = env || {};
  return {
    url: String(e.RSA_HEALTH_URL || "").trim(),
    key: String(e.RSA_API_KEY || "").trim(),
    get configured() { return Boolean(this.url && this.key); }
  };
}

export function getStatus(env = process.env) {
  return rsaConfig(env).configured
    ? { status: "not_configured", detail: "RSA endpoint present — run Test connection to verify (read-only)" }
    : { status: "not_configured", detail: "RSA admin not connected (no public sandbox; set RSA_HEALTH_URL + RSA_API_KEY)" };
}

/** Read-only GET against the customer-provided RSA health endpoint. No config → Not configured. Never throws. */
export async function testConnection(env = process.env, options = {}) {
  const cfg = rsaConfig(env);
  if (!cfg.configured) return { ok: false, message: "Not configured" };
  if (!/^https:\/\//i.test(cfg.url)) return { ok: false, message: "RSA_HEALTH_URL must be https" };
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(cfg.url, {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.key}`, Accept: "application/json" }
    });
    if (res.ok) return { ok: true, message: `RSA endpoint reachable (HTTP ${res.status})` };
    if (res.status === 401 || res.status === 403) return { ok: false, message: `RSA auth rejected (HTTP ${res.status})` };
    return { ok: false, message: `RSA read failed (HTTP ${res.status})` };
  } catch {
    return { ok: false, message: "Could not reach the RSA endpoint" };
  }
}
