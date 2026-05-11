/* ══════════════════════════════════════════════════════════════
   ARIA CORE — shared logic for iisupport.net
   - PayPal checkout rendering
   - Premium modal
   - Real response engine (router)
   - Tap-to-speak with silence-detect
   - Reminders with privacy-safe voice
   - PWA install prompt
   All functions attach to window.ARIA namespace.
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const PAYPAL_RECEIVER_EMAIL = "ahmadwasi456@gmail.com"; // legacy, not used
  const STRIPE_CHECKOUT_ENDPOINT = "/.netlify/functions/stripe-checkout";
  const CURRENCY = "USD";

  /* -------------------------------------------------- Premium modal */
  function showPremiumModal(opts) {
    const { title, body, details, source, onClose } = opts || {};
    const existing = document.querySelector(".aria-premium-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "aria-premium-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="aria-modal-backdrop"></div>
      <div class="aria-modal-content" role="document">
        <button class="aria-modal-close" aria-label="Close">×</button>
        <h2 class="aria-modal-title">${escapeHtml(title || "ARIA")}</h2>
        <div class="aria-modal-body">${body || ""}</div>
        ${
          details
            ? `<dl class="aria-modal-details">${Object.entries(details)
                .map(
                  ([k, v]) =>
                    `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(
                      String(v)
                    )}</dd></div>`
                )
                .join("")}</dl>`
            : ""
        }
        ${source ? `<p class="aria-source">Source: ${escapeHtml(source)}</p>` : ""}
        <button class="aria-return-button" type="button">Return</button>
      </div>`;
    document.body.appendChild(modal);
    document.body.classList.add("aria-modal-open");

    const close = () => {
      modal.remove();
      document.body.classList.remove("aria-modal-open");
      if (typeof onClose === "function") onClose();
    };
    modal.querySelector(".aria-modal-close").addEventListener("click", close);
    modal.querySelector(".aria-return-button").addEventListener("click", close);
    modal.querySelector(".aria-modal-backdrop").addEventListener("click", close);
    document.addEventListener(
      "keydown",
      function escListener(e) {
        if (e.key === "Escape") {
          close();
          document.removeEventListener("keydown", escListener);
        }
      }
    );
    return { close };
  }

  /* -------------------------------------------------- PayPal */
  function paypalReady() {
    return typeof window.paypal !== "undefined" && window.paypal.Buttons;
  }

  function renderPayPal(container, plan) {
    if (!container) return;
    container.innerHTML = "";
    if (!paypalReady()) {
      // Fallback — Paypal.me link with plan name + amount prefilled.
      const link = document.createElement("a");
      link.className = "aria-paypal-fallback";
      link.target = "_blank";
      link.rel = "noopener";
      link.href = `https://www.paypal.com/paypalme/?amount=${encodeURIComponent(
        plan.price
      )}&currency=${CURRENCY}&note=${encodeURIComponent(plan.name)}`;
      link.textContent = `Pay ${plan.price} ${CURRENCY} via PayPal →`;
      link.dataset.paypalPlaceholder = "true";
      container.appendChild(link);
      const note = document.createElement("div");
      note.className = "aria-paypal-note";
      note.textContent =
        "PayPal SDK not loaded — configure PAYPAL_CLIENT_ID to enable in-page checkout.";
      container.appendChild(note);
      return;
    }

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "gold",
          shape: "pill",
          label: "paypal",
        },
        createOrder: function (_data, actions) {
          return actions.order.create({
            purchase_units: [
              {
                description: plan.description || plan.name,
                payee: { email_address: PAYPAL_RECEIVER_EMAIL },
                amount: { currency_code: CURRENCY, value: plan.price },
                custom_id: plan.id,
              },
            ],
            application_context: {
              brand_name: "Integrated IT Support",
              shipping_preference: "NO_SHIPPING",
            },
          });
        },
        onApprove: function (_data, actions) {
          return actions.order.capture().then(function (details) {
            showPaymentSuccess(plan, details);
          });
        },
        onCancel: function () {
          showPremiumModal({
            title: "Payment cancelled",
            body: "<p>No problem — you can return anytime. Nothing was charged.</p>",
          });
        },
        onError: function (err) {
          console.error("PayPal error", err);
          showPremiumModal({
            title: "Checkout unavailable",
            body: "<p>PayPal could not complete the request. Try again or contact Integrated IT Support at <a href='mailto:integrateditsupp@gmail.com'>integrateditsupp@gmail.com</a>.</p>",
          });
        },
      })
      .render(container)
      .catch(function (err) {
        console.error("PayPal render failed", err);
      });
  }

  function confirmAndRenderPayPal(container, plan) {
    if (!container) return;
    container.innerHTML = `
      <button type="button" class="aria-buy-trigger">Purchase · ${escapeHtml(
        plan.name
      )} — $${escapeHtml(plan.price)} ${CURRENCY}</button>
      <p class="aria-pay-disclaimer">Secure checkout via Stripe. Cancel anytime.</p>`;
    container.querySelector(".aria-buy-trigger").addEventListener("click", function () {
      const confirm = showPremiumModal({
        title: `Confirm: ${plan.name}`,
        body: `
          <p>You are about to subscribe to <b>${escapeHtml(
            plan.name
          )}</b> at <b>$${escapeHtml(plan.price)} ${CURRENCY}</b>.</p>
          <p>You'll be redirected to Stripe to complete payment securely. After payment, ARIA will activate immediately.</p>
          <div class="aria-confirm-row">
            <button type="button" class="aria-confirm-proceed">Continue to Stripe</button>
            <button type="button" class="aria-confirm-cancel">Cancel</button>
          </div>`,
      });
      const root = document.querySelector(".aria-premium-modal");
      if (!root) return;
      root.querySelector(".aria-confirm-cancel").addEventListener("click", () => confirm.close());
      root.querySelector(".aria-confirm-proceed").addEventListener("click", async function () {
        const btn = this;
        btn.disabled = true;
        btn.textContent = "Loading…";
        try {
          const res = await fetch(STRIPE_CHECKOUT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tier: plan.id, planName: plan.name, price: plan.price })
          });
          const data = await res.json();
          if (data && data.url) {
            window.location.href = data.url;
          } else {
            btn.disabled = false;
            btn.textContent = "Continue to Stripe";
            alert(data && data.error ? data.error : "Could not start checkout. Please try again or call (647) 581-3182.");
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "Continue to Stripe";
          alert("Network issue. Please try again or call (647) 581-3182.");
        }
      });
    });
  }

  function showPaymentSuccess(plan, details) {
    const given = details && details.payer && details.payer.name && details.payer.name.given_name;
    showPremiumModal({
      title: "Payment received",
      body: `<p>Thank you${given ? `, <b>${escapeHtml(given)}</b>` : ""}. Payment received — Integrated IT Support will contact you shortly to confirm scope and next steps.</p>`,
      details: {
        Plan: plan.name,
        Amount: `$${plan.price} ${CURRENCY}`,
        "Order ID": (details && details.id) || "pending",
      },
    });
    sendPaymentDetails({
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      currency: CURRENCY,
      payer: details && details.payer,
      orderId: details && details.id,
      pageSource: location.pathname,
    });
  }

  async function sendPaymentDetails(data) {
    try {
      await fetch("/.netlify/functions/payment-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error("Payment notification failed", err);
    }
  }

  /* -------------------------------------------------- Speech (tap-to-speak) */
  const speech = {
    recognition: null,
    silenceTimer: null,
    hangGuard: null,
    isListening: false,
    isSpeaking: false,
    finalTranscript: "",
    onStart: null,
    onEnd: null,
    onInterim: null,
    onResult: null,
    onStateChange: null,
    lastActivityTime: 0,
    restartAttempts: 0,
  };

  function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    speech.recognition = new SR();
    speech.recognition.continuous = false;
    speech.recognition.interimResults = true;
    speech.recognition.lang = "en-CA";
    speech.recognition.maxAlternatives = 1;

    speech.recognition.onstart = () => {
      speech.isListening = true;
      speech.finalTranscript = "";
      speech.lastActivityTime = Date.now();
      speech.restartAttempts = 0;
      if (speech.onStart) speech.onStart();
      if (speech.onStateChange) speech.onStateChange("listening");
      startHangGuard();
    };

    speech.recognition.onresult = (event) => {
      clearTimeout(speech.silenceTimer);
      speech.lastActivityTime = Date.now();
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          speech.finalTranscript += t + " ";
        } else {
          interim += t;
        }
      }
      if (speech.onInterim) speech.onInterim(speech.finalTranscript + interim);
      speech.silenceTimer = setTimeout(() => {
        finishListening();
      }, 1800);
    };

    speech.recognition.onerror = (e) => {
      console.warn("SpeechRecognition error", e.error);
      clearTimeout(speech.silenceTimer);
      clearTimeout(speech.hangGuard);
      if (e.error === "no-speech" && speech.restartAttempts < 2) {
        speech.restartAttempts++;
        try { speech.recognition.start(); } catch (_) { cleanupListening(); }
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        if (speech.onStateChange) speech.onStateChange("denied");
      }
      cleanupListening();
    };

    speech.recognition.onend = () => {
      clearTimeout(speech.hangGuard);
      if (speech.isListening && !speech.finalTranscript.trim() && speech.restartAttempts < 2) {
        speech.restartAttempts++;
        try { speech.recognition.start(); return; } catch (_) { /* fall through */ }
      }
      cleanupListening();
    };
    return true;
  }

  function startHangGuard() {
    clearTimeout(speech.hangGuard);
    speech.hangGuard = setTimeout(() => {
      if (speech.isListening) {
        finishListening();
      }
    }, 12000);
  }

  function finishListening() {
    clearTimeout(speech.silenceTimer);
    clearTimeout(speech.hangGuard);
    if (speech.recognition && speech.isListening) {
      try { speech.recognition.stop(); } catch (_) { cleanupListening(); }
    }
  }

  function cleanupListening() {
    speech.isListening = false;
    clearTimeout(speech.silenceTimer);
    clearTimeout(speech.hangGuard);
    if (speech.onStateChange) speech.onStateChange("idle");
    if (speech.onEnd) speech.onEnd();
    const msg = speech.finalTranscript.trim();
    if (msg && speech.onResult) speech.onResult(msg);
  }

  function startSpeechRecognition(handlers) {
    if (!speech.recognition && !initSpeechRecognition()) return false;
    stopAriaSpeaking();
    Object.assign(speech, handlers || {});
    if (speech.isListening) {
      finishListening();
      return false;
    }
    speech.finalTranscript = "";
    speech.restartAttempts = 0;
    try {
      speech.recognition.start();
      return true;
    } catch (_) {
      return false;
    }
  }

  function stopSpeechRecognition() {
    clearTimeout(speech.silenceTimer);
    clearTimeout(speech.hangGuard);
    if (speech.recognition && speech.isListening) {
      try { speech.recognition.stop(); } catch (_) { /* no-op */ }
    }
  }

  function stopAriaSpeaking() {
    if (speech.isSpeaking || (window.speechSynthesis && window.speechSynthesis.speaking)) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
      speech.isSpeaking = false;
      if (speech.onStateChange) speech.onStateChange("idle");
    }
  }

  function ariaSpeakText(text) {
    if (!('speechSynthesis' in window) || !text) return false;
    stopAriaSpeaking();
    const clean = String(text).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return false;
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1; u.pitch = 1; u.lang = 'en-US';
    speech.isSpeaking = true;
    if (speech.onStateChange) speech.onStateChange("speaking");
    u.onend = () => {
      speech.isSpeaking = false;
      if (speech.onStateChange) speech.onStateChange("idle");
    };
    u.onerror = () => {
      speech.isSpeaking = false;
      if (speech.onStateChange) speech.onStateChange("idle");
    };
    window.speechSynthesis.speak(u);
    return true;
  }

  /* -------------------------------------------------- Reminders */
  const REMINDER_KEY = "aria.reminders.v1";

  function loadReminders() {
    try {
      return JSON.parse(localStorage.getItem(REMINDER_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function saveReminders(list) {
    try {
      localStorage.setItem(REMINDER_KEY, JSON.stringify(list));
    } catch { /* quota */ }
  }

  function addReminder(input) {
    const list = loadReminders();
    const reminder = {
      id:
        (crypto.randomUUID && crypto.randomUUID()) ||
        "r_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8),
      title: input.title || "Task",
      dueTime: new Date(input.dueTime).getTime(),
      isPrivate: input.isPrivate !== false,
      notified: false,
    };
    list.push(reminder);
    saveReminders(list);
    return reminder;
  }

  function checkReminders() {
    const list = loadReminders();
    const now = Date.now();
    let changed = false;
    for (const r of list) {
      if (r.notified) continue;
      const mins = (r.dueTime - now) / 60000;
      if (mins <= 10 && mins >= -1) {
        r.notified = true;
        changed = true;
        speakPrivacySafeReminder();
        if (ARIA.onReminder) ARIA.onReminder(r);
      }
    }
    if (changed) saveReminders(list);
  }

  function speakPrivacySafeReminder() {
    try {
      const u = new SpeechSynthesisUtterance("You have a task due soon.");
      u.rate = 0.95;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch { /* no speech synth */ }
  }

  /* -------------------------------------------------- Response engine */
  async function handleAriaRequest(userMessage) {
    const query = (userMessage || "").trim();
    if (!query) return null;
    const lc = query.toLowerCase();

    try {
      if (/\b(go\s?transit|go\s?schedule|go\s?train|go\s?bus)\b/.test(lc))
        return buildGoTransit(query);
      if (/\b(viarail|via\s?rail)\b/.test(lc)) return buildViaRail(query);
      if (/\b(ttc|subway|streetcar)\b/.test(lc)) return buildTtc(query);
      if (/\b(weather|forecast|temperature)\b/.test(lc))
        return buildWeather(query);
      if (/\b(stock|stocks|trading|market|markets|ticker|crypto|bitcoin|ethereum)\b/.test(lc))
        return await fetchTradingNews(query);
      if (/\b(news|headline|headlines)\b/.test(lc)) return await fetchTradingNews(query);
      if (/\b(remind|reminder|remember to|task)\b/.test(lc))
        return handleReminderIntent(query);
      if (/\b(compare\s?price|shopping|buy|cheapest|deal)\b/.test(lc))
        return buildShopping(query);
      if (/\b(tech\s?support|fix|error|broken|crash|computer|laptop|pc|mac|printer|wifi|wi-fi|internet|network|email|outlook|slow|freeze|hang|password|login|update|virus|malware|hack|backup|restore|connect|disconnect|troubleshoot|help me|not working)\b/.test(lc))
        return await buildTechSupport(query);
      if (/\b(directions?|route|map|navigate)\b/.test(lc))
        return buildDirections(query);
      return await handleGeneralSearch(query);
    } catch (err) {
      console.error("ARIA error", err);
      return {
        title: "ARIA",
        text: "I had trouble getting that data. Please try again or ask in a simpler way.",
      };
    }
  }

  function buildGoTransit() {
    return {
      title: "GO Transit Schedule",
      source: "GO Transit",
      large: true,
      html: `
        <div class="aria-result-card">
          <p>Live GO Transit trains, buses, delays and platforms — open the official trip planner.</p>
          <p><a class="aria-result-link" href="https://www.gotransit.com/en/trip-planner" target="_blank" rel="noopener">Open GO Transit Trip Planner →</a></p>
          <p><a class="aria-result-link" href="https://www.gotransit.com/en/service-updates" target="_blank" rel="noopener">Service updates & alerts →</a></p>
          <p class="small-note">For exact times, route changes, and platform updates, always confirm through GO Transit.</p>
        </div>`,
    };
  }
  function buildViaRail() {
    return {
      title: "Via Rail",
      source: "Via Rail Canada",
      large: true,
      html: `
        <div class="aria-result-card">
          <p><a class="aria-result-link" href="https://www.viarail.ca/en" target="_blank" rel="noopener">Via Rail trains & schedules →</a></p>
        </div>`,
    };
  }
  function buildTtc() {
    return {
      title: "TTC",
      source: "Toronto Transit Commission",
      large: true,
      html: `
        <div class="aria-result-card">
          <p><a class="aria-result-link" href="https://www.ttc.ca/trip-planner" target="_blank" rel="noopener">TTC trip planner →</a></p>
          <p><a class="aria-result-link" href="https://www.ttc.ca/service-advisories" target="_blank" rel="noopener">Service advisories →</a></p>
        </div>`,
    };
  }

  function buildWeather(q) {
    const loc = extractLocation(q) || "Toronto";
    return {
      title: `Weather — ${loc}`,
      source: "Environment Canada / wttr.in",
      large: true,
      html: `
        <div class="aria-result-card">
          <p><a class="aria-result-link" href="https://wttr.in/${encodeURIComponent(loc)}" target="_blank" rel="noopener">Open wttr.in forecast for ${escapeHtml(loc)} →</a></p>
          <p><a class="aria-result-link" href="https://weather.gc.ca/canada_e.html" target="_blank" rel="noopener">Environment Canada →</a></p>
        </div>`,
    };
  }

  function buildDirections(q) {
    const dest = q.replace(/^(directions?|route|map|navigate)[\s:to]*/i, "").trim() || q;
    return {
      title: "Directions",
      source: "Google Maps",
      html: `
        <p>Open directions for <b>${escapeHtml(dest)}</b> — <a class="aria-result-link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}">Google Maps →</a></p>`,
    };
  }

  function buildShopping(q) {
    const term = q.replace(/\b(compare\s?price|shopping|buy|cheapest|deal)\b/gi, "").trim() || q;
    return {
      title: `Shopping — ${term}`,
      source: "Price search",
      large: true,
      html: `
        <div class="aria-result-card">
          <p>Compare prices across major retailers:</p>
          <ul class="aria-link-list">
            <li><a class="aria-result-link" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term)}">Google Shopping →</a></li>
            <li><a class="aria-result-link" target="_blank" rel="noopener" href="https://www.amazon.ca/s?k=${encodeURIComponent(term)}">Amazon.ca →</a></li>
            <li><a class="aria-result-link" target="_blank" rel="noopener" href="https://www.bestbuy.ca/en-ca/search?search=${encodeURIComponent(term)}">Best Buy Canada →</a></li>
            <li><a class="aria-result-link" target="_blank" rel="noopener" href="https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(term)}">eBay Canada →</a></li>
          </ul>
        </div>`,
    };
  }

  // Conversation memory for multi-turn helpdesk chat
  const ariaChatHistory = [];

  async function buildTechSupport(q) {
    // 1. Try Knowledge Base first (instant, no AI cost)
    if (window.ARIA_KB) {
      const kb = window.ARIA_KB.lookup(q);
      if (kb) {
        const escalateNote = kb.escalate ? `<p class="small-note" style="color:#D4AF37;"><b>Recommend live agent.</b> Call <a class="aria-result-link" href="tel:+16475813182">(647) 581-3182</a>.</p>` : '';
        return {
          title: kb.escalate ? "Recommend Live Agent" : "ARIA — IT Helpdesk",
          source: "Integrated IT Support",
          large: true,
          html: `<div class="aria-result-card"><p>${escapeHtml(kb.text).replace(/\n/g, "<br>")}</p>${escalateNote}</div>`,
        };
      }
    }
    // 2. Fall through to AI (with conversation memory)
    ariaChatHistory.push({ role: "user", content: q });
    if (ariaChatHistory.length > 16) ariaChatHistory.splice(0, ariaChatHistory.length - 16);

    try {
      const res = await fetch("/.netlify/functions/aria-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: ariaChatHistory }),
      });
      if (!res.ok) throw new Error("Status " + res.status);
      const data = await res.json();
      const replyText = data.text || "I had trouble reaching the helpdesk service. Please call (647) 581-3182.";
      ariaChatHistory.push({ role: "assistant", content: replyText });

      const escapeReply = escapeHtml(replyText).replace(/\n/g, "<br>");
      let escalateNote = "";
      if (data.escalate) {
        escalateNote = `<p class="small-note" style="color:#D4AF37;"><b>Escalating to live agent.</b> Call <a class="aria-result-link" href="tel:+16475813182">(647) 581-3182</a> for immediate help.</p>`;
      }
      let suggestions = "";
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        suggestions = '<ul class="aria-link-list">' + data.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join("") + '</ul>';
      }

      return {
        title: data.escalate ? "Escalating to Live Agent" : "ARIA — IT Helpdesk",
        source: "Integrated IT Support",
        large: true,
        html: `
          <div class="aria-result-card">
            <p>${escapeReply}</p>
            ${suggestions}
            ${escalateNote}
          </div>`,
      };
    } catch (err) {
      console.error("ARIA chat error", err);
      return {
        title: "Tech Support",
        source: "Integrated IT Support",
        large: true,
        html: `
          <div class="aria-result-card">
            <p>For <b>${escapeHtml(q)}</b> — fastest path:</p>
            <ul class="aria-link-list">
              <li><a class="aria-result-link" href="/#service-center">Open the Service Center</a> — AI diagnostics, re-launch, screenshot triage.</li>
              <li><a class="aria-result-link" href="tel:+16475813182">Call Senior Director — (647) 581-3182</a></li>
              <li><a class="aria-result-link" href="mailto:integrateditsupp@gmail.com?subject=Tech%20Support%20Request">Email integrateditsupp@gmail.com</a></li>
            </ul>
            <p class="small-note">If the issue is urgent (system down, data loss, security incident) — call, don't email.</p>
          </div>`,
      };
    }
  }

  function handleReminderIntent(q) {
    const m = q.match(/in\s+(\d+)\s*(min|minute|minutes|hour|hours|hr|hrs)/i);
    if (!m) {
      return {
        title: "Reminder",
        text: 'Try: "remind me to call mom in 30 minutes" — ARIA will set a private task. When due, ARIA will only say "You have a task due soon."',
      };
    }
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const mins = unit.startsWith("h") ? n * 60 : n;
    const title = q.replace(/\bremind\s*(me\s*)?to\s*/i, "").replace(/in\s+\d+\s*\w+.*/i, "").trim() || "Reminder";
    const r = addReminder({
      title,
      dueTime: Date.now() + mins * 60000,
      isPrivate: true,
    });
    return {
      title: "Reminder set",
      text: `OK — I'll quietly let you know ${mins} minute${mins === 1 ? "" : "s"} from now. ARIA will only say "You have a task due soon."`,
      details: { Task: r.title, In: `${mins} min` },
    };
  }

  async function fetchTradingNews(query) {
    const res = await fetch(
      `/.netlify/functions/trading-news?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) throw new Error("news");
    const data = await res.json();
    const items = (data.items || []).slice(0, 8);
    if (items.length === 0) {
      return {
        title: "Trading News",
        text: "No fresh items returned. Try again in a moment.",
      };
    }
    return {
      title: "Trading News",
      large: true,
      source: "Yahoo Finance · CoinGecko · SEC EDGAR",
      html: `
        <div class="trading-news-grid">
          ${items
            .map(
              (item) => `
            <article class="trading-news-card">
              ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : ""}
              <div>
                <h3>${escapeHtml(item.title || "")}</h3>
                ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
                <small>${escapeHtml(item.source || "")} ${
                  item.timestamp ? `· ${escapeHtml(formatDate(item.timestamp))}` : ""
                }</small>
                ${item.url ? `<p><a class="aria-result-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Read more →</a></p>` : ""}
              </div>
            </article>`
            )
            .join("")}
        </div>
        <p class="financial-disclaimer">Market information is for education and research only. It is not financial advice.</p>`,
    };
  }

  async function handleGeneralSearch(query) {
    try {
      const res = await fetch(
        `/.netlify/functions/aria-search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("search");
      const data = await res.json();
      const hasAbstract = data.abstract && data.abstract.length > 0;
      const related = data.related || [];
      if (!hasAbstract && related.length === 0) {
        return {
          title: data.heading || query,
          html: `<p>No direct answer found. <a class="aria-result-link" target="_blank" rel="noopener" href="${escapeHtml(
            data.fallbackUrl
          )}">Search the web for "${escapeHtml(query)}" →</a></p>`,
        };
      }
      return {
        title: data.heading || query,
        large: hasAbstract || related.length > 3,
        source: data.abstractSource,
        html: `
          ${hasAbstract ? `<p>${escapeHtml(data.abstract)}</p>` : ""}
          ${
            data.abstractUrl
              ? `<p><a class="aria-result-link" target="_blank" rel="noopener" href="${escapeHtml(
                  data.abstractUrl
                )}">Full source →</a></p>`
              : ""
          }
          ${
            related.length
              ? `<ul class="aria-link-list">${related
                  .map(
                    (r) =>
                      `<li><a class="aria-result-link" target="_blank" rel="noopener" href="${escapeHtml(
                        r.url
                      )}">${escapeHtml(r.text)}</a></li>`
                  )
                  .join("")}</ul>`
              : ""
          }
          <p class="small-note"><a class="aria-result-link" target="_blank" rel="noopener" href="${escapeHtml(
            data.fallbackUrl
          )}">Broader web results →</a></p>`,
      };
    } catch {
      return {
        title: query,
        html: `<p><a class="aria-result-link" target="_blank" rel="noopener" href="https://duckduckgo.com/?q=${encodeURIComponent(
          query
        )}">Search the web for "${escapeHtml(query)}" →</a></p>`,
      };
    }
  }

  /* -------------------------------------------------- PWA install */
  const pwa = { deferredPrompt: null };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pwa.deferredPrompt = e;
    document.querySelectorAll("[data-install-pwa]").forEach((btn) => {
      btn.hidden = false;
      btn.style.display = "";
    });
  });
  window.addEventListener("appinstalled", () => {
    document.querySelectorAll("[data-install-pwa]").forEach((btn) => {
      btn.hidden = true;
      btn.style.display = "none";
    });
    pwa.deferredPrompt = null;
  });

  async function installPWA() {
    if (pwa.deferredPrompt) {
      pwa.deferredPrompt.prompt();
      try { await pwa.deferredPrompt.userChoice; } catch {}
      pwa.deferredPrompt = null;
      return;
    }
    showPremiumModal({
      title: "Install the app",
      body: `
        <p><b>iPhone / iPad:</b> tap the Share icon → <b>Add to Home Screen</b>.</p>
        <p><b>Android / Chrome:</b> tap the browser menu → <b>Install app</b> or <b>Add to Home Screen</b>.</p>
        <p><b>Desktop (Chrome / Edge):</b> click the install icon in the address bar.</p>`,
    });
  }

  /* -------------------------------------------------- Helpers */
  function extractLocation(q) {
    const m = q.match(/\b(?:in|for|at)\s+([A-Z][a-zA-Z\-]+(?:\s+[A-Z][a-zA-Z\-]+)?)/);
    return m ? m[1] : null;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function formatDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  /* -------------------------------------------------- Service worker */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  /* -------------------------------------------------- Start reminder loop */
  setInterval(checkReminders, 30000);
  setTimeout(checkReminders, 1500);

  /* -------------------------------------------------- Expose */
  const ARIA = {
    PAYPAL_RECEIVER_EMAIL,
    CURRENCY,
    showPremiumModal,
    renderPayPal,
    confirmAndRenderPayPal,
    showPaymentSuccess,
    handleAriaRequest,
    startSpeechRecognition,
    stopSpeechRecognition,
    stopAriaSpeaking,
    ariaSpeakText,
    addReminder,
    loadReminders,
    saveReminders,
    installPWA,
    escapeHtml,
    get isListening() { return speech.isListening; },
    get isSpeaking() { return speech.isSpeaking; },
    onReminder: null,
  };
  window.ARIA = ARIA;
})();

