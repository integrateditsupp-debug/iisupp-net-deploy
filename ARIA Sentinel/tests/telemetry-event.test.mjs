// RUN 5 — telemetry-event-v1 contract. The one content-blind event shape the badge, Slack notify,
// weekly digest, fleet view and API all consume. Asserts: ISO timestamps (never epoch-ms), opaque
// stable endpoint handles (no machine name), symbolic-only fields, and the leak guard.
import assert from "node:assert/strict";
import {
  TELEMETRY_EVENT_VERSION,
  OUTCOMES,
  buildTelemetryEvent,
  endpointHandle,
  isoTimestamp,
  isTelemetrySafe
} from "../src/shared/telemetry-event.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");

// 1) Shape + version.
const ev = buildTelemetryEvent({ recipeId: "dns-fail-v1", signal: "NET.DNS.FAIL", outcome: "applied", endpoint: "LAPTOP-7F3K2MJ", durationMs: 1200, tier: "green", ts: NOW });
assert.equal(ev.v, TELEMETRY_EVENT_VERSION);
assert.equal(ev.recipeId, "dns-fail-v1");
assert.equal(ev.outcome, "applied");
assert.equal(ev.durationMs, 1200);
assert.equal(ev.tier, "green");

// 2) Timestamps are ALWAYS ISO-8601, never epoch-ms (the RUN 3 finding, fixed at the source).
assert.equal(ev.ts, "2026-06-19T12:00:00.000Z");
assert.ok(!/^\d{10,}$/.test(ev.ts), "ts is not a bare epoch number");
assert.equal(isoTimestamp(NOW), "2026-06-19T12:00:00.000Z");
assert.equal(isoTimestamp(new Date(NOW)), "2026-06-19T12:00:00.000Z");
assert.equal(isoTimestamp("2026-06-19T12:00:00.000Z"), "2026-06-19T12:00:00.000Z");

// 3) Endpoint handle: opaque, stable, and NOT the machine name.
const h1 = endpointHandle("LAPTOP-7F3K2MJ");
const h2 = endpointHandle("LAPTOP-7F3K2MJ");
assert.equal(h1, h2, "same input → same handle (groupable)");
assert.ok(/^ep-[a-z0-9]{1,7}$/.test(h1), "handle is a short opaque token");
assert.ok(!h1.includes("LAPTOP"), "handle does not contain the machine name");
assert.notEqual(endpointHandle("DESKTOP-19A8GH"), h1, "different machines → different handles");

// 4) Non-symbolic / unknown fields are dropped, not echoed.
const dirty = buildTelemetryEvent({ recipeId: "rm -rf / ; cat /etc/passwd", outcome: "totally-made-up", endpoint: "x" });
assert.equal(dirty.recipeId, "", "non-token recipeId dropped");
assert.equal(dirty.outcome, "detected", "unknown outcome falls back to a safe default");
assert.ok(OUTCOMES.includes(dirty.outcome));

// 5) The leak guard accepts a clean event and rejects content / epoch-ms.
assert.equal(isTelemetrySafe(ev), true, "clean event is safe");
assert.equal(isTelemetrySafe({ ...ev, ts: "1718800000000" }), false, "epoch-ms ts rejected");
assert.equal(isTelemetrySafe({ ...ev, note: "email jdoe@contoso.com" }), false, "embedded user content rejected");
assert.equal(isTelemetrySafe({ v: "wrong" }), false, "wrong version rejected");

console.log("Telemetry-event test passed (ISO ts only · opaque stable handles · symbolic-only · leak guard).");
