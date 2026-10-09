// aria-live-voice.js — the same live, human Aria voice used by XO Elite, for iisupp.net.
// Persona "iisupp" = public Aria on /aria; persona "axis" = Axis (staff login required).
// Requires /assets/aria-live.js (the shared voice engine). Never substitutes a browser voice.
(() => {
  const BRIDGE = 'https://xoagency.lovable.app/api/public/axis-bridge';
  window.AriaLiveCall = function (persona, opts = {}) {
    const audio = document.createElement('audio');
    audio.autoplay = true; audio.style.display = 'none'; document.body.appendChild(audio);
    let call = null, active = false;
    const setState = (s) => { active = s !== 'idle'; opts.onState && opts.onState(s); };
    const getUrl = async () => {
      const headers = { 'content-type': 'application/json' };
      const token = opts.token && opts.token();
      if (token) headers.Authorization = 'Bearer ' + token;
      const r = await fetch(BRIDGE, { method: 'POST', headers, body: JSON.stringify({ action: 'voice-ticket', persona }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || data.message || (r.status === 401 ? 'Please sign in again.' : 'Voice is unavailable right now.'));
      if (typeof data.url !== 'string') throw new Error('The shared Aria voice has not been published yet.');
      return data.url;
    };
    const onEvent = (e) => {
      if (e.type === 'app.connected') setState('live');
      if (e.type === 'app.stopping') setState('stopping');
      if (e.type === 'app.axis.action' && opts.onAction) Promise.resolve().then(() => opts.onAction(e.action)).catch(() => opts.onError && opts.onError('The requested task could not be completed.'));
      if (e.type === 'app.transcript' && opts.onTranscript) opts.onTranscript(e.role, e.text);
      if (e.error && e.error.message && opts.onError) opts.onError(e.error.message);
      if (e.type === 'app.playback.blocked' && opts.onError) opts.onError('Playback is blocked. Tap the microphone to resume audio.');
      if (e.type === 'app.closed') {
        call = null; setState('idle');
      }
    };
    return {
      get active() { return active; },
      async toggle() {
        if (call) { call.stop(); return; }
        if (!window.AriaLive) { opts.onError && opts.onError('Voice engine not loaded'); return; }
        setState('connecting');
        call = window.AriaLive.create({ getUrl, audio, onEvent });
        try { await call.start(); } catch (err) { call = null; setState('idle'); opts.onError && opts.onError(err.message || 'Voice failed'); }
      },
      stop() { if (call) call.stop(); },
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
