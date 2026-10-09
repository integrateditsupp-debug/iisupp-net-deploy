// RUN-CU / CU4 (2026-10-08) — the ONE fetch wrapper for the main process.
//
// Why: the privacy verifier (runPrivacyCapture) hooks session.webRequest, which sees CHROMIUM requests
// only. Every main-process call (heartbeat, notify, approval poll, license resolve, update check…) used Node
// fetch and was invisible to the verifier — the audit's P1 #7. Routing those calls through here records
// {host, path, method, bytes, ts, status} into a ring the verifier merges, and refuses a host that is not on
// the declared allowlist BEFORE a byte leaves the machine. Pure + injectable (fetchImpl / now / record) so
// tests/outbound-declared.test.mjs proves it without a network.
//
// The record is content-blind: URL (which is a declared service path — never user content), method, byte
// count. Request bodies are NEVER stored here; the verifier's leak check runs on the live body separately.
import { hostAllowed, isServicePathAllowed } from "../shared/network-capture.mjs";
import { NOTIFY_HOST_ALLOWLIST } from "../shared/notify.mjs";
import { assertContentSafePayload } from "../shared/safety.mjs";
import { mustBeTelemetrySafe } from "../shared/notify-channels.mjs";

// Both locks: the RUN 3 leak patterns AND the CU4 catalog-shape guard (which also sees JSON-doubled backslashes).
function contentBlind(value) {
  try { return assertContentSafePayload(value) && mustBeTelemetrySafe(value).ok; } catch { return false; }
}

export const RING_MAX = 50;

function webhookHostAllowed(host) {
  const h = String(host || "").toLowerCase();
  return NOTIFY_HOST_ALLOWLIST.some((a) => (a.startsWith(".") ? h.endsWith(a) : h === a));
}
const GRAPH_HOSTS = ["graph.microsoft.com", "login.microsoftonline.com"];

/** Is this URL one the main process may ever reach? 6-host telemetry allowlist ∪ Slack/Teams webhook hosts ∪ Graph. */
export function isOutboundAllowed(url) {
  let u;
  try { u = new URL(String(url)); } catch { return { ok: false, reason: "bad-url" }; }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost"))) return { ok: false, reason: "not-https" };
  const host = u.hostname.toLowerCase();
  if (hostAllowed(host)) return { ok: true, reason: "allowlist", host, path: u.pathname };
  if (webhookHostAllowed(host)) return { ok: true, reason: "webhook", host, path: u.pathname };
  if (GRAPH_HOSTS.includes(host)) return { ok: true, reason: "graph", host, path: u.pathname };
  return { ok: false, reason: "host-not-allowed", host, path: u.pathname };
}

function safeParse(text) { try { return JSON.parse(text); } catch { return null; } }

// The ONLY keys treated as configured identity (never content): top-level `email`, `to`, `phone`, a `user.email`,
// and each `recipients[].email|phone`. Everything else stays in the leak check untouched.
const IDENTITY_KEYS = new Set(["email", "to", "phone"]);
export function stripIdentityFields(value) {
  let count = 0;
  const clone = JSON.parse(JSON.stringify(value));
  const scrubObj = (o) => { for (const k of Object.keys(o)) { if (IDENTITY_KEYS.has(k) && typeof o[k] === "string" && o[k]) { o[k] = "[identity]"; count++; } } };
  if (clone && typeof clone === "object" && !Array.isArray(clone)) {
    scrubObj(clone);
    if (clone.user && typeof clone.user === "object") scrubObj(clone.user);
    if (Array.isArray(clone.recipients)) for (const r of clone.recipients) if (r && typeof r === "object") scrubObj(r);
  }
  return { value: clone, count };
}

function bodyBytes(body) {
  if (body == null) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) return body.length;
  try { return Buffer.byteLength(String(body), "utf8"); } catch { return 0; }
}

/**
 * createOutbound({ fetchImpl, now, onRecord, ring }) → { fetch, ring, records(), clear() }
 *   fetch(url, init) — same signature as global fetch. Refuses an off-allowlist host (throws
 *   Error("outbound-host-not-allowed")) WITHOUT calling fetchImpl; records every attempt either way.
 */
export function createOutbound(opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const ring = Array.isArray(opts.ring) ? opts.ring : [];
  const max = Number(opts.ringMax) || RING_MAX;
  const push = (row) => {
    ring.push(row);
    while (ring.length > max) ring.shift();
    if (typeof opts.onRecord === "function") { try { opts.onRecord(row); } catch { /* never let a listener break a call */ } }
  };

  async function wrappedFetch(url, init = {}) {
    const method = String((init && init.method) || "GET").toUpperCase();
    const verdict = isOutboundAllowed(url);
    const body = init && init.body;
    const bytes = bodyBytes(body);
    // Content-blind verdict computed at send time on the LIVE body; the body itself is never kept.
    // null = no body; true/false = passed/failed the leak patterns (emails, URLs, paths, card/SSN/SIN shapes).
    // Account / recipient ADDRESS fields the person configured (license email, notify recipients) are counted
    // separately as `identityFields` — they are configuration, not page/document content — and the verifier
    // row says so in plain words rather than hiding them or mislabelling them as a leak.
    let bodySafe = null, identityFields = 0;
    if (bytes > 0) {
      try {
        const parsed = typeof body === "string" ? safeParse(body) : null;
        if (parsed && typeof parsed === "object") {
          const stripped = stripIdentityFields(parsed);
          identityFields = stripped.count;
          bodySafe = contentBlind(stripped.value);
        } else bodySafe = contentBlind(String(body));
      } catch { bodySafe = false; }
    }
    const row = {
      ts: new Date(now()).toISOString(),
      url: verdict.ok ? `https://${verdict.host}${verdict.path}` : String(url).slice(0, 200),
      host: verdict.host || "",
      path: verdict.path || "",
      method,
      bytes,
      bodySafe,
      identityFields,
      declared: Boolean(verdict.ok && (verdict.reason !== "allowlist" || isServicePathAllowed(verdict.path) || !/^\/\.netlify\/functions\//.test(verdict.path || ""))),
      allowed: verdict.ok,
      status: null,
      ok: false,
      error: verdict.ok ? null : verdict.reason
    };
    if (!verdict.ok) { push(row); throw new Error("outbound-host-not-allowed"); }
    if (!fetchImpl) { row.error = "no-fetch"; push(row); throw new Error("outbound-no-fetch"); }
    try {
      const res = await fetchImpl(url, init);
      row.status = res && typeof res.status === "number" ? res.status : null;
      row.ok = Boolean(res && res.ok);
      push(row);
      return res;
    } catch (err) {
      row.error = String((err && err.message) || err).slice(0, 80);
      push(row);
      throw err;
    }
  }

  return {
    fetch: wrappedFetch,
    ring,
    records: () => ring.slice(),
    /** Rows recorded since `sinceMs` — what the privacy verifier merges for its capture window. */
    since: (sinceMs) => ring.filter((r) => Date.parse(r.ts) >= Number(sinceMs || 0)),
    clear: () => { ring.length = 0; }
  };
}
