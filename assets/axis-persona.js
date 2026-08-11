// axis-persona.js — AXIS's conversational layer (the "JARVIS flow"), per
// documents/product-engineering/AXIS-JARVIS-VOICE-DIRECTOR-SPEC-2026-07-01.md.
//
// PURELY ADDITIVE. This module holds only the persona + flow grammar; every existing voice behavior
// (push-to-talk, humanize, sentence chunking, persisted voice choice, barge-in, voice-ON default)
// stays exactly where it was in axis-app.js and is unchanged. Nothing here sends, approves, or pays.
//
// Two things this file decides:
//   1. WHO AXIS SOUNDS LIKE — a distinct woman's voice, deliberately NOT the customer-facing ARIA orb.
//   2. HOW A TURN FLOWS — wake word, instant acknowledgement, hands-free turn-taking, stand-down.

// ── 1. Voice identity ────────────────────────────────────────────────────────
// AXIS is a woman's voice with an en-GB register: composed, lower-pitched, unhurried. ARIA (the
// customer orb, assets/aria-core.js) is en-US at rate 0.95 / pitch 1.05. Keeping AXIS on a different
// accent AND a different prosody means the two are never mistaken for each other, even in the worst
// case where a browser offers only one shared female voice.

// Preferred, in order. Edge/Windows exposes the "Online (Natural)" neural set; macOS exposes Siri/
// premium; Chrome exposes the Google network voices.
// Short tokens are word-bounded on purpose: an unbounded 'ava' would also match "Savannah", and an
// unbounded 'male' in the demote list below would match "English Female" and demote every one of them.
export const AXIS_FEMALE_PREF = [
  '\\bsonia\\b',   // Microsoft Sonia Online (Natural) — en-GB. The AXIS house voice.
  '\\blibby\\b',   // Microsoft Libby Online (Natural) — en-GB
  '\\bmaisie\\b', '\\bolivia\\b', '\\bava\\b', '\\bemma\\b', '\\bjenny\\b', '\\bmichelle\\b',
  '\\bnova\\b', '\\bclara\\b', '\\bmartha\\b', '\\bfemale\\b',
];

// ARIA's own preference list (aria-core.js line 381). AXIS DEMOTES these rather than banning them:
// a penalty keeps AXIS off ARIA's voice whenever any alternative exists, but still lets a bare
// browser fall back to a real female voice instead of dropping to a male or robotic one.
export const AXIS_ARIA_COLLISION = [
  '\\bsamantha\\b', '\\bzira\\b', 'google uk english female', '\\bkaren\\b', '\\bvictoria\\b',
  '\\ballison\\b', '\\bhazel\\b', '\\beva\\b', '\\btessa\\b', '\\bfiona\\b', '\\bmoira\\b',
  '\\bveena\\b', '\\bsusan\\b', '\\bcatherine\\b', '\\bserena\\b',
];

// AXIS is never male. These are demoted hard so the ranker cannot land on one.
export const AXIS_MALE_DEMOTE = [
  '\\bguy\\b', '\\bdavis\\b', '\\bandrew\\b', '\\bbrian\\b', '\\bchristopher\\b', '\\beric\\b',
  '\\broger\\b', '\\bsteffan\\b', '\\bryan\\b', '\\bthomas\\b', '\\bdaniel\\b', '\\balex\\b',
  '\\barthur\\b', '\\bgeorge\\b', '\\bjames\\b', '\\bmark\\b', '\\bdavid\\b', '\\bmale\\b',
];

// Lower and level — the composed register. (ARIA: rate .95 / pitch 1.05. AXIS is deliberately apart.)
export const AXIS_PROSODY = { rate: 1.0, pitch: 0.92, legacyRate: 1.02 };

const hasAny = (haystack, list) => list.some((w) => new RegExp(w, 'i').test(haystack));

// Score bonus AXIS adds on top of the existing quality ranking in axis-app.js (neural > google >
// premium > online). Returns a delta, so the original ranking is extended, never replaced.
export function axisPersonaBonus(name, lang) {
  const n = String(name || '');
  const l = String(lang || '');
  let s = 0;
  if (hasAny(n, AXIS_FEMALE_PREF)) s += 34;          // a named AXIS voice
  if (/^en(-|_)?GB/i.test(l)) s += 40;               // the en-GB register — ARIA is en-US
  if (hasAny(n, AXIS_ARIA_COLLISION)) s -= 45;       // don't wear the customer orb's voice
  if (hasAny(n, AXIS_MALE_DEMOTE)) s -= 60;          // AXIS is never male
  return s;
}

