import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, screen, session, globalShortcut, powerMonitor, clipboard, Notification } from "electron";
import Store from "electron-store";
import { spawn } from "node:child_process";
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
  isEndpointDeployed,
  ENDPOINT_NOT_AVAILABLE_NOTE,
  RECIPES,
  RECIPE_ENDPOINT,
  ROUTING_TARGETS,
  STOP_CODES,
  STOP_CODES_ENDPOINT,
  SENTINEL_VERSION as REGISTRY_VERSION,
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
import { configurePowerShellRunner } from "../sub-agents/detection/ps.mjs"; // PROD 2026-10-14 (audit M27) — one tracked runner
import { loadCustomerConfig } from "../shared/customer-config.mjs";
import { DEEP_LINK_SCHEME, parseSentinelDeepLink, validateResolveLink } from "../shared/deep-link.mjs"; // Slice C — web→Sentinel handoff
import { ingest as ingestKb } from "../shared/kb-ingester.mjs";
import { parsePolicyOverlay, isRecipeAllowedByPolicy, loadPolicyFile, POLICY_FILE_NAME } from "../shared/policy.mjs";
import { parseControlPlaneKill, remediationDecision, blockedRecipeResult, KILL_HOTKEY, buildKillResult } from "../shared/kill-switch.mjs";
// RUN-CU / CU4 (2026-10-08) — autonomy levels · approvals · notify · real restore points · evidence · bridge auth.
import { normalizeSetupPrefs, updateSetupPrefs, resolveAutonomy, autonomyLevelToMode, AUTONOMY_LEVELS } from "../shared/app-config.mjs";
import { decideExecution, describeDecision } from "../shared/approval-policy.mjs";
// ADVISORY ESCALATION (2026-10-14) — "advise three times, then act" (Autonomous mode only). The pure clock + promises;
// the effects (notices, the supervised run, the IT-contact escalation) are performed below through the existing paths.
import { createAdvisoryEscalation, normalizeAdvisoryPrefs, advisoryView, ruleSentence, ADVISORY_CHOICES, ADVISORY_INTERVAL_MIN, ADVISORY_INTERVAL_MAX, ADVISORY_SNOOZE_MIN_H, ADVISORY_SNOOZE_MAX_H } from "../shared/advisory-escalation.mjs";
import { COOLDOWN_MS as AUTOFIRE_COOLDOWN_MS } from "../shared/autonomous.mjs";
import { redactPrivate as advisoryRedact } from "../shared/path-guard.mjs";
import { checkMaintenanceWindow } from "./plan-maintenance-window.mjs";
import { createApprovalsFlow } from "./approvals.mjs";
import { createNotifyDispatcher, NOTIFY_ENDPOINT } from "./notify-dispatch.mjs";
import { createOutbound } from "./outbound.mjs";
import { platformCapabilities } from "../shared/notify-channels.mjs";
import { RESTORE_COMMANDS, sequenceOf, verifyCreated, isThrottled } from "./restore-point.mjs";
import { deriveControlOverrides, summarizeEvidence } from "../shared/compliance-evidence.mjs";
import { isAllowedBridgeOrigin as bridgeOriginAllowed, isStateChangingRoute, sanitizeRunRecipeBody, scrubPublicState } from "../shared/bridge-auth.mjs";
import { sealAuditKeyed, verifyAuditKeyed } from "../shared/audit-integrity.mjs";
import { tier0ForPlatform, isDarwinTier0, TIER0_DARWIN_RECIPES } from "./recipes/tier-0/index.mjs";
import { isYellowRecipe } from "../shared/recipe-runner.mjs";
import { buildVoiceFixAnnouncement, deriveSpeak } from "../shared/voice-turns.mjs";
import { registerWithFallback } from "../shared/hotkeys.mjs";
import { normalizePrefs, addOptOut, resetOptOuts, normalizeExt } from "../shared/delete-confirm.mjs";
// RUN 20 — system knowledge engine: inventory enumerator, Tier-0 recipes, symptom KB + doctor reasoner.
import { enumerate as enumerateSystem, buildSystemContext } from "./system-context.mjs";
import { TIER0_RECIPES, preview as previewTier0, tier0ById } from "./recipes/tier-0/index.mjs";
import { loadSymptomKb } from "../shared/symptom-kb.mjs";
import { diagnose as diagnoseSymptom } from "../shared/diagnostic-reasoner.mjs";
import { executorForSymptom } from "../shared/symptom-executor.mjs"; // F1 — matched symptom → vetted Tier-0 executor
import { resolveIntegrations, testIntegration as runIntegrationTest } from "../shared/integrations.mjs"; // Integrations tab (read-only status)
// RUN 21 — auto-update orchestrator · startup hook · heartbeat. (R11 private-folder guard applied.)
import { checkForUpdate } from "./update-listener.mjs";
import * as orchestrator from "./update-orchestrator.mjs";
import { sealState, openState, defaultUpdateState } from "../shared/update-state.mjs";
import { RUN_KEY, RUN_VALUE_NAME, TASK_NAME, registryRunEntry, taskDefinition, startupHealDecision, shouldShowWindowAtLaunch, shouldShowWindowOnSecondInstance, isStartupLaunch } from "./startup-registrar.mjs";
import { classifyRemoval, buildTamperAudit, disabledBanner } from "./startup-watchdog.mjs";
import { buildHeartbeatPayload } from "./heartbeat.mjs";
import { isBlockedPath, r11AuditEntry, configureExcludedFolders, excludedFolderCount, excludedFoldersLabel, configuredExcludedFolders } from "../shared/path-guard.mjs";
// JULY PORT 2026-10-14 (ddfcac5b) — the READ-ONLY .txt file-association guard (reg query only; never a write).
import {
  FILE_ASSOCIATION_GUARD_INTERVAL_MS,
  TEXT_ASSOCIATION_PRIMARY_RECIPE_ID,
  TEXT_ASSOCIATION_RISK_RECIPE_ID,
  buildAssociationGuardStatus,
  classifyTextAssociation,
  parseRegQueryValues
} from "../shared/file-association-guard.mjs";
// JULY PORT 2026-10-14 (af5e03ab) — the Office File Safety Net (local 2 min backups + 3 min renamed-copy validation).
import { createOfficeSafetyService } from "./office-safety-service.mjs";
// JULY PORT 2026-10-14 (a7f9e111) — the content-blind browser-outcome ledger (bridge) + the chat-activity scrub/cap.
import { appendBrowserOutcome, browserOutcomeToResolutionPayload, buildBrowserOutcomeFleetPacket } from "../shared/browser-outcome.mjs";
import { scrubChatText, capSessionTurns } from "../shared/chat-activity.mjs";
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
import { trayPngDataUrl } from "./tray-art-png.mjs"; // PROD 2026-10-14 (audit M2) — generated by scripts/render-tray-png.mjs
import { EXPECTED_OUTBOUND_PATHS, classifyRequest, summarizeCapture } from "../shared/network-capture.mjs";
import { zipEvidencePack, evidenceFileName, EVIDENCE_ARTIFACTS } from "../shared/evidence-pack.mjs";
import { shouldShowWhatsNew } from "../shared/whats-new.mjs";
import { canEnableAutonomous, evaluateAutoFire, recordAutoFire, autonomousPauseUntil } from "../shared/autonomous.mjs";
import { isGreenRecipe } from "../shared/recipe-runner.mjs";
import { buildNotifyPayload, isAllowedWebhook, redactWebhookForLog } from "../shared/notify.mjs";
import { toCsv as auditToCsv, toPdf as auditToPdf, auditFileName } from "../shared/audit-export.mjs";
import { globeFrameMs } from "../shared/power-mode.mjs";
import { issueLicense, verifyLicense, daysRemaining } from "../shared/license.mjs";
import { updateAvailable, buildFeedUrl, buildFeedRequest, recordInstall, rollbackTargets } from "../shared/auto-update.mjs";
import { buildRemoteSession, sessionActive } from "../shared/remote-control.mjs";
import { modeOverlayBehavior } from "../shared/mode-behavior.mjs";
// RUN 24 A6 — resolvePlanFromKey/verifyLicenseStatus are SERVER-SIDE ONLY now (they need the secret); the
// desktop resolves via the sentinel-resolve endpoint + a local cache (license-cache.mjs hashes the key itself).
import { enabledFeatures as planEnabledFeatures, licenseIsAdmin } from "../shared/license-features.mjs";
// REVIEW P1-3 — a cached verdict counts only when signed for this device + key (or, unsigned, in the run that got it, ≤1 h).
import { buildCache, cacheIsFresh, cacheMatchesKey, effectiveFromCache, unsignedFingerprint, highWaterOf, VERDICT_STATUSES, CLOCK_SKEW_MS as LICENSE_CLOCK_SKEW_MS, FREE_PLAN as CACHE_FREE_PLAN } from "./license-cache.mjs";
import { installCrashReporter } from "./crash-reporter.mjs"; // RUN 29-D — $0 content-blind crash reporter
import { bindAll, withRebinds, DEFAULT_HOTKEYS, selectDefaultHotkeys } from "../shared/hotkeys.mjs";
import { applyRunState } from "../shared/start-stop.mjs";
import { auditFeatures, summarizeAudit, buildHealReport } from "../shared/self-heal.mjs";
import { askAria, scrubR11 } from "../shared/aria-brain-client.mjs";
import { loadKbPack, localKbAnswer } from "../shared/aria-local-kb.mjs"; // RUN 30-B — offline cross-platform KB
import { topicsAnswer } from "../shared/aria-topics-fallback.mjs"; // P3 (2026-07-14) — offline tier-3 guided TOPICS brain (v2.1)
import { shapeKbAnswerForEndUser } from "../shared/kb-answer-shape.mjs"; // P0 (2026-07-14) — strip internal/keyword sections from end-user chat
import { loadFullText, fullArticle, looksTruncated, repairTruncatedTail } from "../shared/kb-fulltext.mjs"; // F2 — full bundled article text so a mid-line-truncated live excerpt never renders as a dangling "Print server (`"
import { parseSystemStatus, parseKbStats, parseSessions, parseHeartbeats } from "../shared/aria-surfaces.mjs"; // RUN 33 — ARIA tab data
import { classifyAnswer, recordAsk, foldStats, kbHitRate as chatKbHitRate } from "../shared/chat-stats.mjs"; // D2 — record real Ask-ARIA usage
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
import { executionPolicy, recordOutcome, vettedCountOf, emptyHistory, vettedTier, VENDOR_FLOOR_TRACK } from "./dry-run-policy.mjs";
import { createCountdown, createCountdownManager, shouldCountdown, countdownChatLine, countdownBannerText, COUNTDOWN_SECONDS } from "./action-countdown.mjs";
// FAULT LAB 2026-10-14 — the vendor floor (defect 4) and the not_resolved outcome of a failed gating verify (defect 3).
import { EXECUTABLE_RECIPES, YELLOW_RECIPES, isVendorVetted, NOT_RESOLVED } from "../shared/recipe-runner.mjs";
// RUN 23b — Tier-0 executor: maps Tier-0 recipe ids to real, reversible PowerShell with pre/post/rollback.
import { executeTier0, resolveExecutorId, TIER0_EXECUTOR_IDS, TIER0_COMMANDS, validateTier0Command } from "./tier-0-executor.mjs";
import { actionNeedsAdmin, buildElevatedExecution, UAC_CANCELLED_EXIT } from "../shared/recipe-runner.mjs"; // PROD 2026-10-14 (audit M3) — admin-aware steps
// RUN 23c — OTA: the local bridge serves the built dist .exe metadata so the admin console can 1-click publish.
import { assetName as otaAssetName, signedAssetName as otaSignedAssetName, githubAssetUrlFor as otaAssetUrlFor, isSignedArtifactName } from "../shared/ota-release.mjs";

// RUN 23e — single build: the license PLAN (not a build-time flag) decides admin access + feature gates.
// Reads gateStatus() (license + trial) each call, so a fresh paste / trial expiry re-gates live. An active
// trial resolves to Pro features; an expired/absent trial falls back to free Personal (never admin).
function currentPlanFeatures() { return planEnabledFeatures(gateStatus()); }
function currentIsAdmin() { return licenseIsAdmin(gateStatus()); }
// PROD 2026-10-14 (audit M32) — developer affordances (simulate detection, globe-confirm test, agent heartbeats from the
// vault) exist ONLY in a dev run; the packaged customer build never shows or serves them.
function devModeNow() { try { return !app.isPackaged || Boolean(process.env.ARIA_SENTINEL_DEV); } catch { return false; } }
let hotkeyStatus = [];
let crashReporter = null; // PROD 2026-10-14 (audit M17) — { capture, flush }; flush runs only after Setup consent
import { trialStatusFor, resolveTrialStart, isUnlocked as licenseUnlocked, trialBadge, TRIAL_DAYS } from "../shared/license.mjs";
import { pilotStatus, pilotBadge, pilotUpgradePrompt, buildPilotRecord, stampTtfv, firstFixAtFromAudit, ttfvMinutes, ttfvLabel } from "../shared/pilot-state.mjs"; // RUN-E E1 — TTFV clock
import { conversionMoment, buildCaseStudy, caseStudyReadiness, autorunCaseStudy, withConsent, publishableCaseStudy } from "../shared/case-study.mjs"; // RUN-D D2 pilot->paid capture + RUN-E E2 proof autorun (consent-gated)
import { deflectionStats, recordOutcome as recordResolutionEvent, pilotProofMetrics, countLiveFixes } from "../shared/resolution-outcome.mjs"; // RUN-B B1 — real deflection %; R6a — live fixes only
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
// PROD 2026-10-14 (audit M4) — the version every surface reports (About, /health, heartbeat, user-agent, update
// checks, evidence pack, What's new) is the one Electron reads from package.json in dev AND in the packaged app.
// The registry's own derived constant is the fallback, never a hand-typed literal.
const SENTINEL_VERSION = (() => { try { const v = app.getVersion(); return /^\d+\.\d+/.test(String(v || "")) ? String(v) : REGISTRY_VERSION; } catch { return REGISTRY_VERSION; } })();
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
    browserOutcomes: [], // JULY PORT 2026-10-14 — content-blind outcomes the companion extension reports (never URLs/titles)
    // RUN-CU / CU4 — approvals ledger (pending + decided) + fixes queued to a maintenance window.
    // (keepSystemFixesDryRun is deliberately NOT defaulted: undefined = "follow the mode", the RUN 29-A rule.)
    approvals: [],
    deferredFixes: [],
    // JULY PORT 2026-10-14 (ddfcac5b) — the last file-association guard status + the last surfaced issue key (dedupe).
    fileAssociationGuard: null,
    fileAssociationLastIssueKey: "",
    // JULY PORT 2026-10-14 (af5e03ab) — Office Safety Net consent. OFF until the person turns it on (Integrations →
    // Office Safety Net): the production line never scans or copies a person's documents unasked.
    officeSafety: { enabled: false },
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

// PROD 2026-10-14 (audit M1) — live fixes are a PERSISTED, CONSENT-GATED setting, not an env var nobody ships.
// `liveFixesEnabled` (electron-store, default false) is written only by the Settings toggle / wizard step through
// sentinel:set-live-fixes (audit-logged). The env override stays for developers: ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1
// forces ON, =0 forces OFF, unset → the stored consent decides. Every gate that used to read the const reads this.
function allowSystemFixes() {
  const env = process.env.ARIA_SENTINEL_ALLOW_SYSTEM_FIXES;
  if (env === "1") return true;
  if (env === "0") return false;
  try { return store.get("liveFixesEnabled") === true; } catch { return false; }
}
/** { enabled, source:'store'|'env', elevation:'uac'|'none', note } — the honest live-fix status the UI shows. */
function liveFixesStatus() {
  const env = process.env.ARIA_SENTINEL_ALLOW_SYSTEM_FIXES;
  const source = env === "1" || env === "0" ? "env" : "store";
  const enabled = allowSystemFixes();
  const elevation = process.platform === "win32" ? "uac" : "none";
  let note;
  if (!enabled) note = source === "env" ? "Live fixes are forced off by ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=0 on this device." : "Live fixes are off — every fix previews only. Turn them on to let ARIA apply vetted fixes you confirm.";
  else if (elevation === "uac") note = "Live fixes are on. Fixes that need administrator rights ask for your approval (UAC) each time; nothing runs unattended as administrator.";
  else note = "Live fixes are on. Fixes that need administrator rights are not available on this platform; they stay in preview.";
  return { enabled, source, elevation, note };
}
/** The legacy RUN 13 global dry-run safety, folded with the consent gate: true = every fix previews only. */
function globalDryRun() { return !allowSystemFixes() || Boolean(store.get("dryRun")); }
function setLiveFixes(payload) {
  const enabled = typeof payload === "boolean" ? payload : Boolean(payload && payload.enabled);
  const before = allowSystemFixes();
  store.set("liveFixesEnabled", enabled);
  // The pre-consent global flag (store.dryRun, default true since RUN 13) would otherwise keep every fix in
  // preview after the person said yes. Turning live fixes on/off is the explicit, audited answer to that flag.
  store.set("dryRun", !enabled);
  const status = liveFixesStatus();
  logEvent("POLICY", `Live fixes ${enabled ? "ENABLED" : "DISABLED"} by the person at this device${status.source === "env" ? " (env override still decides: " + (status.enabled ? "on" : "off") + ")" : ""}.`, { liveFixes: enabled, source: status.source });
  if (before !== status.enabled) broadcastState();
  return status;
}
Menu.setApplicationMenu(null); // No File/Edit/View bar — Sentinel is a focused app, not a generic Electron shell
let mainWindow;
let overlayWindow;
let adminWindow;
let overlayInteractUntil = 0;
// (F3 round 2) the overlay renderer's hover-forward pattern: true while the pointer is over the globe art, which
// pins the window interactive; false lets the transparent parts of the window pass clicks through (forward:true
// keeps mousemove flowing so the renderer can detect re-entry).
let overlayHoverOverride = false;
function setOverlayHover(over) {
  if (!overlayWindow || overlayWindow.isDestroyed() || overlayExpanded) return { ok: false };
  overlayHoverOverride = true;
  try {
    if (over) overlayWindow.setIgnoreMouseEvents(false);
    else overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } catch { /* window state is best-effort */ }
  return { ok: true, over: Boolean(over) };
}
let tray;
let bridgeServer;
let bridgeStatus = { listening: false, conflict: false, port: BRIDGE_PORT, owner: null, lastError: "", killed: false, killReason: "" };
let isQuitting = false;
let overlayExpanded = false;
let overlayCompanion = false; // the interactive assistant panel is open on the globe overlay
// 2026-10-14 — an advise-first notice (Notice n of 3 + three choices) is taller than a detector card: while one is up the
// expanded window grows so the card never hides its choices behind a scrollbar. Cleared on dismiss / hide / companion.
let overlayAdvisory = false;
// RUN 19 §3 — every ARIA-spawned child process is tracked so the kill-switch can terminate them all.
const childProcesses = new Set();
// (audit M27) the watcher / process-scan PowerShell children join the same set, so Ctrl+Alt+K ends them too.
configurePowerShellRunner({ track: (child) => { childProcesses.add(child); return () => childProcesses.delete(child); } });
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
let fileAssociationGuardTimer = null; // JULY PORT 2026-10-14 — the 60 s read-only association re-check
let officeSafetyService = null; // JULY PORT 2026-10-14 — the Office File Safety Net (opt-in)
let officeSafetyRootsWarned = false;

// ── RUN-CU / CU4 (2026-10-08) — autonomy · approvals · notify plumbing ─────────────────────────────────────
// Every main-process network call goes through ONE wrapper that records {host, path, method, bytes} into a
// ring the privacy verifier merges (audit P1 #7) and refuses an off-allowlist host before a byte leaves.
const outbound = createOutbound({});
const APPROVAL_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-sentinel-approval";

