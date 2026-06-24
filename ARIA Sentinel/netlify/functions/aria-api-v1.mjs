// Netlify function: ARIA Sentinel v1 API — read-only events + webhook subscribe. Bearer-token auth
// from the license key. All payloads are content-blind telemetry-event-v1. Project-local until wired.
import { authorize, checkRateLimit, buildEventsResponse, bearerToken } from "../../src/shared/api-v1.mjs";

// Production: look the license up by key (stateless verify). Stubbed safe default here.
function lookupLicenseByKey(/* token */) { return null; }
const rateState = new Map();

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export async function handler(event) {
  const headers = event.headers || {};
  const secret = process.env.LICENSE_SECRET || "";
  const license = lookupLicenseByKey(bearerToken(headers));
  const auth = authorize(headers, license, { secret });
  if (!auth.ok) return json(auth.status, { error: auth.reason });

  const token = bearerToken(headers);
  const rl = checkRateLimit(rateState.get(token) || { hits: [] });
  rateState.set(token, rl.state);
  if (!rl.ok) return json(429, { error: "rate-limited", retryAfterMs: 60000 });

  const path = String(event.path || "");
  if (/\/webhooks$/.test(path) && (event.httpMethod || "GET") === "POST") {
    return json(202, { ok: true, subscribed: true, note: "Webhook registered (content-blind telemetry-event-v1 deliveries)." });
  }
  // Default: read-only events feed (production reads the content-blind rollup).
  return json(200, buildEventsResponse([]));
}

export const config = { path: "/aria-api/v1/*" };
