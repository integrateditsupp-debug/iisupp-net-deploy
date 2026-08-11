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

// CROSS-ENGINE PARITY (2026-08-11, Ahmad: "on edge its one voice and chrome another").
// Edge and Chrome ship different voice inventories — Edge has the "Online (Natural)" neural set
// (Sonia/Libby), Chrome has Google's network voices. Getting the *same* voice in both is impossible
// with free browser TTS; it would take a paid cloud TTS, which breaks the $0 rule.
// What IS possible: make each engine land on the same *character*. Edge's Sonia is the reference,
// and every other family is rate/pitch-corrected toward it — Google's voices run fast and bright,
// so they get slowed and lowered the most. The result is one recognisable AXIS in either browser.
export const VOICE_PROFILES = {
  neural:  { rate: 0.98, pitch: 0.92 }, // Edge "Online (Natural)" — THE REFERENCE
  google:  { rate: 0.88, pitch: 0.82 }, // Chrome network voices: fast + bright → slow + lower
  premium: { rate: 0.95, pitch: 0.90 }, // macOS Siri/premium/enhanced
  legacy:  { rate: 0.94, pitch: 0.96 }, // SAPI desktop — pitch-shifting these sounds artificial
};
export function voiceFamily(name) {
  const n = String(name || '');
  if (/natural|neural/i.test(n)) return 'neural';
  if (/google/i.test(n)) return 'google';
  if (/premium|enhanced|siri/i.test(n)) return 'premium';
  return 'legacy';
}
export function voiceProfile(voice) {
  return VOICE_PROFILES[voiceFamily(voice && voice.name)] || VOICE_PROFILES.legacy;
}

// "Make it more smart sounding." A screen reader spells jargon out; a colleague says the words.
// Applied AFTER the existing axisHumanizeForSpeech (which is untouched — its exact outputs are
// asserted by tests/axis-voice-dock.test.mjs).
const SAY_AS = [
  [/\bKB\b/g, 'knowledge base'], [/\bKPIs?\b/g, 'key numbers'], [/\bCRM\b/g, 'C R M'],
  [/\bSLAs?\b/g, 'service level'], [/\bMSPs?\b/g, 'managed service providers'],
  [/\bSMBs?\b/g, 'small businesses'], [/\bIIS\b/g, 'I I S'], [/\bAXIS\b/g, 'Axis'],
  [/\bARIA\b/g, 'Aria'], [/\bAPIs?\b/g, 'A P I'], [/\bJWT\b/g, 'token'],
  [/\bOAuth\b/gi, 'oh-auth'], [/\bDKIM\b/g, 'D KIM'], [/\bQ&A\b/gi, 'questions and answers'],
  [/\bvs\.?\b/gi, 'versus'], [/\betc\.?\b/gi, 'and so on'], [/\bapprox\.?\b/gi, 'roughly'],
  [/\bCAD\b/g, 'Canadian dollars'], [/\bASAP\b/g, 'as soon as possible'],
];
export function polishForSpeech(text) {
  let t = String(text || '');
  for (const [re, to] of SAY_AS) t = t.replace(re, to);
  t = t.replace(/\$\s?([\d,]+(?:\.\d+)?)\s?[kK]\b/g, '$1 thousand dollars')
       .replace(/\$\s?([\d,]+(?:\.\d+)?)/g, '$1 dollars')
       .replace(/(\d)\s*[-–]\s*(\d)/g, '$1 to $2')          // "3-5" → "3 to 5", not "three minus five"
       .replace(/\b(\d{1,2}):(\d{2})\b/g, '$1 $2')           // clock times read naturally
       .replace(/([a-z])\/([a-z])/gi, '$1 or $2')            // "and/or" → "and or"
       .replace(/\s{2,}/g, ' ').trim();
  return t;
}

