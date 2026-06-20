// Netlify function: admin-only version publish / disable / rollout + ALL-machines rollback pin.
// POST with X-Admin-Token (matched against SENTINEL_ADMIN_TOKEN env). PROJECT-LOCAL until shipped.
import { getStore } from "@netlify/blobs";
import { requireAdminToken } from "../../src/shared/admin-auth.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export async function handler(event) {
  const auth = requireAdminToken(event.headers || {}, process.env);
  if (!auth.ok) return json(auth.status, { error: auth.reason });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }

  const versionsStore = getStore("versions");
  const index = (await versionsStore.get("index", { type: "json" })) || [];

  if (body.action === "disable" && body.version) {
    const next = index.map((v) => (v.version === body.version ? { ...v, disabled: Boolean(body.disabled ?? true) } : v));
    await versionsStore.setJSON("index", next);
    return json(200, { ok: true, version: body.version, disabled: Boolean(body.disabled ?? true) });
  }
  if (body.action === "rollout" && body.percent != null) {
    await versionsStore.setJSON("rollout", { percent: Number(body.percent) });
    return json(200, { ok: true, rollout: Number(body.percent) });
  }
  // Default: publish a new version record.
  if (!body.version || !body.sha512) return json(400, { error: "version-and-sha512-required" });
  const record = {
    version: body.version, sha512: body.sha512, size: Number(body.size) || 0,
    release_date: body.release_date || new Date().toISOString(), release_notes: body.release_notes || "", disabled: false
  };
  const next = [record, ...index.filter((v) => v.version !== body.version)];
  await versionsStore.setJSON("index", next);
  return json(200, { ok: true, published: record.version, count: next.length });
}

export const config = { path: "/.netlify/functions/aria-sentinel-update-publish" };
