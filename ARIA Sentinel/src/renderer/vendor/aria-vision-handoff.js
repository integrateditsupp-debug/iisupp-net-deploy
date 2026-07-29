/*!
 * aria-vision-handoff.js — carry an ARIA abstain to a human, with the evidence attached.
 * -------------------------------------------------------------------------------------
 * Load this BEFORE aria-vision-diagnose.js (and on any page that receives a handoff:
 * /aria and /forums). Framework-free, no dependencies, no network calls of its own.
 *
 * WHAT IT DOES NOT DO — on purpose:
 *   • It does not compose any text. Every word of a draft is written server-side by
 *     `netlify/functions/lib/vision-handoff.mjs` and arrives inside the diagnose response as
 *     `honestFallback.handoff`. One implementation, one place to audit, no browser copy that can
 *     drift into wording the server never approved — and the server-side PII redaction can
 *     therefore never be skipped by a client.
 *   • It does not post, send, escalate or publish anything. It moves a draft between two pages of
 *     the same site and hands it back for the user to read. The submit is the user's own click,
 *     on their own words, on a screen that first shows them exactly what will travel.
 *
 * WHY sessionStorage AND NOT THE URL:
 * a querystring is copied into server access logs, into the Referer header of every asset the next
 * page loads, and into browser history. That would be three extra copies of somebody's error text
 * that we never needed to make. sessionStorage is same-origin, same-tab, and dies with the tab.
 */
(function (global) {
  'use strict';

  var KEY = 'aria_vision_handoff';
  var TTL_MS = 30 * 60 * 1000;           // must match HANDOFF_TTL_MS server-side
  var MAX_RAW = 64 * 1024;               // a draft is text; anything larger is not a draft

  // Mirrors the server's `isUnsafeForHandoff`. This is a GUARD, not composition: it only ever
  // says no. Duplicating a refusal is safe; duplicating wording would not be.
  var DATA_URL_RE = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i;
  var BASE64_BLOB_RE = /[A-Za-z0-9+/]{200,}={0,2}/;
  var CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

  function isUnsafe(text) {
    var s = String(text == null ? '' : text);
    return DATA_URL_RE.test(s) || BASE64_BLOB_RE.test(s) || CONTROL_RE.test(s);
  }

  function store() {
    try { return global.sessionStorage || null; } catch (e) { return null; }   // blocked cookies/private mode
  }

  /**
   * stash(draft) → true when the draft was stored. `false` is a real answer, not a formality:
   * private-browsing and storage-disabled setups exist, and the caller must not navigate away
   * promising a prefilled form it cannot deliver.
   */
  function stash(draft) {
    var ss = store();
    if (!ss || !draft || !draft.ok || !draft.body) return false;
    if (isUnsafe(draft.body) || isUnsafe(draft.title || '')) return false;
    try {
      var raw = JSON.stringify({ v: 1, at: Date.now(), handoff: draft });
      if (raw.length > MAX_RAW) return false;
      ss.setItem(KEY, raw);
      return true;
    } catch (e) { return false; }
  }

  /**
   * take() → the draft, once. It is REMOVED on read: a draft is a one-shot handoff, and leaving
   * somebody's error text sitting in storage after they used it (or decided not to) is a leak with
   * no upside. Returns null for missing, malformed, wrong-version, expired or unsafe.
   */
  function take() {
    var ss = store();
    if (!ss) return null;
    var raw;
    try { raw = ss.getItem(KEY); } catch (e) { return null; }
    try { ss.removeItem(KEY); } catch (e) { /* best effort */ }
    if (!raw) return null;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || o.v !== 1 || !o.handoff || typeof o.handoff !== 'object') return null;
    var at = Number(o.at);
    if (!isFinite(at) || Date.now() - at > TTL_MS || at > Date.now() + 60000) return null;
    var h = o.handoff;
    if (!h.ok || !h.body) return null;
    // Storage is treated as untrusted input on the way out as well as the way in.
    if (isUnsafe(h.body) || isUnsafe(h.title || '')) return null;
    return h;
  }

  /** peek() → true when a usable draft is waiting, without consuming it. */
  function peek() {
    var ss = store();
    if (!ss) return false;
    try { return !!ss.getItem(KEY); } catch (e) { return false; }
  }

  function clear() {
    var ss = store();
    if (!ss) return;
    try { ss.removeItem(KEY); } catch (e) { /* best effort */ }
  }

  /**
   * describe(draft) → the short, literal list of what a submit would send. Shown to the user
   * BEFORE they submit, and built by counting what is actually in the draft rather than by
   * describing what we intend to be in it (Rule 14). Never mentions an image: image bytes are
   * not in a draft and cannot be — the server never puts them there.
   */
  function describe(draft) {
    var lines = [];
    if (!draft) return lines;
    var ev = draft.evidence || [];
    var findings = 0, signals = 0, userText = 0, closest = 0, summary = 0;
    for (var i = 0; i < ev.length; i++) {
      if (ev[i].type === 'log-finding') findings++;
      else if (ev[i].type === 'signal') signals++;
      else if (ev[i].type === 'user-text') userText++;
      else if (ev[i].type === 'closest-kb') closest++;
      else if (ev[i].type === 'log-summary') summary++;
    }
    if (findings) lines.push(findings + (findings === 1 ? ' line' : ' lines') + ' copied word-for-word out of the log you gave ARIA');
    if (summary) lines.push('what ARIA counted in your log');
    if (signals) lines.push('the error codes and app names ARIA picked out');
    if (userText) lines.push('the description you typed');
    if (closest) lines.push('the knowledge-base article ARIA was unsure about');
    lines.push('no image, no file, and no attachment — none of that is in this draft');
    return lines;
  }

  global.ARIAVisionHandoff = {
    KEY: KEY,
    stash: stash,
    take: take,
    peek: peek,
    clear: clear,
    describe: describe,
    isUnsafe: isUnsafe,
    version: '1.0.0'
  };
})(typeof window !== 'undefined' ? window : this);
