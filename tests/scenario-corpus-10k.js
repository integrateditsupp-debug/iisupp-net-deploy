'use strict';
/* === 10,000+ ARIA SCENARIO GENERATOR ===
   Programmatically expands base templates by:
   - subject variations (it/this/that)
   - tense variations (is/was/has been)
   - verb variations (broke/broken/breaking)
   - politeness wrappers (please, can you, help me)
   - urgency wrappers (urgent, asap, now)
   - typo variations (common keyboard slips)
   - casing variations (lowercase, sentence, ALL CAPS)
*/

const baseCorpus = require('./scenario-corpus');  // 1896 hand-curated

const out = [...baseCorpus];

// Variation generators
function caseVariants(s) {
  return [s, s.toUpperCase(), s.charAt(0).toUpperCase() + s.slice(1)];
}

const PREFIX_POLITE = ['please ', 'can you help with ', 'i need help with ', 'help me with ', 'sorry but ', 'quick question — '];
const PREFIX_URGENT = ['urgent: ', 'asap ', 'urgent ', 'help now: ', 'critical: ', 'p1: '];
const SUFFIX = ['', ' please', ' thanks', ' asap', ' urgent', '?', '!', '!!', '...'];
const TYPOS = {
  'won\'t': ['wont', 'won t', "won'r"],
  'can\'t': ['cant', 'can t', "can;t"],
  'outlook': ['outlok', 'outlokk', 'outloook'],
  'password': ['pasword', 'passw0rd', 'pasworld'],
  'wifi': ['wifii', 'wfi', 'wifi-'],
  'email': ['emial', 'eamil', 'emial'],
  'teams': ['team\'s', 'teamz', 'teem'],
};

// Expand each base scenario with variations
baseCorpus.forEach((item, idx) => {
  // Skip edge cases — they should stay literal
  if (item.expect === 'edge' || item.expect === 'resolution' || item.expect === 'not-resolution') return;

  // Add polite prefix variants
  PREFIX_POLITE.forEach(p => {
    out.push({ q: p + item.q, expect: item.expect });
  });
  // Add urgent prefix variants
  PREFIX_URGENT.forEach(p => {
    out.push({ q: p + item.q, expect: item.expect });
  });
  // Add suffix variants (skip empty)
  SUFFIX.slice(1, 4).forEach(s => {
    out.push({ q: item.q + s, expect: item.expect });
  });
  // Add typo variants
  for (const [orig, typos] of Object.entries(TYPOS)) {
    if (item.q.includes(orig)) {
      typos.forEach(t => {
        out.push({ q: item.q.replace(orig, t), expect: item.expect });
      });
    }
  }
});

// Add more resolution variations (10+ phrasings)
const RESOLVE_BASE = ['solved', 'fixed', 'works now', 'all good', 'perfect', 'thank you', 'great', 'awesome', 'done', 'sorted', 'thanks a million'];
const RESOLVE_PREFIX = ['', 'yes ', 'yep ', 'ok ', 'great, ', 'cool, ', 'oh ', 'wow ', 'amazing ', 'perfect, '];
const RESOLVE_SUFFIX = ['', '!', '!!', '.', ' thanks', ' thank you', ' :)', ' 🎉', ' 👌', ' 💯'];
RESOLVE_BASE.forEach(b => {
  RESOLVE_PREFIX.forEach(p => {
    RESOLVE_SUFFIX.forEach(s => {
      out.push({ q: p + b + s, expect: 'resolution' });
    });
  });
});

// Negation expansions
const NEG_BASE = ['still not fixed', 'still broken', 'didn\'t help', 'not working', 'no luck', 'happening again', 'came back', 'broke again', 'worse now', 'nope'];
NEG_BASE.forEach(b => {
  caseVariants(b).forEach(c => {
    out.push({ q: c, expect: 'not-resolution' });
  });
});

/* ============================================================
   ADVERSARIAL LAYER - Sunday 2026-06-21 corpus growth (~5K)
   WHY: the 29,072 clean corpus held 100% pass for 6 consecutive
   runs (06-19 x3, 06-20 x3) = zero signal. Prior sessions flagged
   that the Sunday growth slot must add an ADVERSARIAL layer
   (typos, multi-intent precedence, code-switching, negation/
   sarcasm) NOT a clean industry layer, so pass rate regains signal.
   Expectations reflect what ARIA SHOULD route to. Genuine misses
   surface as regex-broaden suggestions for HUMAN review and are
   NEVER auto-applied to aria.html.
   ============================================================ */
const advStart = out.length;

