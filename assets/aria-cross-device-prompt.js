/*!
 * aria-cross-device-prompt.js — Drop-in welcome-back banner for /aria
 *  On load: if user has email + a token, ping /aria-cross-device-sync event=devices.
 *  If >1 device synced AND most recent sync was on a DIFFERENT device, show "Resume from {device}?" banner.
 *  Cat 21 — Knowledge graph + cross-device memory.
 */
(function(){
  'use strict';
  if (window.__iisCrossDevice) return;
  window.__iisCrossDevice = true;

  function getEmail(){ try { return localStorage.getItem('aria_session_email') || ''; } catch { return ''; } }
  function getToken(){ try { return localStorage.getItem('aria_xdev_token') || ''; } catch { return ''; } }
  function getDeviceId(){
    try {
      var id = localStorage.getItem('aria_device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36).slice(-5);
        localStorage.setItem('aria_device_id', id);
      }
      return id;
    } catch { return 'unknown'; }
  }
  function relTime(ms){
    var s = Math.floor(ms/1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s/60); if (m < 60) return m + ' min ago';
    var h = Math.floor(m/60); if (h < 24) return h + ' hr ago';
    var d = Math.floor(h/24); return d + ' day' + (d>1?'s':'') + ' ago';
  }

  async function check(){
    var email = getEmail();
    var token = getToken();
    var dev = getDeviceId();
    if (!email || !token) return;

    try {
      var r = await fetch('/.netlify/functions/aria-cross-device-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'devices', email: email, token: token })
      });
      if (!r.ok) return;
      var j = await r.json();
      if (!j.ok || !Array.isArray(j.devices) || j.devices.length < 2) return;
      var others = j.devices.filter(function(d){ return d.id !== dev; });
      others.sort(function(a,b){ return (b.last_sync||0) - (a.last_sync||0); });
      var latest = others[0];
      if (!latest || !latest.last_sync) return;
      var ago = Date.now() - latest.last_sync;
      if (ago > 7 * 86400000) return; // ignore stale > 7 days

      var label = (latest.meta && (latest.meta.label || latest.meta.platform)) || 'another device';
      showBanner(label, relTime(ago), async function(){
        // Pull master log, restore via window.ariaSessionMemory if available
        var pull = await fetch('/.netlify/functions/aria-cross-device-sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'pull', email: email, token: token })
        });
        if (pull.ok) {
          var pj = await pull.json();
          if (pj.ok && Array.isArray(pj.turns) && pj.turns.length) {
            if (typeof window.ariaRestoreTurns === 'function') window.ariaRestoreTurns(pj.turns);
            try { localStorage.setItem('aria_session_turns_v1', JSON.stringify(pj.turns.slice(-50))); } catch {}
          }
        }
      });
    } catch {}
  }

  function showBanner(label, ago, onContinue){
    if (document.getElementById('iisXdevBanner')) return;
    var el = document.createElement('div');
    el.id = 'iisXdevBanner';
    el.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#0a0a0a;border:1px solid rgba(197,160,89,.5);border-radius:10px;padding:12px 18px;color:#fff;font-family:-apple-system,system-ui,sans-serif;font-size:14px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.5);display:flex;gap:12px;align-items:center;max-width:560px';
    el.innerHTML =
      '<span>Last seen on <b>' + label + '</b> ' + ago + '. Resume?</span>' +
      '<button id="xdYes" style="background:linear-gradient(135deg,#c5a059,#f1dca7);color:#050505;border:none;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Resume</button>' +
      '<button id="xdNo" style="background:transparent;color:#aaa;border:1px solid #2a2a2a;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase">Fresh</button>';
    document.body.appendChild(el);
    document.getElementById('xdYes').onclick = function(){ onContinue(); el.remove(); };
    document.getElementById('xdNo').onclick = function(){ el.remove(); };
    setTimeout(function(){ if (el.parentNode) el.remove(); }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else { check(); }
})();
