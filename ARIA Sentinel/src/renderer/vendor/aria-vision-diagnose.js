/*!
 * aria-vision-diagnose.js — STAGE 2 reusable "show, don't type" widget (framework-free).
 * One drop/paste/upload zone reused across: ARIA web ask-bar, ARIA Sentinel "diagnose a screenshot",
 * and the Forums "Ask AI" tab. No dependencies. Brand: dark + gold (#c5a059).
 *
 * Usage:
 *   ARIAVisionDiagnose.mount(document.getElementById('zone'), {
 *     surface: 'web',                                  // 'web' | 'sentinel' | 'forums'
 *     endpoint: '/.netlify/functions/aria-vision-diagnose',
 *     os: 'windows',
 *     onFix:      (fix, result) => {},                 // wire to Sentinel deep-link / download / audit flow
 *     onFeedback: (helpful, result) => {},
 *   });
 *
 * PRIVACY: images are only sent to the cloud vision model AFTER the user opts in on the disclosure.
 * Text/logs are matched against the offline KB — the widget shows exactly what leaves the device.
 */
(function (global) {
  'use strict';

  var GOLD = '#c5a059';
  var TEXT_EXT = /\.(txt|log|json|md|csv|xml|ini|cfg|conf|out|err|trace)$/i;

  function injectCSS() {
    if (document.getElementById('avd-css')) return;
    var s = document.createElement('style');
    s.id = 'avd-css';
    s.textContent = [
      '.avd{font-family:Arial,Helvetica,sans-serif;color:#f5f5f0}',
      '.avd-zone{border:1.5px dashed ' + GOLD + ';border-radius:12px;padding:22px;text-align:center;background:#0a0a0a;cursor:pointer;transition:.15s}',
      '.avd-zone.drag{background:#141008;border-color:#e6c983}',
      '.avd-zone h4{margin:0 0 6px;color:' + GOLD + ';font-size:16px}',
      '.avd-zone p{margin:4px 0;font-size:13px;color:#9a9a92}',
      '.avd-note{font-size:11px;color:#6f6f68;margin-top:8px}',
      '.avd-card{margin-top:14px;border:1px solid #24240f;border-radius:12px;padding:16px 18px;background:#0c0c0c}',
      '.avd-h{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
      '.avd-badge{font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px;border:1px solid #333}',
      '.avd-badge.high{color:#7bd88f;border-color:#2f5c39}.avd-badge.medium{color:#e6c983;border-color:#5c4a1f}',
      '.avd-badge.low{color:#e0a15e;border-color:#5c3a1f}.avd-badge.abstain{color:#c98b8b;border-color:#5c2f2f}',
      '.avd-bar{height:6px;border-radius:4px;background:#1b1b1b;overflow:hidden;margin:8px 0 12px}',
      '.avd-bar>i{display:block;height:100%;background:' + GOLD + '}',
      '.avd-steps{white-space:pre-wrap;font-size:13px;line-height:1.5;color:#d8d8d0;max-height:260px;overflow:auto}',
      '.avd-btn{display:inline-block;margin:10px 8px 0 0;padding:9px 16px;border-radius:8px;border:1px solid ' + GOLD + ';background:' + GOLD + ';color:#000;font-weight:700;font-size:13px;cursor:pointer}',
      '.avd-btn.ghost{background:transparent;color:' + GOLD + '}',
      '.avd-priv{font-size:11px;color:#8a8a82;margin-top:10px;border-top:1px solid #1a1a1a;padding-top:8px}',
      '.avd-consent{margin-top:12px;background:#120f06;border:1px solid #3a2f12;border-radius:10px;padding:12px 14px;font-size:13px}',
      '.avd-consent label{display:block;margin:8px 0;cursor:pointer}',
      '.avd-fb{margin-top:10px;font-size:13px;color:#9a9a92}',
      '.avd-err{color:#c98b8b;font-size:13px;margin-top:8px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mount(root, opts) {
    opts = opts || {};
    injectCSS();
    var surface = opts.surface || 'web';
    var endpoint = opts.endpoint || '/.netlify/functions/aria-vision-diagnose';
    var os = opts.os || 'windows';

    root.classList.add('avd');
    root.innerHTML = '';
    var zone = el('div', 'avd-zone');
    // Focusable so an in-widget paste (Ctrl/Cmd-V) targets THIS zone, not the whole document.
    zone.setAttribute('tabindex', '0');
    zone.setAttribute('role', 'button');
    zone.setAttribute('aria-label', 'Show ARIA the problem — click, or focus and paste a screenshot or error text');
    zone.innerHTML =
      '<h4>Show ARIA the problem</h4>' +
      '<p>Drop or paste a <strong>screenshot</strong>, an <strong>error dialog</strong>, or a <strong>log file</strong> — ARIA reads it and returns the fix.</p>' +
      '<p style="color:' + GOLD + '">Drag &amp; drop · click here then paste (Ctrl/Cmd-V) · or click to choose a file</p>' +
      (surface === 'sentinel' ? '<p class="avd-note">Or use “Diagnose my current screen” — Sentinel asks your permission first.</p>' : '') +
      '<div class="avd-note">Text &amp; logs are matched against the offline KB on our own server — no third-party AI model. Images go to the cloud vision model, <strong>unredacted</strong>, only after you approve.</div>';
    var out = el('div');
    var lastCard = null;   // set by render(); the B5 resolve confirmation attaches here
    var fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.txt,.log,.json,.md,.csv,.xml,.ini,.cfg,.out,.err';
    fileInput.style.display = 'none';

    root.appendChild(zone);
    root.appendChild(fileInput);
    root.appendChild(out);

    zone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); });
    });
    zone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });
    // D3 — SCOPED paste: only handle a paste the user aimed AT this widget (the zone is focusable),
    // never one targeting an input/textarea/contenteditable or anything outside the widget root.
    // Without this guard the document-level listener would exfiltrate ANY paste on the host page
    // (login box, forums reply, search) to the diagnose endpoint. This widget is reused in Forums
    // "Ask AI", so the scoping must be airtight.
    document.addEventListener('paste', function (e) {
      if (!root.isConnected) return;
      var t = e.target;
      var withinWidget = t && (t === root || t === zone || (root.contains && root.contains(t)));
      if (!withinWidget) return;                 // paste wasn't aimed at the widget → ignore it entirely
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) { handleFile(items[i].getAsFile()); return; }
      }
      var txt = e.clipboardData && e.clipboardData.getData('text');
      if (txt && txt.length > 8) submit({ kind: 'text', text: txt });
    });

    function handleFile(file) {
      if (!file) return;
      if (file.type.indexOf('image') === 0) {
        var reader = new FileReader();
        reader.onload = function () {
          var b64 = String(reader.result).split(',')[1];
          promptCloudConsent(b64, file.type);            // images require opt-in before cloud call
        };
        reader.readAsDataURL(file);
      } else if (TEXT_EXT.test(file.name) || file.type.indexOf('text') === 0) {
        var tr = new FileReader();
        tr.onload = function () { submit({ kind: 'log', text: String(tr.result), filename: file.name }); };
        tr.readAsText(file);
      } else {
        renderError('That file type isn\'t supported yet. Paste the error text, drop a screenshot, or a .log/.txt file.');
      }
    }

    // Sentinel: request a consent-gated screen capture from the host (Electron preload bridge).
    function diagnoseCurrentScreen() {
      if (!global.ariaSentinel || !global.ariaSentinel.captureScreenWithConsent) {
        renderError('Screen capture is only available inside ARIA Sentinel.');
        return;
      }
      global.ariaSentinel.captureScreenWithConsent().then(function (res) {
        if (!res || !res.consented) { renderError('Screen capture needs your approval.'); return; }
        promptCloudConsent(res.imageBase64, res.mediaType || 'image/png', { screenCapture: true, autoCapture: true });
      });
    }
    opts.exposeCapture && opts.exposeCapture(diagnoseCurrentScreen);

    function promptCloudConsent(b64, mediaType, extraConsent) {
      out.innerHTML = '';
      var box = el('div', 'avd-consent');
      box.innerHTML =
        '<strong style="color:' + GOLD + '">Before ARIA looks at this image</strong>' +
        '<p style="margin:8px 0;color:#c9c9c1">The image itself is sent <strong>unredacted</strong> to Claude Fable 5 (vision) to read the error — pixels can\'t be masked the way text is. Only the text ARIA reads back is filtered for secrets, and we keep no screenshot after. Don\'t upload anything you wouldn\'t show a technician — or cancel and type the error text to keep it off the cloud.</p>' +
        '<label><input type="checkbox" id="avd-ok"> I understand the image is sent unredacted, and I want ARIA to analyze it.</label>';
      var go = el('button', 'avd-btn', 'Analyze image');
      var cancel = el('button', 'avd-btn ghost', 'Cancel — I\'ll type it instead');
      box.appendChild(go); box.appendChild(cancel);
      out.appendChild(box);
      go.addEventListener('click', function () {
        if (!box.querySelector('#avd-ok').checked) return;
        var consent = Object.assign({ cloudProcessing: true, ts: Date.now() }, extraConsent || {});
        submit({ kind: extraConsent && extraConsent.screenCapture ? 'screen-capture' : 'image', imageBase64: b64, mediaType: mediaType, allowCloudVision: true, consent: consent });
      });
      cancel.addEventListener('click', function () { out.innerHTML = ''; });
    }

    function submit(payload) {
      out.innerHTML = '<p style="color:' + GOLD + '">Reading it…</p>';
      var full = Object.assign({ surface: surface, os: os }, payload);
      fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(full) })
        .then(function (r) { return r.json(); })
        .then(function (res) { render(res, full); })
        .catch(function () { renderError('Could not reach the diagnosis service. Please try again or call (647) 581-3182.'); });
    }

    function render(res, sent) {
      out.innerHTML = '';
      if (!res || res.ok === false) return renderError((res && res.error) || 'Something went wrong.');
      if (res.blocked) {
        var b = el('div', 'avd-card');
        b.innerHTML = '<div class="avd-h"><strong>Permission needed</strong></div><p style="font-size:13px;color:#c9c9c1">' + esc(res.disclosure || '') + '</p>';
        out.appendChild(b);
        return;
      }
      var card = el('div', 'avd-card');
      lastCard = card;
      var lvl = res.confidenceLabel || (res.abstain ? 'abstain' : 'low');
      var pct = Math.max(6, Math.min(100, Math.round((res.confidence || 0) / 40 * 100)));

      if (res.abstain || !res.diagnosis) {
        card.appendChild(el('div', 'avd-h', '<span class="avd-badge abstain">Not sure — won\'t guess</span>'));
        var hf = res.honestFallback || {};
        card.appendChild(el('p', null, esc(hf.message || 'I don\'t have a confident answer for this one.')));
        (hf.options || []).forEach(function (o) {
          var btn = el('button', 'avd-btn ghost', esc(o.label));
          btn.addEventListener('click', function () { if (o.href) global.location.href = o.href; else if (opts.onFallback) opts.onFallback(o, res); });
          card.appendChild(btn);
        });
      } else {
        var d = res.diagnosis;
        card.appendChild(el('div', 'avd-h',
          '<strong style="font-size:16px;color:' + GOLD + '">' + esc(d.title || 'Diagnosis') + '</strong>' +
          '<span class="avd-badge ' + lvl + '">' + esc(lvl) + ' confidence</span>'));
        var bar = el('div', 'avd-bar'); bar.appendChild(el('i')); bar.firstChild.style.width = pct + '%';
        card.appendChild(bar);
        card.appendChild(el('div', 'avd-steps', esc(d.steps || '')));
        if (res.fix && res.fix.oneClickEligible) {
          var fixBtn = el('button', 'avd-btn', 'Fix this with ' + (surface === 'sentinel' ? 'Sentinel' : 'ARIA') + ' →');
          fixBtn.addEventListener('click', function () { if (opts.onFix) opts.onFix(res.fix, res); else global.location.href = '/aria?fix=' + encodeURIComponent(res.fix.recipeId); });
          card.appendChild(fixBtn);
        }
        var solo = el('button', 'avd-btn ghost', 'Read the full solution');
        solo.addEventListener('click', function () { global.location.href = d.url; });
        card.appendChild(solo);
        // Feedback (Rule 14 — real signal, no fake activity)
        var fb = el('div', 'avd-fb', (res.feedbackPrompt || 'Was this the right fix?') + '  ');
        ['Yes', 'Not yet'].forEach(function (label) {
          var y = el('button', 'avd-btn ghost', label);
          y.style.padding = '4px 12px';
          y.addEventListener('click', function () { fb.innerHTML = 'Thanks — noted.'; if (opts.onFeedback) opts.onFeedback(label === 'Yes', res); });
          fb.appendChild(y);
        });
        card.appendChild(fb);
      }

      // Privacy receipt — what we removed + what left the device.
      var red = res.redaction || { count: 0, found: [] };
      var flow = res.dataFlow || {};
      // Honest receipt: text redaction applies to the text path; the image itself is sent unredacted.
      var priv = 'Privacy: ' + (red.count ? ('removed ' + red.count + ' sensitive item' + (red.count === 1 ? '' : 's') + ' from the text (' + (red.found || []).map(function (f) { return f.count + ' ' + f.type.toLowerCase(); }).join(', ') + '). ') : 'no sensitive text detected. ') +
        (flow.thirdPartyModel
          ? ('The image was sent UNREDACTED to ' + esc(flow.sentTo || 'the vision model') + '; ' + esc(flow.retention || 'not stored') + '.')
          : ('Matched on our own server against the offline KB — ' + esc(flow.retention || 'not stored') + '. No third-party AI model saw it.'));
      card.appendChild(el('div', 'avd-priv', priv));
      out.appendChild(card);
    }


    // ── B5 tie-in — "resolved · email sent · ticket ref" (Rule 14: real-or-empty) ──────────────
    // The HOST calls this only after the EXISTING gated fix flow (aria-guided-fix / Sentinel
    // resolve: restore point · kill-switch · risk gate · HMAC audit token · append-only log)
    // reports a genuinely completed AND verified repair. This widget never mints a ticket ref,
    // never decides an email was sent, and never writes the sentence itself: the wording and the
    // real-or-empty rules come from the shared B5 builder (window.ariaGlobeConfirmation), so the
    // vision surface can never drift from the desktop/web confirmation the rest of ARIA shows.
    // Anything short of a real verified resolve with a real ticket ref renders NOTHING.
    function reportResolved(detail) {
      detail = detail || {};
      if (detail.completed !== true || detail.verified !== true) return { show: false, reason: 'not-resolved' };
      var b5 = global.ariaGlobeConfirmation;
      // No shared builder loaded → we stay silent rather than invent our own wording.
      if (!b5 || typeof b5.build !== 'function') return { show: false, reason: 'confirmation-unavailable' };
      var email = detail.email || {};
      var conf = b5.build({
        kbResolved: true,
        issueTitle: detail.issueTitle != null ? detail.issueTitle : detail.issue,
        ticketRef: detail.ticketRef,          // pass-through only — a missing/blank ref => show:false
        email: { attempted: email.attempted === true || email.sent === true, sent: email.sent === true, to: email.to }
      }, {});
      if (!conf || !conf.show) return conf || { show: false, reason: 'not-shown' };
      if (typeof b5.render === 'function') b5.render(lastCard || out, conf);
      return conf;
    }

    function renderError(msg) { out.innerHTML = ''; out.appendChild(el('div', 'avd-err', esc(msg))); }

    return { diagnoseCurrentScreen: diagnoseCurrentScreen, submit: submit, reportResolved: reportResolved };
  }

  global.ARIAVisionDiagnose = { mount: mount, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
