// office-msgraph — Microsoft 365 document apps (Word / Excel / PowerPoint / OneNote) read-only health check
// over Microsoft Graph, using the SAME app-registration token as Entra (client credentials → GET). Files
// apps verify with Files.Read.All against a target drive; OneNote with Notes.Read.All against a target user.
// 🔒 HARD RULE 14: with no creds (or no read target) the card is honestly "Not configured"; it only reports
// success when a real read returns 2xx. READ-ONLY (GET only) — never writes, never throws. App registration +
// admin consent are Ahmad's tenant-admin action. `options.fetch` is injectable for tests.

import { hasEntraCredentials, acquireToken } from "./entra-graph-client.mjs";

const GRAPH_HOST = "https://graph.microsoft.com/v1.0";

export const OFFICE_APPS = {
  word: "MS Word",
  excel: "Excel",
  powerpoint: "PowerPoint",
  onenote: "OneNote"
};

// App-only Graph reads need a concrete target. Files apps read a drive (OFFICE_DRIVE_ID); OneNote reads a
// user's notebooks (OFFICE_USER_ID). Returns "" when the needed target isn't set (→ honest Not configured).
function probePath(app, env = process.env) {
  const e = env || {};
  if (app === "onenote") {
    const user = String(e.OFFICE_USER_ID || "").trim();
    return user ? `/users/${encodeURIComponent(user)}/onenote/notebooks?$top=1` : "";
  }
  const drive = String(e.OFFICE_DRIVE_ID || "").trim();
  return drive ? `/drives/${encodeURIComponent(drive)}/root` : "";
}

export function getStatus(app, env = process.env) {
  if (!OFFICE_APPS[app]) return { status: "not_configured", detail: "Unknown app" };
  if (!hasEntraCredentials(env)) return { status: "not_configured", detail: "Microsoft 365 not connected (set DIRECTORY_* creds)" };
  return { status: "not_configured", detail: "Graph creds present — run Test connection to verify (read-only)" };
}

/** Read-only Graph probe. No creds → Not configured. No read target → asks for it. Never throws. */
export async function testConnection(app, env = process.env, options = {}) {
  if (!OFFICE_APPS[app]) return { ok: false, message: "Unknown app" };
  if (!hasEntraCredentials(env)) return { ok: false, message: "Not configured" };
  const path = probePath(app, env);
  if (!path) return { ok: false, message: app === "onenote" ? "Set OFFICE_USER_ID to verify (read-only)" : "Set OFFICE_DRIVE_ID to verify (read-only)" };
  const auth = await acquireToken(env, options);
  if (!auth.ok) return { ok: false, message: auth.message };
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const res = await fetchImpl(`${GRAPH_HOST}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.token}`, Accept: "application/json" }
    });
    if (res.ok) return { ok: true, message: `${OFFICE_APPS[app]} reachable — read-only Graph verified` };
    if (res.status === 401 || res.status === 403) return { ok: false, message: `Read scope not granted (HTTP ${res.status})` };
    return { ok: false, message: `Graph read failed (HTTP ${res.status})` };
  } catch {
    return { ok: false, message: "Could not reach Microsoft Graph" };
  }
}
