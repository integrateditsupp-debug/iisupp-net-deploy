// PROD 2026-10-14 (audit R27) — the headless RENDERER harness: serves the repo over HTTP (ES modules need an origin;
// node_modules must resolve for the on-device voice engine), injects a `window.sentinel` stub shaped like
// main.mjs getState() on a fresh install (the F2 contract: version · liveFixes · excludedFolders · gate.trial.days ·
// hotkeys[].combo/status · endpointStatus[].ok:null · SLA measured:false), and drives the REAL src/renderer with
// Playwright/Chromium. READ-ONLY against the repo. Not a suite itself (no .test.mjs) — tests/renderer-*.test.mjs use it.
//
// It is OPT-IN by environment: Playwright + a Chromium binary are not package.json dependencies. When either is
// absent `available()` says why and the suites skip with a clear line — never a silent green, never a red for a
// missing browser.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".cjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".wasm": "application/wasm" };

const PLAYWRIGHT_CANDIDATES = [process.env.PLAYWRIGHT_MODULE, "/opt/npm-tools/node_modules/playwright/index.mjs", path.join(ROOT, "node_modules", "playwright", "index.mjs")].filter(Boolean);
const CHROMIUM_CANDIDATES = [process.env.PLAYWRIGHT_CHROMIUM, process.env.CHROMIUM_PATH].filter(Boolean);

