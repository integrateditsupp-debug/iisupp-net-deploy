// Netlify function: device check-in / license registration. POST from the app (every 4h in the design).
// Idempotent device upsert into Netlify Blobs. No admin token (the device authenticates by its own
// license credential); content-blind (name/company are user-supplied; every string is path-scrubbed, R11).
//
// SENTINEL-BACKEND 2026-10-14 (audit B1 / B3 / B5 / B13):
//   - device auth is REQUIRED: `x-sentinel-key` = sha256(licenseKey) (lib/sentinel-approvals.cjs — the same
//     credential notify / approval / session-report use). The legacy body field `license_key` (raw key) is
//     still accepted (Rule 15) and is hashed on arrival; a well-formed key that does not verify is 401.
//     Before today ANY 64-hex string registered a record under the RAW key as the blob name.
//   - records in the 'licenses' store are keyed by the credential (sha256(key)) and hold `key_hash`, never the
//     raw key. Per-customer (v2) keys therefore give one record per customer; a v1 plan key is one record per
//     plan (the shared-key limitation the audit describes — fixed by issuing v2 keys).
//   - `seats` comes from the license record (webhook / admin); the response says `overSeats:true` when more
//     devices have checked in than the plan allows. Nothing is locked out server-side yet — honest flag only.
//   - Blobs through lib/sentinel-store.cjs (connectLambda before getStore); unreachable store → 503 JSON.
//
// SENTINEL REVIEW FIXES 2026-10-14 (P1-2): the email a device declares at check-in is SELF-REGISTERED — the review
// registered a stranger's address here and the notify endpoint then mailed it as "vouched for". It is now stored as
// a PENDING contact (`pending_contacts`) and is never a notify / session-report recipient until an admin approves it
// (sentinel-licenses action=approve-contact). The response says which state the address is in.
import { registerDevice } from "../../src/shared/license-registry.mjs";
import { openStore, unavailable, getJson, putJson } from "./lib/sentinel-store.cjs";
import { STORES, EMAIL_RE, MAX_CONTACTS, isAllowedRecipient } from "./lib/sentinel-license-records.cjs";
import { authenticate, headerOf, sha256, HEX64 } from "./lib/sentinel-approvals.cjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

// R11 / content-blind: short, path-free strings only.
function field(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi, "<private-folder>")
    .replace(/[A-Za-z]:\\[^\s"'()<>]+/g, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt|private)\/[^\s"'()]+/gi, "[path]")
    .trim().slice(0, max) || null;
}

export async function handler(event) {
  const method = String(event.httpMethod || "POST").toUpperCase();
  if (method === "OPTIONS") return { statusCode: 204, headers: { "cache-control": "no-store" }, body: "" };
  if (method !== "POST") return json(405, { error: "method-not-allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "bad-json" });

  // Credential: the header (preferred) or the legacy raw key in the body, hashed on arrival and never stored.
  let credential = String(headerOf(event, "x-sentinel-key") || "").trim().toLowerCase();
  if (!credential) {
    const rawKey = String(body.license_key || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(rawKey)) return json(400, { error: "invalid-license-key" });
    credential = sha256(rawKey);
  }
  if (!HEX64.test(credential)) return json(400, { error: "invalid-license-key" });
  const ev = { ...event, headers: { ...(event.headers || {}), "x-sentinel-key": credential } };
  const auth = await authenticate(ev);
  if (!auth.ok) return json(auth.status || 401, { ok: false, error: auth.error === "license-revoked" ? "license-revoked" : "invalid-license-key" });
  if (auth.kind !== "device") return json(401, { ok: false, error: "invalid-license-key" });

  const licenses = await openStore(STORES.DEVICES, ev);
  if (!licenses) return unavailable();
  const existing = (await getJson(licenses, credential)) || null;
  const plan = auth.plan || field(body.plan, 24);
  const updated = registerDevice(existing, {
    license_key: "",
    email: field(body.email, 254), first_name: field(body.first_name, 60), last_name: field(body.last_name, 60), company: field(body.company, 120), plan,
    device_id: field(body.device_id, 64) || "unknown", os: field(body.os, 64), version: field(body.version, 32), last_seen: field(body.last_seen, 40) || new Date().toISOString()
  });
  if (!updated.license_key) delete updated.license_key;
  updated.key_hash = credential;
  updated.plan = updated.plan || plan;
  updated.updated_at = new Date().toISOString();

  // P1-2: the declared email is a PENDING contact unless the license already vouches for it (the Stripe buyer
  // email, an admin-approved contact, the admin inbox). Pending addresses are never mailed.
  const offered = String(field(body.email, 254) || "").toLowerCase();
  let contactStatus = "none";
  if (offered && EMAIL_RE.test(offered)) {
    const allowed = isAllowedRecipient(offered, { keyRecord: auth.record, sharedKey: auth.sharedKey });
    if (allowed.ok) contactStatus = "approved";
    else {
      contactStatus = "pending-admin-approval";
      const pending = Array.isArray(updated.pending_contacts) ? updated.pending_contacts.filter((p) => p && p.email) : [];
      if (!pending.some((p) => p.email === offered) && pending.length < MAX_CONTACTS) pending.push({ email: offered, first_seen_at: updated.updated_at });
      updated.pending_contacts = pending;
    }
  }
  if (!(await putJson(licenses, credential, updated))) return unavailable();

  const seats = auth.record && auth.record.seats != null ? Number(auth.record.seats) : null;
  const devices = Array.isArray(updated.devices) ? updated.devices.length : 0;
  return json(200, {
    ok: true, devices, seats, overSeats: seats != null && devices > seats, plan: updated.plan || null,
    contact: { status: contactStatus, note: contactStatus === "pending-admin-approval" ? "This address will receive notifications and session reports only after Integrated IT Support approves it." : null }
  });
}

export const config = { path: "/.netlify/functions/aria-sentinel-license-register" };
