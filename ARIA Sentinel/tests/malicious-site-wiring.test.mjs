// malicious-site WIRING test (Phase B) — the scaffolds are now wired into the runtime, still
// DECISION-only. Pins:
//   1. safeDeploymentPolicy(): valid managed policy accepted; malformed -> safe defaults + error
//      codes; absent file -> unmanaged defaults with NO errors.
//   2. deploymentPolicyToEvaluator(): deployment policy maps onto evaluateMaliciousSite() input.
//   3. Extension parity: the site-prefs.js port of evaluateMaliciousSite returns EXACTLY what the
//      shared module returns across a policy × signal matrix (incl. policy_locked + enforced:false).
//   4. Three-browser sync: chrome/edge/safari ship byte-identical site-prefs/content-script/background.
//   5. Wiring greps: content-script routes decisions, background clamps them, main.mjs evaluates on
//      /browser-outcome, serves /browser-protection/policy, and rides browserPolicy on Integrations.
//   6. Privacy: every decision object is content-blind and enforced:false; no enforcement primitive
//      (child_process/exec/registry) anywhere in the decision layer.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { evaluateMaliciousSite, MALICIOUS_SITE_DECISIONS, isMaliciousSiteDecisionSafe } from "../src/shared/malicious-site-policy.mjs";
import {
  validateDeploymentPolicy, safeDeploymentPolicy, defaultDeploymentPolicy, deploymentPolicyToEvaluator
} from "../src/shared/deployment-policy-schema.mjs";
import { assertContentSafePayload } from "../src/shared/safety.mjs";

// ── 1 · safeDeploymentPolicy: managed / malformed / absent ─────────────────────────────────────
const managedRaw = {
  customerId: "acme-001",
  browserProtection: "locked-on",
  maliciousSitePolicy: { decisions: { suspicious: "escalate" } },
  overrideRules: "none",
  escalationRouting: "security-team"
};
const managed = safeDeploymentPolicy(managedRaw);
assert.equal(managed.source, "managed", "valid policy is managed");
assert.deepEqual(managed.errors, [], "valid policy has no errors");
assert.equal(managed.policy.locked, true, "locked-on marks the policy locked");
assert.equal(managed.policy.maliciousSitePolicy.decisions.suspicious, "escalate", "decision map survives");

const malformed = safeDeploymentPolicy({ customerId: "", browserProtection: "chaos" });
assert.equal(malformed.source, "default", "malformed policy falls back to defaults");
assert.ok(malformed.errors.length >= 2, "malformed policy reports validator error codes");
assert.deepEqual(malformed.policy, defaultDeploymentPolicy(), "fallback IS the safe default policy");

const absent = safeDeploymentPolicy(null, { present: false });
assert.equal(absent.source, "default", "absent file -> unmanaged defaults");
assert.deepEqual(absent.errors, [], "absent file is NOT an error state");
assert.equal(absent.policy.browserProtection, "on", "defaults keep protection on");
assert.equal(absent.policy.overrideRules, "none", "defaults grant no overrides");

// ── 2 · deploymentPolicyToEvaluator mapping ───────────────────────────────────────────────────
const evalInput = deploymentPolicyToEvaluator(managed.policy);
assert.equal(evalInput.mode, "locked-on", "browserProtection maps to evaluator mode");
assert.equal(evalInput.decisions.suspicious, "escalate", "decision map maps through");
assert.equal(evalInput.escalationRoute, "security-team", "escalation routing maps through");
assert.equal(deploymentPolicyToEvaluator(null).mode, "on", "garbage input -> safe 'on' mode");
assert.equal(deploymentPolicyToEvaluator({}).mode, "on", "missing mode -> safe 'on' mode");

// End-to-end: managed locked-on policy + user override attempt on a suspicious signal.
const lockedVerdict = evaluateMaliciousSite(evalInput, {
  signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "danger", userOverride: "allow"
});
assert.equal(lockedVerdict.policy_locked, true, "locked policy refuses the user override");
assert.equal(lockedVerdict.enforced, false, "decision layer never enforces");
assert.ok(isMaliciousSiteDecisionSafe(lockedVerdict), "end-to-end verdict is content-safe");

// ── 3 · Extension parity: site-prefs.js port === shared module ────────────────────────────────
const chromeRoot = path.resolve("chrome-extension");
const sandbox = { module: { exports: {} }, URL, console, Promise, Number, Array };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(chromeRoot, "site-prefs.js"), "utf8"), sandbox);
const prefs = sandbox.AriaSitePrefs || sandbox.module.exports;
assert.equal(typeof prefs.evaluateMaliciousSite, "function", "extension exposes evaluateMaliciousSite");
assert.equal(typeof prefs.loadMaliciousSitePolicy, "function", "extension exposes loadMaliciousSitePolicy");
assert.equal(prefs.MALICIOUS_SITE_POLICY_KEY, "ariaMaliciousSitePolicy", "managed policy key pinned");

