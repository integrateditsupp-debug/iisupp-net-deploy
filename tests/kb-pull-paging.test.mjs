// tests/kb-pull-paging.test.mjs — RUN-CV / CV5 (2026-10-09), missed request A6f.
//
// The Windows "ARIA KB Pull" task had been failing with 504 on limit=800 for 58 days: the export
// function reads one blob per bit, ~26 s at 800, and the puller's first rung sat right on that
// ceiling with no cursor to fetch the rest. This suite is the contract for the repair:
//   * netlify/functions/aria-kb-export.mjs — an additive `offset` (default 0): the old request is the
//     old response plus `offset`/`total`/`nextOffset`; auth untouched; proven against an in-memory store;
//   * scripts/kb-pull.mjs — starts at 300, pages with offset, halves on 502/504/timeout with at most
//     three jittered tries per page, fails LOUDLY with the last status, stops after one page on a
//     server with no cursor (PARTIAL, never a loop), and writes the same files it always did.
// The server is a node:http fixture on 127.0.0.1 (port 0) — no real network, nothing leaves. Output
// goes to a scratch root (ARIA_KB_OUT_ROOT), never the tracked aria_brain_pack/.
//   node tests/kb-pull-paging.test.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';

let n = 0;
const ok = (name) => { n++; console.log(`  ok — ${name}`); };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'kb-pull.mjs');
const SECRET = 'test-export-secret-0123456789';
const run = promisify(execFile);

// ============================================================ 1. the export function: additive offset
process.env.ARIA_AUDIT_SECRET = SECRET;
delete process.env.APERTURE_JWT_SECRET;
const exportFn = await import('../netlify/functions/aria-kb-export.mjs');
const { pageWindow, _setStoreFactory, DEFAULT_LIMIT, MAX_LIMIT } = exportFn;
const handler = exportFn.default;

{
  // the pure window: limit parsing is byte-for-byte the old line, offset is new and total
  assert.deepEqual(pageWindow(new URLSearchParams('')), { limit: DEFAULT_LIMIT, offset: 0 });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=300')), { limit: 300, offset: 0 });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=99999')), { limit: MAX_LIMIT, offset: 0 });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=abc')), { limit: DEFAULT_LIMIT, offset: 0 });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=300&offset=600')), { limit: 300, offset: 600 });
  assert.deepEqual(pageWindow(new URLSearchParams('offset=-5')), { limit: DEFAULT_LIMIT, offset: 0 });
  assert.deepEqual(pageWindow(new URLSearchParams('offset=abc')), { limit: DEFAULT_LIMIT, offset: 0 });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=3&offset=3'), 7), { limit: 3, offset: 3, total: 7, nextOffset: 6 });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=3&offset=6'), 7), { limit: 3, offset: 6, total: 7, nextOffset: null });
  assert.deepEqual(pageWindow(new URLSearchParams('limit=3&offset=99'), 7), { limit: 3, offset: 99, total: 7, nextOffset: null });
  assert.deepEqual(pageWindow(new URLSearchParams(''), 0), { limit: DEFAULT_LIMIT, offset: 0, total: 0, nextOffset: null });
  assert.deepEqual(pageWindow(null), { limit: DEFAULT_LIMIT, offset: 0 });
}
ok('pageWindow: limit parses exactly as before (default 2000, cap 5000); offset is additive, default 0, never negative; nextOffset ends at total');

// an in-memory Blobs stand-in with seven learned bits and one stranger
const mem = new Map();
for (let i = 1; i <= 7; i++) mem.set(`learn-topic-${String(i).padStart(2, '0')}`, JSON.stringify({ q: `question ${i}`, a: `answer ${i}` }));
mem.set('summary-2026-10-01', JSON.stringify({ total: 7 }));
let getFailures = new Set();
_setStoreFactory(({ name }) => {
  assert.equal(name, 'aria-kb-live', 'the export reads the live store and nothing else');
  return {
    async list({ prefix }) { return { blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })) }; },
    async get(key, opts) { if (getFailures.has(key)) throw new Error('blob read failed'); const v = mem.get(key); return v == null ? null : (opts && opts.type === 'json' ? JSON.parse(v) : v); },
  };
});
const call = async (query, headers = { 'x-aria-export-secret': SECRET }) => {
  const res = await handler(new Request(`https://iisupp.net/.netlify/functions/aria-kb-export${query}`, { headers }));
  return { status: res.status, body: await res.json() };
};

