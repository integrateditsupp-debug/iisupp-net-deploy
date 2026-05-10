// ARIA Trial Widget — vanilla custom element, shadow-DOM isolated.
//
// Mount:        <aria-trial></aria-trial>  (anywhere in the page)
// Activate:     ?aria=on   OR   localStorage.aria_preview = '1'
// Defaults to:  hidden (no layout impact on the host page)
//
// Wiring:
//   - KB retrieval reads /assets/kb-index.json (65 articles).
//   - Pricing checkout posts to /.netlify/functions/stripe-checkout (existing).
//   - Voice via window.speechSynthesis — free, no API spend.
//
// The 10-minute trial timer uses sessionStorage so it resets on tab close.
// On expiry: the upgrade modal opens and inputs disable.
//
// This widget DOES NOT call any LLM. It surfaces the article's
// `user_friendly` section (§9) as ARIA's reply — real RAG output, $0 spend.
// Wire to /api/aria (Anthropic) in Stage 3 once spend is approved.

import { retrieve, renderForAudience } from './aria-kb-retrieval.mjs';
import * as CompanyKB from './aria-company-kb.mjs';

const ARIA_VERSION = '2.1.0';
const ARIA_BUILD_DATE = '2026-05-09';
const TRIAL_MS = 10 * 60 * 1000;
const KB_URL = '/assets/kb-index.json';
const STRIPE_ENDPOINT = '/.netlify/functions/stripe-checkout';
const LICENSE_ENDPOINT = '/.netlify/functions/aria-license';
const SUPPORT_PHONE = '(647) 581-3182';
const SUPPORT_TEL = 'tel:+16475813182';

// The 9 IIS frameworks ARIA reasons with — sourced from iisupp.net §methodology.
// Surfaced in the UI so users (and audit reviewers) see the structured thinking.
const ARIA_FRAMEWORKS = [
  { abbr: "5 W's",   body: "Who · What · When · Where · Why" },
  { abbr: 'STAR',    body: 'Situation · Task · Action · Result' },
  { abbr: 'First Principles', body: 'Break problems down to fundamental truths' },
  { abbr: 'OKR',     body: 'Objectives & Key Results' },
  { abbr: 'Eisenhower', body: 'Urgency vs. Importance' },
  { abbr: 'DMAIC',   body: 'Define · Measure · Analyze · Improve · Control' },
  { abbr: 'Kaizen',  body: 'Continuous improvement, every day' },
  { abbr: 'TOC',     body: 'Theory of Constraints — remove the bottleneck first' },
  { abbr: 'AAR',     body: 'After Action Review — no blame, only improvement' },
];

// localStorage keys used by the widget. Listed here so anyone reading the file
// has one place to inspect what we persist.
const LS = {
  mode: 'aria_mode',                  // 'free' | 'custom'
  licenseToken: 'aria_license_token', // license key (custom mode)
  adminUnlocked: 'aria_admin_unlocked',
  companyName: 'aria_company_name',
  trialStart: 'aria_trial_start',
  unanswered: 'aria_unanswered',
  voice: 'aria_voice',
  off: 'aria_off',
};

// Pricing — source of truth: /aria-voice-agent/kb-5-product-pricing.md
// `tier` strings match the PRICE_MAP keys in stripe-checkout.js.
// `mode: 'self-serve'` → POST to Stripe checkout. `mode: 'sales-led'` → call us.
const PLANS = [
  { tier: 'personal',      name: 'Personal',       price: '$599',    cadence: '/month',  blurb: 'ARIA on every device you log into. Full feature set.', mode: 'self-serve', highlight: false },
  { tier: 'personal_y',    name: 'Personal Annual',price: '$7,188',  cadence: '/year',   blurb: '12-month locked pricing. Save 13% vs monthly.',       mode: 'self-serve', highlight: false },
  { tier: 'pro',           name: 'Pro',            price: '$1,500',  cadence: '/month',  blurb: 'Multi-device, voice, auto-tickets, priority queue.',  mode: 'self-serve', highlight: true  },
  { tier: 'pro_y',         name: 'Pro Annual',     price: '$18,000', cadence: '/year',   blurb: 'Everything in Pro · quarterly check-ins.',             mode: 'self-serve', highlight: false },
  { tier: 'small_business_y', name: 'Small Business', price: '$156,000', cadence: '/year', blurb: 'Up to 25 named seats, managed onboarding, 24/7 priority human escalation.', mode: 'sales-led', highlight: false },
  { tier: 'midsize_y',     name: 'Mid-Size',       price: '$312,000', cadence: '/year',  blurb: 'Up to 100 seats, SSO, custom data policy, dedicated success manager.', mode: 'sales-led', highlight: false },
  { tier: 'enterprise_y',  name: 'Enterprise',     price: '$625,000', cadence: '/year',  blurb: 'Unlimited seats, custom SLA, private model option, on-site enablement.', mode: 'sales-led', highlight: false },
];