const POLICY_MATRIX = [
  {},
  { mode: "off" },
  { mode: "locked-on" },
  { mode: "locked-off" },
  { mode: "off", silenceWhenOff: true },
  { mode: "on", decisions: { suspicious: "escalate", malicious: "escalate" } },
  { mode: "locked-on", escalationRoute: "security team level 2" }
];
const SIGNAL_MATRIX = [
  { signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "danger" },
  { signal: "BROWSER.CACHE.STALE", severity: "notice" },
  { signal: "BROWSER.SECURITY.SUSPICIOUS", severity: "danger", userOverride: "allow" },
  { threatLevel: "critical", userOverride: "allow" },
  { signal: "MALWARE.ACTIVE.DETECTED", severity: "critical" },
  { signal: "PHISH.CONFIRMED.LOGIN", severity: "high" },
  { code: "SITE.BLOCKLIST.HIT" },
  { signal: "BROWSER.CERT.ERROR", severity: "warning", userOverride: "block" },
  { signal: "", severity: "" }
];
// Cross-realm objects can't deepStrictEqual (vm realm prototypes differ) — compare a stable tuple.
const tuple = (r) => JSON.stringify([r.v, r.decision, r.reason, r.policy_locked, r.threatLevel, r.escalationRoute, r.enforced]);
let parityChecks = 0;
for (const policy of POLICY_MATRIX) {
  for (const signal of SIGNAL_MATRIX) {
    const shared = evaluateMaliciousSite(policy, signal);
    const ported = prefs.evaluateMaliciousSite(policy, signal);
    assert.equal(tuple(ported), tuple(shared), `parity for policy=${JSON.stringify(policy)} signal=${JSON.stringify(signal)}`);
    assert.equal(shared.enforced, false, "shared decision is never enforced");
    assert.ok(MALICIOUS_SITE_DECISIONS.includes(shared.decision), "decision stays in the enum");
    assert.ok(assertContentSafePayload(shared), "shared decision is content-blind");
    parityChecks += 1;
  }
}
assert.ok(parityChecks >= 60, "parity matrix actually ran");

// loadMaliciousSitePolicy: managed storage present / absent / broken all resolve safely.
const managedStore = {
  get: (key) => Promise.resolve({ [key]: { mode: "locked-on", decisions: { suspicious: "escalate" } } })
};
const loadedPolicy = await prefs.loadMaliciousSitePolicy(managedStore);
assert.equal(loadedPolicy.mode, "locked-on", "managed malicious-site policy loads");
const emptyPolicy = await prefs.loadMaliciousSitePolicy({ get: () => Promise.resolve({}) });
assert.equal(tuple(prefs.evaluateMaliciousSite(emptyPolicy, { signal: "BROWSER.CACHE.STALE" })),
  tuple(evaluateMaliciousSite({}, { signal: "BROWSER.CACHE.STALE" })), "absent managed policy -> defaults");
assert.deepEqual(Object.keys(await prefs.loadMaliciousSitePolicy(null)).length, 0, "no managed storage -> {}");

// ── 4 · Three-browser sync (chrome = edge = safari, byte-identical) ───────────────────────────
const repoRoot = path.resolve("");
for (const file of ["site-prefs.js", "content-script.js", "background.js"]) {
  const chrome = fs.readFileSync(path.join(repoRoot, "chrome-extension", file), "utf8");
  assert.equal(fs.readFileSync(path.join(repoRoot, "edge-extension", file), "utf8"), chrome, `edge ${file} in sync`);
  assert.equal(fs.readFileSync(path.join(repoRoot, "safari-extension", "Resources", file), "utf8"), chrome, `safari ${file} in sync`);
}

