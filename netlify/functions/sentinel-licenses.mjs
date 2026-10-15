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
//
// SENTINEL REVIEW FIXES 2026-10-14:
//   - P2-3: is-revoked is O(1) and nothing else — the revocation entry + the key's own index entry, read by
//     sha256(key). The legacy "scan every record on a miss" fallback is gone (the review measured 2,002 Blobs reads
//     for ONE unauthenticated request at 2,000 records). It is rate-limited per IP and per key-hash by the durable
//     Blobs limiter (fail closed: limiter store down → 503).
//   - P1-2: new admin action `approve-contact` { subscription_id | key_hash, email?, phone? } — the ONLY way a
//     non-buyer address becomes a notify / session-report recipient. It records `contact_approved_at` (+ a
//     contact_approvals audit list), refreshes the key index, and clears the address from the device's pending list.
//     A shared v1 plan key cannot have contacts (admin inbox only).
//   - P2-1: addManual refuses the server-only `trial` tier (trial keys come only from a Walk-Through purchase).
import { keyHash } from "../../ARIA Sentinel/src/shared/license-features.mjs";
import {
  isAdminAuthorized, filterRecords, revokeRecord, recordsToCsv,
  mintLicense, customerEmail, adminEmail, ADMIN_EMAIL
} from "../../ARIA Sentinel/src/shared/sentinel-license-funnel.mjs";
import { openStore, unavailable, getJson, putJson, durableLimits, limitResponse } from "./lib/sentinel-store.cjs";
import { issueCustomerKey, canonicalPlan, HEX64, sha256 } from "./lib/sentinel-license-v2.cjs";
import {
  STORES, REVOCATION_EFFECT, EMAIL_RE, MAX_CONTACTS, normalizeContacts, normalizePhone, normalizePhones, writeKeyIndex,
  loadKeyRecordStrict, revocationFor, writeRevocation, clearRevocation
} from "./lib/sentinel-license-records.cjs";
import { planKeyHash, PLAN_ORDER as V1_PLAN_MESSAGES, clientIp } from "./lib/sentinel-approvals.cjs";

const IS_REVOKED_PER_IP_PER_HOUR = 120;
const IS_REVOKED_PER_KEY_PER_HOUR = 60;

