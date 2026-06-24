// RUN 22 §7 — admin console aggregates KPIs across licenses (Fleet Performance + Cohort SLA), behind
// the SENTINEL_ADMIN_TOKEN gate.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { aggregateFleet, cohortSla } from "../src/shared/fleet-aggregate.mjs";

const now = Date.parse("2026-07-05T12:00:00Z");
const records = [
  { licenseId: "a", version: "0.1.0", healthScore: 96, startupEnabled: true, receivedAt: new Date(now - 60000).toISOString(), tier: "smb", slaComposite: 99.95 },
  { licenseId: "b", version: "0.1.0", healthScore: 84, startupEnabled: false, receivedAt: new Date(now - 2 * 86400000).toISOString(), tier: "smb", slaComposite: 99.0 },
  { licenseId: "c", version: "0.1.1", healthScore: 99, startupEnabled: true, receivedAt: new Date(now - 120000).toISOString(), tier: "enterprise", slaComposite: 99.999 }
];

// Fleet aggregate.
const agg = aggregateFleet(records, now);
assert.equal(agg.licenses, 3);
assert.deepEqual(agg.versions, { "0.1.0": 2, "0.1.1": 1 });
assert.equal(agg.avgHealth, 93);
assert.equal(agg.startupDisabled, 1);
assert.equal(agg.silent24h, 1, "license b last seen >24h ago");

// Cohort SLA per tier.
const cohort = cohortSla(records);
assert.equal(cohort.smb.count, 2);
assert.equal(cohort.smb.meeting, 1, "only one SMB meets its 99.9% floor");
assert.equal(cohort.smb.pct, 50);
assert.equal(cohort.enterprise.meeting, 1);
assert.equal(cohort.personal.count, 0, "no personal licenses in this cohort");

// Admin console markup + token gate.
const admin = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "admin-console", "index.html"), "utf8");
assert.match(admin, /data-view-target="fleet-performance"/, "Fleet Performance nav present");
assert.match(admin, /Fleet Performance/, "Fleet Performance heading");
assert.match(admin, /id="fleetPerfRows"/, "fleet aggregate table present");
assert.match(admin, /data-view-target="cohort-sla"/, "Cohort SLA view present");
assert.match(admin, /data-view-target="quarterly-reports"/, "Quarterly Reports view present");
assert.match(admin, /Quarterly email queue/, "email queue section present");
assert.match(admin, /'X-Admin-Token'/, "admin endpoints use the SENTINEL_ADMIN_TOKEN header gate");

console.log("Admin-console-fleet-perf test passed (fleet aggregate + cohort SLA + admin views + token gate).");
