// RUN-CU / CU4 (2026-10-08) — notification builders. PURE: no network, no Electron, no filesystem.
//
// Every notification Sentinel sends about a device is CONTENT-BLIND by construction: a catalog title, a
// recipe id, a severity colour, a platform word, a short honest outcome. Never a raw log line, a file path,
// a URL, a document excerpt or a username. mustBeTelemetrySafe() is the last guard before anything leaves
// the process — the dispatcher refuses to send a payload it rejects (tests/notify-channels.test.mjs).
//
// Recipient resolution reads the Setup wizard prefs (app-config.mjs) by ROLE, so "who should know when
// something breaks" is decided once, in one place, and reused by every event.
import { assertContentSafePayload } from "./safety.mjs";

export const NOTIFY_EVENTS = Object.freeze(["issue-detected", "approval-requested", "fix-executed", "fix-failed", "report"]);
export const SEVERITIES = Object.freeze(["green", "yellow", "red"]);
export const ISSUE_DEDUPE_MS = 6 * 60 * 60 * 1000; // one "something broke" per issue per 6h — never a drip of repeats

// ── Platform honesty ────────────────────────────────────────────────────────────────────────────────────
// What Sentinel can really do on each platform. Windows/Surface: detect + fix (the PowerShell engines).
// macOS: detect + a small set of user-level fixes (no sudo). Phones/tablets/ChromeOS: no agent runs there —
// ARIA guides the person by chat/voice; nothing is executed. (Rule 14: say "guided", never "fixed".)
export function platformCapabilities(platform) {
  const p = String(platform || "").toLowerCase();
  if (p === "win32" || p === "windows" || p === "surface") {
    return { platform: "windows", detect: true, fix: true, guided: true, fixEngine: "powershell", label: "Windows", copy: "Detects and fixes on this device." };
  }
  if (p === "darwin" || p === "macos" || p === "mac") {
    return { platform: "macos", detect: true, fix: "limited", guided: true, fixEngine: "shell-user", label: "macOS", copy: "Detects on this Mac and runs a small set of user-level fixes (no admin rights needed). Everything else is guided." };
  }
  if (["ios", "ipados", "android", "chromeos", "chrome-os"].includes(p)) {
    const label = { ios: "iOS", ipados: "iPadOS", android: "Android", chromeos: "ChromeOS", "chrome-os": "ChromeOS" }[p];
    return { platform: p === "chrome-os" ? "chromeos" : p, detect: false, fix: false, guided: true, fixEngine: null, label, copy: `Guided by ARIA only — no agent runs on ${label}, so nothing is executed there.` };
  }
  if (p === "linux") {
    return { platform: "linux", detect: false, fix: false, guided: true, fixEngine: null, label: "Linux", copy: "Guided by ARIA only on this build — detect-only, no fix engine." };
  }
  return { platform: "unknown", detect: false, fix: false, guided: true, fixEngine: null, label: "this device", copy: "Guided by ARIA only — no fix engine for this platform." };
}

