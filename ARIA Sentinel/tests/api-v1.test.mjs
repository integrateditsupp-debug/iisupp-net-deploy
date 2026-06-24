// RUN 10 — v1 API auth + rate-limit + payload schema. Asserts 401/403/429 paths and content-blind events.
import assert from "node:assert/strict";
import { bearerToken, authorize, checkRateLimit, buildEventsResponse, RATE_LIMIT } from "../src/shared/api-v1.mjs";
import { issueLicense } from "../src/shared/license.mjs";

const SECRET = "api-secret";
const NOW = Date.parse("2026-06-19T12:00:00.000Z");
const license = issueLicense({ email: "dev@example.com", days: 30, secret: SECRET, now: NOW });

// Bearer extraction.
assert.equal(bearerToken({ authorization: `Bearer ${license.key}` }), license.key);
assert.equal(bearerToken({}), "");

// 401 — missing / bad token.
assert.equal(authorize({}, license, { secret: SECRET, now: NOW }).status, 401);
assert.equal(authorize({ authorization: "Bearer wrong" }, license, { secret: SECRET, now: NOW }).status, 401);

// 200 — valid bearer + live license.
const ok = authorize({ authorization: `Bearer ${license.key}` }, license, { secret: SECRET, now: NOW });
assert.equal(ok.ok, true);
assert.equal(ok.status, 200);

// 403 — authentic token but the trial expired.
const exp = authorize({ authorization: `Bearer ${license.key}` }, license, { secret: SECRET, now: license.trialEnd + 1000 });
assert.equal(exp.status, 403);

// 429 — rate limit after RATE_LIMIT requests in the window.
let state = { hits: [] };
for (let i = 0; i < RATE_LIMIT; i++) {
  const r = checkRateLimit(state, NOW);
  state = r.state;
  assert.equal(r.ok, true);
}
const over = checkRateLimit(state, NOW);
assert.equal(over.status, 429, "request RATE_LIMIT+1 is rate-limited");
// Window slides — a request a minute later is allowed again.
assert.equal(checkRateLimit(state, NOW + 61_000).ok, true);

// Events payload: content-blind telemetry-event-v1 only.
const resp = buildEventsResponse([
  { recipeId: "dns-fail-v1", outcome: "applied", endpoint: "LAPTOP-7F3K2MJ", durationMs: 100, tier: "green", ts: NOW },
  { recipeId: "x", outcome: "applied", endpoint: "m2", durationMs: 1, tier: "green", note: "email jdoe@contoso.com", ts: NOW }
]);
assert.equal(resp.v, "telemetry-event-v1");
assert.ok(resp.events.every((e) => e.v === "telemetry-event-v1"));
assert.ok(!JSON.stringify(resp).includes("jdoe@contoso.com"), "no user content in API events");
assert.ok(!JSON.stringify(resp).includes("LAPTOP-7F3K2MJ"), "endpoint is an opaque handle");

console.log("API-v1 test passed (bearer auth · 401/403/429 · content-blind events).");
