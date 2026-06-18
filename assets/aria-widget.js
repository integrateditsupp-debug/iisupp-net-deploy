/* === ARIA Embeddable Widget v0.1 ============================
   Drop on any site:
     <script src="https://iisupp.net/assets/aria-widget.js"
             data-color="#c5a059"
             data-position="bottom-right"
             async></script>
   Bottom-right floating chat bubble. Click -> opens an iframe of
   /aria from iisupp.net. Lightweight (no deps), CSP-safe, sub-3KB gz.
============================================================ */
(function(){
  'use strict';
  if (window.__ariaWidgetLoaded) return;
  window.__ariaWidgetLoaded = true;
  var s = document.currentScript || (function(){var a=document.getElementsByTagName('script');return a[a.length-1];})();
  var ds = (s && s.dataset) || {};
  var COLOR = ds.color || '#c5a059';
  var POS = ds.position || 'bottom-right';
  var TITLE = ds.title || 'Ask ARIA';
  var SRC = ds.src || 'https://iisupp.net/aria';
  var posCSS = POS === 'bottom-left' ? 'left:18px;right:auto' : 'right:18px;left:auto';

  // Inject styles
  var st = document.createElement('style');
  st.textContent =
    '.aria-w-bubble{position:fixed;'+posCSS+';bottom:18px;z-index:2147483640;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:'+COLOR+';box-shadow:0 8px 24px rgba(0,0,0,.35);transition:transform .15s,box-shadow .15s;display:flex;align-items:center;justify-content:center}'+
    '.aria-w-bubble:hover{transform:scale(1.08);box-shadow:0 12px 28px rgba(0,0,0,.5)}'+
    '.aria-w-bubble svg{width:28px;height:28px;color:#1a1410}'+
    '.aria-w-panel{position:fixed;'+posCSS+';bottom:88px;z-index:2147483641;width:min(380px,calc(100vw - 40px));height:min(640px,calc(100vh - 120px));background:#050505;border:1px solid '+COLOR+';border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.55);display:none;overflow:hidden;transform-origin:bottom right;animation:awSlide .25s ease-out}'+
    '.aria-w-panel.open{display:flex;flex-direction:column}'+
    '.aria-w-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(197,160,89,.25);background:linear-gradient(180deg,#0a0805,#050402);color:'+COLOR+';font-family:-apple-system,Segoe UI,sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700}'+
    '.aria-w-close{background:transparent;border:0;color:'+COLOR+';font-size:20px;cursor:pointer;padding:2px 6px;line-height:1}'+
    '.aria-w-close:hover{color:#fff}'+
    '.aria-w-frame{flex:1;border:0;width:100%;background:#050505}'+
    '@keyframes awSlide{from{opacity:0;transform:translateY(20px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}';
  document.head.appendChild(st);

  // Bubble button
  var btn = document.createElement('button');
  btn.className = 'aria-w-bubble';
  btn.setAttribute('aria-label', TITLE);
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  // Panel
  var panel = document.createElement('div');
  panel.className = 'aria-w-panel';
  panel.innerHTML = '<div class="aria-w-head"><span>'+TITLE+' &middot; <span style="color:#fff">live</span></span><button class="aria-w-close" aria-label="Close">&times;</button></div><iframe class="aria-w-frame" src="'+SRC+'" loading="lazy" allow="microphone" title="ARIA"></iframe>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  btn.addEventListener('click', function(){
    panel.classList.toggle('open');
  });
  panel.querySelector('.aria-w-close').addEventListener('click', function(){
    panel.classList.remove('open');
  });
})();
