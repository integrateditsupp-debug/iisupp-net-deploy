/*!
 * aria-ab-client.js — Drop-in A/B test client
 *  Usage:
 *    AriaAB.expose('hero-cta-text-test', 'A', () => { ... }, () => { ... });
 *    AriaAB.convert('hero-cta-text-test', 'primary');
 *  Visitor ID stored in localStorage. Consistent variant per visitor per test.
 */
(function () {
  if (window.AriaAB) return;
  const EP = '/.netlify/functions/aria-ab-test';

  function getVisitorId() {
    try {
      let id = localStorage.getItem('aria_visitor_id');
      if (!id) {
        id = 'v_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-5);
        localStorage.setItem('aria_visitor_id', id);
      }
      return id;
    } catch { return 'v_anon'; }
  }
  function getOrAssignVariant(testId, variants) {
    try {
      const k = 'aria_ab_' + testId;
      let v = localStorage.getItem(k);
      if (!v) {
        v = variants[Math.floor(Math.random() * variants.length)];
        localStorage.setItem(k, v);
      }
      return v;
    } catch { return variants[0]; }
  }
  window.AriaAB = {
    expose: function (testId, variants, onA, onB) {
      const visitorId = getVisitorId();
      const variant = getOrAssignVariant(testId, Array.isArray(variants) ? variants : ['A', 'B']);
      fetch(EP, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'expose', test_id: testId, variant, visitor_id: visitorId })
      }).catch(() => {});
      try {
        if (variant === 'A' && typeof onA === 'function') onA();
        else if (typeof onB === 'function') onB();
      } catch {}
      return variant;
    },
    convert: function (testId, conversionType) {
      fetch(EP, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'convert', test_id: testId, visitor_id: getVisitorId(), conversion_type: conversionType || 'primary' })
      }).catch(() => {});
    }
  };
})();
