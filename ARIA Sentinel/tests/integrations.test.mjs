// W5 — Integrations tab contract. Locks the 8 card descriptors, edition gating (Standalone hides the
// 4 integrated cards), the status enum (never a fake "connected"), the read-only stub testConnection()
// (resolves {ok:false} without throwing), and the renderer wiring (nav swap + panel + loader). Read-only
// throughout — no provider here opens a socket. 🔒 R11 — no PII, no filesystem writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  INTEGRATIONS, INTEGRATION_STATUSES, INTEGRATION_GROUPS,
  visibleIntegrations, resolveIntegrations, isVisibleForEdition, testIntegration
} from "../src/shared/integrations.mjs";
import { getEdition, normalizeEdition, EDITIONS } from "../src/shared/edition.mjs";
import * as directory from "../src/shared/directory.mjs";
import * as crm from "../src/shared/crm.mjs";
import * as rsa from "../src/shared/rsa-admin.mjs";
import * as office from "../src/shared/office-msgraph.mjs";
import { testConnection as serviceNowTest } from "../src/shared/servicenow.mjs";
import { readOnlyProbe } from "../src/shared/entra-graph-client.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── Test 1 — the 8 descriptors exist with the required fields + valid edition/group ──
const EXPECT_IDS = ["servicenow", "crm", "entra", "rsa", "word", "excel", "powerpoint", "onenote"];
assert.deepEqual(INTEGRATIONS.map((d) => d.id), EXPECT_IDS, "8 cards in the spec order");
for (const d of INTEGRATIONS) {
  for (const field of ["id", "name", "icon", "description", "edition", "group"]) {
    assert.ok(typeof d[field] === "string" && d[field].length, `${d.id}.${field} present`);
  }
  assert.ok(["integrated", "any"].includes(d.edition), `${d.id} edition valid`);
  assert.ok(INTEGRATION_GROUPS.includes(d.group), `${d.id} group is a known group`);
}
ok("8 descriptors with required fields + valid edition/group");

// ── Test 2 — edition gating: Integrated shows all 8, Standalone hides the 4 integrated cards ──
const integrated = visibleIntegrations("integrated");
const standalone = visibleIntegrations("standalone");
assert.equal(integrated.length, 8, "Integrated shows all 8");
assert.equal(standalone.length, 4, "Standalone shows only the 4 'any' cards");
assert.deepEqual(standalone.map((d) => d.id), ["word", "excel", "powerpoint", "onenote"], "Standalone keeps only the Office cards");
for (const d of standalone) assert.equal(d.edition, "any", "no integrated card leaks into Standalone");
assert.equal(isVisibleForEdition({ edition: "integrated" }, "standalone"), false, "integrated hidden in standalone");
assert.equal(isVisibleForEdition({ edition: "any" }, "standalone"), true, "any shown in standalone");
ok("edition gating hides the 4 integrated cards in Standalone");

// ── Test 3 — resolveIntegrations: status always in enum, never a fake 'connected' with empty env ──
const resolved = resolveIntegrations({}, "integrated");
assert.equal(resolved.length, 8, "resolve returns all 8 for Integrated");
for (const card of resolved) {
  assert.ok(INTEGRATION_STATUSES.includes(card.status), `${card.id} status in enum`);
  assert.equal(card.status, "not_configured", `${card.id} is not_configured with no creds (never a fake Connected)`);
  assert.equal(typeof card.statusDetail, "string", `${card.id} has a statusDetail string`);
}
// Standalone resolve drops the integrated cards entirely.
assert.equal(resolveIntegrations({}, "standalone").length, 4, "Standalone resolves 4 cards");
ok("resolveIntegrations clamps to the enum + never fakes Connected");

