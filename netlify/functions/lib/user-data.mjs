// lib/user-data.mjs — right-of-access (export) and right-of-erasure (purge) across every Netlify Blobs
// store that holds a person's content. Audit 2026-10-08 §9/top-10 #10: aria-account-delete and
// aria-data-export only touched Stripe while transcripts, memory, leads, bookings, calls, tickets and
// licenses lived on indefinitely (and were re-snapshotted by aria-backup-cron for 12 weeks).
//
//   listStoresFor(email, opts)  → { email_hash, phone, stores:{ <store>:{ keys:[], records:[] } }, errors:[] }
//   purgeUserData(email, opts)  → { email_hash, purged:{ <store>:n }, keys_purged:[], errors:[], tombstone }
//   loadTombstones(opts)        → [ {email_hash, hash32, sanitized, key_hashes, ts} ]    (for backup-cron)
//   isTombstonedKey(key, tombs) → boolean
//
// opts.getStore lets tests (and crons) inject a store factory; default is @netlify/blobs getStore.
// opts.phone optionally adds the user's phone so aria-calls (keyed by phone) can be covered when no
// aria-sessions record links the two.
//
// How each store keys a person (from the writers, see audit §9):
//   aria-sessions        `${sessionId}/meta.json`  (meta.user.email/phone) + `${sessionId}/events.jsonl`
//   aria-session-memory  `user-<sha256(email).slice(0,32)>`
//   aria-cross-device    `master-<sha256(email).slice(0,32)>`
//   aria-learning        `${date}/${sessionId}/${ts}`  (sessionId only → linked through aria-sessions)
//   aria-traces          single `log` key: array of {sessionId, userMsg, ...}
//   aria-leads           `health/${ts}_${sanitized-email}.json`, `lead/${ts}_${hash16}`, others with .email
//   aria-bookings        `${ts}_${raw-email}.json`  (user.email)
//   aria-calls           `by-phone/${E.164}` → {callIds[]}  and `call/${id}`
//   aria-tickets         `tkt/${id}` (userEmail) + `index` array
//   aria-licenses        `by-email/${raw-email}` → {token} and `${token}` record

import crypto from 'node:crypto';

export const USER_STORES = [
  'aria-sessions', 'aria-session-memory', 'aria-cross-device', 'aria-learning', 'aria-traces',
  'aria-leads', 'aria-bookings', 'aria-calls', 'aria-tickets', 'aria-licenses',
];
const TOMBSTONE_STORE = 'aria-deletion-log';
const MAX_LIST = 5000;      // hard cap on keys scanned per store (keeps the function inside its timeout)
const MAX_RECORDS = 400;    // cap on records returned per store in an export

export function hash32(email) { return crypto.createHash('sha256').update(String(email || '').toLowerCase().trim()).digest('hex').slice(0, 32); }
export function hash16(email) { return hash32(email).slice(0, 16); }
/** Hash of a qualified `${store}:${key}` — tombstones keep these instead of raw keys (keys can contain emails). */
export function keyHash(storeName, key) { return crypto.createHash('sha256').update(String(storeName) + ':' + String(key)).digest('hex').slice(0, 24); }
const EMAIL_IN_KEY_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
export function sanitizedEmail(email) { return String(email || '').replace(/[^a-z0-9]/gi, '_'); }

export function normalizePhone(s) {
  const digits = String(s || '').replace(/[^0-9+]/g, '');
  if (!digits) return null;
  if (digits.charAt(0) === '+') return digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
  return null;
}

async function resolveGetStore(opts) {
  if (opts && typeof opts.getStore === 'function') return opts.getStore;
  const mod = await import('@netlify/blobs');
  return mod.getStore;
}

async function listKeys(store, prefix) {
  const out = [];
  try {
    const res = await store.list(prefix ? { prefix } : undefined);
    for (const b of (res && res.blobs) || []) {
      out.push(b.key);
      if (out.length >= MAX_LIST) break;
    }
  } catch (e) {
    throw new Error('list failed: ' + (e && e.message));
  }
  return out;
}

async function getJson(store, key) {
  try { return await store.get(key, { type: 'json' }); } catch { return null; }
}

/**
 * Walk every store and collect the keys (and, for export, the records) that belong to `email`.
 */
