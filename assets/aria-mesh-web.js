/* ============================================================================
   ARIA MESH SPIDER-WEB — reusable embeddable component (v2, cinematic)
   ----------------------------------------------------------------------------
   One source of truth for the agent-mesh visualization. Mount it anywhere with:

     <div data-aria-mesh-web data-accent="#2dd4bf"></div>
     <script src="/assets/aria-mesh-web.js" defer></script>

   Optional data-* attributes on the mount:
     data-accent   = hex accent colour (default #2dd4bf teal; learning page uses #22e1ff)
     data-registry = registry URL      (default /mesh-registry.json)
     data-events   = event-bus URL     (default /api/mesh-events)
     data-height   = stage aspect ratio as "W / H" (default "1 / 0.78")

   Reads the ruflo-inspired mesh-registry.json and renders a living radial web:
   canvas ambient (nebula + drifting particles + Aperture radar sweep + comet
   trails) · svg silk + bloom-lit agent nodes · live data-pulses from the mesh
   event bus (falls back to a simulated heartbeat when the bus is unreachable).
   Self-contained, no deps. prefers-reduced-motion collapses to an elegant
   static state. Multiple instances per page are supported.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__ariaMeshWebLoaded) return;
  window.__ariaMeshWebLoaded = true;

  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FALLBACK = {"version":"1.1.0","topology":"mesh","agents":[
    {"id":"aria-research","type":"researcher","status":"active","tier":"L1"},
    {"id":"aria-escalation","type":"escalator","status":"active","tier":"L2"},
    {"id":"aria-first-principles","type":"reasoner","status":"active","tier":"L1"},
    {"id":"aria-diagnostic","type":"analyst","status":"active","tier":"L1"},
    {"id":"aria-persona","type":"wrapper","status":"active","tier":"L0"},
    {"id":"council-architect","type":"council","status":"active","tier":"L2"},
    {"id":"council-coder","type":"council","status":"active","tier":"L2"},
    {"id":"council-reviewer","type":"council","status":"active","tier":"L2"},
    {"id":"council-tester","type":"council","status":"active","tier":"L2"},
    {"id":"council-security","type":"council","status":"active","tier":"L2"},
    {"id":"audit-agent","type":"gatekeeper","status":"active","tier":"L2"},
    {"id":"aperture-monitor","type":"observer","status":"active","tier":"L0"},
    {"id":"self-learning-loop","type":"background","status":"active","tier":"L0"},
    {"id":"opencode-coder","type":"external-executor","status":"planned","tier":"L3"},
    {"id":"claude-sdk-subagent","type":"external-executor","status":"planned","tier":"L3"},
    {"id":"openclaw-assistant","type":"external-executor","status":"active","tier":"L3"},
    {"id":"openclaw-cron","type":"background","status":"active","tier":"L0"}
  ],"phases":{
    "diagnose":["aria-persona","aria-diagnostic"],
    "research":["aria-research","council-architect"],
    "reason":["aria-first-principles","council-architect"],
    "execute":["audit-agent","council-coder","opencode-coder","claude-sdk-subagent","openclaw-assistant"],
    "verify":["council-reviewer","council-tester","council-security"],
    "observe":["aperture-monitor","self-learning-loop","openclaw-cron"]
  }};

  var CSS = [
    '.mw-root{font-family:"Inter",system-ui,sans-serif;color:#d8e0e6;--mw-accent:#2dd4bf;}',
    '.mw-root *{box-sizing:border-box;}',
    '.mw-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px;}',
    '.mw-title{font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#d8e0e6;margin:0;}',
    '.mw-title .a{color:var(--mw-accent);text-shadow:0 0 18px color-mix(in srgb,var(--mw-accent) 55%,transparent);}',
    '.mw-sub{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.16em;color:#6b7c87;}',
    '.mw-legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:12px 0 4px;}',
    '.mw-leg{display:inline-flex;align-items:center;gap:7px;font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b7c87;}',
    '.mw-leg .dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}',
    '.mw-leg .dot.q{background:var(--mw-accent);box-shadow:0 0 8px var(--mw-accent);}',
    '.mw-leg .dot.a{background:#98a8b3;}.mw-leg .dot.c{background:#a78bfa;}.mw-leg .dot.x{background:#fbbf24;}',
    '.mw-leg .dot.p{background:transparent;border:1px dashed #6b7c87;}',
    '.mw-stage{position:relative;width:100%;min-height:460px;background:radial-gradient(ellipse at 50% 44%,#0a1622 0%,#070d16 45%,#04060c 100%);border:1px solid #1a2b35;border-radius:5px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.5),inset 0 0 120px rgba(0,0,0,.55);}',
    '.mw-stage::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,transparent 52%,rgba(2,4,9,.55) 100%);}',
    '.mw-bg,.mw-svg{position:absolute;inset:0;width:100%;height:100%;display:block;}',
    '.mw-silk{fill:none;stroke-width:1;opacity:0;}',
    '.mw-silk.spoke{stroke-dasharray:2 6;}',
    '.mw-phase-label{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.24em;text-transform:uppercase;fill:#6b7c87;opacity:0;}',
    '.mw-edge{fill:none;stroke:var(--mw-accent);stroke-width:1.6;opacity:0;stroke-linecap:round;}',
    '.mw-edge.warn{stroke:#fbbf24;}',
    '.mw-node{cursor:pointer;opacity:0;}',
    '.mw-node .ring{fill:#0d1824;stroke-width:1.5;}',
    '.mw-node .halo{opacity:0;}',
    '.mw-node .label{font-family:"JetBrains Mono",monospace;font-size:8.5px;letter-spacing:.06em;fill:#98a8b3;text-anchor:middle;pointer-events:none;}',
    '.mw-node.queen .label{fill:var(--mw-accent);font-size:10px;letter-spacing:.16em;}',
    '.mw-node:hover .ring{stroke:#fff;}.mw-node:hover .label{fill:#d8e0e6;}',
    '.mw-node.dim{opacity:.5;}',
    '.mw-tip{position:absolute;pointer-events:none;z-index:12;min-width:184px;max-width:270px;background:rgba(5,8,16,.96);border:1px solid var(--mw-accent);border-radius:4px;padding:12px 14px;box-shadow:0 14px 50px rgba(0,0,0,.6),0 0 30px color-mix(in srgb,var(--mw-accent) 14%,transparent);opacity:0;transform:translateY(6px) scale(.98);transition:opacity .18s cubic-bezier(.22,1,.36,1),transform .18s cubic-bezier(.22,1,.36,1);backdrop-filter:blur(4px);}',
    '.mw-tip.show{opacity:1;transform:translateY(0) scale(1);}',
    '.mw-tip .t-id{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--mw-accent);letter-spacing:.08em;font-weight:600;}',
    '.mw-tip .t-type{font-family:"JetBrains Mono",monospace;font-size:8.5px;color:#6b7c87;letter-spacing:.18em;text-transform:uppercase;margin-top:2px;}',
    '.mw-tip .t-desc{font-size:11px;color:#98a8b3;line-height:1.5;margin-top:8px;}',
    '.mw-tip .t-caps{display:flex;flex-wrap:wrap;gap:4px;margin-top:9px;}',
    '.mw-tip .t-cap{font-family:"JetBrains Mono",monospace;font-size:8px;letter-spacing:.06em;color:#98a8b3;background:#0d1824;border:1px solid #243a47;border-radius:2px;padding:2px 6px;}',
    '.mw-tip .t-meta{display:flex;gap:10px;margin-top:9px;font-family:"JetBrains Mono",monospace;font-size:8.5px;color:#6b7c87;letter-spacing:.1em;}',
    '.mw-tip .t-meta b{color:#d8e0e6;font-weight:600;}',
    '.mw-hud{position:absolute;left:16px;bottom:14px;z-index:11;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6b7c87;opacity:0;transition:opacity 1s cubic-bezier(.22,1,.36,1) 1.6s;}',
    '.mw-stage.lit .mw-hud{opacity:.9;}',
    '.mw-mode{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:1px;}',
    '.mw-mode.live{background:rgba(74,222,128,.1);border:1px solid #4ade80;color:#4ade80;}',
    '.mw-mode.sim{background:rgba(251,191,36,.1);border:1px solid #fbbf24;color:#fbbf24;}',
    '.mw-mode .pip{width:6px;height:6px;border-radius:50%;background:currentColor;animation:mwPip 1.4s infinite;}',
    '@keyframes mwPip{0%,100%{opacity:1;}50%{opacity:.3;}}',
    '.mw-stats{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;color:#6b7c87;}',
    '.mw-stats b{color:var(--mw-accent);font-weight:600;}',
    '@media (prefers-reduced-motion: reduce){.mw-root *,.mw-root *::before,.mw-root *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;}.mw-silk,.mw-node,.mw-phase-label,.mw-hud{opacity:1!important;}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('aria-mesh-web-css')) return;
    var s = document.createElement('style');
    s.id = 'aria-mesh-web-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var PHASE_ORDER = ['diagnose','research','reason','execute','verify','observe'];
  var COLOR = {queen:'var(--mw-accent)',council:'#a78bfa','external-executor':'#fbbf24',background:'#7c8a94',observer:'#4ade80',gatekeeper:'#f87171'};

  function buildInstance(mount) {
    var accent   = mount.getAttribute('data-accent')   || '#2dd4bf';
    var regUrl   = mount.getAttribute('data-registry') || '/mesh-registry.json';
    var evtUrl   = mount.getAttribute('data-events')   || '/api/mesh-events';
    var aspect   = mount.getAttribute('data-height')   || '1 / 0.78';

    var uid = 'mw' + Math.random().toString(36).slice(2, 8);
    var CX = 500, CY = 392, R_INNER = 118, R_STEP = 74;
    var PHASE_ANGLE = {}; PHASE_ORDER.forEach(function (p, i) { PHASE_ANGLE[p] = -90 + (360 / PHASE_ORDER.length) * i; });

    mount.className = (mount.className ? mount.className + ' ' : '') + 'mw-root';
    mount.style.setProperty('--mw-accent', accent);
    mount.innerHTML =
      '<div class="mw-head"><h1 class="mw-title">ARIA <span class="a">MESH</span> · SPIDER-WEB</h1>'+
      '<span class="mw-sub" id="'+uid+'-upd">ruflo-inspired · queen-coordinated</span></div>'+
      '<div class="mw-legend">'+
        '<span class="mw-leg"><span class="dot q"></span>Queen / Router</span>'+
        '<span class="mw-leg"><span class="dot a"></span>Core agent</span>'+
        '<span class="mw-leg"><span class="dot c"></span>Council</span>'+
        '<span class="mw-leg"><span class="dot x"></span>External executor</span>'+
        '<span class="mw-leg"><span class="dot p"></span>Planned</span>'+
        '<span style="flex-basis:100%;height:2px"></span>'+
        '<span class="mw-leg" style="opacity:.85">flows:</span>'+
        '<span class="mw-leg"><span class="dot" style="background:'+accent+';box-shadow:0 0 6px '+accent+'"></span>chatter · KB-build</span>'+
        '<span class="mw-leg"><span class="dot" style="background:#a78bfa"></span>evolution → ARIA</span>'+
        '<span class="mw-leg"><span class="dot" style="background:#fbbf24"></span>audit</span>'+
        '<span class="mw-leg"><span class="dot" style="background:#f87171"></span>retry / flag</span></div>'+
      '<div class="mw-stage" id="'+uid+'-stage" style="aspect-ratio:'+aspect+';">'+
        '<canvas class="mw-bg" id="'+uid+'-bg"></canvas>'+
        '<svg class="mw-svg" id="'+uid+'-svg" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet" aria-label="ARIA agent mesh spider-web">'+
          '<defs>'+
            '<radialGradient id="'+uid+'-silk" cx="50%" cy="50%" r="50%">'+
              '<stop offset="0%" stop-color="'+accent+'" stop-opacity="0.5"/>'+
              '<stop offset="60%" stop-color="#243a47" stop-opacity="0.7"/>'+
              '<stop offset="100%" stop-color="#1a2b35" stop-opacity="0.25"/></radialGradient>'+
            '<filter id="'+uid+'-glow" x="-120%" y="-120%" width="340%" height="340%">'+
              '<feGaussianBlur stdDeviation="3.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
            '<filter id="'+uid+'-glowsoft" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>'+
          '</defs>'+
          '<g id="'+uid+'-silk-g"></g><g id="'+uid+'-pl"></g><g id="'+uid+'-edges"></g><g id="'+uid+'-nodes"></g>'+
        '</svg>'+
        '<div class="mw-tip" id="'+uid+'-tip"></div>'+
        '<div class="mw-hud"><span class="mw-mode sim" id="'+uid+'-mode"><span class="pip"></span>SIMULATED</span></div>'+
      '</div>'+
      '<div class="mw-stats">'+
        '<span><b id="'+uid+'-ac">0</b> agents</span>'+
        '<span><b id="'+uid+'-act">0</b> active</span>'+
        '<span><b>'+PHASE_ORDER.length+'</b> phases</span>'+
        '<span><b id="'+uid+'-fc">0</b> fires (24h)</span></div>';

    var $ = function (suf) { return document.getElementById(uid + '-' + suf); };
    var svg = $('svg'), gSilk = $('silk-g'), gPL = $('pl'), gEdge = $('edges'), gNode = $('nodes');
    var stage = $('stage'), tip = $('tip'), bg = $('bg');
    // re-point silk stroke + node glow filters to this instance's ids via CSS vars on root
    gSilk.setAttribute('data-silk', uid + '-silk');

    var mk = function (n, a) { var e = document.createElementNS(SVGNS, n); for (var k in a) e.setAttribute(k, a[k]); return e; };
    var rad = function (d) { return d * Math.PI / 180; };
    var pos = function (d, r) { return { x: CX + Math.cos(rad(d)) * r, y: CY + Math.sin(rad(d)) * r }; };
    var colorFor = function (a) { return (a.queen || a.id === 'aria-mesh-router') ? COLOR.queen : (COLOR[a.type] || '#9fb2bd'); };

    var REG = null, NODES = [], NODE_BY_ID = {}, lastTs = 0, ACT = {};
    var comets = [];

    fetch(regUrl, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : FALLBACK; })
      .catch(function () { return FALLBACK; })
      .then(function (reg) { REG = reg || FALLBACK; start(); });

    function start() {
      layout(); drawSilk(); drawNodes(); initCanvas();
      $('upd').textContent = 'ruflo-inspired · registry v' + (REG.version || '?') + (REG.updated ? ' · ' + REG.updated : '');
      boot();
    }

    function layout() {
      var phases = REG.phases || FALLBACK.phases, phaseOf = {};
      PHASE_ORDER.forEach(function (p) { (phases[p] || []).forEach(function (id) { if (!phaseOf[id]) phaseOf[id] = p; }); });
      var groups = {}; PHASE_ORDER.forEach(function (p) { groups[p] = []; }); var orphans = [];
      (REG.agents || []).forEach(function (a) { var p = phaseOf[a.id]; if (p) groups[p].push(a); else orphans.push(a); });
      orphans.forEach(function (a) { groups['observe'].push(a); });
      NODES = []; NODE_BY_ID = {};
      PHASE_ORDER.forEach(function (p) {
        var deg = PHASE_ANGLE[p], list = groups[p];
        list.forEach(function (a, i) {
          var r = R_INNER + i * R_STEP, fan = list.length > 1 ? (i - (list.length - 1) / 2) * 6.5 : 0;
          var P = pos(deg + fan, r);
          var nd = Object.assign({}, a, { phase: p, x: P.x, y: P.y, deg: deg + fan, r: r, _color: colorFor(a), _planned: a.status === 'planned' });
          NODES.push(nd); NODE_BY_ID[a.id] = nd;
        });
      });
      NODE_BY_ID['aria-mesh-router'] = { id: 'aria-mesh-router', type: 'queen', status: 'active', tier: 'L0', queen: true,
        description: 'Queen / orchestrator. Thompson-sampling capability match, fallback cascade, max ' + ((REG.router_policy && REG.router_policy.max_hops) || 4) + ' hops. Logs every hop to mesh-events.',
        capabilities: ['route', 'select-agent', 'fallback-cascade', 'log-trace'], x: CX, y: CY, deg: 0, r: 0, _color: COLOR.queen, _planned: false };
      $('ac').textContent = NODES.length + 1;
      $('act').textContent = NODES.filter(function (n) { return n.status === 'active'; }).length + 1;
    }

    function ringPath(rr) { var pts = PHASE_ORDER.map(function (p) { return pos(PHASE_ANGLE[p], rr); }); return 'M ' + pts.map(function (q) { return q.x + ' ' + q.y; }).join(' L ') + ' Z'; }
    function drawSilk() {
      [R_INNER, R_INNER + R_STEP, R_INNER + R_STEP * 2, R_INNER + R_STEP * 3].forEach(function (rr) {
        gSilk.appendChild(mk('path', { d: ringPath(rr), class: 'mw-silk ring', stroke: 'url(#' + uid + '-silk)' }));
      });
      PHASE_ORDER.forEach(function (p) {
        var deg = PHASE_ANGLE[p], end = pos(deg, R_INNER + R_STEP * 3.3);
        gSilk.appendChild(mk('line', { x1: CX, y1: CY, x2: end.x, y2: end.y, class: 'mw-silk spoke', stroke: 'url(#' + uid + '-silk)' }));
        var lp = pos(deg, R_INNER + R_STEP * 3.6), t = mk('text', { x: lp.x, y: lp.y, class: 'mw-phase-label' });
        t.textContent = p.toUpperCase();
        t.setAttribute('text-anchor', lp.x < CX - 20 ? 'end' : lp.x > CX + 20 ? 'start' : 'middle');
        gPL.appendChild(t);
      });
    }

    function drawNodes() {
      [NODE_BY_ID['aria-mesh-router']].concat(NODES).forEach(function (nd) {
        var g = mk('g', { class: 'mw-node' + (nd.queen ? ' queen' : '') + (nd._planned ? ' dim' : ''), 'data-id': nd.id });
        var r0 = nd.queen ? 21 : 11;
        g.appendChild(mk('circle', { class: 'halo', cx: nd.x, cy: nd.y, r: r0, fill: nd._color, filter: 'url(#' + uid + '-glowsoft)' }));
        g.appendChild(mk('circle', { class: 'ring', cx: nd.x, cy: nd.y, r: r0, stroke: nd._color, 'stroke-dasharray': nd._planned ? '3 3' : 'none', fill: nd.queen ? 'rgba(45,212,191,0.10)' : '#0d1824' }));
        g.appendChild(mk('circle', { class: 'core', cx: nd.x, cy: nd.y, r: nd.queen ? 7.5 : 3.6, fill: nd._color, opacity: nd._planned ? 0.5 : 0.98, filter: 'url(#' + uid + '-glow)' }));
        var short = nd.id.replace(/^aria-/, '').replace(/^council-/, 'c·').replace(/^openclaw-/, 'oc·');
        var lbl = mk('text', { class: 'label', x: nd.x, y: nd.y + (nd.queen ? 34 : 20) });
        lbl.textContent = nd.queen ? 'QUEEN · ROUTER' : short;
        g.appendChild(lbl);
        g.__nd = nd;
        g.addEventListener('mouseenter', function () { showTip(nd); });
        g.addEventListener('mouseleave', hideTip);
        gNode.appendChild(g);
      });
    }

    function boot() {
      if (REDUCE) {
        stage.classList.add('lit');
        gSilk.querySelectorAll('.mw-silk').forEach(function (s) { s.style.opacity = s.classList.contains('spoke') ? 0.4 : 0.5; });
        gPL.querySelectorAll('.mw-phase-label').forEach(function (l) { l.style.opacity = 0.85; });
        gNode.querySelectorAll('.mw-node').forEach(function (n) { n.style.opacity = n.classList.contains('dim') ? 0.5 : 1; });
        startActivity(); return;
      }
      stage.classList.add('lit');
      var queen = gNode.querySelector('.mw-node.queen');
      setTimeout(function () { if (queen) { queen.style.opacity = 1; popIn(queen); flashHalo('aria-mesh-router'); } }, 180);
      var spokes = [].slice.call(gSilk.querySelectorAll('.mw-silk.spoke'));
      spokes.forEach(function (s, i) { drawLine(s, 460 + i * 70); });
      var rings = [].slice.call(gSilk.querySelectorAll('.mw-silk.ring'));
      rings.forEach(function (s, i) { drawLine(s, 900 + i * 150, 0.5); });
      setTimeout(function () {
        gPL.querySelectorAll('.mw-phase-label').forEach(function (l, i) {
          l.animate([{ opacity: 0 }, { opacity: 0.85 }], { duration: 700, delay: i * 40, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
        });
      }, 1250);
      var nodes = [].slice.call(gNode.querySelectorAll('.mw-node:not(.queen)')).sort(function (a, b) { return a.__nd.r - b.__nd.r; });
      nodes.forEach(function (g, i) { setTimeout(function () { g.style.opacity = g.classList.contains('dim') ? 0.5 : 1; popIn(g); flashHalo(g.__nd.id); }, 1350 + i * 60); });
      setTimeout(startActivity, 1350 + nodes.length * 60 + 400);
    }
    function popIn(g) {
      [g.querySelector('.ring'), g.querySelector('.core')].forEach(function (el) {
        if (!el) return;
        el.animate([{ transform: 'scale(0.2)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 620, easing: 'cubic-bezier(0.34,1.36,0.64,1)' });
      });
    }
    function drawLine(el, delay, finalOpacity) {
      try {
        var len = el.getTotalLength(); el.style.strokeDasharray = len; el.style.strokeDashoffset = len; el.style.opacity = (finalOpacity || 0.4);
        var isRing = el.classList.contains('ring');
        el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: isRing ? 900 : 520, delay: delay, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
        setTimeout(function () { el.style.strokeDasharray = el.classList.contains('spoke') ? '2 6' : 'none'; }, delay + (isRing ? 900 : 520));
      } catch (e) { el.style.opacity = (finalOpacity || 0.4); }
    }

    function showTip(nd) {
      var caps = (nd.capabilities || []).slice(0, 6).map(function (c) { return '<span class="t-cap">' + c + '</span>'; }).join('');
      tip.innerHTML = '<div class="t-id">' + nd.id + '</div>' +
        '<div class="t-type">' + (nd.type || 'agent') + ' · ' + (nd.tier || '—') + ' · ' + (nd.status || 'active') + '</div>' +
        (nd.description ? '<div class="t-desc">' + esc(nd.description) + '</div>' : '') +
        (caps ? '<div class="t-caps">' + caps + '</div>' : '') +
        '<div class="t-meta"><span>phase <b>' + (nd.phase || 'core') + '</b></span><span>fires <b>' + (ACT[nd.id] || 0) + '</b></span></div>';
      var sb = stage.getBoundingClientRect(), sx = sb.width / 1000, sy = sb.height / 800;
      var left = nd.x * sx + 18, top = nd.y * sy - 10;
      if (left > sb.width - 282) left = nd.x * sx - 256; if (top < 8) top = 8;
      tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.classList.add('show');
      flashHalo(nd.id);
    }
    function hideTip() { tip.classList.remove('show'); }
    function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function flashHalo(id) {
      if (REDUCE) return;
      var g = gNode.querySelector('.mw-node[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (!g) return;
      var halo = g.querySelector('.halo'); if (halo) halo.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 900, easing: 'cubic-bezier(0.22,1,0.36,1)' });
      var core = g.querySelector('.core'); if (core) core.animate([{ opacity: 1 }, { opacity: 0.6 }, { opacity: 0.98 }], { duration: 700 });
    }
    // Flow kinds -> colour. learn = ambient KB-building chatter, audit = gatekeeper,
    // evolve = improvement proposals to the Queen/ARIA, request = a live user request,
    // warn = a failed/low-confidence hop.
    var FLOW = {
      learn:   { rgb: null /* accent */, dur: 620 },
      request: { rgb: null /* accent */, dur: 520 },
      audit:   { rgb: '251,191,36',  dur: 560 },
      evolve:  { rgb: '167,139,250', dur: 700 },
      warn:    { rgb: '248,113,113', dur: 560 }
    };
    function animateEdge(fromId, toId, kind) {
      var a = NODE_BY_ID[fromId], b = NODE_BY_ID[toId]; if (!a || !b) return;
      // cap concurrent comets so heavy ambient traffic stays smooth
      if (comets.length > 26) return;
      var f = FLOW[kind] || FLOW.learn;
      var col = f.rgb || (ACCENT_RGB || '94,234,212');
      var mx = (a.x + b.x) / 2 + (CY - (a.y + b.y) / 2) * 0.14, my = (a.y + b.y) / 2;
      var path = mk('path', { class: 'mw-edge', stroke: 'rgb(' + col + ')', d: 'M ' + a.x + ' ' + a.y + ' Q ' + mx + ' ' + my + ' ' + b.x + ' ' + b.y, filter: 'url(#' + uid + '-glow)' });
      gEdge.appendChild(path);
      flashHalo(fromId); setTimeout(function () { flashHalo(toId); }, f.dur * 0.6);
      if (REDUCE) { path.setAttribute('opacity', '0.5'); setTimeout(function () { path.remove(); }, 700); return; }
      var len = path.getTotalLength();
      path.style.strokeDasharray = len; path.style.strokeDashoffset = len; path.style.opacity = 0.8;
      path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: f.dur * 0.85, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
      comets.push({ path: path, len: len, t: performance.now(), dur: f.dur, col: col, trail: [] });
      path.animate([{ opacity: 0.8 }, { opacity: 0.8 }, { opacity: 0 }], { duration: f.dur + 540, easing: 'ease-out', fill: 'forwards' });
      setTimeout(function () { path.remove(); }, f.dur + 600);
    }
    function bump(id) { ACT[id] = (ACT[id] || 0) + 1; $('fc').textContent = Object.keys(ACT).reduce(function (s, k) { return s + ACT[k]; }, 0); }

    var pollTimer = null, simTimer = null;
    function startActivity() {
      pollOnce(true).then(function (ok) {
        if (ok) { setMode(true); pollTimer = setInterval(function () { pollOnce(false); }, 2500); }
        else { setMode(false); simulate(); }
      });
    }
    function setMode(live) { var m = $('mode'); m.className = 'mw-mode ' + (live ? 'live' : 'sim'); m.innerHTML = '<span class="pip"></span>' + (live ? 'LIVE' : 'SIMULATED'); }
    function pollOnce(first) {
      return fetch(evtUrl + '?since=' + lastTs + '&limit=200', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) return false;
        return r.json().then(function (d) {
          if (!d || !d.ok) return false;
          var stats = d.stats || {};
          if (first && stats.agentCounts) { Object.assign(ACT, stats.agentCounts); $('fc').textContent = Object.keys(ACT).reduce(function (s, k) { return s + ACT[k]; }, 0); }
          (d.events || []).forEach(function (e) { if (e.ts) lastTs = Math.max(lastTs, e.ts); });
          var edges = (stats.edges || []).filter(function (e) { return first ? true : e.ts > lastTs - 6000; });
          edges.slice(-8).forEach(function (e, i) { setTimeout(function () { animateEdge(e.from, e.to, e.success === false ? 'warn' : (e.kind || 'request')); bump(e.to); }, i * 200); });
          return true;
        });
      }).catch(function () { return false; });
    }
    // Rich ambient simulation: a queen-coordinated mesh is never idle. While waiting
    // for requests, agents talk peer-to-peer (building bit-form KBs), the auditor is
    // pinged, and improvement proposals flow to the Queen — so the web looks alive.
    function simulate() {
      if (REDUCE) return;
      var ids = NODES.map(function (n) { return n.id; });
      var queen = 'aria-mesh-router';
      var auditId = NODE_BY_ID['audit-agent'] ? 'audit-agent' : (NODE_BY_ID['aria-verifier'] ? 'aria-verifier' : null);
      var pickArr = function (a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; };
      var pick = function () { return pickArr(ids); };
      var alive = function () { return !document.hidden; };
      var sched = function (fn, lo, hi) { setTimeout(fn, lo + Math.random() * (hi - lo)); };

      // 1) ambient peer-to-peer learning chatter (KB-building) — the constant hum
      (function chatter() {
        if (alive()) {
          var n = 1 + Math.floor(Math.random() * 3);
          for (var i = 0; i < n; i++) {
            var from = pick(), to = pick(), t = 0;
            while (to === from && t++ < 4) to = pick();
            if (from && to && from !== to) { animateEdge(from, to, 'learn'); bump(to); }
          }
        }
        sched(chatter, 480, 1150);
      })();

      // 2) periodic full request pipeline: Queen -> diagnose -> research/reason -> [execute] -> verify -> Queen
      (function request() {
        if (alive()) {
          var chain = [queen, pickArr(REG.phases.diagnose),
            pickArr((REG.phases.research || []).concat(REG.phases.reason || [])),
            Math.random() < 0.5 ? pickArr(REG.phases.execute) : null,
            pickArr(REG.phases.verify), queen].filter(Boolean);
          chain.forEach(function (h, i) { setTimeout(function () { if (i > 0 && chain[i - 1] !== h) animateEdge(chain[i - 1], h, Math.random() < 0.06 ? 'warn' : 'request'); bump(h); }, i * 360); });
        }
        sched(request, 3000, 5200);
      })();

      // 3) auditor pings — gatekeeper watching the mesh for concerns
      if (auditId) (function audit() {
        if (alive()) { var from = pick(); if (from && from !== auditId) { animateEdge(from, auditId, 'audit'); bump(auditId); } }
        sched(audit, 2400, 5200);
      })();

      // 4) evolution proposals flowing to the Queen / ARIA
      (function evolve() {
        if (alive()) { var from = pick(); if (from && from !== queen) { animateEdge(from, queen, 'evolve'); bump(queen); } }
        sched(evolve, 3600, 6600);
      })();
    }

    // canvas ambient
    var ctx, W, H, DPR, particles = [], sweepAng = 0, paused = false;
    function initCanvas() {
      ctx = bg.getContext('2d'); resize(); window.addEventListener('resize', resize);
      // Re-measure when the stage becomes visible (e.g. login gate reveals #app after auth),
      // so the canvas ambient layer isn't stuck at 0x0 from being built while hidden.
      if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(stage); } catch (e) {} }
      var N = REDUCE ? 0 : 60;
      for (var i = 0; i < N; i++) particles.push({ a: Math.random() * Math.PI * 2, r: 60 + Math.random() * 340, sp: (Math.random() * 0.0006 + 0.0002) * (Math.random() < 0.5 ? -1 : 1), z: Math.random(), tw: Math.random() * Math.PI * 2 });
      document.addEventListener('visibilitychange', function () { paused = document.hidden; if (!paused && !REDUCE) requestAnimationFrame(loop); });
      if (!REDUCE) requestAnimationFrame(loop);
    }
    function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = bg.clientWidth; H = bg.clientHeight; bg.width = W * DPR; bg.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
    function L2C(x, y) { return { x: x / 1000 * W, y: y / 800 * H }; }
    function rgbAccent() { // crude hex->rgb for accent trails
      var h = (accent || '#2dd4bf').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var n = parseInt(h, 16); return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255);
    }
    var ACCENT_RGB = null;
    function loop() {
      if (paused) return;
      if (!ACCENT_RGB) ACCENT_RGB = rgbAccent();
      ctx.clearRect(0, 0, W, H);
      var c = L2C(CX, CY);
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.min(W, H) * 0.5);
      g.addColorStop(0, 'rgba(' + ACCENT_RGB + ',0.10)'); g.addColorStop(0.4, 'rgba(' + ACCENT_RGB + ',0.03)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, Math.min(W, H) * 0.5, 0, Math.PI * 2); ctx.fill();
      sweepAng += 0.0055;
      var rr = Math.min(W, H) * 0.46;
      if (ctx.createConicGradient) {
        var cg = ctx.createConicGradient(sweepAng, c.x, c.y);
        cg.addColorStop(0, 'rgba(' + ACCENT_RGB + ',0.16)'); cg.addColorStop(0.05, 'rgba(' + ACCENT_RGB + ',0.0)'); cg.addColorStop(1, 'rgba(' + ACCENT_RGB + ',0.0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.fill();
      }
      particles.forEach(function (p) {
        p.a += p.sp; p.tw += 0.04;
        var px = c.x + Math.cos(p.a) * (p.r / 1000 * W), py = c.y + Math.sin(p.a) * (p.r / 800 * H);
        var tw = 0.4 + 0.6 * Math.abs(Math.sin(p.tw));
        ctx.fillStyle = 'rgba(' + ACCENT_RGB + ',' + (0.05 + 0.18 * p.z * tw) + ')';
        ctx.beginPath(); ctx.arc(px, py, (0.6 + 1.4 * p.z), 0, Math.PI * 2); ctx.fill();
      });
      var now = performance.now();
      for (var i = comets.length - 1; i >= 0; i--) {
        var cm = comets[i], k = (now - cm.t) / cm.dur;
        if (k >= 1) { comets.splice(i, 1); continue; }
        var pt; try { pt = cm.path.getPointAtLength(cm.len * k); } catch (e) { comets.splice(i, 1); continue; }
        var cp = L2C(pt.x, pt.y);
        cm.trail.push({ x: cp.x, y: cp.y }); if (cm.trail.length > 14) cm.trail.shift();
        var col = cm.col || ACCENT_RGB;
        cm.trail.forEach(function (tp, j) { var a = (j / cm.trail.length) * 0.5; ctx.fillStyle = 'rgba(' + col + ',' + a + ')'; ctx.beginPath(); ctx.arc(tp.x, tp.y, 1.4 + 2.2 * (j / cm.trail.length), 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = 'rgba(' + col + ',0.95)'; ctx.beginPath(); ctx.arc(cp.x, cp.y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(' + col + ',0.25)'; ctx.beginPath(); ctx.arc(cp.x, cp.y, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(loop);
    }
  }

  function boot() {
    injectCSS();
    var mounts = document.querySelectorAll('[data-aria-mesh-web]');
    mounts.forEach(function (m) { if (!m.__mwBuilt) { m.__mwBuilt = true; try { buildInstance(m); } catch (e) { if (window.console) console.error('[aria-mesh-web]', e); } } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
