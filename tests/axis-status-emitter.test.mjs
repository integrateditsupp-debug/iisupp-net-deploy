// AXIS status emitter — headline-only public feed, full detail internal-only.
// The flywheel repeatedly re-leaked build internals (git SHAs, branch names, operator one-click scripts,
// lock state) into the PUBLIC .well-known/axis/status.json mirrors. scripts/lib/axis-status-emit.mjs is now
// the only sanctioned writer: allowlisted headline keys, length caps, and a leak-pattern refusal. This suite
// proves the emitter refuses every leak class, the mirrors on disk are clean, and the full detail sits only
// behind the authenticated /api/axis-status gate.
// Run: node tests/axis-status-emitter.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };

const { buildPublicStatus, emitAxisStatus, findLeaks, checkPublicFiles, PUBLIC_STATUS_FILES, PUBLIC_ALLOWED_KEYS, INTERNAL_FULL_FILE } =
  await import(new URL('../scripts/lib/axis-status-emit.mjs', import.meta.url).href);

const GOOD = {
  status: 'active build',
  milestone: 'Product and console built and tested.',
  readiness: 'Built and tested; publish is a manual operator step.',
  revenueToDate: 'none',
  headline: 'Honest headline. Revenue received to date: none.',
  note: 'Public headline only.'
};

// ---- 1. happy path: allowlisted headline fields pass and are stamped ----
const pub = buildPublicStatus({ ...GOOD });
assert.equal(pub.public, true); assert.equal(pub.honest, true);
assert.ok(pub.schema && pub.generatedAt, 'schema + generatedAt stamped');
for (const k of Object.keys(pub)) assert.ok(PUBLIC_ALLOWED_KEYS.includes(k), `emitted key ${k} is allowlisted`);
ok();

// ---- 2. refusal: every leak class is rejected (samples built by concat so this tracked file stays clean) ----
const sha = 'aff' + '5342e';
const branch = 'cc' + '/master-fix-2026';
const oneClick = 'AH' + 'MAD-PUSH-RUN99';
const script = 'push-it' + '.cmd';
const gitState = 'refs' + '/heads blocked by index' + '.lock';
for (const [field, bad] of [
  ['headline', `merged at ${sha}`],
  ['milestone', `built on ${branch}`],
  ['note', `click ${oneClick}`],
  ['readiness', `run ${script} to ship`],
  ['status', gitState],
]) {
  assert.throws(() => buildPublicStatus({ ...GOOD, [field]: bad }), /REFUSED/, `leak in "${field}" refused`);
}
assert.throws(() => buildPublicStatus({ ...GOOD, lanes: 'x' }), /not allowlisted/, 'non-headline key refused');
assert.throws(() => buildPublicStatus({ ...GOOD, note: { deep: 'detail' } }), /primitive/, 'nested detail refused');
assert.throws(() => buildPublicStatus({ ...GOOD, headline: 'x'.repeat(500) }), /exceeds/, 'report-length value refused');
const { headline, ...missing } = GOOD;
assert.throws(() => buildPublicStatus(missing), /required/, 'missing required headline key refused');
ok();

// ---- 3. findLeaks catches the classes, passes honest prose ----
assert.equal(findLeaks(JSON.stringify(GOOD)).length, 0, 'honest headline prose is clean');
for (const bad of [sha, branch, oneClick, script, gitState, 'observer run 118', 'senior-director-state/x']) {
  assert.ok(findLeaks('text ' + bad).length > 0, `pattern catches: ${bad.slice(0, 20)}…`);
}
ok();

// ---- 4. round-trip into a temp repo: public mirrors headline-only, full detail internal ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-emit-'));
const res = emitAxisStatus({ root: tmp, publicFields: { ...GOOD }, fullDetail: { lanes: [{ lane: 'x', note: `internal ${sha} ${oneClick}` }] } });
assert.equal(res.written.public.length, 2, 'both public mirrors written');
assert.equal(res.written.internal, INTERNAL_FULL_FILE, 'full detail written to the internal path');
assert.equal(checkPublicFiles(tmp).length, 0, 'emitted public mirrors scan clean');
const mirrors = PUBLIC_STATUS_FILES.map(rel => fs.readFileSync(path.join(tmp, rel), 'utf8'));
assert.equal(mirrors[0], mirrors[1], 'mirrors are byte-identical');
const full = JSON.parse(fs.readFileSync(path.join(tmp, INTERNAL_FULL_FILE), 'utf8'));
assert.ok(full._internal === true && /axis-status-emit/.test(full._emitRule), 'internal file self-describes the rule');
fs.rmSync(tmp, { recursive: true, force: true });
ok();

// ---- 5. the REAL repo mirrors are clean, headline-only, and carry the required fields ----
assert.equal(checkPublicFiles(root).length, 0, 'repo public mirrors carry zero leak-class content');
for (const rel of PUBLIC_STATUS_FILES) {
  const j = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  for (const k of Object.keys(j)) assert.ok(PUBLIC_ALLOWED_KEYS.includes(k), `${rel}: key ${k} allowlisted`);
  for (const k of ['status', 'milestone', 'readiness', 'revenueToDate', 'headline']) assert.ok(k in j, `${rel}: has ${k}`);
  assert.equal(j.public, true);
}
ok();

// ---- 6. full detail is gated: internal file exists, /api/axis-status requires the Aperture login,
//         and the serving layer force-404s the /netlify/* path it lives under ----
assert.ok(fs.existsSync(path.join(root, INTERNAL_FULL_FILE)), 'internal full-detail file exists');
const fn = fs.readFileSync(path.join(root, 'netlify', 'functions', 'axis-status.mjs'), 'utf8');
assert.ok(/verifyAperture\(req\)/.test(fn) && /401/.test(fn), 'endpoint fails closed without the Aperture session');
assert.ok(/_axis-status-full\.json/.test(fn) && /\/api\/axis-status/.test(fn), 'endpoint serves the internal file at /api/axis-status');
const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
assert.ok(toml.split('[[redirects]]').some(b => b.includes('from = "/netlify/*"') && /status\s*=\s*404/.test(b) && /force\s*=\s*true/.test(b)), '/netlify/* force-404 shields the internal file');
ok();

console.log(`axis-status-emitter: ${n}/6 groups green — public mirrors headline-only, every leak class refused, full detail auth-gated.`);
