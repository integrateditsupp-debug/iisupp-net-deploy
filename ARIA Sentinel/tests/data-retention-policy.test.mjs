// RUN 22 §5 — data-retention: each class deleted at its cutoff; legal-hold + never-classes respected;
// 🔒 R11 paths never traversed.
import assert from "node:assert/strict";
import { RETENTION_POLICY, cutoffMs, dueForDeletion, planCleanup, nextCleanupAt, retentionSummary } from "../src/main/data-retention.mjs";

const DAY = 24 * 60 * 60 * 1000;

// Cutoffs from the retention table.
assert.equal(RETENTION_POLICY.auditLog.deleteAfterDays, 2555, "audit log 7y floor");
assert.equal(RETENTION_POLICY.heartbeats.deleteAfterDays, 90);
assert.equal(cutoffMs("heartbeats"), 90 * DAY);
assert.equal(cutoffMs("updateHistory"), Infinity, "update history never deleted");
assert.equal(cutoffMs("quarterlyReports"), Infinity);
assert.equal(cutoffMs("licenseUsage"), Infinity);

// dueForDeletion respects cutoff, never-classes, and legal-hold.
assert.equal(dueForDeletion("heartbeats", 100 * DAY, {}), true, "90d heartbeat past cutoff");
assert.equal(dueForDeletion("heartbeats", 10 * DAY, {}), false, "fresh heartbeat kept");
assert.equal(dueForDeletion("auditLog", 100 * DAY, {}), false, "audit kept until 7y");
assert.equal(dueForDeletion("auditLog", 3000 * DAY, {}), true, "audit deleted past 7y");
assert.equal(dueForDeletion("csat", 10000 * DAY, {}), false, "CSAT never deleted");
assert.equal(dueForDeletion("heartbeats", 100 * DAY, { legalHold: true }), false, "legal-hold overrides cutoff");

// planCleanup: old item deleted, fresh kept, R11 path excluded entirely.
const now = Date.now();
const plan = planCleanup([
  { class: "heartbeats", ts: now - 100 * DAY },
  { class: "heartbeats", ts: now - 2 * DAY },
  { class: "diagnosticEvents", ts: now - 400 * DAY, legalHold: true },
  { class: "auditLog", ts: now - 100 * DAY, path: "C:\\X\\Private pics and Vids\\a" }
], now);
assert.equal(plan.delete.length, 1, "only the 100d heartbeat is deleted");
assert.equal(plan.delete[0].class, "heartbeats");
assert.equal(plan.excludedR11, 1, "R11 path excluded from the plan");
assert.ok(plan.keep.some((i) => i.legalHold), "legal-hold item kept");

// Snapshots: keepLatest protects the newest N regardless of age.
const snaps = Array.from({ length: 8 }, (_, i) => ({ class: "snapshots", id: `s${i}`, ts: now - (40 + i) * DAY }));
const snapPlan = planCleanup(snaps, now);
assert.equal(snapPlan.keep.filter((s) => s.class === "snapshots").length, RETENTION_POLICY.snapshots.keepLatest, "keepLatest snapshots retained");

assert.ok(nextCleanupAt(now), "next cleanup time computed");
assert.equal(retentionSummary().length, Object.keys(RETENTION_POLICY).length);

console.log("Data-retention-policy test passed (per-class cutoffs · never-classes · legal-hold · R11-excluded · snapshot keepLatest).");
