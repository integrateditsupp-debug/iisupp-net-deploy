'use strict';
/* === ARIA ADVERSARIAL SCENARIO SEED ===
   STAGED 2026-06-20 by autonomous classifier loop. NOT yet wired into the
   active harness. Purpose: restore signal after 6 consecutive 100% runs on the
   saturated 29K corpus.

   The Sunday 2026-06-21 growth run should:
     1. Run each q through classify() and confirm the `expect` label is the
        semantically-correct routing (some labels below are best-judgment and
        may need a flip after inspection).
     2. Append validated items into scenario-corpus-10k.js (out.push(...)).
     3. Expand each adversarial category to ~5K via the existing variation
        generators (typo/case/prefix/suffix) so the layer is a real signal.

   Categories: typos, multi-intent, negation, code-switching, sarcasm,
   vague/underspecified, distractor-laden. Labels = what a CORRECT classifier
   should return for the DOMINANT actionable intent.
*/

module.exports = [
  // --- Heavy typos / keyboard slips ---
  { q: 'my pasword isnt wrking anymroe', expect: 'password' },
  { q: 'cnat get into my emial accnt', expect: 'mail' },
  { q: 'wfi keeps dropping evry few mins', expect: 'wifi' },
  { q: 'prnter wont prnt anythign', expect: 'printer' },
  { q: 'vpm wont conect to teh offce', expect: 'vpn' },
  { q: 'outlokk frozen agian ugh', expect: 'mail' },
  { q: 'my teem meeting audio ded', expect: 'kb:teams' },

  // --- Multi-intent (dominant actionable issue should win) ---
  { q: 'wifi is fine but outlook wont send mail', expect: 'mail' },
  { q: 'reset my password and also vpn is down', expect: 'password' },
  { q: 'printer works now but teams call keeps dropping', expect: 'kb:teams' },
  { q: 'i fixed the wifi but now i cant log in at all', expect: 'password' },
  { q: 'bluetooth mouse and the webcam both stopped', expect: 'kb:bluetooth' },

  // --- Negation / "not the problem" framing ---
  { q: 'its not a password issue, i literally cant open outlook', expect: 'mail' },
  { q: 'not wifi — the vpn specifically refuses to connect', expect: 'vpn' },
  { q: 'the printer is NOT offline yet nothing prints', expect: 'printer' },
  { q: 'this isnt about teams, my mic doesnt work anywhere', expect: 'kb:teams' },

  // --- Code-switching / mixed language ---
  { q: 'mon wifi ne marche pas du tout', expect: 'wifi' },
  { q: 'no puedo abrir mi correo outlook', expect: 'mail' },
  { q: 'mi contraseña no funciona help', expect: 'password' },
  { q: 'la imprimante ne fonctionne plus', expect: 'printer' },

  // --- Sarcasm / frustration framing ---
  { q: 'oh great, outlook decided to die again. love it.', expect: 'mail' },
  { q: 'wonderful, locked out of my account for the third time today', expect: 'password' },
  { q: 'cool cool cool the wifi is doing its thing again', expect: 'wifi' },
  { q: 'just SO thrilled the vpn dropped mid-call', expect: 'vpn' },

  // --- Vague / underspecified (should route default or escalation) ---
  { q: 'it broke', expect: 'default' },
  { q: 'nothing works today', expect: 'default' },
  { q: 'this stupid thing again', expect: 'default' },
  { q: 'can someone just call me', expect: 'escalation' },
  { q: 'i need a human right now', expect: 'escalation' },
  { q: 'whatever you cant help', expect: 'escalation' },

  // --- Distractor-laden (real intent buried in noise) ---
  { q: 'so i was on the train this morning and anyway my laptop wont connect to wifi', expect: 'wifi' },
  { q: 'long story but the bottom line is i forgot my password', expect: 'password' },
  { q: 'hey hope your week is going well — quick one, outlook keeps crashing', expect: 'mail' },
  { q: 'after the update yesterday which i didnt want btw the printer died', expect: 'printer' },

  // --- Off-domain / guardrail (should NOT route to a tech intent) ---
  { q: 'whats the weather in toronto tomorrow', expect: 'weather/news' },
  { q: 'should i buy nvidia stock today', expect: 'trade' },
  { q: 'find me a cheap laptop under 800', expect: 'shopping' },
  { q: 'whats the latest news on the election', expect: 'news' },
  { q: 'how much for a managed services quote', expect: 'quote' },

  // --- Borderline escalation vs self-serve ---
  { q: 'ive tried everything and its still broken', expect: 'escalation' },
  { q: 'this has been down for 3 days nobody helped', expect: 'escalation' },
  { q: 'i restarted twice and cleared cache, password still rejected', expect: 'password' },
];
