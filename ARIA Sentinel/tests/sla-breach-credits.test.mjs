// RUN 22 §3 — SLA breach detection + auto-CALCULATED service credits (never auto-issued).
import assert from "node:assert/strict";
import { breaches, serviceCredits, BREACH_REASONS } from "../src/main/sla-tracker.mjs";

// A P1 that blew the SMB 30s response threshold is a breach.
const dets = [
  { severity: "P1", responseMs: 45000, resolved: true, resolveMs: 60000, breachReason: "timeout" }, // breach
  { severity: "P1", responseMs: 10000, resolved: true, resolveMs: 60000 },                            // ok
  { severity: "P2", responseMs: 200000, resolved: true, resolveMs: 30 * 60000 }                       // P2 breach (resolve > 60min)
];
const b = breaches(dets, "smb");
assert.equal(b.length, 2, "two breaches detected");
assert.ok(b.every((x) => BREACH_REASONS.includes(x.reason)), "each breach has a valid reason");

// SMB credit schedule: 5% per P1, 1% per P2. One P1 + one P2 on a $1000/mo plan → $60 owed.
const credits = serviceCredits(b, "smb", 1000);
assert.equal(credits.pctOwed, 6, "5% (P1) + 1% (P2)");
assert.equal(credits.owed, 60);
assert.equal(credits.breakdown.P1, 5);
assert.equal(credits.breakdown.P2, 1);
assert.equal(credits.autoIssue, false, "credits are CALCULATED but never auto-issued");

// Enterprise schedule is richer (15% per P1).
assert.equal(serviceCredits([{ severity: "P1" }], "enterprise", 10000).pctOwed, 15);
assert.equal(serviceCredits([{ severity: "P1" }], "enterprise", 10000).owed, 1500);

// Personal/Pro tiers carry NO service credits regardless of breaches.
assert.equal(serviceCredits([{ severity: "P1" }, { severity: "P2" }], "personal", 599).owed, 0);
assert.equal(serviceCredits([{ severity: "P1" }], "pro", 1500).owed, 0);

console.log("Sla-breach-credits test passed (breach detect · tier credit schedule · never auto-issued · personal/pro = $0).");
