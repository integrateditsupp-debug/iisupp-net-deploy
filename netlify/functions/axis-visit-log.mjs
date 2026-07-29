// axis-visit-log.mjs — RUN-AC AC2: the site writes its own hit log. Free, self-hosted, identity-free.
//
// WHY: RUN-AB found that no passive signal in this program is measurable, and named this exact thing as
// the free unblock for `site-visits`: "a hit log written by the site itself into a file this repo can
// read. No account, no purchase, no third party." This is that writer. It uses Netlify Blobs, which is
// already in use by _heartbeat.mjs — no new dependency, no new vendor, no new cost.
//
// WHAT IT RECORDS, EXHAUSTIVELY (vault Rule 11):
//   - the UTC day
//   - one allowlisted path bucket
//   - a count
// That is the entire record. It does NOT record — and must never be extended to record — an address, a
// user agent, a referrer, a cookie, a session, a visitor identity, or a geography. `visit-log.mjs`
// REJECTS THE WHOLE RECORD if any identity-shaped key appears in it, so a future edit that starts
// collecting identity fails loudly at the reader instead of quietly succeeding.
//
// HONESTY (Rule 14): `startedAt` is stamped once, on the first ever write, and never rewritten. It is
// what lets the reader say "0 visits since <date>" truthfully instead of implying nobody ever came.
//
// This endpoint records nothing until the site carrying it is published. Publishing is Ahmad's
// deliberate click and is not performed here.
import { getStore } from "@netlify/blobs";

const STORE = "axis-visit-log";
const KEY = "visit-log";

const BUCKETS = ["/", "/aria", "/aperture", "/services", "/contact", "other"];

/** Map an arbitrary path onto an allowlisted bucket. Anything unknown collapses to "other". */
export function bucketFor(pathname) {
  if (typeof pathname !== "string" || !pathname) return "other";
  const p = pathname.toLowerCase().split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/index.html") return "/";
  if (p.startsWith("/aria")) return "/aria";
  if (p.startsWith("/aperture")) return "/aperture";
  if (p.startsWith("/services")) return "/services";
  if (p.startsWith("/contact")) return "/contact";
  return "other";
}

/** Our own tooling is not a visitor. Counted separately, never in the headline. */
export function isSelfTraffic(headers) {
  const get = (k) => (headers && typeof headers.get === "function" ? headers.get(k) : headers?.[k]) || "";
  const marker = String(get("x-axis-self") || "").toLowerCase();
  if (marker === "1" || marker === "true") return true;
  // A user agent is read for this one boolean decision and is NEVER stored.
  const ua = String(get("user-agent") || "").toLowerCase();
  return /netlify|uptime|monitor|pingdom|statuscake|headless|curl|wget|bot|crawler|spider/.test(ua);
}

/** Pure: fold one hit into a visit-log.v1 record. Exported so the test can exercise it without Blobs. */
export function applyHit(record, { day, bucket, self, now }) {
  const base = record && typeof record === "object" ? record : {};
  const startedAt = typeof base.startedAt === "string" && base.startedAt ? base.startedAt : now;
  const days = Array.isArray(base.days) ? base.days.map((d) => ({ ...d, buckets: { ...(d.buckets || {}) } })) : [];

  let entry = days.find((d) => d.day === day);
  if (!entry) { entry = { day, buckets: {}, self: 0 }; days.push(entry); }

  if (self) entry.self = (entry.self || 0) + 1;
  else entry.buckets[bucket] = (entry.buckets[bucket] || 0) + 1;

  days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  return {
    schema: "visit-log.v1",
    startedAt,               // stamped once, never rewritten
    updatedAt: now,
    rule11: "UTC day, allowlisted path bucket, count. No address, agent, referrer, cookie, session or identity of any kind is stored.",
    buckets: BUCKETS,
    days,
  };
}

export default async function handler(request) {
  try {
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const url = new URL(request.url);
    const bucket = bucketFor(url.searchParams.get("p") || "/");
    const self = isSelfTraffic(request.headers);

    const store = getStore({ name: STORE });
    const current = await store.get(KEY, { type: "json" }).catch(() => null);
    await store.setJSON(KEY, applyHit(current, { day, bucket, self, now }));

    // 204: nothing is returned to the caller. This endpoint is write-only by design — it must never
    // become a public counter someone could scrape or screenshot as a marketing number.
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  } catch {
    // A failed hit is silently dropped. A visit log must never be able to break a page load, and a
    // dropped hit is honest undercounting, which is the safe direction of error.
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
}

export const config = { path: "/api/axis-visit" };