function findChromium() {
  for (const c of CHROMIUM_CANDIDATES) if (c && fs.existsSync(c)) return c;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME || "", ".cache", "ms-playwright")].filter(Boolean);
  for (const r of roots) {
    let entries = [];
    try { entries = fs.readdirSync(r); } catch { continue; }
    for (const e of entries.filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
      for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-win/chrome.exe", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
        const p = path.join(r, e, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

/** { ok, reason, playwright, chromium } — why the harness can or cannot run here. */
export function available() {
  const pw = PLAYWRIGHT_CANDIDATES.find((p) => fs.existsSync(p)) || null;
  const chromium = findChromium();
  if (!pw) return { ok: false, reason: "Playwright is not installed here (set PLAYWRIGHT_MODULE to its index.mjs, or npm i -g playwright)", playwright: null, chromium };
  if (!chromium) return { ok: false, reason: "no Chromium binary found (set PLAYWRIGHT_CHROMIUM, or run `npx playwright install chromium`)", playwright: pw, chromium: null };
  return { ok: true, reason: "", playwright: pw, chromium };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 30;

/** A fresh-install getState() shape (the F2 main-process contract), with overrides. */
export function firstLaunchState(overrides = {}) {
  const proFeatures = { modes: ["manual", "confirmed", "autonomous"], recipesCount: 77, adminConsole: false, updatesPublish: false, fleetView: false, complianceEvidence: false, customRecipes: false, whiteLabel: false, quarterlyPdf: true, slaTracking: true, systemInventory: true, walkthrough: true };
  const startedAt = Date.now() - 60000;
  const endsAt = new Date(startedAt + TRIAL_DAYS * DAY_MS).toISOString();
  return {
    version: "0.2.0", devMode: false, mode: "manual", dryRun: true, systemFixesEnabled: false, keepSystemFixesDryRun: false,
    liveFixes: { enabled: false, source: "store", elevation: "uac", note: "Live fixes are off — every fix previews only. Turn them on to let ARIA apply vetted fixes you confirm." },
    excludedFolders: { count: 1, label: "1 excluded folder never touched", configured: [] },
    externalAiCalls: false, reasoningMode: "local-symbolic", lastChatProvider: null,
    autonomy: { level: "approve-first", clamped: false, reason: "", mode: "manual", approverMode: "self", levels: ["observe", "safe-auto", "approve-first", "full-auto"] },
    approvals: { pending: [], decided: [], pendingCount: 0 }, deferredFixes: [],
    platformCapabilities: { platform: "windows", detect: true, fix: true, guided: true, fixEngine: "powershell", label: "Windows", copy: "Detects and fixes on this device." },
    setupPrefs: {}, pausedUntil: 0, paused: false, killed: false, killReason: "", customer: { managed: false },
    bridgePort: 37841, bridgeStatus: { listening: true, conflict: false, port: 37841, owner: null, lastError: "", killed: false, killReason: "" },
    systemChecks: [], healthScore: null, agentState: "idle", platform: "win32", autonomousPausedUntil: 0, notifyConfigured: false,
    lowPower: false, showFloatingGlobe: true, kbMeta: null, setupNeeded: true, features: proFeatures, adminConsole: false,
    ariaStopped: false,
    hotkeys: [
      { id: "chat", action: "focus-chat", label: "Open ARIA chat", combo: "CommandOrControl+Alt+A", status: "active", usedFallback: false },
      { id: "globe", action: "toggle-globe", label: "Show or hide the globe", combo: "CommandOrControl+Alt+G", status: "active", usedFallback: false },
      { id: "pause", action: "pause-24h", label: "Pause watching for 24 hours", combo: "CommandOrControl+Alt+P", status: "failed", usedFallback: false },
      { id: "kill", action: "kill-aria", label: "Kill ARIA (panic)", combo: "CommandOrControl+Alt+K", status: "active", usedFallback: false }
    ],
    auditIntegrity: { ok: true }, updates: { current: "0.2.0", autoUpdate: true, mode: "manual", history: [], rollbackTargets: [] },
    license: { mode: "manual", licensed: false, email: null, plan: null, licenseSignal: "personal", licenseMessage: "", trialEndsAt: endsAt, daysLeft: TRIAL_DAYS, trialDays: TRIAL_DAYS },
    gate: { licensed: false, plan: null, email: null, walkthroughEntitled: false, trialEndsAt: endsAt, daysLeft: TRIAL_DAYS, trialDays: TRIAL_DAYS, trial: { state: "active", remainingMs: TRIAL_DAYS * DAY_MS - 60000, endsAt, daysLeft: TRIAL_DAYS, durationMs: TRIAL_DAYS * DAY_MS, days: TRIAL_DAYS, badge: "Trial · 29d 23h left" }, pilot: { state: "not-started" }, conversion: { show: false }, unlocked: true },
    whatsNew: { show: false }, lastPrivacyCapture: null,
    endpointStatus: [{ id: "recipes", ok: true, status: 200 }, { id: "kb-bundle", ok: null, status: 0, note: "not available in this version" }, { id: "stop-codes", ok: false, status: 503, error: "no response" }],
    lastSelfRepair: null, reports: {}, routingTargets: [], recipeCatalog: { localInteractive: 2 },
    recipes: [
      { id: "printer-spooler-v1", title: "Printer stuck / queue frozen", chip: "PRINT", risk: "green", summary: "Restart the print spooler and clear the queue.", needsAdmin: true, actions: [{ id: "restart-spooler", label: "Restart Print Spooler", shell: "powershell", risk: "green", needsAdmin: true }] },
      { id: "wifi-no-internet-v1", title: "Wi-Fi connected, no internet", chip: "NETWORK", risk: "yellow", summary: "Flush DNS and renew the lease.", needsAdmin: false, actions: [{ id: "flush-dns", label: "Flush DNS", shell: "powershell", risk: "green" }] },
      { id: "guide-only-v1", title: "Outlook keeps asking for a password", chip: "APP", risk: "green", summary: "Guided steps only.", needsAdmin: false, actions: [] }
    ],
    stopCodes: [], allowedOutboundPaths: [{ id: "recipes", method: "GET", host: "iisupp.net", path: "/.netlify/functions/aria-recipes", direction: "inbound-data" }, { id: "heartbeat", method: "POST", host: "iisupp.net", path: "/.netlify/functions/aria-sentinel-heartbeat", direction: "content-blind counts" }],
    detections: [], incidents: [], transparencyLog: [], serviceNow: {}, serviceNowStatus: {},
    knowledgeSources: [], restorePoints: [], deletePrefs: { skipTripleFor: [] }, firstRunComplete: false,
    ...overrides
  };
}

/** The expired-trial, no-license, not-entitled state (day 31 for a new user). */
export function expiredState(overrides = {}) {
  const endsAt = new Date(Date.now() - DAY_MS).toISOString();
  return firstLaunchState({
    setupNeeded: false, firstRunComplete: true,
    features: { modes: [], recipesCount: 0, adminConsole: false, fleetView: false, complianceEvidence: false, customRecipes: false, whiteLabel: false, quarterlyPdf: false, slaTracking: false, systemInventory: false, walkthrough: false },
    license: { mode: "manual", licensed: false, email: null, plan: null, licenseSignal: "personal", licenseMessage: "", trialEndsAt: endsAt, daysLeft: 0, trialDays: TRIAL_DAYS },
    gate: { licensed: false, plan: null, email: null, walkthroughEntitled: false, trialEndsAt: endsAt, daysLeft: 0, trialDays: TRIAL_DAYS, trial: { state: "expired", remainingMs: 0, endsAt, daysLeft: 0, durationMs: TRIAL_DAYS * DAY_MS, days: TRIAL_DAYS, badge: "Trial · 0h 0m left" }, pilot: { state: "not-started" }, conversion: { show: false }, unlocked: false },
    ...overrides
  });
}

/** A dashboard-with-data state: detections, log rows, one pending approval, one deferred fix. */
export function dashboardWithDataState(overrides = {}) {
  const now = Date.now();
  const iso = (ms) => new Date(now - ms).toISOString();
  return firstLaunchState({
    setupNeeded: false, firstRunComplete: true,
    detections: [
      { id: "d1", ts: iso(5 * 60000), recipeId: "printer-spooler-v1", title: "Printer stuck / queue frozen", chip: "PRINT", summary: "The print spooler has a stuck job.", risk: "green" },
      { id: "d2", ts: iso(40 * 60000), recipeId: "wifi-no-internet-v1", title: "Wi-Fi connected, no internet", chip: "NETWORK", summary: "Two reachability probes failed.", risk: "yellow" }
    ],
    transparencyLog: [
      { ts: iso(2 * 60000), tag: "DONE", text: "Verification for PRINT.SPOOLER.STUCK: passed." },
      { ts: iso(3 * 60000), tag: "RUN", text: "Executing recipe PRINT.SPOOLER.STUCK" },
      { ts: iso(50 * 60000), tag: "RUN", text: "Dry-run recipe NET.DNS.FAIL" },
      { ts: iso(60 * 60000), tag: "DETECT", text: "NET.DNS.FAIL: Wi-Fi connected, no internet" },
      { ts: iso(70 * 60000), tag: "CANCEL", text: "Action countdown aborted: wifi-no-internet-v1." }
    ],
    approvals: { pending: [{ id: "a1", recipeId: "wifi-no-internet-v1", title: "Renew network address", color: "yellow", requestedBy: "detection", reason: "approve-first", createdAt: iso(10 * 60000), expiresAt: new Date(now + 20 * 60000).toISOString(), status: "pending" }], decided: [], pendingCount: 1 },
    deferredFixes: [{ recipeId: "update-stack-v1", title: "Restart Windows Update services", color: "yellow", queuedAt: iso(30 * 60000), nextWindowStart: new Date(now + 6 * 3600000).toISOString() }],
    ...overrides
  });
}

/**
 * The window.sentinel stub. `handlers` is a map of fn → implementation body (serialized source text) applied on
 * top of the defaults; everything else resolves {ok:true} and records the call in window.__calls.
 */
export function stubScript(state, handlers = {}) {
  const custom = Object.entries(handlers).map(([k, src]) => `if (prop === ${JSON.stringify(k)}) return (${src});`).join("\n");
  return `
  (function(){
    const calls = []; window.__calls = calls;
    const listeners = {};
    const STATE = ${JSON.stringify(state)};
    window.__state = STATE;
    const on = (name) => (cb) => { (listeners[name] ||= []).push(cb); return () => {}; };
    window.__emit = (name, payload) => (listeners[name] || []).forEach((cb) => cb(payload));
    const rec = (fn, args, ret) => { calls.push({ fn, args }); return ret; };
    const h = new Proxy({}, { get(_t, prop) {
      if (typeof prop !== "string" || prop === "then" || prop === "toJSON") return undefined;
      ${custom}
      if (prop === "getState") return async () => STATE;
      if (prop === "onState") return on("state");
      if (prop === "onNavigate") return on("navigate");
      if (prop === "onWalkthrough") return on("walkthrough");
      if (prop === "onFocusChat") return on("focusChat");
      if (prop === "onKillSwitch") return on("killSwitch");
      if (prop === "onUpdateAvailable") return on("updateAvailable");
      if (prop === "onUpdateNotice") return on("updateNotice");
      if (prop === "onStartupTamper") return on("startupTamper");
      if (prop === "onCountdownTick") return on("countdownTick");
      if (prop === "onDetection") return on("detection");
      if (prop === "onProcessHealth") return on("processHealth");
      if (prop === "getSetup") return async () => ({ ok: true, prefs: {}, autonomy: STATE.autonomy });
      if (prop === "getDashboard") return async () => ({ sources: {}, subline: { eventsToday: (STATE.transparencyLog || []).length, threats: 0, lastSyncAgo: "never" }, metrics: { uptime7d: null, mttr: null, accuracy: null, breaches: null, hoursSaved: null, dollarsSaved: null, deflection: null, version: STATE.version }, pending: [], activity: (STATE.transparencyLog || []).slice(0, 10), trust: "🔒 Local processing · audit integrity verified · privacy verifier not run yet — run Live capture (10s)" });
      if (prop === "getPerformance") return async () => ({ operational: { mttd: null, mttr: null, ftr: null, autoPct: null, recipeSuccess: null, detTrend: [] }, ai: { accuracy: null, kbHitRate: null, diagnoses: 0 }, usage: { activeToday: 0, asks: 0, kbHits: 0, hotkeys: 0, topTier: "tier-0" } });
      if (prop === "getSla") return async () => ({ tier: "personal", measured: false, uptime: { h24: null, d7: null, d30: null, d90: null }, compliance: { composite: null, floor: null, met: null, response: {}, resolution: {} }, thresholds: { response: {}, resolution: {} }, breaches: [], credits: {} });
      if (prop === "getCompliance") return async () => ({ audit: { ok: true, entries: 0, lastVerified: "" }, privacy: { pass: null, allowlistOk: true, sanitization: null, ts: "" }, tier0: { blocked: 0, categories: [] }, r11: { folder: "your excluded folders", attempts: 0, touched: false, ok: true, lastVerified: null }, frameworks: { soc2: { score: 0, met: 0, total: 10, badge: "gap" } }, trust: {} });
      if (prop === "getProcessHealth") return async () => ({ timestamp: new Date(Date.now() - 12000).toISOString(), scanned: 120, frozen: [], cpuHogs: [], ramHogs: [], odd: [] });
      if (prop === "listReports") return async () => ({ reports: [], prefs: {}, nextCleanupAt: null, preview: {} });
      if (prop === "getIntegrations") return async () => ({ items: [] });
      if (prop === "serviceNowList") return async () => ({ configured: false });
      if (prop === "getSystemContext") return async () => null;
      if (prop === "listBlueprints") return async () => [];
      if (prop === "listTier0") return async () => [];
      if (prop === "getUpdateState") return async () => ({ phase: "IDLE" });
      if (prop === "getStartupState") return async () => ({ enabled: true, audit: [] });
      if (prop === "getSettings") return async () => ({ showFloatingGlobe: true });
      if (prop === "getLiveFixes") return async () => STATE.liveFixes;
      if (prop === "setLiveFixes") return async (p) => rec("setLiveFixes", [p], { ...STATE.liveFixes, enabled: Boolean(p && p.enabled), note: p && p.enabled ? "Live fixes are on." : "Live fixes are off." });
      if (prop === "getHotkeyPrefs") return async () => ({ ok: true, prefs: { enabled: true, altGrSafe: false, killSwitch: true }, status: STATE.hotkeys });
      if (prop === "getExcludedFolders") return async () => ({ ok: true, ...STATE.excludedFolders });
      if (prop === "voskModelUrl") return async () => null;
      if (prop === "getWalkthrough") return async () => null;
      if (prop === "ariaStatus" || prop === "ariaLearning" || prop === "ariaMemory" || prop === "ariaAgents") return async () => ({ ok: false, data: null });
      if (prop === "startTrial") return async (email) => rec("startTrial", [email], { ok: true, started: false, status: STATE.gate });
      if (prop === "completeSetup") return async (prefs) => rec("completeSetup", [prefs], { ok: true, setup: {}, applied: null });
      if (prop === "enterLicense") return async (p) => rec("enterLicense", [p], { ok: true, plan: "pro" });
      if (prop === "isVettedRecipe") return async () => ({ vetted: true });
      if (prop === "supervisedFix") return async (p) => rec("supervisedFix", [p], { ok: true, verdict: "approve", countdown: true, countdownId: "cd-1", seconds: 10, policy: { dryRun: true }, copy: "" });
      if (prop === "cancelCountdown") return async (id) => rec("cancelCountdown", [id], { ok: true, aborted: 1, id });
      if (prop === "abortCountdown") return async () => rec("abortCountdown", [], { ok: true, aborted: 1 });
      if (prop === "approveFix") return async (id) => rec("approveFix", [id], { ok: true, approval: { id }, result: { ok: false, verdict: "policy", reason: "live-fixes-off", policy: { dryRun: true }, copy: "Preview only — live fixes are off. Turn them on in Settings → Fixes to apply this for real." } });
      if (prop === "denyFix") return async (id) => rec("denyFix", [id], { ok: true });
      if (prop === "killSwitch") return async () => rec("killSwitch", [], { ok: true, killedCount: 0, undone: false, undoAvailable: false, toast: "ARIA terminated — nothing to undo." });
      if (prop === "runRecipe") return async (id, o) => rec("runRecipe", [id, o], { ok: true, dryRun: true, message: "Would restart the Print Spooler service.", recipe: { title: "Printer stuck / queue frozen" } });
      if (prop === "chat") return async (m) => rec("chat", [m], { text: "Try restarting the print spooler.", action: "kb-match", matches: [{ score: 0.8 }] });
      if (prop === "diagnose") return async () => ({ recipeId: "printer-spooler-v1" });
      if (prop === "setMode") return async (m, o) => rec("setMode", [m, o], { ok: true });
      if (prop === "openPlanPicker" || prop === "choosePlan" || prop === "manageSubscription" || prop === "openExternal") return async (...a) => rec(prop, a, { ok: true });
      if (prop === "startAria" || prop === "stopAria") return async () => rec(prop, [], { ok: true });
      return async (...a) => rec(prop, a, { ok: true });
    } });
    window.sentinel = h;
  })();`;
}

/** Start a static server for the repo root; returns { base, close }. */
export async function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = path.normalize(path.join(ROOT, url));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/**
 * Open the real renderer with a stub state and run `fn(page, ctx)`. Returns { errors, logs, result }.
 * `handlers` overrides stub functions (source text of an arrow function).
 */
export async function withPage({ state, handlers = {}, viewport = { width: 1366, height: 768 }, page: pagePath = "/src/renderer/index.html", settle = 700 } = {}, fn) {
  const env = available();
  if (!env.ok) throw new Error(`renderer harness unavailable: ${env.reason}`);
  const { chromium } = await import(env.playwright);
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: env.chromium, args: ["--no-sandbox"] });
  const errors = [], logs = [];
  try {
    const ctx = await browser.newContext({ viewport, colorScheme: "dark" });
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.addInitScript(stubScript(state, handlers));
    await page.goto(`${srv.base}${pagePath}`);
    await page.waitForTimeout(settle);
    const result = await fn(page, { errors, logs, base: srv.base });
    return { errors, logs, result };
  } finally {
    await browser.close().catch(() => undefined);
    srv.close();
  }
}

/** Visible = present, not [hidden], and display != none → "visible" | "hidden" | "missing". */
export function visible(page, sel) {
  return page.evaluate((s) => { const el = document.querySelector(s); if (!el) return "missing"; const cs = getComputedStyle(el); return !el.hidden && cs.display !== "none" ? "visible" : "hidden"; }, sel);
}
/** Text content of one selector ("" when missing), whitespace-collapsed (textContent: no CSS text-transform). */
export function text(page, sel) {
  return page.evaluate((s) => (document.querySelector(s)?.textContent ?? "").replace(/\s+/g, " ").trim(), sel);
}
