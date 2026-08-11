// tests/axis-brain-cascade.test.mjs — the cost cascade (2026-08-11).
//
// Ahmad: "the brain should be using ARIA brain, then research using the agents we have… then the
// plan I pay for every month, and move to anthropic if needed… once it finds a solution the kb
// agent notes it down so in the future we dont have to use anthropic credit and waste tokens."
//
// What this protects: the ORDER (cheapest first), the fact that the metered API is only ever the
// last resort, and the write-back gate — because the learning loop once banked its own boilerplate
// as "knowledge" (~90% slop, fixed 2026-06-02) and a careless gate would recreate that.
// Run: node tests/axis-brain-cascade.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const B = require(path.join(root, 'netlify', 'functions', 'lib', 'axis-brain.cjs'));
const director = fs.readFileSync(path.join(root, 'netlify', 'functions', 'axis-director.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'scripts', 'axis-brain-worker.mjs'), 'utf8');
let n = 0; const ok = () => { n++; };

// ---- 1. Cheapest tier wins, and the order is fixed ----
const realFetch = globalThis.fetch;
const stub = (routes) => { globalThis.fetch = async (url) => {
  for (const [frag, body] of Object.entries(routes))
    if (String(url).includes(frag)) return { ok: true, json: async () => body };
  return { ok: false, json: async () => ({}) };
}; };

const LONG = 'Open Settings then Apps then Installed apps, find the printer entry, choose Advanced options and press Repair. Reboot and print a test page to confirm the queue drains.';
try {
  stub({ 'aria-kb-query': { match: true, content_excerpt: LONG, confidence: 22, source: 'aria-kb-public' },
         'aria-research': { answer: 'research would have answered too' } });
  let hit = await B.askBrain({ query: 'printer queue stuck on windows 11', origin: 'https://x', skip: ['subscription'] });
  assert.equal(hit.tier, 'kb', 'the ARIA brain answers first when it has a match');
  assert.equal(hit.cost, 0);
  assert.deepEqual(hit.tried, ['kb'], 'a KB hit never touches research');

  // KB misses → research picks it up. Still $0, still no metered API.
  stub({ 'aria-kb-query': { match: false, confidence: 2 }, 'aria-research': { answer: LONG } });
  hit = await B.askBrain({ query: 'printer queue stuck on windows 11', origin: 'https://x', skip: ['subscription'] });
  assert.equal(hit.tier, 'research');
  assert.deepEqual(hit.tried, ['kb', 'research'], 'research is only tried after the KB misses');

  // Everything empty → null, which is the ONLY way the caller reaches the metered API.
  stub({ 'aria-kb-query': { match: false }, 'aria-research': {} });
  assert.equal(await B.askBrain({ query: 'something entirely novel to us', origin: 'https://x', skip: ['subscription'] }), null,
    'the cascade returns null rather than inventing an answer');
  ok();

  // ---- 2. A thin research reply does not count as an answer ----
  stub({ 'aria-kb-query': { match: false }, 'aria-research': { answer: 'Maybe?' } });
  assert.equal(await B.askBrain({ query: 'printer queue stuck', origin: 'https://x', skip: ['subscription'] }), null,
    'a one-word research reply must not pre-empt a real answer');
  ok();
} finally { globalThis.fetch = realFetch; }

// ---- 3. The write-back gate — no slop enters the ARIA brain ----
assert.ok(B.isSubstantive(LONG), 'a real procedure is bankable');
for (const bad of ['Hi there!', 'Sure, happy to help.', "I don't know.", 'Could you clarify which printer?', 'ok'])
  assert.ok(!B.isSubstantive(bad), `"${bad}" must never be banked as knowledge`);
// A real answer to a junk question is still junk.
assert.ok(!B.worthLearning('hi', LONG, 'anthropic'), 'a greeting never creates a KB entry');
assert.ok(B.worthLearning('printer queue stuck on windows 11', LONG, 'anthropic'), 'a real Q+A is banked');
// Re-banking a KB answer is the echo chamber that broke the loop before.
assert.ok(!B.worthLearning('printer queue stuck on windows 11', LONG, 'kb'),
  'an answer that CAME from the KB is never written back into the KB');
ok();

// ---- 4. Tier 3 never stalls on an offline worker ----
assert.match(B.subscriptionTier.toString(), /workerOnline\(\)/,
  'the subscription tier checks the heartbeat before queueing');
assert.ok(B.HEARTBEAT_MAX_MS <= 180000, 'a stale heartbeat counts as offline');
ok();

// ---- 5. The director consults the cascade BEFORE spending, and banks after ----
const cascadeAt = director.indexOf('askBrain');
const anthropicAt = director.indexOf('api.anthropic.com');
assert.ok(cascadeAt > 0 && anthropicAt > 0 && cascadeAt < anthropicAt,
  'the cascade runs before the metered API call, not after');
assert.match(director, /learnBack\(\{ query: askText, answer: out\.text, tier: 'anthropic'/,
  'a metered answer is banked so the question is free next time');
assert.match(director, /brainTier/, 'the answering tier is reported back to the console');
ok();

// ---- 6. The worker uses the PLAN, not the metered key ----
// Credential precedence is ANTHROPIC_API_KEY → ANTHROPIC_AUTH_TOKEN → the claude.ai OAuth login.
// Ahmad has ANTHROPIC_API_KEY set as a persistent user env var, so an un-scrubbed spawn silently
// bills the metered account instead of the Max plan. Measured 2026-08-11; this is the whole saving.
assert.match(worker, /delete e\.ANTHROPIC_API_KEY/, 'the API key is stripped from the CLI child env');
assert.match(worker, /delete e\.ANTHROPIC_AUTH_TOKEN/, 'the auth-token fallback is stripped too');
assert.match(worker, /env: PLAN_ENV/, 'the scrubbed env is actually passed to spawn');
assert.match(worker, /'--print'/, 'the CLI is invoked non-interactively');
ok();

console.log(`axis-brain-cascade: ${n}/6 groups green — KB → research → Max plan → metered API, and only real answers are banked.`);
