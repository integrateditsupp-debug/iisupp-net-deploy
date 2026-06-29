/**
 * B3 — HONEST TRUST/SECURITY SURFACE
 *
 * Tests verify:
 *  T1: compliance.mjs privacyRowsHtml — sanitization null → "--" not "100%" (Rule 14 real-or-empty)
 *  T2: compliance.mjs privacyRowsHtml — sanitization 98 → "98%" (real value passes through)
 *  T3: compliance.mjs privacyRowsHtml — sanitization undefined → "--" not "100%"
 *  T4: compliance-score.mjs GDPR Art32 name — no hardcoded "100%" percentage in control name
 *  T5: compliance-score.mjs compositeScores — scores derive from control counts, not seeded values
 *  T6: compliance-score.mjs r11EnforcementStatus — 0 attempts → ok:true, never fabricates access
 *  T7: compliance-score.mjs r11EnforcementStatus — 1 attempt → touched:true, ok:false (alarm not hidden)
 *  T8: compliance.mjs frameworkTilesHtml — score=0 case renders cleanly (no NaN/undefined in output)
 */

import assert from "node:assert/strict";
import { privacyRowsHtml, auditRowsHtml, frameworkTilesHtml } from "../src/renderer/tabs/compliance.mjs";
import {
  GDPR_RIGHTS,
  compositeScores,
  r11EnforcementStatus,
  frameworkScore,
} from "../src/shared/compliance-score.mjs";

const tests = [];

// ── T1: sanitization null → "--" in <strong> (Rule 14 real-or-empty) ──────────
tests.push({ name: "T1 privacyRowsHtml: sanitization=null → <strong>--</strong>, not <strong>100%</strong>", fn() {
  const html = privacyRowsHtml({ pass: true, ts: "2026-06-29", allowlistOk: true, sanitization: null });
  // The <strong> tag holds the displayed value; <em> holds the policy hint ("must be 100%") — that's OK.
  assert.ok(!html.includes("<strong>100%</strong>"), "must not fabricate 100% as displayed value");
  assert.ok(html.includes("<strong>--</strong>"), "must show '--' for unmeasured sanitization");
}});

// ── T2: real sanitization value passes through ──────────────────────────────────
tests.push({ name: "T2 privacyRowsHtml: sanitization=98 → <strong>98%</strong>", fn() {
  const html = privacyRowsHtml({ pass: true, ts: "2026-06-29", allowlistOk: true, sanitization: 98 });
  assert.ok(html.includes("<strong>98%</strong>"), "real sanitization value must appear in strong");
  assert.ok(!html.includes("<strong>100%</strong>"), "must not inflate to 100% in displayed value");
}});

// ── T3: sanitization undefined → "--" in <strong> ───────────────────────────────
tests.push({ name: "T3 privacyRowsHtml: sanitization=undefined → <strong>--</strong>", fn() {
  const html = privacyRowsHtml({ pass: true });
  assert.ok(!html.includes("<strong>100%</strong>"), "undefined sanitization must not show 100% as value");
  assert.ok(html.includes("<strong>--</strong>"), "undefined sanitization must show '--'");
}});

// ── T4: GDPR Art32 control name has no hardcoded percentage ────────────────────
tests.push({ name: "T4 GDPR_RIGHTS Art32 name has no hardcoded '100%' percentage", fn() {
  const art32 = GDPR_RIGHTS.find((c) => c.id === "Art32");
  assert.ok(art32, "Art32 control must exist");
  assert.ok(!art32.name.includes("100%"), `Art32 name must not bake in 100%: "${art32.name}"`);
  assert.ok(art32.name.toLowerCase().includes("sanitization"), "Art32 should still mention sanitization");
}});

// ── T5: compositeScores derives from control counts, not seeded ────────────────
tests.push({ name: "T5 compositeScores — scores are math of controls, not hardcoded values", fn() {
  const scores = compositeScores();
  for (const [fw, s] of Object.entries(scores)) {
    assert.ok(Number.isFinite(s.score), `${fw} score must be finite`);
    assert.ok(s.score >= 0 && s.score <= 100, `${fw} score must be 0-100`);
    assert.ok(s.met <= s.total, `${fw} met (${s.met}) must not exceed total (${s.total})`);
    const expected = Math.round((s.met / s.total) * 100);
    assert.equal(s.score, expected, `${fw} score must equal met/total math`);
  }
}});

// ── T6: r11EnforcementStatus 0 attempts → ok:true ──────────────────────────────
tests.push({ name: "T6 r11EnforcementStatus 0 attempts → ok:true, touched:false", fn() {
  const r = r11EnforcementStatus(0, "2026-06-29");
  assert.equal(r.attempts, 0);
  assert.equal(r.ok, true);
  assert.equal(r.touched, false);
  assert.ok(r.statusLine.includes("0"), "status line must mention 0 accesses");
}});

// ── T7: r11EnforcementStatus 1 attempt → alarm not hidden ──────────────────────
tests.push({ name: "T7 r11EnforcementStatus 1 attempt → touched:true, ok:false (alarm surfaced)", fn() {
  const r = r11EnforcementStatus(1);
  assert.equal(r.attempts, 1);
  assert.equal(r.ok, false);
  assert.equal(r.touched, true);
  assert.ok(r.statusLine.toLowerCase().includes("blocked") || r.statusLine.includes("1"), "status must surface the access");
}});

// ── T8: frameworkTilesHtml with score=0 renders cleanly ────────────────────────
tests.push({ name: "T8 frameworkTilesHtml: score=0 renders without NaN or undefined", fn() {
  const html = frameworkTilesHtml({ soc2: { score: 0, badge: "gap", met: 0, total: 7 } });
  assert.ok(!html.includes("NaN"), "NaN must not appear in output");
  assert.ok(!html.includes("undefined"), "undefined must not appear in output");
  assert.ok(html.includes("0"), "score 0 must appear");
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
console.log(`\nB3: ${passed} passed, ${failed} failed (${tests.length} total)`);
if (failed) process.exit(1);
