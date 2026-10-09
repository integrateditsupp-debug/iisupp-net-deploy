// RUN-CU / CU4 (audit P0 #4) — compliance scores + the privacy verdict derive from REAL state. An unsigned build can
// never claim CC8.1; no live capture = "not measured yet", never a literal pass; a stale capture is not evidence;
// a tamper finding flips the audit controls; the quarterly PDF's trust lines follow the evidence.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { deriveControlOverrides, derivePrivacyVerdict, summarizeEvidence, PRIVACY_CAPTURE_MAX_AGE_MS } from "../src/shared/compliance-evidence.mjs";
import { compositeScores } from "../src/shared/compliance-score.mjs";
import { buildQuarterlyReport, trustLines, executiveSummary } from "../src/main/report-generator.mjs";

let n = 0; const t = () => { n++; };
const NOW = Date.parse("2026-10-08T12:00:00Z");
const goodCapture = { pass: true, allHostsAllowed: true, allContentBlind: true, disallowedHostCount: 0, leakingPayloadCount: 0, total: 4, rows: [1, 2, 3, 4], ts: new Date(NOW - 3600000).toISOString() };

// 1 — privacy verdict: none → not measured; fresh PASS → measured; REVIEW → measured false; stale → not evidenced.
{
  const none = derivePrivacyVerdict(null, NOW);
  assert.equal(none.pass, null); assert.equal(none.sanitization, null); assert.equal(none.evidenced, false); assert.match(none.label, /not measured yet/i);
  const ok = derivePrivacyVerdict(goodCapture, NOW);
  assert.equal(ok.pass, true); assert.equal(ok.sanitization, 100); assert.equal(ok.evidenced, true); assert.equal(ok.ageHours, 1); assert.match(ok.label, /measured: PASS/);
  const review = derivePrivacyVerdict({ ...goodCapture, pass: false, leakingPayloadCount: 1 }, NOW);
  assert.equal(review.pass, false); assert.equal(review.sanitization, 75); assert.match(review.label, /REVIEW/);
  const stale = derivePrivacyVerdict({ ...goodCapture, ts: new Date(NOW - PRIVACY_CAPTURE_MAX_AGE_MS - 1).toISOString() }, NOW);
  assert.equal(stale.evidenced, false); assert.match(stale.label, /re-run Live capture/i);
}
t();

// 2 — unsigned build ⇒ CC8.1 met:false (the headline finding); signed ⇒ met.
{
  const unsigned = deriveControlOverrides({ signExecutable: false, lastPrivacyCapture: goodCapture }, NOW);
  assert.equal(unsigned.overrides["CC8.1"], false);
  assert.equal(unsigned.evidence["CC8.1"].kind, "not-evidenced"); assert.match(unsigned.evidence["CC8.1"].detail, /UNSIGNED/);
  const cs = compositeScores(unsigned.overrides);
  assert.ok(cs.soc2.controls.find((c) => c.id === "CC8.1").met === false, "the composite reflects the unsigned build");
  assert.ok(cs.soc2.score < 100, "SOC 2 can no longer read 100 on an unsigned build");
  const signed = deriveControlOverrides({ signExecutable: true, lastPrivacyCapture: goodCapture }, NOW);
  assert.equal(signed.overrides["CC8.1"], true); assert.equal(signed.evidence["CC8.1"].kind, "measured");
}
t();

// 3 — privacy-backed controls: no capture → not met; fresh PASS → met; stale PASS → not met; allowlist test failure → CC6.6 not met.
{
  const none = deriveControlOverrides({ signExecutable: false }, NOW);
  for (const id of ["CC6.6", "164.312(e)", "P4.5", "P4.8", "Art32"]) { assert.equal(none.overrides[id], false, `${id} not met without a capture`); assert.equal(none.evidence[id].kind, "not-evidenced"); }
  const fresh = deriveControlOverrides({ signExecutable: false, lastPrivacyCapture: goodCapture }, NOW);
  for (const id of ["CC6.6", "164.312(e)", "P4.5", "P4.8", "Art32"]) assert.equal(fresh.overrides[id], true, `${id} met with a fresh PASS`);
  const stale = deriveControlOverrides({ lastPrivacyCapture: { ...goodCapture, ts: new Date(NOW - 10 * 86400000).toISOString() } }, NOW);
  assert.equal(stale.overrides["CC6.6"], false, "a 10-day-old capture is not current evidence");
  const badList = deriveControlOverrides({ lastPrivacyCapture: goodCapture, allowlistTestOk: false }, NOW);
  assert.equal(badList.overrides["CC6.6"], false); assert.match(badList.evidence["CC6.6"].detail, /allowlist test failed/);
}
t();

