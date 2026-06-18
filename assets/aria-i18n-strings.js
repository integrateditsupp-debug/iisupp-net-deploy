/*!
 * aria-i18n-strings.js — Full ARIA UI string table for 5 locales
 *  Use: window.ariaI18N.get('greeting') -> 'Hi! How can I help?' in user locale
 *  Locale priority: ?lang= URL param > localStorage('aria_lang') > navigator.language > 'en'
 *  Cat 8 — Localization. Expanded from form-strings stub to full ARIA chat surface.
 */
(function () {
  'use strict';
  if (window.ariaI18N) return;

  var STRINGS = {
    en: {
      // ARIA chat
      greeting: 'Hi — I am ARIA, your AI IT assistant. What is going on?',
      placeholder: 'Type your question or paste an error message',
      send: 'Send',
      voice_listening: 'Listening...',
      voice_processing: 'Thinking...',
      thinking: 'ARIA is thinking',
      low_confidence: 'I am not fully sure on this one. Want me to escalate to a human technician?',
      degraded: 'I am having a moment connecting to my reasoning brain. Try again in a few seconds.',
      escalate: 'Get a human',
      resolved: 'Glad that worked. Anything else?',
      no_match: 'I do not have this one in my playbook yet. Let me research and log it.',
      // Onboarding
      onboard_title: 'Before we troubleshoot',
      onboard_lead: 'ARIA will create a ticket and email you a session report. 20 seconds. Required.',
      onboard_first: 'First name *',
      onboard_last: 'Last name *',
      onboard_email: 'Email *',
      onboard_phone: 'Phone *',
      onboard_company: 'Company (optional)',
      onboard_license: 'License / Account # (optional)',
      onboard_cta: 'Start troubleshooting',
      onboard_consent: 'Your info is used only for this ticket and session report.',
      // Trial
      trial_remaining: 'Trial: {min}m {sec}s remaining',
      trial_expired: 'Your 15-minute trial is up. Upgrade to keep ARIA on call.',
      // Plans page
      plans_personal: 'Personal',
      plans_pro: 'Pro',
      plans_smb: 'Small Business',
      plans_per_month: '/month',
      plans_per_year: '/year',
      // Common
      close: 'Close',
      cancel: 'Cancel',
      yes: 'Yes',
      no: 'No',
      retry: 'Retry',
      contact_human: 'Contact human'
    },
    fr: {
      greeting: 'Bonjour — je suis ARIA, votre assistant TI IA. Quel est le souci?',
      placeholder: 'Tapez votre question ou collez un message d\'erreur',
      send: 'Envoyer',
      voice_listening: 'En écoute...',
      voice_processing: 'Réflexion...',
      thinking: 'ARIA réfléchit',
      low_confidence: 'Je ne suis pas tout à fait sûr. Voulez-vous escalader vers un technicien?',
      degraded: 'Je rencontre un souci de connexion. Réessayez dans quelques secondes.',
      escalate: 'Parler à un humain',
      resolved: 'Heureux que cela ait fonctionné. Autre chose?',
      no_match: 'Je n\'ai pas encore ce cas dans mon manuel. Je vais chercher et l\'enregistrer.',
      onboard_title: 'Avant de dépanner',
      onboard_lead: 'ARIA créera un ticket et vous enverra un rapport de session par courriel. 20 secondes. Obligatoire.',
      onboard_first: 'Prénom *',
      onboard_last: 'Nom *',
      onboard_email: 'Courriel *',
      onboard_phone: 'Téléphone *',
      onboard_company: 'Entreprise (facultatif)',
      onboard_license: 'Licence / N° de compte (facultatif)',
      onboard_cta: 'Commencer le dépannage',
      onboard_consent: 'Vos renseignements servent uniquement à ce ticket et au rapport de session.',
      trial_remaining: 'Essai : {min}m {sec}s restantes',
      trial_expired: 'Votre essai de 15 minutes est terminé. Passez à un abonnement pour continuer.',
      plans_personal: 'Personnel',
      plans_pro: 'Pro',
      plans_smb: 'Petite entreprise',
      plans_per_month: '/mois',
      plans_per_year: '/an',
      close: 'Fermer',
      cancel: 'Annuler',
      yes: 'Oui',
      no: 'Non',
      retry: 'Réessayer',
      contact_human: 'Contacter un humain'
    },
    es: {
      greeting: 'Hola — soy ARIA, tu asistente de TI con IA. Qué está pasando?',
      placeholder: 'Escribe tu pregunta o pega un mensaje de error',
      send: 'Enviar',
      voice_listening: 'Escuchando...',
      voice_processing: 'Pensando...',
      thinking: 'ARIA está pensando',
      low_confidence: 'No estoy completamente seguro. Quieres que escale a un técnico humano?',
      degraded: 'Tengo un problema de conexión. Inténtalo de nuevo en unos segundos.',
      escalate: 'Contactar un humano',
      resolved: 'Me alegra que funcionó. Algo más?',
      no_match: 'Aún no tengo este caso. Voy a investigar y registrarlo.',
      onboard_title: 'Antes de diagnosticar',
      onboard_lead: 'ARIA creará un ticket y te enviará un reporte. 20 segundos. Requerido.',
      onboard_first: 'Nombre *',
      onboard_last: 'Apellido *',
      onboard_email: 'Correo *',
      onboard_phone: 'Teléfono *',
      onboard_company: 'Empresa (opcional)',
      onboard_license: 'Licencia / N. de cuenta (opcional)',
      onboard_cta: 'Comenzar diagnóstico',
      onboard_consent: 'Tu información se usa solo para este ticket y reporte.',
      trial_remaining: 'Prueba: {min}m {sec}s restantes',
      trial_expired: 'Tu prueba de 15 minutos terminó. Actualiza para mantener ARIA disponible.',
      plans_personal: 'Personal',
      plans_pro: 'Pro',
      plans_smb: 'Pequeña empresa',
      plans_per_month: '/mes',
      plans_per_year: '/año',
      close: 'Cerrar',
      cancel: 'Cancelar',
      yes: 'Sí',
      no: 'No',
      retry: 'Reintentar',
      contact_human: 'Contactar humano'
    },
    de: {
      greeting: 'Hallo — ich bin ARIA, dein KI-IT-Assistent. Was ist los?',
      placeholder: 'Tippe deine Frage oder füge eine Fehlermeldung ein',
      send: 'Senden',
      voice_listening: 'Höre zu...',
      voice_processing: 'Denke nach...',
      thinking: 'ARIA denkt nach',
      low_confidence: 'Bin nicht ganz sicher. Soll ich an einen Techniker eskalieren?',
      degraded: 'Ich habe gerade Verbindungsprobleme. Versuche es in ein paar Sekunden erneut.',
      escalate: 'Mit einem Menschen sprechen',
      resolved: 'Freut mich, dass es geklappt hat. Sonst noch was?',
      no_match: 'Diesen Fall habe ich noch nicht. Ich recherchiere und protokolliere ihn.',
      onboard_title: 'Vor der Fehlersuche',
      onboard_lead: 'ARIA erstellt ein Ticket und sendet einen Sitzungsbericht per E-Mail. 20 Sekunden. Erforderlich.',
      onboard_first: 'Vorname *',
      onboard_last: 'Nachname *',
      onboard_email: 'E-Mail *',
      onboard_phone: 'Telefon *',
      onboard_company: 'Firma (optional)',
      onboard_license: 'Lizenz / Kontonummer (optional)',
      onboard_cta: 'Fehlersuche starten',
      onboard_consent: 'Deine Daten werden nur für dieses Ticket und den Bericht verwendet.',
      trial_remaining: 'Test: {min}m {sec}s übrig',
      trial_expired: 'Dein 15-Minuten-Test ist vorbei. Upgrade, um ARIA weiter zu nutzen.',
      plans_personal: 'Persönlich',
      plans_pro: 'Pro',
      plans_smb: 'Kleines Unternehmen',
      plans_per_month: '/Monat',
      plans_per_year: '/Jahr',
      close: 'Schließen',
      cancel: 'Abbrechen',
      yes: 'Ja',
      no: 'Nein',
      retry: 'Wiederholen',
      contact_human: 'Mensch kontaktieren'
    },
    ar: {
      greeting: 'مرحبا — أنا ARIA، مساعد الذكاء الاصطناعي لتقنية المعلومات. ما المشكلة؟',
      placeholder: 'اكتب سؤالك أو الصق رسالة الخطأ',
      send: 'إرسال',
      voice_listening: 'استماع...',
      voice_processing: 'تفكير...',
      thinking: 'ARIA يفكر',
      low_confidence: 'لست متأكدا تماما. هل تريد التصعيد إلى فني بشري؟',
      degraded: 'أواجه مشكلة اتصال. حاول مرة أخرى بعد بضع ثوان.',
      escalate: 'التواصل مع شخص',
      resolved: 'سعيد بنجاح ذلك. أي شيء آخر؟',
      no_match: 'لم أصادف هذا الحالة بعد. سأبحث وأسجلها.',
      onboard_title: 'قبل أن نبدأ',
      onboard_lead: 'ستنشئ ARIA تذكرة وترسل تقرير الجلسة عبر البريد. 20 ثانية. إلزامي.',
      onboard_first: 'الاسم الأول *',
      onboard_last: 'اسم العائلة *',
      onboard_email: 'البريد الإلكتروني *',
      onboard_phone: 'الهاتف *',
      onboard_company: 'الشركة (اختياري)',
      onboard_license: 'رخصة / رقم الحساب (اختياري)',
      onboard_cta: 'ابدأ التشخيص',
      onboard_consent: 'تستخدم معلوماتك فقط لهذه التذكرة والتقرير.',
      trial_remaining: 'التجربة: {min}د {sec}ث متبقية',
      trial_expired: 'انتهت تجربتك المجانية. الترقية للاستمرار.',
      plans_personal: 'شخصي',
      plans_pro: 'احترافي',
      plans_smb: 'الأعمال الصغيرة',
      plans_per_month: '/شهر',
      plans_per_year: '/سنة',
      close: 'إغلاق',
      cancel: 'إلغاء',
      yes: 'نعم',
      no: 'لا',
      retry: 'إعادة المحاولة',
      contact_human: 'التواصل مع شخص'
    }
  };

  function pickLocale() {
    try {
      var p = new URLSearchParams(location.search);
      var q = p.get('lang');
      if (q && STRINGS[q.toLowerCase()]) return q.toLowerCase();
      var l = localStorage.getItem('aria_lang');
      if (l && STRINGS[l]) return l;
      var nav = (navigator.language || 'en').toLowerCase().split('-')[0];
      return STRINGS[nav] ? nav : 'en';
    } catch (e) { return 'en'; }
  }

  var loc = pickLocale();
  var T = STRINGS[loc] || STRINGS.en;

  // RTL handling for Arabic
  if (loc === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  } else {
    document.documentElement.setAttribute('lang', loc);
  }

  window.ariaI18N = {
    locale: loc,
    get: function (key, vars) {
      var s = T[key] || STRINGS.en[key] || key;
      if (vars) {
        for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
      }
      return s;
    },
    setLocale: function (newLoc) {
      if (!STRINGS[newLoc]) return false;
      try { localStorage.setItem('aria_lang', newLoc); } catch {}
      location.reload();
      return true;
    },
    available: Object.keys(STRINGS)
  };
})();
