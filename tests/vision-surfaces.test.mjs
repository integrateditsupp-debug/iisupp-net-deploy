// vision-surfaces.test.mjs — STAGE 2 · the three surfaces + the Sentinel consent gate.
// ------------------------------------------------------------------------------------
// The engine itself is covered by vision-diagnose.test.mjs / vision-diagnose-handler.test.mjs.
// THIS file guards the things that break when someone edits a page: is the widget actually
// mounted on each surface, is the placeholder copy gone, can a screen capture ever happen
// without a fresh explicit yes, and have the two copies of the widget drifted apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const WIDGET_WEB = 'assets/aria-vision-diagnose.js';
const WIDGET_SENTINEL = 'ARIA Sentinel/src/renderer/vendor/aria-vision-diagnose.js';

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };

test('[1] the shared widget is the single source of truth', () => {
  console.log('# [1] one widget, no forks');
  const web = read(WIDGET_WEB);
  ok(web.includes('ARIAVisionDiagnose'), 'web widget exports ARIAVisionDiagnose');
  ok(fs.existsSync(path.join(ROOT, WIDGET_SENTINEL)), 'Sentinel ships a vendored copy');
  ok(read(WIDGET_SENTINEL) === web, 'Sentinel copy is byte-identical to the web widget (no drift)');
  ok(web.includes('captureScreenWithConsent'), 'widget asks the host for a CONSENTED capture, never captures itself');
});

test('[2] surface 1 — ARIA web ask bar', () => {
  console.log('# [2] ARIA web');
  const h = read('aria.html');
  ok(h.includes('src="/assets/aria-vision-diagnose.js"'), 'aria.html loads the widget');
  ok(h.includes('id="visionPanel"'), 'aria.html has the vision panel');
  ok(h.includes("surface: 'web'"), 'aria.html mounts with surface=web');
  ok(h.includes('ashBuildResolveLink'), 'one-click Fix hands off through the existing gated Sentinel deep link');
  ok(!/onFix[\s\S]{0,400}mode.{0,6}apply/.test(h), 'web never requests apply-mode — the desktop keeps its own confirm step');
  // Rule 15 — the existing ask bar must survive untouched.
  ['id="askInput"', 'id="sendBtn"', 'id="historyToggle"', 'id="newChatBtn"', 'id="historyClear"']
    .forEach((id) => ok(h.includes(id), `existing control preserved: ${id}`));
});

test('[3] surface 2 — Forums Ask-AI', () => {
  console.log('# [3] Forums Ask-AI');
  const html = read('forums/index.html');
  const js = read('assets/forums.js');
  ok(html.includes('src="/assets/aria-vision-diagnose.js"'), 'forums loads the widget');
  ok(html.includes('id="aiDrop"'), 'the Ask-AI drop target still exists');
  ok(js.includes('surface: "forums"'), 'forums.js mounts with surface=forums');
  ok(js.includes('mountVisionDiagnose'), 'forums.js has the mount entry point');
  // The old "not wired yet" stub must be gone from the Ask-AI surface — leaving it would now be a lie.
  ok(!html.includes('Visual diagnosis coming online'), 'placeholder chip removed from Ask-AI');
  ok(!html.includes('visual diagnosis arrives with the Fable'), 'placeholder honesty copy replaced');
  ok(!js.includes("vision engine isn't wired yet"), 'stale "not wired yet" claim removed from forums.js');
  // ...but a dropzone on any OTHER view keeps the honest message rather than silently doing nothing.
  ok(js.includes('visionLive'), 'unclaimed dropzones are skipped, not double-wired');
  ok(js.includes('Visual diagnosis is coming online'), 'non-Ask-AI dropzones keep an honest message');
});

test('[4] surface 3 — Sentinel', () => {
  console.log('# [4] Sentinel');
  const html = read('ARIA Sentinel/src/renderer/index.html');
  const js = read('ARIA Sentinel/src/renderer/renderer.js');
  const preload = read('ARIA Sentinel/src/main/preload.cjs');
  const main = read('ARIA Sentinel/src/main/main.mjs');
  ok(html.includes('id="ariaVisionZone"'), 'Sentinel ARIA tab has the vision zone');
  ok(html.includes('id="ariaVisionCapture"'), 'Sentinel has the "diagnose my current screen" button');
  ok(html.includes('vendor/aria-vision-diagnose.js'), 'Sentinel loads the vendored widget');
  ok(js.includes('surface: "sentinel"'), 'renderer mounts with surface=sentinel');
  ok(preload.includes('captureScreenWithConsent'), 'preload exposes the consent-gated capture');
  ok(preload.includes('sentinel:vision-capture'), 'preload routes capture through IPC to the main process');
  ok(main.includes('ipcMain.handle("sentinel:vision-capture"'), 'main process owns the capture handler');
  // The renderer must NOT be able to reach desktopCapturer on its own.
  ok(!js.includes('desktopCapturer'), 'renderer never touches desktopCapturer directly');
  ok(main.includes('desktopCapturer.getSources'), 'capture happens only in the main process');
  // Rule 15 — the ARIA chat surface it sits next to is untouched.
  ok(html.includes('id="ariaChatForm"') && html.includes('id="ariaChatInput"'), 'existing ARIA chat preserved');
});

