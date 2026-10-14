#!/usr/bin/env node
// sentinel-fleet-endpoints.test.mjs — SENTINEL-BACKEND 2026-10-14 (audit B8 / B10 / B13 / B19 / B20).
// The DEPLOYED fleet endpoints against an in-memory Blobs store:
//   - aria-sentinel-heartbeat: the app's response shape + the stub's licenseActive + {killed, reason} exactly
//     as ARIA Sentinel/src/shared/kill-switch.mjs parseControlPlaneKill reads it; env kill + per-tenant
//     disabled; a WRITE needs x-sentinel-key and is keyed by sha256(credential); a bad credential is 401;
//   - aria-sentinel-update-manifest: x-sentinel-key (or the legacy ?license=, hashed) selects the record;
//     the client's ?rollout= is ignored, the server's rollout + version_pin are honoured; url from the record;
//   - aria-sentinel-update-publish: keeps url + mandatory, refuses a host the desktop cannot reach, both
//     admin env names work, disable/rollout, 503 when the store is down;
//   - aria-sentinel-license-register: credential required (header or hashed legacy body key), record keyed
//     by the credential with key_hash and no raw key, seats/overSeats honest;
//   - aria-sentinel-license-search: masks any raw key, rollback by credential;
//   - aria-recipes / aria-stop-codes: config.path covers every path the desktop declares (recipes.mjs).
//   node tests/sentinel-fleet-endpoints.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { parseControlPlaneKill } from '../ARIA Sentinel/src/shared/kill-switch.mjs';
import { ALLOWED_OUTBOUND_PATHS, RECIPE_ENDPOINT, STOP_CODES_ENDPOINT } from '../ARIA Sentinel/src/shared/recipes.mjs';
import { SERVICE_OUTBOUND_PATHS, UPDATE_OUTBOUND_PATHS } from '../ARIA Sentinel/src/shared/network-capture.mjs';
import { issuePlanKey } from '../ARIA Sentinel/src/shared/license-features.mjs';

const require_ = createRequire(import.meta.url);
let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log('  ✓ ' + label); };

for (const k of ['SENTINEL_LICENSE_SECRET', 'SENTINEL_ADMIN_TOKEN', 'ARIA_ADMIN_TOKEN', 'INTERNAL_WEBHOOK_SECRET', 'ARIA_RECIPES_KILLED', 'ARIA_RECIPES_KILL_REASON', 'SENTINEL_UPDATE_HOSTS']) delete process.env[k];
process.env.SENTINEL_LICENSE_SECRET = 'test-license-secret-0123456789';
global.fetch = async (url) => { throw new Error('unexpected network call in test: ' + String(url)); };