/* ===== HOMEPAGE REORDER + INTRO INJECTION (2026-05-10) ===== */
(function () {
     "use strict";
     var p = location.pathname;
     if (p !== "/" && p !== "/index.html") return;
     function init() {
            var sc = document.getElementById("service-center");
            if (!sc) return;
            if (document.getElementById("company-intro")) return;
            var parent = sc.parentNode;
            var intro = document.createElement("section");
            intro.id = "company-intro";
            intro.className = "py-20 px-6 md:px-10 border-t border-[#c5a059]/15";
            intro.innerHTML = '<div class="max-w-4xl mx-auto text-center"><p class="text-[10px] tracking-[0.3em] uppercase mb-4" style="color:#c5a059">WELCOME</p><h2 class="text-3xl md:text-4xl font-bold mb-8" style="font-family:Cinzel,serif">Welcome to <span style="color:#c5a059">Integrated IT Support Inc.</span></h2><p class="text-base md:text-lg leading-relaxed text-white/80">Our #1 objective and vision is to eliminate IT cost that just does not make sense — saving you not only money but time. Face it: a business runs to bring in revenue, not cut it. Who actually uses ITIL, Six Sigma and the many other skills obtained to help companies? Not many. Our goal is to bring you 21+ years of diverse IT experience across many industries, led by our CEO Ahmad Wasee, and importantly help you save time, effort, money — and stay focused on your goals, not worrying about IT at all. Take a look at some of our examples, apps, recent accomplishments, and much more down the pipeline. Welcome to the future, where AI helps you take over your challenges.</p></div>';
            var aria = document.createElement("section");
            aria.id = "introducing-aria";
            aria.className = "py-20 px-6 md:px-10 border-t border-[#c5a059]/15";
            aria.innerHTML = '<div class="max-w-6xl mx-auto"><div class="text-center mb-10"><p class="text-[10px] tracking-[0.3em] uppercase mb-4" style="color:#c5a059">NEW · ALWAYS ON</p><h2 class="text-3xl md:text-4xl font-bold mb-6" style="font-family:Cinzel,serif">Introducing <span style="color:#c5a059">ARIA</span></h2><p class="text-base md:text-lg leading-relaxed text-white/80 max-w-3xl mx-auto">Your AI technical analyst, customer support, service desk analyst, incident manager, help desk agent, receptionist, switchboard, and much more — all in one. Save tons of company expenses with ARIA.</p></div><div class="rounded-2xl border border-[#c5a059]/30 overflow-hidden" style="background:#000"><iframe src="/aria" loading="lazy" title="ARIA — AI Technical Assistant" style="width:100%;height:1100px;border:0;display:block;background:#000"></iframe></div></div>';
            parent.insertBefore(intro, sc);
            parent.insertBefore(aria, sc);
            ["aria-cinematics","aria-capabilities","aria-revolution","aria-demo"].forEach(function(id){
                     var el = document.getElementById(id);
                     if (el) parent.insertBefore(el, sc);
            });
     }
     if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", init);
     } else {
            init();
     }
})();


