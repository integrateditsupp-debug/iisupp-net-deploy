// ADVISORY ESCALATION (2026-10-14) — the owner's Autonomous-mode rule: "advise three times, then act".
//
// When ARIA (in Autonomous mode, live fixes ON) finds a problem it can fix, it first TELLS the person — notice 1 of 3,
// 2 of 3, 3 of 3, one interval apart. Each notice offers three choices: Fix now · Not now (snooze) · Never for this.
// Any choice ends the escalation. If nobody answers the third notice, after one more interval ARIA fixes it on its
// own — through EVERY existing gate (main.mjs runSupervisedFix: kill switch → R11 → supervisor → vetted-tier policy →
// approval policy → needs-admin → the visible 10-second countdown → executor → verify → audit).
//
// Problems ARIA must NOT fix on its own (red, or a fix that needs administrator rights, or one not yet vetted for
// unattended runs on this device) still get the three notices — but the last step is "tell your IT contact", never
// an execution. That is the `tech-contact` track; the fixing path is the `auto-fix` track. Which track a detection
// takes is decided by main.mjs from the REAL gates (approval-policy decideExecution, dry-run-policy executionPolicy,
// the needs-admin rule); this module only keeps the clock and the promises.
//
// PURE: no timers, no I/O, no Electron. Time is injected (`now()`); persistence is injected (`load`/`save`); main.mjs
// drives `tick()` from ONE interval and performs the returned EFFECTS (notifications, cards, the supervised run).
// Renderer-safe: no node built-ins, so the Settings sentence is generated from these same constants (copy can't drift).
// 🔒 Content-blind: a record carries catalog ids, catalog titles/summaries, colours, counters and timestamps — never a
// path, a log line or user text. The id is derived from a counter + the recipe id, never from the device.

export const ADVISORY_COUNT = 3;
export const ADVISORY_INTERVAL_DEFAULT_MIN = 3;
export const ADVISORY_INTERVAL_MIN = 1;
export const ADVISORY_INTERVAL_MAX = 60;
export const ADVISORY_SNOOZE_DEFAULT_H = 4;
export const ADVISORY_SNOOZE_MIN_H = 1;
export const ADVISORY_SNOOZE_MAX_H = 72;
// The visible pre-execution countdown the final step goes through (src/main/action-countdown.mjs COUNTDOWN_SECONDS —
// tests/advisory-escalation.test.mjs pins the two equal so the sentence can never promise a different number).
export const ADVISORY_COUNTDOWN_SECONDS = 10;
export const ADVISORY_CHOICES = Object.freeze(["fix-now", "not-now", "never"]);
export const ADVISORY_TRACKS = Object.freeze(["auto-fix", "tech-contact"]);
// auto-fix kinds: green · yellow (reserved — recipe-runner never lets a yellow fix fire on its own today);
// tech-contact kinds: needs-admin · not-yet-vetted · needs-confirm (a yellow fix: always a person's yes) · red.
export const ADVISORY_KINDS = Object.freeze(["green", "yellow", "needs-admin", "not-yet-vetted", "needs-confirm", "red"]);
export const ADVISORY_ACTIVE = Object.freeze(["advising", "ready", "fixing", "snoozed"]);
export const ADVISORY_TERMINAL = Object.freeze(["fixed", "fix-failed", "held", "escalated", "acknowledged", "never", "blocked", "cancelled", "closed"]);
export const ADVISORY_STORE_VERSION = 1;
export const ADVISORY_RECORDS_MAX = 60;
// A record handed to the supervised pipeline that never reports back (window closed mid-countdown, a crash) is closed
// honestly as "no-result" after this long — it is never silently re-run.
export const ADVISORY_FIXING_STALE_MS = 60 * 60 * 1000;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
function token(v) { const s = String(v == null ? "" : v).trim(); return TOKEN_RE.test(s) ? s : ""; }
function shortText(v, max = 160) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function isoOf(ms) { const n = Number(ms); return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null; }
function oneOf(list, v, dflt) { return list.includes(v) ? v : dflt; }

