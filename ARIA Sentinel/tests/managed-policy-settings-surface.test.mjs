// managed-policy-settings-surface — the customer-visible ACTIVE deployment policy in Settings.
//
// The shipping (customer) renderer shows the deployment policy an IT admin deployed, READ-ONLY, and
// mirrors the browser-extension policy_locked lock: when browser protection is locked-on/locked-off the
// user-facing toggle is disabled with a "Locked by your IT admin" note. This surface is DECISION/config
// only — it never blocks a site and writes no OS/registry/proxy/DNS setting (enforced:false throughout).
//
// This suite is wiring-level (asserts the IPC + preload binding + Settings DOM + renderer logic exist and
// stay honest), matching the pattern of malicious-site-wiring.test.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

// ── 1 · main process exposes the read-only policy state over IPC ────────────────────────────────
const main = read("src/main/main.mjs");
assert.match(
  main,
  /ipcMain\.handle\("sentinel:browser-policy",\s*\(\)\s*=>\s*browserPolicyStateNow\(\)\)/,
  "main registers sentinel:browser-policy → browserPolicyStateNow (read-only, decision-only)"
);
// browserPolicyStateNow itself must stay honest: enforced:false is asserted by malicious-site-wiring;
// here we confirm the Settings channel reuses that same content-blind surface (no new enforcing path).
assert.match(main, /function browserPolicyStateNow\(\)/, "browserPolicyStateNow is the shared policy surface");

// ── 2 · preload bridges it to the renderer ──────────────────────────────────────────────────────
const preload = read("src/main/preload.cjs");
assert.match(
  preload,
  /getBrowserPolicy:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:browser-policy"\)/,
  "preload exposes window.sentinel.getBrowserPolicy"
);

// ── 3 · the Settings panel exists in the shipping renderer HTML ─────────────────────────────────
const html = read("src/renderer/index.html");
assert.match(html, /id="managedPolicyPanel"/, "Settings has the read-only managed-policy panel");
assert.match(html, /id="browserProtectionManaged"/, "Settings has the managed Browser-protection toggle");
assert.match(html, /id="browserProtectionLockNote"/, "Settings has the lock note element");
assert.ok(
  /<input id="browserProtectionManaged"[^>]*\bdisabled\b/.test(html),
  "the managed Browser-protection toggle ships disabled (read-only reflection)"
);
assert.match(html, /enforced: false/i, "Settings copy labels enforcement honestly (enforced:false)");
assert.match(html, /never blocks a site itself/i, "Settings copy states Sentinel never blocks a site itself");

// ── 4 · the renderer wires + renders it, and honours the lock ───────────────────────────────────
const rj = read("src/renderer/renderer.js");
assert.match(rj, /function loadManagedPolicy\(/, "loadManagedPolicy() defined");
assert.match(rj, /function renderManagedPolicy\(/, "renderManagedPolicy() defined");
assert.match(rj, /target === "settings"[\s\S]{0,80}loadManagedPolicy\(\)/, "the Settings tab loader calls loadManagedPolicy()");
assert.match(rj, /getBrowserPolicy/, "renderer fetches the policy via the preload bridge");
assert.match(rj, /Locked by your IT admin/, "locked-* shows a 'Locked by your IT admin' note (mirrors the extension policy_locked lock)");
assert.match(rj, /Running safe defaults · not managed/, "unmanaged installs honestly show 'Running safe defaults · not managed'");
assert.match(rj, /toggle\.disabled = true/, "the managed toggle is disabled — a read-only reflection, never a live control");
assert.match(rj, /enforced: false/i, "renderer row copy stays honest (recommends only, never blocks — enforced:false)");

// Adversarial: the Settings surface must never introduce a real enforcement/override path.
assert.doesNotMatch(rj, /renderManagedPolicy[\s\S]{0,600}(setBrowserProtection|enforceBlock|blockSite|writeRegistry|setProxy|setDns)/,
  "the managed-policy surface performs no enforcement/override (decision/config only)");

console.log("managed-policy-settings-surface test passed (IPC + preload + read-only Settings panel · locked → disabled + 'Locked by your IT admin' · safe-defaults message · enforced:false, no enforcement path).");