{
  const unauth = await call('?limit=3', {});
  assert.equal(unauth.status, 401, 'no secret, no JWT → 401, exactly as before');
  const wrong = await call('?limit=3', { 'x-aria-export-secret': 'nope' });
  assert.equal(wrong.status, 401);
  const r = await call('');
  assert.equal(r.status, 200);
  for (const k of ['ok', 'count', 'exportedAt', 'store', 'bits']) assert.ok(k in r.body, `old key ${k} still present`);
  assert.equal(r.body.count, 7, 'a request with no offset returns everything, as before');
  assert.deepEqual(r.body.bits.map((b) => b.key), [...Array(7)].map((_, i) => `learn-topic-${String(i + 1).padStart(2, '0')}`));
  assert.equal(r.body.bits[0].q, 'question 1', 'the blob body is spread into the bit, as before');
  assert.deepEqual([r.body.offset, r.body.total, r.body.nextOffset], [0, 7, null], 'the three additive keys');
  assert.ok(!r.body.bits.some((b) => b.key.startsWith('summary-')), 'only learn-* bits are exported');
}
ok('the export without offset is the old response plus offset/total/nextOffset; auth is untouched');

{
  const p1 = await call('?limit=3');
  assert.deepEqual([p1.body.count, p1.body.offset, p1.body.total, p1.body.nextOffset], [3, 0, 7, 3]);
  const p2 = await call('?limit=3&offset=3');
  assert.deepEqual([p2.body.count, p2.body.offset, p2.body.nextOffset], [3, 3, 6]);
  assert.deepEqual(p2.body.bits.map((b) => b.key), ['learn-topic-04', 'learn-topic-05', 'learn-topic-06']);
  const p3 = await call('?limit=3&offset=6');
  assert.deepEqual([p3.body.count, p3.body.offset, p3.body.nextOffset], [1, 6, null]);
  assert.equal(p3.body.bits[0].key, 'learn-topic-07');
  const beyond = await call('?limit=3&offset=99');
  assert.deepEqual([beyond.body.count, beyond.body.nextOffset], [0, null], 'past the end is empty and final, never an error');
  const all = [...p1.body.bits, ...p2.body.bits, ...p3.body.bits].map((b) => b.key);
  assert.equal(new Set(all).size, 7, 'three pages cover every bit exactly once');
  // a bit whose blob read fails is skipped (as before) but the cursor still advances by the slice
  getFailures = new Set(['learn-topic-02']);
  const gap = await call('?limit=3');
  assert.deepEqual([gap.body.count, gap.body.nextOffset], [2, 3], 'a skipped blob never stalls the cursor');
  getFailures = new Set();
}
ok('offset pages walk the whole store in listing order; a failed blob read is skipped without stalling the cursor');

// ====================================================== 2. the fixture server: 504 above a ceiling
const BITS = [...Array(60)].map((_, i) => ({ key: `learn-fixture-${String(i + 1).padStart(3, '0')}`, q: `q${i + 1}`, a: `a${i + 1}` }));
const stats = { requests: [] };
const hanging = new Set();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const [, mode = 'ceiling'] = url.pathname.split('/');
  const limit = parseInt(url.searchParams.get('limit') || '2000', 10);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
  stats.requests.push({ mode, limit, offset, secret: req.headers['x-aria-export-secret'] });
  const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers['x-aria-export-secret'] !== SECRET) return send(401, { error: 'unauthorized' });
  if (mode === 'always504') return send(504, { error: 'Gateway Timeout' });
  if (mode === 'hang' && limit > 100) { hanging.add(res); req.on('close', () => hanging.delete(res)); return; }
  if ((mode === 'ceiling' || mode === 'hang') && limit > 100) return send(504, { error: 'Gateway Timeout' });
  if (mode === 'legacy') return send(200, { ok: true, count: Math.min(limit, BITS.length), exportedAt: '2026-10-09T12:00:00.000Z', store: 'aria-kb-live', bits: BITS.slice(0, limit) });
  if (mode === 'stuck') return send(200, { ok: true, count: 5, exportedAt: 'x', store: 'aria-kb-live', bits: BITS.slice(0, 5), offset, total: BITS.length, nextOffset: offset });
  const page = BITS.slice(offset, offset + limit);
  const end = offset + page.length;
  send(200, { ok: true, count: page.length, exportedAt: '2026-10-09T12:00:00.000Z', store: 'aria-kb-live', bits: page, offset, total: BITS.length, nextOffset: end < BITS.length ? end : null });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const site = (mode) => `http://127.0.0.1:${PORT}/${mode}`;

