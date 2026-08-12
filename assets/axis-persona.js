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
// AXIS is a woman's voice with an en-GB register: warm, unhurried, softly spoken. ARIA (the customer
// orb, assets/aria-core.js) is en-US at rate 0.95 / pitch 1.05. Keeping AXIS on a different accent
// AND a different prosody means the two are never mistaken for each other, even in the worst case
// where a browser offers only one shared female voice.
//
// NOTE: AXIS was lower-pitched than ARIA until 2026-08-12; it now sits ABOVE it (1.12 vs 1.05) after
// Ahmad asked for a younger, softer voice. The separation is preserved, just from the other side —
// no voice family may land on ARIA's exact rate/pitch pair.

// Preferred, in order. Edge/Windows exposes the "Online (Natural)" neural set; macOS exposes Siri/
// premium; Chrome exposes the Google network voices.
// Short tokens are word-bounded on purpose: an unbounded 'ava' would also match "Savannah", and an
// unbounded 'male' in the demote list below would match "English Female" and demote every one of them.
// Ordered youngest-and-warmest first, per Ahmad 2026-08-12 ("softer and younger woman but classy").
// Libby leads now instead of Sonia: both are en-GB Online (Natural), but Sonia is the poised,
// older-sounding newsreader register and Libby is the younger, warmer one. Sonia stays second — it
// is still the right voice on any machine that lacks Libby.
//
// Maisie was REMOVED from this list: it is Microsoft's en-GB *child* voice, so it scored a +34
// preference and could win outright on a machine without the others. It is demoted below instead.
export const AXIS_FEMALE_PREF = [
  '\\blibby\\b',   // Microsoft Libby Online (Natural) — en-GB. The AXIS house voice.
  '\\bsonia\\b',   // Microsoft Sonia Online (Natural) — en-GB, more formal
  '\\babbi\\b', '\\bbella\\b', '\\bhollie\\b',  // en-GB Natural, young + warm
  '\\bolivia\\b', '\\bava\\b', '\\bemma\\b', '\\bjenny\\b', '\\bmichelle\\b',
  '\\bnova\\b', '\\bclara\\b', '\\bmartha\\b', '\\bfemale\\b',
];

// Not male, not ARIA — just wrong for AXIS. Child and novelty voices must never win the ranking.
export const AXIS_CHILD_DEMOTE = ['\\bmaisie\\b', '\\bana\\b', '\\bkid\\b', '\\bchild\\b'];

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

// Ahmad, 2026-08-12: "change the voice also to be more human like and a softer and younger woman
// but classy." The previous setting was deliberately lowered (pitch 0.92) for a composed, older
// register. Lowering a synthesised voice is exactly what makes it read as machine-like — the formants
// stop matching the pitch — so raising it back above 1.0 is what buys both "younger" and "more human"
// at the same time. Softness is volume and pace, not pitch: 0.85 volume and a slightly unhurried
// rate give the classy register without the breathy-assistant cliché.
//
// Raised again on 2026-08-12 (1.08 -> 1.12, 0.9 -> 0.85 volume) when Ahmad reported no change. The
// numbers were only half of it — the real blocker was a pinned voice overriding the persona; see
// VOICE_POLICY_REV below.
//
// AXIS stays apart from ARIA (en-US, rate .95 / pitch 1.05) on ACCENT now rather than on pitch —
// AXIS is en-GB and scores +40 for it, and the name-collision demotes are untouched.
export const AXIS_PROSODY = { rate: 0.96, pitch: 1.12, legacyRate: 1.0, volume: 0.85 };

// Bump this whenever the voice POLICY changes (preferred names or prosody). A voice pinned in
// localStorage under an older revision is released back to the ranker on next load.
//
// Without this, a policy change is invisible: axisPickVoice() honours the pin before it ever
// ranks, so a voice pinned once — including by a single axisVoiceNext() cycle — silently
// outranked every later persona change. That is why 2026-08-12's voice change "did not change".
// A deliberate pick still persists: axisSetVoice/axisVoiceNext stamp the current revision.
export const VOICE_POLICY_REV = '2026-08-12-young-soft';

