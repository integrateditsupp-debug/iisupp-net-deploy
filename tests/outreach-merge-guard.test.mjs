// outreach-merge-guard.test.mjs — regression guard for the "Hello ," merge bug (task #27).
// The bug: generateOutreach() substituted an empty/undefined name into the LOCKED template's
// "Hello {name}," greeting, producing "Hello ," — and lint() only checked for a LEFTOVER {name}
// literal, so the garbage draft passed. Two fixes are asserted here:
//   1. generateOutreach() HARD-FAILS (throws EMPTY_MERGE_FIELD) on a missing/empty/sentinel name.
//   2. lint() HARD-FAILS on an empty-resolved greeting ("Hello ,") and on a sentinel ("Hello undefined,").
import assert from 'node:assert';
import { generateOutreach, lint, cleanName } from '../scripts/lib/outreach.mjs';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`); } };

// ── cleanName: the sanitizer ──
t('cleanName trims and collapses', () => assert.equal(cleanName('  Acme   Corp  '), 'Acme Corp'));
t('cleanName rejects empty', () => assert.equal(cleanName(''), null));
t('cleanName rejects whitespace-only', () => assert.equal(cleanName('   '), null));
t('cleanName rejects null/undefined', () => { assert.equal(cleanName(null), null); assert.equal(cleanName(undefined), null); });
t('cleanName rejects stringified sentinels', () => { assert.equal(cleanName('undefined'), null); assert.equal(cleanName('null'), null); assert.equal(cleanName('NaN'), null); });
t('cleanName keeps a real name', () => assert.equal(cleanName('North Toronto Dental'), 'North Toronto Dental'));

// ── generateOutreach: renderer hard-fail ──
t('renderer throws on empty name', () => {
  assert.throws(() => generateOutreach({ name: '', handle: 'Lead-X' }), /EMPTY_MERGE_FIELD|no usable name/i);
});
t('renderer throws on undefined name', () => {
  assert.throws(() => generateOutreach({ handle: 'Lead-Y' }), /no usable name/i);
});
t('renderer throws on sentinel name', () => {
  assert.throws(() => generateOutreach({ name: 'undefined' }), /no usable name/i);
});
t('renderer succeeds on a real name and never emits "Hello ,"', () => {
  const g = generateOutreach({ name: 'Acme Corp', handle: 'Lead-Z' });
  assert.ok(/^hello acme corp,/i.test(g.body.trim()), 'greeting should be "Hello Acme Corp,"');
  assert.ok(!/hello\s*,/i.test(g.body), 'body must not contain an empty greeting');
});

// ── lint: catches the garbage even if a future code path bypasses the renderer ──
t('lint fails an empty greeting ("Hello ,")', () => {
  const r = lint('Hello ,\n\nHope you are doing well.', {});
  assert.equal(r.pass, false);
  assert.ok(r.issues.some(i => /empty merge/i.test(i)), 'should flag empty merge');
});
t('lint fails a sentinel greeting ("Hello undefined,")', () => {
  const r = lint('Hello undefined,\n\nHope you are doing well.', {});
  assert.equal(r.pass, false);
  assert.ok(r.issues.some(i => /bad merge|sentinel/i.test(i)), 'should flag sentinel merge');
});
t('lint still fails a leftover {name} literal', () => {
  const r = lint('Hello {name},\n\nHope you are doing well.', {});
  assert.equal(r.pass, false);
  assert.ok(r.issues.some(i => /not personalized/i.test(i)));
});

if (fail) { console.error(`\noutreach-merge-guard: FAIL — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`outreach-merge-guard: OK — ${pass} assertions passed; "Hello ," can no longer be rendered or pass lint.`);
