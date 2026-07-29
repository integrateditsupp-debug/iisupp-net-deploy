/*!
 * aria-vision-escalate.js — the other half of "Escalate to IIS (a human will help)".
 * ---------------------------------------------------------------------------------
 * ARIA abstained, the user asked for a human, and the widget carried the draft here. This file
 * turns /aria?escalate=1 into a review-and-send screen instead of a page that quietly forgets why
 * the user arrived. Load after aria-vision-handoff.js. Framework-free, no dependencies.
 *
 * THE RULES IT IS BUILT AROUND
 *
 * Nothing is sent until the user presses Send. The panel opens with the draft ON SCREEN and a
 * literal list of what would travel — not a summary of it, the actual text — because the one
 * moment a privacy promise matters is the moment before data leaves.
 *
 * The ticket is REAL or it is not claimed. The POST goes to the existing
 * `aria-escalation?action=escalate` endpoint, which mints a real ticket id, sets a real ETA and
 * sends the real notification mail. The confirmation shows the id THAT ENDPOINT RETURNED. If the
 * call fails, returns non-2xx, or comes back without an id, the panel says so and offers a retry —
 * it never shows a ticket number we do not have, and never says an email was sent when we do not
 * know that it was (Rule 14).
 *
 * The draft is editable. The user is the author of anything sent under their name, and correcting
 * an ARIA-written summary is the single most useful thing they can do before a technician reads it.
 */
