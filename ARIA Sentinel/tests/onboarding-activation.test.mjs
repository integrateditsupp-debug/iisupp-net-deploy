// RUN-C C3 - 5-minute onboarding activation: pilot starts from real intake and TTFV stays real-or-empty.
import assert from "node:assert/strict";
import { buildPilotRecord, pilotStatus, firstFixAtFromAudit, stampTtfv, ttfvLabel } from "../src/shared/pilot-state.mjs";

const now = Date.parse("2026-07-04T12:00:00.000Z");
const built = buildPilotRecord({ org: "Acme", size: "11-50", pains: ["printer queue", "wifi drops"] }, { now, deviceId: "DESK-1" });
assert.equal(built.ok, true);
assert.equal(built.record.schema, "pilot.v1");
assert.equal(pilotStatus({ startedAt: built.record.started_at, now }).state, "active");

assert.equal(firstFixAtFromAudit([], { startedAt: built.record.started_at }), null, "no real fix means no TTFV");
assert.equal(ttfvLabel(built.record), "--", "TTFV label is empty until measured");

const firstFix = firstFixAtFromAudit([
  { tag: "RUN", ts: "2026-07-04T12:04:00.000Z" },
  { tag: "RUN", ts: "2026-07-04T12:07:00.000Z" }
], { startedAt: built.record.started_at });
const stamped = stampTtfv(built.record, { firstFixAt: firstFix, now: now + 8 * 60000 });
assert.equal(stamped.changed, true);
assert.equal(stamped.record.ttfv.minutes, 4);
assert.equal(stampTtfv(stamped.record, { firstFixAt: now + 2 * 60000 }).changed, false, "TTFV is write-once");

console.log("Onboarding-activation test passed (pilot intake, active state, real-or-empty TTFV, write-once stamp).");
