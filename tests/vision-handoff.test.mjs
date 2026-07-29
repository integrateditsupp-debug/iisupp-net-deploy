// vision-handoff.test.mjs — the abstain handoff: does the evidence actually travel, and does
// nothing travel that shouldn't?
//   node tests/vision-handoff.test.mjs
//
// What these tests are really defending:
//   • Rule 14 — a draft never claims a diagnosis, never invents a title, and never says a ticket
//     exists without an id.
//   • Privacy — a handoff crosses into a PUBLIC forum or an IIS inbox, so image bytes, base64
//     blobs, control bytes and PII must not be in it. Asserted against a deliberately poisoned
//     input, not against a clean one.
//   • No silent sending — the client files contain no auto-post path.
//   • Rule 15 — nothing that existed before was removed or renamed.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildHandoff, escalationPayload, escalationRequest, encodeHandoff, decodeHandoff,
  deriveTitle, derivePriority, deriveTags, clean, isUnsafeForHandoff,
  HANDOFF_STORAGE_KEY, HANDOFF_TTL_MS, FORUMS_COMPOSE_URL, ESCALATE_URL,
} from '../netlify/functions/lib/vision-handoff.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, '..', ...p), 'utf8');

let pass = 0, fail = 0;
const t = (label, fn) => {
  try { fn(); pass++; console.log('  ✓ ' + label); }
  catch (e) { fail++; console.log('  ✗ ' + label + '\n      ' + e.message); }
};

// A realistic abstain: a log that triaged cleanly but matched nothing in the KB.
const LOG_ABSTAIN = {
  ok: true, abstain: true, diagnosis: null, reason: 'no-match',
  kind: 'log', surface: 'web', os: 'windows',
  logTriage: {
    ok: true, format: 'windows-event-csv', hasFindings: true, totalLines: 412, truncated: false,
    counts: { critical: 1, error: 42, warning: 3 },
    findings: [
      { severity: 'critical', count: 1, firstLine: 390, line: 'The system has rebooted without cleanly shutting down first. BugcheckCode 154' },
      { severity: 'error', count: 42, firstLine: 12, line: 'The print spooler failed to load a plug-in module, error code 0x7e.' },
    ],
  },
  signals: { errors: ['0x7e'], apps: ['print spooler'], providers: ['PrintService'] },
  redaction: { count: 2, found: [{ type: 'EMAIL', count: 1 }, { type: 'PHONE', count: 1 }] },
  closest: { title: 'Printer not printing / job stuck in queue', url: '/kb/l1-printer-001' },
};

console.log('[vision-handoff] the abstain actually reaches a human');

// ── 1. the evidence travels ──────────────────────────────────────────────────────
t('[1] a log abstain produces a draft that carries the verbatim failure lines', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log', surface: 'web', os: 'windows' }, { target: 'forums' });
  assert.equal(h.ok, true, 'draft should build');
  assert.ok(h.body.includes('The print spooler failed to load a plug-in module, error code 0x7e.'),
    'the error line the user actually has must be in the draft');
  assert.ok(h.body.includes('BugcheckCode 154'), 'the critical line must be in the draft');
  assert.ok(h.body.includes('x42'), 'the real repeat count must travel — 42 repeats is the finding');
  assert.ok(h.body.includes('line 12') && h.body.includes('line 390'), 'real line numbers must travel');
  assert.ok(h.body.includes('1 critical, 42 error, 3 warning'), 'the real counts must travel');
  assert.ok(h.body.includes('412'), 'the real total line count must travel');
});

t('[2] the closest KB article is labelled unconfirmed, never presented as the answer', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log' }, { target: 'forums' });
  assert.ok(/not confirmed/i.test(h.body), 'must say it is not confirmed');
  assert.ok(h.body.includes('Printer not printing / job stuck in queue'), 'the candidate must still be named');
  // The words a diagnosis would use must NOT appear as a claim.
  assert.ok(!/\bthe fix is\b|\bdiagnosis:\s*\w/i.test(h.body), 'a draft must not assert a fix');
  assert.ok(/ABSTAIN|would not guess|not confident|handed this over/i.test(h.body),
    'the draft must say ARIA declined');
});

