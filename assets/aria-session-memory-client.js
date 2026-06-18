/**
 * aria-session-memory-client.js
 *  Client-side wrapper that auto-saves last 50 ARIA chat turns to /.netlify/functions/aria-session-memory
 *  and welcomes back returning users with a "Continue where you left off?" prompt.
 *
 *  Cat 21 — Knowledge graph + cross-session memory.
 */
(function () {
  'use strict';
  const FN = '/.netlify/functions/aria-session-memory';
  const LS_TURNS = 'aria_session_turns_v1';
  const LS_EMAIL = 'aria_session_email';

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

  let pendingSave = null;
  function debouncedSave(email, turns) {
    if (pendingSave) clearTimeout(pendingSave);
    pendingSave = setTimeout(async () => {
      pendingSave = null;
      try {
        await fetch(FN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'save', email, turns })
        });
      } catch (e) { /* silent */ }
    }, 1500);
  }

  async function loadRemote(email) {
    try {
      const r = await fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'load', email })
      });
      const j = await r.json();
      if (j.ok && Array.isArray(j.turns) && j.turns.length) return j.turns;
    } catch (e) { /* silent */ }
    return null;
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
        // Wipe remote so it doesn't haunt them
        fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'clear', email }) }).catch(() => {});
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
    init: welcomeBackIfReturning
  };
})();
