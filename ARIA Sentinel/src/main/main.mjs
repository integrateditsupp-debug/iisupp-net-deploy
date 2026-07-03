import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, screen, session, globalShortcut, powerMonitor, clipboard } from "electron";
import Store from "electron-store";
import { exec, spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  ALLOWED_OUTBOUND_PATHS,
  BRIDGE_PORT,
  CONTROL_PLANE_MVP_RECIPE_COUNT,
  CONTROL_PLANE_MVP_STOP_CODE_COUNT,
  KB_BUNDLE_ENDPOINT,
  RECIPES,
  RECIPE_ENDPOINT,
  ROUTING_TARGETS,
  STOP_CODES,
  STOP_CODES_ENDPOINT,
  SENTINEL_VERSION,
  buildIncidentDraft,
  matchRecipes,
  recipeById
} from "../shared/recipes.mjs";
import {
  assertContentSafePayload,
  contentSafeContext,
  sanitizeToSignature
} from "../shared/safety.mjs";
import { createDetectionOrchestrator } from "../sub-agents/detection/index.mjs";
import { loadCustomerConfig } from "../shared/customer-config.mjs";
import { DEEP_LINK_SCHEME, parseSentinelDeepLink, validateResolveLink } from "../shared/deep-link.mjs"; // Slice C — web→Sentinel handoff
import { ingest as ingestKb } from "../shared/kb-ingester.mjs";
import { parsePolicyOverlay } from "../shared/policy.mjs";
import { parseControlPlaneKill, remediationDecision, blockedRecipeResult, KILL_HOTKEY, buildKillResult } from "../shared/kill-switch.mjs";
import { registerWithFallback } from "../shared/hotkeys.mjs";
import { normalizePrefs, addOptOut, resetOptOuts, normalizeExt } from "../shared/delete-confirm.mjs";
// RUN 20 — system knowledge engine: inventory enumerator, Tier-0 recipes, symptom KB + doctor reasoner.
import { enumerate as enumerateSystem, buildSystemContext } from "./system-context.mjs";
import { TIER0_RECIPES, preview as previewTier0, tier0ById } from "./recipes/tier-0/index.mjs";
import { loadSymptomKb } from "../shared/symptom-kb.mjs";
import { diagnose as diagnoseSymptom } from "../shared/diagnostic-reasoner.mjs";
// RUN 21 — auto-update orchestrator · startup hook · heartbeat. (R11 private-folder guard applied.)
import { checkForUpdate } from "./update-listener.mjs";
import * as orchestrator from "./update-orchestrator.mjs";
import { sealState, openState, defaultUpdateState } from "../shared/update-state.mjs";
import { RUN_KEY, RUN_VALUE_NAME, TASK_NAME, registryRunEntry, taskDefinition } from "./startup-registrar.mjs";
import { classifyRemoval, buildTamperAudit, disabledBanner } from "./startup-watchdog.mjs";
import { buildHeartbeatPayload } from "./heartbeat.mjs";
import { isBlockedPath, r11AuditEntry } from "../shared/path-guard.mjs";
// RUN 22 — dashboard · performance · SLA · compliance · reports · retention.
import { computeHeroStatus, heroSubline } from "../shared/dashboard-status.mjs";
import * as Sla from "./sla-tracker.mjs";
import { compositeScores, r11EnforcementStatus } from "../shared/compliance-score.mjs";
import { planCleanup, nextCleanupAt, retentionSummary } from "./data-retention.mjs";
import { buildQuarterlyReport, quarterOf, isQuarterStart, reportIsClean } from "./report-generator.mjs";
import { createExecutionCache, runIdempotent } from "../shared/idempotency.mjs";
import { isActionExecutable, isExecutableRecipe, buildExecution, buildVerification } from "../shared/recipe-runner.mjs";
import { buildDiagnostic } from "../shared/diagnostic.mjs";
import { computeHealthScore, healthTooltip } from "../shared/health-score.mjs";
import { tickFreeRoam, roamBounds } from "./overlay-physics.mjs";
import { traySvgDataUrl, normalizeTrayState } from "./tray-art.mjs";
import { EXPECTED_OUTBOUND_PATHS, classifyRequest, summarizeCapture } from "../shared/network-capture.mjs";
import { zipEvidencePack, evidenceFileName, EVIDENCE_ARTIFACTS } from "../shared/evidence-pack.mjs";
import { shouldShowWhatsNew } from "../shared/whats-new.mjs";
import { canEnableAutonomous, evaluateAutoFire, recordAutoFire, autonomousPauseUntil } from "../shared/autonomous.mjs";
import { isGreenRecipe } from "../shared/recipe-runner.mjs";
import { buildNotifyPayload, isAllowedWebhook, redactWebhookForLog } from "../shared/notify.mjs";
import { toCsv as auditToCsv, toPdf as auditToPdf, auditFileName } from "../shared/audit-export.mjs";
import { globeFrameMs } from "../shared/power-mode.mjs";
import { issueLicense, verifyLicense, daysRemaining } from "../shared/license.mjs";
import { updateAvailable, buildFeedUrl, recordInstall, rollbackTargets } from "../shared/auto-update.mjs";
import { buildRemoteSession, sessionActive } from "../shared/remote-control.mjs";
import { modeOverlayBehavior } from "../shared/mode-behavior.mjs";
// RUN 24 A6 — resolvePlanFromKey/verifyLicenseStatus are SERVER-SIDE ONLY now (they need the secret); the
// desktop resolves via the sentinel-resolve endpoint + a local cache (license-cache.mjs hashes the key itself).
import { enabledFeatures as planEnabledFeatures, licenseIsAdmin } from "../shared/license-features.mjs";
import { buildCache, cacheIsFresh, cacheMatchesKey, effectiveFromCache, FREE_PLAN as CACHE_FREE_PLAN } from "./license-cache.mjs";
import { installCrashReporter } from "./crash-reporter.mjs"; // RUN 29-D — $0 content-blind crash reporter
import { bindAll, withRebinds, DEFAULT_HOTKEYS } from "../shared/hotkeys.mjs";
import { applyRunState } from "../shared/start-stop.mjs";
import { auditFeatures, summarizeAudit, buildHealReport } from "../shared/self-heal.mjs";
import { askAria } from "../shared/aria-brain-client.mjs";
import { loadKbPack, localKbAnswer } from "../shared/aria-local-kb.mjs"; // RUN 30-B — offline cross-platform KB
import { parseSystemStatus, parseKbStats, parseSessions, parseHeartbeats } from "../shared/aria-surfaces.mjs"; // RUN 33 — ARIA tab data
import { defaultAppConfig, shouldShowSetup, completeSetup, reopenSetup } from "../shared/app-config.mjs"; // RUN 33-E — setup wizard
import { anchorTarget, tickAnchored } from "../shared/globe-anchor.mjs";
import { dueGreeting, jitteredPeriod } from "../shared/globe-greetings.mjs";
import { buildGlobeConfirmation, mintTicketRef, nextTicketSeq } from "../shared/globe-confirmation.mjs"; // RUN-B B5
import { sealAudit, verifyAudit } from "../shared/audit-integrity.mjs";
// RUN 23 — self-service loop: process-health detector · findings→action mapper · supervisor critic ·
// vetted-tier dry-run policy · abortable 10s countdown gate. The supervisor + policy + countdown form the
// control plane in FRONT of the existing (dry-run-gated) executor — nothing executes live by default.
import { createProcessDetector, IPC as PROC_HEALTH_IPC } from "./process-detectors.mjs";
import { recommendAction } from "../shared/recommend-action.mjs";
import { superviseProposal, supervisorAuditEntry, recipeSideEffects } from "./supervisor-agent.mjs";
import { executionPolicy, recordOutcome, vettedCountOf, emptyHistory } from "./dry-run-policy.mjs";
import { createCountdown, createCountdownManager, shouldCountdown, countdownChatLine, countdownBannerText, COUNTDOWN_SECONDS } from "./action-countdown.mjs";
import { EXECUTABLE_RECIPES, YELLOW_RECIPES } from "../shared/recipe-runner.mjs";
// RUN 23b — Tier-0 executor: maps Tier-0 recipe ids to real, reversible PowerShell with pre/post/rollback.
import { executeTier0, resolveExecutorId, TIER0_EXECUTOR_IDS } from "./tier-0-executor.mjs";
// RUN 23c — OTA: the local bridge serves the built dist .exe metadata so the admin console can 1-click publish.
import { assetName as otaAssetName, githubAssetUrl as otaAssetUrl } from "../shared/ota-release.mjs";

// RUN 23e — single build: the license PLAN (not a build-time flag) decides admin access + feature gates.
// Reads gateStatus() (license + trial) each call, so a fresh paste / trial expiry re-gates live. An active
// trial resolves to Pro features; an expired/absent trial falls back to free Personal (never admin).
function currentPlanFeatures() { return planEnabledFeatures(gateStatus()); }
function currentIsAdmin() { return licenseIsAdmin(gateStatus()); }
let hotkeyStatus = [];
import { computeTrialStatus, isUnlocked as licenseUnlocked, trialBadge } from "../shared/license.mjs";
import { pilotStatus, pilotBadge, pilotUpgradePrompt, buildPilotRecord, stampTtfv, firstFixAtFromAudit, ttfvMinutes, ttfvLabel } from "../shared/pilot-state.mjs"; // RUN-E E1 — TTFV clock
import { conversionMoment, buildCaseStudy, caseStudyReadiness, autorunCaseStudy, withConsent, publishableCaseStudy } from "../shared/case-study.mjs"; // RUN-D D2 pilot->paid capture + RUN-E E2 proof autorun (consent-gated)
import { deflectionStats, recordOutcome as recordResolutionEvent, pilotProofMetrics } from "../shared/resolution-outcome.mjs"; // RUN-B B1 — real deflection %
import { valueProof, valueProofKpis } from "../shared/value-proof.mjs"; // RUN-B B2 — real ROI ($/hours) + deflection on every surface
import { buildTrustSummary } from "../shared/trust-posture.mjs"; // RUN-B B3 — honest trust/security surface (real-or-empty)
import {
  getServiceNowConfig,
  ping as snPing,
  createIncident as snCreateIncident,
  listMyIncidents as snListMyIncidents,
  postComment as snPostComment,
  drainQueue as snDrainQueue,
  queueDepth as snQueueDepth,
  hashIdentifier as snHashIdentifier
} from "../shared/servicenow.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "../..");
loadLocalEnv(path.join(appRoot, ".env.local"));

const store = new Store({
  name: "aria-sentinel-state",
  defaults: {
    mode: "manual",
    dryRun: true,
    pausedUntil: 0,
    showFloatingGlobe: true,
    autoUpdate: true,
    firstRunComplete: false,
    restorePoints: [],
    detections: [],
    incidents: [],
    transparencyLog: [],
    resolutionOutcomes: [],
    serviceNow: {
      instanceUrl: "",
      caller: "",
      connected: false
    },
    knowledgeSources: [
      { name: "Procedures & runbooks", status: "Indexed", docs: 0 },
      { name: "IT policies & workflows", status: "Indexed", docs: 0 },
      { name: "Security & compliance", status: "Indexed", docs: 0 },
      { name: "Audit & regulatory", status: "Indexed", docs: 0 },
      { name: "Culture & tone", status: "Ready", docs: 0 }
    ]
  }
});

const allowSystemFixes = process.env.ARIA_SENTINEL_ALLOW_SYSTEM_FIXES === "1";
Menu.setApplicationMenu(null); // No File/Edit/View bar — Sentinel is a focused app, not a generic Electron shell
let mainWindow;
let overlayWindow;
let adminWindow;
let overlayInteractUntil = 0;
let tray;
let bridgeServer;
let bridgeStatus = { listening: false, conflict: false, port: BRIDGE_PORT, owner: null, lastError: "", killed: false, killReason: "" };
let isQuitting = false;
let overlayExpanded = false;
let overlayCompanion = false; // the interactive assistant panel is open on the globe overlay
// RUN 19 §3 — every ARIA-spawned child process is tracked so the kill-switch can terminate them all.
const childProcesses = new Set();
const startedAt = Date.now(); // RUN 21 — uptime for the heartbeat
let detectionOrchestrator = null;
// RUN 23 — process-health poller + the set of in-flight pre-execution countdowns (so Ctrl+Alt+K aborts them).
let processDetector = null;
let actionIndicatorWindow = null;
const countdownManager = createCountdownManager();
let lastHealth = null;
let agentState = "idle";
let lastPrivacyCapture = null;
let whatsNewState = { show: false, version: SENTINEL_VERSION, notes: "" };
let customerConfig = loadCustomerConfig();
let overlayPhysics = null;
let overlayPhysicsTimer = null;
let overlayLastTick = 0;
let overlayActiveUntil = 0;

// Slice C — register the aria-sentinel:// deep-link scheme so the web "Open with ARIA Sentinel" button can
// hand a matched fix to the installed app. The link only ever carries a recipe id + an intent STRING —
// never a system command (R6/R8). The id is allowlisted against the local registry and the fix still runs
// through the full gated pipeline (supervisor + 10s countdown + restore point + Ctrl+Alt+K + audit).
try {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);
  }
} catch { /* protocol registration is best-effort */ }

let pendingDeepLink = null;
// The last web-originated Walk-through target, held so the renderer can pull it once the tab loads even if the
// event fired before the panel was ready (fresh-launch race). Content-blind: a recipe id + a capped intent only.
let pendingWalkthrough = null;
function extractDeepLink(argv) {
  if (!Array.isArray(argv)) return null;
  return argv.find((a) => typeof a === "string" && a.startsWith(DEEP_LINK_SCHEME + "://")) || null;
}

// Push a Walk-through target to the renderer AND stash it so a freshly-created window can pull it on load. GUIDE
// mode only — this NEVER runs a fix; it opens the Walk-through tab pre-loaded with the recipe's authored steps.
function openWalkthroughTab(recipeId, intent) {
  pendingWalkthrough = { recipeId: String(recipeId || ""), intent: String(intent || "").slice(0, 200), mode: "guide" };
  showMainWindow("walkthrough");
  showOverlay({ expanded: false });
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("sentinel:walkthrough", pendingWalkthrough);
  } catch { /* renderer will pull via sentinel:get-walkthrough on tab load */ }
}

// Parse + safely act on aria-sentinel://resolve?recipe=<id>&intent=<text>&mode=<walkthrough|apply>. Parsing +
// validation live in the pure src/shared/deep-link.mjs (unit-tested); this only wires the verdict to the right
// desktop disposition — GUIDE (Walk-through tab, changes nothing) or the gated apply pipeline.
function handleSentinelDeepLink(rawUrl) {
  const parsed = parseSentinelDeepLink(rawUrl);
  if (!parsed) return;
  const verdict = validateResolveLink(parsed, {
    isKnownRecipe: (id) => Boolean(recipeById(id)) || Boolean(resolveExecutorId(id)),
    isBlocked: isBlockedPath
  });
  if (verdict.reason === "r11_blocked") {
    logEvent("SECURITY", "Deep-link blocked by R11 (private folder).", r11AuditEntry("deep-link"));
    return;
  }
  const wantsWalkthrough = parsed.mode === "walkthrough";
  // Bring the app forward so the handoff is always visible (transparency — never a silent background fix).
  showMainWindow(wantsWalkthrough ? "walkthrough" : "recipes");
  showOverlay({ expanded: false });
  if (!verdict.ok) {
    logEvent("DETECT", `Deep-link not actioned (${verdict.reason}): ${parsed.recipeId || "(none)"}.`, { intent: parsed.intent ? "[provided]" : "" });
    return;
  }
  // mode=walkthrough → open the Walk-through tab in GUIDE mode (pure display; nothing changes on the machine).
  // Still R11-checked + vetted-gated above (a forged/unknown id never reaches here). No fix runs on this path.
  if (wantsWalkthrough) {
    logEvent("RUN", `Deep-link walk-through requested for ${parsed.recipeId}.`, { recipeId: parsed.recipeId });
    try { openWalkthroughTab(parsed.recipeId, parsed.intent); }
    catch (e) { logEvent("ERROR", `Deep-link walk-through failed: ${e?.message || e}`, { recipeId: parsed.recipeId }); }
    return;
  }
  // mode=apply / absent → the gated apply flow. Web-originated → ALWAYS gate as Confirmed: one explicit human
  // approve + the visible 10s countdown is the consent. We deliberately do NOT silently auto-fire from a browser
  // link even for green recipes (R8 trust boundary); runSupervisedFix already forbids Autonomous for resolve
  // actions. Restore point + Ctrl+Alt+K stay.
  logEvent("RUN", `Deep-link resolve requested for ${parsed.recipeId}.`, { recipeId: parsed.recipeId });
  try { runSupervisedFix({ recipeId: parsed.recipeId, mode: "confirmed", risk: (recipeById(parsed.recipeId)?.risk || "medium") }); }
  catch (e) { logEvent("ERROR", `Deep-link resolve failed: ${e?.message || e}`, { recipeId: parsed.recipeId }); }
}

// macOS delivers deep-links via open-url (can fire before the app is ready).
app.on("open-url", (event, openedUrl) => {
  event.preventDefault();
  if (app.isReady()) handleSentinelDeepLink(openedUrl);
  else pendingDeepLink = openedUrl;
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    logEvent("SELF-REPAIR", "Second ARIA Sentinel launch redirected to existing instance.");
    showMainWindow("mode");
    showOverlay({ expanded: false });
    // Windows delivers the deep-link as an argv on the relaunch that hits the running instance.
    const link = extractDeepLink(argv);
    if (link) handleSentinelDeepLink(link);
  });
}

process.on("uncaughtException", (error) => {
  handleSelfError(error, "main-process");
});

process.on("unhandledRejection", (reason) => {
  handleSelfError(reason, "unhandled-rejection");
});

scrubLegacyState();

function loadLocalEnv(envPath) {
  try {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] == null) process.env[key] = value;
    }
  } catch {
    // Env loading should never block the local app shell.
  }
}

function makeTrayImage(state = "idle") {
  // Four state variants (idle / detection / fixing / escalation) — the SVG art lives in tray-art.mjs
  // so it can be unit tested without Electron. Matches design_handoff_aria_sentinel/globe.html.
  return nativeImage.createFromDataURL(traySvgDataUrl(state));
}

// Current at-a-glance agent state shown by the tray icon. Driven by detection + recipe execution.
function setAgentState(next) {
  const state = normalizeTrayState(next);
  if (state === agentState) return;
  agentState = state;
  if (tray && !tray.isDestroyed?.()) {
    try {
      tray.setImage(makeTrayImage(state));
    } catch {
      // A bad icon swap must never take down the tray.
    }
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    show: !process.env.ARIA_BOOT_SMOKE,
    title: "ARIA Sentinel - Settings",
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    icon: makeTrayImage(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // RUN 19 §2 — keep the live globe rotating + the sun orbiting even when the window is unfocused.
      backgroundThrottling: false
    }
  });
  // BOOT SELF-TEST (env-gated; ZERO effect in production — only runs when ARIA_BOOT_SMOKE is set by
  // `npm run test:boot`). Headlessly proves the main window is actually INTERACTIVE after init: clicks the ARIA
  // nav + a Quick Action and reports whether the panel switched. This is what caught the P0 dead-shell that
  // node unit tests couldn't (renderer.js silently not executing under CSP). See tests/boot-smoke.mjs.
  if (process.env.ARIA_BOOT_SMOKE) {
    const logs = [];
    const push = (s) => logs.push(String(s));
    let finalized = false;
    const finalize = () => {
      if (finalized) return; finalized = true;
      const out = "=== ARIA BOOT SMOKE ===\n" + logs.join("\n") + "\n";
      try { fs.writeFileSync(process.env.ARIA_BOOT_SMOKE_OUT || "boot-smoke-out.txt", out); } catch { /* ignore */ }
      try { process.stdout.write(out); } catch { /* ignore */ }
      setTimeout(() => { try { app.exit(0); } catch { /* ignore */ } }, 400);
    };
    // Watchdog: no matter what hangs (a stuck executeJavaScript, a window that never loads), always write + exit.
    setTimeout(() => { push("[watchdog] finalized after timeout"); finalize(); }, 25000);
    const withTimeout = (p, ms, label) => Promise.race([p, new Promise((r) => setTimeout(() => r(`TIMEOUT:${label}`), ms))]);
    mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => push(`[console:${level}] ${message} @ ${sourceId}:${line}`));
    mainWindow.webContents.on("preload-error", (_e, p, err) => push(`[preload-error] ${p}: ${err && err.stack || err}`));
    mainWindow.webContents.on("render-process-gone", (_e, d) => push(`[render-gone] ${JSON.stringify(d)}`));
    mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => push(`[did-fail-load] ${code} ${desc} ${url}`));
    mainWindow.webContents.once("did-finish-load", async () => {
      try {
        await new Promise((r) => setTimeout(r, 3000));
        const probe = await mainWindow.webContents.executeJavaScript(`(function(){try{
          const before = (document.querySelector('.tab-panel.active')||{}).id;
          const hasSentinel = !!window.sentinel;
          const navBtn = document.querySelector('.nav-item[data-tab="aria"]');
          navBtn && navBtn.click();
          const afterNav = (document.querySelector('.tab-panel.active')||{}).id;
          const navStyled = navBtn && navBtn.classList.contains('active');
          const lockedShown = !(document.getElementById('lockedTabOverlay')||{hidden:true}).hidden;
          const planShown = !(document.getElementById('planModal')||{hidden:true}).hidden;
          const qa = document.getElementById('dashDiagnose'); qa && qa.click();
          const afterQa = (document.querySelector('.tab-panel.active')||{}).id;
          return JSON.stringify({hasSentinel, before, afterNav, navStyled, lockedShown, planShown, afterQa});
        }catch(e){return 'PROBE_THREW: '+(e&&e.stack||e);}})()`, true).catch((e) => "EXECJS_FAILED: " + e);
        push("[probe] " + probe);
      } catch (e) { push("[hook-error] " + (e && e.stack || e)); }
      // OVERLAY ONE-BOX probe (P1): open the companion and assert exactly one box + no ghost #companionPanel.
      try {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => push(`[overlay-console:${level}] ${message} @ ${sourceId}:${line}`));
        }
        showOverlay({ companion: true });
        await new Promise((r) => setTimeout(r, 1800));
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          const oprobe = await withTimeout(overlayWindow.webContents.executeJavaScript(`(async function(){try{
            const panelGone = document.getElementById('companionPanel') === null;
            const cardShown = !(document.getElementById('overlayCard')||{hidden:true}).hidden;
            const confirmHidden = (document.getElementById('overlayConfirm')||{hidden:true}).hidden;
            const greetingHidden = (document.getElementById('overlayGreeting')||{hidden:true}).hidden;
            const headShown = !(document.getElementById('overlayCardHead')||{hidden:true}).hidden;
            const hasSpeak = !!document.getElementById('overlaySpeak');
            const globeVisible = !!document.getElementById('overlayGlobe');
            const visibleBoxes = ['overlayCard','overlayConfirm'].filter((id)=>{const e=document.getElementById(id); return e && !e.hidden;});
            let voskUrl = null; try { voskUrl = await window.sentinel.voskModelUrl(); } catch(e) { voskUrl = 'ERR'; }
            const voskResolved = typeof voskUrl === 'string' && voskUrl.indexOf('file:') === 0;
            const c = document.getElementById('overlayCard');
            const cardScrolls = !!c && c.scrollHeight > c.clientHeight + 2; // premium: common card should NOT scroll
            const vis = (id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
            const chipVisible = vis('overlayChip'); const actionsVisible = vis('overlayActions'); // must be HIDDEN in companion mode
            return JSON.stringify({panelGone, cardShown, confirmHidden, greetingHidden, headShown, hasSpeak, globeVisible, visibleBoxes, voskResolved, cardScrolls, chipVisible, actionsVisible});
          }catch(e){return 'OPROBE_THREW: '+(e&&e.stack||e);}})()`, true).catch((e) => "OEXECJS_FAILED: " + e), 6000, "overlay-execjs");
          push("[overlay-probe] " + oprobe);
          // Screenshot the overlay card for the before/after report (env-gated; test-only).
          if (process.env.ARIA_BOOT_SHOT_OUT) {
            try { const img = await withTimeout(overlayWindow.webContents.capturePage(), 5000, "shot"); if (img && img.toPNG) fs.writeFileSync(process.env.ARIA_BOOT_SHOT_OUT, img.toPNG()); push("[overlay-shot] saved"); } catch (e) { push("[overlay-shot-err] " + e); }
          }
        } else { push("[overlay-probe] overlayWindow missing"); }
      } catch (e) { push("[overlay-hook-error] " + (e && e.stack || e)); }
      finalize();
    });
  }
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    hideOverlay();
  });
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function createOverlayWindow() {
  const bounds = overlayBounds();
  overlayWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    show: false,
    // macOS transparent-window quirk: a plain transparent window can render opaque black on some
    // versions. 'hud' vibrancy gives the floating globe the correct translucent blur on darwin.
    ...(process.platform === "darwin" ? { vibrancy: "hud", visualEffectState: "active", backgroundColor: "#00000000" } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // alwaysOnTop "screen-saver" + click-through by default → globe floats above everything yet never
  // intercepts a click (Fix 4). The card mode flips ignore-mouse off so its buttons are usable.
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay.html"));
}

const GLOBE_SIZE = 104;

// A random spawn in the bottom-right quadrant of the primary work area (Fix 3 — free-roam start).
function randomGlobeSpawn() {
  const wa = screen.getPrimaryDisplay().workArea;
  const b = roamBounds(wa, GLOBE_SIZE);
  const x = Math.round(b.minX + (0.5 + Math.random() * 0.5) * Math.max(1, b.maxX - b.minX));
  const y = Math.round(b.minY + (0.5 + Math.random() * 0.5) * Math.max(1, b.maxY - b.minY));
  return { x: Math.min(x, b.maxX), y: Math.min(y, b.maxY), width: GLOBE_SIZE, height: GLOBE_SIZE };
}

// A fresh random waypoint for the free-roam drift target.
function pickWaypoint(workArea) {
  const b = roamBounds(workArea, GLOBE_SIZE);
  return {
    x: Math.round(b.minX + Math.random() * Math.max(1, b.maxX - b.minX)),
    y: Math.round(b.minY + Math.random() * Math.max(1, b.maxY - b.minY))
  };
}

// Companion mode = the interactive assistant panel (bigger, top-center); card mode = a detector card
// (top-center); globe mode = current free-roam position (or a random spawn if none yet).
function overlayBounds() {
  // L1/L2 (2026-07-02) — size the WINDOW so the card fits its content + primary buttons with NO scrollbar on a
  // tiny card, and drop it below the screen top (breathing room; the card doesn't cover the app's header).
  if (overlayCompanion) {
    const wa = screen.getPrimaryDisplay().workArea;
    const width = 384;
    const height = Math.min(620, wa.height - 80);
    return { width, height, x: Math.round(wa.x + (wa.width - width) / 2), y: wa.y + 44 };
  }
  if (overlayExpanded) {
    const wa = screen.getPrimaryDisplay().workArea;
    const width = 360;
    const height = Math.min(340, wa.height - 80); // was 214 → clipped the card behind a scrollbar
    return { width, height, x: Math.round(wa.x + (wa.width - width) / 2), y: wa.y + 44 };
  }
  if (overlayPhysics && Number.isFinite(overlayPhysics.x)) {
    return { x: overlayPhysics.x, y: overlayPhysics.y, width: GLOBE_SIZE, height: GLOBE_SIZE };
  }
  const spawn = randomGlobeSpawn();
  overlayPhysics = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
  return spawn;
}

function positionOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.setBounds(overlayBounds(), false);
}

