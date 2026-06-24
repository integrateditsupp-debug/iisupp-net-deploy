// self-heal — runtime self-audit + auto-repair decision + escalation routing. PURE: it takes a
// feature list + an injected probe fn and returns categorized results; the main-process runner wires
// the real probes (handler/IPC/hotkey/watcher) and performs the heals. Ahmad's directive: ARIA must
// self-assess, self-heal recoverable faults, and escalate the rest — never wait to be told.
import { redactPIIForClassificationOnly } from "./safety.mjs";

// Recoverable fault → the heal action by feature type.
export const HEAL_ACTIONS = { hotkey: "re-register", handler: "re-bind", ipc: "re-bind", watcher: "restart", tab: "re-render" };

/**
 * Audit a list of features against an injected probe.
 * @param {Array} features [{ id, type, recoverable?, fixType? }]
 * @param {(feature)=>boolean} probe returns true if the feature is healthy
 * @returns {Array} [{ id, type, status, healAction }]
 *   status ∈ pass | recoverable-failure | needs-code-fix | needs-design-fix
 */
export function auditFeatures(features = [], probe = () => true) {
  return (Array.isArray(features) ? features : []).map((f) => {
    let ok = false;
    try { ok = Boolean(probe(f)); } catch { ok = false; }
    let status;
    if (ok) status = "pass";
    else if (f.recoverable) status = "recoverable-failure";
    else status = f.fixType === "design" ? "needs-design-fix" : "needs-code-fix";
    return { id: f.id, type: f.type, status, healAction: status === "recoverable-failure" ? (HEAL_ACTIONS[f.type] || "retry") : null };
  });
}

export function summarizeAudit(results = []) {
  const counts = { pass: 0, "recoverable-failure": 0, "needs-code-fix": 0, "needs-design-fix": 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const flagged = results.filter((r) => r.status === "needs-code-fix" || r.status === "needs-design-fix");
  return {
    total: results.length,
    counts,
    healed: results.filter((r) => r.status === "recoverable-failure").map((r) => r.id),
    flagged,
    allClear: flagged.length === 0 && counts["recoverable-failure"] === 0,
    headline: `${counts.pass}/${results.length} features verified · ${counts["recoverable-failure"]} auto-healed · ${flagged.length} need attention`
  };
}

// Where a non-recoverable failure routes.
export function escalationRoute(status) {
  if (status === "needs-code-fix") return "claude-code-agent";
  if (status === "needs-design-fix") return "cowork-agent";
  return null;
}

/**
 * Build the sanitized escalation report. NO user content, NO file paths, NO stack traces — only the
 * symbolic feature id, type, category and the routed agent.
 */
export function buildHealReport(flagged = [], meta = {}) {
  const items = (Array.isArray(flagged) ? flagged : []).map((f) => ({
    feature: symbolic(f.id),
    type: symbolic(f.type),
    category: f.status,
    agent: escalationRoute(f.status)
  }));
  return {
    v: "self-heal-report-v1",
    ts: meta.ts || new Date().toISOString(),
    version: symbolic(meta.version) || "0.0.0",
    items
  };
}

// Strip anything that isn't a symbolic token (drops paths, emails, stack frames, free text).
function symbolic(value) {
  const raw = redactPIIForClassificationOnly(String(value == null ? "" : value));
  const token = raw.replace(/\s+/g, " ").trim();
  // Hard cap + reject obvious path/stack residue.
  if (/[\\/]|\bat \b|\.mjs|\.js\b/.test(token)) return "[redacted]";
  return token.slice(0, 60);
}

export function isHealReportSafe(report) {
  const text = JSON.stringify(report || {});
  return !/[A-Z]:\\|\/(Users|home)\/|@[a-z0-9.-]+\.[a-z]{2,}|\bat \w+ \(/i.test(text);
}
