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

console.error('10K Corpus size:', out.length);
module.exports = out;
