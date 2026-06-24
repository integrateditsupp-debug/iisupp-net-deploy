// RUN 22 §3 — the 5 license tiers carry the correct contractual SLA defaults.
import assert from "node:assert/strict";
import { TIER_SLA, tierSla } from "../src/main/sla-tracker.mjs";

assert.deepEqual(Object.keys(TIER_SLA).sort(), ["enterprise", "midsize", "personal", "pro", "smb"]);

// Uptime targets per the packet.
assert.equal(TIER_SLA.personal.uptimeTarget, 99.0);
assert.equal(TIER_SLA.pro.uptimeTarget, 99.5);
assert.equal(TIER_SLA.smb.uptimeTarget, 99.9);
assert.equal(TIER_SLA.midsize.uptimeTarget, 99.95);
assert.equal(TIER_SLA.enterprise.uptimeTarget, 99.99);

// P1 response thresholds (seconds).
assert.equal(TIER_SLA.personal.response.P1, 120);  // <2min
assert.equal(TIER_SLA.pro.response.P1, 60);         // <60s
assert.equal(TIER_SLA.smb.response.P1, 30);         // <30s
assert.equal(TIER_SLA.midsize.response.P1, 30);
assert.equal(TIER_SLA.enterprise.response.P1, 15);  // <15s

// Service-credit posture: none below SMB; ramps SMB 5% → Mid 10% → Enterprise 15%.
assert.equal(TIER_SLA.personal.credit.P1, 0);
assert.equal(TIER_SLA.pro.credit.P1, 0);
assert.equal(TIER_SLA.smb.credit.P1, 5);
assert.equal(TIER_SLA.midsize.credit.P1, 10);
assert.equal(TIER_SLA.enterprise.credit.P1, 15);

// Dedicated CSM only at Enterprise.
assert.equal(TIER_SLA.enterprise.csm, true);
assert.equal(TIER_SLA.smb.csm, false);

// Unknown tier falls back to personal.
assert.equal(tierSla("nonsense").uptimeTarget, 99.0);

console.log("Sla-tier-thresholds test passed (5 tiers · uptime/response/credit/CSM defaults correct).");