export async function listStoresFor(email, opts = {}) {
  const em = String(email || '').toLowerCase().trim();
  const getStore = await resolveGetStore(opts);
  const h32 = hash32(em), h16 = hash16(em), san = sanitizedEmail(em);
  const out = { email_hash: h16, phone: normalizePhone(opts.phone) || null, stores: {}, errors: [], session_ids: [] };
  const want = Array.isArray(opts.stores) && opts.stores.length ? opts.stores : USER_STORES;
  const open = (name) => { try { return getStore({ name, consistency: 'strong' }); } catch (e) { out.errors.push(name + ': ' + (e && e.message)); return null; } };
  const sessionIds = new Set();

  // 1. aria-sessions — the link between email, phone and session ids.
  if (want.includes('aria-sessions')) {
    const name = 'aria-sessions';
    const entry = { keys: [], records: [] };
    const st = open(name);
    if (st) {
      try {
        const keys = await listKeys(st);
        for (const k of keys) {
          if (!k.endsWith('/meta.json')) continue;
          const meta = await getJson(st, k);
          const mEmail = meta && meta.user && String(meta.user.email || '').toLowerCase().trim();
          if (mEmail && mEmail === em) {
            const sid = k.slice(0, -'/meta.json'.length);
            sessionIds.add(sid);
            entry.keys.push(k, sid + '/events.jsonl');
            if (entry.records.length < MAX_RECORDS) {
              let events = null;
              try { events = await st.get(sid + '/events.jsonl', { type: 'text' }); } catch { events = null; }
              entry.records.push({ key: k, meta, events: events || null });
            }
            if (!out.phone && meta.user && meta.user.phone) out.phone = normalizePhone(meta.user.phone);
          }
        }
      } catch (e) { out.errors.push(name + ': ' + e.message); }
    }
    out.stores[name] = entry;
  }
  out.session_ids = Array.from(sessionIds);

  // 2. Hash-keyed stores — one key each.
  for (const [name, key] of [['aria-session-memory', 'user-' + h32], ['aria-cross-device', 'master-' + h32]]) {
    if (!want.includes(name)) continue;
    const entry = { keys: [], records: [] };
    const st = open(name);
    if (st) {
      const rec = await getJson(st, key);
      if (rec) { entry.keys.push(key); entry.records.push({ key, record: rec }); }
    }
    out.stores[name] = entry;
  }

  // 3. aria-learning — linked by session id in the key `${date}/${sessionId}/${ts}`.
  if (want.includes('aria-learning')) {
    const name = 'aria-learning';
    const entry = { keys: [], records: [], note: sessionIds.size ? null : 'no linked session ids (aria-learning is keyed by session, not email)' };
    const st = open(name);
    if (st && sessionIds.size) {
      try {
        const keys = await listKeys(st);
        for (const k of keys) {
          const parts = k.split('/');
          if (parts.length === 3 && sessionIds.has(parts[1])) {
            entry.keys.push(k);
            if (entry.records.length < MAX_RECORDS) entry.records.push({ key: k, record: await getJson(st, k) });
          }
        }
      } catch (e) { out.errors.push(name + ': ' + e.message); }
    }
    out.stores[name] = entry;
  }

  // 4. aria-traces — one `log` array; match by session id or by the email appearing in the user message.
  if (want.includes('aria-traces')) {
    const name = 'aria-traces';
    const entry = { keys: [], records: [] };
    const st = open(name);
    if (st) {
      let traces = [];
      try { const raw = await st.get('log'); if (raw) traces = JSON.parse(raw); } catch { traces = []; }
      const mine = (Array.isArray(traces) ? traces : []).filter((t) => t && (sessionIds.has(String(t.sessionId || '')) || String(t.userMsg || '').toLowerCase().includes(em)));
      if (mine.length) { entry.keys.push('log'); entry.records = mine.slice(0, MAX_RECORDS).map((t) => ({ key: 'log', record: t })); entry.matched = mine.length; }
    }
    out.stores[name] = entry;
  }

  // 5. aria-leads / aria-bookings — key contains the sanitized/raw email or the record carries .email.
  for (const name of ['aria-leads', 'aria-bookings']) {
    if (!want.includes(name)) continue;
    const entry = { keys: [], records: [] };
    const st = open(name);
    if (st) {
      try {
        const keys = await listKeys(st);
        for (const k of keys) {
          const kl = k.toLowerCase();
          let match = kl.includes(san.toLowerCase()) || kl.includes(em) || kl.includes(h16);
          let rec = null;
          if (!match && name === 'aria-leads' && !kl.startsWith('health/')) {
            rec = await getJson(st, k);
            const re = rec && String((rec.email || (rec.user && rec.user.email) || (rec.lead && rec.lead.email) || '')).toLowerCase().trim();
            match = !!re && re === em;
          }
          if (match) {
            entry.keys.push(k);
            if (entry.records.length < MAX_RECORDS) entry.records.push({ key: k, record: rec || await getJson(st, k) });
          }
        }
      } catch (e) { out.errors.push(name + ': ' + e.message); }
    }
    out.stores[name] = entry;
  }

  // 6. aria-calls — keyed by phone.
  if (want.includes('aria-calls')) {
    const name = 'aria-calls';
    const entry = { keys: [], records: [], note: out.phone ? null : 'no phone number known for this email (aria-calls is keyed by phone)' };
    const st = out.phone ? open(name) : null;
    if (st) {
      const idxKey = 'by-phone/' + out.phone;
      const idx = await getJson(st, idxKey);
      if (idx && Array.isArray(idx.callIds)) {
        entry.keys.push(idxKey);
        for (const id of idx.callIds) {
          const ck = 'call/' + id;
          entry.keys.push(ck);
          if (entry.records.length < MAX_RECORDS) entry.records.push({ key: ck, record: await getJson(st, ck) });
        }
      }
    }
    out.stores[name] = entry;
  }

  // 7. aria-tickets — tkt/<id> with userEmail; the index is patched on purge.
  if (want.includes('aria-tickets')) {
    const name = 'aria-tickets';
    const entry = { keys: [], records: [] };
    const st = open(name);
    if (st) {
      try {
        const keys = await listKeys(st, 'tkt/');
        for (const k of keys) {
          const t = await getJson(st, k);
          if (t && String(t.userEmail || '').toLowerCase().trim() === em) {
            entry.keys.push(k);
            if (entry.records.length < MAX_RECORDS) entry.records.push({ key: k, record: t });
          }
        }
      } catch (e) { out.errors.push(name + ': ' + e.message); }
    }
    out.stores[name] = entry;
  }

  // 8. aria-licenses — by-email/<email> → token record.
  if (want.includes('aria-licenses')) {
    const name = 'aria-licenses';
    const entry = { keys: [], records: [] };
    const st = open(name);
    if (st) {
      for (const beKey of ['by-email/' + em, 'by-email/' + String(email || '').trim()]) {
        const be = await getJson(st, beKey);
        if (be) {
          if (!entry.keys.includes(beKey)) entry.keys.push(beKey);
          const tok = be.token && String(be.token);
          if (tok && !entry.keys.includes(tok)) {
            entry.keys.push(tok);
            const rec = await getJson(st, tok);
            entry.records.push({ key: tok, record: rec ? { ...rec, token: maskToken(tok) } : null });
          }
        }
      }
    }
    out.stores[name] = entry;
  }

  return out;
}