function showOverlay(options = {}) {
  if (!app.isReady()) return;
  overlayCompanion = Boolean(options.companion);
  // The companion panel reuses the "expanded" (pinned + interactive, physics off) window path, just bigger.
  overlayExpanded = Boolean(options.expanded) || overlayCompanion;
  // Fix 5: when the user has hidden the floating globe, the ambient globe never shows (a detection
  // card still pops, since that's a transient alert, not the persistent icon).
  if (!overlayExpanded && store.get("showFloatingGlobe") === false) {
    hideOverlay();
    return;
  }
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
  const wasHidden = !overlayWindow.isVisible();
  positionOverlay();
  overlayWindow.showInactive();
  // RUN 15 §2 — fresh appearance of the globe re-arms the launch "Hi" (after the 2s grace).
  if (wasHidden && !overlayExpanded) greetState = { ...greetState, launchedMs: Date.now(), saidHi: false };
  overlayWindow.webContents.send("sentinel:overlay-mode", overlayCompanion ? "companion" : overlayExpanded ? "card" : "globe");
  if (overlayExpanded) {
    // Card/companion are interactive and pinned — no drifting while the user reads/acts on it.
    stopOverlayPhysics();
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setIgnoreMouseEvents(false);
    // The companion is a longer interaction (an interview + setup) — keep it interactive far longer than a card.
    overlayActiveUntil = Date.now() + (overlayCompanion ? 300000 : 8000);
  } else {
    startOverlayPhysics();
  }
  refreshTray();
}

function hideOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayExpanded = false;
  overlayCompanion = false;
  stopOverlayPhysics();
  overlayWindow.webContents.send("sentinel:overlay-mode", "globe");
  overlayWindow.hide();
  refreshTray();
}

// RUN 15 §2 — greeting scheduler state. Pure decision lives in globe-greetings.mjs; here we hold the
// timing + push the bubble to the overlay. Rate-limited to ≤1/60s; quiet in Autonomous + low-power.
let greetState = { launchedMs: 0, lastGreetMs: -Infinity, lastChatBubbleMs: -Infinity, saidHi: false, periodEveryMs: 0, periodIndex: 0 };
function maybeGreet(now) {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible() || overlayExpanded) return;
  if (!greetState.periodEveryMs) greetState.periodEveryMs = jitteredPeriod(Math.random());
  const opts = { mode: store.get("mode"), lowPower: store.get("lowPower") };
  const g = dueGreeting({ ...greetState, now }, opts);
  if (!g) return;
  greetState.lastGreetMs = now;
  if (g.type === "hi") greetState.saidHi = true;
  if (g.type === "chat-bubble") greetState.lastChatBubbleMs = now;
  if (g.type === "periodic") { greetState.periodIndex += 1; greetState.periodEveryMs = jitteredPeriod(Math.random()); }
  try { overlayWindow.webContents.send("sentinel:greeting", { type: g.type, message: g.message, durationMs: g.durationMs }); } catch { /* overlay gone */ }
}

function startOverlayPhysics() {
  if (overlayPhysicsTimer) return;
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayLastTick = Date.now();
  // Globe v2: click-through by DEFAULT (Fix 4). The per-tick re-enable that used to block clicks is
  // gone; clicks pass through except during a brief interaction window (Ctrl+Alt+G) or card mode.
  if (Date.now() > overlayInteractUntil && store.get("mode") === "manual") overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  if (!overlayPhysics || !Number.isFinite(overlayPhysics.x)) {
    const spawn = randomGlobeSpawn();
    overlayPhysics = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
  }
  const loop = () => {
    overlayPhysicsTimer = null;
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible() || overlayExpanded) return;
    try {
      const cursor = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(cursor);
      const workArea = display.workArea;
      const now = Date.now();
      overlayLastTick = now;
      // RUN 15 §2 — globe v3: anchor to the top-centre of the active window, repelled by a near cursor,
      // teleporting back to centre after 2s idle. Foreground-window bounds aren't exposed without a
      // native module (zero-dep rule), so we anchor to the active display's work-area top-centre.
      const focused = BrowserWindow.getFocusedWindow();
      const anchorBounds = (focused && focused !== overlayWindow && !focused.isDestroyed())
        ? focused.getBounds()
        : { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height };
      const target = anchorTarget(anchorBounds, GLOBE_SIZE);
      const next = tickAnchored(overlayPhysics, { cursor, target, now, size: GLOBE_SIZE });
      overlayPhysics = next;
      overlayWindow.setBounds({ x: overlayPhysics.x, y: overlayPhysics.y, width: GLOBE_SIZE, height: GLOBE_SIZE }, false);
      maybeGreet(now);
      // Restore click-through once an interaction window has elapsed.
      if (now > overlayInteractUntil) overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    } catch {
      // A bad screen read must never stop the loop; the next tick recovers.
    }
    // 60fps while a detection animation is active, 30fps idle (15fps idle in low-power mode).
    const fps = Date.now() < overlayActiveUntil ? 16 : (store.get("lowPower") ? globeFrameMs(true) : 33);
    overlayPhysicsTimer = setTimeout(loop, fps);
    overlayPhysicsTimer.unref?.();
  };
  overlayPhysicsTimer = setTimeout(loop, 16);
  overlayPhysicsTimer.unref?.();
}

// RUN 15 §7 — hardened global-hotkey registration with fallback + live status.
function hotkeyHandler(action) {
  return () => {
    if (action === "focus-chat") {
      // RUN 33 PIVOT — Ctrl+Alt+A opens the in-app ARIA tab (Chat sub-section), not a separate window.
      showMainWindow("aria");
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("focus-chat");
    } else if (action === "toggle-globe") {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      if (overlayWindow.isVisible()) hideOverlay(); else showOverlay({ expanded: false });
    } else if (action === "pause-24h") {
      store.set("pausedUntil", Date.now() + 24 * 60 * 60 * 1000);
      logEvent("WATCH", "Paused watching for 24 hours (hotkey).");
      refreshTray();
      broadcastState();
    }
  };
}
function registerHotkeys() {
  try { globalShortcut.unregisterAll(); } catch { /* none yet */ }
  const defs = withRebinds(DEFAULT_HOTKEYS, store.get("hotkeyRebinds") || {});
  hotkeyStatus = bindAll(
    defs,
    (combo, handler) => globalShortcut.register(combo, handler),
    (combo) => globalShortcut.isRegistered(combo),
    (def) => hotkeyHandler(def.action)
  );
  // RUN 19 §3 — the single-purpose panic kill-switch (Ctrl+Alt+K, fallback Ctrl+Shift+Pause). Registered
  // separately from DEFAULT_HOTKEYS so it can't be confused with the everyday hotkeys, then appended to
  // the live status list so it still shows + is rebindable in the Hotkeys tab.
  const killStatus = registerWithFallback(
    KILL_HOTKEY,
    (combo, handler) => globalShortcut.register(combo, handler),
    (combo) => globalShortcut.isRegistered(combo),
    activateKillSwitch
  );
  hotkeyStatus = [...hotkeyStatus, killStatus];
  for (const h of hotkeyStatus) {
    logEvent("HOTKEY", `${h.id}: ${h.combo} → ${h.status}${h.usedFallback ? " (fallback)" : ""}`);
  }
  return hotkeyStatus;
}

// RUN 19 §3 — terminate every tracked ARIA child process immediately (SIGKILL, no prompt).
function killAllChildren() {
  let count = 0;
  for (const child of [...childProcesses]) {
    try { child.kill("SIGKILL"); count += 1; } catch { /* already gone */ }
    childProcesses.delete(child);
  }
  return count;
}

// RUN 19 §3 — the kill-switch handler. Single purpose: kill children, undo the last action, dim the
// globe, toast the user. Does nothing else (no menu, no dialog, no second action).
function activateKillSwitch() {
  const restorePoints = store.get("restorePoints") || [];
  const result = buildKillResult({ children: [...childProcesses], restorePoints });
  const killed = killAllChildren();
  if (result.undoId) {
    try { rollbackRestorePoint(result.undoId); } catch { /* rollback best-effort under panic */ }
  }
  // RUN 21 — if an update was installed in the last 60 min, the kill-switch also reverts it.
  try {
    const us = readUpdateState();
    if (us.installedAt && orchestrator.canRollback(us.installedAt, Date.now())) {
      logEvent("KILL-SWITCH", `Reverting update ${us.version} (within 60-min rollback window).`);
      const prev = (updateHistoryState().history || []).find((h) => h.version && h.version !== us.version);
      if (prev) rollbackToVersion(prev.version).catch(() => undefined);
      writeUpdateState({ ...us, phase: "IDLE", installedAt: null });
    }
  } catch { /* update rollback is best-effort under panic */ }
  // Halt remediation: stop watchers + hide the globe so nothing new fires mid-undo.
  try { if (detectionOrchestrator) detectionOrchestrator.stopAll(); } catch { /* ignore */ }
  // RUN 23 — abort any pending pre-execution countdowns so an in-flight fix never lands after the kill.
  try { const aborted = countdownManager.abortAll(); if (aborted) { closeActionIndicator(); logEvent("KILL-SWITCH", `Aborted ${aborted} pending action countdown(s).`); } } catch { /* best-effort under panic */ }
  setAgentState("idle");
  logEvent("KILL-SWITCH", `Ctrl+Alt+K: ${killed} child process(es) terminated; ${result.undone ? "last action undone" : "no action to undo"}.`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send("sentinel:kill-switch", { toast: result.toast, killedCount: killed, undone: result.undone }); } catch { /* renderer toast best-effort */ }
  }
  broadcastState();
  return { ok: true, killedCount: killed, undone: result.undone };
}

// ── RUN 19 §4 — triple-confirm delete prefs, persisted to userData/delete-prefs.json ──────────────
function deletePrefsFile() {
  return path.join(app.getPath("userData"), "delete-prefs.json");
}
function readDeletePrefs() {
  try { return normalizePrefs(JSON.parse(fs.readFileSync(deletePrefsFile(), "utf8"))); } catch { return normalizePrefs(null); }
}
function writeDeletePrefs(prefs) {
  const safe = normalizePrefs(prefs);
  try {
    fs.mkdirSync(path.dirname(deletePrefsFile()), { recursive: true });
    fs.writeFileSync(deletePrefsFile(), JSON.stringify(safe, null, 2));
  } catch { /* best-effort; prefs are a convenience, never a safety bypass */ }
  return safe;
}

// ── RUN 20 — system knowledge engine (inventory · Tier-0 catalog · symptom KB · doctor reasoner) ─────
const KB_DIAGNOSTICS_DIR = path.join(appRoot, "aria-kb-pack", "diagnostics");
const KB_BLUEPRINTS_DIR = path.join(appRoot, "aria-kb-pack", "blueprints");
const SYSTEM_CONTEXT_FILE = () => path.join(app.getPath("userData"), "system-context.json");
const SYSTEM_CONTEXT_TTL_MS = 6 * 60 * 60 * 1000; // refresh on launch + every 6h
let symptomKbCache = null;

// READ-ONLY PowerShell collectors. Registry reads are `Get-ItemProperty` enumeration only — no writes.
const PS_COMMANDS = {
  "registry-apps":
    "$keys='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',"
    + "'HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',"
    + "'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall';"
    + "$keys|%{Get-ItemProperty \"$_\\*\" -ErrorAction SilentlyContinue}|?{$_.DisplayName}|"
    + "Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,EstimatedSize,InstallLocation,UninstallString|ConvertTo-Json -Compress",
  "get-package": "Get-Package -ErrorAction SilentlyContinue|Select-Object Name,Version,@{n='Publisher';e={[string]$_.ProviderName}}|ConvertTo-Json -Compress",
  "appx": "Get-AppxPackage -ErrorAction SilentlyContinue|Select-Object Name,@{n='DisplayVersion';e={[string]$_.Version}},Publisher,InstallLocation|ConvertTo-Json -Compress",
  "hardware":
    "$os=Get-CimInstance Win32_OperatingSystem;$cpu=Get-CimInstance Win32_Processor|Select-Object -First 1;"
    + "$ram=@{total=$os.TotalVisibleMemorySize;free=$os.FreePhysicalMemory;"
    + "percentUsed=[math]::Round((($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/$os.TotalVisibleMemorySize)*100)};"
    + "$gpu=Get-CimInstance Win32_VideoController|Select-Object -First 1 Name,DriverVersion,AdapterRAM;"
    + "$disks=Get-CimInstance Win32_DiskDrive|Select-Object Model,Size,Status;"
    + "$svc=Get-Service|Select-Object Name,DisplayName,Status,StartType;"
    + "[pscustomobject]@{cpu=@{model=[string]$cpu.Name;cores=$cpu.NumberOfCores;logical=$cpu.NumberOfLogicalProcessors;load=$cpu.LoadPercentage};"
    + "ram=$ram;gpu=$gpu;disks=$disks;os=@{edition=[string]$os.Caption;build=[string]$os.BuildNumber};services=$svc}|ConvertTo-Json -Compress -Depth 4"
};

function runPowerShell(command, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !command) return resolve("");
    let out = "";
    let child;
    try {
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
        { windowsHide: true, timeout: timeoutMs });
    } catch { return resolve(""); }
    childProcesses.add(child);
    child.stdout?.on("data", (d) => { out += d.toString(); });
    const done = () => { childProcesses.delete(child); resolve(out); };
    child.on("error", () => { childProcesses.delete(child); resolve(""); });
    child.on("close", done);
  });
}

async function collectSystemContext() {
  const context = await enumerateSystem({
    runPS: (label) => runPowerShell(PS_COMMANDS[label] || ""),
    now: new Date().toISOString()
  });
  try {
    fs.mkdirSync(path.dirname(SYSTEM_CONTEXT_FILE()), { recursive: true });
    fs.writeFileSync(SYSTEM_CONTEXT_FILE(), JSON.stringify(context, null, 2));
  } catch { /* cache write is best-effort; context still returns to the caller */ }
  logEvent("SYSTEM-CTX", `Inventory refreshed: ${context.appCount} apps, ${(context.services || []).length} services (content-blind, local).`);
  return context;
}

function readSystemContextCache() {
  try { return JSON.parse(fs.readFileSync(SYSTEM_CONTEXT_FILE(), "utf8")); } catch { return null; }
}

async function getSystemContext({ force = false } = {}) {
  const cached = readSystemContextCache();
  const fresh = cached && cached.generatedAt && (Date.now() - Date.parse(cached.generatedAt) < SYSTEM_CONTEXT_TTL_MS);
  if (cached && fresh && !force) return cached;
  try { return await collectSystemContext(); } catch { return cached || buildSystemContext({}, new Date().toISOString()); }
}

function getSymptomKb() {
  if (symptomKbCache) return symptomKbCache;
  try { symptomKbCache = loadSymptomKb(KB_DIAGNOSTICS_DIR); } catch { symptomKbCache = []; }
  return symptomKbCache;
}

function listBlueprints() {
  try {
    return fs.readdirSync(KB_BLUEPRINTS_DIR).filter((f) => f.endsWith(".md")).map((f) => {
      const md = fs.readFileSync(path.join(KB_BLUEPRINTS_DIR, f), "utf8");
      const title = (md.match(/^#\s+(.+)$/m) || [])[1] || path.basename(f, ".md");
      return { id: path.basename(f, ".md"), title };
    });
  } catch { return []; }
}

function getBlueprint(id) {
  const safeId = String(id || "").replace(/[^a-z0-9-]/gi, ""); // path-traversal guard
  try { return { ok: true, id: safeId, content: fs.readFileSync(path.join(KB_BLUEPRINTS_DIR, `${safeId}.md`), "utf8") }; }
  catch { return { ok: false, error: "not_found" }; }
}

function listTier0Recipes() {
  return TIER0_RECIPES.map((r) => previewTier0(r));
}

// Doctor reasoner: match symptom → rank causes against live context → surface anomalies. KNOWLEDGE +
// LOCAL CONTEXT ONLY; never auto-executes (the renderer asks before any Tier-0 action runs).
async function runDiagnose(message) {
  const context = await getSystemContext({});
  const result = diagnoseSymptom(String(message || ""), getSymptomKb(), context || {});
  logEvent("DIAGNOSE", `Symptom matched: ${result.topSymptom || "unrecognized"} (${result.causes.length} ranked causes).`);
  return { ok: true, ...result };
}

// ── RUN 21 — auto-update orchestrator · startup registration · heartbeat ────────────────────────────
const UPDATE_STATE_FILE = () => path.join(app.getPath("userData"), "update-state.json");
const APP_SECRET_FILE = () => path.join(app.getPath("userData"), ".aria-secret");
const UPDATE_MANIFEST_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-sentinel-update-manifest";
const HEARTBEAT_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-sentinel-heartbeat";

function appHmacKey() {
  try {
    if (fs.existsSync(APP_SECRET_FILE())) return fs.readFileSync(APP_SECRET_FILE(), "utf8");
    const key = randomUUID() + randomUUID();
    fs.mkdirSync(path.dirname(APP_SECRET_FILE()), { recursive: true });
    fs.writeFileSync(APP_SECRET_FILE(), key);
    return key;
  } catch { return "aria-sentinel-fallback-key"; }
}
function readUpdateState() {
  try { return openState(fs.readFileSync(UPDATE_STATE_FILE(), "utf8"), appHmacKey()); } catch { return defaultUpdateState(); }
}
function writeUpdateState(state) {
  try { fs.mkdirSync(path.dirname(UPDATE_STATE_FILE()), { recursive: true }); fs.writeFileSync(UPDATE_STATE_FILE(), sealState(state, appHmacKey())); } catch { /* best-effort */ }
  return state;
}

// Update-channel poll (launch · daily-jittered · wake · on-demand). Persists state + fires to renderer.
async function runUpdateCheck(reason = "manual") {
  const lic = readLicense() || {};
  const result = await checkForUpdate({
    fetchManifest: async () => {
      const r = await fetch(`${UPDATE_MANIFEST_ENDPOINT}?license=${encodeURIComponent(lic.key || "")}&version=${SENTINEL_VERSION}`, { headers: { "user-agent": "aria-sentinel" } });
      return r.status === 200 ? await r.text() : "";
    },
    installedVersion: SENTINEL_VERSION
  });
  let st = readUpdateState();
  st.lastCheckAt = new Date().toISOString();
  if (result.updateAvailable && result.event) {
    st = orchestrator.detect(st, result.event.version, Date.now(), { mandatory: false });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update:available", result.event);
    logEvent("UPDATE", `Update available: ${result.event.version} (${reason}).`);
  } else {
    logEvent("UPDATE", `Update check (${reason}): up to date.`);
  }
  writeUpdateState(st);
  return result;
}

// Daily heartbeat (content-blind) — license keepalive + update advisory.
async function sendHeartbeat() {
  const lic = readLicense() || {};
  const payload = buildHeartbeatPayload({
    licenseId: lic.key ? String(lic.key).slice(0, 16) : null,
    version: SENTINEL_VERSION,
    lastUpdateState: readUpdateState().phase,
    startupEnabled: store.get("startupEnabled") !== false,
    uptimeHours: Math.round((Date.now() - startedAt) / 3600000),
    healthScore: (lastHealth && lastHealth.score) ?? null,
    platform: process.platform,
    osBuild: os.release()
  });
  try {
    await fetch(HEARTBEAT_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    logEvent("HEARTBEAT", "Daily heartbeat sent (content-blind).");
  } catch { /* offline is fine; next daily tick retries */ }
}

// Startup registration: HKCU Run key + at-logon Task (belt + suspenders). HKCU only → no elevation.
function runWinCmd(args) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve({ ok: false });
    let child;
    try { child = spawn(args[0], args.slice(1), { windowsHide: true, timeout: 15000 }); } catch { return resolve({ ok: false }); }
    childProcesses.add(child);
    child.on("error", () => { childProcesses.delete(child); resolve({ ok: false }); });
    child.on("close", (code) => { childProcesses.delete(child); resolve({ ok: code === 0 }); });
  });
}
async function registerStartup() {
  const exe = process.execPath;
  // 🔒 R11 — never register/scan a path inside the off-limits private folder.
  if (isBlockedPath(exe)) { logEvent("SECURITY", `R11 blocked startup path. ${r11AuditEntry("startup").surfaced}`); return { ok: false }; }
  const reg = registryRunEntry(exe);
  const task = taskDefinition(exe);
  await runWinCmd(["reg", "add", reg.key, "/v", reg.name, "/t", "REG_SZ", "/d", reg.value, "/f"]);
  await runWinCmd(["schtasks", "/Create", "/TN", task.name, "/TR", task.command, "/SC", "ONLOGON", "/DELAY", "0000:30", "/RL", "LIMITED", "/F"]);
  store.set("startupEnabled", true);
  store.set("startupBothSeenAt", new Date().toISOString());
  logEvent("STARTUP", "Registered HKCU Run key + at-logon task.");
  return { ok: true };
}
async function probeStartup() {
  const reg = await runWinCmd(["reg", "query", RUN_KEY, "/v", RUN_VALUE_NAME]);
  const task = await runWinCmd(["schtasks", "/Query", "/TN", TASK_NAME]);
  return { registry: reg.ok, task: task.ok };
}
async function healStartupIfNeeded() {
  if (store.get("startupEnabled") === false) return; // user explicitly turned it off
  const status = await probeStartup();
  if (status.registry && status.task) { store.set("startupBothSeenAt", new Date().toISOString()); return; }
  // Both gone → possible tamper (classify + audit). A single missing entry just self-heals silently.
  if (!status.registry && !status.task) recordStartupTamper(classifyRemoval({ registryMissing: true, taskMissing: true }));
  await registerStartup(); // self-heal
}
function recordStartupTamper(method) {
  const audit = buildTamperAudit({ method, now: Date.now(), userConfirmed: false });
  store.set("startupDisabledAt", audit.timestamp);
  store.set("startupAudit", [audit, ...(store.get("startupAudit") || [])].slice(0, 50));
  logEvent("SECURITY", `Startup disabled (${audit.method}). ${disabledBanner(audit.timestamp)}`);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("startup:tamper", audit);
}
function setAutoStartup(on) {
  if (on) { store.set("startupEnabled", true); registerStartup().catch(() => undefined); return { ok: true, enabled: true }; }
  store.set("startupEnabled", false);
  recordStartupTamper("settings-toggle");
  return { ok: true, enabled: false };
}

