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
// AXIS is a woman's voice with an American register: refined, unhurried, softly spoken — upscale
// rather than bright-and-perky. ARIA (the customer orb, assets/aria-core.js) is also en-US, at
// rate 0.95 / pitch 1.05.
//
// Ahmad, 2026-08-12: "change the voice to a english USA accent but classy and up scale style."
//
// THE SEPARATION FROM ARIA NOW RESTS ENTIRELY ON NAME AND PROSODY. Until today AXIS was en-GB and
// accent alone kept the two apart, which meant the name and prosody rules could afford to be soft.
// They cannot any more: both assistants speak American English, so if the ranker ever lands AXIS on
// ARIA's voice at ARIA's rate and pitch, the two become genuinely indistinguishable. That is why the
// ARIA-collision demote is unchanged and the prosody below is deliberately held clear of
// 0.95 / 1.05 — AXIS is slower and higher, and no voice family may land on ARIA's exact pair.

// Preferred, in order. Edge/Windows exposes the "Online (Natural)" neural set; macOS exposes Siri/
// premium; Chrome exposes the Google network voices.
// Short tokens are word-bounded on purpose: an unbounded 'ava' would also match "Savannah", and an
// unbounded 'male' in the demote list below would match "English Female" and demote every one of them.
// Ordered most-upscale-American first, per Ahmad 2026-08-12 ("english USA accent but classy and up
// scale style"). Ava leads: it is Edge's flagship en-US Natural female and the one that actually
// reads as poised rather than perky. Emma and Michelle are the warm, measured alternates; Jenny is
// the competent-assistant default and sits below them because it is the most obviously "assistant"
// sounding of the set.
//
// The en-GB voices that used to lead (Libby, Sonia) are kept at the BOTTOM rather than deleted. A
// machine with no US Natural voice should still get a refined woman's voice rather than falling
// through to a robotic SAPI one — a British voice is a better failure than a mechanical one.
//
// Maisie was REMOVED from this list: it is Microsoft's en-GB *child* voice, so it scored a +34
// preference and could win outright on a machine without the others. It is demoted below instead.
export const AXIS_FEMALE_PREF = [
  '\\bava\\b',      // Microsoft Ava Online (Natural) / macOS Ava — en-US. The AXIS house voice.
  '\\bemma\\b',     // en-US Natural, warm and measured
  '\\bmichelle\\b', // en-US Natural, warm
  '\\bjenny\\b',    // en-US Natural, the composed assistant register
  '\\bnova\\b', '\\bsara\\b', '\\bnancy\\b', '\\bamber\\b', // further en-US Natural women
  '\\bzoe\\b',      // macOS Zoe (Premium) — en-US, refined
  '\\bolivia\\b',   // en-AU Natural, still a poised woman if no US voice exists
  '\\blibby\\b', '\\bsonia\\b',                 // en-GB Natural — last-resort, better than robotic
  '\\bclara\\b', '\\bmartha\\b', '\\bfemale\\b',
];

// Not male, not ARIA — just wrong for AXIS. Child and novelty voices must never win the ranking.
export const AXIS_CHILD_DEMOTE = ['\\bmaisie\\b', '\\bana\\b', '\\bkid\\b', '\\bchild\\b'];

