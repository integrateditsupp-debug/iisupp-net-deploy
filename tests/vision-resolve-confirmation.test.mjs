// vision-resolve-confirmation.test.mjs — STAGE 2 · the B5 "resolved · email sent · ticket ref" tie-in.
// ----------------------------------------------------------------------------------------------
// The spec requires the one-click Fix to end in the existing gated resolve flow AND surface the
// B5 confirmation. Rule 14 is the whole point of this file: the vision surface must be INCAPABLE
// of announcing a fix that did not really happen. It may not mint a ticket ref, may not decide an
// email was sent, and may not write the sentence itself — that all belongs to the shared builder.
//
// We load both real files into one minimal DOM-ish sandbox (no deps) and drive the public API.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };

// ── the smallest DOM that both files need ────────────────────────────────────────────────────
function makeNode(tag = 'div') {
  const n = {
    tagName: String(tag).toUpperCase(), children: [], style: { cssText: '', opacity: '' },
    attrs: {}, _text: '', className: '', id: '',
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener() {}, removeEventListener() {}, focus() {}, click() {},
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html || ''; },
    set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; },
  };
  return n;
}
// all text rendered anywhere under a node (what the user would actually see)
function visibleText(node) {
  let t = node._text || '';
  for (const c of node.children) t += ' ' + visibleText(c);
  return t.trim();
}

function loadSandbox() {
  const doc = makeNode('body');
  doc.createElement = (t) => makeNode(t);
  doc.getElementById = () => null;
  doc.head = makeNode('head');
  doc.body = makeNode('body');
  doc.addEventListener = () => {};
  doc.readyState = 'complete';

  const win = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
  const ctx = vm.createContext({
    window: win, document: doc, console,
    setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: null,
    navigator: { platform: 'Win32', userAgent: 'node' }, location: { href: '' },
    FileReader: function () {}, fetch: async () => ({ ok: true, json: async () => ({}) }),
  });
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.runInContext(read('assets/aria-globe-confirmation.js'), ctx);   // the shared B5 builder
  vm.runInContext(read('assets/aria-vision-diagnose.js'), ctx);      // the vision widget
  return ctx;
}

function mountWidget(ctx) {
  const zone = makeNode('div');
  const api = ctx.window.ARIAVisionDiagnose.mount(zone, {
    surface: 'web', endpoint: '/.netlify/functions/aria-vision-diagnose', os: 'windows',
  });
  return { zone, api };
}

const REAL = { completed: true, verified: true, issueTitle: 'DNS', ticketRef: 'IIS-20260701-0001',
               email: { attempted: true, sent: true } };

test('[1] the widget exposes the resolve tie-in', () => {
  console.log('# [1] API');
  const ctx = loadSandbox();
  ok(typeof ctx.window.ariaGlobeConfirmation?.build === 'function', 'shared B5 builder loaded');
  const { api } = mountWidget(ctx);
  ok(typeof api.reportResolved === 'function', 'mount() returns reportResolved()');
});

test('[2] NOTHING is announced without a real, verified resolve (Rule 14)', () => {
  console.log('# [2] real-or-empty');
  const ctx = loadSandbox();
  const { zone, api } = mountWidget(ctx);

  const cases = [
    ['no detail at all', undefined],
    ['completed but NOT verified', { completed: true, verified: false, issueTitle: 'DNS', ticketRef: 'IIS-1' }],
    ['verified but NOT completed', { completed: false, verified: true, issueTitle: 'DNS', ticketRef: 'IIS-1' }],
    ['user merely clicked Fix', { issueTitle: 'DNS', ticketRef: 'IIS-1' }],
  ];
  for (const [label, detail] of cases) {
    const r = api.reportResolved(detail);
    ok(r.show === false, `${label} → show:false`);
  }
  ok(!/resolved/i.test(visibleText(zone)), 'nothing resolution-flavoured was rendered');
});

test('[3] a ticket ref is NEVER invented', () => {
  console.log('# [3] ticket ref pass-through only');
  const ctx = loadSandbox();
  const { zone, api } = mountWidget(ctx);
  for (const [label, ref] of [['missing', undefined], ['empty', ''], ['blank', '   ']]) {
    const r = api.reportResolved({ ...REAL, ticketRef: ref });
    ok(r.show === false, `${label} ticket ref → show:false (never minted)`);
  }
  ok(!/IIS-|INC\d/.test(visibleText(zone)), 'no ticket-shaped string ever appeared on screen');

  const src = read('assets/aria-vision-diagnose.js');
  ok(!/IIS-\d|INC00|Math\.random|Date\.now\(\)[^)]*ticket/i.test(src),
     'widget source contains no ticket-ref minting');
});