t('[3] the abstain reason is rendered in plain English, and an unknown reason is not smoothed over', () => {
  for (const [reason, needle] of [
    ['log-no-failure-lines', 'no error, critical or warning entries'],
    ['log-binary-not-text', 'could not read that log as text'],
    ['no-vision-model', 'not enabled'],
    ['vision-failed', 'could not make out'],
  ]) {
    const h = buildHandoff({ ...LOG_ABSTAIN, reason }, { kind: 'log' }, { target: 'forums' });
    assert.ok(h.body.includes(needle), reason + ' should read as "' + needle + '"');
  }
  const odd = buildHandoff({ ...LOG_ABSTAIN, reason: 'brand-new-engine-state' }, { kind: 'log' }, { target: 'forums' });
  assert.ok(odd.body.includes('brand-new-engine-state'),
    'an unmapped reason must appear verbatim rather than be replaced by a generic sentence');
});

// ── 2. Rule 14 — no invention ────────────────────────────────────────────────────
t('[4] no real evidence → no draft at all (a hollow post is worse than none)', () => {
  const bare = buildHandoff({ ok: true, abstain: true, reason: 'no-vision-model', kind: 'image', signals: {} },
    { kind: 'image', surface: 'sentinel' }, { target: 'forums' });
  assert.equal(bare.ok, false, 'an unreadable image with no signals must not produce a draft');
  assert.equal(bare.reason, 'no-evidence');
  assert.equal(bare.body, '');
  assert.equal(buildHandoff(null).ok, false, 'no result at all → no draft');
});

t('[5] a title is only claimed when it came from evidence', () => {
  const fromLog = deriveTitle(LOG_ABSTAIN);
  assert.equal(fromLog.from, 'log-finding');
  assert.equal(fromLog.title, 'The system has rebooted without cleanly shutting down first. BugcheckCode 154');

  const fromSignal = deriveTitle({ signals: { errors: ['0x8004010F'], apps: ['Outlook'] } });
  assert.equal(fromSignal.from, 'signal');
  assert.ok(fromSignal.title.includes('0x8004010F') && /outlook/i.test(fromSignal.title));

  // The user's own words outrank our own unsure guess.
  const both = deriveTitle({ closest: { title: 'Some KB article' }, _userText: 'Excel freezes when I open any file' });
  assert.equal(both.from, 'user-text', "the user's own description must win over a KB guess");

  const guess = deriveTitle({ closest: { title: 'Printer not printing' } });
  assert.equal(guess.from, 'closest-kb');
  assert.ok(/was not sure/i.test(guess.title), 'a KB-derived title must be phrased as a question, not a finding');

  const none = deriveTitle({ signals: {} });
  assert.equal(none.evidence, false);
  assert.equal(none.title, '', 'no evidence must mean no title — not a plausible-sounding one');
});

t('[6] a CLEAN log gets a draft but no title — its first line is routine noise, not a symptom', () => {
  const cleanLog = {
    ok: true, abstain: true, reason: 'log-no-failure-lines', kind: 'log', surface: 'web', os: 'windows',
    logTriage: { ok: true, hasFindings: false, totalLines: 2, counts: { critical: 0, error: 0, warning: 0 },
      summary: 'Scanned 2 lines and found no error, critical or warning entries.' },
    signals: {},
  };
  const firstLine = 'Information,7/28/2026,SCM,7036,The Print Spooler service entered the running state.';
  const h = buildHandoff(cleanLog, { kind: 'log', text: firstLine + '\nInformation,ok again' }, { target: 'forums' });
  assert.equal(h.ok, true, 'the honest "your log is clean" finding is still worth a discussion');
  assert.equal(h.titleFromEvidence, false, 'there is no symptom, so there is no title');
  assert.equal(h.title, '');
  assert.ok(!h.body.includes('entered the running state'),
    'a log’s contents are not "what I described" and must not be quoted wholesale into a public post');
  assert.ok(h.body.includes('no error, critical or warning entries'), 'the honest finding must be there');
});

t('[7] priority is conservative — only a real critical earns high, and never critical', () => {
  assert.equal(derivePriority(LOG_ABSTAIN), 'high', 'a real critical log entry earns high');
  assert.equal(derivePriority({ logTriage: { counts: { critical: 0, error: 99 } } }), 'normal',
    '99 errors and no critical is still normal — volume is not severity');
  assert.equal(derivePriority({}), 'normal');
  for (const res of [LOG_ABSTAIN, {}, { logTriage: { counts: { critical: 7 } } }]) {
    assert.notEqual(derivePriority(res), 'critical', 'critical is a human decision, never automatic');
  }
});

