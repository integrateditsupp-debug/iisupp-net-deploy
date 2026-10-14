// PROD 2026-10-14 (audit R8 / §3) — the first-run wizard's PURE model: the three screens a buyer judges the
// product by (Hello · Who are you · What I'll do), the safe defaults that finish setup in under three minutes,
// and the summary that says exactly what was chosen. The renderer only paints these; the full 12-step wizard
// stays reachable through "Customize" (Rule 15), and main.mjs still sanitizes everything (app-config.mjs).
//
// Honesty rules baked in here (Rule 14):
//   · the mode the person picks is respected — the autonomy level FOLLOWS the mode unless they explicitly change
//     it (Manual → approve-first, which maps back to Manual; Confirmed → safe-auto), never the other way round
//   · "safe defaults" = Manual · approve-first · desktop notifications · tray icon · weekly summary · live fixes off
//   · the summary never says "all set" before the last step, and lists live-fixes OFF in plain words

export const QUICK_TRACK = Object.freeze(["hello", "who", "what", "summary"]);
export const TRACKS = Object.freeze(["quick", "full"]);

export const SAFE_DEFAULTS = Object.freeze({
  mode: "manual",
  autonomyLevel: "approve-first",
  landOnAria: false,
  kbNotifications: true,
  trayIcon: true,
  approver: Object.freeze({ mode: "self", contacts: [], timeoutMinutes: 30, onTimeout: "skip" }),
  reportCadence: "weekly",
  maintenanceWindow: Object.freeze({ enabled: false, windows: [] }),
  notifyChannels: Object.freeze({ desktop: true, email: false, sms: false }),
  liveFixes: false
});

/** The autonomy level that keeps the chosen mode true (the default the wizard pre-selects). */
export function autonomyForMode(mode) {
  return String(mode || "manual") === "confirmed" ? "safe-auto" : "approve-first";
}

/** The mode a level implies (observe / approve-first → Manual · safe-auto → Confirmed · full-auto → Confirmed + opt-in later). */
export function modeForAutonomy(level) {
  const l = String(level || "");
  if (l === "safe-auto" || l === "full-auto") return "confirmed";
  return "manual";
}

/** The three "What I'll do" cards (screen C). */
export const WHAT_CARDS = Object.freeze([
  { id: "tell-first", label: "Tell me first", level: "approve-first", mode: "manual", consequence: "I find it, I explain it, and I ask before every fix. Nothing changes until you say yes.", recommended: true },
  { id: "fix-safe", label: "Fix safe things yourself", level: "safe-auto", mode: "confirmed", consequence: "I apply low-risk vetted fixes after a 10-second countdown you can cancel, and tell you after. Higher-risk fixes still ask." },
  { id: "observe", label: "Observe only", level: "observe", mode: "manual", consequence: "I find it and tell you. I touch nothing — ever." }
]);

/** Map a screen-C card to the prefs it sets. Unknown ids fall back to the recommended card. */
export function quickChoiceToPrefs(cardId) {
  const card = WHAT_CARDS.find((c) => c.id === cardId) || WHAT_CARDS[0];
  return { autonomyLevel: card.level, mode: card.mode };
}

