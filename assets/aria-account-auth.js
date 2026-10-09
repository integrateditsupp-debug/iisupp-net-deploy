/*!
 * aria-account-auth.js — proof-of-mailbox client for the ARIA account endpoints (2026-10-08).
 *
 * The backend was hardened today (netlify/functions/lib/require-verified-email.cjs): billing-portal, plan-change,
 * invoice-download, account-delete, data-export and session-memory `load`/`clear` now need proof that the caller
 * owns the email they act on. Accepted proofs: (a) a magic-link token or the 12-hour `session_token` that
 * `aria-magic-link {event:'verify'}` mints — sent as `body.token` (or header X-ARIA-Session-Token); (b) an
 * Aperture admin JWT (console use, not this file). Without proof the server answers 401 `verification_required`.
 *
 * This helper gives every page the same three moves:
 *   1. requestMagicLink(email)        → POST aria-magic-link {event:'request'} → "check your inbox"
 *   2. consumeMagicLinkFromUrl()      → the link lands on /aria?magic=<token>; verify it, keep the session token
 *   3. postAccount(fn, body)          → adds `token` for the matching email, maps 401 to {needs_signin:true}
 *
 * Storage: localStorage `aria_session_token` (+ `_exp`) is the existing site convention (assets/forums.js reads
 * it) so a sign-in on /aria carries to /account.html and /aria-data-export.html; sessionStorage mirrors it for
 * the current tab. The token's payload is only DECODED here to read email/exp — verification is the server's job.
 * Honest by construction: no call is marked ok unless the server said so.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.ariaAccountAuth = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function (root) {
  'use strict';

  var FN_MAGIC = '/.netlify/functions/aria-magic-link';
  var FN_BASE = '/.netlify/functions/';
  var LS_TOKEN = 'aria_session_token';
  var LS_TOKEN_EXP = 'aria_session_token_exp';
  var LS_EMAIL = 'aria_session_email';
  var LS_RETURN = 'aria_magic_return';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function store(kind) {
    try { return kind === 'session' ? root.sessionStorage : root.localStorage; } catch (_) { return null; }
  }
  function get(kind, k) { try { var s = store(kind); return s ? (s.getItem(k) || '') : ''; } catch (_) { return ''; } }
  function set(kind, k, v) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (_) { /* private mode */ } }
  function del(kind, k) { try { var s = store(kind); if (s) s.removeItem(k); } catch (_) { /* noop */ } }

  function b64urlDecode(s) {
    var t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    try {
      if (typeof root.atob === 'function') return decodeURIComponent(Array.prototype.map.call(root.atob(t), function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
      if (typeof Buffer !== 'undefined') return Buffer.from(t, 'base64').toString('utf8');
    } catch (_) { /* fallthrough */ }
    return '';
  }

  /** Read {email, exp, kind} out of a token WITHOUT trusting it (the server verifies the HMAC). */
  function decodePayload(token) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length !== 2) return null;
      var p = JSON.parse(b64urlDecode(parts[0]));
      return p && typeof p === 'object' ? p : null;
    } catch (_) { return null; }
  }

  function isLive(token) {
    var p = decodePayload(token);
    if (!p || typeof p.email !== 'string') return false;
    if (typeof p.exp === 'number' && p.exp < Date.now()) return false;
    return true;
  }

  function getToken() {
    var t = get('session', LS_TOKEN) || get('local', LS_TOKEN);
    if (!t) return '';
    if (!isLive(t)) { clearSession(); return ''; }
    return t;
  }

  function getEmail() {
    var p = decodePayload(getToken());
    if (p && typeof p.email === 'string') return p.email.toLowerCase();
    return (get('local', LS_EMAIL) || '').toLowerCase();
  }

  function setSession(token, email, expiresAt) {
    if (!token) return;
    set('local', LS_TOKEN, token);
    set('session', LS_TOKEN, token);
    if (expiresAt) set('local', LS_TOKEN_EXP, String(expiresAt));
    if (email) set('local', LS_EMAIL, String(email).toLowerCase().trim());
  }

  function clearSession() {
    del('local', LS_TOKEN); del('session', LS_TOKEN); del('local', LS_TOKEN_EXP);
  }

  /** True when we hold a live token (for THIS email, when one is given). */
  function hasValidToken(email) {
    var t = getToken();
    if (!t) return false;
    if (!email) return true;
    var p = decodePayload(t);
    return !!(p && String(p.email).toLowerCase() === String(email).toLowerCase().trim());
  }

  function tokenExpiry() {
    var p = decodePayload(getToken());
    return p && typeof p.exp === 'number' ? p.exp : null;
  }

  function sameOriginPath(p) {
    var s = String(p || '');
    return /^\/[^\s]*$/.test(s) && !/^\/\//.test(s) ? s : '';
  }

  function fetchJson(url, body, extraHeaders) {
    var f = root.fetch ? root.fetch.bind(root) : null;
    if (!f) return Promise.resolve({ status: 0, json: { ok: false, error: 'fetch_unavailable' } });
    var headers = { 'Content-Type': 'application/json' };
    if (extraHeaders) for (var k in extraHeaders) headers[k] = extraHeaders[k];
    return f(url, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, json: j || {} }; }); })
      .catch(function (e) { return { status: 0, json: { ok: false, error: 'network', message: e && e.message } }; });
  }

  /**
   * Ask the server to email a sign-in link. Resolves {ok, message} or {ok:false, error, message}.
   * `returnTo` (same-origin path) is remembered so /aria can offer the way back after the link is followed.
   */
  function requestMagicLink(email, opts) {
    var e = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return Promise.resolve({ ok: false, error: 'invalid_email', message: 'Enter a valid email address.' });
    var o = opts || {};
    var rt = sameOriginPath(o.returnTo);
    if (rt) set('local', LS_RETURN, rt);
    set('local', LS_EMAIL, e);
    return fetchJson(FN_MAGIC, { event: 'request', email: e }).then(function (r) {
      var j = r.json || {};
      if (r.status === 200 && j.ok) return { ok: true, message: j.message || 'Sign-in link sent. Check your inbox.', expires_at: j.expires_at || null };
      if (r.status === 429) return { ok: false, error: 'rate_limited', message: 'Too many sign-in requests. Wait a few minutes and try again.' };
      if (r.status === 503) return { ok: false, error: 'not_configured', message: 'Sign-in links are not configured on this deployment yet. Call (647) 581-3182.' };
      return { ok: false, error: j.error || ('http_' + r.status), message: j.message || 'We could not send the sign-in email right now. Try again in a minute or call (647) 581-3182.' };
    });
  }

  /** Exchange a sign-in token (from the emailed link) for the 12-hour session token. */
  function verifyMagicToken(token) {
    var t = String(token || '').trim();
    if (!t) return Promise.resolve({ ok: false, error: 'no_token' });
    return fetchJson(FN_MAGIC, { event: 'verify', token: t }).then(function (r) {
      var j = r.json || {};
      if (r.status === 200 && j.ok && j.session_token) {
        setSession(j.session_token, j.email, j.session_expires_at);
        return { ok: true, email: String(j.email || '').toLowerCase(), expires_at: j.session_expires_at || null, single_use_enforced: j.single_use_enforced === true };
      }
      return { ok: false, error: j.error || ('http_' + r.status), message: j.error === 'token already used or unknown' ? 'That sign-in link was already used. Request a new one.' : 'That sign-in link is invalid or expired. Request a new one.' };
    });
  }

  /**
   * Called on page load: if the URL carries ?magic=<token> (the shape aria-magic-link emails), verify it, keep the
   * session, and strip the token from the address bar. Resolves null when no token was present.
   */
  function consumeMagicLinkFromUrl() {
    var loc = root.location;
    if (!loc) return Promise.resolve(null);
    var token = '';
    try {
      var qs = new URLSearchParams(loc.search || '');
      token = qs.get('magic') || qs.get('token') || '';
    } catch (_) { token = ''; }
    if (!token) return Promise.resolve(null);
    var returnTo = sameOriginPath(get('local', LS_RETURN));
    return verifyMagicToken(token).then(function (res) {
      try {
        var u = new URL(loc.href);
        u.searchParams.delete('magic'); u.searchParams.delete('token');
        if (root.history && root.history.replaceState) root.history.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
      } catch (_) { /* noop */ }
      if (res.ok) del('local', LS_RETURN);
      res.attempted = true;
      res.returnTo = res.ok ? returnTo : '';
      return res;
    });
  }

  /** Body + header carrying the token when it is for this email. */
  function withToken(body, email) {
    var b = {};
    for (var k in (body || {})) b[k] = body[k];
    var e = String(email || b.email || '').toLowerCase().trim();
    if (e) b.email = e;
    var t = getToken();
    if (t && (!e || hasValidToken(e))) b.token = t;
    return b;
  }

  /**
   * POST an account endpoint with proof attached. Resolves {ok, status, data} — or {ok:false, needs_signin:true}
   * when the server wants a sign-in link first (401 verification_required / no token held for this email).
   */
  function postAccount(fn, body) {
    var name = String(fn || '').replace(/^\/?(\.netlify\/functions\/)?/, '');
    var b = withToken(body, body && body.email);
    if (!b.token) return Promise.resolve({ ok: false, status: 401, needs_signin: true, error: 'verification_required', data: null, message: 'A sign-in link is required for this action.' });
    return fetchJson(FN_BASE + name, b, { 'X-ARIA-Session-Token': b.token }).then(function (r) {
      var j = r.json || {};
      if (r.status === 401 && (j.error === 'verification_required' || /verif/i.test(String(j.error || '')))) {
        clearSession();
        return { ok: false, status: 401, needs_signin: true, error: 'verification_required', data: j, message: 'Your sign-in expired or does not match this email. Request a new sign-in link.' };
      }
      if (r.status === 503 && j.error === 'not-configured') return { ok: false, status: 503, error: 'not-configured', data: j, message: 'Sign-in verification is not configured on this deployment yet (APERTURE_JWT_SECRET). Call (647) 581-3182.' };
      return { ok: r.status === 200 && j.ok !== false, status: r.status, data: j, error: j.error || (r.status === 200 ? null : 'http_' + r.status), message: j.message || null };
    });
  }

  /**
   * Minimal sign-in UI: an email field + "Send me a sign-in link" + an honest status line. Returns {setEmail, destroy}.
   * Styling is inherited from the page (it uses plain elements + the classes passed in).
   */
  function mountSignIn(container, opts) {
    var o = opts || {};
    if (!container) return null;
    container.innerHTML = '';
    var wrap = root.document.createElement('div');
    wrap.className = o.className || 'aria-signin';
    var email = getEmail();
    wrap.innerHTML =
      '<p class="' + (o.textClass || 'aria-signin-text') + '">' + (o.intro || 'Prove it is your mailbox: we email you a one-time sign-in link (valid 15 minutes). No password.') + '</p>' +
      '<label class="' + (o.labelClass || 'aria-signin-label') + '" for="' + (o.inputId || 'aria-signin-email') + '">Your email</label>' +
      '<input class="' + (o.inputClass || 'aria-signin-input') + '" id="' + (o.inputId || 'aria-signin-email') + '" type="email" autocomplete="email" placeholder="you@company.com">' +
      '<p style="margin:12px 0 0"><button type="button" class="' + (o.buttonClass || 'aria-signin-btn') + '">Send me a sign-in link</button></p>' +
      '<p class="' + (o.statusClass || 'aria-signin-status') + '" role="status" aria-live="polite"></p>';
    container.appendChild(wrap);
    var input = wrap.querySelector('input'), btn = wrap.querySelector('button'), status = wrap.querySelector('[role="status"]');
    if (email) input.value = email;
    if (o.email) input.value = o.email;
    btn.addEventListener('click', function () {
      var e = (input.value || '').trim();
      if (!EMAIL_RE.test(e)) { status.textContent = 'Enter a valid email address.'; return; }
      btn.disabled = true; status.textContent = 'Sending…';
      requestMagicLink(e, { returnTo: o.returnTo }).then(function (r) {
        btn.disabled = false;
        status.textContent = r.ok
          ? 'Check your inbox — the link signs you in on /aria; then come back here. Nothing is unlocked until the link is clicked.'
          : (r.message || 'Could not send the link.');
        if (typeof o.onSent === 'function') o.onSent(r, e);
      });
    });
    return { setEmail: function (v) { input.value = v || ''; }, destroy: function () { wrap.remove(); } };
  }

  return {
    requestMagicLink: requestMagicLink,
    verifyMagicToken: verifyMagicToken,
    consumeMagicLinkFromUrl: consumeMagicLinkFromUrl,
    getToken: getToken,
    getEmail: getEmail,
    hasValidToken: hasValidToken,
    tokenExpiry: tokenExpiry,
    setSession: setSession,
    clearSession: clearSession,
    withToken: withToken,
    postAccount: postAccount,
    mountSignIn: mountSignIn,
    decodePayload: decodePayload,
    KEYS: { token: LS_TOKEN, tokenExp: LS_TOKEN_EXP, email: LS_EMAIL, returnTo: LS_RETURN },
  };
});
