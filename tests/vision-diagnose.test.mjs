// vision-diagnose.test.mjs — STAGE 2 acceptance tests (offline, $0, no network).
// Runs the real RUN-A retriever over the real 203-chunk KB + the real recipe library.
//
//   node tests/vision-diagnose.test.mjs
//
// Covers the four spec must-haves:
//   1. known screenshot/log  → correct diagnosis
//   2. low-confidence image  → abstain (NO fabrication, Rule 14)
//   3. PII / secret redaction
//   4. consent gate (Sentinel capture + cloud vision)
// Plus: description builder redacts before querying, and one-click fix never offers red/black.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  redactPII, extractSignals, buildProblemDescription, diagnose, diagnoseInput,
  scoreChunk, confidenceLabel, CONFIDENCE_THRESHOLD,
} from '../netlify/functions/lib/vision-diagnose-core.mjs';
import { evaluateConsent, shouldCallCloudVision } from '../netlify/functions/lib/vision-consent.mjs';
import { matchFix } from '../netlify/functions/lib/vision-fix-link.mjs';
import { RECIPES } from '../netlify/functions/aria-recipes-data.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const KB = JSON.parse(readFileSync(join(__dir, '..', 'assets', 'aria-kb-chunks.json'), 'utf8'));
const CHUNKS = KB.chunks || KB;

let pass = 0;
function ok(label, cond) { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); }
function eq(label, a, b) { assert.equal(a, b, label + ` (got ${JSON.stringify(a)})`); pass++; console.log('  ✓ ' + label); }

console.log('KB chunks loaded:', CHUNKS.length, '| recipes:', RECIPES.length, '| threshold:', CONFIDENCE_THRESHOLD);
assert.ok(CHUNKS.length >= 200, 'KB should have the full offline corpus');

// ───────────────────────── 1. KNOWN SCREENSHOT/LOG → CORRECT DIAGNOSIS ─────────────────────────
console.log('\n[1] known problem → correct diagnosis');
{
  // Simulate what Fable-5 vision would return for a BSOD screenshot.
  const visionText = 'Windows blue screen stop error CRITICAL_PROCESS_DIED code 0x000000EF, PC needs to restart.';
  const r = diagnoseInput({ kind: 'image', visionText, chunks: CHUNKS });
  ok('BSOD image → match (not abstain)', r.match === true && r.abstain === false);
  ok('BSOD routes to a windows KB article', /^l1-windows-00[123]/.test(r.article.slug));
  ok('BSOD confidence clears threshold', r.confidence >= CONFIDENCE_THRESHOLD);
  eq('BSOD confidence is high (routing boost fired)', confidenceLabel(r.confidence), 'high');

  // A pasted printer log.
  const printer = diagnoseInput({ kind: 'log', text: 'Print spooler service keeps stopping, jobs stuck in the print queue, cannot print to the office printer.', chunks: CHUNKS });
  ok('printer log → match', printer.match === true);
  ok('printer routes to l1-printer-001', printer.article.slug.startsWith('l1-printer-001'));

  // Outlook.
  const ol = diagnoseInput({ kind: 'text', text: 'Outlook is frozen and will not open, stuck on loading profile.', chunks: CHUNKS });
  ok('outlook text → match to outlook article', ol.match && ol.article.slug.startsWith('l1-outlook'));
}

// ───────────────────────── 2. LOW-CONFIDENCE → ABSTAIN (Rule 14) ─────────────────────────
console.log('\n[2] low-confidence → honest abstain (no fabrication)');
{
  const vague = diagnoseInput({ kind: 'image', visionText: 'A photo of a coffee mug on a wooden desk near a window.', chunks: CHUNKS });
  ok('irrelevant image → abstain', vague.match === false && vague.abstain === true);
  eq('abstain exposes no fabricated article', vague.article, undefined);
  eq('abstain label', confidenceLabel(vague.confidence), 'abstain');

  const gibberish = diagnoseInput({ kind: 'text', text: 'zzzz qqqq wwww asdf', chunks: CHUNKS });
  ok('gibberish → abstain', gibberish.match === false);

  const empty = diagnose('', CHUNKS);
  ok('empty query → abstain', empty.match === false && empty.reason === 'empty-input');
}

