/*!
 * aria-onboarding-tour-v2.js — 3-step spotlight tour for first-time aria.html users
 *  Skips if localStorage.aria_tour_done is set.
 *  Steps: 1) input bar, 2) voice button, 3) escalate-to-human button.
 *  Premium gold styling. Dismissible at any step.
 *  Drop-in: include the script tag on aria.html when ready (preview-before-push gated).
 *  Cat 15 — Lifecycle + onboarding.
 */
(function(){
  'use strict';
  if (window.__iisTour) return;
  window.__iisTour = true;
  if (localStorage.getItem('aria_tour_done')) return;

  var STEPS = [
    { sel: 'input[type="text"], textarea, #aria-input, [data-aria-input]', title: 'Type anything', body: 'Real IT problems work best. "My Outlook is slow" is fine.' },
    { sel: '[data-aria-voice], button[aria-label*="mic" i], button[aria-label*="voice" i]', title: 'Or use voice', body: 'Tap the mic and speak your issue. Faster than typing.' },
    { sel: '[data-aria-escalate], button[aria-label*="human" i], button[aria-label*="escalate" i]', title: 'Get a real human anytime', body: 'If ARIA cannot help, escalate. A live technician will pick up.' }
  ];

  var styleEl = document.createElement('style');
  styleEl.textContent = `
    #iisTourOverlay{position:fixed;inset:0;z-index:2147483600;pointer-events:none}
    #iisTourMask{position:fixed;inset:0;background:rgba(5,5,5,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);pointer-events:auto}
    #iisTourSpot{position:fixed;border:2px solid #c5a059;border-radius:14px;box-shadow:0 0 0 6px rgba(197,160,89,.25), 0 0 30px rgba(197,160,89,.4);pointer-events:none;transition:all .3s cubic-bezier(.16,1,.3,1)}
    #iisTourCard{position:fixed;background:#0a0a0a;border:1px solid rgba(197,160,89,.5);border-radius:14px;padding:22px 26px;max-width:340px;color:#fff;font-family:-apple-system,system-ui,sans-serif;line-height:1.55;pointer-events:auto;box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:2147483601;animation:iisTourPop .3s cubic-bezier(.16,1,.3,1)}
    @keyframes iisTourPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    #iisTourCard h3{color:#f1dca7;font-size:11px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px;font-weight:600;font-family:ui-monospace,monospace}
    #iisTourCard h2{color:#fff;font-size:19px;font-weight:600;margin-bottom:6px}
    #iisTourCard p{color:rgba(255,255,255,.75);font-size:14px;margin-bottom:14px}
    .iis-tour-actions{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .iis-tour-step{color:rgba(255,255,255,.45);font-size:11px;font-family:ui-monospace,monospace}
    .iis-tour-btn{background:linear-gradient(135deg,#c5a059,#f1dca7);color:#050505;border:none;padding:10px 18px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-family:ui-monospace,monospace}
    .iis-tour-skip{background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.15);padding:9px 14px;border-radius:8px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;font-family:ui-monospace,monospace}
    .iis-tour-skip:hover{color:#fff;border-color:rgba(255,255,255,.3)}
  `;
  document.head.appendChild(styleEl);

  var ov = document.createElement('div');
  ov.id = 'iisTourOverlay';
  ov.innerHTML = '<div id="iisTourMask"></div><div id="iisTourSpot"></div>';
  document.body.appendChild(ov);
  var card = document.createElement('div');
  card.id = 'iisTourCard';
  document.body.appendChild(card);

  var idx = 0;
  function render(){
    var s = STEPS[idx];
    var el = document.querySelector(s.sel);
    if (!el) {
      // Skip to next if this step's target missing on this page
      if (idx < STEPS.length - 1) { idx++; render(); return; }
      finish(); return;
    }
    var r = el.getBoundingClientRect();
    var pad = 8;
    var spot = document.getElementById('iisTourSpot');
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad*2) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';

    // Position card below or above based on space
    var cardTop = r.bottom + 16;
    if (cardTop + 200 > window.innerHeight) cardTop = r.top - 200;
    if (cardTop < 12) cardTop = 12;
    var cardLeft = Math.max(12, Math.min(r.left, window.innerWidth - 360));
    card.style.top = cardTop + 'px';
    card.style.left = cardLeft + 'px';

    card.innerHTML =
      '<h3>Quick tour</h3>' +
      '<h2>' + s.title + '</h2>' +
      '<p>' + s.body + '</p>' +
      '<div class="iis-tour-actions">' +
        '<span class="iis-tour-step">' + (idx+1) + ' of ' + STEPS.length + '</span>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="iis-tour-skip" id="iisTourSkip">Skip</button>' +
          '<button class="iis-tour-btn" id="iisTourNext">' + (idx === STEPS.length-1 ? 'Done' : 'Next') + '</button>' +
        '</div>' +
      '</div>';
    document.getElementById('iisTourSkip').onclick = finish;
    document.getElementById('iisTourNext').onclick = function(){
      if (idx < STEPS.length-1) { idx++; render(); } else { finish(); }
    };
  }
  function finish(){
    try { localStorage.setItem('aria_tour_done', '1'); } catch {}
    ov.remove(); card.remove(); styleEl.remove();
  }

  // Wait a moment for the page UI to settle, then start
  setTimeout(function(){
    if (document.querySelector(STEPS[0].sel)) render();
    else finish(); // page doesn't have the targets — skip tour silently
  }, 800);
})();