/** Interval between notices, minutes (default 3, clamped 1–60). */
export function clampAdvisoryInterval(v) { return clampInt(v, ADVISORY_INTERVAL_MIN, ADVISORY_INTERVAL_MAX, ADVISORY_INTERVAL_DEFAULT_MIN); }
/** "Not now" snooze, hours (default 4, clamped 1–72). */
export function clampSnoozeHours(v) { return clampInt(v, ADVISORY_SNOOZE_MIN_H, ADVISORY_SNOOZE_MAX_H, ADVISORY_SNOOZE_DEFAULT_H); }

/** The advisory prefs from the (sanitized) setup prefs — absent keys fall back to the defaults. */
export function normalizeAdvisoryPrefs(prefs = {}) {
  const p = prefs && typeof prefs === "object" ? prefs : {};
  // Accepts the setup-prefs keys (advisoryIntervalMinutes / advisorySnoozeHours) AND an already-normalized object
  // ({ intervalMinutes, snoozeHours }) — normalizing twice is the identity (the fault lab caught the second shape).
  const iv = p.advisoryIntervalMinutes != null ? p.advisoryIntervalMinutes : p.intervalMinutes;
  const sz = p.advisorySnoozeHours != null ? p.advisorySnoozeHours : p.snoozeHours;
  return {
    intervalMinutes: iv == null ? ADVISORY_INTERVAL_DEFAULT_MIN : clampAdvisoryInterval(iv),
    snoozeHours: sz == null ? ADVISORY_SNOOZE_DEFAULT_H : clampSnoozeHours(sz)
  };
}

/**
 * The rule in plain words (Settings → Autonomy). Generated from the constants above + the person's prefs, so the
 * sentence on screen is always the rule the code runs.
 */
export function ruleSentence(prefs = {}, { countdownSeconds = ADVISORY_COUNTDOWN_SECONDS } = {}) {
  const p = normalizeAdvisoryPrefs(prefs);
  const every = p.intervalMinutes === 1 ? "1 minute" : `${p.intervalMinutes} minutes`;
  const snooze = p.snoozeHours === 1 ? "1 hour" : `${p.snoozeHours} hours`;
  return `In Autonomous mode, when ARIA finds a problem it can fix, it tells you first — ${ADVISORY_COUNT} times, ${every} apart. ` +
    `If nobody answers, it fixes the problem on its own after a ${countdownSeconds}-second countdown you can cancel, through the same safety checks as every fix. ` +
    `Problems that need administrator rights or a person are never fixed on their own: after ${ADVISORY_COUNT} unanswered notices ARIA tells your IT contact instead. ` +
    `Every notice lets you choose Fix now, Not now (waits ${snooze}) or Never for this.`;
}

export function emptyAdvisoryState() { return { v: ADVISORY_STORE_VERSION, seq: 0, records: [], never: [] }; }

function cleanRecord(r) {
  if (!r || typeof r !== "object") return null;
  const recipeId = token(r.recipeId);
  const id = token(r.id);
  if (!recipeId || !id) return null;
  const status = oneOf([...ADVISORY_ACTIVE, ...ADVISORY_TERMINAL], r.status, "closed");
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return {
    id,
    detectionId: token(r.detectionId) || null,
    recipeId,
    title: shortText(r.title, 120) || recipeId,
    summary: shortText(r.summary, 200),
    color: oneOf(["green", "yellow", "red"], r.color, "yellow"),
    track: oneOf(ADVISORY_TRACKS, r.track, "tech-contact"),
    kind: oneOf(ADVISORY_KINDS, r.kind, "needs-admin"),
    status,
    advisory: clampInt(r.advisory, 0, ADVISORY_COUNT, 0),
    of: ADVISORY_COUNT,
    cycle: clampInt(r.cycle, 1, 999, 1),
    openedAt: num(r.openedAt),
    updatedAt: num(r.updatedAt),
    lastAdvisoryAt: num(r.lastAdvisoryAt),
    nextAt: num(r.nextAt),
    notBefore: num(r.notBefore),
    readySince: num(r.readySince),
    fixingSince: num(r.fixingSince),
    snoozedUntil: num(r.snoozedUntil),
    frozenSince: num(r.frozenSince),
    frozenReason: shortText(r.frozenReason, 40) || null,
    closedAt: num(r.closedAt),
    outcome: shortText(r.outcome, 80) || null,
    choice: ADVISORY_CHOICES.includes(r.choice) ? r.choice : null,
    decidedAt: num(r.decidedAt),
    resumedAfterRestart: r.resumedAfterRestart === true,
    waitReason: shortText(r.waitReason, 60) || null
  };
}

