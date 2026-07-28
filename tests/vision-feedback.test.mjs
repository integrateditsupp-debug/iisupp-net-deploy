// tests/vision-feedback.test.mjs — STAGE 2 · "Was this the right fix?" must be a REAL signal.
//
// The defect this file locks shut: the widget used to render the prompt, print
// "Thanks — noted." and then discard the answer. Rule 14 forbids claiming an action we
// did not perform, so these tests prove (a) the vote is actually posted to the existing
// aria-feedback endpoint, (b) the on-screen wording follows the ACTUAL outcome, and
// (c) the payload leaks no image, no raw log/screen text and no PII.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFeedbackPayload, newDiagnosisId, sendFeedback, FEEDBACK_ENDPOINT,
} from '../netlify/functions/lib/vision-feedback.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const WIDGET_WEB = 'assets/aria-vision-diagnose.js';
const WIDGET_SENTINEL = 'ARIA Sentinel/src/renderer/vendor/aria-vision-diagnose.js';
const HANDLER = 'netlify/functions/aria-vision-diagnose.mjs';

const MATCHED = {
  ok: true, surface: 'web', kind: 'image', abstain: false,
  confidence: 31, confidenceLabel: 'high',
  diagnosis: { title: 'Windows stop code 0x133 (DPC_WATCHDOG_VIOLATION)', slug: 'bsod-dpc-watchdog', url: '/kb/bsod-dpc-watchdog' },
  fix: { oneClickEligible: true, recipeId: 'storahci-driver-reset' },
  meta: { visionUsed: true },
  diagnosisId: 'vd.web.image.bsod-dpc-watchdog.31.abc123',
};

const ABSTAINED = {
  ok: true, surface: 'sentinel', kind: 'screen-capture', abstain: true,
  confidence: 4, confidenceLabel: 'abstain', diagnosis: null,
  honestFallback: { message: "I don't have a confident answer for this one." },
  meta: { visionUsed: true },
};

// ── 1. payload shape matches what aria-feedback actually accepts ────────────────────────
test('[1] payload matches the aria-feedback contract exactly', () => {
  const p = buildFeedbackPayload({ helpful: true, result: MATCHED });
  assert.deepEqual(Object.keys(p).sort(), ['comment', 'intent', 'msg_id', 'text', 'vote']);
  assert.equal(p.vote, 'up');
  assert.ok(['up', 'down'].includes(p.vote), 'aria-feedback rejects anything else');
  assert.equal(p.msg_id, MATCHED.diagnosisId, 'reuses the server-issued id when present');
  assert.equal(p.intent, 'vision-diagnose:bsod-dpc-watchdog');

  const d = buildFeedbackPayload({ helpful: false, result: MATCHED });
  assert.equal(d.vote, 'down', 'a "Not yet" click is the downvote that alerts Ahmad');
});

test('[2] aria-feedback field limits are respected so nothing is silently truncated server-side', () => {
  const p = buildFeedbackPayload({
    helpful: false,
    result: { ...MATCHED, diagnosis: { ...MATCHED.diagnosis, title: 'T'.repeat(900), slug: 'S'.repeat(200) } },
  });
  assert.ok(p.msg_id.length <= 120, 'msg_id within the 120-char server slice');
  assert.ok(p.intent.length <= 60, 'intent within the 60-char server slice');
  assert.ok(p.text.length <= 600, 'text within the 600-char server slice');
  assert.ok(p.comment.length <= 600, 'comment within the 600-char server slice');
});

// ── 2. abstain is rateable — a wrong abstain is the most valuable signal we have ─────────
test('[3] an abstain still produces a real, honest vote', () => {
  const p = buildFeedbackPayload({ helpful: false, result: ABSTAINED });
  assert.equal(p.intent, 'vision-diagnose:abstain');
  assert.equal(p.vote, 'down');
  assert.match(p.text, /abstained/i);
  assert.match(p.comment, /abstain=yes/);
  assert.ok(!/diagnosis(?!\b)/.test(p.text) || /abstained/.test(p.text),
    'never dressed up as a diagnosis we did not make');
});

// ── 3. PRIVACY — the vote must not become a side channel ────────────────────────────────
test('[4] payload carries no image, no raw text/log, and no PII', () => {
  const leaky = {
    ...MATCHED,
    imageBase64: 'iVBORw0KGgoAAAANSUhEUg', // must never appear
    text: 'user log line: password=hunter2 ssn 123-45-6789 admin@acme.com 10.0.0.7',
    visionText: 'OCR: Serial ABC-9931 · card 4111 1111 1111 1111',
    redaction: { count: 3, found: [{ type: 'EMAIL', count: 1 }] },
  };
  const blob = JSON.stringify(buildFeedbackPayload({ helpful: true, result: leaky }));

  for (const secret of ['iVBORw0KGgo', 'hunter2', '123-45-6789', 'admin@acme.com',
                        '10.0.0.7', '4111 1111 1111 1111', 'ABC-9931', 'OCR:']) {
    assert.ok(!blob.includes(secret), `leaked "${secret}" into the feedback payload`);
  }
  // What it DOES carry is only what the user already saw on screen.
  assert.ok(blob.includes('DPC_WATCHDOG_VIOLATION'), 'the visible headline is fair game');
});

