/*!
 * aria-i18n-page-copy.js - localized page copy bridge for homepage, plans, and scorecard.
 * It only applies when a supported non-English locale is selected.
 */
(function () {
  'use strict';

  var STRINGS = {
    fr: {
      home_title: 'Services TI distingues pour les equipes modernes',
      plans_tag: 'CHOISISSEZ VOTRE ARIA',
      plans_title: 'Forfaits concus pour chaque etape',
      plans_sub: 'Commencez gratuitement sur ce site pendant 15 minutes. Choisissez le forfait adapte a votre equipe.',
      scorecard_crown: 'Integrated IT Support - Scorecard gratuit',
      scorecard_title: 'Scorecard de preparation IA',
      scorecard_sub: '12 questions - 2 minutes - obtenez un score de 0 a 100 et une liste dactions.'
    },
    es: {
      home_title: 'Servicios de TI distinguidos para equipos modernos',
      plans_tag: 'ELIGE TU ARIA',
      plans_title: 'Planes creados para cada etapa',
      plans_sub: 'Comienza gratis durante 15 minutos. Elige el plan que coincide con tu equipo.',
      scorecard_crown: 'Integrated IT Support - Scorecard gratis',
      scorecard_title: 'Scorecard de preparacion para IA',
      scorecard_sub: '12 preguntas - 2 minutos - recibe una puntuacion de 0 a 100 y acciones claras.'
    },
    de: {
      home_title: 'Ausgezeichnete IT-Services fuer moderne Teams',
      plans_tag: 'WAEHLE DEIN ARIA',
      plans_title: 'Plaene fuer jede Phase',
      plans_sub: 'Starte 15 Minuten kostenlos. Waehle den Plan, der zu deinem Team passt.',
      scorecard_crown: 'Integrated IT Support - Kostenloser Scorecard',
      scorecard_title: 'KI-Bereitschafts-Scorecard',
      scorecard_sub: '12 Fragen - 2 Minuten - erhalte einen Score von 0 bis 100 und klare naechste Schritte.'
    },
    ar: {
      home_title: 'خدمات تقنية معلومات مميزة للفرق الحديثة',
      plans_tag: 'اختر ARIA',
      plans_title: 'خطط لكل مرحلة',
      plans_sub: 'ابدأ مجانا لمدة 15 دقيقة واختر الخطة المناسبة لفريقك.',
      scorecard_crown: 'Integrated IT Support - تقييم مجاني',
      scorecard_title: 'تقييم جاهزية الذكاء الاصطناعي',
      scorecard_sub: '12 سؤالا في دقيقتين للحصول على نتيجة وخطوات تالية.'
    }
  };

  function locale() {
    try {
      var urlLocale = new URLSearchParams(location.search).get('lang');
      var stored = localStorage.getItem('aria_lang');
      var nav = (navigator.language || 'en').toLowerCase().split('-')[0];
      var loc = (urlLocale || stored || nav || 'en').toLowerCase().split('-')[0];
      return STRINGS[loc] ? loc : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function setText(selector, text) {
    var node = document.querySelector(selector);
    if (node && text) node.textContent = text;
  }

  function apply() {
    var loc = locale();
    if (loc === 'en') return;
    var t = STRINGS[loc];
    if (loc === 'ar') document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', loc);

    var path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/') {
      document.title = t.home_title + ' | Integrated IT Support';
      setText('h1', t.home_title);
    }
    if (path === '/plans') {
      setText('.pf-tag', t.plans_tag);
      setText('main h1', t.plans_title);
      setText('main h1 + p', t.plans_sub);
    }
    if (path === '/scorecard.html' || path === '/scorecard') {
      setText('.crown', t.scorecard_crown);
      setText('h1', t.scorecard_title);
      setText('.sub', t.scorecard_sub);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
