// RUN 15 §1 — self-heal engine: enumerate features, auto-heal recoverable, escalate the rest, sanitized.
import assert from "node:assert/strict";
import { auditFeatures, summarizeAudit, escalationRoute, buildHealReport, isHealReportSafe } from "../src/shared/self-heal.mjs";

const features = [
  { id: "btn-show-globe", type: "handler", recoverable: true },
  { id: "hotkey-chat", type: "hotkey", recoverable: true },
  { id: "ipc-run-recipe", type: "ipc", recoverable: false, fixType: "code" },
  { id: "tab-mode-layout", type: "tab", recoverable: false, fixType: "design" },
  { id: "watcher-disk", type: "watcher", recoverable: true }
];
// Probe: the hotkey + the code IPC + the design tab are "broken"; rest healthy.
const broken = new Set(["hotkey-chat", "ipc-run-recipe", "tab-mode-layout"]);
const results = auditFeatures(features, (f) => !broken.has(f.id));

assert.equal(results.find((r) => r.id === "btn-show-globe").status, "pass");
const hk = results.find((r) => r.id === "hotkey-chat");
assert.equal(hk.status, "recoverable-failure");
assert.equal(hk.healAction, "re-register", "recoverable hotkey auto-re-registers");
assert.equal(results.find((r) => r.id === "ipc-run-recipe").status, "needs-code-fix");
assert.equal(results.find((r) => r.id === "tab-mode-layout").status, "needs-design-fix");

// Escalation routing.
assert.equal(escalationRoute("needs-code-fix"), "claude-code-agent");
assert.equal(escalationRoute("needs-design-fix"), "cowork-agent");
assert.equal(escalationRoute("pass"), null);

// Summary.
const sum = summarizeAudit(results);
assert.equal(sum.total, 5);
assert.equal(sum.flagged.length, 2, "2 need attention");
assert.equal(sum.allClear, false);
assert.match(sum.headline, /features verified/);

// Report is sanitized: no paths, no emails, no stack frames.
const report = buildHealReport([
  { id: "C:\\Users\\jdoe\\app\\ipc.mjs leak", type: "ipc", status: "needs-code-fix" },
  { id: "clean-feature", type: "handler", status: "needs-code-fix" }
], { version: "0.1.0" });
assert.equal(report.v, "self-heal-report-v1");
assert.doesNotMatch(report.items[0].feature, /jdoe|\\|ipc\.mjs/, "path stripped from id");
assert.match(report.items[0].feature, /\[(redacted|win-path|path)\]/, "path replaced with a symbolic token");
assert.equal(report.items[1].agent, "claude-code-agent");
assert.ok(isHealReportSafe(report), "report passes the content-blind check");
assert.equal(isHealReportSafe({ items: [{ note: "at fn (C:\\x\\y.js:1)" }] }), false, "stack frame flagged unsafe");

// All-clear path.
assert.equal(summarizeAudit(auditFeatures(features, () => true)).allClear, true);

console.log("Self-heal test passed (audit · auto-heal recoverable · escalate code/design · sanitized report).");