test('[5] the diagnosis id itself is content-free and stable in shape', () => {
  const id = newDiagnosisId({ surface: 'forums', kind: 'log', slug: 'printer-spooler', confidence: 22, now: 0 });
  assert.match(id, /^vd\.forums\.log\.printer-spooler\.22\.0$/);
  const dirty = newDiagnosisId({ surface: 'web', kind: 'image', slug: 'a b/c?d=hunter2', confidence: 5, now: 0 });
  assert.ok(!dirty.includes('/') && !dirty.includes('?') && !dirty.includes(' '), 'id is sanitised');
});

// ── 4. HONESTY — "recorded" only when it really was ─────────────────────────────────────
test('[6] sendFeedback reports recorded ONLY on a successful POST', async () => {
  const seen = [];
  const okFetch = async (url, init) => { seen.push({ url, init }); return { ok: true, status: 200 }; };
  const r = await sendFeedback({ helpful: true, result: MATCHED, surface: 'web', fetchImpl: okFetch });
  assert.equal(r.recorded, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, FEEDBACK_ENDPOINT);
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(JSON.parse(seen[0].init.body).vote, 'up');
});

test('[7] a failing endpoint is NEVER reported as recorded', async () => {
  const bad = await sendFeedback({ helpful: true, result: MATCHED, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(bad.recorded, false);
  assert.equal(bad.reason, 'http-500');

  const thrown = await sendFeedback({ helpful: false, result: MATCHED, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(thrown.recorded, false, 'a network error must not be dressed up as success');
  assert.equal(thrown.reason, 'offline');

  const nothing = await sendFeedback({ helpful: true, result: null, fetchImpl: async () => ({ ok: true }) });
  assert.equal(nothing.recorded, false);
  assert.equal(nothing.reason, 'nothing-to-send');
});

test('[8] sendFeedback never throws, whatever the transport does', async () => {
  for (const impl of [null, undefined, async () => null, async () => { throw 1; }]) {
    const r = await sendFeedback({ helpful: true, result: MATCHED, fetchImpl: impl });
    assert.equal(typeof r.recorded, 'boolean');
    assert.equal(r.recorded, false);
  }
});

// ── 5. the SHIPPED widget really wires this up (not just the library) ───────────────────
test('[9] the widget posts the vote and does not hard-code a success message', () => {
  for (const f of [WIDGET_WEB, WIDGET_SENTINEL]) {
    const src = read(f);
    assert.ok(src.includes('aria-feedback'), `${f}: widget must target the real endpoint`);
    assert.ok(/postFeedback\s*\(/.test(src), `${f}: widget must actually post`);
    // The old line ASSIGNED the claim unconditionally. Prose mentioning it in a comment is
    // fine; an assignment is not — that is the exact defect being locked shut.
    assert.ok(!/=\s*'Thanks — noted\.'/.test(src),
      `${f}: the old fire-and-forget "noted" assignment must be gone`);
    assert.ok(src.includes('Thanks — recorded.'), `${f}: success wording present`);
    assert.ok(/Couldn\\?'t record that/.test(src), `${f}: honest failure wording present`);
    assert.ok(/r\.recorded/.test(src), `${f}: wording must branch on the ACTUAL outcome`);
    assert.ok(src.includes('opts.onFeedback'),
      `${f}: the host's own onFeedback hook must survive (Rule 15 — additive only)`);
  }
});

test('[10] the two widget copies stay byte-identical', () => {
  assert.equal(read(WIDGET_WEB), read(WIDGET_SENTINEL),
    'the Sentinel vendor copy drifted from assets/ — re-copy it');
});

test('[11] the widget never puts image bytes or raw input into the vote', () => {
  const src = read(WIDGET_WEB);
  const fn = src.slice(src.indexOf('function feedbackPayload'), src.indexOf('function safeKey'));
  for (const banned of ['imageBase64', 'visionText', 'res.text', 'redaction']) {
    assert.ok(!fn.includes(banned), `widget payload builder touches "${banned}"`);
  }
});

// ── 6. the SERVER hands the widget what it needs ────────────────────────────────────────
test('[12] the handler issues a diagnosisId + feedback endpoint on BOTH answer paths', () => {
  const src = read(HANDLER);
  assert.ok(src.includes("from './lib/vision-feedback.mjs'"), 'handler imports the shared module');
  const ids = src.match(/diagnosisId: newDiagnosisId\(/g) || [];
  assert.equal(ids.length, 2, 'both the matched and the abstain response carry an id');
  const eps = src.match(/feedbackEndpoint: FEEDBACK_ENDPOINT/g) || [];
  assert.equal(eps.length, 2, 'both responses tell the widget where to send the vote');
  assert.ok(src.includes("feedbackPrompt: 'Did this point you somewhere useful?'"),
    'the abstain path asks its own honest question');
});

test('[13] the endpoint constant matches the function that actually exists', () => {
  assert.equal(FEEDBACK_ENDPOINT, '/.netlify/functions/aria-feedback');
  const fn = read('netlify/functions/aria-feedback.js');
  assert.ok(fn.includes("['up', 'down'].includes(vote)"), 'contract check: vote vocabulary');
  for (const field of ['msg_id', 'intent', 'text', 'comment']) {
    assert.ok(fn.includes(field), `aria-feedback reads "${field}" — our payload supplies it`);
  }
});
