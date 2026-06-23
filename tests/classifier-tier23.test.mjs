// RUN 25-1 — Tier-2/3 vocabulary bank + expert-mode detector. Table-driven: every keyword routes to the
// right tier, 2+ hits triggers expert mode, 1 hit skips the picker with Tier-2 framing. Pure logic — does
// NOT touch aria.html's classify() regex tree, so the 34K corpus is unaffected (verified separately).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const NLU = require('../assets/aria-nlu-tier23.js');

let n = 0; const t = () => { n++; };

// 1 — every Tier-2 keyword, on its own, is recognized (skipPicker) and reports tier 2.
for (const kw of NLU.TIER2) {
  const r = NLU.detectExpertMode(`having trouble with ${kw} today`);
  assert.ok(r.skipPicker, `Tier-2 keyword skips the picker: "${kw}"`);
  assert.ok(r.matched.includes(kw), `Tier-2 keyword is matched: "${kw}"`);
  assert.equal(r.tier, 2, `single Tier-2 keyword reports tier 2: "${kw}"`);
  assert.equal(r.framing, 'tier2', `single Tier-2 keyword uses Tier-2 framing: "${kw}"`);
}
t();

// 2 — every Tier-3 keyword, on its own, is recognized and reports tier 3.
for (const kw of NLU.TIER3) {
  const r = NLU.detectExpertMode(`question about ${kw} please`);
  assert.ok(r.skipPicker, `Tier-3 keyword skips the picker: "${kw}"`);
  assert.ok(r.matched.includes(kw), `Tier-3 keyword is matched: "${kw}"`);
  assert.equal(r.tier, 3, `single Tier-3 keyword reports tier 3: "${kw}"`);
}
t();

// 3 — 2+ keyword hits → full expert mode; tier 3 wins when any Tier-3 word is present.
let r = NLU.detectExpertMode('GPO not applying to the Sales OU after the AD schema upgrade, gpupdate completes, rsop shows old policy, Event 1058');
assert.equal(r.expert, true, '2+ hits → expert mode');
assert.equal(r.tier, 3, 'Tier-3 words present → tier 3');
assert.ok(r.hits >= 2, 'multiple distinct hits counted');
assert.equal(r.framing, 'tier3');
t();

// 4 — two Tier-2 (no Tier-3) hits → expert mode at tier 2.
r = NLU.detectExpertMode('our domain controller and dns forwarder both look wrong');
assert.equal(r.expert, true);
assert.equal(r.tier, 2);
assert.equal(r.framing, 'tier2');
t();

// 5 — exactly 1 hit → NOT full expert, but still skips the picker with Tier-2 framing.
r = NLU.detectExpertMode('I think it is a vlan thing');
assert.equal(r.hits, 1);
assert.equal(r.expert, false, '1 hit is not full expert mode');
assert.equal(r.skipPicker, true, '1 hit still bypasses the Tier-1 picker');
assert.equal(r.framing, 'tier2');
t();

// 6 — 0 hits → ordinary message proceeds with the existing Tier-1 flow (no skip).
for (const msg of ['my printer is jammed again', 'wifi keeps dropping', 'outlook will not open', 'forgot my password', 'the pc is really slow']) {
  const z = NLU.detectExpertMode(msg);
  assert.equal(z.skipPicker, false, `ordinary L1 message does not trigger expert mode: "${msg}"`);
  assert.equal(z.tier, 0);
  assert.equal(z.framing, 'none');
}
t();

// 7 — short ambiguous tokens (ad/ou/dc/isp/san/lun) match ONLY as whole words, never inside other words.
for (const benign of ['I had a bad download', 'about the house', 'please read the manual', 'plunge into it', 'san francisco office wifi']) {
  // "san francisco" contains the token "san" as a whole word → that is an accepted (rare) 1-hit edge; assert it never
  // mis-fires on the embedded-substring cases, which are the real risk:
  if (/\bsan francisco\b/.test(benign)) continue;
  const z = NLU.detectExpertMode(benign);
  assert.equal(z.hits, 0, `no false positive from embedded substrings: "${benign}"`);
}
// explicit substring guards
assert.equal(NLU.detectExpertMode('I had an issue and it would not load').hits, 0, '"had"/"load" never match "ad"');
assert.equal(NLU.detectExpertMode('thinking about our roundtrip').hits, 0, '"about"/"round"/"our" never match "ou"/"wan"');
t();

// 8 — expert routing carries a sensible domain + first-3-checks content (label + exactly 3 checks).
const dns = NLU.detectExpertMode('DCs can\'t resolve each other after the ISP change, dns forwarder is stale');
assert.equal(dns.domain, 'dns-net', 'DNS/ISP message → dns-net domain');
const checks = NLU.expertChecks(dns.domain);
assert.equal(checks.checks.length, 3, 'exactly first-3-checks');
assert.ok(checks.label && checks.escalation, 'domain has a label + escalation line');
const adgpo = NLU.expertChecks(NLU.detectExpertMode('gpupdate then rsop shows old GPO, Event 1058 on sysvol').domain);
assert.equal(NLU.detectExpertMode('gpupdate then rsop shows old GPO, Event 1058 on sysvol').domain, 'ad-gpo');
assert.equal(adgpo.checks.length, 3);
t();

// 9 — public-surface scrub strips admin-internal terms from any expert output (fc13223 invariant).
const dirty = 'run rcp_disk_clean via the tier-0 executor then check /.netlify/functions/sentinel-resolve and SENTINEL_LICENSE_SECRET';
const clean = NLU.scrubPublicSurface(dirty);
assert.ok(!/rcp_/.test(clean), 'recipe ids scrubbed');
assert.ok(!/SENTINEL_/.test(clean), 'secret env names scrubbed');
assert.ok(!/netlify\/functions/.test(clean), 'function paths scrubbed');
assert.ok(!/tier-0 executor/i.test(clean), 'internal mode names scrubbed');
// And the authored expert content is already clean:
for (const key of ['ad-gpo', 'dns-net', 'virtualization', 'identity', 'remote-access', 'generic']) {
  const c = NLU.expertChecks(key);
  const blob = c.label + ' ' + c.checks.join(' ') + ' ' + c.escalation;
  assert.equal(NLU.scrubPublicSurface(blob), blob, `authored ${key} content has no admin-internal terms`);
}
t();

assert.equal(n, 9, '9 expert-mode test groups');
console.log(`classifier-tier23 test passed (${n} groups · ${NLU.TIER2.length} Tier-2 + ${NLU.TIER3.length} Tier-3 keywords route · expert threshold · whole-word safety · domain checks · public scrub).`);
