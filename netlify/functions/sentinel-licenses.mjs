// RUN 24 A3 — admin license registry API over the Netlify Blobs "sentinel-licenses" store. Pure JSON,
// admin-console-only. Every read/mutation requires Bearer SENTINEL_ADMIN_TOKEN EXCEPT is-revoked, which
// is the content-blind runtime check (key-hash gated, returns only {revoked}). All decisions live in the
// shared funnel module (Sentinel-suite-tested); this handler does the Blobs/Resend I/O.
//
// 🔒 Stop conditions: SENTINEL_LICENSE_SECRET never logged/returned; every mutation is admin-token gated;
// is-revoked never returns a key or PII; R11 — funnel scrubs paths from any minted record.
//
// SENTINEL-BACKEND 2026-10-14:
//   - audit B1/B17: stores open through lib/sentinel-store.cjs (connectLambda first); an unreachable store is
//     503 { ok:false, reason:'store-unavailable' } — the live 502 + stack trace is gone.
//   - audit B4: Revoke now WRITES the revocation entry sentinel-resolve and device auth READ
//     ('sentinel-licenses-revocations' <sha256(key)>) — before today nothing wrote it, so "revoked" customers kept
//     full access. A v1 plan key is shared by everyone on that plan, so its revocation entry is written only
//     when no other ACTIVE record still holds the same key; the response says honestly whether the key was
//     cut off (`enforced`) and why not when it was not.
//   - audit B3: addManual mints a per-customer v2 key (lib/sentinel-license-v2.cjs) and every mint / revoke keeps
//     the O(1) key index ('sentinel-license-keys') in step. New admin actions: setFlags (disabled / contacts /
//     seats), unrevoke, revokeKeyHash (explicitly cut off a credential, e.g. a leaked v1 plan key).
//   All previous actions keep their routes and response fields (Rule 15); new fields are additive.
import { keyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import {
  isAdminAuthorized, filterRecords, revokeRecord, findRevokedByKeyHash, recordsToCsv,
  mintLicense, customerEmail, adminEmail, ADMIN_EMAIL
} from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";
import { openStore, unavailable } from "./lib/sentinel-store.cjs";
import { issueCustomerKey, canonicalPlan, HEX64 } from "./lib/sentinel-license-v2.cjs";
import {
  STORES, REVOCATION_EFFECT, normalizeContacts, writeKeyIndex, revocationFor, writeRevocation, clearRevocation
} from "./lib/sentinel-license-records.cjs";

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const action = String(params.action || "");
  const store = await openStore(STORES.LICENSES, event);
  if (!store) return unavailable({ error: "store-unavailable" });

  // --- Public, content-blind: runtime revocation check (no admin token; key-hash only). ---
  if (action === "is-revoked") {
    const hash = String(params["key-hash"] || params.keyHash || "").toLowerCase();
    if (!HEX64.test(hash)) return json(400, { error: "bad key-hash" });
    // O(1): the one revocation store (what revoke / Stripe cancellation write). Legacy fallback: the record scan.
    const r = await revocationFor(hash, event);
    if (r.revoked) return json(200, { revoked: true });
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
  if (!body || typeof body !== "object") body = {};

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
      // Rule 14: `resent` is true only when Resend accepted the message; an unconfigured sender is said so.
      const sent = await sendEmail(rec.email, customerEmail(rec));
      return json(sent ? 200 : 503, sent ? { resent: true } : { resent: false, reason: "email-not-configured" });
    }
    if (method === "POST" && action === "revoke") {
      const id = String(body.subscription_id || params.subscription_id || "");
      const rec = await store.get(id, { type: "json" }).catch(() => null);
      if (!rec) return json(404, { error: "not found" });
      const updated = revokeRecord(rec, new Date().toISOString());
      await store.setJSON(id, updated);
      const enforcement = await enforceRevocation(store, updated, event, { reason: "admin-revoke", subscription_id: id });
      return json(200, { record: { ...updated, key: undefined }, ...enforcement }); // never echo the key back
    }
    if (method === "POST" && action === "unrevoke") {
      const id = String(body.subscription_id || params.subscription_id || "");
      const rec = await store.get(id, { type: "json" }).catch(() => null);
      if (!rec) return json(404, { error: "not found" });
      const updated = { ...rec, status: "active", revoked_at: null, unrevoked_at: new Date().toISOString() };
      await store.setJSON(id, updated);
      const cleared = rec.key ? await clearRevocation(keyHash(rec.key), event) : false;
      const indexed = await writeKeyIndex(updated, event);
      return json(200, { record: { ...updated, key: undefined }, revocationCleared: cleared, indexed });
    }
    if (method === "POST" && action === "revokeKeyHash") {
      // Explicitly cut off ONE credential (sha256(key)) — e.g. a leaked v1 shared plan key. Every record holding
      // that key is marked revoked too, so the admin list and the revocation store agree.
      const hash = String(body.key_hash || body.keyHash || "").toLowerCase();
      if (!HEX64.test(hash)) return json(400, { error: "bad key-hash" });
      const written = await writeRevocation(hash, { reason: String(body.reason || "admin-revoke-key").slice(0, 120) }, event);
      if (!written) return unavailable({ error: "store-unavailable" });
      let marked = 0;
      for (const rec of await loadAll(store)) {
        if (rec.key && keyHash(rec.key) === hash && rec.status !== "revoked") {
          const updated = revokeRecord(rec, new Date().toISOString());
          await store.setJSON(String(rec.subscription_id), updated).catch(() => null);
          await writeKeyIndex(updated, event);
          marked++;
        }
      }
      return json(200, { revoked: true, key_hash: hash, recordsMarked: marked, enforced: true, effect: REVOCATION_EFFECT });
    }
    if (method === "POST" && action === "setFlags") {
      const id = String(body.subscription_id || params.subscription_id || "");
      const rec = await store.get(id, { type: "json" }).catch(() => null);
      if (!rec) return json(404, { error: "not found" });
      const updated = { ...rec };
      if (typeof body.disabled === "boolean") updated.disabled = body.disabled;
      if (Array.isArray(body.contacts)) updated.contacts = normalizeContacts(body.contacts);
      if (body.seats !== undefined) updated.seats = body.seats == null ? null : Math.max(1, Math.min(10000, Math.floor(Number(body.seats)) || 1));
      updated.updated_at = new Date().toISOString();
      await store.setJSON(id, updated);
      const indexed = await writeKeyIndex(updated, event);
      return json(200, { record: { ...updated, key: undefined }, indexed });
    }
    if (method === "POST" && action === "addManual") {
      const licenseSecret = process.env.SENTINEL_LICENSE_SECRET;
      if (!licenseSecret) return json(500, { error: "license signing not configured" });
      if (!body.email || !body.tier) return json(400, { error: "email + tier required" });
      const plan = canonicalPlan(body.tier);
      if (!plan) return json(400, { error: "unknown tier" });
      const subscription_id = `manual_${keyHash(`${body.email}:${body.tier}:${Date.now()}`).slice(0, 24)}`;
      const base = mintLicense({ email: body.email, name: body.name, plan, subscription_id, customer_id: "manual", secret: licenseSecret, issued_at: new Date().toISOString() });
      // Per-customer v2 key (audit B3): plan + customer + HMAC tag inside the same 64-hex shape the desktop accepts.
      const key = issueCustomerKey({ plan, seed: `manual:${subscription_id}`, secret: licenseSecret });
      const rec = {
        ...base, key, key_version: 2,
        seats: body.seats == null ? defaultSeats(plan) : Math.max(1, Math.min(10000, Math.floor(Number(body.seats)) || 1)),
        contacts: normalizeContacts(body.contacts), disabled: false
      };
      await store.setJSON(subscription_id, rec);
      const indexed = await writeKeyIndex(rec, event);
      const emailed = { customer: false, admin: false };
      emailed.customer = Boolean(await sendEmail(rec.email, customerEmail(rec)).catch((e) => { console.error("[sentinel-licenses] customer email:", e.message); return false; }));
      emailed.admin = Boolean(await sendEmail(ADMIN_EMAIL, adminEmail(rec)).catch((e) => { console.error("[sentinel-licenses] admin email:", e.message); return false; }));
      return json(200, { record: { ...rec, key: undefined }, subscription_id, indexed, keyVersion: 2, emailed }); // key delivered by email, not API
    }
    return json(400, { error: "unknown action" });
  } catch (err) {
    console.error("[sentinel-licenses] error:", String((err && err.message) || err).slice(0, 200));
    return json(500, { error: "registry error" });
  }
};

