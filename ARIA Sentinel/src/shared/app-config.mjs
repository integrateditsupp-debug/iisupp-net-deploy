// RUN 29-C — first-run onboarding state (the testable core behind ~/.aria-sentinel/app-config.json).
// The renderer (src/renderer/onboarding/*) draws the splash + 3-step walkthrough; THIS module owns the
// state machine + the one invariant that matters: once the user completes OR skips onboarding, it NEVER
// replays. 🔒 R11 — pure JSON state, no filesystem paths, no PII.
import { clampAdvisoryInterval, clampSnoozeHours } from "./advisory-escalation.mjs";

export const ONBOARDING_VERSION = 1;     // bump to re-introduce the walkthrough after a major UX change
export const ONBOARDING_TOTAL_STEPS = 3; // (1) tray pointer · (2) mode picker · (3) first-scan countdown

// RUN 33-E — first-launch Setup wizard. Separate from the onboarding walkthrough; auto-shows when
// `setup.completed` is missing, and is re-runnable from Settings → "Re-run Setup". Owns its prefs + the
// never-replay invariant (once completed, never auto-shows again unless re-run is requested).
// RUN-CU / CU4 (2026-10-08) — wizard v2 APPENDS six steps after the original six (Rule 15: nothing removed):
//   who uses this device · who should know when something breaks · how much Sentinel fixes on its own ·
//   who approves a fix · who gets the report · when maintenance can run.
export const SETUP_TOTAL_STEPS = 12; // welcome · license/trial · mode · ARIA Chat · notifications · done + 6 v2 steps
export const SETUP_V1_STEPS = 6;     // the original six (kept so the v1 ids/order are provably intact)

// ── RUN-CU / CU4 — autonomy levels + the plain-language consequence a customer reads on each card ──────────
// Rule 17 (value first, plain, honest): every level says exactly what Sentinel will and will not touch.
export const AUTONOMY_LEVELS = Object.freeze(["observe", "safe-auto", "approve-first", "full-auto"]);
export const AUTONOMY_LEVEL_COPY = Object.freeze({
  observe: { label: "Observe", consequence: "I find it, I tell you, I touch nothing." },
  "safe-auto": { label: "Safe-auto", consequence: "I ask you once per fix, then fix it with you present." }, // REVIEW P1-1 — Confirmed asks once
  "approve-first": { label: "Approve-first", consequence: "I ask before every fix." },
  "full-auto": { label: "Full-auto", consequence: "I fix green and yellow inside your maintenance window and report." }
});
export const APPROVER_MODES = Object.freeze(["self", "admin", "either"]);
export const APPROVER_TIMEOUT_MIN = 5;
export const APPROVER_TIMEOUT_MAX = 1440;
export const APPROVER_TIMEOUT_DEFAULT = 30;
export const ON_TIMEOUT_CHOICES = Object.freeze(["skip", "proceed-green-only"]);
export const REPORT_CADENCES = Object.freeze(["per-fix", "daily", "weekly"]);
export const TECH_CONTACT_ROLES = Object.freeze(["admin", "it-lead", "approver"]);
export const IDENTITY_KINDS = Object.freeze(["personal", "business"]);
const MAX_CONTACTS = 12;

/** Fresh config for a brand-new install. */
export function defaultAppConfig() {
  return {
    onboarding: { completed: false, skipped: false, step: 0, version: ONBOARDING_VERSION },
    setup: defaultSetupState()
  };
}

/** The v2 prefs a fresh install starts with (personal device → safe-auto, approver = self). */
export function defaultV2Prefs() {
  return {
    identity: { kind: "personal", orgName: "" },
    deviceUser: { name: "", email: "", phone: "", smsOptIn: false },
    techContacts: [],
    autonomyLevel: "safe-auto",
    approver: { mode: "self", contacts: [], timeoutMinutes: APPROVER_TIMEOUT_DEFAULT, onTimeout: "skip" },
    reportRecipients: [],
    reportCadence: "weekly",
    maintenanceWindow: { enabled: false, windows: [] },
    notifyChannels: { desktop: true, email: true, sms: false }
  };
}

export function defaultSetupState() {
  return { completed: false, step: 0, prefs: { mode: "manual", landOnAria: false, kbNotifications: true, trayIcon: true, ...defaultV2Prefs() } };
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
      trayIcon: p.trayIcon !== false,               // default ON
      // RUN-CU / CU4 — v2 prefs: every field sanitized/clamped, defaults filled in (forward/backward safe).
      ...defaultV2Prefs(),
      ...sanitizePrefs(p)
    }
  };
}