function readSetupConfigSafe() { try { return store.get("setupConfig") || null; } catch { return null; } }
// PROD 2026-10-14 (audit M17) — NOTHING leaves the device on its own until the person finished Setup (the wizard is
// where the channels and what is sent are explained). Heartbeat, automatic update checks, crash-queue flush and the
// knowledge pull all wait for this; a person's explicit click (Check updates / Update knowledge / Enter license)
// is its own consent and is never blocked here.
function telemetryAllowed() { try { return !shouldShowSetup(store.get("setupConfig")); } catch { return false; } }
/** The sanitized Setup-wizard prefs (v1 + v2), defaults filled in. */
function setupPrefsNow() { return normalizeSetupPrefs(readSetupConfigSafe()); }
/** The autonomy level Sentinel honours right now (business clamp applied) + its mapped mode. */
function autonomyNow() {
  const prefs = setupPrefsNow();
  const r = resolveAutonomy(prefs);
  return { ...r, approverMode: (prefs.approver && prefs.approver.mode) || "self", mode: autonomyLevelToMode(r.level).mode, prefs };
}
/** sha256(licenseKey) — the device's content-blind identity for the notify/approval server; never the raw key. */
function licenseKeyHash() {
  const key = String((readLicense() || {}).key || "");
  return /^[a-f0-9]{64}$/i.test(key) ? createHash("sha256").update(key).digest("hex") : "";
}
/** A stable per-device hash (never the raw hostname) for X-Sentinel-Device + the notify "device" field. */
function deviceIdHash() {
  try { return createHash("sha256").update(`${os.hostname()}::aria-sentinel-device`).digest("hex").slice(0, 32); } catch { return "device"; }
}
/** Honest, content-blind label for notifications: "Sam's Windows device" when the wizard captured a name. */
function deviceLabelNow() {
  const prefs = setupPrefsNow();
  const first = String((prefs.deviceUser && prefs.deviceUser.name) || "").trim().split(/\s+/)[0].replace(/[^A-Za-z0-9'\-]/g, "").slice(0, 24);
  const label = platformCapabilities(process.platform).label;
  return first ? `${first}'s ${label} device` : `this ${label} device`;
}
/** Desktop (OS) notification — local, free, honest. Returns true only when one was actually shown. */
function desktopNotify({ title, body } = {}) {
  try {
    if (!app.isReady() || !Notification.isSupported()) return false;
    const n = new Notification({ title: String(title || "ARIA Sentinel").slice(0, 80), body: String(body || "").slice(0, 200), silent: false });
    n.on("click", () => { try { showMainWindow("control-center"); } catch { /* best-effort */ } });
    n.show();
    return true;
  } catch { return false; }
}
const notifyDispatcher = createNotifyDispatcher({
  outbound,
  endpoint: NOTIFY_ENDPOINT,
  logEvent: (tag, text, extra) => logEvent(tag, text, extra),
  prefs: setupPrefsNow,
  desktopNotify,
  deviceKeyHash: licenseKeyHash,
  deviceId: deviceIdHash
});
/** Fire-and-forget notify; never throws into a caller. */
function notifyEvent(event, ctx = {}, opts = {}) {
  return notifyDispatcher.dispatch(event, { ...ctx, platform: process.platform, deviceLabel: deviceLabelNow() }, opts).catch(() => null);
}
const approvals = createApprovalsFlow({
  store: { get: () => store.get("approvals") || [], set: (v) => store.set("approvals", v) },
  log: (tag, text, extra) => logEvent(tag, text, extra),
  prefs: setupPrefsNow,
  uuid: randomUUID,
  onChange: () => { try { broadcastState(); } catch { /* window may be gone */ } },
  notify: (event, ctx) => notifyEvent(event, ctx),
  // KILL GATE (review P0-2) — an approval (in-app click, voice "yes", emailed link merged by the poll) and the
  // "proceed-green-only" timeout never run a fix while the gate is closed; the approval is not consumed either.
  gate: () => killGateReason(),
  // An approved fix runs through the SAME supervised pipeline (R11 → supervisor → policy → execute); the
  // approval replaces the countdown, never the gates.
  runner: ({ recipeId, approvalId, decidedBy, channel }) => runSupervisedFix({ recipeId, mode: "confirmed", approved: true, approvalId, source: `approval:${channel || "desktop"}`, risk: (recipeById(recipeId) || {}).risk || "medium", decidedBy })
});
let approvalPollTimer = null;
function ensureApprovalPolling() {
  if (approvalPollTimer) return;
  if (ariaStoppedNow()) return; // (review P0-2) a stopped ARIA polls nothing; Start ARIA restarts the poll
  approvalPollTimer = setInterval(() => { approvalTick().catch(() => undefined); }, 60 * 1000);
  approvalPollTimer.unref?.();
}
function stopApprovalPolling() {
  if (approvalPollTimer) { clearInterval(approvalPollTimer); approvalPollTimer = null; }
}
/** Every 60s while anything is pending: expire overdue asks (per approver.onTimeout) + poll remote decisions. */
async function approvalTick() {
  // KILL GATE (review P0-2) — stopped: no expiry, no poll, no merge (and the timer goes away).
  if (ariaStoppedNow()) { stopApprovalPolling(); return; }
  try { await approvals.expire(Date.now()); } catch { /* expiry is best-effort */ }
  const pending = approvals.pending();
  if (!pending.length) { stopApprovalPolling(); return; }
  if (!killGateOpen()) return; // paused / fleet kill: a remote "approved" waits on the server; nothing is merged into a run
  const keyHash = licenseKeyHash();
  if (!keyHash) return; // no license → no remote approvals (in-app only)
  for (const a of pending.filter((p) => p.remoteId)) {
    try {
      // The server binds each ask to the device hash that raised it; the poll proves the same device is asking.
      const res = await outbound.fetch(`${APPROVAL_ENDPOINT}?poll=1&id=${encodeURIComponent(a.remoteId)}`, { headers: { "x-sentinel-key": keyHash, "x-sentinel-device": deviceIdHash(), "user-agent": "aria-sentinel" }, signal: AbortSignal.timeout?.(8000) });
      if (!res || !res.ok) continue;
      const body = await res.json().catch(() => null);
      if (body && (body.status === "approved" || body.status === "denied")) await approvals.mergeRemote(a.id, body);
    } catch { /* offline → next tick */ }
  }
}
/** The colour tier of a fix: Tier-0 catalog + green registry → green; yellow registry → yellow; red/unknown → red. */
function recipeColor(recipeId) {
  const id = String(recipeId || "");
  if (resolveExecutorId(id) || tier0ById(id) || isDarwinTier0(id) || isGreenRecipe(id)) return "green";
  if (isYellowRecipe(id)) return "yellow";
  const r = recipeById(id);
  if (!r) return "red";
  if (r.risk === "green") return "green";
  if (r.risk === "yellow" || r.risk === "orange") return "yellow";
  return "red";
}
function recipeTitle(recipeId) {
  const id = String(recipeId || "");
  return (recipeById(id) || {}).title || (tier0ById(id, process.platform) || {}).title || id;
}
/** Maintenance-window verdict for an unattended run (strict: no window configured = not "within"). */
function maintenanceWindowNow(recipeId) {
  try { return checkMaintenanceWindow({ plan: { id: String(recipeId || "") }, windowConfig: setupPrefsNow().maintenanceWindow, now: new Date(), unattended: true }); }
  catch { return { allowed: false, within: false, windowConfigured: false, nextWindowStart: null, reasons: ["window check failed"] }; }
}
/** Customer policy overlay business hours: open when unset; otherwise local hour within [start, end). */
function businessHoursOpen(overlay, now = new Date()) {
  const bh = overlay && overlay.business_hours;
  if (!bh || !Number.isInteger(bh.start) || !Number.isInteger(bh.end)) return { open: true, configured: false };
  const h = now.getHours();
  const open = bh.start <= bh.end ? (h >= bh.start && h < bh.end) : (h >= bh.start || h < bh.end); // overnight window
  return { open, configured: true, start: bh.start, end: bh.end };
}

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
// The Walk-through LAUNCHER (2026-07-14) target: a companion flow id the globe overlay opens UNDER the globe.
// Held so a freshly-shown overlay renderer can pull it on companion-mode entry (mirrors pendingWalkthrough).
let pendingCompanionFlow = null;
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
  // RUN-CU / CU4 (fix i) — source:"deep-link" makes runSupervisedFix create an APPROVAL record (Control Center →
  // Approvals, plus the approvers' email) instead of ever executing straight from a browser link.
  logEvent("RUN", `Deep-link resolve requested for ${parsed.recipeId} — queued for your approval.`, { recipeId: parsed.recipeId });
  try { Promise.resolve(runSupervisedFix({ recipeId: parsed.recipeId, mode: "confirmed", source: "deep-link", risk: (recipeById(parsed.recipeId)?.risk || "medium") })).catch((e) => logEvent("ERROR", `Deep-link resolve failed: ${e?.message || e}`, { recipeId: parsed.recipeId })); }
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
    // PROD 2026-10-14 (audit M7) — an auto-start relaunch (`--startup` from the Run key / task) must never pop the
    // Settings window over the person's desktop; only a launch a PERSON started brings the window forward.
    const byPerson = shouldShowWindowOnSecondInstance(argv);
    logEvent("SELF-REPAIR", byPerson ? "Second ARIA Sentinel launch redirected to existing instance." : "Auto-start relaunch redirected to the running instance (window left as it was).");
    if (byPerson) showMainWindow("mode");
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
// PROD 2026-10-14 (audit M15) — the configurable excluded-folder list joins the locked default at launch.
try { configureExcludedFolders(store.get("excludedFolders") || []); } catch { /* the locked default always applies */ }

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
  // Four state variants (idle / detection / fixing / escalation) — the art lives in tray-art.mjs so it can be
  // unit tested without Electron. PROD 2026-10-14 (audit M2): nativeImage decodes PNG/JPEG only, so the icon is
  // the PNG rasterized from that art (tray-art-png.mjs, 1x + 2x), falling back to build/icon-256.png, and only
  // then to the legacy SVG URL (which Electron renders empty — kept as the last resort so nothing throws).
  const key = normalizeTrayState(state);
  try {
    const img = nativeImage.createFromDataURL(trayPngDataUrl(key, 1));
    if (img && !img.isEmpty()) {
      try { img.addRepresentation({ scaleFactor: 2, dataURL: trayPngDataUrl(key, 2) }); } catch { /* 1x alone is fine */ }
      return img;
    }
  } catch { /* fall through to the file icon */ }
  try {
    const fromFile = nativeImage.createFromPath(path.join(appRoot, "build", "icon-256.png"));
    if (fromFile && !fromFile.isEmpty()) return fromFile.resize({ width: 32, height: 32 });
  } catch { /* fall through */ }
  return nativeImage.createFromDataURL(traySvgDataUrl(key));
}

/** The window / taskbar icon: the ARIA brand icon (build/icon-256.png) when it ships beside the app, else the globe. */
let windowIconCache = null;
function makeWindowIcon() {
  if (windowIconCache) return windowIconCache;
  try {
    const brand = nativeImage.createFromPath(path.join(appRoot, "build", "icon-256.png"));
    if (brand && !brand.isEmpty()) { windowIconCache = brand; return brand; }
  } catch { /* fall through to the globe */ }
  windowIconCache = makeTrayImage("idle");
  return windowIconCache;
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

// PROD 2026-10-14 (F3 round 2 / R15) — the Settings window fits the screen it opens on (1366×768 laptops), and the size
// the person last used is remembered (validated against the current display before it is reused).
function mainWindowSizing() {
  let wa = { x: 0, y: 0, width: 1280, height: 820 };
  try { wa = screen.getPrimaryDisplay().workArea; } catch { /* headless / early call */ }
  const width = Math.max(640, Math.min(1280, wa.width - 40));
  const height = Math.max(480, Math.min(820, wa.height - 40));
  const sizing = { width, height, minWidth: 1024, minHeight: 720 };
  if (width < sizing.minWidth) sizing.minWidth = width;    // a 1366×768 work area cannot host a 1024×720 minimum
  if (height < sizing.minHeight) sizing.minHeight = height;
  try {
    const saved = store.get("mainWindowBounds");
    if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
      const w = Math.max(sizing.minWidth, Math.min(Number(saved.width), wa.width));
      const h = Math.max(sizing.minHeight, Math.min(Number(saved.height), wa.height));
      Object.assign(sizing, { width: w, height: h });
      if (Number.isFinite(saved.x) && Number.isFinite(saved.y) && saved.x >= wa.x && saved.y >= wa.y && saved.x + w <= wa.x + wa.width && saved.y + h <= wa.y + wa.height) Object.assign(sizing, { x: Number(saved.x), y: Number(saved.y) });
    }
  } catch { /* defaults */ }
  return sizing;
}
let boundsSaveTimer = null;
function rememberMainWindowBounds() {
  if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = null;
    try { if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized() && !mainWindow.isMaximized()) store.set("mainWindowBounds", mainWindow.getBounds()); } catch { /* best-effort */ }
  }, 500);
  boundsSaveTimer.unref?.();
}
function createMainWindow() {
  mainWindow = new BrowserWindow({
    ...mainWindowSizing(),
    // (audit M7) headless at auto-start: `--startup` (Run key / task) never shows the 1280×820 window at logon.
    show: shouldShowWindowAtLaunch(process.argv, process.env),
    title: "ARIA Sentinel - Settings",
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    icon: makeWindowIcon(),
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
          // Integrations RESTORE + tab-set-complete probe (2026-07-02): the Integrations tab activates and hosts
          // every connector section; the full expected tab set is present and ServiceNow is no longer top-level.
          const intBtn = document.querySelector('.nav-item[data-tab="integrations"]');
          intBtn && intBtn.click();
          const afterIntegrations = (document.querySelector('.tab-panel.active')||{}).id;
          const intSections = ['sn-section','entra-section','remote-section','ext-section','notify-section'].every(id=>!!document.getElementById(id));
          const intGrid = !!document.getElementById('integrationsGrid');
          const tabSet = Array.from(document.querySelectorAll('.nav-item[data-tab]')).map(b=>b.getAttribute('data-tab'));
          return JSON.stringify({hasSentinel, before, afterNav, navStyled, lockedShown, planShown, afterQa, afterIntegrations, intSections, intGrid, tabSet});
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
  mainWindow.on("resize", rememberMainWindowBounds);
  mainWindow.on("move", rememberMainWindowBounds);
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
    const height = Math.min(overlayAdvisory ? 500 : 340, wa.height - 80); // was 214 → clipped the card behind a scrollbar
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
  if (options.advisory) overlayAdvisory = true;
  if (overlayCompanion) overlayAdvisory = false;
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
  overlayAdvisory = false;
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
  // Globe v2 → PROD 2026-10-14 (F3 round 2): the resting mouse state comes from the MODE behaviour (manual is
  // interactive now, so the globe can be clicked to open the companion); the overlay's hover IPC may still make
  // the transparent parts click-through with forward:true. A brief interaction window always wins.
  if (Date.now() > overlayInteractUntil && !overlayHoverOverride) overlayWindow.setIgnoreMouseEvents(modeOverlayBehavior(store.get("mode")).ignoreMouse, { forward: true });
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
      // Restore the mode's resting mouse state once an interaction window has elapsed (hover override respected).
      if (now > overlayInteractUntil && !overlayHoverOverride) overlayWindow.setIgnoreMouseEvents(modeOverlayBehavior(store.get("mode")).ignoreMouse, { forward: true });
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
  // PROD 2026-10-14 (audit M20) — the everyday chords are configurable: off entirely (hotkeysEnabled:false), AltGr-safe
  // (Ctrl+Shift+Alt+key) by opt-in or automatically on AltGr-heavy system languages, classic Ctrl+Alt otherwise.
  const hk = store.get("hotkeyPrefs") || {};
  let locales = [];
  try { locales = typeof app.getPreferredSystemLanguages === "function" ? app.getPreferredSystemLanguages() : [app.getLocale()]; } catch { locales = []; }
  const base = selectDefaultHotkeys({ locales, altGrSafe: hk.altGrSafe, enabled: hk.enabled !== false });
  const defs = withRebinds(base, store.get("hotkeyRebinds") || {});
  hotkeyStatus = bindAll(
    defs,
    (combo, handler) => globalShortcut.register(combo, handler),
    (combo) => globalShortcut.isRegistered(combo),
    (def) => hotkeyHandler(def.action)
  );
  if (hk.enabled === false) hotkeyStatus = DEFAULT_HOTKEYS.map((d) => ({ id: d.id, action: d.action, label: d.label, combo: d.combo, status: "disabled", usedFallback: false, reason: "hotkeys-off" }));
  // RUN 19 §3 — the single-purpose panic kill-switch (Ctrl+Alt+K, fallback Ctrl+Shift+Pause). Registered
  // separately from DEFAULT_HOTKEYS so it can't be confused with the everyday hotkeys, then appended to
  // the live status list so it still shows + is rebindable in the Hotkeys tab. Its own switch: hotkeyPrefs.killSwitch.
  const killDef = (store.get("hotkeyRebinds") || {}).kill ? { ...KILL_HOTKEY, combo: (store.get("hotkeyRebinds") || {}).kill } : KILL_HOTKEY;
  const killStatus = hk.killSwitch === false
    ? { id: KILL_HOTKEY.id, action: KILL_HOTKEY.action, label: KILL_HOTKEY.label, combo: killDef.combo, status: "disabled", usedFallback: false, reason: "kill-hotkey-off" }
    : registerWithFallback(
      killDef,
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
// KILL GATE 2026-10-14 (review P0-2) — the gate closes FIRST (ariaStopped + the kill record), so every continuation that
// resumes after this function (a child's close, a countdown's tick, a poll response) already finds it closed; then the
// pending approvals go on hold and the approval poll stops. An elevated step already running (a UAC child Windows owns)
// finishes its own command — ARIA cannot end an elevated process — but nothing after it runs: every later step, spawn,
// approval and notice is refused at the gate until Start ARIA.
function activateKillSwitch() {
  store.set("ariaStopped", true);
  store.set("ariaKill", { at: new Date().toISOString(), by: "ctrl-alt-k" });
  const restorePoints = store.get("restorePoints") || [];
  const killed = killAllChildren();
  // PROD 2026-10-14 (audit M19) — rollbackRestorePoint records the request and offers the System Restore point; it
  // does NOT undo anything by itself (a real restore needs admin + a restart). So `undone` stays false and the toast
  // says "undo available" / "nothing to undo" — never "last action undone" for an undo that did not run.
  let undoRan = false;
  const target = buildKillResult({ children: [], restorePoints });
  if (target.undoId) {
    try { const rb = rollbackRestorePoint(target.undoId); undoRan = Boolean(rb && rb.undone === true); } catch { /* rollback best-effort under panic */ }
  }
  const result = buildKillResult({ children: Array.from({ length: killed }, () => ({})), restorePoints, undoRan });
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
  // Halt remediation: stop watchers + hide the globe so nothing new fires mid-undo. (F3 round 2) the state says
  // ariaStopped:true so the renderer's Start button re-arms from the truth, not from a local guess.
  try { if (detectionOrchestrator) detectionOrchestrator.stopAll(); } catch { /* ignore */ }
  store.set("ariaStopped", true);
  // ADVISORY ESCALATION (2026-10-14) — every open "advise three times, then act" escalation is BLOCKED (audited) and never
  // resumes on its own. Done BEFORE the countdowns are aborted so an in-flight auto-fix is recorded as blocked, not cancelled.
  try { const k = advisoryMachine.kill("kill-switch"); if (k.blocked) logEvent("KILL-SWITCH", `Ctrl+Alt+K: ${k.blocked} advisory escalation(s) blocked — they will not resume on their own.`, { advisoriesBlocked: k.blocked }); } catch { /* best-effort under panic */ }
  // RUN 23 — abort any pending pre-execution countdowns so an in-flight fix never lands after the kill.
  try { const aborted = countdownManager.abortAll(); if (aborted) { closeActionIndicator(); logEvent("KILL-SWITCH", `Aborted ${aborted} pending action countdown(s).`); } } catch { /* best-effort under panic */ }
  // KILL GATE (review P0-2) — pending approvals go ON HOLD (no click, link or timeout can run them; Start ARIA asks again)
  // and the approval poll stops, so a decision made on the server can never be merged into a run while ARIA is stopped.
  try { const h = approvals.hold("kill-switch"); if (h.held.length) logEvent("KILL-SWITCH", `Ctrl+Alt+K: ${h.held.length} pending approval(s) put on hold — they cannot be approved or run until Start ARIA asks again.`, { approvalsHeld: h.held.length }); } catch { /* best-effort under panic */ }
  stopApprovalPolling();
  // The opt-in Office Safety Net (local backups) stops too — "stops everything" (it restarts on Start ARIA when it is on).
  try { if (officeSafetyService && officeSafetyService.status().running) officeSafetyService.stop(); } catch { /* best-effort under panic */ }
  setAgentState("idle");
  logEvent("KILL-SWITCH", `Ctrl+Alt+K: ${killed} child process(es) terminated; ${result.undone ? "last action undone" : result.undoAvailable ? "undo available via System Restore (not applied automatically)" : "nothing to undo"}.`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send("sentinel:kill-switch", { toast: result.toast, killedCount: killed, undone: result.undone, undoAvailable: result.undoAvailable }); } catch { /* renderer toast best-effort */ }
  }
  broadcastState();
  return { ok: true, killedCount: killed, undone: result.undone, undoAvailable: result.undoAvailable, toast: result.toast };
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
    + "$sys=Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3'|Where-Object {$_.DeviceID -eq $env:SystemDrive}|Select-Object -First 1 DeviceID,Size,FreeSpace;" // D6 — system-drive usage
    + "$svc=Get-Service|Select-Object Name,DisplayName,Status,StartType;"
    + "[pscustomobject]@{cpu=@{model=[string]$cpu.Name;cores=$cpu.NumberOfCores;logical=$cpu.NumberOfLogicalProcessors;load=$cpu.LoadPercentage};"
    + "ram=$ram;gpu=$gpu;disks=$disks;systemVolume=$sys;os=@{edition=[string]$os.Caption;build=[string]$os.BuildNumber};services=$svc}|ConvertTo-Json -Compress -Depth 4"
};

function runPowerShell(command, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !command) return resolve("");
    let out = "";
    let child;
    try {
      // PROD 2026-10-14 (audit M8) — Restricted: an inline -Command never needs Bypass (Restricted only forbids .ps1 files).
      child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command", command],
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
  // RUN-CU / CU4 — the catalog that applies on THIS platform (macOS → the user-level darwin set; Windows unchanged).
  return tier0ForPlatform(process.platform).map((r) => ({ ...previewTier0(r), platform: r.platform || "win32" }));
}

// Doctor reasoner: match symptom → rank causes against live context → surface anomalies. KNOWLEDGE +
// LOCAL CONTEXT ONLY; never auto-executes (the renderer asks before any Tier-0 action runs).
async function runDiagnose(message) {
  const context = await getSystemContext({});
  const result = diagnoseSymptom(String(message || ""), getSymptomKb(), context || {});
  // F1 — bind the matched symptom to its vetted, reversible Tier-0 executor (printer → restart-print-spooler)
  // so "Resolve it for me" actually runs the gated fix. Empty when no safe one-click fix exists → the caller
  // honestly routes to the guided walk-through instead of a resolve that would be held (Rule 14).
  const topId = (result.matches && result.matches[0] && result.matches[0].id) || "";
  const recipeId = executorForSymptom(topId);
  logEvent("DIAGNOSE", `Symptom matched: ${result.topSymptom || "unrecognized"} (${result.causes.length} ranked causes)${recipeId ? " · bound fix " + recipeId : ""}.`);
  return { ok: true, ...result, recipeId };
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
  if (reason !== "manual" && !telemetryAllowed()) { logEvent("UPDATE", `Update check (${reason}) deferred until Setup is completed.`); return { updateAvailable: false, deferred: true, reason: "setup-not-completed" }; }
  const lic = readLicense() || {};
  // PROD 2026-10-14 (audit M9/M17) — the device credential travels as x-sentinel-key (sha256 of the key); the raw key
  // in the query string is only the legacy fallback when there is no 64-hex key to hash.
  const feed = buildFeedRequest(lic.key || "", "https://iisupp.net", `version=${encodeURIComponent(SENTINEL_VERSION)}`);
  const result = await checkForUpdate({
    fetchManifest: async () => {
      const r = await outbound.fetch(feed.url, { headers: { "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash(), ...feed.requestHeaders } });
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
  if (!telemetryAllowed()) { logEvent("HEARTBEAT", "Heartbeat not sent — waiting for Setup to be completed (nothing leaves the device before consent)."); return { sent: false, reason: "setup-not-completed" }; }
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
    // (audit M9/M31) the device credential + device hash ride in headers, like notify/approval already do.
    const keyHash = licenseKeyHash();
    const headers = { "content-type": "application/json", "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash() };
    if (keyHash) headers["x-sentinel-key"] = keyHash;
    const res = await outbound.fetch(HEARTBEAT_ENDPOINT, { method: "POST", headers, body: JSON.stringify(payload) });
    store.set("lastHeartbeat", { ok: Boolean(res && res.ok), status: res && res.status, ts: new Date().toISOString() });
    logEvent("HEARTBEAT", res && res.ok ? "Daily heartbeat sent (content-blind)." : `Daily heartbeat not accepted (HTTP ${res && res.status}).`);
    // RUN-CU / CU4 (audit P0 #2) — the heartbeat reply is the fleet control plane's second channel: a
    // { killed, reason } directive here propagates without waiting for a manual "Update knowledge" click.
    try {
      const body = res && res.ok && typeof res.json === "function" ? await res.json().catch(() => null) : null;
      const kill = parseControlPlaneKill(body);
      if (kill.present) applyControlPlaneKill(kill.killed, kill.reason);
      // REVIEW P1-3 — the server's first sight of this device anchors the local trial (only ever moves its start earlier).
      if (body && body.trialStartedAt) noteServerTrialStart(body.trialStartedAt);
    } catch { /* an unparseable reply never affects the kill state */ }
  } catch { store.set("lastHeartbeat", { ok: false, status: 0, ts: new Date().toISOString() }); /* offline is fine; next daily tick retries */ }
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
// PROD 2026-10-14 (audit M7) — ONE launcher per logon. Registration writes the HKCU Run key only; the at-logon task
// is created only as the SELF-HEAL after the key was removed (belt-and-suspenders used to mean two launches per
// logon, the second of which hit second-instance and popped the Settings window ~30 s after every login).
async function registerStartup({ withTask = false } = {}) {
  if (process.platform !== "win32") return { ok: false, reason: "not-windows" };
  const exe = process.execPath;
  // 🔒 R11 — never register/scan a path inside the off-limits private folder.
  if (isBlockedPath(exe)) { logEvent("SECURITY", `R11 blocked startup path. ${r11AuditEntry("startup").surfaced}`); return { ok: false }; }
  const reg = registryRunEntry(exe);
  const regRes = await runWinCmd(["reg", "add", reg.key, "/v", reg.name, "/t", "REG_SZ", "/d", reg.value, "/f"]);
  let taskRes = { ok: false, skipped: true };
  if (withTask) {
    const task = taskDefinition(exe);
    taskRes = await runWinCmd(["schtasks", "/Create", "/TN", task.name, "/TR", task.command, "/SC", "ONLOGON", "/DELAY", "0000:30", "/RL", "LIMITED", "/F"]);
  }
  store.set("startupEnabled", true);
  if (regRes.ok) store.set("startupBothSeenAt", new Date().toISOString());
  logEvent("STARTUP", regRes.ok ? (withTask ? `Registered HKCU Run key + at-logon task (self-heal)${taskRes.ok ? "" : " — task creation did not complete"}.` : "Registered HKCU Run key.") : "Startup registration did not complete (reg add failed).");
  return { ok: regRes.ok, task: taskRes.ok };
}
async function probeStartup() {
  const reg = await runWinCmd(["reg", "query", RUN_KEY, "/v", RUN_VALUE_NAME]);
  const task = await runWinCmd(["schtasks", "/Query", "/TN", TASK_NAME]);
  return { registry: reg.ok, task: task.ok };
}
async function healStartupIfNeeded() {
  // (audit M7) pure decision (startup-registrar.mjs) → no tamper audit on a clean first run, nothing at all off win32,
  // the 24h grace honoured, and the at-logon task only as the heal after a removal.
  if (process.platform !== "win32") return { action: "skip", reason: "not-windows" };
  if (store.get("startupEnabled") === false) return { action: "skip", reason: "user-disabled" }; // user explicitly turned it off
  const status = await probeStartup();
  const decision = startupHealDecision({ platform: process.platform, startupEnabled: store.get("startupEnabled"), status, lastBothPresentAt: store.get("startupBothSeenAt"), now: Date.now() });
  if (decision.action === "ok") { store.set("startupBothSeenAt", new Date().toISOString()); return decision; }
  if (decision.action !== "register") return decision;
  if (decision.tamper) recordStartupTamper(classifyRemoval({ registryMissing: true, taskMissing: !status.task }));
  await registerStartup({ withTask: decision.reason !== "never-registered" }); // first run: key only; a heal: key + task
  return decision;
}
function recordStartupTamper(method) {
  const audit = buildTamperAudit({ method, now: Date.now(), userConfirmed: false });
  store.set("startupDisabledAt", audit.timestamp);
  store.set("startupAudit", [audit, ...(store.get("startupAudit") || [])].slice(0, 50));
  logEvent("SECURITY", `Startup disabled (${audit.method}). ${disabledBanner(audit.timestamp)}`);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("startup:tamper", audit);
}
function setAutoStartup(on) {
  if (on) { store.set("startupEnabled", true); registerStartup({ withTask: false }).catch(() => undefined); return { ok: true, enabled: true }; }
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
  logEvent("UPDATE", `Installing update ${state.version} in an opportunity window.`);
  // (audit M24) INSTALLED is written only when the installer was really handed the update (quitAndInstall reached);
  // a failed download leaves the phase where it was, so a retry is still possible and the state never lies.
  let r = { ok: false, reason: "not-attempted" };
  try { r = await installUpdate(); } catch { r = { ok: false, reason: "install-threw" }; }
  if (r && r.ok) writeUpdateState({ ...state, phase: "INSTALLED", installedAt: new Date().toISOString() });
  else logEvent("UPDATE", `Update ${state.version} not installed (${(r && r.reason) || "unknown"}); will retry at the next opportunity.`);
  return r && r.ok ? { ok: true } : { ok: false, reason: (r && r.reason) || "install-failed" };
}
function updateTick() {
  let st = readUpdateState();
  if (orchestrator.isNoticeDue(st, Date.now())) {
    st = orchestrator.advance(st, Date.now());
    writeUpdateState(st);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("update:notice", { phase: st.phase, strike: st.strike, version: st.version });
  }
  if (st.phase === "AUTO" && !ariaStoppedNow()) { // (review P0-2) no automatic update install while ARIA is stopped
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
  // RUN-CU / CU4 — privacy is the MEASURED verifier verdict (a failed live capture), not "did the KB-first chain
  // ever reach Anthropic": a novel question answered by the fallback is not a privacy incident. externalAiCalls
  // is reported separately + honestly in getState().
  const pc = lastPrivacyCapture || store.get("lastPrivacyCapture") || null;
  // (audit M29) heartbeatOk is the LAST real heartbeat outcome (true until one has actually failed; never a literal "all good").
  const hb = store.get("lastHeartbeat") || null;
  const sources = { auditOk, privacyOk: !(pc && pc.pass === false), tier0Ok: !remediationKilled(), heartbeatOk: !(hb && hb.ok === false) };
  const log = store.get("transparencyLog") || [];
  const fixes = countLiveFixes(log); // R6a — live fixes only, never a preview
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
  const sla = slaData();
  return {
    sources,
    // (audit M29) real-or-empty: threats are the SECURITY rows (null when none were ever evaluated is not a thing —
    // the count is real); breaches come from the SLA surface (null until measured); "last sync" says "never" honestly.
    subline: { eventsToday: log.length, threats: log.filter((e) => e.tag === "SECURITY").length, lastSyncAgo: upd.lastCheckAt ? relativeAgo(upd.lastCheckAt) : "never" },
    metrics: { uptime7d: sla.uptime.d7, mttr: null, accuracy: null, breaches: sla.measured ? (sla.breaches || []).length : null, hoursSaved: vp.hoursSaved, dollarsSaved: vp.dollarsSaved, deflection: resolutionStatsNow().deflectionPct, version: SENTINEL_VERSION, updatePending: pending.some((p) => /Update/.test(p.text)) },
    pending,
    activity: recentLog(10),
    // Rule 14 — the trust strip states what was measured, and says "not measured yet" when it was not.
    trust: `🔒 Local processing · audit integrity ${auditOk ? "verified" : "NEEDS REVIEW"} · ${pc && pc.ts ? `privacy verifier ${pc.pass ? "PASS" : "REVIEW"} (${pc.disallowedHostCount || 0} off-allowlist, ${pc.leakingPayloadCount || 0} with content, last capture ${relativeAgo(pc.ts)})` : "privacy verifier not run yet — run Live capture (10s)"}${s.externalAiCalls ? " · Anthropic fallback used this session" : ""}`
  };
}
/** (audit M13) fixes whose read-only post-fix probe PASSED — the only number allowed to be called "verified". */
function verifiedFixCount() {
  return (store.get("transparencyLog") || []).filter((e) => e && e.tag === "DONE" && /^Verification for .*: passed\.$/.test(String(e.text || ""))).length;
}
function relativeAgo(iso) { const t = Date.parse(iso); if (!t) return "just now"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; }

function performanceData() {
  const log = store.get("transparencyLog") || [];
  const fixes = countLiveFixes(log); // R6a — live fixes only, never a preview
  const diags = log.filter((e) => e.tag === "DIAGNOSE").length;
  const chatStats = store.get("chatStats") || {}; // D2 — real Ask-ARIA usage
  return {
    // H2 (2026-07-02) — real-or-empty: no fabricated 100%. Until real operational metrics are wired from live
    // resolution outcomes, these render "--" (Rule 14: never a vanity 100% first-touch/auto/recipe at zero data).
    operational: { mttd: null, mttr: null, ftr: null, autoPct: null, recipeSuccess: null, detTrend: [] },
    // D2 — KB hit rate is now REAL: kb hits / total asks (null until the first real ask, Rule 14).
    ai: { accuracy: null, calibration: null, confirmRate: null, kbHitRate: chatKbHitRate(chatStats), top3: null, hoursSaved: null, costSaved: null, anomalies: 0, diagnoses: diags },
    usage: { activeToday: Math.round((Date.now() - startedAt) / 3600000), activeWeek: 0, topTier: "tier-0", hotkeys: (store.get("hotkeyUse") || 0), asks: Number(chatStats.asks) || 0, kbHits: Number(chatStats.kbHits) || 0 }
  };
}

function readSlaState() {
  try { return Sla.openSlaState(fs.readFileSync(SLA_STATE_FILE(), "utf8"), appHmacKey()); } catch { return { downtime: [], detections: [] }; }
}
function writeSlaState(state) {
  try { fs.mkdirSync(path.dirname(SLA_STATE_FILE()), { recursive: true }); fs.writeFileSync(SLA_STATE_FILE(), Sla.sealSlaState(state, appHmacKey())); } catch { /* best-effort */ }
  return state;
}
// PROD 2026-10-14 (audit M12) — the SLA surface is REAL-OR-EMPTY: nulls + "not measured yet" until a detection or a
// downtime row has actually been recorded on this device; never "100% met" over zero data.
function slaData() {
  const tier = licenseTier();
  const st = readSlaState();
  const surface = Sla.slaSurface(st, tier, Date.now());
  return {
    tier,
    ...surface,
    thresholds: { response: Sla.tierSla(tier).response, resolution: Sla.tierSla(tier).resolution }
  };
}
// (audit M12) the producers that were missing: a launch after an unseen gap > 2 min is downtime; every detection
// writes a row (responseMs = watcher → card), updated with resolveMs when its fix verifies.
const LAST_SEEN_KEY = "slaLastSeenAt";
function recordLaunchGapAsDowntime() {
  try {
    const last = Date.parse(store.get(LAST_SEEN_KEY) || "");
    const gap = Number.isFinite(last) ? startedAt - last : NaN;
    if (Number.isFinite(gap) && gap > 2 * 60 * 1000) writeSlaState(Sla.recordDowntime(readSlaState(), { startMs: last, durationMs: gap, reason: "not-running" }));
  } catch { /* best-effort */ }
  touchSlaLastSeen();
}
function touchSlaLastSeen() { try { store.set(LAST_SEEN_KEY, new Date().toISOString()); } catch { /* best-effort */ } }
function recordSlaDetectionRow(detection, recipe) {
  try {
    const sev = recipe && recipe.risk === "red" ? "P1" : recipe && (recipe.risk === "yellow" || recipe.risk === "orange") ? "P3" : "P4";
    writeSlaState(Sla.recordSlaDetection(readSlaState(), { severity: sev, responseMs: 0, resolved: false, ts: detection && detection.ts }));
  } catch { /* best-effort */ }
}

// RUN-CU / CU4 (audit P0 #4) — the Compliance tab + the quarterly PDF read EVIDENCE, not literals. Every control
// with a real local signal is measured right now; the rest are labelled capabilities; the privacy verdict is
// the last live capture (or "not measured yet"), never a hardcoded pass.
let signExecutableFlag = null;
function buildIsSigned() {
  if (signExecutableFlag != null) return signExecutableFlag;
  try { const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8")); signExecutableFlag = Boolean(pkg.build && pkg.build.win && pkg.build.win.signExecutable === true); }
  catch { signExecutableFlag = false; }
  return signExecutableFlag;
}
function complianceEvidenceNow() {
  const sla = readSlaState();
  return deriveControlOverrides({
    auditIntegrity: store.get("auditIntegrity") || { ok: true },
    auditSealKeyed: fs.existsSync(AUDIT_SEAL_FILE()),
    lastPrivacyCapture: lastPrivacyCapture || store.get("lastPrivacyCapture") || null,
    signExecutable: buildIsSigned(),
    watchersRunning: Boolean(detectionOrchestrator) && !agentBlocked() && !store.get("ariaStopped"),
    slaHasData: Boolean((sla.detections && sla.detections.length) || (sla.downtime && sla.downtime.length)),
    setupCompleted: !shouldShowSetup(store.get("setupConfig")),
    lastRetentionCleanup: store.get("lastRetentionCleanup") || null,
    allowlistTestOk: null,
    killed: remediationKilled(),
    externalAiCalls: externalAiCallsNow()
  });
}
function complianceData() {
  const s = getState();
  const ev = complianceEvidenceNow();
  return {
    audit: { ok: !(s.auditIntegrity && s.auditIntegrity.ok === false), entries: (store.get("transparencyLog") || []).length, lastVerified: store.get("auditVerifiedAt") || "" },
    privacy: ev.privacy, // { pass:true|false|null, allowlistOk, sanitization|null, ts, ageHours, evidenced, label }
    tier0: { blocked: (store.get("tier0Blocked") || 0), categories: [] },
    r11: r11EnforcementStatus(store.get("r11Attempts") || 0, new Date().toISOString()),
    frameworks: compositeScores(ev.overrides),
    evidence: ev.evidence,
    evidenceSummary: summarizeEvidence(ev.evidence),
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
    // (audit M13) incidents = detections logged; diagnoses + verified fixes are counted separately — never conflated.
    kpis: { incidents: (store.get("transparencyLog") || []).filter((e) => e.tag === "DETECT").length, diagnoses: perf.ai.diagnoses || 0, verifiedFixes: verifiedFixCount(), autoPct: perf.operational.autoPct, hoursSaved: vp.hoursSaved, dollarsSaved: vp.dollarsSaved, deflectionPct: vp.deflectionPct, resolved: vp.resolved, conversations: vp.conversations, accuracy: perf.ai.accuracy, breaches: (sla.breaches || []).length, uptime7d: sla.uptime.d7, mttr: perf.operational.mttr, version: SENTINEL_VERSION },
    sla: { composite: sla.compliance.composite, floor: sla.compliance.floor, breaches: (sla.breaches || []).length, measured: sla.measured !== false, categories: sla.measured === false ? { uptime: "not measured yet", met: "not measured yet" } : { uptime: `${sla.compliance.uptime}%`, met: sla.compliance.met ? "yes" : "no" } },
    compliance: { soc2: comp.frameworks.soc2, hipaa: comp.frameworks.hipaa, pipeda: comp.frameworks.pipeda, gdpr: comp.frameworks.gdpr },
    // RUN-CU / CU4 — evidence + the measured privacy verdict so the PDF says "verified" only when it is.
    evidence: comp.evidence,
    privacy: comp.privacy,
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

// RUN-CU / CU4 (audit P1 #9) — the 7-year audit floor is REAL now: rows that leave the hot in-store window are
// appended to userData/audit/YYYY-MM.jsonl (one line per entry, same content-blind fields) before they are
// trimmed, both here and in logEvent's 250-row cap. Nothing is dropped silently any more.
const AUDIT_ARCHIVE_DIR = () => path.join(app.getPath("userData"), "audit");
function archiveAuditRows(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((e) => e && e.ts);
  if (!list.length) return 0;
  try {
    fs.mkdirSync(AUDIT_ARCHIVE_DIR(), { recursive: true });
    const byMonth = new Map();
    for (const e of list) {
      const month = String(e.ts).slice(0, 7) || "unknown";
      byMonth.set(month, (byMonth.get(month) || "") + JSON.stringify({ ts: e.ts, tag: e.tag, text: e.text, recipeId: e.recipeId }) + "\n");
    }
    for (const [month, text] of byMonth) fs.appendFileSync(path.join(AUDIT_ARCHIVE_DIR(), `${month.replace(/[^0-9-]/g, "")}.jsonl`), text);
    return list.length;
  } catch { return 0; }
}

// Daily 02:00 retention cleanup — honors the retention table + legal-hold; never traverses R11 paths.
function runRetentionCleanup() {
  const log = store.get("transparencyLog") || [];
  const items = log.map((e) => ({ class: "auditLog", ts: e.ts }));
  const plan = planCleanup(items, Date.now());
  // Audit log: keep the hot 30-day window in the store; older rows rotate to the monthly archive (7y floor —
  // full purge only past it, handled by plan). CU4 fixed the former no-op filter (`>= cutoff || true`).
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const hot = log.filter((e) => { const t = Date.parse(e && e.ts); return !Number.isFinite(t) || t >= cutoff; });
  const cold = log.filter((e) => { const t = Date.parse(e && e.ts); return Number.isFinite(t) && t < cutoff; });
  const archived = archiveAuditRows(cold);
  const trimmed = hot.slice(0, 5000);
  store.set("transparencyLog", trimmed);
  try { writeKeyedAuditSeal(trimmed); } catch { /* re-seal best-effort */ }
  store.set("lastRetentionCleanup", new Date().toISOString());
  logEvent("RETENTION", `Cleanup pass: ${plan.delete.length} eligible, ${plan.excludedR11} R11-excluded, ${archived} row(s) rotated to the monthly audit archive, next ${nextCleanupAt()}.`);
  return { ok: true, planned: plan.delete.length, excludedR11: plan.excludedR11, archived };
}

// RUN-CU / CU4 — aggregate report (daily/weekly per reportCadence): the local PDF stays on the device (the
// existing report generator); the email/SMS carries only COUNTS for the period. Per-fix cadence sends on each
// outcome instead (see afterFixOutcome). Runs on launch + hourly; sends at most once per period.
function reportPeriodMs(cadence) { return cadence === "daily" ? 24 * 3600000 : cadence === "weekly" ? 7 * 24 * 3600000 : 0; }
async function maybeSendAggregateReport(now = Date.now()) {
  const prefs = setupPrefsNow();
  const period = reportPeriodMs(prefs.reportCadence);
  if (!period) return { sent: false, reason: "per-fix cadence" };
  const last = Date.parse(store.get("lastAggregateReportAt") || "") || 0;
  if (now - last < period) return { sent: false, reason: "not due" };
  const since = last || (now - period);
  const log = (store.get("transparencyLog") || []).filter((e) => { const t = Date.parse(e && e.ts); return Number.isFinite(t) && t >= since; });
  const summary = {
    period: prefs.reportCadence === "daily" ? "last 24 hours" : "last 7 days",
    detections: log.filter((e) => e.tag === "DETECT").length,
    fixes: log.filter((e) => e.tag === "RUN" && /^Executing/.test(e.text || "")).length,
    failures: log.filter((e) => e.tag === "ERROR" && e.recipeId).length
  };
  store.set("lastAggregateReportAt", new Date(now).toISOString());
  let pdf = null;
  try { pdf = await generateReport({ quarterly: false }); } catch { pdf = null; } // local PDF stays local
  const r = await notifyEvent("report", { title: "Sentinel report", summary });
  return { sent: Boolean(r && (r.email.status === "sent" || r.sms.status === "sent" || r.desktop.shown)), summary, pdf: pdf && pdf.ok ? pdf.filename : null, result: r };
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
// KILL GATE 2026-10-14 (review P0-2) — Stop ARIA closes the same gate Ctrl+Alt+K does (nothing runs while stopped: no
// fix, no approval, no timeout policy, no poll); its open escalations freeze in place (Ctrl+Alt+K blocks them for good).
function stopAria() {
  const next = applyRunState({ running: true, watchers: true }, "stop");
  store.set("ariaStopped", true);
  store.set("pausedUntil", 0);
  try { if (detectionOrchestrator) detectionOrchestrator.stopAll(); } catch { /* ignore */ }
  try { const aborted = countdownManager.abortAll(); if (aborted) closeActionIndicator(); } catch { /* best-effort */ }
  stopApprovalPolling();
  hideOverlay();
  setAgentState("idle");
  logEvent("WATCH", "ARIA stopped by user — globe hidden, monitoring paused, nothing runs until Start ARIA.");
  broadcastState();
  return { ok: true, state: next };
}
/**
 * Start ARIA — the ONE deliberate way out of a stop (Stop ARIA or Ctrl+Alt+K), from the visible Start ARIA button
 * (sentinel:start-aria). Audited: after a kill it says so, re-asks every held approval (fresh links) and restarts the
 * watchers, the approval poll and an enabled Office Safety Net. Blocked escalations stay closed.
 */
function startAria() {
  const wasStopped = ariaStoppedNow();
  const kill = store.get("ariaKill") || null;
  store.set("ariaStopped", false);
  store.delete("ariaKill");
  store.set("pausedUntil", 0);
  startDetection();
  if (store.get("showFloatingGlobe") !== false) showOverlay({ expanded: false });
  applyModeBehavior(store.get("mode"));
  let reasked = 0;
  if (kill) { try { reasked = approvals.reaskHeld().reasked.length; } catch { reasked = 0; } }
  if (approvals.pending().length) ensureApprovalPolling();
  try { if ((store.get("officeSafety") || {}).enabled === true && !(officeSafetyService && officeSafetyService.status().running)) startOfficeSafety(); } catch { /* the safety net never blocks a start */ }
  if (wasStopped) logEvent("KILL-SWITCH", `Resumed by the person at this device (Start ARIA) after ${kill ? `Ctrl+Alt+K (${String(kill.at || "").slice(0, 19)})` : "Stop ARIA"} — fixes may run again through every gate${kill ? `; ${reasked} held approval(s) asked again with new links; escalations blocked by Ctrl+Alt+K stay closed` : ""}.`, { resumed: true, after: kill ? "kill-switch" : "stop", reasked });
  logEvent("WATCH", "ARIA started — now monitoring (screen errors → event log → KB → research → escalate).");
  broadcastState();
  return { ok: true, state: applyRunState({}, "start") };
}

// RUN 15 §1 — runtime self-heal pass: audit real surfaces, auto-heal recoverable, escalate the rest.
function runSelfHeal() {
  // (audit M20) probe the chords that are ACTUALLY configured (AltGr-safe / rebinds); a deliberately disabled hotkey is healthy.
  const liveHotkeys = hotkeyStatus.length ? hotkeyStatus.filter((h) => h.id !== KILL_HOTKEY.id) : DEFAULT_HOTKEYS.map((h) => ({ id: h.id, combo: h.combo, status: "active" }));
  const features = [
    ...liveHotkeys.map((h) => ({ id: `hotkey-${h.id}`, type: "hotkey", recoverable: true, combo: h.combo, disabled: h.status === "disabled" })),
    { id: "watcher-orchestrator", type: "watcher", recoverable: true },
    { id: "bridge", type: "ipc", recoverable: false, fixType: "code" }
  ];
  const probe = (f) => {
    if (f.type === "hotkey") { if (f.disabled) return true; try { return globalShortcut.isRegistered(f.combo); } catch { return false; } }
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
    if (Date.now() >= overlayInteractUntil && overlayWindow && !overlayWindow.isDestroyed() && !overlayExpanded && !overlayHoverOverride) {
      overlayWindow.setIgnoreMouseEvents(modeOverlayBehavior(store.get("mode")).ignoreMouse, { forward: true });
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
  // PROD 2026-10-14 (audit M29) — no fabricated constants: the watcher heartbeat is the orchestrator's REAL status
  // (null = not measured → the scorer's neutral), and `tampered` is the real integrity verdict.
  let heartbeats = null;
  try {
    const st = detectionOrchestrator ? detectionOrchestrator.status() : null;
    if (st) heartbeats = { healthy: st.running && !agentBlocked() ? st.count : 0, total: st.count };
  } catch { heartbeats = null; }
  const integrity = store.get("auditIntegrity") || null;
  return {
    state: {
      heartbeats,
      recipeOutcomes: { success, failure },
      serviceNow: { queued: serviceNowQueueDepthSafe(), failed: 0 },
      // kb age is unknown locally (no signed-bundle timestamp on disk yet) → neutral-healthy.
      kb: {},
      audit: { entries: log.length, valid: integrity && integrity.ok === false ? Math.max(0, Number(integrity.brokenAt) || 0) : log.length, tampered: Boolean(integrity && integrity.ok === false) }
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
    { label: "Update knowledge", click: () => updateKnowledge({ manual: true }).catch(() => undefined) },
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
    ...(devModeNow() ? [{ label: "Simulate ARIA detection (test)", click: () => simulateAriaDetection() }] : []), // (audit M32) dev only
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
    icon: makeWindowIcon(),
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
    icon: makeWindowIcon(),
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
// REVIEW P1-3 (2026-10-14) — the cache is believed only when the server SIGNED the verdict for this device + key
// (license-cache.mjs); an unsigned answer counts for ≤1 h in the run that received it, never as admin.
const RESOLVE_ENDPOINT = "https://iisupp.net/.netlify/functions/sentinel-resolve";
const LICENSE_CACHE_FILE = path.join(os.homedir(), ".aria-sentinel", "license-cache.json");
// REVIEW P1-3 — the trial clock's marks in the store: the monotonic last-seen high-water mark (also kept in the licence
// cache as `last_seen`), a mirror of the local trial start, and the server's first sight of this device.
const CLOCK_HIGH_WATER_KEY = "clockHighWater";
const TRIAL_START_MIRROR_KEY = "trialStartedAt";
const SERVER_TRIAL_START_KEY = "serverTrialStartedAt";
const UNSIGNED_RECHECK_MS = 50 * 60 * 1000; // an unsigned verdict lasts 1 h: ask again before it lapses
let unsignedVerdictThisRun = ""; // the fingerprint of the one UNSIGNED verdict this process itself received (never from disk)
let unsignedRecheckTimer = null;
let lastSigningState = "";
let highWaterCacheWrittenAt = 0;

function readLicenseCache() {
  try { return JSON.parse(fs.readFileSync(LICENSE_CACHE_FILE, "utf8")); } catch { return null; }
}
// The cache holds only a key HASH + plan + timestamps — deliberately no secret and no raw key, so even if
// another local user could read it they gain nothing forgeable. We still scope it to the user profile dir
// and best-effort user-only perms (consistent with license.json / trial.json alongside it).
function writeLicenseCacheRaw(cache) {
  try {
    fs.mkdirSync(path.dirname(LICENSE_CACHE_FILE), { recursive: true });
    fs.writeFileSync(LICENSE_CACHE_FILE, JSON.stringify(cache, null, 2));
    try { fs.chmodSync(LICENSE_CACHE_FILE, 0o600); } catch { /* perms best-effort (no-op on some FS) */ }
  } catch { /* cache write best-effort */ }
}
// REVIEW P1-3 — every write carries the last-seen high-water mark forward (never lowers it).
function writeLicenseCache(cache) {
  const keep = highWaterOf((readLicenseCache() || {}).last_seen, cache && cache.last_seen, store.get(CLOCK_HIGH_WATER_KEY));
  writeLicenseCacheRaw({ ...cache, ...(keep > 0 ? { last_seen: new Date(keep).toISOString() } : {}) });
}
// REVIEW P1-3 — the verdict goes; the last-seen high-water mark stays (it is what stops a deleted trial.json from
// meaning "never ran here").
function clearLicenseCache() {
  unsignedVerdictThisRun = "";
  try {
    const keep = highWaterOf((readLicenseCache() || {}).last_seen, store.get(CLOCK_HIGH_WATER_KEY));
    if (keep > 0) writeLicenseCacheRaw({ last_seen: new Date(keep).toISOString() });
    else fs.rmSync(LICENSE_CACHE_FILE, { force: true });
  } catch { /* already gone */ }
}

// REVIEW P1-3 — the monotonic last-seen high-water mark: the latest time this app has seen (store + licence cache).
function clockHighWaterMs(cache) {
  let fromCache = 0;
  try { fromCache = highWaterOf(((cache === undefined ? readLicenseCache() : cache) || {}).last_seen); } catch { fromCache = 0; }
  return highWaterOf(store.get(CLOCK_HIGH_WATER_KEY), fromCache);
}
/** Raise the high-water mark to now (a clock rolled back never lowers it). The licence-cache copy is written ≤ every 10 min. */
function touchClockHighWater() {
  const now = Date.now();
  try { if (now > (Number(store.get(CLOCK_HIGH_WATER_KEY)) || 0)) store.set(CLOCK_HIGH_WATER_KEY, now); } catch { /* best-effort */ }
  if (highWaterCacheWrittenAt && now - highWaterCacheWrittenAt < 10 * 60 * 1000 && now >= highWaterCacheWrittenAt) return;
  highWaterCacheWrittenAt = now;
  try {
    const cache = readLicenseCache() || {};
    if (highWaterOf(cache.last_seen) < now) writeLicenseCacheRaw({ ...cache, last_seen: new Date(now).toISOString() });
  } catch { /* best-effort */ }
}
/**
 * A SIGNED verdict carries the server's clock. When it agrees with this device's clock but the high-water mark is
 * ahead of both, the mark was poisoned by a clock that once ran fast — reset it to now, or a paying customer would be
 * locked out for good. Only a verified signature can lower the mark; nothing unsigned ever does.
 */
function reconcileHighWaterWithSignedVerdict(cache) {
  try {
    const now = Date.now();
    const server = Date.parse(String((cache && cache.verdict && cache.verdict.verified_at) || ""));
    if (!Number.isFinite(server) || Math.abs(server - now) > LICENSE_CLOCK_SKEW_MS) return false;
    if (clockHighWaterMs(cache) <= now + LICENSE_CLOCK_SKEW_MS) return false;
    if (effectiveFromCache(cache, now, { ...licenseCacheOpts(), highWaterMs: 0 }).signed !== true) return false;
    store.set(CLOCK_HIGH_WATER_KEY, now);
    writeLicenseCacheRaw({ ...cache, last_seen: new Date(now).toISOString() });
    logEvent("LICENSE", "The clock high-water mark was ahead of the licence server's signed time (this clock once ran fast) — reset to now.");
    return true;
  } catch { return false; }
}
/** REVIEW P1-3 — the server's first sight of this device (heartbeat / sentinel-resolve). Kept only if it is EARLIER. */
function noteServerTrialStart(iso) {
  try {
    const t = Date.parse(String(iso || ""));
    if (!Number.isFinite(t) || t <= 0 || t > Date.now() + LICENSE_CLOCK_SKEW_MS) return false; // a later start never matters
    const prev = Date.parse(String(store.get(SERVER_TRIAL_START_KEY) || ""));
    if (Number.isFinite(prev) && prev <= t) return false;
    store.set(SERVER_TRIAL_START_KEY, new Date(t).toISOString());
    return true;
  } catch { return false; }
}
/** The options every cache decision is made with: this device, the high-water mark, the one unsigned answer of this run. */
function licenseCacheOpts(cache) {
  return { deviceHash: deviceIdHash(), highWaterMs: clockHighWaterMs(cache), trustedUnsigned: unsignedVerdictThisRun };
}
/** Store a sentinel-resolve answer (verdict + sig verbatim) and remember an unsigned one for THIS run only. */
function storeVerdict(key, r) {
  const cache = buildCache(key, r, Date.now());
  writeLicenseCache(cache);
  noteServerTrialStart(r.trialStartedAt);
  if (cache.sig) {
    unsignedVerdictThisRun = "";
    reconcileHighWaterWithSignedVerdict(cache);
  } else {
    unsignedVerdictThisRun = unsignedFingerprint(cache);
    try { clearTimeout(unsignedRecheckTimer); } catch { /* none */ }
    unsignedRecheckTimer = setTimeout(() => { refreshLicense({ force: true }).catch(() => undefined); }, UNSIGNED_RECHECK_MS);
    unsignedRecheckTimer?.unref?.();
  }
  if (cache.signing !== lastSigningState) {
    lastSigningState = cache.signing;
    if (!cache.sig) logEvent("LICENSE", `The licence server's answer was not signed (${cache.signing}) — it counts for at most 1 hour, never unlocks admin, and is checked again before it lapses and at the next launch.`);
  }
  return cache;
}

// POST the key to sentinel-resolve. Returns { httpStatus, status, plan, verified_at, verdict, sig, … }. Throws on a
// network failure (caller falls back to the cache). The raw key never leaves over anything but this one HTTPS POST.
async function resolveLicenseOnline(key, _email = "") {
  // RUN 34-3 — 10s timeout so license verification can NEVER hang the activation/trial flow on a slow or
  // mis-deployed endpoint. A timeout throws → enterLicense/refreshLicense treat it as offline (fail-closed).
  // REVIEW P1-3 — X-Sentinel-Device binds the signed verdict to this device. (The email is no longer sent: the
  // server stopped reading it — review P2-2 — and an address the server ignores has no reason to leave the device.)
  const res = await outbound.fetch(RESOLVE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash() },
    body: JSON.stringify({ key }),
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
    trialEndsAt: data.trialEndsAt || null,
    // REVIEW P1-3 — the signed verdict, verbatim, and the server's first sight of this device.
    verdict: data.verdict && typeof data.verdict === "object" && !Array.isArray(data.verdict) ? data.verdict : null,
    sig: typeof data.sig === "string" ? data.sig : null,
    signing: typeof data.signing === "string" ? data.signing : null,
    trialStartedAt: typeof data.trialStartedAt === "string" ? data.trialStartedAt : null
  };
}

// Silent launch re-verify. A fresh, same-key, SIGNED cache skips the network; otherwise we re-resolve and refresh the
// cache. Only a server verdict (active / revoked / expired / past_due) updates the cache — "invalid"/429/5xx/offline
// keep the prior cache (never downgrade on a non-verdict), and licenseStatus() decides what the cache is worth.
async function refreshLicense({ force = false } = {}) {
  // REVIEW P2-9 — nothing leaves the device before Setup consent: a pre-seeded license.json (Intune) is checked once
  // the person finishes Setup (setup:complete runs this), never at a launch before it. A key the person pastes
  // (enterLicense) is their own request and is not deferred.
  if (!telemetryAllowed()) { logEvent("LICENSE", "Licence check deferred until Setup is completed (nothing leaves the device before consent)."); return { deferred: true, reason: "setup-not-completed" }; }
  const lic = readLicense();
  const key = lic && lic.key ? String(lic.key) : "";
  if (!/^[a-f0-9]{64}$/i.test(key)) { clearLicenseCache(); return; }
  const cache = readLicenseCache();
  if (!force && cacheMatchesKey(cache, key) && cacheIsFresh(cache, Date.now(), licenseCacheOpts(cache))) return;
  try {
    const r = await resolveLicenseOnline(key);
    noteServerTrialStart(r.trialStartedAt);
    if (VERDICT_STATUSES.includes(r.status)) {
      storeVerdict(key, r);
      if (r.status === "revoked") logEvent("LICENSE", "License revoked by issuer — downgraded to free.");
      else if (r.plan && lic.plan !== r.plan) {
        try { fs.writeFileSync(LICENSE_FILE, JSON.stringify({ ...lic, plan: r.plan, validated_at: new Date().toISOString() }, null, 2)); } catch { /* plan-sync best-effort */ }
      }
      broadcastState();
    }
    // "invalid"/429/5xx → keep the prior cache; only a server verdict changes it. Fail-open, like the old behavior.
  } catch {
    // Offline / endpoint down → keep cache; effectiveFromCache degrades by age (toast at 24h, free floor at 72h).
  }
}

// The effective plan + licensed flag come from the server's cached verdict, degraded by cache age. "licensed"
// (a paid tier unlocked) holds while a trusted verdict is fresh (≤24h) or merely stale (24–72h, keeps the tier with a
// reconnect nudge); an untrusted, >72h-unverified, revoked/expired/past-due cache, or no cache, falls back to the free floor.
function licenseStatus() {
  const lic = readLicense();
  const key = lic && lic.key ? String(lic.key) : "";
  if (!/^[a-f0-9]{64}$/i.test(key)) return { mode: "manual", licensed: false, email: null, plan: null, ...trialFields(null), licenseSignal: "personal", licenseMessage: "" };
  const raw = readLicenseCache();
  const cache = cacheMatchesKey(raw, key) ? raw : null;
  const eff = effectiveFromCache(cache, Date.now(), licenseCacheOpts(raw));
  const licensed = eff.action === "use" || eff.action === "toast"; // fresh or stale-but-trusted
  return {
    mode: licensed ? "licensed" : "manual",
    licensed,
    email: lic?.email || null,
    plan: eff.plan,
    // SENTINEL TRIAL GATING 2026-07-02 — the permanent Walk-Through entitlement + real 30-day trial end,
    // echoed even when the plan degrades offline (a paid Walk-Through survives a network blip; fail-open).
    walkthroughEntitled: Boolean(eff.walkthroughEntitled),
    ...trialFields(eff.trialEndsAt || null),
    licenseSignal: eff.action,        // "use" | "toast" | "banner" | "personal" — drives the renderer nudge/banner
    licenseMessage: eff.message || "",
    licenseSigned: eff.signed === true // REVIEW P1-3 — true only for a verified, device-bound signed verdict
  };
}
/**
 * PROD 2026-10-14 (R3) — the TRUE trial end + days left for the renderer: the server-issued entitlement end when the
 * server sent one, otherwise the local 30-day trial's end; null when no trial exists. Same numbers on every surface.
 * REVIEW P1-3 — the local trial's days left come from its state (high-water mark, a start in the future refused), never
 * from the raw end date, so a rolled-back clock or an edited trial.json cannot show days that are not there.
 */
function trialFields(serverTrialEndsAt) {
  const local = trialState();
  const endsAt = serverTrialEndsAt || local.endsAt || null;
  const endsMs = endsAt ? Date.parse(endsAt) : NaN;
  const daysLeft = !serverTrialEndsAt ? (local.daysLeft == null ? null : local.daysLeft)
    : Number.isFinite(endsMs) ? Math.max(0, Math.ceil((endsMs - Math.max(Date.now(), clockHighWaterMs())) / 86400000)) : null;
  return { trialEndsAt: endsAt, daysLeft, trialDays: TRIAL_DAYS };
}

// RUN 13 §7 — the trial, stored at ~/.aria-sentinel/trial.json. PROD 2026-10-14 (audit M14 / R3): 30 DAYS from the
// first launch, started exactly once (the file is write-once; a later "Start trial" click or relaunch never resets
// it); the state carries the TRUE end date + days left so every surface shows the same number.
// REVIEW P1-3 — and deleting it does not restart it: the start is mirrored in the store, the server remembers when it
// first saw this device, and a device ARIA has run on before (a high-water mark exists) never starts a second trial.
function readTrial() {
  try { return JSON.parse(fs.readFileSync(TRIAL_FILE, "utf8")); } catch { return null; }
}
/** Every recorded trial start: trial.json, its store mirror, and the server's first sight (heartbeat / resolve). */
function trialStarts(cache) {
  const c = (cache === undefined ? readLicenseCache() : cache) || {};
  return [readTrial()?.started_at, store.get(TRIAL_START_MIRROR_KEY), store.get(SERVER_TRIAL_START_KEY), c.trialStartedAt];
}
/** Has ARIA run on this device before? (any high-water mark or any recorded start — never "fresh" after the first run) */
function trialHasRunBefore(cache) {
  return clockHighWaterMs(cache) > 0 || Boolean(resolveTrialStart(store.get(TRIAL_START_MIRROR_KEY), store.get(SERVER_TRIAL_START_KEY)));
}
function writeTrialRecord(started, email = "", extra = {}) {
  fs.mkdirSync(path.dirname(TRIAL_FILE), { recursive: true });
  const record = { started_at: started, days: TRIAL_DAYS, ends_at: new Date(Date.parse(started) + TRIAL_DAYS * 86400000).toISOString(), device_id: os.hostname(), ...extra };
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) record.email = String(email).trim().toLowerCase(); // local only, never sent
  fs.writeFileSync(TRIAL_FILE, JSON.stringify(record, null, 2));
  return record;
}
function mirrorTrialStart() {
  try {
    const local = Date.parse(String(readTrial()?.started_at || ""));
    const mirror = Date.parse(String(store.get(TRIAL_START_MIRROR_KEY) || ""));
    if (Number.isFinite(local) && local > 0 && !(mirror <= local)) store.set(TRIAL_START_MIRROR_KEY, new Date(local).toISOString());
  } catch { /* best-effort */ }
}
function ensureTrialStarted(email = "") {
  const ranBefore = trialHasRunBefore(); // decided BEFORE this launch leaves its own marks
  mirrorTrialStart();
  touchClockHighWater();
  if (readTrial() || licenseStatus().licensed) return false;
  // REVIEW P1-3 — trial.json is missing. A start recorded anywhere else is restored (never a new 30 days); with none, a
  // device ARIA has run on before keeps "trial ended" — only a first run ever starts a trial.
  const prior = resolveTrialStart(trialStarts());
  if (prior || ranBefore) {
    try { if (prior) writeTrialRecord(prior, "", { restored: true }); } catch { /* best-effort */ }
    logEvent("LICENSE", prior
      ? `trial.json was missing — restored from the recorded start (${prior.slice(0, 10)}); the trial is not restarted.`
      : "trial.json was missing on a device ARIA has run on before — the trial is not restarted (it counts as ended).");
    return false;
  }
  try {
    const started = new Date().toISOString();
    const record = writeTrialRecord(started, email);
    store.set(TRIAL_START_MIRROR_KEY, started);
    logEvent("LICENSE", `${TRIAL_DAYS}-day trial started (ends ${record.ends_at.slice(0, 10)}).`);
    return true;
  } catch {
    return false; // trial file write best-effort
  }
}
function trialState() {
  const cache = readLicenseCache();
  return trialStatusFor({ starts: trialStarts(cache), hasRunBefore: trialHasRunBefore(cache), now: Date.now(), highWaterMs: clockHighWaterMs(cache) });
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
  const fixes = countLiveFixes(log); // R6a — live fixes only, never a preview
  // RUN-B B1 — feed the REAL deflection (resolved / conversations) into the D2 pilot->paid proof, not just a fix count.
  return pilotProofMetrics(store.get("resolutionOutcomes") || [], { fixes });
}
// RUN-B B1 — the "Was this fixed?" feedback loop -> a real, defensible deflection %. Outcomes persist
// locally (no external send); the metric is real-or-empty and moves ONLY on a real resolved outcome.
function resolutionOutcomesLog() { return store.get("resolutionOutcomes") || []; }
function browserOutcomesLog() { return store.get("browserOutcomes") || []; } // JULY PORT 2026-10-14
function resolutionStatsNow() { return deflectionStats(resolutionOutcomesLog()); }
// RUN-B B2 — the ONE real-or-empty value proof (ROI $/hours + real deflection %) every surface renders. fixes =
// the SAME audit-log RUN count the D2 pilot proof uses; outcomes = the real B1 "was this fixed?" events.
function valueProofNow() {
  const log = store.get("transparencyLog") || [];
  const fixes = countLiveFixes(log); // R6a — live fixes only, never a preview
  return valueProof({ fixes, outcomeEvents: resolutionOutcomesLog() });
}
// RUN-B B3 — the honest trust/security surface, real-or-empty. Same real signals B1/B2 use: audit-log RUN
// count for fixes + the real "was this fixed?" outcomes for deflection. No seeded values, no cert we don't hold.
function trustPostureNow() {
  const log = store.get("transparencyLog") || [];
  const fixes = countLiveFixes(log); // R6a — live fixes only, never a preview
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
    // (audit M31) the device credential + device hash ride along so the server can require them.
    const headers = { "content-type": "application/json", "user-agent": "aria-sentinel", "x-sentinel-device": deviceIdHash() };
    const keyHash = licenseKeyHash();
    if (keyHash) headers["x-sentinel-key"] = keyHash;
    const res = await outbound.fetch(RESOLUTION_EMAIL_ENDPOINT, {
      method: "POST",
      headers,
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
// JULY PORT 2026-10-14 (a7f9e111) — a browser issue outcome reported by the companion extension over the local bridge.
// The pure module keeps only symbolic data (issue id · signal · action · outcome · origin CATEGORY · severity); a URL,
// title, page text or credential never enters the ledger. A resolved / failed / live-help outcome also feeds the SAME
// real "was this fixed?" deflection ledger (resolved · not-yet · escalated) — real-or-empty, deduped per issue.
// The managed browser-protection policy evaluator the July line ran here (decision-only) is NOT ported (out of scope).
function recordBrowserOutcome(payload = {}) {
  const res = appendBrowserOutcome(browserOutcomesLog(), payload || {});
  if (!res.ok) return { ok: false, errors: res.errors, stats: resolutionStatsNow() };
  store.set("browserOutcomes", res.events);
  let proof = null;
  const resolutionPayload = browserOutcomeToResolutionPayload(res.record);
  if (resolutionPayload) proof = recordResolutionOutcome(resolutionPayload);
  if (!res.deduped) {
    logEvent("BROWSER", `Browser issue ${res.record.signal} marked ${res.record.outcome}.`, {
      signal: res.record.signal,
      outcome: res.record.outcome,
      action: res.record.action,
      originCategory: res.record.originCategory
    });
  }
  broadcastState();
  return {
    ok: true,
    deduped: res.deduped,
    record: res.record,
    proof,
    browserOutcomes: res.events.length,
    stats: resolutionStatsNow()
  };
}

// The content-blind fleet packet (handles + ISO times + counts), served LOCALLY over the bridge only — no outbound
// path is added; the 6-host telemetry allowlist does not grow.
function browserOutcomeFleetPacketNow() {
  return buildBrowserOutcomeFleetPacket(browserOutcomesLog(), {
    now: Date.now(),
    endpointSeed: "local-browser"
  });
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
    daysLeft: lic.daysLeft == null ? null : lic.daysLeft,
    trialDays: TRIAL_DAYS,
    trial: { state: trial.state, remainingMs: trial.remainingMs, endsAt: trial.endsAt, daysLeft: trial.daysLeft, durationMs: trial.durationMs, days: trial.days, badge: trialBadge(trial.remainingMs) },
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
  // (audit M9) a key pasted from an email in UPPER/mixed case is the same key: normalise before the shape gate.
  const key = String(payload.key || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(key)) return { ok: false, error: "invalid_key" };
  let r;
  try {
    r = await resolveLicenseOnline(key);
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
  // REVIEW P1-3 — the answer is stored verbatim (verdict + sig); what it unlocks is licenseStatus()'s decision (a signed
  // verdict for this device + key, or an unsigned one for ≤1 h in this run and never as admin).
  if (!VERDICT_STATUSES.includes(r.status)) return { ok: false, error: "server_error" };
  storeVerdict(key, r);
  if (r.status === "revoked") {
    logEvent("LICENSE", "License key entered but revoked by issuer — Personal tier.");
    broadcastState();
    return { ok: false, error: "revoked", status: gateStatus() };
  }
  if (!licenseStatus().licensed) {
    const error = r.status === "expired" ? "expired" : r.status === "past_due" ? "past_due" : "unverified";
    logEvent("LICENSE", `License key entered but not unlocked (${error.replace(/_/g, " ")}) — free tier.`);
    broadcastState();
    return { ok: false, error, status: gateStatus() };
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
function openPlanCheckout(tier, opts = {}) {
  // RUN 19 §5 — tier → Stripe Checkout URL. New canonical env names with the RUN 13 names as fallback.
  // PROD 2026-10-14 (F3 round 2) — `billing` ("monthly" | "yearly") picks the matching env URL when one exists and is
  // carried on the /plans fallback (&billing=yearly) so the web page lands on the same toggle the app showed.
  const yearly = opts && opts.billing === "yearly";
  const env = process.env;
  const pick = (...keys) => keys.map((k) => env[k]).find((v) => typeof v === "string" && /^https:\/\//.test(v)) || "";
  const map = {
    personal: yearly ? pick("STRIPE_PERSONAL_YEARLY_URL", "STRIPE_PERSONAL_MONTHLY_URL") : pick("STRIPE_PERSONAL_MONTHLY_URL", "STRIPE_PERSONAL_YEARLY_URL"),
    pro: yearly ? pick("STRIPE_PRO_YEARLY_URL", "STRIPE_PRO_MONTHLY_URL") : pick("STRIPE_PRO_MONTHLY_URL", "STRIPE_PRO_YEARLY_URL"),
    smb: yearly ? pick("STRIPE_SMALL_BUSINESS_YEARLY_URL", "STRIPE_SMB_URL", "STRIPE_SMALL_BUSINESS_MONTHLY_URL") : pick("STRIPE_SMALL_BUSINESS_MONTHLY_URL", "STRIPE_SMALL_BUSINESS_YEARLY_URL", "STRIPE_SMB_URL"),
    midsize: yearly ? pick("STRIPE_MIDSIZE_YEARLY_URL", "STRIPE_MIDSIZE_URL", "STRIPE_MIDSIZE_MONTHLY_URL") : pick("STRIPE_MIDSIZE_MONTHLY_URL", "STRIPE_MIDSIZE_YEARLY_URL", "STRIPE_MIDSIZE_URL"),
    enterprise: yearly ? pick("STRIPE_ENTERPRISE_YEARLY_URL", "STRIPE_ENTERPRISE_URL", "STRIPE_ENTERPRISE_MONTHLY_URL") : pick("STRIPE_ENTERPRISE_MONTHLY_URL", "STRIPE_ENTERPRISE_YEARLY_URL", "STRIPE_ENTERPRISE_URL")
  };
  // (audit M10) the fallback is a page that exists: /plans (the old /aria-sentinel/ was a 404).
  const safeTier = /^[a-z]{1,20}$/.test(String(tier)) ? String(tier) : "pro";
  const url = map[String(tier)] || `https://iisupp.net/plans/?from=app&tier=${safeTier}${yearly ? "&billing=yearly" : ""}`;
  try { shell.openExternal(url); return { ok: true, billing: yearly ? "yearly" : "monthly", source: map[String(tier)] ? "stripe" : "plans-page" }; } catch { return { ok: false }; }
}

// Legacy RUN 10 entry point retained for compatibility (starts the 30-day trial once; a second click is a no-op).
function startTrial(email) {
  const started = ensureTrialStarted(typeof email === "string" ? email : (email && email.email) || "");
  return { ok: true, started, status: gateStatus() };
}

async function checkForUpdates() {
  // D3 (2026-07-03) — OTA needs a real signed manifest at UPDATE_ENDPOINT (not wired yet). Rather than a dead,
  // alarming "Update check unavailable," report the HONEST state: no manifest reachable → manual-update mode
  // ("You're on <version> · manual updates for now"). A real manifest with a newer version still surfaces the
  // update. mode: "manual" | "ota" lets the renderer pick honest copy; ok stays true so it never reads as a failure.
  try {
    const res = await outbound.fetch(UPDATE_ENDPOINT, { headers: { "user-agent": "aria-sentinel" }, signal: AbortSignal.timeout?.(8000) });
    const latest = res && res.ok ? await res.json().catch(() => null) : null; // { version, downloadUrl } manifest
    if (!latest || !latest.version) return { ok: true, current: SENTINEL_VERSION, updateAvailable: false, mode: "manual" };
    return { ok: true, current: SENTINEL_VERSION, latest, updateAvailable: updateAvailable(SENTINEL_VERSION, latest), mode: "ota" };
  } catch {
    return { ok: true, current: SENTINEL_VERSION, updateAvailable: false, mode: "manual" };
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
    const feed = buildFeedRequest(readLicense()?.key || ""); // (audit M17) hash in a header, never the raw key in the URL
    autoUpdaterRef.setFeedURL({ provider: "generic", url: feed.url, requestHeaders: { "x-sentinel-device": deviceIdHash(), ...feed.requestHeaders } });
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
    const feed = buildFeedRequest(readLicense()?.key || "", "https://iisupp.net", `pin=${encodeURIComponent(version)}`);
    autoUpdaterRef.setFeedURL({ provider: "generic", url: feed.url, requestHeaders: { "x-sentinel-device": deviceIdHash(), ...feed.requestHeaders } });
    autoUpdaterRef.allowDowngrade = true; // (audit M24) a rollback IS a downgrade; electron-updater refuses them by default
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
  const url = process.env.CALENDLY_URL || "https://iisupp.net/aria"; // (audit M10) /contact was a 404; /aria is live
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
    await outbound.fetch(cfg.webhookUrl, {
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
  // KILL GATE 2026-10-14 (review P0-2) — a detection that arrives while ARIA is stopped (Ctrl+Alt+K / Stop ARIA) — from
  // the bridge's /detect, the 5-minute self-diagnosis or a chat — is recorded, and NOTHING acts on it: no fix, no
  // approval request, no advisory notice. (A pause / fleet kill is handled below exactly as before.)
  if (ariaStoppedNow()) {
    logEvent("KILL-SWITCH", `${advisoryRedact(recipeTitle(recipe.id))}: detected while ARIA is stopped — nothing runs and nothing is asked until you press Start ARIA.`, { recipeId: recipe.id });
    return;
  }
  // RUN-CU / CU4 — the autonomy level from the Setup wizard governs unattended fixes alongside the legacy mode.
  // REVIEW P1-1 (2026-10-14) — the owner's decision: Confirmed asks once, every time, and never executes unattended;
  // unattended execution exists ONLY in Autonomous mode (the advise-three-times rule, and the guarded auto-fire below).
  // So outside Autonomous: observe notes it, approve-first and Confirmed (safe-auto) turn the detection into ONE approval
  // request (one click on the globe card / Home row) — whatever its colour and however vetted the recipe is.
  const auto = autonomyNow();
  // ADVISORY ESCALATION (2026-10-14) — "Never for this": the person opted this recipe out of fixing on its own, so on
  // this device it behaves as approve-first (an approval request, never an unattended run).
  if (advisoryMachine.isNever(recipe.id)) { advisoryNeverDetection(recipe); return; }
  // ADVISORY ESCALATION — Autonomous mode + live fixes on: instead of firing now, the problem is ADVISED three times
  // first (a fix ARIA may make on its own → the auto-fix track; red / needs-admin / not-yet-vetted / needs-a-yes → the
  // IT-contact track). Everything the rule does not take falls through to the unchanged paths below.
  if (!autonomousPaused() && !agentBlocked() && considerAdvisory(recipe, context)) return;
  const autonomous = store.get("mode") === "autonomous";
  if (!autonomous || autonomousPaused() || agentBlocked()) {
    if (!agentBlocked() && !autonomousPaused() && auto.level !== "observe") {
      const reason = auto.level === "approve-first" ? "level-approve-first" : "confirmed-asks-once";
      approvals.request({ recipeId: recipe.id, title: recipe.title, color: recipeColor(recipe.id), tier: vettedTierOf(recipe.id), requestedBy: "watcher", reason, source: "detection" });
      ensureApprovalPolling();
    }
    return;
  }
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
  // The approval policy + the maintenance window (plan-maintenance-window.mjs, now wired) decide the disposition.
  const color = recipeColor(recipe.id);
  const win = maintenanceWindowNow(recipe.id);
  const verdict = decideExecution({ level: auto.level, color, tier: vettedTierOf(recipe.id), approverMode: auto.approverMode, inWindow: win.within, hasRestorePoint: false, killed: remediationKilled(), blocked: agentBlocked() });
  if (verdict.action !== "execute") {
    logEvent("AUTONOMOUS", `Auto-fix for ${recipe.signal} → ${verdict.action} (${verdict.reason}).`, { recipeId: recipe.id });
    if (verdict.action === "request-approval") { approvals.request({ recipeId: recipe.id, title: recipe.title, color, tier: vettedTierOf(recipe.id), requestedBy: "watcher", reason: verdict.reason, source: "detection" }); ensureApprovalPolling(); }
    return;
  }
  store.set("autoFireHistory", recordAutoFire(history, { recipeId: recipe.id }));
  const started = Date.now();
  // PROD 2026-10-14 (audit M18) — an auto-fire goes through the SAME supervised pipeline as every other fix
  // (R11 → supervisor → vetted-tier policy → approval policy → countdown → executor). source:"detection" keeps it
  // honest: unattended, so a not-yet-vetted (Tier-2) or admin-needing fix becomes an approval request, never a
  // silent change; the "Keep fixes in dry-run" checkbox and the live-fix consent apply here too.
  const result = await runSupervisedFix({ recipeId: recipe.id, mode: "confirmed", source: "detection", risk: recipe.risk || "medium", startedAt: started });
  if (result && result.verdict && result.verdict !== "approve" && result.verdict !== "approve-fast") {
    logEvent("AUTONOMOUS", `Auto-fix for ${recipe.signal} → ${result.verdict}${result.reason ? ` (${result.reason})` : ""}.`, { recipeId: recipe.id });
  }
  // The Slack/Teams webhook (if configured) fires from afterFixOutcome with the REAL outcome once the gated run
  // completes — never "applied" from here, where the countdown has not even finished (Rule 14).
  void endpoint;
}

/**
 * Vetted tier (0/1/2) of a recipe from the recipe-history ledger. The vendor floor for a vendor-vetted GREEN fix applies
 * ONLY on the Autonomous advisory track (REVIEW P1-1): `track` is VENDOR_FLOOR_TRACK there and undefined everywhere else.
 */
function vettedTierOf(recipeId, track) {
  try {
    const id = String(recipeId || "");
    // FAULT LAB 2026-10-14 (defect 4) — the same rule executionPolicy() applies (dry-run-policy.mjs vettedTier).
    return vettedTier(vettedCountOf(readRecipeHistory(), id), { color: recipeColor(id), vendorVetted: isVendorVetted(id), track });
  } catch { return 2; }
}

// RUN-CU / CU4 — after every execution outcome: failures notify immediately (always); successes notify per
// reportCadence (per-fix now, daily/weekly folded into the aggregate). Dry-runs are reported as previews.
function afterFixOutcome(recipeId, result, meta = {}) {
  try {
    const title = recipeTitle(recipeId);
    const dryRun = Boolean(result && result.dryRun);
    const failed = !result || result.ok === false;
    const rp = result && result.restorePoint;
    // ADVISORY ESCALATION — an auto-fix made after three unanswered notices reports its real outcome to its escalation.
    // FAULT LAB 2026-10-14 (defect 3) — a `not_resolved` auto-fix is ESCALATED there (the IT contact is told through the
    // existing advisoryEscalate path); that path then owns the notifications, so they are not sent twice from here.
    const escalated = advisoryFixOutcome(recipeId, result, meta) === "escalated";
    const notResolved = Boolean(result && result.outcome === NOT_RESOLVED);
    // (audit M18) a watcher-sourced auto-fix reports its REAL outcome to the Slack/Teams webhook from here (the
    // advisory auto-fix is watcher-sourced too: source "detection:advisory").
    if (/^detection(?::|$)/.test(String(meta.source || "")) && !dryRun && !escalated) {
      const recipe = recipeById(recipeId);
      sendAutoFixNotify({ recipeId, signal: (recipe && recipe.signal) || recipeId, outcome: failed ? "failed" : "applied", endpoint: os.hostname(), durationMs: Math.max(0, Date.now() - (Number(meta.startedAt) || Date.now())), tier: recipeColor(recipeId) === "green" ? "green" : "yellow" }).catch(() => undefined);
    }
    if (failed && !dryRun) {
      if (!escalated) notifyEvent("fix-failed", { title, recipeId, severity: recipeColor(recipeId), outcome: notResolved ? "not resolved" : "failed", rolledBack: Boolean(result && result.rolledBack) });
      return;
    }
    if (setupPrefsNow().reportCadence === "per-fix") {
      notifyEvent("fix-executed", { title, recipeId, severity: recipeColor(recipeId), outcome: dryRun ? "previewed" : "applied", dryRun, verified: result && result.verified, restorePoint: rp ? rp.created === true : undefined });
    }
    // daily/weekly cadences: the outcome is already in the audit log, which the aggregate report summarizes.
  } catch { /* reporting never affects the fix */ }
}

// ── ADVISORY ESCALATION (2026-10-14) — "advise three times, then act" (Autonomous mode only) ─────────────────────────
// src/shared/advisory-escalation.mjs keeps the clock and the promises (pure); this block performs its effects through the
// EXISTING paths and nothing else:
//   · notice n of 3 → desktopNotify + the globe card (sentinel:advisory) + the Home "What I need from you" row + an
//     "ADVISORY n/3" audit row, in plain words, with Fix now · Not now · Never for this;
//   · no answer after notice 3 + one interval → the autonomous guards (evaluateAutoFire) → an "AUTO-FIX after 3
//     advisories" audit row → runSupervisedFix (kill switch → R11 → supervisor → vetted-tier policy → approval policy →
//     needs-admin → the visible, cancellable 10-s countdown → executor → verify → audit) → afterFixOutcome (notify-after);
//   · red / needs-admin / not-yet-vetted / yellow (needs a yes) problems get the same notices but end with the IT contact
//     told (notifyEvent fix-failed + sendAutoFixNotify escalated) — never an execution;
//   · Ctrl+Alt+K blocks every open escalation for good; pause · fleet/customer kill · license · Stop ARIA · live fixes
//     off FREEZE them in place (the remaining time is kept; nothing skips ahead); leaving Autonomous closes them.
// Which track a detection takes is decided from the REAL gates (decideExecution · executionPolicy · the needs-admin rule ·
// the supervisor) so a notice never promises a fix the pipeline would refuse (Rule 14).
const ADVISORY_TICK_MS = 15 * 1000;
let advisoryTimer = null;
const advisoryMachine = createAdvisoryEscalation({
  now: () => Date.now(),
  load: () => store.get("advisoryEscalations") || null,
  save: (s) => store.set("advisoryEscalations", s)
});
/** { intervalMinutes, snoozeHours } — the person's advisory prefs (Settings → Autonomy), defaults filled in. */
function advisoryPrefsNow() { return normalizeAdvisoryPrefs(setupPrefsNow()); }
/** The rule applies only in Autonomous mode with live fixes on (otherwise every fix previews and nothing escalates). */
function advisoryApplies() { return store.get("mode") === "autonomous" && allowSystemFixes() && !globalDryRun(); }
/** Why open escalations must stand still right now ("" = they may advance). */
function advisoryFrozenReason() {
  if (remediationKilled()) return "fixes-disabled-by-policy";
  if (Number(store.get("pausedUntil") || 0) > Date.now()) return "paused";
  if (autonomousPaused()) return "autonomous-paused";
  if (store.get("ariaStopped")) return "aria-stopped";
  if (!allowSystemFixes()) return "live-fixes-off";
  try { if (!gateStatus().unlocked) return "license"; } catch { return "license"; }
  return "";
}
/** Does the recipe have a live step ARIA could apply at all (an executor binding or a cleared registry action)? */
function recipeHasLiveSteps(recipeId) {
  const id = String(recipeId || "");
  if (resolveExecutorId(id)) return true;
  if (!isExecutableRecipe(id)) return false;
  const r = recipeById(id);
  return Boolean(r && (r.actions || []).some((a) => a && a.shell === "powershell" && a.command));
}
/**
 * The track a detection takes under the rule, read from the REAL gates. null = the rule does not take it (the unchanged
 * paths decide: approval / maintenance window / observe / preview / guide-only).
 *   auto-fix     — green, user-space, vetted for unattended runs, supervisor-clean → notices, then the supervised fix
 *   tech-contact — red · needs administrator rights · not yet vetted for unattended runs · yellow (always needs a yes)
 */
function advisoryTrackFor(recipe) {
  const id = String((recipe && recipe.id) || "");
  if (!id || isBlockedPath(id)) return null;
  const auto = autonomyNow();
  const color = recipeColor(id);
  const win = maintenanceWindowNow(id);
  // A yellow fix is only ever promised conditionally: a REAL restore point is made at the last step, never at notice time.
  const decision = decideExecution({ level: auto.level, color, tier: vettedTierOf(id, VENDOR_FLOOR_TRACK), approverMode: auto.approverMode, inWindow: win.within, hasRestorePoint: color === "yellow", killed: remediationKilled(), blocked: agentBlocked() });
  if (decision.action === "notify-only" && decision.reason === "red-never-automated") return { track: "tech-contact", kind: "red", color };
  if (decision.action !== "execute") return null;
  if (!recipeHasLiveSteps(id)) return null; // guide-only: nothing ARIA could apply on its own
  if (recipeNeedsAdmin(id)) return { track: "tech-contact", kind: "needs-admin", color };
  // recipe-runner + autonomous.mjs: a yellow fix NEVER fires on its own — it always waits for a person's yes.
  if (color === "yellow" || !isGreenRecipe(id)) return { track: "tech-contact", kind: "needs-confirm", color };
  // FAULT LAB 2026-10-14 (defect 4) — a vendor-vetted green fix starts at the vendor floor (Tier 1), so on a fresh install
  // the third unanswered notice can end in the fix itself — still through every gate in runSupervisedFix.
  // (REVIEW P1-1: this track — and its final step, source "detection:advisory" — is the ONLY place the floor applies.)
  const policy = executionPolicy({ vettedCount: vettedCountOf(readRecipeHistory(), id), vendorVetted: isVendorVetted(id), color, track: VENDOR_FLOOR_TRACK, mode: "confirmed", dryRunCheckbox: store.get("keepSystemFixesDryRun"), supervisorVerdict: "approve", humanInitiated: false });
  if (policy.dryRun) return null; // "keep every fix in preview" → the preview path, unchanged
  if (!policy.allowed) return { track: "tech-contact", kind: "not-yet-vetted", color };
  if (!isRecipeAllowedByPolicy(store.get("policyOverlay") || null, id)) return null;
  const sup = superviseProposal({ recipeId: id, riskTier: (recipe && recipe.risk) || "medium", expectedImpact: recipeSideEffects(id), rollbackPlan: "restore-point" }, { mode: "confirmed", history: [], now: Date.now(), vettedCatalog: supervisedVettedCatalog() });
  if (sup.verdict === "veto") return null;
  return { track: "auto-fix", kind: "green", color };
}
/** autoFireIfEligible → true when the rule took this detection (the immediate auto-fire is then skipped). */
function considerAdvisory(recipe, context = {}) {
  if (!recipe || !advisoryApplies()) return false;
  const frozen = advisoryFrozenReason();
  if (frozen) {
    // A license / Stop-ARIA freeze: nothing unattended happens at all (no notice, no fix) until it clears.
    logEvent("ADVISORY", `Noted ${advisoryRedact(recipeTitle(recipe.id))} — not advising or fixing on its own while ${frozen}.`, { recipeId: recipe.id, frozen });
    return true;
  }
  const t = advisoryTrackFor(recipe);
  if (!t) return false;
  const r = advisoryMachine.open({
    detectionId: String(context.detectionId || ""),
    recipeId: recipe.id,
    title: advisoryRedact(String(context.advisoryTitle || recipeTitle(recipe.id))),
    summary: advisoryRedact(String(recipe.summary || "")),
    color: t.color,
    track: t.track,
    kind: t.kind
  }, advisoryPrefsNow());
  if (!r.opened) return r.reason !== "never" && r.reason !== "bad-recipe"; // an open / snoozed escalation already owns it
  performAdvisoryEffects(r.effects);
  ensureAdvisoryTimer();
  return true;
}
/** A Never-listed recipe detected again: approve-first on this device (red is never automated, so it is only noted). */
function advisoryNeverDetection(recipe) {
  const color = recipeColor(recipe.id);
  if (color !== "red" && !agentBlocked()) {
    approvals.request({ recipeId: recipe.id, title: recipe.title, color, tier: vettedTierOf(recipe.id), requestedBy: "watcher", reason: "never-for-this", source: "detection" });
    ensureApprovalPolling();
  }
  logEvent("ADVISORY", `${advisoryRedact(recipeTitle(recipe.id))}: you chose "Never for this" — ${color === "red" ? "noted only; nothing runs" : "asking for a yes instead of fixing it on its own"}.`, { recipeId: recipe.id });
}
/** Notice n of 3: audit row + desktop notification (when that channel is on) + the globe card + the Home row (state). */
function advisoryNotice(rec, n, { reissued = false } = {}) {
  const prefs = advisoryPrefsNow();
  const view = advisoryView(rec, prefs, Date.now());
  // (review P2-6) a notice re-issued after a restart is the SAME notice shown again — a real desktop notification + card.
  logEvent("ADVISORY", `ADVISORY ${n}/${rec.of}: ${rec.title} — ${view.copy.when}`, { recipeId: rec.recipeId, advisoryId: rec.id, advisory: n, of: rec.of, track: rec.track, kind: rec.kind, cycle: rec.cycle, ...(reissued ? { reissued: true } : {}) });
  if ((setupPrefsNow().notifyChannels || {}).desktop !== false) desktopNotify({ title: `${view.copy.line}: ${rec.title}`, body: `${view.copy.willDo} ${view.copy.when}` });
  pushAdvisoryCard(view);
}
function pushAdvisoryCard(view) {
  try {
    overlayActiveUntil = Date.now() + 8000;
    if (overlayWindow && !overlayWindow.isDestroyed()) { showOverlay({ expanded: true, advisory: true }); overlayWindow.webContents.send("sentinel:advisory", view); }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("sentinel:advisory", view);
  } catch { /* the card is best-effort; the state + the Home row carry the same notice */ }
}
/** The last step of the auto-fix track: the autonomous guards, then the supervised pipeline (countdown first). */
async function advisoryAutoFix(rec) {
  // KILL GATE 2026-10-14 (review P0-2) — the final step checks the gate FIRST: no AUTO-FIX row, no auto-fire history, no
  // countdown when it is closed. (A stop / pause freezes the escalation upstream; this is the line that holds if a tick
  // and a kill ever race.) Ctrl+Alt+K / Stop ARIA end it as blocked; a pause / fleet kill holds it for the next tick.
  if (!killGateOpen()) {
    const reason = killGateReason();
    if (ariaStoppedNow()) { advisoryMachine.settle(rec.id, "blocked", "kill-switch"); logEvent("KILL-SWITCH", `${rec.title}: the advise-first fix did not run — ${reason}. The escalation is closed (blocked).`, { recipeId: rec.recipeId, advisoryId: rec.id }); }
    else { advisoryMachine.defer(rec.id, Date.now() + ADVISORY_TICK_MS, "the gate to open"); logEvent("ADVISORY", `${rec.title}: ready to fix, but ${reason} — nothing runs until that clears.`, { recipeId: rec.recipeId, advisoryId: rec.id }); }
    broadcastState();
    return { ok: false, reason: "kill-gate", gate: reason };
  }
  const recipe = recipeById(rec.recipeId);
  if (!recipe) { advisoryMachine.settle(rec.id, "closed", "recipe-missing"); broadcastState(); return { ok: false, reason: "recipe-missing" }; }
  if (!advisoryApplies()) { advisoryMachine.settle(rec.id, "closed", "autonomous-off"); logEvent("ADVISORY", `${rec.title}: Autonomous mode or live fixes are off now — nothing runs on its own.`, { recipeId: rec.recipeId, advisoryId: rec.id }); broadcastState(); return { ok: false, reason: "autonomous-off" }; }
  const t = advisoryTrackFor(recipe);
  if (!t || t.track !== "auto-fix") {
    // The gates changed since notice 1 (vetting, a new organization rule, the window): ARIA may no longer fix it alone.
    advisoryMachine.settle(rec.id, "escalated", `gates-changed${t ? "-" + t.kind : ""}`);
    advisoryEscalate({ ...rec, kind: t ? t.kind : rec.kind }, "gates-changed");
    broadcastState();
    return { ok: false, reason: "gates-changed" };
  }
  // The same autonomous guards autoFireIfEligible applies: 3 per recipe per 24 h · 30 min between automatic fixes · fleet limit.
  const history = store.get("autoFireHistory") || [];
  const guard = evaluateAutoFire({ recipeId: rec.recipeId, tier: isGreenRecipe(rec.recipeId) ? "green" : "yellow", mode: "autonomous", now: Date.now(), history });
  if (!guard.allow) {
    if (guard.reason === "cooldown") {
      const lastAny = history.reduce((m, h) => Math.max(m, Number(h.ts) || 0), 0);
      const until = lastAny + AUTOFIRE_COOLDOWN_MS + 1000;
      advisoryMachine.defer(rec.id, until, "the 30-minute gap between automatic fixes");
      logEvent("ADVISORY", `Ready to fix ${rec.title} — waiting for the 30-minute gap between automatic fixes (until ${new Date(until).toISOString()}).`, { recipeId: rec.recipeId, advisoryId: rec.id });
      broadcastState();
      return { ok: false, reason: "cooldown", until };
    }
    advisoryMachine.settle(rec.id, "held", `autofire-${guard.reason}`);
    approvals.request({ recipeId: rec.recipeId, title: rec.title, color: rec.color, tier: vettedTierOf(rec.recipeId, VENDOR_FLOOR_TRACK), requestedBy: "advisory", reason: `advisory-${guard.reason}`, source: "advisory" });
    ensureApprovalPolling();
    logEvent("ADVISORY", `${rec.title}: not fixed on its own (${guard.reason}) — asked for a yes instead. Nothing was changed.`, { recipeId: rec.recipeId, advisoryId: rec.id });
    broadcastState();
    return { ok: false, reason: guard.reason };
  }
  store.set("autoFireHistory", recordAutoFire(history, { recipeId: rec.recipeId, ts: Date.now() }, Date.now()));
  advisoryMachine.markFixing(rec.id);
  logEvent("AUTO-FIX", `AUTO-FIX after ${rec.of} advisories: ${rec.title} — no answer, so ARIA is fixing it through the supervised pipeline (countdown first).`, { recipeId: rec.recipeId, advisoryId: rec.id, advisories: rec.advisory });
  const result = await runSupervisedFix({ recipeId: rec.recipeId, mode: "confirmed", source: "detection:advisory", risk: recipe.risk || "medium", startedAt: Date.now(), detectionId: rec.detectionId || undefined });
  advisoryFollowPipeline(rec, result);
  broadcastState();
  return result;
}
/** What the supervised pipeline said: a countdown is followed (cancel → the escalation ends); a refusal ends it honestly. */
function advisoryFollowPipeline(rec, result) {
  const r = result || {};
  if (r.countdown === true && r.countdownId) {
    const cd = countdownManager.list().find((c) => c && c.id === r.countdownId);
    if (cd && cd.signal && typeof cd.signal.addEventListener === "function") {
      cd.signal.addEventListener("abort", () => {
        const s = advisoryMachine.settle(rec.id, "cancelled", "countdown-cancelled");
        if (s.ok) { logEvent("ADVISORY", `${rec.title}: the countdown was cancelled — nothing was changed, and ARIA will not retry on its own.`, { recipeId: rec.recipeId, advisoryId: rec.id }); broadcastState(); }
      }, { once: true });
    }
    return; // completion arrives through afterFixOutcome → advisoryFixOutcome
  }
  if (r.verdict === "approve" || r.verdict === "approve-fast") return; // running now (no countdown); the result arrives the same way
  const verdict = String(r.verdict || r.error || "refused");
  const status = verdict === "blocked" ? "blocked" : "held";
  advisoryMachine.settle(rec.id, status, verdict === "approval-requested" ? "approval-requested" : verdict);
  logEvent("ADVISORY", `${rec.title}: not fixed on its own — ${advisoryRedact(String(r.copy || r.reason || verdict)).slice(0, 160)}`, { recipeId: rec.recipeId, advisoryId: rec.id, verdict });
}
/**
 * afterFixOutcome → the auto-fix's real outcome closes its escalation (fixed / fix-failed / preview-only), or — when the
 * fix ran but its gating verify says the problem is still there (`not_resolved`) — ESCALATES it to the IT contact.
 * Returns the status it settled ("escalated" means the escalation path owns the notifications), or undefined.
 */
function advisoryFixOutcome(recipeId, result, meta = {}) {
  try {
    if (!/^detection:advisory/.test(String(meta.source || ""))) return undefined;
    const rec = advisoryMachine.state.records.find((r) => r.recipeId === recipeId && r.status === "fixing");
    if (!rec) return undefined;
    // FAULT LAB 2026-10-14 (defect 3) — not resolved is never "fixed": the item goes to the IT contact (the EXISTING
    // escalation path: fix-failed notify incl. the IT contact + the webhook + an ESCALATE audit row). Nothing further runs.
    if (result && result.dryRun !== true && result.outcome === NOT_RESOLVED) {
      advisoryMachine.settle(rec.id, "escalated", NOT_RESOLVED);
      logEvent("ADVISORY", `${rec.title}: the fix ran after ${rec.of} notices, but the check afterwards says the problem is still there — NOT RESOLVED. Telling your IT contact; nothing further is changed.`, { recipeId, advisoryId: rec.id, status: "escalated", outcome: NOT_RESOLVED });
      advisoryEscalate(rec, "not-resolved");
      broadcastState();
      return "escalated";
    }
    const dryRun = Boolean(result && result.dryRun);
    const failed = !result || result.ok === false;
    const status = dryRun ? "held" : failed ? "fix-failed" : "fixed";
    const outcome = dryRun ? "preview-only" : failed ? String((result && (result.reason || result.outcome)) || "failed") : result.verified === false ? "applied-unverified" : result.verified === true ? "verified" : String(result.outcome || "applied");
    advisoryMachine.settle(rec.id, status, outcome);
    logEvent("ADVISORY", `${rec.title}: ${status === "fixed" ? `fixed on its own after ${rec.of} notices (${outcome})` : status === "held" ? "previewed only — nothing was changed" : `the fix did not complete (${outcome}) — nothing further was changed`}.`, { recipeId, advisoryId: rec.id, status, outcome });
    broadcastState();
    return status;
  } catch { return undefined; /* reporting never affects the fix */ }
}
/**
 * The IT-contact track's last step (or "Get help now" on a red notice, or a `not_resolved` auto-fix): the EXISTING notify
 * paths, never an execution. why ∈ unanswered · fix-now · gates-changed · not-resolved.
 */
function advisoryEscalate(rec, why = "unanswered") {
  const prefs = setupPrefsNow();
  const contacts = Array.isArray(prefs.techContacts) ? prefs.techContacts.length : 0;
  const notResolved = why === "not-resolved"; // FAULT LAB 2026-10-14 (defect 3) — the fix ran; its check says the problem is still there
  const reason = why === "fix-now" ? "you asked for help" : why === "gates-changed" ? "it can no longer be fixed on its own" : notResolved ? "the fix ran but the problem is still there (not resolved)" : `no answer after ${rec.of} notices`;
  notifyEvent("fix-failed", { title: rec.title, recipeId: rec.recipeId, severity: rec.color, outcome: why === "fix-now" ? "needs a person - help requested" : notResolved ? "needs a person - not resolved" : "needs a person - no answer" });
  sendAutoFixNotify({ recipeId: rec.recipeId, signal: (recipeById(rec.recipeId) || {}).signal || rec.recipeId, outcome: "escalated", endpoint: os.hostname(), durationMs: 0, tier: rec.color === "green" ? "green" : rec.color === "red" ? "red" : "yellow" }).catch(() => undefined);
  // A fix a person CAN approve (needs admin · not yet vetted · needs a yes) also waits as an approval; red never runs.
  // A not-resolved fix already ran: asking to run the same fix again would only repeat it, so no approval is raised.
  if (rec.kind !== "red" && rec.color !== "red" && !notResolved) {
    approvals.request({ recipeId: rec.recipeId, title: rec.title, color: rec.color, tier: vettedTierOf(rec.recipeId, VENDOR_FLOOR_TRACK), requestedBy: "advisory", reason: `advisory-${rec.kind}`, source: "advisory" });
    ensureApprovalPolling();
  }
  logEvent("ESCALATE", `ESCALATED to ${contacts ? "your IT contact" : "the device user (no IT contact configured)"} — ${reason}: ${rec.title}. ${notResolved ? "Nothing further was changed." : "Nothing was changed."}`, { recipeId: rec.recipeId, advisoryId: rec.id, kind: rec.kind, why });
}
/** "Fix now": the person chose — the SAME supervised pipeline, human-initiated (UAC when needed, countdown first). */
async function advisoryFixNow(rec) {
  logEvent("ADVISORY", `Fix now: ${rec.title} — you chose to fix it at notice ${rec.advisory}/${rec.of}; running it through the supervised pipeline.`, { recipeId: rec.recipeId, advisoryId: rec.id });
  const recipe = recipeById(rec.recipeId) || {};
  return runSupervisedFix({ recipeId: rec.recipeId, mode: "confirmed", source: "advisory-fix-now", risk: recipe.risk || "medium", startedAt: Date.now(), detectionId: rec.detectionId || undefined });
}
function performAdvisoryEffects(effects = []) {
  for (const e of Array.isArray(effects) ? effects : []) {
    const rec = advisoryMachine.find(e.id);
    if (!rec) continue;
    const meta = { recipeId: rec.recipeId, advisoryId: rec.id };
    try {
      if (e.type === "advise") advisoryNotice(rec, e.n, { reissued: e.reissued === true });
      else if (e.type === "auto-fix") advisoryAutoFix(rec).catch(() => undefined);
      else if (e.type === "escalate") advisoryEscalate(rec, e.why);
      else if (e.type === "snoozed") logEvent("ADVISORY", `Not now: ${rec.title} — snoozed until ${new Date(e.until).toISOString()}; nothing runs before then.`, meta);
      else if (e.type === "never") { logEvent("ADVISORY", `Never for this: ${rec.title} — ARIA will not fix this on its own on this device again; it asks for a yes instead (approve-first).`, meta); if (rec.color !== "red") { approvals.request({ recipeId: rec.recipeId, title: rec.title, color: rec.color, tier: vettedTierOf(rec.recipeId, VENDOR_FLOOR_TRACK), requestedBy: "advisory", reason: "never-for-this", source: "advisory" }); ensureApprovalPolling(); } }
      else if (e.type === "frozen") logEvent("ADVISORY", `Paused at notice ${rec.advisory}/${rec.of}: ${rec.title} (${e.reason}) — nothing advances until this clears.`, { ...meta, frozen: e.reason });
      else if (e.type === "unfrozen") logEvent("ADVISORY", `Resumed at notice ${rec.advisory}/${rec.of}: ${rec.title} — the remaining time was kept.`, meta);
      // REVIEW P2-6 — a restart never proceeds on its own: notice N is shown AGAIN at the next tick, the next step a full interval later.
      else if (e.type === "resumed") logEvent("ADVISORY", `Restarted at notice ${e.n}/${rec.of}: ${rec.title} — ARIA shows notice ${e.n} again (a desktop notification and the card) before anything else happens; the next step waits ${advisoryPrefsNow().intervalMinutes} min after it.`, { ...meta, resumed: true, was: e.was });
      // REVIEW P2-6 — the app died (crash / power / kill) while this fix was in its countdown or before it reported back:
      // that attempt is CANCELLED, never resumed. Whether any step had started is read from the audit itself.
      else if (e.type === "interrupted") {
        const since = Number(e.fixingSince) || 0;
        const started = since > 0 && (store.get("transparencyLog") || []).some((r) => r && r.recipeId === rec.recipeId && ["RUN", "FIX", "DONE", "ERROR", "WARN"].includes(r.tag) && Date.parse(r.ts) >= since);
        logEvent("CANCEL", started
          ? `${rec.title}: ARIA closed before this fix reported back (it had started — its rows are above). It is not resumed; notice ${e.n} of ${rec.of} is shown again first.`
          : `${rec.title}: ARIA closed during the countdown — the fix was cancelled and nothing ran. Notice ${e.n} of ${rec.of} is shown again before anything else happens.`, { ...meta, interrupted: true, started });
      }
      else if (e.type === "reopened") logEvent("ADVISORY", `Snooze over: ${rec.title} — telling you again (round ${e.cycle}).`, meta);
      else if (e.type === "closed") logEvent("ADVISORY", `Advisory closed: ${rec.title} (${e.reason}) — nothing runs on its own.`, meta);
    } catch { /* one effect never breaks the next */ }
  }
  if (effects && effects.length) broadcastState();
}
/** The ONE interval that drives the machine (15 s). Leaving Autonomous closes; a freeze holds; otherwise the clock runs. */
function advisoryTick() {
  const closeAll = store.get("mode") !== "autonomous" ? "autonomous-mode-off" : "";
  const frozen = closeAll ? "" : advisoryFrozenReason();
  const r = advisoryMachine.tick({ closeAll, frozen }, advisoryPrefsNow());
  performAdvisoryEffects(r.effects);
  return r;
}
function ensureAdvisoryTimer() {
  if (advisoryTimer) return;
  advisoryTimer = setInterval(() => { try { advisoryTick(); } catch { /* the tick never throws into the loop */ } }, ADVISORY_TICK_MS);
  advisoryTimer.unref?.();
}
/** At launch: resume persisted escalations CONSERVATIVELY (same notice number, a full interval before the next step). */
function startAdvisoryEscalation() {
  try { performAdvisoryEffects(advisoryMachine.restore(advisoryPrefsNow()).effects); } catch { /* never blocks startup */ }
  ensureAdvisoryTimer();
}
/** sentinel:advisory-ack {id, choice} — Fix now · Not now · Never for this. Any choice ends the escalation. */
async function handleAdvisoryAck(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const id = String(p.id || "").slice(0, 96);
  const choice = String(p.choice || "");
  if (!id || isBlockedPath(id) || !ADVISORY_CHOICES.includes(choice)) return { ok: false, error: "bad-request" };
  // KILL GATE (review P0-2) — "Fix now" while the gate is closed is refused BEFORE the notice is consumed (Not now and
  // Never never run anything, so they stay available).
  if (choice === "fix-now" && !killGateOpen()) return { ok: false, error: "kill-gate", gate: killGateReason(), copy: describeDecision({ action: "blocked", reason: killGateDecisionReason() }) };
  const r = advisoryMachine.ack(id, choice, advisoryPrefsNow());
  if (!r.ok) return { ok: false, error: r.reason };
  const rec = r.record;
  logEvent("ADVISORY", `You chose ${choice === "fix-now" ? (rec.kind === "red" ? "Get help now" : "Fix now") : choice === "not-now" ? "Not now" : "Never for this"} at notice ${rec.advisory}/${rec.of}: ${rec.title}.`, { recipeId: rec.recipeId, advisoryId: rec.id, choice });
  performAdvisoryEffects(r.effects.filter((e) => e.type !== "run-now"));
  let fix = null;
  if (r.effects.some((e) => e.type === "run-now")) fix = await advisoryFixNow(rec);
  broadcastState();
  return { ok: true, choice, advisory: advisoryView(advisoryMachine.find(id), advisoryPrefsNow(), Date.now()), fix };
}
/** sentinel:get-advisory-prefs — the interval/snooze, their limits, the rule in plain words and the Never list. */
function advisoryPrefsPayload() {
  return { ok: true, prefs: advisoryPrefsNow(), limits: { intervalMinutes: [ADVISORY_INTERVAL_MIN, ADVISORY_INTERVAL_MAX], snoozeHours: [ADVISORY_SNOOZE_MIN_H, ADVISORY_SNOOZE_MAX_H] }, rule: ruleSentence(setupPrefsNow()), never: advisoryMachine.neverList() };
}
/** sentinel:set-advisory-prefs { intervalMinutes?, snoozeHours?, allowAgain?: [recipeId] } — clamped, stored in the setup prefs. */
function setAdvisoryPrefs(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const partial = {};
  if ("intervalMinutes" in p) partial.advisoryIntervalMinutes = p.intervalMinutes;
  if ("snoozeHours" in p) partial.advisorySnoozeHours = p.snoozeHours;
  if (Object.keys(partial).length) store.set("setupConfig", updateSetupPrefs(readSetupConfig(), partial));
  const allowed = [];
  for (const rid of Array.isArray(p.allowAgain) ? p.allowAgain.slice(0, 50) : []) { if (advisoryMachine.clearNever(String(rid || "")).removed) allowed.push(String(rid)); }
  const now = advisoryPrefsNow();
  logEvent("SETUP", `Advise-first rule: a notice every ${now.intervalMinutes} min, Not now waits ${now.snoozeHours} h${allowed.length ? ` · allowed again: ${allowed.join(", ")}` : ""}.`);
  broadcastState();
  return advisoryPrefsPayload();
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
  overlayAdvisory = false;
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

/**
 * KILL GATE 2026-10-14 (review P0-2) — THE one gate between "a fix is wanted" and "a fix runs". "" = open; otherwise the
 * plain reason nothing may run. Closed by:
 *   · Ctrl+Alt+K / Stop ARIA (`ariaStopped`) — until the person presses Start ARIA (the ONLY way out: a relaunch, a mode
 *     change, a remote approval or the timeout policy never reopens it);
 *   · a fleet / customer kill (detect-only) — while it lasts;
 *   · a pause — until it ends.
 * It used to be that `ariaStopped` was set by the panic switch but read by no execution path, so a later detection, an
 * emailed approval, the approval timeout and a relaunch's watchers all still acted. Every execution entry now checks this
 * (runSupervisedFix · runRecipe · runTier0Fix · autoFireIfEligible · the approvals runner + its expiry · the advisory
 * escalation's final step · the bridge's /run-recipe · every fix-step spawn), and agentBlocked() IS this gate.
 */
function ariaStoppedNow() { try { return store.get("ariaStopped") === true; } catch { return true; } }
function killGateReason() {
  if (ariaStoppedNow()) return store.get("ariaKill") ? "ARIA was stopped with Ctrl+Alt+K — nothing runs until you press Start ARIA" : "ARIA is stopped — nothing runs until you press Start ARIA";
  if (remediationKilled()) return bridgeStatus.killReason || (customerConfig?.disabled === true ? "Customer policy disabled fixes." : "remediation disabled");
  if (Number(store.get("pausedUntil") || 0) > Date.now()) return "ARIA is paused on this device";
  return "";
}
function killGateOpen() { return killGateReason() === ""; }
function agentBlocked() {
  // True when watchers + recipe execution must stand down: stopped (Ctrl+Alt+K / Stop ARIA) · fleet/customer kill · paused.
  return !killGateOpen();
}
/** The decision-copy reason for a closed gate (approval-policy describeDecision). */
function killGateDecisionReason() { return ariaStoppedNow() ? "aria-stopped" : remediationKilled() ? "kill-switch" : "agent-blocked"; }

// PROD 2026-10-14 (audit M6) — persisted watcher cursors: the event-log RecordId / WER report-time the watchers
// last saw, so a relaunch continues from there instead of re-emitting a month of old errors as new detections.
const watcherCursors = {
  get: (key) => { try { return ((store.get("watcherCursors") || {})[String(key)]); } catch { return undefined; } },
  set: (key, value) => { try { store.set("watcherCursors", { ...(store.get("watcherCursors") || {}), [String(key)]: value }); } catch { /* best-effort */ } }
};
/** { running, count, lastTickAgeMs, names, spawnsPerMinute } — real-or-empty (no orchestrator → not running, 0 watchers). */
function watchersStatus() {
  try {
    if (!detectionOrchestrator) return { running: false, count: 0, lastTickAgeMs: null, names: [], spawnsPerMinute: 0 };
    const st = detectionOrchestrator.status();
    return { running: Boolean(st.running) && !store.get("ariaStopped"), count: Number(st.count) || 0, lastTickAgeMs: st.lastTickAgeMs == null ? null : Number(st.lastTickAgeMs), names: Array.isArray(st.names) ? st.names : [], spawnsPerMinute: Number(st.spawnsPerMinute) || 0 };
  } catch { return { running: false, count: 0, lastTickAgeMs: null, names: [], spawnsPerMinute: 0 }; }
}
/**
 * KILL GATE 2026-10-14 (review P0-2) — the launch-time watcher start. A relaunch used to call startDetection()
 * unconditionally, so after Ctrl+Alt+K + a reboot the watchers ran (and acted) while the status line said "stopped".
 * Returns true when the watchers were started; false (audited) when ARIA is still stopped.
 */
function startDetectionAtLaunch() {
  if (ariaStoppedNow()) {
    const kill = store.get("ariaKill") || null;
    logEvent("KILL-SWITCH", `Launch: ARIA is still stopped (${kill ? `Ctrl+Alt+K at ${String(kill.at || "").slice(0, 19)}` : "Stop ARIA"}) — watchers, fixes, approvals and notices stay off until you press Start ARIA.`, { launch: true, stopped: true });
    return false;
  }
  startDetection();
  return true;
}
function startDetection() {
  // (audit M11) Stop ARIA → Start ARIA: the orchestrator survives a stop with its timers cleared; restart them.
  if (detectionOrchestrator) {
    if (!detectionOrchestrator.status().running) detectionOrchestrator.startAll();
    return detectionOrchestrator;
  }
  detectionOrchestrator = createDetectionOrchestrator({
    detectIssue,
    isBlocked: agentBlocked,
    cursors: watcherCursors,
    watcherOptions: { network: (setupPrefsNow().networkProbe || {}) },
    logger: (tag, text) => logEvent(tag, text),
    onError: (name, err) => logEvent("SELF-REPAIR", `Watcher ${name} skipped a tick.`, { code: "APP.SENTINEL.ERROR" })
  });
  detectionOrchestrator.startAll();
  return detectionOrchestrator;
}

// ── JULY PORT 2026-10-14 (ddfcac5b) — the READ-ONLY .txt file-association guard ────────────────────────────
// Ported from cc/security-lockdown-2026-07-01 and re-wired to the production gates. What it does: on launch, every
// 60 s, on a manual scan and when Autonomous mode is switched on, read the Windows .txt association with positional
// `reg query` calls (never `reg add` / `reg delete` / Set-ItemProperty — asserted by the suite), classify it in the
// pure module, and surface a NORMAL detection (addDetection → globe card → the same supervised pipeline as every other
// recipe). The two recipes are MANUAL/guide recipes, so the executor can never "apply" them; the only action ARIA
// offers is opening Windows Default Apps for the person to pick Notepad themselves (openDefaultAppsForTextFiles —
// user-initiated, audit-logged, nothing written). 🔒 Registry-derived strings pass the excluded-folder guard in the
// module; a redaction is logged here as a SECURITY audit row. Windows only; anywhere else the scan is a no-op.
function runRegQuery(args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !Array.isArray(args) || args.length === 0) return resolve("");
    let out = "";
    let child;
    try {
      child = spawn("reg", args, { windowsHide: true, timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return resolve("");
    }
    childProcesses.add(child); // tracked so Ctrl+Alt+K ends it like every other child
    child.stdout?.on("data", (d) => { if (out.length < 64000) out += d.toString(); });
    child.on("error", () => { childProcesses.delete(child); resolve(""); });
    child.on("close", () => { childProcesses.delete(child); resolve(out); });
  });
}

function safeProgIdForRegPath(progId) {
  const text = String(progId || "").trim();
  return /^[A-Za-z0-9_.!{}-]{1,180}$/.test(text) ? text : "";
}

async function readClassValues(progId, subkey) {
  const safeProgId = safeProgIdForRegPath(progId);
  if (!safeProgId) return {};
  const suffix = subkey ? `\\${subkey}` : "";
  for (const root of ["HKCU\\Software\\Classes", "HKCR"]) {
    const values = parseRegQueryValues(await runRegQuery(["query", `${root}\\${safeProgId}${suffix}`]));
    if (Object.keys(values).length) return values;
  }
  return {};
}

async function readTextAssociationSnapshot() {
  if (process.platform !== "win32") {
    return { extension: ".txt", source: "unsupported-platform" };
  }
  const userChoice = parseRegQueryValues(await runRegQuery([
    "query",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.txt\\UserChoice",
    "/v",
    "ProgId"
  ]));
  const openWithList = parseRegQueryValues(await runRegQuery([
    "query",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.txt\\OpenWithList"
  ]));
  const openWithExecutables = Object.entries(openWithList)
    .filter(([key]) => /^[a-z]$/i.test(key))
    .map(([, value]) => value)
    .filter(Boolean);
  const association = parseRegQueryValues(await runRegQuery(["query", "HKCR\\.txt"]));
  const userChoiceProgId = userChoice.ProgId || "";
  const appValues = await readClassValues(userChoiceProgId, "Application");
  const commandValues = await readClassValues(userChoiceProgId, "Shell\\open\\command");
  return {
    extension: ".txt",
    source: "windows-registry-readonly",
    userChoiceProgId,
    userChoiceApplicationName: appValues.ApplicationName || "",
    userChoiceCommand: commandValues["(Default)"] || "",
    associationProgId: association["(Default)"] || "",
    openWithExecutables
  };
}

async function scanFileAssociationGuard(reason = "interval") {
  if (process.platform !== "win32") {
    const status = { ...buildAssociationGuardStatus(null), status: "unsupported", summary: "The text-file association guard runs on Windows only.", reason };
    store.set("fileAssociationGuard", status);
    return { ok: true, status, issue: null, unsupported: true };
  }
  const snapshot = await readTextAssociationSnapshot();
  const classification = classifyTextAssociation(snapshot);
  if (classification.snapshot && classification.snapshot.r11Redacted) {
    logEvent("SECURITY", "File association guard redacted a registry value that referenced an excluded folder.", r11AuditEntry("file-association-guard"));
  }
  const status = buildAssociationGuardStatus(classification);
  store.set("fileAssociationGuard", { ...status, reason });

  if (!classification.issue) {
    if (store.get("fileAssociationLastIssueKey")) store.set("fileAssociationLastIssueKey", "");
    broadcastState();
    return { ok: true, status, issue: null };
  }

  const issue = classification.issue;
  const lastKey = String(store.get("fileAssociationLastIssueKey") || "");
  if (issue.key !== lastKey || reason === "mode-autonomous" || reason === "manual") {
    const recipe = recipeById(issue.recipeId);
    if (recipe) {
      addDetection(recipe, {
        source: "desktop-scan",
        signal: issue.signal,
        issue: issue.summary,
        signature: { code: issue.signal, family: issue.family, confidence: issue.confidence, source: "desktop" }
      });
      logEvent("WATCH", `File association guard surfaced ${issue.signal} (${reason}).`, { recipeId: recipe.id });
    }
    store.set("fileAssociationLastIssueKey", issue.key);
  } else {
    broadcastState();
  }
  return { ok: true, status, issue };
}

function startFileAssociationGuard() {
  if (fileAssociationGuardTimer || process.platform !== "win32") return;
  scanFileAssociationGuard("startup").catch((error) => handleSelfError(error, "association-guard-startup"));
  fileAssociationGuardTimer = setInterval(() => {
    if (agentBlocked()) return; // paused / stopped ARIA does not scan
    scanFileAssociationGuard("interval").catch(() => undefined);
  }, FILE_ASSOCIATION_GUARD_INTERVAL_MS);
  fileAssociationGuardTimer.unref?.();
}

// The ONLY "fix" the guard offers: open Windows Default Apps (ms-settings:defaultapps) so the PERSON selects Notepad.
// User-initiated (a click on the globe card / fix card), audit-logged, nothing written by ARIA, re-scan afterwards.
// Refused while the kill switch / a pause is active so the guard behaves like every other remediation surface.
async function openDefaultAppsForTextFiles(recipeId) {
  const id = String(recipeId || "");
  if (![TEXT_ASSOCIATION_PRIMARY_RECIPE_ID, TEXT_ASSOCIATION_RISK_RECIPE_ID].includes(id)) return { ok: false, error: "recipe_not_found" };
  const recipe = recipeById(id);
  if (!recipe) return { ok: false, error: "recipe_not_found" };
  if (remediationKilled() || agentBlocked()) {
    return { ok: false, opened: false, recipe: publicRecipe(recipe), message: "ARIA is paused or stopped — open Windows Settings > Apps > Default apps yourself and choose Notepad for .txt files." };
  }
  if (process.platform !== "win32") {
    return { ok: false, opened: false, recipe: publicRecipe(recipe), message: "Default-app settings can only be opened on Windows." };
  }
  try {
    await shell.openExternal("ms-settings:defaultapps");
    logEvent("GUIDE", "Opened Windows Default Apps so the person can choose Notepad for .txt files (nothing changed by ARIA).", { recipeId: id });
    setTimeout(() => { scanFileAssociationGuard("post-fix-opened").catch(() => undefined); }, 45000).unref?.();
    return { ok: true, opened: true, recipe: publicRecipe(recipe), message: "Opened Windows Default Apps. Choose Notepad for .txt files — ARIA re-checks in a minute and nothing was changed by ARIA." };
  } catch {
    return { ok: false, opened: false, recipe: publicRecipe(recipe), message: "Windows Default Apps could not be opened automatically. Open Windows Settings > Apps > Default apps and choose Notepad for .txt files." };
  }
}

// ── JULY PORT 2026-10-14 (af5e03ab · 24a33108) — the Office File Safety Net ──────────────────────────────────
// Local rescue backups for recently changed Word/Excel/PowerPoint files (every 2 min) proven by opening a RENAMED
// copy (every 3 min) — never the live file, never Office, never a macro, never a byte off the device. OPT-IN on the
// production line (store.officeSafety.enabled, default false; Integrations → Office Safety Net); July started it at
// launch for everyone. The public status is path-blind (counts + timestamps). 🔒 The excluded-folder guard is applied
// inside the service to every root / directory / file; the watch roots are also filtered here so the audit row can say so.
function appPathSafe(name) {
  try { return app.getPath(name); } catch { return ""; }
}

function officeSafetyConfigNow() {
  const saved = store.get("officeSafety") || {};
  const userData = appPathSafe("userData") || path.join(os.homedir(), ".aria-sentinel");
  const defaultRoots = [
    appPathSafe("documents"),
    appPathSafe("desktop"),
    process.env.ONEDRIVE,
    process.env.OneDrive,
    process.env.OneDriveCommercial,
    process.env.OneDriveConsumer
  ].filter(Boolean);
  const wanted = Array.isArray(saved.watchRoots) && saved.watchRoots.length ? saved.watchRoots : defaultRoots;
  const watchRoots = wanted.filter((root) => !isBlockedPath(root));
  if (watchRoots.length !== wanted.length && !officeSafetyRootsWarned) {
    officeSafetyRootsWarned = true; // one audit row per process, not one per re-check
    logEvent("SECURITY", "Office Safety Net skipped a watch root inside an excluded folder.", r11AuditEntry("office-safety-roots"));
  }
  return {
    ...saved,
    enabled: saved.enabled === true, // opt-in: only an explicit true runs the scanner
    backupRoot: saved.backupRoot || path.join(userData, "RescueBackups"),
    watchRoots
  };
}

function officeSafetyStatus() {
  if (officeSafetyService) return officeSafetyService.status();
  const cfg = store.get("officeSafety") || {};
  return {
    ok: true,
    enabled: cfg.enabled === true,
    running: false,
    excludedFolderSkips: 0,
    backupIntervalMs: 2 * 60 * 1000,
    validationIntervalMs: 3 * 60 * 1000,
    scanIntervalMs: 30 * 1000,
    activeWindowMs: 24 * 60 * 60 * 1000,
    watchRootsCount: 0,
    backupVault: "local-user-vault",
    backupRootConfigured: false,
    filesTracked: 0,
    backupsCreated: 0,
    validationsPassed: 0,
    validationFailures: 0,
    lastScanAt: null,
    lastBackupAt: null,
    lastValidationAt: null,
    lastError: "",
    documents: [],
    recentEvents: [],
    safeContract: {
      localOnly: true,
      cloudUpload: false,
      validatesLiveFile: false,
      validationUsesRenamedCopy: true,
      launchesOffice: false,
      macrosRun: false
    }
  };
}

function ensureOfficeSafetyService() {
  if (!officeSafetyService) {
    officeSafetyService = createOfficeSafetyService({
      fs,
      path,
      os,
      config: officeSafetyConfigNow(),
      log: (tag, message) => logEvent(tag, message),
      onChange: () => broadcastState()
    });
  }
  return officeSafetyService;
}

function startOfficeSafety() {
  const cfg = officeSafetyConfigNow();
  if (!cfg.enabled) return { ok: true, status: officeSafetyStatus(), skipped: "opt-in" }; // nothing scans unasked
  const result = ensureOfficeSafetyService().start(cfg);
  logEvent("OFFICE-SAFETY", result.ok ? "Office Safety Net started (local vault, renamed-copy validation)." : "Office Safety Net did not start cleanly.");
  broadcastState();
  return result;
}

function setOfficeSafetyEnabled(on) {
  const next = { ...(store.get("officeSafety") || {}), enabled: on === true || (on && typeof on === "object" && on.enabled === true) };
  store.set("officeSafety", next);
  const result = ensureOfficeSafetyService().configure(officeSafetyConfigNow());
  logEvent("OFFICE-SAFETY", `Office Safety Net ${next.enabled ? "enabled by the person at the device" : "disabled"}.`);
  broadcastState();
  return result;
}

function scanOfficeSafety() {
  if ((store.get("officeSafety") || {}).enabled !== true) {
    return { ok: false, error: "office-safety-off", status: officeSafetyStatus(), copy: "Office Safety Net is off. Turn it on to scan and back up recently changed Office files." };
  }
  const service = ensureOfficeSafetyService();
  if (!service.status().running) service.start(officeSafetyConfigNow());
  const result = service.scanNow();
  broadcastState();
  return result;
}

function registerOfficeSafetyFile(filePath) {
  if (typeof filePath !== "string" || !filePath.trim() || filePath.length > 2048) {
    return { ok: false, error: "invalid-file-path", status: officeSafetyStatus() };
  }
  if (isBlockedPath(filePath)) { // 🔒 never read, never copied, surfaced as the usual count
    logEvent("SECURITY", "Office Safety Net refused a file inside an excluded folder.", r11AuditEntry("office-safety-register"));
    return { ok: false, error: "excluded-folder", surface: "1 personal folder excluded", status: officeSafetyStatus() };
  }
  if ((store.get("officeSafety") || {}).enabled !== true) {
    return { ok: false, error: "office-safety-off", status: officeSafetyStatus() };
  }
  const service = ensureOfficeSafetyService();
  const result = service.registerFile(filePath);
  broadcastState();
  return result;
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
    // (review P0-2) a stopped ARIA (Ctrl+Alt+K / Stop ARIA) takes no process snapshots either.
    const poll = () => { if (ariaStoppedNow()) return; processDetector.tick().then((snap) => pushProcessHealth(snap)).catch(() => undefined); };
    poll();
    setInterval(poll, processDetector.cadenceMs).unref?.();
  } catch { /* the detector is best-effort and must never block startup */ }
}

// The supervisor's signed catalog = Tier-0 safe-generic ∪ green/yellow executable recipes.
function supervisedVettedCatalog() {
  // PROD 2026-10-14 (audit M23) — the canonical executor ids (restart-audio, flush-dns-cache, …) are vetted too; a
  // voice/chat offer that resolves to one of them used to be vetoed as "not in the signed catalog".
  return new Set([...TIER0_RECIPES.map((r) => r.id), ...TIER0_EXECUTOR_IDS, ...EXECUTABLE_RECIPES, ...YELLOW_RECIPES]);
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

function startActionCountdown({ recipeId, risk, title, onComplete }) {
  // PROD 2026-10-14 — one tick payload for every surface (renderer contract): { id, secondsLeft, recipeId, title,
  // canCancel } plus the legacy fields (remaining, risk, chat) so the action-indicator keeps rendering unchanged.
  const id = randomUUID();
  const label = title || recipeTitle(recipeId);
  const info = (remaining) => ({ id, secondsLeft: remaining, recipeId, title: label, canCancel: true, remaining, risk, chat: countdownChatLine(recipeId, remaining) });
  createActionIndicatorWindow(info(COUNTDOWN_SECONDS));
  const c = createCountdown({
    seconds: COUNTDOWN_SECONDS,
    recipeId,
    onTick: (remaining) => {
      const payload = info(remaining);
      updateActionIndicator(payload);
      for (const win of BrowserWindow.getAllWindows()) {
        if (win === actionIndicatorWindow || win.isDestroyed() || win.webContents.isDestroyed()) continue;
        try { win.webContents.send("sentinel:countdown-tick", payload); } catch { /* a window mid-teardown is harmless */ }
      }
    },
    onComplete: () => { countdownManager.remove(c); closeActionIndicator(); try { if (onComplete) onComplete(); } catch { /* execution guarded by runRecipe */ } },
    onAbort: () => { countdownManager.remove(c); closeActionIndicator(); logEvent("CANCEL", `Action countdown aborted: ${recipeId}.`, { recipeId }); }
  });
  c.id = id;
  c.title = label;
  countdownManager.register(c);
  c.start();
  return c;
}
/** Cancel one countdown by id (or every pending one when no id is given). Returns how many were aborted. */
function cancelCountdown(id) {
  const key = String(id || "");
  let n = 0;
  if (key) {
    for (const c of countdownManager.list()) {
      if (c && c.id === key && c.isPending()) { c.abort(); countdownManager.remove(c); n += 1; }
    }
  } else n = countdownManager.abortAll();
  if (n) closeActionIndicator();
  return { ok: true, aborted: n, id: key || null };
}

/**
 * RUN 23 — the supervised-fix entry point (window.sentinelBridge.runRecipe → "sentinel:supervised-fix").
 * R11 → supervisor critic → vetted-tier dry-run policy → 10s countdown → the EXISTING (dry-run-gated)
 * executor. Nothing executes live by default: a fresh machine has 0 vetted runs (Tier-2, dry-run ON), so the
 * countdown completes into a dry-run. Low-risk action sentinels bypass the gate entirely.
 */
async function runSupervisedFix(payload = {}) {
  // RUN-CU / CU4 (audit P0 #1) — LINE 1: a fleet/customer kill or a paused agent refuses to apply ANY change on
  // this path too (it used to be checked only by the autonomous path). Detection + guidance keep working.
  // KILL GATE 2026-10-14 (review P0-2) — and Ctrl+Alt+K / Stop ARIA: agentBlocked() IS the one gate now (killGateReason).
  if (remediationKilled() || agentBlocked()) {
    const reason = killGateReason();
    logEvent("KILL-SWITCH", `Supervised fix ${String(payload.recipeId || "(none)")} blocked: ${reason}.`, { recipeId: String(payload.recipeId || ""), source: String(payload.source || "app").slice(0, 40) });
    return { ...blockedRecipeResult(reason), verdict: "blocked", countdown: false, copy: describeDecision({ action: "blocked", reason: killGateDecisionReason() }) };
  }
  const recipeId = String(payload.recipeId || "");
  const pname = String(payload.processName || "");
  // 🔒 R11 — refuse anything referencing the off-limits folder up front.
  if (isBlockedPath(recipeId) || isBlockedPath(pname)) {
    logEvent("SECURITY", "Supervised fix blocked by R11 (private folder).", r11AuditEntry("supervised-fix"));
    return { ok: false, error: "r11_blocked", surface: "1 personal folder excluded", copy: "This fix touches an excluded folder, so ARIA will not run it." };
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
  if (verdict.verdict === "veto") { writeRecipeHistory(recordOutcome(history, recipeId, "veto")); return { ok: false, verdict: "veto", reason: verdict.reason, copy: `The safety supervisor stopped this fix: ${verdict.reason}` }; }

  // WHO asked decides what a fresh (Tier-2) recipe may do (audit M1): a person at the device or an approval
  // may run it in Confirmed; an unattended source (watcher / deep-link / bridge) may not.
  const source = String(payload.source || "app");
  const humanInitiated = !/^(detection|deep-link|bridge)/.test(source) && payload.approved !== true;
  const approvedRecord = payload.approved === true && payload.approvalId ? approvals.byId(String(payload.approvalId)) : null;
  const approved = Boolean(approvedRecord && approvedRecord.status === "approved" && approvedRecord.recipeId === recipeId);
  // FAULT LAB 2026-10-14 (defect 4) — the vendor floor applies to a GREEN fix only; a fix the supervisor flagged high-risk
  // (needsConfirm → treated as yellow below) never takes it.
  const policyColor = verdict.supervisorEvidence && verdict.supervisorEvidence.needsConfirm ? "yellow" : recipeColor(recipeId);
  // REVIEW P1-1 — the vendor floor is the Autonomous advisory track's alone: only its final step (source
  // "detection:advisory") names VENDOR_FLOOR_TRACK; every other caller is judged on the local count (Confirmed never
  // executes unattended — it asks once, so a person's click or approval is what allows a fresh Tier-2 fix here).
  const policy = executionPolicy({ vettedCount: vettedCountOf(history, recipeId), vendorVetted: isVendorVetted(recipeId), color: policyColor, track: source === "detection:advisory" ? VENDOR_FLOOR_TRACK : undefined, mode, dryRunCheckbox: store.get("keepSystemFixesDryRun"), supervisorVerdict: verdict.verdict, humanInitiated, approved });
  // The consent gate folds into the policy's dry-run so the renderer sees ONE truth: policy.dryRun === false
  // means "this will change the device". Without live fixes on, a human run is an honest preview.
  if (!policy.dryRun && globalDryRun()) { policy.dryRun = true; policy.execute = false; policy.heldBy = "live-fixes-off"; policy.copy = liveFixesStatus().enabled ? "Preview only — the global dry-run safety is on for this device." : "Preview only — live fixes are off. Turn them on in Settings → Fixes to apply this for real."; }

  // ── RUN-CU / CU4 (audit P1 #6) — the policy's outputs are ENFORCED, not just read ────────────────────────
  if (!policy.allowed) {
    logEvent("POLICY", `Fix ${recipeId} held by execution policy: ${policy.reason}`, { recipeId });
    return { ok: false, verdict: "policy", reason: policy.reason, policy, countdown: false, copy: policy.copy };
  }
  const overlay = store.get("policyOverlay") || null;
  if (!isRecipeAllowedByPolicy(overlay, recipeId)) {
    logEvent("POLICY", `Fix ${recipeId} disabled by customer policy overlay.`, { recipeId });
    const reason = "This fix is disabled by your organization's policy.";
    return { ok: false, verdict: "policy", reason, policy, countdown: false, copy: reason };
  }
  const needsConfirm = Boolean(verdict.supervisorEvidence && verdict.supervisorEvidence.needsConfirm); // high-risk in Autonomous
  const hours = businessHoursOpen(overlay, new Date());

  // ── RUN-CU / CU4 — the approval policy decides execute / ask / notify-only / defer ────────────────────────
  const title = recipeTitle(recipeId);
  let color = recipeColor(recipeId);
  if (needsConfirm && color === "green") color = "yellow"; // the supervisor flagged it high-risk: treat as yellow
  const auto = autonomyNow();
  let decision;
  if (approved) {
    decision = { action: "execute", reason: `approved-by-${approvedRecord.decidedBy || "person"}`, requiresRestorePoint: color === "yellow", notifyBefore: false, notifyAfter: true, level: auto.level, color };
  } else if (source === "deep-link") {
    // (audit P1 §8 / fix i) — a browser link NEVER executes instantly: it creates an approval the person clicks.
    decision = { action: "request-approval", reason: "deep-link-requires-approval", requiresRestorePoint: color === "yellow", notifyBefore: true, notifyAfter: false, level: auto.level, color };
  } else if (!hours.open) {
    decision = { action: "request-approval", reason: "outside-business-hours", requiresRestorePoint: color === "yellow", notifyBefore: true, notifyAfter: false, level: auto.level, color };
  } else {
    let hasRestorePoint = false;
    if (color === "yellow" && auto.level === "full-auto") {
      const win = maintenanceWindowNow(recipeId);
      if (win.within) { const rp = await recordRestorePoint(recipeId, `ARIA pre-fix ${title}`); hasRestorePoint = Boolean(rp && rp.created === true); }
      decision = decideExecution({ level: auto.level, color, tier: policy.tier, approverMode: auto.approverMode, inWindow: win.within, hasRestorePoint, killed: remediationKilled(), blocked: agentBlocked() });
      if (decision.action === "defer-window" && !win.windowConfigured) decision = { ...decision, action: "request-approval", reason: "no-maintenance-window" };
      if (decision.action === "defer-window") decision = { ...decision, nextWindowStart: win.nextWindowStart ? win.nextWindowStart.toISOString() : null };
    } else {
      decision = decideExecution({ level: auto.level, color, tier: policy.tier, approverMode: auto.approverMode, inWindow: maintenanceWindowNow(recipeId).within, hasRestorePoint: false, killed: remediationKilled(), blocked: agentBlocked() });
    }
    // A person who clicked "Resolve it for me" on their OWN device (approver = self) IS the approver: the visible,
    // abortable 10s countdown is that approval — exactly today's consent model. Admin/either approver modes
    // still route to an approval request so the named approver decides.
    // REVIEW P1-1 — in Confirmed that click IS the "once" in "asks once": the fix runs with the person present. A red
    // problem is never self-approved: it needs a person — said plainly, nothing changed (as in every other mode).
    if (decision.action === "request-approval" && decision.reason === "confirmed-asks-once" && color === "red" && humanInitiated) {
      decision = { ...decision, action: "notify-only", reason: "red-never-automated" };
    }
    if (decision.action === "request-approval" && humanInitiated && auto.approverMode === "self" && decision.reason !== "restore-point-unavailable" && color !== "red") {
      // REVIEW P1-1 — when Confirmed already asked about this fix (one pending approval for this recipe), this click IS
      // the yes to THAT ask: it is approved (audited, the approval replaces the countdown) — one record, one run, never
      // a second run later from the same ask. With no ask open, the visible countdown is the yes (as before).
      const open = approvals.pending().find((a) => a && a.recipeId === recipeId);
      if (open) {
        const r = await approvals.approve(open.id, { decidedBy: "self", channel: String(source || "app").slice(0, 20) });
        if (!r.ok) return { ok: false, verdict: r.reason === "kill-gate" ? "blocked" : "approval-failed", reason: r.gate || r.reason, approvalId: open.id, countdown: false, copy: r.reason === "kill-gate" ? describeDecision({ action: "blocked", reason: killGateDecisionReason() }) : "That approval could not be applied — nothing was changed." };
        return { ...(r.result || {}), approvedPending: true, approvalId: open.id };
      }
      decision = { ...decision, action: "execute", reason: `${decision.reason}:self-approved-by-countdown`, notifyAfter: true, forceCountdown: true };
    }
  }
  // ── PROD 2026-10-14 (audit M3) — honest elevation. A fix whose command needs administrator rights can only run
  // through a UAC prompt the person at the device answers (Confirmed / Approve-first / Manual, human-started or
  // human-approved, never red). An UNATTENDED run of such a fix (watcher-sourced full-auto) is turned into an
  // approval request and says so: unattended elevated fixes need the admin runner, which is not registered.
  const needsAdmin = !policy.dryRun && recipeNeedsAdmin(recipeId);
  const elevation = liveFixesStatus().elevation;
  if (needsAdmin) {
    const attended = humanInitiated || approved;
    if (decision.action === "execute" && (!attended || elevation !== "uac" || color === "red")) {
      const reason = elevation !== "uac" ? "needs-admin-unavailable" : "needs-admin-unattended";
      decision = { ...decision, action: "request-approval", reason, needsAdmin: true, elevation, notifyBefore: true };
    } else if (decision.action === "execute") {
      decision = { ...decision, needsAdmin: true, elevation };
    }
  }
  const copy = describeDecision(decision);
  if (decision.action === "blocked") {
    logEvent("KILL-SWITCH", `Fix ${recipeId} blocked (${decision.reason}).`, { recipeId });
    return { ok: false, verdict: "blocked", reason: decision.reason, decision, policy, countdown: false, copy };
  }
  if (decision.action === "notify-only") {
    logEvent("AUTONOMY", `Fix ${recipeId} not run — ${decision.reason} (${auto.level}). Nothing was changed.`, { recipeId });
    notifyEvent("issue-detected", { title, recipeId, severity: color });
    return { ok: false, verdict: "notify-only", reason: decision.reason, decision, policy, countdown: false, copy, level: auto.level };
  }
  if (decision.action === "request-approval") {
    const apr = approvals.request({ recipeId, title, color, tier: policy.tier, detectionId: payload.detectionId, requestedBy: humanInitiated ? "user" : source, reason: decision.reason, source });
    ensureApprovalPolling();
    return { ok: true, verdict: "approval-requested", approvalId: apr.id, reused: Boolean(apr.reused), expiresAt: apr.expiresAt, decision, policy, countdown: false, copy, level: auto.level };
  }
  if (decision.action === "defer-window") {
    const queued = { recipeId, title, color, queuedAt: new Date().toISOString(), nextWindowStart: decision.nextWindowStart || null };
    store.set("deferredFixes", [queued, ...(store.get("deferredFixes") || []).filter((d) => d.recipeId !== recipeId)].slice(0, 50));
    logEvent("AUTONOMY", `Fix ${recipeId} queued to the next maintenance window${queued.nextWindowStart ? ` (${queued.nextWindowStart})` : ""}.`, { recipeId });
    return { ok: true, verdict: "deferred", nextWindowStart: queued.nextWindowStart, decision, policy, countdown: false, copy, level: auto.level };
  }

  const execute = () => {
    // Pass the policy's resolved dry-run so a Tier-0 recipe the customer opted into actually runs live. The
    // elevation flag tells the runner a person is present (UAC may be asked); it is "none" for anything unattended.
    const elevationFor = (humanInitiated || approved) && color !== "red" ? elevation : "none";
    Promise.resolve(runRecipe(recipeId, { confirmed: true, dryRun: policy.dryRun, elevation: elevationFor, approvalId: approved ? approvedRecord.id : undefined }))
      .then((res) => {
        // Ledger (audit M1): a live success counts +1; a completed preview is "preview" (±0); a live failure is "abort".
        const ran = Boolean(res && res.ok && res.dryRun === false);
        const previewed = Boolean(res && res.ok && res.dryRun === true);
        writeRecipeHistory(recordOutcome(readRecipeHistory(), recipeId, ran ? "success" : previewed ? "preview" : "abort"));
        afterFixOutcome(recipeId, res, { decision, source, startedAt: payload.startedAt });
      })
      .catch(() => writeRecipeHistory(recordOutcome(readRecipeHistory(), recipeId, "abort")));
  };
  // An approval REPLACES the countdown (the person already said yes); the supervisor's needsConfirm FORCES one.
  const countdown = approved ? false : (policy.requiresCountdown || needsConfirm || decision.forceCountdown === true);
  if (!countdown) { execute(); return { ok: true, verdict: verdict.verdict, countdown: false, policy, decision, approved, copy }; }
  const cd = startActionCountdown({ recipeId, risk: proposal.riskTier, title, onComplete: execute });
  return { ok: true, verdict: verdict.verdict, countdown: true, countdownId: cd.id, seconds: COUNTDOWN_SECONDS, policy, decision, copy };
}

/**
 * PROD 2026-10-14 (audit M3) — does this recipe have at least one live step that needs administrator rights?
 * Tier-0 executor bindings carry `needsAdmin`; registry recipes are scanned per action (explicit flag or command shape).
 */
function recipeNeedsAdmin(recipeId) {
  const id = String(recipeId || "");
  const exec = resolveExecutorId(id);
  if (exec) return Boolean(TIER0_COMMANDS[exec] && TIER0_COMMANDS[exec].needsAdmin);
  if (process.platform === "darwin" && isDarwinTier0(id)) return false; // user-level darwin set, never sudo
  const r = recipeById(id);
  if (!r) return false;
  return (r.actions || []).some((a) => a && a.shell === "powershell" && actionNeedsAdmin(a));
}

// RUN 23b — Tier-0 execution path. childProcesses-tracked PowerShell runner (so Ctrl+Alt+K kills it) + the
// runRecipe-shaped wrapper that maps a Tier-0 id to the executor under the SAME dry-run gate as every fix.
function tier0Run(command) {
  return new Promise((resolve) => {
    if (process.platform !== "win32" || !command) return resolve({ stdout: "", stderr: "", exitCode: 0 });
    // KILL GATE (review P0-2) — no fix step spawns after Ctrl+Alt+K / Stop ARIA.
    if (ariaStoppedNow()) return resolve({ stdout: "", stderr: "stopped by the kill switch", exitCode: 1, reason: "kill-switch" });
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

// PROD 2026-10-14 (audit M3) — run ONE allow-listed command with administrator rights through a UAC prompt the
// person at this device answers (Start-Process -Verb RunAs). Rules, enforced here and not only upstream:
//   · win32 only; the command must pass the Tier-0 allowlist OR the recipe command allowlist, and never a deny verb;
//   · the caller must say a person is present (`attended:true`) — this is never used from an unattended path;
//   · stdout of the elevated process is not readable (Windows forbids redirecting a RunAs child), so the result is
//     the exit code only — the exit guard inside the command makes a refused step exit non-zero;
//   · a declined / timed-out prompt comes back as exitCode 1223 + reason "uac-denied" (nothing was changed);
//   · tracked in childProcesses so Ctrl+Alt+K terminates the waiting outer shell too.
const UAC_WAIT_MS = 3 * 60 * 1000; // Windows auto-dismisses an unanswered consent prompt well inside this.
function runElevated(command, { attended = false, timeoutMs = UAC_WAIT_MS } = {}) {
  return new Promise((resolve) => {
    const cmd = String(command || "");
    if (process.platform !== "win32" || !cmd) return resolve({ stdout: "", stderr: "", exitCode: 1, reason: "elevation-unavailable", elevated: false });
    if (attended !== true) return resolve({ stdout: "", stderr: "", exitCode: 1, reason: "unattended-elevation-refused", elevated: false });
    // KILL GATE (review P0-2) — no UAC prompt (and no elevated step) after Ctrl+Alt+K / Stop ARIA.
    if (ariaStoppedNow()) return resolve({ stdout: "", stderr: "", exitCode: 1, reason: "kill-switch", elevated: false });
    if (!(isAllowedCommand(cmd) || validateTier0Command(cmd))) return resolve({ stdout: "", stderr: "", exitCode: 1, reason: "command-not-allowlisted", elevated: false });
    const { file, args } = buildElevatedExecution(cmd);
    let child;
    try { child = spawn(file, args, { windowsHide: true, timeout: timeoutMs, stdio: ["ignore", "ignore", "ignore"] }); }
    catch { return resolve({ stdout: "", stderr: "spawn-failed", exitCode: 1, reason: "spawn-failed", elevated: false }); }
    childProcesses.add(child);
    logEvent("ELEVATE", "Asked Windows for administrator approval (UAC) for one allow-listed fix step.", { needsAdmin: true });
    child.on("error", () => { childProcesses.delete(child); resolve({ stdout: "", stderr: "error", exitCode: 1, reason: "spawn-error", elevated: false }); });
    child.on("close", (code, signal) => {
      childProcesses.delete(child);
      if (signal) return resolve({ stdout: "", stderr: "", exitCode: 1, reason: "uac-timeout", elevated: false });
      const exitCode = code == null ? 1 : code;
      if (exitCode === UAC_CANCELLED_EXIT) return resolve({ stdout: "", stderr: "", exitCode, reason: "uac-denied", elevated: false });
      resolve({ stdout: "", stderr: "", exitCode, reason: exitCode === 0 ? "" : "exit-code", elevated: true });
    });
  });
}

// RUN-CU / CU4 — macOS user-level Tier-0 runner: each command is spawned POSITIONALLY (argv array, no shell),
// tracked for the kill-switch, 20s timeout, stdout never surfaced (counts/exit codes only — content-blind).
function runDarwinArgv(argv) {
  return new Promise((resolve) => {
    if (process.platform !== "darwin" || !Array.isArray(argv) || !argv.length) return resolve({ exitCode: 1, ran: false });
    if (ariaStoppedNow()) return resolve({ exitCode: 1, ran: false, reason: "kill-switch" }); // KILL GATE (review P0-2)
    let child;
    try { child = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "ignore", "ignore"], timeout: 20000 }); }
    catch { return resolve({ exitCode: 1, ran: false }); }
    childProcesses.add(child);
    child.on("error", () => { childProcesses.delete(child); resolve({ exitCode: 1, ran: true }); });
    child.on("close", (code) => { childProcesses.delete(child); resolve({ exitCode: code == null ? 1 : code, ran: true }); });
  });
}
async function runDarwinTier0Fix(recipe, actualDryRun) {
  logEvent("RUN", `${actualDryRun ? "Dry-run" : "Executing"} macOS Tier-0 ${recipe.id}`, { recipeId: recipe.id });
  const steps = [];
  if (actualDryRun) {
    for (const c of recipe.commands) steps.push({ command: c, ok: true, dryRun: true });
    return { ok: true, dryRun: true, recipe: { id: recipe.id, tier: "tier-0", platform: "darwin" }, outcome: "dry-run", steps, message: "Dry-run: no change was made on this Mac." };
  }
  let ok = true;
  for (let i = 0; i < recipe.argv.length; i++) {
    const r = await runDarwinArgv(recipe.argv[i]);
    const stepOk = r.ran && r.exitCode === 0;
    steps.push({ command: recipe.commands[i], ok: stepOk, exitCode: r.exitCode });
    logEvent(stepOk ? "DONE" : "ERROR", `${recipe.commands[i].split(/\s+/)[0]}: ${stepOk ? "completed" : `exit ${r.exitCode}`}`, { recipeId: recipe.id });
    if (!stepOk) { ok = false; break; }
  }
  return { ok, dryRun: false, recipe: { id: recipe.id, tier: "tier-0", platform: "darwin" }, outcome: ok ? (recipe.readOnly ? "no-op-neutral" : "success") : "fail", steps, message: ok ? (recipe.readOnly ? "Checked — read-only, nothing changed." : "Done.") : "A step did not complete; nothing further was changed." };
}

async function runTier0Fix(recipeId, options = {}) {
  // RUN-CU / CU4 (audit P0 #1) — line 1: the fleet/customer kill switch and a paused agent cover THIS executor too.
  // KILL GATE 2026-10-14 (review P0-2) — and Ctrl+Alt+K / Stop ARIA: agentBlocked() IS the one gate now (killGateReason).
  if (remediationKilled() || agentBlocked()) {
    const reason = killGateReason();
    logEvent("KILL-SWITCH", `Tier-0 fix ${recipeId} blocked: ${reason}.`, { recipeId });
    return { ...blockedRecipeResult(reason), dryRun: true, recipe: { id: String(recipeId || ""), tier: "tier-0" }, outcome: "blocked", steps: [], message: ariaStoppedNow() ? "ARIA is stopped on this device — nothing runs until you press Start ARIA." : "Fixes are paused on this device." };
  }
  // Dry-run unless system fixes are enabled AND the global gate is off AND the caller didn't force dry-run.
  const actualDryRun = globalDryRun() || options.dryRun === true;
  // macOS user-level Tier-0 (dry-run by default; no PowerShell engine involved).
  if (process.platform === "darwin" && isDarwinTier0(recipeId)) return runDarwinTier0Fix(tier0ById(recipeId, "darwin"), actualDryRun);
  // PROD 2026-10-14 (audit M3) — a person is present (options.elevation === "uac") → the executor's EXEC step for a
  // needsAdmin binding goes through the UAC runner; otherwise the executor is told elevation is unavailable and
  // reports "needs-admin" honestly instead of trying a change Windows will refuse.
  const attended = options.elevation === "uac" && process.platform === "win32";
  const result = await executeTier0(recipeId, {
    dryRun: actualDryRun,
    run: tier0Run,
    runElevated: attended ? (cmd) => runElevated(cmd, { attended: true }) : undefined,
    elevated: attended ? undefined : false,
    logger: (event, text, extra) => logEvent(event, text, { ...extra })
  });
  try { refreshHealthScore(); } catch { /* health refresh best-effort */ }
  // KILL GATE (review P0-2) — stopped mid-run: every spawn after the stop was refused (tier0Run / runElevated), so say
  // that instead of the executor's generic failure line.
  if (!actualDryRun && ariaStoppedNow() && result.outcome !== "success" && result.outcome !== "no-op-neutral") {
    result.message = "Stopped by Ctrl+Alt+K — no step after the stop ran (a step already running when it was pressed finished its own command).";
    logEvent("KILL-SWITCH", `Tier-0 fix ${recipeId} stopped mid-run — nothing after the stop ran.`, { recipeId });
  }
  const ok = ["success", "no-op-neutral", "dry-run"].includes(result.outcome);
  // (R6a) one FIX row per completed LIVE execution — the only row the hours-saved / pilot-proof counters read.
  if (!actualDryRun) logEvent("FIX", `${recipeTitle(recipeId)}: ${result.message}`, { recipeId: result.recipeId || recipeId, outcome: result.outcome === "success" ? "done" : result.outcome === "no-op-neutral" ? "no-op" : "failed", tier: "tier-0" });
  return {
    ok,
    dryRun: actualDryRun,
    recipe: { id: result.recipeId || recipeId, tier: "tier-0" },
    outcome: result.outcome,
    needsAdmin: Boolean(result.needsAdmin),
    reason: result.reason || "",
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
    // (F4 round 2) prefer the SIGNED installer (-setup.exe), fall back to the unsigned name; the name is the truth.
    const candidates = [path.join(root, "dist", otaSignedAssetName(version)), path.join(root, "dist", otaAssetName(version))];
    const exePath = candidates.find((p) => fs.existsSync(p));
    if (!exePath) return { ok: false, reason: "dist-exe-not-found", version };
    const name = path.basename(exePath);
    const buf = fs.readFileSync(exePath);
    return { ok: true, version, name, signed: isSignedArtifactName(name), sha512: createHash("sha512").update(buf).digest("base64"), size: buf.length, url: otaAssetUrlFor(version, name) };
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
  // RUN-CU / CU4 — rows pushed out of the 250-row hot window are archived (userData/audit/YYYY-MM.jsonl), never dropped.
  if (current.length > 250) { try { archiveAuditRows(current.slice(250)); } catch { /* archive is best-effort */ } }
  // PROD 2026-10-14 (audit M21) — ONE atomic write (electron-store writes temp+rename) carries the log, the RUN 16
  // legacy seal AND the keyed seal, so a crash / power loss between three separate writes can no longer leave the
  // log and its seal out of step and raise a false "tamper detected" banner on an honest machine. The keyed seal
  // file (audit-seal.json) is kept as a MIRROR for the verifier CLI and older readers, written atomically too.
  let keyed = null;
  try { keyed = sealAuditKeyed(trimmed, appHmacKey()); } catch { keyed = null; }
  try {
    store.set(keyed ? { transparencyLog: trimmed, auditSeal: sealAudit(trimmed), auditSealKeyed: keyed } : { transparencyLog: trimmed, auditSeal: sealAudit(trimmed) });
  } catch {
    try { store.set("transparencyLog", trimmed); } catch { /* logging must never throw */ }
  }
  if (keyed) { try { writeKeyedAuditSealFile(keyed); } catch { /* the mirror is best-effort */ } }
  // RUN-E E1 — a real fix just landed in the audit log: stamp pilot TTFV (write-once; no-op for other tags).
  if (tag === "RUN") { try { maybeStampPilotTtfv(); } catch { /* TTFV must never block logging */ } }
  if (tag === "RUN") { try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — proof autorun must never block logging */ } }
  broadcastState();
  return entry;
}

// RUN 16 §H — at session start, verify the persisted audit log against the seal written last session.
// A mismatch means the on-disk log was edited/truncated/reordered while the app was closed → record a
// SECURITY entry, surface it to the admin (state + tray), then re-baseline the seal to the current log.
// RUN-CU / CU4 — the keyed seal file (separate from the electron-store log; HMAC under the per-install key).
const AUDIT_SEAL_FILE = () => path.join(app.getPath("userData"), "audit-seal.json");
// The keyed seal is read from the SAME store record as the log first (written atomically with it, audit M21); the
// file is the mirror / the migration source for installs that only ever wrote the file.
function readKeyedAuditSeal() {
  try { const inStore = store.get("auditSealKeyed"); if (inStore && Array.isArray(inStore.chain)) return inStore; } catch { /* fall through */ }
  try { return JSON.parse(fs.readFileSync(AUDIT_SEAL_FILE(), "utf8")); } catch { return null; }
}
/** Atomic mirror write: temp file + rename, so a power loss mid-write never leaves a half seal on disk. */
function writeKeyedAuditSealFile(sealed) {
  const file = AUDIT_SEAL_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sealed));
  fs.renameSync(tmp, file);
  return sealed;
}
function writeKeyedAuditSeal(log) {
  const sealed = sealAuditKeyed(log, appHmacKey());
  try { store.set("auditSealKeyed", sealed); } catch { /* the store write is best-effort here; the mirror follows */ }
  writeKeyedAuditSealFile(sealed);
  return sealed;
}
function verifyAuditIntegrity() {
  const log = store.get("transparencyLog") || [];
  const sealed = store.get("auditSeal");
  // RUN-CU / CU4 — the KEYED seal is authoritative. A non-empty log with NO keyed seal is trusted only when the
  // legacy (unkeyed) seal still verifies — the one-time 0.1.x → 0.2.0 migration; otherwise "seal-missing" is a
  // tamper finding (banner), never a silent re-baseline (audit P1 #9).
  const keyed = readKeyedAuditSeal();
  if (keyed || log.length) {
    let result;
    if (keyed) result = verifyAuditKeyed(log, keyed, appHmacKey());
    else if (sealed && Array.isArray(sealed.chain)) { const legacy = verifyAudit(log, sealed); result = legacy.ok ? { ok: true, reason: "legacy-seal-migrated" } : legacy; }
    else result = verifyAuditKeyed(log, null, appHmacKey()); // → "seal-missing" for a non-empty log
    if (!result.ok) {
      const finding = { ok: false, reason: result.reason, brokenAt: result.brokenAt, detectedAt: new Date().toISOString() };
      store.set("auditIntegrity", finding);
      // logEvent re-seals over the (now-trusted-going-forward) log, so this alert won't repeat next launch.
      logEvent("SECURITY", `Audit log integrity check FAILED (${result.reason}) — tamper detected; admin alerted.`);
      try { refreshTray(); } catch { /* tray may not exist yet at startup */ }
      return finding;
    }
  } else if (sealed && Array.isArray(sealed.chain)) {
    const result = verifyAudit(log, sealed);
    if (!result.ok) {
      const finding = { ok: false, reason: result.reason, brokenAt: result.brokenAt, detectedAt: new Date().toISOString() };
      store.set("auditIntegrity", finding);
      logEvent("SECURITY", `Audit log integrity check FAILED (${result.reason}) — tamper detected; admin alerted.`);
      try { refreshTray(); } catch { /* tray may not exist yet at startup */ }
      return finding;
    }
  }
  const ok = { ok: true, verifiedAt: new Date().toISOString(), keyed: true };
  store.set("auditIntegrity", ok);
  store.set("auditVerifiedAt", ok.verifiedAt);
  // Baseline/refresh both seals (first run, migration, or after a confirmed-clean verify).
  try { store.set("auditSeal", sealAudit(log)); } catch { /* non-fatal */ }
  try { writeKeyedAuditSeal(log); } catch { /* non-fatal */ }
  return ok;
}

// RUN-CU / CU4 (fix j) — externalAiCalls reflects REALITY: true once this session's chat chain reached the
// aria-chat (Anthropic) fallback for a novel question (recorded by chat()); false while every answer came
// from the KB-first retrieval or the bundled local KB. Never a literal.
let lastChatProvider = null; // { provider, action, anthropic, ts }
function externalAiCallsNow() { return Boolean(lastChatProvider && lastChatProvider.anthropic === true); }

function getState() {
  const pausedUntil = Number(store.get("pausedUntil") || 0);
  const auto = autonomyNow();
  return {
    version: SENTINEL_VERSION,
    // F5 (2026-07-02) — dev-only affordances (e.g. "Simulate ARIA error") show ONLY in a dev run, never in the
    // packaged customer build. app.isPackaged is true for the shipped .exe → devMode false.
    devMode: devModeNow(),
    // PROD 2026-10-14 (audit M15) — the exclusion guard as a COUNT + the configured names; the locked default is never named.
    excludedFolders: { count: excludedFolderCount(), label: excludedFoldersLabel(), configured: configuredExcludedFolders() },
    mode: store.get("mode"),
    dryRun: globalDryRun(),
    systemFixesEnabled: allowSystemFixes(),
    liveFixes: liveFixesStatus(), // PROD 2026-10-14 (audit M1) — { enabled, source, elevation, note }
    keepSystemFixesDryRun: store.get("keepSystemFixesDryRun") === true,
    externalAiCalls: externalAiCallsNow(),
    reasoningMode: externalAiCallsNow() ? "kb-first + anthropic fallback (used this session)" : "local-symbolic",
    lastChatProvider: lastChatProvider ? { provider: lastChatProvider.provider, anthropic: Boolean(lastChatProvider.anthropic), ts: lastChatProvider.ts } : null,
    // RUN-CU / CU4 — autonomy level + approvals + platform honesty + the wizard prefs (for Settings → Autonomy & contacts).
    autonomy: { level: auto.level, clamped: auto.clamped, reason: auto.reason, mode: auto.mode, approverMode: auto.approverMode, levels: AUTONOMY_LEVELS },
    approvals: approvals.forState(),
    // ADVISORY ESCALATION (2026-10-14) — the open notices ({ id, recipeId, title, advisory, of: 3, nextAt, choices, copy }),
    // the person's interval/snooze, the rule in plain words, recent outcomes (content-blind) and the Never list.
    advisories: advisoryMachine.forState(advisoryPrefsNow()),
    advisoryPrefs: advisoryPrefsNow(),
    advisoryRule: ruleSentence(setupPrefsNow()),
    advisoryOutcomes: advisoryMachine.recentOutcomes(10),
    advisoryNever: advisoryMachine.neverList(),
    deferredFixes: (store.get("deferredFixes") || []).slice(0, 10),
    platformCapabilities: platformCapabilities(process.platform),
    setupPrefs: setupPrefsNow(),
    pausedUntil,
    paused: pausedUntil > Date.now(),
    killed: remediationKilled(),
    killReason: bridgeStatus.killReason || (customerConfig?.disabled ? "Customer policy disabled fixes." : ""),
    customer: customerConfig ? { id: customerConfig.customerId, name: customerConfig.displayName, managed: true } : { managed: false },
    bridgePort: BRIDGE_PORT,
    bridgeStatus,
    systemChecks: store.get("systemChecks") || [],
    healthScore: lastHealth || store.get("healthScore") || null,
    // PROD 2026-10-14 (F3 round 2) — the real watcher status for the Home "Watching: … last check N s ago" line.
    watchers: watchersStatus(),
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
    fileAssociationGuard: store.get("fileAssociationGuard") || null, // JULY PORT 2026-10-14 — last read-only .txt association check
    officeSafety: officeSafetyStatus(), // JULY PORT 2026-10-14 — Office Safety Net status (path-blind; opt-in)
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
    needsAdmin: (recipe.actions || []).some((a) => a && a.shell === "powershell" && actionNeedsAdmin(a)), // PROD 2026-10-14 (audit M3)
    actions: (recipe.actions || []).map((action) => ({
      id: action.id,
      label: action.label,
      shell: action.shell,
      risk: action.risk,
      requiresConfirm: action.requiresConfirm,
      needsAdmin: action.shell === "powershell" && actionNeedsAdmin(action),
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
    dryRun: globalDryRun(),
    contentBlind: true,
    externalAiCalls: externalAiCallsNow() // RUN-CU / CU4 — real, not a literal
  };
}

// PROD 2026-10-14 (audit M33) — coalesced: every logEvent used to re-read ~8 files and ship the whole state (log +
// 77 recipes) to every window, ~10 times per fix. A 16 ms trailing debounce sends ONE snapshot per burst; callers
// that need the send now pass { immediate: true }.
let broadcastTimer = null;
function broadcastState(opts = {}) {
  if (isQuitting) return;
  if (opts && opts.immediate === true) { if (broadcastTimer) { clearTimeout(broadcastTimer); broadcastTimer = null; } return broadcastStateNow(); }
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => { broadcastTimer = null; broadcastStateNow(); }, 16);
  broadcastTimer.unref?.();
}
function broadcastStateNow() {
  if (isQuitting) return;
  let state;
  try { state = getState(); } catch { return; }
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
    // FAULT LAB 2026-10-14 (defect 5) — the fixed enum only: a watched service disabled at its start type needs an admin.
    ...(detection.startType === "disabled" ? { startType: "disabled", needsAdmin: true } : {}),
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
  // FAULT LAB 2026-10-14 (defect 5) — a watched service whose START TYPE is Disabled (the service watcher's
  // `startType: "disabled"`, accepted only from the watcher and only for a service recipe): the card says what is really
  // wrong — disabled, not just stopped — and that an administrator is needed. It routes to the same service recipe, whose
  // restart needs administrator rights (needsAdmin → never unattended); no recipe ever changes a start type.
  const disabled = context.startType === "disabled" && String(context.source || "") === "detection-watcher" && Boolean(recipe.service && recipe.service.display);
  const disabledLine = disabled ? `${recipe.service.display} is disabled (start type), not just stopped — needs an administrator` : "";
  if (disabled) safeContext.startType = "disabled";
  const detection = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: safeContext.source || "desktop",
    recipeId: recipe.id,
    family: recipe.family,
    signal: recipe.signal,
    title: recipe.title,
    chip: recipe.chip,
    summary: disabled ? `${disabledLine}.` : recipe.summary,
    risk: recipe.risk,
    mode: recipe.mode,
    confidence: signature.confidence,
    ...(disabled ? { startType: "disabled", needsAdmin: true } : {}),
    context: safeContext
  };
  const detections = store.get("detections") || [];
  detections.unshift(detection);
  store.set("detections", detections.slice(0, 100));
  logEvent("DETECT", `${recipe.signal}: ${recipe.title}${disabled ? " — start type Disabled, needs an administrator" : ""}`, disabled ? { recipeId: recipe.id, startType: "disabled" } : { recipeId: recipe.id });
  recordSlaDetectionRow(detection, recipe); // (audit M12) the SLA tab measures real detections, never zero data as 100%
  // Tray reflects the new situation at a glance: a red recipe escalates, everything else is a detection.
  setAgentState(recipe.risk === "red" ? "escalation" : "detection");
  // RUN-CU / CU4 — "who should know when something breaks": desktop/email/SMS per the wizard channels,
  // deduped per issue for 6h, content-blind (catalog title + id + severity + platform only).
  notifyEvent("issue-detected", { title: recipe.title, recipeId: recipe.id, severity: recipeColor(recipe.id), detectionId: detection.id });
  // Autonomous mode may auto-apply a green recipe — gated by the opt-in + cap/cooldown/fleet guards. (ADVISORY ESCALATION:
  // the detection id travels along so its escalation is idempotent per detection; a disabled service's notices carry the
  // same plain sentence as its card.)
  // (advisoryTitle is always set HERE — never taken from the caller's input — so no free text can reach a notice.)
  autoFireIfEligible(recipe, { ...context, detectionId: detection.id, advisoryTitle: disabled ? disabledLine : undefined }).catch(() => undefined);
  overlayActiveUntil = Date.now() + 8000; // run the globe at 60fps through the fix animation
  if (overlayWindow) {
    showOverlay({ expanded: true });
    overlayWindow.webContents.send("sentinel:detection", detection);
  }
  return detection;
}

// PROD 2026-10-14 (audit M30) — a self-error is an audit row + a crash-queue record (content-blind), NOT a customer
// detection: it used to mint a fix card, pop the globe and e-mail the IT contact on every renderer hiccup / GPU
// process restart / bridge-port conflict. At most one self-repair card per hour, and only for a REPEATED fault.
const SELF_ERROR_CARD_MIN_MS = 60 * 60 * 1000;
let lastSelfErrorCardAt = 0;
let selfErrorsSinceCard = 0;
function handleSelfError(error, source = "runtime") {
  const message = error instanceof Error ? error.message : String(error || "unknown runtime error");
  const safeMessage = safeShortText(message, "ARIA Sentinel runtime fault");
  logEvent("SELF-ERROR", "ARIA Sentinel self-diagnosed a runtime fault.", { source, code: "APP.SENTINEL.ERROR" });
  try { if (crashReporter && typeof crashReporter.capture === "function") crashReporter.capture(error instanceof Error ? error : new Error(String(message))); } catch { /* never a second crash */ }
  selfErrorsSinceCard += 1;
  const now = Date.now();
  if (selfErrorsSinceCard < 3 || now - lastSelfErrorCardAt < SELF_ERROR_CARD_MIN_MS) return; // quiet: logged + queued only
  lastSelfErrorCardAt = now;
  selfErrorsSinceCard = 0;
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
    check("dry-run", globalDryRun(), "System-changing actions remain gated."),
    // RUN-CU / CU4 (fix j) — say what is true: the KB-first chain may reach the Anthropic fallback for a novel question.
    check("content-boundary", true, externalAiCallsNow() ? "KB-first chain reached the Anthropic fallback this session (question text only; never logs/paths/docs)." : "No external AI call this session — answers came from the knowledge base / local KB.")
  ];
  store.set("systemChecks", checks);
  const ok = checks.every((item) => item.ok || item.severity === "warn");
  // PROD 2026-10-14 (audit M28) — the 5-minute interval logs ONLY when the verdict changes (288 "interval self
  // diagnosis passed" rows a day were pushing real events out of the hot audit window). Manual / startup runs log.
  const signature = `${ok}:${checks.filter((c) => !c.ok).map((c) => c.id).join(",")}`;
  const last = store.get("selfDiagnoseSignature");
  if (reason !== "interval" || signature !== last) logEvent(ok ? "SELF-CHECK" : "SELF-REPAIR", `${reason} self diagnosis ${ok ? "passed" : "needs attention"}.`);
  store.set("selfDiagnoseSignature", signature);
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
  // KILL GATE 2026-10-14 (review P0-2) — line 1, before anything else: a stopped ARIA (Ctrl+Alt+K / Stop ARIA), a
  // fleet/customer kill or a pause refuses this executor outright — a preview included ("stops everything").
  if (!killGateOpen()) {
    const reason = killGateReason();
    logEvent("KILL-SWITCH", `Recipe ${String(recipeId || "(none)")} blocked: ${reason}.`, { recipeId: String(recipeId || "") });
    const known = recipeById(recipeId);
    return { ...blockedRecipeResult(reason), dryRun: true, steps: [], ...(known ? { recipe: publicRecipe(known) } : {}), message: ariaStoppedNow() ? "ARIA is stopped on this device — nothing runs until you press Start ARIA." : "Fixes are paused on this device." };
  }
  // RUN 23b — a Tier-0 id (direct or aliased) routes to the dedicated executor instead of the diagnostic
  // recipe registry. Still dry-run-gated by the same flags; the supervisor + countdown gate it upstream.
  if (resolveExecutorId(recipeId) || (process.platform === "darwin" && isDarwinTier0(recipeId))) return runTier0Fix(recipeId, options);
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
  // RUN-CU / CU4 (audit P1 #6) — the customer policy overlay (recipes_disabled) is enforced on the direct path too.
  if (!isRecipeAllowedByPolicy(store.get("policyOverlay") || null, recipeId)) {
    logEvent("POLICY", `Recipe ${recipe.signal} disabled by customer policy overlay.`, { recipeId });
    return { ok: false, error: "policy_disabled", reason: "This fix is disabled by your organization's policy.", recipe: publicRecipe(recipe) };
  }
  const executionId = options.executionId || options.execution_id;
  const confirmed = options.confirmed === true;
  const core = async () => {
  const actualDryRun = globalDryRun() || options.dryRun !== false;
  setAgentState("fixing");
  const steps = [];
  // A System Restore point is created — and VERIFIED (sequence number increased) — before any change touches
  // the machine. Yellow-tier recipes REQUIRE a real one before their actions may execute (isActionExecutable);
  // a record alone no longer counts (audit P0 #3). Dry-runs never create one.
  let restorePoint = null;
  if (!actualDryRun && (recipe.actions || []).some((a) => a.shell === "powershell")) {
    restorePoint = await recordRestorePoint(recipe.id, `ARIA pre-fix ${recipe.signal}`);
  }
  const restorePointTaken = Boolean(restorePoint && restorePoint.created === true);
  if (!actualDryRun && isYellowRecipe(recipe.id) && !restorePointTaken) {
    logEvent("RESTORE PT", `${recipe.signal}: restore point unavailable on this platform/account — yellow-tier actions stay in preview.`, { recipeId });
  }
  logEvent("RUN", `${actualDryRun ? "Dry-run" : "Executing"} recipe ${recipe.signal}`, { recipeId });
  // PROD 2026-10-14 (audit M3) — elevation is allowed for this run only when the gate said a person is present.
  const elevation = options.elevation === "uac" && process.platform === "win32" && recipeColor(recipe.id) !== "red" ? "uac" : "none";
  let stoppedMidRun = false;
  for (const action of recipe.actions || []) {
    // KILL GATE (review P0-2) — Ctrl+Alt+K between two steps: the next step never starts (the running one was ended,
    // or — an elevated step Windows owns — finished its own command). Recorded, never silent.
    if (!actualDryRun && ariaStoppedNow()) {
      stoppedMidRun = true;
      steps.push({ actionId: action.id, label: action.label, ok: false, dryRun: false, stopped: true, reason: "kill-switch", message: "Stopped by Ctrl+Alt+K before this step — it did not run." });
      logEvent("KILL-SWITCH", `${recipe.signal}: stopped by Ctrl+Alt+K before "${action.label}" — no step after the stop ran.`, { recipeId, actionId: action.id });
      break;
    }
    const result = await runAction(action, actualDryRun, recipe.id, { confirmed, restorePointTaken, elevation });
    // FAULT LAB 2026-10-14 (defect 3) — a NON-FATAL step (action.nonFatal, e.g. `ipconfig /registerdns`, which Windows may
    // refuse a standard user) that fails LIVE is a WARNING, not a failed fix: it is recorded, said in the audit, and the
    // remaining steps run. It never counts as a live change and never makes the fix "done" — the verify probe decides.
    if (!result.ok && action.nonFatal === true && result.dryRun === false) {
      steps.push({ actionId: action.id, label: action.label, ...result, nonFatal: true });
      logEvent("WARN", `${action.label}: did not complete (Windows may require administrator rights for this step) — a non-fatal step, so the fix continues without it. Nothing else was skipped.`, { recipeId, actionId: action.id, nonFatal: true });
      continue;
    }
    steps.push({ actionId: action.id, label: action.label, ...result });
    logEvent(result.ok ? "DONE" : "ERROR", `${action.label}: ${result.message}`, { recipeId, actionId: action.id });
    // (review P0-2) a step ended by Ctrl+Alt+K (its child was terminated, or its spawn refused) stops the run as "stopped".
    if (!result.ok) { if (!actualDryRun && ariaStoppedNow()) stoppedMidRun = true; break; }
  }
  // After a real (non-dry-run) execution of a cleared recipe, run a read-only verification probe.
  let verifiedFlag = null;
  const requiredSteps = steps.filter((s) => !s.nonFatal); // a failed non-fatal step never fails (or passes) the fix
  const liveSteps = steps.filter((s) => s.dryRun === false && !(s.nonFatal && !s.ok) && !s.stopped).length;
  if (!actualDryRun && !stoppedMidRun && isExecutableRecipe(recipe.id) && requiredSteps.every((s) => s.ok) && liveSteps > 0) {
    const verified = await verifyRecipe(recipe.id);
    verifiedFlag = Boolean(verified.ok);
    // FAULT LAB 2026-10-14 (defect 3) — the verify probe's verdict IS the outcome: the steps ran but the check after them
    // failed = NOT RESOLVED (never "success", never "fixed and verified"), and the audit row says so in those words.
    logEvent(verified.ok ? "DONE" : "REVIEW", `Verification for ${recipe.signal}: ${verified.ok ? "passed" : "failed — not resolved (the steps ran, but the check after them says the problem is still there)"}.`, verified.ok ? { recipeId } : { recipeId, outcome: NOT_RESOLVED });
    // RUN-B B5 - a REAL applied+verified fix: show the under-globe "resolved | email sent | ticket ref"
    // confirmation (real email + real recorded ticket ref). Non-blocking; never fires on an unverified fix.
    if (verified.ok) {
      Promise.resolve(emitGlobeConfirmation({ issueTitle: recipe.title || recipe.signal, sessionId: executionId })).catch(() => {});
    }
  }
  refreshHealthScore();
  // FAULT LAB 2026-10-14 (defect 3) — every required step ran, the gate's verify failed → `not_resolved`: ok:false (so the
  // vetted ledger never counts it as a success and every surface treats it as "needs a person"), outcome + reason say it.
  const stepsOk = requiredSteps.every((step) => step.ok);
  const notResolved = stepsOk && verifiedFlag === false;
  const ok = stepsOk && !notResolved;
  setAgentState(ok ? "idle" : "escalation");
  // Rule 14 — "live" only when at least one action really executed; a yellow fix held in preview for want of a
  // restore point reports dryRun:true + says why, never "Fix applied".
  const effectiveDryRun = actualDryRun || liveSteps === 0;
  const heldForRestorePoint = !actualDryRun && liveSteps === 0 && isYellowRecipe(recipe.id) && !restorePointTaken;
  const warnings = steps.filter((s) => s.nonFatal && !s.ok).map((s) => s.actionId);
  // (R6a) one FIX row per completed LIVE execution: "done" only when every step ran and verification did not fail.
  if (!effectiveDryRun) logEvent("FIX", `${recipe.title}: ${ok ? (warnings.length ? "applied (a non-fatal step did not complete)" : "applied") : notResolved ? "applied, NOT RESOLVED — the check after the fix says the problem is still there" : stoppedMidRun ? "stopped by Ctrl+Alt+K part-way — no step after the stop ran" : "failed"}`, { recipeId, outcome: ok && verifiedFlag !== false ? "done" : "failed", liveSteps, ...(notResolved ? { resolution: NOT_RESOLVED } : {}), ...(stoppedMidRun ? { stopped: true } : {}), ...(warnings.length ? { warnings } : {}) });
  return {
    ok,
    dryRun: effectiveDryRun,
    ...(notResolved ? { outcome: NOT_RESOLVED, reason: NOT_RESOLVED } : {}),
    ...(stoppedMidRun ? { stopped: true, reason: "kill-switch" } : {}),
    recipe: publicRecipe(recipe),
    steps,
    restorePoint,
    restorePointTaken,
    verified: verifiedFlag,
    warnings,
    message: stoppedMidRun
      ? (liveSteps > 0 ? "Stopped by Ctrl+Alt+K part-way: the steps before the stop ran; nothing after it did." : "Stopped by Ctrl+Alt+K before the first step — nothing ran.")
      : heldForRestorePoint
      ? "Held in preview: a restore point is unavailable on this platform/account, so this yellow-tier fix was not applied."
      : effectiveDryRun ? "Dry-run complete. No system changes were made."
        : notResolved ? "Not resolved: the fix ran, but the check afterwards says the problem is still there. Nothing further was changed — a person should take a look."
          : recipe.success
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
    allowSystemFixes: allowSystemFixes(),
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
  // PROD 2026-10-14 (audit M3) — a step that needs administrator rights runs ONLY through the UAC runner, and only
  // when the gate said a person is present. Otherwise it is reported as not applied, never attempted-and-masked.
  if (actionNeedsAdmin(action)) {
    if (gate.elevation !== "uac") {
      return Promise.resolve({ ok: false, dryRun: false, needsAdmin: true, reason: "needs-admin", message: "Needs administrator approval (UAC) — not attempted because no one is here to approve it. Nothing was changed.", output: "[needs-admin]" });
    }
    return runElevated(guardedRecipeCommand(action.command), { attended: true }).then((r) => {
      if (r.reason === "kill-switch") return { ok: false, dryRun: false, needsAdmin: true, stopped: true, reason: "kill-switch", message: "Stopped by Ctrl+Alt+K — this step did not run.", output: "[stopped]" };
      if (r.exitCode === 0) return { ok: true, dryRun: false, needsAdmin: true, elevated: true, message: "Command completed (with administrator approval).", output: "[command-complete]" };
      if (r.reason === "uac-denied" || r.reason === "uac-timeout") return { ok: false, dryRun: false, needsAdmin: true, reason: r.reason, message: "Not applied — the administrator prompt was declined or timed out. Nothing was changed.", output: "[uac-denied]" };
      return { ok: false, dryRun: false, needsAdmin: true, reason: r.reason || "exit-code", message: "Command failed even with administrator rights. Review local admin console.", output: "[command-error]" };
    });
  }
  // KILL GATE (review P0-2) — no fix step spawns after Ctrl+Alt+K / Stop ARIA.
  if (ariaStoppedNow()) return Promise.resolve({ ok: false, dryRun: false, stopped: true, reason: "kill-switch", message: "Stopped by Ctrl+Alt+K — this step did not run.", output: "[stopped]" });
  // Real execution: spawn with positional argv (no shell string interpolation), Restricted policy.
  const { file, args } = buildExecution(action);
  return new Promise((resolve) => {
    let settled = false;
    let stderr = "";
    const finish = (ok, message, output, extra = {}) => {
      if (settled) return;
      settled = true;
      resolve({ ok, dryRun: false, message, output, ...extra });
    };
    let child;
    try {
      child = spawn(file, args, { windowsHide: true, timeout: 120000, stdio: ["ignore", "ignore", "pipe"] });
    } catch {
      return finish(false, "Command could not start. Review local admin console.", "[spawn-error]");
    }
    childProcesses.add(child); // tracked so the kill-switch (Ctrl+Alt+K) can terminate it
    child.stderr?.on("data", (d) => { if (stderr.length < 4000) stderr += d.toString(); }); // classified, never surfaced raw
    child.on("error", () => { childProcesses.delete(child); finish(false, "Command failed. Review local admin console.", "[command-error]"); });
    child.on("close", (code) => {
      childProcesses.delete(child);
      // (audit M5) an "access is denied" on stderr is a refusal, whatever the exit code of a trailing statement says.
      if (/access is denied|cannot open|PermissionDenied|cannot be stopped/i.test(stderr)) return finish(false, "Needs administrator approval (UAC) — Windows refused this step for a standard user. Nothing was changed.", "[needs-admin]", { needsAdmin: true, reason: "needs-admin" });
      finish(code === 0, code === 0 ? "Command completed." : "Command failed. Review local admin console.", code === 0 ? "[command-complete]" : "[command-error]");
    });
  });
}

/** `if(-not $?){exit 1}` after the first statement of a registry command, so a refused step exits non-zero. */
function guardedRecipeCommand(command) {
  const parts = String(command || "").split(";");
  const first = parts[0].trim();
  const rest = parts.slice(1).map((s) => s.trim()).filter(Boolean);
  return [first, "if(-not $?){exit 1}", ...rest].join("; ");
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
    "Clear-DnsClientCache", // PROD 2026-10-14 (audit M3) — the user-space replacement for Restart-Service Dnscache
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
  const startedAt = Date.now(); // RUN-CU / CU4 — main-process (Node fetch) calls recorded by outbound.mjs are merged below
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
  // RUN-CU / CU4 (audit P1 #7) — the main process's own outbound calls during the window (heartbeat, notify,
  // approval poll, license, update, brain) join the capture: byte counts + the content-blind verdict recorded at
  // send time (bodies are never stored). Before this, Node fetch traffic was invisible to the verifier.
  const mainRows = outbound.since(startedAt).map((r) => ({ url: r.url, method: r.method, payloadBytes: r.bytes, sanitizationStatus: r.bytes > 0 ? (r.bodySafe === false ? "leak" : "clean") : "none", identityFields: r.identityFields || 0, source: "main-process" }));
  // Declared inbound GET pulls — the baseline allow-listed rows (0 payload, content-blind).
  const baseline = EXPECTED_OUTBOUND_PATHS.map((p) => ({ url: `https://${p.host}${p.path}`, method: p.method }));
  const extra = [...captured, ...mainRows].filter((c) => {
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
    capturedMain: mainRows.length,
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
  // PROD 2026-10-14 (audit M27) — through the tracked, win32-guarded runner (it used to shell-exec an untracked
  // `powershell` on every platform and fail noisily on macOS).
  if (process.platform !== "win32") return { ok: false, error: "not-windows", skipped: true };
  const stdout = await runPowerShell("Get-PSDrive C | Select-Object Used,Free | ConvertTo-Json -Compress", 20000);
  if (!stdout) return { ok: false, error: "no-output" };
  try {
    const disk = JSON.parse(stdout);
    const free = Number(disk.Free || 0);
    const used = Number(disk.Used || 0);
    const percentFree = free + used > 0 ? Math.round((free / (free + used)) * 1000) / 10 : null;
    if (percentFree != null && percentFree < 8) {
      detectIssue({ source: "desktop-scan", issue: `disk low space ${percentFree}% free`, signal: "DISK.LOW_SPACE" });
    }
    return { ok: true, disk: { free, used, percentFree } };
  } catch (err) {
    return { ok: false, error: safeShortText(err && err.message, "scan error") };
  }
}

async function updateKnowledge(opts = {}) {
  // Automatic pulls (launch / daily) wait for Setup consent; a person's click passes { manual:true } and never waits.
  if (opts.manual !== true && !telemetryAllowed()) { logEvent("KB", "Knowledge pull deferred until Setup is completed."); return { ok: false, deferred: true, reason: "setup-not-completed", results: [] }; }
  // PROD 2026-10-14 (audit M9) — only endpoints that exist are called; a declared-but-not-deployed feed (kb-bundle)
  // is reported as "not available in this version" (ok:null), never as a failed check / red row at every launch.
  // The two live feeds (aria-recipes, aria-stop-codes) carry the fleet kill directive and are checked for real.
  const fetchImpl = typeof opts.fetchImpl === "function" ? opts.fetchImpl : (url, init) => outbound.fetch(url, init);
  const results = [];
  for (const item of [
    { id: "recipes", endpoint: RECIPE_ENDPOINT },
    { id: "stop-codes", endpoint: STOP_CODES_ENDPOINT },
    { id: "kb-bundle", endpoint: KB_BUNDLE_ENDPOINT }
  ]) {
    if (!isEndpointDeployed(item.id)) { results.push({ id: item.id, ok: null, status: "not-available", note: ENDPOINT_NOT_AVAILABLE_NOTE }); continue; }
    try {
      const headers = { "user-agent": `ARIA-Sentinel/${SENTINEL_VERSION}` };
      if (customerConfig?.customerId) headers["x-aria-customer"] = customerConfig.customerId;
      const res = await fetchImpl(item.endpoint, { headers });
      results.push({ id: item.id, ok: res.ok, status: res.status });
      // The recipes endpoint is the control plane: it may carry a global kill switch.
      if (item.id === "recipes" && res.ok) {
        const body = await (typeof res.clone === "function" ? res.clone() : res).json().catch(() => null);
        const kill = parseControlPlaneKill(body);
        if (kill.present) applyControlPlaneKill(kill.killed, kill.reason);
      }
    } catch (err) {
      results.push({ id: item.id, ok: false, error: err.message });
    }
  }
  const live = results.filter((r) => r.ok !== null);
  const summary = results.map((r) => `${r.id} ${r.ok === null ? ENDPOINT_NOT_AVAILABLE_NOTE : r.ok ? r.status : `failed (${r.status || r.error || "no response"})`}`).join(" · ");
  logEvent(live.every((r) => r.ok) ? "KB" : "ERROR", `Knowledge update check: ${summary}.`, { results });
  store.set("endpointStatus", results.map((result) => ({
    id: result.id,
    ok: result.ok === null ? null : Boolean(result.ok),
    status: result.status || 0,
    note: result.note || "",
    error: result.error ? safeShortText(result.error, "endpoint error") : ""
  })));
  broadcastState();
  return { ok: live.every((r) => r.ok), results, note: results.some((r) => r.ok === null) ? `kb-bundle ${ENDPOINT_NOT_AVAILABLE_NOTE}` : "" };
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

// F2 (2026-07-03) — the bundled FULL KB article text (slug → complete markdown), loaded once. Used to repair a
// live aria-kb-query excerpt that arrives cut mid-line (the deployed web bundle can lag the fixed one). Failure
// degrades to an empty map → we fall back to repairTruncatedTail on the excerpt (still never a dangling token).
let _fullTextIndex = null;
function fullTextIndex() {
  if (_fullTextIndex) return _fullTextIndex;
  try { _fullTextIndex = loadFullText(path.join(app.getAppPath(), "aria-kb-pack"), fs); } catch { _fullTextIndex = new Map(); }
  return _fullTextIndex;
}

// D2 (2026-07-03) — persist a completed Ask-ARIA interaction to LOCAL memory + stats so the Memory tab and
// the Dashboard "Operations at a glance" reflect real usage. One session file per app-run (grouped by a local
// id) under ~/.aria-sentinel/sessions; global counters live in the electron-store. 🔒 Local-only, never sent.
const SESSIONS_DIR = () => path.join(os.homedir(), ".aria-sentinel", "sessions");
function persistChatAsk(message, reply, kind) {
  const at = new Date().toISOString();
  try {
    let sid = store.get("localChatSessionId");
    if (!sid) { sid = `local-${Date.now().toString(36)}`; store.set("localChatSessionId", sid); }
    const dir = SESSIONS_DIR();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${sid}.json`);
    let session = {};
    try { session = JSON.parse(fs.readFileSync(file, "utf8")); } catch { session = { id: sid }; }
    // JULY PORT 2026-10-14 (a7f9e111) — every stored turn is scrubbed on disk (excluded folders through the guard, then
    // drive / home paths → "[path]") and the session is capped at MAX_SESSION_TURNS; parseSessions scrubs again on render.
    session = capSessionTurns(recordAsk(session, { message: scrubChatText(message), reply: scrubChatText(reply), kind, at }));
    if (!session.id) session.id = sid;
    fs.writeFileSync(file, JSON.stringify(session, null, 2));
  } catch { /* memory persistence is best-effort; never break the chat reply over it */ }
  try { store.set("chatStats", foldStats(store.get("chatStats"), kind)); } catch { /* best-effort */ }
  broadcastState();
}

async function chat(message, context = {}) {
  // Local KB match (always computed; used as the offline fallback + as a fix hint).
  const signature = sanitizeToSignature({ issue: message, ...context });
  const query = queryForSignature(signature);
  const localMatches = matchRecipes(query, { limit: 3 }).map((match) => ({ score: match.score, recipe: publicRecipe(match.recipe) }));
  // RUN-CU / CU4 — multi-turn + voice: the caller (ARIA tab / companion voice loop) passes the recent turns and
  // `voice:true`; the brain then returns speak / needs_input / listen / action. History is capped + scrubbed
  // in buildChatRequest; the KB-first local path synthesizes `speak` itself (first two sentences, listen:true).
  const voice = context && context.voice === true;
  const history = Array.isArray(context && context.history) ? context.history : [];
  // RUN 15 §4 — desktop wraps the LIVE iisupp.net/aria brain. Try it first; degrade to local KB offline.
  const brain = await askAria(String(message || ""), {
    sessionId: store.get("chatSessionId") || null,
    deviceId: deviceIdHash(),                                 // RUN-CU / CU4 (fix j) — a hash, never the raw hostname
    licenseKey: (readLicense() || {}).key || "",
    platform: process.platform,                               // RUN 30 — real OS so the brain answers cross-platform
    tier: (licenseStatus() || {}).plan || "",
    version: SENTINEL_VERSION,
    messages: history,
    voice,
    fetchImpl: outbound.fetch                                 // RUN-CU / CU4 — recorded by the privacy ring
  });
  if (brain && !brain.offline && brain.reply) {
    // (fix j) — remember which tier answered so getState().externalAiCalls / Health tell the truth.
    lastChatProvider = { provider: "aria-brain", action: brain.action || null, anthropic: brain.action !== "kb-match", ts: new Date().toISOString() };
    if (brain.session_id) store.set("chatSessionId", brain.session_id);
    if (brain.kb_meta) { store.set("kbMeta", brain.kb_meta); broadcastState(); } // RUN 33-A — surface KB freshness to the top bar
    // F2 (2026-07-03) — the live aria-kb-query excerpt can arrive cut mid-line (e.g. the printer "Escalation
    // Trigger" section as a dangling "- Print server (`"). If we carry the FULL article for this slug, swap in
    // the complete text (re-scrubbed with the same R11 rule, keeping the "Full article" footer). If we don't,
    // strip the incomplete trailing fragment so a dangling token is never rendered. Never fabricates text.
    let text = brain.reply;
    if (looksTruncated(text)) {
      const slug = brain.kb_match && brain.kb_match.slug;
      const full = slug ? fullArticle(fullTextIndex(), slug) : "";
      if (full) {
        const footer = /→ Full article:\s*(\S+)/.exec(text);
        text = scrubR11(full) + (footer ? `\n\n→ Full article: ${footer[1]}` : "");
      } else {
        text = repairTruncatedTail(text);
      }
    }
    // P0 (2026-07-14) — shape the answer for the end user: lead with the plain-language explanation + fix
    // steps and NEVER render "Internal Technician Notes" / "Keywords / Search Tags" (registry + security-
    // tradeoff content is internal-facing). Defense in depth — the server excerpt is also shaped.
    const footerMatch = /(\n+→ Full article:\s*\S+)\s*$/.exec(text);
    const footerLine = footerMatch ? footerMatch[1] : "";
    text = shapeKbAnswerForEndUser(footerLine ? text.slice(0, footerMatch.index) : text) + footerLine;
    persistChatAsk(message, text, classifyAnswer({ provider: "aria-brain", action: brain.action || null })); // D2
    return withVoice({ ok: true, provider: "aria-brain", text, action: brain.action || null, kbMatch: brain.kb_match || null, kbMeta: brain.kb_meta || null, matches: localMatches }, brain, voice);
  }
  lastChatProvider = { provider: "local-kb", action: null, anthropic: false, ts: new Date().toISOString() };
  // Offline / unreachable → answer from the bundled cross-platform KB (RUN 30-B). ARIA is full cross-platform
  // tech support (Windows, macOS, iOS, iPadOS, Android, ChromeOS, Linux) — never the old Windows-only string.
  // A matching Sentinel recipe is offered alongside; otherwise the KB answer (or its cross-platform no-match) stands.
  const kb = localKbAnswer({ message: String(message || ""), platform: process.platform, index: kbIndex() });
  if (kb.matched) {
    const text = localMatches.length
      ? `${kb.text}\n\nI also found a local Sentinel recipe that may help: ${localMatches[0].recipe.title} — I can dry-run it or show the steps.`
      : kb.text;
    persistChatAsk(message, text, classifyAnswer({ provider: "local-kb", matched: true })); // D2
    return withVoice({ ok: true, provider: "local-kb", text, signature, matched: true, matches: localMatches, offline: true, cost: "none" }, null, voice);
  }
  // P3 (2026-07-14) — tier 3: the shared TOPICS brain (v2.1) gives GUIDED, multi-turn, $0 help when the
  // bundled KB has no confident match. Skipped for a credential-retrieval refusal (that answer stands).
  if (!kb.refusal) {
    let topic = null;
    try { topic = topicsAnswer(String(message || "")); } catch { topic = null; }
    if (topic && topic.text) {
      persistChatAsk(message, topic.text, classifyAnswer({ provider: "aria-topics", matched: true })); // D2
      return withVoice({ ok: true, provider: "aria-topics", text: topic.text, signature, matched: true, matches: localMatches, offline: true, cost: "none" }, null, voice);
    }
  }
  // No confident match at any offline tier → the KB no-match message (or the credential refusal) stands.
  const text = (!kb.refusal && localMatches.length)
    ? `${kb.text}\n\nI also found a local Sentinel recipe that may help: ${localMatches[0].recipe.title} — I can dry-run it or show the steps.`
    : kb.text;
  persistChatAsk(message, text, classifyAnswer({ provider: "local-kb", matched: kb.matched })); // D2
  return withVoice({ ok: true, provider: "local-kb", text, signature, matched: kb.matched, matches: localMatches, offline: true, cost: "none" }, null, voice);
}

// RUN-CU / CU4 — voice fields on every chat reply: the brain's own speak/needs_input/listen/action when it sent
// them (voice mode), else synthesized from the text (first two sentences; listen:true so the loop re-arms).
// When the action is a sentinel-fix with a recipe hint, match it to a VETTED catalog recipe and announce the
// gated offer; the fix itself still goes through runSupervisedFix + the approval policy — never here.
function withVoice(reply, brain, voice) {
  const vf = voiceFieldsFor(reply, brain, voice);
  return { ...reply, ...vf };
}
function voiceFieldsFor(reply, brain, voice) {
  const text = String((reply && reply.text) || "");
  const b = brain || {};
  const speak = typeof b.speak === "string" && b.speak.trim() ? b.speak.trim() : deriveSpeak(text);
  const needsInput = typeof b.needs_input === "boolean" ? b.needs_input : true;
  const listen = typeof b.listen === "boolean" ? b.listen : needsInput;
  const action = normalizeChatAction(b.actionDetail || b.action, reply);
  let fixOffer = null;
  if (action.kind === "sentinel-fix" && action.recipeHint) {
    const matched = matchVettedRecipe(action.recipeHint, reply && reply.matches);
    fixOffer = matched
      ? { recipeId: matched.id, title: matched.title, color: recipeColor(matched.id), announce: buildVoiceFixAnnouncement({ title: matched.title, platform: process.platform, color: recipeColor(matched.id) }) }
      : null;
  }
  return { speak: fixOffer ? `${speak} ${fixOffer.announce}`.trim() : speak, needs_input: needsInput, listen: fixOffer ? true : listen, voiceAction: action, fixOffer, voice: Boolean(voice) };
}
// deriveSpeak() comes from ../shared/voice-turns.mjs — ONE rule for spoken text in main, the tab and the companion.
function normalizeChatAction(action, reply) {
  if (action && typeof action === "object") {
    const kind = ["guide", "sentinel-fix", "escalate", "none"].includes(action.kind) ? action.kind : "none";
    return { kind, recipeHint: action.recipeHint ? String(action.recipeHint).slice(0, 80) : null };
  }
  const a = typeof action === "string" ? action : (reply && reply.action) || "";
  if (a === "escalate") return { kind: "escalate", recipeHint: null };
  if (a === "kb-match" || a === "resolved" || a === "local-kb-only") return { kind: "guide", recipeHint: null };
  return { kind: "none", recipeHint: null };
}
/** Match a recipe hint (id or words) to a recipe in the supervisor's VETTED catalog; null when nothing safe matches. */
function matchVettedRecipe(hint, localMatches) {
  const h = String(hint || "").toLowerCase().trim();
  if (!h || isBlockedPath(h)) return null;
  const vetted = supervisedVettedCatalog();
  const direct = resolveExecutorId(h) || (vetted.has(h) ? h : null);
  if (direct && (resolveExecutorId(direct) || vetted.has(direct))) return { id: resolveExecutorId(direct) || direct, title: recipeTitle(direct) };
  const words = h.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const candidates = [
    ...TIER0_RECIPES.map((r) => ({ id: r.id, title: r.title, blob: `${r.id} ${r.title} ${r.category || ""}`.toLowerCase() })),
    ...(process.platform === "darwin" ? TIER0_DARWIN_RECIPES.map((r) => ({ id: r.id, title: r.title, blob: `${r.id} ${r.title} ${r.category || ""}`.toLowerCase() })) : []),
    ...RECIPES.filter((r) => vetted.has(r.id)).map((r) => ({ id: r.id, title: r.title, blob: `${r.id} ${r.title} ${r.signal || ""}`.toLowerCase() }))
  ];
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const score = words.filter((w) => c.blob.includes(w)).length;
    if (score > bestScore) { best = c; bestScore = score; }
  }
  if (!best || bestScore < 2) { // a weak hint: fall back to the local KB match ONLY if it is vetted
    const top = Array.isArray(localMatches) && localMatches[0] && localMatches[0].recipe;
    return top && vetted.has(top.id) ? { id: top.id, title: top.title } : null;
  }
  return { id: best.id, title: best.title };
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
    // FAULT LAB 2026-10-14 (defect 2) — "the internet is unreachable" gets the same guide as "no adapter is up"
    // (net-adapter-down-v1); before this NET.DOWN matched no recipe at all and the person heard nothing.
    "NET.DOWN": "NET.ADAPTER.DOWN",
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
// PROD 2026-10-14 (audit M25) — the overlay has a LOADER now: ~/.aria-sentinel/policy.json (an IT lead / MDM drop) is
// read at launch, on the daily tick and whenever the file changes; customer.json is re-read on the same cadence.
const POLICY_FILE = path.join(os.homedir(), ".aria-sentinel", POLICY_FILE_NAME);
let lastPolicySignature = null;
function loadPolicyOverlayFromDisk(reason = "launch") {
  try {
    const { overlay, present } = loadPolicyFile(POLICY_FILE, fs);
    const signature = JSON.stringify(overlay);
    if (signature === lastPolicySignature) return overlay;
    lastPolicySignature = signature;
    const prev = store.get("policyOverlay") || null;
    const prevActive = Boolean(prev && ((prev.recipes_disabled || []).length || prev.business_hours || prev.confirmation_threshold != null));
    store.set("policyOverlay", overlay);
    // Quiet when nothing is configured (the common case): a log row only when a policy applies or one was removed.
    if (present) logEvent("POLICY", `Policy file applied (${reason}): ${overlay.recipes_disabled.length} recipe(s) disabled${overlay.business_hours ? ", business hours set" : ""}.`);
    else if (prevActive) logEvent("POLICY", `Policy file removed (${reason}) — organization policy overlay cleared.`);
    broadcastState();
    return overlay;
  } catch { return null; }
}
function watchPolicyFile() {
  try {
    const dir = path.dirname(POLICY_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const w = fs.watch(dir, { persistent: false }, (_ev, name) => { if (String(name || "") === POLICY_FILE_NAME) loadPolicyOverlayFromDisk("file-change"); });
    w.on?.("error", () => { /* watching is best-effort; the daily tick still re-reads */ });
  } catch { /* best-effort */ }
}
function reloadCustomerConfig() {
  try { const next = loadCustomerConfig(); const changed = JSON.stringify(next) !== JSON.stringify(customerConfig); customerConfig = next; if (changed) { logEvent("POLICY", `Customer config re-read: ${customerConfig ? (customerConfig.disabled ? "fixes DISABLED by customer policy" : "managed, fixes allowed") : "unmanaged"}.`); broadcastState(); } } catch { /* keep the last good config */ }
}

// RUN-CU / CU4 (audit P0 #3) — a restore point is REAL or it is honestly "unavailable". The wrapper runs
// src/main/restore-point.mjs's commands through the childProcesses-tracked PowerShell runner and verifies by
// OUTCOME (the restore-point sequence number must increase; Windows silently no-ops inside its 24h throttle).
// Record fields: status ('created' | 'throttled-degraded' | 'unverified-degraded' | 'unavailable' | 'dry-run'),
// created (true ONLY when verified), sequenceNumber, protection, line (the honest copy the UI shows).
const RESTORE_POINT_REUSE_MS = 30 * 60 * 1000; // a verified point we made in the last 30 min protects the next fix too
function restoreCopy(status, seq) {
  switch (status) {
    case "created": return `Restore point #${seq} created and verified — this fix can be undone from System Restore.`;
    case "throttled-degraded": return "Windows already made a restore point in the last 24h and won't make another; the earlier point still protects this fix.";
    case "unverified-degraded": return "Restore point could not be confirmed (System Restore needs administrator rights, or is turned off). Yellow-tier fixes stay in preview until one exists.";
    case "dry-run": return "Dry run — no restore point and no changes were made.";
    default: return "Restore point unavailable on this platform/account — yellow-tier fixes stay in preview.";
  }
}
async function recordRestorePoint(recipeId, name) {
  const now = Date.now();
  const points = store.get("restorePoints") || [];
  const recent = points.find((p) => p && p.created === true && !p.rolledBack && now - Date.parse(p.createdAt) < RESTORE_POINT_REUSE_MS);
  if (recent) {
    logEvent("RESTORE PT", `Reusing verified restore point #${recent.sequenceNumber} (made ${Math.round((now - Date.parse(recent.createdAt)) / 60000)} min ago) before ${recipeId || "fix"}.`, { snapshotId: recent.id, recipeId });
    return { ...recent, reused: true };
  }
  let status = "unavailable", sequenceNumber = null;
  if (process.platform !== "win32") status = "unavailable";
  else if (globalDryRun()) status = "dry-run";
  else if (isThrottled(Number(store.get("lastRestoreCheckpointTs") || 0), now)) status = "throttled-degraded";
  else {
    try {
      const before = sequenceOf(await runPowerShell(RESTORE_COMMANDS.list, 30000));
      await runPowerShell(RESTORE_COMMANDS.create, 120000);
      const after = sequenceOf(await runPowerShell(RESTORE_COMMANDS.list, 30000));
      if (verifyCreated(before, after)) { status = "created"; sequenceNumber = after; store.set("lastRestoreCheckpointTs", now); }
      else status = "unverified-degraded";
    } catch { status = "unverified-degraded"; }
  }
  const created = status === "created";
  const point = {
    id: randomUUID(),
    recipeId: recipeId || "",
    name: safeShortText(name, "ARIA pre-fix"),
    createdAt: new Date(now).toISOString(),
    rolledBack: false,
    status,
    created,
    sequenceNumber,
    protection: created ? "restore-point" : "journal-only",
    line: restoreCopy(status, sequenceNumber)
  };
  points.unshift(point);
  store.set("restorePoints", points.slice(0, 20));
  logEvent("RESTORE PT", created ? `Restore point #${sequenceNumber} created and verified before ${recipeId || "fix"}.` : `Restore point NOT created before ${recipeId || "fix"} (${status}): ${point.line}`, { snapshotId: point.id, recipeId, status });
  return point;
}

function rollbackRestorePoint(snapshotId) {
  const points = store.get("restorePoints") || [];
  const point = points.find((p) => p.id === snapshotId);
  if (!point) return { ok: false, error: "snapshot_not_found" };
  // A real System Restore (Restore-Computer -RestorePoint N) restarts the machine and needs administrator
  // rights — ARIA never restarts your machine on its own. We record the request + the exact point so a person
  // can run it; a record that was never a verified checkpoint is reported as "nothing to roll back to".
  point.rolledBack = true;
  point.rolledBackAt = new Date().toISOString();
  store.set("restorePoints", points);
  const real = point.created === true;
  logEvent("RESTORE PT", real
    ? `Roll back requested to verified restore point #${point.sequenceNumber} (run System Restore to apply; requires a restart).`
    : `Roll back requested for ${snapshotId.slice(0, 8)} — no verified restore point exists for it (nothing to roll back to).`, { snapshotId });
  broadcastState();
  return { ok: true, snapshot: point, real, undone: false, dryRun: globalDryRun(), message: real ? `Use System Restore → point #${point.sequenceNumber} to undo this fix (restart required).` : "No verified restore point exists for this fix, so there is nothing to roll back to." };
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
    kb: { bundleOk: true, version: (store.get("endpointStatus") || []).every((e) => e.ok !== false) }, // null = not available, not a failure
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
    dryRun: globalDryRun(),
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

/**
 * The bridge's POST /run-recipe (the browser extension asks for a fix). KILL GATE 2026-10-14 (review P0-2): the gate is
 * checked here FIRST — a stopped / killed / paused ARIA answers "blocked" without parsing the ask any further. Otherwise
 * routed through runSupervisedFix (R11 → supervisor → policy → approval/countdown); the caller's dryRun / confirmed flags
 * are stripped by sanitizeRunRecipeBody — the bridge can ask, never force.
 */
async function bridgeRunRecipe(rawBody) {
  if (!killGateOpen()) {
    const reason = killGateReason();
    logEvent("KILL-SWITCH", `Bridge /run-recipe refused: ${reason}.`, { source: "bridge" });
    return { ...blockedRecipeResult(reason), verdict: "blocked", countdown: false, copy: describeDecision({ action: "blocked", reason: killGateDecisionReason() }) };
  }
  const body = sanitizeRunRecipeBody(rawBody); // idempotent: the route already sanitized; a direct caller is sanitized here
  return runSupervisedFix({ ...body, mode: "confirmed", risk: (recipeById(body.recipeId) || {}).risk || "medium" });
}

function startBridge() {
  if (bridgeServer?.listening) return;
  bridgeServer = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${BRIDGE_PORT}`);
      // RUN-CU / CU4 (audit P0 #5) — the pure bridge-auth policy: foreign origins are refused everywhere; an EMPTY
      // origin (curl / any local process as the user) may only read /health, /state (scrubbed) and /dist-info;
      // every POST needs an identified extension / loopback origin. The legacy check stays as a second gate.
      const gate = bridgeOriginAllowed({ origin: req.headers.origin, method: req.method, pathname: url.pathname, port: BRIDGE_PORT });
      if (!gate.ok) return sendJson(res, 403, { ok: false, error: gate.reason });
      if (!isAllowedBridgeOrigin(req)) {
        return sendJson(res, 403, { ok: false, error: "origin_blocked" });
      }
      if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true, app: "ARIA Sentinel", version: SENTINEL_VERSION });
      // /state is the SCRUBBED public slice (no transparency log, no license key, no contacts, no prefs).
      if (req.method === "GET" && url.pathname === "/state") return sendJson(res, 200, scrubPublicState(getState()));
      // RUN 23c — current dist .exe metadata for the admin console's 1-click publish (local, read-only).
      if (req.method === "GET" && url.pathname === "/dist-info") return sendJson(res, 200, readDistInfo());
      if (req.method === "POST" && url.pathname === "/signature") return sendJson(res, 200, { ok: true, signature: sanitizeToSignature(await readJson(req)) });
      if (req.method === "POST" && url.pathname === "/detect") return sendJson(res, 200, await detectIssue(await readJson(req)));
      // JULY PORT 2026-10-14 (a7f9e111) — the extension reports a content-blind issue outcome; the fleet packet is local-only.
      if (req.method === "POST" && url.pathname === "/browser-outcome") return sendJson(res, 200, recordBrowserOutcome(await readJson(req)));
      if (req.method === "GET" && url.pathname === "/browser-outcomes/fleet-packet") return sendJson(res, 200, browserOutcomeFleetPacketNow());
      if (req.method === "POST" && url.pathname === "/run-recipe") {
        // KILL GATE (review P0-2) — bridgeRunRecipe answers "blocked" while the gate is closed; otherwise the ask goes
        // through the supervised pipeline (R11 → supervisor → policy → approval/countdown). The caller's dryRun /
        // confirmed flags are stripped by sanitizeRunRecipeBody — the bridge can ask, never force.
        return sendJson(res, 200, await bridgeRunRecipe(sanitizeRunRecipeBody(await readJson(req))));
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
      if (req.method === "POST" && url.pathname === "/knowledge/update") return sendJson(res, 200, await updateKnowledge({ manual: true }));
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
  if (mode === "autonomous") {
    logEvent("MODE", "Autonomous mode enabled via explicit opt-in.");
    scanFileAssociationGuard("mode-autonomous").catch(() => undefined); // JULY PORT 2026-10-14 — immediate read-only re-check
  }
  // RUN-CU / CU4 — keep the autonomy level in step with a manual Mode change (one truth, two controls):
  // autonomous → full-auto · confirmed → safe-auto · manual → approve-first. Business clamp still applies.
  try {
    const levelFor = { autonomous: "full-auto", confirmed: "safe-auto", manual: "approve-first" }[mode];
    const cur = setupPrefsNow();
    if (levelFor && cur.autonomyLevel !== levelFor && !(mode === "manual" && cur.autonomyLevel === "observe")) {
      store.set("setupConfig", updateSetupPrefs(readSetupConfig(), { autonomyLevel: levelFor, fullAutoUnderstood: mode === "autonomous" ? true : cur.fullAutoUnderstood === true }));
    }
  } catch { /* level sync is best-effort */ }
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
ipcMain.handle("sentinel:globe-confirm-test", (_e, input = {}) => {
  // (audit M32) a REAL ticket + a REAL email from a test button is a dev-only affordance; packaged builds refuse it.
  if (!devModeNow()) return { show: false, reason: "not-available-in-this-build" };
  return emitGlobeConfirmation({
    issueTitle: (input && input.issueTitle) || "DNS lookup failed",
    sessionId: (input && input.sessionId) || `test-${Date.now()}`
  });
});
ipcMain.handle("sentinel:set-dry-run", (_event, dryRun) => {
  store.set("dryRun", Boolean(dryRun));
  broadcastState();
  return { ok: true, state: getState() };
});
ipcMain.handle("sentinel:detect", (_event, input) => detectIssue(input));
// PROD 2026-10-14 (audit M18) — the direct channel is PREVIEW-ONLY. The renderer only ever passes dryRun:true here;
// anything that should change the device goes through sentinel:supervised-fix (R11 → supervisor → policy →
// approval/countdown → executor). Forcing dryRun keeps a forged/stale caller from skipping those gates.
ipcMain.handle("sentinel:run-recipe", (_event, recipeId, options) => runRecipe(recipeId, { ...(options || {}), dryRun: true, elevation: "none" }));
// PROD 2026-10-14 (audit M1) — the persisted, audited live-fix consent (Settings toggle / wizard step).
ipcMain.handle("sentinel:get-live-fixes", () => liveFixesStatus());
ipcMain.handle("sentinel:set-live-fixes", (_event, payload) => setLiveFixes(payload));
// Cancel a pending pre-execution countdown by id (or all of them). Same effect as the ABORT button / Ctrl+Alt+K.
ipcMain.handle("sentinel:cancel-countdown", (_event, payload) => cancelCountdown(payload && typeof payload === "object" ? payload.id : payload));
ipcMain.handle("sentinel:chat", (_event, message, context) => chat(message, context || {}));
// RUN 33 — ARIA tab data surfaces. Network ones (status/learning) fetch read-only stats (no chat content sent);
// local ones (memory/agents) read on-device files. All parsing + R11 scrub happens in the shared parsers.
ipcMain.handle("aria:status", async () => {
  // D4 — Health must reflect the DESKTOP's real posture (this build ships externalAiCalls:false), so the
  // Anthropic tier renders OFF/disabled instead of a green "metered · novel only" that would contradict the
  // Control Center content-boundary and the D1 abstain behavior.
  const opts = { externalAiEnabled: getState().externalAiCalls === true };
  try {
    const r = await outbound.fetch("https://iisupp.net/.netlify/functions/aria-system-status", { headers: { "user-agent": "aria-sentinel" }, signal: AbortSignal.timeout?.(8000) });
    return { ok: r.ok, data: parseSystemStatus(r.ok ? await r.json() : null, opts) };
  } catch { return { ok: false, data: parseSystemStatus(null, opts) }; }
});
ipcMain.handle("aria:learning", async () => {
  try {
    const r = await outbound.fetch("https://iisupp.net/.netlify/functions/aria-kb-stats", { headers: { "user-agent": "aria-sentinel" }, signal: AbortSignal.timeout?.(8000) });
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
  // (audit M32) the agent heartbeats live in the developer's vault beside the dev checkout; a packaged customer
  // build has no such folder and must not go looking for it.
  if (!devModeNow()) return { ok: true, data: parseHeartbeats([]) };
  try {
    const dir = path.join(app.getAppPath(), "..", "aria-vault", "11_CorpusCallosum", "agent-heartbeats");
    const beats = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return null; } }).filter(Boolean);
    return { ok: true, data: parseHeartbeats(beats) };
  } catch { return { ok: true, data: parseHeartbeats([]) }; }
});
ipcMain.handle("sentinel:scan", () => scanDisk());
ipcMain.handle("sentinel:update-knowledge", () => updateKnowledge({ manual: true }));
// JULY PORT 2026-10-14 (ddfcac5b) — the read-only .txt association guard: a manual re-check, and the ONE guide action
// (open Windows Default Apps for the person to pick Notepad; ARIA writes nothing; refused while paused/killed).
ipcMain.handle("sentinel:file-association-scan", () => scanFileAssociationGuard("manual"));
ipcMain.handle("sentinel:file-association-fix", (_event, recipeId) => openDefaultAppsForTextFiles(recipeId));
// JULY PORT 2026-10-14 (af5e03ab) — the Office File Safety Net (opt-in): status · enable/disable · scan now · register a file.
ipcMain.handle("sentinel:office-safety-status", () => officeSafetyStatus());
ipcMain.handle("sentinel:office-safety-set-enabled", (_event, on) => setOfficeSafetyEnabled(on));
ipcMain.handle("sentinel:office-safety-scan", () => scanOfficeSafety());
ipcMain.handle("sentinel:office-safety-register-file", (_event, filePath) => registerOfficeSafetyFile(filePath));
ipcMain.handle("sentinel:incident", (_event, recipeId, context) => makeIncident(recipeId, context || {}));
ipcMain.handle("sentinel:self-diagnose", (_event, reason) => selfDiagnose(reason || "renderer"));
ipcMain.handle("sentinel:self-repair", (_event, reason) => selfRepair(reason || "renderer"));
// (F3 round 2) overlay hover-forward: over=true → interactive, over=false → click-through with forwarded mousemove.
ipcMain.handle("sentinel:overlay-hover", (_event, payload) => setOverlayHover(Boolean(payload && typeof payload === "object" ? payload.over : payload)));
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
ipcMain.handle("sentinel:get-integrations", () => ({ items: resolveIntegrations(process.env) })); // Integrations tab — read-only status
ipcMain.handle("sentinel:integration-test", (_event, id) => runIntegrationTest(String(id || ""), process.env)); // read-only per-card test
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
// PROD 2026-10-14 (audit M20) — hotkey preferences: { enabled, altGrSafe, killSwitch } (all optional booleans).
ipcMain.handle("sentinel:get-hotkey-prefs", () => ({ ok: true, prefs: store.get("hotkeyPrefs") || {}, status: hotkeyStatus }));
ipcMain.handle("sentinel:set-hotkey-prefs", (_event, prefs) => {
  const p = prefs && typeof prefs === "object" ? prefs : {};
  const next = { ...(store.get("hotkeyPrefs") || {}) };
  for (const k of ["enabled", "altGrSafe", "killSwitch"]) if (typeof p[k] === "boolean") next[k] = p[k]; else if (p[k] === null) delete next[k];
  store.set("hotkeyPrefs", next);
  registerHotkeys();
  logEvent("HOTKEY", `Hotkey preferences updated (${Object.keys(next).map((k) => `${k}=${next[k]}`).join(", ") || "defaults"}).`);
  broadcastState();
  return { ok: true, prefs: next, status: hotkeyStatus };
});
ipcMain.handle("sentinel:enter-license", async (_event, payload) => enterLicense(payload || {})); // RUN 24 A6 — async (server resolve)
ipcMain.handle("sentinel:logout", () => logoutLicense());
ipcMain.handle("sentinel:choose-plan", (_event, tier, opts) => openPlanCheckout(tier, opts && typeof opts === "object" ? opts : {}));
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
// P5/P6 (2026-07-14) — chat escalation. When a user says "not yet" and asks to connect a technician, mint a REAL
// ticket reference (IIS-YYYYMMDD-NNN, or a ServiceNow number when that bridge is live for a matched recipe), log
// it to the transparency log so it surfaces in Dashboard → Activity, and return the ref for the chat bubble.
// Real-or-empty: the ref is minted + recorded exactly like a resolve ticket; nothing is faked.
ipcMain.handle("sentinel:escalate-ticket", async (_event, payload = {}) => {
  let snNumber = "";
  const recipeId = String((payload && payload.recipeId) || "");
  if (recipeId) {
    try { const r = await serviceNowRaiseIncident(recipeId, { intent: String((payload && payload.issue) || "").slice(0, 200) }); if (r && r.ok && r.number) snNumber = String(r.number); }
    catch { /* ServiceNow best-effort; a local ref is always minted below */ }
  }
  const { ref, source } = mintAndRecordTicketRef(snNumber);
  logEvent("ESCALATE", `Escalation ticket ${ref} opened from a chat question (${source}).`, { ref, source });
  broadcastState();
  return { ok: true, ref, source };
});
// P5 — record a KB "miss" (the user said the answer didn't fix it) to the local learning loop so weak answers are
// visible + improvable. Content-blind: we store only the outcome + match score, never the raw question off-device.
ipcMain.handle("sentinel:answer-miss", (_event, payload = {}) => {
  try {
    const score = Number(payload && payload.matchScore);
    const misses = store.get("answerMisses") || [];
    misses.unshift({ ts: new Date().toISOString(), matchScore: Number.isFinite(score) ? score : null });
    store.set("answerMisses", misses.slice(0, 500));
    logEvent("FEEDBACK", "Answer marked not-yet — logged a KB miss for review.");
    return { ok: true, count: misses.length };
  } catch { return { ok: false }; }
});
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
  // (audit M28) the title says what the export CONTAINS: the hot rows and their real date range, not "30 days".
  const oldest = log.length ? String(log[log.length - 1].ts || "").slice(0, 10) : "";
  const newest = log.length ? String(log[0].ts || "").slice(0, 10) : "";
  const title = log.length ? `ARIA Sentinel — audit (${log.length} rows, ${oldest} to ${newest})` : "ARIA Sentinel — audit (no rows yet)";
  const content = kind === "pdf" ? auditToPdf(title, log) : auditToCsv(log);
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
// RUN-CU / CU4 — apply the autonomy level onto the EXISTING mode machine. observe/approve-first → manual (with
// notifications), safe-auto → confirmed, full-auto → autonomous ONLY with the explicit "I understand" opt-in
// (canEnableAutonomous — the same guard the Mode modal uses); without it the level stays but the mode is
// clamped to confirmed and the person is told. Returns what was actually applied (Rule 14).
function applyAutonomyLevel(prefs, optIn = {}) {
  const auto = resolveAutonomy(prefs);
  const map = autonomyLevelToMode(auto.level);
  let mode = map.mode;
  let note = auto.clamped ? auto.reason : "";
  if (mode === "autonomous" && !canEnableAutonomous(optIn)) { mode = "confirmed"; note = "Full-auto needs the explicit \"I understand\" opt-in — running as safe-auto (confirmed) until then."; }
  store.set("mode", mode);
  applyModeBehavior(mode);
  refreshTray();
  if (mode === "autonomous") logEvent("MODE", "Autonomous mode enabled via the Setup wizard's explicit opt-in (full-auto).");
  logEvent("AUTONOMY", `Autonomy level ${auto.level}${auto.clamped ? " (clamped)" : ""} → mode ${mode}.${note ? " " + note : ""}`);
  return { level: auto.level, mode, clamped: auto.clamped, note };
}
ipcMain.handle("setup:complete", (_event, prefs) => {
  const cfg = completeSetup(readSetupConfig(), prefs || {});
  store.set("setupConfig", cfg);
  // Apply the chosen default mode — but NEVER autonomous silently (that needs the explicit opt-in modal).
  const m = cfg.setup.prefs.mode;
  if (m === "manual" || m === "confirmed") { store.set("mode", m); applyModeBehavior(m); refreshTray(); }
  // RUN-CU / CU4 — the v2 autonomy level (when the wizard set one) maps onto the mode, opt-in guarded.
  let applied = null;
  if (prefs && typeof prefs === "object" && "autonomyLevel" in prefs) applied = applyAutonomyLevel(cfg.setup.prefs, { understood: cfg.setup.prefs.fullAutoUnderstood === true });
  logEvent("SETUP", "Setup wizard completed.");
  broadcastState();
  // (audit M17) consent just arrived: the deferred launch-time telemetry runs now, once.
  setTimeout(() => {
    sendHeartbeat().catch(() => undefined);
    runUpdateCheck("launch").catch(() => undefined);
    updateKnowledge().catch(() => undefined);
    if (crashReporter && typeof crashReporter.flush === "function") crashReporter.flush().catch(() => undefined);
    refreshLicense().catch(() => undefined); // REVIEW P2-9 — a pre-seeded licence is checked now, not before consent
  }, 1500).unref?.();
  return { ok: true, setup: cfg.setup, applied };
});
ipcMain.handle("setup:reopen", () => {
  store.set("setupConfig", reopenSetup(readSetupConfig()));
  broadcastState();
  return { ok: true };
});
// RUN-CU / CU4 — read the sanitized wizard prefs (v1 + v2) + the resolved autonomy, and update them later from
// Settings → Autonomy & contacts (partial updates merge; everything re-sanitized; mode re-mapped when the level changes).
ipcMain.handle("setup:get", () => ({ ok: true, prefs: setupPrefsNow(), autonomy: autonomyNow(), platformCapabilities: platformCapabilities(process.platform) }));
ipcMain.handle("setup:update-prefs", (_event, partial) => {
  const cfg = updateSetupPrefs(readSetupConfig(), partial || {});
  store.set("setupConfig", cfg);
  let applied = null;
  if (partial && typeof partial === "object" && ("autonomyLevel" in partial || "techContacts" in partial || "identity" in partial)) {
    applied = applyAutonomyLevel(cfg.setup.prefs, { understood: cfg.setup.prefs.fullAutoUnderstood === true });
  }
  logEvent("SETUP", `Autonomy & contacts updated (${Object.keys(partial || {}).filter((k) => k !== "fullAutoUnderstood").join(", ") || "no fields"}).`);
  broadcastState();
  return { ok: true, prefs: cfg.setup.prefs, autonomy: autonomyNow(), applied };
});
// RUN-CU / CU4 — approvals: approve runs the fix through the supervised pipeline with the approval in place of
// the countdown; deny records the decision and NEVER executes. Both are gated under Control Center in the renderer.
ipcMain.handle("sentinel:approve-fix", async (_event, payload) => {
  const id = String((payload && payload.id) || payload || "");
  const r = await approvals.approve(id, { decidedBy: "self", channel: "desktop" });
  broadcastState();
  return r;
});
ipcMain.handle("sentinel:deny-fix", async (_event, payload) => {
  const id = String((payload && payload.id) || payload || "");
  const r = await approvals.deny(id, { decidedBy: "self", channel: "desktop" });
  broadcastState();
  return r;
});
ipcMain.handle("sentinel:list-approvals", () => approvals.forState());
// ADVISORY ESCALATION (2026-10-14) — the three choices on a notice + the advise-first prefs (Settings → Autonomy).
ipcMain.handle("sentinel:advisory-ack", (_event, payload) => handleAdvisoryAck(payload));
ipcMain.handle("sentinel:get-advisory-prefs", () => advisoryPrefsPayload());
ipcMain.handle("sentinel:set-advisory-prefs", (_event, payload) => setAdvisoryPrefs(payload));
// RUN-CU / CU4 (fix f) — the "Keep fixes in dry-run" checkbox finally has a writer. true = always preview;
// false = live (still gated); unset = follow the mode (RUN 29-A default).
ipcMain.handle("sentinel:set-keep-dry-run", (_event, on) => {
  if (on === null || on === undefined) store.delete("keepSystemFixesDryRun"); else store.set("keepSystemFixesDryRun", Boolean(on));
  logEvent("POLICY", on === null || on === undefined ? "Dry-run keep flag cleared (follows the mode)." : `Keep system fixes in dry-run: ${Boolean(on) ? "ON (preview only)" : "OFF (live, gated)"}.`);
  broadcastState();
  return { ok: true, keepSystemFixesDryRun: store.get("keepSystemFixesDryRun") };
});
// RUN-CU / CU4 — voice "yes" from the companion / ARIA tab: approves the matching pending ask (in-app channel).
ipcMain.handle("sentinel:voice-approve", async (_event, payload) => {
  const recipeId = String((payload && payload.recipeId) || "");
  const pending = approvals.pending().find((a) => a.recipeId === recipeId);
  if (!pending) return { ok: false, reason: "no-pending-approval" };
  const r = await approvals.approve(pending.id, { decidedBy: "self", channel: "voice" });
  broadcastState();
  return r;
});
ipcMain.handle("sentinel:ingest-kb", (_event, file) => ingestKnowledgeFile(file || {}));
// PROD 2026-10-14 (audit M15) — configurable excluded folders (names only; never paths; never the locked default).
ipcMain.handle("sentinel:get-excluded-folders", () => ({ ok: true, count: excludedFolderCount(), label: excludedFoldersLabel(), configured: configuredExcludedFolders() }));
ipcMain.handle("sentinel:set-excluded-folders", (_event, names) => {
  const list = (Array.isArray(names) ? names : []).map((n) => String(n == null ? "" : n).trim().slice(0, 120)).filter(Boolean).slice(0, 50);
  store.set("excludedFolders", list);
  configureExcludedFolders(list);
  logEvent("SECURITY", `Excluded-folder list updated: ${excludedFolderCount()} folder(s) excluded (names stay on this device).`);
  broadcastState();
  return { ok: true, count: excludedFolderCount(), label: excludedFoldersLabel(), configured: configuredExcludedFolders() };
});
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
ipcMain.handle("sentinel:preview-tier0", (_event, id) => { const r = tier0ById(id, process.platform); return r ? previewTier0(r) : { ok: false, error: "not_found" }; });
// RUN-CU / CU4 — send a real test notification through every configured channel and report what happened
// (desktop shown / email sent|dormant|failed / sms sent|dormant|failed). Nothing is ever claimed "sent" unless it was.
ipcMain.handle("sentinel:test-notification", async () => notifyEvent("issue-detected", { title: "Test notification from ARIA Sentinel", recipeId: "sentinel-test", severity: "green" }, { force: true }));
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
// PROD 2026-10-14 (F3 round 2) — open the local reports folder in the OS file manager. The raw path never goes to the renderer.
ipcMain.handle("sentinel:open-reports-folder", async () => {
  try {
    const dir = REPORTS_DIR();
    fs.mkdirSync(dir, { recursive: true });
    const err = await shell.openPath(dir); // "" on success, an error string otherwise
    if (err) { logEvent("REPORT", "Could not open the reports folder."); return { ok: false, path: null }; }
    logEvent("REPORT", "Opened the reports folder.");
    return { ok: true, path: null };
  } catch { return { ok: false, path: null }; }
});
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
// RUN-CU / CU4 (fix k) — platform-aware: Windows = the 5 PowerShell executor bindings; macOS = the user-level darwin
// Tier-0 set; anywhere else nothing is vetted to auto-apply (the renderer routes to the guided walk-through).
ipcMain.handle("sentinel:is-vetted", (_event, recipeId) => {
  const id = String(recipeId || "");
  if (process.platform === "darwin") return { vetted: isDarwinTier0(id), platform: "darwin" };
  if (process.platform === "win32") return { vetted: Boolean(resolveExecutorId(id)), platform: "win32" };
  return { vetted: false, platform: process.platform, reason: "no fix engine on this platform — guided only" };
});
// Allowlist for shell.openExternal. The companion's `open` steps open the user's BROWSER to an OFFICIAL vendor
// site (their pricing / sign-up) — this is the USER's click launching their own browser, NOT an app network
// call and NOT an account/payment action by the agent (those stay the user's, always). Host-anchored so only
// these exact official domains are ever opened. No paid API is called from here.
// AI-tool vendor pages + the IT-setup official pages the Walk-through launcher opens (Microsoft 365 / OneDrive /
// Copilot / MFA / the browser-extension stores). Host-anchored, https-only, user-initiated browser opens only —
// never an app network call, account, or payment action. Kept in sync with the flow `open` URLs (proven by
// tests/walkthrough-open-live.test.mjs, which asserts every flow URL matches this allowlist).
const OPEN_EXTERNAL_ALLOW = /^https:\/\/(iisupp\.net|[\w.-]+\.service-now\.com|(www\.)?anthropic\.com|claude\.ai|(www\.)?openai\.com|chatgpt\.com|gemini\.google\.com|ai\.google\.dev|(www\.)?perplexity\.ai|(www\.)?microsoft\.com|support\.microsoft\.com|copilot\.microsoft\.com|(www\.)?microsoft365\.com|aka\.ms|chromewebstore\.google\.com|microsoftedge\.microsoft\.com)(\/|$)/;
// PROD 2026-10-14 (audit M10) — the Settings → Support buttons send mailto:/tel:/WhatsApp links to the company's own
// address, number and WhatsApp line; the https-only regex above silently dropped all three ("Call now" did nothing).
// Exact-shape, company-only: a mailto to any other domain, any other number, or any other wa.me line is refused.
export const OPEN_EXTERNAL_CONTACT_ALLOW = /^(mailto:[A-Za-z0-9._%+-]+@iisupp\.net(\?subject=[A-Za-z0-9%+._-]{0,120})?|tel:\+1647\d{7}|https:\/\/wa\.me\/1647\d{7})$/;
export function isOpenExternalAllowed(url) {
  return typeof url === "string" && (OPEN_EXTERNAL_ALLOW.test(url) || OPEN_EXTERNAL_CONTACT_ALLOW.test(url));
}
ipcMain.handle("sentinel:open-external", (_event, url) => {
  if (typeof url === "string" && (OPEN_EXTERNAL_ALLOW.test(url) || OPEN_EXTERNAL_CONTACT_ALLOW.test(url))) {
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
// Companion → open the assistant panel on the floating globe overlay (companion mode). Clears any un-consumed
// launcher flow first, so a plain globe click always lands on the menu (never resumes a stale launcher flow).
ipcMain.handle("sentinel:open-companion", () => { pendingCompanionFlow = null; showOverlay({ companion: true }); return { ok: true }; });
// Walk-through LAUNCHER (2026-07-14) → open a SPECIFIC guided flow UNDER the floating globe (not in the app
// window). Stash the id so the overlay renderer can pull it on companion-mode entry (freshly-shown race), AND
// push it directly for the already-open case. Guide/setup changes nothing on the machine; `open` steps launch
// the user's browser via the host-anchored allowlist, and account/pay steps stay the user's own hard-stops.
ipcMain.handle("sentinel:open-companion-flow", (_event, flowId) => {
  const id = String(flowId || "");
  if (!id) return { ok: false, error: "no-flow" };
  pendingCompanionFlow = id;
  showOverlay({ companion: true });               // shows the overlay even if the ambient globe is hidden
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try { overlayWindow.webContents.send("sentinel:companion-flow", { flowId: id }); } catch { /* overlay gone → pull covers it */ }
  }
  return { ok: true, flowId: id };
});
// The overlay pulls (and clears) the pending launcher flow when it enters companion mode — flash-free start.
ipcMain.handle("sentinel:get-companion-flow", () => { const f = pendingCompanionFlow; pendingCompanionFlow = null; return f; });
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
    crashReporter = installCrashReporter({ version: SENTINEL_VERSION, crashFile: path.join(os.homedir(), ".aria-sentinel", "crash.log"), endpoint: "https://iisupp.net/.netlify/functions/sentinel-crash", fs, log: logEvent,
      fetchImpl: outbound.fetch, canSend: telemetryAllowed, headers: () => { const h = { "x-sentinel-device": deviceIdHash() }; const k = licenseKeyHash(); if (k) h["x-sentinel-key"] = k; return h; } });
    createMainWindow();
    createOverlayWindow();
    createTray();
    if (isStartupLaunch(process.argv)) logEvent("STARTUP", "Launched at logon (--startup): window stays hidden; globe + watchers run.");
    ensureTrialStarted();
    try { maybeStampPilotTtfv(); } catch { /* RUN-E E1 — catch a first fix recorded in an earlier session; never blocks startup */ }
    try { maybeAutorunCaseStudy(); } catch { /* RUN-E E2 — a pilot that matured between sessions drafts its proof at startup; never blocks */ }
    refreshLicense().catch(() => undefined); // RUN 24 A6 — silent server-side re-verify (skips network if a signed cache is fresh; before Setup consent it sends nothing — review P2-9)
    showOverlay({ expanded: false });
    applyModeBehavior(store.get("mode"));
    startBridge();
    // KILL GATE 2026-10-14 (review P0-2) — a relaunch never re-arms a stopped ARIA: watchers + the Office Safety Net stay
    // off (and every execution path stays refused) until the person presses Start ARIA.
    const launchedWatching = startDetectionAtLaunch();
    startFileAssociationGuard(); // JULY PORT 2026-10-14 — read-only .txt association guard (Windows only)
    if (launchedWatching) startOfficeSafety(); // JULY PORT 2026-10-14 — Office Safety Net: runs ONLY when the person turned it on
    startProcessHealth(); // RUN 23 — 30s content-blind process-health poll feeding the globe status panel
    serviceNowDrain().catch(() => undefined); // flush any incidents queued while offline
    selfDiagnose("startup").catch((error) => handleSelfError(error, "startup-diagnose"));
    scanDisk().catch((error) => handleSelfError(error, "startup-scan"));
    setInterval(() => {
      selfDiagnose("interval").catch((error) => handleSelfError(error, "interval-diagnose"));
    }, 5 * 60 * 1000).unref?.();
    // Health Score is refreshed every 60s so the tray tooltip stays current between detections.
    // REVIEW P1-3 — the same minute tick raises the trial clock's high-water mark (a clock rolled back never lowers it).
    setInterval(() => { refreshHealthScore(); touchSlaLastSeen(); touchClockHighWater(); }, 60 * 1000).unref?.();
    recordLaunchGapAsDowntime(); // (audit M12) a gap > 2 min since the last heartbeat-minute is real downtime
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
    // RUN-CU / CU4 (audit P0 #2) — the control plane (fleet kill directive) is read at LAUNCH and every 24h, not
    // only when someone clicks "Update knowledge". The heartbeat reply is parsed for {killed} as well.
    updateKnowledge().catch(() => undefined);
    setInterval(updateTick, 60 * 60 * 1000).unref?.(); // hourly: advance strikes + take AUTO opportunities
    // (audit M22) the license is re-verified on the SAME daily tick (and on wake), not only at launch — a desktop
    // left running for days no longer degrades to the free tier with the network fine.
    setInterval(() => { runUpdateCheck("daily").catch(() => undefined); sendHeartbeat().catch(() => undefined); healStartupIfNeeded().catch(() => undefined); refreshLicense().catch(() => undefined); updateKnowledge().catch(() => undefined); }, 24 * 60 * 60 * 1000).unref?.();
    // RUN-CU / CU4 — approvals: expire overdue asks + poll remote decisions while anything is pending; aggregate
    // report (daily/weekly per reportCadence) on launch + hourly.
    if (approvals.pending().length) ensureApprovalPolling();
    // ADVISORY ESCALATION (2026-10-14) — resume persisted escalations conservatively + start the one 15 s interval.
    startAdvisoryEscalation();
    setTimeout(() => maybeSendAggregateReport().catch(() => undefined), 20 * 1000).unref?.();
    setInterval(() => maybeSendAggregateReport().catch(() => undefined), 60 * 60 * 1000).unref?.();
    try { powerMonitor.on("resume", () => { runUpdateCheck("wake").catch(() => undefined); refreshLicense().catch(() => undefined); }); } catch { /* powerMonitor may be unavailable */ }
    // (audit M25) organization policy: file at launch + watched + daily; customer.json re-read daily.
    loadPolicyOverlayFromDisk("launch");
    watchPolicyFile();
    setInterval(() => { loadPolicyOverlayFromDisk("daily"); reloadCustomerConfig(); }, 24 * 60 * 60 * 1000).unref?.();
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
  if (webContents === mainWindow?.webContents && !isQuitting) {
    // (audit M30) destroy the dead window before recreating — never a second mainWindow beside a zombie.
    try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy(); } catch { /* already gone */ }
    mainWindow = null;
    createMainWindow();
  }
});

app.on("child-process-gone", (_event, details) => {
  handleSelfError(new Error(`Child process gone: ${details.type}`), "child-process");
});

/**
 * REVIEW P2-6 — quitting during a pre-execution countdown CANCELS that fix (audited): the countdown is aborted before the
 * process goes (an advise-first auto-fix is then closed as "countdown-cancelled" by its own abort listener — it does not
 * come back after the relaunch). Returns how many were cancelled.
 */
function cancelCountdownsForQuit() {
  let n = 0;
  try { n = countdownManager.abortAll(); } catch { n = 0; }
  if (n) { try { closeActionIndicator(); } catch { /* window may be gone */ } logEvent("CANCEL", `ARIA is quitting during ${n} countdown(s) — ${n === 1 ? "that fix was" : "those fixes were"} cancelled; nothing ran.`, { quit: true, cancelled: n }); }
  return n;
}
app.on("before-quit", () => {
  cancelCountdownsForQuit();
  isQuitting = true;
  stopOverlayPhysics();
  try { globalShortcut.unregisterAll(); } catch { /* nothing registered */ }
  if (fileAssociationGuardTimer) { clearInterval(fileAssociationGuardTimer); fileAssociationGuardTimer = null; } // JULY PORT 2026-10-14
  if (officeSafetyService) { try { officeSafetyService.stop(); } catch { /* stopping never blocks quit */ } } // JULY PORT 2026-10-14
  if (advisoryTimer) { clearInterval(advisoryTimer); advisoryTimer = null; } // ADVISORY ESCALATION — state is already persisted
  if (detectionOrchestrator) detectionOrchestrator.stopAll();
  if (adminWindow && !adminWindow.isDestroyed()) adminWindow.destroy();
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  if (bridgeServer) bridgeServer.close();
});
