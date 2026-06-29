/**
 * B2 — REAL ROI: all ROI surfaces trace to real log events; no seeded values; real-or-empty (Rule 14).
 *
 * Tests verify:
 *  R1: roiFromLog — empty log → fixes=0, hoursSaved=null, dollarsSaved=null (never fabricated zero)
 *  R2: roiFromLog — N RUN events → fixes=N, hoursSaved computed correctly
 *  R3: roiFromLog — ignores non-RUN events (DIAGNOSE, SECURITY, etc.)
 *  R4: roiFromLog — custom hourlyRate / minutesPerFix respected
 *  S1: roiSummaryFromLog — empty log → "not recorded any resolved incidents" (not "0 hours")
 *  S2: roiSummaryFromLog — real fixes → shows real numbers
 *  E1: quarterly email body — incidents=0 renders "0" (no seeded non-zero)
 *  E2: quarterly email body — hoursSaved null → savings clause absent (not "null hours")
 *  E3: quarterly email body — real hoursSaved → savings clause present with real value
 *  P1: roiFromLog with DIAGNOSE-only log → fixes=0, hoursSaved=null (diagnoses ≠ fixes)
 *  P2: roiFromLog rejects non-array input gracefully (no crash)
 */

import assert from "node:assert/strict";
import { roiFromLog, roiSummaryFromLog, computeRoi, DEFAULT_HOURLY_RATE, DEFAULT_MINUTES_PER_FIX } from "../src/shared/roi.mjs";
import { emailBody } from "../src/shared/quarterly-email.mjs";

const tests = [];

// ── R1: empty log → null (real-or-empty, Rule 14) ─────────────────────────────
tests.push({ name: "R1 empty log → fixes=0, hoursSaved=null, dollarsSaved=null", fn() {
  const r = roiFromLog([]);
  assert.equal(r.fixes, 0, "no fixes from empty log");
  assert.equal(r.hoursSaved, null, "hoursSaved null when no fixes (Rule 14)");
  assert.equal(r.dollarsSaved, null, "dollarsSaved null when no fixes (Rule 14)");
}});

// ── R2: real RUN events → real numbers ────────────────────────────────────────
tests.push({ name: "R2 3 RUN events → fixes=3, hoursSaved computed", fn() {
  const log = [
    { tag: "RUN", text: "Executing windows-update-flush" },
    { tag: "RUN", text: "Executing dns-flush" },
    { tag: "RUN", text: "Executing clear-temp" },
  ];
  const r = roiFromLog(log);
  assert.equal(r.fixes, 3, "3 RUN events = 3 fixes");
  // 3 fixes × 20 min/fix = 60 min = 1.0 hour
  assert.equal(r.hoursSaved, 1.0, `expected 1.0h got ${r.hoursSaved}`);
  assert.ok(r.dollarsSaved > 0, "dollarsSaved > 0 when fixes > 0");
  assert.equal(r.dollarsSaved, Math.round(1 * DEFAULT_HOURLY_RATE), "dollarsSaved = 1h × default rate");
}});

// ── R3: non-RUN events ignored ─────────────────────────────────────────────────
tests.push({ name: "R3 DIAGNOSE/SECURITY events do not count as fixes", fn() {
  const log = [
    { tag: "DIAGNOSE", text: "slow computer" },
    { tag: "SECURITY", text: "R11 blocked" },
    { tag: "RUN", text: "Executing clear-temp" },
    { tag: "INFO", text: "startup" },
  ];
  const r = roiFromLog(log);
  assert.equal(r.fixes, 1, "only RUN events count");
}});

// ── R4: custom rate/minutesPerFix respected ────────────────────────────────────
tests.push({ name: "R4 custom hourlyRate + minutesPerFix override defaults", fn() {
  const log = [{ tag: "RUN" }, { tag: "RUN" }]; // 2 fixes
  const r = roiFromLog(log, { hourlyRate: 100, minutesPerFix: 30 });
  // 2 × 30min = 60min = 1h; 1h × $100 = $100
  assert.equal(r.hoursSaved, 1.0, "2 × 30min = 1.0 hour");
  assert.equal(r.dollarsSaved, 100, "1h × $100/hr = $100");
}});

