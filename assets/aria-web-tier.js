/* Q-WEBTIER — $70/mo "ARIA Web + AI Edge" upsell card. Env-aware: renders a real Subscribe button ONLY when
   the Stripe price is configured (STRIPE_PRICE_ARIA_WEB_M, surfaced via /.netlify/functions/aria-web-tier);
   otherwise falls back to "Start free trial" + "Contact" so the page NEVER shows a broken checkout.
   Mounts into any element with [data-aria-web-tier]. Browser-global + node-requireable (for tests). */
(function () {
  'use strict';

  // Pure, side-effect-free view model — unit-tested headlessly.
  function tierCardModel(cfg) {
    cfg = cfg || {};
    var name = cfg.name || 'ARIA Web + AI Edge';
    var price = cfg.price || '$70/mo';
    var features = Array.isArray(cfg.features) ? cfg.features : [];
    if (cfg.configured) {
      return {
        heading: name, price: price, features: features,
        primary: { label: 'Subscribe · ' + price, action: 'checkout', tier: 'aria_web_m' },
        secondary: { label: 'Try the free chat', action: 'trial', href: '/aria' },
      };
    }
    // Not configured yet → never offer a broken checkout.
    return {
      heading: name, price: price, features: features,
      primary: { label: 'Start free trial', action: 'trial', href: '/aria' },
      secondary: { label: 'Contact us', action: 'contact', href: '/contact.html' },
    };
  }

  function startCheckout() {
    return fetch('/.netlify/functions/stripe-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'aria_web_m', planName: 'ARIA Web + AI Edge' }),
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data && data.url) { window.location.href = data.url; }
      else { window.location.href = '/aria'; } // graceful fallback — never a dead end
    }).catch(function () { window.location.href = '/aria'; });
  }

  function render(mount, model) {
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
    var feat = model.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    mount.innerHTML =
      '<div class="aria-web-tier-card">' +
      '<div class="awt-eyebrow">Top of funnel</div>' +
      '<h3 class="awt-title">' + esc(model.heading) + '</h3>' +
      '<div class="awt-price">' + esc(model.price) + '</div>' +
      '<ul class="awt-features">' + feat + '</ul>' +
      '<button type="button" class="awt-primary"></button>' +
      '<a class="awt-secondary"></a>' +
      '</div>';
    var btn = mount.querySelector('.awt-primary');
    btn.textContent = model.primary.label;
    btn.addEventListener('click', function () {
      if (model.primary.action === 'checkout') startCheckout();
      else window.location.href = model.primary.href || '/aria';
    });
    var sec = mount.querySelector('.awt-secondary');
    sec.textContent = model.secondary.label;
    sec.setAttribute('href', model.secondary.href || '/aria');
  }

  function mountAll() {
    var nodes = document.querySelectorAll('[data-aria-web-tier]');
    if (!nodes.length) return;
    fetch('/.netlify/functions/aria-web-tier').then(function (r) { return r.json(); })
      .then(function (cfg) { var m = tierCardModel(cfg); nodes.forEach(function (n) { render(n, m); }); })
      .catch(function () { var m = tierCardModel({ configured: false }); nodes.forEach(function (n) { render(n, m); }); });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
    else mountAll();
  }
  if (typeof window !== 'undefined') window.ariaWebTier = { tierCardModel: tierCardModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = { tierCardModel: tierCardModel };
})();
