// STAGE 3 S3 — DEFLECTION FEED (→ RUN-B B1 → Stage-4 Trust Center → Stage-5 conversion).
// This is the number the whole proof chain hangs on, so this battery is a Rule-14 lock:
//   • no data → deflectionRate is NULL, never a flattering 0% and never a seeded demo figure;
//   • DURABLE resolutions only — a fix that came back inside the window is NOT a deflection;
//   • "already healthy" (no-op-neutral) is never counted as an ARIA fix;
//   • the feed is content-blind (symbolic ids, hashes, counts, timestamps — nothing else);
//   • 🔒 R11 first: a blocked payload is REFUSED, not sanitised-and-shipped.
import assert from "node:assert/strict";
import { buildDeflectionFeed, deflectionKpi, journalOutcomeCounts, assertContentBlind, FEED_EMPTY_LINE } from "../src/shared/deflection-feed.mjs";
import { emptyDurabilityLedger, issueSignature, recordResolution, QUIET_WINDOW_MS } from "../src/shared/durability-ledger.mjs";

const NOW = 1_770_000_000_000;

// 1 — REAL-OR-EMPTY. Nothing recorded → null, not 0%. The tile renders empty, not impressive.
{
  const feed = buildDeflectionFeed({ ledger: emptyDurabilityLedger(), journalEntries: [], now: NOW });
  assert.equal(feed.hasData, false);
  assert.equal(feed.deflectionRate, null, "no data must NEVER render as 0% — that is a fabricated metric");
  assert.equal(feed.attempts, 0);
  assert.equal(feed.line, FEED_EMPTY_LINE);
  const kpi = deflectionKpi(feed);
  assert.equal(kpi.value, null);
  assert.equal(kpi.empty, true);
  assert.ok(kpi.sub.includes("after ARIA's first real fix"));
}

// 2 — a fresh fix is "monitoring", NOT a deflection. The rate only moves once the 24h quiet window is served.
{
  const sig = issueSignature({ symptomId: "printer-issues", subsystem: "spooler" });
  let led = recordResolution(emptyDurabilityLedger(), { signature: sig, planId: "print-recovery", fixApplied: "print-recovery", resolved: true, evidence: "0", now: NOW });
  const fresh = buildDeflectionFeed({ ledger: led, now: NOW + 60_000 });
  assert.equal(fresh.durableResolutions, 0, "a fix 1 minute old is not yet durable");
  assert.equal(fresh.monitoring, 1);
  assert.equal(fresh.deflectionRate, 0, "honest 0 — there IS data, and it has not earned a deflection yet");
  // …but the TILE does not print a damning "0%" while the fix is legitimately still being watched.
  const pendingKpi = deflectionKpi(fresh);
  assert.equal(pendingKpi.value, null);
  assert.equal(pendingKpi.pending, true);
  assert.ok(pendingKpi.sub.includes("monitoring window"));

  const later = buildDeflectionFeed({ ledger: led, now: NOW + QUIET_WINDOW_MS + 1 });
  assert.equal(later.durableResolutions, 1, "24h of quiet EARNS the deflection");
  assert.equal(later.deflectionRate, 1);
  assert.equal(deflectionKpi(later).value, "100%");
}

// 3 — a resolution that came back is NOT a deflection (F1 durability, enforced at the metric).
{
  const sig = issueSignature({ symptomId: "no-internet", subsystem: "network" });
  let led = recordResolution(emptyDurabilityLedger(), { signature: sig, planId: "network-recovery", fixApplied: "network-recovery", resolved: true, evidence: "3", now: NOW });
  led = recordResolution(led, { signature: sig, planId: "network-recovery", fixApplied: "network-recovery", resolved: false, evidence: "", now: NOW + 3600_000 });
  const feed = buildDeflectionFeed({ ledger: led, now: NOW + QUIET_WINDOW_MS + 1 });
  assert.equal(feed.durableResolutions, 0, "it came back — it never counts as deflected");
  assert.equal(feed.recurred, 1);
  assert.ok(feed.deflectionRate < 1);
}

// 4 — journal counts: "already healthy" is reported, but NEVER as an ARIA fix.
{
  const entries = [
    { event: "PLAN.APPROVED" },
    { event: "PLAN.RESOLVED", extra: { noChange: false } },
    { event: "PLAN.APPROVED" },
    { event: "PLAN.RESOLVED", extra: { noChange: true } },   // no-op-neutral
    { event: "PLAN.APPROVED" },
    { event: "PLAN.ESCALATED", extra: { code: "GOAL_PROBE_FAILED" } },
    { event: "PLAN.ABORTED", extra: { code: "R11_BLOCKED" } }
  ];
  const c = journalOutcomeCounts(entries);
  assert.equal(c.attempts, 3);
  assert.equal(c.resolved, 1);
  assert.equal(c.alreadyHealthy, 1, "already-healthy is surfaced separately, never as a fix");
  assert.equal(c.escalated, 1);
  assert.equal(c.blocked, 1);
  const feed = buildDeflectionFeed({ ledger: emptyDurabilityLedger(), journalEntries: entries, now: NOW });
  assert.equal(feed.journal.alreadyHealthy, 1);
  assert.equal(feed.deflectionRate, null, "the journal alone never manufactures a rate — durability does");
}

// 5 — content-blind by construction, and 🔒 R11 REFUSES rather than ships.
{
  const sig = issueSignature({ symptomId: "printer-issues", subsystem: "spooler" });
  const led = recordResolution(emptyDurabilityLedger(), { signature: sig, planId: "print-recovery", fixApplied: "print-recovery", resolved: true, evidence: "0", now: NOW });
  const feed = buildDeflectionFeed({ ledger: led, now: NOW + QUIET_WINDOW_MS + 1 });
  assert.equal(assertContentBlind(feed).ok, true);
  const blob = JSON.stringify(feed);
  assert.ok(!/Private pics and Vids/i.test(blob));
  assert.ok(!/C:\\\\Users/i.test(blob));

  const blocked = buildDeflectionFeed({ ledger: { issues: { x: { hash: "x", note: "C:\\Private pics and Vids" } } }, now: NOW });
  assert.equal(blocked.ok, false, "R11 is check #1 — the feed is withheld, not scrubbed and shipped");
  assert.equal(blocked.deflectionRate, null);
  assert.ok(blocked.surfaced);
}

console.log("s3-deflection-feed test passed (null-not-zero · durable only · recurrence never deflects · no-op never a fix · content-blind · R11 refuses).");
