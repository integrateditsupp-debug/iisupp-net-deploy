// Preload runs in Electron's sandboxed context, which loads it as CommonJS — NOT ESM.
// (An ESM `import` here fails with "Cannot use import statement outside a module", which
// silently drops window.sentinel and forces the renderer onto its preview stub.)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sentinel", {
  getState: () => ipcRenderer.invoke("sentinel:get-state"),
  setMode: (mode, optIn) => ipcRenderer.invoke("sentinel:set-mode", mode, optIn),
  pauseAutonomous: (choice) => ipcRenderer.invoke("sentinel:pause-autonomous", choice),
  setNotify: (config) => ipcRenderer.invoke("sentinel:set-notify", config),
  testNotify: () => ipcRenderer.invoke("sentinel:test-notify"),
  setDryRun: (dryRun) => ipcRenderer.invoke("sentinel:set-dry-run", dryRun),
  detect: (input) => ipcRenderer.invoke("sentinel:detect", input),
  runRecipe: (recipeId, options) => ipcRenderer.invoke("sentinel:run-recipe", recipeId, options),
  chat: (message, context) => ipcRenderer.invoke("sentinel:chat", message, context),
  ariaStatus: () => ipcRenderer.invoke("aria:status"),      // RUN 33 — ARIA tab data surfaces
  ariaLearning: () => ipcRenderer.invoke("aria:learning"),
  ariaMemory: () => ipcRenderer.invoke("aria:memory"),
  ariaAgents: () => ipcRenderer.invoke("aria:agents"),
  scan: () => ipcRenderer.invoke("sentinel:scan"),
  updateKnowledge: () => ipcRenderer.invoke("sentinel:update-knowledge"),
  selfDiagnose: (reason) => ipcRenderer.invoke("sentinel:self-diagnose", reason),
  selfRepair: (reason) => ipcRenderer.invoke("sentinel:self-repair", reason),
  showGlobe: () => ipcRenderer.invoke("sentinel:show-globe"),
  dismissOverlay: () => ipcRenderer.invoke("sentinel:dismiss-overlay"),
  openAdminConsole: () => ipcRenderer.invoke("sentinel:open-admin-console"),
  setPaused: (milliseconds) => ipcRenderer.invoke("sentinel:set-paused", milliseconds),
  reportError: (payload) => ipcRenderer.invoke("sentinel:report-error", payload),
  createIncident: (recipeId, context) => ipcRenderer.invoke("sentinel:incident", recipeId, context),
  serviceNowTest: () => ipcRenderer.invoke("sentinel:sn-test"),
  serviceNowRaise: (recipeId, context) => ipcRenderer.invoke("sentinel:sn-raise", recipeId, context),
  serviceNowList: () => ipcRenderer.invoke("sentinel:sn-list"),
  getIntegrations: () => ipcRenderer.invoke("sentinel:get-integrations"), // W5 — Integrations tab (read-only status)
  testIntegration: (id) => ipcRenderer.invoke("sentinel:integration-test", id), // W5 Slice 2 — read-only test
  getProofMetrics: () => ipcRenderer.invoke("sentinel:get-proof-metrics"), // G-METRICS — real measured proof numbers
  getOmniStatus: () => ipcRenderer.invoke("sentinel:omni-status"), // G-OMNI — Slack/Teams config status (honest)
  omniMessage: (message) => ipcRenderer.invoke("sentinel:omni-message", message), // G-OMNI — hosted read-only handler
  serviceNowComment: (incidentSysId, comment) => ipcRenderer.invoke("sentinel:sn-comment", incidentSysId, comment),
  rollback: (snapshotId) => ipcRenderer.invoke("sentinel:rollback", snapshotId),
  completeOnboarding: () => ipcRenderer.invoke("sentinel:complete-onboarding"),
  completeSetup: (prefs) => ipcRenderer.invoke("setup:complete", prefs), // RUN 33-E — first-launch wizard
  reopenSetup: () => ipcRenderer.invoke("setup:reopen"),
  runDiagnostic: () => ipcRenderer.invoke("sentinel:run-diagnostic"),
  privacyCapture: (windowMs) => ipcRenderer.invoke("sentinel:privacy-capture", windowMs),
  exportEvidence: () => ipcRenderer.invoke("sentinel:export-evidence"),
  exportAudit: (kind) => ipcRenderer.invoke("sentinel:export-audit", kind),
  setLowPower: (on) => ipcRenderer.invoke("sentinel:set-low-power", on),
  getSettings: () => ipcRenderer.invoke("sentinel:get-settings"),
  setShowFloatingGlobe: (on) => ipcRenderer.invoke("sentinel:set-show-floating-globe", on),
  enterLicense: (payload) => ipcRenderer.invoke("sentinel:enter-license", payload),
  logout: () => ipcRenderer.invoke("sentinel:logout"),
  choosePlan: (tier) => ipcRenderer.invoke("sentinel:choose-plan", tier),
  openPlanPicker: () => ipcRenderer.invoke("sentinel:open-plan-picker"),
  installUpdate: () => ipcRenderer.invoke("sentinel:install-update"),
  rollbackUpdate: (version) => ipcRenderer.invoke("sentinel:rollback-update", version),
  updateHistory: () => ipcRenderer.invoke("sentinel:update-history"),
  setAutoUpdate: (on) => ipcRenderer.invoke("sentinel:set-auto-update", on),
  onUpdateAvailable: (cb) => { const l = (_e, info) => cb(info); ipcRenderer.on("update:available", l); return () => ipcRenderer.removeListener("update:available", l); },
  startTrial: (email) => ipcRenderer.invoke("sentinel:start-trial", email),
  checkUpdates: () => ipcRenderer.invoke("sentinel:check-updates"),
  manageSubscription: () => ipcRenderer.invoke("sentinel:manage-subscription"),
  ackWhatsNew: () => ipcRenderer.invoke("sentinel:ack-whats-new"),
  openMacPermissions: (pane) => ipcRenderer.invoke("sentinel:open-mac-permissions", pane),
  startAria: () => ipcRenderer.invoke("sentinel:start-aria"),
  stopAria: () => ipcRenderer.invoke("sentinel:stop-aria"),
  selfHeal: () => ipcRenderer.invoke("sentinel:self-heal"),
  hotkeyStatus: () => ipcRenderer.invoke("sentinel:hotkey-status"),
  rebindHotkey: (id, combo) => ipcRenderer.invoke("sentinel:rebind-hotkey", id, combo),
  onFocusChat: (cb) => { const l = () => cb(); ipcRenderer.on("focus-chat", l); return () => ipcRenderer.removeListener("focus-chat", l); },
  ingestKb: (file) => ipcRenderer.invoke("sentinel:ingest-kb", file),
  openExternal: (url) => ipcRenderer.invoke("sentinel:open-external", url),
  // RUN 19 — triple-confirm delete prefs + panic kill-switch.
  getDeletePrefs: () => ipcRenderer.invoke("sentinel:get-delete-prefs"),
  setDeletePref: (ext) => ipcRenderer.invoke("sentinel:set-delete-pref", ext),
  clearDeletePref: (ext) => ipcRenderer.invoke("sentinel:clear-delete-pref", ext),
  resetDeletePrefs: () => ipcRenderer.invoke("sentinel:reset-delete-prefs"),
  killSwitch: () => ipcRenderer.invoke("sentinel:kill-switch"),
  onKillSwitch: (cb) => { const l = (_e, info) => cb(info); ipcRenderer.on("sentinel:kill-switch", l); return () => ipcRenderer.removeListener("sentinel:kill-switch", l); },
  // RUN 20 — system knowledge engine (local · read-only · content-blind).
  getSystemContext: () => ipcRenderer.invoke("sentinel:get-system-context"),
  refreshSystemContext: () => ipcRenderer.invoke("sentinel:refresh-system-context"),
  listTier0: () => ipcRenderer.invoke("sentinel:list-tier0"),
  previewTier0: (id) => ipcRenderer.invoke("sentinel:preview-tier0", id),
  listBlueprints: () => ipcRenderer.invoke("sentinel:list-blueprints"),
  getBlueprint: (id) => ipcRenderer.invoke("sentinel:get-blueprint", id),
  diagnose: (message) => ipcRenderer.invoke("sentinel:diagnose", message),
  // RUN 21 — auto-update orchestrator · startup · heartbeat.
  checkUpdateChannel: () => ipcRenderer.invoke("sentinel:check-update-channel"),
  getUpdateState: () => ipcRenderer.invoke("sentinel:update-state"),
  updateChoice: (choice) => ipcRenderer.invoke("sentinel:update-choice", choice),
  pauseUpdates: () => ipcRenderer.invoke("sentinel:pause-updates"),
  getStartupState: () => ipcRenderer.invoke("sentinel:startup-state"),
  setAutoStartup: (on) => ipcRenderer.invoke("sentinel:set-auto-startup", on),
  onUpdateNotice: (cb) => { const l = (_e, info) => cb(info); ipcRenderer.on("update:notice", l); return () => ipcRenderer.removeListener("update:notice", l); },
  onStartupTamper: (cb) => { const l = (_e, info) => cb(info); ipcRenderer.on("startup:tamper", l); return () => ipcRenderer.removeListener("startup:tamper", l); },
  // RUN 22 — dashboard · performance · SLA · compliance · reports.
  getDashboard: () => ipcRenderer.invoke("sentinel:get-dashboard"),
  getPerformance: () => ipcRenderer.invoke("sentinel:get-performance"),
  getSla: () => ipcRenderer.invoke("sentinel:get-sla"),
  getCompliance: () => ipcRenderer.invoke("sentinel:get-compliance"),
  listReports: () => ipcRenderer.invoke("sentinel:list-reports"),
  generateReport: (opts) => ipcRenderer.invoke("sentinel:generate-report", opts),
  setReportPrefs: (prefs) => ipcRenderer.invoke("sentinel:set-report-prefs", prefs),
  // RUN 23 — process health · supervised fix pipeline · 10s countdown gate.
  getProcessHealth: () => ipcRenderer.invoke("sentinel:processHealth:get"),
  subscribeProcessHealth: () => ipcRenderer.invoke("sentinel:processHealth:subscribe"),
  onProcessHealth: (cb) => { const l = (_e, snap) => cb(snap); ipcRenderer.on("sentinel:processHealth", l); return () => ipcRenderer.removeListener("sentinel:processHealth", l); },
  supervisedFix: (payload) => ipcRenderer.invoke("sentinel:supervised-fix", payload),
  abortCountdown: () => ipcRenderer.invoke("sentinel:abort-countdown"),
  onCountdownTick: (cb) => { const l = (_e, info) => cb(info); ipcRenderer.on("sentinel:countdown-tick", l); return () => ipcRenderer.removeListener("sentinel:countdown-tick", l); },
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("sentinel:state", listener);
    return () => ipcRenderer.removeListener("sentinel:state", listener);
  },
  onNavigate: (callback) => {
    const listener = (_event, tab) => callback(tab);
    ipcRenderer.on("sentinel:navigate", listener);
    return () => ipcRenderer.removeListener("sentinel:navigate", listener);
  },
  onDetection: (callback) => {
    const listener = (_event, detection) => callback(detection);
    ipcRenderer.on("sentinel:detection", listener);
    return () => ipcRenderer.removeListener("sentinel:detection", listener);
  },
  onOverlayMode: (callback) => {
    const listener = (_event, mode) => callback(mode);
    ipcRenderer.on("sentinel:overlay-mode", listener);
    return () => ipcRenderer.removeListener("sentinel:overlay-mode", listener);
  },
  onGreeting: (callback) => {
    const listener = (_event, greeting) => callback(greeting);
    ipcRenderer.on("sentinel:greeting", listener);
    return () => ipcRenderer.removeListener("sentinel:greeting", listener);
  }
});

// RUN 23 — the globe status panel + action-indicator windows talk to window.sentinelBridge. runRecipe takes
// the object form {recipeId, processName, pid} and routes through the supervised-fix control plane.
contextBridge.exposeInMainWorld("sentinelBridge", {
  runRecipe: (payload) => ipcRenderer.invoke("sentinel:supervised-fix", payload),
  abortCountdown: () => ipcRenderer.invoke("sentinel:abort-countdown"),
  getProcessHealth: () => ipcRenderer.invoke("sentinel:processHealth:get"),
  onProcessHealth: (cb) => { const l = (_e, snap) => cb(snap); ipcRenderer.on("sentinel:processHealth", l); return () => ipcRenderer.removeListener("sentinel:processHealth", l); },
  onCountdownTick: (cb) => { const l = (_e, info) => cb(info); ipcRenderer.on("sentinel:countdown-tick", l); return () => ipcRenderer.removeListener("sentinel:countdown-tick", l); }
});