/** Sanitize a persisted state (forward/backward safe; unknown fields dropped, malformed records dropped). */
export function normalizeAdvisoryState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const records = (Array.isArray(s.records) ? s.records : []).map(cleanRecord).filter(Boolean);
  const never = [...new Set((Array.isArray(s.never) ? s.never : []).map(token).filter(Boolean))].slice(0, 200);
  const seq = Math.max(clampInt(s.seq, 0, 1e9, 0), records.length);
  return { v: ADVISORY_STORE_VERSION, seq, records: trimRecords(records), never };
}

function trimRecords(records) {
  if (records.length <= ADVISORY_RECORDS_MAX) return records;
  const active = records.filter((r) => ADVISORY_ACTIVE.includes(r.status));
  const closed = records.filter((r) => !ADVISORY_ACTIVE.includes(r.status)).sort((a, b) => (b.closedAt || b.updatedAt || 0) - (a.closedAt || a.updatedAt || 0));
  return [...active, ...closed].slice(0, Math.max(ADVISORY_RECORDS_MAX, active.length));
}

export function isActive(record) { return Boolean(record && ADVISORY_ACTIVE.includes(record.status)); }

function intervalMs(prefs) { return normalizeAdvisoryPrefs(prefs).intervalMinutes * MIN; }

/** Milliseconds until the escalation's last step (the fix, or telling the IT contact) if nobody chooses. */
export function msUntilAction(record, prefs = {}, now = Date.now()) {
  if (!record) return null;
  if (record.status === "ready" || record.status === "fixing") return 0;
  if (record.status !== "advising" || !record.nextAt) return null;
  const rest = Math.max(0, ADVISORY_COUNT - record.advisory) * intervalMs(prefs);
  return Math.max(0, record.nextAt - now) + rest;
}

function minutesWord(ms) {
  const m = Math.max(1, Math.ceil(ms / MIN));
  return m === 1 ? "1 minute" : `${m} minutes`;
}

/** Plain-words copy for one record (what was found · what ARIA will do · when · the three choices). */
export function advisoryCopy(record, prefs = {}, now = Date.now()) {
  const r = record || {};
  const p = normalizeAdvisoryPrefs(prefs);
  const title = r.title || "A problem on this device";
  const summary = r.summary ? r.summary.replace(/\.?$/, ".") : "";
  const found = `I found a problem: ${title}.`;
  let willDo;
  if (r.track === "auto-fix") willDo = r.kind === "yellow" ? `I can fix this myself after making a restore point${summary ? " — " + summary.charAt(0).toLowerCase() + summary.slice(1) : "."}` : `I can fix this myself${summary ? " — " + summary.charAt(0).toLowerCase() + summary.slice(1) : "."}`;
  else if (r.kind === "red") willDo = "This one needs a person, so I won't change anything.";
  else if (r.kind === "not-yet-vetted") willDo = "This fix hasn't been proven on this device yet, so I won't run it on my own. Fix now runs it with you watching.";
  else if (r.kind === "needs-confirm") willDo = "This fix closes an app or resets a local cache, so it always waits for your yes — I never run it on my own. Fix now runs it with you here, after a restore point.";
  else willDo = "The fix needs administrator approval, so I won't change anything on my own. Fix now runs it with you here — Windows asks you first.";
  const left = msUntilAction(r, p, now);
  let when;
  if (r.status === "snoozed") when = r.snoozedUntil ? `You chose Not now — I'll check again after ${new Date(r.snoozedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : "You chose Not now.";
  else if (r.status === "fixing") when = "Fixing it now — a countdown you can cancel runs first.";
  else if (r.status === "ready") when = r.waitReason ? `Ready to fix — waiting for ${r.waitReason}.` : "Fixing it now.";
  else if (r.track === "auto-fix") {
    when = r.advisory >= ADVISORY_COUNT
      ? `Last notice: I'll fix it in about ${minutesWord(left == null ? p.intervalMinutes * MIN : left)} unless you choose — then a ${ADVISORY_COUNTDOWN_SECONDS}-second countdown you can cancel.`
      : `If you don't choose, I'll fix it in about ${minutesWord(left == null ? p.intervalMinutes * MIN : left)} — I'll remind you before then.`;
  } else {
    when = `If nobody answers, I'll tell your IT contact in about ${minutesWord(left == null ? p.intervalMinutes * MIN : left)}.`;
  }
  const snooze = p.snoozeHours === 1 ? "1 h" : `${p.snoozeHours} h`;
  const choices = choiceButtons(r).map((id) => ({
    id,
    label: id === "fix-now" ? (r.kind === "red" ? "Get help now" : "Fix now") : id === "not-now" ? `Not now (${snooze})` : "Never for this"
  }));
  return { headline: title, line: `Notice ${r.advisory || 1} of ${ADVISORY_COUNT}`, found, willDo, when, choices };
}

