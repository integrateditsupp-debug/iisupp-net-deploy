/*!
 * aria-mobile-shim.js — Mobile + iOS Safari edge-case fixes (drop-in, no markup changes)
 *  - Sets --vh real-viewport-height variable (defeats iOS Safari address-bar miscalc)
 *  - Detects on-screen keyboard, adds .iis-kb-open class to body for layout adjustment
 *  - Prevents iOS auto-zoom on focused inputs by enforcing 16px+ font-size
 *  - Hooks orientationchange + resize + visualViewport API (where supported)
 *  - Adds .iis-touch class to body for touch-only hover-substitute styling
 *  Cat 11 — Mobile + responsive.
 */
(function () {
  'use strict';
  if (window.__iisMobileShim) return;
  window.__iisMobileShim = true;

  var html = document.documentElement, body = document.body || document.documentElement;

  // Touch detection
  if ('ontouchstart' in window || (navigator.maxTouchPoints > 0)) {
    html.classList.add('iis-touch');
  }

  // iOS detection
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) html.classList.add('iis-ios');

  // Real viewport height
  function setVH() {
    var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    html.style.setProperty('--vh', (vh * 0.01) + 'px');
    html.style.setProperty('--vh-full', vh + 'px');
  }
  setVH();

  // Keyboard detection via visualViewport
  var initialH = window.innerHeight;
  function checkKb() {
    var vv = window.visualViewport;
    var h = vv ? vv.height : window.innerHeight;
    var kbOpen = (initialH - h) > 150;  // 150px threshold
    body.classList.toggle('iis-kb-open', kbOpen);
    setVH();
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', checkKb);
    window.visualViewport.addEventListener('scroll', setVH);
  } else {
    window.addEventListener('resize', checkKb);
  }
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { initialH = window.innerHeight; setVH(); checkKb(); }, 300);
  });

  // Prevent iOS auto-zoom: ensure all inputs/textareas/selects are >=16px
  if (isIOS) {
    var style = document.createElement('style');
    style.textContent =
      'input, textarea, select { font-size: max(16px, 1em) !important; }' +
      'body.iis-kb-open { padding-bottom: 0 !important; }' +
      'body.iis-kb-open [data-fixed-bottom] { position: absolute !important; }';
    document.head.appendChild(style);
  }

  // Expose for debugging
  window.iisShim = { setVH: setVH, checkKb: checkKb, isIOS: isIOS };
})();