(function (global) {
  'use strict';

  var GOLD = '#c5a059';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var SESSION_KEY = 'aria_session_email';   // the site's existing sign-in key — reused, not re-invented

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, function (c) {
      return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function injectCSS() {
    if (document.getElementById('ave-css')) return;
    var s = document.createElement('style');
    s.id = 'ave-css';
    s.textContent = [
      '.ave-wrap{font-family:Arial,Helvetica,sans-serif;color:#f5f5f0;background:#0a0a0a;border:1px solid #2a2a2a;border-left:3px solid ' + GOLD + ';border-radius:12px;padding:20px;margin:18px 0}',
      '.ave-wrap h3{margin:0 0 6px;color:' + GOLD + ';font-size:17px}',
      '.ave-wrap p{font-size:13.5px;line-height:1.6;color:#c9c9c1;margin:8px 0}',
      '.ave-list{margin:8px 0 12px 18px;padding:0;font-size:13px;color:#c9c9c1}',
      '.ave-list li{margin:3px 0}',
      '.ave-field{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8f8f88;margin:14px 0 5px}',
      '.ave-wrap input,.ave-wrap textarea{width:100%;box-sizing:border-box;background:#050505;color:#f5f5f0;border:1px solid #333;border-radius:8px;padding:10px;font-size:13.5px;font-family:inherit}',
      '.ave-wrap textarea{min-height:190px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.5}',
      '.ave-btn{background:' + GOLD + ';color:#0a0a0a;border:0;border-radius:8px;padding:11px 18px;font-weight:700;font-size:13.5px;cursor:pointer;margin:14px 8px 0 0}',
      '.ave-btn.ghost{background:transparent;color:' + GOLD + ';border:1px solid ' + GOLD + '}',
      '.ave-btn[disabled]{opacity:.55;cursor:default}',
      '.ave-err{color:#ff8f8f;font-size:13px;margin-top:10px}',
      '.ave-ok{border-color:#7bd88f}',
      '.ave-tkt{font-family:ui-monospace,Menlo,Consolas,monospace;color:' + GOLD + ';font-size:15px;font-weight:700}',
      '.ave-note{font-size:12px;color:#8f8f88;margin-top:10px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // Where to put the panel: the ask-bar area if this page has one, else the top of main, else body.
  function findHost() {
    var ids = ['aria-escalate-host', 'aria-vision-zone', 'ariaAskBar', 'aria-ask', 'main'];
    for (var i = 0; i < ids.length; i++) {
      var n = document.getElementById(ids[i]);
      if (n) return n;
    }
    return document.querySelector('main') || document.body;
  }

  function savedEmail() {
    try { return global.localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; }
  }

  function render(draft) {
    injectCSS();
    var host = findHost();
    var wrap = el('div', 'ave-wrap');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Escalate to IIS');

    wrap.appendChild(el('h3', null, 'Send this to a person at IIS'));
    wrap.appendChild(el('p', null,
      'ARIA would not guess at this one, so it wrote up what it actually saw. Read it, change anything ' +
      'that is wrong, and press send. Nothing has been sent yet.'));

    var HO = global.ARIAVisionHandoff;
    var lines = (HO && HO.describe) ? HO.describe(draft) : [];
    if (lines.length) {
      var ul = el('ul', 'ave-list');
      for (var i = 0; i < lines.length; i++) ul.appendChild(el('li', null, esc(lines[i])));
      wrap.appendChild(el('p', null, '<strong>What goes with it:</strong>'));
      wrap.appendChild(ul);
    }

    // Title — the ticket subject. Empty when ARIA had no real evidence to build one from, and in
    // that case the user has to write it: inventing a subject would be the exact bluff we refuse.
    wrap.appendChild(el('label', 'ave-field', 'Subject'));
    var titleIn = el('input');
    titleIn.type = 'text';
    titleIn.maxLength = 240;
    titleIn.value = draft.title || '';
    titleIn.placeholder = draft.titleFromEvidence
      ? 'One clear sentence'
      : 'ARIA could not tell what to call this — please describe it in one sentence';
    wrap.appendChild(titleIn);

    wrap.appendChild(el('label', 'ave-field', 'Your email (so a technician can reply)'));
    var mailIn = el('input');
    mailIn.type = 'email';
    mailIn.maxLength = 120;
    mailIn.value = savedEmail();
    mailIn.placeholder = 'you@company.com';
    wrap.appendChild(mailIn);

    wrap.appendChild(el('label', 'ave-field', 'What ARIA wrote (edit freely)'));
    var bodyIn = el('textarea');
    bodyIn.value = draft.body || '';
    wrap.appendChild(bodyIn);

    var send = el('button', 'ave-btn', 'Send to IIS');
    var cancel = el('button', 'ave-btn ghost', 'Not now');
    wrap.appendChild(send);
    wrap.appendChild(cancel);
    var errBox = el('div', 'ave-err');
    errBox.hidden = true;
    wrap.appendChild(errBox);
    wrap.appendChild(el('p', 'ave-note',
      'Sent to IIS only. It is not posted publicly. If you would rather ask the community instead, ' +
      'use "Open a discussion" back on the diagnosis.'));

    function fail(msg) {
      errBox.textContent = msg;
      errBox.hidden = false;
      send.disabled = false;
      send.textContent = 'Try again';
    }

    cancel.addEventListener('click', function () {
      if (HO && HO.clear) HO.clear();
      wrap.parentNode && wrap.parentNode.removeChild(wrap);
    });

    send.addEventListener('click', function () {
      errBox.hidden = true;
      var title = String(titleIn.value || '').trim();
      var mail = String(mailIn.value || '').trim();
      var body = String(bodyIn.value || '').trim();
      if (title.length < 8) return fail('Give it a subject of at least 8 characters so a technician knows what they are opening.');
      if (!EMAIL_RE.test(mail)) return fail('That email does not look right — without it nobody can reply to you.');
      if (body.length < 10) return fail('There is nothing in the write-up to send.');

      // The request template was composed SERVER-SIDE and travelled inside the draft. We fill the
      // two fields the user just typed and change nothing else — the endpoint, the priority and
      // the abstain labelling are not ours to rewrite here.
      var req = draft.request;
      if (!req || !req.endpoint || !req.body) return fail('This draft is missing its send details. Go back and run the diagnosis again.');
      var payload = {};
      for (var k in req.body) if (Object.prototype.hasOwnProperty.call(req.body, k)) payload[k] = req.body[k];
      payload.userEmail = mail;
      payload.issue = title.slice(0, 240);
      payload.ariaFindings = 'ARIA ABSTAINED - it did not diagnose this and would not guess.\n\n' + body;

      if (typeof fetch !== 'function') return fail('This browser cannot send it. Please call (647) 581-3182.');
      send.disabled = true;
      send.textContent = 'Sending…';

      fetch(req.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().then(function (j) { return { status: r.status, ok: r.ok, j: j }; },
                             function () { return { status: r.status, ok: r.ok, j: null }; });
      }).then(function (out) {
        var ticket = out.j && out.j.ticket;
        // A ticket id is the ONLY proof the ticket exists. No id → no claim.
        if (!out.ok || !out.j || out.j.ok === false || !ticket || !ticket.id) {
          return fail('It did not go through' + (out.status ? ' (http-' + out.status + ')' : '') +
            ' — nothing was sent. Press try again, or call (647) 581-3182.');
        }
        if (HO && HO.clear) HO.clear();
        showSent(wrap, ticket, mail);
      }).catch(function (e) {
        fail('It did not go through (' + ((e && e.message) || 'network') + ') — nothing was sent. Press try again, or call (647) 581-3182.');
      });
    });

    // Put it where the user is looking, and move focus so a screen reader announces it.
    if (host.firstChild) host.insertBefore(wrap, host.firstChild);
    else host.appendChild(wrap);
    wrap.setAttribute('tabindex', '-1');
    try { wrap.focus({ preventScroll: false }); } catch (e) { /* older browsers */ }
    try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* older browsers */ }
  }

  // The confirmation. Every fact in it came back from the endpoint; the ETA line is omitted
  // entirely when the endpoint did not give us one, rather than filled with a comfortable guess.
  function showSent(wrap, ticket, mail) {
    wrap.className = 'ave-wrap ave-ok';
    wrap.innerHTML = '';
    wrap.appendChild(el('h3', null, 'Sent — a person has it now'));
    wrap.appendChild(el('p', null, 'Your ticket reference is <span class="ave-tkt">' + esc(ticket.id) + '</span>.'));
    if (ticket.etaSeconds) {
      var mins = Math.max(1, Math.round(Number(ticket.etaSeconds) / 60));
      wrap.appendChild(el('p', null, 'Target time to a solution: about ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.'));
    }
    wrap.appendChild(el('p', null, 'Replies go to ' + esc(mail) + '. Keep the reference if you call: (647) 581-3182.'));
    wrap.appendChild(el('p', 'ave-note', 'ARIA did not diagnose this one, and it did not pretend to. A technician picks it up from here.'));
  }

  function noDraft() {
    injectCSS();
    var wrap = el('div', 'ave-wrap');
    wrap.appendChild(el('h3', null, 'Nothing to escalate yet'));
    wrap.appendChild(el('p', null,
      'This page opens the escalation form when ARIA has just declined to diagnose something — it carries ' +
      'the details across for you. Nothing was carried over this time (the draft expires after 30 minutes, ' +
      'and it does not survive a new tab). Describe the problem to ARIA or drop the error in, and if it ' +
      'cannot answer you will get the "escalate to IIS" button with everything already filled in.'));
    wrap.appendChild(el('p', 'ave-note', 'In a hurry? Call (647) 581-3182.'));
    var host = findHost();
    if (host.firstChild) host.insertBefore(wrap, host.firstChild);
    else host.appendChild(wrap);
  }

  function start() {
    var params;
    try { params = new URLSearchParams(global.location.search); } catch (e) { return; }
    if (params.get('escalate') !== '1') return;
    var HO = global.ARIAVisionHandoff;
    var draft = HO && HO.take ? HO.take() : null;
    if (draft && draft.body) render(draft);
    else noDraft();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  global.ARIAVisionEscalate = { render: render, start: start, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