// ── 2. Address + spoken copy ─────────────────────────────────────────────────
export const AXIS_ADDRESS = 'Ahmad'; // vault 07_Cortex/AXIS.md: "Ahmad" — never "sir", never "boss".

// Instant acknowledgement. The director round-trip takes a second or two; JARVIS never leaves dead
// air. Short, rotating, never a promise about what it found.
const ACKS = ['On it.', 'Checking.', 'One moment.', 'Looking now.', 'Working on it.'];
let __ack = 0;
export function ackLine() { return ACKS[__ack++ % ACKS.length]; }

const partOfDay = (h) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

// Boot briefing. Rule 14: AXIS never voices a number it does not have. If the snapshot has not
// landed, it says so — it does NOT report "all quiet", because that is a claim about real data.
export function greetLine(kpis, hour = new Date().getHours(), name = AXIS_ADDRESS) {
  const k = kpis || {};
  const pick = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const a = pick(k.awaiting_approval), m = pick(k.messages_waiting), f = pick(k.followups_due);
  if (a === null && m === null && f === null) return `${partOfDay(hour)}, ${name}. I do not have the board yet.`;
  const bits = [];
  if (a) bits.push(`${a} ${a === 1 ? 'approval' : 'approvals'} waiting`);
  if (m) bits.push(`${m} client ${m === 1 ? 'reply' : 'replies'} waiting`);
  if (f) bits.push(`${f} ${f === 1 ? 'follow-up' : 'follow-ups'} due`);
  if (!bits.length) return `${partOfDay(hour)}, ${name}. All quiet. Nothing needs you.`;
  return `${partOfDay(hour)}, ${name}. ${bits.join(', ')}.`;
}

// ── 3. Turn grammar ──────────────────────────────────────────────────────────
// Wake: "AXIS", "hey AXIS", "okay AXIS" at the head of an utterance.
export const WAKE_RE = /(?:^|\b)(?:hey\s+|ok(?:ay)?\s+)?axis\b/i;
// Stand-down: the spoken kill-switch from the spec ("AXIS stop"). Checked BEFORE everything else.
export const STOP_RE = /\baxis[\s,]+(?:stop|cancel|quiet|enough|stand\s*down|shut\s*up)\b|^\s*(?:stop|cancel)\s*[.!]?\s*$/i;
// Verbal confirm / decline for a routed intent.
export const CONFIRM_RE = /\b(?:confirm(?:ed|s)?|approve[ds]?|do it|go ahead|send it|affirmative|yes(?:\s+(?:do|go|please))?)\b/i;
export const DENY_RE = /\b(?:no|nope|cancel|reject|hold|deny|negative|stand\s*down|forget it)\b/i;

export const isWake = (t) => WAKE_RE.test(String(t || ''));
export const isStop = (t) => STOP_RE.test(String(t || ''));
// Order matters at the call site: stand-down wins over deny, deny wins over confirm.
export const isConfirm = (t) => !isStop(t) && !DENY_RE.test(String(t || '')) && CONFIRM_RE.test(String(t || ''));
export const isDeny = (t) => !isStop(t) && DENY_RE.test(String(t || ''));

// Strip a leading wake phrase so "AXIS, what's going on" reaches the director as "what's going on".
export function stripWake(text) {
  return String(text || '').replace(/^\s*(?:hey\s+|ok(?:ay)?\s+)?axis\b[\s,.:!?-]*/i, '').trim();
}

// The spoken tail AXIS appends when the director routed something. `needsApproval` is the hard-stop
// class from the spec — irreversible/anomalous work. Voice may confirm a ROUTE (the worker still
// holds anything irreversible in Approvals); it may never confirm a hard-stop. That stays a click.
export function routeTail(agent, needsApproval) {
  if (needsApproval) return `That one needs your click, ${AXIS_ADDRESS}. It is waiting in Approvals.`;
  return `Route to ${agent}? Say confirm, or cancel.`;
}