const stores = new Map();
let blobsDown = false;
function memStore(name) {
  if (blobsDown) return null;
  if (!stores.has(name)) {
    const m = new Map();
    stores.set(name, {
      async get(k, o) { const v = m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; },
      async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
      async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
      _m: m
    });
  }
  return stores.get(name);
}
const S = require_('../netlify/functions/lib/sentinel-store.cjs');
S._setStoreFactory((name) => memStore(name));
// One-process registry safety: the approvals seam must point at this suite's stores too.
const A = require_('../netlify/functions/lib/sentinel-approvals.cjs');
A._setStoreFactory((name) => memStore(name));
require_('../netlify/functions/_rate-limit.js').resetRateLimits();
const V2 = require_('../netlify/functions/lib/sentinel-license-v2.cjs');
const heartbeat = await import('../netlify/functions/aria-sentinel-heartbeat.js');
const manifest = await import('../netlify/functions/aria-sentinel-update-manifest.js');
const publish = await import('../netlify/functions/aria-sentinel-update-publish.js');
const register = await import('../netlify/functions/aria-sentinel-license-register.js');
const search = await import('../netlify/functions/aria-sentinel-license-search.js');
const recipes = await import('../netlify/functions/aria-recipes.mjs');
const stopCodes = await import('../netlify/functions/aria-stop-codes.mjs');

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const planKey = issuePlanKey('pro', process.env.SENTINEL_LICENSE_SECRET);
const v1Cred = sha(planKey);
const v2Key = V2.issueCustomerKey({ plan: 'smb', customerId: 'sub_fleet', secret: process.env.SENTINEL_LICENSE_SECRET });
const v2Cred = V2.keyHash(v2Key);
await memStore('sentinel-license-keys').setJSON(v2Cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_fleet', tier: 'smb', status: 'active', seats: 2, key_version: 2, email: 'it@fleet.example', contacts: [], disabled: false });
const J = (r) => { try { return JSON.parse(r.body); } catch { return null; } };

console.log('[heartbeat] response shape + kill directive (B10)');
{
  const payload = { licenseId: planKey.slice(0, 16), version: '0.1.16', lastUpdateState: 'idle', startupEnabled: true, uptimeHours: 3, healthScore: 91, platform: 'win32', osBuild: '10.0.22631', timestamp: '2026-10-14T10:00:00.000Z' };
  const anon = await heartbeat.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const a = J(anon);
  ok('unauthenticated ping → 200 with the app shape (ok, valid:false, latestVersion, mandatoryUpdate, advisoryMessage, nextCheckIn, serverTime)', anon.statusCode === 200 && a.ok === true && a.valid === false && 'latestVersion' in a && a.mandatoryUpdate === false && /not recognized/.test(a.advisoryMessage) && a.nextCheckIn === 86400 && a.serverTime);
  ok('…and the stub\'s licenseActive (Rule 15) + killed:false reason:"" + recorded:false', a.licenseActive === false && a.killed === false && a.reason === '' && a.recorded === false && a.auth === 'none');
  ok('parseControlPlaneKill sees the directive as present and not killed', parseControlPlaneKill(a).present === true && parseControlPlaneKill(a).killed === false);
  ok('nothing was written without a credential', !stores.has('heartbeats'));
  process.env.ARIA_RECIPES_KILLED = '1'; process.env.ARIA_RECIPES_KILL_REASON = 'Fleet paused by ops';
  const killed = J(await heartbeat.handler({ httpMethod: 'POST', headers: {}, body: '{}' }));
  ok('ARIA_RECIPES_KILLED=1 → killed:true with the reason, and the desktop parser agrees', killed.killed === true && killed.reason === 'Fleet paused by ops' && parseControlPlaneKill(killed).killed === true && parseControlPlaneKill(killed).reason === 'Fleet paused by ops');
  delete process.env.ARIA_RECIPES_KILLED; delete process.env.ARIA_RECIPES_KILL_REASON;
  ok('GET → 405', (await heartbeat.handler({ httpMethod: 'GET', headers: {} })).statusCode === 405);
  ok('bad JSON → 400', (await heartbeat.handler({ httpMethod: 'POST', headers: {}, body: '{nope' })).statusCode === 400);
}

console.log('[heartbeat] device auth → fleet record keyed by sha256(credential)');
{
  const payload = { licenseId: planKey.slice(0, 16), version: '0.1.16', platform: 'win32', osBuild: '10.0.22631', healthScore: 91 };
  const bad = await heartbeat.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': 'f'.repeat(64) }, body: JSON.stringify(payload) });
  ok('unknown credential → 401', bad.statusCode === 401);
  const r = J(await heartbeat.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': v1Cred }, body: JSON.stringify(payload) }));
  ok('a v1 plan credential → valid:true, licenseActive:true, plan pro, recorded:true', r.valid === true && r.licenseActive === true && r.plan === 'pro' && r.recorded === true && r.auth === 'device');
  const keys = [...memStore('heartbeats')._m.keys()];
  ok('the record key is <day>/<sha256(credential)> — a one-way id, never the credential or the key', keys.length === 1 && keys[0].endsWith('/' + sha(v1Cred)) && !keys[0].includes(v1Cred));
  const rec = JSON.parse(memStore('heartbeats')._m.get(keys[0]));
  ok('the stored record holds the allow-listed fields and the licenseId only as a hash (never 16 chars of the raw key)', rec.version === '0.1.16' && rec.healthScore === 91 && rec.licenseId !== planKey.slice(0, 16) && /^[a-f0-9]{16}$/.test(rec.licenseId) && rec.tenant === sha(v1Cred) && rec.plan === 'pro');
  ok('no raw payload extras are stored', !('evil' in JSON.parse(memStore('heartbeats')._m.get(keys[0]))));
  const v2 = J(await heartbeat.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': v2Cred }, body: JSON.stringify({ ...payload, evil: 'C:\\Users\\x' }) }));
  ok('a v2 credential → plan smb from the key index, tenantDisabled:false', v2.plan === 'smb' && v2.tenantDisabled === false && v2.killed === false);
  await memStore('sentinel-license-keys').setJSON(v2Cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_fleet', tier: 'smb', status: 'active', seats: 2, key_version: 2, email: 'it@fleet.example', contacts: [], disabled: true });
  const dis = J(await heartbeat.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': v2Cred }, body: JSON.stringify(payload) }));
  ok('per-tenant disabled → killed:true "Customer policy disabled fixes." (the desktop wording), tenantDisabled:true', dis.killed === true && dis.reason === 'Customer policy disabled fixes.' && dis.tenantDisabled === true && parseControlPlaneKill(dis).killed === true);
  await memStore('sentinel-license-keys').setJSON(v2Cred, { v: 'sentinel-license-key-v1', subscription_id: 'sub_fleet', tier: 'smb', status: 'active', seats: 2, key_version: 2, email: 'it@fleet.example', contacts: [], disabled: false });
  await memStore('sentinel-licenses-revocations').setJSON(v2Cred, { revoked: true });
  ok('revoked credential → 401 license-revoked', J(await heartbeat.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': v2Cred }, body: '{}' })).error === 'license-revoked');
  memStore('sentinel-licenses-revocations')._m.clear();
  blobsDown = true;
  const down = J(await heartbeat.handler({ httpMethod: 'POST', headers: { 'x-sentinel-key': v1Cred }, body: JSON.stringify(payload) }));
  ok('Blobs down → the ping still answers 200 (recorded:false), never breaks the daily keepalive', down && down.ok === true && down.recorded === false);
  blobsDown = false;
}

console.log('[publish] url + mandatory kept, hosts validated, admin env aliases (B13)');
{
  const post = (body, headers = {}) => publish.handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) });
  ok('no admin token configured → 401 admin-token-not-configured', (await post({ version: '0.2.0', sha512: 'a'.repeat(128) })).statusCode === 401);
  process.env.ARIA_ADMIN_TOKEN = 'aria-admin-0123456789';
  ok('ARIA_ADMIN_TOKEN works (the app alias the root copy used to refuse)', J(await post({ action: 'rollout', percent: 50 }, { 'x-admin-token': 'aria-admin-0123456789' })).rollout === 50);
  delete process.env.ARIA_ADMIN_TOKEN;
  process.env.SENTINEL_ADMIN_TOKEN = 'sentinel-admin-0123456789';
  const H = { 'x-admin-token': 'sentinel-admin-0123456789' };
  ok('wrong token → 401', (await post({ version: '0.2.0', sha512: 'a'.repeat(128) }, { 'x-admin-token': 'nope' })).statusCode === 401);
  ok('missing version/sha512 → 400', J(await post({ version: '0.2.0' }, H)).error === 'version-and-sha512-required');
  ok('malformed version → 400', J(await post({ version: 'latest', sha512: 'a'.repeat(128) }, H)).error === 'version-malformed');
  const gh = await post({ version: '0.2.0', sha512: 'a'.repeat(128), url: 'https://github.com/x/y/releases/download/v0.2.0/a.exe' }, H);
  ok('a github.com url → 400 url-host-not-allowed (the desktop\'s allow-list cannot reach it) with the allowed hosts named', gh.statusCode === 400 && J(gh).error === 'url-host-not-allowed' && J(gh).allowedHosts.includes('download.iisupp.net'));
  ok('http:// → 400 url-not-https', J(await post({ version: '0.2.0', sha512: 'a'.repeat(128), url: 'http://iisupp.net/x.exe' }, H)).error === 'url-not-https');
  process.env.SENTINEL_UPDATE_HOSTS = 'github.com';
  ok('SENTINEL_UPDATE_HOSTS extends the allowed hosts', publish.validateUpdateUrl('https://github.com/x/y.exe').ok === true);
  delete process.env.SENTINEL_UPDATE_HOSTS;
  const pub = J(await post({ version: '0.2.0', sha512: 'a'.repeat(128), size: 123, url: 'https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.0.exe', mandatory: true, release_notes: 'first signed build' }, H));
  ok('publish → {ok, published:0.2.0, count:1, url, mandatory:true}', pub.ok === true && pub.published === '0.2.0' && pub.count === 1 && pub.url === 'https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.0.exe' && pub.mandatory === true);
  const index = await memStore('versions').get('index', { type: 'json' });
  ok('the stored record keeps url + mandatory + path-less default', index[0].url === 'https://download.iisupp.net/sentinel/ARIA-Sentinel-0.2.0.exe' && index[0].mandatory === true && index[0].disabled === false);
  ok('an update-events audit row was written', stores.has('update-events') && memStore('update-events')._m.size >= 2);
  await post({ version: '0.1.16', sha512: 'b'.repeat(128), size: 100 }, H);
  const dis = J(await post({ action: 'disable', version: '0.2.0', disabled: true }, H));
  ok('disable flips the record', dis.disabled === true && (await memStore('versions').get('index', { type: 'json' })).find((v) => v.version === '0.2.0').disabled === true);
  blobsDown = true;
  ok('store down → 503 JSON', (await post({ version: '0.3.0', sha512: 'c'.repeat(128) }, H)).statusCode === 503);
  blobsDown = false;
  delete process.env.SENTINEL_ADMIN_TOKEN;
}

console.log('[manifest] credential in the header, server-side rollout, record url (B13)');
{
  const get = (query = {}, headers = {}) => manifest.handler({ httpMethod: 'GET', headers, queryStringParameters: query });
  // versions: 0.2.0 disabled (above), 0.1.16 live
  const r = await get({});
  ok('no credential → latest live version (0.1.16; 0.2.0 is disabled)', r.statusCode === 200 && /^version: 0\.1\.16/m.test(r.body));
  process.env.SENTINEL_ADMIN_TOKEN = 'sentinel-admin-0123456789';
  await publish.handler({ httpMethod: 'POST', headers: { 'x-admin-token': 'sentinel-admin-0123456789' }, body: JSON.stringify({ action: 'disable', version: '0.2.0', disabled: false }) });
  await publish.handler({ httpMethod: 'POST', headers: { 'x-admin-token': 'sentinel-admin-0123456789' }, body: JSON.stringify({ action: 'rollout', percent: 100 }) });
  const latest = await get({});
  ok('re-enabled → 0.2.0 with the record\'s url (not the iisupp.net/sentinel-binaries default)', /^version: 0\.2\.0/m.test(latest.body) && /url: https:\/\/download\.iisupp\.net\/sentinel\/ARIA-Sentinel-0\.2\.0\.exe/.test(latest.body) && latest.headers['content-type'] === 'text/yaml');
  // version pin via the device registry record (keyed by credential)
  await memStore('licenses').setJSON(v1Cred, { key_hash: v1Cred, version_pin: '0.1.16', devices: [] });
  const pinned = await get({}, { 'x-sentinel-key': v1Cred });
  ok('x-sentinel-key selects the record → version_pin 0.1.16 served', /^version: 0\.1\.16/m.test(pinned.body));
  const legacy = await get({ license: planKey });
  ok('legacy ?license=<raw key> is hashed to the same record (Rule 15)', /^version: 0\.1\.16/m.test(legacy.body));
  // rollout: server says 0 → everyone holds on the older version; client ?rollout=100 is ignored
  await publish.handler({ httpMethod: 'POST', headers: { 'x-admin-token': 'sentinel-admin-0123456789' }, body: JSON.stringify({ action: 'rollout', percent: 0 }) });
  const held = await get({ rollout: '100' }, { 'x-sentinel-key': v2Cred });
  ok('server rollout 0% → an unpinned device is held on 0.1.16 even though it asked ?rollout=100', /^version: 0\.1\.16/m.test(held.body));
  await publish.handler({ httpMethod: 'POST', headers: { 'x-admin-token': 'sentinel-admin-0123456789' }, body: JSON.stringify({ action: 'rollout', percent: 100 }) });
  ok('server rollout 100% → 0.2.0', /^version: 0\.2\.0/m.test((await get({}, { 'x-sentinel-key': v2Cred })).body));
  memStore('licenses')._m.clear();
  memStore('versions')._m.clear();
  ok('no versions → 204', (await get({})).statusCode === 204);
  delete process.env.SENTINEL_ADMIN_TOKEN;
}

console.log('[register] credential required, record keyed by credential, no raw key stored');
{
  const post = (body, headers = {}) => register.handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  ok('no credential and no key → 400 invalid-license-key', J(await post({ email: 'x@example.com' })).error === 'invalid-license-key');
  ok('a well-formed but unknown key → 401 (before today: registered blindly)', (await post({ license_key: 'f'.repeat(64) })).statusCode === 401);
  const legacy = J(await post({ license_key: planKey, email: 'dev@example.com', first_name: 'Dev', company: 'Acme', device_id: 'dev-1', os: 'win32', version: '0.1.16' }));
  ok('legacy body key (hashed on arrival) → {ok, devices:1, seats:null (v1 plan key), plan pro}', legacy.ok === true && legacy.devices === 1 && legacy.seats === null && legacy.plan === 'pro');
  const keys = [...memStore('licenses')._m.keys()];
  ok('the record is keyed by sha256(key), holds key_hash, and NOT the raw key', keys[0] === v1Cred && !memStore('licenses')._m.get(v1Cred).includes(planKey) && JSON.parse(memStore('licenses')._m.get(v1Cred)).key_hash === v1Cred);
  const h = J(await post({ device_id: 'dev-2', os: 'win32', version: '0.1.16', company: 'C:\\Users\\sam\\corp' }, { 'x-sentinel-key': v1Cred }));
  ok('header credential → same record, second device appended, path scrubbed from free text', h.devices === 2 && JSON.parse(memStore('licenses')._m.get(v1Cred)).company === 'Acme');
  const again = J(await post({ device_id: 'dev-2', os: 'win32', version: '0.1.17' }, { 'x-sentinel-key': v1Cred }));
  ok('the same device_id upserts (still 2 devices)', again.devices === 2);
  const s1 = J(await post({ device_id: 'a' }, { 'x-sentinel-key': v2Cred }));
  const s2 = J(await post({ device_id: 'b' }, { 'x-sentinel-key': v2Cred }));
  const s3 = J(await post({ device_id: 'c' }, { 'x-sentinel-key': v2Cred }));
  ok('a v2 credential reports seats from the record and overSeats honestly (2 seats, 3 devices)', s1.seats === 2 && s2.overSeats === false && s3.devices === 3 && s3.overSeats === true);
  ok('GET → 405, OPTIONS → 204', (await register.handler({ httpMethod: 'GET', headers: {} })).statusCode === 405 && (await register.handler({ httpMethod: 'OPTIONS', headers: {} })).statusCode === 204);
}

console.log('[search] admin-only, masked keys, rollback by credential (B19)');
{
  process.env.SENTINEL_ADMIN_TOKEN = 'sentinel-admin-0123456789';
  const H = { 'x-admin-token': 'sentinel-admin-0123456789' };
  ok('no token → 401', (await search.handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { q: '' } })).statusCode === 401);
  await memStore('licenses').setJSON('legacy-raw-key-record', { license_key: planKey, email: 'legacy@example.com', devices: [] });
  const r = J(await search.handler({ httpMethod: 'GET', headers: H, queryStringParameters: { q: '' } }));
  ok('results list every record with key_hash and a MASKED legacy license_key', r.total === 3 && r.results.every((x) => !x.license_key || /^[a-f0-9]{4}…[a-f0-9]{4}$/.test(x.license_key)) && !JSON.stringify(r).includes(planKey));
  const rb = J(await search.handler({ httpMethod: 'POST', headers: H, body: JSON.stringify({ action: 'rollback', keys: [v1Cred, planKey], version_pin: '0.1.16' }) }));
  ok('rollback accepts a credential or a legacy raw key (hashed) and pins the record once', rb.rolledBack === 1 && JSON.parse(memStore('licenses')._m.get(v1Cred)).version_pin === '0.1.16');
  ok('scope:all without confirm → 400', J(await search.handler({ httpMethod: 'POST', headers: H, body: JSON.stringify({ action: 'rollback', scope: 'all', version_pin: '0.1.16' }) })).error === 'all-machines-requires-confirm');
  const all = J(await search.handler({ httpMethod: 'POST', headers: H, body: JSON.stringify({ action: 'rollback', scope: 'all', confirm_all: true, version_pin: null }) }));
  ok('scope:all + confirm → every record touched', all.rolledBack === 3);
  delete process.env.SENTINEL_ADMIN_TOKEN;
}

console.log('[recipes / stop-codes] served at every path the desktop declares (B8)');
{
  const declared = ALLOWED_OUTBOUND_PATHS.filter((p) => p.id === 'recipes' || p.id === 'stop-codes').map((p) => p.path);
  ok('config.path arrays cover /.netlify/functions/aria-recipes + /.netlify/functions/aria-stop-codes', recipes.config.path.includes(new URL(RECIPE_ENDPOINT).pathname) && stopCodes.config.path.includes(new URL(STOP_CODES_ENDPOINT).pathname) && declared.every((p) => recipes.config.path.includes(p) || stopCodes.config.path.includes(p)));
  ok('the pretty paths are still served (Rule 15)', recipes.config.path.includes('/aria-recipes') && stopCodes.config.path.includes('/aria-stop-codes'));
  const res = await recipes.default(new Request('https://iisupp.net/.netlify/functions/aria-recipes'));
  const body = await res.json();
  ok('the recipes body still carries the kill-switch fields the desktop parses', res.status === 200 && 'killed' in body && 'reason' in body && parseControlPlaneKill(body).present === true && res.headers.get('x-aria-recipes-sha256'));
  const sc = await stopCodes.default(new Request('https://iisupp.net/.netlify/functions/aria-stop-codes?q=0x0000003B'));
  ok('stop-codes still filters by ?q=', sc.status === 200 && (await sc.json()).stopCodes.length >= 1);
  // every SERVICE / UPDATE path the desktop declares maps to a deployed function file (static contract)
  const fs = await import('node:fs');
  const path = await import('node:path');
  // Resolved from this file, not the cwd: the desktop registry runs suites with cwd = "ARIA Sentinel/".
  const FN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'netlify', 'functions');
  const fnFiles = fs.readdirSync(FN);
  const hasFn = (p) => { const name = p.replace('/.netlify/functions/', ''); return fnFiles.some((f) => f.replace(/\.(m?js|cjs|mts)$/, '') === name); };
  const missing = [...SERVICE_OUTBOUND_PATHS, ...UPDATE_OUTBOUND_PATHS].filter((p) => p.startsWith('/.netlify/functions/') && !hasFn(p));
  ok('every /.netlify/functions path in SERVICE_OUTBOUND_PATHS + UPDATE_OUTBOUND_PATHS has a deployed function (' + (missing.join(', ') || 'none missing') + ')', missing.length === 0);
}

console.log(`sentinel-fleet-endpoints: ${pass} checks green — heartbeat shape + killed/reason + tenant disabled + one-way record keys, publish url/mandatory/host validation, manifest header credential + server rollout + record url, register by credential, search masks keys, recipes/stop-codes at the declared paths.`);
