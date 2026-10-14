// Netlify function: admin-only version publish / disable / rollout + ALL-machines rollback pin.
// POST with X-Admin-Token (SENTINEL_ADMIN_TOKEN or ARIA_ADMIN_TOKEN — the app's src/shared/admin-auth.mjs).
//
// SENTINEL-BACKEND 2026-10-14 (audit B1 / B13 / B20):
//   - parity with the app's copy (ARIA Sentinel/netlify/functions/aria-sentinel-update-publish.js): a published
//     record keeps `url`, `mandatory` and `path`, and an `update-events` log row is written best-effort. The
//     root copy had dropped `url`/`mandatory`, so the manifest could only ever point at
//     iisupp.net/sentinel-binaries/<file> (the HELD path) and never flag a mandatory update.
//   - `url` must be https on a host the desktop may reach (its allow-list: iisupp.net, download.iisupp.net;
//     extend with SENTINEL_UPDATE_HOSTS="host1,host2"). A URL the desktop cannot fetch is a broken publish,
//     so it is refused (400 url-host-not-allowed) instead of being served (Rule 14).
//   - Blobs through lib/sentinel-store.cjs (connectLambda before getStore); unreachable store → 503 JSON.
import { requireAdminToken } from "../../src/shared/admin-auth.mjs";
import { openStore, unavailable, getJson, putJson } from "./lib/sentinel-store.cjs";
import { STORES } from "./lib/sentinel-license-records.cjs";

const DEFAULT_UPDATE_HOSTS = ["iisupp.net", "download.iisupp.net"];
const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

/** Hosts a published binary URL may use: the desktop's allow-list, plus SENTINEL_UPDATE_HOSTS (comma list). */
export function allowedUpdateHosts(env = process.env) {
  const extra = String(env.SENTINEL_UPDATE_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...DEFAULT_UPDATE_HOSTS, ...extra])];
}

/** { ok, url } for a candidate binary URL (https + allowed host) — or { ok:false, reason }. */
export function validateUpdateUrl(raw, env = process.env) {
  if (raw == null || raw === "") return { ok: true, url: null };
  let u;
  try { u = new URL(String(raw)); } catch { return { ok: false, reason: "url-malformed" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "url-not-https" };
  if (!allowedUpdateHosts(env).includes(u.hostname.toLowerCase())) return { ok: false, reason: "url-host-not-allowed" };
  if (u.username || u.password) return { ok: false, reason: "url-has-credentials" };
  return { ok: true, url: u.toString() };
}

export async function handler(event) {
  const auth = requireAdminToken(event.headers || {}, process.env);
  if (!auth.ok) return json(auth.status, { error: auth.reason });
  if (String(event.httpMethod || "POST").toUpperCase() !== "POST") return json(405, { error: "method-not-allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "bad-json" });

  const versionsStore = await openStore(STORES.VERSIONS, event);
  if (!versionsStore) return unavailable();
  const index = (await getJson(versionsStore, "index")) || [];
  const list = Array.isArray(index) ? index : [];

  if (body.action === "disable" && body.version) {
    const disabled = Boolean(body.disabled ?? true);
    const next = list.map((v) => (v.version === body.version ? { ...v, disabled } : v));
    if (!(await putJson(versionsStore, "index", next))) return unavailable();
    await logUpdateEvent(event, { action: "disable", version: String(body.version), disabled, via: auth.via || null });
    return json(200, { ok: true, version: body.version, disabled });
  }
  if (body.action === "rollout" && body.percent != null) {
    const percent = Math.max(0, Math.min(100, Number(body.percent) || 0));
    if (!(await putJson(versionsStore, "rollout", { percent, at: new Date().toISOString() }))) return unavailable();
    await logUpdateEvent(event, { action: "rollout", percent });
    return json(200, { ok: true, rollout: percent });
  }
  // Default: publish a new version record.
  if (!body.version || !body.sha512) return json(400, { error: "version-and-sha512-required" });
  const version = String(body.version).trim();
  if (!VERSION_RE.test(version)) return json(400, { error: "version-malformed" });
  if (!/^[A-Za-z0-9+/=]{64,}$|^[a-f0-9]{128}$/i.test(String(body.sha512).trim())) return json(400, { error: "sha512-malformed" });
  const urlCheck = validateUpdateUrl(body.url);
  if (!urlCheck.ok) return json(400, { error: urlCheck.reason, allowedHosts: allowedUpdateHosts() });
  const record = {
    version,
    sha512: String(body.sha512).trim(),
    size: Number(body.size) || 0,
    release_date: body.release_date || new Date().toISOString(),
    release_notes: String(body.release_notes || "").slice(0, 4000),
    path: body.path ? String(body.path).replace(/[^\w.\-]/g, "").slice(0, 120) || undefined : undefined,
    url: urlCheck.url || undefined,
    mandatory: body.mandatory === true,
    disabled: false,
    published_at: new Date().toISOString()
  };
  const next = [record, ...list.filter((v) => v.version !== version)];
  if (!(await putJson(versionsStore, "index", next))) return unavailable();
  await logUpdateEvent(event, { action: "publish", version, mandatory: record.mandatory, url: record.url || null });
  return json(200, { ok: true, published: record.version, count: next.length, url: record.url || null, mandatory: record.mandatory });
}

/** Best-effort audit row (never fails the publish). */
async function logUpdateEvent(event, data) {
  try {
    const store = await openStore(STORES.UPDATE_EVENTS, event);
    if (!store) return false;
    const at = new Date().toISOString();
    return await putJson(store, `${at.slice(0, 10)}/${Date.now()}-${(data && data.action) || "event"}`, { ...data, at });
  } catch { return false; }
}

export const config = { path: "/.netlify/functions/aria-sentinel-update-publish" };
