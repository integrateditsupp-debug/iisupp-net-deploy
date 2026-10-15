// axis-task-ids.cjs — the ids, row signatures, overlay rules and Toronto dates the live task list and the
// situation model share (RUN-AX3, 2026-10-15). Pure: no Blobs, no network, no clock of its own.
//
// Why a separate module: lib/axis-situation.cjs (what needs Ahmad, ranked) and lib/axis-tasks.cjs (the one
// live list AXIS and Ahmad work together) must agree on three things or the screen and the brain disagree:
//   1. the id of every row — `<source>:<key>`, stable per source (the store's own id, the ledger's own #N);
//   2. what an overlay record means — an acknowledged / done / archived / snoozed row drops out of the
//      "needs Ahmad" ranking (until its snooze ends) WITHOUT anyone editing the row's own store, which for
//      the CEO ledger lives on Ahmad's machine and for the board lives in the worker's SQLite;
//   3. the calendar — whole America/Toronto days, never UTC (the RUN-AX2 lesson).
// The situation requires this file and this file requires nothing, so there is no cycle.
'use strict';
const crypto = require('node:crypto');

const TZ = 'America/Toronto';
const DAY = 86400000;
// Where the overlay and the audit live (Netlify Blobs). One JSON map per store, keyed by row id, so a whole
// list is one read — the situation is loaded inside a 2.5 s budget on every brain call.
const OVERLAY_STORE = 'axis-task-overlay';
const OVERLAY_KEY = 'rows';
const AUDIT_STORE = 'axis-task-audit';
const AUDIT_KEY = 'log';

// ── Ids ──────────────────────────────────────────────────────────────────────────────────────────────
// One prefix per source. The key is the source's own id, never a position in a list, so an id survives
// re-ranking, re-sorting and every worker tick. Documented in docs/AXIS-TASKS.md.
const SOURCES = {
  todo: 'todo',                     // axis-exec 'todos' (the To-do tab)
  followup: 'followup',             // axis-exec 'followups' (follow-ups AXIS created with followUp())
  automation: 'automation',         // axis-exec 'tasks' (the Automate tab)
  approval: 'approval',             // axis-exec 'approvals' (spend / reply / outreach approvals)
  pc: 'pc',                         // axis-exec 'local-jobs' (Axis Local commands waiting for an OK)
  ledger: 'ledger',                 // axis-snapshots overview.ceo_critical (CEO-CRITICAL-ITEMS.md rows)
  boardFollowup: 'board-followup',  // axis-snapshots followups (the worker's follow_ups rows)
  boardApproval: 'board-approval',  // axis-snapshots approvals (pending outreach drafts)
  inbox: 'inbox',                   // axis-snapshots inbox (client replies + new requests)
  document: 'document',             // axis-snapshots documents (drafts not sent)
  waiting: 'waiting',               // axis-snapshots waiting_reply (threads that need a delegate decision)
  job: 'job',                       // axis-brain-jobs (Claude worker jobs: failed, queued, working)
  agent: 'agent',                   // _axis-state-full.json agents reporting a failure
};

const hash8 = (s) => crypto.createHash('sha1').update(String(s || '')).digest('hex').slice(0, 8);
const clean = (v) => String(v == null ? '' : v).trim();

/** The ledger's own number is the stable key ("#5"); a Watch bullet has none, so its text is hashed. */
function ledgerKey(r) {
  if (r && r.ref && r.ref !== 'watch') return clean(r.ref);
  return 'watch-' + hash8(r && r.what);
}
function makeId(source, key) {
  const k = clean(key);
  return k ? `${source}:${k}` : null;
}
function parseId(id) {
  const s = clean(id);
  const i = s.indexOf(':');
  if (i <= 0) return null;
  return { source: s.slice(0, i), key: s.slice(i + 1) };
}

