// network-capture — the privacy verifier's analysis core. PURE + testable: it classifies captured
// outbound requests and summarizes whether the binary stayed inside its declared boundary. The main
// process feeds it real session.webRequest details; the test feeds it synthetic ones.
//
// Two enterprise-buyer questions it answers in-product:
//   1. Did every request go to an allow-listed host?  (allowlistMatch)
//   2. Did every request body stay content-blind?     (sanitizationStatus via assertContentSafePayload)
import { ALLOWED_OUTBOUND_PATHS } from "./recipes.mjs";
import { assertContentSafePayload } from "./safety.mjs";

// The 6-host allowlist the binary may ever reach. Loopback covers the local bridge; iisupp.net (and
// its download subdomain) cover the pull/feedback paths; *.service-now.com is the customer ITSM lane.
export const CAPTURE_HOST_ALLOWLIST = [
  "iisupp.net",
  "download.iisupp.net",
  "127.0.0.1",
  "localhost",
  "::1",
  "*.service-now.com"
];

// The three outbound paths a normal live capture exercises — the GET pulls. These are the rows the
// Privacy verifier shows with a cyan tick. (recipe-feedback is opt-in POST; servicenow is customer-only.)
export const EXPECTED_OUTBOUND_PATHS = ALLOWED_OUTBOUND_PATHS
  .filter((p) => p.direction === "inbound-data")
  .map((p) => ({ id: p.id, method: p.method, host: p.host, path: p.path }));

// RUN 14 — the ONLY two iisupp.net paths the auto-updater may reach (manifest + binary prefix).
// This is an ADDITIVE path allowlist for the update class; the 6-host telemetry verifier
// (CAPTURE_HOST_ALLOWLIST / classifyRequest) is unchanged.
export const UPDATE_OUTBOUND_PATHS = [
  "/.netlify/functions/aria-sentinel-update-manifest",
  "/sentinel-binaries/" // prefix match (the .exe lives under here)
];

// True only for an explicitly-allowed update path — every other iisupp.net path returns false.
export function isUpdatePathAllowed(pathname) {
  const p = String(pathname || "");
  return UPDATE_OUTBOUND_PATHS.some((a) => (a.endsWith("/") ? p.startsWith(a) : p === a));
}

// RUN 15 / RUN 31 — the iisupp.net paths the live ARIA-brain client may reach: KB-first retrieval (aria-kb-query,
// $0, tried first), then chat + research. Additive, like the update channel; the 6-host telemetry verifier is
// unchanged. Growing this list requires an explicit test (see aria-brain-client.test.mjs).
export const BRAIN_OUTBOUND_PATHS = [
  "/.netlify/functions/aria-kb-query",
  "/.netlify/functions/aria-chat",
  "/.netlify/functions/aria-research",
  // RUN 33 — ARIA tab data surfaces (read-only status/stats, no chat content sent):
  "/.netlify/functions/aria-kb-stats",
  "/.netlify/functions/aria-system-status"
];

// True only for an explicitly-allowed brain path — every other iisupp.net path returns false.
export function isBrainPathAllowed(pathname) {
  const p = String(pathname || "");
  return BRAIN_OUTBOUND_PATHS.some((a) => p === a);
}

// RUN 24 — the ONLY iisupp.net path the license revocation check may reach. Additive, like the update +
// brain classes; the 6-host telemetry verifier (CAPTURE_HOST_ALLOWLIST) is UNCHANGED. The request is
// content-blind: it carries only sha256(key) as a query param (?action=is-revoked&key-hash=…), never the
// raw key, never PII. 🔒 R11 — no filesystem path ever leaves the device.
export const LICENSE_OUTBOUND_PATHS = [
  "/.netlify/functions/sentinel-licenses"
];

// True only for the explicitly-allowed license path — every other iisupp.net path returns false.
export function isLicensePathAllowed(pathname) {
  const p = String(pathname || "");
  return LICENSE_OUTBOUND_PATHS.some((a) => p === a);
}

// 2026-06-26 — the ONLY iisupp.net path the end-of-session report may reach. Additive, like the update /
// brain / license classes; the 6-host telemetry verifier (CAPTURE_HOST_ALLOWLIST) is UNCHANGED. The POST is
// content-SAFE (scrubbed transcript + REAL metrics + the user's OWN contact for delivery) and fires ONLY at
// session end, never mid-session. 🔒 R11 — the private folder + absolute paths are stripped before send.
// Growing this list requires an explicit test (see profile-session.test.mjs).
export const SESSION_OUTBOUND_PATHS = [
  "/.netlify/functions/sentinel-session-report"
];

// True only for the explicitly-allowed session-report path — every other iisupp.net path returns false.
export function isSessionPathAllowed(pathname) {
  const p = String(pathname || "");
  return SESSION_OUTBOUND_PATHS.some((a) => p === a);
}

export function hostAllowed(host) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "");
  if (!h) return false;
  return CAPTURE_HOST_ALLOWLIST.some((allowed) => {
    if (allowed.startsWith("*.")) return h === allowed.slice(2) || h.endsWith(allowed.slice(1));
    if (allowed === "iisupp.net") return h === "iisupp.net" || h.endsWith(".iisupp.net");
    return h === allowed;
  });
}

function bodyToBytes(body) {
  if (body == null) return 0;
  if (typeof body === "number") return Math.max(0, body);
  if (Buffer.isBuffer?.(body)) return body.length;
  return Buffer.byteLength(String(body), "utf8");
}

/**
 * Classify a single captured request into one privacy-verifier row.
 * @param {object} req { url, method, body? }  body is the raw request payload (string/Buffer), if any
 * @returns {{host,path,method,payloadBytes,sanitizationStatus,allowlistMatch,allowlistId}}
 */
export function classifyRequest(req = {}) {
  let host = "";
  let path = "";
  try {
    const u = new URL(String(req.url));
    host = u.hostname;
    path = u.pathname || "/";
  } catch {
    host = "";
    path = String(req.url || "");
  }
  const method = String(req.method || "GET").toUpperCase();
  const payloadBytes = bodyToBytes(req.body);
  // A request with no body is content-blind by definition; one with a body must pass the leak check.
  let sanitizationStatus = "none";
  if (payloadBytes > 0) {
    let safe = false;
    try { safe = assertContentSafePayload(req.body); } catch { safe = false; }
    sanitizationStatus = safe ? "clean" : "leak";
  }
  const allowlistMatch = hostAllowed(host);
  const matched = ALLOWED_OUTBOUND_PATHS.find((p) => p.host === host && p.path === path);
  return {
    host,
    path,
    method,
    payloadBytes,
    sanitizationStatus,
    allowlistMatch,
    allowlistId: matched ? matched.id : null
  };
}

/**
 * Summarize a set of captured requests into the verifier verdict.
 * @param {Array} requests raw request objects (see classifyRequest)
 */
export function summarizeCapture(requests = []) {
  const rows = requests.map(classifyRequest);
  const disallowedHosts = rows.filter((r) => !r.allowlistMatch);
  const leakingPayloads = rows.filter((r) => r.sanitizationStatus === "leak");
  // "User content" = any request body that failed the content-blind check.
  const userContentRequests = leakingPayloads.length;
  return {
    rows,
    total: rows.length,
    disallowedHostCount: disallowedHosts.length,
    leakingPayloadCount: leakingPayloads.length,
    userContentRequests,
    allHostsAllowed: disallowedHosts.length === 0,
    allContentBlind: leakingPayloads.length === 0,
    pass: disallowedHosts.length === 0 && leakingPayloads.length === 0
  };
}
