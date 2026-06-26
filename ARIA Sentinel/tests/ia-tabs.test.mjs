// RUN 13 §1 → RUN 23d — information architecture count-lock. Consolidated 17→9 settings tabs.
// (Ahmad's directive 2026-06-21: Dashboard merges Overview+Performance+SLA; Compliance&Privacy; System
//  merges System Context+Cross-Platform; Settings merges Mode+Hotkeys+Troubleshoot+Support+About;
//  ServiceNow keeps its own tab.)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");

const navOrder = [...indexHtml.matchAll(/class="nav-item[^"]*"\s+data-tab="([^"]+)"/g)].map((m) => m[1]);
const expected = [
  "dashboard", "aria", "control-center", "recipes",   // RUN 33 PIVOT — ARIA added as the 10th tab (after Dashboard)
  "compliance-privacy", "reports", "knowledge",
  "system", "integrations", "settings"   // W5 — Integrations took ServiceNow's slot (ServiceNow is a card)
];
assert.deepEqual(navOrder, expected, "nav tabs in order (RUN 23d 9 + RUN 33 ARIA = 10)");
assert.ok(expected.length <= 10, "tab budget: ≤10 sidebar entries (hard stop)");
// Dashboard is the default active tab.
assert.match(indexHtml, /class="nav-item active"\s+data-tab="dashboard"/, "Dashboard is the default tab");

// Each nav tab has a matching tab-panel section.
for (const tab of expected) {
  assert.match(indexHtml, new RegExp(`id="${tab}"\\s+class="tab-panel`), `panel for ${tab} exists`);
}

// Branded header + animated footer globe.
assert.match(indexHtml, /Integrated IT Support Inc\./, "branded header name");
assert.match(indexHtml, /aria-living-globe/, "rail footer animated globe");

console.log(`IA-tabs test passed (${navOrder.length} tabs in order, branded header + footer).`);
