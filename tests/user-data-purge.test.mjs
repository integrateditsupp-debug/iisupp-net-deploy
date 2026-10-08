#!/usr/bin/env node
// user-data-purge.test.mjs — right-of-access + right-of-erasure contract for netlify/functions/lib/user-data.mjs.
// Seeds an in-memory stand-in for every Netlify Blobs store the audit (2026-10-08 §9) listed, with one
// person's data mixed in with a stranger's, then proves listStoresFor() finds exactly the person's records,
// purgeUserData() removes exactly those (and patches the ticket index / trace log), writes a tombstone, and
// aria-backup-cron's isTombstonedKey() skips the purged keys. No network, no Blobs credentials.
//   node tests/user-data-purge.test.mjs
import assert from 'node:assert/strict';
import { listStoresFor, purgeUserData, loadTombstones, isTombstonedKey, hash32, hash16, USER_STORES } from '../netlify/functions/lib/user-data.mjs';

let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

// ---- in-memory Blobs stand-in ------------------------------------------------
const stores = new Map();
function fakeStore(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const m = stores.get(name);
  return {
    async get(key, opts) { if (!m.has(key)) return null; const v = m.get(key); return opts && opts.type === 'json' ? JSON.parse(v) : v; },
    async set(key, val) { m.set(key, String(val)); },
    async setJSON(key, val) { m.set(key, JSON.stringify(val)); },
    async delete(key) { m.delete(key); },
    async list(o) { const prefix = o && o.prefix; return { blobs: [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
const getStore = ({ name }) => fakeStore(name);

const ME = 'dana.q@example.com';
const OTHER = 'someone.else@example.org';
const h32 = hash32(ME), h32o = hash32(OTHER);

// aria-sessions
await fakeStore('aria-sessions').setJSON('sess_me1/meta.json', { sessionId: 'sess_me1', ticket: 'ARIA-00000001', user: { firstName: 'Dana', lastName: 'Q', email: 'Dana.Q@example.com', phone: '416-555-0199' } });
await fakeStore('aria-sessions').set('sess_me1/events.jsonl', JSON.stringify({ type: 'message_user', payload: { text: 'my laptop is slow' } }) + '\n');
await fakeStore('aria-sessions').setJSON('sess_ot1/meta.json', { sessionId: 'sess_ot1', user: { email: OTHER } });
await fakeStore('aria-sessions').set('sess_ot1/events.jsonl', '{}\n');
// hash-keyed memory stores
await fakeStore('aria-session-memory').setJSON('user-' + h32, { turns: [{ role: 'user', content: 'hi' }] });
await fakeStore('aria-session-memory').setJSON('user-' + h32o, { turns: [] });
await fakeStore('aria-cross-device').setJSON('master-' + h32, { turns: [], devices: {} });
// learning (keyed by session id)
await fakeStore('aria-learning').setJSON('2026-10-01/sess_me1/1700000000', { session: 'sess_me1', userMessage: 'slow laptop' });
await fakeStore('aria-learning').setJSON('2026-10-01/sess_ot1/1700000001', { session: 'sess_ot1', userMessage: 'other' });
await fakeStore('aria-learning').setJSON('summary/2026-10-01', { total: 2 });
// traces (single log)
await fakeStore('aria-traces').set('log', JSON.stringify([
  { ts: 1, sessionId: 'sess_me1', userMsg: 'slow laptop' },
  { ts: 2, sessionId: 'web-2861', userMsg: 'please email dana.q@example.com the invoice' },
  { ts: 3, sessionId: 'sess_ot1', userMsg: 'other person' },
]));
// leads / bookings
await fakeStore('aria-leads').setJSON('health/1700_dana_q_example_com.json', { name: 'Dana', email: ME });
await fakeStore('aria-leads').setJSON('lead/1701_' + hash16(ME), { email: ME, message: 'call me' });
await fakeStore('aria-leads').setJSON('abuse/1702', { reporter: OTHER });
await fakeStore('aria-leads').setJSON('lead/1703_zzz', { email: OTHER });
await fakeStore('aria-bookings').setJSON('1704_dana.q@example.com.json', { user: { email: ME } });
await fakeStore('aria-bookings').setJSON('1705_' + hash16(OTHER) + '.json', { user: { email: OTHER } });
// calls (keyed by phone — linked through the session meta phone)
await fakeStore('aria-calls').setJSON('by-phone/+14165550199', { callIds: ['c1', 'c2'] });
await fakeStore('aria-calls').setJSON('call/c1', { phone: '+14165550199', summary: 'x' });
await fakeStore('aria-calls').setJSON('call/c2', { phone: '+14165550199', summary: 'y' });
await fakeStore('aria-calls').setJSON('by-phone/+14165550000', { callIds: ['c3'] });
await fakeStore('aria-calls').setJSON('call/c3', { phone: '+14165550000' });
// tickets + index
await fakeStore('aria-tickets').setJSON('tkt/TKT-1', { id: 'TKT-1', userEmail: ME, issue: 'slow' });
await fakeStore('aria-tickets').setJSON('tkt/TKT-2', { id: 'TKT-2', userEmail: OTHER, issue: 'other' });
await fakeStore('aria-tickets').setJSON('index', [{ id: 'TKT-1' }, { id: 'TKT-2' }]);
// licenses
await fakeStore('aria-licenses').setJSON('by-email/' + ME, { token: 'ARIA-PRO-AAAA-BBBB-CCCC', plan: 'pro' });
await fakeStore('aria-licenses').setJSON('ARIA-PRO-AAAA-BBBB-CCCC', { token: 'ARIA-PRO-AAAA-BBBB-CCCC', email: ME, plan: 'pro', active: true, deviceFingerprints: [] });
await fakeStore('aria-licenses').setJSON('by-email/' + OTHER, { token: 'ARIA-PRO-ZZZZ-ZZZZ-ZZZZ' });
await fakeStore('aria-licenses').setJSON('ARIA-PRO-ZZZZ-ZZZZ-ZZZZ', { email: OTHER, active: true, deviceFingerprints: [] });

console.log('[user-data] listStoresFor (export)');
const found = await listStoresFor('Dana.Q@example.com', { getStore });
ok('every audited store is covered', USER_STORES.every((s) => s in found.stores));
ok('aria-sessions: only my session (meta + events)', found.stores['aria-sessions'].keys.sort().join() === 'sess_me1/events.jsonl,sess_me1/meta.json' && /slow/.test(found.stores['aria-sessions'].records[0].events));
ok('phone linked from the session meta (E.164)', found.phone === '+14165550199');
ok('session memory + cross-device by hash', found.stores['aria-session-memory'].keys[0] === 'user-' + h32 && found.stores['aria-cross-device'].keys[0] === 'master-' + h32);
ok('learning: only my session\'s turns, not the daily summary', found.stores['aria-learning'].keys.join() === '2026-10-01/sess_me1/1700000000');
ok('traces: by session id AND by my email in the message', found.stores['aria-traces'].matched === 2);
ok('leads: health + lead keys (by sanitized email, by hash, by record email) and not the stranger', found.stores['aria-leads'].keys.sort().join() === ['health/1700_dana_q_example_com.json', 'lead/1701_' + hash16(ME)].sort().join());
ok('bookings: raw-email key found, stranger untouched', found.stores['aria-bookings'].keys.join() === '1704_dana.q@example.com.json');
ok('calls: index + both calls for my phone', found.stores['aria-calls'].keys.sort().join() === 'by-phone/+14165550199,call/c1,call/c2');
ok('tickets: mine only', found.stores['aria-tickets'].keys.join() === 'tkt/TKT-1');
ok('licenses: by-email + token record, token masked in the export', found.stores['aria-licenses'].keys.includes('ARIA-PRO-AAAA-BBBB-CCCC') && found.stores['aria-licenses'].records[0].record.token === 'ARIA…CCCC');
ok('errors list empty on a healthy run', found.errors.length === 0);

console.log('[user-data] purgeUserData (erasure)');
const dry = await purgeUserData(ME, { getStore, dryRun: true });
ok('dry run counts but deletes nothing', dry.dry_run === true && dry.purged['aria-tickets'] === 1 && stores.get('aria-tickets').has('tkt/TKT-1'));
const purge = await purgeUserData(ME, { getStore });
ok('sessions purged', !stores.get('aria-sessions').has('sess_me1/meta.json') && !stores.get('aria-sessions').has('sess_me1/events.jsonl') && stores.get('aria-sessions').has('sess_ot1/meta.json'));
ok('memory stores purged; stranger kept', !stores.get('aria-session-memory').has('user-' + h32) && stores.get('aria-session-memory').has('user-' + h32o) && !stores.get('aria-cross-device').has('master-' + h32));
ok('learning purged by session; summary kept', !stores.get('aria-learning').has('2026-10-01/sess_me1/1700000000') && stores.get('aria-learning').has('summary/2026-10-01') && stores.get('aria-learning').has('2026-10-01/sess_ot1/1700000001'));
const log = JSON.parse(await fakeStore('aria-traces').get('log'));
ok('trace log rewritten WITHOUT my entries, stranger\'s entry kept', log.length === 1 && log[0].sessionId === 'sess_ot1' && purge.purged['aria-traces'] === 2);
ok('leads + bookings purged; strangers kept', !stores.get('aria-leads').has('health/1700_dana_q_example_com.json') && stores.get('aria-leads').has('lead/1703_zzz') && !stores.get('aria-bookings').has('1704_dana.q@example.com.json') && stores.get('aria-bookings').size === 1);
ok('calls purged (index + records); other phone kept', !stores.get('aria-calls').has('by-phone/+14165550199') && !stores.get('aria-calls').has('call/c1') && stores.get('aria-calls').has('call/c3'));
const idx = JSON.parse(await fakeStore('aria-tickets').get('index'));
ok('ticket purged and index patched', !stores.get('aria-tickets').has('tkt/TKT-1') && idx.length === 1 && idx[0].id === 'TKT-2');
ok('license + by-email purged; stranger kept', !stores.get('aria-licenses').has('ARIA-PRO-AAAA-BBBB-CCCC') && !stores.get('aria-licenses').has('by-email/' + ME) && stores.get('aria-licenses').has('ARIA-PRO-ZZZZ-ZZZZ-ZZZZ'));
ok('keys_purged lists every deleted key qualified by store', purge.keys_purged.includes('aria-tickets:tkt/TKT-1') && purge.keys_purged.includes('aria-session-memory:user-' + h32));
ok('tombstone written', purge.tombstone && stores.get('aria-deletion-log').has(purge.tombstone));

console.log('[user-data] backup-cron tombstone skip');
const tombs = await loadTombstones({ getStore });
ok('tombstone loads with hash32 + sanitized email + hashed keys, and NO raw email anywhere', tombs.length === 1 && tombs[0].hash32 === h32 && tombs[0].sanitized === 'dana_q_example_com' && Array.isArray(tombs[0].key_hashes) && !JSON.stringify(tombs[0]).toLowerCase().includes('dana.q@'));
ok('a re-created raw-email booking key is skipped (email embedded in the key)', isTombstonedKey('9999_dana.q@example.com.json', tombs, 'aria-bookings') === true);
ok('a purged key is skipped by store:key', isTombstonedKey('tkt/TKT-1', tombs, 'aria-tickets') === true);
ok('a re-created hash-keyed record for the same person is skipped', isTombstonedKey('user-' + h32, tombs, 'aria-session-memory') === true);
ok('a re-created lead with the sanitized email in the key is skipped', isTombstonedKey('health/9999_dana_q_example_com.json', tombs, 'aria-leads') === true);
ok('a stranger\'s key is NOT skipped', isTombstonedKey('user-' + h32o, tombs, 'aria-session-memory') === false && isTombstonedKey('tkt/TKT-2', tombs, 'aria-tickets') === false);

const again = await listStoresFor(ME, { getStore });
ok('after purge, export finds nothing', Object.values(again.stores).every((e) => e.keys.length === 0));

console.log(`\nuser-data-purge: ${pass} checks passed`);