// ── Content-blind guard ─────────────────────────────────────────────────────────────────────────────────
// (the payload is tested as JSON text, where a backslash is doubled — hence the `\\` allowed before a UNC name)
const RAW_PATH_RE = /(^|[\s"'(\\])(?:[a-z]:\\|\\\\[a-z0-9._-]+\\|\/(?:Users|home|var|etc|tmp|mnt|opt|private)\/)/i;
const URL_RE = /\b(?:https?|ftp|file):\/\//i;
// A log LINE is a timestamp followed by a level/pid (a bare ISO `ts` field is not a log line), a bracketed level,
// a stack frame, or a hex stop code.
const LOG_LINE_RE = /(?:\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?Z?\s+(?:\[?(?:ERROR|WARN|WARNING|INFO|DEBUG|FATAL|TRACE|CRITICAL)\]?|\d+\s|<\w+>))|\[(?:ERROR|WARN|INFO|DEBUG|FATAL)\]|Exception in thread|\bat [\w$.]+\([\w$.]+\.(?:java|js|cs|py):\d+\)|Stack trace:|\b0x[0-9a-f]{8}\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Reject anything that is not catalog-shaped. Returns { ok, reason }. The payload is the thing that will
 * cross the boundary (the notify POST body), recipients excluded — recipient addresses are carried in a
 * separate field the server hashes before logging.
 */
export function mustBeTelemetrySafe(payload) {
  let text;
  try { text = JSON.stringify(payload == null ? {} : payload); } catch { return { ok: false, reason: "unserializable" }; }
  if (text.length > 8000) return { ok: false, reason: "too-large" };
  if (RAW_PATH_RE.test(text)) return { ok: false, reason: "raw-path" };
  if (URL_RE.test(text)) return { ok: false, reason: "url" };
  if (LOG_LINE_RE.test(text)) return { ok: false, reason: "log-line" };
  if (EMAIL_RE.test(text)) return { ok: false, reason: "email-in-payload" };
  let safe = false;
  try { safe = assertContentSafePayload(payload); } catch { safe = false; }
  if (!safe) return { ok: false, reason: "content-leak" };
  return { ok: true, reason: "" };
}

// Keep only the content-blind shape of a title: URLs, drive/UNC/posix paths and file-name tokens are removed FIRST
// (a catalog title never has them), then letters, digits and basic punctuation survive, 120 chars.
export function cleanTitle(v, fallback = "ARIA Sentinel") {
  const s = String(v == null ? "" : v)
    .replace(/\b(?:https?|ftp|file):\/\/\S+/gi, " ")
    .replace(/\b[a-z]:[\\/][^\s]*/gi, " ")
    .replace(/\\\\[^\s]+/g, " ")
    .replace(/\/(?:Users|home|var|etc|tmp|mnt|opt|private)\/[^\s]*/gi, " ")
    .replace(/\b[\w-]+\.(?:xlsx?|docx?|pptx?|pdf|csv|txt|log|zip|exe|msi|dll|sys|ps1|bat|cmd|js|json|xml|ini|cfg|ost|pst|db|bak|png|jpe?g|mp4|mov)\b/gi, " ")
    .replace(/[^\w .,:;'()\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return s || fallback;
}
function token(v) { const s = String(v == null ? "" : v).trim(); return /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(s) ? s : ""; }
function severity(v) { return SEVERITIES.includes(v) ? v : "yellow"; }

// ── Recipient resolution by role ────────────────────────────────────────────────────────────────────────
function contactOf(c, role) {
  if (!c || typeof c !== "object") return null;
  const email = String(c.email || "").trim().toLowerCase();
  const phone = String(c.phone || "").trim();
  if (!email && !phone) return null;
  return { role, name: String(c.name || "").slice(0, 80), email, phone };
}
function dedupe(list) {
  const seen = new Set(); const out = [];
  for (const r of list) {
    if (!r) continue;
    const key = `${r.email}|${r.phone}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(r);
  }
  return out;
}

/**
 * Who hears about an event, read from the wizard prefs:
 *   issue-detected / fix-executed / fix-failed → the device user + every tech contact (admins + it-leads + approvers)
 *   approval-requested                          → approvers per approver.mode (self = device user · admin = approver
 *                                                 contacts + role:approver/admin tech contacts · either = both)
 *   report                                      → report recipients (+ the device user if nobody else is listed)
 * SMS is only ever used for a phone that opted in (device user) or a tech contact (business line).
 */
export function resolveRecipients(prefs = {}, event = "issue-detected") {
  const p = prefs || {};
  const user = contactOf(p.deviceUser, "device-user");
  if (user && !(p.deviceUser && p.deviceUser.smsOptIn)) user.phone = ""; // no opt-in → never SMS the user
  const techs = (Array.isArray(p.techContacts) ? p.techContacts : []).map((c) => contactOf(c, c && c.role ? String(c.role) : "admin")).filter(Boolean);
  const approverPrefs = p.approver || {};
  const mode = ["self", "admin", "either"].includes(approverPrefs.mode) ? approverPrefs.mode : "self";
  switch (event) {
    case "approval-requested": {
      const admins = [
        ...(Array.isArray(approverPrefs.contacts) ? approverPrefs.contacts : []).map((e) => contactOf({ email: e }, "approver")).filter(Boolean),
        ...techs.filter((t) => t.role === "approver" || t.role === "admin")
      ];
      if (mode === "self") return dedupe([user]);
      if (mode === "admin") return dedupe(admins.length ? admins : [user]); // nobody configured → fall back to the user
      return dedupe([user, ...admins]);
    }
    case "report": {
      const reps = (Array.isArray(p.reportRecipients) ? p.reportRecipients : []).map((r) => contactOf(r, "report")).filter(Boolean);
      return dedupe(reps.length ? reps : [user]);
    }
    default:
      return dedupe([user, ...techs]);
  }
}

/** Which channels an event may use (desktop is always allowed; email/sms follow the wizard toggles). */
export function channelsFor(prefs = {}) {
  const c = (prefs && prefs.notifyChannels) || {};
  return { desktop: c.desktop !== false, email: c.email !== false, sms: c.sms === true };
}

// ── Builders ────────────────────────────────────────────────────────────────────────────────────────────
function outcomeWord(ctx) {
  if (ctx.dryRun) return "previewed (dry-run, nothing changed)";
  if (ctx.verified === true) return "fixed and verified";
  if (ctx.verified === false) return "applied, verification inconclusive";
  return ctx.outcome ? String(ctx.outcome).replace(/[^a-z -]/gi, "").slice(0, 40) : "done";
}

/**
 * Build one notification for an event. ctx carries ONLY catalog-shaped facts:
 *   { title, recipeId, severity, platform, outcome, dryRun, verified, approvalId, expiresAt, requestedBy,
 *     summary:{fixes,detections,failures,period}, deviceLabel }
 * Returns { event, subject, text, sms, desktop:{title, body}, payload, recipients:[], channels, safe:{ok,reason} }.
 * The caller decides channels; `payload` is what crosses the wire (hashed/recipients travel separately).
 */
export function buildNotification(event, ctx = {}, prefs = {}) {
  const ev = NOTIFY_EVENTS.includes(event) ? event : "issue-detected";
  const title = cleanTitle(ctx.title, "An issue on your device");
  const recipeId = token(ctx.recipeId);
  const sev = severity(ctx.severity || ctx.color);
  const caps = platformCapabilities(ctx.platform);
  const device = cleanTitle(ctx.deviceLabel, "your device");
  const sevWord = { green: "low", yellow: "medium", red: "high" }[sev];
  let subject = "", text = "", sms = "", desktop = { title: "ARIA Sentinel", body: "" };

  if (ev === "issue-detected") {
    subject = `ARIA Sentinel: ${title} on ${device}`;
    text = `${title} (${sevWord} severity) was detected on ${device} (${caps.label}). ${caps.fix === true ? "A vetted fix is available." : caps.fix === "limited" ? "Guided help is available; some fixes are user-level only on macOS." : "ARIA will guide the person through it; nothing is executed on this platform."}`;
    sms = `ARIA: ${title} (${sevWord}) on ${device}.`;
    desktop = { title: `Found: ${title}`, body: caps.fix === true ? "A vetted fix is ready. Open ARIA Sentinel to see it." : "Open ARIA Sentinel for guided steps." };
  } else if (ev === "approval-requested") {
    const until = ctx.expiresAt ? ` It waits until ${String(ctx.expiresAt).slice(0, 16).replace("T", " ")} UTC.` : "";
    subject = `Approve a fix on ${device}: ${title}`;
    text = `ARIA Sentinel wants to run "${title}" (${sevWord} severity, ${recipeId || "vetted recipe"}) on ${device}. It will not run until someone approves it.${until}`;
    sms = `ARIA: approve "${title}" on ${device}? Reply in the app or use the link in your email.`;
    desktop = { title: `Approval needed: ${title}`, body: "Approve or deny in Control Center → Approvals." };
  } else if (ev === "fix-executed") {
    subject = `ARIA Sentinel ${outcomeWord(ctx)}: ${title} on ${device}`;
    text = `"${title}" was ${outcomeWord(ctx)} on ${device}.${ctx.restorePoint === true ? " A restore point was created first, so it can be undone." : ctx.restorePoint === false ? " No restore point was available on this platform/account." : ""}`;
    sms = `ARIA: ${title} ${outcomeWord(ctx)} on ${device}.`;
    desktop = { title: `${ctx.dryRun ? "Previewed" : "Done"}: ${title}`, body: outcomeWord(ctx) };
  } else if (ev === "fix-failed") {
    subject = `ARIA Sentinel could not fix: ${title} on ${device}`;
    text = `"${title}" did not complete on ${device}. ${ctx.rolledBack ? "The change was rolled back." : "Nothing further was changed."} A person should take a look.`;
    sms = `ARIA: ${title} did not complete on ${device}. A person should look.`;
    desktop = { title: `Needs a person: ${title}`, body: "The fix did not complete. Open ARIA Sentinel for details." };
  } else if (ev === "report") {
    const s = ctx.summary || {};
    const fixes = Number(s.fixes) || 0, det = Number(s.detections) || 0, fails = Number(s.failures) || 0;
    const period = cleanTitle(s.period, "this period");
    subject = `ARIA Sentinel report (${period}) for ${device}`;
    text = `${period}: ${det} issue${det === 1 ? "" : "s"} detected, ${fixes} fix${fixes === 1 ? "" : "es"} applied, ${fails} needing a person. The full PDF stays on the device.`;
    sms = `ARIA ${period}: ${det} detected, ${fixes} fixed, ${fails} need a person.`;
    desktop = { title: `Report ready (${period})`, body: `${det} detected · ${fixes} fixed · ${fails} need a person` };
  }

  const payload = {
    v: "sentinel-notify-v1",
    event: ev,
    title,
    recipeId: recipeId || null,
    severity: sev,
    platform: caps.platform,
    outcome: ev === "fix-executed" || ev === "fix-failed" ? outcomeWord(ctx) : null,
    approvalId: token(ctx.approvalId) || null,
    expiresAt: ctx.expiresAt ? String(ctx.expiresAt).slice(0, 30) : null,
    summary: ev === "report" ? { fixes: Number((ctx.summary || {}).fixes) || 0, detections: Number((ctx.summary || {}).detections) || 0, failures: Number((ctx.summary || {}).failures) || 0, period: cleanTitle((ctx.summary || {}).period, "this period") } : null,
    ts: ctx.ts ? String(ctx.ts).slice(0, 30) : null // real-or-empty: never a fabricated timestamp
  };
  return {
    event: ev,
    subject,
    text,
    sms,
    desktop,
    payload,
    recipients: resolveRecipients(prefs, ev),
    channels: channelsFor(prefs),
    // The guard covers EVERYTHING that crosses the wire: the payload AND the rendered copy (subject/text/sms/desktop).
    safe: mustBeTelemetrySafe({ payload, subject, text, sms, desktop })
  };
}

/** Dedupe key for "same issue again" (6h window): event + recipe/title, never the device. */
export function dedupeKey(event, ctx = {}) {
  return `${event}:${token(ctx.recipeId) || cleanTitle(ctx.title, "issue").toLowerCase()}`;
}