function choiceButtons(r) {
  if (!r || r.status === "fixing") return [];
  if (r.status === "snoozed") return ["fix-now", "never"];
  if (r.status === "advising" || r.status === "ready") return [...ADVISORY_CHOICES];
  return [];
}

/** The getState().advisories[] view: active records only, newest first, with plain-words copy. */
export function advisoryView(record, prefs = {}, now = Date.now()) {
  const copy = advisoryCopy(record, prefs, now);
  return {
    id: record.id,
    recipeId: record.recipeId,
    title: record.title,
    color: record.color,
    track: record.track,
    kind: record.kind,
    status: record.status,
    advisory: record.advisory,
    of: record.of,
    nextAt: isoOf(record.nextAt),
    snoozedUntil: isoOf(record.snoozedUntil),
    frozen: record.frozenSince ? (record.frozenReason || "paused") : null,
    minutesUntilAction: (() => { const ms = msUntilAction(record, prefs, now); return ms == null ? null : Math.ceil(ms / MIN); })(),
    choices: copy.choices.map((c) => c.id),
    copy
  };
}

/** Recent closed escalations — content-blind (ids, outcome words, counters, ISO times) for the audit view + bridge. */
export function outcomeView(record) {
  return { id: record.id, recipeId: record.recipeId, track: record.track, status: record.status, outcome: record.outcome, advisories: record.advisory, of: record.of, choice: record.choice, closedAt: isoOf(record.closedAt) };
}

// ── Pure reducers ─────────────────────────────────────────────────────────────────────────────────────────────────
// Each takes a state + input + now + prefs and returns { state, effects, ... } WITHOUT mutating the input.

function withRecord(state, id, fn) {
  const records = state.records.map((r) => (r.id === id ? fn({ ...r }) : r));
  return { ...state, records };
}

/**
 * Open an escalation for a detection. Idempotent per detection id; one active escalation per recipe (a repeat
 * detection of the same problem joins the open one); a recipe on the Never list never opens.
 * input: { detectionId, recipeId, title, summary, color, track, kind }
 */
export function openRecord(state, input = {}, now = Date.now(), prefs = {}) {
  const s = normalizeAdvisoryState(state);
  const recipeId = token(input.recipeId);
  if (!recipeId) return { state: s, opened: false, reason: "bad-recipe", effects: [] };
  if (s.never.includes(recipeId)) return { state: s, opened: false, reason: "never", effects: [] };
  const detectionId = token(input.detectionId) || null;
  if (detectionId && s.records.some((r) => r.detectionId === detectionId)) {
    return { state: s, opened: false, reason: "duplicate-detection", record: s.records.find((r) => r.detectionId === detectionId), effects: [] };
  }
  const open = s.records.find((r) => r.recipeId === recipeId && isActive(r));
  if (open) return { state: s, opened: false, reason: open.status === "snoozed" ? "snoozed" : "already-advising", record: open, effects: [] };
  const track = oneOf(ADVISORY_TRACKS, input.track, "tech-contact");
  const seq = s.seq + 1;
  const record = cleanRecord({
    id: `adv-${seq}-${recipeId}`.slice(0, 96),
    detectionId,
    recipeId,
    title: input.title,
    summary: input.summary,
    color: input.color,
    track,
    kind: oneOf(ADVISORY_KINDS, input.kind, track === "auto-fix" ? (input.color === "yellow" ? "yellow" : "green") : "needs-admin"),
    status: "advising",
    advisory: 1,
    cycle: 1,
    openedAt: now,
    updatedAt: now,
    lastAdvisoryAt: now,
    nextAt: now + intervalMs(prefs)
  });
  const next = { ...s, seq, records: trimRecords([record, ...s.records]) };
  return { state: next, opened: true, reason: "", record, effects: [{ type: "advise", id: record.id, n: 1, of: ADVISORY_COUNT, cycle: 1 }] };
}