// 4 — audit integrity, watchers, SLA data, consent, retention cleanup each follow their real signal; the privacy verdict rides along.
{
  const tampered = deriveControlOverrides({ auditIntegrity: { ok: false, reason: "seal-missing" } }, NOW);
  for (const id of ["CC4.1", "164.312(b)", "164.312(c)"]) { assert.equal(tampered.overrides[id], false); assert.match(tampered.evidence[id].detail, /seal-missing/); }
  const intact = deriveControlOverrides({ auditIntegrity: { ok: true }, auditSealKeyed: true }, NOW);
  assert.equal(intact.overrides["CC4.1"], true); assert.match(intact.evidence["CC4.1"].detail, /HMAC-keyed/);
  const live = deriveControlOverrides({ watchersRunning: true, slaHasData: true, setupCompleted: true, lastRetentionCleanup: new Date(NOW - 3600000).toISOString() }, NOW);
  assert.equal(live.overrides["CC7.2"], true); assert.equal(live.overrides["A1.2"], true); assert.equal(live.overrides["P4.3"], true); assert.equal(live.overrides["Art17"], true);
  const dead = deriveControlOverrides({ watchersRunning: false, slaHasData: false, setupCompleted: false, lastRetentionCleanup: new Date(NOW - 5 * 86400000).toISOString() }, NOW);
  assert.equal(dead.overrides["CC7.2"], false); assert.equal(dead.overrides["A1.2"], false); assert.equal(dead.overrides["P4.3"], false); assert.equal(dead.overrides["Art17"], false);
  assert.equal(live.privacy.pass, null, "the privacy verdict is carried on the result");
  assert.equal(live.evidence["CC6.1"].kind, "capability", "controls without a local signal are labelled capabilities, not measured");
  const sum = summarizeEvidence(live.evidence);
  assert.equal(sum.total, Object.keys(live.evidence).length); assert.ok(sum.capability >= 5); assert.ok(sum.measured + sum.notEvidenced + sum.capability === sum.total);
}
t();

// 5 — the PDF: trust lines + executive summary say "not evidenced"/"not measured" when that is the truth, "verified" only when measured.
{
  const bad = deriveControlOverrides({ auditIntegrity: { ok: false, reason: "entry-modified" }, signExecutable: false }, NOW);
  const lines = trustLines({ evidence: bad.evidence, privacy: bad.privacy });
  assert.match(lines[0], /NOT evidenced/); assert.match(lines[1], /not evidenced/i); assert.match(lines[2], /UNSIGNED/); assert.match(lines[3], /not evidenced/);
  const good = deriveControlOverrides({ auditIntegrity: { ok: true }, signExecutable: true, lastPrivacyCapture: goodCapture }, NOW);
  const gl = trustLines({ evidence: good.evidence, privacy: good.privacy });
  assert.match(gl[0], /verified/); assert.match(gl[1], /measured PASS/); assert.match(gl[2], /code-signed/);
  assert.match(executiveSummary({ evidence: bad.evidence, privacy: bad.privacy })[2], /not evidenced.*not measured yet/i);
  assert.match(executiveSummary({ evidence: good.evidence, privacy: good.privacy })[2], /verified.*passing \(measured\)/i);
  // legacy caller (no evidence) keeps the original line — nothing removed
  assert.match(trustLines({})[0], /Audit integrity verified · privacy verifier active/);
  const html = buildQuarterlyReport({ kpis: {}, sla: {}, compliance: {}, evidence: bad.evidence, privacy: bad.privacy }).html;
  assert.match(html, /NOT evidenced/); assert.doesNotMatch(html, /100% sanitization/, "the PDF no longer prints a literal 100% when nothing was measured");
}
t();

// 6 — main.mjs wiring: complianceData derives evidence; the literal privacy pass is gone; reportData carries evidence.
{
  const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
  assert.match(main, /deriveControlOverrides\(\{/, "complianceData derives overrides from live state");
  assert.match(main, /frameworks: compositeScores\(ev\.overrides\)/, "composites take the derived overrides");
  assert.doesNotMatch(main, /privacy: \{ pass: true, allowlistOk: true, sanitization: 100/, "the hardcoded privacy pass is gone");
  assert.match(main, /signExecutable: buildIsSigned\(\)/, "signing state read from package.json");
  assert.match(main, /evidence: comp\.evidence,\s*\n\s*privacy: comp\.privacy/, "report data carries evidence + the measured privacy verdict");
}
t();

assert.equal(n, 6, "6 compliance-evidence groups");
console.log(`compliance-evidence test passed (${n} groups · privacy verdict real-or-empty · unsigned ⇒ CC8.1 not met · capture-backed controls · signal-backed controls · PDF honesty · main wiring).`);