/** Seats a plan carries when the admin does not say (Personal is 1 user · 1 device; fleet tiers are unmetered). */
function defaultSeats(plan) {
  return plan === "personal" ? 1 : plan === "pro" ? 5 : null;
}

/**
 * After a record is revoked: cut the KEY off wherever it is checked. A v2 key belongs to one customer, so its
 * revocation entry is written at once. A v1 plan key is shared by every customer on that plan: the entry is
 * written only when no other ACTIVE record still holds the same key — otherwise the response says so
 * (enforced:false) instead of pretending the customer was cut off (Rule 14).
 */
async function enforceRevocation(store, updated, event, info) {
  const key = updated && updated.key;
  if (!key) return { enforced: false, enforcement: "record-has-no-key" };
  const hash = keyHash(key);
  const siblings = (await loadAll(store)).filter((r) => r && r.key === key && String(r.subscription_id) !== String(updated.subscription_id));
  const activeSibling = siblings.find((r) => r.status !== "revoked") || null;
  const activeSiblings = siblings.filter((r) => r.status !== "revoked").length;
  if (activeSibling) {
    // The key index is per KEY: while another customer legitimately holds this shared key it must keep saying
    // "active" (from that customer's record), or notify / resolve would cut everyone off.
    const indexed = await writeKeyIndex(activeSibling, event);
    return { enforced: false, indexed, activeSiblings, enforcement: `shared-plan-key: ${activeSiblings} other active record(s) hold this same v1 key, so the key itself was not cut off. Revoke those records too, or use action=revokeKeyHash to cut the key off for everyone.` };
  }
  const indexed = await writeKeyIndex(updated, event);
  const written = await writeRevocation(hash, info, event);
  return { enforced: written, indexed, enforcement: written ? REVOCATION_EFFECT : "revocation-store-unavailable: the record is marked revoked but the key is NOT yet cut off — retry Revoke when the store is back." };
}

async function loadAll(store) {
  const listing = await store.list().catch(() => ({ blobs: [] }));
  const keys = (listing.blobs || []).map((b) => b.key);
  const recs = await Promise.all(keys.map((k) => store.get(k, { type: "json" }).catch(() => null)));
  return recs.filter(Boolean);
}

/** true when Resend accepted the message; false when email is not configured; throws on a provider error. */
async function sendEmail(to, { subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from || !to) return false;
  // RUN 34-3 — 8s timeout so a slow/unreachable Resend can't hang the mint function (caller treats email as
  // best-effort; the license is already minted + persisted before this runs).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
  return true;
}

function json(statusCode, obj) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(obj) };
}