test('[5] the consent gate cannot be walked around', async () => {
  console.log('# [5] consent gate');
  const mod = await import(new URL('../ARIA Sentinel/src/shared/vision-capture.mjs'.replace(/ /g, '%20'), import.meta.url));
  const { decideCapture, CONSENT_TTL_MS } = mod;
  const fresh = { screenCapture: true, cloudProcessing: true, ts: Date.now() };

  ok(decideCapture({ consent: fresh }).allowed === true, 'a fresh, complete yes is allowed');
  ok(decideCapture({}).allowed === false, 'no consent object → refused');
  ok(decideCapture({ consent: {} }).allowed === false, 'empty consent → refused');
  ok(decideCapture({ consent: { screenCapture: true, ts: Date.now() } }).allowed === false,
     'screen consent alone is not cloud consent');
  ok(decideCapture({ consent: { cloudProcessing: true, ts: Date.now() } }).allowed === false,
     'cloud consent alone is not screen consent');
  ok(decideCapture({ consent: { screenCapture: 'yes', cloudProcessing: 'yes', ts: Date.now() } }).allowed === false,
     'only a literal true counts — truthy strings are refused');

  // Consent is per-capture, not sticky.
  const stale = { screenCapture: true, cloudProcessing: true, ts: Date.now() - CONSENT_TTL_MS - 1000 };
  ok(decideCapture({ consent: stale }).allowed === false, 'a stale approval does not authorise a new capture');
  ok(decideCapture({ consent: stale }).reason === 'consent-stale', 'stale consent is reported honestly');
  const future = { screenCapture: true, cloudProcessing: true, ts: Date.now() + 10 * 60 * 1000 };
  ok(decideCapture({ consent: future }).allowed === false, 'a future-dated timestamp cannot buy extra validity');

  // Stand-down outranks consent.
  ok(decideCapture({ consent: fresh, agentBlocked: true }).allowed === false,
     'kill-switch / paused refuses capture even with consent');
  ok(decideCapture({ consent: fresh, agentBlocked: true }).reason === 'agent-stood-down', 'stand-down reason is explicit');
  ok(decideCapture({ consent: fresh, captureSupported: false }).allowed === false, 'unsupported platform refuses');

  // Every refusal still tells the user what would happen and what is missing.
  const refused = decideCapture({ consent: {} });
  ok(!!refused.disclosure && !!refused.disclosure.what, 'refusal still carries the disclosure');
  ok(refused.requiresConsent.length === 2, 'refusal names exactly what is missing');
});

test('[6] the privacy story we tell is the one we implement', async () => {
  console.log('# [6] privacy honesty');
  const mod = await import(new URL('../ARIA Sentinel/src/shared/vision-capture.mjs'.replace(/ /g, '%20'), import.meta.url));
  const { CAPTURE_DISCLOSURE, captureDataFlow, captureAuditEntry } = mod;
  const flow = captureDataFlow();
  ok(/unredacted/i.test(CAPTURE_DISCLOSURE.where), 'disclosure admits the image leaves unredacted — no soft-pedalling');
  ok(/unredacted/i.test(flow.sentTo), 'data-flow says the same thing as the dialog');
  ok(/not written to disk/i.test(flow.retention), 'we promise no disk write');
  ok(/cancel|type the error/i.test(CAPTURE_DISCLOSURE.advice), 'the offline alternative is offered at the consent moment');

  const main = read('ARIA Sentinel/src/main/main.mjs');
  ok(!/writeFile[^\n]*thumbnail|thumbnail[^\n]*writeFile/.test(main), 'the captured image is never written to disk');
  ok(main.includes('captureAuditEntry'), 'every capture decision is written to the transparency log');
  const denied = captureAuditEntry({ allowed: false, reason: 'consent-required' });
  ok(denied.consented === false && /refused/i.test(denied.text), 'a refusal is logged as a refusal');
  const allowed = captureAuditEntry({ allowed: true, sourceLabel: 'Screen 1' });
  ok(allowed.consented === true && !/imageBase64|base64/i.test(JSON.stringify(allowed)), 'the audit line carries no image data');

  // A "no" from the dialog must never be upgraded into a yes.
  ok(/approved\s*=\s*false;\s*\/\/ a dialog we cannot show is a "no"/.test(main), 'a failed dialog is treated as refusal');
});

test('[7] the abstain path stays reachable from every surface', () => {
  console.log('# [7] honest abstain');
  const web = read(WIDGET_WEB);
  ok(/Not sure\s*—\s*won\\?'t guess/.test(web), 'widget renders an explicit abstain state');
  ok(web.includes('honestFallback'), 'widget consumes the server honest-fallback options');
  const fn = read('netlify/functions/aria-vision-diagnose.mjs');
  ok(fn.includes('cloud-vision-not-configured'), 'an unconfigured vision model abstains rather than pretending');
  ok(fn.includes('abstain: true'), 'the handler has an abstain path');
});

test('summary', () => {
  console.log('─'.repeat(30));
  console.log(`ALL ${passed} SURFACE/CONSENT ASSERTIONS PASSED ✅`);
});