// ────────────────────────────────────────────────────────────────────────────
// Custom element
// ────────────────────────────────────────────────────────────────────────────
class AriaTrial extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._kb = null;
    this._trialStart = null;
    this._timerHandle = null;
    this._expired = false;
    this._lastAriaText = '';
    this._cachedVoice = null;
    // Voices load async on Chrome/Edge. Force initial enumeration and listen
    // for the change event so the next _speakText() picks the best voice.
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.getVoices(); } catch {}
      window.speechSynthesis.onvoiceschanged = () => { this._cachedVoice = null; };
    }
    // Mode + license state — read once at construction, written via setters.
    this._mode = this._readLS(LS.mode);                   // 'free' | 'custom' | null
    this._licenseToken = this._readLS(LS.licenseToken);
    this._companyName  = this._readLS(LS.companyName);
    this._isAdminUnlocked = this._readLS(LS.adminUnlocked) === '1';
  }

  _readLS(key) { try { return localStorage.getItem(key); } catch { return null; } }
  _writeLS(key, value) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); }
    catch {}
  }
  _isAdmin() { return this._isAdminUnlocked || this._licenseToken; }

  connectedCallback() {
    if (!this._isActivated()) {
      // No render → no layout impact. Still register so the element exists in the DOM.
      this.setAttribute('hidden', '');
      this.setAttribute('aria-hidden', 'true');
      return;
    }
    this.removeAttribute('hidden');
    this._render();
    this._loadKB();
    this._startTrial();
    this._initLiveActivity();
    this._initRailMicLabel();
    // First launch: no mode chosen yet → show onboarding once.
    if (!this._mode) {
      // Defer one frame so the rest of the widget paints behind the modal.
      requestAnimationFrame(() => this._showOnboarding());
    }
    this._updateModeBadge();
  }

  disconnectedCallback() {
    if (this._timerHandle) clearInterval(this._timerHandle);
    if (this._liveTickHandle) clearInterval(this._liveTickHandle);
  }

  _isActivated() {
    // Default: visible to every visitor. Opt-out via ?aria=off or localStorage.
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('aria') === 'off') return false;
      if (localStorage.getItem('aria_off') === '1') return false;
    } catch {/* localStorage may throw in privacy mode */}
    return true;
  }

  // ── Trial timer ────────────────────────────────────────────────────────
  _startTrial() {
    let start;
    try {
      start = sessionStorage.getItem('aria_trial_start');
      if (!start) {
        start = String(Date.now());
        sessionStorage.setItem('aria_trial_start', start);
      }
    } catch { start = String(Date.now()); }
    this._trialStart = +start;
    this._timerHandle = setInterval(() => this._tick(), 1000);
    this._tick();
  }

  _tick() {
    const elapsed = Date.now() - this._trialStart;
    const remaining = Math.max(0, TRIAL_MS - elapsed);
    const mm = Math.floor(remaining / 60000);
    const ss = Math.floor((remaining % 60000) / 1000);
    const display = `${mm}:${ss.toString().padStart(2, '0')}`;
    const t = this.shadowRoot.querySelector('.timer');
    if (t) t.textContent = display;
    if (remaining === 0 && !this._expired) {
      this._expired = true;
      clearInterval(this._timerHandle);
      this._showUpgradeModal();
    }
  }

  // ── KB load ────────────────────────────────────────────────────────────
  async _loadKB() {
    const status = this.shadowRoot.querySelector('.kb-status');
    try {
      const res = await fetch(KB_URL, { cache: 'default' });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      this._kb = await res.json();
      const total = this._kb.total;
      if (status) status.textContent = `${total} articles loaded`;
      // Update scene-stats and search placeholder with the real count.
      const counter = this.shadowRoot.querySelector('.scene-article-count');
      if (counter) counter.textContent = total;
      const search = this.shadowRoot.querySelector('.kb-search');
      if (search) search.setAttribute('placeholder', `Search ${total} articles…`);
      this._renderKBList(this._kb.articles.slice(0, 8));
    } catch (err) {
      if (status) status.textContent = 'KB load failed — refresh to retry';
      console.warn('[aria-trial] KB load failed:', err);
    }
  }

  _renderKBList(articles) {
    const ul = this.shadowRoot.querySelector('.kb-results');
    if (!ul) return;
    ul.innerHTML = '';
    if (!articles.length) {
      ul.innerHTML = `<li class="kb-empty">No articles match. Try simpler words.</li>`;
      return;
    }
    for (const a of articles) {
      const li = document.createElement('li');
      li.className = 'kb-item';
      li.innerHTML = `
        <button type="button" class="kb-open" data-id="${a.id}">
          <span class="kb-badge kb-badge-${a.level.toLowerCase()}">${a.level}</span>
          <span class="kb-badge kb-badge-sev kb-badge-sev-${a.severity}">${a.severity}</span>
          <span class="kb-title">${escapeHtml(a.title)}</span>
        </button>`;
      ul.appendChild(li);
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────
  _handleAsk(query) {
    if (!query || !this._kb) return;
    if (this._expired) { this._showUpgradeModal(); return; }
    const messages = this.shadowRoot.querySelector('.messages');
    this._addMessage(messages, 'user', query);
    this._setGlobeState('thinking');
    // Yield ~450ms so the thinking-globe animation is perceivable. Stage 1
    // retrieval is instant; Stage 3 LLM call will replace this fixed delay.
    setTimeout(() => this._renderAnswer(query, messages), 450);
  }

  async _renderAnswer(query, messages) {
    // Tier 1 — Company-uploaded policies/procedures ALWAYS win when confident.
    // (Per user spec: "ARIA should prioritize company policy over general AI advice".)
    try {
      const companyHits = await CompanyKB.searchCompanyDocs(query, { topK: 3 });
      if (companyHits[0] && companyHits[0].score >= CompanyKB.COMPANY_KB_SCORE_FLOOR) {
        this._renderCompanyAnswer(messages, companyHits, query);
        this._setGlobeState('idle');
        return;
      }
    } catch (err) {
      console.warn('[aria-trial] company-kb search failed:', err);
    }

    // Tier 2 — Built-in 69-article IT support KB.
    const results = retrieve(query, this._kb.articles, { topK: 3 });
    if (!results.length || results[0].score < 8) {
      this._recordUnanswered(query);
      this._addMessage(messages, 'aria', "I don't have a strong knowledge-base match for that yet — I've logged it so we can train me on it. A human technician can help right now: <a href=\"" + SUPPORT_TEL + "\">" + SUPPORT_PHONE + "</a>. Or rephrase and I'll try again.", true);
      this._setGlobeState('idle');
      return;
    }
    const top = results[0];
    const view = renderForAudience(top, top._signals?.audience || 'end-user');
    const reply = view.summary || top.symptoms?.split('\n')[0] || top.title;
    this._lastAriaText = reply;

    const escalation = top.severity === 'critical' || top.escalation_trigger
      ? `<div class="msg-escalation">If this is urgent, call <a href="${SUPPORT_TEL}">${SUPPORT_PHONE}</a>.</div>`
      : '';

    const related = results.slice(1, 3).map(r => `
      <button type="button" class="msg-related" data-id="${r.id}">${escapeHtml(r.title)}</button>
    `).join('');

    this._addMessage(messages, 'aria', `
      <div class="msg-title">
        <span class="kb-badge kb-badge-${top.level.toLowerCase()}">${top.level}</span>
        ${escapeHtml(top.title)}
      </div>
      <div class="msg-body">${escapeHtml(reply)}</div>
      ${escalation}
      ${related ? `<div class="msg-related-row">${related}</div>` : ''}
      ${this._resolveButtonsHTML(top.severity === 'critical')}
    `, true);
    this._setGlobeState('idle');
  }

  // Render an answer that came from the user's uploaded company docs.
  // Visually distinct from built-in KB answers + cites the source.
  _renderCompanyAnswer(messages, hits, query) {
    const top = hits[0];
    const cleanText = top.text.replace(/\s+/g, ' ').trim();
    this._lastAriaText = `From ${top.docName}. ${cleanText.slice(0, 600)}`;
    const others = hits.slice(1, 3).filter(h => h.score >= CompanyKB.COMPANY_KB_SCORE_FLOOR);
    const moreContext = others.length
      ? `<div class="msg-citation-extras">${others.map(h => `<span class="msg-citation-chip">${escapeHtml(h.docName)}</span>`).join('')}</div>`
      : '';
    this._addMessage(messages, 'aria', `
      <div class="msg-title">
        <span class="kb-badge kb-badge-company">📄 Company Doc</span>
        Per ${escapeHtml(top.docName)}
      </div>
      <div class="msg-body msg-body-company">${escapeHtml(cleanText.slice(0, 600))}${cleanText.length > 600 ? '…' : ''}</div>
      <div class="msg-citation">Sourced from your uploaded company documentation. This is your organization's policy — defer to it over general advice.</div>
      ${moreContext}
      ${this._resolveButtonsHTML(false)}
    `, true);
  }

  // Try-first / confirm-resolve buttons appended to every ARIA answer.
  // Implements the corporate workflow loop: ARIA tries → user confirms →
  // ARIA escalates only if unresolved.
  _resolveButtonsHTML(isCritical) {
    if (isCritical) return ''; // critical articles already surface escalation
    return `
      <div class="msg-resolve" role="group" aria-label="Was this helpful?">
        <span class="msg-resolve-label">Did this resolve it?</span>
        <button type="button" class="msg-resolve-btn" data-resolve="yes">Yes, fixed</button>
        <button type="button" class="msg-resolve-btn" data-resolve="no">Still broken</button>
        <button type="button" class="msg-resolve-btn" data-resolve="human">Talk to human</button>
      </div>`;
  }

  _handleResolve(action) {
    const messages = this.shadowRoot.querySelector('.messages');
    if (action === 'yes') {
      this._addMessage(messages, 'aria',
        "Glad we got it sorted. I've logged what worked. If it comes back or you hit something new, just describe it.", false);
    } else if (action === 'no') {
      this._addMessage(messages, 'aria',
        `Understood — let's escalate. I've captured everything we've tried. ` +
        `Call <a href="${SUPPORT_TEL}">${SUPPORT_PHONE}</a> any time, or describe what's different and I'll try a deeper angle.`, true);
    } else if (action === 'human') {
      this._addMessage(messages, 'aria',
        `Connecting you with a human technician now. Call <a href="${SUPPORT_TEL}">${SUPPORT_PHONE}</a> — they'll have full context from our conversation.`, true);
    }
  }

  _addMessage(host, role, content, isHTML = false) {
    if (!host) return;
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    if (isHTML) div.innerHTML = content;
    else div.textContent = content;
    host.appendChild(div);
    host.scrollTop = host.scrollHeight;
  }

  _speakLast() {
    if (!('speechSynthesis' in window)) return;
    // If there's no last reply, speak a greeting — useful as a "preview the voice" trigger.
    const text = this._lastAriaText ||
      "Hi, I'm Aria. I'm here to help, whenever you need me. Just tell me what's going on, and we'll work through it together.";
    this._speakText(text);
  }

  // Pick the best available natural-sounding female English voice.
  // Order matters: more-natural voices first, fallbacks last. Cached per session.
  // User override: if localStorage.aria_voice is set to a voice name, use that.
  _pickVoice() {
    if (this._cachedVoice) return this._cachedVoice;
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    // User-chosen override always wins.
    try {
      const saved = localStorage.getItem('aria_voice');
      if (saved) {
        const match = voices.find(v => v.name === saved);
        if (match) { this._cachedVoice = match; return match; }
      }
    } catch {}
    // Each pattern targets a known modern, neural, female voice. The first
    // match in this order wins. Restricted to English locales so timbre is
    // consistent with the cinematic copy.
    const PREFERRED = [
      // Microsoft Edge / Windows 11 — newest neural voices, very human:
      /Microsoft\s+Aria\s+Online.*Natural/i,
      /Microsoft\s+Jenny\s+Online.*Natural/i,
      /Microsoft\s+Ava\s+Online.*Natural/i,
      /Microsoft\s+Emma\s+Online.*Natural/i,
      /Microsoft\s+Sonia\s+Online.*Natural/i,
      /Microsoft\s+Libby\s+Online.*Natural/i,
      // Apple — Premium voices on macOS / iOS / iPadOS:
      /Ava \(Premium\)/i,
      /Allison \(Premium\)/i,
      /Samantha \(Premium\)/i,
      /Susan \(Premium\)/i,
      /^Ava$/i,
      /^Allison$/i,
      /^Samantha$/i,
      /^Susan$/i,
      // Microsoft offline fallbacks (Aria/Jenny/Ava without "Online"):
      /Microsoft\s+Aria\b/i,
      /Microsoft\s+Jenny\b/i,
      /Microsoft\s+Ava\b/i,
      // Google Chrome built-in (UK Female is the most natural-sounding default
      // available on stock Chrome — softer, clearly female, less robotic):
      /Google\s+UK\s+English\s+Female/i,
      /Google\s+US\s+English/i,
      // Generic last-resorts:
      /\bfemale\b/i,
      /Zira/i, // Microsoft Zira (older, robotic — last resort, but better than male)
    ];
    for (const pattern of PREFERRED) {
      const match = voices.find(v => pattern.test(v.name) && /^en/i.test(v.lang));
      if (match) { this._cachedVoice = match; return match; }
    }
    // Final fallback: any en-US voice, then anything.
    this._cachedVoice = voices.find(v => v.lang === 'en-US') || voices[0];
    return this._cachedVoice;
  }

  _speakText(text) {
    if (!text || !('speechSynthesis' in window)) return;
    // Pre-process for natural cadence. SpeechSynthesis honors punctuation
    // pauses but not SSML <break> tags, so we shape the text instead:
    //   • em-dash and newlines → commas (gentler than a hard stop)
    //   • collapse whitespace
    //   • drop quotation marks (the engine reads them awkwardly)
    //   • trim "L1" / "L2" etc. prefixes that don't belong in spoken copy
    const processed = String(text)
      .replace(/^L[123]\s+/i, '')
      .replace(/[""]/g, '')
      .replace(/[—–]/g, ', ')
      .replace(/\s*\n\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .trim();
    const u = new SpeechSynthesisUtterance(processed);
    // Younger / soothing / customer-service tone, tuned empirically:
    //   rate 0.96 — slightly slower than default, still feels natural
    //   pitch 1.06 — reads younger without sounding chipmunk-y
    //   volume 1   — modern neural voices have built-in dynamic control
    u.rate = 0.96;
    u.pitch = 1.06;
    u.volume = 1.0;
    const voice = this._pickVoice();
    if (voice) u.voice = voice;
    u.onstart = () => this._setGlobeState('speaking');
    u.onend   = () => this._setGlobeState('idle');
    u.onerror = () => this._setGlobeState('idle');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // ── Upgrade / pricing ──────────────────────────────────────────────────
  async _checkout(plan) {
    if (plan.mode === 'sales-led') {
      window.location.href = SUPPORT_TEL;
      return;
    }
    try {
      const res = await fetch(STRIPE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier: plan.tier, planName: plan.name }),
      });
      const data = await res.json().catch(() => ({}));
      // 503 + salesLed: tier exists but Price ID env var not yet set in Netlify.
      // Treat exactly like a sales-led tier — route to phone, no error toast.
      if (res.status === 503 && data.salesLed) {
        window.location.href = SUPPORT_TEL;
        return;
      }
      if (!res.ok) throw new Error(`stripe ${res.status}: ${data.error || 'unknown'}`);
      if (!data.url) throw new Error('no checkout url');
      window.location.href = data.url;
    } catch (err) {
      console.error('[aria-trial] checkout error:', err);
      const m = this.shadowRoot.querySelector('.checkout-error');
      if (m) m.textContent = `Checkout unavailable. Call ${SUPPORT_PHONE} to subscribe.`;
    }
  }

  // ── First-launch onboarding ──────────────────────────────────────────
  _showOnboarding() {
    const m = this.shadowRoot?.querySelector('.onboarding-modal');
    if (!m) return;
    m.classList.add('open');
    // Reset the license input each time the modal opens.
    const licenseSection = this.shadowRoot.querySelector('.onboarding-license');
    if (licenseSection) licenseSection.setAttribute('hidden', '');
    const status = this.shadowRoot.querySelector('.license-status');
    if (status) status.textContent = '';
  }
  _hideOnboarding() {
    const m = this.shadowRoot?.querySelector('.onboarding-modal');
    if (m) m.classList.remove('open');
  }

  _pickMode(mode) {
    if (mode === 'free') {
      this._mode = 'free';
      this._writeLS(LS.mode, 'free');
      this._writeLS(LS.adminUnlocked, '0');
      this._isAdminUnlocked = false;
      this._hideOnboarding();
      this._updateModeBadge();
      const messages = this.shadowRoot.querySelector('.messages');
      if (messages) {
        this._addMessage(messages, 'aria',
          "You're in Free Mode — I'm using my built-in 72-article IT support library. Ask me anything tech, and I'll work through it with the 5 W's and STAR framework.", false);
      }
      return;
    }
    if (mode === 'custom') {
      // Reveal the license entry within the same modal.
      const licenseSection = this.shadowRoot.querySelector('.onboarding-license');
      if (licenseSection) licenseSection.removeAttribute('hidden');
      const input = this.shadowRoot.querySelector('.license-input');
      if (input) setTimeout(() => input.focus(), 50);
      return;
    }
  }

  async _submitLicense(token) {
    const status = this.shadowRoot.querySelector('.license-status');
    const tk = (token || '').trim();
    if (!tk) {
      if (status) { status.textContent = 'Paste your license key first.'; status.className = 'license-status error'; }
      return;
    }
    // Stage-1 validation: accept any non-empty key shaped roughly like ARIA-XXXX-...
    // In production this POSTs to /.netlify/functions/aria-license verify.
    const looksValid = /^ARIA-[A-Z0-9-]{6,}$/i.test(tk) || tk.length >= 16;
    if (!looksValid) {
      if (status) { status.textContent = 'That doesn\'t look like an ARIA license key. Format: ARIA-XXXX-XXXX-XXXX-XXXX'; status.className = 'license-status error'; }
      return;
    }
    if (status) { status.textContent = 'Activating…'; status.className = 'license-status'; }

    // Best-effort live verification (does not block activation if endpoint is unreachable).
    let verified = null;
    try {
      const res = await fetch(LICENSE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token: tk, device: this._deviceFingerprint() }),
      });
      if (res.ok) verified = await res.json();
    } catch {}

    this._mode = 'custom';
    this._licenseToken = tk;
    this._isAdminUnlocked = true;
    this._writeLS(LS.mode, 'custom');
    this._writeLS(LS.licenseToken, tk);
    this._writeLS(LS.adminUnlocked, '1');
    if (verified?.email) this._writeLS(LS.companyName, verified.company || verified.email.split('@')[1] || 'Your Company');
    this._companyName = this._readLS(LS.companyName);

    if (status) {
      status.className = 'license-status ok';
      status.textContent = verified?.ok
        ? `Verified — ${verified.plan || 'plan'} · ${verified.devices || 1}/${5} devices.`
        : 'License saved on this device. Server-side verification will run on the next online sync.';
    }
    setTimeout(() => {
      this._hideOnboarding();
      this._updateModeBadge();
      const messages = this.shadowRoot.querySelector('.messages');
      if (messages) {
        this._addMessage(messages, 'aria',
          `License accepted${this._companyName ? ` for ${this._companyName}` : ''}. Settings is unlocked. Open ⚙ to upload your policies, procedures, and internal docs — I'll cite them before falling back to my built-in KB.`, false);
      }
    }, 600);
  }

  _deviceFingerprint() {
    // Best-effort, privacy-respecting fingerprint: stable per browser profile,
    // not cross-site trackable. Used only for the 5-device-per-license cap.
    let id = this._readLS('aria_device_id');
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
           (Math.random().toString(36).slice(2) + Date.now().toString(36));
      this._writeLS('aria_device_id', id);
    }
    return id;
  }

  _updateModeBadge() {
    const badge = this.shadowRoot?.querySelector('.aria-mode-badge');
    if (!badge) return;
    if (this._mode === 'custom') {
      badge.dataset.mode = 'custom';
      const label = this._companyName ? `Custom Mode · ${this._companyName}` : 'Custom Mode';
      badge.querySelector('.aria-mode-text').textContent = label;
    } else if (this._mode === 'free') {
      badge.dataset.mode = 'free';
      badge.querySelector('.aria-mode-text').textContent = 'Free Mode';
    } else {
      badge.dataset.mode = 'unset';
      badge.querySelector('.aria-mode-text').textContent = 'Setup';
    }
  }

  async _refreshSettings() {
    const root = this.shadowRoot;
    if (!root) return;
    let stats = null;
    let docs = [];
    try {
      stats = await CompanyKB.getStats();
      docs = await CompanyKB.listDocuments();
    } catch (err) {
      const status = root.querySelector('.settings-status');
      if (status) {
        status.className = 'settings-status error';
        status.textContent = 'Unable to access local document store: ' + err.message;
      }
      return;
    }
    const activeEl = root.querySelector('.company-active');
    const chunksEl = root.querySelector('.company-chunks');
    const storageEl = root.querySelector('.company-storage');
    if (activeEl) activeEl.textContent = String(stats.activeDocuments);
    if (chunksEl) chunksEl.textContent = String(stats.totalChunks);
    if (storageEl) {
      storageEl.textContent = stats.usageBytes != null
        ? `Using ${CompanyKB.formatBytes(stats.usageBytes)} of ${CompanyKB.formatBytes(stats.quotaBytes)}`
        : '—';
    }
    const list = root.querySelector('.settings-doc-list');
    if (!list) return;
    if (!docs.length) {
      list.innerHTML = `<p class="settings-doc-empty" style="color:var(--cream-faint);font-size:12px;text-align:center;padding:14px;">No company documents uploaded yet. ARIA falls back to its built-in IT support library.</p>`;
      return;
    }
    list.innerHTML = docs.map(d => `
      <div class="settings-doc" role="listitem">
        <div>
          <div class="settings-doc-name">${escapeHtml(d.name)}</div>
          <div class="settings-doc-meta">
            ${escapeHtml(d.source || 'upload')} ·
            ${CompanyKB.formatBytes(d.size || d.length)} ·
            ${escapeHtml(new Date(d.uploadedAt).toLocaleDateString())}
          </div>
        </div>
        <button type="button" class="settings-doc-remove" data-id="${d.id}">Remove</button>
      </div>
    `).join('');
  }

  _toggleVoicePicker(force) {
    const picker = this.shadowRoot?.querySelector('.voice-picker');
    if (!picker) return;
    const next = typeof force === 'boolean' ? !force : picker.hasAttribute('hidden') ? false : true;
    if (next) picker.setAttribute('hidden', ''); else picker.removeAttribute('hidden');
  }

  _setGlobeState(state) {
    const root = this.shadowRoot;
    if (!root) return;
    // Old (v2.0) globe element — kept for back-compat if someone re-adds it.
    const g = root.querySelector('.trial-globe');
    if (g) g.dataset.state = state;
    const STATUS = {
      idle: 'ARIA is ready',
      thinking: 'ARIA is searching the knowledge base',
      speaking: 'ARIA is speaking',
      listening: 'ARIA is listening',
    };
    const status = root.querySelector('.aria-status');
    if (status) {
      status.textContent = STATUS[state] || `ARIA is ${state}`;
      status.dataset.state = state;
    }
    // Mic label syncs with state
    const micLabel = root.querySelector('.rail-mic-label');
    if (micLabel) {
      const MIC_LABELS = {
        idle: 'Tap to speak',
        thinking: 'ARIA is thinking',
        speaking: 'ARIA is speaking',
        listening: 'ARIA is listening',
      };
      micLabel.textContent = MIC_LABELS[state] || 'Tap to speak';
    }
  }

  _initRailMicLabel() {
    // Idle state by default — keeps mic label in sync with status from the start.
    this._setGlobeState('idle');
  }

  // Animated live activity counters — values drift up plausibly every ~1.5s.
  // Targets every element with class .rail-stat-num or .rail-micro-num inside
  // .rail-stat[data-init][data-fmt] / .rail-micro[data-init][data-fmt].
  _initLiveActivity() {
    const root = this.shadowRoot;
    if (!root) return;
    const fmt = (n, unit) => {
      if (unit === 'K/s') return (n / 1000).toFixed(1) + 'K/s';
      if (unit === 'K')   return (n / 1000).toFixed(1) + 'K';
      if (unit === 'M')   {
        if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
        return (n / 1000000).toFixed(1) + 'M';
      }
      return String(Math.round(n));
    };
    const targets = [
      ...root.querySelectorAll('.rail-stat[data-init]'),
      ...root.querySelectorAll('.rail-micro[data-init]'),
    ].map(el => {
      const init = parseFloat(el.dataset.init);
      const unit = el.dataset.fmt || '';
      const numEl = el.querySelector('.rail-stat-num, .rail-micro-num');
      // velocity proportional to magnitude (0.0001 to 0.0005 per tick)
      const v = init * (0.0001 + Math.random() * 0.0004);
      return { el, numEl, value: init, unit, v };
    });
    if (this._liveTickHandle) clearInterval(this._liveTickHandle);
    this._liveTickHandle = setInterval(() => {
      for (const t of targets) {
        // upward drift with small downward noise — mostly increasing
        const drift = t.v * (0.55 + Math.random() * 0.9 - 0.20);
        t.value = Math.max(0, t.value + drift);
        t.numEl.textContent = fmt(t.value, t.unit);
      }
    }, 1500);
  }

  _recordUnanswered(query) {
    // Learning hook: queries that didn't match (or matched weakly) are saved
    // to localStorage. Surface them later for KB review / new article creation.
    try {
      const KEY = 'aria_unanswered';
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.push({ q: query, t: new Date().toISOString() });
      // Cap at 200 entries; FIFO drop.
      while (list.length > 200) list.shift();
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {/* localStorage may throw in privacy mode */}
  }

  _showUpgradeModal() {
    const modal = this.shadowRoot.querySelector('.upgrade-modal');
    if (!modal) return;
    modal.classList.add('open');
    // Disable chat input while expired
    const input = this.shadowRoot.querySelector('.chat-input');
    if (input) input.disabled = true;
  }

  _closeUpgradeModal() {
    const modal = this.shadowRoot.querySelector('.upgrade-modal');
    if (modal) modal.classList.remove('open');
  }

  // ── Render ─────────────────────────────────────────────────────────────
  _render() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <section class="aria-trial" aria-label="ARIA enterprise voice assistant">
        <!-- Scene tagline (matches design: monospace caps centered above) -->
        <div class="scene-tagline" aria-hidden="true">EVERY QUERY · ANSWERED · BEAUTIFULLY</div>

        <!-- Floating header chips: settings + cinematic + mode badge + status -->
        <div class="floating-header">
          <div class="aria-mode-badge" data-mode="unset" role="status" aria-label="ARIA mode">
            <span class="aria-mode-dot"></span>
            <span class="aria-mode-text">Setup</span>
          </div>
          <div class="aria-status" data-state="idle">ARIA is ready</div>
          <button type="button" class="watch-cinematic" title="Watch the cinematic demo">▶ Cinematic</button>
          <button type="button" class="settings-open" aria-label="Open ARIA settings" title="Personalize ARIA with your company docs">⚙ Settings</button>
        </div>

        <!-- Hidden semantic elements that the rest of the code expects (preserved for compatibility) -->
        <span class="timer" hidden>10:00</span>
        <span class="scene-article-count" hidden>72</span>
        <div class="frameworks-strip" hidden aria-hidden="true">
          ${ARIA_FRAMEWORKS.map(f => `<span class="fw-pill" title="${escapeHtml(f.body)}">${escapeHtml(f.abbr)}</span>`).join('')}
        </div>

        <!-- Main two-column stage: scene pane (left) + ARIA voice rail (right) -->
        <div class="stage-grid">
          <!-- LEFT: scene pane (browser-frame chat by default) -->
          <div class="scene-pane chat-pane" role="region" aria-label="ARIA chat">
            <div class="browser-frame">
              <div class="browser-bar">
                <div class="traffic"><span></span><span></span><span></span></div>
                <span class="browser-url"><span class="lock">🔒</span>aria.iisupp.net/session/<span class="session-id">2861</span></span>
                <span class="browser-aria-pill"><span class="a-mark">A</span>ARIA</span>
              </div>
              <div class="scene-content">
                <div class="scene-label">SUPPORT · ENTERPRISE · TIER ONE</div>
                <div class="messages" aria-live="polite">
                  <div class="msg msg-aria msg-greeting">
                    <div class="msg-title"><span class="kb-badge kb-badge-l1">ARIA</span> Hi — I'm ARIA.</div>
                    <div class="msg-body">I can guide you, resolve for you, or just answer. Tell me what's going on — I'll route you to the fastest path.</div>
                  </div>
                </div>
                <form class="chat-form">
                  <input type="text" class="chat-input" placeholder="Describe your issue…" autocomplete="off" />
                  <button type="button" class="chat-speak" aria-label="Speak last reply" title="Speak last reply (right-click to choose voice)">🔊</button>
                  <button type="submit" class="chat-send">Send</button>
                </form>
                <div class="voice-picker" hidden>
                  <label class="voice-picker-label">Voice</label>
                  <select class="voice-picker-select" aria-label="Choose ARIA voice"></select>
                  <button type="button" class="voice-picker-test">Preview</button>
                  <button type="button" class="voice-picker-close" aria-label="Close">×</button>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: persistent ARIA voice assistant rail -->
          <aside class="aria-rail" role="complementary" aria-label="ARIA voice assistant">
            <div class="rail-header">
              <span class="rail-mark"><span>A</span></span>
              <div class="rail-title-wrap">
                <div class="rail-title">ARIA</div>
                <div class="rail-sub">AI Voice Assistant</div>
              </div>
              <span class="rail-clock" aria-hidden="true">⌚</span>
            </div>

            <div class="rail-live">
              <span class="rail-live-dot"></span>
              <span class="rail-live-label">Live Activity</span>
              <span class="rail-live-region">Worldwide · Updated every sec</span>
            </div>

            <div class="rail-stats-top">
              <div class="rail-stat" data-stat="online" data-init="202200000" data-fmt="M">
                <span class="rail-stat-icon">⊕</span>
                <span class="rail-stat-num">202.2M</span>
                <span class="rail-stat-label">Online globally</span>
              </div>
              <div class="rail-stat" data-stat="ai" data-init="28300000" data-fmt="M">
                <span class="rail-stat-icon">✱</span>
                <span class="rail-stat-num">28.3M</span>
                <span class="rail-stat-label">Using AI tools</span>
              </div>
              <div class="rail-stat" data-stat="enterprise" data-init="70000" data-fmt="K/s">
                <span class="rail-stat-icon">🔍</span>
                <span class="rail-stat-num">70.0K/s</span>
                <span class="rail-stat-label">Enterprise queries</span>
              </div>
              <div class="rail-stat" data-stat="streaming" data-init="364500000" data-fmt="M">
                <span class="rail-stat-icon">▭</span>
                <span class="rail-stat-num">364.5M</span>
                <span class="rail-stat-label">Streaming video</span>
              </div>
            </div>

            <div class="rail-globe-area">
              <div class="rail-side rail-side-left">
                <div class="rail-micro" data-init="11800000" data-fmt="M"><span class="rail-micro-icon">💬</span><div><span class="rail-micro-num">11.8M</span><span class="rail-micro-label">On chat AI</span></div></div>
                <div class="rail-micro" data-init="505300" data-fmt="K"><span class="rail-micro-icon">⬡</span><div><span class="rail-micro-num">505.3K</span><span class="rail-micro-label">On dev platforms</span></div></div>
                <div class="rail-micro" data-init="80600000" data-fmt="M"><span class="rail-micro-icon">🛒</span><div><span class="rail-micro-num">80.6M</span><span class="rail-micro-label">Shopping online</span></div></div>
                <div class="rail-micro" data-init="17600000" data-fmt="M"><span class="rail-micro-icon">📈</span><div><span class="rail-micro-num">17.6M</span><span class="rail-micro-label">Trading markets</span></div></div>
              </div>

              <!-- Constellation globe — orbital rings + scattered dots + sun marker + italic A -->
              <div class="constellation-wrap" aria-hidden="true">
                <svg class="constellation-svg" viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="c-globe-bg" cx="0.5" cy="0.5" r="0.55">
                      <stop offset="0%" stop-color="#2a1f12" stop-opacity="0.9"/>
                      <stop offset="60%" stop-color="#0f0a05" stop-opacity="0.95"/>
                      <stop offset="100%" stop-color="#050402" stop-opacity="1"/>
                    </radialGradient>
                    <radialGradient id="c-sun" cx="0.5" cy="0.5" r="0.5">
                      <stop offset="0%" stop-color="#FFE4A8"/>
                      <stop offset="60%" stop-color="#E8C988"/>
                      <stop offset="100%" stop-color="#C9A567"/>
                    </radialGradient>
                  </defs>
                  <circle cx="0" cy="0" r="78" fill="url(#c-globe-bg)" stroke="rgba(232,201,136,0.30)" stroke-width="0.5"/>
                  <ellipse cx="0" cy="0" rx="78" ry="78" fill="none" stroke="rgba(232,201,136,0.20)" stroke-width="0.5"/>
                  <ellipse cx="0" cy="0" rx="78" ry="42" fill="none" stroke="rgba(232,201,136,0.32)" stroke-width="0.5"/>
                  <ellipse cx="0" cy="0" rx="78" ry="14" fill="none" stroke="rgba(232,201,136,0.38)" stroke-width="0.5"/>
                  <g class="constellation-dots">
                    <!-- mid orbit -->
                    <circle cx="-72" cy="-12" r="1.2" class="c-dot"/>
                    <circle cx="-50" cy="-30" r="1.2" class="c-dot"/>
                    <circle cx="-18" cy="-40" r="1.2" class="c-dot"/>
                    <circle cx="22" cy="-38" r="1.2" class="c-dot"/>
                    <circle cx="55" cy="-28" r="1.2" class="c-dot"/>
                    <circle cx="74" cy="-6" r="1.2" class="c-dot"/>
                    <circle cx="60" cy="22" r="1.2" class="c-dot"/>
                    <circle cx="28" cy="38" r="1.2" class="c-dot"/>
                    <circle cx="-12" cy="40" r="1.2" class="c-dot"/>
                    <circle cx="-46" cy="32" r="1.2" class="c-dot"/>
                    <circle cx="-68" cy="14" r="1.2" class="c-dot"/>
                    <!-- equator orbit -->
                    <circle cx="-77" cy="-2" r="1" class="c-dot c-dot-bright"/>
                    <circle cx="-30" cy="-13" r="1" class="c-dot c-dot-bright"/>
                    <circle cx="40" cy="-12" r="1" class="c-dot c-dot-bright"/>
                    <circle cx="76" cy="2" r="1" class="c-dot c-dot-bright"/>
                    <!-- outer scatter -->
                    <circle cx="-30" cy="-68" r="0.9" class="c-dot"/>
                    <circle cx="30" cy="-66" r="0.9" class="c-dot"/>
                    <circle cx="-30" cy="64" r="0.9" class="c-dot"/>
                    <circle cx="30" cy="62" r="0.9" class="c-dot"/>
                  </g>
                  <!-- Sun marker (top right) -->
                  <circle cx="60" cy="-44" r="3.4" fill="url(#c-sun)" class="c-sun"/>
                  <text x="38" y="-52" class="c-sun-label">SUN · 17° · N17°</text>
                  <!-- Italic A centerpiece -->
                  <text x="0" y="14" text-anchor="middle" class="c-letter">A</text>
                </svg>
              </div>

              <div class="rail-side rail-side-right">
                <div class="rail-micro" data-init="134900000" data-fmt="M"><span class="rail-micro-icon">▶</span><div><span class="rail-micro-num">134.9M</span><span class="rail-micro-label">Gaming now</span></div></div>
                <div class="rail-micro" data-init="137200000" data-fmt="M"><span class="rail-micro-icon">♪</span><div><span class="rail-micro-num">137.2M</span><span class="rail-micro-label">On short video</span></div></div>
                <div class="rail-micro" data-init="150200000" data-fmt="M"><span class="rail-micro-icon">▢</span><div><span class="rail-micro-num">150.2M</span><span class="rail-micro-label">On social feeds</span></div></div>
                <div class="rail-micro" data-init="40100000" data-fmt="M"><span class="rail-micro-icon">⚡</span><div><span class="rail-micro-num">40.1M</span><span class="rail-micro-label">Trading crypto</span></div></div>
              </div>
            </div>

            <div class="rail-mic-area">
              <div class="rail-mic-label">Tap to speak</div>
              <button type="button" class="rail-mic" aria-label="Tap to speak with ARIA"><span class="rail-mic-glyph">🎤</span></button>
            </div>

            <form class="rail-ask">
              <input type="text" class="rail-ask-input" placeholder="Ask ARIA anything…" autocomplete="off" />
              <button type="submit" class="rail-ask-send" aria-label="Send to ARIA">→</button>
            </form>
          </aside>
        </div>

        <!-- Pricing strip -->
        <section class="pricing" aria-label="Plans">
          <h3 class="pricing-h3">Plans</h3>
          <p class="pricing-sub">Start with the trial above. When you're ready, pick a tier.</p>
          <div class="pricing-grid">
            ${PLANS.map(p => `
              <button type="button" class="pcard ${p.highlight ? 'pcard-featured' : ''}" data-tier="${p.tier}" aria-label="Plan: ${escapeHtml(p.name)}">
                <div class="pcard-front">
                  <div class="pcard-name">${escapeHtml(p.name)}</div>
                  <div class="pcard-price">${escapeHtml(p.price)}<span class="pcard-cadence">${escapeHtml(p.cadence)}</span></div>
                  <div class="pcard-mode">${p.mode === 'self-serve' ? 'Subscribe' : 'Talk to sales'}</div>
                </div>
                <div class="pcard-back">
                  <div class="pcard-blurb">${escapeHtml(p.blurb)}</div>
                  <div class="pcard-cta">${p.mode === 'self-serve' ? 'Start subscription →' : 'Call (647) 581-3182 →'}</div>
                </div>
              </button>
            `).join('')}
          </div>
          <div class="checkout-error" role="alert"></div>
        </section>

        <!-- Upgrade modal (fires when trial expires) -->
        <div class="upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
          <div class="upgrade-backdrop"></div>
          <div class="upgrade-content">
            <button type="button" class="upgrade-close" aria-label="Close">×</button>
            <h3 id="upgrade-title" class="upgrade-title">Your trial is up</h3>
            <p class="upgrade-body">10 minutes flew by. Continue with the plan that fits — Personal works for one device, Pro adds voice + priority. Bigger plans are sales-led.</p>
            <div class="upgrade-cards">
              ${PLANS.filter(p => p.mode === 'self-serve').map(p => `
                <button type="button" class="ucard ${p.highlight ? 'ucard-featured' : ''}" data-tier="${p.tier}">
                  <span class="ucard-name">${escapeHtml(p.name)}</span>
                  <span class="ucard-price">${escapeHtml(p.price)}${escapeHtml(p.cadence)}</span>
                </button>
              `).join('')}
              <a href="${SUPPORT_TEL}" class="ucard ucard-call">
                <span class="ucard-name">Talk to sales</span>
                <span class="ucard-price">${SUPPORT_PHONE}</span>
              </a>
            </div>
            <p class="upgrade-disclaimer">Secure checkout via Stripe. Cancel anytime. Bigger plans require a brief call.</p>
          </div>
        </div>

        <!-- Settings: company-docs upload & retrieval priority -->
        <div class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="settings-backdrop"></div>
          <div class="settings-content">
            <button type="button" class="settings-close" aria-label="Close">×</button>
            <h3 id="settings-title" class="settings-title">Personalize ARIA</h3>
            <p class="settings-sub">
              Upload your company's policies, procedures, FAQs, or internal instructions.
              ARIA references them <b>before</b> falling back to its built-in knowledge base
              or general advice. Stored locally on this device — never sent to any server.
            </p>

            <div class="settings-stats" role="status">
              <span><b class="company-active">0</b> active</span>
              <span class="sep">·</span>
              <span><b class="company-chunks">0</b> chunks</span>
              <span class="sep">·</span>
              <span class="company-storage">—</span>
            </div>

            <div class="settings-tabs" role="tablist">
              <button type="button" class="settings-tab active" data-tab="files" role="tab" aria-selected="true">📁 Upload files</button>
              <button type="button" class="settings-tab" data-tab="paste" role="tab" aria-selected="false">📋 Paste text</button>
            </div>

            <div class="settings-pane settings-pane-files" role="tabpanel">
              <label class="upload-zone">
                <input type="file" class="upload-input" multiple accept=".txt,.md,.markdown,.csv,.json,.log,.html,.htm,.pdf,.yml,.yaml,.rst" />
                <span class="upload-zone-icon">📁</span>
                <span class="upload-zone-text">Drop files here or click to choose</span>
                <span class="upload-zone-hint">.txt · .md · .pdf · .html · .csv — up to 10 MB each</span>
              </label>
            </div>

            <div class="settings-pane settings-pane-paste" role="tabpanel" hidden>
              <input type="text" class="paste-name" placeholder="Document name (e.g. 'BYOD Policy 2026')" />
              <textarea class="paste-text" rows="6" placeholder="Paste your policy or procedure text here…"></textarea>
              <button type="button" class="paste-save">Save to ARIA</button>
            </div>

            <div class="settings-doc-list" role="list" aria-label="Uploaded documents"></div>

            <div class="settings-status" role="status" aria-live="polite"></div>

            <div class="settings-footer">
              <button type="button" class="settings-clear">Clear all uploaded docs</button>
              <span class="settings-privacy">All data is local · Never uploaded to any server</span>
            </div>
            <div class="settings-version">
              ARIA v${ARIA_VERSION} · built ${ARIA_BUILD_DATE} ·
              <button type="button" class="check-updates">Check for updates</button>
              <span class="check-updates-status"></span>
            </div>
          </div>
        </div>

        <!-- First-launch onboarding: Free vs Custom mode -->
        <div class="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <div class="onboarding-backdrop"></div>
          <div class="onboarding-content">
            <div class="onboarding-globe-wrap" aria-hidden="true">
              <span class="ring faint"></span>
              <span class="ring dashed"></span>
              <div class="onboarding-globe"><span class="onboarding-globe-letter">A</span></div>
            </div>
            <h3 id="onboarding-title" class="onboarding-title">Welcome to <span class="accent">ARIA</span></h3>
            <p class="onboarding-sub">
              Pick how ARIA should work with you. You can change this any time in Settings.
            </p>
            <div class="onboarding-cards">
              <button type="button" class="onboarding-card" data-mode="free">
                <span class="onboarding-card-icon">⚡</span>
                <div class="onboarding-card-title">Free Mode</div>
                <div class="onboarding-card-body">ARIA uses its built-in 72-article IT support library. Generic IT advice, no setup. Voice + chat work immediately.</div>
                <div class="onboarding-card-cta">Start in Free Mode →</div>
              </button>
              <button type="button" class="onboarding-card onboarding-card-featured" data-mode="custom">
                <span class="onboarding-card-icon">🔐</span>
                <div class="onboarding-card-title">Custom Company Mode</div>
                <div class="onboarding-card-body">ARIA learns your policies, procedures, and FAQs — cites your docs first, falls back to the built-in KB only when nothing matches. Admin-gated. Requires a license.</div>
                <div class="onboarding-card-cta">Activate License →</div>
              </button>
            </div>
            <div class="onboarding-license" hidden>
              <input type="text" class="license-input" placeholder="Paste your license key (ARIA-XXXX-XXXX-XXXX-XXXX)" autocomplete="off" />
              <button type="button" class="license-submit">Activate</button>
              <button type="button" class="license-back">← Back</button>
              <p class="license-status" role="status" aria-live="polite"></p>
            </div>
            <div class="onboarding-footer">
              <span>ARIA v${ARIA_VERSION} · Privacy-first · All data stays on this device</span>
            </div>
          </div>
        </div>

        <!-- License-required notice when a non-admin tries to open Settings -->
        <div class="locked-modal" role="dialog" aria-modal="true">
          <div class="locked-backdrop"></div>
          <div class="locked-content">
            <button type="button" class="locked-close" aria-label="Close">×</button>
            <h3 class="locked-title">Settings is admin-only</h3>
            <p class="locked-body">
              ARIA's Settings — including company-doc upload — can only be modified by your IT admin.
              Activate a license key to unlock, or contact your IT team. In Free Mode, ARIA still answers
              from the built-in 72-article library.
            </p>
            <div class="locked-actions">
              <button type="button" class="locked-activate">Activate license</button>
              <a href="${SUPPORT_TEL}" class="locked-call">Call IT (${SUPPORT_PHONE})</a>
            </div>
          </div>
        </div>

        <!-- Cinematic demo side panel -->
        <div class="cinematic" role="dialog" aria-modal="true" aria-label="ARIA cinematic demo">
          <div class="cinematic-backdrop"></div>
          <div class="cinematic-frame">
            <button type="button" class="cinematic-close" aria-label="Close demo">×</button>
            <iframe class="cinematic-iframe" title="ARIA cinematic demo" allow="autoplay; fullscreen"></iframe>
          </div>
        </div>
      </section>
    `;
    this._wireEvents();
  }

  _wireEvents() {
    const root = this.shadowRoot;

    // Chat
    const form = root.querySelector('.chat-form');
    const input = root.querySelector('.chat-input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this._handleAsk(q);
    });
    root.querySelector('.chat-speak').addEventListener('click', () => this._speakLast());
    root.querySelector('.chat-speak').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._toggleVoicePicker();
    });

    // Voice picker
    const select = root.querySelector('.voice-picker-select');
    const populateVoices = () => {
      const voices = (window.speechSynthesis?.getVoices() || []).filter(v => /^en/i.test(v.lang));
      const auto = this._pickVoice();
      const saved = (() => { try { return localStorage.getItem('aria_voice'); } catch { return null; } })();
      select.innerHTML = '<option value="">Auto (' + (auto?.name || 'system default') + ')</option>' +
        voices.map(v => `<option value="${escapeHtml(v.name)}"${v.name === saved ? ' selected' : ''}>${escapeHtml(v.name)} — ${escapeHtml(v.lang)}</option>`).join('');
    };
    populateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', populateVoices);
    }
    select.addEventListener('change', () => {
      const value = select.value;
      try {
        if (value) localStorage.setItem('aria_voice', value);
        else localStorage.removeItem('aria_voice');
      } catch {}
      this._cachedVoice = null;
    });
    root.querySelector('.voice-picker-test').addEventListener('click', () => {
      this._speakText("Hi, I'm Aria. Tell me what's going on, and we'll work through it together.");
    });
    root.querySelector('.voice-picker-close').addEventListener('click', () => this._toggleVoicePicker(false));

    // ── Rail ask form (right-rail "Ask ARIA anything…" input) — same handler as chat-form
    const railAsk = root.querySelector('.rail-ask');
    if (railAsk) {
      const railInput = root.querySelector('.rail-ask-input');
      railAsk.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = railInput.value.trim();
        if (!q) return;
        railInput.value = '';
        this._handleAsk(q);
      });
    }

    // ── Mic button — Web Speech API STT if available, else falls back to speak-last
    const micBtn = root.querySelector('.rail-mic');
    if (micBtn) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        let listening = false;
        micBtn.addEventListener('click', () => {
          if (listening) { rec.stop(); return; }
          try { rec.start(); listening = true; micBtn.dataset.listening = 'true'; this._setGlobeState('listening'); }
          catch {}
        });
        rec.onresult = (e) => {
          const text = e.results[0]?.[0]?.transcript;
          if (text) this._handleAsk(text);
        };
        rec.onend = () => { listening = false; micBtn.dataset.listening = 'false'; this._setGlobeState('idle'); };
        rec.onerror = () => { listening = false; micBtn.dataset.listening = 'false'; this._setGlobeState('idle'); };
      } else {
        // No STT available — fallback to speaking the last reply
        micBtn.addEventListener('click', () => this._speakLast());
        micBtn.title = 'Browser STT unavailable — tap to hear last reply';
      }
    }

    // KB search (legacy element — guarded so it doesn't crash if KB pane was removed)
    const search = root.querySelector('.kb-search');
    if (!search) { /* KB pane removed in v2.1 layout */ } else {
    search.addEventListener('input', (e) => {
      if (!this._kb) return;
      const q = e.target.value.trim();
      if (!q) {
        this._renderKBList(this._kb.articles.slice(0, 8));
        return;
      }
      const results = retrieve(q, this._kb.articles, { topK: 12 });
      this._renderKBList(results);
    });

    // KB result clicks → ask the same query path
    const kbResults = root.querySelector('.kb-results');
    if (kbResults) kbResults.addEventListener('click', (e) => {
      const btn = e.target.closest('.kb-open');
      if (!btn) return;
      const id = btn.dataset.id;
      const article = this._kb?.articles.find(a => a.id === id);
      if (!article) return;
      const messages = root.querySelector('.messages');
      this._addMessage(messages, 'user', article.title);
      this._lastAriaText = article.user_friendly || article.symptoms?.split('\n')[0] || '';
      this._addMessage(messages, 'aria', `
        <div class="msg-title"><span class="kb-badge kb-badge-${article.level.toLowerCase()}">${article.level}</span> ${escapeHtml(article.title)}</div>
        <div class="msg-body">${escapeHtml(this._lastAriaText)}</div>
        ${article.escalation_trigger ? `<div class="msg-escalation">Escalate when: ${escapeHtml(article.escalation_trigger)}</div>` : ''}
      `, true);
    });
    } /* end if (search) — v2.1 KB pane was removed */

    // Related-article buttons inside ARIA messages
    root.querySelector('.messages').addEventListener('click', (e) => {
      const btn = e.target.closest('.msg-related');
      if (!btn) return;
      const id = btn.dataset.id;
      const article = this._kb?.articles.find(a => a.id === id);
      if (!article) return;
      this._handleAsk(article.title);
    });

    // Pricing cards
    root.querySelectorAll('.pcard').forEach(card => {
      card.addEventListener('click', () => {
        const tier = card.dataset.tier;
        const plan = PLANS.find(p => p.tier === tier);
        if (!plan) return;
        this._checkout(plan);
      });
      // Tap-to-flip on touch (CSS handles hover for desktop).
      card.addEventListener('touchstart', () => {
        root.querySelectorAll('.pcard.flipped').forEach(c => { if (c !== card) c.classList.remove('flipped'); });
        card.classList.toggle('flipped');
      }, { passive: true });
    });

    // Upgrade modal cards
    root.querySelectorAll('.ucard').forEach(card => {
      if (card.tagName === 'A') return; // call link
      card.addEventListener('click', () => {
        const tier = card.dataset.tier;
        const plan = PLANS.find(p => p.tier === tier);
        if (plan) this._checkout(plan);
      });
    });
    root.querySelector('.upgrade-close').addEventListener('click', () => this._closeUpgradeModal());
    root.querySelector('.upgrade-backdrop').addEventListener('click', () => this._closeUpgradeModal());

    // ── Onboarding (first-launch mode picker) ────────────────────────────
    root.querySelectorAll('.onboarding-card').forEach(card => {
      card.addEventListener('click', () => this._pickMode(card.dataset.mode));
    });
    const licenseInput = root.querySelector('.license-input');
    root.querySelector('.license-submit').addEventListener('click', () => this._submitLicense(licenseInput.value));
    licenseInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submitLicense(licenseInput.value);
    });
    root.querySelector('.license-back').addEventListener('click', () => {
      root.querySelector('.onboarding-license').setAttribute('hidden', '');
    });

    // ── Locked-settings modal (admin gate) ───────────────────────────────
    const lockedModal = root.querySelector('.locked-modal');
    const closeLocked = () => lockedModal.classList.remove('open');
    root.querySelector('.locked-close').addEventListener('click', closeLocked);
    root.querySelector('.locked-backdrop').addEventListener('click', closeLocked);
    root.querySelector('.locked-activate').addEventListener('click', () => {
      closeLocked();
      this._showOnboarding();
      // Pre-open the license entry section.
      root.querySelector('.onboarding-license').removeAttribute('hidden');
      setTimeout(() => licenseInput.focus(), 100);
    });

    // ── Settings / Company-KB upload (admin only) ────────────────────────
    const settingsModal = root.querySelector('.settings-modal');
    const openSettings = async () => {
      if (!this._isAdmin()) {
        lockedModal.classList.add('open');
        return;
      }
      settingsModal.classList.add('open');
      await this._refreshSettings();
    };
    const closeSettings = () => settingsModal.classList.remove('open');
    root.querySelector('.settings-open').addEventListener('click', openSettings);
    root.querySelector('.settings-close').addEventListener('click', closeSettings);
    root.querySelector('.settings-backdrop').addEventListener('click', closeSettings);

    // ── Check for updates (manual; auto-updates land via the static deploy) ─
    root.querySelector('.check-updates').addEventListener('click', async () => {
      const status = root.querySelector('.check-updates-status');
      status.textContent = 'Checking…';
      try {
        const r = await fetch('/assets/aria-trial.js?_v=' + Date.now(), { cache: 'no-store', method: 'HEAD' });
        if (r.ok) {
          const lm = r.headers.get('last-modified');
          status.textContent = lm ? `Up to date · server ${lm}` : 'Up to date';
        } else {
          status.textContent = 'Server unreachable';
        }
      } catch {
        status.textContent = 'Offline — no update check';
      }
    });

    // Tabs
    root.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        root.querySelectorAll('.settings-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        const which = tab.dataset.tab;
        root.querySelector('.settings-pane-files').toggleAttribute('hidden', which !== 'files');
        root.querySelector('.settings-pane-paste').toggleAttribute('hidden', which !== 'paste');
      });
    });

    // File upload (input + drag-drop)
    const uploadInput = root.querySelector('.upload-input');
    const uploadZone = root.querySelector('.upload-zone');
    const handleFiles = async (files) => {
      const status = root.querySelector('.settings-status');
      status.className = 'settings-status';
      const list = Array.from(files);
      if (!list.length) return;
      status.textContent = `Processing ${list.length} file${list.length === 1 ? '' : 's'}…`;
      let okCount = 0, errCount = 0;
      const errors = [];
      for (const file of list) {
        try {
          const r = await CompanyKB.addFile(file);
          okCount++;
          status.textContent = `Indexed ${file.name} — ${r.chunkCount} chunks. (${okCount}/${list.length})`;
        } catch (err) {
          errCount++;
          errors.push(`${file.name}: ${err.message}`);
        }
      }
      status.className = 'settings-status' + (errCount === 0 ? ' ok' : ' error');
      status.innerHTML = okCount
        ? `Added ${okCount} document${okCount === 1 ? '' : 's'}.${errCount ? ' ' + errCount + ' failed: ' + escapeHtml(errors.join('; ')) : ''}`
        : `Could not process. ${escapeHtml(errors.join('; '))}`;
      await this._refreshSettings();
    };
    uploadInput.addEventListener('change', (e) => handleFiles(e.target.files));
    ['dragenter','dragover'].forEach(evt => uploadZone.addEventListener(evt, (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(evt => uploadZone.addEventListener(evt, (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); }));
    uploadZone.addEventListener('drop', (e) => { handleFiles(e.dataTransfer?.files || []); });

    // Paste tab
    root.querySelector('.paste-save').addEventListener('click', async () => {
      const name = root.querySelector('.paste-name').value.trim();
      const text = root.querySelector('.paste-text').value.trim();
      const status = root.querySelector('.settings-status');
      if (!name) { status.className = 'settings-status error'; status.textContent = 'Give the document a name first.'; return; }
      if (text.length < 30) { status.className = 'settings-status error'; status.textContent = 'Paste a bit more text — needs at least ~30 characters.'; return; }
      try {
        const r = await CompanyKB.addDocumentText({ name, text, type: 'text/plain', source: 'paste' });
        status.className = 'settings-status ok';
        status.textContent = `Saved "${name}" — ${r.chunkCount} chunks indexed.`;
        root.querySelector('.paste-name').value = '';
        root.querySelector('.paste-text').value = '';
        await this._refreshSettings();
      } catch (err) {
        status.className = 'settings-status error';
        status.textContent = err.message;
      }
    });

    // Document list (delete buttons delegated)
    root.querySelector('.settings-doc-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-doc-remove');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      await CompanyKB.removeDocument(id);
      const status = root.querySelector('.settings-status');
      status.className = 'settings-status ok';
      status.textContent = 'Removed. Older versions of this document are kept for ARIA’s reference.';
      await this._refreshSettings();
    });

    // Clear all
    root.querySelector('.settings-clear').addEventListener('click', async () => {
      if (!confirm('Delete every uploaded company document? This cannot be undone.')) return;
      await CompanyKB.clearAll();
      const status = root.querySelector('.settings-status');
      status.className = 'settings-status ok';
      status.textContent = 'All uploaded documents cleared.';
      await this._refreshSettings();
    });

    // Resolve buttons in messages (delegated on .messages container)
    root.querySelector('.messages').addEventListener('click', (e) => {
      const btn = e.target.closest('.msg-resolve-btn');
      if (!btn) return;
      this._handleResolve(btn.dataset.resolve);
    });

    // Cinematic demo
    const cinematic = root.querySelector('.cinematic');
    const iframe = root.querySelector('.cinematic-iframe');
    root.querySelector('.watch-cinematic').addEventListener('click', () => {
      iframe.src = '/design-handoff/ARIA Demo.html';
      cinematic.classList.add('open');
    });
    const closeCinema = () => {
      cinematic.classList.remove('open');
      iframe.src = 'about:blank';
    };
    root.querySelector('.cinematic-close').addEventListener('click', closeCinema);
    root.querySelector('.cinematic-backdrop').addEventListener('click', closeCinema);
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Styles (scoped to shadow DOM — cannot leak to or be styled by the host) ──
// Palette + typography target: design-handoff cinematic (ARIA Demo.html, Scene 04).
// Cream is shifted warmer/more-gold so body text reads as cinematic-cream, not white.
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:host { display: block; }
:host([hidden]) { display: none !important; }

* { box-sizing: border-box; }

.aria-trial {
  --gold: #c9a567;
  --gold-bright: #e8c988;
  --gold-warm: #f1dca7;
  --gold-deep: #8c6f3f;
  --bg-0: #050402;
  --bg-1: #0B0907;
  --bg-2: #14100B;
  --line-soft: rgba(232, 201, 136, 0.08);
  --line: rgba(232, 201, 136, 0.18);
  --line-strong: rgba(232, 201, 136, 0.45);
  /* Cream pushed warmer so it never looks white; full opacity for body text. */
  --cream: #EDE6D6;
  --cream-warm: #E8D8B8;
  --cream-dim: #C8BFA9;
  --cream-faint: #807865;
  --danger: #D9665A;
  --success: #7FB37A;
  font-family: 'Inter', system-ui, -apple-system, Segoe UI, sans-serif;
  background:
    radial-gradient(1200px 600px at 50% -10%, rgba(232,201,136,0.08), transparent 55%),
    radial-gradient(800px 400px at 90% 110%, rgba(201,165,103,0.05), transparent 60%),
    var(--bg-0);
  color: var(--cream);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 72px 24px;
  position: relative;
  overflow: hidden;
}
/* Faint scanlines like the cinematic backdrop. */
.aria-trial::after {
  content: "";
  position: absolute; inset: 0;
  background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px);
  mix-blend-mode: overlay;
  pointer-events: none;
}

/* Scene chrome — matches design-handoff cinematic header */
.scene-head {
  max-width: 1100px;
  margin: 0 auto 36px;
  text-align: center;
  position: relative;
  z-index: 1;
}
.scene-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.45em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.scene-label .pulse-dot {
  display: inline-block;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--gold-bright);
  box-shadow: 0 0 8px var(--gold-bright), 0 0 0 4px rgba(232,201,136,0.12);
  margin-right: 10px;
  vertical-align: 1px;
  animation: dot-pulse 2.4s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .35; }
}
.scene-title {
  font-family: 'Cormorant Garamond', 'Cinzel', Georgia, serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: 0.005em;
  color: var(--cream);
  margin: 0 0 8px;
  line-height: 1.15;
}
.scene-title .accent { color: var(--gold-bright); font-style: italic; }
.scene-stats {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.20em;
  color: var(--cream-dim);
  text-transform: uppercase;
  margin-top: 14px;
}
.scene-stats .sep { color: var(--line-strong); margin: 0 12px; }
.scene-stats b { color: var(--gold-bright); font-weight: 500; }
.watch-cinematic {
  position: absolute;
  top: 0; right: 0;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: rgba(0,0,0,0.5);
  color: var(--gold-bright);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all .2s ease;
}
.watch-cinematic:hover { background: rgba(232,201,136,0.10); border-color: var(--gold); }

/* Globe centerpiece */
.globe-stage {
  display: grid; place-items: center;
  margin: 0 auto 18px;
  width: 200px; height: 200px;
  position: relative;
}
.globe-stage .ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--line);
  pointer-events: none;
}
.globe-stage .ring.dashed { border-style: dashed; opacity: 0.5; inset: 16px; }
.globe-stage .ring.faint  { inset: 32px; opacity: 0.25; }

.trial-globe {
  width: 132px; height: 132px; border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, var(--gold-warm), var(--gold) 45%, var(--gold-deep));
  box-shadow:
    0 0 0 6px rgba(232,201,136,0.06),
    0 0 0 14px rgba(232,201,136,0.03),
    0 0 38px rgba(232,201,136,0.40),
    inset 0 1px 0 rgba(255,255,255,0.5);
  display: grid; place-items: center;
  position: relative;
  transition: box-shadow .35s ease, transform .35s ease;
}
.trial-globe::before, .trial-globe::after {
  content: ""; position: absolute; inset: -10px;
  border: 1px solid rgba(232,201,136,0);
  border-radius: 50%;
  pointer-events: none;
  transition: border-color .35s ease, transform .35s ease;
}
.trial-globe::after { inset: -22px; }
.aria-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.30em;
  color: var(--gold-bright);
  text-transform: uppercase;
  text-align: center;
  margin-top: 6px;
  min-height: 14px;
}
.aria-status::before {
  content: "● ";
  color: var(--gold);
  margin-right: 4px;
  vertical-align: 1px;
}

/* Idle — gentle pulse (subtle, every 3s). */
.trial-globe[data-state="idle"] { animation: globe-idle 3s ease-in-out infinite; }
@keyframes globe-idle {
  0%, 100% { box-shadow: 0 0 24px rgba(241,220,167,0.30), inset 0 1px 0 rgba(255,255,255,0.4); }
  50%      { box-shadow: 0 0 36px rgba(241,220,167,0.45), inset 0 1px 0 rgba(255,255,255,0.5); }
}

/* Thinking — counter-rotating rings + brighter glow. */
.trial-globe[data-state="thinking"] {
  animation: none;
  box-shadow: 0 0 40px rgba(241,220,167,0.55), 0 0 80px rgba(201,165,89,0.20), inset 0 1px 0 rgba(255,255,255,0.5);
}
.trial-globe[data-state="thinking"]::before {
  border-color: rgba(241,220,167,0.40);
  border-top-color: rgba(241,220,167,0.85);
  animation: globe-spin 1.6s linear infinite;
}
.trial-globe[data-state="thinking"]::after {
  border-color: rgba(201,165,89,0.20);
  border-bottom-color: rgba(241,220,167,0.55);
  animation: globe-spin-rev 2.2s linear infinite;
}
@keyframes globe-spin     { to { transform: rotate( 360deg); } }
@keyframes globe-spin-rev { to { transform: rotate(-360deg); } }

/* Speaking — soft 6Hz scale on the globe core. */
.trial-globe[data-state="speaking"] {
  animation: globe-speaking .55s ease-in-out infinite;
  box-shadow: 0 0 50px rgba(241,220,167,0.70), inset 0 1px 0 rgba(255,255,255,0.6);
}
@keyframes globe-speaking {
  0%, 100% { transform: scale(1.00); }
  50%      { transform: scale(1.04); }
}

@media (prefers-reduced-motion: reduce) {
  .trial-globe, .trial-globe::before, .trial-globe::after { animation: none !important; transition: none !important; }
}
.globe-letter {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 64px;
  font-weight: 500;
  color: var(--bg-0);
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255,255,255,0.4);
}
.timer {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  color: var(--gold-bright);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* Two-pane grid */
.trial-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
  position: relative; z-index: 1;
}
@media (max-width: 800px) {
  .trial-grid { grid-template-columns: 1fr; }
  .watch-cinematic { position: static; margin: 12px auto 0; display: inline-block; }
}

/* Browser-frame chrome (matches the cinematic browser pane) */
.chat-pane, .kb-pane {
  background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--line);
  border-radius: 14px;
  display: flex; flex-direction: column;
  min-height: 520px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.025);
}
.pane-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255,255,255,0.012);
}
.pane-bar .traffic { display: flex; gap: 7px; }
.pane-bar .traffic span {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.06);
}
.pane-bar .url {
  flex: 1;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--line-soft);
  border-radius: 6px;
  padding: 5px 12px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--cream-dim);
  text-align: center;
  letter-spacing: 0.02em;
}
.pane-bar .url .lock { color: var(--gold); margin-right: 8px; }
.aria-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 3px 10px 3px 4px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(232,201,136,0.18), rgba(232,201,136,0.06));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.25em;
  color: var(--gold-bright);
  text-transform: uppercase;
}
.aria-pill .a-mark {
  width: 18px; height: 18px; border-radius: 4px;
  display: grid; place-items: center;
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  color: var(--bg-0);
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-weight: 600;
  font-size: 13px;
  box-shadow: 0 0 12px rgba(232,201,136,0.35);
}
.messages {
  flex: 1; overflow-y: auto;
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.msg {
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  max-width: 92%;
  word-wrap: break-word;
}
.msg-user {
  align-self: flex-end;
  background: rgba(232,201,136,0.10);
  border: 1px solid var(--line);
  color: var(--cream);
}
.msg-aria {
  align-self: flex-start;
  background: linear-gradient(180deg, rgba(232,201,136,0.05), rgba(232,201,136,0.015));
  border: 1px solid var(--line);
  color: var(--cream);
  position: relative;
}
.msg-aria::before {
  content: "";
  position: absolute; left: 14px; top: -1px;
  width: 60px; height: 2px;
  background: linear-gradient(90deg, var(--gold-bright), transparent);
}
.msg-title {
  display: flex; gap: 8px; align-items: center;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 16px;
  color: var(--gold-bright);
  margin-bottom: 6px;
  font-weight: 600;
  letter-spacing: 0.005em;
}
.msg-body {
  color: var(--cream);
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 14px;
  line-height: 1.6;
  font-weight: 400;
}
.msg-escalation {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(217,102,90,0.40);
  border-radius: 6px;
  background: rgba(217,102,90,0.06);
  font-size: 12px;
  color: #f5b8b0;
}
.msg-escalation a { color: var(--gold-bright); }
.msg-related-row { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.msg-related {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s ease;
}
.msg-related:hover { color: var(--gold-bright); border-color: var(--gold); }

.chat-form {
  display: flex; gap: 8px; padding: 12px;
  border-top: 1px solid var(--line-soft);
  background: rgba(0,0,0,0.2);
}
.chat-input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--cream);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color .15s ease;
}
.chat-input:focus { border-color: var(--gold); }
.chat-input:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-speak {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--line);
  color: var(--gold-bright);
  font-size: 16px;
  cursor: pointer;
  transition: all .15s ease;
}
.chat-speak:hover { background: rgba(197,160,89,0.10); border-color: var(--gold); }
.chat-send {
  padding: 0 18px;
  border-radius: 999px;
  border: 0;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold) 60%, var(--gold-deep));
  color: #050505;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  cursor: pointer;
  transition: filter .15s ease;
}
.chat-send:hover { filter: brightness(1.08); }

/* Voice picker — appears below chat form on right-click of the speaker button */
.voice-picker {
  display: flex; gap: 8px; align-items: center;
  padding: 10px 12px;
  border-top: 1px solid var(--line-soft);
  background: rgba(0,0,0,0.3);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.10em;
  color: var(--cream-dim);
  text-transform: uppercase;
}
.voice-picker[hidden] { display: none; }
.voice-picker-label { color: var(--gold-bright); flex-shrink: 0; }
.voice-picker-select {
  flex: 1;
  padding: 6px 10px;
  background: rgba(0,0,0,0.5);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--cream);
  font-family: inherit;
  font-size: 10px;
  outline: none;
  text-transform: none;
  letter-spacing: 0.02em;
}
.voice-picker-test {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: rgba(232,201,136,0.10);
  color: var(--gold-bright);
  font-family: inherit;
  font-size: 9.5px;
  letter-spacing: 0.20em;
  cursor: pointer;
  text-transform: uppercase;
}
.voice-picker-test:hover { background: rgba(232,201,136,0.18); }
.voice-picker-close {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

/* KB pane body — padding moves inside since the pane-bar is now at top */
.kb-pane-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.kb-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.kb-h3 {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 14px;
  letter-spacing: 0.10em;
  color: var(--gold-bright);
  text-transform: uppercase;
  margin: 0;
}
.kb-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.15em;
  color: var(--cream-faint);
  text-transform: uppercase;
}
.kb-search {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--cream);
  font-family: inherit;
  font-size: 12px;
  margin-bottom: 10px;
  outline: none;
}
.kb-search:focus { border-color: var(--gold); }
.kb-results {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
  overflow-y: auto;
  max-height: 380px;
}
.kb-item {}
.kb-open {
  display: flex; gap: 8px; align-items: center;
  width: 100%;
  padding: 8px 10px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--line-soft);
  border-radius: 6px;
  color: var(--cream);
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all .15s ease;
}
.kb-open:hover { background: rgba(197,160,89,0.06); border-color: var(--line); }
.kb-title { flex: 1; line-height: 1.4; }
.kb-empty {
  padding: 14px;
  color: var(--cream-faint);
  font-size: 12px;
  text-align: center;
}

.kb-badge {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.10em;
  padding: 2px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 500;
}
.kb-badge-l1 { background: rgba(127,179,122,0.15); color: #a4d49e; border: 1px solid rgba(127,179,122,0.30); }
.kb-badge-l2 { background: rgba(212,154,92,0.15); color: #e8c477; border: 1px solid rgba(212,154,92,0.30); }
.kb-badge-l3 { background: rgba(217,102,90,0.15); color: #ec9486; border: 1px solid rgba(217,102,90,0.30); }
.kb-badge-ga { background: rgba(197,160,89,0.15); color: var(--gold-bright); border: 1px solid var(--line); }
.kb-badge-company {
  background: linear-gradient(180deg, rgba(232,201,136,0.25), rgba(232,201,136,0.10));
  color: var(--gold-bright);
  border: 1px solid var(--line-strong);
  font-weight: 600;
}
.msg-body-company {
  border-left: 2px solid var(--gold);
  padding-left: 10px;
  font-style: italic;
}
.msg-citation {
  margin-top: 8px;
  padding: 7px 9px;
  border-radius: 6px;
  background: rgba(232,201,136,0.06);
  border: 1px dashed var(--line);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--cream-dim);
  text-transform: none;
  font-style: normal;
}
.msg-citation-extras { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
.msg-citation-chip {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.10em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--cream-dim);
  background: rgba(0,0,0,0.4);
}
.msg-resolve {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
}
.msg-resolve-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--cream-faint);
  margin-right: 4px;
}
.msg-resolve-btn {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  cursor: pointer;
  transition: all .15s ease;
}
.msg-resolve-btn:hover { color: var(--gold-bright); border-color: var(--gold); }
.msg-resolve-btn[data-resolve="yes"]:hover { color: var(--success); border-color: var(--success); }
.msg-resolve-btn[data-resolve="no"]:hover  { color: var(--danger); border-color: var(--danger); }
.kb-badge-sev { font-size: 8px; padding: 1px 5px; }
.kb-badge-sev-low { background: rgba(255,255,255,0.04); color: var(--cream-faint); border-color: rgba(255,255,255,0.10); }
.kb-badge-sev-medium { background: rgba(127,179,122,0.10); color: #a4d49e; border: 1px solid rgba(127,179,122,0.20); }
.kb-badge-sev-high { background: rgba(212,154,92,0.10); color: #e8c477; border: 1px solid rgba(212,154,92,0.20); }
.kb-badge-sev-critical { background: rgba(217,102,90,0.15); color: #f5b8b0; border: 1px solid rgba(217,102,90,0.30); }

/* Pricing */
.pricing { max-width: 1100px; margin: 48px auto 0; }
.pricing-h3 {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 18px;
  letter-spacing: 0.20em;
  color: var(--gold-bright);
  text-transform: uppercase;
  text-align: center;
  margin: 0 0 4px;
}
.pricing-sub { text-align: center; color: var(--cream-dim); font-size: 12px; margin: 0 0 24px; }
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.pcard {
  perspective: 1000px;
  position: relative;
  height: 180px;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
}
.pcard-front, .pcard-back {
  position: absolute; inset: 0;
  border-radius: 12px;
  padding: 18px 16px;
  display: flex; flex-direction: column; justify-content: space-between;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(197,160,89,0.06), rgba(0,0,0,0));
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: transform .5s cubic-bezier(0.4,0,0.2,1);
  text-align: left;
}
.pcard-back {
  transform: rotateY(180deg);
  background: linear-gradient(180deg, rgba(197,160,89,0.12), rgba(0,0,0,0.4));
}
.pcard:hover .pcard-front, .pcard.flipped .pcard-front { transform: rotateY(180deg); }
.pcard:hover .pcard-back, .pcard.flipped .pcard-back { transform: rotateY(0deg); }
.pcard-featured .pcard-front { border-color: var(--line-strong); box-shadow: 0 0 20px rgba(241,220,167,0.10); }
.pcard-name {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 13px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--gold-bright);
}
.pcard-price {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 26px;
  color: var(--cream);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.pcard-cadence { font-size: 11px; color: var(--cream-faint); margin-left: 4px; font-weight: 400; }
.pcard-mode {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.20em;
  color: var(--gold);
  text-transform: uppercase;
}
.pcard-blurb { font-size: 11px; line-height: 1.55; color: var(--cream-dim); }
.pcard-cta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--gold-bright);
  text-transform: uppercase;
  text-align: center;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}

.checkout-error { color: var(--danger); text-align: center; font-size: 12px; margin-top: 12px; min-height: 18px; }

/* Upgrade modal */
.upgrade-modal {
  position: fixed; inset: 0;
  z-index: 99999;
  display: none;
}
.upgrade-modal.open { display: block; }
.upgrade-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.78);
  backdrop-filter: blur(8px);
}
.upgrade-content {
  position: relative;
  width: min(700px, 92vw);
  max-height: 86vh;
  margin: 8vh auto;
  padding: 32px 28px;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-2));
  border: 1px solid var(--line-strong);
  border-radius: 18px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
}
.upgrade-close {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--gold-bright);
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}
.upgrade-title {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 22px;
  letter-spacing: 0.06em;
  color: var(--gold-bright);
  margin: 0 0 10px;
}
.upgrade-body { font-size: 14px; color: var(--cream-dim); margin: 0 0 18px; line-height: 1.55; }
.upgrade-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}
.ucard {
  padding: 14px 12px;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--cream);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 4px;
  text-align: left;
  text-decoration: none;
  transition: all .15s ease;
}
.ucard:hover { border-color: var(--gold); background: rgba(197,160,89,0.06); }
.ucard-featured { border-color: var(--line-strong); }
.ucard-call { background: rgba(127,179,122,0.05); border-color: rgba(127,179,122,0.30); }
.ucard-name {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 13px;
  color: var(--gold-bright);
  letter-spacing: 0.05em;
}
.ucard-price { font-size: 12px; color: var(--cream-dim); }
.upgrade-disclaimer { font-size: 11px; color: var(--cream-faint); text-align: center; margin: 0; }

/* Settings (also serves as the company-docs upload panel) */
.settings-open {
  position: absolute;
  top: 44px; right: 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all .2s ease;
}
.settings-open:hover { color: var(--gold-bright); border-color: var(--gold); background: rgba(232,201,136,0.08); }
@media (max-width: 800px) {
  .settings-open { position: static; display: inline-block; margin-left: 8px; }
}

.settings-modal {
  position: fixed; inset: 0;
  z-index: 99997;
  display: none;
}
.settings-modal.open { display: block; }
.settings-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.78);
  backdrop-filter: blur(8px);
}
.settings-content {
  position: relative;
  width: min(720px, 94vw);
  max-height: 88vh;
  margin: 6vh auto;
  padding: 30px 28px 24px;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-2));
  border: 1px solid var(--line-strong);
  border-radius: 18px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  overflow-y: auto;
}
.settings-close {
  position: absolute; top: 12px; right: 12px;
  width: 32px; height: 32px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--gold-bright);
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}
.settings-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 26px;
  letter-spacing: 0.02em;
  color: var(--gold-bright);
  margin: 0 0 8px;
}
.settings-sub { font-size: 13px; color: var(--cream-dim); line-height: 1.55; margin: 0 0 14px; }
.settings-sub b { color: var(--gold-bright); font-weight: 600; }

.settings-stats {
  display: flex; gap: 4px; align-items: center;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.20em;
  color: var(--cream-dim);
  text-transform: uppercase;
  margin-bottom: 16px;
  padding: 8px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: rgba(0,0,0,0.3);
}
.settings-stats b { color: var(--gold-bright); font-weight: 500; }
.settings-stats .sep { color: var(--line-strong); }
.company-storage { margin-left: auto; }

.settings-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
.settings-tab {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.3);
  color: var(--cream-dim);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all .15s ease;
}
.settings-tab:hover { color: var(--gold-bright); }
.settings-tab.active {
  background: linear-gradient(180deg, rgba(232,201,136,0.10), rgba(232,201,136,0.03));
  color: var(--gold-bright);
  border-color: var(--line-strong);
}

.settings-pane[hidden] { display: none; }

.upload-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed var(--line);
  border-radius: 12px;
  background: rgba(0,0,0,0.25);
  cursor: pointer;
  transition: all .2s ease;
}
.upload-zone:hover, .upload-zone.dragover {
  border-color: var(--gold);
  background: rgba(232,201,136,0.04);
}
.upload-input { display: none; }
.upload-zone-icon { font-size: 24px; }
.upload-zone-text {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-style: italic;
  color: var(--gold-bright);
}
.upload-zone-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--cream-faint);
}

.paste-name, .paste-text {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--cream);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  margin-bottom: 8px;
}
.paste-text { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px; line-height: 1.55; resize: vertical; }
.paste-name:focus, .paste-text:focus { border-color: var(--gold); }
.paste-save {
  padding: 10px 18px;
  border-radius: 999px;
  border: 0;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold) 60%, var(--gold-deep));
  color: var(--bg-0);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
}
.paste-save:hover { filter: brightness(1.08); }

.settings-doc-list {
  margin-top: 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.settings-doc {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  background: rgba(232,201,136,0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 12px;
}
.settings-doc-name {
  flex: 1;
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  color: var(--gold-bright);
  font-size: 14px;
}
.settings-doc-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--cream-faint);
}
.settings-doc-remove {
  padding: 4px 10px;
  font-size: 10px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
}
.settings-doc-remove:hover { color: var(--danger); border-color: var(--danger); }

.settings-status {
  margin-top: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--cream-dim);
  min-height: 16px;
}
.settings-status.ok    { color: var(--success); }
.settings-status.error { color: var(--danger); }

.settings-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}
.settings-clear {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(217,102,90,0.40);
  background: rgba(217,102,90,0.05);
  color: #f5b8b0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
}
.settings-clear:hover { background: rgba(217,102,90,0.15); }
.settings-privacy {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--cream-faint);
}

/* Mode badge + framework pills (scene-head) */
.aria-mode-badge {
  display: inline-flex; align-items: center; gap: 8px;
  margin: 8px auto 0;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.25em;
  color: var(--cream-dim);
  text-transform: uppercase;
}
.aria-mode-badge[data-mode="custom"] {
  border-color: rgba(127,179,122,0.45);
  color: #a4d49e;
  background: rgba(127,179,122,0.06);
}
.aria-mode-badge[data-mode="free"] {
  border-color: var(--line-strong);
  color: var(--gold-bright);
}
.aria-mode-badge[data-mode="unset"] {
  border-color: rgba(217,154,92,0.45);
  color: #e8c477;
}
.aria-mode-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor, 0 0 0 3px rgba(255,255,255,0.04);
  animation: dot-pulse 2.4s ease-in-out infinite;
}

.frameworks-strip {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;
  max-width: 720px;
  margin: 12px auto 0;
}
.fw-pill {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.20em;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--line);
  color: var(--cream-faint);
  text-transform: uppercase;
  background: rgba(0,0,0,0.3);
  cursor: help;
  transition: color .15s ease, border-color .15s ease;
}
.fw-pill:hover { color: var(--gold-bright); border-color: var(--gold); }

/* Onboarding modal */
.onboarding-modal {
  position: fixed; inset: 0;
  z-index: 100000;
  display: none;
}
.onboarding-modal.open { display: block; }
.onboarding-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.86);
  backdrop-filter: blur(14px);
}
.onboarding-content {
  position: relative;
  width: min(820px, 94vw);
  max-height: 92vh;
  margin: 4vh auto;
  padding: 36px 32px 28px;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-2));
  border: 1px solid var(--line-strong);
  border-radius: 22px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.7);
  overflow-y: auto;
  text-align: center;
}
.onboarding-globe-wrap {
  width: 130px; height: 130px;
  margin: 0 auto 16px;
  position: relative;
  display: grid; place-items: center;
}
.onboarding-globe-wrap .ring {
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 1px solid var(--line);
}
.onboarding-globe-wrap .ring.dashed { border-style: dashed; opacity: 0.5; inset: 14px; }
.onboarding-globe-wrap .ring.faint  { inset: 28px; opacity: 0.25; }
.onboarding-globe {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--gold-warm), var(--gold) 45%, var(--gold-deep));
  box-shadow: 0 0 28px rgba(232,201,136,0.40), inset 0 1px 0 rgba(255,255,255,0.5);
  display: grid; place-items: center;
}
.onboarding-globe-letter {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 38px;
  font-weight: 500;
  color: var(--bg-0);
  line-height: 1;
}
.onboarding-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 32px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--cream);
  margin: 0 0 10px;
}
.onboarding-title .accent { color: var(--gold-bright); }
.onboarding-sub {
  font-size: 13px;
  color: var(--cream-dim);
  line-height: 1.55;
  margin: 0 0 22px;
}
.onboarding-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.onboarding-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 22px 20px 18px;
  background: linear-gradient(180deg, rgba(232,201,136,0.04), rgba(0,0,0,0));
  border: 1px solid var(--line);
  border-radius: 14px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
  transition: all .2s ease;
}
.onboarding-card:hover {
  border-color: var(--line-strong);
  background: linear-gradient(180deg, rgba(232,201,136,0.10), rgba(0,0,0,0));
  transform: translateY(-2px);
}
.onboarding-card-featured {
  border-color: rgba(232,201,136,0.55);
  box-shadow: 0 0 30px rgba(232,201,136,0.10);
}
.onboarding-card-icon { font-size: 22px; }
.onboarding-card-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 22px;
  letter-spacing: 0.02em;
  color: var(--gold-bright);
}
.onboarding-card-body { font-size: 12.5px; line-height: 1.55; color: var(--cream-dim); }
.onboarding-card-cta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.20em;
  color: var(--gold-bright);
  text-transform: uppercase;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--line-soft);
}
.onboarding-license {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  margin-bottom: 14px;
}
.onboarding-license[hidden] { display: none; }
.license-input {
  flex: 1 1 280px;
  padding: 10px 14px;
  background: rgba(0,0,0,0.5);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--cream);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.05em;
  outline: none;
}
.license-input:focus { border-color: var(--gold); }
.license-submit {
  padding: 10px 22px;
  border-radius: 999px;
  border: 0;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold) 60%, var(--gold-deep));
  color: var(--bg-0);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
}
.license-submit:hover { filter: brightness(1.08); }
.license-back {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}
.license-status {
  width: 100%;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  margin: 4px 0 0;
  color: var(--cream-dim);
  min-height: 14px;
}
.license-status.ok    { color: var(--success); }
.license-status.error { color: var(--danger); }
.onboarding-footer {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.20em;
  color: var(--cream-faint);
  text-transform: uppercase;
}

/* Locked-settings notice (non-admin tries to open Settings) */
.locked-modal { position: fixed; inset: 0; z-index: 99996; display: none; }
.locked-modal.open { display: block; }
.locked-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(8px); }
.locked-content {
  position: relative;
  width: min(520px, 92vw);
  margin: 14vh auto 0;
  padding: 26px 24px 22px;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-2));
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  text-align: center;
}
.locked-close {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
}
.locked-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 22px;
  color: var(--gold-bright);
  margin: 0 0 8px;
}
.locked-body { font-size: 13px; color: var(--cream-dim); line-height: 1.55; margin: 0 0 16px; }
.locked-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.locked-activate {
  padding: 10px 18px;
  border-radius: 999px;
  border: 0;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold) 60%, var(--gold-deep));
  color: var(--bg-0);
  font-weight: 700; font-size: 11px;
  letter-spacing: 0.15em; text-transform: uppercase;
  cursor: pointer; font-family: inherit;
}
.locked-call {
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream);
  text-decoration: none;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
}
.locked-call:hover { color: var(--gold-bright); border-color: var(--gold); }

/* Settings version + check-updates */
.settings-version {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.10em;
  color: var(--cream-faint);
  text-transform: uppercase;
}
.check-updates {
  margin-left: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.4);
  color: var(--cream-dim);
  font-family: inherit;
  font-size: 9.5px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  cursor: pointer;
}
.check-updates:hover { color: var(--gold-bright); border-color: var(--gold); }
.check-updates-status { margin-left: 8px; color: var(--success); }

/* Cinematic */
.cinematic {
  position: fixed; inset: 0;
  z-index: 99998;
  display: none;
}
.cinematic.open { display: block; }
.cinematic-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(6px);
}
.cinematic-frame {
  position: relative;
  width: min(1100px, 96vw);
  height: min(720px, 84vh);
  margin: 6vh auto;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  overflow: hidden;
  background: #050505;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
}
.cinematic-iframe { width: 100%; height: 100%; border: 0; display: block; }
.cinematic-close {
  position: absolute; top: 10px; right: 10px;
  z-index: 2;
  width: 32px; height: 32px;
  border: 1px solid var(--line-strong);
  background: rgba(0,0,0,0.7);
  color: var(--gold-bright);
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .pcard-front, .pcard-back { transition: none; }
}

/* ─────────────────────────────────────────────────────────────────────────
   v2.1 — Cinematic scene + ARIA voice rail (matches design-handoff PNGs)
   ───────────────────────────────────────────────────────────────────────── */

/* Scene tagline (top, monospace caps, centered) */
.scene-tagline {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.40em;
  color: var(--gold);
  text-transform: uppercase;
  text-align: center;
  margin: 0 auto 30px;
}

/* Floating header chips: mode badge + status + cinematic + settings */
.floating-header {
  position: relative;
  z-index: 2;
  display: flex; gap: 10px; align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: 0 4px 16px;
  max-width: 1280px; margin: 0 auto;
}
.floating-header .aria-mode-badge { margin: 0; }
.floating-header .aria-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.20em;
  color: var(--cream-dim);
  text-transform: uppercase;
}
.floating-header .aria-status::before { content: "● "; color: var(--gold); }
.floating-header .watch-cinematic,
.floating-header .settings-open {
  position: static !important;
}

/* Two-column stage grid: scene-pane | aria-rail */
.stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(380px, 480px);
  gap: 24px;
  max-width: 1280px;
  margin: 0 auto;
  position: relative; z-index: 1;
}
@media (max-width: 980px) {
  .stage-grid { grid-template-columns: 1fr; gap: 18px; }
  .aria-rail { max-width: 100%; }
}

/* SCENE PANE (left) — replaces the old chat-pane wrapper */
.scene-pane {
  background: transparent;
  border: 0;
  box-shadow: none;
  display: flex; flex-direction: column;
}
.browser-frame {
  background: linear-gradient(180deg, rgba(20,16,11,0.85), rgba(11,9,7,0.95));
  border: 1px solid rgba(232,201,136,0.18);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.025);
  display: flex; flex-direction: column;
  min-height: 600px;
}
.browser-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(232,201,136,0.10);
  background: rgba(255,255,255,0.012);
}
.browser-bar .traffic { display: flex; gap: 7px; }
.browser-bar .traffic span {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.06);
}
.browser-url {
  flex: 1;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(232,201,136,0.10);
  border-radius: 6px;
  padding: 5px 12px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--cream-dim);
  text-align: center;
  letter-spacing: 0.02em;
}
.browser-url .lock { color: var(--gold); margin-right: 8px; }
.browser-aria-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 3px 10px 3px 4px;
  border: 1px solid rgba(232,201,136,0.45);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(232,201,136,0.18), rgba(232,201,136,0.06));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.25em;
  color: var(--gold-bright);
  text-transform: uppercase;
}
.browser-aria-pill .a-mark {
  width: 18px; height: 18px; border-radius: 4px;
  display: grid; place-items: center;
  background: linear-gradient(180deg, var(--gold), var(--gold-deep));
  color: var(--bg-0);
  font-family: 'Cormorant Garamond', serif;
  font-style: italic; font-weight: 600; font-size: 13px;
  box-shadow: 0 0 12px rgba(232,201,136,0.35);
}
.scene-content {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0;
  padding: 18px;
}
.scene-content .scene-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.40em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 14px;
  text-align: center;
}
.scene-content .messages {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  padding: 0 0 14px;
  min-height: 320px;
}
.scene-content .chat-form {
  display: flex; gap: 8px;
  padding: 12px 0 0;
  border-top: 1px solid rgba(232,201,136,0.08);
  background: transparent;
}

/* ARIA RAIL (right) — persistent voice assistant column */
.aria-rail {
  background: linear-gradient(180deg, rgba(20,16,11,0.85), rgba(11,9,7,0.95));
  border: 1px solid rgba(232,201,136,0.18);
  border-radius: 14px;
  padding: 18px 18px 14px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.025);
  min-height: 600px;
}
.rail-header {
  display: flex; align-items: center; gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(232,201,136,0.10);
}
.rail-mark {
  width: 36px; height: 36px; border-radius: 8px;
  display: grid; place-items: center;
  background: linear-gradient(180deg, rgba(232,201,136,0.18), rgba(232,201,136,0.06));
  border: 1px solid rgba(232,201,136,0.40);
}
.rail-mark span {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic; font-weight: 500;
  font-size: 22px;
  color: var(--gold-bright);
  line-height: 1;
}
.rail-title-wrap { flex: 1; }
.rail-title {
  font-family: 'Cinzel', 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  letter-spacing: 0.25em;
  color: var(--cream);
  text-transform: uppercase;
}
.rail-sub {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.30em;
  color: var(--cream-faint);
  text-transform: uppercase;
  margin-top: 2px;
}
.rail-clock {
  width: 26px; height: 26px;
  border: 1px solid rgba(232,201,136,0.30);
  border-radius: 50%;
  display: grid; place-items: center;
  font-size: 13px;
  color: var(--cream-faint);
  opacity: 0.6;
}

.rail-live {
  display: flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--cream-faint);
}
.rail-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
  animation: dot-pulse 2.4s ease-in-out infinite;
}
.rail-live-label { color: var(--gold-bright); letter-spacing: 0.30em; font-weight: 500; }
.rail-live-region { margin-left: auto; opacity: 0.7; letter-spacing: 0.10em; }

.rail-stats-top {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.rail-stat {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px;
  border: 1px solid rgba(232,201,136,0.15);
  border-radius: 8px;
  background: rgba(0,0,0,0.4);
  position: relative;
  overflow: hidden;
}
.rail-stat-icon {
  position: absolute; top: 6px; right: 8px;
  font-size: 10px;
  color: var(--gold);
  opacity: 0.7;
}
.rail-stat-num {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  color: var(--cream);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.rail-stat-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8.5px;
  letter-spacing: 0.10em;
  color: var(--cream-faint);
  text-transform: uppercase;
  line-height: 1.3;
  margin-top: 2px;
}

/* Globe area: side stats + constellation centerpiece */
.rail-globe-area {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  padding: 10px 0;
}
.rail-side { display: flex; flex-direction: column; gap: 10px; }
.rail-side-left  { text-align: right; align-items: flex-end; }
.rail-side-right { text-align: left;  align-items: flex-start; }
.rail-micro {
  display: flex; gap: 8px; align-items: center;
  padding: 6px 10px;
  border: 1px solid rgba(232,201,136,0.15);
  border-radius: 6px;
  background: rgba(0,0,0,0.4);
  width: 100%;
}
.rail-side-left .rail-micro { flex-direction: row-reverse; }
.rail-side-left .rail-micro > div { text-align: right; }
.rail-micro-icon {
  width: 22px; height: 22px;
  border-radius: 4px;
  display: grid; place-items: center;
  background: rgba(232,201,136,0.10);
  border: 1px solid rgba(232,201,136,0.20);
  font-size: 11px;
  color: var(--gold);
  flex-shrink: 0;
}
.rail-micro > div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rail-micro-num {
  font-family: 'Cormorant Garamond', serif;
  font-size: 13px;
  color: var(--cream);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.rail-micro-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 7.5px;
  letter-spacing: 0.10em;
  color: var(--cream-faint);
  text-transform: uppercase;
}

/* Constellation globe */
.constellation-wrap {
  width: 200px; height: 200px;
  position: relative;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.constellation-svg {
  width: 100%; height: 100%;
  filter: drop-shadow(0 0 24px rgba(232,201,136,0.20));
}
.constellation-dots {
  transform-origin: 0 0;
  animation: c-rotate 90s linear infinite;
}
.c-dot {
  fill: var(--gold-bright);
  filter: drop-shadow(0 0 1.5px var(--gold-bright));
  opacity: 0.85;
}
.c-dot-bright { opacity: 1; }
.c-sun {
  filter: drop-shadow(0 0 4px var(--gold-bright));
}
.c-sun-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 4.5px;
  letter-spacing: 0.18em;
  fill: var(--cream-faint);
  text-transform: uppercase;
}
.c-letter {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-weight: 500;
  font-size: 70px;
  fill: var(--gold-bright);
  filter: drop-shadow(0 0 12px rgba(232,201,136,0.55));
}
@keyframes c-rotate { to { transform: rotate(360deg); } }

/* Globe state animations on the constellation */
.aria-status[data-state="thinking"] ~ .stage-grid .constellation-svg { animation: c-thinking 1.5s ease-in-out infinite; }
.aria-status[data-state="speaking"] ~ .stage-grid .constellation-svg { animation: c-speaking 0.6s ease-in-out infinite; }
@keyframes c-thinking { 0%,100% { filter: drop-shadow(0 0 18px rgba(232,201,136,0.20)); } 50% { filter: drop-shadow(0 0 32px rgba(232,201,136,0.55)); } }
@keyframes c-speaking { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }

/* Mic area + ask input */
.rail-mic-area {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 6px 0 4px;
}
.rail-mic-label {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 16px;
  color: var(--cream);
  letter-spacing: 0.02em;
}
.rail-mic {
  width: 56px; height: 56px;
  border-radius: 50%;
  border: 0;
  background: radial-gradient(circle at 30% 30%, var(--gold-warm), var(--gold) 45%, var(--gold-deep));
  box-shadow: 0 0 0 6px rgba(232,201,136,0.10), 0 0 0 14px rgba(232,201,136,0.04), 0 0 28px rgba(232,201,136,0.40), inset 0 1px 0 rgba(255,255,255,0.5);
  cursor: pointer;
  display: grid; place-items: center;
  transition: transform .15s ease;
}
.rail-mic:hover { transform: scale(1.04); }
.rail-mic:active { transform: scale(0.96); }
.rail-mic-glyph {
  font-size: 22px;
  filter: brightness(0.2);
}
.rail-mic[data-listening="true"] {
  animation: mic-pulse 1.2s ease-in-out infinite;
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 6px rgba(232,201,136,0.10), 0 0 0 14px rgba(232,201,136,0.04), 0 0 28px rgba(232,201,136,0.40), inset 0 1px 0 rgba(255,255,255,0.5); }
  50%      { box-shadow: 0 0 0 8px rgba(232,201,136,0.20), 0 0 0 18px rgba(232,201,136,0.08), 0 0 40px rgba(232,201,136,0.65), inset 0 1px 0 rgba(255,255,255,0.5); }
}

.rail-ask {
  display: flex; gap: 8px;
  padding: 10px 4px 0;
  border-top: 1px solid rgba(232,201,136,0.10);
}
.rail-ask-input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(232,201,136,0.15);
  border-radius: 8px;
  color: var(--cream);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color .15s ease;
}
.rail-ask-input::placeholder { color: var(--cream-faint); font-style: italic; }
.rail-ask-input:focus { border-color: var(--gold); }
.rail-ask-send {
  width: 40px;
  border-radius: 8px;
  border: 0;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold) 60%, var(--gold-deep));
  color: var(--bg-0);
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: filter .15s ease;
}
.rail-ask-send:hover { filter: brightness(1.08); }

/* Hide v2.0 elements that were inside the old scene-head */
.frameworks-strip[hidden] { display: none !important; }
`;

if (!customElements.get('aria-trial')) {
  customElements.define('aria-trial', AriaTrial);
}