// ── 5 · Wiring greps ──────────────────────────────────────────────────────────────────────────
const contentJs = fs.readFileSync(path.join(chromeRoot, "content-script.js"), "utf8");
assert.match(contentJs, /decoratePolicyDecision/, "content script routes the managed decision");
assert.match(contentJs, /evaluateMaliciousSite/, "content script evaluates the malicious-site policy");
assert.match(contentJs, /loadMaliciousSitePolicy\(chrome\.storage\.managed\)/, "content script reads the MANAGED policy");
assert.match(contentJs, /policyLocked/, "content script surfaces the managed lock");
assert.match(contentJs, /block-recommend/, "content script handles block-recommend routing");
assert.doesNotMatch(contentJs, /window\.close\(|tabs\.remove|location\.replace\(/, "content script never enforces (no close/redirect)");

const backgroundJs = fs.readFileSync(path.join(chromeRoot, "background.js"), "utf8");
assert.match(backgroundJs, /safePolicyDecision/, "background clamps the decision enum");
assert.match(backgroundJs, /safeThreatLevel/, "background clamps the threat-level enum");
assert.match(backgroundJs, /policyDecision/, "background records the decision in detections");
// Lost-update guard (found via the Phase C live battery): state must be read fresh AFTER the awaited
// bridge call, or a concurrent write (clearOriginCache's lastFix) is clobbered with stale data.
const signalFn = backgroundJs.slice(backgroundJs.indexOf("async function handleBrowserSignal"), backgroundJs.indexOf("async function handleBrowserOutcome"));
assert.ok(signalFn.indexOf("postBridge") !== -1 && signalFn.indexOf("getLocalState") > signalFn.indexOf("postBridge"),
  "handleBrowserSignal reads state AFTER the bridge await (lost-update guard)");
const outcomeFn = backgroundJs.slice(backgroundJs.indexOf("async function handleBrowserOutcome"), backgroundJs.indexOf("async function clearOriginCache"));
assert.ok(outcomeFn.indexOf("postBridge") !== -1 && outcomeFn.indexOf("getLocalState") > outcomeFn.indexOf("postBridge"),
  "handleBrowserOutcome reads state AFTER the bridge await (lost-update guard)");
// Reload-type fixes kill the content script before it can report — the background self-records.
assert.match(backgroundJs, /recordActionOutcome\(payload, tab, "clear-cache"/, "cache-clear outcome recorded background-side");
assert.match(backgroundJs, /recordActionOutcome\(payload, tab, "service-worker"/, "service-worker outcome recorded background-side");
assert.match(contentJs, /actionContext/, "content ships issue context with resolve actions");

const mainJs = fs.readFileSync(path.resolve("src/main/main.mjs"), "utf8");
assert.match(mainJs, /from "\.\.\/shared\/malicious-site-policy\.mjs"/, "main imports the shared evaluator");
assert.match(mainJs, /safeDeploymentPolicy|deploymentPolicyToEvaluator/, "main loads policy via the schema module");
assert.match(mainJs, /deployment-policy\.json/, "main reads the MDM deployment-policy.json");
assert.match(mainJs, /"\/browser-protection\/policy"/, "local bridge serves the content-blind policy state");
assert.match(mainJs, /policyDecision = evaluateMaliciousSite\(/, "/browser-outcome ingestion evaluates the managed decision");
assert.match(mainJs, /browserPolicy: browserPolicyStateNow\(\)/, "Integrations payload carries browserPolicy");
assert.match(mainJs, /decisionCounts: store\.get\("browserPolicyDecisions"\)\s*\|\|\s*null/, "decision counters are real-or-empty");

const rendererJs = fs.readFileSync(path.resolve("src/renderer/renderer.js"), "utf8");
assert.match(rendererJs, /data && data\.browserPolicy/, "Integrations tab renders the policy strip");
assert.match(rendererJs, /Browser protection policy/, "policy strip is labelled");
assert.match(rendererJs, /No suspicious\/malicious site decisions recorded yet\./, "strip is real-or-empty");

// ── 6 · Decision layer stays enforcement-free + content-blind ─────────────────────────────────
for (const modulePath of ["src/shared/malicious-site-policy.mjs", "src/shared/deployment-policy-schema.mjs"]) {
  const src = fs.readFileSync(path.resolve(modulePath), "utf8");
  assert.doesNotMatch(src, /child_process|execSync|spawn|winreg|netsh|HKEY_/, `${modulePath} has no enforcement primitive`);
}
const policyState = {
  ok: true, enforced: false, source: managed.source, valid: true, errors: [],
  customerId: managed.policy.customerId, browserProtection: managed.policy.browserProtection,
  locked: managed.policy.locked, overrideRules: managed.policy.overrideRules,
  escalationRouting: managed.policy.escalationRouting, decisions: managed.policy.maliciousSitePolicy.decisions,
  decisionCounts: null
};
assert.ok(assertContentSafePayload(policyState), "the surfaced policy state is content-blind");

console.log("malicious-site WIRING test passed (safe-default policy load · deployment->evaluator mapping · extension/shared parity matrix · 3-browser sync · content-script/background/main/renderer wiring · decision-only + content-blind).");