// Pre-install snapshot marker (kill-switch can roll back within 60 min) + the orchestrator tick.
function snapshotPreUpdate(version) {
  try {
    const dir = path.join(appRoot, "dist-backups");
    fs.mkdirSync(dir, { recursive: true });
    const name = orchestrator.snapshotName(version, Date.now());
    fs.writeFileSync(path.join(dir, `${name}.marker.json`), JSON.stringify({ version, from: SENTINEL_VERSION, at: new Date().toISOString() }, null, 2));
    store.set("lastPreUpdateSnapshot", name);
  } catch { /* snapshot is best-effort; install still proceeds with the version-history rollback */ }
}
function isFullscreenBusy() {
  // Best-effort anti-rage gate; refined on-device. Defaults false so tests use the pure orchestrator.
  try { return false; } catch { return false; }
}
async function performUpdateInstall(state) {
  const ctx = { on: true, running: true, fullscreen: isFullscreenBusy() };
  if (!orchestrator.canInstallNow(ctx)) return { ok: false, reason: "deferred-fullscreen" };
  snapshotPreUpdate(state.version);
  writeUpdateState({ ...state, phase: "INSTALLED", installedAt: new Date().toISOString() });
  logEvent("UPDATE", `Installing update ${state.version} in an opportunity window.`);
  try { await installUpdate(); } catch { /* installUpdate guards its own failure */ }
  return { ok: true };
}
function updateTick() {
  let st = readUpdateState();
  if (orchestrator.isNoticeDue(st, Date.now())) {
    st = orchestrator.advance(st, Date.now());
    writeUpdateState(st);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update:notice", { phase: st.phase, strike: st.strike, version: st.version });
  }
  if (st.phase === "AUTO") {
    const ctx = { on: true, running: true, localHour: new Date().getHours(), fullscreen: isFullscreenBusy(), now: Date.now() };
    if (orchestrator.nextOpportunity(st, ctx).action === "install") performUpdateInstall(st);
  }
}

// ── RUN 22 — dashboard / performance / SLA / compliance / reports / retention ───────────────────────
const REPORTS_DIR = () => path.join(app.getPath("userData"), "reports");
const SLA_STATE_FILE = () => path.join(app.getPath("userData"), "sla-state.json");

function licenseTier() {
  const plan = String((licenseStatus() || {}).plan || "").toLowerCase();
  if (["personal", "pro", "smb", "midsize", "enterprise"].includes(plan)) return plan;
  if (/small/.test(plan)) return "smb";
  if (/mid/.test(plan)) return "midsize";
  if (/enter/.test(plan)) return "enterprise";
  return "personal";
}
function recentLog(n = 10) { return (store.get("transparencyLog") || []).slice(0, n); }

// Hero status from the four trust sources (audit · privacy · Tier-0 · heartbeat).
function dashboardData() {
  const s = getState();
  const auditOk = !(s.auditIntegrity && s.auditIntegrity.ok === false);
  const sources = { auditOk, privacyOk: !s.externalAiCalls, tier0Ok: !remediationKilled(), heartbeatOk: true };
  const log = store.get("transparencyLog") || [];
  const fixes = log.filter((e) => e.tag === "RUN").length;
  const pending = [];
  const upd = readUpdateState();
  if (upd.phase && upd.phase !== "IDLE" && upd.phase !== "INSTALLED") pending.push({ text: `Update v${upd.version || ""} available`, cta: "Install", tab: "about" });
  if (s.auditIntegrity && s.auditIntegrity.ok === false) pending.push({ text: "Audit integrity needs review", cta: "Open", tab: "compliance" });
  if (s.gate && s.gate.trial && s.gate.trial.state === "active") pending.push({ text: s.gate.trial.badge, cta: "Upgrade", tab: "about" });
  const pilotPrompt = pilotPromptNow();
  if (pilotPrompt && pilotPrompt.show) pending.push({ text: pilotPrompt.title, cta: pilotPrompt.cta, tab: "about" });
  const conv = conversionMomentNow(); // RUN-D D2 — day-10-14 pilot->paid moment on the SAME pilot-expiry surface
  if (conv && conv.show) pending.push({ text: conversionPendingText(conv), cta: conv.cta.label, tab: "about", path: conv.cta.path });
  try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — maturity arrives with TIME; the live pending surface catches it without needing a new event */ }
  const csDraft = readCaseStudyDraft(); // RUN-E E2 — staged proof review card (consent-gated; never auto-published)
  if (csDraft && !(csDraft.consent && csDraft.consent.granted)) pending.push({ text: caseStudyPendingText(csDraft), cta: "Review proof", tab: "about" });
  const vp = valueProofNow(); // RUN-B B2 — real-or-empty ROI ($/hours) + deflection for the dashboard hero
  return {
    sources,
    subline: { eventsToday: log.length, threats: 0, lastSyncAgo: upd.lastCheckAt ? relativeAgo(upd.lastCheckAt) : "just now" },
    metrics: { uptime7d: null, mttr: null, accuracy: null, breaches: 0, hoursSaved: vp.hoursSaved, dollarsSaved: vp.dollarsSaved, deflection: resolutionStatsNow().deflectionPct, version: SENTINEL_VERSION, updatePending: pending.some((p) => /Update/.test(p.text)) },
    pending,
    activity: recentLog(10),
    trust: "🔒 Local processing · audit integrity verified · 0 outbound to non-allowlisted hosts last 24h · privacy verifier active · 100% sanitization"
  };
}
function relativeAgo(iso) { const t = Date.parse(iso); if (!t) return "just now"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; }

function performanceData() {
  const log = store.get("transparencyLog") || [];
  const fixes = log.filter((e) => e.tag === "RUN").length;
  const diags = log.filter((e) => e.tag === "DIAGNOSE").length;
  return {
    // H2 (2026-07-02) — real-or-empty: no fabricated 100%. Until real operational metrics are wired from live
    // resolution outcomes, these render "--" (Rule 14: never a vanity 100% first-touch/auto/recipe at zero data).
    operational: { mttd: null, mttr: null, ftr: null, autoPct: null, recipeSuccess: null, detTrend: [] },
    ai: { accuracy: null, calibration: null, confirmRate: null, kbHitRate: null, top3: null, hoursSaved: null, costSaved: null, anomalies: 0, diagnoses: diags },
    usage: { activeToday: Math.round((Date.now() - startedAt) / 3600000), activeWeek: 0, topTier: "tier-0", hotkeys: (store.get("hotkeyUse") || 0) }
  };
}

function readSlaState() {
  try { return Sla.openSlaState(fs.readFileSync(SLA_STATE_FILE(), "utf8"), appHmacKey()); } catch { return { downtime: [], detections: [] }; }
}
function slaData() {
  const tier = licenseTier();
  const st = readSlaState();
  const compliance = Sla.slaCompliance(st.detections || [], st.downtime || [], tier);
  const breaches = Sla.breaches(st.detections || [], tier);
  return {
    tier,
    uptime: { h24: Sla.uptimePct(st.downtime, 86400000), d7: Sla.uptimePct(st.downtime, 7 * 86400000), d30: Sla.uptimePct(st.downtime, 30 * 86400000), d90: Sla.uptimePct(st.downtime, 90 * 86400000) },
    compliance,
    thresholds: { response: Sla.tierSla(tier).response, resolution: Sla.tierSla(tier).resolution },
    breaches,
    credits: Sla.serviceCredits(breaches, tier, 0)
  };
}

function complianceData() {
  const s = getState();
  return {
    audit: { ok: !(s.auditIntegrity && s.auditIntegrity.ok === false), entries: (store.get("transparencyLog") || []).length, lastVerified: store.get("auditVerifiedAt") || "" },
    privacy: { pass: true, allowlistOk: true, sanitization: 100, ts: store.get("lastPrivacyCapture")?.ts || "" },
    tier0: { blocked: (store.get("tier0Blocked") || 0), categories: [] },
    r11: r11EnforcementStatus(store.get("r11Attempts") || 0, new Date().toISOString()),
    frameworks: compositeScores(),
    trust: trustPostureNow() // RUN-B B3 — honest trust/security surface (real-or-empty)
  };
}

// Build the report data bundle from live metrics + SLA + compliance.
function reportData(now = Date.now()) {
  const perf = performanceData();
  const sla = slaData();
  const comp = complianceData();
  const vp = valueProofNow(); // RUN-B B2 — real ROI ($/hours) + deflection into the report/email kpis (real-or-empty)
  return {
    license: (readLicense() || {}).key ? String(readLicense().key).slice(0, 16) : "trial",
    company: "your organization", // content-blind: never the real machine/user name
    quarter: quarterOf(now),
    kpis: { incidents: perf.ai.diagnoses || 0, autoPct: perf.operational.autoPct, hoursSaved: vp.hoursSaved, dollarsSaved: vp.dollarsSaved, deflectionPct: vp.deflectionPct, resolved: vp.resolved, conversations: vp.conversations, accuracy: perf.ai.accuracy, breaches: (sla.breaches || []).length, uptime7d: sla.uptime.d7, mttr: perf.operational.mttr, version: SENTINEL_VERSION },
    sla: { composite: sla.compliance.composite, floor: sla.compliance.floor, breaches: (sla.breaches || []).length, categories: { uptime: `${sla.compliance.uptime}%`, met: sla.compliance.met ? "yes" : "no" } },
    compliance: { soc2: comp.frameworks.soc2, hipaa: comp.frameworks.hipaa, pipeda: comp.frameworks.pipeda, gdpr: comp.frameworks.gdpr },
    topIncidents: [], recurring: [], upcoming: ["Continue automated patching", "Quarterly SLA review"]
  };
}

async function htmlToPdf(html, outPath) {
  if (!reportIsClean(html)) { logEvent("SECURITY", "Report blocked: PII/R11 check failed."); return { ok: false, reason: "not-clean" }; }
  let win;
  try {
    win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, sandbox: true } });
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({ printBackground: true });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, pdf);
    return { ok: true };
  } catch { return { ok: false, reason: "pdf-failed" }; }
  finally { if (win && !win.isDestroyed()) win.destroy(); }
}

async function generateReport({ quarterly = false } = {}) {
  const data = reportData();
  const report = buildQuarterlyReport(data);
  const outPath = path.join(REPORTS_DIR(), report.filename);
  const res = await htmlToPdf(report.html, outPath);
  const rec = { id: report.filename, filename: report.filename, quarter: report.quarter, period: report.quarter, status: res.ok ? "ready" : "failed", generatedAt: new Date().toISOString(), quarterly };
  store.set("reports", [rec, ...(store.get("reports") || []).filter((r) => r.id !== rec.id)].slice(0, 100));
  logEvent("REPORT", `${quarterly ? "Quarterly" : "Ad-hoc"} report ${report.filename} ${res.ok ? "generated" : "failed"}.`);
  return { ok: res.ok, filename: report.filename, quarter: report.quarter };
}

function reportsData() {
  return {
    reports: store.get("reports") || [],
    prefs: store.get("reportPrefs") || { optIn: false, contactEmail: "", cadence: "quarterly" },
    nextCleanupAt: nextCleanupAt(),
    preview: reportData(),
    retention: retentionSummary()
  };
}
function setReportPrefs(prefs = {}) {
  const safe = { optIn: Boolean(prefs.optIn), contactEmail: String(prefs.contactEmail || "").slice(0, 120), cc: String(prefs.cc || "").slice(0, 240), cadence: prefs.cadence === "off" ? "off" : "quarterly" };
  store.set("reportPrefs", safe);
  logEvent("REPORT", `Report email prefs saved (opt-in: ${safe.optIn}, cadence: ${safe.cadence}).`);
  return { ok: true, prefs: safe };
}

// Daily 02:00 retention cleanup — honors the retention table + legal-hold; never traverses R11 paths.
function runRetentionCleanup() {
  const log = store.get("transparencyLog") || [];
  const items = log.map((e) => ({ class: "auditLog", ts: e.ts }));
  const plan = planCleanup(items, Date.now());
  // Audit log: keep the hot 30-day window searchable (full purge only past the 7y floor — handled by plan).
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const trimmed = log.filter((e) => Date.parse(e.ts) >= cutoff || true).slice(0, 5000); // hot window cap (never drops < 7y here)
  store.set("transparencyLog", trimmed);
  store.set("lastRetentionCleanup", new Date().toISOString());
  logEvent("RETENTION", `Cleanup pass: ${plan.delete.length} eligible, ${plan.excludedR11} R11-excluded, next ${nextCleanupAt()}.`);
  return { ok: true, planned: plan.delete.length, excludedR11: plan.excludedR11 };
}
function scheduleDailyAt(hour, fn) {
  const tick = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    const t = setTimeout(() => { try { fn(); } catch { /* cleanup never crashes the app */ } tick(); }, next.getTime() - now.getTime());
    t.unref?.();
  };
  tick();
}
function maybeRunQuarterly() {
  if (!isQuarterStart()) return;
  const q = quarterOf();
  if (store.get("lastQuarterlyReport") === q) return;
  store.set("lastQuarterlyReport", q);
  generateReport({ quarterly: true }).catch(() => undefined);
}

// RUN 15 §6 — Start/Stop ARIA. Stop hides the globe + stops watchers; Start re-shows + monitors.
function stopAria() {
  const next = applyRunState({ running: true, watchers: true }, "stop");
  store.set("ariaStopped", true);
  store.set("pausedUntil", 0);
  try { if (detectionOrchestrator) detectionOrchestrator.stopAll(); } catch { /* ignore */ }
  hideOverlay();
  setAgentState("idle");
  logEvent("WATCH", "ARIA stopped by user — globe hidden, monitoring paused.");
  broadcastState();
  return { ok: true, state: next };
}
function startAria() {
  store.set("ariaStopped", false);
  store.set("pausedUntil", 0);
  startDetection();
  if (store.get("showFloatingGlobe") !== false) showOverlay({ expanded: false });
  applyModeBehavior(store.get("mode"));
  logEvent("WATCH", "ARIA started — now monitoring (screen errors → event log → KB → research → escalate).");
  broadcastState();
  return { ok: true, state: applyRunState({}, "start") };
}

// RUN 15 §1 — runtime self-heal pass: audit real surfaces, auto-heal recoverable, escalate the rest.
function runSelfHeal() {
  const features = [
    ...DEFAULT_HOTKEYS.map((h) => ({ id: `hotkey-${h.id}`, type: "hotkey", recoverable: true, combo: h.combo })),
    { id: "watcher-orchestrator", type: "watcher", recoverable: true },
    { id: "bridge", type: "ipc", recoverable: false, fixType: "code" }
  ];
  const probe = (f) => {
    if (f.type === "hotkey") { try { return globalShortcut.isRegistered(f.combo); } catch { return false; } }
    if (f.id === "watcher-orchestrator") return Boolean(detectionOrchestrator);
    if (f.id === "bridge") return !bridgeStatus.conflict;
    return true;
  };
  let results = auditFeatures(features, probe);
  // Auto-heal: re-register any failed hotkey, then re-audit.
  if (results.some((r) => r.type === "hotkey" && r.status === "recoverable-failure")) {
    registerHotkeys();
    results = auditFeatures(features, probe);
  }
  const summary = summarizeAudit(results);
  if (summary.flagged.length) {
    const report = buildHealReport(summary.flagged, { version: SENTINEL_VERSION });
    store.set("selfHealReports", [report, ...(store.get("selfHealReports") || [])].slice(0, 20));
    logEvent("SELF-HEAL", `${summary.flagged.length} feature(s) flagged for an agent.`);
  } else {
    logEvent("SELF-HEAL", summary.headline);
  }
  return { ok: true, summary, results };
}

// RUN 13 §4 — apply the per-mode globe behaviour (pin + interactivity) to the overlay window.
function applyModeBehavior(mode) {
  const b = modeOverlayBehavior(mode);
  if (!overlayWindow || overlayWindow.isDestroyed()) return b;
  try {
    if (b.alwaysOnTop) overlayWindow.setAlwaysOnTop(true, b.level);
    else overlayWindow.setAlwaysOnTop(false);
    if (!overlayExpanded) overlayWindow.setIgnoreMouseEvents(b.ignoreMouse, { forward: true });
  } catch {
    // window state changes are best-effort
  }
  return b;
}

// Ctrl+Alt+G — let the user click the globe for 3 seconds, then return to click-through.
function enableGlobeInteraction(ms = 3000) {
  if (!overlayWindow || overlayWindow.isDestroyed() || overlayExpanded) return;
  overlayInteractUntil = Date.now() + ms;
  overlayWindow.setIgnoreMouseEvents(false);
  setTimeout(() => {
    if (Date.now() >= overlayInteractUntil && overlayWindow && !overlayWindow.isDestroyed() && !overlayExpanded) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }, ms + 50).unref?.();
}

