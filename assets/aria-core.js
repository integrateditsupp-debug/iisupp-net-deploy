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