// ── 3. privacy — the strictest text path in Stage 2 ──────────────────────────────
t('[8] a poisoned abstain leaks nothing: no image bytes, no secrets, no PII', () => {
  const poison = {
    ok: true, abstain: true, reason: 'no-match', kind: 'log', surface: 'web', os: 'windows',
    logTriage: {
      ok: true, hasFindings: true, totalLines: 3, counts: { critical: 0, error: 1, warning: 0 },
      findings: [{
        severity: 'error', count: 1, firstLine: 2,
        line: 'auth failed for jane.doe@acme.com password=hunter2 SSN 123-45-6789 card 4111111111111111 host 10.9.9.9 phone 416-555-0199',
      }],
    },
    signals: { apps: ['data:image/png;base64,' + 'A'.repeat(400)], errors: ['B'.repeat(300)] },
    closest: { title: 'Login fails', url: '/kb/login' },
  };
  const h = buildHandoff(poison, { kind: 'log' }, { target: 'escalate' });
  const wire = JSON.stringify(h);
  for (const secret of ['jane.doe@acme.com', 'hunter2', '123-45-6789', '4111111111111111', '416-555-0199']) {
    assert.ok(!wire.includes(secret), 'must not carry ' + secret);
  }
  assert.ok(!/data:image\/[a-z]+;base64,/.test(wire), 'must not carry an image data URL');
  assert.ok(!/[A-Za-z0-9+/]{200,}/.test(wire), 'must not carry a base64 blob');
  assert.ok(wire.includes('REDACTED'), 'redaction must be visible, not silent');
});

t('[9] image bytes can never enter a draft — the builder does not read them', () => {
  const src = read('netlify', 'functions', 'lib', 'vision-handoff.mjs');
  for (const field of ['imageBase64', 'mediaType', 'sendBase64', 'redactRegions']) {
    assert.ok(!src.includes(field), 'the handoff builder must not reference ' + field);
  }
  // and prove it behaviourally: an image kind ignores `text` entirely
  const h = buildHandoff({ ...LOG_ABSTAIN, kind: 'image' },
    { kind: 'image', text: 'data:image/png;base64,' + 'Z'.repeat(500) }, { target: 'forums' });
  assert.ok(!h.body.includes('base64'), 'nothing image-shaped may reach the body');
});

t('[10] control bytes and blobs are refused on the way in AND on the way out', () => {
  assert.equal(isUnsafeForHandoff('hello world'), false);
  assert.equal(isUnsafeForHandoff('a b'), true, 'NUL is unsafe');
  assert.equal(isUnsafeForHandoff('a�b'), true, 'a replacement char means we read binary');
  assert.equal(isUnsafeForHandoff('data:image/png;base64,AAA'), true);
  assert.equal(isUnsafeForHandoff('Q'.repeat(250)), true);
  // called twice on the same input, the answer must not change (a /g regex would drift)
  assert.equal(isUnsafeForHandoff('a b'), isUnsafeForHandoff('a b'));
  assert.equal(clean('a b'), 'a b', 'control bytes are stripped, not preserved');
});

t('[11] the transfer envelope rejects stale, malformed and unsafe drafts', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log' }, { target: 'forums' });
  const raw = encodeHandoff(h);
  assert.ok(decodeHandoff(raw), 'a fresh envelope decodes');
  assert.equal(decodeHandoff(raw, Date.now() + HANDOFF_TTL_MS + 1000), null, 'an expired draft is dropped');
  assert.equal(decodeHandoff('{"v":2,"at":' + Date.now() + ',"handoff":{"ok":true,"body":"x"}}'), null, 'wrong version dropped');
  assert.equal(decodeHandoff('not json'), null);
  assert.equal(decodeHandoff(''), null);
  assert.equal(decodeHandoff(null), null);
  assert.equal(decodeHandoff(JSON.stringify({ v: 1, at: Date.now(), handoff: { ok: true, body: 'x'.repeat(5) + ' ' } })), null,
    'a draft that picked up a control byte in storage is dropped');
  assert.equal(decodeHandoff(JSON.stringify({ v: 1, at: Date.now() + 5 * 60000, handoff: { ok: true, body: 'x' } })), null,
    'a future-dated draft is dropped');
});

