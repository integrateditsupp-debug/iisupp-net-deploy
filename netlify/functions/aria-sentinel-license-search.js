// Netlify function: admin license search + per-license / bulk / all-machines rollback pin.
// GET ?q=  → search.  POST {action:"rollback", keys:[], version_pin}  → set pin(s).
// Admin-only (X-Admin-Token). Rollback NEVER bypasses license validation — it only sets a
// version_pin on an EXISTING license record; the device still validates its key to run.
//
// SENTINEL-BACKEND 2026-10-14 (audit B1 / B13 / B19):
//   - admin gate = the app's src/shared/admin-auth.mjs (SENTINEL_ADMIN_TOKEN or ARIA_ADMIN_TOKEN, constant-time).
//   - the 'licenses' store is keyed by the device credential sha256(key) (license-register); `keys` in a
//     rollback may be those hashes (preferred) or legacy raw keys (hashed on arrival, tried both ways).
//   - no raw key leaves this endpoint: a legacy record's `license_key` is masked (first4…last4) in results.
//   - Blobs through lib/sentinel-store.cjs (connectLambda before getStore); unreachable store → 503 JSON.
import { requireAdminToken } from "../../src/shared/admin-auth.mjs";
import { searchLicenses } from "../../src/shared/license-registry.mjs";
import { openStore, unavailable, getJson, putJson } from "./lib/sentinel-store.cjs";
import { STORES } from "./lib/sentinel-license-records.cjs";
import { sha256, HEX64 } from "./lib/sentinel-approvals.cjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

function maskKey(k) { const s = String(k || ""); return s.length < 12 ? (s ? "…" : "") : `${s.slice(0, 4)}…${s.slice(-4)}`; }

async function allRecords(store) {
  const out = [];
  try {
    const { blobs } = await store.list();
    for (const b of (blobs || []).slice(0, 2000)) {
      const rec = await store.get(b.key, { type: "json" }).catch(() => null);
      if (rec && typeof rec === "object") out.push({ ...rec, key_hash: rec.key_hash || (HEX64.test(String(b.key)) ? b.key : undefined), _blobKey: b.key });
    }
  } catch { /* empty store */ }
  return out;
}

export async function handler(event) {
  const auth = requireAdminToken(event.headers || {}, process.env);
  if (!auth.ok) return json(auth.status, { error: auth.reason });
  const licenses = await openStore(STORES.DEVICES, event);
  if (!licenses) return unavailable();

  if ((event.httpMethod || "GET") === "POST") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
    if (body.action !== "rollback") return json(400, { error: "unknown-action" });
    // "all" requires a second confirm flag from the UI's double-confirm + token re-entry.
    let keys = Array.isArray(body.keys) ? body.keys.map((k) => String(k || "")) : [];
    if (body.scope === "all") {
      if (!body.confirm_all) return json(400, { error: "all-machines-requires-confirm" });
      keys = (await allRecords(licenses)).map((r) => r._blobKey).filter(Boolean);
    }
    let updated = 0;
    const pin = body.version_pin ? String(body.version_pin).slice(0, 32) : null;
    const pinned = new Set();
    for (const key of keys) {
      // A credential (sha256) is the blob name; a legacy raw key is hashed and both spellings are tried.
      const candidates = HEX64.test(key.toLowerCase()) ? [key.toLowerCase(), sha256(key)] : [key];
      for (const c of candidates) {
        if (pinned.has(c)) break;
        const rec = await getJson(licenses, c);
        if (rec) { if (await putJson(licenses, c, { ...rec, version_pin: pin })) { updated++; pinned.add(c); } break; }
      }
    }
    return json(200, { ok: true, rolledBack: updated, version_pin: pin });
  }

  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  const page = Number(event.queryStringParameters?.page) || 1;
  const result = searchLicenses(await allRecords(licenses), q, { page, pageSize: 25 });
  result.results = result.results.map(({ _blobKey, ...r }) => ({ ...r, license_key: r.license_key ? maskKey(r.license_key) : undefined }));
  return json(200, result);
}

export const config = { path: "/.netlify/functions/aria-sentinel-license-search" };
