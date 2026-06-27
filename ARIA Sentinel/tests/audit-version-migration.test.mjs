// Audit-integrity VERSION MIGRATION — fixes the false "audit log tampered" alarm on a version upgrade.
// Contract: a benign upgrade (or a legacy version-less seal) re-seals the chain WITHOUT alerting, while a
// SAME-VERSION off-app edit of the log STILL alerts. This is the pure logic behind verifyAuditIntegrity.
import assert from "node:assert/strict";
import { sealAudit, classifyIntegrity } from "../src/shared/audit-integrity.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

const E = (n) => Array.from({ length: n }, (_, i) => ({ ts: `2026-06-27T00:0${i}:00.000Z`, tag: "EVENT", text: `entry ${i}` }));
const log = E(4);

// ── 1 · sealAudit stamps the app version (v2 seal) ──
{
  const s = sealAudit(log, { appVersion: "0.1.18", sealedAt: "2026-06-27T00:00:00.000Z" });
  assert.equal(s.appVersion, "0.1.18");
  assert.equal(s.v, "audit-seal-v2");
  assert.equal(s.count, 4);
  ok("sealAudit version-stamps the seal (appVersion recorded)");
}

// ── 2 · Same version, intact log → 'intact', no alert ──
{
  const s = sealAudit(log, { appVersion: "0.1.19" });
  const v = classifyIntegrity(log, s, "0.1.19");
  assert.equal(v.status, "intact");
  assert.equal(v.alertAdmin, false);
  ok("same version + intact log → intact (no alert)");
}

// ── 3 · VERSION UPGRADE (0.1.18 seal, running 0.1.19) → 'version-changed', NOT tampering ──
{
  const s = sealAudit(log, { appVersion: "0.1.18" });
  const v = classifyIntegrity(log, s, "0.1.19");
  assert.equal(v.status, "version-changed");
  assert.equal(v.alertAdmin, false, "an upgrade NEVER alerts");
  assert.equal(v.from, "0.1.18");
  assert.equal(v.to, "0.1.19");
  ok("version upgrade → benign re-seal (version-changed), no tamper alert");
}

// ── 4 · The exact field-shape that produced the live false alarm: a new entry prepended after the old
//        build sealed, then the new build boots. Under the OLD path this diverged at entry 0 ('tampered');
//        with version-awareness the upgrade re-seals silently. ──
{
  const oldSeal = sealAudit(log, { appVersion: "0.1.18" });        // 0.1.18 sealed 4 entries
  const afterReboot = [{ ts: "2026-06-27T04:31:55.000Z", tag: "EVENT", text: "new entry 0" }, ...log]; // prepend (unshift)
  const v = classifyIntegrity(afterReboot, oldSeal, "0.1.19");      // now running 0.1.19
  assert.equal(v.status, "version-changed", "the upgrade scenario is classified as a version change, not tamper");
  assert.equal(v.alertAdmin, false);
  ok("repro of the live false alarm (prepend + upgrade) → migrated, not flagged");
}

// ── 5 · Legacy version-less seal (pre-fix builds) → migrate silently, no alert ──
{
  const legacy = sealAudit(log); // no appVersion
  assert.equal(legacy.appVersion, null);
  const v = classifyIntegrity(log, legacy, "0.1.19");
  assert.equal(v.status, "version-changed");
  assert.equal(v.alertAdmin, false);
  ok("legacy version-less seal → migrate silently (no false alarm on first upgrade)");
}

// ── 6 · REAL TAMPER still alerts: SAME version, an entry edited off-app → 'tampered' + alert ──
{
  const s = sealAudit(log, { appVersion: "0.1.19" });
  const tampered = log.map((e, i) => (i === 2 ? { ...e, text: "EDITED off-app" } : e));
  const v = classifyIntegrity(tampered, s, "0.1.19");
  assert.equal(v.status, "tampered");
  assert.equal(v.alertAdmin, true, "real same-version tampering STILL alerts");
  assert.equal(v.brokenAt, 2);
  ok("real tamper (same version, edited entry) → tampered + admin alert (detection preserved)");
}

// ── 7 · REAL TAMPER via truncation under the same version still alerts ──
{
  const s = sealAudit(log, { appVersion: "0.1.19" });
  const truncated = log.slice(0, 2);
  const v = classifyIntegrity(truncated, s, "0.1.19");
  assert.equal(v.status, "tampered");
  assert.equal(v.alertAdmin, true);
  ok("real tamper (same-version truncation) → tampered + alert");
}

// ── 8 · First run (no seal) → baseline, no alert ──
{
  const v = classifyIntegrity(log, null, "0.1.19");
  assert.equal(v.status, "baseline");
  assert.equal(v.alertAdmin, false);
  ok("first run (no seal) → baseline, no alert");
}

assert.equal(tests, 8, "audit-version-migration runs exactly 8 cases");
console.log(`Audit-version-migration test passed (${tests}/8 · upgrade re-seals silently · legacy seal migrates · real same-version tamper still alerts).`);