// ───────────────────────── 3. PII / SECRET REDACTION ─────────────────────────
console.log('\n[3] PII / secret redaction (privacy-first)');
{
  const dirty = [
    'User john.doe@contoso.com hit an error.',
    'Server 203.0.113.45 refused; gateway 8.8.8.8.',
    'GitHub token ghp_ABCDEFGHIJKLMNOpqrstuvwxyz0123456789 leaked.',
    'password = Sup3rSecret! and api_key=sk-abcdefghijklmnopqrstuvwx',
    'NIC 3C:22:FB:1A:2B:3C on C:\\Users\\jdoe\\AppData.',
    'APIPA 169.254.10.20 and loopback 127.0.0.1 are fine to keep.',
  ].join('\n');
  const r = redactPII(dirty);
  const map = Object.fromEntries(r.found.map(f => [f.type, f.count]));

  ok('email redacted', !/john\.doe@contoso\.com/.test(r.redacted) && map.EMAIL >= 1);
  ok('public IP redacted', !/203\.0\.113\.45/.test(r.redacted) && !/8\.8\.8\.8/.test(r.redacted));
  ok('APIPA + loopback preserved (diagnostic, non-PII)', /169\.254\.10\.20/.test(r.redacted) && /127\.0\.0\.1/.test(r.redacted));
  ok('github token redacted', !/ghp_ABCDEF/.test(r.redacted) && /\[REDACTED_SECRET\]/.test(r.redacted));
  ok('password value redacted', !/Sup3rSecret/.test(r.redacted));
  ok('api key redacted', !/sk-abcdefghijklmnop/.test(r.redacted));
  ok('MAC redacted', !/3C:22:FB:1A:2B:3C/.test(r.redacted) && map.MAC >= 1);
  ok('windows username redacted, path kept', /\[REDACTED_USER\]/.test(r.redacted) && /AppData/.test(r.redacted));
  ok('redaction report has a total count', r.count >= 6);

  // Redaction must happen BEFORE the query is built (nothing secret reaches the retriever).
  const built = buildProblemDescription({ kind: 'log', text: 'Outlook error for admin@corp.com token ghp_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz1234567' });
  ok('built query carries no raw email', !/admin@corp\.com/.test(built.query));
  ok('built query carries no raw token', !/ghp_zzzz/.test(built.query));
  ok('built query still diagnoses (outlook survives redaction)', /outlook/i.test(built.query));
}

// ───────────────────────── 4. CONSENT GATE ─────────────────────────
console.log('\n[4] consent gate (screen capture + cloud vision)');
{
  // Sentinel auto screen-capture with NO consent → blocked.
  const noConsent = evaluateConsent({ surface: 'sentinel', kind: 'screen-capture', willCallCloud: true, consent: {} });
  ok('sentinel capture without consent is blocked', noConsent.blocked === true);
  ok('blocked → requires screenCapture', noConsent.requiresConsent.includes('screenCapture'));
  ok('blocked → requires cloudProcessing too', noConsent.requiresConsent.includes('cloudProcessing'));
  ok('disclosure explains the offline alternative', /type/i.test(noConsent.disclosure));

  // Screen consent given, but cloud not yet → still needs cloud consent.
  const capOnly = evaluateConsent({ surface: 'sentinel', kind: 'screen-capture', willCallCloud: true, consent: { screenCapture: true } });
  ok('capture-consent alone still gates cloud', capOnly.blocked === true && capOnly.requiresConsent.includes('cloudProcessing') && !capOnly.requiresConsent.includes('screenCapture'));

  // Full consent → allowed.
  const full = evaluateConsent({ surface: 'sentinel', kind: 'screen-capture', willCallCloud: true, consent: { screenCapture: true, cloudProcessing: true } });
  ok('full consent → allowed', full.allowed === true && full.blocked === false);
  ok('cloud flow marks data leaving device to a third-party model', full.dataFlow.leavesDevice === true && full.dataFlow.thirdPartyModel === true);

  // Web text: allowed with no cloud model — but honest that it POSTs to our own function (not "on device").
  const webText = evaluateConsent({ surface: 'web', kind: 'text', willCallCloud: false, consent: {} });
  ok('web text is allowed offline', webText.allowed === true);
  ok('text path is honest: leaves device to OUR function, never a third-party model',
     webText.dataFlow.leavesDevice === true && webText.dataFlow.thirdPartyModel === false);

  // D2 truthful-wording gate (kill-issue class): the image disclosure must say UNREDACTED and must
  // NOT claim a "redacted copy" of the image is sent. Text disclosure must not claim "stays on your device".
  ok('image disclosure states the image is sent UNREDACTED',
     /unredacted/i.test(full.disclosure) && !/redacted copy of the image/i.test(full.disclosure));
  ok('image dataFlow.sends is honest about unredacted pixels',
     /unredacted/i.test(full.dataFlow.sends));
  ok('text disclosure no longer claims it stays on your device',
     !/stays on your device/i.test(webText.disclosure) && /our own iisupp\.net function/i.test(webText.disclosure));

  // Cloud-vision gating helper.
  ok('image + allow + model → cloud vision', shouldCallCloudVision({ kind: 'image', allowCloudVision: true, hasVisionModel: true }) === true);
  ok('image + allow but NO model → no cloud (honest abstain path)', shouldCallCloudVision({ kind: 'image', allowCloudVision: true, hasVisionModel: false }) === false);
  ok('text never calls cloud vision', shouldCallCloudVision({ kind: 'text', allowCloudVision: true, hasVisionModel: true }) === false);
}

