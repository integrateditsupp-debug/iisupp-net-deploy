// RUN 29-D — $0 crash sink. Receives a content-blind crash record from the Sentinel desktop and appends it to
// the Netlify Blobs "sentinel-crashes" store. Defense-in-depth: re-scrubs the R11 folder + any absolute path
// server-side before persisting, and ONLY ever stores the symbolic fields (ts/name/message/stack/version/
// platform) — never file contents. No auth (volume is tiny + content is non-sensitive); bounded record size.
import { getStore } from "@netlify/blobs";

const PRIVATE_FOLDER_RE = /([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi;
function scrub(text) {
  return String(text == null ? "" : text)
    .replace(PRIVATE_FOLDER_RE, "<private-folder>")
    .replace(/file:\/\/\/?[^\s"')]+/gi, "[path]")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp|opt|private)\/[^\s"'()]+/gi, "[path]");
}

export const handler = async (event) => {
  if ((event.httpMethod || "POST").toUpperCase() !== "POST") return json(405, { error: "method not allowed" });
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(400, { error: "bad json" }); }

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

  try {
    const store = getStore("sentinel-crashes");
    const key = `${rec.ts}-${Math.abs(hash(rec.message + rec.stack)).toString(36)}`;
    await store.setJSON(key, rec);
    return json(200, { stored: true });
  } catch (e) {
    console.error("[sentinel-crash] store error:", e.message);
    return json(500, { error: "store error" });
  }
};

function hash(s) { let h = 0; const str = String(s || ""); for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; } return h; }
function json(statusCode, obj) { return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) }; }