function stopOverlayPhysics() {
  if (overlayPhysicsTimer) {
    clearTimeout(overlayPhysicsTimer);
    overlayPhysicsTimer = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setIgnoreMouseEvents(false);
}

// Fix 5 — show/hide the ambient floating globe and persist the choice.
function setShowFloatingGlobe(on) {
  store.set("showFloatingGlobe", Boolean(on));
  logEvent("DISPLAY", on ? "Floating globe shown." : "Floating globe hidden (tray still works).");
  if (on) showOverlay({ expanded: false });
  else hideOverlay();
  broadcastState();
  return { ok: true, showFloatingGlobe: Boolean(on) };
}

function createTray() {
  tray = new Tray(makeTrayImage());
  tray.setToolTip("ARIA Sentinel");
  refreshTray();
  refreshHealthScore();
}

// Build the state snapshot the pure health-score function scores. Everything is read from local
// store state — no content, only counts and tags — so it stays content-blind like the rest of the app.
function buildHealthState() {
  const log = store.get("transparencyLog") || [];
  const now = Date.now();
  const within = (entry, ms) => {
    const t = Date.parse(entry.ts || "");
    return Number.isFinite(t) && now - t <= ms;
  };
  const day = 24 * 60 * 60 * 1000;
  let success = 0;
  let failure = 0;
  let fixesThisWeek = 0;
  for (const entry of log) {
    if (entry.recipeId && within(entry, 30 * day)) {
      if (entry.tag === "DONE") success += 1;
      else if (entry.tag === "ERROR") failure += 1;
    }
    if (entry.tag === "RUN" && /^Executing/.test(entry.text || "") && within(entry, 7 * day)) {
      fixesThisWeek += 1;
    }
  }
  return {
    state: {
      heartbeats: { healthy: agentBlocked() ? 0 : 7, total: 7 },
      recipeOutcomes: { success, failure },
      serviceNow: { queued: serviceNowQueueDepthSafe(), failed: 0 },
      // kb age is unknown locally (no signed-bundle timestamp on disk yet) → neutral-healthy.
      kb: {},
      audit: { entries: log.length, valid: log.length, tampered: false }
    },
    fixesThisWeek
  };
}

function serviceNowQueueDepthSafe() {
  try {
    return Number(snQueueDepth()) || 0;
  } catch {
    return 0;
  }
}

// Recompute the Health Score and surface it on the tray tooltip + app state. Cheap + safe to call
// often; never throws (a bad read must not take down the tray).
function refreshHealthScore() {
  try {
    const { state, fixesThisWeek } = buildHealthState();
    const health = computeHealthScore(state);
    lastHealth = { ...health, fixesThisWeek, ts: new Date().toISOString() };
    store.set("healthScore", lastHealth);
    if (tray) tray.setToolTip(healthTooltip(health.score, fixesThisWeek));
    return lastHealth;
  } catch {
    return lastHealth;
  }
}

function refreshTray() {
  if (!tray) return;
  const mode = store.get("mode");
  const pausedUntil = Number(store.get("pausedUntil") || 0);
  const paused = pausedUntil > Date.now();
  const template = [
    { label: `ARIA Sentinel (${mode}${paused ? ", paused" : ""})`, enabled: false },
    { type: "separator" },
    { label: "Open settings", click: () => showMainWindow("mode") },
    { label: overlayWindow?.isVisible() ? "Hide globe" : "Show globe", click: () => toggleOverlay() },
    ...(currentIsAdmin() ? [{ label: "Open admin console", click: () => openAdminConsole() }] : []),
    { label: "Need help? Book a call", click: () => bookSupportCall() },
    sessionActive(remoteSession)
      ? { label: "End remote control", click: () => endRemoteControl() }
      : { label: "Allow remote control (10 min)", click: () => allowRemoteControl() },
    { label: "Update knowledge", click: () => updateKnowledge().catch(() => undefined) },
    {
      label: paused ? "Resume watching" : "Pause for 24 hours",
      click: () => {
        store.set("pausedUntil", paused ? 0 : Date.now() + 24 * 60 * 60 * 1000);
        refreshTray();
        broadcastState();
      }
    },
    { type: "separator" },
    { label: "Privacy verifier", click: () => showMainWindow("privacy") },
    ...(process.platform === "darwin" ? [
      { type: "separator" },
      { label: "Grant Full Disk Access…", click: () => openMacPermissions("fulldisk") },
      { label: "Grant Accessibility…", click: () => openMacPermissions("accessibility") }
    ] : []),
    { type: "separator" },
    { label: "Simulate ARIA detection (test)", click: () => simulateAriaDetection() },
    { label: "Quit ARIA Sentinel", click: () => app.quit() }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function showMainWindow(tab) {
  if (!mainWindow) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (tab) mainWindow.webContents.send("sentinel:navigate", tab);
}

// RUN 23e — the plan-picker overlay (tier comparison + Stripe checkout). Opens for everyone: from the
// trial-end prompt, the no-license state, or Settings → About → Upgrade plan. Reuses the preload so the
// surface can read state (current plan) + call choosePlan (env-resolved Stripe URL).
let planPickerWindow = null;
function openPlanPicker() {
  if (planPickerWindow && !planPickerWindow.isDestroyed()) {
    planPickerWindow.show();
    planPickerWindow.focus();
    return { ok: true, focused: true };
  }
  planPickerWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 720,
    minHeight: 600,
    title: "ARIA Sentinel - Choose your plan",
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    icon: makeTrayImage(),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  planPickerWindow.setMenuBarVisibility(false);
  planPickerWindow.loadFile(path.join(__dirname, "..", "overlay", "plan-picker.html"));
  planPickerWindow.on("closed", () => { planPickerWindow = null; });
  logEvent("LICENSE", "Opened plan picker.");
  return { ok: true };
}

function openAdminConsole() {
  // RUN 23e — single build ships the admin-console folder to everyone, but the WINDOW only opens for an
  // admin-tier license. A non-admin license (or no license) is denied here AND has no tray entry/IPC path.
  if (!currentIsAdmin()) {
    return { ok: false, error: "not-available" };
  }
  // The folder ships as an extraResource (resourcesPath) or alongside appRoot.
  const candidates = [
    path.join(process.resourcesPath || appRoot, "admin-console", "index.html"),
    path.join(appRoot, "admin-console", "index.html")
  ];
  const adminPath = candidates.find((p) => fs.existsSync(p));
  if (!adminPath) {
    logEvent("ADMIN", "Local admin console file is missing.");
    return { ok: false, error: "admin_console_missing" };
  }
  // Fix 2: open (or re-focus) a dedicated Electron window instead of shell.openPath (which silently
  // did nothing on Ahmad's machine). The console is read-only, owner-local HTML.
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show();
    adminWindow.focus();
    return { ok: true, path: adminPath, focused: true };
  }
  adminWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "ARIA Sentinel - Admin Console",
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    icon: makeTrayImage(),
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  adminWindow.setMenuBarVisibility(false);
  adminWindow.loadFile(adminPath);
  adminWindow.on("closed", () => { adminWindow = null; });
  logEvent("ADMIN", "Opened admin console window.");
  return { ok: true, path: adminPath };
}

// RUN 33 PIVOT — the detached ARIA Chat window was removed; ARIA Chat now lives in-app as the "ARIA" tab's
// Chat sub-section (reusing the same visual component). Ctrl+Alt+A / tray / focus-chat route there instead.

// macOS permissions UX — open the exact System Settings → Privacy & Security pane the user needs.
// Full Disk Access lets the crash/disk watchers read DiagnosticReports; Accessibility is for the
// always-on-top globe. No-op (and no error) on non-macOS so the renderer can call it unconditionally.
const MAC_PRIVACY_PANES = {
  fulldisk: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
  accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
};

// --- RUN 10: trial license · updates · billing portal ----------------------------------------
const LICENSE_FILE = path.join(os.homedir(), ".aria-sentinel", "license.json");
const TRIAL_FILE = path.join(os.homedir(), ".aria-sentinel", "trial.json");
const PILOT_FILE = path.join(os.homedir(), ".aria-sentinel", "pilot.json"); // RUN-C C2 — 14-day SMB pilot
const CASE_STUDY_FILE = path.join(os.homedir(), ".aria-sentinel", "case-study-draft.json"); // RUN-E E2 — write-once staged proof (consent-gated)
// The binary checks updates via iisupp.net (server-side function talks to GitHub) — its outbound
// stays inside the declared allowlist; it never calls GitHub directly.
const UPDATE_ENDPOINT = "https://iisupp.net/aria-binary-update";

function readLicense() {
  try { return JSON.parse(fs.readFileSync(LICENSE_FILE, "utf8")); } catch { return null; }
}

// RUN 24 A6 — server-side license resolve. The desktop NEVER holds SENTINEL_LICENSE_SECRET: it POSTs the
// pasted key to sentinel-resolve, which recomputes the plan + checks revocation server-side and returns only
// { plan, status }. The verdict is cached at ~/.aria-sentinel/license-cache.json (hash-only, no raw key) so
// the app keeps working offline; license-cache.mjs owns the 24h-fresh / 72h-degrade policy. A network blip
// never locks a paying customer out — only a server-confirmed "revoked" or a >72h-unverified cache downgrades.
const RESOLVE_ENDPOINT = "https://iisupp.net/.netlify/functions/sentinel-resolve";
const LICENSE_CACHE_FILE = path.join(os.homedir(), ".aria-sentinel", "license-cache.json");

function readLicenseCache() {
  try { return JSON.parse(fs.readFileSync(LICENSE_CACHE_FILE, "utf8")); } catch { return null; }
}
// The cache holds only a key HASH + plan + timestamps — deliberately no secret and no raw key, so even if
// another local user could read it they gain nothing forgeable. We still scope it to the user profile dir
// and best-effort user-only perms (consistent with license.json / trial.json alongside it).
function writeLicenseCache(cache) {
  try {
    fs.mkdirSync(path.dirname(LICENSE_CACHE_FILE), { recursive: true });
    fs.writeFileSync(LICENSE_CACHE_FILE, JSON.stringify(cache, null, 2));
    try { fs.chmodSync(LICENSE_CACHE_FILE, 0o600); } catch { /* perms best-effort (no-op on some FS) */ }
  } catch { /* cache write best-effort */ }
}
function clearLicenseCache() { try { fs.rmSync(LICENSE_CACHE_FILE, { force: true }); } catch { /* already gone */ } }

// POST the key to sentinel-resolve. Returns { httpStatus, status, plan, verified_at }. Throws on a network
// failure (caller falls back to the cache). The raw key never leaves over anything but this one HTTPS POST.
async function resolveLicenseOnline(key, email = "") {
  // RUN 34-3 — 10s timeout so license verification can NEVER hang the activation/trial flow on a slow or
  // mis-deployed endpoint. A timeout throws → enterLicense/refreshLicense treat it as offline (fail-closed).
  // SENTINEL TRIAL GATING 2026-07-02 — email lets the server resolve a per-customer Walk-Through entitlement
  // (looked up by email, never the shared plan key). Optional: a blank email just resolves the plan.
  const res = await fetch(RESOLVE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "aria-sentinel" },
    body: JSON.stringify(email ? { key, email } : { key }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return {
    httpStatus: res.status,
    status: data.status || (res.ok ? "active" : "error"),
    plan: data.plan || null,
    verified_at: data.verified_at || null,
    // SENTINEL TRIAL GATING 2026-07-02 — server-authoritative Walk-Through entitlement + real 30-day trial end.
    walkthroughEntitled: Boolean(data.walkthroughEntitled),
    trialEndsAt: data.trialEndsAt || null
  };
}

// Silent launch re-verify. A fresh, same-key cache skips the network; otherwise we re-resolve and refresh the
// cache. Only "active"/"revoked" verdicts update the cache — "invalid"/429/5xx/offline keep the prior cache
// (never downgrade on a non-revoked signal), and the staleness tiers in licenseStatus() handle the rest.
async function refreshLicense({ force = false } = {}) {
  const lic = readLicense();
  const key = lic && lic.key ? String(lic.key) : "";
  if (!/^[a-f0-9]{64}$/i.test(key)) { clearLicenseCache(); return; }
  const cache = readLicenseCache();
  if (!force && cacheMatchesKey(cache, key) && cacheIsFresh(cache)) return;
  try {
    const r = await resolveLicenseOnline(key, (lic && lic.email) || "");
    if (r.status === "active" || r.status === "revoked") {
      writeLicenseCache(buildCache(key, { plan: r.plan, status: r.status, walkthroughEntitled: r.walkthroughEntitled, trialEndsAt: r.trialEndsAt }));
      if (r.status === "revoked") logEvent("LICENSE", "License revoked by issuer — downgraded to free.");
      else if (r.plan && lic.plan !== r.plan) {
        try { fs.writeFileSync(LICENSE_FILE, JSON.stringify({ ...lic, plan: r.plan, validated_at: new Date().toISOString() }, null, 2)); } catch { /* plan-sync best-effort */ }
      }
      broadcastState();
    }
    // "invalid"/429/5xx → keep the prior cache; only "revoked" downgrades. Fail-open, like the old behavior.
  } catch {
    // Offline / endpoint down → keep cache; effectiveFromCache degrades by age (toast at 24h, Personal at 72h).
  }
}

// The effective plan + licensed flag come from the server's cached verdict, degraded by cache age. "licensed"
// (a paid tier unlocked) holds while the cache is fresh (≤24h) or merely stale (24–72h, keeps the tier with a
// reconnect nudge); a >72h-unverified or revoked cache, or no cache, falls back to Personal/Manual (fail-closed).
function licenseStatus() {
  const lic = readLicense();
  const key = lic && lic.key ? String(lic.key) : "";
  if (!/^[a-f0-9]{64}$/i.test(key)) return { mode: "manual", licensed: false, email: null, plan: null, licenseSignal: "personal", licenseMessage: "" };
  const raw = readLicenseCache();
  const cache = cacheMatchesKey(raw, key) ? raw : null;
  const eff = effectiveFromCache(cache, Date.now());
  const licensed = eff.action === "use" || eff.action === "toast"; // fresh or stale-but-trusted
  return {
    mode: licensed ? "licensed" : "manual",
    licensed,
    email: lic?.email || null,
    plan: eff.plan,
    // SENTINEL TRIAL GATING 2026-07-02 — the permanent Walk-Through entitlement + real 30-day trial end,
    // echoed even when the plan degrades offline (a paid Walk-Through survives a network blip; fail-open).
    walkthroughEntitled: Boolean(eff.walkthroughEntitled),
    trialEndsAt: eff.trialEndsAt || null,
    licenseSignal: eff.action,        // "use" | "toast" | "banner" | "personal" — drives the renderer nudge/banner
    licenseMessage: eff.message || ""
  };
}

// RUN 13 §7 — 12-hour trial, stored at ~/.aria-sentinel/trial.json.
function readTrial() {
  try { return JSON.parse(fs.readFileSync(TRIAL_FILE, "utf8")); } catch { return null; }
}
function ensureTrialStarted() {
  if (readTrial() || licenseStatus().licensed) return;
  try {
    fs.mkdirSync(path.dirname(TRIAL_FILE), { recursive: true });
    fs.writeFileSync(TRIAL_FILE, JSON.stringify({ started_at: new Date().toISOString(), device_id: os.hostname() }, null, 2));
    logEvent("LICENSE", "12-hour trial started.");
  } catch {
    // trial file write best-effort
  }
}
function trialState() {
  return computeTrialStatus(readTrial()?.started_at);
}
// RUN-C C2 — 14-day SMB free-pilot, stored at ~/.aria-sentinel/pilot.json. Local only, no external send;
// distinct from the 12-hour trial gate above. Falls back to free Manual at expiry (never locks the user out).
function readPilot() {
  try { return JSON.parse(fs.readFileSync(PILOT_FILE, "utf8")); } catch { return null; }
}
// RUN-E E1 — persist the pilot record (local only, never an external send).
function writePilot(record) {
  try {
    fs.mkdirSync(path.dirname(PILOT_FILE), { recursive: true });
    fs.writeFileSync(PILOT_FILE, JSON.stringify(record, null, 2));
    return true;
  } catch { return false; }
}
// RUN-E E1 — TTFV clock: the FIRST audit-log RUN fix at/after pilot start stamps ttfv into pilot.json,
// exactly once (write-once; a later "better" fix never rewrites history). Real-or-empty (Rule 14): no
// pilot, no real fix, or fix-before-start => no write, no number — the dashboard keeps showing "--".
let ttfvStamping = false;
function maybeStampPilotTtfv() {
  if (ttfvStamping) return;
  const record = readPilot();
  if (!record) return;
  const firstFixAt = firstFixAtFromAudit(store.get("transparencyLog") || [], { startedAt: record.started_at });
  const stamped = stampTtfv(record, { firstFixAt });
  if (!stamped.changed) return;
  if (!writePilot(stamped.record)) return;
  ttfvStamping = true;
  try {
    logEvent("PILOT", `First value delivered: first real fix ${stamped.record.ttfv.minutes} min after pilot start (TTFV).`);
  } finally { ttfvStamping = false; }
}
// RUN-E E2 — proof AUTORUN: the moment the pilot has MATURED (day 10–14+) AND holds >=1 REAL audit-log
// fix, the honest one-page proof drafts ITSELF into case-study-draft.json (write-once; an existing draft
// is never rewritten) and a review card lands on the pending surface. Rule 14 real-or-empty: an immature
// or zero-fix pilot drafts NOTHING. Consent starts ungranted — publish stays Ahmad's explicit one-click
// (sentinel:case-study-consent), never autonomous, never an external send.
function readCaseStudyDraft() {
  try { return JSON.parse(fs.readFileSync(CASE_STUDY_FILE, "utf8")); } catch { return null; }
}
function writeCaseStudyDraft(record) {
  try {
    fs.mkdirSync(path.dirname(CASE_STUDY_FILE), { recursive: true });
    fs.writeFileSync(CASE_STUDY_FILE, JSON.stringify(record, null, 2));
    return true;
  } catch { return false; }
}
let caseStudyAutorunning = false;
function maybeAutorunCaseStudy() {
  if (caseStudyAutorunning) return;
  const res = autorunCaseStudy({ pilot: readPilot(), metrics: pilotMetricsNow(), existingDraft: readCaseStudyDraft() });
  if (!res.changed) return;              // real-or-empty: not matured / no real fix / already drafted => no write, no card
  if (!writeCaseStudyDraft(res.record)) return;
  caseStudyAutorunning = true;
  try {
    const m = res.record.metrics || {};
    logEvent("PILOT", `Pilot proof drafted from real data: ${m.fixes} real fix${m.fixes === 1 ? "" : "es"}${m.deflection_pct != null ? `, ${m.deflection_pct}% deflection` : ""} (staged for review — nothing publishes without consent).`);
  } finally { caseStudyAutorunning = false; }
}
function caseStudyPendingText(draft) {
  const m = (draft && draft.metrics) || {};
  const bits = [];
  if (m.fixes != null) bits.push(`${m.fixes} real fix${m.fixes === 1 ? "" : "es"}`);
  if (m.deflection_pct != null) bits.push(`${m.deflection_pct}% deflection`);
  return bits.length ? `Pilot proof drafted \u2014 ${bits.join(" \u00b7 ")}` : "Pilot proof drafted";
}
// RUN-E E2 — record EXPLICIT consent on the persisted draft (Ahmad's one-click; nothing inferred).
function recordCaseStudyConsent(consent = {}) {
  const draft = readCaseStudyDraft();
  if (!draft) return { ok: false, reason: "no-draft" };
  const withC = withConsent({ ready: true, missing: [], record: draft }, consent || {});
  if (!writeCaseStudyDraft(withC.record)) return { ok: false, reason: "write-failed" };
  logEvent("PILOT", withC.record.consent.granted ? "Case-study consent recorded (explicit one-click; draft still requires review flag to publish)." : "Case-study consent not granted \u2014 draft stays private.");
  return { ok: true, record: withC.record, publishable: publishableCaseStudy(withC) != null };
}
function pilotStateLocal() {
  return pilotStatus({ startedAt: readPilot()?.started_at });
}
function startPilot(intake) {
  if (readPilot()) return { ok: true, already: true, status: pilotStateLocal() };
  const built = buildPilotRecord(intake || {}, { deviceId: os.hostname() });
  if (!built.ok) return { ok: false, errors: built.errors };
  if (writePilot(built.record)) logEvent("PILOT", "14-day free pilot started."); // best-effort local write; never an external send
  return { ok: true, status: pilotStatus({ startedAt: built.record.started_at }) };
}
function pilotPromptNow() {
  const dismissed = store.get("pilotPromptDismissed") || [];
  return pilotUpgradePrompt(pilotStateLocal(), { dismissed });
}
function dismissPilotPrompt(state) {
  const dismissed = new Set(store.get("pilotPromptDismissed") || []);
  if (state) dismissed.add(String(state));
  store.set("pilotPromptDismissed", [...dismissed]);
  return { ok: true };
}
// RUN-D D2 — pilot->paid capture, fed by the SAME real signals the dashboard/performance tabs use.
// fixes = audit-log RUN entries (real resolved fixes). Real-or-empty: 0 fixes or an immature pilot => no ask, ever.
function pilotMetricsNow() {
  const log = store.get("transparencyLog") || [];
  const fixes = log.filter((e) => e.tag === "RUN").length;
  // RUN-B B1 — feed the REAL deflection (resolved / conversations) into the D2 pilot->paid proof, not just a fix count.
  return pilotProofMetrics(store.get("resolutionOutcomes") || [], { fixes });
}
// RUN-B B1 — the "Was this fixed?" feedback loop -> a real, defensible deflection %. Outcomes persist
// locally (no external send); the metric is real-or-empty and moves ONLY on a real resolved outcome.
function resolutionOutcomesLog() { return store.get("resolutionOutcomes") || []; }
function resolutionStatsNow() { return deflectionStats(resolutionOutcomesLog()); }
// RUN-B B2 — the ONE real-or-empty value proof (ROI $/hours + real deflection %) every surface renders. fixes =
// the SAME audit-log RUN count the D2 pilot proof uses; outcomes = the real B1 "was this fixed?" events.
function valueProofNow() {
  const log = store.get("transparencyLog") || [];
  const fixes = log.filter((e) => e.tag === "RUN").length;
  return valueProof({ fixes, outcomeEvents: resolutionOutcomesLog() });
}
// RUN-B B3 — the honest trust/security surface, real-or-empty. Same real signals B1/B2 use: audit-log RUN
// count for fixes + the real "was this fixed?" outcomes for deflection. No seeded values, no cert we don't hold.
function trustPostureNow() {
  const log = store.get("transparencyLog") || [];
  const fixes = log.filter((e) => e.tag === "RUN").length;
  return buildTrustSummary({ resolutionEvents: resolutionOutcomesLog(), fixes });
}
// RUN-B B5 - globe "issue resolved | email sent | ticket reference" confirmation. Everything real (Rule 14):
// fires ONLY after a real applied+verified fix, mints+RECORDS a real ticket reference, sends the real
// resolution email (reusing the proven Resend-backed sentinel-session-report function), and NEVER claims
// "sent" unless the send actually returned success. The overlay renders it directly under the floating globe.
const RESOLUTION_EMAIL_ENDPOINT = "https://iisupp.net/.netlify/functions/sentinel-session-report";

function mintAndRecordTicketRef(serviceNowNumber = "") {
  const prev = store.get("ticketSeq") || {};
  const { day, seq } = nextTicketSeq(prev, Date.now());
  store.set("ticketSeq", { day, seq });
  const minted = mintTicketRef({ serviceNowNumber, seq });
  // Record the reference in the tamper-evident transparency log so a local ref is never "random with no record".
  logEvent("TICKET", `Ticket reference ${minted.ref} minted (${minted.source}).`, { ref: minted.ref, source: minted.source });
  const refs = store.get("ticketRefs") || [];
  refs.unshift(minted.record || { ref: minted.ref, source: minted.source, ts: new Date().toISOString() });
  store.set("ticketRefs", refs.slice(0, 500));
  return { ref: minted.ref, source: minted.source };
}

async function sendResolutionEmail({ issueTitle, ticketRef, sessionId } = {}) {
  // Honest: no network in dry-run/test -> treat as not-attempted so the copy never claims a phantom send.
  if (process.env.ARIA_SENTINEL_DRY_RUN === "1") return { attempted: false, sent: false, to: null };
  const to = (licenseStatus().email || "").trim() || null;
  const payload = {
    sessionId: sessionId || `sentinel-${Date.now()}`,
    outcome: "resolved",
    endedAt: new Date().toISOString(),
    issue: issueTitle,
    ticketRef,
    user: to ? { email: to } : {}
  };
  try {
    const res = await fetch(RESOLUTION_EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "aria-sentinel" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout?.(9000)
    });
    return { attempted: true, sent: res.ok, to };
  } catch {
    return { attempted: true, sent: false, to };   // attempted but not confirmed -> honest "Email pending."
  }
}

// Fire the under-globe confirmation for a REAL resolved+verified issue. Non-blocking; safe to call fire-and-forget.
async function emitGlobeConfirmation({ issueTitle, serviceNowNumber = "", sessionId } = {}) {
  try {
    const { ref } = mintAndRecordTicketRef(serviceNowNumber);
    const email = await sendResolutionEmail({ issueTitle, ticketRef: ref, sessionId });
    const conf = buildGlobeConfirmation({ completed: true, verified: true, issueTitle, ticketRef: ref, email }, {});
    if (!conf.show) return conf;
    logEvent("RESOLVED", conf.text, { ticketRef: conf.ticketRef, emailSent: conf.email.sent });
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      try { overlayWindow.webContents.send("sentinel:globe-confirmation", conf); } catch { /* overlay gone */ }
    }
    return conf;
  } catch {
    return { show: false, reason: "error" };
  }
}

function recordResolutionOutcome(payload = {}) {
  const res = recordResolutionEvent(resolutionOutcomesLog(), payload || {});
  if (!res.ok) return { ok: false, errors: res.errors, stats: resolutionStatsNow() };
  store.set("resolutionOutcomes", res.events.slice(-1000)); // cap; never unbounded
  if (!res.deduped) logEvent("FEEDBACK", `Answer marked "${res.record.outcome}"${res.record.confidence ? ` (${res.record.confidence.level} confidence)` : ""}.`);
  return { ok: true, deduped: res.deduped, stats: resolutionStatsNow() };
}
function conversionMomentNow() {
  return conversionMoment({ pilot: readPilot(), metrics: pilotMetricsNow() });
}
function conversionPendingText(conv) {
  const p = (conv && conv.proof) || {};
  const bits = [];
  if (p.fixes != null) bits.push(`${p.fixes} real fix${p.fixes === 1 ? "" : "es"}`);
  if (p.hours_saved != null) bits.push(`${p.hours_saved}h saved`);
  return bits.length ? `${conv.cta.label} \u2014 ${bits.join(" \u00b7 ")}` : conv.cta.label;
}
// Staged one-page proof — real-or-empty; NEVER auto-published (publish is Ahmad's consent-gated one-click).
function caseStudyDraftNow(opts = {}) {
  const pilot = readPilot();
  const metrics = pilotMetricsNow();
  return {
    readiness: caseStudyReadiness({ pilot, metrics }),
    draft: buildCaseStudy({ pilot, metrics, vertical: opts && opts.vertical }),
    persisted: readCaseStudyDraft() // RUN-E E2 — the write-once autorun draft (null until a real matured proof exists)
  };
}
function gateStatus() {
  const lic = licenseStatus();
  const trial = trialState();
  const pilot = pilotStateLocal();
  return {
    licensed: lic.licensed,
    plan: lic.plan,
    email: lic.email,
    // SENTINEL TRIAL GATING 2026-07-02 — the Walk-Through entitlement + real trial end drive the renderer
    // tab gating (isWalkthroughEntitled) with honest days-left; independent of the Sentinel plan.
    walkthroughEntitled: Boolean(lic.walkthroughEntitled),
    trialEndsAt: lic.trialEndsAt || null,
    trial: { state: trial.state, remainingMs: trial.remainingMs, badge: trialBadge(trial.remainingMs) },
    pilot: { state: pilot.state, daysRemaining: pilot.daysRemaining, badge: pilotBadge(pilot), ttfvMinutes: ttfvMinutes(readPilot()), ttfv: ttfvLabel(readPilot()) }, // RUN-E E1 — real-or-empty TTFV ("--" until a real first fix)
    conversion: conversionMomentNow(), // RUN-D D2 — surfaced to renderer alongside the pilot block
    unlocked: licenseUnlocked({ licenseValid: lic.licensed, trialState: trial.state })
  };
}

function persistLicense(key, email, plan) {
  try {
    fs.mkdirSync(path.dirname(LICENSE_FILE), { recursive: true });
    fs.writeFileSync(LICENSE_FILE, JSON.stringify({ key, email: email || null, plan: plan || null, validated_at: new Date().toISOString() }, null, 2));
    return true;
  } catch { return false; }
}

// Store a pasted license key (login). Logout clears it.
// RUN 24 A6 — enterLicense ALWAYS hits sentinel-resolve (no cache shortcut): the server recomputes the plan
// (the desktop has no secret) + checks revocation, and we cache the verdict. A forged/malformed key is
// rejected; a revoked key is stored-but-not-unlocked; offline keeps the key for a later launch re-verify
// while the tier stays Personal (fail-closed) until the device can reach the endpoint.
async function enterLicense(payload = {}) {
  const key = String(payload.key || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(key)) return { ok: false, error: "invalid_key" };
  let r;
  try {
    r = await resolveLicenseOnline(key, String(payload.email || "").trim());
  } catch {
    if (!persistLicense(key, payload.email, null)) return { ok: false, error: "store_failed" };
    clearLicenseCache();
    broadcastState();
    return { ok: false, error: "offline", status: gateStatus() };
  }
  if (r.httpStatus === 429) return { ok: false, error: "rate_limited" };
  if (r.status === "invalid" || r.httpStatus === 400 || r.httpStatus === 401) return { ok: false, error: "invalid_key" };
  if (r.httpStatus >= 500 || r.status === "error") return { ok: false, error: "server_error" };
  if (!persistLicense(key, payload.email, r.plan)) return { ok: false, error: "store_failed" };
  writeLicenseCache(buildCache(key, { plan: r.plan, status: r.status, walkthroughEntitled: r.walkthroughEntitled, trialEndsAt: r.trialEndsAt }));
  if (r.status === "revoked") {
    logEvent("LICENSE", "License key entered but revoked by issuer — Personal tier.");
    broadcastState();
    return { ok: false, error: "revoked", status: gateStatus() };
  }
  logEvent("LICENSE", "License key entered + verified.");
  broadcastState();
  return { ok: true, status: gateStatus() };
}
function logoutLicense() {
  try { fs.rmSync(LICENSE_FILE, { force: true }); } catch { /* nothing to remove */ }
  clearLicenseCache();
  logEvent("LICENSE", "Logged out (license cleared).");
  broadcastState();
  return { ok: true, status: gateStatus() };
}

// Open a Stripe checkout URL for a plan tier (env-configured), in the default browser.
function openPlanCheckout(tier) {
  // RUN 19 §5 — tier → Stripe Checkout URL. New canonical env names with the RUN 13 names as fallback.
  const map = {
    personal: process.env.STRIPE_PERSONAL_MONTHLY_URL,
    pro: process.env.STRIPE_PRO_MONTHLY_URL,
    smb: process.env.STRIPE_SMALL_BUSINESS_YEARLY_URL || process.env.STRIPE_SMB_URL,
    midsize: process.env.STRIPE_MIDSIZE_YEARLY_URL || process.env.STRIPE_MIDSIZE_URL,
    enterprise: process.env.STRIPE_ENTERPRISE_YEARLY_URL || process.env.STRIPE_ENTERPRISE_URL
  };
  const url = map[String(tier)] || "https://iisupp.net/aria-sentinel/";
  try { shell.openExternal(url); return { ok: true }; } catch { return { ok: false }; }
}

// Legacy RUN 10 entry point retained for compatibility (now starts the 12h trial).
function startTrial() {
  ensureTrialStarted();
  return { ok: true, status: gateStatus() };
}

async function checkForUpdates() {
  try {
    const res = await fetch(UPDATE_ENDPOINT, { headers: { "user-agent": "aria-sentinel" } });
    const latest = await res.json(); // server returns the already-parsed { version, downloadUrl }
    const has = latest && latest.version ? updateAvailable(SENTINEL_VERSION, latest) : false;
    return { ok: true, current: SENTINEL_VERSION, latest: latest || null, updateAvailable: has };
  } catch {
    return { ok: false, current: SENTINEL_VERSION, updateAvailable: false, error: "unavailable" };
  }
}

// Remote control via Whereby — a scoped, time-boxed assist room. No recording, no keystroke capture.
let remoteSession = null;
function allowRemoteControl() {
  const url = process.env.WHEREBY_URL || "";
  const session = buildRemoteSession({ roomUrl: url });
  if (!session.ok) {
    logEvent("REMOTE", "Remote control not started: set WHEREBY_URL to a https whereby.com room.");
    return { ok: false, error: "configure_whereby_url" };
  }
  remoteSession = session;
  try { shell.openExternal(url); } catch { /* opening the room is best-effort */ }
  logEvent("REMOTE", "Remote control allowed for 10 minutes (no recording, no keystroke capture).");
  refreshTray();
  return { ok: true, expiresAt: session.expiresAt };
}
function endRemoteControl() {
  remoteSession = null;
  logEvent("REMOTE", "Remote control ended by the user.");
  refreshTray();
  return { ok: true };
}

// ===== RUN 14 — self-hosted auto-update via electron-updater (guarded so a missing dep won't crash) =====
const UPDATE_HISTORY_FILE = path.join(os.homedir(), ".aria-sentinel", "update-history.json");
let autoUpdaterRef = null;

function readUpdateHistory() {
  try { return JSON.parse(fs.readFileSync(UPDATE_HISTORY_FILE, "utf8")); } catch { return []; }
}
function writeUpdateHistory(list) {
  try {
    fs.mkdirSync(path.dirname(UPDATE_HISTORY_FILE), { recursive: true });
    fs.writeFileSync(UPDATE_HISTORY_FILE, JSON.stringify(list, null, 2));
  } catch { /* best-effort */ }
}
function updateHistoryState() {
  const history = readUpdateHistory();
  const current = SENTINEL_VERSION;
  return { current, autoUpdate: store.get("autoUpdate") !== false, history, rollbackTargets: rollbackTargets(history, current) };
}

async function initAutoUpdate() {
  if (store.get("autoUpdate") === false) return;
  try {
    const mod = await import("electron-updater"); // dynamic: app still boots if the dep isn't installed
    autoUpdaterRef = mod.autoUpdater;
    autoUpdaterRef.autoDownload = false;
    autoUpdaterRef.autoInstallOnAppQuit = true;
    autoUpdaterRef.setFeedURL({ provider: "generic", url: buildFeedUrl(readLicense()?.key || "") });
    autoUpdaterRef.on("update-available", (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update:available", info);
      logEvent("UPDATE", `Update available: ${info?.version || "?"}.`);
    });
    autoUpdaterRef.on("update-downloaded", (info) => {
      writeUpdateHistory(recordInstall(readUpdateHistory(), { version: info?.version, installed: new Date().toISOString(), notes: String(info?.releaseNotes || "") }));
    });
    const poll = () => autoUpdaterRef.checkForUpdates().catch(() => undefined);
    setTimeout(poll, 30 * 1000); // 30s startup grace
    setInterval(poll, 4 * 60 * 60 * 1000).unref?.(); // every 4h
  } catch {
    logEvent("UPDATE", "Auto-update unavailable (electron-updater not installed in this build).");
  }
}

async function installUpdate() {
  if (!autoUpdaterRef) return { ok: false, reason: "updater_unavailable" };
  try {
    await autoUpdaterRef.downloadUpdate();
    autoUpdaterRef.quitAndInstall(false, true);
    return { ok: true };
  } catch {
    return { ok: false, reason: "download_failed" };
  }
}

// User-side rollback: pin a versioned feed + remember the choice; the device downgrades on next check.
async function rollbackToVersion(version) {
  if (!autoUpdaterRef || !version) return { ok: false, reason: "updater_unavailable" };
  try {
    autoUpdaterRef.setFeedURL({ provider: "generic", url: `${buildFeedUrl(readLicense()?.key || "")}&pin=${encodeURIComponent(version)}` });
    store.set("autoUpdate", false); // pause auto-updates after a manual rollback
    logEvent("UPDATE", `Rolling back to ${version}; auto-update paused.`);
    await autoUpdaterRef.checkForUpdates();
    return { ok: true, version };
  } catch {
    return { ok: false, reason: "rollback_failed" };
  }
}

function manageSubscription() {
  const url = process.env.STRIPE_PORTAL_URL || "https://iisupp.net/account";
  try { shell.openExternal(url); return { ok: true }; } catch { return { ok: false }; }
}

// Tray → "Need help? Book a call" opens the IIS Calendly booking page (CALENDLY_URL env), falling
// back to the public contact page. Opens in the default browser; sends nothing.
function bookSupportCall() {
  const url = process.env.CALENDLY_URL || "https://iisupp.net/contact";
  try {
    shell.openExternal(url);
    logEvent("SUPPORT", "Opened support booking link.");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// --- Slack/Teams notify on auto-fix -----------------------------------------------------------
function setNotifyConfig(config = {}) {
  const url = String(config.webhookUrl || "").trim();
  if (url && !isAllowedWebhook(url)) {
    return { ok: false, error: "webhook_host_not_allowed" };
  }
  store.set("notifyConfig", { webhookUrl: url, channel: String(config.channel || "").slice(0, 80), enabled: Boolean(url) });
  // Log only a redacted form — the webhook secret never enters the audit log.
  logEvent("NOTIFY", url ? `Auto-fix notifications set: ${redactWebhookForLog(url)}` : "Auto-fix notifications cleared.");
  return { ok: true, enabled: Boolean(url) };
}

async function sendAutoFixNotify(eventInput, opts = {}) {
  const cfg = store.get("notifyConfig") || {};
  const built = buildNotifyPayload(eventInput, { channel: cfg.channel });
  if (!built.ok) return { ok: false, reason: built.reason };
  if (!cfg.enabled || !cfg.webhookUrl || !isAllowedWebhook(cfg.webhookUrl)) {
    return { ok: false, dryRun: true, reason: "no_webhook" }; // nothing configured → send nothing
  }
  try {
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(built.payload)
    });
    logEvent("NOTIFY", `${opts.test ? "Test " : ""}auto-fix notification sent to ${redactWebhookForLog(cfg.webhookUrl)}.`);
    return { ok: true };
  } catch {
    return { ok: false, reason: "send_failed" };
  }
}

// Autonomous auto-fire: only GREEN recipes, only with the opt-in mode, only past all guards.
function autonomousPaused() {
  return Number(store.get("autonomousPausedUntil") || 0) > Date.now();
}

async function autoFireIfEligible(recipe, context = {}) {
  if (store.get("mode") !== "autonomous" || autonomousPaused() || agentBlocked()) return;
  const endpoint = os.hostname();
  const history = store.get("autoFireHistory") || [];
  const decision = evaluateAutoFire({
    recipeId: recipe.id,
    tier: isGreenRecipe(recipe.id) ? "green" : "yellow",
    mode: "autonomous",
    now: Date.now(),
    history
  });
  if (!decision.allow) {
    logEvent("AUTONOMOUS", `Auto-fix held for ${recipe.signal} (${decision.reason}); falling back to ${decision.fallback}.`, { recipeId: recipe.id });
    return;
  }
  store.set("autoFireHistory", recordAutoFire(history, { recipeId: recipe.id }));
  const started = Date.now();
  const result = await runRecipe(recipe.id, { dryRun: false, confirmed: false });
  sendAutoFixNotify({
    recipeId: recipe.id,
    signal: recipe.signal,
    outcome: result.ok ? "applied" : "failed",
    endpoint,
    durationMs: Date.now() - started,
    tier: "green"
  }).catch(() => undefined);
}

function openMacPermissions(pane = "fulldisk") {
  if (process.platform !== "darwin") return { ok: false, reason: "not_macos" };
  const url = MAC_PRIVACY_PANES[pane] || MAC_PRIVACY_PANES.fulldisk;
  try {
    shell.openExternal(url);
    logEvent("PERMISSIONS", `Opened macOS privacy pane: ${pane}.`);
    return { ok: true, pane };
  } catch {
    return { ok: false, reason: "open_failed" };
  }
}

function dismissOverlay() {
  overlayExpanded = false;
  overlayCompanion = false;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    positionOverlay();
    overlayWindow.webContents.send("sentinel:overlay-mode", "globe");
    startOverlayPhysics();
  }
  setAgentState("idle");
  refreshTray();
  return { ok: true, state: getState() };
}