test('[4] on a REAL verified resolve the shared B5 sentence is shown', () => {
  console.log('# [4] the happy path');
  const ctx = loadSandbox();
  const { zone, api } = mountWidget(ctx);
  const r = api.reportResolved(REAL);
  ok(r.show === true, 'real verified resolve → show:true');
  ok(r.ticketRef === 'IIS-20260701-0001', 'carries the REAL ticket ref it was given');

  // identical to what the rest of ARIA shows — proves no wording fork
  const expected = ctx.window.ariaGlobeConfirmation.build(
    { kbResolved: true, issueTitle: 'DNS', ticketRef: 'IIS-20260701-0001',
      email: { attempted: true, sent: true } }, {}).text;
  ok(r.text === expected, 'text is byte-identical to the shared B5 builder (no fork)');
  ok(/resolved/i.test(r.text) && r.text.includes('IIS-20260701-0001'), 'sentence names the real ticket');
  ok(visibleText(zone).includes(r.text), 'the confirmation is actually rendered into the widget');
});

test('[5] email is never claimed as sent unless it really was', () => {
  console.log('# [5] honest email state');
  const ctx = loadSandbox();
  const { api } = mountWidget(ctx);

  const notSent = api.reportResolved({ ...REAL, email: { attempted: true, sent: false } });
  ok(notSent.show === true, 'a real resolve still confirms when the email did not send');
  ok(notSent.email.sent === false, 'email.sent stays false');
  ok(!/email has been sent/i.test(notSent.text), 'copy does NOT claim the email was sent');

  const sent = api.reportResolved(REAL);
  ok(sent.email.sent === true && /email has been sent/i.test(sent.text),
     'a genuinely sent email IS reported as sent');
});

test('[6] the widget never writes the sentence itself', () => {
  console.log('# [6] no wording fork');
  const src = read('assets/aria-vision-diagnose.js');
  ok(!/has been resolved/i.test(src), 'no hard-coded resolution sentence in the widget');
  ok(!/email has been sent/i.test(src), 'no hard-coded email sentence in the widget');
  ok(src.includes('ariaGlobeConfirmation'), 'it delegates to the shared B5 builder');

  // builder absent → silence, not an improvised message
  const ctx = loadSandbox();
  delete ctx.window.ariaGlobeConfirmation;
  const { zone, api } = mountWidget(ctx);
  const r = api.reportResolved(REAL);
  ok(r.show === false && r.reason === 'confirmation-unavailable',
     'no shared builder → stays silent instead of inventing wording');
  ok(!/resolved/i.test(visibleText(zone)), 'nothing rendered');
});

test('[7] the fix bridge declares the contract instead of a dead template', async () => {
  console.log('# [7] fix-link contract');
  const src = read('netlify/functions/lib/vision-fix-link.mjs');
  ok(!src.includes('resolvedMessageTemplate'), 'the never-rendered template string is gone');
  ok(src.includes('resolvedConfirmation'), 'a real contract is declared instead');

  const { matchFix } = await import('../netlify/functions/lib/vision-fix-link.mjs');
  const RECIPES = [{ id: 'dns-flush', title: 'Flush DNS', category: 'network', os: ['windows'],
                     riskOverall: 'yellow', matchKeywords: ['dns'], fixSteps: [{ id: 's1' }] }];
  const fix = matchFix('dns not resolving', 'windows', RECIPES);
  ok(fix && fix.recipeId === 'dns-flush', 'still matches a recipe');
  ok(fix.resolvedConfirmation.neverFabricated === true, 'contract marks the confirmation non-fabricable');
  ok(fix.resolvedConfirmation.requires.includes('ticketRef'), 'contract requires a real ticket ref');
  ok(fix.resolvedConfirmation.requires.includes('verified'), 'contract requires verification');
});

test('[8] Sentinel vendored widget has not drifted', () => {
  console.log('# [8] no drift');
  ok(read('ARIA Sentinel/src/renderer/vendor/aria-vision-diagnose.js') === read('assets/aria-vision-diagnose.js'),
     'Sentinel copy is byte-identical (reportResolved shipped to the desktop too)');
});

// Honest summary (Rule 14): only claim a pass when the process is actually exiting clean.
process.on('exit', (code) => {
  if (code === 0) console.log(`\nALL ${passed} RESOLVE-CONFIRMATION ASSERTIONS PASSED ✅`);
  else console.log(`\n✗ RESOLVE-CONFIRMATION SUITE FAILED (${passed} assertions passed before the failure)`);
});
