// tests/axis-tasks-endpoint.test.mjs — RUN-AX3 (2026-10-15): /api/axis/tasks, the deployed handler.
//
// Runs netlify/functions/axis-tasks.mjs as Netlify would call it (a Fetch Request in, a Response out) over an
// in-memory Blobs store, with a real HS256 Aperture token. Fails the moment the endpoint answers without the
// Aperture login, caches a response, ships a different shape, accepts an unknown action or id, or reads a
// store that did not answer as an empty list. Run: node tests/axis-tasks-endpoint.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createMemoryBlobs, envelope } from './lib/axis-memory-store.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const T = require(path.join(ROOT, 'netlify/functions/lib/axis-tasks.cjs'));
let groups = 0; const ok = () => { groups++; };

const prevSecret = process.env.APERTURE_JWT_SECRET;
process.env.APERTURE_JWT_SECRET = 'axis-tasks-endpoint-secret';
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (claims, secret = process.env.APERTURE_JWT_SECRET) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64u(JSON.stringify(claims));
  return `${h}.${p}.${b64u(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest())}`;
};
const TOKEN = jwt({ sub: 'ahmad', role: 'admin', exp: Math.floor(Date.now() / 1000) + 600 });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();

const mem = createMemoryBlobs();
function seed() {
  mem.reset();
  mem.put('axis-exec', 'todos', [{ id: 'todo-a', title: 'Sign the Whereby cancel', priority: 'high', needsYou: true, done: false, created_at: day(-3) }, { id: 'todo-b', title: 'Draft the Apollo renewal note', needsYou: false, done: false, created_at: day(-2) }]);
  mem.put('axis-exec', 'approvals', [{ id: 'apr-reply', kind: 'reply', title: 'Reply to Acme', payload: { to: 'ceo@acme.example', text: 'hi' }, status: 'pending', created_at: day(-1) }]);
  for (const k of ['tasks', 'followups', 'workspace', 'local-jobs']) mem.put('axis-exec', k, []);
  mem.put('axis-snapshots', 'overview', envelope('overview', { ceo_critical: [{ ref: '#5', n: 5, section: 'open', what: 'Fix the Apollo payment method', who: 'enrichment', deadline: null, one_click: 'Apollo billing page', overdue: false, closed: false, cleared: false }] }));
}
seed();
T._setGetStore(mem.getStore);
const fn = (await import(pathToFileURL(path.join(ROOT, 'netlify/functions/axis-tasks.mjs')).href)).default;
const H = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' };
const call = async (method, q = '', body = undefined, headers = H) => {
  const r = await fn(new Request('https://iisupp.example/api/axis/tasks' + q, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }));
  let json = null; const text = await r.text(); try { json = JSON.parse(text); } catch { json = null; }
  return { status: r.status, cache: r.headers.get('cache-control'), type: r.headers.get('content-type'), json };
};