// CROSS-ENGINE PARITY (2026-08-11, Ahmad: "on edge its one voice and chrome another").
// Edge and Chrome ship different voice inventories — Edge has the "Online (Natural)" neural set
// (Sonia/Libby), Chrome has Google's network voices. Getting the *same* voice in both is impossible
// with free browser TTS; it would take a paid cloud TTS, which breaks the $0 rule.
// What IS possible: make each engine land on the same *character*. Edge's Sonia is the reference,
// and every other family is rate/pitch-corrected toward it — Google's voices run fast and bright,
// so they get slowed and lowered the most. The result is one recognisable AXIS in either browser.
export const VOICE_PROFILES = {
  neural:  { rate: 0.96, pitch: 1.12, volume: 0.85 }, // Edge "Online (Natural)" — THE REFERENCE
  google:  { rate: 0.92, pitch: 1.06, volume: 0.85 }, // Chrome network voices run fast + bright
  premium: { rate: 0.95, pitch: 1.10, volume: 0.85 }, // macOS Siri/premium/enhanced
  legacy:  { rate: 0.95, pitch: 1.09, volume: 0.90 }, // SAPI desktop — heavy shifts sound artificial
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
// ── Screen text is not speech ────────────────────────────────────────────────
// Ahmad, 2026-08-12: AXIS kept saying "Next: Accounting Plus Business Services — 29 days overdue.
// queued → Approvals." That is a table row read out loud. "→" is not a word, "·" is not a word, a
// field separator is not a sentence, and nobody says "29 days overdue" when they mean "about a
// month behind".
//
// The underlying mistake was that the dock message and the spoken message were the SAME string, so
// board formatting went straight to the speaker. This is the layer that separates them: the screen
// keeps its compact badges, and the voice gets English. It runs on everything that reaches the
// speaker — board answers, brain answers, task read-backs — so a template added later cannot leak
// punctuation into speech the way this one did.
const SPOKEN = [
  // Status badges → what a person would actually say happened.
  [/\bqueued\s*(?:→|->)\s*approvals?\b/gi, 'queued for your approval'],
  [/\b(?:routed|sent)\s*(?:→|->)\s*/gi, 'routed to '],
  [/\bdraft\s*[—-]\s*not sent\b/gi, 'drafted, not sent yet'],
  [/\bawaiting approval\b/gi, 'waiting for your approval'],
  [/\bclient waiting\b/gi, 'the client is waiting'],
  [/\bwaiting on you\b/gi, 'waiting on you'],
  // Any surviving arrow is a transition; say it.
  [/\s*(?:→|->)\s*/g, ' to '],
  // Separators that exist purely to pack a line: a spoken pause is a comma.
  [/\s*·\s*/g, ', '],
  [/\s+[—–]\s+/g, ', '],
  // Label prefixes read as headings. Turn them into how someone opens a sentence.
  [/^\s*Next:\s*/i, 'Next up, '],
  [/^\s*Top:\s*/i, 'Top of the list, '],
  [/\bTop:\s*/g, 'Top of the list, '],
  [/^\s*Being worked on:\s*/i, 'Right now the agents are on '],
];

// Nobody counts past about a fortnight. "29 days overdue" is data; "about a month behind" is speech.
function humanDays(text) {
  return String(text).replace(/\b(\d+)\s+days?\s+overdue\b/gi, (m, d) => {
    const n = Number(d);
    if (n <= 2) return 'a couple of days overdue';
    if (n <= 6) return n + ' days overdue';
    if (n <= 10) return 'about a week overdue';
    if (n <= 20) return 'a couple of weeks behind';
    if (n <= 45) return 'about a month behind';
    if (n <= 75) return 'a couple of months behind';
    return 'months behind';
  }).replace(/\bin (\d+) days\b/gi, (m, d) => {
    const n = Number(d);
    if (n === 7) return 'in a week';
    if (n <= 6) return 'in ' + n + ' days';
    return 'in about ' + Math.round(n / 7) + ' weeks';
  });
}

export function speechify(text) {
  let t = String(text || '');
  for (const [re, to] of SPOKEN) t = t.replace(re, to);
  t = humanDays(t);
  // Collapse the double punctuation the substitutions can leave behind (", ." / ", ,").
  return t.replace(/,\s*([.,;])/g, '$1').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
}

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
  // Position in AXIS_FEMALE_PREF has to count for something, or the list is only a set and Libby
  // ties with Sonia at exactly the same score — leaving the actual choice to whatever order the
  // browser happened to enumerate voices in. Earlier in the list wins.
  const pref = AXIS_FEMALE_PREF.findIndex((w) => new RegExp(w, 'i').test(n));
  if (pref >= 0) s += 34 + Math.max(0, 10 - pref);   // a named AXIS voice, best-first
  if (/^en(-|_)?GB/i.test(l)) s += 40;               // the en-GB register — ARIA is en-US
  if (hasAny(n, AXIS_ARIA_COLLISION)) s -= 45;       // don't wear the customer orb's voice
  if (hasAny(n, AXIS_MALE_DEMOTE)) s -= 60;          // AXIS is never male
  if (hasAny(n, AXIS_CHILD_DEMOTE)) s -= 70;         // "younger" means young woman, not a child
  // "More human like": the Natural/Neural set is the only genuinely non-robotic family in a free
  // browser, so it gets its own bonus rather than relying on the caller's ranking alone.
  if (/natural|neural/i.test(n)) s += 18;
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
// Ahmad, 2026-08-11: "when I say Axis it hears access so let it hear me when I say Ax or Axie."
// Short forms are deliberately included: "ax" and "axie" are easier for STT to get right than the
// full word, which Chrome and Edge both mangle into "access" more often than not. `ax` is bounded
// by \b at the call site so it cannot fire inside "axle", "fax" or "axes-of-rotation".
// Two tiers, because the homophones are not all equally safe.
//
// STRICT forms are unambiguous — nobody says "axie" mid-sentence — so they wake from anywhere.
// LOOSE forms exist only because speech recognition mishears "Axis" as them ("it hears access"), but
// they are also ordinary English words, and allowing them anywhere made AXIS wake on "he acts
// strangely" and "can you access it" (measured 2026-08-12). They now only count at the START of an
// utterance, which is where a person actually puts a name when addressing someone. That keeps the
// mishear coverage Ahmad needs without the console answering its own name in the middle of a
// sentence about something else.
const WAKE_STRICT = '(?:axis(?:\'s)?|axie|axi|ax|ax\\s?is|a\\s?xis|axys|axel)';
const WAKE_LOOSE = '(?:access|acces|axes|acts|actus|exes)';
const GREET = '(?:hey\\s+|ok(?:ay)?\\s+|hi\\s+)?';
const WAKE_WORD = '(?:' + WAKE_STRICT + '|' + WAKE_LOOSE + ')';
export const WAKE_RE = new RegExp(
  '^\\s*' + GREET + WAKE_WORD + '\\b' +               // addressed by name, at the front
  '|\\b' + GREET + WAKE_STRICT + '\\b', 'i');         // or an unambiguous form, anywhere
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

// ── Operational intents: the things AXIS can DO, not just answer ─────────────
// Ahmad, 2026-08-11: manage the channel by voice, and "if I tell it to fix any issues… use claude
// code to fix itself and tell me once its done."
//
// Detection is deliberately conservative. A miss costs one repeated sentence; a false positive
// spends the Max plan, edits the repo, or publishes to the channel. Every match is read back and
// must be confirmed out loud before anything runs — "only if I make sense it then confirms what I
// said before executing."
const OPS = [
  { kind: 'video.short',  re: /\b(?:make|create|do|build|record)\b[^.?!]*\b(short|shorts|clip|reel)\b/i,
    arg: /\b(?:about|on|for|covering)\s+(.+)$/i,
    say: (a) => `Build a short${a ? ' about ' + a : ''}` },
  { kind: 'video.make',   re: /\b(?:make|create|do|build|record)\b[^.?!]*\b(video|episode|tutorial)\b/i,
    arg: /\b(?:about|on|for|covering)\s+(.+)$/i,
    say: (a) => `Build a video${a ? ' about ' + a : ''}` },
  { kind: 'video.upload', re: /\b(?:upload|publish|post|push)\b[^.?!]*\b(video|videos|shorts?|channel|youtube|them|it)\b|\bupload\s*(?:them|it|now)?\s*$/i,
    say: () => 'Upload the staged videos to the channel' },
  { kind: 'video.status', re: /\b(?:how many|what(?:'s| is) )?\b[^.?!]*\b(video|videos|shorts?|channel|youtube)\b[^.?!]*\b(status|staged|ready|queue|left|today)\b|\bchannel status\b/i,
    say: () => 'Check the channel status' },
  // Talking to Claude Cowork. Read-only, so this only ever comes back as an answer.
  { kind: 'cowork.ask',   re: /\b(?:ask|check with|talk to|speak (?:to|with)|get)\s+(?:claude\s+)?cowork(?:er)?\b|\bask claude\b/i,
    // Anchor on "cowork" first — "ask claude cowork about X" would otherwise capture from "claude"
    // and read back as "Ask Claude Cowork about cowork about X".
    // The "ask claude" branch needs the lookahead: regex alternation takes the LEFTMOST match, so in
    // "ask claude cowork about X" it would win at index 0 and capture "cowork about X" as the topic.
    arg: /\bcowork(?:er)?\s+(?:about\s+|what\s+|why\s+|how\s+|if\s+|whether\s+)?(.+)$|\bask claude\s+(?!cowork)(?:about\s+)?(.+)$/i,
    say: (a) => `Ask Claude Cowork${a ? ' about ' + a : ''}` },
  // Machine control. Deliberately requires an explicit "on my machine" / "take control" phrasing —
  // this must never be what a vague sentence falls through to.
  { kind: 'machine.run',  re: /\b(?:take control|on my (?:machine|computer|pc)|run (?:this|that|it) locally)\b/i,
    arg: /\b(?:and|to|:)\s+(.+)$/i,
    say: (a) => `Run on your machine: ${a || 'the request'}` },
  // Self-repair. The verb alone can NEVER be the trigger: "fix" is a word Ahmad uses constantly
  // about client problems — "how do I fix a stuck windows update", "the client needs us to fix
  // their vpn". Measured 2026-08-12, the bare-verb version hijacked 5 of 16 realistic questions
  // into "say confirm, or cancel" instead of answering them. That is the whole "it is failing more
  // than before" complaint.
  //
  // So a self-fix needs BOTH a repair verb AND something naming AXIS itself, and it must not be a
  // question — a question about fixing something is a support request, not an instruction.
  { kind: 'self.fix',
    re: /\b(?:fix|repair|sort out|correct|debug)\b/i,
    self: /\b(?:yourself|your\s+\w+|you\s+(?:keep|always|never|are|were|do|don'?t|can'?t|cannot|won'?t)|the way you|wake\s?word|hands[-\s]?free|the globe|the hologram|the mic|the dock|the console|the voice|axis|the way it works)\b/i,
    notAsk: /^\s*(?:how|what|why|when|where|who|which|is|are|does|do|did|can|could|should|would)\b/i,
    arg: /\b(?:fix|repair|sort out|correct|debug)\s+(.+)$/i,
    say: (a) => `Have Claude Code fix: ${a || 'the reported issue'}` },
];

export function detectOp(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 4) return null;
  for (const op of OPS) {
    if (!op.re.test(t)) continue;
    // Extra qualifiers, where matching the verb is not enough to be sure the request is an order
    // aimed at AXIS rather than a question about the same subject.
    if (op.self && !op.self.test(t)) continue;
    if (op.notAsk && op.notAsk.test(t)) continue;
    let arg = '';
    // Alternation patterns leave undefined groups — take the first that actually captured.
    if (op.arg) {
      const m = t.match(op.arg);
      if (m) arg = String(m.slice(1).find(Boolean) || '').trim().replace(/[.?!]+$/, '');
    }
    // "you keep cutting me off, fix that" captures only "that". For a self-fix the whole sentence is
    // the better description anyway — it is what Claude Code needs to act on, and the self-reference
    // test above has already established the request is aimed at AXIS.
    if (op.kind === 'self.fix' && (arg.length < 6 || /^(?:that|this|it|them|those)\b/i.test(arg))) arg = t;
    // These are meaningless without a subject, and guessing at one is worse than asking. "fix it"
    // with no antecedent must not become a repo edit.
    if (['self.fix', 'machine.run', 'cowork.ask'].includes(op.kind) && arg.length < 6) return null;
    return { kind: op.kind, arg, confirm: op.say(arg) + '. Say confirm, or cancel.' };
  }
  return null;
}

// ── Turn-taking: don't monologue ─────────────────────────────────────────────
// Ahmad, 2026-08-11: "it just goes on and on and does not pause to say these are the priority items,
// shall we tackle the first 3 then move to the next?"
// Spoken output is not written output. A list read end-to-end is unusable by voice — by item six the
// first is gone. So a long answer, or any list of four or more, is delivered as the first three and
// an explicit offer. The remainder is held, not discarded, and released on "yes" / "go on".
const LIST_LINE = /^\s*(?:[-•*·]|\d+[.)])\s+/;
const SPEAK_BUDGET = 420;          // characters ≈ 25 seconds spoken — past that, attention drops

export function splitForTurns(text) {
  const t = String(text || '').trim();
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = lines.filter((l) => LIST_LINE.test(l));

  // A real list: lead, first three, offer, hold the rest.
  if (items.length >= 4) {
    const lead = lines.slice(0, lines.indexOf(items[0])).join(' ').trim();
    const first = items.slice(0, 3);
    const rest = items.slice(3);
    const say = [lead, ...first].filter(Boolean).join('\n');
    return { say, rest: rest.join('\n'),
      offer: `That is the top three of ${items.length}. Shall we take these first, or hear the rest?` };
  }

  // Long prose: stop at a sentence boundary near the budget rather than mid-thought.
  if (t.length > SPEAK_BUDGET) {
    const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
    let head = '', i = 0;
    while (i < sentences.length && (head + sentences[i]).length <= SPEAK_BUDGET) head += sentences[i++];
    if (head.trim() && i < sentences.length) {
      return { say: head.trim(), rest: sentences.slice(i).join('').trim(), offer: 'Want the rest?' };
    }
  }
  return { say: t, rest: '', offer: '' };
}

// "yes", "go on", "keep going" — release the held remainder. Deliberately narrow: anything else is
// treated as a new question, so a held remainder never hijacks a fresh request.
const CONTINUE_RE = /^\s*(?:yes|yeah|yep|go on|keep going|continue|carry on|finish (?:it|them|the list)|the rest|rest of (?:it|them)|and then|more|next)\b/i;
export const isContinue = (t) => CONTINUE_RE.test(String(t || ''));

// Referential: Ahmad points at something AXIS just said instead of naming it again — "do what you
// just mentioned", "go ahead", "make it so". A person tracks the antecedent across an interruption;
// before this, "stop" followed by "do that" fell through to the brain as a brand-new question with
// no idea what "that" was.
//
// Kept separate from isConfirm on purpose. isConfirm answers a question AXIS asked ("say confirm,
// or cancel"). This resolves a pronoun to whatever is currently parked, which is a different job and
// must NOT satisfy a safety gate on its own — an ambiguous "go ahead" with nothing parked resolves
// to nothing and goes to the brain like any other sentence.
const REFERENTIAL_RE = new RegExp(
  '^\\s*(?:(?:ok(?:ay)?|yes|yeah|sure|alright|right|please)[,\\s]+)?' +
  '(?:go ahead|do (?:that|it|this|so)|(?:do|run|execute|start|finish) (?:what|the thing) (?:you|u) ' +
  '(?:just )?(?:said|mentioned|suggested|offered|described)|make it (?:so|happen)|proceed|' +
  'carry on with (?:that|it)|(?:that|the (?:first|second|third|last)) one)' +
  // Anchored to the END of the utterance, not just the start. "go ahead" is a pronoun; "go ahead
  // AND tell me about pricing" is a fresh instruction that merely opens with the same two words.
  // Only trailing politeness is allowed to follow.
  '(?:\\s+(?:please|now|then|thanks|thank you))*\\s*[.!?]*\\s*$', 'i');
export const isReferential = (t) => !isStop(t) && REFERENTIAL_RE.test(String(t || ''));

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
