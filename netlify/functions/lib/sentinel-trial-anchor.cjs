// lib/sentinel-trial-anchor.cjs — the server-anchored local trial (SENTINEL REVIEW FIXES 2026-10-14, P1-3 server half).
//
// The desktop's 30-day local trial started from ~/.aria-sentinel/trial.json: editing that file (or rolling the
// clock back) restarted it. sentinel-resolve and aria-sentinel-heartbeat now record the FIRST time this server
// saw a device — keyed by the X-Sentinel-Device header (the desktop's sha256-derived device hash, 32 hex) — and
// return it as `trialStartedAt`, so the desktop can anchor its trial on a date it does not control.
//
//   store 'sentinel-trial-anchors', key `trial-anchor/<device>` → { first_seen_at }   (nothing else, ever)
//
// Rules: an existing anchor is NEVER overwritten (conditional create where the Blobs client supports it; read-first
// otherwise). Content-blind — the device value is already a one-way hash and is the only identifier stored. A store
// that cannot be read/written gives trialStartedAt:null (state 'unavailable') — never an invented date.
'use strict';

const S = require('./sentinel-store.cjs');
const { STORES } = require('./sentinel-license-records.cjs');

const ANCHOR_STORE = STORES.TRIAL_ANCHORS; // 'sentinel-trial-anchors'
// Echoed into the signed verdict only when it is a sane token; anchored only when it is long enough to be a hash
// (the desktop's fallback value "device" is shared by every machine whose hash failed — never anchor it).
const DEVICE_ECHO_RE = /^[A-Za-z0-9_-]{1,128}$/;
const DEVICE_ANCHOR_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** The device value as it may appear in a verdict ("" when absent or not a plain token). */
function deviceToken(headerValue) {
  const d = String(headerValue == null ? '' : headerValue).trim();
  return DEVICE_ECHO_RE.test(d) ? d : '';
}

/**
 * readTrialAnchor(event, deviceHeader, { now, create = true, mayCreate }) →
 *   { device, trialStartedAt: ISO|null, state: 'existing'|'created'|'no-device'|'not-created'|'unavailable' }
 * `mayCreate()` (optional) is asked before a NEW anchor is written (e.g. a per-IP creation limit); false → not created.
 */
async function readTrialAnchor(event, deviceHeader, opts) {
  const o = opts || {};
  const device = deviceToken(deviceHeader);
  if (!device || !DEVICE_ANCHOR_RE.test(device)) return { device, trialStartedAt: null, state: 'no-device' };
  const store = await S.openStore(ANCHOR_STORE, event);
  if (!store) return { device, trialStartedAt: null, state: 'unavailable' };
  const key = `trial-anchor/${device}`;
  const cur = await S.readJson(store, key);
  if (!cur.ok) return { device, trialStartedAt: null, state: 'unavailable' };
  const existing = cur.value && Number.isFinite(Date.parse(cur.value.first_seen_at || '')) ? cur.value.first_seen_at : null;
  if (existing) return { device, trialStartedAt: existing, state: 'existing' };
  if (o.create === false || (typeof o.mayCreate === 'function' && !o.mayCreate())) return { device, trialStartedAt: null, state: 'not-created' };
  const first_seen_at = new Date(Number(o.now) || Date.now()).toISOString();
  let res;
  try { res = await store.setJSON(key, { first_seen_at }, { onlyIfNew: true }); } catch { return { device, trialStartedAt: null, state: 'unavailable' }; }
  if (res && typeof res === 'object' && res.modified === false) {
    // Lost a create race (conditional-write client): the anchor that won is the truth.
    const won = await S.readJson(store, key);
    const at = won.ok && won.value && won.value.first_seen_at ? won.value.first_seen_at : null;
    return { device, trialStartedAt: at, state: at ? 'existing' : 'unavailable' };
  }
  return { device, trialStartedAt: first_seen_at, state: 'created' };
}

module.exports = { ANCHOR_STORE, DEVICE_ECHO_RE, DEVICE_ANCHOR_RE, deviceToken, readTrialAnchor };
