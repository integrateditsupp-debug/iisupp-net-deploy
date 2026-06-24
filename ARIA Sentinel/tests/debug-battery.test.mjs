// RUN 16 §A — Debug battery. Inject a deliberate fault into each feature class (IPC · watcher ·
// recipe · preload binding · settings-tab handler) and assert the RUN 15 self-heal engine DETECTS and
// either auto-recovers OR escalates within one audit cycle. Zero silent failures: every non-pass
// feature MUST produce a sanitized, content-blind report item with an escalation route.
import assert from "node:assert/strict";
import { auditFeatures, summarizeAudit, buildHealReport, isHealReportSafe, escalationRoute, HEAL_ACTIONS } from "../src/shared/self-heal.mjs";

// A feature universe spanning every class the packet enumerates. `recoverable`/`fixType` declare how
// a fault on that feature should be dispositioned; the injected probe decides health (false = faulty).
const FEATURES = [
  { id: "ipc:sentinel:run-recipe", type: "ipc" },
  { id: "ipc:sentinel:chat", type: "ipc" },               // hard fault → code agent
  { id: "watcher:disk", type: "watcher", recoverable: true },   // transient → auto-restart
  { id: "watcher:event-log", type: "watcher", recoverable: true },
  { id: "recipe:dns-fail-v1", type: "recipe", fixType: "design" }, // behaviour wrong → design agent
  { id: "preload:selfHeal", type: "handler" },
  { id: "tab-handler:privacy", type: "handler" },
  { id: "hotkey:chat", type: "hotkey", recoverable: true }      // re-register
];

// Inject faults: these ids fail their probe (probe returns false = unhealthy).
const FAULTY = new Set(["watcher:disk", "hotkey:chat", "ipc:sentinel:chat", "recipe:dns-fail-v1"]);
const probe = (feature) => !FAULTY.has(feature.id);

const results = auditFeatures(FEATURES, probe);
const summary = summarizeAudit(results);

// Every feature produced a result — nothing skipped.
assert.equal(results.length, FEATURES.length, "every feature was probed (no silent skips)");

// Each injected fault was detected with the right disposition.
const byId = Object.fromEntries(results.map((r) => [r.id, r]));
assert.equal(byId["watcher:disk"].status, "recoverable-failure");
assert.ok(byId["watcher:disk"].healAction, "recoverable fault carries a heal action");
assert.equal(byId["hotkey:chat"].status, "recoverable-failure");
assert.equal(byId["ipc:sentinel:chat"].status, "needs-code-fix");
assert.equal(byId["recipe:dns-fail-v1"].status, "needs-design-fix");

// Healthy features stay clean.
assert.equal(byId["watcher:event-log"].status, "pass");
assert.equal(byId["preload:selfHeal"].status, "pass");

// Escalation routing: code-fix → claude-code-agent, design-fix → cowork-agent.
assert.equal(escalationRoute("needs-code-fix"), "claude-code-agent");
assert.equal(escalationRoute("needs-design-fix"), "cowork-agent");

// Summary: of 4 injected faults, 2 auto-heal (recoverable) and 2 escalate (flagged). Not all-clear.
assert.equal(summary.total, 8);
assert.equal(summary.healed.length, 2, "2 recoverable faults auto-healed");
assert.equal(summary.flagged.length, 2, "2 hard faults escalated");
assert.equal(summary.allClear, false);
assert.ok(summary.headline, "summary has a headline");

// ZERO SILENT FAILURES: every injected fault is accounted for — healed OR escalated, never ignored.
const faultsAccountedFor = summary.healed.length + summary.flagged.length;
assert.equal(faultsAccountedFor, FAULTY.size, "every injected fault was healed or escalated (0 silent)");
const passing = results.filter((r) => r.status === "pass").map((r) => r.id);
assert.ok(![...FAULTY].some((id) => passing.includes(id)), "no faulty feature was silently marked pass");

// Every escalated feature is represented in the report with a routed agent.
const report = buildHealReport(summary.flagged, { version: "0.1.0" });
assert.equal(report.items.length, summary.flagged.length, "every escalation produced a report item");
assert.ok(report.items.every((it) => it.agent), "every report item has an escalation target");

// Report is content-blind even when a fault id smuggles a path/email.
const dirty = buildHealReport([{ id: "ipc C:\\Users\\jane\\app\\x.mjs jane@corp.com fail", type: "ipc", status: "needs-code-fix" }], { version: "0.1.0" });
assert.ok(isHealReportSafe(dirty), "report with a path/email-bearing id is sanitized to content-blind");
assert.doesNotMatch(JSON.stringify(dirty), /jane|C:\\\\Users|@corp/, "no raw path/email survives into the report");

// All-clear path: no faults → no escalations.
const clean = summarizeAudit(auditFeatures(FEATURES, () => "pass"));
assert.equal(clean.allClear, true);
assert.equal(clean.flagged.length, 0);

// Heal-action vocabulary is defined for the recoverable classes.
assert.ok(HEAL_ACTIONS && typeof HEAL_ACTIONS === "object", "HEAL_ACTIONS catalog present");

console.log(`Debug battery passed (${FEATURES.length} features probed · 4 injected faults all detected · 2 auto-recoverable · 2 escalated · 0 silent failures · report content-blind).`);