/** The sanitized, default-filled setup prefs for a (possibly partial / legacy) config. */
export function normalizeSetupPrefs(config) {
  return normalizeSetup(config).prefs;
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

// ── RUN-CU / CU4 — v2 field sanitizers. Strict + clamped: an unknown value falls back to the safe default, an
// over-long or malformed contact is dropped (never stored). Emails/phones are shape-checked only; nothing here
// ever sends anything. Content-blind by construction: short labels, addresses, enums and integers only.
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,24}$/;
const PHONE_RE = /^\+?[0-9()\-\s.]{7,20}$/;
const NAME_RE = /^[A-Za-z0-9 .,'&_@+\-]{0,80}$/;

function cleanEmail(v) { const s = String(v == null ? "" : v).trim().toLowerCase(); return EMAIL_RE.test(s) ? s : ""; }
function cleanPhone(v) { const s = String(v == null ? "" : v).trim(); return PHONE_RE.test(s) ? s.replace(/\s+/g, " ") : ""; }
function cleanName(v) { const s = String(v == null ? "" : v).trim().slice(0, 80); return NAME_RE.test(s) ? s : s.replace(/[^A-Za-z0-9 .,'&_@+\-]/g, "").slice(0, 80); }
function clampInt(v, min, max, dflt) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; }
function oneOf(list, v, dflt) { return list.includes(v) ? v : dflt; }

export function sanitizeIdentity(v) {
  const d = defaultV2Prefs().identity;
  if (!v || typeof v !== "object") return d;
  return { kind: oneOf(IDENTITY_KINDS, v.kind, d.kind), orgName: cleanName(v.orgName) };
}
export function sanitizeDeviceUser(v) {
  const d = defaultV2Prefs().deviceUser;
  if (!v || typeof v !== "object") return d;
  const phone = cleanPhone(v.phone);
  return { name: cleanName(v.name), email: cleanEmail(v.email), phone, smsOptIn: Boolean(v.smsOptIn) && Boolean(phone) };
}
export function sanitizeTechContacts(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const email = cleanEmail(c.email);
    const phone = cleanPhone(c.phone);
    if (!email && !phone) continue; // a contact nobody can reach is not a contact
    out.push({ name: cleanName(c.name), email, phone, role: oneOf(TECH_CONTACT_ROLES, c.role, "admin") });
    if (out.length >= MAX_CONTACTS) break;
  }
  return out;
}
export function sanitizeApprover(v) {
  const d = defaultV2Prefs().approver;
  if (!v || typeof v !== "object") return d;
  const contacts = (Array.isArray(v.contacts) ? v.contacts : []).map(cleanEmail).filter(Boolean).slice(0, MAX_CONTACTS);
  return {
    mode: oneOf(APPROVER_MODES, v.mode, d.mode),
    contacts: [...new Set(contacts)],
    timeoutMinutes: clampInt(v.timeoutMinutes, APPROVER_TIMEOUT_MIN, APPROVER_TIMEOUT_MAX, d.timeoutMinutes),
    onTimeout: oneOf(ON_TIMEOUT_CHOICES, v.onTimeout, d.onTimeout)
  };
}
export function sanitizeReportRecipients(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const email = cleanEmail(r.email);
    const phone = cleanPhone(r.phone);
    if (!email && !phone) continue;
    out.push({ email, phone });
    if (out.length >= MAX_CONTACTS) break;
  }
  return out;
}
/** Maintenance window — the exact shape src/main/plan-maintenance-window.mjs normalizeWindowConfig accepts. */
export function sanitizeMaintenanceWindow(v) {
  const d = defaultV2Prefs().maintenanceWindow;
  if (!v || typeof v !== "object") return d;
  const windows = [];
  for (const w of (Array.isArray(v.windows) ? v.windows : [])) {
    if (!w || typeof w !== "object") continue;
    const start = /^(\d{1,2}):(\d{2})$/.exec(String(w.start || "").trim());
    if (!start) continue;
    const h = Number(start[1]), mi = Number(start[2]);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) continue;
    const durationMin = clampInt(w.durationMin, 15, 1440, 0);
    if (!durationMin) continue;
    let days;
    if (typeof w.days === "string") days = ["daily", "weekdays", "weekends"].includes(w.days.trim().toLowerCase()) ? w.days.trim().toLowerCase() : "daily";
    else if (Array.isArray(w.days)) { days = [...new Set(w.days.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort(); if (!days.length) continue; }
    else days = "daily";
    windows.push({ days, start: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`, durationMin });
    if (windows.length >= 7) break;
  }
  return { enabled: v.enabled === undefined ? windows.length > 0 : Boolean(v.enabled) && windows.length > 0, windows };
}
export function sanitizeNotifyChannels(v) {
  const d = defaultV2Prefs().notifyChannels;
  if (!v || typeof v !== "object") return d;
  return {
    desktop: v.desktop === undefined ? d.desktop : Boolean(v.desktop),
    email: v.email === undefined ? d.email : Boolean(v.email),
    sms: v.sms === undefined ? d.sms : Boolean(v.sms)
  };
}

/** Sanitize a (partial) prefs object: only known keys survive, every value validated/clamped. Exported for CU4. */
export function sanitizePrefs(p) {
  const out = {};
  if (!p || typeof p !== "object") return out;
  if (["manual", "confirmed", "autonomous"].includes(p.mode)) out.mode = p.mode;
  if (typeof p.landOnAria === "boolean") out.landOnAria = p.landOnAria;
  if (typeof p.kbNotifications === "boolean") out.kbNotifications = p.kbNotifications;
  if (typeof p.trayIcon === "boolean") out.trayIcon = p.trayIcon;
  // RUN-CU / CU4 — v2 prefs (each sanitized; absent keys are left absent so a partial update merges cleanly).
  if ("identity" in p) out.identity = sanitizeIdentity(p.identity);
  if ("deviceUser" in p) out.deviceUser = sanitizeDeviceUser(p.deviceUser);
  if ("techContacts" in p) out.techContacts = sanitizeTechContacts(p.techContacts);
  if ("autonomyLevel" in p) out.autonomyLevel = oneOf(AUTONOMY_LEVELS, p.autonomyLevel, defaultV2Prefs().autonomyLevel);
  if ("approver" in p) out.approver = sanitizeApprover(p.approver);
  if ("reportRecipients" in p) out.reportRecipients = sanitizeReportRecipients(p.reportRecipients);
  if ("reportCadence" in p) out.reportCadence = oneOf(REPORT_CADENCES, p.reportCadence, defaultV2Prefs().reportCadence);
  if ("maintenanceWindow" in p) out.maintenanceWindow = sanitizeMaintenanceWindow(p.maintenanceWindow);
  if ("notifyChannels" in p) out.notifyChannels = sanitizeNotifyChannels(p.notifyChannels);
  if (typeof p.fullAutoUnderstood === "boolean") out.fullAutoUnderstood = p.fullAutoUnderstood;
  // PROD 2026-10-14 (audit M8) — optional network-watcher probe targets (host/IP shapes only; blank = the device's own
  // gateway / DNS server + the NCSI name Windows already resolves). Never user content, never a URL.
  if ("networkProbe" in p) out.networkProbe = sanitizeNetworkProbe(p.networkProbe);
  // ADVISORY ESCALATION (2026-10-14) — the advise-first rule's interval (1–60 min, default 3) and "Not now" snooze (1–72 h,
  // default 4). Optional keys (absent = the defaults in advisory-escalation.mjs); never part of defaultV2Prefs (Rule 15).
  if ("advisoryIntervalMinutes" in p) out.advisoryIntervalMinutes = clampAdvisoryInterval(p.advisoryIntervalMinutes);
  if ("advisorySnoozeHours" in p) out.advisorySnoozeHours = clampSnoozeHours(p.advisorySnoozeHours);
  return out;
}
const PROBE_HOST_RE = /^[A-Za-z0-9.:-]{1,253}$/;
function sanitizeNetworkProbe(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  const host = String(o.probeHost == null ? "" : o.probeHost).trim();
  const name = String(o.dnsProbeName == null ? "" : o.dnsProbeName).trim();
  if (host && PROBE_HOST_RE.test(host)) out.probeHost = host;
  if (name && PROBE_HOST_RE.test(name)) out.dnsProbeName = name;
  return out;
}

/** Merge a partial v2 update into an existing config WITHOUT touching completion/step (Settings → Autonomy & contacts). */
export function updateSetupPrefs(config, partial = {}) {
  const s = normalizeSetup(config);
  return { ...(config || {}), setup: { ...s, prefs: { ...s.prefs, ...sanitizePrefs(partial) } } };
}

/**
 * The autonomy level Sentinel actually honours, with the business clamp: a business device stays on
 * approve-first until at least one tech contact exists (there is nobody to tell / to approve otherwise).
 * Personal devices keep whatever they chose (default safe-auto).
 */
export function resolveAutonomy(prefs = {}) {
  const p = { ...defaultV2Prefs(), ...(prefs || {}) };
  const level = oneOf(AUTONOMY_LEVELS, p.autonomyLevel, "safe-auto");
  const business = p.identity && p.identity.kind === "business";
  const contacts = Array.isArray(p.techContacts) ? p.techContacts.length : 0;
  if (business && contacts === 0 && level !== "observe") {
    return { level: "approve-first", clamped: true, reason: "business device without a tech contact stays on approve-first" };
  }
  return { level, clamped: false, reason: "" };
}

/**
 * Map an autonomy level onto the EXISTING mode machine (manual | confirmed | autonomous). observe and
 * approve-first run in manual with notifications on; safe-auto is confirmed; full-auto is autonomous and
 * still needs the explicit "I understand" opt-in (canEnableAutonomous) — the wizard never sets it silently.
 */
export function autonomyLevelToMode(level) {
  switch (oneOf(AUTONOMY_LEVELS, level, "safe-auto")) {
    case "observe": return { mode: "manual", notify: true, requiresOptIn: false };
    case "approve-first": return { mode: "manual", notify: true, requiresOptIn: false };
    case "full-auto": return { mode: "autonomous", notify: true, requiresOptIn: true };
    default: return { mode: "confirmed", notify: true, requiresOptIn: false };
  }
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