// --- 1. Robustness wrappers around known-good phrases (should PASS) ---
const GOOD_BASE = [
  ['my outlook wont open', 'mail'],
  ['cant connect to the vpn', 'vpn'],
  ['i need a password reset', 'password'],
  ['the printer is jammed', 'printer'],
  ['wifi keeps dropping', 'wifi'],
  ['teams wont load my channels', 'kb:teams'],
  ['the mfa code never arrives', 'kb:mfa'],
  ['onedrive wont sync', 'kb:onedrive'],
  ['my laptop is really slow', 'kb:performance'],
  ['this pc is super laggy', 'kb:performance'],
  ['bluetooth headset keeps cutting out', 'kb:bluetooth'],
  ['i think i clicked a phishing link', 'kb:security'],
  ['someone has access to my account', 'kb:security'],
  ['my webcam isnt working on video calls', 'kb:webcam'],
  ['bitlocker is asking for a recovery key', 'kb:bitlocker'],
  ['my macbook wont boot', 'kb:macos'],
  ['usb drive not recognized', 'kb:usb'],
  ['chrome keeps crashing', 'kb:browser'],
  ['edge is so slow lately', 'kb:browser'],
  ['i cant open the shared folder', 'kb:permissions'],
  ['cant resolve hostname', 'kb:networking'],
  ['my account is locked out in active directory', 'kb:active-directory'],
  ['switch to voice mode', 'voice'],
  ['i want to talk to a human', 'escalation'],
  ['im stuck', 'escalation'],
  ['whats the weather today', 'weather'],
  ['show me the news headlines', 'news'],
  ['whats the bitcoin price', 'trade'],
  ['give me a motivational quote', 'quote'],
  ['i want to buy a laptop charger on amazon', 'shopping'],
  ['vpn keeps disconnecting every few minutes', 'vpn'],
  ['outlook is frozen and not responding', 'mail'],
  ['cant sign in to my account', 'password'],
  ['the wifi adapter disappeared', 'wifi'],
  ['teams call has no audio', 'kb:teams'],
  ['authenticator app isnt sending codes', 'kb:mfa'],
  ['files wont sync to onedrive', 'kb:onedrive'],
  ['my laptop keeps overheating', 'kb:performance'],
  ['my airpods wont pair', 'kb:bluetooth'],
  ['i got a ransomware warning', 'kb:security'],
];
const NOISE_PRE = ['so basically ', 'ok so ', 'hey quick one ', 'not sure who to ask but ', 'sorry to bug you ', 'long story short ', 'real quick ', 'morning! ', 'ugh ', 'heads up ', 'genuine question '];
const NOISE_POST = ['', ' anyway', ' lol', ' been like this all morning', ' driving me nuts', ' second time today', ' any ideas', ' pls help', ' when you get a sec', ' tia', ' so frustrating'];
GOOD_BASE.forEach(function (pair) {
  NOISE_PRE.forEach(function (pre) {
    NOISE_POST.forEach(function (post) {
      out.push({ q: pre + pair[0] + post, expect: pair[1], adv: true, cat: 'robustness' });
    });
  });
});

// --- 2. Multi-intent precedence (most-specific wins) ---
const PRECEDENCE = [
  ['network printer on the wifi wont print', 'printer'],
  ['wireless printer not printing over the wifi', 'printer'],
  ['outlook keeps crashing when i connect to the vpn', 'mail'],
  ['got a phishing email asking me to reset my password', 'kb:security'],
  ['suspicious sign-in and now my account is locked out', 'kb:security'],
  ['teams meeting wont start and my webcam is dead', 'kb:webcam'],
  ['out of office wont turn off in outlook', 'outlook_ooo'],
  ['mfa code never arrives so i cant reset my password', 'password'],
  ['onedrive wont sync and teams wont load', 'kb:teams'],
  ['vpn is up but i still cant reach the internal site', 'vpn'],
  ['macbook wont boot after the bluetooth update', 'kb:macos'],
  ['my password is fine but the wifi keeps dropping', 'wifi'],
];
PRECEDENCE.forEach(function (pair) {
  caseVariants(pair[0]).forEach(function (c) { out.push({ q: c, expect: pair[1], adv: true, cat: 'precedence' }); });
});

