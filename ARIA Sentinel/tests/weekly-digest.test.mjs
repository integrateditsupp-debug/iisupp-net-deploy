// RUN 6 — weekly digest. Asserts aggregation math, HTML render, and no PII.
import assert from "node:assert/strict";
import { aggregateWeek, renderDigestHtml } from "../src/shared/weekly-digest.mjs";
import { buildTelemetryEvent } from "../src/shared/telemetry-event.mjs";

const ev = (over) => buildTelemetryEvent({ recipeId: "dns-fail-v1", outcome: "applied", endpoint: "m1", durationMs: 100, tier: "green", ts: Date.parse("2026-06-18T10:00:00Z"), ...over });

const events = [
  ev({ recipeId: "dns-fail-v1", endpoint: "m1" }),
  ev({ recipeId: "dns-fail-v1", endpoint: "m2" }),
  ev({ recipeId: "printer-spooler-v1", endpoint: "m1" }),
  ev({ recipeId: "teams-cache-v1", outcome: "confirmed", tier: "yellow", endpoint: "m3" }),
  ev({ recipeId: "bsod-x", outcome: "escalated", endpoint: "m1" }),
  ev({ recipeId: "audio-no-output-v1", outcome: "detected", endpoint: "m1" }) // detected-only: not a "fix"
];

const agg = aggregateWeek(events);
assert.equal(agg.fixes, 4, "applied + confirmed count as fixes; detected/escalated do not");
assert.equal(agg.escalations, 1);
assert.equal(agg.endpoints, 3, "distinct endpoints helped");
// uptime: 3 green (12m) + 1 yellow (25m) = 61m
assert.equal(agg.uptimeMinutes, 3 * 12 + 25, "minutes-saved math");
assert.equal(agg.top3[0].recipeId, "dns-fail-v1", "most frequent fix ranks first");
assert.equal(agg.top3[0].count, 2);
assert.ok(agg.top3.length <= 3);

// Render: valid HTML, shows the numbers, content-blind note.
const html = renderDigestHtml(agg, { tenant: "acme", weekOf: "2026-06-15" });
assert.match(html, /^<!doctype html>/i);
assert.match(html, /this week/i);
assert.match(html, />4</, "shows fix count");
assert.match(html, /~1\.0 hrs/, "shows hours saved (61 min ≈ 1.0 hr)");
assert.match(html, /Content-blind/i, "states no content included");

// No PII: even if a raw event tried to carry content, only telemetry fields are rendered.
assert.ok(!/@/.test(html.replace(/[a-z]+@2x/g, "")), "no emails in the digest");

// Empty week renders without throwing.
const empty = renderDigestHtml(aggregateWeek([]), {});
assert.match(empty, />0</);

console.log("Weekly-digest test passed (aggregation math · HTML render · content-blind · empty-safe).");
