/* ══════════════════════════════════════════════════════════════
   ARIA CORE — shared logic for iisupp.net
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
            body: "<p>PayPal could not complete the request. Try again or contact Integrated IT Support at <a href='mailto:ahmad.wasee@iisupp.net'>ahmad.wasee@iisupp.net</a>.</p>",
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
try { var __voices = window.speechSynthesis.getVoices(); var __femPref = ["Samantha","Microsoft Zira","Google UK English Female","Karen","Victoria","Allison","Microsoft Hazel","Microsoft Eva","Tessa","Fiona","Moira","Veena","Susan","Catherine","Serena"]; var __female=null; for(var __i=0;__i<__femPref.length && !__female;__i++){ var __np=__femPref[__i]; __female=__voices.find(function(v){return v.name===__np || v.name.indexOf(__np)>=0;}); } if(__female) u.voice=__female; u.rate=0.95; u.pitch=1.05; } catch(e){}
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
        suggestions = '<ul class="aria-link-list aria-suggestions">' + data.suggestions.map(s => `<li class="aria-suggestion-item">${escapeHtml(s)}</li>`).join("") + '</ul>';
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
              <li><a class="aria-result-link" href="mailto:ahmad.wasee@iisupp.net?subject=Tech%20Support%20Request">Email ahmad.wasee@iisupp.net</a></li>
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
            intro.innerHTML =
                  '<style>'
                +   '#company-intro .ci-eyebrow{display:inline-flex;align-items:center;justify-content:center;gap:9px}'
                +   '#company-intro .ci-dot{width:8px;height:8px;border-radius:999px;background:#c5a059;box-shadow:0 0 12px #c5a059;animation:ciPulse 1.8s ease-in-out infinite}'
                +   '@keyframes ciPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.6)}}'
                +   '#company-intro .ci-card{position:relative;overflow:hidden;opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s ease,border-color .3s ease,box-shadow .3s ease}'
                +   '#company-intro.in .ci-card{opacity:1;transform:none}'
                +   '#company-intro.in .ci-card:nth-child(1){transition-delay:.04s}'
                +   '#company-intro.in .ci-card:nth-child(2){transition-delay:.12s}'
                +   '#company-intro.in .ci-card:nth-child(3){transition-delay:.20s}'
                +   '#company-intro.in .ci-card:nth-child(4){transition-delay:.28s}'
                +   '#company-intro .ci-card:hover{box-shadow:0 18px 50px rgba(0,0,0,.45);transform:translateY(-4px)}'
                +   '#company-intro .ci-card::after{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(120deg,transparent 32%,rgba(241,220,167,.10) 50%,transparent 68%);transform:translateX(-130%);pointer-events:none}'
                +   '#company-intro .ci-card:hover::after{animation:ciSheen 1.05s ease}'
                +   '@keyframes ciSheen{to{transform:translateX(130%)}}'
                +   '#company-intro .ci-icon{display:inline-block;animation:ciFloat 4.5s ease-in-out infinite}'
                +   '#company-intro .ci-card:nth-child(2) .ci-icon{animation-delay:.6s}'
                +   '#company-intro .ci-card:nth-child(3) .ci-icon{animation-delay:1.2s}'
                +   '#company-intro .ci-card:nth-child(4) .ci-icon{animation-delay:1.8s}'
                +   '@keyframes ciFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
                +   '@media (prefers-reduced-motion:reduce){#company-intro .ci-card{opacity:1;transform:none}#company-intro .ci-dot,#company-intro .ci-icon{animation:none}}'
                +   '#company-intro .ci-card-flip{perspective:900px;min-height:108px}'
                +   '#company-intro .ci-card-inner{position:relative;width:100%;height:108px;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.4,0,.2,1)}'
                +   '#company-intro .ci-card-flip:hover .ci-card-inner,#company-intro .ci-card-flip:focus-within .ci-card-inner{transform:rotateY(180deg)}'
                +   '#company-intro .ci-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:10px;border:1px solid rgba(197,160,89,.22);background:rgba(255,255,255,.02);padding:10px 9px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}'
                +   '#company-intro .ci-face.ci-back{transform:rotateY(180deg);background:linear-gradient(160deg,rgba(20,16,11,.92),rgba(8,7,5,.98));border-color:rgba(241,220,167,.5)}'
                +   '#company-intro .ci-card-title{color:#c5a059;font-family:Cinzel,serif;font-size:11px;font-weight:700;letter-spacing:.03em;margin:0;line-height:1.15}'
                +   '#company-intro .ci-back p{color:rgba(255,255,255,.78);font-size:10px;line-height:1.42;margin:0}'
                +   '#company-intro .ci-front .ci-icon{font-size:17px!important;margin-bottom:7px!important}'
                +   '@media (prefers-reduced-motion:reduce){#company-intro .ci-card-flip:hover .ci-card-inner{transform:none}}'
                + '</style>'
                + '<div class="max-w-5xl mx-auto">'
                +   '<div class="text-center mb-10">'
                +     '<p class="ci-eyebrow text-[10px] tracking-[0.3em] uppercase mb-4" style="color:#c5a059"><span class="ci-dot"></span>WELCOME</p>'
                +     '<h2 class="text-3xl md:text-4xl font-bold mb-4" style="font-family:Cinzel,serif">Welcome to <span style="color:#c5a059">Integrated IT Support Inc.</span></h2>'
                +     '<p class="text-base md:text-lg leading-relaxed text-white/70 max-w-2xl mx-auto">We remove the IT costs that do not make sense — so you save money, save time, and stay focused on growing your business.</p>'
                +   '</div>'
                +   '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto mb-3 md:mb-4">'
                +     '<div class="ci-card-flip" tabindex="0"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">🛠️</div><h3 class="ci-card-title">L1 – L3 IT Support</h3></div><div class="ci-face ci-back"><p>Helpdesk to escalation engineering, every tier. <a href="/plans/" style="color:#f1dca7;text-decoration:underline">See pricing →</a></p></div></div></div>'
                +     '<div class="ci-card-flip" tabindex="0"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">🚚</div><h3 class="ci-card-title">Move-In / Move-Out</h3></div><div class="ci-face ci-back"><p>We set up &amp; configure offices during moves — desks, network, printers, phones — and decommission cleanly.</p></div></div></div>'
                +     '<div class="ci-card-flip" tabindex="0"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">📈</div><h3 class="ci-card-title">IT Improvement Assessments</h3></div><div class="ci-face ci-back"><p>We audit your IT team with 21+ years of experience — candidly, without the job-security hesitation a manager might have. Stronger IT, not needless expense.</p></div></div></div>'
                +     '<div class="ci-card-flip" tabindex="0"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">🛡️</div><h3 class="ci-card-title">Cybersecurity</h3></div><div class="ci-face ci-back"><p>Endpoint protection, M365 hardening, backup &amp; DR, compliance. <a href="/services.html" style="color:#f1dca7;text-decoration:underline">Explore →</a></p></div></div></div>'
                +   '</div>'
                +   '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">'
                +     '<div class="ci-card-flip"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">💰</div><h3 class="ci-card-title">Cut IT waste</h3></div><div class="ci-face ci-back"><p>We eliminate IT costs that do not make sense.</p></div></div></div>'
                +     '<div class="ci-card-flip"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">🎯</div><h3 class="ci-card-title">Focus on revenue</h3></div><div class="ci-face ci-back"><p>We own your IT so you do not have to think about it.</p></div></div></div>'
                +     '<div class="ci-card-flip"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">🏆</div><h3 class="ci-card-title"><span class="ci-count" data-to="15">15</span>+ years</h3></div><div class="ci-face ci-back"><p>ITIL, Six Sigma, cross-industry — actually applied, not framed on a wall.</p></div></div></div>'
                +     '<div class="ci-card-flip"><div class="ci-card-inner"><div class="ci-face ci-front"><div class="ci-icon text-xl mb-2">🤖</div><h3 class="ci-card-title">Built on AI</h3></div><div class="ci-face ci-back"><p>AI helps you take on challenges before they become problems.</p></div></div></div>'
                +   '</div>'
                +   '<div class="text-center mt-10"><a href="#introducing-aria" class="inline-block text-[10px] tracking-[0.4em] uppercase font-bold border-b border-[#c5a059]/40 pb-2 transition hover:text-white" style="color:#c5a059">See our apps, examples &amp; recent work ↓</a></div>'
                + '</div>';
            var aiEdge = document.querySelector(".ai-edge-band");
            if (aiEdge && aiEdge.parentNode) { aiEdge.parentNode.insertBefore(intro, aiEdge); }
            else { parent.insertBefore(intro, sc); }
            ["aria-cinematics","aria-capabilities","aria-revolution","aria-demo"].forEach(function(id){
                     var el = document.getElementById(id);
                     if (el) parent.insertBefore(el, sc);
            });
            (function () {
                     function reveal() {
                            intro.classList.add("in");
                            var cnt = intro.querySelector(".ci-count");
                            if (cnt && !cnt.getAttribute("data-done")) {
                                   cnt.setAttribute("data-done", "1");
                                   var to = parseInt(cnt.getAttribute("data-to"), 10) || 0, cur = 0;
                                   var step = Math.max(1, Math.round(to / 28));
                                   var t = setInterval(function () { cur += step; if (cur >= to) { cur = to; clearInterval(t); } cnt.textContent = cur; }, 34);
                            }
                     }
                     if ("IntersectionObserver" in window) {
                            var io = new IntersectionObserver(function (es) {
                                   es.forEach(function (e) { if (e.isIntersecting) { reveal(); io.disconnect(); } });
                            }, { threshold: 0.18 });
                            io.observe(intro);
                     } else { reveal(); }
            })();
     }
     if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", init);
     } else {
            init();
     }
})();

/* ===== CONTENT ASSURANCE SPOTLIGHT (2026-07-04) ===== */
(function () {
     "use strict";
     var p = location.pathname;
     if (p !== "/" && p !== "/index.html") return;

     function injectStyles() {
            if (document.getElementById("content-assurance-spotlight-style")) return;
            var style = document.createElement("style");
            style.id = "content-assurance-spotlight-style";
            style.textContent =
                  "#content-assurance-spotlight{position:relative}" +
                  "#content-assurance-spotlight .cas-shell{max-width:940px;margin:0 auto;border:1px solid rgba(197,160,89,.22);border-radius:20px;padding:26px 22px;background:radial-gradient(circle at top left,rgba(197,160,89,.14),transparent 42%),linear-gradient(165deg,rgba(255,255,255,.03),rgba(255,255,255,.015));box-shadow:0 20px 60px rgba(0,0,0,.22)}" +
                  "#content-assurance-spotlight .cas-eyebrow{display:inline-block;color:#c5a059;font-size:10px;letter-spacing:.34em;text-transform:uppercase;font-weight:700;margin:0 0 12px}" +
                  "#content-assurance-spotlight .cas-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(250px,.85fr);gap:20px;align-items:center}" +
                  "#content-assurance-spotlight h2{font-family:Cinzel,serif;font-size:30px;line-height:1.12;color:#fff;margin:0 0 10px}" +
                  "#content-assurance-spotlight h2 .cas-gold{color:#c5a059}" +
                  "#content-assurance-spotlight .cas-copy{color:rgba(255,255,255,.72);font-size:14px;line-height:1.68;margin:0}" +
                  "#content-assurance-spotlight .cas-actions{display:flex;flex-direction:column;gap:10px;align-items:flex-start}" +
                  "#content-assurance-spotlight .cas-btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 22px;border-radius:999px;background:linear-gradient(135deg,#c5a059 0%,#f1dca7 100%);color:#1a140c;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.12em;font-weight:700;text-decoration:none;box-shadow:0 12px 28px rgba(197,160,89,.22);transition:transform .15s ease,box-shadow .2s ease}" +
                  "#content-assurance-spotlight .cas-btn:hover{transform:translateY(-1px);box-shadow:0 16px 32px rgba(197,160,89,.28)}" +
                  "#content-assurance-spotlight .cas-note{color:rgba(241,220,167,.82);font-size:10.5px;line-height:1.65;letter-spacing:.03em}" +
                  "#content-assurance-spotlight .cas-points{display:grid;grid-template-columns:1fr;gap:7px;margin-top:14px}" +
                  "#content-assurance-spotlight .cas-point{color:rgba(255,255,255,.64);font-size:11.5px;line-height:1.5;padding-left:16px;position:relative}" +
                  "#content-assurance-spotlight .cas-point::before{content:'';position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:#c5a059;box-shadow:0 0 10px rgba(197,160,89,.55)}" +
                  "@media (max-width:800px){#content-assurance-spotlight .cas-shell{padding:24px 18px;border-radius:16px}#content-assurance-spotlight .cas-grid{grid-template-columns:1fr;gap:18px}#content-assurance-spotlight h2{font-size:26px}#content-assurance-spotlight .cas-copy{font-size:14px}#content-assurance-spotlight .cas-actions{align-items:stretch}#content-assurance-spotlight .cas-btn{width:100%;text-align:center}}";
            document.head.appendChild(style);
     }

     function buildSection() {
            var section = document.createElement("section");
            section.id = "content-assurance-spotlight";
            section.className = "py-14 px-6 md:px-10";
            section.innerHTML = `
              <div class="cas-shell">
                <div class="cas-grid">
                  <div>
                    <p class="cas-eyebrow">AI Verification</p>
                    <h2>Content <span class="cas-gold">Assurance</span></h2>
                    <p class="cas-copy">Check whether writing looks AI-made. Fast, simple, and built for real review work.</p>
                    <div class="cas-points">
                      <div class="cas-point">Upload a file or paste the text.</div>
                      <div class="cas-point">Review the AI-likelihood result.</div>
                      <div class="cas-point">Export the findings if you need proof.</div>
                    </div>
                  </div>
                  <div class="cas-actions">
                    <a class="cas-btn" href="/services/content-assurance">Open Content Assurance &rarr;</a>
                    <div class="cas-note">Useful for reports, essays, proposals, articles, and other written work.</div>
                  </div>
                </div>
              </div>`;
            return section;
     }

     function init() {
            if (document.getElementById("content-assurance-spotlight")) return;
            var intro = document.getElementById("company-intro");
            var roadmap = document.getElementById("vision-roadmap");
            var aiEdge = document.querySelector(".ai-edge-band");
            if (!intro && !roadmap && !aiEdge) return;
            injectStyles();
            var section = buildSection();
            if (roadmap && roadmap.parentNode) {
                   roadmap.parentNode.insertBefore(section, roadmap);
                   return;
            }
            if (intro && intro.parentNode) {
                   intro.parentNode.insertBefore(section, intro.nextSibling);
                   return;
            }
            if (aiEdge && aiEdge.parentNode) {
                   aiEdge.parentNode.insertBefore(section, aiEdge);
            }
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
  var TRIAL_MS = 15 * 60 * 1000;
  var KEY = "aria_trial_started_at";
  var ARIA_SECTION_IDS = ["aria-demo","ariaBrowser","chatBrowser","aria-browser"];

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

  /* === trial state machine v4 (2026-06-17) ====================
     Trial is INACTIVE until the user submits the "Before we troubleshoot"
     form (which dispatches `aria-user-set`). Before that, ARIA is fully
     accessible with no countdown bar and no lock.
     On `aria-user-set`:
       effectiveUsed = max(email_consumed, device_elapsed)
       if effectiveUsed >= 15min → fire paywall (blurAriaSections)
       else → start 15-min countdown from effectiveUsed
     We track BOTH a per-email key AND a device-level key. A new email
     CANNOT bypass an exhausted device — the device counter persists
     across all email identities used on this browser.
  */
  var EMAIL_KEY    = "aria_user_email";
  var PREFIX       = "aria_trial_consumed_";          // + lowercased email
  var DEVICE_KEY   = "aria_device_elapsed_ms";        // device-level accumulator
  var _sessionStart = 0;     // 0 = trial not running
  var _baseConsumed = 0;
  var _trialActive  = false;
  var _expired      = false;
  var _barBuilt     = false;
  var _timerHandle  = null;

  function getActiveEmail() {
    try {
      var v = localStorage.getItem(EMAIL_KEY);
      return v ? String(v).trim().toLowerCase() : "";
    } catch (e) { return ""; }
  }
  function getEmailConsumed(email) {
    if (!email) return 0;
    try {
      var v = parseInt(localStorage.getItem(PREFIX + email) || "0", 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function getDeviceElapsed() {
    try {
      var v = parseInt(localStorage.getItem(DEVICE_KEY) || "0", 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function getElapsed() {
    if (!_trialActive && !_expired) return _baseConsumed;
    if (!_sessionStart) return _baseConsumed;
    return _baseConsumed + (Date.now() - _sessionStart);
  }
  function persistElapsed() {
    if (!_trialActive) return;
    var elapsed = getElapsed();
    var email = getActiveEmail();
    try {
      if (email) localStorage.setItem(PREFIX + email, String(elapsed));
      var dev = getDeviceElapsed();
      localStorage.setItem(DEVICE_KEY, String(Math.max(dev, elapsed)));
    } catch (e) {}
  }

  function startTrialFor(email) {
    if (!email) return;
    var emailConsumed  = getEmailConsumed(email);
    var deviceConsumed = getDeviceElapsed();
    var effective = Math.max(emailConsumed, deviceConsumed);
    if (effective >= TRIAL_MS) {
      // Already exhausted — gate immediately, no bar, no countdown
      _expired = true;
      _trialActive = false;
      _baseConsumed = TRIAL_MS;
      _sessionStart = Date.now();
      try { localStorage.setItem(DEVICE_KEY, String(Math.max(deviceConsumed, TRIAL_MS))); } catch (e) {}
      // Mark expired state on bar if previously built
      var bar = document.getElementById("aria-trial-bar");
      if (bar) {
        bar.classList.add("expired");
        var t = bar.querySelector(".atb-time"); if (t) t.textContent = "0:00";
        var l = bar.querySelector(".atb-label"); if (l) l.textContent = "TRIAL ENDED";
      }
      blurAriaSections();
      return;
    }
    _expired = false;
    _baseConsumed = effective;
    _sessionStart = Date.now();
    _trialActive = true;
    if (!_barBuilt) {
      injectStyles();
      buildBar(TRIAL_MS - effective);
      _barBuilt = true;
    } else {
      var b2 = document.getElementById("aria-trial-bar");
      if (b2) {
        b2.classList.remove("expired");
        var t2 = b2.querySelector(".atb-time"); if (t2) t2.textContent = fmt(TRIAL_MS - effective);
      }
    }
    startTick();
  }

  /* === Trial-expiry email reminders (added 2026-06-18) ===
     Fires email at 5-min-remaining and at 0:00 expiry.
     Uses localStorage flags so each milestone only sends ONCE per email
     (across sessions/devices). Routes through existing aria-receipt-email
     Netlify function (Resend primary + SMTP fallback). */
  function sendReminderEmail(milestone) {
    var email = getActiveEmail();
    if (!email) return;
    var flagKey = "aria_reminder_sent_" + milestone + "_" + email;
    try { if (localStorage.getItem(flagKey)) return; } catch (e) {}
    try {
      fetch("/.netlify/functions/aria-receipt-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          event: "trial_" + milestone,
          ts: new Date().toISOString(),
          milestone: milestone === "5min" ? "5 minutes remaining" : "expired"
        })
      }).then(function () {
        try { localStorage.setItem(flagKey, String(Date.now())); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }

  function startTick() {
    if (_timerHandle) clearTimeout(_timerHandle);
    function tick() {
      if (!_trialActive) return;
      var elapsed = getElapsed();
      var remaining = TRIAL_MS - elapsed;
      var bar = document.getElementById("aria-trial-bar");
      // Fire 5-min-remaining reminder (only when crossing the threshold downward)
      if (remaining > 0 && remaining <= 5 * 60 * 1000 && remaining > 4 * 60 * 1000 + 50 * 1000) {
        sendReminderEmail("5min");
      }
      if (remaining <= 0) {
        _trialActive = false;
        _expired = true;
        persistElapsed();
        if (bar) {
          bar.classList.add("expired");
          var t = bar.querySelector(".atb-time"); if (t) t.textContent = "0:00";
          var l = bar.querySelector(".atb-label"); if (l) l.textContent = "TRIAL ENDED";
        }
        sendReminderEmail("expired");  // single fire on first 0:00 detection
        blurAriaSections();
        return;
      }
      if (bar) {
        var t2 = bar.querySelector(".atb-time"); if (t2) t2.textContent = fmt(remaining);
      }
      _timerHandle = setTimeout(tick, 1000);
    }
    tick();
  }

  // Lifecycle persistence
  window.addEventListener("beforeunload", persistElapsed);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) persistElapsed();
  });
  setInterval(persistElapsed, 5000);

  // Triggered by the aperture-bridge form submit
  window.addEventListener("aria-user-set", function (e) {
    var email = (e && e.detail && e.detail.email) ? String(e.detail.email).toLowerCase() : getActiveEmail();
    if (!email) return;
    startTrialFor(email);
  });

  // Cross-tab storage sync
  window.addEventListener("storage", function (e) {
    if (e.key === EMAIL_KEY || (e.key || "").indexOf(PREFIX) === 0 || e.key === DEVICE_KEY) {
      persistElapsed();
      var em = getActiveEmail();
      if (em) startTrialFor(em);
    }
  });

  // Back-compat shim for anything still calling getTrialStart()
  function getTrialStart() {
    return Date.now() - getElapsed();
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
      ".aria-locked > *:not(.aria-locked-overlay){pointer-events:none;user-select:none}" +
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
      ".aria-locked-card.tariff{max-width:580px;padding:24px 26px}" +
      ".aria-locked-eyebrow{display:block;color:#c5a059;font-size:9px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;margin-bottom:10px}" +
      ".aria-locked-card .arl-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:16px 0 14px}" +
      "@media (max-width:520px){.aria-locked-card .arl-grid{grid-template-columns:1fr}}" +
      ".aria-locked-card .arl-tile{border:1px solid rgba(197,160,89,.32);border-radius:12px;padding:14px 12px;background:rgba(255,255,255,.02);display:flex;flex-direction:column;gap:8px;text-align:center;position:relative}" +
      ".aria-locked-card .arl-tile.featured{border-color:rgba(241,220,167,.75);background:rgba(241,220,167,.08)}" +
      ".aria-locked-card .arl-tile.featured::before{content:\"RECOMMENDED\";position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#c5a059;color:#1a1407;padding:2px 9px;font-size:8px;letter-spacing:.18em;font-weight:800;border-radius:999px}" +
      ".aria-locked-card .arl-tier{color:#c5a059;font-size:8px;letter-spacing:.28em;text-transform:uppercase;font-weight:700}" +
      ".aria-locked-card .arl-price{color:#f1dca7;font-family:Cinzel,serif;font-size:20px;font-weight:700;margin:2px 0}" +
      ".aria-locked-card .arl-period{color:rgba(243,236,217,.55);font-size:9px;letter-spacing:.12em}" +
      ".aria-locked-card .arl-desc{color:rgba(255,255,255,.65);font-size:10.5px;line-height:1.45;min-height:30px}" +
      ".aria-locked-card .arl-pick{margin-top:6px;background:linear-gradient(135deg,#b8954f,#d8bd84 50%,#9c7322);color:#1a1407;border:none;border-radius:6px;padding:7px 8px;font-family:Inter,sans-serif;font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;font-family:inherit}" +
      ".aria-locked-card .arl-pick:hover{filter:brightness(1.08)}" +
      ".aria-locked-card .arl-pick:disabled{opacity:.6;cursor:progress}" +
      ".aria-locked-card .arl-seemore{display:inline-block;margin-top:6px;color:#f1dca7;font-size:10px;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;border:1px solid rgba(241,220,167,.5);padding:8px 18px;border-radius:999px;background:rgba(15,12,7,.7)}" +
      ".aria-locked-card .arl-seemore:hover{background:rgba(241,220,167,.18)}" +
      "#ariaFab.aria-locked-fab{filter:blur(4px) saturate(.7);opacity:.55;cursor:not-allowed !important;transition:filter .3s}";
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
    var targets = ARIA_SECTION_IDS.map(function(id){ return document.getElementById(id); }).filter(Boolean);
    var frame = document.querySelector(".browser-frame");
    if (frame && targets.indexOf(frame) < 0) targets.push(frame);
    targets.forEach(function (el) {
      if (el.querySelector(".aria-locked-overlay")) return;
      el.classList.add("aria-locked");
      var overlay = document.createElement("div");
      overlay.className = "aria-locked-overlay";
      overlay.innerHTML =
        '<div class="aria-locked-card tariff">' +
          '<span class="aria-locked-eyebrow">Trial ended · Time to commit</span>' +
          '<h3>Continue with <span class="gold">ARIA</span></h3>' +
          '<p>Pick a plan to keep chatting. The rest of the site stays open — explore as much as you want.</p>' +
          '<div class="arl-grid">' +
            '<div class="arl-tile"><span class="arl-tier">Personal</span><span class="arl-price">$599</span><span class="arl-period">/month</span><span class="arl-desc">For one user. Full chat + KB access.</span><button class="arl-pick" data-tier="personal">Pick Personal</button></div>' +
            '<div class="arl-tile featured"><span class="arl-tier">Pro</span><span class="arl-price">$1,500</span><span class="arl-period">/month</span><span class="arl-desc">For consultants. Voice mode + receipts.</span><button class="arl-pick" data-tier="pro">Pick Pro</button></div>' +
            '<div class="arl-tile"><span class="arl-tier">Small Biz</span><span class="arl-price">$156K</span><span class="arl-period">/year</span><span class="arl-desc">Up to 10 users. Company KB upload.</span><button class="arl-pick" data-tier="small_business">Pick SMB</button></div>' +
          '</div>' +
          '<a class="arl-seemore" href="' + PLANS_PATH + '">See all plans →</a>' +
          '<div class="aria-locked-sub">Or <a href="mailto:ahmad.wasee@iisupp.net?subject=ARIA%20Sales%20Inquiry">talk to sales</a></div>' +
        '</div>';
      el.appendChild(overlay);
      overlay.querySelectorAll(".arl-pick").forEach(function(btn){
        btn.addEventListener("click", async function(){
          if (btn.disabled) return;
          btn.disabled = true;
          var orig = btn.textContent;
          btn.textContent = "Connecting...";
          try {
            var r = await fetch("/.netlify/functions/stripe-checkout", {
              method:"POST", headers:{"Content-Type":"application/json"},
              body: JSON.stringify({tier: btn.dataset.tier})
            });
            var d = await r.json();
            if (d && d.url) { window.location = d.url; return; }
            throw new Error((d && d.error) || "Checkout failed");
          } catch(e){
            btn.disabled = false;
            btn.textContent = orig;
            alert("Could not start checkout: " + (e.message || e) + "\nEmail ahmad.wasee@iisupp.net to complete the purchase.");
          }
        });
      });
    });
    ["ariaFab","installAppButton"].forEach(function (id) {
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
    // No styles, no bar, no lock until the user submits the bridge form.
    // ARIA stays fully accessible in this "pre-trial" state.
    var existing = getActiveEmail();
    if (existing) {
      // Returning visitor with stored identity: jump straight into trial state
      injectStyles();
      startTrialFor(existing);
    }
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
    { status: "done",    title: "Small contracts closed",            desc: "2025 — $35K+ in real contracts. The first proof the model works in the field. Small businesses paying for real IT support." },
    { status: "done",    title: "First long-term global contract",  desc: "2025 — $75K+/yr secured with a global company. Recurring revenue. Real partnership. The model scales." },
    { status: "done",    title: "Reinvested for growth",            desc: "2025 — Revenue cycled back into skill, experience, and marketing development. We didn't pocket it — we built with it." },
    { status: "done",    title: "ARIA conceived & built with AI",  desc: "2026 — An AI replacing Tier 1, 2, and 3 IT support with empathy, professionalism, and 24/7 availability. Saving companies time, money, and frustration while educating users. A work in progress that keeps gaining capabilities." },
    { status: "done",    title: "Knowledge base — 200+ deep articles", desc: "Windows, Mac, M365, networking, security, mobile — plus vertical packs for healthcare (HIPAA), legal (privilege), and finance (SOX/PCI). Tenants can also upload their own KB so ARIA follows their processes." },
    { status: "done",    title: "Live on iisupp.net",               desc: "Web platform with chat, voice, and live demo. The product is real. You're using it right now." },
    { status: "done",    title: "Plans, trial, and checkout",       desc: "Five tiers, Stripe-secured checkout, 15-minute live trial with countdown + paywall, self-serve billing portal, plan up/downgrade, GDPR + PIPEDA data export. Revenue rails operating." },
    { status: "done",    title: "Procurement + partner-ready",       desc: "2026 — Enterprise governance library published (SOC 2 + ISO 27001 + PIPEDA roadmaps). Registered on CanadaBuys + SAP Ariba. Anthropic Partner Network applied; Microsoft Cloud Partner + AWS Partner application packets prepared." },
    { status: "done",    title: "Enterprise platform shipped",       desc: "2026 — Microsoft 365 Graph integration, multi-language (EN/FR/AR/ES/DE), mobile + iOS support, Slack + Teams apps, white-label theming, public API + Node & Python SDKs, cross-device session memory." },
    { status: "done",    title: "Security & compliance live",       desc: "2026 — SOC 2 readiness self-assessment, GDPR Art. 22 + PIPEDA Principle 9 notices, ISO 29147 vulnerability disclosure, AI governance + automated-decisions policy, per-tenant audit log + human-approval gate on every privileged action." },
    { status: "current", title: "Connecting with brands & companies", desc: "Where we are right now. Engaging brands directly. Building partnerships with Anthropic, Microsoft, and AWS in motion. Proving the model in the field, contract by contract." },
    { status: "future",  title: "ARIA Sentinel — desktop companion", desc: "Within a month — ARIA Sentinel arrives. The desktop companion to ARIA, available on all platforms beginning with Windows. Quieter machines, faster recoveries, fewer support tickets. macOS, Linux, and mobile follow." },
    { status: "future",  title: "Global expansion",                desc: "Multi-region, multi-language. Wherever a business needs IT support, ARIA shows up — North America, Europe, Asia, beyond." },
    { status: "future",  title: "Charity support, pro bono",       desc: "Free ARIA for non-profits doing the work governments won't. Their tech burden becomes our responsibility." },
    { status: "future",  title: "Reimagining education — with respect", desc: "Education is the most important part of our lives. It must change and grow with us — but never by tearing down the hardship and dedication of the generations before. We stay appreciative and aware. There is no good done from negativity; start negative and you end with a toxic message. We're not perfect — we strive for balance. To those who 'badmouth' the system, we understand the pain behind it, and we're with you too. Lead by great example: not by acting perfect, but by being vulnerable and true to our humanity." },
    { status: "future",  title: "Eliminating real-world problems", desc: "Hunger. Housing. Mental health. Loneliness. We pick problems we can move with technology and patience — and we move them." },
    { status: "future",  title: "Expanding into virtual worlds",  desc: "VR, AR, spatial computing. ARIA goes wherever humans go. But our feet stay on planet earth — the virtual serves the real, not the other way around." },
    { status: "future",  title: "Mental health & human connection", desc: "Tech should bring people closer to themselves, to each other, to their lives. Not pull them away. We build for that line." }
  ]

  function injectStyles() {
    if (document.getElementById("rm-style")) return;
    var css =
      "#vision-roadmap{position:relative;padding:28px 20px 36px;max-width:1200px;margin:0 auto;overflow:hidden;z-index:2}" +
      "#vision-roadmap .rm-head{text-align:center;max-width:760px;margin:0 auto 18px;position:relative;z-index:2}" +
      "#vision-roadmap .rm-tag{color:#c5a059;font-size:11px;letter-spacing:.34em;margin:0 0 14px;text-transform:uppercase}" +
      "#vision-roadmap h2{font-family:Cinzel,serif;font-size:44px;font-weight:700;color:#fff;margin:0 0 18px;line-height:1.1}" +
      "#vision-roadmap h2 .rm-gold{color:#c5a059}" +
      "#vision-roadmap .rm-sub{color:rgba(255,255,255,.72);font-size:16px;line-height:1.6;margin:0}" +
      "#vision-roadmap .rm-track{position:relative}" +
      "#vision-roadmap .rm-stones{position:relative;z-index:2;display:flex;flex-direction:column;gap:10px;padding-top:6px}" +
      "#vision-roadmap .rm-tree{position:absolute;left:50%;top:0;width:240px;height:100%;transform:translateX(-50%);z-index:1;pointer-events:none}" +
      "#vision-roadmap .rm-stone::before{content:'';position:absolute;top:50%;height:1.5px;transform:translateY(-50%);z-index:1;pointer-events:none;box-shadow:0 0 6px rgba(241,220,167,.4)}" +
      "#vision-roadmap .rm-stone.left::before{right:50%;width:36%;background:linear-gradient(270deg,rgba(241,220,167,.85),rgba(241,220,167,0))}" +
      "#vision-roadmap .rm-stone.right::before{left:50%;width:36%;background:linear-gradient(90deg,rgba(241,220,167,.85),rgba(241,220,167,0))}" +
      "@media (max-width:720px){#vision-roadmap .rm-tree{display:block;left:50%;width:92px;opacity:.58}#vision-roadmap .rm-stone::before{display:block;width:30%}#vision-roadmap .rm-stone.left::before{right:50%;background:linear-gradient(270deg,rgba(241,220,167,.72),rgba(241,220,167,0))}#vision-roadmap .rm-stone.right::before{left:50%;background:linear-gradient(90deg,rgba(241,220,167,.72),rgba(241,220,167,0))}}" +
      "#vision-roadmap .rm-stone{display:grid;grid-template-columns:1fr 64px 1fr;gap:14px;align-items:center;justify-items:stretch;opacity:0;transform:translateY(20px);transition:opacity .8s ease,transform .8s ease}" +
      "#vision-roadmap .rm-stone.visible{opacity:1;transform:translateY(0)}" +
      "#vision-roadmap .rm-card{background:none;border:none;border-radius:0;padding:14px 22px;box-shadow:none;transition:none}" +
      "#vision-roadmap .rm-card:hover{background:none;border:none;box-shadow:none}" +
      "#vision-roadmap .rm-stone.left .rm-card{grid-column:1;text-align:right;justify-self:end}" +
      "#vision-roadmap .rm-stone.right .rm-card{grid-column:3;text-align:left;justify-self:start}" +
      "#vision-roadmap .rm-stone.left .rm-spacer{grid-column:3}" +
      "#vision-roadmap .rm-stone.right .rm-spacer{grid-column:1}" +
      "#vision-roadmap .rm-node{grid-column:2;justify-self:center;align-self:center;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:10px;letter-spacing:.04em;position:relative}" +
      "#vision-roadmap .rm-card h3{font-family:Cinzel,serif;font-size:18px;color:#f1dca7;margin:0 0 8px;letter-spacing:.02em;line-height:1.25}" +
      "#vision-roadmap .rm-card p{color:rgba(241,220,167,.78);font-size:13.5px;line-height:1.65;margin:0}" +
      "#vision-roadmap .rm-badge{display:inline-block;margin-top:10px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-family:Cinzel,serif;font-weight:700;padding:3px 10px;border-radius:6px}" +
      "#vision-roadmap .rm-stone.done .rm-node{background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);color:#fff;box-shadow:0 0 16px rgba(34,197,94,.55),inset 0 0 0 1.5px rgba(255,255,255,.18)}" +
      "#vision-roadmap .rm-stone.done .rm-card{border-color:rgba(34,197,94,.35)}" +
      "#vision-roadmap .rm-stone.done .rm-badge{background:rgba(34,197,94,.16);color:#86efac;border:1px solid rgba(34,197,94,.4)}" +
      "#vision-roadmap .rm-stone.current .rm-node{background:linear-gradient(135deg,#c5a059 0%,#f1dca7 100%);color:#1a1410;box-shadow:0 0 22px rgba(241,220,167,.7),inset 0 0 0 1.5px rgba(255,255,255,.25);animation:rmPulse 2.2s infinite}" +
      "#vision-roadmap .rm-stone.current .rm-card{border-color:rgba(241,220,167,.6);background:linear-gradient(165deg,#1a1410 0%,#251a12 100%);box-shadow:0 0 50px rgba(241,220,167,.18)}" +
      "#vision-roadmap .rm-flip{perspective:900px;min-height:78px;max-width:340px;cursor:pointer;width:100%;transition:min-height .35s cubic-bezier(.4,0,.2,1)}" +
      "#vision-roadmap .rm-flip-inner{position:relative;width:100%;min-height:78px;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.4,0,.2,1),min-height .35s cubic-bezier(.4,0,.2,1)}" +
      "#vision-roadmap .rm-flip:hover,#vision-roadmap .rm-flip:focus-within{min-height:220px}" +
      "#vision-roadmap .rm-flip:hover .rm-flip-inner,#vision-roadmap .rm-flip:focus-within .rm-flip-inner{transform:rotateY(180deg);min-height:220px}" +
      "#vision-roadmap .rm-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:12px;border:1px solid rgba(197,160,89,.22);background:linear-gradient(160deg,rgba(255,255,255,.02),rgba(197,160,89,.04));padding:12px 16px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box}" +
      "#vision-roadmap .rm-face.rm-back{transform:rotateY(180deg);background:linear-gradient(165deg,#1a1410 0%,#251a12 100%);border-color:rgba(241,220,167,.4)}" +
      "#vision-roadmap .rm-front h3{font-family:Cinzel,serif;font-size:15px;color:#f1dca7;margin:0 0 6px;letter-spacing:.03em;line-height:1.25;text-transform:uppercase}" +
      "#vision-roadmap .rm-front .rm-hint{display:none}" +
      "#vision-roadmap .rm-back p{color:rgba(241,220,167,.92);font-size:12.5px;line-height:1.55;margin:0;overflow:auto;max-height:170px}" +
      "#vision-roadmap .rm-stone.done .rm-front{border-color:rgba(34,197,94,.35)}" +
      "#vision-roadmap .rm-stone.current .rm-front{border-color:rgba(241,220,167,.6)}" +
      "@media (prefers-reduced-motion:reduce){#vision-roadmap .rm-flip:hover .rm-flip-inner{transform:none}}" +
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
        "#vision-roadmap{padding:48px 14px 66px}" +
        "#vision-roadmap .rm-head{margin-bottom:30px}" +
        "#vision-roadmap .rm-tag{font-size:8px;letter-spacing:.22em;margin-bottom:8px}" +
        "#vision-roadmap h2{font-size:25px;line-height:1.12}" +
        "#vision-roadmap .rm-sub{font-size:11px;line-height:1.52}" +
        "#vision-roadmap .rm-tree{left:50%;width:88px;opacity:.56;transform:translateX(-50%)}" +
        "#vision-roadmap .rm-stone::before{display:block;width:28%}" +
        "#vision-roadmap .rm-stone.left::before{right:50%;background:linear-gradient(270deg,rgba(241,220,167,.62),rgba(241,220,167,0))}" +
        "#vision-roadmap .rm-stone.right::before{left:50%;background:linear-gradient(90deg,rgba(241,220,167,.62),rgba(241,220,167,0))}" +
        "#vision-roadmap .rm-stones{gap:26px;padding-top:6px}" +
        "#vision-roadmap .rm-stone{grid-template-columns:minmax(0,1fr) 38px minmax(0,1fr);gap:6px;align-items:center;max-width:100%;margin:0 auto}" +
        "#vision-roadmap .rm-stone.left .rm-card{grid-column:1;text-align:right}" +
        "#vision-roadmap .rm-stone.right .rm-card{grid-column:3;text-align:left}" +
        "#vision-roadmap .rm-stone.left .rm-spacer{display:block;grid-column:3}" +
        "#vision-roadmap .rm-stone.right .rm-spacer{display:block;grid-column:1}" +
        "#vision-roadmap .rm-node{grid-column:2;grid-row:auto;width:22px;height:22px;font-size:8px;margin-top:0}" +
        "#vision-roadmap .rm-card{padding:6px 4px}" +
        "#vision-roadmap .rm-card h3{font-size:11.3px;line-height:1.22;margin-bottom:5px;overflow-wrap:anywhere}" +
        "#vision-roadmap .rm-card p{font-size:9.4px;line-height:1.38;overflow-wrap:anywhere}" +
        "#vision-roadmap .rm-badge{font-size:7px;letter-spacing:.1em;padding:2px 5px;margin-top:6px;max-width:100%;white-space:normal}" +
        "#vision-roadmap .rm-stone.current .rm-card h3{font-size:13px}" +
        "#vision-roadmap .rm-dream{margin-top:42px;padding:28px 8px}" +
        "#vision-roadmap .rm-dream .rm-star{width:48px;height:48px;margin-bottom:18px;font-size:22px}" +
        "#vision-roadmap .rm-dream blockquote{font-size:14px;line-height:1.55}" +
        "#vision-roadmap .rm-dream cite{font-size:8px;letter-spacing:.16em}" +
        "#vision-roadmap .rm-motto{font-size:10.5px;line-height:1.55}" +
      "}";
    var s = document.createElement("style");
    s.id = "rm-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildSVGTrunk() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "rm-tree");
    svg.setAttribute("viewBox", "0 0 240 1500");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      '<defs><linearGradient id="rmTrunk" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#c5a059" stop-opacity="0.2"/><stop offset="8%" stop-color="#c5a059" stop-opacity="0.85"/><stop offset="50%" stop-color="#f1dca7" stop-opacity="1"/><stop offset="92%" stop-color="#c5a059" stop-opacity="0.85"/><stop offset="100%" stop-color="#c5a059" stop-opacity="0.2"/></linearGradient><filter id="rmTreeGlow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<path d="M 120 0 C 145 120, 95 240, 120 360 C 145 480, 95 600, 120 720 C 145 840, 95 960, 120 1080 C 145 1200, 95 1320, 120 1440 L 120 1500" stroke="url(#rmTrunk)" stroke-width="2.5" fill="none" filter="url(#rmTreeGlow)"/>' +
      '<path d="M 120 180 Q 100 195, 88 215" stroke="url(#rmTrunk)" stroke-width="1.2" fill="none" opacity="0.5" filter="url(#rmTreeGlow)"/>' +
      '<path d="M 120 540 Q 140 555, 152 575" stroke="url(#rmTrunk)" stroke-width="1.2" fill="none" opacity="0.5" filter="url(#rmTreeGlow)"/>' +
      '<path d="M 120 900 Q 100 915, 88 935" stroke="url(#rmTrunk)" stroke-width="1.2" fill="none" opacity="0.5" filter="url(#rmTreeGlow)"/>' +
      '<path d="M 120 1260 Q 140 1275, 152 1295" stroke="url(#rmTrunk)" stroke-width="1.2" fill="none" opacity="0.5" filter="url(#rmTreeGlow)"/>';
    return svg;
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
    track.appendChild(buildSVGTrunk());

    var stones = document.createElement("div");
    stones.className = "rm-stones";

    MILESTONES.forEach(function (m, i) {
      var side = (i % 2 === 0) ? "left" : "right";
      var stone = document.createElement("div");
      stone.className = "rm-stone " + m.status + " " + side;
      var nodeContent = m.status === "done" ? "&#10003;" : (m.status === "current" ? "&#9203;" : String(i + 1));
      var badge = "";
      stone.innerHTML =
        '<div class="rm-card rm-flip" tabindex="0">' +
          '<div class="rm-flip-inner">' +
            '<div class="rm-face rm-front"><h3>' + m.title + '</h3>' + badge + '<span class="rm-hint">Hover for detail</span></div>' +
            '<div class="rm-face rm-back"><p>' + m.desc + '</p></div>' +
          '</div>' +
        '</div>' +
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
        '<span class="rm-line">A dreamer never stops dreaming. There is no finish line.</span>' +
        '<span class="rm-line">Stories continue, one way or another.</span>' +
      '</blockquote>' +
      '<cite>&mdash; The founder</cite>';
    track.appendChild(dream);

    var motto = document.createElement("div");
    motto.className = "rm-motto";
    motto.textContent = "The bigger we grow, the greater we build — we'll never stop efforts in growing!";
    track.appendChild(motto);

    section.appendChild(track);
    return section;
  }

  function init() {
    if (document.getElementById("vision-roadmap")) return;
    // Prefer placement right under the hero — insert BEFORE the AI Edge band.
    var aiEdge = document.querySelector(".ai-edge-band");
    var sc = document.getElementById("service-center");
    var ariaDemo = document.getElementById("aria-demo");
    injectStyles();
    var section = buildRoadmap();
    if (aiEdge && aiEdge.parentNode) {
      aiEdge.parentNode.insertBefore(section, aiEdge);
    } else {
      var anchor = ariaDemo || sc;
      if (!anchor) return;
      anchor.parentNode.insertBefore(section, anchor.nextSibling);
    }

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


/* ===== SERVICE CENTER STATUS LABELS (v1 2026-05-10) ===== */
(function () {
  "use strict";
  if (window.self !== window.top) return;
  var p = location.pathname;
  if (p !== "/" && p !== "/index.html") return;
  function init() {
    var sc = document.getElementById("service-center");
    if (!sc) return;
    if (sc.querySelector(".sc-status-tag")) return;
    var heading = sc.querySelector("h2, h1");
    if (heading) {
      var tag = document.createElement("p");
      tag.className = "sc-status-tag";
      tag.textContent = "IN PROGRESS";
      tag.style.cssText = "color:#c5a059;font-size:10px;letter-spacing:.32em;margin:10px 0 0;font-family:Cinzel,serif;font-weight:700;text-transform:uppercase;text-align:center;opacity:.75";
      heading.parentNode.insertBefore(tag, heading.nextSibling);
    }
    var footer = document.createElement("p");
    footer.className = "sc-footer-status";
    footer.textContent = "Completing soon";
    footer.style.cssText = "color:rgba(241,220,167,.55);font-size:13px;font-style:italic;letter-spacing:.06em;text-align:center;margin:40px auto 0;font-family:Cinzel,serif";
    sc.appendChild(footer);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


/* Service Center male professional voice helper */
(function(){if(window.serviceCenterSpeakText)return;window.serviceCenterSpeakText=function(text){if(!("speechSynthesis" in window))return;try{window.speechSynthesis.cancel();}catch(e){}var u=new SpeechSynthesisUtterance(text);try{var voices=window.speechSynthesis.getVoices();var pref=["Daniel","Alex","Microsoft David","Google UK English Male","Microsoft Mark","Tom","James","Reed","Fred","Lee","Oliver","Aaron","Arthur"];var pick=null;for(var i=0;i<pref.length&&!pick;i++){var np=pref[i];pick=voices.find(function(v){return v.name===np||v.name.indexOf(np)>=0;});}if(pick)u.voice=pick;u.rate=0.97;u.pitch=0.92;}catch(e){}u.volume=1.0;window.speechSynthesis.speak(u);};})();


/* ARIA fab lock + /aria standalone 5-min trial overlay */
(function(){
  var css = '#ariaFab.aria-locked-fab{cursor:pointer !important}'+
    '#ariaFab.aria-locked-fab::after{content:"\\1F512";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px;color:#c5a059;text-shadow:0 0 6px rgba(0,0,0,.7);filter:none;pointer-events:none;z-index:2}'+
    '#aria5Modal{position:fixed;inset:0;background:rgba(8,5,2,.78);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:aria5Fade .4s ease}'+
    '#aria5Modal .a5-card{background:linear-gradient(160deg,#100b06,#1a1209);border:1px solid rgba(197,160,89,.45);border-radius:18px;padding:36px 30px;max-width:440px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(197,160,89,.18)}'+
    '#aria5Modal h2{font-family:Cinzel,serif;color:#c5a059;font-size:24px;margin:0 0 12px;letter-spacing:.02em}'+
    '#aria5Modal p{color:rgba(255,255,255,.78);margin:0 0 22px;line-height:1.55;font-size:15px}'+
    '#aria5Modal a{display:inline-block;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;margin:6px;font-size:14px;letter-spacing:.02em;transition:transform .15s}'+
    '#aria5Modal a.a5-primary{background:linear-gradient(135deg,#c5a059,#9d7a3a);color:#0a0805}'+
    '#aria5Modal a.a5-secondary{background:transparent;border:1px solid rgba(197,160,89,.45);color:#c5a059}'+
    '#aria5Modal a:hover{transform:translateY(-2px)}'+
    '@keyframes aria5Fade{from{opacity:0}to{opacity:1}}';
  var st=document.createElement('style');st.id='aria5style';st.textContent=css;document.head.appendChild(st);
  function intercept(){
    var fab=document.getElementById('ariaFab');
    if(!fab) return;
    fab.addEventListener('click',function(e){
      if(fab.classList.contains('aria-locked-fab')){ e.preventDefault(); e.stopPropagation(); window.location.href='/plans'; }
    },true);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',intercept);}else{intercept();}
  function isAriaPage(){var p=location.pathname;return p==='/aria' || p==='/aria/' || /aria(\\.html)?$/i.test(p);}
  if(!isAriaPage()) return;
  var KEY='aria_standalone_5min_v1';
  var DUR=5*60*1000;
  var start=Number(localStorage.getItem(KEY))||0;
  if(!start){start=Date.now();try{localStorage.setItem(KEY,String(start));}catch(e){}}
  function showModal(){
    if(document.getElementById('aria5Modal')) return;
    var d=document.createElement('div');d.id='aria5Modal';
    d.innerHTML='<div class="a5-card"><h2>Your ARIA preview has ended</h2><p>5 minutes is just a taste. Pick a plan to keep working with ARIA, or head back to the homepage.</p><a href="/plans" class="a5-primary">View Plans &amp; Pricing</a><a href="/" class="a5-secondary">Return to Homepage</a></div>';
    document.body.appendChild(d);
    var f=document.getElementById('ariaFab');if(f) f.classList.add('aria-locked-fab');
    document.body.style.overflow='hidden';
  }
  var elapsed=Date.now()-start;
  if(elapsed>=DUR){showModal();return;}
  setTimeout(showModal, DUR-elapsed);
})();


/* Voice interrupt grammar + Get IT Support modal (lead capture) */
(function(){
  var INTERRUPT=/\b(pause|stop|wait|hold on|one sec|one second|hang on|halt)\b/i;
  var RESUME=/\b(continue|go on|keep going|resume|carry on|proceed)\b/i;
  var REPEAT=/\b(repeat|say that again|once more|go back)\b/i;
  var lastUtter='';
  if (typeof window.ariaSpeakText==='function'){
    var origSpeak=window.ariaSpeakText;
    window.ariaSpeakText=function(text){lastUtter=text||'';return origSpeak.apply(this,arguments);};
  }
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var rec=null,recOn=false;
  function startInterruptListener(){
    if (!SR||recOn) return;
    try {
      rec=new SR();rec.continuous=true;rec.interimResults=true;rec.lang='en-US';
      rec.onresult=function(ev){
        for (var i=ev.resultIndex;i<ev.results.length;i++){
          var t=ev.results[i][0].transcript||'';
          if (INTERRUPT.test(t)) { try { window.speechSynthesis.pause(); } catch(e){} }
          else if (RESUME.test(t)) { try { window.speechSynthesis.resume(); } catch(e){} }
          else if (REPEAT.test(t) && lastUtter) { try { window.speechSynthesis.cancel(); } catch(e){} if (typeof window.ariaSpeakText==='function') window.ariaSpeakText(lastUtter); }
        }
      };
      rec.onerror=function(){recOn=false;};rec.onend=function(){recOn=false;};
      rec.start();recOn=true;
    } catch(e){recOn=false;}
  }
  function stopInterruptListener(){if (rec&&recOn){try{rec.stop();}catch(e){}recOn=false;}}
  if (window.speechSynthesis){
    var orig2=window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak=function(u){startInterruptListener();if(u&&!u.onend){u.onend=function(){setTimeout(function(){if(!window.speechSynthesis.speaking)stopInterruptListener();},800);};}return orig2(u);};
  }
  function gisCSS(){
    if (document.getElementById('gisStyle')) return;
    var css='#gisModal{position:fixed;inset:0;background:rgba(8,5,2,.78);backdrop-filter:blur(8px);z-index:99998;display:flex;align-items:center;justify-content:center}'
      +'#gisModal .gis-card{background:linear-gradient(160deg,#100b06,#1a1209);border:1px solid rgba(197,160,89,.45);border-radius:16px;padding:30px 28px;max-width:480px;width:92%;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(197,160,89,.18)}'
      +'#gisModal h3{font-family:Cinzel,serif;color:#c5a059;font-size:22px;margin:0 0 8px}'
      +'#gisModal p.gis-sub{color:rgba(255,255,255,.72);margin:0 0 20px;font-size:14px;line-height:1.5}'
      +'#gisModal label{display:block;color:rgba(241,220,167,.85);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin:14px 0 6px}'
      +'#gisModal input,#gisModal textarea{width:100%;background:rgba(0,0,0,.45);border:1px solid rgba(197,160,89,.28);border-radius:8px;padding:10px 12px;color:#fff;font-size:14px;font-family:inherit;box-sizing:border-box}'
      +'#gisModal textarea{min-height:90px;resize:vertical}'
      +'#gisModal .gis-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end}'
      +'#gisModal button{padding:10px 18px;border-radius:8px;border:none;font-weight:600;cursor:pointer;font-size:14px;font-family:inherit}'
      +'#gisModal .gis-send{background:linear-gradient(135deg,#c5a059,#9d7a3a);color:#0a0805}'
      +'#gisModal .gis-cancel{background:transparent;border:1px solid rgba(197,160,89,.4);color:#c5a059}'
      +'#gisModal .gis-msg{margin-top:12px;font-size:13px;color:#b8e6b0}'
      +'#gisModal .gis-err{color:#e6a0a0}'
      +'#gisModal .gis-hp{display:none}';
    var st=document.createElement('style');st.id='gisStyle';st.textContent=css;document.head.appendChild(st);
  }
  function showGIS(){
    if (document.getElementById('gisModal')) return;
    gisCSS();
    var d=document.createElement('div');d.id='gisModal';
    d.innerHTML='<div class="gis-card"><h3>Get IT Support</h3><p class="gis-sub">Tell us what you need help with. We email back fast.</p>'
      +'<form name="get-it-support" data-netlify="true" netlify-honeypot="bot-field" method="POST">'
      +'<input type="hidden" name="form-name" value="get-it-support">'
      +'<p class="gis-hp"><input name="bot-field"></p>'
      +'<label>Your name</label><input type="text" name="name" required>'
      +'<label>Email</label><input type="email" name="email" required>'
      +'<label>Phone (optional)</label><input type="tel" name="phone">'
      +'<label>What do you need help with?</label><textarea name="issue" required></textarea>'
      +'<div class="gis-msg" id="gisMsg"></div>'
      +'<div class="gis-actions"><button type="button" class="gis-cancel" id="gisCancel">Cancel</button><button type="submit" class="gis-send">Send to Support</button></div>'
      +'</form></div>';
    document.body.appendChild(d);
    document.getElementById('gisCancel').onclick=function(){d.remove();};
    var form=d.querySelector('form');
    form.onsubmit=function(ev){
      ev.preventDefault();
      var fd=new FormData(form);var body=new URLSearchParams();fd.forEach(function(v,k){body.append(k,v);});
      var msg=document.getElementById('gisMsg');msg.textContent='Sending...';msg.className='gis-msg';
      fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()})
        .then(function(r){if(r.ok){msg.textContent='Sent. We will reply to your email shortly.';setTimeout(function(){d.remove();},2200);}else{msg.textContent='Send failed. Email ahmad.wasee@iisupp.net directly.';msg.className='gis-msg gis-err';}})
        .catch(function(){msg.textContent='Send failed. Email ahmad.wasee@iisupp.net directly.';msg.className='gis-msg gis-err';});
    };
  }
  window.openGetItSupport=showGIS;
  function wireChatFab(){
    var cf=document.getElementById('chatFab');
    if (!cf||cf.__gisHooked) return;
    cf.__gisHooked=true;
    cf.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();showGIS();},true);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',wireChatFab); else wireChatFab();
  setTimeout(wireChatFab,1500);
  function injectStaticForm(){
    if (document.getElementById('gisStaticForm')) return;
    var hf=document.createElement('form');hf.id='gisStaticForm';
    hf.setAttribute('name','get-it-support');
    hf.setAttribute('data-netlify','true');
    hf.setAttribute('netlify-honeypot','bot-field');
    hf.style.display='none';
    hf.innerHTML='<input name="form-name" value="get-it-support"><input name="bot-field"><input name="name"><input name="email"><input name="phone"><textarea name="issue"></textarea>';
    if (document.body) document.body.appendChild(hf);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',injectStaticForm); else injectStaticForm();
})();


(function(){
  if (document.getElementById('aria-suggestion-style')) return;
  var st = document.createElement('style');
  st.id = 'aria-suggestion-style';
  st.textContent = `@keyframes ariaSuggPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(241,220,167,0.45), 0 4px 14px rgba(0,0,0,0.4); } 50% { transform: scale(1.03); box-shadow: 0 0 24px 6px rgba(241,220,167,0.55), 0 6px 20px rgba(0,0,0,0.5); } } .aria-link-list.aria-suggestions { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 10px; } .aria-suggestion-item { display: block; width: 100%; padding: 12px 18px; background: linear-gradient(135deg, #c5a059 0%, #f1dca7 50%, #b38728 100%); color: #0a0a0a; border: 1px solid rgba(241,220,167,0.5); border-radius: 12px; font-family: 'Cinzel', serif; font-size: 14px; font-weight: 700; letter-spacing: 0.05em; text-align: center; cursor: pointer; animation: ariaSuggPulse 2.6s ease-in-out infinite; transition: transform .25s ease, filter .25s ease, box-shadow .25s ease; } .aria-suggestion-item:hover { transform: scale(1.06); filter: brightness(1.08); animation-play-state: paused; } .aria-suggestion-item:active { transform: scale(0.97); }`;
  document.head.appendChild(st);
})();


(function(){
  if (document.getElementById('aria-trial-unlock-style')) return;
  var st = document.createElement('style');
  st.id = 'aria-trial-unlock-style';
  st.textContent = `body.aria-trial-active.overflow-hidden, body.overflow-hidden.aria-trial-active { overflow-y: auto !important; overflow-x: hidden !important; } body.aria-trial-active #aria-trial-bar ~ * { /* let content scroll naturally */ }`;
  document.head.appendChild(st);
})();