// ── Test 4 — provider stubs: getStatus is not_configured, testConnection resolves {ok:false} no-throw ──
for (const [name, mod, arg] of [
  ["directory", directory, {}], ["crm", crm, {}], ["rsa", rsa, {}],
  ["office.word", office, "word"], ["office.excel", office, "excel"]
]) {
  const s = mod.getStatus(arg);
  assert.equal(s.status, "not_configured", `${name} getStatus not_configured`);
  const r = await mod.testConnection(arg);
  assert.equal(r.ok, false, `${name} testConnection {ok:false}`);
  assert.equal(typeof r.message, "string", `${name} testConnection has a message`);
}
// ServiceNow with no creds → clean Not configured, no network, no throw.
const snNone = await serviceNowTest({});
assert.deepEqual(snNone, { ok: false, message: "Not configured" }, "ServiceNow no-creds → Not configured");
ok("provider stubs report not_configured + testConnection {ok:false} without throwing");

// ── Test 5 — Slice 2 read-only Test connection: dispatcher + Entra read-only probe (injected fetch) ──
// Every visible card's testIntegration with empty env → {ok:false} and never throws.
for (const card of resolveIntegrations({}, "integrated")) {
  const r = await testIntegration(card.id, {});
  assert.equal(r.ok, false, `${card.id} testIntegration {ok:false} with no creds`);
  assert.equal(typeof r.message, "string", `${card.id} testIntegration has a message`);
}
assert.deepEqual(await testIntegration("does-not-exist", {}), { ok: false, message: "Unknown integration" }, "unknown id handled");
// Entra read-only probe: with creds + a fake fetch it issues ONLY a token POST then a single GET (no writes).
const calls = [];
const fakeFetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || "GET" });
  if (String(url).includes("/oauth2/v2.0/token")) return { ok: true, status: 200, json: async () => ({ access_token: "t0ken" }) };
  return { ok: true, status: 200, json: async () => ({ value: [{ id: "u1" }] }) };
};
const creds = { DIRECTORY_TENANT_ID: "t", DIRECTORY_CLIENT_ID: "c", DIRECTORY_CLIENT_SECRET: "s" };
const probe = await readOnlyProbe(creds, { fetch: fakeFetch });
assert.equal(probe.ok, true, "Entra probe ok with a valid token + read");
assert.equal(calls.length, 2, "exactly two requests: token + one read");
assert.equal(calls[0].method, "POST", "token request is a POST to sign-in");
assert.equal(calls[1].method, "GET", "directory read is GET-only (read-only)");
assert.match(calls[1].url, /\/users\?\$top=1/, "reads at most one user id");
assert.ok(!calls.some((c) => /^(PUT|PATCH|DELETE|POST)$/.test(c.method) && /graph\.microsoft\.com/.test(c.url)), "no write verb ever hits Graph");
// A denied read scope is reported as a failure, not a throw.
const denied = await readOnlyProbe(creds, { fetch: async (url) => String(url).includes("token")
  ? { ok: true, status: 200, json: async () => ({ access_token: "t" }) }
  : { ok: false, status: 403, json: async () => ({}) } });
assert.equal(denied.ok, false, "403 read → not ok");
assert.match(denied.message, /scope/i, "403 surfaces a read-scope message");
ok("Slice 2 read-only test: dispatcher no-throw + Entra GET-only probe (token+read, 403 handled)");

// ── Test 6 — edition resolver: env override + safe default ──
assert.equal(getEdition({}), "integrated", "default edition is Integrated");
assert.equal(getEdition({ SENTINEL_EDITION: "standalone" }), "standalone", "env switches to Standalone");
assert.equal(getEdition({ SENTINEL_EDITION: "garbage" }), "integrated", "unknown edition falls back to Integrated");
assert.equal(normalizeEdition("STANDALONE"), "standalone", "normalizeEdition is case-insensitive");
assert.equal(normalizeEdition("nope"), null, "normalizeEdition rejects unknowns");
assert.deepEqual(EDITIONS, ["standalone", "integrated"], "two editions");
ok("edition resolver: env override + safe default + normalize");

