// RUN 23 §8 — Cowork bridge. Unit-tests the pure redaction (read-state / read-audit) + the client request
// shape (injected fetch), and meta-tests the function file (admin gate, 3 actions, report-generator wiring).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { redactAuditSlice, redactState } from "../src/shared/cowork-redact.mjs";
import { createSentinelBridge, BRIDGE_PATH } from "../cowork-tools/sentinel-bridge.mjs";

// redactAuditSlice — keeps the last N, redacts text, and 🔒 R11-drops any blocked entry.
const audit = [
  { ts: "1", tag: "RUN", text: "restart spooler" },
  { ts: "2", tag: "SECURITY", text: "C:/Users/bob/Private pics and Vids/x was scanned" },
  { ts: "3", tag: "DONE", text: "done", recipeId: "restart-print-spooler" }
];
const slice = redactAuditSlice(audit, 100);
assert.equal(slice.length, 2, "the off-limits entry is dropped entirely");
assert.doesNotMatch(JSON.stringify(slice), /private pics and vids/i);
assert.equal(slice[1].recipeId, "restart-print-spooler");
assert.equal(redactAuditSlice(audit, 1).length, 1, "limit honored");

// redactState — content-blind operational slice; private services scrubbed.
const st = redactState({ cpu: "12", ram: 41, services: ["Spooler", "C:/Users/bob/Private pics and Vids/svc"], recipes: 77, mode: "confirmed" });
assert.equal(st.cpu, 12);
assert.equal(st.ram, 41);
assert.equal(st.recipes, 77);
assert.equal(st.mode, "confirmed");
assert.deepEqual(st.services, ["Spooler"]);

// Client builds the right request (POST, x-admin-token, action in body) via injected fetch.
let captured = null;
const bridge = createSentinelBridge({
  baseUrl: "https://iisupp.net/",
  token: "secret-token",
  fetchImpl: async (url, opts) => { captured = { url, opts }; return { json: async () => ({ ok: true }) }; }
});
const res = await bridge.generateReport({ quarter: "2026-Q3", tenant: { company: "Acme" }, saveTo: ["console"] });
assert.equal(res.ok, true);
assert.equal(captured.url, `https://iisupp.net${BRIDGE_PATH}`, "trailing slash normalized");
assert.equal(captured.opts.method, "POST");
assert.equal(captured.opts.headers["x-admin-token"], "secret-token");
const sentBody = JSON.parse(captured.opts.body);
assert.equal(sentBody.action, "generate-report");
assert.equal(sentBody.quarter, "2026-Q3");
await bridge.readState({ tenant: "LIC-1" });
assert.equal(JSON.parse(captured.opts.body).action, "read-state");
await bridge.readAudit({ tenant: "LIC-1", limit: 50 });
assert.equal(JSON.parse(captured.opts.body).action, "read-audit");

// Meta-test the bridge function file.
const fn = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "netlify", "functions", "aria-sentinel-cowork-bridge.js"), "utf8");
assert.match(fn, /requireAdminToken/, "admin-token gated");
assert.match(fn, /generate-report/);
assert.match(fn, /read-state/);
assert.match(fn, /read-audit/);
assert.match(fn, /buildQuarterlyReport/, "wires report-generator");
assert.match(fn, /reportIsClean/, "defense-in-depth clean check");
assert.match(fn, /redactAuditSlice|redactState/, "R11 redaction wired");

console.log("Cowork-bridge test passed (audit/state redaction · R11 drop · client request shape · 3 actions · admin gate).");