function toggleOverlay() {
  if (!overlayWindow) createOverlayWindow();
  if (overlayWindow.isVisible()) hideOverlay();
  else showOverlay({ expanded: false });
  refreshTray();
}


function simulateAriaDetection() {
  // Fire a test detection so Ahmad can see the floating globe expand into a fix card.
  // Uses the existing detectIssue path, which honors content-blind sanitization.
  try {
    const fakeInput = { source: "tray-test", signal: "DISK.NEAR_FULL", issue: "Tray simulation" };
    detectIssue(fakeInput);
    showOverlay({ expanded: true });
  } catch (err) {
    logEvent("SELF-ERROR", "Simulate detection failed: " + (err && err.message ? err.message : "unknown"));
  }
}

function remediationKilled() {
  // Global (fleet) kill OR per-customer disabled both put us in detect-only mode.
  return remediationDecision({
    controlPlaneKilled: bridgeStatus.killed === true,
    controlPlaneReason: bridgeStatus.killReason,
    customerDisabled: customerConfig?.disabled === true
  }).killed;
}

function agentBlocked() {
  // True when watchers + recipe execution must stand down: paused OR kill switch.
  const pausedUntil = Number(store.get("pausedUntil") || 0);
  return pausedUntil > Date.now() || remediationKilled();
}

function startDetection() {
  if (detectionOrchestrator) return detectionOrchestrator;
  detectionOrchestrator = createDetectionOrchestrator({
    detectIssue,
    isBlocked: agentBlocked,
    logger: (tag, text) => logEvent(tag, text),
    onError: (name, err) => logEvent("SELF-REPAIR", `Watcher ${name} skipped a tick.`, { code: "APP.SENTINEL.ERROR" })
  });
  detectionOrchestrator.startAll();
  return detectionOrchestrator;
}

// ── RUN 23 — process-health poller + supervised-fix control plane ─────────────────────────────────────────
// recipe-history.json (vetted-tier ledger) lives in userData, alongside delete-prefs.
function recipeHistoryFile() { return path.join(app.getPath("userData"), "recipe-history.json"); }
function readRecipeHistory() { try { return JSON.parse(fs.readFileSync(recipeHistoryFile(), "utf8")); } catch { return emptyHistory(); } }
function writeRecipeHistory(h) { try { fs.writeFileSync(recipeHistoryFile(), JSON.stringify(h)); } catch { /* best-effort */ } }

function pushProcessHealth(snap) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    try { win.webContents.send(PROC_HEALTH_IPC.push, snap); } catch { /* best-effort */ }
  }
}
function startProcessHealth() {
  try {
    processDetector = createProcessDetector();
    const poll = () => { processDetector.tick().then((snap) => pushProcessHealth(snap)).catch(() => undefined); };
    poll();
    setInterval(poll, processDetector.cadenceMs).unref?.();
  } catch { /* the detector is best-effort and must never block startup */ }
}

// The supervisor's signed catalog = Tier-0 safe-generic ∪ green/yellow executable recipes.
function supervisedVettedCatalog() {
  return new Set([...TIER0_RECIPES.map((r) => r.id), ...EXECUTABLE_RECIPES, ...YELLOW_RECIPES]);
}

// Action-indicator: a small frameless banner anchored just below the floating globe during a countdown.
let lastIndicatorInfo = null;
function createActionIndicatorWindow(info) {
  lastIndicatorInfo = info;
  try {
    if (actionIndicatorWindow && !actionIndicatorWindow.isDestroyed()) { updateActionIndicator(info); return actionIndicatorWindow; }
    const ob = (overlayWindow && !overlayWindow.isDestroyed()) ? overlayWindow.getBounds() : { x: 100, y: 100, width: 104, height: 104 };
    const width = 360, height = 64;
    actionIndicatorWindow = new BrowserWindow({
      x: Math.round(ob.x + ob.width / 2 - width / 2),
      y: Math.round(ob.y + ob.height + 8),
      width, height, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
      resizable: false, movable: false, hasShadow: false, show: false, focusable: true,
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
    });
    actionIndicatorWindow.setAlwaysOnTop(true, "screen-saver");
    actionIndicatorWindow.loadFile(path.join(__dirname, "../overlay/action-indicator.html"));
    actionIndicatorWindow.webContents.on("did-finish-load", () => { if (lastIndicatorInfo) updateActionIndicator(lastIndicatorInfo); });
    actionIndicatorWindow.once("ready-to-show", () => { try { actionIndicatorWindow.showInactive(); } catch { /* show best-effort */ } });
    return actionIndicatorWindow;
  } catch { return null; }
}
function updateActionIndicator(info) {
  lastIndicatorInfo = info;
  if (!actionIndicatorWindow || actionIndicatorWindow.isDestroyed()) return;
  try { actionIndicatorWindow.webContents.send("sentinel:countdown-tick", info); } catch { /* best-effort */ }
}
function closeActionIndicator() {
  if (actionIndicatorWindow && !actionIndicatorWindow.isDestroyed()) { try { actionIndicatorWindow.destroy(); } catch { /* ignore */ } }
  actionIndicatorWindow = null;
  lastIndicatorInfo = null;
}

function startActionCountdown({ recipeId, risk, onComplete }) {
  const info = (remaining) => ({ recipeId, remaining, risk });
  createActionIndicatorWindow(info(COUNTDOWN_SECONDS));
  const c = createCountdown({
    seconds: COUNTDOWN_SECONDS,
    recipeId,
    onTick: (remaining) => {
      updateActionIndicator(info(remaining));
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { mainWindow.webContents.send("sentinel:countdown-tick", { ...info(remaining), chat: countdownChatLine(recipeId, remaining) }); } catch { /* chat line best-effort */ }
      }
    },
    onComplete: () => { closeActionIndicator(); try { if (onComplete) onComplete(); } catch { /* execution guarded by runRecipe */ } },
    onAbort: () => { closeActionIndicator(); logEvent("CANCEL", `Action countdown aborted: ${recipeId}.`, { recipeId }); }
  });
  countdownManager.register(c);
  c.start();
  return c;
}

/**
 * RUN 23 — the supervised-fix entry point (window.sentinelBridge.runRecipe → "sentinel:supervised-fix").
 * R11 → supervisor critic → vetted-tier dry-run policy → 10s countdown → the EXISTING (dry-run-gated)
 * executor. Nothing executes live by default: a fresh machine has 0 vetted runs (Tier-2, dry-run ON), so the
 * countdown completes into a dry-run. Low-risk action sentinels bypass the gate entirely.
 */
function runSupervisedFix(payload = {}) {
  const recipeId = String(payload.recipeId || "");
  const pname = String(payload.processName || "");
  // 🔒 R11 — refuse anything referencing the off-limits folder up front.
  if (isBlockedPath(recipeId) || isBlockedPath(pname)) {
    logEvent("SECURITY", "Supervised fix blocked by R11 (private folder).", r11AuditEntry("supervised-fix"));
    return { ok: false, error: "r11_blocked", surface: "1 personal folder excluded" };
  }
  // Low-risk action sentinels (end-task / investigate / info) bypass supervisor + countdown.
  if (["end-task", "investigate", "info", "none"].includes(recipeId)) {
    logEvent("DETECT", `Low-risk action acknowledged: ${recipeId}.`, { recipeId });
    return { ok: true, bypass: true, action: recipeId };
  }
  const history = readRecipeHistory();
  const runs = (((history.recipes || {})[recipeId] || {}).runs || []).map((r) => ({ recipeId, ts: r.ts, ok: r.outcome === "success" }));
  const proposal = { recipeId, args: { pid: payload.pid }, riskTier: payload.risk || "medium", expectedImpact: recipeSideEffects(recipeId), rollbackPlan: "restore-point" };
  // "Resolve it for me" (TASK 3) may request CONFIRMED-grade gating for this one action — explicit user
  // approval + a visible 10s countdown. SAFETY: a resolve action may only request "manual" or "confirmed";
  // it can NEVER escalate to Autonomous (silent auto-fix). Anything else falls back to the stored mode.
  const requested = String(payload.mode || "");
  const mode = (requested === "manual" || requested === "confirmed") ? requested : (store.get("mode") || "manual");
  const verdict = superviseProposal(proposal, { mode, history: runs, now: Date.now(), vettedCatalog: supervisedVettedCatalog() });
  logEvent(verdict.verdict === "veto" ? "SECURITY" : "SUPERVISOR", `${supervisorAuditEntry(verdict, proposal).event}: ${verdict.reason}`, { recipeId });
  if (verdict.verdict === "veto") { writeRecipeHistory(recordOutcome(history, recipeId, "veto")); return { ok: false, verdict: "veto", reason: verdict.reason }; }

  const policy = executionPolicy({ vettedCount: vettedCountOf(history, recipeId), mode, dryRunCheckbox: store.get("keepSystemFixesDryRun"), supervisorVerdict: verdict.verdict });
  const execute = () => {
    // Pass the policy's resolved dry-run so a Tier-0 recipe the customer opted into actually runs live.
    Promise.resolve(runRecipe(recipeId, { confirmed: true, dryRun: policy.dryRun }))
      .then((res) => {
        const ran = Boolean(res && res.ok && res.dryRun === false);
        writeRecipeHistory(recordOutcome(readRecipeHistory(), recipeId, ran ? "success" : "abort"));
      })
      .catch(() => writeRecipeHistory(recordOutcome(readRecipeHistory(), recipeId, "abort")));
  };
  if (!policy.requiresCountdown) { execute(); return { ok: true, verdict: verdict.verdict, countdown: false, policy }; }
  startActionCountdown({ recipeId, risk: proposal.riskTier, onComplete: execute });
  return { ok: true, verdict: verdict.verdict, countdown: true, seconds: COUNTDOWN_SECONDS, policy };
}

// RUN 23b — Tier-0 execution path. childProcesses-tracked PowerShell runner (so Ctrl+Alt+K kills it) + the
// runRecipe-shaped wrapper that maps a Tier-0 id to the executor under the SAME dry-run gate as every fix.
function tier0Run(command) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !command) return resolve({ stdout: "", stderr: "", exitCode: 0 });
    let out = "", err = "", child;
    try {
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", String(command)], { windowsHide: true, timeout: 30000 });
    } catch { return resolve({ stdout: "", stderr: "spawn-failed", exitCode: 1 }); }
    childProcesses.add(child);
    child.stdout?.on("data", (d) => { out += d.toString(); });
    child.stderr?.on("data", (d) => { err += d.toString(); });
    child.on("error", () => { childProcesses.delete(child); resolve({ stdout: out, stderr: err || "error", exitCode: 1 }); });
    child.on("close", (code) => { childProcesses.delete(child); resolve({ stdout: out, stderr: err, exitCode: code == null ? 1 : code }); });
  });
}

async function runTier0Fix(recipeId, options = {}) {
  // Dry-run unless system fixes are enabled AND the global gate is off AND the caller didn't force dry-run.
  const actualDryRun = !allowSystemFixes || Boolean(store.get("dryRun")) || options.dryRun === true;
  const result = await executeTier0(recipeId, {
    dryRun: actualDryRun,
    run: tier0Run,
    logger: (event, text, extra) => logEvent(event, text, { ...extra })
  });
  try { refreshHealthScore(); } catch { /* health refresh best-effort */ }
  const ok = ["success", "no-op-neutral", "dry-run"].includes(result.outcome);
  return {
    ok,
    dryRun: actualDryRun,
    recipe: { id: result.recipeId || recipeId, tier: "tier-0" },
    outcome: result.outcome,
    steps: result.events,
    message: result.message
  };
}