// Clause-aware phrasing: a colleague breathes at commas, not only at full stops. Splitting here
// (rather than only on sentence ends) is what stops long status lines sounding like one flat run.
export function phraseChunks(text, max = 180) {
  const sentences = String(text || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [String(text || '')];
  const out = [];
  for (const s of sentences) {
    if (s.length <= max) { if (s.trim()) out.push(s.trim()); continue; }
    let buf = '';
    for (const clause of s.split(/(?<=[,;:])\s+/)) {
      if ((buf + ' ' + clause).trim().length > max && buf) { out.push(buf.trim()); buf = clause; }
      else buf += (buf ? ' ' : '') + clause;
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out.length ? out : [String(text || '').trim()].filter(Boolean);
}

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
// THE WAKE-WORD HOMOPHONE PROBLEM (2026-08-11, Ahmad: "it does not hear me").
// Browser speech-to-text almost never returns the literal string "axis". Chrome and Edge both
// routinely hear the word as "access", "axes", "acts", "exes", "axis's", "ax is", or "a x s".
// Matching only /axis/ meant the wake listener heard every word and silently ignored all of them.
// This alternation is the fix — it is deliberately generous, because a false wake costs one
// ignored question while a missed wake makes the whole feature look broken.
const WAKE_WORD = '(?:axis|axis\'s|access|axes|acces|actus|acts|exes|ax\\s?is|a\\s?xis|axel|axys)';
export const WAKE_RE = new RegExp('(?:^|\\b)(?:hey\\s+|ok(?:ay)?\\s+|hi\\s+)?' + WAKE_WORD + '\\b', 'i');
// Stand-down: the spoken kill-switch from the spec ("AXIS stop"). Checked BEFORE everything else.
// Same homophone treatment, plus a bare "stop"/"cancel" so panic-stopping always works.
export const STOP_RE = new RegExp(
  WAKE_WORD + '[\\s,]+(?:stop|cancel|quiet|enough|stand\\s*down|shut\\s*up)\\b'
  + '|^\\s*(?:stop|cancel|quiet|shut\\s*up|stand\\s*down)\\s*[.!]?\\s*$', 'i');
// Verbal confirm / decline for a routed intent.
export const CONFIRM_RE = /\b(?:confirm(?:ed|s)?|approve[ds]?|do it|go ahead|send it|affirmative|yes(?:\s+(?:do|go|please))?)\b/i;
export const DENY_RE = /\b(?:no|nope|cancel|reject|hold|deny|negative|stand\s*down|forget it)\b/i;

export const isWake = (t) => WAKE_RE.test(String(t || ''));
export const isStop = (t) => STOP_RE.test(String(t || ''));
// Order matters at the call site: stand-down wins over deny, deny wins over confirm.
export const isConfirm = (t) => !isStop(t) && !DENY_RE.test(String(t || '')) && CONFIRM_RE.test(String(t || ''));
export const isDeny = (t) => !isStop(t) && DENY_RE.test(String(t || ''));

// Strip a leading wake phrase so "AXIS, what's going on" reaches the director as "what's going on".
// Must strip the same homophone set the wake matcher accepts, or "access what's going on" would be
// sent to the director verbatim and answered as nonsense.
const STRIP_RE = new RegExp('^\\s*(?:hey\\s+|ok(?:ay)?\\s+|hi\\s+)?' + WAKE_WORD + '\\b[\\s,.:!?-]*', 'i');
export function stripWake(text) {
  return String(text || '').replace(STRIP_RE, '').trim();
}

// The spoken tail AXIS appends when the director routed something. `needsApproval` is the hard-stop
// class from the spec — irreversible/anomalous work. Voice may confirm a ROUTE (the worker still
// holds anything irreversible in Approvals); it may never confirm a hard-stop. That stays a click.
export function routeTail(agent, needsApproval) {
  if (needsApproval) return `That one needs your click, ${AXIS_ADDRESS}. It is waiting in Approvals.`;
  return `Route to ${agent}? Say confirm, or cancel.`;
}
