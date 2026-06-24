// RUN 23 §3 — globe status panel builder. Sections render only when populated; empty state shows the
// counters; every button is CSP-safe (data-* + bind, no inline handlers) and routes to runRecipe; 🔒 R11
// values never render.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildStatusPanel } from "../src/overlay/globe-status-panel.mjs";

// Empty state → "All clear · N events scanned · CPU X% · RAM Y%".
const empty = buildStatusPanel({ snapshot: { scanned: 137 }, cpu: 12, ram: 41 });
assert.match(empty, /All clear/);
assert.match(empty, /137 events scanned/);
assert.match(empty, /CPU 12%/);
assert.match(empty, /RAM 41%/);
assert.doesNotMatch(empty, /sp-section/, "no sections when nothing is wrong");

// Frozen → a Frozen section + an "End task" button carrying the pid (low-risk).
const frozen = buildStatusPanel({ snapshot: { frozen: [{ name: "Notepad", pid: 42, since_ms: 8000 }] } });
assert.match(frozen, /Frozen/);
assert.match(frozen, /not responding 8s/);
assert.match(frozen, /End task/);
assert.match(frozen, /data-action="runRecipe"/);
assert.match(frozen, /data-pid="42"/);

// Stopped service → "Run fix" button bound to the vetted Tier-0 recipe id.
const svc = buildStatusPanel({ snapshot: {}, services: [{ service: "Spooler" }] });
assert.match(svc, /Stopped services/);
assert.match(svc, /data-recipe="restart-print-spooler"/);
assert.match(svc, /Run fix/);

// High-CPU investigate (low risk) renders a button too.
assert.match(buildStatusPanel({ snapshot: { cpuHogs: [{ name: "chrome", pid: 7, cpu: 88 }] } }), /Investigate/);

// CSP-safe: NO inline event handlers anywhere in the output.
assert.doesNotMatch(frozen, /onclick=/i);
assert.doesNotMatch(svc, /onclick=/i);

// HTML-escaping of angle brackets.
assert.match(buildStatusPanel({ snapshot: { frozen: [{ name: "<script>", pid: 1 }] } }), /&lt;script&gt;/);

// 🔒 R11 — a process name carrying the off-limits path becomes a passive card (no action), never rendered.
const blocked = buildStatusPanel({ snapshot: { frozen: [{ name: "C:/Users/bob/Private pics and Vids/x.mp4", pid: 3 }] } });
assert.doesNotMatch(blocked, /private pics and vids/i);
assert.match(blocked, /1 personal folder excluded/);

// bind wiring references the bridge contract (file-level assertion — CSP-safe addEventListener path).
const src = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "overlay", "globe-status-panel.mjs"), "utf8");
assert.match(src, /runRecipe/);
assert.match(src, /addEventListener/);
assert.match(src, /path-guard\.mjs|redactPrivate/, "R11 guard wired");

console.log("Globe-status-panel test passed (empty state · sections · CSP-safe runRecipe buttons · escaping · R11).");
