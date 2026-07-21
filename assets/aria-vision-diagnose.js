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
      '.avd-redact{margin:10px 0;border:1px solid #3a2f12;border-radius:8px;background:#000;overflow:auto;max-height:320px}',
      '.avd-redact canvas{display:block;max-width:100%;cursor:crosshair;touch-action:none}',
      '.avd-redact-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:#9a9a92;margin-top:6px}',
      '.avd-mini{padding:4px 10px;border-radius:6px;border:1px solid #5c4a1f;background:transparent;color:' + GOLD + ';font-size:12px;cursor:pointer}',
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
        '<p style="margin:8px 0;color:#c9c9c1">Every pixel you do <strong>not</strong> paint over is sent <strong>unredacted</strong> to Claude Fable 5 (vision) to read the error — nothing is found or masked automatically, there is no OCR. Drag over anything you don\'t want sent (an email address, a customer name, a licence key): those pixels are painted out in the file itself, in this browser, before it is sent. Only the text ARIA reads back is filtered for secrets, and we keep no screenshot after. Don\'t upload anything you wouldn\'t show a technician — or cancel and type the error text to keep it off the cloud.</p>';

      // ── Paint-over tool: the user marks what must not leave. Real pixels, not an overlay. ──
      // Regions are kept as 0..1 fractions so they survive any display scaling, and are ALSO
      // sent to the server, which repaints them server-side before the paid call. Belt and
      // braces: if the browser export fails, the server still refuses to send an unpainted
      // image once redaction has been asked for.
      var regions = [];
      var wrap = el('div', 'avd-redact');
      var canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      var bar = el('div', 'avd-redact-bar');
      var count = el('span', '', 'Nothing painted out yet — the whole image will be sent.');
      var undo = el('button', 'avd-mini', 'Undo last box');
      var clear = el('button', 'avd-mini', 'Clear boxes');
      bar.appendChild(count); bar.appendChild(undo); bar.appendChild(clear);
      box.appendChild(wrap); box.appendChild(bar);

      var img = new Image();
      var ready = false;
      img.onload = function () {
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ready = true;
        repaint();
      };
      img.onerror = function () { wrap.style.display = 'none'; bar.style.display = 'none'; };
      img.src = 'data:' + (mediaType || 'image/png') + ';base64,' + b64;

      function repaint(live) {
        if (!ready) return;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        regions.concat(live ? [live] : []).forEach(function (r) {
          ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
        });
        count.textContent = regions.length
          ? (regions.length + ' area' + (regions.length === 1 ? '' : 's') + ' will be painted out before sending. Everything else is still sent unredacted.')
          : 'Nothing painted out yet — the whole image will be sent.';
      }

      var drag = null;
      function pointAt(e) {
        var b = canvas.getBoundingClientRect();
        var cx = (e.touches ? e.touches[0].clientX : e.clientX) - b.left;
        var cy = (e.touches ? e.touches[0].clientY : e.clientY) - b.top;
        return { x: Math.min(Math.max(cx / b.width, 0), 1), y: Math.min(Math.max(cy / b.height, 0), 1) };
      }
      function boxOf(a, z) {
        return { x: Math.min(a.x, z.x), y: Math.min(a.y, z.y), w: Math.abs(z.x - a.x), h: Math.abs(z.y - a.y) };
      }
      canvas.addEventListener('pointerdown', function (e) { if (!ready) return; e.preventDefault(); drag = pointAt(e); });
      canvas.addEventListener('pointermove', function (e) { if (!drag) return; repaint(boxOf(drag, pointAt(e))); });
      canvas.addEventListener('pointerup', function (e) {
        if (!drag) return;
        var r = boxOf(drag, pointAt(e));
        drag = null;
        if (r.w > 0.004 && r.h > 0.004) regions.push(r);   // ignore accidental taps
        repaint();
      });
      canvas.addEventListener('pointerleave', function () { if (drag) { drag = null; repaint(); } });
      undo.addEventListener('click', function () { regions.pop(); repaint(); });
      clear.addEventListener('click', function () { regions = []; repaint(); });

      var label = el('label', '', '');
      label.innerHTML = '<input type="checkbox" id="avd-ok"> I understand everything I have not painted over is sent unredacted, and I want ARIA to analyze it.';
      box.appendChild(label);

      var go = el('button', 'avd-btn', 'Analyze image');
      var cancel = el('button', 'avd-btn ghost', 'Cancel — I\'ll type it instead');
      box.appendChild(go); box.appendChild(cancel);
      out.appendChild(box);
      go.addEventListener('click', function () {
        if (!box.querySelector('#avd-ok').checked) return;
        var consent = Object.assign({ cloudProcessing: true, ts: Date.now() }, extraConsent || {});
        var sendB64 = b64, sendType = mediaType, sendRegions = regions.slice();
        if (ready && regions.length) {
          // Flatten in the browser: the painted pixels are destroyed here, so the original
          // never leaves this machine at all. The server repaints the same regions anyway.
          try {
            var flat = canvas.toDataURL('image/png').split(',')[1];
            if (flat && flat.length) { sendB64 = flat; sendType = 'image/png'; }
          } catch (err) { /* keep the original + server-side paint as the fallback */ }
        }
        submit({
          kind: extraConsent && extraConsent.screenCapture ? 'screen-capture' : 'image',
          imageBase64: sendB64, mediaType: sendType,
          redactRegions: sendRegions,
          allowCloudVision: true, consent: consent
        });
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
      // Real-or-silent: the painted-region line appears only when the server confirms it painted.
      var pxr = res.pixelRedaction && res.pixelRedaction.ok ? res.pixelRedaction : null;
      var priv = 'Privacy: ' + (red.count ? ('removed ' + red.count + ' sensitive item' + (red.count === 1 ? '' : 's') + ' from the text (' + (red.found || []).map(function (f) { return f.count + ' ' + f.type.toLowerCase(); }).join(', ') + '). ') : 'no sensitive text detected. ') +
        (pxr ? ('You painted out ' + pxr.regions + ' area' + (pxr.regions === 1 ? '' : 's') + ' (' + pxr.percentPainted + '% of the image) — those pixels were destroyed before sending. ') : '') +
        (flow.thirdPartyModel
          ? ((pxr ? 'Every pixel you did not paint was sent UNREDACTED to ' : 'The image was sent UNREDACTED to ') + esc(flow.sentTo || 'the vision model') + '; ' + esc(flow.retention || 'not stored') + '.')
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
