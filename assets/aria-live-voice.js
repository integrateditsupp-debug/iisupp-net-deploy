// aria-live-voice.js — the same live, human Aria voice used by XO Elite, for iisupp.net.
// Persona "iisupp" = public Aria on /aria; persona "axis" = Axis (staff login required).
// Requires /assets/aria-live.js (the shared voice engine). Falls back silently if unavailable.
(() => {
  const BRIDGE = 'https://xoagency.lovable.app/api/public/axis-bridge';
  window.AriaLiveCall = function (persona, opts = {}) {
    const audio = document.createElement('audio');
    audio.autoplay = true; audio.style.display = 'none'; document.body.appendChild(audio);
    let call = null, active = false;
    const setState = (s) => { active = s === 'connecting' || s === 'live'; opts.onState && opts.onState(s); };
    const getUrl = async () => {
      const headers = { 'content-type': 'application/json' };
      const token = opts.token && opts.token();
      if (token) headers.Authorization = 'Bearer ' + token;
      const r = await fetch(BRIDGE, { method: 'POST', headers, body: JSON.stringify({ action: 'voice-ticket', persona }) });
      if (!r.ok) throw new Error(r.status === 401 ? 'Please sign in again.' : 'Voice is unavailable right now.');
      return (await r.json()).url;
    };
    const onEvent = (e) => {
      if (e.type === 'app.connected' || e.type === 'app.greeting.accepted' || e.type === 'gateway.session.created') setState('live');
      if (e.type === 'app.axis.action' && opts.onAction) { try { opts.onAction(e.action); } catch {} }
      if (e.type === 'app.transcript' && opts.onTranscript) opts.onTranscript(e.role, e.text);
      if (e.type === 'app.error' || e.type === 'app.closed' || e.type === 'session.closed') {
        if (e.error && e.error.message && opts.onError) opts.onError(e.error.message);
        call = null; setState('idle');
      }
    };
    return {
      get active() { return active; },
      async toggle() {
        if (call) { const c = call; call = null; c.stop(); setState('idle'); return; }
        if (!window.AriaLive) { opts.onError && opts.onError('Voice engine not loaded'); return; }
        setState('connecting');
        call = window.AriaLive.create({ getUrl, audio, onEvent });
        try { await call.start(); } catch (err) { call = null; setState('idle'); opts.onError && opts.onError(err.message || 'Voice failed'); }
      },
      stop() { if (call) { call.stop(); call = null; } setState('idle'); },
    };
  };

  // Public Aria page: the mic button starts a real two-way conversation.
  function wireAriaPage() {
    const mic = document.getElementById('micBtn');
    if (!mic || mic.dataset.live) return;
    mic.dataset.live = '1';
    const tag = document.createElement('div');
    tag.style.cssText = 'font:600 10px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#c5a059;text-align:center;margin-top:6px;min-height:14px';
    mic.insertAdjacentElement('afterend', tag);
    const live = window.AriaLiveCall('iisupp', {
      onState: (s) => {
        tag.textContent = s === 'connecting' ? 'Connecting…' : s === 'live' ? 'Talking with Aria · tap to end' : '';
        mic.style.boxShadow = s === 'idle' ? '' : '0 0 0 3px rgba(197,160,89,.55), 0 0 28px rgba(197,160,89,.45)';
        mic.title = s === 'idle' ? 'Tap to talk with Aria' : 'Tap to end';
      },
      onError: (m) => { tag.textContent = m; },
    });
    mic.addEventListener('click', (e) => {
      e.preventDefault(); e.stopImmediatePropagation();
      try { window.speechSynthesis && speechSynthesis.cancel(); } catch {}
      live.toggle();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireAriaPage); else wireAriaPage();
})();