// ── 4. the escalation payload matches the EXISTING endpoint ──────────────────────
t('[12] the payload fits aria-escalation?action=escalate — no new endpoint invented', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log' }, { target: 'escalate' });
  const p = escalationPayload(h, { userEmail: 'bob@acme.co', userName: 'Bob', sessionId: 's_1' });
  assert.equal(p.ok, true);
  assert.equal(p.endpoint, '/.netlify/functions/aria-escalation?action=escalate');
  const fn = read('netlify', 'functions', 'aria-escalation.mjs');
  for (const field of Object.keys(p.body)) {
    assert.ok(fn.includes('b.' + field), 'aria-escalation must actually read `' + field + '`');
  }
  assert.ok(['normal', 'high'].includes(p.body.priority));
});

t('[13] ariaFindings is a STRING — the endpoint interpolates it into an email', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log' }, { target: 'escalate' });
  const p = escalationPayload(h, { userEmail: 'bob@acme.co' });
  assert.equal(typeof p.body.ariaFindings, 'string',
    'an object would arrive in the technician email as "[object Object]"');
  assert.ok(/ABSTAIN/i.test(p.body.ariaFindings), 'it must open by saying ARIA did not diagnose');
  assert.ok(p.body.ariaFindings.includes('0x7e'), 'the evidence must be inside it');
  const fn = read('netlify', 'functions', 'aria-escalation.mjs');
  assert.ok(fn.includes('${ariaFindings'), 'this test exists because the endpoint string-interpolates the field');
});

t('[14] a reply address is required, and is NOT redacted away', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log' }, { target: 'escalate' });
  assert.equal(escalationPayload(h, {}).reason, 'email-required');
  assert.equal(escalationPayload(h, { userEmail: 'nope' }).reason, 'email-required');
  assert.equal(escalationPayload(h, { userEmail: '' }).reason, 'email-required');
  const good = escalationPayload(h, { userEmail: '  Bob@Acme.co  ' });
  assert.equal(good.ok, true);
  assert.equal(good.body.userEmail, 'Bob@Acme.co',
    'the deliberate reply address must survive intact — running it through the PII redactor once ' +
    'broke every escalation, and this is the assertion that keeps it fixed');
  assert.equal(escalationPayload({ ok: false }, { userEmail: 'a@b.co' }).reason, 'no-handoff');
});

t('[15] escalationRequest hands the client everything except the email', () => {
  const h = buildHandoff(LOG_ABSTAIN, { kind: 'log' }, { target: 'escalate' });
  const r = escalationRequest(h);
  assert.equal(r.ok, true);
  assert.equal(r.body.userEmail, null, 'the browser fills this one field');
  assert.equal(r.needsEmail, true);
  assert.ok(r.body.issue && r.body.issue.length > 4, 'the subject is composed server-side');
  assert.ok(typeof r.body.ariaFindings === 'string' && r.body.ariaFindings.length > 20);
});

t('[16] tags come from real extracted values only', () => {
  assert.deepEqual(deriveTags(LOG_ABSTAIN, 'log'), ['log', 'print-spooler', '0x7e']);
  assert.deepEqual(deriveTags({}, 'image'), ['screenshot']);
  assert.deepEqual(deriveTags({}, 'text'), [], 'no signals means no tags — not a guessed category');
  assert.ok(deriveTags({ signals: { apps: ['a', 'b', 'c', 'd', 'e', 'f'] } }, 'log').length <= 5, 'capped');
});

// ── 5. the client does not send, and does not compose ────────────────────────────
const HANDOFF_JS = read('assets', 'aria-vision-handoff.js');
const ESCALATE_JS = read('assets', 'aria-vision-escalate.js');
const WIDGET_JS = read('assets', 'aria-vision-diagnose.js');
const VENDOR_JS = read('ARIA Sentinel', 'src', 'renderer', 'vendor', 'aria-vision-diagnose.js');
const VENDOR_HANDOFF_JS = read('ARIA Sentinel', 'src', 'renderer', 'vendor', 'aria-vision-handoff.js');
const FORUMS_JS = read('assets', 'forums.js');

t('[17] the transfer helper makes no network calls at all', () => {
  for (const bad of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'import(']) {
    assert.ok(!HANDOFF_JS.includes(bad), 'aria-vision-handoff.js must not contain ' + bad);
  }
});

