// Stub for aria-sentinel-heartbeat.js — the full implementation lives on sprint-0-backend.
// This minimal version keeps the Netlify deploy green while preserving content-blind heartbeat
// semantics. Real impl ships when sprint-0-backend lands on main.

const ALLOWED_FIELDS = ["licenseId", "version", "platform", "uptime", "tier", "status", "checks"];

export function sanitizeHeartbeatRecord(payload) {
  if (!payload || typeof payload !== "object") return {};
  const out = {};
  for (const k of ALLOWED_FIELDS) {
    if (payload[k] != null) out[k] = typeof payload[k] === "string" ? String(payload[k]).slice(0, 200) : payload[k];
  }
  return out;
}

export function heartbeatStoreKey(licenseId, ts) {
  const id = String(licenseId || "anon").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const day = new Date(ts || Date.now()).toISOString().slice(0, 10);
  return `${day}/${id}`;
}

export function latestLiveVersion(versions) {
  if (!Array.isArray(versions) || !versions.length) return null;
  return versions.filter(v => v && v.live === true).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))[0] || null;
}

export function heartbeatResponse({ licenseRecord, versions, mandatory, now } = {}) {
  const latest = latestLiveVersion(versions);
  return {
    ok: true,
    serverTime: new Date(now || Date.now()).toISOString(),
    licenseActive: Boolean(licenseRecord && licenseRecord.status === "active"),
    latestVersion: latest ? latest.version : null,
    mandatoryUpdate: Boolean(mandatory),
  };
}
