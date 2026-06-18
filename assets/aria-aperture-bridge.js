/*! aria-aperture-bridge.js v0.3 — Aperture API integration for /aria
 *  © 2026 Integrated IT Support Inc.
 *
 *  Behavior:
 *   1) On /aria load, check localStorage('aria_active_session'). Resume if exists, else show blocking intake modal.
 *   2) Intake submit → POST /.netlify/functions/aria-session → store sessionId + ticket in localStorage.
 *      The localStorage write fires a `storage` event that an open /aperture tab uses to switch to LIVE mode.
 *   3) MutationObserver on #chatMessages catches new .you-block / .aria-block elements.
 *      Each new message → POST /.netlify/functions/aria-event.
 *   4) Every ARIA message is scanned for resolve/escalate signals.
 *      First match → automatically POST /.netlify/functions/aria-session-end.
 *   5) End-of-session clears localStorage so Aperture knows to reset.
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

  const LS_KEY = 'aria_active_session';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /[0-9]{7,}/;

  // ARIA self-resolve / self-escalate detection
  const RESOLVE_RE = /\b(issue resolved|all set|that should fix|fixed it|should be fixed|resolved\.|resolution summary|^summary:|all done|wrapped|all clear|you're all set|verified resolved)\b/i;
  const ESCALATE_RE = /\b(escalat|hand[-\s]?off|hand it off|l2 ticket|l3 ticket|forwarding to (a )?human|human will (follow|reach)|call(ing)? you back|sending a (tech|technician)|opening a ticket with|cannot resolve this|need a specialist|book a callback)\b/i;

  // =========================== STATE ===========================
  let session = null;
  const seenHashes = new Set();
  let idleTimer = null;
  let chatObserver = null;
  let endingInProgress = false;

  function loadSession() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch { session = null; }
  }
  function saveSession() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(session || null)); } catch {}
  }
  function clearSessionStorage() {
    session = null;
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  async function readJsonSafe(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { error: text.slice(0, 160) || 'non-JSON response' };
    }
  }

  function makeLocalTicket() {
    return 'ARIA-LOCAL-' + Date.now().toString(36).toUpperCase().slice(-6);
  }

  function startLocalSession(data, reason) {
    session = {
      sessionId: 'local_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5),
      ticket: makeLocalTicket(),
      user: data,
      startedAt: Date.now(),
      localOnly: true,
      fallbackReason: String(reason || 'session endpoint unavailable').slice(0, 180)
    };
    saveSession();
    return session;
  }

  // =========================== INTAKE MODAL ===========================
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
    
/* === ARIA i18n stub (Cat 8 localization — 2026-06-18) === */
const ARIA_I18N = {
  en: {
    title: 'Before we troubleshoot',
    lead: 'ARIA will create a ticket and email you a session report. Takes 20 seconds. Required.',
    first: 'First name *', last: 'Last name *',
    email: 'Email *', phone: 'Phone *',
    company: 'Company (optional)', license: 'License / Account # (optional)',
    cta: 'Start troubleshooting \u2192',
    consent: 'Your info is used only for this ticket and session report. We will email you and integrateditsupp@iisupp.net when ARIA resolves or escalates the issue.'
  },
  fr: {
    title: 'Avant de d\u00e9panner',
    lead: 'ARIA cr\u00e9era un ticket et vous enverra par courriel un rapport de session. 20 secondes. Obligatoire.',
    first: 'Pr\u00e9nom *', last: 'Nom *',
    email: 'Courriel *', phone: 'T\u00e9l\u00e9phone *',
    company: 'Entreprise (facultatif)', license: 'Licence / N\u00b0 de compte (facultatif)',
    cta: 'Commencer le d\u00e9pannage \u2192',
    consent: 'Vos renseignements servent uniquement \u00e0 ce ticket et au rapport de session. Vous et integrateditsupp@iisupp.net recevrez un courriel lorsque ARIA r\u00e9soudra ou escaladera le probl\u00e8me.'
  },
  ar: {
    title: '\u0642\u0628\u0644 \u0623\u0646 \u0646\u0628\u062f\u0623',
    lead: '\u0633\u062a\u0646\u0634\u0626 ARIA \u062a\u0630\u0643\u0631\u0629 \u062f\u0639\u0645 \u0648\u062a\u0631\u0633\u0644 \u0644\u0643 \u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062c\u0644\u0633\u0629 \u0639\u0628\u0631 \u0627\u0644\u0628\u0631\u064a\u062f. 20 \u062b\u0627\u0646\u064a\u0629. \u0625\u0644\u0632\u0627\u0645\u064a.',
    first: '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644 *', last: '\u0627\u0633\u0645 \u0627\u0644\u0639\u0627\u0626\u0644\u0629 *',
    email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a *', phone: '\u0627\u0644\u0647\u0627\u062a\u0641 *',
    company: '\u0627\u0644\u0634\u0631\u0643\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)', license: '\u0631\u062e\u0635\u0629 / \u0631\u0642\u0645 \u0627\u0644\u062d\u0633\u0627\u0628 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)',
    cta: '\u0627\u0628\u062f\u0623 \u0627\u0644\u062a\u0634\u062e\u064a\u0635 \u2192',
    consent: '\u062a\u0633\u062a\u062e\u062f\u0645 \u0645\u0639\u0644\u0648\u0645\u0627\u062a\u0643 \u0641\u0642\u0637 \u0644\u0647\u0630\u0647 \u0627\u0644\u062a\u0630\u0643\u0631\u0629 \u0648\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062c\u0644\u0633\u0629. \u0633\u064a\u0635\u0644\u0643 \u0625\u064a\u0645\u064a\u0644 \u0648integrateditsupp@iisupp.net \u0639\u0646\u062f\u0645\u0627 \u062a\u062d\u0644 ARIA \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0623\u0648 \u062a\u0635\u0639\u062f\u0647\u0627.'
  }
};
function ariaPickLocale() {
  try {
    var p = new URLSearchParams(location.search);
    var q = p.get('lang');
    if (q && ARIA_I18N[q.toLowerCase()]) return q.toLowerCase();
    var l = localStorage.getItem('aria_lang');
    if (l && ARIA_I18N[l]) return l;
    var nav = (navigator.language || 'en').toLowerCase().split('-')[0];
    return ARIA_I18N[nav] ? nav : 'en';
  } catch { return 'en'; }
}
const __ARIA_LOCALE__ = ariaPickLocale();
const __T__ = ARIA_I18N[__ARIA_LOCALE__] || ARIA_I18N.en;

    overlay.innerHTML = `
      <div id="apIntakeCard">
        <h3>${__T__.title}</h3>
        <p class="lead">${__T__.lead}</p>
        <div class="row">
          <div><label>${__T__.first}</label><input id="apF_first" type="text" autocomplete="given-name" /></div>
          <div><label>${__T__.last}</label><input id="apF_last" type="text" autocomplete="family-name" /></div>
        </div>
        <label>${__T__.email}</label>
        <input id="apF_email" type="email" autocomplete="email" placeholder="you@company.com" />
        <label>${__T__.phone}</label>
        <input id="apF_phone" type="tel" autocomplete="tel" placeholder="(647) 555-1234" />
        <label>${__T__.company}</label>
        <input id="apF_company" type="text" autocomplete="organization" />
        <label>${__T__.license}</label>
        <input id="apF_license" type="text" />
        <div class="err-msg" id="apF_err"></div>
        <button class="cta" id="apF_submit">${__T__.cta}</button>
        <p class="consent">${__T__.consent.replace("integrateditsupp@iisupp.net", "<code>integrateditsupp@iisupp.net</code>")}</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const $ = (id) => document.getElementById(id);
    $('apF_submit').addEventListener('click', async () => {
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
      const submit = $('apF_submit');
      submit.disabled = true;
      submit.textContent = 'Creating ticket...';
      try {
        const r = await fetch(API.session, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const j = await readJsonSafe(r);
        if (!r.ok || !j || !j.sessionId) {
          const msg = (j && (j.error || j.detail)) || `session endpoint returned ${r.status}`;
          throw new Error(msg);
        }
        session = { sessionId: j.sessionId, ticket: j.ticket, user: data, startedAt: Date.now() };
        saveSession(); // fires storage event in other tabs
        try { if (data && data.email) { localStorage.setItem('aria_user_email', String(data.email).toLowerCase()); localStorage.setItem('aria_user_profile', JSON.stringify({firstName:data.firstName,lastName:data.lastName,company:data.company||'',email:String(data.email).toLowerCase(),startedAt:Date.now()})); window.dispatchEvent(new CustomEvent('aria-user-set', { detail: data })); } } catch(e) {}
        overlay.remove();
        showTicketBanner(j.ticket);
        startWatching();
      } catch (e) {
        const local = startLocalSession(data, e.message || e);
        try { if (data && data.email) { localStorage.setItem('aria_user_email', String(data.email).toLowerCase()); localStorage.setItem('aria_user_profile', JSON.stringify({firstName:data.firstName,lastName:data.lastName,company:data.company||'',email:String(data.email).toLowerCase(),startedAt:Date.now()})); window.dispatchEvent(new CustomEvent('aria-user-set', { detail: data })); } } catch(e) {}
        overlay.remove();
        showTicketBanner(local.ticket);
        startWatching();
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
    const existing = document.getElementById('apTicketBanner'); if (existing) existing.remove();
    const b = document.createElement('div');
    b.id = 'apTicketBanner';
    b.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483500;background:#0a1219;border:1px solid #2dd4bf;color:#2dd4bf;padding:8px 14px;font-family:\'JetBrains Mono\',ui-monospace,monospace;font-size:11px;letter-spacing:0.05em;box-shadow:0 0 24px rgba(45,212,191,0.2);';
    b.innerHTML = '<span style="color:#6b7c87;">TICKET</span> &nbsp; ' + escapeHtml(ticket);
    document.body.appendChild(b);
    setTimeout(() => { b.style.transition = 'opacity 1s'; b.style.opacity = '0.5'; }, 8000);
  }

  // =========================== WATCH CHAT ===========================
  function canObserveNode(node) {
    return !!(node && typeof node.nodeType === 'number' && typeof node.addEventListener === 'function');
  }

  function startWatching() {
    const chat = document.getElementById('chatMessages');
    if (!canObserveNode(chat)) {
      // Retry after a beat
      setTimeout(startWatching, 500);
      return;
    }
    // Initial scan (already-rendered messages we may have missed)
    scanForMessages(chat);

    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          scanForMessages(n);
        }
      }
    });
    chatObserver.observe(chat, { childList: true, subtree: true });
    bumpIdle();
  }

  function scanForMessages(root) {
    if (!session || endingInProgress) return;

    // Find .you-block or .aria-block elements (skip introBlock)
    const find = (sel) => root.querySelectorAll ? root.querySelectorAll(sel) : [];
    const userBlocks = root.matches && root.matches('.you-block') ? [root] : Array.from(find('.you-block'));
    const ariaBlocks = root.matches && root.matches('.aria-block') ? [root] : Array.from(find('.aria-block'));

    userBlocks.forEach(el => emitMessage('user', el));
    ariaBlocks.forEach(el => {
      // Skip the intro block (#introBlock has the "How can I help you today?" greeting)
      if (el.closest && el.closest('#introBlock')) return;
      if (el.id === 'introBlock') return;
      emitMessage('aria', el);
    });
  }

  function emitMessage(from, el) {
    let text = (el.innerText || el.textContent || '').trim();
    // Strip the leading "YOU" or "ARIA" prefix that's the role label
    text = text.replace(/^(YOU|ARIA)\s+/i, '').trim();
    if (text.length < 2 || text.length > 8000) return;

    const hash = from + '|' + simpleHash(text.slice(0, 240));
    if (seenHashes.has(hash)) return;
    seenHashes.add(hash);

    sendEvent(from === 'user' ? 'message_user' : 'message_aria', { text });
    bumpIdle();

    // ARIA self-detection of resolve / escalate
    if (from === 'aria') {
      if (ESCALATE_RE.test(text)) {
        scheduleEnd('escalated', text);
      } else if (RESOLVE_RE.test(text)) {
        scheduleEnd('resolved', text);
      }
    }
  }

  let endScheduled = null;
  function scheduleEnd(status, summary) {
    if (endingInProgress || !session) return;
    // Debounce — wait a moment in case more ARIA text streams in
    if (endScheduled) { clearTimeout(endScheduled); }
    endScheduled = setTimeout(() => {
      endSession(status, summary);
    }, 1500);
  }

  function bumpIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!session || endingInProgress) return;
    idleTimer = setTimeout(() => {
      // Idle 5min — close as resolved
      endSession('resolved', 'Session idle 5 min — auto-closed.');
    }, 5 * 60 * 1000);
  }

  // =========================== API ===========================
  function sendEvent(type, payload) {
    if (!session || !session.sessionId) return;
    if (session.localOnly) return;
    fetch(API.event, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, type, payload: payload || {} })
    }).catch(() => {});
  }

  function endSession(status, summary) {
    if (!session || !session.sessionId || endingInProgress) return;
    endingInProgress = true;
    const ticket = session.ticket;
    if (session.localOnly) {
      showCloseBanner(status, ticket, false, true);
      setTimeout(() => {
        clearSessionStorage();
        endingInProgress = false;
        seenHashes.clear();
      }, 2500);
      return;
    }
    fetch(API.sessionEnd, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, status, summary: summary || '' })
    }).then(readJsonSafe).then(j => {
      showCloseBanner(status, ticket, !!(j && j.emailSent), false);
      // Clear localStorage AFTER a short delay so Aperture has time to fetch final state
      setTimeout(() => {
        clearSessionStorage(); // fires storage event → Aperture resets
        endingInProgress = false;
        seenHashes.clear();
      }, 2500);
    }).catch(() => { endingInProgress = false; });
  }

  function showCloseBanner(status, ticket, emailSent, localOnly) {
    const c = status === 'resolved' ? '#4ade80' : '#fbbf24';
    const lbl = status === 'resolved' ? 'RESOLVED' : 'ESCALATED';
    const existing = document.getElementById('apCloseBanner'); if (existing) existing.remove();
    const b = document.createElement('div');
    b.id = 'apCloseBanner';
    b.style.cssText = `position:fixed;top:14px;right:14px;z-index:2147483600;background:#0a1219;border:1px solid ${c};color:${c};padding:14px 18px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.6;letter-spacing:0.05em;box-shadow:0 0 30px rgba(45,212,191,0.2);max-width:340px;`;
    b.innerHTML = `
      <div style="color:${c};font-weight:700;letter-spacing:0.18em;">${lbl}</div>
      <div style="color:#d8e0e6;margin-top:4px;">${escapeHtml(ticket || '')}</div>
      <div style="color:#6b7c87;margin-top:8px;font-size:10.5px;letter-spacing:0;">${localOnly ? 'Local session closed. No email sent because the ticket endpoint was unavailable.' : (emailSent ? 'Report emailed to you + integrateditsupp@iisupp.net.' : 'Report queued; will email once SMTP env is set.')}</div>
    `;
    document.body.appendChild(b);
    setTimeout(() => { b.style.transition='opacity 1s'; b.style.opacity='0'; setTimeout(()=>b.remove(), 1200); }, 9000);
  }

  // =========================== UTILS ===========================
  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function simpleHash(s) { let h=0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return h; }

  // =========================== BOOT ===========================
  function boot() {
    loadSession();
    if (session && session.sessionId) {
      showTicketBanner(session.ticket);
      startWatching();
    } else {
      injectModal();
    }
  }

  window.ARIAperture = {
    getSession: () => session ? { sessionId: session.sessionId, ticket: session.ticket } : null,
    endSession: endSession,
    forceModal: () => { clearSessionStorage(); injectModal(); },
    // expose for testing
    _emit: emitMessage,
    _scanNow: () => { const c = document.getElementById('chatMessages'); if (c) scanForMessages(c); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
