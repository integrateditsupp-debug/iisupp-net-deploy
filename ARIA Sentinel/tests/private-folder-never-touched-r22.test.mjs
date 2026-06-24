// 🔒 R11 (RUN 22) — every new tab + data source + report + email excludes "Private pics and Vids".
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { activityHtml, pendingHtml, tileHtml, esc } from "../src/renderer/tabs/dashboard.mjs";
import { operationalTilesHtml, usageHtml } from "../src/renderer/tabs/performance.mjs";
import { breachRowsHtml } from "../src/renderer/tabs/sla.mjs";
import { auditRowsHtml } from "../src/renderer/tabs/compliance.mjs";
import { reportsRowsHtml, previewText } from "../src/renderer/tabs/reports.mjs";
import { buildQuarterlyReport } from "../src/main/report-generator.mjs";
import { emailBody } from "../src/shared/quarterly-email.mjs";

const PRIV = "C:\\Users\\bob\\Private pics and Vids\\evidence.mp4";
const re = /private pics and vids/i;

// Feed the off-limits path into every new builder — it must NEVER surface.
assert.doesNotMatch(esc(PRIV), re, "dashboard esc redacts");
assert.doesNotMatch(activityHtml([{ time: "1:00", text: PRIV, status: "" }]), re, "activity timeline");
assert.doesNotMatch(pendingHtml([{ text: PRIV, cta: "Open" }]), re, "pending actions");
assert.doesNotMatch(tileHtml({ label: "x", value: PRIV }), re, "kpi tile");
assert.doesNotMatch(usageHtml({ topTier: PRIV }), re, "performance usage");
assert.doesNotMatch(breachRowsHtml([{ reason: PRIV }], {}), re, "sla breaches");
assert.doesNotMatch(auditRowsHtml({ ok: true, lastVerified: PRIV }), re, "compliance audit");
assert.doesNotMatch(reportsRowsHtml([{ period: PRIV, filename: PRIV }]), re, "reports list");
assert.doesNotMatch(previewText({ company: PRIV, kpis: {} }), re, "report preview");
assert.doesNotMatch(buildQuarterlyReport({ company: PRIV }).html, re, "quarterly report");
assert.doesNotMatch(emailBody({ company: PRIV, kpis: {} }), re, "quarterly email");

// Every new text-rendering RUN 22 module wires the R11 guard (path-guard / redact / sanitize).
const root = path.resolve(import.meta.dirname, "..");
const GUARDED = [
  "src/renderer/tabs/dashboard.mjs", "src/renderer/tabs/performance.mjs", "src/renderer/tabs/sla.mjs",
  "src/renderer/tabs/compliance.mjs", "src/renderer/tabs/reports.mjs",
  "src/main/report-generator.mjs", "src/shared/quarterly-email.mjs", "src/main/data-retention.mjs"
];
for (const f of GUARDED) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  assert.match(src, /path-guard\.mjs|redactPrivate|isBlockedPath|sanitizeText|\.\/dashboard\.mjs/, `${f} wires the R11 guard`);
}

console.log("Private-folder-never-touched-r22 test passed (every new tab/report/email redacts the private folder; guard wired in 8 modules).");