/* ===== TRIAL TIMER + PAYWALL + PLANS LINK FIX (v2 2026-05-10) ===== */
(function () {
  "use strict";
  if (window.self !== window.top) return;
  var PLANS_PATH = "/plans/";
  var TRIAL_MS = 3 * 60 * 1000;
  var KEY = "aria_trial_started_at";
  var ARIA_SECTION_IDS = ["introducing-aria", "aria-cinematics", "aria-capabilities", "aria-revolution", "aria-demo"];

  function rewritePlansLinks() {
    document.querySelectorAll("a").forEach(function (a) {
      var h = a.getAttribute("href") || "";
      var t = (a.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (h === "/aria?view=plans" || /[?&]view=plans/.test(h)) {
        a.setAttribute("href", PLANS_PATH);
        return;
      }
      if (h === "#solutions" && /view\s+plans/.test(t)) {
        a.setAttribute("href", PLANS_PATH);
      }
    });
  }

  function fmt(ms) {
    if (ms < 0) ms = 0;
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function getTrialStart() {
    var s = null;
    try { s = localStorage.getItem(KEY); } catch (e) {}
    if (!s) {
      s = Date.now().toString();
      try { localStorage.setItem(KEY, s); } catch (e) {}
    }
    return parseInt(s, 10) || Date.now();
  }

  function injectStyles() {
    if (document.getElementById("aria-trial-style")) return;
    var css =
      "#aria-trial-bar{position:fixed;top:0;left:0;right:0;z-index:9998;background:linear-gradient(90deg,#0a0805 0%,#1a1410 50%,#0a0805 100%);border-bottom:1px solid rgba(197,160,89,.45);padding:8px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-family:Inter,sans-serif;font-size:12px;letter-spacing:.12em;color:#f1dca7}" +
      "#aria-trial-bar .atb-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;animation:atbPulse 1.4s infinite}" +
      "#aria-trial-bar.expired .atb-dot{background:#ef4444;box-shadow:0 0 6px #ef4444;animation:none}" +
      "#aria-trial-bar .atb-time{font-family:Cinzel,serif;font-size:16px;color:#fff;letter-spacing:.04em;min-width:54px;text-align:center}" +
      "#aria-trial-bar.expired .atb-time{color:#ef4444}" +
      "#aria-trial-bar .atb-cta{background:#c5a059;color:#1a1410;padding:6px 14px;border-radius:10px;font-weight:700;text-decoration:none;letter-spacing:.15em;font-size:11px;font-family:Cinzel,serif;transition:transform .15s}" +
      "#aria-trial-bar .atb-cta:hover{transform:translateY(-1px)}" +
      "@keyframes atbPulse{0%,100%{opacity:1}50%{opacity:.35}}" +
      "body.aria-trial-active{padding-top:42px !important}" +
      "body.aria-trial-active nav.fixed{top:42px !important}" +
      "@media (max-width:600px){#aria-trial-bar{font-size:10px;gap:8px;padding:6px 10px}#aria-trial-bar .atb-time{font-size:14px}#aria-trial-bar .atb-cta{padding:4px 10px;font-size:10px}}" +
      ".aria-locked{position:relative}" +
      ".aria-locked > *:not(.aria-locked-overlay){filter:blur(7px) saturate(.8);transition:filter .4s ease;pointer-events:none;user-select:none}" +
      ".aria-locked-overlay{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse at center,rgba(5,5,5,.45) 0%,rgba(5,5,5,.75) 100%);backdrop-filter:blur(2px);animation:lockFade .5s ease both}" +
      "@keyframes lockFade{from{opacity:0}to{opacity:1}}" +
      ".aria-locked-card{background:linear-gradient(165deg,#0a0805 0%,#15110a 100%);border:1px solid rgba(197,160,89,.55);border-radius:18px;padding:30px 32px;text-align:center;max-width:380px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(197,160,89,.18)}" +
      ".aria-locked-card h3{font-family:Cinzel,serif;font-size:22px;color:#fff;margin:0 0 10px;letter-spacing:.02em}" +
      ".aria-locked-card h3 .gold{color:#c5a059}" +
      ".aria-locked-card p{color:rgba(255,255,255,.76);font-size:13.5px;line-height:1.6;margin:0 0 20px}" +
      ".aria-locked-cta{display:inline-block;background:linear-gradient(135deg,#c5a059 0%,#f1dca7 100%);color:#1a1410;padding:12px 26px;border-radius:12px;font-family:Cinzel,serif;font-weight:700;letter-spacing:.15em;text-decoration:none;font-size:12px;transition:transform .15s,box-shadow .15s}" +
      ".aria-locked-cta:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(197,160,89,.4)}" +
      ".aria-locked-sub{margin-top:14px;font-size:11px;color:rgba(255,255,255,.5);letter-spacing:.08em}" +
      ".aria-locked-sub a{color:#c5a059;text-decoration:none}" +
      ".aria-locked-fab{filter:blur(4px) saturate(.7);opacity:.55;cursor:not-allowed !important;transition:filter .3s}";
    var s = document.createElement("style");
    s.id = "aria-trial-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildBar(remaining) {
    var bar = document.createElement("div");
    bar.id = "aria-trial-bar";
    bar.innerHTML = '<span class="atb-dot"></span><span class="atb-label">FREE TRIAL</span>' +
      '<span class="atb-time">' + fmt(remaining) + '</span>' +
      '<span style="opacity:.55">remaining</span>' +
      '<a class="atb-cta" href="' + PLANS_PATH + '">PICK A PLAN →</a>';
    document.body.appendChild(bar);
    document.body.classList.add("aria-trial-active");
    return bar;
  }

  function blurAriaSections() {
    ARIA_SECTION_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.querySelector(".aria-locked-overlay")) return;
      el.classList.add("aria-locked");
      var overlay = document.createElement("div");
      overlay.className = "aria-locked-overlay";
      overlay.innerHTML =
        '<div class="aria-locked-card">' +
          '<h3>Your <span class="gold">trial</span> is up</h3>' +
          '<p>Pick a plan to keep using ARIA. The rest of the site stays open — explore as much as you want.</p>' +
          '<a class="aria-locked-cta" href="' + PLANS_PATH + '">VIEW PLANS →</a>' +
          '<div class="aria-locked-sub">Or <a href="mailto:integrateditsupp@gmail.com?subject=ARIA%20Sales%20Inquiry">talk to sales</a></div>' +
        '</div>';
      el.appendChild(overlay);
    });
    ["ariaFab","chatFab","installAppButton"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.classList.add("aria-locked-fab");
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = PLANS_PATH;
      }, true);
    });
  }

  function init() {
    rewritePlansLinks();
    var p = location.pathname;
    if (p === PLANS_PATH || p === "/plans") return;
    injectStyles();
    var start = getTrialStart();
    var remaining = TRIAL_MS - (Date.now() - start);
    var bar = buildBar(Math.max(0, remaining));
    var timeEl = bar.querySelector(".atb-time");
    var labelEl = bar.querySelector(".atb-label");
    function tick() {
      var r = TRIAL_MS - (Date.now() - start);
      if (r <= 0) {
        bar.classList.add("expired");
        labelEl.textContent = "TRIAL ENDED";
        timeEl.textContent = "0:00";
        blurAriaSections();
        return;
      }
      timeEl.textContent = fmt(r);
      setTimeout(tick, 1000);
    }
    tick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ===== VISION ROADMAP INJECTION (v2 2026-05-10) ===== */
(function () {
  "use strict";
  if (window.self !== window.top) return;
  var p = location.pathname;
  if (p !== "/" && p !== "/index.html") return;

  var MILESTONES = [
    { status: "done",    title: "ARIA conceived",                 desc: "From a sketch to a name. The vision: an AI that replaces tier-1 IT support with empathy, memory, and 24/7 availability." },
    { status: "done",    title: "Knowledge base built",           desc: "100+ deep IT support articles. Windows, Mac, M365, networking, security, mobile. The brain ARIA reasons from." },
    { status: "done",    title: "Live on iisupp.net",             desc: "Web platform with chat, voice, and live demo. The product is real. You're using it right now." },
    { status: "done",    title: "Plans & payment infrastructure", desc: "Five tiers, lifetime access, acquisition pathway, Stripe-secured checkout. Revenue rails laid down." },
    { status: "done",    title: "Forced trial & paywall",         desc: "3-minute web trial with countdown. Pay or pick a plan. Real conversion mechanics, not vanity numbers." },
    { status: "current", title: "Connecting with brands & companies", desc: "Where we are right now. Building real partnerships. Real contracts. Proving the model in the field, one customer at a time." },
    { status: "future",  title: "Global expansion",               desc: "Multi-region, multi-language. Wherever a business needs IT support, ARIA shows up — North America, Europe, Asia, beyond." },
    { status: "future",  title: "Charity support, pro bono",      desc: "Free ARIA for non-profits doing the work governments won't. Their tech burden becomes our responsibility." },
    { status: "future",  title: "Reimagining education — with respect", desc: "Education is the most important part of our lives. It must change and grow with us — but never by tearing down the hardship and dedication of the generations before. We stay appreciative and aware. There is no good done from negativity; start negative and you end with a toxic message. We're not perfect — we strive for balance. To those who 'badmouth' the system, we understand the pain behind it, and we're with you too. Lead by great example: not by acting perfect, but by being vulnerable and true to our humanity." },
    { status: "future",  title: "Eliminating real-world problems", desc: "Hunger. Housing. Mental health. Loneliness. We pick problems we can move with technology and patience — and we move them." },
    { status: "future",  title: "Expanding into virtual worlds",  desc: "VR, AR, spatial computing. ARIA goes wherever humans go. But our feet stay on planet earth — the virtual serves the real, not the other way around." },
    { status: "future",  title: "Mental health & human connection", desc: "Tech should bring people closer to themselves, to each other, to their lives. Not pull them away. We build for that line." }
  ];

  function injectStyles() {
    if (document.getElementById("rm-style")) return;
    var css =
      "#vision-roadmap{position:relative;padding:90px 20px 120px;max-width:1200px;margin:0 auto;overflow:hidden;z-index:2}" +
      "#vision-roadmap .rm-head{text-align:center;max-width:760px;margin:0 auto 64px;position:relative;z-index:2}" +
      "#vision-roadmap .rm-tag{color:#c5a059;font-size:11px;letter-spacing:.34em;margin:0 0 14px;text-transform:uppercase}" +
      "#vision-roadmap h2{font-family:Cinzel,serif;font-size:44px;font-weight:700;color:#fff;margin:0 0 18px;line-height:1.1}" +
      "#vision-roadmap h2 .rm-gold{color:#c5a059}" +
      "#vision-roadmap .rm-sub{color:rgba(255,255,255,.72);font-size:16px;line-height:1.6;margin:0}" +
      "#vision-roadmap .rm-track{position:relative}" +
      "#vision-roadmap .rm-stones{position:relative;z-index:2;display:flex;flex-direction:column;gap:48px;padding-top:24px}" +
      "#vision-roadmap .rm-stone{display:grid;grid-template-columns:1fr 64px 1fr;gap:14px;align-items:center;opacity:0;transform:translateY(20px);transition:opacity .8s ease,transform .8s ease}" +
      "#vision-roadmap .rm-stone.visible{opacity:1;transform:translateY(0)}" +
      "#vision-roadmap .rm-card{background:linear-gradient(165deg,#0a0805 0%,#15110a 100%);border:1px solid rgba(197,160,89,.22);border-radius:16px;padding:22px 24px;transition:border-color .2s,box-shadow .2s}" +
      "#vision-roadmap .rm-card:hover{border-color:rgba(197,160,89,.55);box-shadow:0 18px 40px rgba(197,160,89,.14)}" +
      "#vision-roadmap .rm-stone.left .rm-card{grid-column:1;text-align:right}" +
      "#vision-roadmap .rm-stone.right .rm-card{grid-column:3;text-align:left}" +
      "#vision-roadmap .rm-stone.left .rm-spacer{grid-column:3}" +
      "#vision-roadmap .rm-stone.right .rm-spacer{grid-column:1}" +
      "#vision-roadmap .rm-node{grid-column:2;justify-self:center;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:11px;letter-spacing:.04em;position:relative}" +
      "#vision-roadmap .rm-card h3{font-family:Cinzel,serif;font-size:18px;color:#f1dca7;margin:0 0 8px;letter-spacing:.02em;line-height:1.25}" +
      "#vision-roadmap .rm-card p{color:rgba(255,255,255,.74);font-size:13.5px;line-height:1.6;margin:0}" +
      "#vision-roadmap .rm-badge{display:inline-block;margin-top:10px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-family:Cinzel,serif;font-weight:700;padding:3px 10px;border-radius:6px}" +
      "#vision-roadmap .rm-stone.done .rm-node{background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);color:#fff;box-shadow:0 0 16px rgba(34,197,94,.55),inset 0 0 0 1.5px rgba(255,255,255,.18)}" +
      "#vision-roadmap .rm-stone.done .rm-card{border-color:rgba(34,197,94,.35)}" +
      "#vision-roadmap .rm-stone.done .rm-badge{background:rgba(34,197,94,.16);color:#86efac;border:1px solid rgba(34,197,94,.4)}" +
      "#vision-roadmap .rm-stone.current .rm-node{background:linear-gradient(135deg,#c5a059 0%,#f1dca7 100%);color:#1a1410;box-shadow:0 0 22px rgba(241,220,167,.7),inset 0 0 0 1.5px rgba(255,255,255,.25);animation:rmPulse 2.2s infinite}" +
      "#vision-roadmap .rm-stone.current .rm-card{border-color:rgba(241,220,167,.6);background:linear-gradient(165deg,#1a1410 0%,#251a12 100%);box-shadow:0 0 50px rgba(241,220,167,.18)}" +
      "#vision-roadmap .rm-stone.current .rm-card h3{color:#fff;font-size:20px}" +
      "#vision-roadmap .rm-stone.current .rm-badge{background:rgba(241,220,167,.16);color:#f1dca7;border:1px solid rgba(241,220,167,.5)}" +
      "@keyframes rmPulse{0%,100%{box-shadow:0 0 22px rgba(241,220,167,.7),inset 0 0 0 1.5px rgba(255,255,255,.25)}50%{box-shadow:0 0 36px rgba(241,220,167,1),inset 0 0 0 1.5px rgba(255,255,255,.4)}}" +
      "#vision-roadmap .rm-stone.future .rm-node{background:rgba(197,160,89,.08);color:#c5a059;border:1.5px dashed rgba(197,160,89,.55)}" +
      "#vision-roadmap .rm-stone.future .rm-card{border-color:rgba(197,160,89,.18);opacity:.9}" +
      "#vision-roadmap .rm-stone.future .rm-card h3{color:#f1dca7;opacity:.85}" +
      "#vision-roadmap .rm-stone.future .rm-badge{background:rgba(197,160,89,.08);color:#c5a059;border:1px solid rgba(197,160,89,.3)}" +
      "#vision-roadmap .rm-dream{margin-top:80px;text-align:center;position:relative;z-index:2;padding:48px 28px;background:radial-gradient(ellipse at center,rgba(197,160,89,.12) 0%,transparent 70%)}" +
      "#vision-roadmap .rm-dream .rm-star{width:72px;height:72px;margin:0 auto 28px;border-radius:50%;background:linear-gradient(135deg,#c5a059 0%,#f1dca7 50%,#c5a059 100%);display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:32px;color:#1a1410;box-shadow:0 0 70px rgba(241,220,167,.6),inset 0 0 0 1.5px rgba(255,255,255,.3);animation:rmStar 4s infinite}" +
      "@keyframes rmStar{0%,100%{box-shadow:0 0 70px rgba(241,220,167,.6),inset 0 0 0 1.5px rgba(255,255,255,.3)}50%{box-shadow:0 0 110px rgba(241,220,167,.95),inset 0 0 0 1.5px rgba(255,255,255,.5)}}" +
      "#vision-roadmap .rm-dream blockquote{font-family:Cinzel,serif;font-size:24px;font-style:italic;color:#f1dca7;margin:0;line-height:1.65;font-weight:400}" +
      "#vision-roadmap .rm-dream blockquote .rm-line{display:block}" +
      "#vision-roadmap .rm-dream cite{display:block;margin-top:22px;font-family:Inter,sans-serif;font-size:11px;font-style:normal;color:rgba(255,255,255,.55);letter-spacing:.32em;text-transform:uppercase}" +
      "#vision-roadmap .rm-motto{text-align:center;margin:40px auto 0;max-width:600px;color:rgba(255,255,255,.55);font-size:13px;font-style:italic;letter-spacing:.04em;line-height:1.6}" +
      "@media (max-width:720px){" +
        "#vision-roadmap{padding:60px 16px 80px}" +
        "#vision-roadmap h2{font-size:32px}" +
        "#vision-roadmap .rm-stone{grid-template-columns:48px 1fr;gap:14px}" +
        "#vision-roadmap .rm-stone.left .rm-card,#vision-roadmap .rm-stone.right .rm-card{grid-column:2;text-align:left}" +
        "#vision-roadmap .rm-stone.left .rm-spacer,#vision-roadmap .rm-stone.right .rm-spacer{display:none}" +
        "#vision-roadmap .rm-node{grid-column:1;width:34px;height:34px;font-size:10px}" +
        "#vision-roadmap .rm-card{padding:18px 20px}" +
        "#vision-roadmap .rm-dream blockquote{font-size:18px}" +
      "}";
    var s = document.createElement("style");
    s.id = "rm-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildRoadmap() {
    var section = document.createElement("section");
    section.id = "vision-roadmap";
    var head = document.createElement("div");
    head.className = "rm-head";
    head.innerHTML =
      '<p class="rm-tag">THE ROAD AHEAD</p>' +
      '<h2>From <span class="rm-gold">here</span> to <span class="rm-gold">everywhere</span></h2>' +
      '<p class="rm-sub">A dreamer\'s roadmap. Where we are. Where we are going. And why this story does not end.</p>';
    section.appendChild(head);

    var track = document.createElement("div");
    track.className = "rm-track";

    var stones = document.createElement("div");
    stones.className = "rm-stones";

    MILESTONES.forEach(function (m, i) {
      var side = (i % 2 === 0) ? "left" : "right";
      var stone = document.createElement("div");
      stone.className = "rm-stone " + m.status + " " + side;
      var nodeContent = m.status === "done" ? "&#10003;" : (m.status === "current" ? "&#9203;" : String(i + 1));
      var badge = m.status === "done" ? '<span class="rm-badge">Live</span>' :
                  (m.status === "current" ? '<span class="rm-badge">In progress</span>' :
                   '<span class="rm-badge">Coming</span>');
      stone.innerHTML =
        '<div class="rm-card"><h3>' + m.title + '</h3><p>' + m.desc + '</p>' + badge + '</div>' +
        '<div class="rm-node">' + nodeContent + '</div>' +
        '<div class="rm-spacer"></div>';
      stones.appendChild(stone);
    });

    track.appendChild(stones);

    var dream = document.createElement("div");
    dream.className = "rm-dream";
    dream.innerHTML =
      '<div class="rm-star">A</div>' +
      '<blockquote>' +
        '<span class="rm-line">A dreamer never stops dreaming.</span>' +
        '<span class="rm-line">There is no finish line.</span>' +
        '<span class="rm-line">Stories continue, one way or another.</span>' +
      '</blockquote>' +
      '<cite>&mdash; The founder</cite>';
    track.appendChild(dream);

    var motto = document.createElement("div");
    motto.className = "rm-motto";
    motto.textContent = "Our plans grow as our company does.";
    track.appendChild(motto);

    section.appendChild(track);
    return section;
  }

  function init() {
    var sc = document.getElementById("service-center");
    var ariaDemo = document.getElementById("aria-demo");
    var anchor = ariaDemo || sc;
    if (!anchor) return;
    if (document.getElementById("vision-roadmap")) return;
    injectStyles();
    var section = buildRoadmap();
    anchor.parentNode.insertBefore(section, anchor.nextSibling);

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -80px 0px" });
      section.querySelectorAll(".rm-stone").forEach(function (s) { io.observe(s); });
    } else {
      section.querySelectorAll(".rm-stone").forEach(function (s) { s.classList.add("visible"); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ===== GLOBAL SIDE ROOTS (v2 2026-05-10 — two side lines from welcome to dream) ===== */
(function () {
  "use strict";
  if (window.self !== window.top) return;
  var p = location.pathname;
  if (p !== "/" && p !== "/index.html") return;

  var SVG_NS = "http://www.w3.org/2000/svg";

  function injectStyles() {
    if (document.getElementById("gr-style")) return;
    var css =
      "#global-roots{position:absolute;left:0;width:100%;z-index:1;pointer-events:none}" +
      "@media (max-width:720px){#global-roots{opacity:.55}}";
    var s = document.createElement("style");
    s.id = "gr-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function build() {
    var top = document.getElementById("company-intro");
    var bottom = document.getElementById("vision-roadmap");
    if (!top || !bottom) return;
    var topY = top.offsetTop;
    var bottomY = bottom.offsetTop + bottom.offsetHeight;
    var height = Math.max(800, bottomY - topY);

    var prev = document.getElementById("global-roots");
    if (prev) prev.remove();

    document.body.style.position = "relative";

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.id = "global-roots";
    svg.setAttribute("viewBox", "0 0 1600 " + height);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.top = topY + "px";
    svg.style.height = height + "px";

    function p(d, w, op) {
      return '<path d="' + d + '" stroke="url(#grRoots)" stroke-width="' + w + '" fill="none" opacity="' + op + '" filter="url(#grGlow)"/>';
    }

    var h = height;
    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="grRoots" x1="0%" y1="0%" x2="0%" y2="100%">' +
          '<stop offset="0%" stop-color="#c5a059" stop-opacity="0"/>' +
          '<stop offset="4%" stop-color="#c5a059" stop-opacity="0.5"/>' +
          '<stop offset="50%" stop-color="#f1dca7" stop-opacity="0.85"/>' +
          '<stop offset="96%" stop-color="#c5a059" stop-opacity="0.5"/>' +
          '<stop offset="100%" stop-color="#c5a059" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<filter id="grGlow" x="-50%" y="-50%" width="200%" height="200%">' +
          '<feGaussianBlur stdDeviation="3.5" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
      '</defs>' +
      p("M 90 0 C 70 " + (h*0.15) + ", 110 " + (h*0.32) + ", 80 " + (h*0.5) + " C 50 " + (h*0.68) + ", 100 " + (h*0.85) + ", 80 " + h, 2.2, 1) +
      p("M 1510 0 C 1530 " + (h*0.15) + ", 1490 " + (h*0.32) + ", 1520 " + (h*0.5) + " C 1550 " + (h*0.68) + ", 1500 " + (h*0.85) + ", 1520 " + h, 2.2, 1) +
      p("M 80 " + (h*0.12) + " Q 50 " + (h*0.14) + ", 25 " + (h*0.17), 1.3, 0.55) +
      p("M 1520 " + (h*0.28) + " Q 1555 " + (h*0.30) + ", 1580 " + (h*0.33), 1.3, 0.55) +
      p("M 85 " + (h*0.42) + " Q 50 " + (h*0.44) + ", 20 " + (h*0.47), 1.3, 0.5) +
      p("M 1515 " + (h*0.58) + " Q 1555 " + (h*0.60) + ", 1582 " + (h*0.63), 1.3, 0.5) +
      p("M 80 " + (h*0.72) + " Q 45 " + (h*0.74) + ", 18 " + (h*0.77), 1.3, 0.5) +
      p("M 1520 " + (h*0.88) + " Q 1555 " + (h*0.90) + ", 1582 " + (h*0.93), 1.3, 0.5);

    document.body.appendChild(svg);
  }

  var pending = null;
  function debouncedBuild() {
    if (pending) clearTimeout(pending);
    pending = setTimeout(build, 350);
  }

  function init() {
    injectStyles();
    setTimeout(build, 1800);
    setTimeout(build, 4000);
    window.addEventListener("resize", debouncedBuild);
    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(debouncedBuild);
      setTimeout(function () {
        var rm = document.getElementById("vision-roadmap");
        if (rm) ro.observe(rm);
        ro.observe(document.body);
      }, 2200);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