/** Which screen-C card matches a prefs object (for re-selection when the person goes Back). */
export function quickChoiceOf(prefs = {}) {
  const level = String(prefs.autonomyLevel || "");
  const hit = WHAT_CARDS.find((c) => c.level === level);
  return hit ? hit.id : (prefs.mode === "confirmed" ? "fix-safe" : "tell-first");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True for a 64-hex license key (the only shape main accepts; case-insensitive). */
export function isLicenseKeyShaped(key) {
  return /^[a-f0-9]{64}$/i.test(String(key || "").trim());
}

/**
 * Apply the safe defaults to a prefs object WITHOUT discarding what the person already typed (name, email,
 * org, license key, identity kind). Email channel + report recipient turn on only when an email was entered.
 */
export function applySafeDefaults(prefs = {}) {
  const p = JSON.parse(JSON.stringify(prefs || {}));
  const email = String((p.deviceUser && p.deviceUser.email) || "").trim();
  const hasEmail = EMAIL_RE.test(email);
  p.mode = SAFE_DEFAULTS.mode;
  p.autonomyLevel = SAFE_DEFAULTS.autonomyLevel;
  p.landOnAria = SAFE_DEFAULTS.landOnAria;
  p.kbNotifications = SAFE_DEFAULTS.kbNotifications;
  p.trayIcon = SAFE_DEFAULTS.trayIcon;
  p.fullAutoUnderstood = false;
  p.approver = { ...SAFE_DEFAULTS.approver, contacts: [] };
  p.reportCadence = SAFE_DEFAULTS.reportCadence;
  p.reportRecipients = hasEmail ? [{ email, phone: "" }] : [];
  p.maintenanceWindow = { enabled: false, windows: [] };
  p.notifyChannels = { desktop: true, email: hasEmail, sms: false };
  p.techContacts = Array.isArray(p.techContacts) ? p.techContacts : [];
  p.identity = { kind: (p.identity && p.identity.kind) === "business" ? "business" : "personal", orgName: String((p.identity && p.identity.orgName) || "") };
  p.deviceUser = { name: String((p.deviceUser && p.deviceUser.name) || ""), email, phone: String((p.deviceUser && p.deviceUser.phone) || ""), smsOptIn: false };
  return p;
}

const LEVEL_WORDS = {
  observe: "Observe — I find it and tell you, I touch nothing",
  "approve-first": "Tell me first — I ask before every fix",
  "safe-auto": "Fix safe things yourself — low-risk fixes after a cancellable countdown, I tell you after",
  "full-auto": "Full-auto — green and yellow fixes inside your maintenance window"
};

/**
 * The plain sentences the LAST screen shows (and the only place "You're all set" is said). Everything here is
 * what will actually be saved, including the live-fixes state and whether a license key is being verified.
 */
export function summaryLines(prefs = {}, { liveFixes = false, licenseKey = "", trialLine = "" } = {}) {
  const p = prefs || {};
  const mode = String(p.mode || "manual");
  const level = String(p.autonomyLevel || autonomyForMode(mode));
  const impliedMode = modeForAutonomy(level);
  const lines = [];
  lines.push(`Mode: ${impliedMode === "confirmed" ? "Confirmed" : "Manual"} — ${impliedMode === "confirmed" ? "fixes you confirm (or safe ones after a countdown) are applied" : "ARIA previews and guides; nothing changes without you"}.`);
  lines.push(`Autonomy: ${LEVEL_WORDS[level] || LEVEL_WORDS["approve-first"]}.`);
  lines.push(liveFixes ? "Live fixes: ON — ARIA applies vetted fixes you confirm. Windows may ask for administrator permission." : "Live fixes: OFF — ARIA shows what it would do and changes nothing. Turn them on in Settings → Autonomy when you're ready.");
  const ch = p.notifyChannels || {};
  const chans = [ch.desktop !== false ? "desktop notifications" : "", ch.email ? "email" : "", ch.sms ? "text message" : ""].filter(Boolean);
  lines.push(`You hear about problems by: ${chans.length ? chans.join(", ") : "the app only"}.`);
  const rec = Array.isArray(p.reportRecipients) ? p.reportRecipients.map((r) => r.email || r.phone).filter(Boolean) : [];
  lines.push(`Reports: ${p.reportCadence || "weekly"}${rec.length ? " to " + rec.join(", ") : " — kept on this device (no recipient yet)"}.`);
  const mw = p.maintenanceWindow || {};
  lines.push(mw.enabled && Array.isArray(mw.windows) && mw.windows[0] ? `Maintenance window: ${mw.windows[0].days || "daily"} at ${mw.windows[0].start || "02:00"} for ${mw.windows[0].durationMin || 120} min.` : "Maintenance window: off — yellow-tier fixes always ask first.");
  const key = String(licenseKey || "").trim();
  if (key) lines.push(isLicenseKeyShaped(key) ? "License key: will be verified when you finish." : "License key: not a valid 64-character key — it will not be sent. You can add one later in Settings.");
  else if (trialLine) lines.push(trialLine);
  return lines;
}

/** Wizard progress label: "Step 2 of 4". */
export function progressLabel(index, total) {
  const i = Math.max(0, Number(index) || 0), t = Math.max(1, Number(total) || 1);
  return `Step ${Math.min(i + 1, t)} of ${t}`;
}
