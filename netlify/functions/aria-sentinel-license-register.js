// Netlify function: device check-in / license registration. POST every 4h from the app.
// Idempotent device upsert into Netlify Blobs. PROJECT-LOCAL until shipped. No admin token (the
// device authenticates by its own license key); content-blind (name/company are user-supplied).
import { getStore } from "@netlify/blobs";
import { registerDevice } from "../../src/shared/license-registry.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export async function handler(event) {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  const key = String(body.license_key || "");
  if (!/^[a-f0-9]{64}$/i.test(key)) return json(400, { error: "invalid-license-key" });

  const licenses = getStore("licenses");
  const existing = (await licenses.get(key, { type: "json" })) || null;
  const updated = registerDevice(existing, {
    license_key: key,
    email: body.email, first_name: body.first_name, last_name: body.last_name, company: body.company, plan: body.plan,
    device_id: body.device_id, os: body.os, version: body.version, last_seen: body.last_seen || new Date().toISOString()
  });
  await licenses.setJSON(key, updated);
  return json(200, { ok: true, devices: updated.devices.length });
}

export const config = { path: "/.netlify/functions/aria-sentinel-license-register" };