// ARIA's own preference list (aria-core.js line 381). AXIS DEMOTES these rather than banning them:
// a penalty keeps AXIS off ARIA's voice whenever any alternative exists, but still lets a bare
// browser fall back to a real female voice instead of dropping to a male or robotic one.
//
// '\\baria\\b' is new as of the move to en-US: Edge ships "Microsoft Aria Online (Natural) -
// English (United States)", and an American-accented AXIS speaking in a voice literally named Aria
// is the exact confusion this whole section exists to prevent. Word-bounded so it cannot catch
// "Maria" or "Bavaria".
export const AXIS_ARIA_COLLISION = [
  '\\baria\\b',
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
// 2026-08-12, moving to en-US: "classy and up scale style." Upscale is pace, not brightness. The
// pitch comes DOWN slightly (1.12 -> 1.10) because 1.12 on an American voice reads perky rather than
// poised, and the rate comes down further (0.96 -> 0.93) because an unhurried speaker sounds
// expensive and a quick one sounds like a call centre. Volume stays soft at 0.85.
//
// These numbers are also now the ONLY thing separating AXIS from ARIA on a machine where the ranker
// is forced onto a shared voice, since both are en-US. ARIA is rate 0.95 / pitch 1.05; AXIS is
// deliberately slower AND higher, so neither value coincides and the pair never does.
export const AXIS_PROSODY = { rate: 0.93, pitch: 1.10, legacyRate: 1.0, volume: 0.85 };

// Bump this whenever the voice POLICY changes (preferred names or prosody). A voice pinned in
// localStorage under an older revision is released back to the ranker on next load.
//
// Without this, a policy change is invisible: axisPickVoice() honours the pin before it ever
// ranks, so a voice pinned once — including by a single axisVoiceNext() cycle — silently
// outranked every later persona change. That is why 2026-08-12's voice change "did not change".
// A deliberate pick still persists: axisSetVoice/axisVoiceNext stamp the current revision.
export const VOICE_POLICY_REV = '2026-08-12-us-upscale';

// CROSS-ENGINE PARITY (2026-08-11, Ahmad: "on edge its one voice and chrome another").
// Edge and Chrome ship different voice inventories — Edge has the "Online (Natural)" neural set
// (Sonia/Libby), Chrome has Google's network voices. Getting the *same* voice in both is impossible
// with free browser TTS; it would take a paid cloud TTS, which breaks the $0 rule.
// What IS possible: make each engine land on the same *character*. Edge's en-US Ava is the reference
// now that AXIS is American, and every other family is rate/pitch-corrected toward it — Google's
// voices run fast and bright, so they get slowed and lowered the most. The result is one
// recognisable AXIS in either browser.
//
// No profile may sit at ARIA's rate 0.95 / pitch 1.05, and none may use pitch 1.05 at all, because
// accent no longer separates the two assistants.
export const VOICE_PROFILES = {
  neural:  { rate: 0.93, pitch: 1.10, volume: 0.85 }, // Edge "Online (Natural)" en-US — THE REFERENCE
  google:  { rate: 0.89, pitch: 1.04, volume: 0.85 }, // Chrome network voices run fast + bright
  premium: { rate: 0.92, pitch: 1.08, volume: 0.85 }, // macOS Siri/premium/enhanced
  legacy:  { rate: 0.92, pitch: 1.07, volume: 0.90 }, // SAPI desktop — heavy shifts sound artificial
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
  // The tiebreak spans the WHOLE list. It used to be `max(0, 10 - pref)`, which silently stopped
  // discriminating past the tenth entry — when the list grew to 15 on 2026-08-12, Libby and Sonia
  // both landed on +34 and the choice between them fell back to whatever order the browser
  // enumerated voices in. Caught by tests/axis-voice-pin.test.mjs.
  if (pref >= 0) s += 34 + (AXIS_FEMALE_PREF.length - pref);   // a named AXIS voice, best-first
  // American English, per Ahmad 2026-08-12. The old +40 was for en-GB; the accent is now the same
  // as ARIA's, so this bonus no longer does any separating work — it only picks the accent. The
  // separating is done by AXIS_ARIA_COLLISION below and by AXIS_PROSODY.
  if (/^en(-|_)?US/i.test(l)) s += 40;
  // Other English accents stay eligible but rank below American, so a machine with no US Natural
  // voice still lands on a refined woman rather than a robotic one — a British AXIS is a better
  // failure than a mechanical AXIS. Small enough that any en-US voice outranks them.
  else if (/^en(-|_)?(GB|AU|NZ|IE|CA|ZA)/i.test(l)) s -= 14;
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
const WAKE_STRICT = '(?:axis(?:\'s)?|axie|axi|axic|axik|aksi|axy|ax|ax\\s?is|a\\s?xis|axys|axel)';
const WAKE_LOOSE = '(?:access|acces|axes|acts|actus|exes|axed)';
const GREET = '(?:hey\\s+|ok(?:ay)?\\s+|hi\\s+|so\\s+|um+\\s+|uh+\\s+)?';
const WAKE_WORD = '(?:' + WAKE_STRICT + '|' + WAKE_LOOSE + ')';
// A homophone followed by a question word or an order is somebody addressing AXIS, wherever it sits
// in the sentence. Ahmad, 2026-08-12: "sometimes it hears axic as 'access' which then it ignores me."
// Start-of-utterance alone was not enough — "so Axie, what's the status" comes back as "so access
// what's the status", and the name is no longer first. This is what makes the mishears usable
// without letting "we need access to the portal" wake anything: there, "access" is followed by "to".
// Question words and imperatives only. Copulas and auxiliaries ("is", "are", "do") follow a noun
// perfectly naturally — "remote access is down", "access is restricted" — so treating them as a
// form of address woke AXIS on ordinary IT sentences, which in this business are constant.
const ADDRESSED = '\\s+(?:what|whats|what\'s|hows?|how\'s|when|where|why|who|which|give|tell|show|check|make|open|start|stop|status|read|list|find|run|play|pause|please)\\b';
// At the front of a sentence a homophone is usually the name — but not when the next word makes it
// the SUBJECT. "Access is restricted", "access to the portal", "access control" are IT sentences this
// business says constantly, and waking on them is worse than missing one address.
const LOOSE_NOUN = '(?!\\s+(?:is|was|are|were|to|for|from|on|in|of|and|or|has|have|had|will|would|' +
  'can|could|should|control|point|points|level|levels|rights|denied|granted|log|logs|list|card|code|' +
  'key|keys|token|issue|issues|problem|problems|request|requests|error|errors)\\b)';
export const WAKE_RE = new RegExp(
  '^\\s*' + GREET + '(?:' + WAKE_STRICT + '|' + WAKE_LOOSE + LOOSE_NOUN + ')\\b' +  // addressed by name, at the front
  '|\\b' + GREET + WAKE_STRICT + '\\b' +                      // an unambiguous form, anywhere
  '|\\b' + WAKE_LOOSE + ADDRESSED, 'i');                      // a mishear that is clearly an address
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
  // Either word order. The original required the subject BEFORE the status word, so Ahmad's actual
  // question — "what is the status on the YouTube videos" — did not match, fell through to the
  // board, and got answered with follow-up counts three times in a row (2026-08-12 transcript).
  { kind: 'video.status',
    re: /\b(?:youtube|videos?|shorts?|channel|clips?)\b[^.?!]*\b(?:status|staged|ready|queued?|left|today|uploaded|posted|published)\b|\b(?:status|how many|how'?s|what'?s|what is|update on|where are)\b[^.?!]*\b(?:youtube|videos?|shorts?|channel|clips?)\b/i,
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
  // ── Planning WITH Ahmad, via Claude Cowork ─────────────────────────────────
  // Ahmad, 2026-08-12: "nor does it plan out with me anything or work with me like I would with
  // claude cowork or claude code. I want Axis basically the visual and verbal extension of claude
  // code and cowork. claude cowork to be use by axis for planning."
  //
  // cowork.ask above only fires when he SAYS "ask cowork". Nobody talks that way while planning —
  // he says "let's plan the migration" or "work out the approach with me". Those fell through to the
  // brain cascade and came back as a generic answer with no repo context, which is exactly the
  // "doesn't work with me like Cowork would" complaint. This routes them to Cowork, which reads the
  // repo under CLAUDE.md, and never runs below the standard tier (see COWORK_FLOOR).
  //
  // Read-only by construction: cowork.plan gets no edit permission, so a planning conversation can
  // never quietly become a commit.
  { kind: 'cowork.plan',
    re: /\b(?:let'?s|lets|help me|work with me|together we|i want to|we need to|can we)\b[^.?!]*\b(?:plan|planning|strategi[sz]e|map out|work out|think through|figure out|scope|design|approach|decide|prioriti[sz]e|break down)\b|\b(?:plan|scope|map)\s+(?:out\s+)?(?:the|our|a|this)\b[^.?!]*\b(?:with me|together)\b/i,
    // A plan needs a subject; "let's plan" alone is not actionable.
    arg: /\b(?:plan|planning|strategi[sz]e|map out|work out|think through|figure out|scope|design|approach|decide|prioriti[sz]e|break down)\s+(?:out\s+)?(.+)$/i,
    notAsk: /^\s*(?:what|why|when|where|who|which)\b/i,
    say: (a) => `Plan with Claude Cowork: ${a || 'the request'}` },

  // ── Building, via Claude Code ──────────────────────────────────────────────
  // "claude code to execute any code." self.fix below is REPAIR only — it needs a repair verb and a
  // reference to AXIS itself, deliberately, so that "how do I fix a stuck Windows update" stays a
  // support question. That left new work with no route at all: "build the intake form", "add a
  // column to the roster", "wire the webhook" all fell through to being answered rather than done.
  //
  // Narrower than it looks: it needs a build verb AND a code-ish object, and it must not be a
  // question. "Should we build a portal?" is a strategy question and goes to Cowork above, not here.
  { kind: 'code.build',
    re: /\b(?:build|implement|add|create|write|wire|hook up|set up|refactor|migrate|rename|delete|remove)\b/i,
    self: /\b(?:function|endpoint|route|page|panel|tab|component|script|test|tests|suite|cron|worker|handler|webhook|api|field|column|table|schema|migration|module|file|repo|branch|commit|css|html|button|form|toggle|flag|the console|the site|the vault|axis|aria|sentinel)\b/i,
    notAsk: /^\s*(?:how|what|why|when|where|who|which|is|are|does|do|did|can|could|should|would|shall)\b/i,
    arg: /\b(?:build|implement|add|create|write|wire|hook up|set up|refactor|migrate|rename|delete|remove)\s+(.+)$/i,
    say: (a) => `Have Claude Code build: ${a || 'the request'}` },

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
    if (['self.fix', 'machine.run', 'cowork.ask', 'cowork.plan', 'code.build'].includes(op.kind) && arg.length < 6) return null;
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
// Leading fillers are consumed too. A wake word is rarely the literal first token in real speech —
// "so, Axie, check the channel" is normal — and without this the brain receives "so axie check the
// channel", wake word and all.
const FILLER = '(?:(?:so|well|now|um+|uh+|ok(?:ay)?|alright|hey|hi|yo|bro|and)[\\s,]+)*';
const STRIP_RE = new RegExp('^\\s*' + FILLER + GREET + WAKE_WORD + '\\b[\\s,.:!?-]*', 'i');
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

// ── Talking like a person, not a process ─────────────────────────────────────
// Ahmad, 2026-08-12, from a real transcript: he said "okay hold on" and AXIS replied "The user said
// 'okay hold on' — they're pausing. I'll wait. / Standing by." Then he asked the same question three
// times and got the identical paragraph back, word for word, each time.
//
// Three separate faults, three fixes below.

// 1. SMALL TALK NEVER NEEDED A BRAIN. "hold on", "thanks", "you there" are turn-management, not
//    questions. Routing them to a model is what produced a paragraph of narration about a
//    two-word pause — and it cost a round trip to do it.
const SMALL_TALK = [
  [/^\s*(?:ok(?:ay)?[,\s]*)?(?:hold on|hang on|one (?:sec|second|moment)|wait|gimme a sec|give me a sec|just a sec)\b/i,
    ['Sure.', 'Take your time.', 'No rush.']],
  [/^\s*(?:thanks|thank you|cheers|appreciate it|nice one)\b/i, ['Anytime.', 'Of course.', 'Happy to.']],
  [/^\s*(?:never ?mind|forget it|scratch that|ignore that)\b/i, ['No problem.', 'Dropped it.']],
  [/^\s*(?:you there|are you there|hello|hi|hey)\s*\??\s*$/i, ['Right here.', 'Listening.', 'Here.']],
  [/^\s*(?:sorry|my bad|oops)\b/i, ['All good.', 'No harm done.']],
  [/^\s*(?:good|great|perfect|nice|cool|awesome|excellent)\s*[.!]?\s*$/i, ['Good.', 'Glad that works.']],
  [/^\s*(?:ok(?:ay)?|alright|right|got it|understood)\s*[.!]?\s*$/i, ['Mm-hm.', 'Right.']],
];
let __st = 0;
export function smallTalk(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 40) return null;          // a long sentence is a real turn, not a filler
  for (const [re, replies] of SMALL_TALK) {
    if (re.test(t)) return replies[(__st++) % replies.length];
  }
  return null;
}

// 2. AXIS MUST NEVER TALK ABOUT AHMAD IN THE THIRD PERSON. A model asked to be helpful sometimes
//    narrates its own reasoning — "The user said X, they're pausing, I'll wait." That is a note
//    about the conversation, not a turn in it, and hearing it out loud is deeply strange.
//    Whole sentences of it are dropped; if that leaves nothing, a short human line stands in.
const META_SENTENCE = /(?:^|\s)(?:the user|the human|they(?:'re| are)\s+(?:pausing|waiting|asking|telling)|user (?:said|asked|wants)|i(?:'m| am)\s+(?:being asked|instructed)|as an ai|my (?:instructions|system prompt))\b/i;
export function stripMetaNarration(text) {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  const sentences = raw.match(/[^.!?]+[.!?]*/g) || [raw];
  const kept = sentences.filter((s) => !META_SENTENCE.test(s)).join(' ').replace(/\s{2,}/g, ' ').trim();
  if (kept) return kept;
  return 'Standing by.';                         // everything was narration — say the one useful bit
}

// 3. SAYING THE IDENTICAL PARAGRAPH AGAIN IS HOW A MACHINE ANSWERS. A person notices they are
//    repeating themselves. This does not re-word the content — inventing variation in numbers would
//    be worse — it just acknowledges the repeat, which is what makes it land as a conversation.
const AGAIN = ['Same as a moment ago — ', 'Still the same — ', 'Unchanged — '];
let __again = 0;

// A HOLDING LINE IS NOT AN ANSWER, so repeating one is not repeating yourself. Two slow questions in
// a row both return the ack "One moment.", and marking the second as a repeat produced the line
// Ahmad actually heard: "Unchanged - one moment." and then "Same as a moment ago - one moment."
// which says nothing at all and reads as a broken machine. The repeat-marker exists for a
// substantive paragraph delivered twice; acks and the pending placeholder are exempt.
// The pending text comes from axis-director.js's subscription-pending branch.
const TRANSIENT = new Set([...ACKS, 'One moment.', 'Standing by.'].map((s) => s.toLowerCase()));
export function isTransientLine(text) {
  return TRANSIENT.has(String(text || '').trim().toLowerCase());
}

export function markRepeat(text, lastText) {
  const a = String(text || '').trim(), b = String(lastText || '').trim();
  if (!a || a !== b) return text;
  if (isTransientLine(a)) return text;          // holding lines repeat freely
  return AGAIN[(__again++) % AGAIN.length] + a.charAt(0).toLowerCase() + a.slice(1);
}