export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const action = String(params.action || "");
  const store = await openStore(STORES.LICENSES, event);
  if (!store) return unavailable({ error: "store-unavailable" });

  // --- Public, content-blind: runtime revocation check (no admin token; key-hash only). ---
  if (action === "is-revoked") {
    const hash = String(params["key-hash"] || params.keyHash || "").toLowerCase();
    if (!HEX64.test(hash)) return json(400, { error: "bad key-hash" });
    const limited = await isRevokedLimit(event, hash);
    if (limited) return limited;
    // O(1), P2-3: the revocation entry + the key's own index entry — never a scan, a miss is {revoked:false}.
    const r = await revocationFor(hash, event);
    const idx = await loadKeyRecordStrict(hash, event);
    if (r.unknown || !idx.ok) return unavailable({ error: "store-unavailable" });
    const revoked = r.revoked || Boolean(idx.record && idx.record.status === "revoked");
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
      if (Array.isArray(body.contact_phones)) updated.contact_phones = normalizePhones(body.contact_phones);
      if (body.seats !== undefined) updated.seats = body.seats == null ? null : Math.max(1, Math.min(10000, Math.floor(Number(body.seats)) || 1));
      updated.updated_at = new Date().toISOString();
      await store.setJSON(id, updated);
      const indexed = await writeKeyIndex(updated, event);
      return json(200, { record: { ...updated, key: undefined }, indexed });
    }
    if (method === "POST" && action === "approve-contact") {
      return await approveContact(store, body, params, event);
    }
    if (method === "POST" && action === "addManual") {
      const licenseSecret = process.env.SENTINEL_LICENSE_SECRET;
      if (!licenseSecret) return json(500, { error: "license signing not configured" });
      if (!body.email || !body.tier) return json(400, { error: "email + tier required" });
      const plan = canonicalPlan(body.tier);
      if (!plan) return json(400, { error: "unknown tier" });
      if (plan === "trial") return json(400, { error: "trial keys are minted only by an AI Setup Walk-Through purchase" });
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

/** P2-3 — the durable per-IP + per-key-hash ceiling on the public is-revoked check. null when allowed. */
async function isRevokedLimit(event, hash) {
  const rl = await openStore(STORES.RATE_LIMITS, event);
  const dl = await durableLimits(rl, [
    { scope: "is-revoked-ip", id: sha256(clientIp(event)).slice(0, 32), limit: IS_REVOKED_PER_IP_PER_HOUR },
    { scope: "is-revoked-key", id: hash.slice(0, 32), limit: IS_REVOKED_PER_KEY_PER_HOUR }
  ]);
  if (dl.ok) return null;
  if (dl.unavailable) console.error("[sentinel-licenses] is-revoked limiter unavailable — refusing (fail closed)");
  return limitResponse(dl);
}

/** Is this credential (sha256 of a key) one of the v1 SHARED plan keys? (Needs SENTINEL_LICENSE_SECRET.) */
function isSharedPlanCredential(hash) {
  const secret = String(process.env.SENTINEL_LICENSE_SECRET || "").trim();
  if (!secret) return false;
  return V1_PLAN_MESSAGES.some((p) => planKeyHash(p, secret) === hash);
}

/**
 * P1-2 — admin approval of a notify / session-report recipient. Body: { subscription_id | key_hash, email?, phone? }.
 * The address joins the record's approved contacts (key index refreshed), `contact_approved_at` is recorded, and the
 * address leaves the device registry's pending list. A shared v1 plan key never gets contacts.
 */
async function approveContact(store, body, params, event) {
  const email = String(body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);
  if (!email && !phone) return json(400, { error: "email or phone required" });
  if (email && !EMAIL_RE.test(email)) return json(400, { error: "bad email" });
  if (body.phone != null && String(body.phone) !== "" && !phone) return json(400, { error: "bad phone" });
  let id = String(body.subscription_id || params.subscription_id || "");
  const hash = String(body.key_hash || body.keyHash || "").toLowerCase();
  if (!id && hash) {
    if (!HEX64.test(hash)) return json(400, { error: "bad key-hash" });
    if (isSharedPlanCredential(hash)) return json(409, { error: "shared-plan-key", detail: "A v1 plan key is shared by every customer on its plan — it can notify the admin inbox only. Issue the customer a per-customer key (addManual) first." });
    const idx = await loadKeyRecordStrict(hash, event);
    if (!idx.ok) return unavailable({ error: "store-unavailable" });
    if (!idx.record || !idx.record.subscription_id) return json(404, { error: "no-license-record", detail: "This credential has no per-customer license record, so it can notify the admin inbox only." });
    id = String(idx.record.subscription_id);
  }
  if (!id) return json(400, { error: "subscription_id or key_hash required" });
  const rec = await getJson(store, id);
  if (!rec) return json(404, { error: "not found" });
  if (Number(rec.key_version) !== 2) return json(409, { error: "shared-plan-key", detail: "This record holds a shared v1 plan key — issue a per-customer key first." });
  const at = new Date().toISOString();
  const contacts = normalizeContacts([...(Array.isArray(rec.contacts) ? rec.contacts : []), ...(email ? [email] : [])]);
  const contact_phones = normalizePhones([...(Array.isArray(rec.contact_phones) ? rec.contact_phones : []), ...(phone ? [phone] : [])]);
  if ((email && !contacts.includes(email)) || (phone && !contact_phones.includes(phone))) return json(409, { error: "contacts-full", max: MAX_CONTACTS });
  const contact_approvals = [...(Array.isArray(rec.contact_approvals) ? rec.contact_approvals : []), { email: email || null, phone: phone || null, approved_at: at, via: "approve-contact" }].slice(-50);
  const updated = { ...rec, contacts, contact_phones, contact_approvals, contact_approved_at: at, updated_at: at };
  if (!(await putJson(store, id, updated))) return unavailable({ error: "store-unavailable" });
  const indexed = await writeKeyIndex(updated, event);
  let pendingCleared = false;
  if (email && rec.key) {
    const devices = await openStore(STORES.DEVICES, event);
    const cred = keyHash(rec.key);
    const dev = await getJson(devices, cred);
    if (dev && Array.isArray(dev.pending_contacts) && dev.pending_contacts.some((p) => p && p.email === email)) {
      pendingCleared = await putJson(devices, cred, { ...dev, pending_contacts: dev.pending_contacts.filter((p) => p && p.email !== email) });
    }
  }
  return json(200, { ok: true, subscription_id: id, approved: { email: email || null, phone: phone || null }, contact_approved_at: at, contacts, contact_phones, indexed, pendingCleared });
}

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
