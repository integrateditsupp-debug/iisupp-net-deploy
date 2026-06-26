// crm — CRM read-only health check. Uses a FREE-tier HubSpot private-app token (HUBSPOT_PRIVATE_APP_TOKEN);
// a single GET of one contact proves read connectivity. 🔒 HARD RULE 14: with no token the card is honestly
// "Not configured"; it only reports success when a real read returns 2xx. READ-ONLY (GET only) — never writes,
// never throws. No paid SDK — node fetch only. `options.fetch` is injectable for tests.

const HUBSPOT_API = "https://api.hubapi.com";

/** The HubSpot private-app token from any of the accepted env names (trimmed). */
export function hubspotToken(env = process.env) {
  const e = env || {};
  return String(e.HUBSPOT_PRIVATE_APP_TOKEN || e.HUBSPOT_TOKEN || e.CRM_TOKEN || "").trim();
}

/** Honest status: grey until a real read verifies (never "connected" without a successful call). */
export function getStatus(env = process.env) {
  return hubspotToken(env)
    ? { status: "not_configured", detail: "HubSpot token present — run Test connection to verify (read-only)" }
    : { status: "not_configured", detail: "No CRM connected (set HUBSPOT_PRIVATE_APP_TOKEN)" };
}

/** Read-only: GET one contact. No token → Not configured. Never throws. */
export async function testConnection(env = process.env, options = {}) {
  const token = hubspotToken(env);
  if (!token) return { ok: false, message: "Not configured" };
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(`${HUBSPOT_API}/crm/v3/objects/contacts?limit=1&archived=false`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    if (res.ok) return { ok: true, message: "HubSpot reachable — read-only token verified" };
    if (res.status === 401 || res.status === 403) return { ok: false, message: `HubSpot token rejected (HTTP ${res.status})` };
    return { ok: false, message: `HubSpot read failed (HTTP ${res.status})` };
  } catch {
    return { ok: false, message: "Could not reach HubSpot" };
  }
}
