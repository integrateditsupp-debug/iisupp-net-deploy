// vision-web-surface-wiring.test.mjs — STAGE 2 surface #1 (ARIA web) wiring guard.
// Verifies the "show, don't type" vision widget is actually mounted on iisupp.net/aria's ask
// surface (not just the standalone demo) and points at the real endpoint. This is a Rule-16
// regression lock: if a future edit drops the include, the zone, or the mount, the suite fails.
//   node tests/vision-web-surface-wiring.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const aria = readFileSync(join(root, 'aria.html'), 'utf8');
const widget = readFileSync(join(root, 'assets', 'aria-vision-diagnose.js'), 'utf8');
const fn = readFileSync(join(root, 'netlify', 'functions', 'aria-vision-diagnose.mjs'), 'utf8');

let pass = 0, fail = 0;
const t = (name, fn2) => { try { fn2(); console.log('  ✓ ' + name); pass++; } catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\n[1] the vision widget script is loaded on the ARIA web page');
t('aria.html includes the aria-vision-diagnose.js widget', () => {
  assert.match(aria, /assets\/aria-vision-diagnose\.js/);
});
t('the widget defines the global the page expects', () => {
  assert.match(widget, /global\.ARIAVisionDiagnose\s*=/);
});

console.log('\n[2] the mount point exists and is wired to surface "web"');
t('aria.html has the drop/paste mount container', () => {
  assert.match(aria, /id=["']ariaVisionZone["']/);
});
t('a mount() call targets that container with surface:web', () => {
  const block = aria.slice(aria.indexOf('ariaVisionZone'));
  assert.match(block, /ARIAVisionDiagnose\.mount/);
  assert.match(block, /surface\s*:\s*['"]web['"]/);
});
t('the mount points at the real diagnose endpoint (matches the function path)', () => {
  assert.match(aria, /\/\.netlify\/functions\/aria-vision-diagnose/);
  assert.match(fn, /path:\s*['"]\/\.netlify\/functions\/aria-vision-diagnose['"]/);
});

console.log('\n[3] value-first, honest framing on the surface (Rule 14 + Rule 17)');
t('the panel leads with the customer benefit, not the tech', () => {
  assert.match(aria, /SHOW ARIA THE PROBLEM/i);
});
t('the surface discloses the privacy split (text on our server, image only after approval)', () => {
  const panel = aria.slice(aria.indexOf('ariaVisionPanel'), aria.indexOf('ariaVisionPanel') + 900);
  assert.match(panel, /our own server/i);
  assert.match(panel, /only after you approve/i);
});
t('mount is idempotent (guarded against double-mount)', () => {
  assert.match(aria, /data-mounted/);
});

console.log('\n─'.repeat(30));
if (fail) { console.log(`❌ ${fail} FAILED, ${pass} passed`); process.exit(1); }
console.log(`ALL ${pass} WEB-SURFACE WIRING ASSERTIONS PASSED ✅`);