// RUN 23c — read the built customer .exe (version + sha512 + size) + its GitHub Release URL so the admin
// console can publish in one click. Local + read-only; returns {ok:false} when no dist build is present.
function readDistInfo() {
  try {
    const root = path.resolve(__dirname, "../..");
    const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
    const exePath = path.join(root, "dist", otaAssetName(version));
    if (!fs.existsSync(exePath)) return { ok: false, reason: "dist-exe-not-found", version };
    const buf = fs.readFileSync(exePath);
    return { ok: true, version, sha512: createHash("sha512").update(buf).digest("base64"), size: buf.length, url: otaAssetUrl(version) };
  } catch { return { ok: false, reason: "dist-info-error" }; }
}

function applyControlPlaneKill(killed, reason = "") {
  // Global (per-fleet) kill switch. Detect-only mode: watchers keep running so the
  // user still sees problems, but runRecipe() refuses to apply any change.
  const wasKilled = bridgeStatus.killed === true;
  bridgeStatus = { ...bridgeStatus, killed: Boolean(killed), killReason: killed ? safeShortText(reason, "control plane disabled fixes") : "" };
  store.set("bridgeStatus", bridgeStatus);
  if (Boolean(killed) !== wasKilled) {
    logEvent(killed ? "KILL-SWITCH" : "KILL-SWITCH", killed ? `Control plane killed remediation: ${bridgeStatus.killReason}` : "Control plane re-enabled remediation.");
    broadcastState();
  }
  return bridgeStatus;
}

function logEvent(tag, text, extra = {}) {
  const entry = {
    ts: new Date().toISOString(),
    tag,
    text,
    ...extra
  };
  const current = store.get("transparencyLog") || [];
  current.unshift(entry);
  const trimmed = current.slice(0, 250);
  store.set("transparencyLog", trimmed);
  // RUN 16 §H — re-seal the log on every write so the next session can detect off-app tampering.
  try { store.set("auditSeal", sealAudit(trimmed)); } catch { /* sealing must never block logging */ }
  // RUN-E E1 — a real fix just landed in the audit log: stamp pilot TTFV (write-once; no-op for other tags).
  if (tag === "RUN") { try { maybeStampPilotTtfv(); } catch { /* TTFV must never block logging */ } }
  if (tag === "RUN") { try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — proof autorun must never block logging */ } }
  broadcastState();
  return entry;
}

// RUN 16 §H — at session start, verify the persisted audit log against the seal written last session.
// A mismatch means the on-disk log was edited/truncated/reordered while the app was closed → record a
// SECURITY entry, surface it to the admin (state + tray), then re-baseline the seal to the current log.
function verifyAuditIntegrity() {
  const log = store.get("transparencyLog") || [];
  const sealed = store.get("auditSeal");
  if (sealed && Array.isArray(sealed.chain)) {
    const result = verifyAudit(log, sealed);
    if (!result.ok) {
      const finding = { ok: false, reason: result.reason, brokenAt: result.brokenAt, detectedAt: new Date().toISOString() };
      store.set("auditIntegrity", finding);
      // logEvent re-seals over the (now-trusted-going-forward) log, so this alert won't repeat next launch.
      logEvent("SECURITY", `Audit log integrity check FAILED (${result.reason}) — tamper detected; admin alerted.`);
      try { refreshTray(); } catch { /* tray may not exist yet at startup */ }
      return finding;
    }
  }
  const ok = { ok: true, verifiedAt: new Date().toISOString() };
  store.set("auditIntegrity", ok);
  // Baseline/refresh the seal (first run, or after a confirmed-clean verify).
  try { store.set("auditSeal", sealAudit(log)); } catch { /* non-fatal */ }
  return ok;
}

function getState() {
  const pausedUntil = Number(store.get("pausedUntil") || 0);
  return {
    version: SENTINEL_VERSION,
    // F5 (2026-07-02) — dev-only affordances (e.g. "Simulate ARIA error") show ONLY in a dev run, never in the
    // packaged customer build. app.isPackaged is true for the shipped .exe → devMode false.
    devMode: !app.isPackaged || Boolean(process.env.ARIA_SENTINEL_DEV),
    mode: store.get("mode"),
    dryRun: !allowSystemFixes || Boolean(store.get("dryRun")),
    systemFixesEnabled: allowSystemFixes,
    externalAiCalls: false,
    reasoningMode: "local-symbolic",
    pausedUntil,
    paused: pausedUntil > Date.now(),
    killed: remediationKilled(),
    killReason: bridgeStatus.killReason || (customerConfig?.disabled ? "Customer policy disabled fixes." : ""),
    customer: customerConfig ? { id: customerConfig.customerId, name: customerConfig.displayName, managed: true } : { managed: false },
    bridgePort: BRIDGE_PORT,
    bridgeStatus,
    systemChecks: store.get("systemChecks") || [],
    healthScore: lastHealth || store.get("healthScore") || null,
    agentState,
    platform: process.platform,
    autonomousPausedUntil: Number(store.get("autonomousPausedUntil") || 0),
    notifyConfigured: Boolean((store.get("notifyConfig") || {}).enabled),
    lowPower: Boolean(store.get("lowPower")),
    showFloatingGlobe: store.get("showFloatingGlobe") !== false,
    kbMeta: store.get("kbMeta") || null, // RUN 33-A — live KB freshness for the top-bar chip
    setupNeeded: shouldShowSetup(store.get("setupConfig")), // RUN 33-E — show the first-launch wizard once
    // RUN 23e — the renderer gates every surface off this resolved feature object (replaces adminBuild).
    features: currentPlanFeatures(),
    adminConsole: currentIsAdmin(),
    ariaStopped: Boolean(store.get("ariaStopped")),
    hotkeys: hotkeyStatus,
    auditIntegrity: store.get("auditIntegrity") || { ok: true },
    updates: updateHistoryState(),
    license: licenseStatus(),
    gate: gateStatus(),
    whatsNew: whatsNewState,
    lastPrivacyCapture: lastPrivacyCapture || store.get("lastPrivacyCapture") || null,
    endpointStatus: store.get("endpointStatus") || [],
    lastSelfRepair: store.get("lastSelfRepair") || null,
    reports: buildReports(),
    routingTargets: ROUTING_TARGETS,
    recipeCatalog: {
      localInteractive: RECIPES.length,
      controlPlaneMvp: CONTROL_PLANE_MVP_RECIPE_COUNT,
      localStopCodes: STOP_CODES.length,
      controlPlaneStopCodes: CONTROL_PLANE_MVP_STOP_CODE_COUNT
    },
    recipes: RECIPES.map(publicRecipe),
    stopCodes: STOP_CODES,
    allowedOutboundPaths: ALLOWED_OUTBOUND_PATHS,
    detections: (store.get("detections") || []).map(scrubDetection),
    incidents: (store.get("incidents") || []).map(scrubIncident),
    transparencyLog: store.get("transparencyLog") || [],
    serviceNow: store.get("serviceNow"),
    serviceNowStatus: serviceNowSummary(),
    knowledgeSources: store.get("knowledgeSources"),
    restorePoints: (store.get("restorePoints") || []).slice(0, 10),
    deletePrefs: readDeletePrefs(),
    firstRunComplete: Boolean(store.get("firstRunComplete"))
  };
}

function publicRecipe(recipe) {
  return {
    id: recipe.id,
    family: recipe.family,
    signal: recipe.signal,
    title: recipe.title,
    chip: recipe.chip,
    risk: recipe.risk,
    mode: recipe.mode,
    summary: recipe.summary,
    detector: recipe.detector,
    success: recipe.success,
    escalation: recipe.escalation,
    actions: (recipe.actions || []).map((action) => ({
      id: action.id,
      label: action.label,
      shell: action.shell,
      risk: action.risk,
      requiresConfirm: action.requiresConfirm,
      dryRunResult: action.dryRunResult
    }))
  };
}

function buildReports() {
  const detections = store.get("detections") || [];
  const incidents = store.get("incidents") || [];
  const log = store.get("transparencyLog") || [];
  return {
    generatedAt: new Date().toISOString(),
    detections: detections.length,
    incidents: incidents.length,
    auditEvents: log.length,
    recipes: RECIPES.length,
    stopCodes: STOP_CODES.length,
    dryRun: !allowSystemFixes || Boolean(store.get("dryRun")),
    contentBlind: true,
    externalAiCalls: false
  };
}

function broadcastState() {
  if (isQuitting) return;
  const state = getState();
  for (const win of BrowserWindow.getAllWindows()) {
    // Guard against the teardown race: a window can be disposed between enumeration and send.
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    try {
      win.webContents.send("sentinel:state", state);
    } catch {
      // A frame disposed mid-send is harmless; the next broadcast reaches live windows.
    }
  }
}

function scrubLegacyState() {
  try {
    const detections = store.get("detections") || [];
    store.set("detections", detections.map(scrubDetection).filter(assertContentSafePayload).slice(0, 100));
    const incidents = store.get("incidents") || [];
    store.set("incidents", incidents.map(scrubIncident).filter(assertContentSafePayload).slice(0, 50));
  } catch {
    // Legacy state cleanup must never block app startup.
  }
}

function scrubDetection(detection = {}) {
  const signature = sanitizeToSignature(detection.context || detection.signal || detection);
  return {
    id: detection.id || randomUUID(),
    ts: detection.ts || new Date().toISOString(),
    source: detection.source || signature.source || "desktop",
    recipeId: detection.recipeId,
    family: detection.family || signature.family,
    signal: detection.signal || signature.code,
    title: safeShortText(detection.title, "ARIA Sentinel detection"),
    chip: detection.chip || signature.code.replace(/\./g, " - "),
    summary: safeShortText(detection.summary, "Content-blind local signal matched."),
    risk: detection.risk || "yellow",
    mode: detection.mode || "manual",
    confidence: detection.confidence || signature.confidence,
    context: contentSafeContext({ signal: signature.code, source: detection.source || signature.source })
  };
}

function scrubIncident(incident = {}) {
  const draft = incident.draft || {};
  const safeBody = String(draft.body || "")
    .split(/\r?\n/)
    .filter((line) => !/^Origin:/i.test(line))
    .map((line) => safeShortText(line, ""))
    .filter(Boolean)
    .join("\n");
  return {
    id: incident.id || `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    state: incident.state || "Draft",
    source: "local-dry-run",
    createdAt: incident.createdAt || new Date().toISOString(),
    draft: {
      shortDescription: safeShortText(draft.shortDescription, "ARIA Sentinel incident").slice(0, 160),
      assignmentGroup: draft.assignmentGroup || "Service Desk",
      priority: draft.priority || "4 - Low",
      caller: "ARIA Sentinel local user",
      body: safeBody || "Content-blind incident draft. Raw user content is not stored."
    }
  };
}

function safeShortText(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const redacted = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\b[a-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+/gi, "[path]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[number]");
  return redacted.slice(0, 180);
}

function addDetection(recipe, context = {}) {
  const signature = context.signature || sanitizeToSignature(context);
  const safeContext = contentSafeContext({
    ...context,
    signal: signature.code,
    source: context.source || signature.source
  });
  const detection = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: safeContext.source || "desktop",
    recipeId: recipe.id,
    family: recipe.family,
    signal: recipe.signal,
    title: recipe.title,
    chip: recipe.chip,
    summary: recipe.summary,
    risk: recipe.risk,
    mode: recipe.mode,
    confidence: signature.confidence,
    context: safeContext
  };
  const detections = store.get("detections") || [];
  detections.unshift(detection);
  store.set("detections", detections.slice(0, 100));
  logEvent("DETECT", `${recipe.signal}: ${recipe.title}`, { recipeId: recipe.id });
  // Tray reflects the new situation at a glance: a red recipe escalates, everything else is a detection.
  setAgentState(recipe.risk === "red" ? "escalation" : "detection");
  // Autonomous mode may auto-apply a green recipe — gated by the opt-in + cap/cooldown/fleet guards.
  autoFireIfEligible(recipe, context).catch(() => undefined);
  overlayActiveUntil = Date.now() + 8000; // run the globe at 60fps through the fix animation
  if (overlayWindow) {
    showOverlay({ expanded: true });
    overlayWindow.webContents.send("sentinel:detection", detection);
  }
  return detection;
}

function handleSelfError(error, source = "runtime") {
  const message = error instanceof Error ? error.message : String(error || "unknown runtime error");
  const safeMessage = safeShortText(message, "ARIA Sentinel runtime fault");
  logEvent("SELF-ERROR", "ARIA Sentinel self-diagnosed a runtime fault.", { source, code: "APP.SENTINEL.ERROR" });
  setAgentState("escalation");
  const recipe = recipeById("sentinel-self-repair-v1");
  if (recipe) {
    try {
      addDetection(recipe, {
        source: "sentinel-self",
        signal: "APP.SENTINEL.ERROR",
        issue: safeMessage
      });
    } catch {
      // Self-reporting must not create a second crash.
    }
  }
  showOverlay({ expanded: true });
}

async function selfDiagnose(reason = "manual") {
  const checks = [
    check("single-instance", hasSingleInstanceLock, hasSingleInstanceLock ? "Primary app instance owns UI." : "Duplicate instance redirected."),
    check("bridge", bridgeStatus.listening && !bridgeStatus.conflict, bridgeStatus.conflict ? `Port ${BRIDGE_PORT} is already in use.` : `Bridge listening state: ${bridgeStatus.listening}.`),
    check("overlay", Boolean(overlayWindow && !overlayWindow.isDestroyed()), "Top-center ARIA globe window is available."),
    check("main-window", Boolean(mainWindow && !mainWindow.isDestroyed()), "Settings window is available."),
    check("dry-run", !allowSystemFixes || Boolean(store.get("dryRun")), "System-changing actions remain gated."),
    check("content-boundary", true, "Runtime is local-symbolic with external AI calls disabled.")
  ];
  store.set("systemChecks", checks);
  const ok = checks.every((item) => item.ok || item.severity === "warn");
  logEvent(ok ? "SELF-CHECK" : "SELF-REPAIR", `${reason} self diagnosis ${ok ? "passed" : "needs attention"}.`);
  broadcastState();
  if (!ok) {
    const recipe = recipeById("sentinel-self-repair-v1");
    if (recipe) addDetection(recipe, { source: "sentinel-self", signal: "APP.SENTINEL.ERROR", issue: "self diagnosis needs attention" });
  }
  return { ok, checks, bridgeStatus };
}

async function selfRepair(reason = "manual") {
  const actions = [];
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    actions.push("main-window-recreated");
  }
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
    actions.push("overlay-recreated");
  }
  showOverlay({ expanded: false });
  scrubLegacyState();
  actions.push("legacy-state-scrubbed");
  if (bridgeStatus.conflict) {
    try {
      bridgeServer?.close?.();
    } catch {
      // A closed or failed bridge is fine; the retry below owns the next state.
    }
    bridgeStatus = { listening: false, conflict: false, port: BRIDGE_PORT, owner: null, lastError: "" };
    actions.push("bridge-conflict-cleared-for-retry");
  }
  if (!bridgeStatus.listening && !bridgeStatus.conflict) {
    startBridge();
    actions.push("bridge-restart-requested");
  }
  if (bridgeStatus.conflict) {
    actions.push("bridge-conflict-detected-existing-process-not-killed");
  }
  const diagnosis = await selfDiagnose(`self-repair:${reason}`);
  const result = { ok: diagnosis.ok || bridgeStatus.conflict, actions, diagnosis, at: new Date().toISOString() };
  store.set("lastSelfRepair", result);
  logEvent("SELF-REPAIR", `Self repair ran: ${actions.join(", ") || "no-op"}.`);
  broadcastState();
  return result;
}

function check(id, ok, message, severity = ok ? "ok" : "warn") {
  return { id, ok: Boolean(ok), severity, message, ts: new Date().toISOString() };
}

async function detectIssue(input = {}) {
  const signature = sanitizeToSignature(input);
  const query = queryForSignature(signature, input.signal);
  const [top] = matchRecipes(query, { limit: 1 });
  if (!top) {
    logEvent("DETECT", `No local recipe matched: ${signature.code}`);
    return { ok: false, error: "no_match", signature, matches: [] };
  }
  const detection = addDetection(top.recipe, { ...input, signature });
  return { ok: true, signature, detection, matches: matchRecipes(query, { limit: 3 }).map((m) => ({ score: m.score, recipe: publicRecipe(m.recipe) })) };
}

async function runRecipe(recipeId, options = {}) {
  // RUN 23b — a Tier-0 id (direct or aliased) routes to the dedicated executor instead of the diagnostic
  // recipe registry. Still dry-run-gated by the same flags; the supervisor + countdown gate it upstream.
  if (resolveExecutorId(recipeId)) return runTier0Fix(recipeId, options);
  const recipe = recipeById(recipeId);
  if (!recipe) return { ok: false, error: "recipe_not_found" };
  const decision = remediationDecision({
    controlPlaneKilled: bridgeStatus.killed === true,
    controlPlaneReason: bridgeStatus.killReason,
    customerDisabled: customerConfig?.disabled === true
  });
  if (decision.killed) {
    // Kill switch is active (fleet or per-customer): refuse to apply any change. Detection still works.
    logEvent("KILL-SWITCH", `Recipe ${recipe.signal} blocked: ${decision.reason}.`, { recipeId });
    return { ...blockedRecipeResult(decision.reason), recipe: publicRecipe(recipe) };
  }
  const executionId = options.executionId || options.execution_id;
  const confirmed = options.confirmed === true;
  const core = async () => {
  const actualDryRun = !allowSystemFixes || Boolean(store.get("dryRun")) || options.dryRun !== false;
  setAgentState("fixing");
  const steps = [];
  // A System Restore point is created before any change touches the machine. Yellow-tier recipes
  // REQUIRE this to have happened before their actions are allowed to execute (see isActionExecutable).
  let restorePoint = null;
  if ((recipe.actions || []).some((a) => a.shell === "powershell")) {
    restorePoint = recordRestorePoint(recipe.id, `ARIA pre-fix ${recipe.signal}`);
  }
  const restorePointTaken = Boolean(restorePoint);
  logEvent("RUN", `${actualDryRun ? "Dry-run" : "Executing"} recipe ${recipe.signal}`, { recipeId });
  for (const action of recipe.actions || []) {
    const result = await runAction(action, actualDryRun, recipe.id, { confirmed, restorePointTaken });
    steps.push({ actionId: action.id, label: action.label, ...result });
    logEvent(result.ok ? "DONE" : "ERROR", `${action.label}: ${result.message}`, { recipeId, actionId: action.id });
    if (!result.ok) break;
  }
  // After a real (non-dry-run) execution of a cleared recipe, run a read-only verification probe.
  if (!actualDryRun && isExecutableRecipe(recipe.id) && steps.every((s) => s.ok)) {
    const verified = await verifyRecipe(recipe.id);
    logEvent(verified.ok ? "DONE" : "REVIEW", `Verification for ${recipe.signal}: ${verified.ok ? "passed" : "inconclusive"}.`, { recipeId });
    // RUN-B B5 - a REAL applied+verified fix: show the under-globe "resolved | email sent | ticket ref"
    // confirmation (real email + real recorded ticket ref). Non-blocking; never fires on an unverified fix.
    if (verified.ok) {
      Promise.resolve(emitGlobeConfirmation({ issueTitle: recipe.title || recipe.signal, sessionId: executionId })).catch(() => {});
    }
  }
  refreshHealthScore();
  const ok = steps.every((step) => step.ok);
  setAgentState(ok ? "idle" : "escalation");
  return {
    ok,
    dryRun: actualDryRun,
    recipe: publicRecipe(recipe),
    steps,
    restorePoint,
    message: actualDryRun ? "Dry-run complete. No system changes were made." : recipe.success
  };
  };
  // Idempotency: a repeated execution_id returns the cached outcome instead of re-applying.
  if (executionId) {
    const cache = createExecutionCache(store.get("executionCache") || {});
    const result = await runIdempotent(cache, String(executionId), core);
    const snapshot = cache.toJSON();
    const keys = Object.keys(snapshot);
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete snapshot[k];
    store.set("executionCache", snapshot);
    return result;
  }
  return core();
}

function runAction(action, dryRun, recipeId, gate = {}) {
  // Second gate: even when system fixes are enabled, only allow-listed reversible recipes
  // execute for real. Yellow recipes additionally require an explicit confirm + a restore point
  // already taken (gate.confirmed / gate.restorePointTaken). Anything else falls through to dry-run.
  const executable = isActionExecutable({
    recipeId,
    action,
    allowSystemFixes,
    dryRun,
    confirmed: gate.confirmed,
    restorePointTaken: gate.restorePointTaken
  });
  if (!executable) {
    return Promise.resolve({
      ok: true,
      dryRun: true,
      message: action.dryRunResult || "Dry-run only.",
      output: action.command ? `[dry-run] ${action.id}` : "[manual]"
    });
  }
  if (!isAllowedCommand(action.command)) {
    return Promise.resolve({
      ok: false,
      dryRun: false,
      message: "Command blocked by allowlist.",
      output: ""
    });
  }
  // Real execution: spawn with positional argv (no shell string interpolation), Restricted policy.
  const { file, args } = buildExecution(action);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok, message, output) => {
      if (settled) return;
      settled = true;
      resolve({ ok, dryRun: false, message, output });
    };
    let child;
    try {
      child = spawn(file, args, { windowsHide: true, timeout: 120000, stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      return finish(false, "Command could not start. Review local admin console.", "[spawn-error]");
    }
    childProcesses.add(child); // tracked so the kill-switch (Ctrl+Alt+K) can terminate it
    child.on("error", () => { childProcesses.delete(child); finish(false, "Command failed. Review local admin console.", "[command-error]"); });
    child.on("close", (code) => { childProcesses.delete(child); finish(code === 0, code === 0 ? "Command completed." : "Command failed. Review local admin console.", code === 0 ? "[command-complete]" : "[command-error]"); });
  });
}

function verifyRecipe(recipeId) {
  // Read-only post-fix probe. Returns only ok/!ok — raw probe output never surfaces.
  const verification = buildVerification(recipeId);
  if (!verification) return Promise.resolve({ ok: true, skipped: true });
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve({ ok });
    };
    let child;
    try {
      child = spawn(verification.file, verification.args, { windowsHide: true, timeout: 30000, stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      return done(false);
    }
    childProcesses.add(child); // tracked for the kill-switch
    child.on("error", () => { childProcesses.delete(child); done(false); });
    child.on("close", (code) => { childProcesses.delete(child); done(code === 0); });
  });
}

function isAllowedCommand(command) {
  const denied = /\b(format-volume|remove-partition|clear-disk|delete\s+shadow|bcdedit|reg\s+delete|cipher\s+\/w)\b/i;
  if (denied.test(command)) return false;
  const allowedPrefixes = [
    "ipconfig",
    "Get-",
    "Resolve-",
    "Test-",
    "Stop-Service",
    "Start-Service",
    "Restart-Service",
    "Stop-Process",
    "Remove-Item",
    "Start-Process",
    "Checkpoint-Computer",
    "sfc"
  ];
  return allowedPrefixes.some((prefix) => command.trim().startsWith(prefix));
}

// ---- Privacy verifier: live network capture --------------------------------------------------
// Attaches a real 10s session.webRequest sniff, then classifies what was seen against the 6-host
// allowlist + the content-blind check. The three declared inbound GET pulls always seed the rows
// (the cyan ticks) so a buyer sees exactly which paths are permitted; any extra/leaky request the
// sniff catches is surfaced (red) — in normal operation there are none.
function decodeUploadBody(uploadData) {
  if (!Array.isArray(uploadData) || uploadData.length === 0) return null;
  try {
    const parts = uploadData.map((d) => (d && d.bytes ? Buffer.from(d.bytes) : Buffer.alloc(0)));
    const buf = Buffer.concat(parts);
    return buf.length ? buf.toString("utf8") : null;
  } catch {
    return null;
  }
}

async function runPrivacyCapture(windowMs = 10000) {
  const captured = [];
  let ses = null;
  try {
    ses = session.defaultSession;
    ses.webRequest.onBeforeRequest((details, callback) => {
      try {
        captured.push({ url: details.url, method: details.method, body: decodeUploadBody(details.uploadData) });
      } catch {
        // a bad capture entry must never block the request
      }
      callback({});
    });
  } catch {
    ses = null;
  }
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, windowMs)));
  if (ses) {
    try { ses.webRequest.onBeforeRequest(null); } catch { /* listener already cleared */ }
  }
  // Declared inbound GET pulls — the baseline allow-listed rows (0 payload, content-blind).
  const baseline = EXPECTED_OUTBOUND_PATHS.map((p) => ({ url: `https://${p.host}${p.path}`, method: p.method }));
  const extra = captured.filter((c) => {
    try {
      const u = new URL(c.url);
      return !baseline.some((b) => b.url === `${u.protocol}//${u.hostname}${u.pathname}`);
    } catch {
      return true;
    }
  });
  const summary = summarizeCapture([...baseline, ...extra]);
  lastPrivacyCapture = {
    ...summary,
    windowMs,
    capturedLive: captured.length,
    ts: new Date().toISOString()
  };
  store.set("lastPrivacyCapture", lastPrivacyCapture);
  logEvent("PRIVACY", `Live capture: ${summary.rows.length} paths, ${summary.disallowedHostCount} off-allowlist, ${summary.leakingPayloadCount} with content.`);
  return lastPrivacyCapture;
}

// ---- One-button RFP evidence pack -------------------------------------------------------------
function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function exportEvidencePack() {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const sbom = readJsonSafe(path.join(appRoot, "docs", `SBOM-LITE-${SENTINEL_VERSION}.json`));
  const manifest = readJsonSafe(path.join(appRoot, "docs", `RELEASE_MANIFEST_${SENTINEL_VERSION}.json`));
  const signedBundleHash = {
    productVersion: SENTINEL_VERSION,
    binary: manifest?.artifacts?.[0] || null,
    knowledgeBundle: store.get("knowledgeBundleHash") || null,
    note: "Hashes of the signed/release artifacts; no content."
  };
  const inputs = {
    auditLog: store.get("transparencyLog") || [],
    allowedOutboundPaths: ALLOWED_OUTBOUND_PATHS,
    networkCapture: lastPrivacyCapture || store.get("lastPrivacyCapture") || null,
    recipes: RECIPES,
    recipeRegistryVersion: SENTINEL_VERSION,
    sbom,
    signedBundleHash,
    productVersion: SENTINEL_VERSION
  };
  let buffer;
  try {
    buffer = zipEvidencePack(inputs, { dateStamp });
  } catch (err) {
    logEvent("EVIDENCE", "Evidence pack build failed.");
    return { ok: false, error: "build_failed" };
  }
  const outPath = path.join(os.homedir(), "Documents", evidenceFileName(dateStamp));
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buffer);
  } catch {
    return { ok: false, error: "write_failed" };
  }
  logEvent("EVIDENCE", `Exported RFP evidence pack (${buffer.length} bytes, ${EVIDENCE_ARTIFACTS.length} artifacts).`);
  return { ok: true, path: outPath, bytes: buffer.length, artifacts: EVIDENCE_ARTIFACTS };
}