/**
 * Advance the clock. ctx: { frozen: reason|"" — paused / fleet kill / license / stopped / live fixes off: nothing
 * advances and the remaining time is preserved; closeAll: reason|"" — Autonomous mode was left: every active
 * escalation closes, nothing runs on its own }.
 */
export function tickState(state, now = Date.now(), ctx = {}, prefs = {}) {
  let s = normalizeAdvisoryState(state);
  const effects = [];
  const interval = intervalMs(prefs);
  if (ctx.closeAll) {
    for (const r of s.records.filter(isActive)) {
      s = withRecord(s, r.id, (x) => ({ ...x, status: "closed", outcome: shortText(ctx.closeAll, 60), closedAt: now, updatedAt: now, nextAt: null }));
      effects.push({ type: "closed", id: r.id, reason: ctx.closeAll });
    }
    return { state: s, effects };
  }
  if (ctx.frozen) {
    for (const r of s.records.filter(isActive)) {
      if (r.status === "fixing" || r.frozenSince) continue;
      s = withRecord(s, r.id, (x) => ({ ...x, frozenSince: now, frozenReason: shortText(ctx.frozen, 40), updatedAt: now }));
      effects.push({ type: "frozen", id: r.id, reason: ctx.frozen });
    }
    return { state: s, effects };
  }
  for (const r0 of s.records.filter(isActive)) {
    let r = r0;
    if (r.frozenSince) {
      const pushed = Math.max(0, now - r.frozenSince);
      s = withRecord(s, r.id, (x) => ({ ...x, frozenSince: null, frozenReason: null, nextAt: x.nextAt ? x.nextAt + pushed : x.nextAt, notBefore: x.notBefore ? x.notBefore + pushed : x.notBefore, updatedAt: now }));
      effects.push({ type: "unfrozen", id: r.id, pushedMs: pushed });
      r = s.records.find((x) => x.id === r.id);
    }
    if (r.status === "advising" && r.nextAt && now >= r.nextAt) {
      if (r.advisory < ADVISORY_COUNT) {
        const n = r.advisory + 1;
        s = withRecord(s, r.id, (x) => ({ ...x, advisory: n, lastAdvisoryAt: now, nextAt: now + interval, updatedAt: now, resumedAfterRestart: false }));
        effects.push({ type: "advise", id: r.id, n, of: ADVISORY_COUNT, cycle: r.cycle });
      } else if (r.track === "auto-fix") {
        s = withRecord(s, r.id, (x) => ({ ...x, status: "ready", readySince: now, nextAt: null, notBefore: null, waitReason: null, updatedAt: now }));
        effects.push({ type: "auto-fix", id: r.id });
      } else {
        s = withRecord(s, r.id, (x) => ({ ...x, status: "escalated", outcome: "escalated-unanswered", closedAt: now, nextAt: null, updatedAt: now }));
        effects.push({ type: "escalate", id: r.id, why: "unanswered" });
      }
    } else if (r.status === "ready" && r.notBefore && now >= r.notBefore) {
      s = withRecord(s, r.id, (x) => ({ ...x, notBefore: null, updatedAt: now }));
      effects.push({ type: "auto-fix", id: r.id, retry: true });
    } else if (r.status === "snoozed" && r.snoozedUntil && now >= r.snoozedUntil) {
      const cycle = r.cycle + 1;
      s = withRecord(s, r.id, (x) => ({ ...x, status: "advising", cycle, advisory: 1, choice: null, decidedAt: null, snoozedUntil: null, lastAdvisoryAt: now, nextAt: now + interval, updatedAt: now }));
      effects.push({ type: "reopened", id: r.id, cycle });
      effects.push({ type: "advise", id: r.id, n: 1, of: ADVISORY_COUNT, cycle });
    } else if (r.status === "fixing" && r.fixingSince && now - r.fixingSince > ADVISORY_FIXING_STALE_MS) {
      s = withRecord(s, r.id, (x) => ({ ...x, status: "closed", outcome: "no-result", closedAt: now, updatedAt: now }));
      effects.push({ type: "closed", id: r.id, reason: "no-result" });
    }
  }
  return { state: s, effects };
}