export function maskToken(tok) {
  const s = String(tok || '');
  return s.length > 8 ? s.slice(0, 4) + '…' + s.slice(-4) : '…';
}

/**
 * Delete everything listStoresFor() found, patch secondary indexes, and write a tombstone so
 * aria-backup-cron never re-snapshots the purged keys.
 */
export async function purgeUserData(email, opts = {}) {
  const em = String(email || '').toLowerCase().trim();
  const getStore = await resolveGetStore(opts);
  const found = await listStoresFor(em, { ...opts, getStore });
  const out = { email_hash: found.email_hash, purged: {}, keys_purged: [], errors: found.errors.slice(), tombstone: null, dry_run: !!opts.dryRun };
  const open = (name) => { try { return getStore({ name, consistency: 'strong' }); } catch (e) { out.errors.push(name + ': ' + (e && e.message)); return null; } };

  for (const [name, entry] of Object.entries(found.stores)) {
    out.purged[name] = 0;
    if (!entry.keys.length) continue;
    const st = open(name);
    if (!st) continue;
    if (opts.dryRun) { out.purged[name] = entry.keys.length; out.keys_purged.push(...entry.keys.map((k) => name + ':' + k)); continue; }
    try {
      if (name === 'aria-traces') {
        // Rewrite the single log without this user's entries instead of wiping everyone's.
        let traces = [];
        try { const raw = await st.get('log'); if (raw) traces = JSON.parse(raw); } catch { traces = []; }
        const sids = new Set(found.session_ids);
        const keep = (Array.isArray(traces) ? traces : []).filter((t) => !(t && (sids.has(String(t.sessionId || '')) || String(t.userMsg || '').toLowerCase().includes(em))));
        await st.set('log', JSON.stringify(keep));
        out.purged[name] = (Array.isArray(traces) ? traces.length : 0) - keep.length;
        out.keys_purged.push(name + ':log#' + out.purged[name]);
        continue;
      }
      for (const k of entry.keys) {
        try { await st.delete(k); out.purged[name]++; out.keys_purged.push(name + ':' + k); }
        catch (e) { out.errors.push(name + ':' + k + ': ' + (e && e.message)); }
      }
      if (name === 'aria-tickets') {
        const ids = new Set(entry.keys.map((k) => k.replace(/^tkt\//, '')));
        const idx = await getJson(st, 'index');
        if (Array.isArray(idx)) await st.set('index', JSON.stringify(idx.filter((x) => !(x && ids.has(x.id)))));
      }
      if (name === 'aria-calls' && found.phone) {
        // the by-phone index was in entry.keys and is already deleted
      }
    } catch (e) { out.errors.push(name + ': ' + (e && e.message)); }
  }

  if (!opts.dryRun) {
    try {
      const ts = Date.now();
      const tomb = open(TOMBSTONE_STORE);
      if (tomb) {
        const key = 'tomb-' + found.email_hash + '-' + ts;
        // No raw keys (they can embed the address): hashed qualified keys + hashed identity only.
        const keyHashes = out.keys_purged.slice(0, 2000).map((qk) => {
          const i = qk.indexOf(':');
          return keyHash(qk.slice(0, i), qk.slice(i + 1));
        });
        await tomb.setJSON(key, {
          kind: 'user-erasure', ts, ran_at: new Date(ts).toISOString(),
          email_hash: found.email_hash, hash32: hash32(em), sanitized: sanitizedEmail(em).toLowerCase(),
          phone_hash: found.phone ? hash16(found.phone) : null,
          key_hashes: keyHashes, keys_purged_count: out.keys_purged.length,
          purged: out.purged, errors: out.errors.slice(0, 50).map((e) => String(e).split(':')[0]),
        });
        out.tombstone = key;
      }
    } catch (e) { out.errors.push('tombstone: ' + (e && e.message)); }
  }
  return out;
}

/** All user-erasure tombstones (for aria-backup-cron). Never throws. */
export async function loadTombstones(opts = {}) {
  try {
    const getStore = await resolveGetStore(opts);
    const st = getStore({ name: TOMBSTONE_STORE, consistency: 'eventual' });
    const keys = await listKeys(st, 'tomb-');
    const out = [];
    for (const k of keys) {
      const t = await getJson(st, k);
      if (t && t.kind === 'user-erasure') out.push(t);
    }
    return out;
  } catch { return []; }
}

/** True when a key in `storeName` belongs to a purged person (by purged-key hash, hashed-email key,
 *  sanitized-email key, or an email embedded in the key). */
export function isTombstonedKey(key, tombstones, storeName) {
  if (!Array.isArray(tombstones) || !tombstones.length) return false;
  const k = String(key || '');
  const kl = k.toLowerCase();
  const kh = storeName ? keyHash(storeName, k) : null;
  // Emails embedded in keys (`${ts}_${email}.json`): strip the file extension and the timestamp prefix.
  const bare = kl.replace(/\.(json|jsonl|txt)$/, '');
  const embedded = [];
  for (const m of (bare.match(EMAIL_IN_KEY_RE) || [])) { embedded.push(hash16(m)); embedded.push(hash16(m.replace(/^\d+_/, ''))); }
  for (const t of tombstones) {
    if (!t) continue;
    if (kh && Array.isArray(t.key_hashes) && t.key_hashes.includes(kh)) return true;
    if (t.hash32 && kl.includes(String(t.hash32).toLowerCase())) return true;
    if (t.sanitized && t.sanitized.length >= 6 && kl.includes(String(t.sanitized).toLowerCase())) return true;
    if (t.email_hash && embedded.includes(t.email_hash)) return true;
  }
  return false;
}

export default { listStoresFor, purgeUserData, loadTombstones, isTombstonedKey, USER_STORES, hash16, hash32, keyHash, normalizePhone, maskToken };
