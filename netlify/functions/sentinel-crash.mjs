// RUN 29-D — $0 crash sink. Receives a content-blind crash record from the Sentinel desktop and appends it to
// the Netlify Blobs "sentinel-crashes" store. Defense-in-depth: re-scrubs the R11 folder + any absolute path
// server-side before persisting, and ONLY ever stores the symbolic fields (ts/name/message/stack/version/
// platform) — never file contents. No auth (volume is tiny + content is non-sensitive); bounded record size.
//
// SENTINEL-BACKEND 2026-10-14 (audit B1/B16/B17): the store is opened through lib/sentinel-store.cjs, which
// hands the Lambda event's Blobs credentials to @netlify/blobs (connectLambda) before getStore — the previous
// bare getStore() threw MissingBlobsEnvironmentError on every call, so every crash POST answered 500 and the
// desktop's crash queue retried forever. A store that cannot be opened is now an honest 503
// { ok:false, reason:'store-unavailable' } (never a stack trace), and a per-IP rate limit (60 / 10 min)
// bounds store flooding. The `error:'store error'` field is kept for any caller that read it.
import { checkRateLimit, rateLimitResponse, hashKey } from "./_rate-limit.js";
import { openStore, unavailable } from "./lib/sentinel-store.cjs";

const STORE = "sentinel-crashes";
const PRIVATE_FOLDER_RE = /([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi;
function scrub(text) {
  return String(text == null ? "" : text)
    .replace(PRIVATE_FOLDER_RE, "<private-folder>")
    .replace(/file:\/\/\/?[^\s"')]+/gi, "[path]")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt|private)\/[^\s"'()]+/gi, "[path]");
}

function clientIp(event) {
  const h = (event && event.headers) || {};
  return h["x-nf-client-connection-ip"] || h["client-ip"] || String(h["x-forwarded-for"] || "unknown").split(",")[0].trim() || "unknown";
}

export const handler = async (event) => {
  if ((event.httpMethod || "POST").toUpperCase() !== "POST") return json(405, { error: "method not allowed" });
  const rl = checkRateLimit(event, { scope: "sentinel-crash", key: hashKey(`sentinel-crash:${clientIp(event)}`), limit: 60, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl, { "cache-control": "no-store" });
  if (Buffer.byteLength(String(event.body || ""), "utf8") > 64 * 1024) return json(413, { error: "body too large" });
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(400, { error: "bad json" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "bad json" });

  // Whitelist + re-scrub the symbolic fields only — nothing else from the payload is persisted.
  const rec = {
    ts: Number(body.ts) || Date.now(),
    name: scrub(body.name).slice(0, 120),
    message: scrub(body.message).slice(0, 500),
    stack: scrub(body.stack).slice(0, 4000),
    version: String(body.version || "").slice(0, 32),
    platform: String(body.platform || "").slice(0, 32),
    received_at: new Date().toISOString()
  };

  const store = await openStore(STORE, event);
  if (!store) return unavailable({ error: "store error" });
  try {
    const key = `${rec.ts}-${Math.abs(hash(rec.message + rec.stack)).toString(36)}`;
    await store.setJSON(key, rec);
    return json(200, { stored: true });
  } catch (e) {
    console.error("[sentinel-crash] store error:", String((e && e.message) || e).slice(0, 160));
    return unavailable({ error: "store error" });
  }
};

function hash(s) { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; } return h; }
function json(statusCode, obj) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(obj) }; }
