// C2 test — agent diagnostic self-test (pure builder).
import assert from "node:assert/strict";
import { buildDiagnostic } from "../src/shared/diagnostic.mjs";

const CHECK_IDS = ["bridge", "watchers", "servicenow", "kb-bundle", "audit", "tray", "overlay"];

// Healthy machine → 7/7 PASS.
const healthy = buildDiagnostic({
  bridge: { listening: true, conflict: false, port: 37841 },
  watchers: { running: true, count: 7, lastTickAgeMs: 4000 },
  serviceNow: { configured: false },
  kb: { bundleOk: true },
  audit: { entries: [{}, {}] },
  tray: true,
  overlay: true
});
assert.equal(healthy.total, 7, "always 7 checks");
assert.deepEqual(healthy.rows.map((r) => r.id), CHECK_IDS, "fixed check order");
assert.equal(healthy.passed, 7);
assert.equal(healthy.ok, true);
for (const r of healthy.rows) assert.equal(r.remediation, "", "passing checks carry no remediation");

// Bridge conflict + stale watchers + dead tray/overlay → those FAIL with remediation.
const sick = buildDiagnostic({
  bridge: { listening: false, conflict: true, port: 37841 },
  watchers: { running: true, count: 7, lastTickAgeMs: 5 * 60 * 1000 }, // stale > 2min
  serviceNow: { configured: true, connected: false },
  kb: { bundleOk: false },
  audit: { ok: false },
  tray: false,
  overlay: false
});
const byId = Object.fromEntries(sick.rows.map((r) => [r.id, r]));
assert.equal(byId.bridge.ok, false);
assert.ok(byId.bridge.remediation.length > 0, "failing bridge gives a remediation hint");
assert.equal(byId.watchers.ok, false, "stale heartbeat fails");
assert.equal(byId.tray.ok, false);
assert.equal(byId.overlay.ok, false);
assert.equal(byId.audit.ok, false);
// ServiceNow configured-but-unreachable is a WARN, not a hard FAIL (doesn't sink overall ok by itself).
assert.equal(byId.servicenow.severity, "warn");
assert.equal(byId.servicenow.ok, false);
assert.equal(byId["kb-bundle"].severity, "warn");
assert.equal(sick.ok, false, "hard failures sink overall ok");
assert.ok(sick.passed < 7);

// Watchers idle on a non-Windows host (lastTickAgeMs null) still counts as up if running with 7.
const idleHost = buildDiagnostic({
  bridge: { listening: true },
  watchers: { running: true, count: 7, lastTickAgeMs: null },
  serviceNow: { configured: false },
  tray: true,
  overlay: true,
  audit: { entries: [] }
});
assert.equal(idleHost.rows.find((r) => r.id === "watchers").ok, true);

// ServiceNow unconfigured is always a PASS (nothing to fail).
const noSn = buildDiagnostic({ bridge: { listening: true }, watchers: { running: true, count: 7 }, serviceNow: {}, tray: true, overlay: true, audit: { entries: [] } });
assert.equal(noSn.rows.find((r) => r.id === "servicenow").ok, true);

console.log("Diagnostic self-test passed (7 checks, PASS/WARN/FAIL + remediation).");
