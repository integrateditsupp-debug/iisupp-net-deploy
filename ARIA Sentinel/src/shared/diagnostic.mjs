// diagnostic — pure builder for the Settings → About "Run diagnostic" self-test.
// Takes a snapshot of live facts (gathered by main) and returns a fixed 7-row report so an
// admin can answer "is the agent actually running?" without opening Task Manager.
// Side-effect free → unit-testable without Electron.

const WATCHER_COUNT = 7;
const HEARTBEAT_MAX_MS = 2 * 60 * 1000; // a watcher must have ticked within 2 minutes

export function buildDiagnostic(facts = {}) {
  const bridge = facts.bridge || {};
  const watchers = facts.watchers || {};
  const serviceNow = facts.serviceNow || {};
  const kb = facts.kb || {};
  const audit = facts.audit || {};

  const rows = [];

  rows.push(row(
    "bridge",
    "Local bridge port",
    Boolean(bridge.listening) && !bridge.conflict,
    bridge.conflict ? `Port ${bridge.port || 37841} in use` : bridge.listening ? `Listening on 127.0.0.1:${bridge.port || 37841}` : "Standby",
    "Run Repair ARIA (Settings → Mode) to restart the local bridge."
  ));

  const wOk = Boolean(watchers.running) && Number(watchers.count) === WATCHER_COUNT &&
    (watchers.lastTickAgeMs == null || watchers.lastTickAgeMs <= HEARTBEAT_MAX_MS);
  rows.push(row(
    "watchers",
    "Detection watchers",
    wOk,
    `${Number(watchers.count) || 0}/${WATCHER_COUNT} watchers${watchers.lastTickAgeMs != null ? ` · last tick ${Math.round(watchers.lastTickAgeMs / 1000)}s ago` : ""}`,
    "Run Repair ARIA to restart detection; on a non-Windows host watchers idle by design."
  ));

  // ServiceNow is PASS when unconfigured (nothing to fail) or configured+reachable.
  const snOk = !serviceNow.configured || Boolean(serviceNow.connected);
  rows.push(row(
    "servicenow",
    "ServiceNow connection",
    snOk,
    !serviceNow.configured ? "Not configured (local drafts only)" : serviceNow.connected ? `Connected${serviceNow.queued ? ` · ${serviceNow.queued} queued` : ""}` : "Configured but unreachable",
    "Settings → ServiceNow → Test connection. Check SN_INSTANCE_URL / SN_USER / SN_PASS.",
    serviceNow.configured && !serviceNow.connected ? "warn" : undefined
  ));

  rows.push(row(
    "kb-bundle",
    "Knowledge bundle",
    kb.bundleOk !== false,
    kb.bundleOk === false ? "Bundle hash check failed" : `Bundle ${kb.version || "current"} verified`,
    "Tray → Update knowledge re-pulls and re-verifies the signed bundle.",
    kb.bundleOk === false ? "warn" : undefined
  ));

  const auditOk = Array.isArray(audit.entries) ? true : audit.ok !== false;
  const auditCount = Array.isArray(audit.entries) ? audit.entries.length : Number(audit.count) || 0;
  rows.push(row(
    "audit",
    "Audit log integrity",
    auditOk,
    `${auditCount} local events · content-blind`,
    "The audit log is local-only and append-trimmed; reinstall if it cannot be read."
  ));

  rows.push(row(
    "tray",
    "Tray icon",
    Boolean(facts.tray),
    facts.tray ? "Gold globe present" : "Tray missing",
    "Restart ARIA Sentinel if the tray icon is missing."
  ));

  rows.push(row(
    "overlay",
    "Overlay rendering",
    Boolean(facts.overlay),
    facts.overlay ? "Globe window available" : "Overlay not created",
    "Settings → Mode → Show globe re-creates the overlay window."
  ));

  const passed = rows.filter((r) => r.ok).length;
  return {
    ok: rows.every((r) => r.ok || r.severity === "warn"),
    passed,
    total: rows.length,
    rows,
    generatedAt: facts.now || null
  };
}

function row(id, label, ok, detail, remediation, severity) {
  return {
    id,
    label,
    ok: Boolean(ok),
    severity: severity || (ok ? "ok" : "fail"),
    detail,
    remediation: ok ? "" : remediation
  };
}