// ── Row signatures ───────────────────────────────────────────────────────────────────────────────────
// An acknowledgement is "I have seen THIS". When the row itself changes (a new deadline, the ledger stamps
// it OVERDUE, a follow-up is rescheduled) the acknowledgement lapses and the row ranks again — a new
// development must never hide behind an old "seen it". Only the fields that mean "something changed for
// Ahmad" go in; a cosmetic status note (a calendar id added to the ledger cell) does not.
function rowSig(parts) {
  return crypto.createHash('sha1').update(JSON.stringify(parts || [])).digest('hex').slice(0, 12);
}
/** The store's own id when it has one; otherwise a hash of the row's identifying fields (stable per row). */
function keyOf(id, parts) {
  return id !== null && id !== undefined && String(id).trim() !== '' ? String(id).trim() : 'h-' + hash8(JSON.stringify(parts || []));
}
// One signature per source — both the situation and the task list compute them from the same row, so an
// acknowledgement written from the console is honoured identically by the brain.
const SIG = {
  ledger: (r) => rowSig([r.what || '', r.deadline || null, !!r.overdue, !!r.cleared, r.section || '']),
  boardFollowup: (f) => rowSig([f.due_at || null, f.status || 'scheduled']),
  boardApproval: (r) => rowSig([r.status || '', r.subject || '']),
  inbox: (m) => rowSig([m.received_at || null, !!m.actioned, m.snoozed_until || null]),
  document: (d) => rowSig([d.status || '', d.title || '', d.due_at || null]),
  waiting: (w) => rowSig([w.touches_done || 0, !!w.delegate]),
  waitingAll: (n) => rowSig([Number(n) || 0]),
  job: (j) => rowSig([j.state || '', j.error || '']),
  agent: (a) => rowSig([a.status || a.health || '', a.note || a.last || '']),
  todo: (t) => rowSig([t.title || '', !!t.done, t.due || null]),
  followup: (f) => rowSig([f.title || '', f.status || '', f.due || null]),
  automation: (t) => rowSig([t.status || '', (t.last_result && t.last_result.error) || '']),
  approval: (a) => rowSig([a.status || '', a.title || '']),
  pc: (j) => rowSig([j.status || '', j.title || '']),
};

// ── Overlay ──────────────────────────────────────────────────────────────────────────────────────────
// axis-task-overlay holds one record per row id: { status, until, sig, edits, draft, staged, followUps,
// at, by, via }. These statuses take a row out of the "needs Ahmad" ranking.
const OVERLAY_CLOSED = new Set(['acknowledged', 'done', 'archived', 'cancelled', 'rejected', 'approved']);

/**
 * What an overlay record means right now. Never throws; a missing/garbage record means "no overlay".
 * → { status: string|null, until: ISO|null, active: bool (takes the row out of the ranking),
 *     lapsed: bool (an acknowledgement the row has outgrown), snoozeEnded: bool, edits, draft, staged }
 */
function resolveOverlay(rec, { sig = null, now = new Date() } = {}) {
  const out = { status: null, until: null, active: false, lapsed: false, snoozeEnded: false, edits: null, draft: null, staged: null, followUps: [] };
  if (!rec || typeof rec !== 'object') return out;
  out.edits = rec.edits && typeof rec.edits === 'object' ? rec.edits : null;
  out.draft = rec.draft && typeof rec.draft === 'object' ? rec.draft : null;
  out.staged = rec.staged && typeof rec.staged === 'object' ? rec.staged : null;
  out.followUps = Array.isArray(rec.followUps) ? rec.followUps.slice(0, 20) : [];
  const st = clean(rec.status);
  if (!st || st === 'open') return out;
  const t = now instanceof Date ? now.getTime() : Date.now();
  if (st === 'snoozed') {
    const until = Date.parse(rec.until || '');
    if (!Number.isFinite(until) || until <= t) { out.snoozeEnded = true; return out; }
    out.status = 'snoozed'; out.until = new Date(until).toISOString(); out.active = true;
    return out;
  }
  if (st === 'acknowledged' && rec.sig && sig && rec.sig !== sig) { out.lapsed = true; return out; }
  out.status = st;
  out.active = OVERLAY_CLOSED.has(st);
  return out;
}
/** True when the overlay takes this row out of "needs Ahmad" right now. */
function overlayHides(rec, opts) { return resolveOverlay(rec, opts).active; }

