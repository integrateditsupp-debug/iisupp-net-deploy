/*!
 * aria-page-i18n.js — Drop-in page-level i18n
 *  Reads ?lang= or stored locale, applies translations to elements with data-i18n attrs.
 *  Provides a floating language picker (bottom-right) that flips locale + reloads.
 *  Also auto-translates document.title via data-i18n-title meta tag.
 *  Depends on aria-i18n-strings.js (loaded first if available).
 *  Cat 8 — Localization.
 */
(function(){
  'use strict';
  if (window.__iisPageI18N) return;
  window.__iisPageI18N = true;

  function getLocale() {
    try {
      var p = new URLSearchParams(location.search);
      var q = p.get('lang');
      if (q && /^[a-z]{2}$/i.test(q)) return q.toLowerCase();
      var l = localStorage.getItem('aria_lang');
      if (l) return l;
      var nav = (navigator.language || 'en').toLowerCase().split('-')[0];
      return nav;
    } catch { return 'en'; }
  }
  var loc = getLocale();
  var SUPPORTED = ['en','fr','es','de','ar','zh','ur','hi','pt','ja','ko','ru','it'];
  if (SUPPORTED.indexOf(loc) === -1) loc = 'en';

  // Resolve a translation string. Prefer ariaI18N if available, else inline map.
  function t(key) {
    if (window.ariaI18N && window.ariaI18N.get) return window.ariaI18N.get(key);
    return INLINE_FALLBACK[loc] && INLINE_FALLBACK[loc][key] || INLINE_FALLBACK.en[key] || key;
  }

  // Lightweight fallback for the most common page elements.
  // Pages can extend this by adding window.__iisI18NExtra = { en:{key:val}, fr:{...} } before this script loads.
  var INLINE_FALLBACK = {
    en: { try_aria:'Try ARIA — 15 min free', home:'Home', pricing:'Pricing', back:'Back', next:'Next', close:'Close', submit:'Submit', loading:'Loading', see_score:'See my score', email_report:'Email me the full report', try_again:'Try again', start:'Start' },
    fr: { try_aria:'Essayer ARIA — 15 min gratuit', home:'Accueil', pricing:'Tarifs', back:'Précédent', next:'Suivant', close:'Fermer', submit:'Soumettre', loading:'Chargement', see_score:'Voir mon score', email_report:'Recevoir le rapport par courriel', try_again:'Réessayer', start:'Commencer' },
    es: { try_aria:'Probar ARIA — 15 min gratis', home:'Inicio', pricing:'Precios', back:'Atrás', next:'Siguiente', close:'Cerrar', submit:'Enviar', loading:'Cargando', see_score:'Ver mi puntaje', email_report:'Enviarme el reporte completo', try_again:'Reintentar', start:'Comenzar' },
    de: { try_aria:'ARIA testen — 15 min kostenlos', home:'Startseite', pricing:'Preise', back:'Zurück', next:'Weiter', close:'Schließen', submit:'Absenden', loading:'Laden', see_score:'Mein Ergebnis sehen', email_report:'Vollständigen Bericht per E-Mail', try_again:'Erneut versuchen', start:'Starten' },
    ar: { try_aria:'جرّب ARIA — 15 دقيقة مجانًا', home:'الرئيسية', pricing:'الأسعار', back:'رجوع', next:'التالي', close:'إغلاق', submit:'إرسال', loading:'جارٍ التحميل', see_score:'شاهد نتيجتي', email_report:'أرسل لي التقرير كاملاً', try_again:'حاول مجددًا', start:'ابدأ' },
    zh: { try_aria:'试用 ARIA — 免费 15 分钟', home:'首页', pricing:'价格', back:'返回', next:'下一步', close:'关闭', submit:'提交', loading:'加载中', see_score:'查看我的得分', email_report:'发送完整报告到邮箱', try_again:'重试', start:'开始' },
    ur: { try_aria:'ARIA آزمائیں — 15 منٹ مفت', home:'ہوم', pricing:'قیمت', back:'پیچھے', next:'آگے', close:'بند کریں', submit:'جمع کرائیں', loading:'لوڈ ہو رہا ہے', see_score:'میرا اسکور دیکھیں', email_report:'مکمل رپورٹ ای میل کریں', try_again:'دوبارہ کوشش', start:'شروع' },
    hi: { try_aria:'ARIA आज़माएँ — मुफ़्त 15 मिनट', home:'होम', pricing:'मूल्य', back:'वापस', next:'आगे', close:'बंद करें', submit:'जमा करें', loading:'लोड हो रहा है', see_score:'मेरा स्कोर देखें', email_report:'पूरी रिपोर्ट ईमेल करें', try_again:'फिर से कोशिश', start:'शुरू' },
    pt: { try_aria:'Testar ARIA — 15 min grátis', home:'Início', pricing:'Preços', back:'Voltar', next:'Próximo', close:'Fechar', submit:'Enviar', loading:'Carregando', see_score:'Ver minha pontuação', email_report:'Enviar relatório completo por e-mail', try_again:'Tentar novamente', start:'Começar' },
    ja: { try_aria:'ARIAを試す — 15分無料', home:'ホーム', pricing:'料金', back:'戻る', next:'次へ', close:'閉じる', submit:'送信', loading:'読み込み中', see_score:'スコアを見る', email_report:'完全なレポートをメール送信', try_again:'再試行', start:'開始' },
    ko: { try_aria:'ARIA 사용해 보기 — 15분 무료', home:'홈', pricing:'가격', back:'뒤로', next:'다음', close:'닫기', submit:'제출', loading:'로딩 중', see_score:'점수 보기', email_report:'전체 보고서 이메일로 받기', try_again:'재시도', start:'시작' },
    ru: { try_aria:'Попробовать ARIA — 15 мин бесплатно', home:'Главная', pricing:'Цены', back:'Назад', next:'Далее', close:'Закрыть', submit:'Отправить', loading:'Загрузка', see_score:'Показать мой результат', email_report:'Прислать полный отчёт', try_again:'Повторить', start:'Начать' },
    it: { try_aria:'Prova ARIA — 15 min gratis', home:'Home', pricing:'Prezzi', back:'Indietro', next:'Avanti', close:'Chiudi', submit:'Invia', loading:'Caricamento', see_score:'Vedi il mio punteggio', email_report:'Inviami il report completo', try_again:'Riprova', start:'Inizia' }
  };

  // Merge any page-specific extras
  if (window.__iisI18NExtra && typeof window.__iisI18NExtra === 'object') {
    Object.keys(window.__iisI18NExtra).forEach(function(lang){
      INLINE_FALLBACK[lang] = Object.assign({}, INLINE_FALLBACK[lang] || {}, window.__iisI18NExtra[lang]);
    });
  }

  // Apply HTML attrs (lang + dir for RTL)
  document.documentElement.setAttribute('lang', loc);
  if (loc === 'ar' || loc === 'ur') document.documentElement.setAttribute('dir', 'rtl');

  function applyTranslations(){
    var nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(function(n){
      var key = n.getAttribute('data-i18n');
      var val = t(key);
      if (val && val !== key) n.textContent = val;
    });
    // attr-based: data-i18n-placeholder, data-i18n-title, data-i18n-aria-label
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(n){
      var v = t(n.getAttribute('data-i18n-placeholder'));
      if (v) n.setAttribute('placeholder', v);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function(n){
      var v = t(n.getAttribute('data-i18n-title'));
      if (v) n.setAttribute('title', v);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function(n){
      var v = t(n.getAttribute('data-i18n-aria-label'));
      if (v) n.setAttribute('aria-label', v);
    });
    // Document title
    var titleMeta = document.querySelector('meta[name="i18n-title-key"]');
    if (titleMeta) {
      var v = t(titleMeta.getAttribute('content'));
      if (v) document.title = v + ' — IIS';
    }
  }

  // Language picker — floating bottom-right
  function injectPicker(){
    if (document.getElementById('iisLangPicker')) return;
    var sel = document.createElement('div');
    sel.id = 'iisLangPicker';
    sel.style.cssText = 'position:fixed;bottom:18px;right:18px;background:#0a0a0a;border:1px solid rgba(197,160,89,.45);border-radius:999px;padding:5px;display:flex;gap:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;z-index:99998;box-shadow:0 8px 24px rgba(0,0,0,.4);';
    SUPPORTED.forEach(function(l){
      var btn = document.createElement('button');
      btn.textContent = l.toUpperCase();
      btn.style.cssText = 'background:' + (l === loc ? 'linear-gradient(135deg,#c5a059,#f1dca7)' : 'transparent') + ';color:' + (l === loc ? '#050505' : '#aaa') + ';border:none;border-radius:999px;padding:6px 11px;cursor:pointer;font-family:inherit;font-size:inherit;letter-spacing:inherit;font-weight:600;';
      btn.onclick = function(){
        try { localStorage.setItem('aria_lang', l); } catch {}
        var u = new URL(location.href); u.searchParams.set('lang', l); location.href = u.toString();
      };
      sel.appendChild(btn);
    });
    document.body.appendChild(sel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ applyTranslations(); injectPicker(); });
  } else {
    applyTranslations(); injectPicker();
  }
  window.iisPageI18N = { applyTranslations: applyTranslations, locale: loc };
})();
