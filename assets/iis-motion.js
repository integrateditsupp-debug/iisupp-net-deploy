/*! ==========================================================================
   IIS MOTION LAYER v1.1 — ambient scroll-reactive background system
   --------------------------------------------------------------------------
   v1.1: crisper text (reveal classes stripped after settle → zero residual
   compositing), richer gold dust (more motes + large soft bokeh, sharper
   DPR), stronger scroll parallax on the dust. Pairs with iis-motion.css.

   Safety contract unchanged:
   · If this script never runs, no content is ever hidden or altered.
   · Everything wrapped — a failure here can never break the page.
   · prefers-reduced-motion → static ambience, instant reveals, no canvas.
   · Modes: default "full" · data-mode="bg" (ambience only, no reveals).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__IISM__) return;
  window.__IISM__ = 1.1;

  var doc = document;
  var root = doc.documentElement;
  var script = doc.currentScript;
  var MODE = (script && script.getAttribute('data-mode')) === 'bg' ? 'bg' : 'full';

  var REDUCED = false, MOBILE = false;
  try {
    REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    MOBILE = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------------ */
  var bg, orbsWrap, orbs = [], progressBar, grid;
  var dustCanvas, dustCtx, particles = [], dpr = 1;
  var vw = 0, vh = 0, docH = 1;
  var curP = 0, targetP = 0, lastY = 0, scrollDelta = 0;
  var running = false, rafId = 0, tick = 0;
  var pendingReveal = [];

  function clamp01(n) { return n < 0 ? 0 : (n > 1 ? 1 : n); }

  function el(tag, cls, parent) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  function measure() {
    vw = window.innerWidth || root.clientWidth || 1;
    vh = window.innerHeight || root.clientHeight || 1;
    var b = doc.body;
    docH = Math.max(
      b.scrollHeight, b.offsetHeight,
      root.scrollHeight, root.offsetHeight, root.clientHeight
    );
  }

  function scrollY() {
    return window.pageYOffset || root.scrollTop || 0;
  }

  /* ---------------- Stage construction ---------------- */
  function buildStage() {
    bg = el('div', null, null);
    bg.id = 'iism-bg';
    bg.setAttribute('aria-hidden', 'true');

    el('div', 'iism-tint iism-tint-a', bg);
    el('div', 'iism-tint iism-tint-b', bg);
    el('div', 'iism-tint iism-tint-c', bg);

    orbsWrap = el('div', 'iism-orbs', bg);
    for (var i = 1; i <= 4; i++) {
      var o = el('div', 'iism-orb iism-o' + i, orbsWrap);
      el('i', null, o);
      orbs.push(o);
    }

    grid = el('div', 'iism-grid', bg);
    if (!REDUCED) el('div', 'iism-beam', bg);
    if (!REDUCED) {
      dustCanvas = el('canvas', null, bg);
      dustCanvas.id = 'iism-dust';
    }
    el('div', 'iism-vig', bg);

    doc.body.insertBefore(bg, doc.body.firstChild);

    progressBar = el('div', null, doc.body);
    progressBar.id = 'iism-progress';
  }

  /* ---------------- Gold dust — the floating lights ---------------- */
  function makeParticle(anyY, bokeh) {
    var W = dustCanvas.width / dpr, H = dustCanvas.height / dpr;
    if (bokeh) {
      /* large, soft, slow motes drifting like dust in a sunbeam */
      return {
        x: Math.random() * W,
        y: anyY ? Math.random() * H : H + 10,
        r: 2.4 + Math.random() * 2.2,
        a: 0.04 + Math.random() * 0.07,
        tw: Math.random() * 6.283,
        tws: 0.003 + Math.random() * 0.008,
        vy: -(0.03 + Math.random() * 0.08),
        vx: (Math.random() - 0.5) * 0.05,
        d: 0.15 + Math.random() * 0.35,
        soft: true
      };
    }
    return {
      x: Math.random() * W,
      y: anyY ? Math.random() * H : H + 6,
      r: 0.5 + Math.random() * 1.4,
      a: 0.08 + Math.random() * 0.36,
      tw: Math.random() * 6.283,
      tws: 0.006 + Math.random() * 0.022,
      vy: -(0.05 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 0.08,
      d: 0.25 + Math.random() * 0.75,
      soft: false
    };
  }

  function initDust() {
    try {
      dustCtx = dustCanvas.getContext('2d');
      if (!dustCtx) { dustCanvas = null; return; }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeCanvas();
      particles.length = 0;
      var n = MOBILE ? 38 : 84;
      var nb = MOBILE ? 3 : 7;
      for (var i = 0; i < n; i++) particles.push(makeParticle(true, false));
      for (var j = 0; j < nb; j++) particles.push(makeParticle(true, true));
    } catch (e) { dustCanvas = null; }
  }

  function sizeCanvas() {
    if (!dustCanvas) return;
    dustCanvas.width = Math.floor(vw * dpr);
    dustCanvas.height = Math.floor(vh * dpr);
    if (dustCtx) dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function stepDust(delta) {
    if (!dustCtx || !dustCanvas) return;
    var W = vw, H = vh;
    dustCtx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.tw += p.tws;
      p.y += p.vy - delta * p.d * 0.65;
      p.x += p.vx + Math.sin(tick * 0.004 + p.tw) * (p.soft ? 0.03 : 0.05);
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      else if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10;
      else if (p.x > W + 10) p.x = -10;
      var alpha = p.a * (0.55 + 0.45 * Math.sin(p.tw));
      if (alpha <= 0.006) continue;
      if (p.soft) {
        /* two-pass soft bokeh: wide faint halo + gentle core */
        dustCtx.beginPath();
        dustCtx.fillStyle = 'rgba(214,184,118,' + (alpha * 0.45).toFixed(3) + ')';
        dustCtx.arc(p.x, p.y, p.r * 2.2, 0, 6.283);
        dustCtx.fill();
        dustCtx.beginPath();
        dustCtx.fillStyle = 'rgba(238,214,158,' + alpha.toFixed(3) + ')';
        dustCtx.arc(p.x, p.y, p.r, 0, 6.283);
        dustCtx.fill();
        continue;
      }
      if (p.r > 1.3) {
        dustCtx.beginPath();
        dustCtx.fillStyle = 'rgba(216,186,120,' + (alpha * 0.3).toFixed(3) + ')';
        dustCtx.arc(p.x, p.y, p.r * 2.6, 0, 6.283);
        dustCtx.fill();
      }
      dustCtx.beginPath();
      dustCtx.fillStyle = 'rgba(226,198,134,' + alpha.toFixed(3) + ')';
      dustCtx.arc(p.x, p.y, p.r, 0, 6.283);
      dustCtx.fill();
    }
  }

  /* ---------------- Scroll-reactive scene ---------------- */
  function applyScene(p, y) {
    progressBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (y > 40) { if (!progressBar.className) progressBar.className = 'iism-vis'; }
    else if (progressBar.className) progressBar.className = '';

    var ta = clamp01(1 - p * 1.9);
    var tb = clamp01(1 - Math.abs(p - 0.5) * 2.8);
    var tc = clamp01((p - 0.55) * 2.4);
    bg.style.setProperty('--ta', ta.toFixed(3));
    bg.style.setProperty('--tb', tb.toFixed(3));
    bg.style.setProperty('--tc', tc.toFixed(3));

    grid.style.setProperty('--py', (-(y * 0.08 % 34)).toFixed(2));

    orbsWrap.style.transform =
      'translate3d(0,' + (-p * vh * 0.14).toFixed(1) + 'px,0) rotate(' + (p * 7).toFixed(2) + 'deg)';
    orbs[0].style.transform =
      'translate3d(' + (-p * vw * 0.10).toFixed(1) + 'px,' + (p * vh * 0.24).toFixed(1) + 'px,0)';
    orbs[1].style.transform =
      'translate3d(' + (p * vw * 0.12).toFixed(1) + 'px,' + (-p * vh * 0.10).toFixed(1) + 'px,0) scale(' + (1 + p * 0.22).toFixed(3) + ')';
    orbs[2].style.transform =
      'translate3d(0,' + (-p * vh * 0.30).toFixed(1) + 'px,0)';
    orbs[3].style.transform =
      'translate3d(' + (-p * vw * 0.08).toFixed(1) + 'px,' + (-p * vh * 0.42).toFixed(1) + 'px,0) scale(' + (1 + p * 0.15).toFixed(3) + ')';
  }

  /* ---------------- Frame loop ---------------- */
  function frame() {
    rafId = 0;
    tick++;
    var y = scrollY();
    var denom = Math.max(1, docH - vh);
    targetP = clamp01(y / denom);
    scrollDelta = y - lastY;
    if (scrollDelta > 60) scrollDelta = 60;
    else if (scrollDelta < -60) scrollDelta = -60;
    lastY = y;

    curP += (targetP - curP) * 0.14;
    if (Math.abs(targetP - curP) < 0.0004) curP = targetP;

    applyScene(curP, y);
    stepDust(scrollDelta);

    if ((tick & 31) === 0) {
      measure();
      sweepReveal(false);
    }
    if (running) rafId = window.requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || REDUCED) return;
    running = true;
    if (!rafId) rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
  }

  function reducedUpdate() {
    measure();
    var y = scrollY();
    var p = clamp01(y / Math.max(1, docH - vh));
    curP = p;
    applyScene(p, y);
  }

  /* ---------------- Section reveals (full mode) ----------------
     v1.1: after a section settles, BOTH classes are removed so the element
     returns to completely untouched paint — crisp text, no stacking residue,
     and the site's own fixed decorations (bg-i-stage) are never buried. */
  function settle(s) {
    window.setTimeout(function () {
      try { s.classList.remove('iism-reveal', 'iism-in'); } catch (e) { /* noop */ }
    }, 900);
  }

  function revealNow(s) {
    if (!s.classList.contains('iism-in')) {
      s.classList.add('iism-in');
      settle(s);
    }
    var idx = pendingReveal.indexOf(s);
    if (idx > -1) pendingReveal.splice(idx, 1);
  }

  function collectRevealTargets() {
    if (MODE !== 'full' || REDUCED) return;
    var nodes;
    try {
      nodes = doc.querySelectorAll('section, footer, [data-iism-reveal]');
    } catch (e) { return; }
    var startY = scrollY();
    for (var i = 0; i < nodes.length; i++) {
      var s = nodes[i];
      try {
        if (s.className && String(s.className).indexOf('iism-') !== -1) continue;
        if (s.closest && s.closest('[data-iism-skip], dialog, [role="dialog"], header, nav, #iism-bg')) continue;
        if (s.querySelector && s.querySelector('.fixed, [data-iism-skip]')) continue;
        var r = s.getBoundingClientRect();
        if (r.height < 40) continue;
        if (r.top < vh * 0.88) continue;
        if (startY > 80 && r.top < vh * 1.15) continue;
        s.classList.add('iism-reveal');
        pendingReveal.push(s);
      } catch (e) { /* skip node */ }
    }
    if (!pendingReveal.length) return;

    if ('IntersectionObserver' in window) {
      try {
        var io = new IntersectionObserver(function (entries) {
          for (var j = 0; j < entries.length; j++) {
            if (entries[j].isIntersecting) {
              revealNow(entries[j].target);
              io.unobserve(entries[j].target);
            }
          }
        }, { rootMargin: '0px 0px -9% 0px', threshold: 0.04 });
        for (var k = 0; k < pendingReveal.length; k++) io.observe(pendingReveal[k]);
      } catch (e) { sweepReveal(true); }
    }
    window.setTimeout(function () { sweepReveal(false); }, 1200);
  }

  function sweepReveal(forceAll) {
    if (!pendingReveal.length) return;
    for (var i = pendingReveal.length - 1; i >= 0; i--) {
      var s = pendingReveal[i];
      var show = forceAll;
      if (!show) {
        try {
          var r = s.getBoundingClientRect();
          show = r.top < vh * 0.96 && r.bottom > 0;
        } catch (e) { show = true; }
      }
      if (show) {
        s.classList.add('iism-in');
        settle(s);
        pendingReveal.splice(i, 1);
      }
    }
  }

  /* ---------------- Boot ---------------- */
  function init() {
    if (!doc.body) return;
    try {
      root.classList.add(MODE === 'full' ? 'iism-full' : 'iism-bgonly');
      measure();
      buildStage();
      if (dustCanvas) initDust();
      lastY = scrollY();
      collectRevealTargets();

      if (REDUCED) {
        reducedUpdate();
        window.addEventListener('scroll', function () {
          reducedUpdate();
          sweepReveal(false);
        }, { passive: true });
      } else {
        startLoop();
        doc.addEventListener('visibilitychange', function () {
          if (doc.hidden) stopLoop(); else startLoop();
        });
      }

      window.addEventListener('resize', function () {
        measure();
        sizeCanvas();
      }, { passive: true });

      window.addEventListener('load', function () {
        measure();
        sweepReveal(false);
      });
    } catch (e) {
      try { sweepReveal(true); } catch (e2) { /* noop */ }
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