// ── Test 7 — renderer wiring: nav swap, ServiceNow card, and Slice 2 Test connection buttons ──
const indexHtml = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");
assert.match(indexHtml, /class="nav-item"\s+data-tab="integrations"/, "Integrations nav button present");
assert.doesNotMatch(indexHtml, /class="nav-item"\s+data-tab="servicenow"/, "ServiceNow nav button removed (now a card)");
assert.match(indexHtml, /id="integrations"\s+class="tab-panel"/, "Integrations panel present");
assert.match(indexHtml, /id="servicenow"\s+class="tab-panel"/, "ServiceNow panel kept (deep-linked)");
assert.match(indexHtml, /id="integrationsGrid"/, "card grid mount present");
assert.match(renderer, /integrations:\s*"Integrations"/, "TAB_TITLES has Integrations");
assert.match(renderer, /servicenow:\s*"ServiceNow"/, "TAB_TITLES keeps ServiceNow for the deep-link");
assert.match(renderer, /target === "integrations"\)\s*loadIntegrations\(\)/, "loader fires on tab open");
assert.match(renderer, /function loadIntegrations/, "loadIntegrations defined");
assert.match(renderer, /data-goto="servicenow"/, "ServiceNow card deep-links to its incident panel");
// Slice 2 — buttons are enabled (no longer disabled) and wired to a read-only test with an inline result.
assert.match(renderer, /data-test-for="\$\{escapeHtml\(card\.id\)\}"/, "card renders a Test-connection button per id");
assert.doesNotMatch(renderer, /<button class="ghost" disabled title="Read-only connection test is enabled/, "Test button no longer disabled");
assert.match(renderer, /data-result-for="\$\{escapeHtml\(card\.id\)\}"/, "card renders an inline result line");
assert.match(renderer, /function runIntegrationTest/, "runIntegrationTest handler defined");
assert.match(renderer, /sentinel\.testIntegration/, "renderer calls the read-only testIntegration bridge");
// G-INTEGRATIONS — a successful real test flips the badge to "Connected"; a real error → "Error"; never faked.
assert.match(renderer, /badge\.classList\.add\(state\)/, "Test result flips the card badge to the verified state");
assert.match(renderer, /ok\s*\?\s*"connected"/, "badge shows connected ONLY on a real success");
ok("renderer wiring: nav + loader + ServiceNow deep-link + Slice 2 Test connection buttons");

// ── Test 8 — status badge + result styling exists ──
for (const state of ["connected", "not_configured", "error"]) {
  assert.match(css, new RegExp(`\\.int-badge\\.${state}`), `badge style for ${state}`);
}
assert.match(css, /\.integrations-grid/, "responsive grid styled");
assert.match(css, /\.integration-result\.pass/, "pass result styled");
assert.match(css, /\.integration-result\.fail/, "fail result styled");
ok("status badge + Test-connection result styles present");

// ── Test 9 — main + preload wiring (read-only IPC surface, both get + test) ──
const main = read("src", "main", "main.mjs");
const preload = read("src", "main", "preload.cjs");
assert.match(preload, /getIntegrations:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:get-integrations"\)/, "preload exposes getIntegrations");
assert.match(preload, /testIntegration:\s*\(id\)\s*=>\s*ipcRenderer\.invoke\("sentinel:integration-test", id\)/, "preload exposes testIntegration");
assert.match(main, /ipcMain\.handle\("sentinel:get-integrations"/, "main registers the status handler");
assert.match(main, /ipcMain\.handle\("sentinel:integration-test"/, "main registers the read-only test handler");
assert.match(main, /resolveIntegrations\(process\.env/, "handler resolves from env (read-only)");
assert.match(main, /testIntegration\(String\(id/, "test handler dispatches by id (read-only)");
ok("main + preload expose read-only getIntegrations + testIntegration IPC");

// ── Test 10 — G-INTEGRATIONS: real read-only health checks (injected fetch); connected ONLY on a real 2xx ──
// CRM (HubSpot): no token → Not configured; token + 200 → ok; 401 → error; GET-only; never throws.
assert.deepEqual(await crm.testConnection({}), { ok: false, message: "Not configured" }, "CRM no token → Not configured");
const crmOk = await crm.testConnection({ HUBSPOT_PRIVATE_APP_TOKEN: "t" }, { fetch: async (url, o = {}) => {
  assert.equal(o.method, "GET", "CRM read is GET-only"); assert.match(url, /api\.hubapi\.com/); return { ok: true, status: 200 };
} });
assert.equal(crmOk.ok, true, "CRM verifies on a real 200");
const crm401 = await crm.testConnection({ HUBSPOT_PRIVATE_APP_TOKEN: "t" }, { fetch: async () => ({ ok: false, status: 401 }) });
assert.equal(crm401.ok, false, "CRM 401 → not ok");
assert.match(crm401.message, /401|rejected/, "CRM surfaces the auth failure");

// Office (Graph): no creds → Not configured; creds+target+token+200 → ok; 403 → scope error; GET-only.
assert.equal((await office.testConnection("word", {})).ok, false, "Office no creds → Not configured");
const offCalls = [];
const offFetch = async (url, o = {}) => {
  offCalls.push({ url, method: o.method || "GET" });
  return String(url).includes("/oauth2/v2.0/token")
    ? { ok: true, status: 200, json: async () => ({ access_token: "tok" }) }
    : { ok: true, status: 200 };
};
const offOk = await office.testConnection("word", { DIRECTORY_TENANT_ID: "t", DIRECTORY_CLIENT_ID: "c", DIRECTORY_CLIENT_SECRET: "s", OFFICE_DRIVE_ID: "d1" }, { fetch: offFetch });
assert.equal(offOk.ok, true, "Office Word verifies on a real Graph 200");
assert.ok(offCalls.some((c) => /\/drives\/d1\/root/.test(c.url) && c.method === "GET"), "Files read is GET /drives/{id}/root (read-only)");
assert.equal((await office.testConnection("word", { DIRECTORY_TENANT_ID: "t", DIRECTORY_CLIENT_ID: "c", DIRECTORY_CLIENT_SECRET: "s" })).ok, false, "Office creds but no drive id → not verified (honest)");
const off403 = await office.testConnection("onenote", { DIRECTORY_TENANT_ID: "t", DIRECTORY_CLIENT_ID: "c", DIRECTORY_CLIENT_SECRET: "s", OFFICE_USER_ID: "u1" }, { fetch: async (url) =>
  String(url).includes("token") ? { ok: true, status: 200, json: async () => ({ access_token: "tok" }) } : { ok: false, status: 403 } });
assert.equal(off403.ok, false, "Office 403 → not ok");
assert.match(off403.message, /scope|403/i, "Office surfaces the read-scope failure");

// RSA: no config → Not configured (never faked); a real https endpoint + 200 → ok; non-https rejected.
assert.deepEqual(await rsa.testConnection({}), { ok: false, message: "Not configured" }, "RSA no config → Not configured (not faked)");
const rsaOk = await rsa.testConnection({ RSA_HEALTH_URL: "https://rsa.example/health", RSA_API_KEY: "k" }, { fetch: async (url, o = {}) => {
  assert.equal(o.method, "GET", "RSA read is GET-only"); return { ok: true, status: 200 };
} });
assert.equal(rsaOk.ok, true, "RSA verifies on a real 200 from a provided endpoint");
assert.equal((await rsa.testConnection({ RSA_HEALTH_URL: "http://insecure/health", RSA_API_KEY: "k" })).ok, false, "RSA rejects a non-https endpoint");

// getStatus never returns 'connected' (the badge only flips to connected after a real test succeeds).
for (const s of [crm.getStatus({}), rsa.getStatus({}), office.getStatus("word", {}), office.getStatus("onenote", {})]) {
  assert.equal(s.status, "not_configured", "getStatus is never a pre-emptive 'connected'");
}
// The dispatcher threads the injected fetch end-to-end.
assert.equal((await testIntegration("crm", { HUBSPOT_PRIVATE_APP_TOKEN: "t" }, { fetch: async () => ({ ok: true, status: 200 }) })).ok, true, "testIntegration dispatches CRM with injected fetch");
ok("G-INTEGRATIONS: real read-only checks (CRM/Office/RSA) — connected only on a real 2xx, never faked");

assert.equal(tests, 10, "integrations runs exactly 10 test cases");
console.log(`Integrations test passed (${tests}/10 · 8 cards · edition-gated · honest status · REAL read-only Test connection · ServiceNow→card).`);
