// RUN 24 A3 — admin license registry API over the Netlify Blobs "sentinel-licenses" store. Pure JSON,
// admin-console-only. Every read/mutation requires Bearer SENTINEL_ADMIN_TOKEN EXCEPT is-revoked, which
// is the content-blind runtime check (key-hash gated, returns only {revoked}). All decisions live in the
// shared funnel module (Sentinel-suite-tested); this handler does the Blobs/Resend I/O.
//
// 🔒 Stop conditions: SENTINEL_LICENSE_SECRET never logged/returned; every mutation is admin-token gated;
// is-revoked never returns a key or PII; R11 — funnel scrubs paths from any minted record.
import { getStore } from "@netlify/blobs";
import { keyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import {
  isAdminAuthorized, filterRecords, revokeRecord, findRevokedByKeyHash, recordsToCsv,
  mintLicense, customerEmail, adminEmail, ADMIN_EMAIL
} from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const action = String(params.action || "");
  const store = getStore("sentinel-licenses");

  // --- Public, content-blind: runtime revocation check (no admin token; key-hash only). ---
  if (action === "is-revoked") {
    const hash = String(params["key-hash"] || params.keyHash || "");
    if (!/^[a-f0-9]{64}$/i.test(hash)) return json(400, { error: "bad key-hash" });
    const all = await loadAll(store);
    const { revoked } = findRevokedByKeyHash(all, hash, keyHash);
    return json(200, { revoked });
  }

  // --- Everything else requires the admin token (Authorization: Bearer … OR the admin console's
  //     X-Admin-Token header — both constant-time compared against SENTINEL_ADMIN_TOKEN). ---
  const token = process.env.SENTINEL_ADMIN_TOKEN;
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const xToken = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  const authed = isAdminAuthorized(authHeader, token) || isAdminAuthorized(`Bearer ${xToken || ""}`, token);
  if (!authed) return json(401, { error: "unauthorized" });
  const method = (event.httpMethod || "GET").toUpperCase();
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(400, { error: "bad json" }); }

  try {
    if (method === "GET" && action === "list") {
      return json(200, { records: filterRecords(await loadAll(store), params.q) });
    }
    if (method === "GET" && action === "get") {
      const rec = await store.get(String(params.subscription_id || ""), { type: "json" }).catch(() => null);
      return rec ? json(200, { record: rec }) : json(404, { error: "not found" });
    }
    if (method === "GET" && action === "exportCsv") {
      return { statusCode: 200, headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=sentinel-licenses.csv" }, body: recordsToCsv(await loadAll(store)) };
    }
    if (method === "POST" && action === "resend") {
      const rec = await store.get(String(body.subscription_id || params.subscription_id || ""), { type: "json" }).catch(() => null);
      if (!rec) return json(404, { error: "not found" });
      await sendEmail(rec.email, customerEmail(rec));
      return json(200, { resent: true });
    }
    if (method === "POST" && action === "revoke") {
      const id = String(body.subscription_id || params.subscription_id || "");
      const rec = await store.get(id, { type: "json" }).catch(() => null);
      if (!rec) return json(404, { error: "not found" });
      const updated = revokeRecord(rec, new Date().toISOString());
      await store.setJSON(id, updated);
      return json(200, { record: { ...updated, key: undefined } }); // never echo the key back
    }
    if (method === "POST" && action === "addManual") {
      const licenseSecret = process.env.SENTINEL_LICENSE_SECRET;
      if (!licenseSecret) return json(500, { error: "license signing not configured" });
      if (!body.email || !body.tier) return json(400, { error: "email + tier required" });
      const subscription_id = `manual_${keyHash(`${body.email}:${body.tier}:${Date.now()}`).slice(0, 24)}`;
      const rec = mintLicense({ email: body.email, name: body.name, plan: body.tier, subscription_id, customer_id: "manual", secret: licenseSecret, issued_at: new Date().toISOString() });
      await store.setJSON(subscription_id, rec);
      await sendEmail(rec.email, customerEmail(rec)).catch((e) => console.error("[sentinel-licenses] customer email:", e.message));
      await sendEmail(ADMIN_EMAIL, adminEmail(rec)).catch((e) => console.error("[sentinel-licenses] admin email:", e.message));
      return json(200, { record: { ...rec, key: undefined }, subscription_id }); // key delivered by email, not API
    }
    return json(400, { error: "unknown action" });
  } catch (err) {
    console.error("[sentinel-licenses] error:", err.message);
    return json(500, { error: "registry error" });
  }
};

async function loadAll(store) {
  const listing = await store.list().catch(() => ({ blobs: [] }));
  const keys = (listing.blobs || []).map((b) => b.key);
  const recs = await Promise.all(keys.map((k) => store.get(k, { type: "json" }).catch(() => null)));
  return recs.filter(Boolean);
}

async function sendEmail(to, { subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from || !to) return;
  // RUN 34-3 — 8s timeout so a slow/unreachable Resend can't hang the mint function (caller treats email as
  // best-effort; the license is already minted + persisted before this runs).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

function json(statusCode, obj) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) };
}
