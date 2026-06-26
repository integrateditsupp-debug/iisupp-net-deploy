// RUN 25-3 — low-confidence → technician handoff (no generic picker). The public classifier has no numeric
// confidence, so 'default' IS the low-confidence signal; escalate only when it is NOT an expert message.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const NLU = require('../assets/aria-nlu-tier23.js');

let n = 0; const t = () => { n++; };

// 1 — genuine garbage / unmatched input (intent 'default', no expert vocab) → escalate to a technician.
for (const junk of ['asdf qwer zxcv', 'the thingy is doing the thing', 'blah blah weird situation']) {
  const expert = NLU.detectExpertMode(junk);
  assert.equal(expert.skipPicker, false, `no expert vocab in junk: "${junk}"`);
  assert.equal(NLU.shouldEscalateToTechnician('default', expert), true, `junk → technician handoff: "${junk}"`);
}
t();

// 2 — an EXPERT 'default' message does NOT escalate to the generic handoff (it gets the domain answer instead).
const gpo = NLU.detectExpertMode('GPO not applying after AD schema upgrade, Event 1058');
assert.equal(gpo.skipPicker, true, 'expert vocab present');
assert.equal(NLU.shouldEscalateToTechnician('default', gpo), false, 'expert message bypasses the generic handoff');
t();

// 3 — a confidently-classified intent (not 'default') never triggers the technician handoff.
for (const intent of ['printer', 'wifi', 'password', 'kb:active-directory', 'kb:networking', 'escalation']) {
  assert.equal(NLU.shouldEscalateToTechnician(intent, NLU.detectExpertMode('whatever')), false, `classified intent does not escalate: ${intent}`);
}
t();

// 4 — the escalation lead carries the FULL user message + the correct lead-source tag for the pipeline.
const msg = 'something very specific and weird happening with three monitors at 3pm only';
const lead = NLU.buildEscalationLead(msg, 'default');
assert.equal(lead.message, msg, 'full message captured (not truncated)');
assert.equal(lead.source, 'aria-low-confidence-escalation', 'lead-source tag set');
assert.equal(lead.source, NLU.LOW_CONFIDENCE_SOURCE, 'tag matches the exported constant');
assert.equal(lead.last_intent, 'default');
// null-safety
assert.equal(NLU.buildEscalationLead(null, null).source, 'aria-low-confidence-escalation');
assert.equal(NLU.buildEscalationLead(null, null).message, '');
t();

assert.equal(n, 4, '4 low-confidence-escalation test groups');
console.log(`low-confidence-escalation test passed (${n} groups · junk→handoff · expert bypasses · classified never escalates · full message + source tag captured).`);