/** A person's choice on a notice. Any choice ends the escalation (Not now: a fresh cycle only after the snooze). */
export function ackRecord(state, id, choice, now = Date.now(), prefs = {}) {
  const s = normalizeAdvisoryState(state);
  const r = s.records.find((x) => x.id === String(id || ""));
  if (!r) return { state: s, ok: false, reason: "not-found", effects: [] };
  if (!ADVISORY_CHOICES.includes(choice)) return { state: s, ok: false, reason: "bad-choice", record: r, effects: [] };
  if (r.status === "fixing") return { state: s, ok: false, reason: "already-fixing", record: r, effects: [] };
  if (!isActive(r)) return { state: s, ok: false, reason: `already-${r.status}`, record: r, effects: [] };
  if (r.status === "snoozed" && choice === "not-now") return { state: s, ok: false, reason: "already-snoozed", record: r, effects: [] };
  const base = { choice, decidedAt: now, updatedAt: now, nextAt: null, notBefore: null };
  let next, effects;
  if (choice === "fix-now") {
    if (r.kind === "red") {
      next = withRecord(s, r.id, (x) => ({ ...x, ...base, status: "escalated", outcome: "escalated-on-request", closedAt: now }));
      effects = [{ type: "escalate", id: r.id, why: "fix-now" }];
    } else {
      next = withRecord(s, r.id, (x) => ({ ...x, ...base, status: "acknowledged", outcome: "fix-now", closedAt: now }));
      effects = [{ type: "run-now", id: r.id }];
    }
  } else if (choice === "not-now") {
    const until = now + normalizeAdvisoryPrefs(prefs).snoozeHours * HOUR;
    next = withRecord(s, r.id, (x) => ({ ...x, ...base, status: "snoozed", snoozedUntil: until }));
    effects = [{ type: "snoozed", id: r.id, until }];
  } else {
    next = withRecord(s, r.id, (x) => ({ ...x, ...base, status: "never", outcome: "never", closedAt: now }));
    next = { ...next, never: [...new Set([...next.never, r.recipeId])] };
    effects = [{ type: "never", id: r.id, recipeId: r.recipeId }];
  }
  return { state: next, ok: true, reason: "", record: next.records.find((x) => x.id === r.id), effects };
}

/** Ctrl+Alt+K: every active escalation is BLOCKED (terminal, audited) — never resumed silently. */
export function killAll(state, now = Date.now(), reason = "kill-switch") {
  let s = normalizeAdvisoryState(state);
  const effects = [];
  for (const r of s.records.filter(isActive)) {
    s = withRecord(s, r.id, (x) => ({ ...x, status: "blocked", outcome: shortText(reason, 40), closedAt: now, nextAt: null, notBefore: null, updatedAt: now }));
    effects.push({ type: "blocked", id: r.id });
  }
  return { state: s, effects, blocked: effects.length };
}

/**
 * After an app restart: resume CONSERVATIVELY. Every escalation keeps its notice number (never skips ahead) and the
 * next step waits at least one full interval from now. One that was ready / mid-fix when the app closed goes back to
 * "notice 3 of 3" — it is never re-run straight away.
 */
export function restoreState(state, now = Date.now(), prefs = {}) {
  let s = normalizeAdvisoryState(state);
  const effects = [];
  const interval = intervalMs(prefs);
  for (const r of s.records.filter(isActive)) {
    if (r.status === "snoozed") continue;
    const advisory = r.status === "advising" ? r.advisory : ADVISORY_COUNT;
    const nextAt = r.status === "advising" ? Math.max(r.nextAt || 0, now + interval) : now + interval;
    s = withRecord(s, r.id, (x) => ({ ...x, status: "advising", advisory, nextAt, notBefore: null, readySince: null, fixingSince: null, frozenSince: null, frozenReason: null, waitReason: null, resumedAfterRestart: true, updatedAt: now }));
    effects.push({ type: "resumed", id: r.id, n: advisory, was: r.status });
  }
  return { state: s, effects };
}

