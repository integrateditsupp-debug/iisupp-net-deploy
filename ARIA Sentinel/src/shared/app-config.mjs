// RUN 29-C — first-run onboarding state (the testable core behind ~/.aria-sentinel/app-config.json).
// The renderer (src/renderer/onboarding/*) draws the splash + 3-step walkthrough; THIS module owns the
// state machine + the one invariant that matters: once the user completes OR skips onboarding, it NEVER
// replays. 🔒 R11 — pure JSON state, no filesystem paths, no PII.

export const ONBOARDING_VERSION = 1;     // bump to re-introduce the walkthrough after a major UX change
export const ONBOARDING_TOTAL_STEPS = 3; // (1) tray pointer · (2) mode picker · (3) first-scan countdown

// RUN 33-E — first-launch Setup wizard (6 steps). Separate from the onboarding walkthrough; auto-shows when
// `setup.completed` is missing, and is re-runnable from Settings → "Re-run Setup". Owns its prefs + the
// never-replay invariant (once completed, never auto-shows again unless re-run is requested).
export const SETUP_TOTAL_STEPS = 6; // welcome · license/trial · mode · ARIA Chat · notifications · done

/** Fresh config for a brand-new install. */
export function defaultAppConfig() {
  return {
    onboarding: { completed: false, skipped: false, step: 0, version: ONBOARDING_VERSION },
    setup: defaultSetupState()
  };
}

export function defaultSetupState() {
  return { completed: false, step: 0, prefs: { mode: "manual", landOnAria: false, kbNotifications: true, trayIcon: true } };
}

function normalizeSetup(config) {
  const s = (config && typeof config === "object" && config.setup) || {};
  const p = (s.prefs && typeof s.prefs === "object") ? s.prefs : {};
  const d = defaultSetupState();
  return {
    completed: Boolean(s.completed),
    step: Math.max(0, Math.min(SETUP_TOTAL_STEPS, Number(s.step) || 0)),
    prefs: {
      mode: ["manual", "confirmed", "autonomous"].includes(p.mode) ? p.mode : d.prefs.mode,
      landOnAria: Boolean(p.landOnAria),
      kbNotifications: p.kbNotifications !== false, // default ON
      trayIcon: p.trayIcon !== false                // default ON
    }
  };
}

/** Auto-show the wizard only on a fresh install (setup never completed). */
export function shouldShowSetup(config) {
  return !normalizeSetup(config).completed;
}

/** Advance the wizard one step (clamped); reaching the last step completes it. */
export function advanceSetup(config) {
  const s = normalizeSetup(config);
  const step = Math.min(SETUP_TOTAL_STEPS, s.step + 1);
  return { ...(config || {}), setup: { ...s, step, completed: step >= SETUP_TOTAL_STEPS } };
}

/** Finish setup, persisting the chosen prefs. Never auto-shows again after this. */
export function completeSetup(config, prefs = {}) {
  const s = normalizeSetup(config);
  return { ...(config || {}), setup: { completed: true, step: SETUP_TOTAL_STEPS, prefs: { ...s.prefs, ...sanitizePrefs(prefs) } } };
}

/** "Re-run Setup" — reopen the wizard from step 0 WITHOUT wiping the saved prefs. */
export function reopenSetup(config) {
  const s = normalizeSetup(config);
  return { ...(config || {}), setup: { ...s, completed: false, step: 0 } };
}

function sanitizePrefs(p) {
  const out = {};
  if (["manual", "confirmed", "autonomous"].includes(p.mode)) out.mode = p.mode;
  if (typeof p.landOnAria === "boolean") out.landOnAria = p.landOnAria;
  if (typeof p.kbNotifications === "boolean") out.kbNotifications = p.kbNotifications;
  if (typeof p.trayIcon === "boolean") out.trayIcon = p.trayIcon;
  return out;
}

/** Normalize a possibly-partial config read from disk (forward/backward safe). */
export function normalizeAppConfig(config) {
  const base = defaultAppConfig();
  const o = (config && typeof config === "object" && config.onboarding) || {};
  return {
    ...config,
    onboarding: {
      completed: Boolean(o.completed),
      skipped: Boolean(o.skipped),
      step: Math.max(0, Math.min(ONBOARDING_TOTAL_STEPS, Number(o.step) || 0)),
      // numeric-safe: a stored version of 0 must NOT be coerced to the current version (|| would do that)
      version: Number.isFinite(Number(o.version)) && o.version != null ? Number(o.version) : ONBOARDING_VERSION
    }
  };
}

/**
 * Show onboarding only when it has NOT been dismissed (completed/skipped) at the current version. A version
 * bump re-introduces it once. `hasLicense`/`hasTrial` don't gate showing — the splash IS where the user
 * enters a license or starts the trial — but they're surfaced so the caller can preselect the right step.
 */
export function shouldShowOnboarding(config, { version = ONBOARDING_VERSION } = {}) {
  const o = normalizeAppConfig(config).onboarding;
  if (o.version < version) return true;            // new walkthrough version → show again, once
  return !(o.completed || o.skipped);              // otherwise: only until dismissed
}

/** Advance to the next walkthrough step (clamped). Returns a NEW config. */
export function advanceOnboarding(config) {
  const c = normalizeAppConfig(config);
  const step = Math.min(ONBOARDING_TOTAL_STEPS, c.onboarding.step + 1);
  const completed = step >= ONBOARDING_TOTAL_STEPS;
  return { ...c, onboarding: { ...c.onboarding, step, completed } };
}

/** Mark onboarding finished (reached the end). Never replays after this. */
export function completeOnboarding(config) {
  const c = normalizeAppConfig(config);
  return { ...c, onboarding: { ...c.onboarding, completed: true, step: ONBOARDING_TOTAL_STEPS, version: ONBOARDING_VERSION } };
}

/** Power-user "Skip walkthrough". Never replays after this (until a version bump). */
export function skipOnboarding(config) {
  const c = normalizeAppConfig(config);
  return { ...c, onboarding: { ...c.onboarding, skipped: true, version: ONBOARDING_VERSION } };
}
