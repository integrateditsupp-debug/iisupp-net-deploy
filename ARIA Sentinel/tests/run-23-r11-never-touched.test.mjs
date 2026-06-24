// 🔒 R11 (RUN 23) — feed the OFF-LIMITS "Private pics and Vids" path into EVERY new RUN 23 builder /
// detector / critic / redactor and assert it NEVER renders, is never enumerated, and never reaches an
// executable action or the audit log. Same severity as the no-Raymond-James rule.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recommendAction } from "../src/shared/recommend-action.mjs";
import { evaluateProcessHealth } from "../src/main/process-detectors.mjs";
import { buildStatusPanel } from "../src/overlay/globe-status-panel.mjs";
import { buildIndicator } from "../src/overlay/action-indicator.mjs";
import { countdownChatLine, countdownBannerText } from "../src/main/action-countdown.mjs";
import { superviseProposal, supervisorAuditEntry } from "../src/main/supervisor-agent.mjs";
import { recordOutcome, emptyHistory } from "../src/main/dry-run-policy.mjs";
import { redactAuditSlice, redactState } from "../src/shared/cowork-redact.mjs";

const PRIV = "C:\\Users\\bob\\Private pics and Vids\\evidence.mp4";
const re = /private pics and vids/i;
const clean = (v) => assert.doesNotMatch(typeof v === "string" ? v : JSON.stringify(v), re);

// D2 — mapper: a blocked finding yields a passive "excluded" card, never an action.
const rec = recommendAction({ type: "frozen", name: PRIV, pid: 9 });
assert.equal(rec.action, "none");
assert.equal(rec.recipeId, null);
clean(rec);

// D1 — detector: a process whose image path is off-limits is never enumerated.
const { snapshot } = evaluateProcessHealth({}, [
  { name: "vlc", pid: 1, path: PRIV, wsMB: 5000, responding: false },
  { name: "ok", pid: 2, wsMB: 10, responding: true }
], 1000);
assert.equal(snapshot.scanned, 1);
clean(snapshot);

// D3 — globe panel: surfaces the exclusion notice, never the path.
const panel = buildStatusPanel({ snapshot: { frozen: [{ name: PRIV, pid: 1 }] } });
assert.match(panel, /1 personal folder excluded/);
clean(panel);

// D4 — indicator + countdown copy.
clean(buildIndicator({ recipeId: PRIV, remaining: 8, risk: "medium" }));
clean(countdownChatLine(PRIV, 5));
clean(countdownBannerText(PRIV, 5));

// D5 — supervisor: an off-limits proposal is an absolute VETO; the audit entry leaks nothing.
const v = superviseProposal({ recipeId: "restart-print-spooler", expectedImpact: [PRIV] }, { now: 1 });
assert.equal(v.code, "R11_BLOCKED");
clean(v);
clean(supervisorAuditEntry(v, { recipeId: PRIV }));

// D6 — ledger: an outcome for an off-limits recipe id is never recorded.
const h = recordOutcome(emptyHistory(), PRIV, "success");
assert.equal(Object.keys(h.recipes).length, 0);
clean(h);

// D8 — cowork redactors: blocked audit entries dropped; blocked services dropped.
clean(redactAuditSlice([{ tag: "X", text: PRIV }, { tag: "Y", text: "fine" }]));
assert.equal(redactAuditSlice([{ tag: "X", text: PRIV }]).length, 0);
clean(redactState({ services: ["Spooler", PRIV], cpu: 1 }));

// Every new module wires the R11 guard (path-guard / redact / isBlockedPath).
const root = path.resolve(import.meta.dirname, "..");
const GUARDED = [
  "src/shared/recommend-action.mjs", "src/main/process-detectors.mjs", "src/overlay/globe-status-panel.mjs",
  "src/overlay/action-indicator.mjs", "src/main/action-countdown.mjs", "src/main/supervisor-agent.mjs",
  "src/main/dry-run-policy.mjs", "src/shared/cowork-redact.mjs", "netlify/functions/aria-sentinel-cowork-bridge.js"
];
for (const f of GUARDED) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  assert.match(src, /path-guard\.mjs|redactPrivate|isBlockedPath|cowork-redact\.mjs/, `${f} wires the R11 guard`);
}

console.log("Run-23-r11-never-touched test passed (every new builder/detector/critic/redactor excludes the private folder; guard wired in 9 modules).");