// ── Toronto calendar ─────────────────────────────────────────────────────────────────────────────────
function localParts(date, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: WD[p.weekday] };
}
function tzOffsetMinutes(date, tz = TZ) {
  const p = localParts(date, tz);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
/** Wall-clock time in `tz` → the UTC instant. Two passes so a DST edge resolves to the right side. */
function zonedToUtc(y, m, d, h = 0, mi = 0, tz = TZ) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  const off2 = tzOffsetMinutes(new Date(t), tz);
  t = guess - off2 * 60000;
  return new Date(t);
}
const dayNumber = (date, tz = TZ) => { const p = localParts(date, tz); return Date.UTC(p.y, p.m - 1, p.d) / DAY; };
/** Whole Toronto calendar days from now to `when` (negative = overdue). null when there is no date. */
function daysUntil(when, now = new Date(), tz = TZ) {
  if (when === null || when === undefined || when === '') return null;
  const d = new Date(typeof when === 'number' ? when : String(when));
  if (Number.isNaN(d.getTime())) return null;
  return dayNumber(d, tz) - dayNumber(now, tz);
}
/** The same labels the situation uses: "OVERDUE 2d" · "due today" · "due tomorrow" · "due in 3d" · "". */
function dueLabel(when, now = new Date(), tz = TZ) {
  const n = daysUntil(when, now, tz);
  if (n === null) return '';
  if (n < 0) return `OVERDUE ${-n}d`;
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  return `due in ${n}d`;
}
/** "Fri Oct 17" (+ " 15:00" when the time is not the 09:00 / end-of-day default). */
function fmtWhen(when, tz = TZ) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return '';
  const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(d).replace(/,/g, '');
  const p = localParts(d, tz);
  const hm = `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
  return hm === '09:00' || hm === '23:59' ? s : `${s} ${hm}`;
}

const WEEKDAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

/**
 * A date Ahmad or the model said → a UTC Date, read on the Toronto calendar. null when unreadable (the
 * caller answers "could not read the date" — it never guesses). Accepts ISO (with or without a time or an
 * offset), today / tonight / tomorrow / end of day / end of week / next week / a weekday ("friday",
 * "next mon", "fri 3pm"), "in 3 days", "+2d", "2w". A bare date lands at `defaultHour` (09:00 for a
 * snooze or a follow-up; callers pass 23:59 for a due date — "by end of that day", as the ledger reads it).
 */
function parseWhen(text, { now = new Date(), tz = TZ, defaultHour = 9, defaultMinute = 0 } = {}) {
  const raw = clean(text);
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/[.,]+$/, '').replace(/\s+/g, ' ');
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d;
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t ](\d{1,2}):(\d{2}))?$/);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return zonedToUtc(y, mo, d, m[4] != null ? +m[4] : defaultHour, m[5] != null ? +m[5] : defaultMinute, tz);
  }
  const base = localParts(now, tz);
  const at = (offsetDays, h = defaultHour, mi = defaultMinute) => {
    const dt = new Date(Date.UTC(base.y, base.m - 1, base.d + offsetDays));
    return zonedToUtc(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), h, mi, tz);
  };
  // An optional clock time at the end: "friday 3pm", "tomorrow at 14:30", "monday 9".
  let hour = defaultHour, minute = defaultMinute, rest = s;
  const tm = s.match(/^(.*?)(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (tm && tm[1] && (tm[4] || tm[3] || /\bat\b/.test(s))) {
    let h = +tm[2]; const mi = tm[3] != null ? +tm[3] : 0;
    if (tm[4] === 'pm' && h < 12) h += 12;
    if (tm[4] === 'am' && h === 12) h = 0;
    if (h <= 23 && mi <= 59) { hour = h; minute = mi; rest = tm[1].trim(); }
  }
  if (rest === 'later today' || rest === 'later') return new Date(now.getTime() + 3 * 3600000);
  if (rest === 'today') return hour === defaultHour && minute === defaultMinute ? at(0, 17, 0) : at(0, hour, minute);
  if (/^(?:tonight|this evening)$/.test(rest)) return at(0, 20, 0);
  if (/^(?:eod|end of (?:the )?day)$/.test(rest)) return at(0, 17, 0);
  if (/^(?:tomorrow|tmrw|tmr)(?: morning)?$/.test(rest)) return at(1, hour, minute);
  if (/^(?:next week)$/.test(rest)) { const add = ((1 - base.wd + 7) % 7) || 7; return at(add, hour, minute); }
  if (/^(?:eow|end of (?:the )?week|this weekend|weekend)$/.test(rest)) {
    const target = /weekend/.test(rest) ? 6 : 5; let add = (target - base.wd + 7) % 7;
    if (add === 0 && base.h >= 17) add = 7;
    return at(add, /weekend/.test(rest) ? 10 : 17, 0);
  }
  m = rest.match(/^(?:(next|this|on|coming)\s+)?([a-z]+)$/);
  if (m && WEEKDAYS[m[2]] !== undefined) {
    let add = (WEEKDAYS[m[2]] - base.wd + 7) % 7;
    if (add === 0) add = 7;                       // "friday" said on a Friday means next Friday
    return at(add, hour, minute);                 // "next mon" said on a Wednesday = the coming Monday
  }
  m = rest.match(/^(?:in\s+)?\+?(\d{1,3})\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?)(?:\s+from now)?$/);
  if (m) {
    const n = +m[1]; const u = m[2][0];
    if (u === 'm' && !/^mo/.test(m[2])) return new Date(now.getTime() + n * 60000);
    if (u === 'h') return new Date(now.getTime() + n * 3600000);
    if (u === 'd') return at(n, hour, minute);
    if (u === 'w') return at(7 * n, hour, minute);
  }
  m = rest.match(/^(?:in\s+)?(a|an|one|two|three|four|five|six|seven)\s+(day|days|week|weeks)$/);
  if (m) {
    const N = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }[m[1]];
    return at((/week/.test(m[2]) ? 7 : 1) * N, hour, minute);
  }
  return null;
}

module.exports = {
  TZ, OVERLAY_STORE, OVERLAY_KEY, AUDIT_STORE, AUDIT_KEY, SOURCES, OVERLAY_CLOSED, SIG, hash8, keyOf, ledgerKey, makeId, parseId, rowSig, resolveOverlay, overlayHides,
  localParts, zonedToUtc, daysUntil, dueLabel, fmtWhen, parseWhen,
};
