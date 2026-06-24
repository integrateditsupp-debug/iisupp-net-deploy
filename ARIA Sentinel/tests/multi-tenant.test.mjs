// RUN 11 — multi-tenant fleet aggregation. Asserts per-customer math, the filter, and privacy
// (handles only — no real customer names ever surface). Also covers the Whereby remote-control guard.
import assert from "node:assert/strict";
import { aggregateFleet, filterFleet, fleetTotals } from "../src/shared/fleet.mjs";
import { buildRemoteSession, isWherebyRoom, sessionActive, SESSION_MS } from "../src/shared/remote-control.mjs";

const NOW = Date.parse("2026-06-19T12:00:00.000Z");
const tenants = [
  { handle: "cust-7f3k2", name: "Contoso Secret Holdings", endpoints: [
    { health: 96, fixesWeek: 10, lastSeenMs: NOW - 1000 },
    { health: 90, fixesWeek: 5, lastSeenMs: NOW - 5000 }
  ] },
  { handle: "cust-19a8g", endpoints: [{ health: 84, fixesWeek: 40, lastSeenMs: NOW - 200 }] },
  { handle: "evil name!!", endpoints: [] } // bad handle → sanitized
];

const rows = aggregateFleet(tenants);
assert.equal(rows.length, 3);
// Per-customer math.
const c1 = rows.find((r) => r.handle === "cust-7f3k2");
assert.equal(c1.endpoints, 2);
assert.equal(c1.healthAvg, 93, "average health = (96+90)/2");
assert.equal(c1.fixesWeek, 15, "fixes summed across endpoints");
assert.equal(c1.lastSeenMs, NOW - 1000, "most recent last-seen");

// Privacy: NO real name ever appears; a bad handle collapses to a safe placeholder.
const text = JSON.stringify(rows);
assert.ok(!text.includes("Contoso"), "real customer name never surfaces");
assert.ok(rows.some((r) => r.handle === "cust-unknown"), "invalid handle sanitized to cust-unknown");

// Totals + filter.
const totals = fleetTotals(rows);
assert.equal(totals.customers, 3);
assert.equal(totals.endpoints, 3);
assert.equal(filterFleet(rows, "19a8g").length, 1, "per-tenant filter by handle");
assert.equal(filterFleet(rows, "").length, 3, "empty filter returns all");

// Remote control (Whereby) — host-pinned, time-boxed, no recording/keystroke.
assert.equal(isWherebyRoom("https://iis.whereby.com/support-room"), true);
assert.equal(isWherebyRoom("https://evil.com/room"), false);
assert.equal(isWherebyRoom("http://whereby.com/x"), false, "https required");
const session = buildRemoteSession({ roomUrl: "https://iis.whereby.com/support", now: NOW });
assert.equal(session.ok, true);
assert.equal(session.recording, false, "never records");
assert.equal(session.keystrokeCapture, false, "never captures keystrokes");
assert.equal(session.expiresAt, NOW + SESSION_MS, "10-minute scoped session");
assert.equal(sessionActive(session, NOW + 60000), true);
assert.equal(sessionActive(session, NOW + SESSION_MS + 1), false, "session expires");
assert.equal(buildRemoteSession({ roomUrl: "https://evil.com/x" }).ok, false);

console.log("Multi-tenant test passed (fleet aggregation · handle-only privacy · filter · Whereby guard).");
