// vision-diagnose-handler.test.mjs — offline smoke test for the aria-vision-diagnose function.
// Stubs the KB fetch with the local corpus and exercises the handler end-to-end (no network, no key).
//   node tests/vision-diagnose-handler.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const KB = readFileSync(join(__dir, '..', 'assets', 'aria-kb-chunks.json'), 'utf8');

// Ensure no vision model is configured for this run → image must honestly abstain.
delete process.env.ARIA_VISION_MODEL;
delete process.env.ANTHROPIC_API_KEY;

// Stub global.fetch so loadChunks() gets the local KB instead of hitting iisupp.net.
const realFetch = global.fetch;
global.fetch = async (url) => {
  if (String(url).includes('aria-kb-chunks.json')) {
    return new Response(KB, { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected network call in test: ' + url);
};

const { default: handler } = await import('../netlify/functions/aria-vision-diagnose.mjs');

const call = async (payload) => {
  const req = new Request('https://x/.netlify/functions/aria-vision-diagnose', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const res = await handler(req);
  return res.json();
};

let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

console.log('[handler] offline end-to-end');

// 1. Pasted error text → confident diagnosis + gated fix.
{
  const r = await call({ surface: 'web', kind: 'text', text: 'Outlook is frozen and will not open, stuck loading profile.' });
  ok('text problem returns ok', r.ok === true && r.blocked !== true);
  ok('text problem produces a diagnosis', r.diagnosis && /outlook/i.test(r.diagnosis.title || r.diagnosis.slug));
  ok('diagnosis carries a confidence label', ['high', 'medium', 'low'].includes(r.confidenceLabel));
  ok('gated fix attached with audit endpoint', r.fix && /action=audit/.test(r.fix.auditEndpoint));
  ok('privacy dataFlow is honest: no third-party model on the text path', r.dataFlow && r.dataFlow.thirdPartyModel === false);
}

// 2. Image with NO vision model configured → honest abstain (Rule 14, no fabrication).
{
  const r = await call({ surface: 'web', kind: 'image', imageBase64: 'AAAA', mediaType: 'image/png', allowCloudVision: true, consent: { cloudProcessing: true } });
  ok('image w/o model → abstain', r.abstain === true && !r.diagnosis);
  ok('abstain reason is honest (not-configured)', r.reason === 'cloud-vision-not-configured');
  ok('abstain offers an honest fallback path', r.honestFallback && Array.isArray(r.honestFallback.options));
}

// 3. Sentinel screen-capture with no consent → blocked.
{
  const r = await call({ surface: 'sentinel', kind: 'screen-capture', imageBase64: 'AAAA', allowCloudVision: true, consent: {} });
  ok('sentinel capture w/o consent → blocked', r.blocked === true);
  ok('block lists screenCapture consent', r.requiresConsent.includes('screenCapture'));
}

// 4. Redaction runs in the pipeline — secret in pasted text never echoed back raw.
{
  const r = await call({ surface: 'forums', kind: 'log', text: 'Teams crash for user amy@corp.com token ghp_qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1234567' });
  ok('forums surface works', r.ok === true);
  ok('redaction report present', r.redaction && r.redaction.count >= 2);
  ok('no raw email/token anywhere in response', !JSON.stringify(r).includes('amy@corp.com') && !JSON.stringify(r).includes('ghp_qqqq'));
}

// 5. D4 — oversized image is refused BEFORE any paid call (size cap), even with a model configured.
{
  process.env.ARIA_VISION_MODEL = 'test-vision-model';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ARIA_VISION_MAX_B64 = '1000';           // tiny cap for the test
  let anthropicHit = false;
  const kbFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).includes('api.anthropic.com')) { anthropicHit = true; throw new Error('should never reach Anthropic'); }
    return kbFetch(url, opts);
  };
  const big = 'A'.repeat(2000);                        // over the 1000-char cap
  const req = new Request('https://x/.netlify/functions/aria-vision-diagnose', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ surface: 'web', kind: 'image', imageBase64: big, mediaType: 'image/png', allowCloudVision: true, consent: { cloudProcessing: true } }),
  });
  const res = await handler(req);
  const j = await res.json();
  ok('oversized image → 413 refusal', res.status === 413);
  ok('oversized image reason is image-too-large', j.reason === 'image-too-large');
  ok('oversized image NEVER hits the paid Anthropic endpoint', anthropicHit === false);
  ok('oversized image still offers an honest fallback', j.honestFallback && Array.isArray(j.honestFallback.options));
  global.fetch = kbFetch;
  delete process.env.ARIA_VISION_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ARIA_VISION_MAX_B64;
}

global.fetch = realFetch;
console.log('\nALL ' + pass + ' HANDLER ASSERTIONS PASSED ✅');
