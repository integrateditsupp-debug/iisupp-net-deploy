// Netlify function: admin license search + per-license / bulk / all-machines rollback pin.
// GET ?q=  → search.  POST {action:"rollback", keys:[], version_pin}  → set pin(s).
// Admin-only (X-Admin-Token). Rollback NEVER bypasses license validation — it only sets a
// version_pin on an EXISTING license record; the device still validates its key to run.
import { getStore } from "@netlify/blobs";
import { requireAdminToken } from "../../src/shared/admin-auth.mjs";
import { searchLicenses } from "../../src/shared/license-registry.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function allRecords(store) {
  const out = [];
  try {
    const { blobs } = await store.list();
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: "json" });
      if (rec) out.push(rec);
    }
  } catch { /* empty store */ }
  return out;
}

export async function handler(event) {
  const auth = requireAdminToken(event.headers || {}, process.env);
  if (!auth.ok) return json(auth.status, { error: auth.reason });
  const licenses = getStore("licenses");

  if ((event.httpMethod || "GET") === "POST") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
    if (body.action !== "rollback") return json(400, { error: "unknown-action" });
    // "all" requires a second confirm flag from the UI's double-confirm + token re-entry.
    let keys = Array.isArray(body.keys) ? body.keys : [];
    if (body.scope === "all") {
      if (!body.confirm_all) return json(400, { error: "all-machines-requires-confirm" });
      keys = (await allRecords(licenses)).map((r) => r.license_key).filter(Boolean);
    }
    let updated = 0;
    for (const key of keys) {
      const rec = await licenses.get(key, { type: "json" });
      if (rec) { await licenses.setJSON(key, { ...rec, version_pin: body.version_pin || null }); updated++; }
    }
    return json(200, { ok: true, rolledBack: updated, version_pin: body.version_pin || null });
  }

  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  const page = Number(event.queryStringParameters?.page) || 1;
  return json(200, searchLicenses(await allRecords(licenses), q, { page, pageSize: 25 }));
}

export const config = { path: "/.netlify/functions/aria-sentinel-license-search" };
