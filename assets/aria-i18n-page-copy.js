/*!
 * aria-i18n-page-copy.js - localized page copy bridge for core ARIA conversion pages.
 * Applies only when a supported non-English locale is selected by URL, localStorage, or browser language.
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
      scorecard_sub: '12 questions - 2 minutes - obtenez un score de 0 a 100 et une liste dactions.',
      aria_title: 'Assistant technique ARIA',
      aria_topbar: 'ARIA par Integrated IT Support',
      account_title: 'Compte ARIA',
      account_sub: 'Gerez les sieges, la facturation, les factures et les demandes de support depuis un seul endroit.',
      analytics_title: 'Analytique ARIA',
      analytics_sub: 'Suivez usage, deflexion, SLA et signaux revenus par client.',
      tenant_title: 'Administration client ARIA',
      tenant_sub: 'Configurez roles, acces, domaines, SCIM et politiques par client.',
      partner_title: 'Verification partenaire ARIA',
      partner_sub: 'Preparez les brouillons Microsoft et AWS sans soumettre avant le feu vert CEO.',
      screenshare_title: 'Consentement au partage ecran ARIA',
      screenshare_sub: 'Confirmez consentement, enregistrement et controle distant avant toute session live.',
      platform_title: 'Preparation plateforme ARIA',
      platform_sub: 'Mesurez les derniers blocages CEO et fournisseur sans exposer de secrets ni declencher dactions externes.'
    },
    es: {
      home_title: 'Servicios de TI distinguidos para equipos modernos',
      plans_tag: 'ELIGE TU ARIA',
      plans_title: 'Planes creados para cada etapa',
      plans_sub: 'Comienza gratis durante 15 minutos. Elige el plan que coincide con tu equipo.',
      scorecard_crown: 'Integrated IT Support - Scorecard gratis',
      scorecard_title: 'Scorecard de preparacion para IA',
      scorecard_sub: '12 preguntas - 2 minutos - recibe una puntuacion de 0 a 100 y acciones claras.',
      aria_title: 'Asistente tecnico ARIA',
      aria_topbar: 'ARIA de Integrated IT Support',
      account_title: 'Cuenta ARIA',
      account_sub: 'Gestiona asientos, facturacion, facturas y solicitudes de soporte en un solo lugar.',
      analytics_title: 'Analitica ARIA',
      analytics_sub: 'Mide uso, desvio, SLA y senales de ingresos por cliente.',
      tenant_title: 'Administracion de clientes ARIA',
      tenant_sub: 'Configura roles, acceso, dominios, SCIM y politicas por cliente.',
      partner_title: 'Verificador de socios ARIA',
      partner_sub: 'Prepara borradores de Microsoft y AWS sin enviar hasta la aprobacion del CEO.',
      screenshare_title: 'Consentimiento de pantalla ARIA',
      screenshare_sub: 'Confirma pantalla, grabacion y control remoto antes de una sesion en vivo.',
      platform_title: 'Preparacion de plataforma ARIA',
      platform_sub: 'Mide los ultimos bloqueos de CEO y proveedor sin exponer secretos ni ejecutar acciones externas.'
    },
    de: {
      home_title: 'Ausgezeichnete IT-Services fuer moderne Teams',
      plans_tag: 'WAEHLE DEIN ARIA',
      plans_title: 'Plaene fuer jede Phase',
      plans_sub: 'Starte 15 Minuten kostenlos. Waehle den Plan, der zu deinem Team passt.',
      scorecard_crown: 'Integrated IT Support - Kostenloser Scorecard',
      scorecard_title: 'KI-Bereitschafts-Scorecard',
      scorecard_sub: '12 Fragen - 2 Minuten - erhalte einen Score von 0 bis 100 und klare naechste Schritte.',
      aria_title: 'ARIA technischer Assistent',
      aria_topbar: 'ARIA von Integrated IT Support',
      account_title: 'ARIA Konto',
      account_sub: 'Verwalte Sitze, Abrechnung, Rechnungen und Supportanfragen an einem Ort.',
      analytics_title: 'ARIA Analytik',
      analytics_sub: 'Verfolge Nutzung, Deflection, SLA und Umsatzsignale je Kunde.',
      tenant_title: 'ARIA Mandantenverwaltung',
      tenant_sub: 'Konfiguriere Rollen, Zugriff, Domains, SCIM und Richtlinien je Mandant.',
      partner_title: 'ARIA Partnerpruefung',
      partner_sub: 'Bereite Microsoft- und AWS-Entwuerfe vor, ohne vor CEO-Freigabe zu senden.',
      screenshare_title: 'ARIA Bildschirmfreigabe-Zustimmung',
      screenshare_sub: 'Bestaetige Bildschirmfreigabe, Aufnahme und Fernsteuerung vor jeder Live-Sitzung.',
      platform_title: 'ARIA Plattformbereitschaft',
      platform_sub: 'Miss die letzten CEO- und Provider-Blocker, ohne Secrets offenzulegen oder externe Aktionen auszufuehren.'
    },
    ar: {
      home_title: '\u062e\u062f\u0645\u0627\u062a \u062a\u0642\u0646\u064a\u0629 \u0645\u0645\u064a\u0632\u0629 \u0644\u0644\u0641\u0631\u0642 \u0627\u0644\u062d\u062f\u064a\u062b\u0629',
      plans_tag: '\u0627\u062e\u062a\u0631 ARIA',
      plans_title: '\u062e\u0637\u0637 \u0644\u0643\u0644 \u0645\u0631\u062d\u0644\u0629',
      plans_sub: '\u0627\u0628\u062f\u0623 \u0645\u062c\u0627\u0646\u0627 \u0644\u0645\u062f\u0629 15 \u062f\u0642\u064a\u0642\u0629 \u0648\u0627\u062e\u062a\u0631 \u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u0641\u0631\u064a\u0642\u0643.',
      scorecard_crown: 'Integrated IT Support - \u062a\u0642\u064a\u064a\u0645 \u0645\u062c\u0627\u0646\u064a',
      scorecard_title: '\u062a\u0642\u064a\u064a\u0645 \u062c\u0627\u0647\u0632\u064a\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
      scorecard_sub: '12 \u0633\u0624\u0627\u0644\u0627 \u0641\u064a \u062f\u0642\u064a\u0642\u062a\u064a\u0646 \u0644\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629 \u0648\u062e\u0637\u0648\u0627\u062a \u062a\u0627\u0644\u064a\u0629.',
      aria_title: '\u0645\u0633\u0627\u0639\u062f ARIA \u0627\u0644\u062a\u0642\u0646\u064a',
      aria_topbar: 'ARIA \u0645\u0646 Integrated IT Support',
      account_title: '\u062d\u0633\u0627\u0628 ARIA',
      account_sub: '\u0627\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0642\u0627\u0639\u062f \u0648\u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0648\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062f\u0639\u0645 \u0641\u064a \u0645\u0643\u0627\u0646 \u0648\u0627\u062d\u062f.',
      analytics_title: '\u062a\u062d\u0644\u064a\u0644\u0627\u062a ARIA',
      analytics_sub: '\u062a\u062a\u0628\u0639 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0648\u0645\u0624\u0634\u0631\u0627\u062a SLA \u0648\u0627\u0644\u0627\u064a\u0631\u0627\u062f \u0644\u0643\u0644 \u0639\u0645\u064a\u0644.',
      tenant_title: '\u0627\u062f\u0627\u0631\u0629 \u0645\u0633\u062a\u0627\u062c\u0631 ARIA',
      tenant_sub: '\u062a\u0643\u0648\u064a\u0646 \u0627\u0644\u0627\u062f\u0648\u0627\u0631 \u0648\u0627\u0644\u0648\u0635\u0648\u0644 \u0648SCIM \u0648\u0627\u0644\u0633\u064a\u0627\u0633\u0627\u062a \u0644\u0643\u0644 \u0639\u0645\u064a\u0644.',
      partner_title: '\u0641\u062d\u0635 \u0634\u0631\u0627\u0643\u0627\u062a ARIA',
      partner_sub: '\u062a\u062d\u0636\u064a\u0631 \u0645\u0633\u0648\u062f\u0627\u062a Microsoft \u0648AWS \u0628\u062f\u0648\u0646 \u0627\u0631\u0633\u0627\u0644 \u0642\u0628\u0644 \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u062f\u064a\u0631.',
      screenshare_title: '\u0645\u0648\u0627\u0641\u0642\u0629 \u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0634\u0627\u0634\u0629',
      screenshare_sub: '\u062a\u0627\u0643\u064a\u062f \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0642\u0628\u0644 \u0627\u064a \u062c\u0644\u0633\u0629 \u062f\u0639\u0645 \u0645\u0628\u0627\u0634\u0631\u0629.',
      platform_title: '\u062c\u0627\u0647\u0632\u064a\u0629 \u0645\u0646\u0635\u0629 ARIA',
      platform_sub: '\u0642\u064a\u0627\u0633 \u0627\u0644\u0628\u0648\u0627\u0628\u0627\u062a \u0627\u0644\u0627\u062e\u064a\u0631\u0629 \u0628\u062f\u0648\u0646 \u0643\u0634\u0641 \u0627\u0633\u0631\u0627\u0631 \u0627\u0648 \u062a\u0646\u0641\u064a\u0630 \u0627\u062c\u0631\u0627\u0621\u0627\u062a \u062e\u0627\u0631\u062c\u064a\u0629.'
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

  function applyFinishPage(t, titleKey, subtitleKey) {
    document.title = t[titleKey] + ' | Integrated IT Support';
    setText('h1', t[titleKey]);
    setText('.f100-hero p', t[subtitleKey]);
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
    if (path === '/aria.html' || path === '/aria') {
      document.title = t.aria_title + ' | Integrated IT Support';
      setText('.topbar', t.aria_topbar);
    }

    var pages = {
      '/account.html': ['account_title', 'account_sub'],
      '/account': ['account_title', 'account_sub'],
      '/analytics.html': ['analytics_title', 'analytics_sub'],
      '/analytics': ['analytics_title', 'analytics_sub'],
      '/tenant-admin.html': ['tenant_title', 'tenant_sub'],
      '/tenant-admin': ['tenant_title', 'tenant_sub'],
      '/partner-application-checker.html': ['partner_title', 'partner_sub'],
      '/partner-application-checker': ['partner_title', 'partner_sub'],
      '/screenshare-consent.html': ['screenshare_title', 'screenshare_sub'],
      '/screenshare-consent': ['screenshare_title', 'screenshare_sub'],
      '/platform-readiness.html': ['platform_title', 'platform_sub'],
      '/platform-readiness': ['platform_title', 'platform_sub']
    };
    if (pages[path]) applyFinishPage(t, pages[path][0], pages[path][1]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
