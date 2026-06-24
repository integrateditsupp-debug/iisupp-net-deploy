// RUN 22 §3 — SLA tracker: uptime + response + resolution, all tier-specific.
import assert from "node:assert/strict";
import { uptimePct, responseMet, resolutionMet, slaCompliance, tierSla } from "../src/main/sla-tracker.mjs";

// Uptime: 1h of downtime in a 30-day window.
const month = 30 * 24 * 60 * 60 * 1000;
assert.equal(uptimePct([{ durationMs: 60 * 60 * 1000 }], month), 99.86);
assert.equal(uptimePct([], month), 100, "no downtime = 100%");

// Response SLA is tier-specific: SMB P1 threshold is 30s. 40s misses, 10s meets.
const dets = [
  { severity: "P1", responseMs: 40000, resolved: true, resolveMs: 120000 },
  { severity: "P1", responseMs: 10000, resolved: true, resolveMs: 60000 }
];
assert.equal(responseMet(dets, "smb").P1, 50, "1 of 2 P1 met the 30s response SLA");
// Pro P1 threshold is 60s → both 40s and 10s meet.
assert.equal(responseMet(dets, "pro").P1, 100, "Pro's 60s threshold → both meet");

// Resolution SLA: SMB P1 resolve threshold is 15min. 2min meets, 1min meets → 100%.
assert.equal(resolutionMet(dets, "smb").P1, 100);
const slow = [{ severity: "P1", resolved: true, resolveMs: 20 * 60000 }];
assert.equal(resolutionMet(slow, "smb").P1, 0, "20min P1 resolution misses the 15min SLA");

// Composite compliance window number + floor check.
const c = slaCompliance(dets, [{ durationMs: 60 * 60 * 1000 }], "smb", month);
assert.ok(c.composite > 0 && c.composite <= 100);
assert.equal(c.floor, tierSla("smb").uptimeTarget);
assert.equal(typeof c.met, "boolean");
assert.ok("response" in c && "resolution" in c && "uptime" in c);

console.log("Sla-tracker test passed (uptime + response + resolution, all tier-specific).");