// ───────────────────────── 5. ONE-CLICK FIX BRIDGE (gated) ─────────────────────────
console.log('\n[5] one-click fix bridge → gated recipe, never red/black');
{
  const fix = matchFix('outlook is frozen and will not open', 'windows', RECIPES);
  ok('outlook diagnosis matches a vetted recipe', fix && fix.recipeId);
  ok('fix points at the gated audit endpoint', /aria-guided-fix\?action=audit/.test(fix.auditEndpoint));
  ok('every offered fix is one-click eligible (no red/black)', fix.oneClickEligible === true);

  // No recipe should ever be surfaced as one-click if it is red/black.
  for (const r of RECIPES) {
    const f = matchFix((r.matchKeywords && r.matchKeywords[0]) || r.title, (r.os && r.os[0]) || 'windows', RECIPES);
    if (f && (f.riskOverall === 'red' || f.riskOverall === 'black')) {
      assert.equal(f.oneClickEligible, false, 'red/black recipe must not be one-click: ' + f.recipeId);
    }
  }
  ok('red/black recipes are never one-click eligible', true);

  const none = matchFix('xy', 'windows', RECIPES);
  ok('too-short issue → no fix (no bluffing)', none === null);
}

// ───────────────────────── 6. SIGNAL EXTRACTION ─────────────────────────
console.log('\n[6] signal extraction sharpens routing');
{
  const s = extractSignals('BSOD DRIVER_IRQL_NOT_LESS_OR_EQUAL stop code 0x000000D1 in Microsoft Teams');
  ok('extracts hex code', s.codes.includes('0x000000d1'));
  ok('extracts bugcheck name', s.bugchecks.some(b => /DRIVER_IRQL/.test(b)));
  ok('extracts app hint (teams)', s.apps.includes('teams'));
}

// ───────────────────────── 7. D3 — SCOPED PASTE (widget source lock) ─────────────────────────
// The document-level paste listener must be guarded so it only handles pastes aimed at the widget,
// never editable fields elsewhere on the host page. This widget is reused in Forums "Ask AI", so a
// regression here would re-open a global paste-exfiltration bug. Locked at the source level.
console.log('\n[7] scoped paste — no global exfiltration');
{
  const widgetSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'aria-vision-diagnose.js'), 'utf8');
  const pasteIdx = widgetSrc.indexOf("addEventListener('paste'");
  ok('widget registers a paste handler', pasteIdx > 0);
  const pasteBlock = widgetSrc.slice(pasteIdx, pasteIdx + 700);
  ok('paste handler is scoped to the widget root (withinWidget guard)', /withinWidget/.test(pasteBlock) && /root\.contains/.test(pasteBlock));
  ok('paste handler bails when the paste is not aimed at the widget', /if \(!withinWidget\) return/.test(pasteBlock));
  ok('the drop zone is focusable so an in-widget paste targets it', /setAttribute\('tabindex', '0'\)/.test(widgetSrc));
}

console.log('\n──────────────────────────────');
console.log('ALL ' + pass + ' ASSERTIONS PASSED ✅');