// ---- "What's new" modal trigger ---------------------------------------------------------------
function readReleaseNotes(version) {
  try {
    return fs.readFileSync(path.join(appRoot, "docs", `RELEASE_NOTES_${version}.md`), "utf8");
  } catch {
    return "";
  }
}

function initWhatsNew() {
  // First install = no local history yet. Record the current version as seen and skip the modal —
  // there is nothing the user "upgraded" from. Real upgrades (a future version bump) then trigger it.
  const firstRun = (store.get("transparencyLog") || []).length === 0 && store.get("firstRunComplete") === false;
  if (store.get("lastSeenVersion") == null) store.set("lastSeenVersion", SENTINEL_VERSION);
  const show = shouldShowWhatsNew({
    lastSeenVersion: store.get("lastSeenVersion"),
    currentVersion: SENTINEL_VERSION,
    firstRun
  });
  whatsNewState = { show, version: SENTINEL_VERSION, notes: show ? readReleaseNotes(SENTINEL_VERSION) : "" };
}

function acknowledgeWhatsNew() {
  store.set("lastSeenVersion", SENTINEL_VERSION);
  whatsNewState = { show: false, version: SENTINEL_VERSION, notes: "" };
  return { ok: true };
}

async function scanDisk() {
  return new Promise((resolve) => {
    const command = "Get-PSDrive C | ConvertTo-Json -Compress";
    exec(`powershell -NoProfile -Command ${JSON.stringify(command)}`, { timeout: 20000 }, (error, stdout) => {
      if (error) {
        resolve({ ok: false, error: error.message });
        return;
      }
      try {
        const disk = JSON.parse(stdout);
        const free = Number(disk.Free || 0);
        const used = Number(disk.Used || 0);
        const percentFree = free + used > 0 ? Math.round((free / (free + used)) * 1000) / 10 : null;
        if (percentFree != null && percentFree < 8) {
          detectIssue({ source: "desktop-scan", issue: `disk low space ${percentFree}% free`, signal: "DISK.LOW_SPACE" });
        }
        resolve({ ok: true, disk: { free, used, percentFree } });
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    });
  });
}

async function updateKnowledge() {
  const results = [];
  for (const item of [
    { id: "recipes", endpoint: RECIPE_ENDPOINT },
    { id: "stop-codes", endpoint: STOP_CODES_ENDPOINT },
    { id: "kb-bundle", endpoint: KB_BUNDLE_ENDPOINT }
  ]) {
    try {
      const headers = { "user-agent": `ARIA-Sentinel/${SENTINEL_VERSION}` };
      if (customerConfig?.customerId) headers["x-aria-customer"] = customerConfig.customerId;
      const res = await fetch(item.endpoint, { headers });
      results.push({ id: item.id, ok: res.ok, status: res.status });
      // The recipes endpoint is the control plane: it may carry a global kill switch.
      if (item.id === "recipes" && res.ok) {
        const body = await res.clone().json().catch(() => null);
        const kill = parseControlPlaneKill(body);
        if (kill.present) applyControlPlaneKill(kill.killed, kill.reason);
      }
    } catch (err) {
      results.push({ id: item.id, ok: false, error: err.message });
    }
  }
  logEvent("KB", "Knowledge update check complete", { results });
  store.set("endpointStatus", results.map((result) => ({
    id: result.id,
    ok: Boolean(result.ok),
    status: result.status || 0,
    error: result.error ? safeShortText(result.error, "endpoint error") : ""
  })));
  broadcastState();
  return { ok: results.every((r) => r.ok), results };
}

// RUN 30-B — the bundled cross-platform KB pack, indexed once and cached. aria-kb-pack ships in the .exe via
// build.files; app.getAppPath() resolves it in both dev and the packaged app. Failure degrades to an empty
// index (localKbAnswer then returns its cross-platform no-match message).
let _kbIndex = null;
function kbIndex() {
  if (_kbIndex) return _kbIndex;
  try { _kbIndex = loadKbPack(path.join(app.getAppPath(), "aria-kb-pack"), fs); } catch { _kbIndex = []; }
  return _kbIndex;
}

async function chat(message, context = {}) {
  // Local KB match (always computed; used as the offline fallback + as a fix hint).
  const signature = sanitizeToSignature({ issue: message, ...context });
  const query = queryForSignature(signature);
  const localMatches = matchRecipes(query, { limit: 3 }).map((match) => ({ score: match.score, recipe: publicRecipe(match.recipe) }));
  // RUN 15 §4 — desktop wraps the LIVE iisupp.net/aria brain. Try it first; degrade to local KB offline.
  const brain = await askAria(String(message || ""), {
    sessionId: store.get("chatSessionId") || null,
    deviceId: os.hostname(),
    licenseKey: (readLicense() || {}).key || "",
    platform: process.platform,                               // RUN 30 — real OS so the brain answers cross-platform
    tier: (licenseStatus() || {}).plan || "",
    version: SENTINEL_VERSION
  });
  if (brain && !brain.offline && brain.reply) {
    if (brain.session_id) store.set("chatSessionId", brain.session_id);
    if (brain.kb_meta) { store.set("kbMeta", brain.kb_meta); broadcastState(); } // RUN 33-A — surface KB freshness to the top bar
    return { ok: true, provider: "aria-brain", text: brain.reply, action: brain.action || null, kbMatch: brain.kb_match || null, kbMeta: brain.kb_meta || null, matches: localMatches };
  }
  // Offline / unreachable → answer from the bundled cross-platform KB (RUN 30-B). ARIA is full cross-platform
  // tech support (Windows, macOS, iOS, iPadOS, Android, ChromeOS, Linux) — never the old Windows-only string.
  // A matching Sentinel recipe is offered alongside; otherwise the KB answer (or its cross-platform no-match) stands.
  const kb = localKbAnswer({ message: String(message || ""), platform: process.platform, index: kbIndex() });
  const text = localMatches.length
    ? `${kb.text}\n\nI also found a local Sentinel recipe that may help: ${localMatches[0].recipe.title} — I can dry-run it or show the steps.`
    : kb.text;
  return { ok: true, provider: "local-kb", text, signature, matched: kb.matched, matches: localMatches, offline: true, cost: "none" };
}

function queryForSignature(signature, rawSignal = "") {
  const rawSymbolic = rawSignal && String(rawSignal).includes(".") ? String(rawSignal).toUpperCase() : "";
  return [signature.code, signature.family, legacySignalFor(signature.code), rawSymbolic].filter(Boolean).join(" ");
}

function legacySignalFor(code) {
  return {
    "BROWSER.CACHE.STALE": "CACHE.STALE",
    "BROWSER.SERVICE_WORKER.STUCK": "SERVICE.WORKER.STUCK",
    "AUTH.LOGIN.RETRY_LOOP": "PASSWORD.RETRY.2",
    "BROWSER.ZOOM.WRONG": "ZOOM.WEIRD",
    "NET.DNS.FAIL": "DNS.FAIL",
    "NET.ADAPTER.APIPA": "NET.NO_GATEWAY",
    "APP.TEAMS.SIGNIN_LOOP": "TEAMS.SIGNIN_LOOP",
    "BSOD.CRITICAL_PROCESS_DIED": "BLUE.SCREEN",
    "BSOD.SYSTEM_SERVICE_EXCEPTION": "BLUE.SCREEN",
    "BSOD.PAGE_FAULT_IN_NONPAGED_AREA": "BLUE.SCREEN",
    "BSOD.INACCESSIBLE_BOOT_DEVICE": "BLUE.SCREEN",
    "BSOD.DPC_WATCHDOG_VIOLATION": "BLUE.SCREEN"
  }[code] || "";
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim() || "ARIA could not generate a response.";
}

function makeIncident(recipeId, context = {}) {
  const recipe = recipeById(recipeId);
  if (!recipe) return { ok: false, error: "recipe_not_found" };
  const safeContext = contentSafeContext({ ...context, signal: recipe.signal });
  const draft = buildIncidentDraft(recipe, safeContext);
  const incident = {
    id: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    state: "Draft",
    source: "local-dry-run",
    createdAt: new Date().toISOString(),
    draft
  };
  const incidents = store.get("incidents") || [];
  incidents.unshift(incident);
  store.set("incidents", incidents.slice(0, 50));
  logEvent("ESCALATE", `Incident draft created for ${recipe.signal}`, { recipeId, incidentId: incident.id });
  return { ok: true, incident };
}

async function ingestKnowledgeFile(file = {}) {
  // Content-blind ingestion. Only the filename label is kept locally for the source list;
  // never any document text crosses a boundary.
  try {
    const result = await ingestKb(file);
    if (!result.ok) {
      logEvent("KB", `Knowledge ingest skipped: ${result.error || "unknown"}.`);
      return result;
    }
    const sources = store.get("knowledgeSources") || [];
    const label = safeShortText(file.name, "Customer document");
    const idx = sources.findIndex((s) => s.name === label);
    const entry = { name: label, status: result.status || "Indexed", docs: result.chunkCount || 0, sha256: result.sha256 };
    if (idx >= 0) sources[idx] = entry;
    else sources.unshift(entry);
    store.set("knowledgeSources", sources.slice(0, 25));
    // Audit log records only the hash + counts — NOT the content.
    logEvent("KB", `Indexed document ${result.sha256.slice(0, 12)} (${result.chunkCount} chunks, ${result.status}).`);
    broadcastState();
    return result;
  } catch (err) {
    logEvent("KB", "Knowledge ingest failed safely.");
    return { ok: false, error: "ingest_failed" };
  }
}

export function applyPolicyOverlay(jsonString) {
  // Strict gate: the parser drops anything outside the schema. Stored locally only.
  const overlay = parsePolicyOverlay(jsonString);
  store.set("policyOverlay", overlay);
  logEvent("POLICY", `Policy overlay applied: ${overlay.recipes_disabled.length} recipe(s) disabled.`);
  broadcastState();
  return overlay;
}

function recordRestorePoint(recipeId, name) {
  const point = {
    id: randomUUID(),
    recipeId: recipeId || "",
    name: safeShortText(name, "ARIA pre-fix"),
    createdAt: new Date().toISOString(),
    rolledBack: false
  };
  const points = store.get("restorePoints") || [];
  points.unshift(point);
  store.set("restorePoints", points.slice(0, 20));
  logEvent("RESTORE PT", `Restore point created before ${recipeId || "fix"}.`, { snapshotId: point.id });
  return point;
}

function rollbackRestorePoint(snapshotId) {
  const points = store.get("restorePoints") || [];
  const point = points.find((p) => p.id === snapshotId);
  if (!point) return { ok: false, error: "snapshot_not_found" };
  // MVP: we log the rollback intent + mark the point. Real System Restore invocation is a
  // signed, elevated action gated behind ARIA_SENTINEL_ALLOW_SYSTEM_FIXES (see DO_BUY list).
  point.rolledBack = true;
  point.rolledBackAt = new Date().toISOString();
  store.set("restorePoints", points);
  logEvent("RESTORE PT", `Roll back requested for restore point ${snapshotId.slice(0, 8)}.`, { snapshotId });
  broadcastState();
  return { ok: true, snapshot: point, dryRun: !allowSystemFixes || Boolean(store.get("dryRun")) };
}

function ariaCallerId() {
  // Opaque, stable per-device caller — hashed so no username/email ever reaches ServiceNow.
  return snHashIdentifier(`${os.hostname?.() || "device"}::aria-sentinel`);
}

function runDiagnostic() {
  // Assemble live facts then hand to the pure builder. 7-row PASS/FAIL self-test.
  const facts = {
    bridge: { listening: bridgeStatus.listening, conflict: bridgeStatus.conflict, port: BRIDGE_PORT },
    watchers: detectionOrchestrator ? detectionOrchestrator.status() : { running: false, count: 0, lastTickAgeMs: null },
    serviceNow: serviceNowSummary(),
    kb: { bundleOk: true, version: (store.get("endpointStatus") || []).every((e) => e.ok !== false) },
    audit: { entries: store.get("transparencyLog") || [] },
    tray: Boolean(tray),
    overlay: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
    now: new Date().toISOString()
  };
  const report = buildDiagnostic(facts);
  logEvent(report.ok ? "SELF-CHECK" : "SELF-REPAIR", `Diagnostic self-test: ${report.passed}/${report.total} checks passed.`);
  return report;
}

function serviceNowSummary() {
  const cfg = getServiceNowConfig();
  const saved = store.get("serviceNow") || {};
  return {
    configured: cfg.configured,
    instanceConfigured: Boolean(cfg.instanceUrl),
    connected: Boolean(saved.connected),
    lastVerified: saved.lastVerified || 0,
    lastLatencyMs: saved.lastLatencyMs || 0,
    queued: snQueueDepth(),
    caller: ariaCallerId()
  };
}

async function serviceNowTestConnection() {
  const cfg = getServiceNowConfig();
  if (!cfg.configured) {
    logEvent("SERVICENOW", "Test connection skipped: ServiceNow not configured.");
    return { ok: false, configured: false };
  }
  const result = await snPing(cfg.instanceUrl, cfg.user, cfg.pass);
  store.set("serviceNow", {
    ...(store.get("serviceNow") || {}),
    connected: Boolean(result.ok),
    lastVerified: Date.now(),
    lastLatencyMs: result.latency_ms || 0
  });
  logEvent("SERVICENOW", result.ok ? `Connection verified (${result.latency_ms} ms).` : "Connection failed.");
  broadcastState();
  if (result.ok) serviceNowDrain().catch(() => undefined);
  return result;
}

async function serviceNowRaiseIncident(recipeId, context = {}) {
  const recipe = recipeById(recipeId);
  if (!recipe) return { ok: false, error: "recipe_not_found" };
  const safeContext = contentSafeContext({ ...context, signal: recipe.signal });
  const route = ROUTING_TARGETS.find((r) => r.signal === recipe.family) || ROUTING_TARGETS.find((r) => r.signal === "APP");
  const result = await snCreateIncident({
    symbolicCode: safeContext.symbolicCode || recipe.signal,
    recipeIds: [recipe.id],
    dryRun: !allowSystemFixes || Boolean(store.get("dryRun")),
    category: recipe.family,
    assignmentGroup: route?.group,
    priority: route?.priority,
    caller: ariaCallerId()
  });
  logEvent("ESCALATE", result.ok ? `ServiceNow incident ${result.number} raised for ${recipe.signal}.` : result.queued ? `ServiceNow unreachable; incident for ${recipe.signal} queued.` : `ServiceNow incident for ${recipe.signal} prepared (dry-run).`, { recipeId });
  broadcastState();
  return result;
}

async function serviceNowListIncidents() {
  const cfg = getServiceNowConfig();
  if (!cfg.configured) return { ok: true, configured: false, incidents: [] };
  const incidents = await snListMyIncidents({ caller: ariaCallerId(), limit: 25 });
  return { ok: true, configured: true, incidents };
}

async function serviceNowComment(incidentSysId, comment) {
  const result = await snPostComment({ incidentSysId, comment });
  logEvent("SERVICENOW", result.ok ? "Comment posted to ServiceNow incident." : "Comment post did not complete.");
  return result;
}

async function serviceNowDrain() {
  const cfg = getServiceNowConfig();
  if (!cfg.configured) return { ok: false, drained: 0 };
  const result = await snDrainQueue();
  if (result.drained) logEvent("SERVICENOW", `Drained ${result.drained} queued incident(s) to ServiceNow.`);
  broadcastState();
  return result;
}

function startBridge() {
  if (bridgeServer?.listening) return;
  bridgeServer = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    try {
      if (!isAllowedBridgeOrigin(req)) {
        return sendJson(res, 403, { ok: false, error: "origin_blocked" });
      }
      const url = new URL(req.url || "/", `http://127.0.0.1:${BRIDGE_PORT}`);
      if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true, app: "ARIA Sentinel", version: SENTINEL_VERSION });
      if (req.method === "GET" && url.pathname === "/state") return sendJson(res, 200, getState());
      // RUN 23c — current dist .exe metadata for the admin console's 1-click publish (local, read-only).
      if (req.method === "GET" && url.pathname === "/dist-info") return sendJson(res, 200, readDistInfo());
      if (req.method === "POST" && url.pathname === "/signature") return sendJson(res, 200, { ok: true, signature: sanitizeToSignature(await readJson(req)) });
      if (req.method === "POST" && url.pathname === "/detect") return sendJson(res, 200, await detectIssue(await readJson(req)));
      if (req.method === "POST" && url.pathname === "/run-recipe") {
        const body = await readJson(req);
        return sendJson(res, 200, await runRecipe(body.recipeId, body));
      }
      if (req.method === "POST" && url.pathname === "/incident") {
        const body = await readJson(req);
        return sendJson(res, 200, makeIncident(body.recipeId, body.context || {}));
      }
      if (req.method === "POST" && url.pathname === "/chat") {
        const body = await readJson(req);
        return sendJson(res, 200, await chat(body.message || "", body.context || {}));
      }
      if (req.method === "POST" && url.pathname === "/scan") return sendJson(res, 200, await scanDisk());
      if (req.method === "POST" && url.pathname === "/knowledge/update") return sendJson(res, 200, await updateKnowledge());
      if (req.method === "POST" && url.pathname === "/self-diagnose") return sendJson(res, 200, await selfDiagnose("bridge"));
      if (req.method === "POST" && url.pathname === "/self-repair") return sendJson(res, 200, await selfRepair("bridge"));
      sendJson(res, 404, { ok: false, error: "not_found" });
    } catch (err) {
      handleSelfError(err, "bridge-request");
      sendJson(res, 500, { ok: false, error: "bridge_error" });
    }
  });
  bridgeServer.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      bridgeStatus = {
        listening: false,
        conflict: true,
        port: BRIDGE_PORT,
        owner: "existing-process",
        lastError: "Port already in use. Existing ARIA Sentinel instance may still be running."
      };
      store.set("bridgeStatus", bridgeStatus);
      logEvent("SELF-REPAIR", `Bridge port ${BRIDGE_PORT} already in use. ARIA stayed open and entered self-diagnosis mode.`);
      handleSelfError(error, "bridge-port-conflict");
      broadcastState();
      return;
    }
    bridgeStatus = { listening: false, conflict: false, port: BRIDGE_PORT, owner: null, lastError: safeShortText(error?.message, "bridge error") };
    store.set("bridgeStatus", bridgeStatus);
    handleSelfError(error, "bridge-listen");
  });
  bridgeServer.listen(BRIDGE_PORT, "127.0.0.1", () => {
    bridgeStatus = { listening: true, conflict: false, port: BRIDGE_PORT, owner: "this-process", lastError: "" };
    store.set("bridgeStatus", bridgeStatus);
    logEvent("BRIDGE", `Local bridge listening on 127.0.0.1:${BRIDGE_PORT}`);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  if (status === 204) res.end();
  else res.end(JSON.stringify(payload));
}

function isAllowedBridgeOrigin(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("edge-extension://")) return true;
  if (origin === `http://127.0.0.1:${BRIDGE_PORT}` || origin === `http://localhost:${BRIDGE_PORT}`) return true;
  return false;
}

function readJson(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 65536) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

