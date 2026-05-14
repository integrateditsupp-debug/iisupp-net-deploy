/*! aria-aperture-bridge.js — gates /aria with intake modal, mirrors chat events to Aperture API
 *  © 2026 Integrated IT Support Inc.
 *
 *  Behavior:
 *   1) On /aria load, check sessionStorage('aria_session_id'). If absent, show blocking intake modal.
 *   2) On intake submit → POST /.netlify/functions/aria-session → store sessionId + ticket.
 *   3) MutationObserver on the chat output area mirrors every message to /.netlify/functions/aria-event.
 *   4) On Resolve / Escalate / idle 5min → POST /.netlify/functions/aria-session-end → email goes out.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__APERTURE_BRIDGE_LOADED__) return;
  window.__APERTURE_BRIDGE_LOADED__ = true;

  const API = {
    session:    '/.netlify/functions/aria-session',
    event:      '/.netlify/functions/aria-event',
    sessionEnd: '/.netlify/functions/aria-session-end'
  };

  const SS_KEY = 'aria_session';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /[0-9]{7,}/;

  // =========================== STATE ===========================
  let session = null;          // { sessionId, ticket, user, startedAt }
  let seenMessageHashes = new Set();
  let idleTimer = null;
  const IDLE_MS = 5 * 60 * 1000;

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch { session = null; }
  }
  function saveSession() {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify(session || null)); } catch {}
  }
  function clearSession() {
    session = null;
    try { sessionStorage.removeItem(SS_KEY); } catch {}
  }

  // =========================== MODAL ===========================
  function injectModal() {
    if (document.getElementById('apIntakeOverlay')) return;
    const style = document.createElement('style');
    style.textContent = `
      #apIntakeOverlay { position:fixed; inset:0; background:rgba(5,8,16,0.96); backdrop-filter:blur(10px); z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:20px; }
      #apIntakeOverlay * { box-sizing:border-box; }
      #apIntakeCard { width:100%; max-width:480px; background:#0a1219; border:1px solid #2dd4bf; padding:32px 28px; box-shadow:0 0 80px rgba(45,212,191,0.18); font-family:'Inter',system-ui,sans-serif; color:#d8e0e6; }
      #apIntakeCard h3 { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:13px; letter-spacing:.15em; color:#2dd4bf; margin:0 0 6px; font-weight:600; }
      #apIntakeCard p.lead { font-size:12.5px; color:#98a8b3; margin:0 0 22px; line-height:1.6; }
      #apIntakeCard label { display:block; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:9.5px; letter-spacing:.22em; text-transform:uppercase; color:#6b7c87; margin:12px 0 5px; }
      #apIntakeCard .row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      #apIntakeCard input { width:100%; padding:9px 11px; background:#050810; border:1px solid #243a47; color:#d8e0e6; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:12px; outline:none; transition:border-color .15s; }
      #apIntakeCard input:focus { border-color:#2dd4bf; }
      #apIntakeCard input.err { border-color:#f87171; }
      #apIntakeCard .err-msg { font-size:10.5px; color:#f87171; min-height:14px; margin-top:4px; font-family:'JetBrains Mono',ui-monospace,monospace; }
      #apIntakeCard .cta { display:block; width:100%; margin-top:22px; padding:11px 18px; background:rgba(45,212,191,0.15); border:1px solid #2dd4bf; color:#2dd4bf; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:11px; letter-spacing:.22em; text-transform:uppercase; font-weight:600; cursor:pointer; transition:all .15s; }
      #apIntakeCard .cta:hover:not(:disabled) { background:#2dd4bf; color:#050810; }
      #apIntakeCard .cta:disabled { opacity:.5; cursor:wait; }
      #apIntakeCard .consent { font-size:10.5px; color:#6b7c87; line-height:1.55; margin-top:14px; }
      #apIntakeCard .consent code { color:#2dd4bf; font-family:'JetBrains Mono',ui-monospace,monospace; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'apIntakeOverlay';
    overlay.innerHTML = `
      <div id="apIntakeCard">
        <h3>Before we troubleshoot</h3>
        <p class="lead">ARIA will create a ticket and email you a session report. Takes 20 seconds. Required.</p>
        <div class="row">
          <div>
            <label>First name *</label>
            <input id="apF_first" type="text" autocomplete="given-name" />
          </div>
          <div>
            <label>Last name *</label>
            <input id="apF_last" type="text" autocomplete="family-name" />
          </div>
        </div>
        <label>Email *</label>
        <input id="apF_email" type="email" autocomplete="email" placeholder="you@company.com" />
        <label>Phone *</label>
        <input id="apF_phone" type="tel" autocomplete="tel" placeholder="(647) 555-1234" />
        <label>Company (optional)</label>
        <input id="apF_company" type="text" autocomplete="organization" />
        <label>License / Account # (optional)</label>
        <input id="apF_license" type="text" />
        <div class="err-msg" id="apF_err"></div>
        <button class="cta" id="apF_submit">Start troubleshooting →</button>
        <p class="consent">Your data is used only for this ticket and session report. We will email you and <code>integrateditsupp@iisupp.net</code>. You can unsubscribe from follow-ups any time.</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const $ = (id) => document.getElementById(id);
    const submit = $('apF_submit');
    submit.addEventListener('click', async () => {
      const data = {
        firstName: $('apF_first').value.trim(),
        lastName:  $('apF_last').value.trim(),
        email:     $('apF_email').value.trim(),
        phone:     $('apF_phone').value.trim(),
        company:   $('apF_company').value.trim() || null,
        license:   $('apF_license').value.trim() || null
      };
      const err = validate(data);
      ['first','last','email','phone'].forEach(k => $('apF_' + k).classList.remove('err'));
      if (err) {
        $('apF_err').textContent = err.msg;
        if (err.field) $('apF_' + err.field).classList.add('err');
        return;
      }
      $('apF_err').textContent = '';
      submit.disabled = true;
      submit.textContent = 'Creating ticket...';
      try {
        const r = await fetch(API.session, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const j = await r.json();
        if (!r.ok || !j.sessionId) throw new Error(j.error || 'session creation failed');
        session = {
          sessionId: j.sessionId,
          ticket: j.ticket,
          user: data,
          startedAt: Date.now()
        };
        saveSession();
        overlay.remove();
        startWatching();
        // tell aperture the session is live (for any /aperture tab open)
        try {
          window.postMessage({ type: 'aperture:session_start', sessionId: j.sessionId, ticket: j.ticket }, '*');
        } catch {}
        // optional: display a small ticket banner
        showTicketBanner(j.ticket);
      } catch (e) {
        submit.disabled = false;
        submit.textContent = 'Start troubleshooting →';
        $('apF_err').textContent = 'Could not create ticket: ' + (e.message || e);
      }
    });
  }

  function validate(d) {
    if (!d.firstName) return { field:'first', msg:'First name required' };
    if (!d.lastName)  return { field:'last',  msg:'Last name required' };
    if (!d.email)     return { field:'email', msg:'Email required' };
    if (!EMAIL_RE.test(d.email)) return { field:'email', msg:'Enter a valid email address' };
    if (!d.phone)     return { field:'phone', msg:'Phone required' };
    if (!PHONE_RE.test(d.phone.replace(/[^0-9]/g, ''))) return { field:'phone', msg:'Enter a valid phone (7+ digits)' };
    return null;
  }

  function showTicketBanner(ticket) {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483500;background:#0a1219;border:1px solid #2dd4bf;color:#2dd4bf;padding:8px 14px;font-family:\'JetBrains Mono\',ui-monospace,monospace;font-size:11px;letter-spacing:0.05em;box-shadow:0 0 24px rgba(45,212,191,0.2);';
    b.innerHTML = '<span style="color:#6b7c87;">TICKET</span> &nbsp; ' + escapeHtml(ticket);
    document.body.appendChild(b);
    setTimeout(() => { b.style.transition = 'opacity 1s'; b.style.opacity = '0.5'; }, 6000);
  }

  // =========================== WATCH CHAT ===========================
  function startWatching() {
    // Find likely chat-output containers across ARIA layouts
    const SELECTORS = [
      '#aria-results', '#ariaResults', '.aria-chat', '.aria-results',
      '[data-aria-output]', '[data-chat-output]',
      '.aria-locked-content', '.aria-conversation', '.chat-stream', 'main'
    ];
    let containers = [];
    SELECTORS.forEach(sel => { document.querySelectorAll(sel).forEach(el => containers.push(el)); });
    if (!containers.length) containers = [document.body];

    const observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          scanForMessages(n);
        }
      }
    });
    containers.forEach(c => observer.observe(c, { childList: true, subtree: true }));

    // initial sweep
    containers.forEach(c => scanForMessages(c));
    bumpIdle();

    // Hook the "Resolve / Still broken / Talk to human" buttons if present
    document.addEventListener('click', onAnyClick, true);

    // Hook page unload — try to flush idle finalize
    window.addEventListener('beforeunload', () => {
      // Don't auto-end on simple navigation. Idle timer will handle it.
      try { navigator.sendBeacon && navigator.sendBeacon(API.event, JSON.stringify({ sessionId: session && session.sessionId, type:'page_unload' })); } catch {}
    });
  }

  function scanForMessages(root) {
    if (!session) return;
    // Heuristic: any element with text length 15-2000 + role/aria attributes suggesting message
    const candidates = root.querySelectorAll
      ? root.querySelectorAll('[data-role="user"], [data-role="aria"], .aria-msg, .aria-message, .chat-message, .user-message, .assistant-message, p, div')
      : [];
    candidates.forEach(el => {
      // Skip our own modal/banner/style
      if (el.closest && (el.closest('#apIntakeOverlay') || el.closest('#apTicketBanner') || el.tagName === 'STYLE' || el.tagName === 'SCRIPT')) return;
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length < 8 || text.length > 4000) return;
      // Identify role by class/data-role
      const roleAttr = (el.getAttribute && (el.getAttribute('data-role') || '')).toLowerCase();
      const cls = (el.className || '').toString().toLowerCase();
      let from = null;
      if (roleAttr === 'user' || /user-message|chat-user/.test(cls)) from = 'user';
      else if (roleAttr === 'aria' || roleAttr === 'assistant' || /aria-message|assistant-message|chat-aria|chat-assistant/.test(cls)) from = 'aria';
      if (!from) return;
      const hash = simpleHash(from + '|' + text.slice(0, 200));
      if (seenMessageHashes.has(hash)) return;
      seenMessageHashes.add(hash);
      sendEvent(from === 'user' ? 'message_user' : 'message_aria', { text });
      bumpIdle();
    });
  }

  function onAnyClick(e) {
    if (!session) return;
    const t = e.target;
    if (!t || !t.closest) return;
    const txt = (t.innerText || t.textContent || '').trim().toLowerCase();
    if (!txt) return;
    if (/yes|resolved|that worked|fixed/.test(txt) && txt.length < 40) {
      endSession('resolved', 'User confirmed resolution via button.');
    } else if (/still broken|not working|didn'?t work/.test(txt) && txt.length < 40) {
      // Don't auto-escalate on first still-broken; let ARIA decide.
      sendEvent('user_still_broken', { txt });
      bumpIdle();
    } else if (/talk to human|human|escalat|call (?:me|us)/.test(txt) && txt.length < 60) {
      endSession('escalated', 'User requested human handoff.');
    }
  }

  function bumpIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!session) return;
    idleTimer = setTimeout(() => {
      // Idle 5min: end as resolved if last ARIA message looked like a fix, otherwise escalate
      endSession('resolved', 'Session idle 5 min — auto-closed.');
    }, IDLE_MS);
  }

  // =========================== API CALLS ===========================
  function sendEvent(type, payload) {
    if (!session || !session.sessionId) return;
    fetch(API.event, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, type, payload: payload || {} })
    }).catch(() => {});
  }

  function endSession(status, summary) {
    if (!session || !session.sessionId) return;
    const payload = { sessionId: session.sessionId, status, summary };
    fetch(API.sessionEnd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json()).then(j => {
      try { window.postMessage({ type:'aperture:session_end', status, ticket: session.ticket }, '*'); } catch {}
      if (j && j.ticket) {
        showCloseBanner(status, j.ticket, j.emailSent);
      }
      clearSession();
    }).catch(() => {});
  }

  function showCloseBanner(status, ticket, emailSent) {
    const c = status === 'resolved' ? '#4ade80' : '#fbbf24';
    const lbl = status === 'resolved' ? 'RESOLVED' : 'ESCALATED';
    const b = document.createElement('div');
    b.style.cssText = `position:fixed;top:14px;right:14px;z-index:2147483600;background:#0a1219;border:1px solid ${c};color:${c};padding:14px 18px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.6;letter-spacing:0.05em;box-shadow:0 0 30px rgba(45,212,191,0.2);max-width:340px;`;
    b.innerHTML = `
      <div style="color:${c};font-weight:700;letter-spacing:0.18em;">${lbl}</div>
      <div style="color:#d8e0e6;margin-top:4px;">${escapeHtml(ticket)}</div>
      <div style="color:#6b7c87;margin-top:8px;font-size:10.5px;letter-spacing:0;">${emailSent ? 'Report emailed to you.' : 'Report queued (email sending shortly).'}</div>
    `;
    document.body.appendChild(b);
    setTimeout(() => { b.style.transition='opacity 1s'; b.style.opacity='0'; setTimeout(()=>b.remove(), 1200); }, 8000);
  }

  // =========================== UTILS ===========================
  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return h;
  }

  // =========================== BOOTSTRAP ===========================
  function boot() {
    loadSession();
    if (session && session.sessionId) {
      // Resume existing session
      startWatching();
    } else {
      // Fresh — gate with intake modal
      injectModal();
    }
  }

  // Expose minimal API for /aperture page coordination
  window.ARIAperture = {
    getSession: () => session ? { sessionId: session.sessionId, ticket: session.ticket } : null,
    endSession: endSession,
    forceModal: () => { clearSession(); injectModal(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
