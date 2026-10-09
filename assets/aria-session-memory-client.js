/**
 * aria-session-memory-client.js
 *  Client-side wrapper that auto-saves last 50 ARIA chat turns to /.netlify/functions/aria-session-memory
 *  and welcomes back returning users with a "Continue where you left off?" prompt.
 *
 *  Cat 21 — Knowledge graph + cross-session memory.
 *
 *  2026-10-08 (backend hardened, audit #1): `load` and `clear` now require proof of mailbox ownership — the
 *  magic-link / session token (`body.token`) that assets/aria-account-auth.js keeps after the emailed link is
 *  followed. `save` stays open (write-only, redacted, capped server-side). So:
 *   - every request carries the per-tab web session id (window.ariaWebSessionId) when the page exposes one;
 *   - `load`/`clear` send `token` when we hold one for that email; a 401 is reported as needs_signin instead of
 *     being swallowed, and the welcome-back banner is NOT shown (nothing was read back — honest, not silent);
 *   - `window.ariaSessionMemory.status()` tells the page whether read-back is possible right now.
 */
(function () {
  'use strict';
  const FN = '/.netlify/functions/aria-session-memory';
  const LS_TURNS = 'aria_session_turns_v1';
  const LS_EMAIL = 'aria_session_email';
  const LS_TOKEN = 'aria_session_token'; // same key assets/aria-account-auth.js + assets/forums.js use

  let lastLoad = { ok: null, needs_signin: false, error: null, at: 0 };

  function getEmail() {
    try { return localStorage.getItem(LS_EMAIL) || ''; } catch { return ''; }
  }
  function setEmail(e) {
    try { localStorage.setItem(LS_EMAIL, String(e || '').toLowerCase().trim()); } catch {}
  }
  function getLocalTurns() {
    try { return JSON.parse(localStorage.getItem(LS_TURNS) || '[]'); } catch { return []; }
  }
  function setLocalTurns(t) {
    try { localStorage.setItem(LS_TURNS, JSON.stringify(t.slice(-50))); } catch {}
  }
  function webSessionId() {
    try { return typeof window.ariaWebSessionId === 'function' ? window.ariaWebSessionId() : undefined; } catch { return undefined; }
  }
  /** Token for this email: prefer the shared auth helper, else the raw localStorage key (decoded only for the email match). */
  function tokenFor(email) {
    try {
      if (window.ariaAccountAuth && typeof window.ariaAccountAuth.hasValidToken === 'function') {
        return window.ariaAccountAuth.hasValidToken(email) ? window.ariaAccountAuth.getToken() : '';
      }
      const raw = sessionStorage.getItem(LS_TOKEN) || localStorage.getItem(LS_TOKEN) || '';
      if (!raw) return '';
      const part = raw.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(part + '='.repeat((4 - part.length % 4) % 4)));
      if (payload && typeof payload.exp === 'number' && payload.exp < Date.now()) return '';
      return payload && String(payload.email || '').toLowerCase() === String(email || '').toLowerCase() ? raw : '';
    } catch { return ''; }
  }
  function body(obj) {
    const sid = webSessionId();
    return JSON.stringify(sid ? Object.assign({ sessionId: sid }, obj) : obj);
  }

  let pendingSave = null;
  function debouncedSave(email, turns) {
    if (pendingSave) clearTimeout(pendingSave);
    pendingSave = setTimeout(async () => {
      pendingSave = null;
      try {
        await fetch(FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body({ event: 'save', email, turns })
        });
      } catch (e) { /* silent: save is best-effort and write-only */ }
    }, 1500);
  }

  async function loadRemote(email) {
    const token = tokenFor(email);
    if (!token) {
      lastLoad = { ok: false, needs_signin: true, error: 'verification_required', at: Date.now() };
      return null; // cannot read back without proof — say so via status(), never pretend it was empty
    }
    try {
      const r = await fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ARIA-Session-Token': token },
        body: body({ event: 'load', email, token })
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { lastLoad = { ok: false, needs_signin: true, error: j.error || 'verification_required', at: Date.now() }; return null; }
      if (!r.ok || !j.ok) { lastLoad = { ok: false, needs_signin: false, error: j.error || ('http_' + r.status), at: Date.now() }; return null; }
      lastLoad = { ok: true, needs_signin: false, error: null, at: Date.now(), durable: j.durable === true, cold: j.cold === true };
      if (Array.isArray(j.turns) && j.turns.length) return j.turns;
    } catch (e) { lastLoad = { ok: false, needs_signin: false, error: 'network', at: Date.now() }; }
    return null;
  }

  async function clearRemote(email) {
    const token = tokenFor(email);
    if (!token) return { ok: false, needs_signin: true };
    try {
      const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ARIA-Session-Token': token }, body: body({ event: 'clear', email, token }) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok && j.ok !== false, needs_signin: r.status === 401, error: j.error || null };
    } catch (e) { return { ok: false, needs_signin: false, error: 'network' }; }
  }

  async function welcomeBackIfReturning(email) {
    if (!email) return false;
    const remote = await loadRemote(email);
    if (!remote || remote.length === 0) return false;
    const last = remote[remote.length - 1];
    const ago = relativeTime(Date.now() - (last.ts || 0));
    // Surface a non-blocking banner
    const banner = document.createElement('div');
    banner.id = 'aria-welcome-back';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Continue your last session?');
    banner.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#141414;border:1px solid #d4af37;border-radius:10px;padding:14px 22px;color:#fff;font-family:system-ui,sans-serif;font-size:14px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.5);display:flex;gap:14px;align-items:center;max-width:560px';
    banner.innerHTML =
      '<span>Welcome back. We picked up your last session from ' + ago + '.</span>' +
      '<button id="awb-yes" style="background:#d4af37;color:#0a0a0a;border:none;padding:7px 14px;border-radius:6px;font-weight:600;cursor:pointer">Continue</button>' +
      '<button id="awb-no" style="background:transparent;color:#aaa;border:1px solid #2a2a2a;padding:7px 14px;border-radius:6px;cursor:pointer">Fresh start</button>';
    document.body.appendChild(banner);
    return new Promise(resolve => {
      banner.querySelector('#awb-yes').onclick = () => {
        setLocalTurns(remote);
        banner.remove();
        if (typeof window.ariaRestoreTurns === 'function') window.ariaRestoreTurns(remote);
        resolve(true);
      };
      banner.querySelector('#awb-no').onclick = () => {
        // Wipe remote so it doesn't haunt them (needs the same proof the load used)
        clearRemote(email).catch(() => {});
        setLocalTurns([]);
        banner.remove();
        resolve(false);
      };
      setTimeout(() => { try { banner.remove(); } catch {} resolve(false); }, 12000);
    });
  }

  function relativeTime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'a moment ago';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' minute' + (m > 1 ? 's' : '') + ' ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' hour' + (h > 1 ? 's' : '') + ' ago';
    const d = Math.floor(h / 24);
    return d + ' day' + (d > 1 ? 's' : '') + ' ago';
  }

  window.ariaSessionMemory = {
    setEmail,
    getEmail,
    trackTurn(role, content) {
      const email = getEmail();
      if (!email) return;
      const turns = getLocalTurns();
      turns.push({ role, content: String(content || '').slice(0, 2000), ts: Date.now() });
      setLocalTurns(turns);
      debouncedSave(email, turns.slice(-50));
    },
    init: welcomeBackIfReturning,
    load: loadRemote,
    clear: clearRemote,
    /** {ok, needs_signin, error} of the last read-back attempt — pages show "sign-in link required" from this. */
    status() { return Object.assign({}, lastLoad); },
    canReadBack(email) { return !!tokenFor(email || getEmail()); }
  };
})();