// ── S1: summary from empty log ─────────────────────────────────────────────────
tests.push({ name: "S1 roiSummaryFromLog empty → 'not recorded' message, not '0 hours'", fn() {
  const s = roiSummaryFromLog([]);
  assert.ok(!s.includes("0 hours"), "must not say '0 hours' when nothing recorded");
  assert.ok(!s.includes("$0"), "must not say '$0' when nothing recorded");
  assert.ok(s.toLowerCase().includes("not") || s.toLowerCase().includes("no"), "must indicate no data");
}});

// ── S2: summary from real fixes ────────────────────────────────────────────────
tests.push({ name: "S2 roiSummaryFromLog with real fixes → shows real numbers", fn() {
  const log = [{ tag: "RUN" }, { tag: "RUN" }];
  const s = roiSummaryFromLog(log);
  assert.ok(s.includes("2"), "must include fix count");
  assert.ok(s.includes("hour") || s.includes("hr"), "must mention hours");
}});

// ── E1: email body incidents=0 → renders "0" not a seeded value ───────────────
tests.push({ name: "E1 emailBody incidents=0 renders 0 resolved (not a seeded positive)", fn() {
  if (!emailBody) { console.log("    (emailBody not available — skip E1)"); return; }
  const html = emailBody({ quarter: "2026-Q3", company: "Test Corp", kpis: { incidents: 0 } });
  assert.ok(html.includes(">0<") || html.includes("0 incidents") || html.includes("resolved <b>0</b>"),
    "zero incidents shown as 0, not a fabricated value");
  // must NOT contain a large seeded number
  assert.ok(!/resolved.*?<b>[1-9][0-9]+<\/b>/.test(html), "no fabricated non-zero incident count");
}});

// ── E2: email body hoursSaved null → savings clause absent ────────────────────
tests.push({ name: "E2 emailBody hoursSaved=null → no 'null hours' in output", fn() {
  if (!emailBody) { console.log("    (emailBody not available — skip E2)"); return; }
  const html = emailBody({ quarter: "2026-Q3", company: "Test Corp", kpis: { incidents: 0, hoursSaved: null } });
  assert.ok(!html.includes("null"), "null must not appear literally in email");
  assert.ok(!html.includes("undefined"), "undefined must not appear in email");
}});

// ── E3: email body real hoursSaved → savings clause present ───────────────────
tests.push({ name: "E3 emailBody real hoursSaved → savings clause in output", fn() {
  if (!emailBody) { console.log("    (emailBody not available — skip E3)"); return; }
  const html = emailBody({ quarter: "2026-Q3", company: "Test Corp", kpis: { incidents: 5, hoursSaved: 1.7 } });
  assert.ok(html.includes("1.7"), "real hoursSaved appears in email");
}});

// ── P1: DIAGNOSE-only log → fixes=0, null (diagnoses ≠ resolved) ──────────────
tests.push({ name: "P1 DIAGNOSE-only log → fixes=0, hoursSaved=null (diagnosing ≠ resolving)", fn() {
  const log = Array.from({ length: 10 }, () => ({ tag: "DIAGNOSE" }));
  const r = roiFromLog(log);
  assert.equal(r.fixes, 0, "diagnoses don't count as fixes");
  assert.equal(r.hoursSaved, null, "no hoursSaved when fixes=0");
}});

// ── P2: non-array input → no crash ────────────────────────────────────────────
tests.push({ name: "P2 roiFromLog(null/undefined/string) → no crash, fixes=0", fn() {
  for (const bad of [null, undefined, "oops", 42]) {
    const r = roiFromLog(bad);
    assert.equal(r.fixes, 0, `fixes=0 for bad input ${JSON.stringify(bad)}`);
    assert.equal(r.hoursSaved, null, "hoursSaved null for bad input");
  }
}});

// ── Runner ─────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log("  ✓ " + t.name);
    passed++;
  } catch (e) {
    console.error("  ✗ " + t.name + "\n    " + e.message);
    failed++;
  }
}
console.log(`\nB2: ${passed} passed, ${failed} failed (${tests.length} total)`);
if (failed) process.exit(1);
