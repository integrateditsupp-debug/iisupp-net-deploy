/*!
 * aria-cookie-banner-i18n.js — Drop-in cookie banner with 13-locale support
 *  Uses aria-i18n-strings.js if loaded; else falls back to inline EN strings.
 *  Shows once per visitor (localStorage). Premium dark theme matching site.
 *  Cat 8 + Cat 24 — Localization + compliance.
 */
(function () {
  'use strict';
  if (window.__iisCookieBannerI18N) return;
  window.__iisCookieBannerI18N = true;
  if (localStorage.getItem('iis_cookie_consent')) return;

  var STRINGS = {
    en: { text: 'We use only essential cookies for login + payment. No tracking pixels. No third-party ads.', accept: 'OK', learn: 'Privacy details' },
    fr: { text: 'Nous utilisons uniquement des cookies essentiels pour la connexion et le paiement.', accept: 'OK', learn: 'Détails' },
    es: { text: 'Solo cookies esenciales para inicio de sesión y pago. Sin píxeles de seguimiento.', accept: 'OK', learn: 'Detalles' },
    de: { text: 'Nur essentielle Cookies für Login + Zahlung. Keine Tracking-Pixel.', accept: 'OK', learn: 'Details' },
    ar: { text: 'نستخدم فقط ملفات تعريف الارتباط الأساسية لتسجيل الدخول والدفع.', accept: 'موافق', learn: 'التفاصيل' },
    zh: { text: '我们仅使用登录和支付的必需 cookies。无追踪像素。', accept: '好的', learn: '详情' },
    ur: { text: 'ہم صرف لاگ ان اور ادائیگی کے ضروری کوکیز استعمال کرتے ہیں۔', accept: 'ٹھیک ہے', learn: 'تفصیلات' },
    hi: { text: 'हम केवल लॉगिन और भुगतान के लिए आवश्यक कुकीज़ का उपयोग करते हैं।', accept: 'ठीक है', learn: 'विवरण' },
    pt: { text: 'Usamos apenas cookies essenciais para login e pagamento. Sem rastreamento.', accept: 'OK', learn: 'Detalhes' },
    ja: { text: 'ログインと支払いに必須のCookieのみ使用。追跡なし。', accept: 'OK', learn: '詳細' },
    ko: { text: '로그인 및 결제에 필수적인 쿠키만 사용합니다. 추적 픽셀 없음.', accept: '확인', learn: '자세히' },
    ru: { text: 'Используем только необходимые cookies для входа и оплаты. Без трекеров.', accept: 'OK', learn: 'Подробнее' },
    it: { text: 'Usiamo solo cookie essenziali per login e pagamento. Nessun tracker.', accept: 'OK', learn: 'Dettagli' }
  };

  function pickLocale() {
    try {
      var p = new URLSearchParams(location.search);
      var q = p.get('lang');
      if (q && STRINGS[q]) return q;
      var l = localStorage.getItem('aria_lang');
      if (l && STRINGS[l]) return l;
      var nav = (navigator.language || 'en').toLowerCase().split('-')[0];
      return STRINGS[nav] ? nav : 'en';
    } catch { return 'en'; }
  }
  var loc = pickLocale();
  var t = STRINGS[loc] || STRINGS.en;
  var isRtl = loc === 'ar' || loc === 'ur';

  var style = document.createElement('style');
  style.textContent =
    '#iisCookieI18N{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99998;max-width:560px;width:calc(100% - 36px);background:#0a0a0a;border:1px solid rgba(197,160,89,.4);border-radius:10px;padding:14px 18px;color:#fff;font-family:-apple-system,system-ui,sans-serif;font-size:13px;line-height:1.5;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 12px 32px rgba(0,0,0,.5);' + (isRtl ? 'direction:rtl' : '') + '}' +
    '#iisCookieI18N p{margin:0;flex:1;min-width:200px;color:rgba(255,255,255,.85)}' +
    '#iisCookieI18N a{color:#c5a059;text-decoration:underline}' +
    '#iisCookieI18N button{background:linear-gradient(135deg,#c5a059,#f1dca7);color:#050505;border:none;padding:8px 18px;border-radius:6px;font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;font-family:ui-monospace,monospace}';
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.id = 'iisCookieI18N';
  el.innerHTML = '<p>' + t.text + ' <a href="/privacy">' + t.learn + '</a></p><button id="iisCookieOK">' + t.accept + '</button>';
  document.body.appendChild(el);
  document.getElementById('iisCookieOK').onclick = function () {
    try { localStorage.setItem('iis_cookie_consent', '1'); } catch {}
    el.remove();
  };
})();