/** The final step could not start yet (e.g. the 30-minute gap between automatic fixes): wait, retry at `until`. */
export function deferRecord(state, id, until, reason = "", now = Date.now()) {
  const s = normalizeAdvisoryState(state);
  const r = s.records.find((x) => x.id === String(id || ""));
  if (!r || r.status !== "ready") return { state: s, ok: false };
  return { state: withRecord(s, r.id, (x) => ({ ...x, notBefore: Number(until) || now + MIN, waitReason: shortText(reason, 60) || null, updatedAt: now })), ok: true };
}

/** The final step was handed to the supervised pipeline. */
export function markFixing(state, id, now = Date.now()) {
  const s = normalizeAdvisoryState(state);
  const r = s.records.find((x) => x.id === String(id || ""));
  if (!r || (r.status !== "ready" && r.status !== "advising")) return { state: s, ok: false };
  return { state: withRecord(s, r.id, (x) => ({ ...x, status: "fixing", fixingSince: now, nextAt: null, notBefore: null, waitReason: null, updatedAt: now })), ok: true };
}

/**
 * The pipeline reported back. status ∈ fixed | fix-failed | held | cancelled | blocked | closed; `outcome` is a short
 * content-blind word ("verified", "approval-requested", "policy", "countdown-cancelled", …).
 */
export function settleRecord(state, id, status, outcome = "", now = Date.now()) {
  const s = normalizeAdvisoryState(state);
  const r = s.records.find((x) => x.id === String(id || ""));
  if (!r || !isActive(r)) return { state: s, ok: false };
  const st = oneOf(ADVISORY_TERMINAL, status, "closed");
  return { state: withRecord(s, r.id, (x) => ({ ...x, status: st, outcome: shortText(outcome || st, 80), closedAt: now, nextAt: null, notBefore: null, updatedAt: now })), ok: true };
}

/** Remove a recipe from the Never list ("Allow again"). */
export function clearNeverRecipe(state, recipeId) {
  const s = normalizeAdvisoryState(state);
  const id = token(recipeId);
  return { state: { ...s, never: s.never.filter((x) => x !== id) }, removed: s.never.includes(id) };
}

// ── The driver-facing machine: owns the state, persists after every change, injectable clock ─────────────────────
export function createAdvisoryEscalation({ now = () => Date.now(), load = () => null, save = () => {} } = {}) {
  let state;
  try { state = normalizeAdvisoryState(load()); } catch { state = emptyAdvisoryState(); }
  const commit = (next) => { state = next; try { save(state); } catch { /* persistence is best-effort; the clock keeps running */ } return state; };
  const find = (id) => state.records.find((r) => r.id === String(id || "")) || null;
  return {
    get state() { return state; },
    find,
    findActiveByRecipe: (recipeId) => state.records.find((r) => r.recipeId === recipeId && isActive(r)) || null,
    active: () => state.records.filter(isActive),
    neverList: () => state.never.slice(),
    isNever: (recipeId) => state.never.includes(String(recipeId || "")),
    open(input, prefs) { const r = openRecord(state, input, now(), prefs); commit(r.state); return r; },
    tick(ctx, prefs) { const r = tickState(state, now(), ctx, prefs); commit(r.state); return r; },
    ack(id, choice, prefs) { const r = ackRecord(state, id, choice, now(), prefs); commit(r.state); return r; },
    kill(reason) { const r = killAll(state, now(), reason); commit(r.state); return r; },
    restore(prefs) { const r = restoreState(state, now(), prefs); commit(r.state); return r; },
    defer(id, until, reason) { const r = deferRecord(state, id, until, reason, now()); commit(r.state); return r; },
    markFixing(id) { const r = markFixing(state, id, now()); commit(r.state); return r; },
    settle(id, status, outcome) { const r = settleRecord(state, id, status, outcome, now()); commit(r.state); return r; },
    clearNever(recipeId) { const r = clearNeverRecipe(state, recipeId); commit(r.state); return r; },
    forState(prefs) {
      const t = now();
      return state.records.filter(isActive).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map((r) => advisoryView(r, prefs, t));
    },
    recentOutcomes(limit = 10) {
      return state.records.filter((r) => !isActive(r)).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, limit).map(outcomeView);
    }
  };
}
