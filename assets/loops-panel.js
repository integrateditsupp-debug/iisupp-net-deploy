/* ============================================================================
   IIS LOOPS PANEL — live view of the loop registry + ledger + observer.
   Mounts inside /aperture-learning.html (and anywhere else it's loaded).

   Behavior:
     - Self-mounts after #app becomes visible (post-login) — never blocks login
     - Shadow DOM scoped so styles can't leak/fight aperture's CSS
     - Polls /.netlify/functions/loops-status every 10s (AbortController, 6s timeout)
     - Renders: goal | running/idle loop tally | live convo ticker | alignment chip
     - On endpoint 404 / network fail: "Waiting for first run…" — never crashes
     - Respects prefers-reduced-motion

   Drop-in via:  <script src="/assets/loops-panel.js" defer></script>
   ========================================================================== */
(function () {
  'use strict';
  if (window.__iisLoopsPanelLoaded) return;
  window.__iisLoopsPanelLoaded = true;

  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ENDPOINT = '/.netlify/functions/loops-status';
  var POLL_MS = 10000;
  var FETCH_TIMEOUT_MS = 6000;

  // Inject only after the app is shown — avoid disturbing the login flow.
  function start() {
    var app = document.getElementById('app');
    if (!app) return; // not the learning page; do nothing
    // Watch for #app becoming visible
    if (getComputedStyle(app).display !== 'none') return mount();
    var mo = new MutationObserver(function () {
      if (getComputedStyle(app).display !== 'none') {
        mo.disconnect();
        mount();
      }
    });
    mo.observe(app, { attributes: true, attributeFilter: ['style', 'class'] });
    // Stop watching after 60s
    setTimeout(function () { mo.disconnect(); }, 60000);
  }

  function mount() {
    // If a host element exists, mount there; else create our own and append to #app
    var host = document.querySelector('[data-iis-loops-panel]');
    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-iis-loops-panel', '');
      var app = document.getElementById('app');
      // Insert near the top of #app so it's visible without scrolling
      var anchor = app.querySelector('.grid.g-stats') || app.firstElementChild;
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(host, anchor.nextSibling);
      } else {
        app.appendChild(host);
      }
    }

    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;
    var root = shadow || host;
    root.innerHTML = SHELL_HTML + STYLE;
    var els = {
      goal:        root.querySelector('[data-goal]'),
      runningPill: root.querySelector('[data-running]'),
      idlePill:    root.querySelector('[data-idle]'),
      alignPill:   root.querySelector('[data-align]'),
      loopList:    root.querySelector('[data-loops]'),
      convo:       root.querySelector('[data-convo]'),
      ts:          root.querySelector('[data-ts]'),
      observer:    root.querySelector('[data-observer]'),
    };

    poll(els);
    setInterval(function () { poll(els); }, POLL_MS);
  }

  function poll(els) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    fetch(ENDPOINT, { signal: ctrl.signal })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (data) { render(els, data); })
      .catch(function (err) { renderError(els, err); })
      .finally(function () { clearTimeout(timer); });
  }

  function render(els, data) {
    // GOAL
    els.goal.textContent = data.goal || 'No goal set yet. Run `npm run goal -- "Your goal here"`.';

    // RUNNING / IDLE PILLS
    var running = (data.loops || []).filter(function (l) { return l.status === 'running'; }).length;
    var idle    = (data.loops || []).filter(function (l) { return l.status === 'idle'; }).length;
    els.runningPill.textContent = running + ' running';
    els.idlePill.textContent    = idle + ' idle';

    // ALIGNMENT PILL
    var a = data.alignment || {};
    if (a.total) {
      els.alignPill.textContent = 'Goal alignment: ' + a.aligned + '/' + a.total;
      els.alignPill.classList.toggle('warn', a.drifting > 0);
    } else {
      els.alignPill.textContent = 'Goal alignment: pending';
      els.alignPill.classList.remove('warn');
    }

    // LOOP TABLE
    var rows = (data.loops || []).map(function (l) {
      var statusClass = l.status === 'running' ? 'ok'
                      : l.status === 'paused'  ? 'warn'
                      : l.status === 'killed'  ? 'crit'
                      : '';
      var last = l.last_run ? new Date(l.last_run).toLocaleString() : 'never';
      return '<tr>'
        + '<td><span class="dot ' + statusClass + '"></span>' + esc(l.id) + '</td>'
        + '<td>' + esc(l.class || '?') + '</td>'
        + '<td>' + esc(l.owner || '?') + '</td>'
        + '<td class="mono small">' + esc(l.cadence || '—') + '</td>'
        + '<td class="status ' + statusClass + '">' + esc(l.status) + '</td>'
        + '<td class="mono small">' + esc(last) + '</td>'
        + '</tr>';
    }).join('');
    els.loopList.innerHTML = rows || '<tr><td colspan="6" class="empty">No loops registered yet.</td></tr>';

    // CONVO TICKER
    var entries = (data.ledger || []).map(function (e) {
      return '<li><span class="ts">' + esc(formatTs(e.ts)) + '</span>'
           + '<span class="msg">' + esc(e.text) + '</span></li>';
    }).join('');
    els.convo.innerHTML = entries || '<li class="empty">No ledger entries yet — first loop run will appear here.</li>';

    // OBSERVER SUMMARY
    var obs = data.observerSummary;
    if (obs) {
      var topDir = (obs.topDir && obs.topDir[0]) ? obs.topDir[0] : '—';
      els.observer.innerHTML =
        '<span class="eyebrow">Codex observer</span>'
        + '<span>' + obs.codexCommits + ' commits</span>'
        + '<span class="sep">•</span>'
        + '<span>median ' + obs.median + ' L</span>'
        + '<span class="sep">•</span>'
        + '<span>top dir <code>' + esc(topDir) + '</code></span>';
    } else {
      els.observer.innerHTML = '<span class="eyebrow">Codex observer</span><span class="muted">no scan yet</span>';
    }

    // TIMESTAMP
    els.ts.textContent = 'Updated ' + new Date(data.generatedAt).toLocaleTimeString();
  }

  function renderError(els, err) {
    // Don't blank the panel; show last state + a quiet "offline" indicator
    els.ts.textContent = '⚠ status endpoint offline — retrying';
    if (!els.loopList.children.length || els.loopList.textContent.trim() === '') {
      els.loopList.innerHTML = '<tr><td colspan="6" class="empty">Waiting for first poll…</td></tr>';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d)) return ts;
    var now = Date.now();
    var diff = (now - d.getTime()) / 1000;
    if (diff < 60) return Math.round(diff) + 's ago';
    if (diff < 3600) return Math.round(diff / 60) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return d.toLocaleDateString();
  }

  // -- shell HTML + scoped styles (shadow DOM) ----------------------------
  var SHELL_HTML = ''
    + '<section class="loops">'
    + '  <header>'
    + '    <div class="meta">'
    + '      <span class="eyebrow">Loops · live</span>'
    + '      <span class="pill" data-running>—</span>'
    + '      <span class="pill" data-idle>—</span>'
    + '      <span class="pill" data-align>—</span>'
    + '    </div>'
    + '    <div class="ts" data-ts>—</div>'
    + '  </header>'
    + '  <p class="goal" data-goal>—</p>'
    + '  <div class="grid">'
    + '    <div class="card">'
    + '      <div class="card-head"><span class="eyebrow">Registry</span></div>'
    + '      <table class="loops-table">'
    + '        <thead><tr><th>ID</th><th>Class</th><th>Owner</th><th>Cadence</th><th>Status</th><th>Last run</th></tr></thead>'
    + '        <tbody data-loops></tbody>'
    + '      </table>'
    + '    </div>'
    + '    <div class="card convo-card">'
    + '      <div class="card-head"><span class="eyebrow">Loop convo</span></div>'
    + '      <ul class="convo" data-convo></ul>'
    + '      <div class="observer-row" data-observer></div>'
    + '    </div>'
    + '  </div>'
    + '</section>';

  var STYLE = ''
    + '<style>'
    + ':host { display: block; margin: 22px auto; max-width: 1240px; padding: 0 24px; font-family: "Inter", system-ui, -apple-system, sans-serif; color: #e8edf6; }'
    + '.loops { background: linear-gradient(180deg, rgba(14,19,32,.96), rgba(11,15,26,.92)); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 22px 24px; box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 24px 48px -28px rgba(0,0,0,.8); }'
    + 'header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }'
    + '.meta { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }'
    + '.eyebrow { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 10px; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: #62718b; }'
    + '.pill { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 11px; letter-spacing: .04em; padding: 4px 10px; border-radius: 99px; background: rgba(34,225,255,.08); color: #22e1ff; border: 1px solid rgba(34,225,255,.2); }'
    + '.pill.warn { background: rgba(251,191,36,.08); color: #fbbf24; border-color: rgba(251,191,36,.22); }'
    + '.ts { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: #9aa7bd; }'
    + '.goal { font-size: 13.5px; line-height: 1.55; color: #c9d2e1; margin: 0 0 16px; padding: 12px 14px; border-left: 2px solid #22e1ff; background: rgba(34,225,255,.04); border-radius: 0 8px 8px 0; }'
    + '.grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; }'
    + '@media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }'
    + '.card { background: rgba(14,19,32,.7); border: 1px solid rgba(255,255,255,.07); border-radius: 11px; padding: 16px 18px; }'
    + '.card-head { margin-bottom: 10px; }'
    + 'table.loops-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }'
    + 'table.loops-table th { text-align: left; padding: 6px 10px 8px; color: #62718b; font-weight: 500; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,.07); }'
    + 'table.loops-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.04); }'
    + 'table.loops-table td .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #62718b; margin-right: 8px; vertical-align: middle; }'
    + 'table.loops-table td .dot.ok { background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,.55); animation: ' + (REDUCE ? 'none' : 'pulse 2s ease-in-out infinite') + '; }'
    + 'table.loops-table td .dot.warn { background: #fbbf24; }'
    + 'table.loops-table td .dot.crit { background: #fb7185; }'
    + 'table.loops-table td.status { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 11px; letter-spacing: .04em; }'
    + 'table.loops-table td.status.ok { color: #34d399; }'
    + 'table.loops-table td.status.warn { color: #fbbf24; }'
    + 'table.loops-table td.status.crit { color: #fb7185; }'
    + 'table.loops-table td.empty { text-align: center; color: #62718b; padding: 24px; }'
    + 'table.loops-table .small { color: #9aa7bd; font-size: 11px; }'
    + 'table.loops-table .mono { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; }'
    + 'ul.convo { list-style: none; padding: 0; margin: 0; max-height: 280px; overflow-y: auto; }'
    + 'ul.convo li { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.04); font-size: 12.5px; align-items: baseline; }'
    + 'ul.convo li:last-child { border-bottom: none; }'
    + 'ul.convo li .ts { flex: 0 0 70px; color: #62718b; font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 10.5px; }'
    + 'ul.convo li .msg { flex: 1; color: #c9d2e1; line-height: 1.45; }'
    + 'ul.convo li.empty { color: #62718b; justify-content: center; }'
    + '.observer-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-top: 10px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,.07); font-size: 11.5px; color: #9aa7bd; }'
    + '.observer-row code { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; background: rgba(255,255,255,.04); padding: 1px 5px; border-radius: 3px; color: #c9d2e1; }'
    + '.observer-row .sep { color: #2a3247; }'
    + '.observer-row .muted { color: #62718b; font-style: italic; }'
    + '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }'
    + '</style>';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
