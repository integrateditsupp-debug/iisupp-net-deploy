// Integrations tab RESTORE (2026-07-02, Rule 15). Ahmad's order: "all the other integrations disappeared,
// only ServiceNow is there. Put all of them including ServiceNow under Integrations tab." This test locks
// the restore so nothing can silently vanish again:
//   • the full expected nav tab set is present (11 tabs) — ServiceNow is NO LONGER a top-level tab;
//   • a top-level "Integrations" tab + panel exists;
//   • it hosts EVERY integration section: ServiceNow (full content) + Entra/365 + Remote assist + browser
//     extensions + Slack/Teams notify;
//   • the integrations backend resolves all cards real-or-empty and the IPC + preload bridge are wired.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveIntegrations, testIntegration, INTEGRATIONS } from "../src/shared/integrations.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const preload = read("src", "main", "preload.cjs");
const mainJs = read("src", "main", "main.mjs");

// ── 1 — full tab set present; ServiceNow is no longer a top-level tab; Integrations IS. ──
const navOrder = [...indexHtml.matchAll(/class="nav-item[^"]*"\s+data-tab="([^"]+)"/g)].map((m) => m[1]);
const EXPECTED_TABS = ["dashboard", "aria", "control-center", "recipes", "walkthrough",
  "compliance-privacy", "reports", "knowledge", "system", "integrations", "settings"];
assert.deepEqual(navOrder, EXPECTED_TABS, "full expected 11-tab set present, in order");
assert.ok(!navOrder.includes("servicenow"), "ServiceNow is no longer its own top-level tab (folded into Integrations)");
assert.match(indexHtml, /<section id="integrations" class="tab-panel"/, "Integrations tab panel exists");
assert.match(indexHtml, /id="integrationsGrid"/, "Integrations status grid host present");

// ── 2 — every integration section is present under the tab (ServiceNow + Entra + Remote + ext + notify). ──
const panel = indexHtml.slice(indexHtml.indexOf('id="integrations"'), indexHtml.indexOf('id="settings"'));
for (const section of ["sn-section", "entra-section", "remote-section", "ext-section", "notify-section"]) {
  assert.match(panel, new RegExp(`id="${section}"`), `Integrations hosts the ${section} section`);
}
// ServiceNow's FULL content is preserved inside its section (nothing lost — Rule 15).
for (const id of ["testServiceNow", "routingRows", "incidentList", "notifyWebhook", "snStatusNote"]) {
  assert.match(panel, new RegExp(`id="${id}"`), `ServiceNow content preserved: #${id}`);
}
// Human-readable section titles are present.
for (const title of ["ServiceNow", "Microsoft Entra", "Remote assist", "Browser extensions", "Slack / Teams notify"]) {
  assert.ok(panel.includes(title), `Integrations tab shows the "${title}" section`);
}

// ── 3 — old servicenow deep-link/route redirects into the Integrations tab (no dead links — Rule 15). ──
assert.match(renderer, /servicenow:\s*\{\s*tab:\s*"integrations",\s*anchor:\s*"sn-section"/, "old servicenow route → integrations#sn-section");
assert.match(renderer, /if \(target === "integrations"\)/, "Integrations tab loader wired (grid + incidents)");
assert.match(renderer, /function loadIntegrations/, "renderer has loadIntegrations");

// ── 4 — backend resolves every required integration, real-or-empty (never fabricated 'connected'). ──
const items = resolveIntegrations({}); // empty env → nothing configured
const ids = new Set(items.map((i) => i.id));
for (const need of ["servicenow", "entra", "remote", "chrome-ext", "edge-ext", "notify", "crm", "rsa", "word", "excel", "powerpoint", "onenote"]) {
  assert.ok(ids.has(need), `backend exposes the "${need}" integration`);
}
// With no credentials, NOTHING claims to be connected (real-or-empty honesty).
for (const it of items) {
  assert.ok(["connected", "not_configured", "error"].includes(it.status), `${it.id} has a valid status`);
  assert.notEqual(it.status, "connected", `${it.id} is never fabricated-connected with empty env`);
}
assert.equal(INTEGRATIONS.length, items.length, "every descriptor resolves");

// ── 5 — read-only test is honest: unconfigured providers report not-configured; unknown → no live test. ──
const snTest = await testIntegration("servicenow", {});
assert.equal(snTest.ok, false, "ServiceNow test with no creds → not ok");
const noTest = await testIntegration("word", {});
assert.equal(noTest.ok, false, "a doc connector has no live test → not ok, honest message");

// ── 6 — IPC + preload bridge wired. ──
assert.match(mainJs, /ipcMain\.handle\("sentinel:get-integrations"/, "main handles get-integrations");
assert.match(mainJs, /ipcMain\.handle\("sentinel:integration-test"/, "main handles integration-test");
assert.match(preload, /getIntegrations:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:get-integrations"\)/, "preload bridges getIntegrations");
assert.match(preload, /testIntegration:\s*\(id\)\s*=>\s*ipcRenderer\.invoke\("sentinel:integration-test"/, "preload bridges testIntegration");

console.log(`integrations-tab-restore test passed (11-tab set locked · Integrations hosts ${items.length} connectors incl ServiceNow+Entra+Remote+Chrome/Edge+Slack/Teams · real-or-empty · IPC wired).`);