t('[18] the client composes no draft text — wording lives server-side only', () => {
  for (const phrase of ['What I gave ARIA', 'Why ARIA handed this over', 'What ARIA read in the log',
                        'Closest thing ARIA found', 'Private details were removed']) {
    assert.ok(!HANDOFF_JS.includes(phrase), 'transfer helper must not compose: ' + phrase);
    assert.ok(!WIDGET_JS.includes(phrase), 'widget must not compose: ' + phrase);
    assert.ok(!FORUMS_JS.includes(phrase), 'forums must not compose: ' + phrase);
  }
});

t('[19] the draft is consumed once and cleared, never left sitting in storage', () => {
  assert.ok(/function take\(\)[\s\S]{0,400}removeItem/.test(HANDOFF_JS),
    'take() must remove the item as it reads it');
  assert.ok(HANDOFF_JS.includes("var KEY = 'aria_vision_handoff'"), 'key must match the server constant');
  assert.equal(HANDOFF_STORAGE_KEY, 'aria_vision_handoff');
  assert.ok(HANDOFF_JS.includes('30 * 60 * 1000'), 'TTL must match the server constant');
});

t('[20] the URL is never used to carry the draft', () => {
  for (const src of [HANDOFF_JS, WIDGET_JS, ESCALATE_JS]) {
    assert.ok(!/searchParams\.set|encodeURIComponent\((?:draft|handoff|body)/.test(src),
      'a draft must never be put into a querystring');
  }
  assert.ok(HANDOFF_JS.includes('sessionStorage'), 'transfer is same-origin sessionStorage');
});

t('[21] escalation claims nothing without a real ticket id from the endpoint', () => {
  assert.ok(/!ticket\s*\|\|\s*!ticket\.id/.test(ESCALATE_JS),
    'a missing id must be treated as a failure');
  assert.ok(/nothing was sent/i.test(ESCALATE_JS), 'a failure must say nothing was sent');
  assert.ok(/ticket\.etaSeconds/.test(ESCALATE_JS) && /if \(ticket\.etaSeconds\)/.test(ESCALATE_JS),
    'the ETA line must be omitted when the endpoint did not give one');
  // The confirmation must not be reachable without going through the id check.
  const showIdx = ESCALATE_JS.indexOf('showSent(wrap, ticket, mail)');
  const guardIdx = ESCALATE_JS.indexOf('!ticket.id');
  assert.ok(guardIdx > -1 && showIdx > guardIdx, 'the guard must precede the confirmation');
});

t('[22] the escalate panel sends only on an explicit click', () => {
  assert.ok(/send\.addEventListener\('click'/.test(ESCALATE_JS), 'send is click-driven');
  const beforeClick = ESCALATE_JS.slice(0, ESCALATE_JS.indexOf("send.addEventListener('click'"));
  assert.ok(!beforeClick.includes('fetch('), 'nothing may POST before the user clicks');
  assert.ok(/params\.get\('escalate'\) !== '1'/.test(ESCALATE_JS), 'it only activates on ?escalate=1');
});

t('[23] the forums prefill opens a DRAFT and never posts it', () => {
  assert.ok(FORUMS_JS.includes('function applyVisionHandoff'), 'the prefill exists');
  // Slice exactly the function, to its closing brace at column 0 — a fixed character window
  // overran into the real (untouched) create handler further down the file and failed on ITS code.
  const fnStart = FORUMS_JS.indexOf('function applyVisionHandoff');
  const fnEnd = FORUMS_JS.indexOf('\n}', fnStart);
  assert.ok(fnEnd > fnStart, 'the function must be delimited');
  const fnBody = FORUMS_JS.slice(fnStart, fnEnd);
  assert.ok(!/op:\s*"create"/.test(fnBody), 'the prefill must not call the create op');
  assert.ok(!/requestSubmit|\.submit\(\)/.test(fnBody), 'the prefill must not submit the form');
  assert.ok(/#ctTitle"\)\.value|#ctBody"\)\.value/.test(fnBody), 'it fills the existing composer fields');
  assert.ok(/nothing has been posted/i.test(fnBody), 'it must tell the user nothing was posted');
});

t('[24] a title ARIA could not derive is left blank in the UI, and the user is asked for one', () => {
  assert.ok(/titleFromEvidence/.test(FORUMS_JS), 'forums must branch on titleFromEvidence');
  assert.ok(/titleFromEvidence/.test(ESCALATE_JS), 'the escalate panel must branch on it too');
  assert.ok(/please write one|please describe it/i.test(FORUMS_JS + ESCALATE_JS),
    'the user must be asked for a title rather than given an invented one');
});

// ── 6. Rule 15 — additive only ───────────────────────────────────────────────────
t('[25] nothing pre-existing was removed', () => {
  assert.ok(WIDGET_JS.includes('opts.onFeedback'), 'the feedback hook is still there');
  assert.ok(WIDGET_JS.includes('opts.onFix'), 'the fix hook is still there');
  assert.ok(WIDGET_JS.includes('reportResolved'), 'the B5 resolve tie-in is still there');
  const handlerSrc = read('netlify', 'functions', 'aria-vision-diagnose.mjs');
  assert.ok(handlerSrc.includes("action: 'type-error'"), 'the "type the exact error text" option is still offered');
  assert.ok(handlerSrc.includes("action: 'open-discussion'") && handlerSrc.includes("action: 'escalate'"),
    'both original fallback options are still offered');
  assert.ok(FORUMS_JS.includes('op: "create"'), 'the real forums create path is untouched');
  assert.ok(FORUMS_JS.includes('#newThreadBtn'), 'the manual "start a discussion" button is untouched');
});

t('[26] the widget still honours a host that wants to handle the fallback itself', () => {
  assert.ok(/opts\.onFallback\(o, res, draft\)/.test(WIDGET_JS),
    'the host hook must still fire, and now receives the draft');
  assert.ok(/handled === true/.test(WIDGET_JS),
    'a host returning true must suppress navigation (Sentinel has no site nav)');
});

t('[27] the Sentinel vendor copies are byte-identical to the web copies', () => {
  assert.equal(VENDOR_JS, WIDGET_JS, 'aria-vision-diagnose.js must not fork');
  assert.equal(VENDOR_HANDOFF_JS, HANDOFF_JS, 'aria-vision-handoff.js must not fork');
});

t('[28] every surface loads the transfer helper BEFORE the widget', () => {
  const pages = [
    ['aria.html', '/assets/aria-vision-handoff.js', '/assets/aria-vision-diagnose.js'],
    ['forums/index.html', '/assets/aria-vision-handoff.js', '/assets/aria-vision-diagnose.js'],
    [join('ARIA Sentinel', 'src', 'renderer', 'index.html'), './vendor/aria-vision-handoff.js', './vendor/aria-vision-diagnose.js'],
  ];
  for (const [page, helper, widget] of pages) {
    const html = read(page);
    const h = html.indexOf(helper), w = html.indexOf(widget);
    assert.ok(h > -1, page + ' must load ' + helper);
    assert.ok(w > -1, page + ' must load ' + widget);
    assert.ok(h < w, page + ' must load the helper before the widget');
  }
  const aria = read('aria.html');
  assert.ok(aria.includes('/assets/aria-vision-escalate.js'), 'aria.html must load the escalate panel');
});

// ── 7. the handler actually attaches the drafts ──────────────────────────────────
t('[29] the handler routes every abstain through one place and links the real destinations', () => {
  const fn = read('netlify', 'functions', 'aria-vision-diagnose.mjs');
  assert.ok(fn.includes('const abstainResp ='), 'one attach point');
  assert.ok(fn.includes("href: FORUMS_COMPOSE_URL"), 'the discussion option points at the compose URL');
  assert.ok(fn.includes("href: ESCALATE_URL"), 'the escalate option points at the escalate URL');
  assert.equal(FORUMS_COMPOSE_URL, '/forums?compose=vision#discussions');
  assert.equal(ESCALATE_URL, '/aria?escalate=1');
  // No abstain path may still return through the bare `resp` with a fallback attached.
  const bareAbstains = fn.match(/return resp\((?:200|413|429), \{\s*(?:\.\.\.base, )?ok: (?:true|false)[\s\S]{0,600}?honestFallback/g) || [];
  assert.equal(bareAbstains.length, 0, 'every fallback-bearing return must go through abstainResp');
});

console.log('\n' + (fail === 0
  ? '  ALL ' + pass + ' HANDOFF ASSERTIONS PASSED ✅'
  : '  ' + pass + ' passed, ' + fail + ' FAILED ❌'));
process.exit(fail === 0 ? 0 : 1);