try {
  // ---- 1. The Aperture login is required — for reading as much as for writing ----
  {
    for (const [m, b] of [['GET', undefined], ['POST', { action: 'complete', id: 'todo:todo-a' }]]) {
      const none = await call(m, '', b, { 'content-type': 'application/json' });
      assert.equal(none.status, 401, `${m} without a token → 401`); assert.equal(none.cache, 'no-store');
      const forged = await call(m, '', b, { authorization: 'Bearer ' + jwt({ sub: 'x', exp: Math.floor(Date.now() / 1000) + 600 }, 'not-the-secret'), 'content-type': 'application/json' });
      assert.equal(forged.status, 401, `${m} with a token signed by another secret → 401`);
      const expired = await call(m, '', b, { authorization: 'Bearer ' + jwt({ sub: 'ahmad', exp: Math.floor(Date.now() / 1000) - 5 }), 'content-type': 'application/json' });
      assert.equal(expired.status, 401, `${m} with an expired token → 401`);
    }
    assert.equal(mem.read('axis-exec', 'todos')[0].done, false, 'a refused POST changed nothing');
    assert.equal((await fn(new Request('https://x/api/axis/tasks', { method: 'OPTIONS' }))).status, 204);
    assert.equal((await call('PUT', '', '{}')).status, 405);
    assert.equal((await call('DELETE')).status, 405, 'there is no hard delete — not even as a verb');
    ok();
  }

  // ---- 2. GET → { ok, generatedAt, local, items, counts, filters, sources, overlay }, never cached ----
  {
    const g = await call('GET');
    assert.equal(g.status, 200); assert.equal(g.cache, 'no-store'); assert.match(g.type, /application\/json/);
    assert.deepEqual(Object.keys(g.json).sort(), ['counts', 'filters', 'generatedAt', 'items', 'local', 'ok', 'overlay', 'sources'].sort());
    assert.equal(g.json.ok, true);
    assert.equal(g.json.local.tz, 'America/Toronto');
    assert.ok(g.json.items.some((i) => i.id === 'todo:todo-a') && g.json.items.some((i) => i.id === 'ledger:#5') && g.json.items.some((i) => i.id === 'approval:apr-reply'));
    for (const i of g.json.items) assert.ok(!('_raw' in i) && !('_sig' in i), 'store internals never ship');
    assert.ok(!JSON.stringify(g.json).includes('ceo@acme.example') || g.json.items.find((i) => i.id === 'approval:apr-reply').detail.includes('ceo@acme.example'), 'an approval names its recipient in its own detail only');
    assert.ok(!JSON.stringify(g.json).includes('"text":"hi"'), 'a draft body never rides the list');
    assert.deepEqual(g.json.filters.map((f) => f.id), T.FILTER_IDS);
    assert.equal(g.json.sources.exec, 'ok'); assert.equal(g.json.sources.board, 'live');
    assert.ok(!('situation' in g.json), 'the situation rides only when asked for');
    const s = await call('GET', '?situation=1');
    assert.match(s.json.situation.text, /^Local time: /, '?situation=1 carries the block the brains read');
    const f = await call('GET', '?filter=approvals');
    assert.ok(f.json.items.length >= 1 && f.json.items.every((i) => i.kind === 'approval'));
    const q = await call('GET', '?filter=open&q=apollo');
    assert.deepEqual(q.json.items.map((i) => i.id).sort(), ['ledger:#5', 'todo:todo-b']);
    const bad = await call('GET', '?filter=everything');
    assert.equal(bad.status, 400); assert.equal(bad.cache, 'no-store');
    ok();
  }

  // ---- 3. POST — 400 for an unknown action / id / body, 409 for an action the row does not offer ----
  {
    const r1 = await call('POST', '', { action: 'frobnicate', id: 'todo:todo-a' });
    assert.equal(r1.status, 400); assert.equal(r1.json.code, 'unknown_action'); assert.equal(r1.cache, 'no-store');
    const r2 = await call('POST', '', { action: 'complete', id: 'todo:does-not-exist' });
    assert.equal(r2.status, 400); assert.equal(r2.json.code, 'unknown_id');
    const r3 = await call('POST', '', 'not json');
    assert.equal(r3.status, 400);
    const r4 = await call('POST', '', [1, 2]);
    assert.equal(r4.status, 400);
    const r5 = await call('POST', '', { action: 'complete' });
    assert.equal(r5.status, 400, 'no id and no match is a 400');
    const r6 = await call('POST', '', { action: 'approve', id: 'todo:todo-a' });
    assert.equal(r6.status, 409); assert.equal(r6.json.code, 'not_allowed'); assert.ok(r6.json.actions.includes('complete'));
    const r7 = await call('POST', '', { action: 'snooze', match: 'apollo', until: 'friday' });
    assert.equal(r7.status, 409); assert.equal(r7.json.code, 'ambiguous'); assert.equal(r7.json.candidates.length, 2);
    const r8 = await call('POST', '', { action: 'snooze', id: 'ledger:#5', until: 'whenever' });
    assert.equal(r8.status, 400); assert.equal(r8.json.code, 'bad_field');
    assert.equal(mem.read('axis-task-audit', 'log'), null, 'nothing refused was audited');
    ok();
  }

  // ---- 4. POST — 200 { ok, action, item, audit, receipt }; via defaults to console; the approval gate holds ----
  {
    const d = await call('POST', '', { action: 'complete', id: 'todo:todo-a' });
    assert.equal(d.status, 200); assert.equal(d.cache, 'no-store');
    for (const k of ['ok', 'action', 'item', 'audit', 'receipt']) assert.ok(k in d.json, `200 carries ${k}`);
    assert.equal(d.json.item.status, 'done'); assert.equal(d.json.receipt, '✔ Done: Sign the Whereby cancel');
    assert.equal(d.json.audit.via, 'console', 'a POST without via is a console click'); assert.equal(d.json.audit.actor, 'ahmad');
    const v = await call('POST', '', { action: 'snooze', id: 'ledger:#5', until: 'friday', via: 'voice' });
    assert.equal(v.json.audit.via, 'voice'); assert.match(v.json.receipt, /^⏰ Snoozed #5 Fix the Apollo payment method to /);
    const st = await call('POST', '', { action: 'approve', id: 'approval:apr-reply', via: 'chat' });
    assert.equal(st.status, 200); assert.equal(st.json.staged, true); assert.equal(st.json.needsClick, true);
    assert.equal(mem.read('axis-exec', 'approvals')[0].status, 'pending', 'a sending approval is not approved from chat');
    const click = await call('POST', '', { action: 'approve', id: 'approval:apr-reply' });
    assert.equal(click.json.item.status, 'approved'); assert.equal(mem.read('axis-exec', 'approvals')[0].status, 'approved');
    const fu = await call('POST', '', { action: 'followUp', id: 'todo:todo-b', when: 'next week', note: 'check the renewal' });
    assert.equal(fu.status, 200, 'the camelCase action names from the spec are accepted'); assert.ok(fu.json.created.id.startsWith('followup:'));
    const dr = await call('POST', '', { action: 'replyDraft', id: 'todo:todo-b', text: 'Draft body.' });
    assert.equal(dr.json.item.draft.docId, mem.read('axis-exec', 'workspace')[0].id);
    const cr = await call('POST', '', { action: 'create', title: 'Call the CDIC desk' });
    assert.ok(cr.json.item.id.startsWith('todo:'));
    const g = await call('GET', '?filter=all');
    assert.ok(g.json.items.find((i) => i.id === 'todo:todo-a').audit.length >= 1, 'the list carries each row\'s audit');
    assert.ok(g.json.overlay['ledger:#5'] && g.json.overlay['ledger:#5'].status === 'snoozed', 'the resolved overlay ships for the console queue');
    ok();
  }

  // ---- 5. A store that did not answer is unavailable, never an empty list; a write is refused with 503 ----
  {
    seed();
    mem.down('axis-exec');
    const g = await call('GET');
    assert.equal(g.status, 200); assert.equal(g.json.sources.exec, 'unavailable');
    assert.ok(!g.json.items.some((i) => i.source === 'todo'));
    const p = await call('POST', '', { action: 'create', title: 'x' });
    assert.equal(p.status, 503); assert.equal(p.json.code, 'store_unavailable'); assert.equal(p.cache, 'no-store');
    mem.up('axis-exec');
    ok();
  }

  // ---- 6. Static: literal config path, the Aperture gate, and no send / pay / publish path in the handler ----
  {
    const src = fs.readFileSync(path.join(ROOT, 'netlify/functions/axis-tasks.mjs'), 'utf8');
    assert.match(src, /export const config = \{ path: '\/api\/axis\/tasks' \};/, 'config.path is a static literal');
    assert.match(src, /if \(!verifyAperture\(req\)\) return jr\(401/);
    const lib = fs.readFileSync(path.join(ROOT, 'netlify/functions/lib/axis-tasks.cjs'), 'utf8');
    for (const [re, what] of [[/sendMail|nodemailer|api\.resend\.com/, 'mail'], [/stripe|paypal|checkout/i, 'payments'], [/api\.anthropic\.com/, 'a model call']])
      assert.ok(!re.test(src) && !re.test(lib), `the task endpoint has no ${what} path`);
    ok();
  }
} finally {
  T._setGetStore(null);
  if (prevSecret === undefined) delete process.env.APERTURE_JWT_SECRET; else process.env.APERTURE_JWT_SECRET = prevSecret;
}
console.log(`[axis-tasks-endpoint] ${groups} groups passed`);