// The desktop registry imports every suite into ONE process, and several registered suites replace
// `global.fetch` with a throwing stub and never put it back. So the in-process pulls below use a
// node:http fetch of their own (the same Response surface the puller reads: ok/status/json/text,
// and the abort signal honoured), and the end-to-end runs use the real fetch in a child process.
function httpFetch(url, { headers = {}, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(signal.reason);
    const req = http.request(url, { method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, async text() { return text; }, async json() { return JSON.parse(text); } });
      });
      res.on('error', reject);
    });
    const onAbort = () => { req.destroy(signal.reason); };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    req.on('close', () => { if (signal) signal.removeEventListener('abort', onAbort); });
    req.on('error', reject);
    req.end();
  });
}

const pull = await import('../scripts/kb-pull.mjs');
const { pullBits, backoffMs, halve, ExportFailed, DEFAULT_START_LIMIT, MIN_LIMIT, DEFAULT_TRIES, writeMirror } = pull;
const quiet = { log: () => {}, warn: () => {}, sleep: async () => {}, retryBaseMs: 1, fetchImpl: httpFetch };
const reset = () => { stats.requests.length = 0; };

// Whatever happens below, the fixture server is closed: an open server after a failed assertion would
// keep the registry's event loop alive and turn a red into a ten-minute hang.
try {

{
  assert.equal(DEFAULT_START_LIMIT, 300, 'the first page is 300, under the measured ~800 ceiling');
  assert.equal(DEFAULT_TRIES, 3);
  assert.equal(halve(300), 150); assert.equal(halve(75), 37); assert.equal(halve(30), MIN_LIMIT); assert.equal(halve(1), MIN_LIMIT);
  for (const attempt of [1, 2, 3]) {
    const lo = backoffMs(attempt, 1000, () => 0), hi = backoffMs(attempt, 1000, () => 1);
    assert.equal(lo, 1000 * 2 ** (attempt - 1), 'exponential base');
    assert.equal(hi, Math.round(lo * 1.5), 'jitter adds at most 50%');
    const mid = backoffMs(attempt, 1000);
    assert.ok(mid >= lo && mid <= hi, 'real jitter stays inside the band');
  }
}
ok('halve floors at 25; backoff is exponential with bounded jitter');

{
  reset();
  const warned = [];
  const r = await pullBits({ site: site('ceiling'), secret: SECRET, ...quiet, warn: (m) => warned.push(m) });
  assert.deepEqual(stats.requests.map((q) => q.limit), [300, 150, 75], 'ladder: 300 → 504, 150 → 504, 75 → 200');
  assert.deepEqual(stats.requests.map((q) => q.offset), [0, 0, 0], 'the failed tries stay on the same page position');
  assert.equal(r.bits.length, 60);
  assert.equal(new Set(r.bits.map((b) => b.key)).size, 60, 'every bit once');
  assert.deepEqual([r.pages, r.total, r.complete, r.usedLimits], [1, 60, true, [75]]);
  assert.equal(r.exportedAt, '2026-10-09T12:00:00.000Z');
  assert.ok(warned.some((m) => /limit=300 offset=0 -> 504 \(attempt 1\/3\) — retrying with limit=150/.test(m)), 'each failed try is logged with the status, the attempt and the next size');
  assert.ok(stats.requests.every((q) => q.secret === SECRET), 'the secret travels in the header on every try');
}
ok('a 504 above the ceiling halves the page (300 → 150 → 75) and the pull completes whole');

{
  reset();
  const r = await pullBits({ site: site('ceiling'), secret: SECRET, startLimit: 10, ...quiet });
  assert.deepEqual(stats.requests.map((q) => [q.limit, q.offset]), [[25, 0], [25, 25], [25, 50]], 'startLimit under the floor is lifted to 25; pages start at 0, 25, 50');
  assert.deepEqual([r.bits.length, r.pages, r.complete, r.usedLimits], [60, 3, true, [25, 25, 25]]);
  reset();
  const r2 = await pullBits({ site: site('ceiling'), secret: SECRET, startLimit: 100, ...quiet });
  assert.deepEqual(stats.requests.map((q) => q.offset), [0], 'a page that holds everything is one request');
  assert.deepEqual([r2.bits.length, r2.pages, r2.complete], [60, 1, true]);
}
ok('offset paging walks every page to nextOffset=null; the page size found is kept for the following pages');

{
  reset();
  const warned = [];
  const r = await pullBits({ site: site('legacy'), secret: SECRET, startLimit: 10, ...quiet, warn: (m) => warned.push(m) });
  assert.equal(stats.requests.length, 1, 'a server with no cursor is asked exactly once — never a loop');
  assert.deepEqual([r.bits.length, r.pages, r.complete, r.total], [25, 1, false, null]);
  assert.ok(warned.some((m) => /PARTIAL mirror of 25 bits/.test(m)), 'and the mirror is called PARTIAL');
  reset();
  const r2 = await pullBits({ site: site('stuck'), secret: SECRET, startLimit: 10, ...quiet, warn: (m) => warned.push(m) });
  assert.equal(stats.requests.length, 1, 'a cursor that does not advance stops after one page');
  assert.equal(r2.complete, false);
  assert.ok(warned.some((m) => /cursor did not advance/.test(m)));
}
ok('the deployed (cursor-less) export and a stuck cursor both stop after one page as PARTIAL — the pull never hangs or loops');

{
  reset();
  await assert.rejects(() => pullBits({ site: site('always504'), secret: SECRET, ...quiet }), (e) => {
    assert.ok(e instanceof ExportFailed);
    assert.equal(e.status, 504, 'the LAST status is what the failure carries');
    assert.equal(e.attempts, 3);
    assert.match(e.message, /Export failed: 504/);
    assert.match(e.body, /Gateway Timeout/);
    return true;
  });
  assert.deepEqual(stats.requests.map((q) => q.limit), [300, 150, 75], 'exactly three tries, each one smaller, then it stops');
  reset();
  await assert.rejects(() => pullBits({ site: site('ceiling'), secret: 'wrong-secret', ...quiet }), (e) => e instanceof ExportFailed && e.status === 401 && e.attempts === 1);
  assert.equal(stats.requests.length, 1, 'a 401 is the secret, not the size: no retry, no smaller page');
  await assert.rejects(() => pullBits({ site: site('ceiling'), secret: '', ...quiet }), (e) => e instanceof ExportFailed && e.status === 'no-secret');
  reset();
  await assert.rejects(() => pullBits({ site: `http://127.0.0.1:1/dead`, secret: SECRET, ...quiet }), (e) => e instanceof ExportFailed && e.status === 'network' && e.attempts === 3);
}
ok('bounded retries: three tries then a loud ExportFailed with the last status (504); 401 and a missing secret fail at once; a dead host fails after three');

{
  reset();
  const t0 = Date.now();
  const r = await pullBits({ site: site('hang'), secret: SECRET, timeoutMs: 250, ...quiet });
  assert.deepEqual(stats.requests.map((q) => q.limit), [300, 150, 75], 'the hung 300 and 150 time out; 75 answers');
  assert.deepEqual([r.bits.length, r.complete], [60, true]);
  assert.ok(Date.now() - t0 < 5000, 'a hang is bounded by the timeout, not by patience');
  for (const res of hanging) res.destroy();
  hanging.clear();
}
ok('a server that hangs above the ceiling is timed out, halved and completed — it does not stall the job');

// ================================================= 3. the real script, end to end, into a scratch root
const scratch = makeScratchDir('kb-pull-');
const env = (over) => ({ ...process.env, ARIA_AUDIT_SECRET: SECRET, ARIA_KB_OUT_ROOT: scratch, ARIA_KB_RETRY_BASE_MS: '1', ...over });
const runScript = async (over) => {
  try {
    const { stdout, stderr } = await run(process.execPath, [SCRIPT], { env: env(over), cwd: ROOT, timeout: 60000 });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
};

{
  reset();
  const r = await runScript({ ARIA_SITE: site('ceiling') });
  assert.equal(r.code, 0, `exit 0\n${r.stderr}`);
  assert.match(r.stdout, /Done\.\s*Wrote\s+60\s+bits/, 'the ONE line the job registry keys on is still printed');
  assert.match(r.stdout, /Pulling live bit-KB from http:\/\/127\.0\.0\.1:\d+\/ceiling\/\.netlify\/functions\/aria-kb-export\?limit=300&offset=0/);
  assert.match(r.stdout, /page sizes: 75/);
  assert.deepEqual(stats.requests.map((q) => q.limit), [300, 150, 75]);
  const bitsDir = path.join(scratch, 'aria_brain_pack', 'bits');
  const files = fs.readdirSync(bitsDir).sort();
  assert.equal(files.length, 60);
  assert.equal(files[0], 'learn-fixture-001.json', 'same file naming as before: <key>.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(bitsDir, 'learn-fixture-007.json'), 'utf8')), BITS[6], 'each file is the bit, pretty-printed');
  const manifest = JSON.parse(fs.readFileSync(path.join(scratch, 'aria_brain_pack', 'manifest.json'), 'utf8'));
  for (const k of ['pulledAt', 'site', 'exportedAt', 'count', 'written', 'note']) assert.ok(k in manifest, `manifest keeps ${k}`);
  assert.deepEqual([manifest.count, manifest.written, manifest.exportedAt, manifest.site], [60, 60, '2026-10-09T12:00:00.000Z', site('ceiling')]);
  assert.deepEqual([manifest.pages, manifest.total, manifest.complete, manifest.pageSizes], [1, 60, true, [75]], 'additive: how the pull went');
  assert.ok(!fs.existsSync(path.join(ROOT, 'aria_brain_pack', 'bits', 'learn-fixture-001.json')), 'nothing was written into the tracked aria_brain_pack/');
}
ok('end to end: the script survives 504s, writes aria_brain_pack/bits/<key>.json + manifest.json as before, exit 0, "Done. Wrote 60 bits"');

{
  reset();
  const r = await runScript({ ARIA_SITE: site('always504') });
  assert.equal(r.code, 1, 'a pull that cannot get a page exits 1');
  assert.match(r.stderr, /ERROR: Export failed: 504/, 'the registry\'s failRe (ERROR:) and the old "Export failed: <status>" text, together');
  assert.match(r.stderr, /3 attempt\(s\)/);
  assert.doesNotMatch(r.stdout, /Done\./, 'no success line on a failed run');
  assert.deepEqual(stats.requests.map((q) => q.limit), [300, 150, 75]);
  const noSecret = await runScript({ ARIA_SITE: site('ceiling'), ARIA_AUDIT_SECRET: '', ARIA_EXPORT_SECRET: '' });
  assert.equal(noSecret.code, 1);
  assert.match(noSecret.stderr, /ERROR: set ARIA_AUDIT_SECRET/);
  const custom = await runScript({ ARIA_SITE: site('ceiling'), ARIA_KB_LIMIT: '5', ARIA_KB_OUT_ROOT: path.join(scratch, 'custom') });
  assert.equal(custom.code, 0);
  assert.match(custom.stdout, /Done\.\s*Wrote\s+60\s+bits/);
  assert.match(custom.stdout, /Pages: 3, page sizes: 25>25>25, listed: 60/, 'ARIA_KB_LIMIT below the floor is lifted to 25 and paged three times');
}
ok('a run that cannot get a page fails loudly (exit 1, ERROR: Export failed: 504, 3 attempts); no secret fails before any request; ARIA_KB_LIMIT still steers the first page');

{
  const partial = makeScratchDir('kb-pull-partial-');
  const r = await runScript({ ARIA_SITE: site('legacy'), ARIA_KB_OUT_ROOT: partial, ARIA_KB_LIMIT: '10' });
  assert.equal(r.code, 0, 'a partial mirror is still a success for the job (some of the KB beats none)');
  assert.match(r.stdout, /Done\.\s*Wrote\s+25\s+bits/);
  assert.match(r.stdout, /PARTIAL/);
  assert.match(r.stderr, /PARTIAL mirror/);
  const manifest = JSON.parse(fs.readFileSync(path.join(partial, 'aria_brain_pack', 'manifest.json'), 'utf8'));
  assert.equal(manifest.complete, false, 'the manifest says so, so a partial mirror can never pass for a whole one');
  // writeMirror is the only writer, and it writes where it always did
  const w = await writeMirror({ bits: [{ key: 'learn-x/y' }], exportedAt: 'e', pages: 1, total: 1, complete: true, usedLimits: [25] }, { outRoot: path.join(partial, 'w'), site: 's' });
  assert.equal(w.written, 1);
  assert.ok(fs.existsSync(path.join(partial, 'w', 'aria_brain_pack', 'bits', 'learn-x_y.json')), 'unsafe key characters are replaced exactly as before');
}
ok('against the cursor-less deployed export the script still succeeds with a PARTIAL manifest (complete:false) and the old file layout');

{
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /if \(isMain\) \{/, 'the puller only runs as an entry point (this suite imported it without a pull)');
  assert.match(src, /Done\. Wrote \$\{written\} bits to aria_brain_pack\/bits\/ \(manifest updated\)/, 'the success sentence is verbatim');
  const fn = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'aria-kb-export.mjs'), 'utf8');
  assert.match(fn, /x-aria-export-secret/, 'secret auth kept');
  assert.match(fn, /verifyAperture\(request\)/, 'JWT auth kept');
  assert.match(fn, /blobs\.slice\(offset, offset \+ limit\)/, 'the page is a window, not a prefix');
}
ok('source guards: entry-guarded puller, verbatim success line, export auth untouched, windowed slice');

} finally {
  for (const res of hanging) res.destroy();
  hanging.clear();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
console.log(`\nkb-pull-paging: ${n} checks passed`);
