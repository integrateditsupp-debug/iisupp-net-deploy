import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve("chrome-extension");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "ARIA Sentinel");
for (const permission of ["browsingData", "storage", "tabs", "scripting"]) {
  assert.ok(manifest.permissions.includes(permission), `manifest includes ${permission}`);
}
assert.ok(manifest.content_scripts[0].js.includes("content-script.js"));
assert.ok(fs.existsSync(path.join(root, "background.js")));
assert.ok(fs.existsSync(path.join(root, "content-script.js")));
assert.ok(fs.existsSync(path.join(root, "popup.html")));
assert.ok(!fs.readFileSync(path.join(root, "background.js"), "utf8").includes("OPENAI_API_KEY"), "extension must not reference OPENAI_API_KEY");

// ---- RUN 2: per-site disable + auto-pause -------------------------------------------------
// No new permission was added — per-site state rides on the existing "storage" grant.
assert.deepEqual(
  manifest.permissions.slice().sort(),
  ["activeTab", "alarms", "browsingData", "notifications", "scripting", "storage", "tabs"].sort(),
  "RUN 2 added no new permissions"
);

// site-prefs.js must load BEFORE the content script so AriaSitePrefs is on globalThis in time.
assert.deepEqual(manifest.content_scripts[0].js, ["site-prefs.js", "content-script.js"], "site-prefs loads first");
assert.ok(fs.existsSync(path.join(root, "site-prefs.js")), "site-prefs.js exists");

// Load the REAL site-prefs.js in a sandbox and exercise its behaviour.
const sandbox = { module: { exports: {} }, URL, console, Promise, Number, Array };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "site-prefs.js"), "utf8"), sandbox);
const prefs = sandbox.AriaSitePrefs || sandbox.module.exports;
assert.ok(prefs && typeof prefs.toggle === "function", "AriaSitePrefs API is exposed");

// Host normalisation: scheme + www. + path all collapse to a bare hostname.
assert.equal(prefs.normalizeHost("https://www.Example.com/some/path"), "example.com");
assert.equal(prefs.normalizeHost("EXAMPLE.com"), "example.com");
assert.equal(prefs.AUTO_PAUSE_MS, 5 * 60 * 1000, "auto-pause window is 5 minutes");
assert.equal(prefs.shouldAutoPause(0, 5 * 60 * 1000 + 1), true, "auto-pause fires just past 5 min");
assert.equal(prefs.shouldAutoPause(0, 60 * 1000), false, "no auto-pause inside the window");

// An in-memory stand-in for chrome.storage.sync (promise-based get/set).
function makeSyncStorage() {
  const backing = {};
  return {
    backing,
    get: (key) => Promise.resolve({ [key]: backing[key] }),
    set: (obj) => { Object.assign(backing, obj); return Promise.resolve(); }
  };
}

// Persistence across "reloads": save the disabled list, then re-load from the same backing store.
const storage = makeSyncStorage();
// (load() returns an array minted inside the vm realm, so compare by length, not deepEqual.)
assert.equal((await prefs.load(storage)).length, 0, "starts with no disabled sites");

const list = prefs.toggle(await prefs.load(storage), "https://example.com/app");
await prefs.save(storage, list);
// Simulate a fresh popup/content-script load reading the persisted store.
const afterReload = await prefs.load(storage);
assert.equal(prefs.isDisabled(afterReload, "example.com"), true, "disabled site persists across a reload");
assert.equal(prefs.isDisabled(afterReload, "other.com"), false, "only the toggled site is disabled");

// Toggle back off, persist, reload again.
await prefs.save(storage, prefs.toggle(afterReload, "example.com"));
assert.equal(prefs.isDisabled(await prefs.load(storage), "example.com"), false, "re-enabling persists too");

// Content script must actually consult the disabled list + run the auto-pause window.
const contentJs = fs.readFileSync(path.join(root, "content-script.js"), "utf8");
assert.match(contentJs, /AriaSitePrefs|prefs\./, "content script uses the shared site-prefs API");
assert.match(contentJs, /isDisabled/, "content script checks the per-site disable list");
assert.match(contentJs, /AUTO_PAUSE_MS|setTimeout/, "content script implements auto-pause");

// Popup exposes the per-site toggle and loads the shared module first.
const popupHtml = fs.readFileSync(path.join(root, "popup.html"), "utf8");
assert.match(popupHtml, /id="siteDisable"/, "popup has the On-this-site toggle");
assert.match(popupHtml, /site-prefs\.js/, "popup loads site-prefs.js");

// ---- RUN 5: all three browser manifests validate -------------------------------------------
const repoRoot = path.resolve("");
for (const dir of ["chrome-extension", "edge-extension", "safari-extension"]) {
  const mfPath = dir === "safari-extension"
    ? path.join(repoRoot, dir, "manifest.json")
    : path.join(repoRoot, dir, "manifest.json");
  const mf = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  assert.equal(mf.manifest_version, 3, `${dir} is MV3`);
  assert.ok(/ARIA Sentinel/.test(mf.name), `${dir} name`);
  assert.ok(Array.isArray(mf.content_scripts) && mf.content_scripts[0].js.includes("content-script.js"), `${dir} has content script`);
  assert.ok(mf.action && mf.action.default_popup === "popup.html", `${dir} has popup`);
  assert.ok(mf.permissions.includes("storage"), `${dir} keeps storage permission`);
}
// Edge + Safari manifests are tweaked names of the same Chrome code.
assert.equal(JSON.parse(fs.readFileSync(path.join(repoRoot, "edge-extension", "manifest.json"), "utf8")).name, "ARIA Sentinel for Edge");
assert.equal(JSON.parse(fs.readFileSync(path.join(repoRoot, "safari-extension", "manifest.json"), "utf8")).name, "ARIA Sentinel for Safari");
// Safari ships the web assets under Resources/.
assert.ok(fs.existsSync(path.join(repoRoot, "safari-extension", "Resources", "content-script.js")), "safari Resources has the content script");

// ---- RUN 5: cross-browser detect + per-site "today" counter --------------------------------
assert.equal(prefs.detectBrowser("Mozilla/5.0 ... Chrome/120 Safari/537 Edg/120.0"), "edge");
assert.equal(prefs.detectBrowser("Mozilla/5.0 ... Chrome/120 Safari/537"), "chrome");
assert.equal(prefs.detectBrowser("Mozilla/5.0 ... Version/17 Safari/605"), "safari");

const localStore = makeSyncStorage();
const day = "2026-06-19T00:00:00Z";
assert.equal(await prefs.readToday(localStore, "example.com", day), 0, "today starts at 0");
assert.equal(await prefs.bumpToday(localStore, "example.com", day), 1);
await prefs.bumpToday(localStore, "example.com", day);
assert.equal(await prefs.readToday(localStore, "example.com", day), 2, "counter increments per site/day");
assert.equal(await prefs.readToday(localStore, "other.com", day), 0, "counter is per-host");
assert.equal(await prefs.readToday(localStore, "example.com", "2026-06-20T00:00:00Z"), 0, "counter is per-day");

console.log("Chrome extension test passed (3 manifests validate · per-site disable persists · auto-pause · browser detect · today counter).");
