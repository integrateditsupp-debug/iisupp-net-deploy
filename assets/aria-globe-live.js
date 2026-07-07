/* ARIA Living Globe layer — 2026-07-07 (Cowork)
   PURPOSE: make the aria.html globe REACT to ARIA instead of idling — the globe now visibly
   listens, thinks, speaks, resolves, and responds to the visitor's pointer. Rule 17 value-first:
   the "wow, it's alive" moment a prospect feels in the first 5 seconds.

   STRICTLY ADDITIVE (Rule 15):
   - Zero changes to buildGlobe(), its SVG, or any existing animation. This file only:
     (a) sets data-aria-state="..." on the two existing globe mounts (#globeWrap, #voiceGlobeContainer),
     (b) injects state-scoped CSS overrides that revert automatically when the state exits,
     (c) appends tiny overlay elements (state ring, state label, ripples) INSIDE the mounts,
     (d) listens to events the brain adapter (aria-brain.js v2) already dispatches:
         'aria:user-turn' -> thinking, 'aria:turn' -> speaking/resolved/escalated,
         plus a MutationObserver fallback so the old (?brain=old) engine animates too,
     (e) watches #micBtn's existing 'recording' class -> listening.
   - Honest states only: the globe claims nothing — it reflects what the page is actually doing.

   Real interactive behaviors wired here (9): idle · attend (typing) · listening (mic) ·
   thinking · speaking · resolved · escalated · hover-parallax · tap-ripple.

   API (for future features, e.g. Sentinel-style anchors): window.AriaGlobe.setState(s),
   .getState(), .pulse(), .celebrate().
*/
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__AGL) return; window.__AGL = 1;

  var REDUCED = false;
  try { REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var FINE_POINTER = false;
  try { FINE_POINTER = window.matchMedia && window.matchMedia('(pointer: fine)').matches; } catch (e) {}

  /* ---------- state-scoped CSS (injected; overrides revert on state exit) ---------- */
  var CSS = ''
    /* stage becomes a 3D card for the parallax tilt */
    + '.agl-live .globe-stage{transform-style:preserve-3d;will-change:transform;transition:transform .28s ease-out}'
    + '.agl-live{position:relative}'

    /* --- state ring overlay (one div, two pseudo rings) --- */
    + '.agl-ring{position:absolute;inset:6%;border-radius:50%;pointer-events:none;z-index:3}'
    + '.agl-ring:before,.agl-ring:after{content:"";position:absolute;inset:0;border-radius:50%;border:1px solid rgba(212,168,90,0);opacity:0}'

    /* --- state label --- */
    + '.agl-state{position:absolute;left:50%;bottom:2.5%;transform:translateX(-50%);z-index:4;pointer-events:none;'
    +   'font:600 9.5px/1 "Segoe UI",system-ui,sans-serif;letter-spacing:.32em;text-transform:uppercase;'
    +   'color:rgba(212,168,90,.38);white-space:nowrap;transition:color .4s ease}'
    + '.agl-state .agl-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:rgba(212,168,90,.45);'
    +   'margin-right:7px;vertical-align:1px;transition:background .4s ease}'
    + '[data-aria-state]:not([data-aria-state="idle"]) .agl-state{color:rgba(240,216,149,.85)}'
    + '[data-aria-state]:not([data-aria-state="idle"]) .agl-state .agl-dot{background:#f0d895;animation:aglDotPulse 1.1s ease-in-out infinite}'

    /* --- LISTENING: calm, attentive — slow spin, breathing rings --- */
    + '[data-aria-state="listening"] .globe-rotate{animation-duration:150s!important}'
    + '[data-aria-state="listening"] .globe-rotate-rev{animation-duration:170s!important}'
    + '[data-aria-state="listening"] .agl-ring:before{animation:aglRingPulse 2.2s ease-out infinite}'
    + '[data-aria-state="listening"] .agl-ring:after{animation:aglRingPulse 2.2s ease-out infinite;animation-delay:1.1s}'
    + '[data-aria-state="listening"] .globe-letter .a{filter:brightness(1.18)}'

    /* --- THINKING: energy up — fast spin, rapid dot pulse, rotating dashed halo --- */
    + '[data-aria-state="thinking"] .globe-rotate{animation-duration:18s!important}'
    + '[data-aria-state="thinking"] .globe-rotate-rev{animation-duration:26s!important}'
    + '[data-aria-state="thinking"] .dots-pulse>circle{animation-duration:1.15s!important}'
    + '[data-aria-state="thinking"] .agl-ring:before{opacity:1;border:1px dashed rgba(240,216,149,.34);animation:aglSpin 3.2s linear infinite}'
    + '[data-aria-state="thinking"] .globe-letter .a{filter:brightness(.92) saturate(1.15)}'

    /* --- SPEAKING: rhythmic glow on the A, gentle spin --- */
    + '[data-aria-state="speaking"] .globe-rotate{animation-duration:55s!important}'
    + '[data-aria-state="speaking"] .globe-letter .a{animation:aglSpeak .36s ease-in-out infinite alternate}'

    /* --- RESOLVED: one warm success sweep --- */
    + '[data-aria-state="resolved"] .agl-ring:before{animation:aglResolve 1.5s ease-out 1}'
    + '[data-aria-state="resolved"] .globe-letter .a{filter:brightness(1.35);transition:filter .3s ease}'

    /* --- ESCALATED: a single amber attention ring (honest: needs human hands) --- */
    + '[data-aria-state="escalated"] .agl-ring:before{animation:aglEscalate 1.6s ease-out 1}'

    /* --- ATTEND: user is typing — the globe leans in (tiny, subtle) --- */
    + '[data-aria-state="attend"] .globe-stage{transform:scale(1.012)}'
    + '[data-aria-state="attend"] .globe-letter .a{filter:brightness(1.1)}'

    /* --- tap/click ripple --- */
    + '.agl-ripple{position:absolute;border-radius:50%;pointer-events:none;z-index:5;border:1px solid rgba(240,216,149,.55);'
    +   'animation:aglRipple .9s ease-out 1;transform:translate(-50%,-50%)}'

    /* --- keyframes --- */
    + '@keyframes aglRingPulse{0%{opacity:.55;border-color:rgba(212,168,90,.5);transform:scale(.96)}'
    +   '100%{opacity:0;border-color:rgba(240,216,149,0);transform:scale(1.14)}}'
    + '@keyframes aglSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'
    + '@keyframes aglSpeak{from{filter:brightness(1.02)}to{filter:brightness(1.42)}}'
    + '@keyframes aglResolve{0%{opacity:.9;border:2px solid rgba(126,200,120,.65);transform:scale(.92)}'
    +   '60%{opacity:.5;border-color:rgba(240,216,149,.5)}100%{opacity:0;border-color:rgba(240,216,149,0);transform:scale(1.22)}}'
    + '@keyframes aglEscalate{0%{opacity:.85;border:2px solid rgba(224,164,80,.7);transform:scale(.94)}'
    +   '100%{opacity:0;border-color:rgba(224,120,60,0);transform:scale(1.18)}}'
    + '@keyframes aglRipple{0%{width:12px;height:12px;opacity:.8}100%{width:220px;height:220px;opacity:0}}'
    + '@keyframes aglDotPulse{0%,100%{opacity:1}50%{opacity:.35}}'
    /* reduced motion: keep it calm — no fast spins, no ripples */
    + '@media (prefers-reduced-motion: reduce){'
    +   '[data-aria-state] .globe-rotate,[data-aria-state] .globe-rotate-rev,[data-aria-state] .dots-pulse>circle{animation-duration:inherit!important}'
    +   '.agl-ripple{display:none}}';

  function injectCss() {
    var st = document.createElement('style');
    st.id = 'aria-globe-live-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- mounts ---------- */
  var MOUNT_IDS = ['globeWrap', 'voiceGlobeContainer'];
  var mounts = [];

  function setupMount(el) {
    if (!el || el.__aglSetup) return;
    el.__aglSetup = 1;
    el.classList.add('agl-live');
    el.setAttribute('data-aria-state', 'idle');
    var stage = el.querySelector('.globe-stage') || el;

    var ring = document.createElement('div');
    ring.className = 'agl-ring';
    stage.appendChild(ring);

    var label = document.createElement('div');
    label.className = 'agl-state';
    label.innerHTML = '<span class="agl-dot"></span><span class="agl-word">online</span>';
    stage.appendChild(label);

    /* pointer parallax — fine pointers only, reduced-motion off */
    if (FINE_POINTER && !REDUCED) {
      var rx = 0, ry = 0, tx = 0, ty = 0, rafId = null, inside = false;
      var loop = function () {
        rx += (tx - rx) * 0.12; ry += (ty - ry) * 0.12;
        stage.style.transform = 'perspective(900px) rotateX(' + (-ry).toFixed(2) + 'deg) rotateY(' + rx.toFixed(2) + 'deg)';
        if (inside || Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05) { rafId = requestAnimationFrame(loop); }
        else { stage.style.transform = ''; rafId = null; }
      };
      el.addEventListener('pointerenter', function () { inside = true; if (!rafId) rafId = requestAnimationFrame(loop); });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        tx = px * 9; ty = py * 9;
      });
      el.addEventListener('pointerleave', function () { inside = false; tx = 0; ty = 0; });
    }

    /* tap ripple + honest data spark (uses the page's own spawnArc/flashCity if present) */
    el.addEventListener('click', function (e) {
      if (REDUCED) return;
      var r = el.getBoundingClientRect();
      var rip = document.createElement('div');
      rip.className = 'agl-ripple';
      rip.style.left = (e.clientX - r.left) + 'px';
      rip.style.top = (e.clientY - r.top) + 'px';
      el.appendChild(rip);
      setTimeout(function () { if (rip.parentNode) rip.parentNode.removeChild(rip); }, 950);
      try {
        if (typeof window.spawnArc === 'function') { window.spawnArc(); window.spawnArc(); }
        if (typeof window.flashCity === 'function' && window.__globeCities && window.__globeCities.length) {
          window.flashCity(window.__globeCities[Math.floor(Math.random() * window.__globeCities.length)]);
        }
      } catch (err) {}
    });

    mounts.push({ el: el, label: label.querySelector('.agl-word') });
  }

  /* ---------- state machine ---------- */
  var state = 'idle';
  var speakTimer = null, resolveTimer = null, thinkGuard = null, arcBurst = null, attendTimer = null;
  var WORDS = { idle: 'online', attend: 'attentive', listening: 'listening', thinking: 'thinking', speaking: 'speaking', resolved: 'resolved', escalated: 'handing off' };

  function apply(s) {
    state = s;
    for (var i = 0; i < mounts.length; i++) {
      mounts[i].el.setAttribute('data-aria-state', s);
      if (mounts[i].label) mounts[i].label.textContent = WORDS[s] || s;
    }
  }

  function clearTimers() {
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
    if (resolveTimer) { clearTimeout(resolveTimer); resolveTimer = null; }
    if (thinkGuard) { clearTimeout(thinkGuard); thinkGuard = null; }
    stopArcBurst();
  }

  function startArcBurst() {
    if (REDUCED || arcBurst) return;
    arcBurst = setInterval(function () {
      try { if (typeof window.spawnArc === 'function') window.spawnArc(); } catch (e) {}
    }, 240);
  }
  function stopArcBurst() { if (arcBurst) { clearInterval(arcBurst); arcBurst = null; } }

  function setState(s) {
    if (!s || s === state) { if (s === 'thinking') armThinkGuard(); return; }
    // listening is sticky while the mic is recording — only the mic observer exits it
    if (state === 'listening' && s !== 'idle' && s !== 'thinking' && s !== 'speaking') return;
    clearTimers();
    if (s === 'thinking') { apply('thinking'); startArcBurst(); armThinkGuard(); return; }
    if (s === 'speaking') {
      apply('speaking');
      speakTimer = setTimeout(function checkVoice() {
        var speaking = false;
        try { speaking = window.speechSynthesis && window.speechSynthesis.speaking; } catch (e) {}
        if (speaking) { speakTimer = setTimeout(checkVoice, 320); }
        else { apply('idle'); speakTimer = null; }
      }, 2400);
      return;
    }
    if (s === 'resolved' || s === 'escalated') {
      apply(s);
      resolveTimer = setTimeout(function () { apply('idle'); resolveTimer = null; }, s === 'resolved' ? 2800 : 2400);
      return;
    }
    apply(s);
  }

  function armThinkGuard() { // never stick in "thinking" if a reply never lands
    if (thinkGuard) clearTimeout(thinkGuard);
    thinkGuard = setTimeout(function () { if (state === 'thinking') setState('idle'); }, 14000);
  }

  /* ---------- wiring ---------- */
  function wire() {
    // brain adapter events (aria-brain.js v2)
    document.addEventListener('aria:user-turn', function () { setState('thinking'); });
    document.addEventListener('aria:turn', function (e) {
      var stage = (e && e.detail && e.detail.stage) || '';
      if (stage === 'closed') setState('resolved');
      else if (stage === 'escalated') setState('escalated');
      else setState('speaking');
    });

    // fallback for the legacy engine (?brain=old): watch the chat stream itself
    var cm = document.getElementById('chatMessages');
    if (cm && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (!n || !n.classList) continue;
            if (n.classList.contains('you-block')) setState('thinking');
            else if (n.classList.contains('aria-block') && state !== 'resolved' && state !== 'escalated') setState('speaking');
          }
        }
      }).observe(cm, { childList: true });
    }

    // mic -> listening (the page toggles 'recording' on #micBtn already)
    var mic = document.getElementById('micBtn');
    if (mic && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () {
        if (mic.classList.contains('recording')) { clearTimers(); apply('listening'); }
        else if (state === 'listening') apply('idle');
      }).observe(mic, { attributes: true, attributeFilter: ['class'] });
    }

    // typing -> attend (subtle lean-in; honest "attention", not fake listening)
    var inp = document.getElementById('askInput');
    if (inp) {
      inp.addEventListener('input', function () {
        if (state !== 'idle' && state !== 'attend') return;
        apply('attend');
        if (attendTimer) clearTimeout(attendTimer);
        attendTimer = setTimeout(function () { if (state === 'attend') apply('idle'); }, 1200);
      });
    }
  }

  function boot() {
    injectCss();
    for (var i = 0; i < MOUNT_IDS.length; i++) setupMount(document.getElementById(MOUNT_IDS[i]));
    if (!mounts.length) { // globes mount from inline script; retry briefly if we ran first
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        for (var i = 0; i < MOUNT_IDS.length; i++) setupMount(document.getElementById(MOUNT_IDS[i]));
        if (mounts.length || tries > 20) clearInterval(t);
      }, 250);
    }
    wire();
    window.AriaGlobe = {
      setState: setState,
      getState: function () { return state; },
      pulse: function () { setState('speaking'); },
      celebrate: function () { setState('resolved'); }
    };
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