// --- 3. Typo-break (genuine regex gaps - expect human intent) ---
const TYPO_BREAK = [
  ['wirless wont conect', 'wifi'],
  ['cant find the wireles network', 'wifi'],
  ['no wirless signal at all', 'wifi'],
  ['vpm wont conect', 'vpn'],
  ['cant reach the vpm', 'vpn'],
  ['prnter jammed again', 'printer'],
  ['the priner is offline', 'printer'],
  ['bluetoth headset dead', 'kb:bluetooth'],
  ['blutooth wont pair', 'kb:bluetooth'],
  ['my wabcam is frozen on calls', 'kb:webcam'],
];
const TB_SUFFIX = ['', ' please', ' asap'];
TYPO_BREAK.forEach(function (pair) {
  caseVariants(pair[0]).forEach(function (c) {
    TB_SUFFIX.forEach(function (s) { out.push({ q: c + s, expect: pair[1], adv: true, cat: 'typo-break' }); });
  });
});

// --- 4. Code-switching ---
const CS_PASS = [
  ['mi wifi no funciona', 'wifi'],
  ['el wifi no conecta', 'wifi'],
  ['necesito password reset urgente', 'password'],
  ['mi outlook no abre', 'mail'],
  ['el vpn no funciona', 'vpn'],
  ['mon wifi ne marche pas', 'wifi'],
  ['mon outlook plante', 'mail'],
  ['mein outlook startet nicht', 'mail'],
  ['ich kann das wifi nicht verbinden', 'wifi'],
  ['reset password bitte', 'password'],
  ['mi teams no carga', 'kb:teams'],
  ['mon vpn est deconnecte', 'vpn'],
  ['el onedrive no sincroniza', 'kb:onedrive'],
  ['mein bluetooth headset geht nicht', 'kb:bluetooth'],
];
const CS_FAIL = [
  ['mi impresora esta atascada', 'printer'],
  ['no puedo iniciar sesion', 'password'],
  ['mi red inalambrica no funciona', 'wifi'],
  ['mon imprimante est en panne', 'printer'],
  ['je ne peux pas me connecter', 'password'],
  ['mein drucker druckt nicht', 'printer'],
  ['ma souris ne marche pas', 'default'],
  ['no tengo internet', 'wifi'],
  ['mein passwort ist abgelaufen', 'password'],
  ['mi correo no abre', 'mail'],
];
CS_PASS.forEach(function (p) { p.push('cs-pass'); });
CS_FAIL.forEach(function (p) { p.push('cs-fail'); });
CS_PASS.concat(CS_FAIL).forEach(function (pair) {
  [pair[0], pair[0].charAt(0).toUpperCase() + pair[0].slice(1), pair[0] + ' ?'].forEach(function (c) {
    out.push({ q: c, expect: pair[1], adv: true, cat: pair[2] });
  });
});

// --- 5. Negation / sarcasm resolution ---
const NOT_RES = [
  'oh great still broken', 'fantastic, didnt work', 'lovely, broke again',
  'wonderful, still not working', 'nice, came back', 'cool, still down',
  'perfect, no luck', 'amazing, worse now', 'awesome, still cant log in',
  'thanks but nope still broken', 'yeah no it didnt help', 'great, happening again',
];
const RES = [
  'yep that sorted it', 'perfect all good now', 'legend that fixed it',
  'cheers mate works now', '10/10 sorted', 'that did the trick thanks',
  'all set were good', 'works like a charm now', 'brilliant, problem solved',
  'youre a lifesaver, fixed', 'much better now thanks', 'sweet, back to normal',
];
const RES_PRE = ['', 'ok ', 'oh ', 'well '];
NOT_RES.forEach(function (b) { RES_PRE.forEach(function (p) { out.push({ q: p + b, expect: 'not-resolution', adv: true, cat: 'neg-res' }); }); });
RES.forEach(function (b) { RES_PRE.forEach(function (p) { out.push({ q: p + b, expect: 'resolution', adv: true, cat: 'pos-res' }); }); });


// --- 6. Genuine-gap singles (tracked regex gaps; expectation = correct human intent) ---
// Each is ONE instance (no wrapper inflation). Surfaces a specific aria.html regex
// rigidity for HUMAN review (logged to pending-fixes). NOT auto-applied.
const GAP_SINGLES = [
  ['my fan is spinning and the laptop is hot', 'kb:performance'],   // perf regex needs adjacency; "fan is spinning" / "laptop is hot" infix breaks it
  ['the laptop is running hot and loud', 'kb:performance'],
  ['cant sign in to my email', 'password'],                         // email keyword routes to mail before login; design review
];
GAP_SINGLES.forEach(function (pair) { out.push({ q: pair[0], expect: pair[1], adv: true, cat: 'gap-single' }); });
console.error('Adversarial layer added:', out.length - advStart, 'scenarios');
console.error('10K Corpus size:', out.length);
module.exports = out;