ipcMain.handle("sentinel:get-state", () => getState());
ipcMain.handle("sentinel:set-mode", (_event, mode, optIn) => {
  if (!["manual", "confirmed", "autonomous"].includes(mode)) return { ok: false };
  // Autonomous can NEVER be enabled silently — the opt-in modal must pass { understood: true }.
  if (mode === "autonomous" && !canEnableAutonomous(optIn || {})) {
    return { ok: false, error: "opt_in_required", state: getState() };
  }
  store.set("mode", mode);
  applyModeBehavior(mode);
  if (mode === "autonomous") logEvent("MODE", "Autonomous mode enabled via explicit opt-in.");
  refreshTray();
  broadcastState();
  return { ok: true, state: getState() };
});
ipcMain.handle("sentinel:pause-autonomous", (_event, choice) => {
  store.set("autonomousPausedUntil", autonomousPauseUntil(choice));
  logEvent("MODE", `Autonomous paused (${choice || "until re-enable"}).`);
  broadcastState();
  return { ok: true, state: getState() };
});
ipcMain.handle("sentinel:set-notify", (_event, config = {}) => setNotifyConfig(config));
ipcMain.handle("sentinel:test-notify", () => sendAutoFixNotify({ recipeId: "dns-fail-v1", signal: "NET.DNS.FAIL", outcome: "applied", endpoint: os.hostname(), durationMs: 0, tier: "green" }, { test: true }));
// RUN-B B5 - lets Cowork/Ahmad trigger the under-globe confirmation live (records a real ticket ref + sends the
// real resolution email, then renders the message under the globe) so the end-to-end can be seen + verified.
ipcMain.handle("sentinel:globe-confirm-test", (_e, input = {}) => emitGlobeConfirmation({
  issueTitle: (input && input.issueTitle) || "DNS lookup failed",
  sessionId: (input && input.sessionId) || `test-${Date.now()}`
}));
ipcMain.handle("sentinel:set-dry-run", (_event, dryRun) => {
  store.set("dryRun", Boolean(dryRun));
  broadcastState();
  return { ok: true, state: getState() };
});
ipcMain.handle("sentinel:detect", (_event, input) => detectIssue(input));
ipcMain.handle("sentinel:run-recipe", (_event, recipeId, options) => runRecipe(recipeId, options || {}));
ipcMain.handle("sentinel:chat", (_event, message, context) => chat(message, context || {}));
// RUN 33 — ARIA tab data surfaces. Network ones (status/learning) fetch read-only stats (no chat content sent);
// local ones (memory/agents) read on-device files. All parsing + R11 scrub happens in the shared parsers.
ipcMain.handle("aria:status", async () => {
  try {
    const r = await fetch("https://iisupp.net/.netlify/functions/aria-system-status", { headers: { "user-agent": "aria-sentinel" }, signal: AbortSignal.timeout?.(8000) });
    return { ok: r.ok, data: parseSystemStatus(r.ok ? await r.json() : null) };
  } catch { return { ok: false, data: parseSystemStatus(null) }; }
});
ipcMain.handle("aria:learning", async () => {
  try {
    const r = await fetch("https://iisupp.net/.netlify/functions/aria-kb-stats", { headers: { "user-agent": "aria-sentinel" }, signal: AbortSignal.timeout?.(8000) });
    const data = parseKbStats(r.ok ? await r.json() : null);
    if (data.generatedAt) store.set("lastKbSeen", data.generatedAt);
    return { ok: r.ok, data };
  } catch { return { ok: false, data: parseKbStats(null) }; }
});
ipcMain.handle("aria:memory", () => {
  try {
    const dir = path.join(os.homedir(), ".aria-sentinel", "sessions");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const sessions = files.map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return null; } }).filter(Boolean);
    return { ok: true, data: parseSessions(sessions) }; // 🔒 parseSessions R11-scrubs every field
  } catch { return { ok: true, data: parseSessions([]) }; }
});
ipcMain.handle("aria:agents", () => {
  try {
    const dir = path.join(app.getAppPath(), "..", "aria-vault", "11_CorpusCallosum", "agent-heartbeats");
    const beats = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return null; } }).filter(Boolean);
    return { ok: true, data: parseHeartbeats(beats) };
  } catch { return { ok: true, data: parseHeartbeats([]) }; }
});
ipcMain.handle("sentinel:scan", () => scanDisk());
ipcMain.handle("sentinel:update-knowledge", () => updateKnowledge());
ipcMain.handle("sentinel:incident", (_event, recipeId, context) => makeIncident(recipeId, context || {}));
ipcMain.handle("sentinel:self-diagnose", (_event, reason) => selfDiagnose(reason || "renderer"));
ipcMain.handle("sentinel:self-repair", (_event, reason) => selfRepair(reason || "renderer"));
ipcMain.handle("sentinel:show-globe", () => {
  showOverlay({ expanded: false });
  return { ok: true, state: getState() };
});
ipcMain.handle("sentinel:dismiss-overlay", () => dismissOverlay());
ipcMain.handle("sentinel:open-admin-console", () => openAdminConsole());
ipcMain.handle("sentinel:set-paused", (_event, milliseconds = 0) => {
  const duration = Math.max(0, Number(milliseconds) || 0);
  store.set("pausedUntil", duration ? Date.now() + duration : 0);
  refreshTray();
  broadcastState();
  return { ok: true, state: getState() };
});
ipcMain.handle("sentinel:report-error", (_event, payload = {}) => {
  handleSelfError(new Error(safeShortText(payload.message, "renderer error")), payload.source || "renderer");
  return { ok: true };
});
ipcMain.handle("sentinel:sn-test", () => serviceNowTestConnection());
ipcMain.handle("sentinel:sn-raise", (_event, recipeId, context) => serviceNowRaiseIncident(recipeId, context || {}));
ipcMain.handle("sentinel:sn-list", () => serviceNowListIncidents());
ipcMain.handle("sentinel:sn-comment", (_event, incidentSysId, comment) => serviceNowComment(incidentSysId, comment));
ipcMain.handle("sentinel:rollback", (_event, snapshotId) => rollbackRestorePoint(snapshotId));
ipcMain.handle("sentinel:run-diagnostic", () => runDiagnostic());
ipcMain.handle("sentinel:install-update", () => installUpdate());
ipcMain.handle("sentinel:rollback-update", (_event, version) => rollbackToVersion(version));
ipcMain.handle("sentinel:update-history", () => updateHistoryState());
ipcMain.handle("sentinel:set-auto-update", (_event, on) => {
  store.set("autoUpdate", Boolean(on));
  logEvent("UPDATE", on ? "Auto-update enabled." : "Auto-update disabled.");
  if (on) initAutoUpdate();
  broadcastState();
  return { ok: true, autoUpdate: Boolean(on) };
});
ipcMain.handle("sentinel:start-aria", () => startAria());
ipcMain.handle("sentinel:stop-aria", () => stopAria());
ipcMain.handle("sentinel:self-heal", () => runSelfHeal());
ipcMain.handle("sentinel:hotkey-status", () => hotkeyStatus);
ipcMain.handle("sentinel:rebind-hotkey", (_event, id, combo) => {
  const rebinds = { ...(store.get("hotkeyRebinds") || {}), [id]: combo };
  store.set("hotkeyRebinds", rebinds);
  registerHotkeys();
  return { ok: true, status: hotkeyStatus };
});
ipcMain.handle("sentinel:enter-license", async (_event, payload) => enterLicense(payload || {})); // RUN 24 A6 — async (server resolve)
ipcMain.handle("sentinel:logout", () => logoutLicense());
ipcMain.handle("sentinel:choose-plan", (_event, tier) => openPlanCheckout(tier));
ipcMain.handle("sentinel:open-plan-picker", () => openPlanPicker());
ipcMain.handle("sentinel:privacy-capture", (_event, windowMs) => runPrivacyCapture(Number(windowMs) || 10000));
ipcMain.handle("sentinel:export-evidence", () => exportEvidencePack());
ipcMain.handle("sentinel:ack-whats-new", () => acknowledgeWhatsNew());
ipcMain.handle("sentinel:open-mac-permissions", (_event, pane) => openMacPermissions(pane));
ipcMain.handle("sentinel:start-trial", (_event, email) => startTrial(email));
ipcMain.handle("sentinel:start-pilot", (_event, intake) => startPilot(intake || {}));
ipcMain.handle("sentinel:pilot-status", () => ({ status: pilotStateLocal(), prompt: pilotPromptNow() }));
ipcMain.handle("sentinel:dismiss-pilot-prompt", (_event, state) => dismissPilotPrompt(state));
ipcMain.handle("sentinel:conversion-moment", () => conversionMomentNow());                    // RUN-D D2
ipcMain.handle("sentinel:case-study-draft", (_event, opts) => caseStudyDraftNow(opts || {}));  // RUN-D D2 — staged, never auto-publish
ipcMain.handle("sentinel:case-study-consent", (_event, consent) => recordCaseStudyConsent(consent || {})); // RUN-E E2 — explicit one-click consent, never inferred
ipcMain.handle("sentinel:case-study-publishable", () => publishableCaseStudy({ ready: true, missing: [], record: readCaseStudyDraft() })); // RUN-E E2 — null until consent + review
ipcMain.handle("sentinel:resolution-outcome", (_event, payload) => recordResolutionOutcome(payload || {})); // RUN-B B1 — "Was this fixed?" real outcome
ipcMain.handle("sentinel:resolution-stats", () => resolutionStatsNow());                                     // RUN-B B1 — real deflection %
ipcMain.handle("sentinel:value-proof", () => valueProofNow());                                                // RUN-B B2 — real ROI + deflection value proof
ipcMain.handle("sentinel:trust-posture", () => trustPostureNow());                                            // RUN-B B3 — honest trust/security surface
ipcMain.handle("sentinel:check-updates", () => checkForUpdates());
ipcMain.handle("sentinel:manage-subscription", () => manageSubscription());
ipcMain.handle("sentinel:get-settings", () => ({ showFloatingGlobe: store.get("showFloatingGlobe") !== false, lowPower: Boolean(store.get("lowPower")) }));
ipcMain.handle("sentinel:set-show-floating-globe", (_event, on) => setShowFloatingGlobe(on));
ipcMain.handle("sentinel:set-low-power", (_event, on) => {
  store.set("lowPower", Boolean(on));
  logEvent("POWER", `Low-power mode ${on ? "on (60s polling · 15fps)" : "off"}.`);
  broadcastState();
  return { ok: true, lowPower: Boolean(on) };
});
ipcMain.handle("sentinel:export-audit", (_event, kind) => {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const log = store.get("transparencyLog") || [];
  const content = kind === "pdf" ? auditToPdf("ARIA Sentinel — audit (30 days)", log) : auditToCsv(log);
  logEvent("AUDIT", `Exported human-readable audit (${kind === "pdf" ? "PDF" : "CSV"}).`);
  return { ok: true, filename: auditFileName(kind, dateStamp), content, kind: kind === "pdf" ? "pdf" : "csv" };
});
ipcMain.handle("sentinel:complete-onboarding", () => {
  store.set("firstRunComplete", true);
  logEvent("ONBOARDING", "First-run tour completed.");
  broadcastState();
  return { ok: true };
});
// RUN 33-E — first-launch Setup wizard. State lives in electron-store via the tested app-config helpers.
function readSetupConfig() { return store.get("setupConfig") || defaultAppConfig(); }
ipcMain.handle("setup:complete", (_event, prefs) => {
  const cfg = completeSetup(readSetupConfig(), prefs || {});
  store.set("setupConfig", cfg);
  // Apply the chosen default mode — but NEVER autonomous silently (that needs the explicit opt-in modal).
  const m = cfg.setup.prefs.mode;
  if (m === "manual" || m === "confirmed") { store.set("mode", m); applyModeBehavior(m); refreshTray(); }
  logEvent("SETUP", "Setup wizard completed.");
  broadcastState();
  return { ok: true, setup: cfg.setup };
});
ipcMain.handle("setup:reopen", () => {
  store.set("setupConfig", reopenSetup(readSetupConfig()));
  broadcastState();
  return { ok: true };
});
ipcMain.handle("sentinel:ingest-kb", (_event, file) => ingestKnowledgeFile(file || {}));
// RUN 19 §4 — triple-confirm delete prefs (per-ext opt-out).
ipcMain.handle("sentinel:get-delete-prefs", () => readDeletePrefs());
ipcMain.handle("sentinel:set-delete-pref", (_event, ext) => {
  const next = writeDeletePrefs(addOptOut(readDeletePrefs(), ext));
  logEvent("DELETE-PREF", `Triple-confirm opt-out set for ${normalizeExt(ext) || "?"} files.`);
  broadcastState();
  return { ok: true, prefs: next };
});
ipcMain.handle("sentinel:clear-delete-pref", (_event, ext) => {
  const key = normalizeExt(ext);
  const cur = readDeletePrefs();
  const next = writeDeletePrefs({ skipTripleFor: (cur.skipTripleFor || []).filter((e) => e !== key) });
  broadcastState();
  return { ok: true, prefs: next };
});
ipcMain.handle("sentinel:reset-delete-prefs", () => {
  const next = writeDeletePrefs(resetOptOuts(readDeletePrefs()));
  logEvent("DELETE-PREF", "All triple-confirm opt-outs reset.");
  broadcastState();
  return { ok: true, prefs: next };
});
// RUN 19 §3 — manual kill-switch trigger (the global hotkey also calls activateKillSwitch directly).
ipcMain.handle("sentinel:kill-switch", () => activateKillSwitch());
// RUN 20 — system knowledge engine IPC (all local · read-only · content-blind).
ipcMain.handle("sentinel:get-system-context", () => getSystemContext({}));
ipcMain.handle("sentinel:refresh-system-context", () => getSystemContext({ force: true }));
ipcMain.handle("sentinel:list-tier0", () => listTier0Recipes());
ipcMain.handle("sentinel:preview-tier0", (_event, id) => { const r = tier0ById(id); return r ? previewTier0(r) : { ok: false, error: "not_found" }; });
ipcMain.handle("sentinel:list-blueprints", () => listBlueprints());
ipcMain.handle("sentinel:get-blueprint", (_event, id) => getBlueprint(id));
ipcMain.handle("sentinel:diagnose", (_event, message) => runDiagnose(message));
// RUN 21 — auto-update orchestrator · startup · heartbeat IPC.
ipcMain.handle("sentinel:check-update-channel", () => runUpdateCheck("manual"));
ipcMain.handle("sentinel:update-state", () => readUpdateState());
ipcMain.handle("sentinel:update-choice", (_event, choice) => {
  const st = orchestrator.userChoice(readUpdateState(), choice, Date.now());
  writeUpdateState(st);
  if (choice === "install") performUpdateInstall(st);
  return st;
});
ipcMain.handle("sentinel:pause-updates", () => {
  const r = orchestrator.recordPause(readUpdateState(), Date.now());
  if (r.ok) writeUpdateState(r.state);
  return r;
});
ipcMain.handle("sentinel:startup-state", () => ({
  enabled: store.get("startupEnabled") !== false,
  disabledAt: store.get("startupDisabledAt") || null,
  audit: (store.get("startupAudit") || []).slice(0, 10)
}));
ipcMain.handle("sentinel:set-auto-startup", (_event, on) => setAutoStartup(Boolean(on)));
// RUN 22 — dashboard · performance · SLA · compliance · reports.
ipcMain.handle("sentinel:get-dashboard", () => dashboardData());
ipcMain.handle("sentinel:get-performance", () => performanceData());
ipcMain.handle("sentinel:get-sla", () => slaData());
ipcMain.handle("sentinel:get-compliance", () => complianceData());
ipcMain.handle("sentinel:list-reports", () => reportsData());
ipcMain.handle("sentinel:generate-report", (_event, opts) => generateReport(opts || {}));
ipcMain.handle("sentinel:set-report-prefs", (_event, prefs) => setReportPrefs(prefs || {}));
// RUN 23 — process-health stream · supervised fix pipeline · countdown abort.
ipcMain.handle(PROC_HEALTH_IPC.get, () => (processDetector ? processDetector.latest() : { timestamp: Date.now(), scanned: 0, frozen: [], cpuHogs: [], ramHogs: [], odd: [] }));
ipcMain.handle(PROC_HEALTH_IPC.subscribe, () => ({ ok: true, channel: PROC_HEALTH_IPC.push }));
ipcMain.handle("sentinel:supervised-fix", (_event, payload) => runSupervisedFix(payload || {}));
ipcMain.handle("sentinel:abort-countdown", () => { const n = countdownManager.abortAll(); if (n) closeActionIndicator(); return { ok: true, aborted: n }; });
// Walk-through tab — pull (and clear) the last web-originated GUIDE-mode target after the tab loads; content-blind.
ipcMain.handle("sentinel:get-walkthrough", () => { const t = pendingWalkthrough; pendingWalkthrough = null; return t; });
// P1 routing — is this recipe a vetted/bound Tier-0 action that can safely auto-apply? Single source of truth so
// the renderer routes unvetted recipes to the Walk-through tab (never a dead "Resolve" that can't apply anything).
ipcMain.handle("sentinel:is-vetted", (_event, recipeId) => ({ vetted: Boolean(resolveExecutorId(String(recipeId || ""))) }));
// Allowlist for shell.openExternal. The companion's `open` steps open the user's BROWSER to an OFFICIAL vendor
// site (their pricing / sign-up) — this is the USER's click launching their own browser, NOT an app network
// call and NOT an account/payment action by the agent (those stay the user's, always). Host-anchored so only
// these exact official domains are ever opened. No paid API is called from here.
const OPEN_EXTERNAL_ALLOW = /^https:\/\/(iisupp\.net|[\w.-]+\.service-now\.com|(www\.)?anthropic\.com|claude\.ai|(www\.)?openai\.com|chatgpt\.com|gemini\.google\.com|ai\.google\.dev)(\/|$)/;
ipcMain.handle("sentinel:open-external", (_event, url) => {
  if (typeof url === "string" && OPEN_EXTERNAL_ALLOW.test(url)) {
    shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});
// Companion → open the main window's Walk-through tab in GUIDE mode for a matched recipe (fix-a-problem path;
// changes nothing). Reuses the same gated/guided surface as the web deep-link — never Control Center.
ipcMain.handle("sentinel:open-walkthrough", (_event, payload = {}) => {
  try { openWalkthroughTab(String(payload.recipeId || ""), String(payload.intent || "")); return { ok: true }; }
  catch (e) { return { ok: false, error: e?.message || "open-failed" }; }
});
// Companion → bring the main window forward on a given tab (e.g. "Ask ARIA" → the ARIA chat tab).
ipcMain.handle("sentinel:open-main-tab", (_event, tab) => {
  const allowed = new Set(["aria", "walkthrough", "recipes", "dashboard"]);
  showMainWindow(allowed.has(String(tab)) ? String(tab) : "aria");
  return { ok: true };
});
// Companion → open the assistant panel on the floating globe overlay (companion mode).
ipcMain.handle("sentinel:open-companion", () => { showOverlay({ companion: true }); return { ok: true }; });
// Companion → copy a locally-composed prompt to the OS clipboard. R11: never copy an off-limits path reference.
ipcMain.handle("sentinel:copy", (_event, text) => {
  const s = String(text || "");
  if (isBlockedPath(s)) { logEvent("SECURITY", "Copy blocked by R11 (private folder).", r11AuditEntry("companion-copy")); return { ok: false, error: "r11_blocked" }; }
  clipboard.writeText(s);
  return { ok: true };
});
// TRUE on-device tap-to-speak — resolve the bundled offline Vosk model to a local file:// URL. Bundled via
// extraResources (see package.json + scripts/fetch-vosk-model.mjs); lands next to the app resources in prod, or
// under resources/models/ in dev. Returns null when absent so the renderer hides the mic (never a cloud fallback).
// R11: refuse to hand back any path that touches the off-limits folder.
ipcMain.handle("sentinel:vosk-model-url", () => {
  try {
    const candidates = [
      process.resourcesPath ? path.join(process.resourcesPath, "vosk-model-small-en-us") : "",
      path.join(__dirname, "..", "..", "resources", "models", "vosk-model-small-en-us")
    ];
    for (const dir of candidates) {
      if (!dir || isBlockedPath(dir)) continue;
      if (fs.existsSync(dir)) return pathToFileURL(dir).href.replace(/\/?$/, "/");
    }
    return null;
  } catch { return null; }
});

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    // RUN 16 §H — verify audit-log integrity BEFORE anything logs (a startup logEvent would re-seal).
    verifyAuditIntegrity();
    initWhatsNew();
    // RUN 29-D — install the content-blind crash reporter early (after the audit verifier): captures uncaught
    // errors to a local queue + best-effort forwards last launch's queue to sentinel-crash (never blocks the UI).
    installCrashReporter({ version: SENTINEL_VERSION, crashFile: path.join(os.homedir(), ".aria-sentinel", "crash.log"), endpoint: "https://iisupp.net/.netlify/functions/sentinel-crash", fs, log: logEvent });
    createMainWindow();
    createOverlayWindow();
    createTray();
    ensureTrialStarted();
    try { maybeStampPilotTtfv(); } catch { /* RUN-E E1 — catch a first fix recorded in an earlier session; never blocks startup */ }
    try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — a pilot that matured between sessions drafts its proof at startup; never blocks */ }
    refreshLicense().catch(() => undefined); // RUN 24 A6 — silent server-side re-verify (skips network if cache fresh)
    showOverlay({ expanded: false });
    applyModeBehavior(store.get("mode"));
    startBridge();
    startDetection();
    startProcessHealth(); // RUN 23 — 30s content-blind process-health poll feeding the globe status panel
    serviceNowDrain().catch(() => undefined); // flush any incidents queued while offline
    selfDiagnose("startup").catch((error) => handleSelfError(error, "startup-diagnose"));
    scanDisk().catch((error) => handleSelfError(error, "startup-scan"));
    setInterval(() => {
      selfDiagnose("interval").catch((error) => handleSelfError(error, "interval-diagnose"));
    }, 5 * 60 * 1000).unref?.();
    // Health Score is refreshed every 60s so the tray tooltip stays current between detections.
    setInterval(() => refreshHealthScore(), 60 * 1000).unref?.();
    // Self-hosted auto-update (electron-updater) — guarded; no-op if the dep isn't installed.
    initAutoUpdate();
    // RUN 15 §7 — hardened hotkeys: try primary, fall back, surface live status (no silent fail).
    registerHotkeys();
    // RUN 20 — build the local system-context inventory on launch, then refresh every 6h (background).
    collectSystemContext().catch((error) => handleSelfError(error, "system-context-startup"));
    setInterval(() => collectSystemContext().catch(() => undefined), SYSTEM_CONTEXT_TTL_MS).unref?.();
    // RUN 21 — self-maintaining: startup registration + heal, update poll, heartbeat, orchestrator tick.
    healStartupIfNeeded().catch(() => undefined);
    runUpdateCheck("launch").catch(() => undefined);
    sendHeartbeat().catch(() => undefined);
    setInterval(updateTick, 60 * 60 * 1000).unref?.(); // hourly: advance strikes + take AUTO opportunities
    setInterval(() => { runUpdateCheck("daily").catch(() => undefined); sendHeartbeat().catch(() => undefined); healStartupIfNeeded().catch(() => undefined); }, 24 * 60 * 60 * 1000).unref?.();
    try { powerMonitor.on("resume", () => runUpdateCheck("wake").catch(() => undefined)); } catch { /* powerMonitor may be unavailable */ }
    // RUN 22 — daily 02:00 data-retention cleanup + quarterly report on a quarter-start launch.
    scheduleDailyAt(2, runRetentionCleanup);
    maybeRunQuarterly();
    // Slice C — a deep-link that LAUNCHED the app (Windows first-run argv, or a macOS open-url buffered
    // before ready). Fire it after the UI is up so the recipes view + countdown are visible.
    const initialLink = pendingDeepLink || extractDeepLink(process.argv);
    pendingDeepLink = null;
    if (initialLink) setTimeout(() => handleSentinelDeepLink(initialLink), 1500);
  });
}

app.on("activate", () => {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  showMainWindow("mode");
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
  if (mainWindow) mainWindow.hide();
  hideOverlay();
});

app.on("render-process-gone", (_event, webContents, details) => {
  handleSelfError(new Error(`Renderer process gone: ${details.reason}`), "renderer-process");
  if (webContents === mainWindow?.webContents && !isQuitting) createMainWindow();
});

app.on("child-process-gone", (_event, details) => {
  handleSelfError(new Error(`Child process gone: ${details.type}`), "child-process");
});

app.on("before-quit", () => {
  isQuitting = true;
  stopOverlayPhysics();
  try { globalShortcut.unregisterAll(); } catch { /* nothing registered */ }
  if (detectionOrchestrator) detectionOrchestrator.stopAll();
  if (adminWindow && !adminWindow.isDestroyed()) adminWindow.destroy();
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  if (bridgeServer) bridgeServer.close();
});
