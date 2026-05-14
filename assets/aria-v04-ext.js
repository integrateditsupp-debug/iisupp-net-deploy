// aria-v04-ext.js — ARIA v0.4 chat extensions
// Loaded AFTER aria-aperture-bridge.js on /aria.
// Adds: idle timer, end-chat button, contact-back button,
//       escalation patterns, vendor handling, out-of-scope handling,
//       topic-change confirmation.
// Touches NO existing chat logic — operates as an overlay.

(function(){
  if (window.__ARIA_V04_LOADED__) return;
  window.__ARIA_V04_LOADED__ = true;

  // ============ CONFIG ============
  const HELPDESK_NUMBER = '(647) 581-3182';
  const HELPDESK_TEL = '+16475813182';
  const SESSION_END_URL = '/.netlify/functions/aria-session-end';
  const CONTACT_BACK_URL = '/.netlify/functions/aria-contact-back';

  const IDLE_FIRST_MS = 30000;   // 30s -> "are you there?"
  const IDLE_SECOND_MS = 60000;  // +60s -> "please reply"
  const IDLE_END_MS = 60000;     // +60s -> drop chat

  const ESCALATE_RE = /\b(get me (a )?(person|human|real)|live agent|live person|transfer me|escalate|speak to (a )?(human|person|real)|talk to (a )?(human|person|tech|technician)|need (a )?human|call me|call back|callback)\b/i;
  const VENDOR_RE = /\b(call (microsoft|apple|google|samsung|dell|hp|lenovo|cisco|netgear|asus|acer|sony|brother|canon|epson|adobe|autodesk|sage|quickbooks|intuit|salesforce|zoom|slack|dropbox|box))\b/i;
  const OUT_OF_SCOPE_RE = /\b(make me a sandwich|book a flight|stock price|weather|sports score|movie recommendation|order food)\b/i;

  // ============ SCOPE INTRO ============
  const ARIA_CAN_HELP_WITH = [
    'Wi-Fi, VPN, network connectivity',
    'email setup, Outlook, M365',
    'password resets, MFA, sign-in issues',
    'printer setup and troubleshooting',
    'computer slow, won’t boot, blue screen',
    'software install, updates, license issues',
    'phishing checks, suspicious-site warnings',
    'cloud storage (OneDrive, SharePoint, Drive)'
  ];

  // ============ IDLE TIMER STATE ============
  let idleStage = 0;   // 0 = waiting for user, 1 = sent are-you-there, 2 = sent please-reply, 3 = ended
  let idleTimers = [];

  function clearIdle() {
    idleTimers.forEach(clearTimeout);
    idleTimers = [];
    idleStage = 0;
  }

  function startIdle() {
    clearIdle();
    idleTimers.push(setTimeout(() => {
      if (idleStage !== 0) return;
      idleStage = 1;
      injectAriaSystemMsg('Hello, are you there?');
      idleTimers.push(setTimeout(() => {
        if (idleStage !== 1) return;
        idleStage = 2;
        injectAriaSystemMsg('Please reply so that I can help you.');
        idleTimers.push(setTimeout(() => {
          if (idleStage !== 2) return;
          idleStage = 3;
          injectAriaSystemMsg('Unfortunately I will need to end this conversation. Please re-engage with Integrated IT Support Inc. — ARIA if you still require assistance.');
          setTimeout(() => endSession('timeout', 'No response from user across three idle prompts'), 1500);
        }, IDLE_END_MS));
      }, IDLE_SECOND_MS));
    }, IDLE_FIRST_MS));
  }

  // ============ HELPERS ============
  function injectAriaSystemMsg(text) {
    const chat = document.getElementById('chatMessages');
    if (!chat) return;
    const wrap = document.createElement('div');
    wrap.className = 'fade-in';
    wrap.innerHTML = '<div class="aria-block"><div class="aria-label">ARIA</div><div class="aria-text"></div></div>';
    wrap.querySelector('.aria-text').textContent = text;
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem('aria_active_session') || 'null'); }
    catch { return null; }
  }

  async function endSession(status, closureReason) {
    const sess = getSession();
    if (!sess || !sess.sessionId) return;
    try {
      await fetch(SESSION_END_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sess.sessionId,
          status: status,
          closureReason: closureReason || ''
        })
      });
    } catch (e) { console.warn('[aria-v04] session-end failed', e); }
    // signal Aperture to reset
    try { localStorage.removeItem('aria_active_session'); } catch {}
    clearIdle();
    setTimeout(resetChatUI, 1800);
  }

  // ============ ESCALATION / VENDOR / OUT-OF-SCOPE / TOPIC ============
  let currentTopic = null;

  function handleUserMessage(text) {
    if (!text) return;
    clearIdle();
    setTimeout(startIdle, 500);   // restart idle countdown after ARIA replies

    const lower = text.toLowerCase();

    // 1. escalation
    if (ESCALATE_RE.test(lower)) {
      injectAriaSystemMsg(`I’ll get a live agent on this. Please call our helpdesk now at ${HELPDESK_NUMBER}. I’ll keep this ticket open so the agent has full context.`);
      // do NOT end the session — let the user decide what to do next.
      return;
    }

    // 2. vendor inquiry
    const vendorMatch = lower.match(VENDOR_RE);
    if (vendorMatch) {
      const vendor = vendorMatch[2];
      injectAriaSystemMsg(`That’s a vendor-specific request for ${vendor.charAt(0).toUpperCase()+vendor.slice(1)}. They’ll have the fastest, most authoritative answer. I’d recommend reaching out to them directly — search "${vendor} support phone" on their site and call the number listed for your region. I’ll keep this ticket noted in case you need anything else after.`);
      return;
    }

    // 3. out-of-scope
    if (OUT_OF_SCOPE_RE.test(lower)) {
      injectAriaSystemMsg(`That’s outside what I cover. I focus on IT problems: ${ARIA_CAN_HELP_WITH.slice(0,4).join(', ')}, and more. For anything else, please call our team at ${HELPDESK_NUMBER}.`);
      return;
    }

    // 4. topic change detection (simple keyword domain check)
    const newTopic = detectTopic(lower);
    if (currentTopic && newTopic && currentTopic !== newTopic) {
      askTopicChangeConfirm(newTopic);
      return;
    }
    if (newTopic && !currentTopic) currentTopic = newTopic;
    // Pre-think acknowledgement — surfaces multiple agents in Aperture while ARIA's core reply spins up.
    maybeInjectThinkAloud(text);
  }

  function maybeInjectThinkAloud(userText) {
    var lower = (userText || '').toLowerCase().trim();
    // Skip short msgs / yes-no / topic confirmations / triggers already handled
    if (lower.length < 6) return;
    if (/^(yes|no|y|n|ok|okay|thanks|thank you|cool|sure|nope|yep|nah)\b/.test(lower)) return;
    if (ESCALATE_RE.test(lower) || VENDOR_RE.test(lower) || OUT_OF_SCOPE_RE.test(lower)) return;
    // Choose interim based on user's intent type — each variant fires multiple agent signals.
    var isQuestion = /^(what|why|when|where|how|can|do|does|is|are|will|should|who)\b/.test(lower) || lower.endsWith('?');
    var isProblem = /\b(broken|not working|won.?t|cannot|can.?t|isn.?t|stuck|slow|crash|out of|low on|running out|error|fail|frozen|hang|black screen|blue screen|dead|down|missing)\b/.test(lower);
    var msg;
    if (isProblem) {
      msg = "Okay, sorry to hear that. Let me check our knowledge base and research the best fix \u2014 running a quick diagnostic to verify what\u2019s going on.";
    } else if (isQuestion) {
      msg = "Good question. Let me look that up in our knowledge base and verify the right answer before I respond.";
    } else {
      msg = "Got it. Let me check this against our knowledge base and find the right next step for you.";
    }
    // Inject as an ARIA system message \u2014 this fires reasoning_agent + kb_agent + research_agent + troubleshooting (problem variant) + psychology + intent signals.
    injectAriaSystemMsg(msg);
  }

  function detectTopic(lower) {
    if (/\b(wifi|wi-fi|network|router|ethernet|connection)\b/.test(lower)) return 'network';
    if (/\b(vpn|firewall|tunnel|remote access)\b/.test(lower)) return 'vpn';
    if (/\b(email|outlook|gmail|smtp|imap|inbox)\b/.test(lower)) return 'email';
    if (/\b(password|login|sign in|mfa|2fa|authentication)\b/.test(lower)) return 'auth';
    if (/\b(printer|print|toner|cartridge|scanner)\b/.test(lower)) return 'printer';
    if (/\b(slow|crash|freeze|blue screen|reboot|boot)\b/.test(lower)) return 'performance';
    if (/\b(install|update|license|software|app)\b/.test(lower)) return 'software';
    if (/\b(phishing|suspicious|scam|malware|virus|hacked)\b/.test(lower)) return 'security';
    if (/\b(buy|purchase|price|watch|product|shop|order)\b/.test(lower)) return 'commerce';
    return null;
  }

  function askTopicChangeConfirm(newTopic) {
    injectAriaSystemMsg(`It sounds like you’re moving to a different topic (${newTopic}). Are you sure you want to change topics? I’ll close this ticket and open a new one. Reply "yes" to switch, or stay on the current topic to continue.`);
    // mark pending state — next user message that matches yes/no resolves it
    pendingTopicChange = { newTopic: newTopic, ts: Date.now() };
  }

  let pendingTopicChange = null;
  function checkPendingTopicAnswer(text) {
    if (!pendingTopicChange) return false;
    const lower = (text||'').toLowerCase().trim();
    if (/^(yes|y|yeah|yep|sure|confirm|switch|change)\b/.test(lower)) {
      const newTopic = pendingTopicChange.newTopic;
      pendingTopicChange = null;
      // close current ticket -> new ticket
      endSession('resolved', `Topic changed to ${newTopic}; closing prior ticket`);
      setTimeout(() => {
        try { window.ARIAperture && window.ARIAperture.forceModal && window.ARIAperture.forceModal(); } catch {}
        currentTopic = newTopic;
      }, 2200);
      return true;
    }
    if (/^(no|n|nope|nah|stay)\b/.test(lower)) {
      pendingTopicChange = null;
      injectAriaSystemMsg(`Got it — staying on the current topic. Go ahead.`);
      return true;
    }
    return false;
  }

  // ============ CHAT RESET / HISTORY ARCHIVE ============
  function pushToHistory() {
    try {
      var chat = document.getElementById('chatMessages');
      if (!chat) return;
      var sess = getSession();
      var entry = {
        ts: Date.now(),
        ticket: sess && sess.ticket,
        user: sess && sess.user,
        html: chat.innerHTML
      };
      var raw = localStorage.getItem('aria_v04_chat_history') || '[]';
      var arr = JSON.parse(raw);
      arr.unshift(entry);
      if (arr.length > 20) arr.length = 20;
      localStorage.setItem('aria_v04_chat_history', JSON.stringify(arr));
    } catch (e) { console.warn('[aria-v04] pushToHistory failed', e); }
  }

  function resetChatUI() {
    pushToHistory();
    try { window.archiveCurrentChat && window.archiveCurrentChat(); } catch (e) {}
    var chat = document.getElementById('chatMessages');
    if (chat) {
      var welcome = chat.querySelector('.fade-in');
      var welcomeClone = welcome ? welcome.cloneNode(true) : null;
      chat.innerHTML = '';
      if (welcomeClone) chat.appendChild(welcomeClone);
    }
    currentTopic = null;
    pendingTopicChange = null;
    clearIdle();
  }

  // ============ END-CHAT + CONTACT-BACK BUTTONS ============
  function injectControls() {
    if (document.getElementById('aria-v04-end-btn')) return;
    var baseStyle = "font-family:'JetBrains Mono',ui-monospace,Consolas,monospace;font-size:9px;letter-spacing:1.98px;text-transform:uppercase;padding:6px 11px;cursor:pointer;border-radius:1px;line-height:1;";
    var btnsHtml =
      '<button id="aria-v04-end-btn" type="button" style="'+baseStyle+'background:rgba(248,113,113,0.10);border:1px solid #f87171;color:#f87171;">End Chat</button>' +
      '<button id="aria-v04-callback-btn" type="button" style="'+baseStyle+'background:rgba(45,212,191,0.10);border:1px solid #2dd4bf;color:#2dd4bf;">Contact Back</button>';

    var bar = document.querySelector('.history-bar');
    if (bar) {
      // Inline alongside HISTORY / CLEAR (smaller, matched style)
      var inline = document.createElement('span');
      inline.id = 'aria-v04-inline';
      inline.style.cssText = 'display:inline-flex;gap:6px;margin-right:6px;align-items:center;';
      inline.innerHTML = btnsHtml;
      bar.insertBefore(inline, bar.firstChild);
    } else {
      // Fallback: fixed bottom-right dock
      var dock = document.createElement('div');
      dock.id = 'aria-v04-controls';
      dock.style.cssText = 'position:fixed;bottom:18px;right:18px;display:flex;gap:6px;z-index:9999;font-family:Inter,system-ui,sans-serif;';
      dock.innerHTML = btnsHtml;
      document.body.appendChild(dock);
    }

    document.getElementById('aria-v04-end-btn').onclick = function() {
      var sess = getSession();
      if (!sess) { injectAriaSystemMsg('No active session to end. Send a message to start.'); return; }
      if (!confirm('End this chat now? You will get the session report by email.')) return;
      injectAriaSystemMsg('Closing the chat. Your session report will arrive in your inbox shortly. Thanks for using ARIA.');
      endSession('user_ended', 'User clicked End Chat');
    };
    document.getElementById('aria-v04-callback-btn').onclick = function() { openCallbackModal(); };

    // Retry anchoring later if .history-bar wasn't ready yet (DOM may render after our wireUp).
    if (!bar) {
      var tries = 0;
      var retry = setInterval(function() {
        tries++;
        var b = document.querySelector('.history-bar');
        if (b && !document.getElementById('aria-v04-inline')) {
          var inl = document.createElement('span');
          inl.id = 'aria-v04-inline';
          inl.style.cssText = 'display:inline-flex;gap:6px;margin-right:6px;align-items:center;';
          // move existing fixed buttons into the bar
          var endBtn = document.getElementById('aria-v04-end-btn');
          var cbBtn = document.getElementById('aria-v04-callback-btn');
          if (endBtn && cbBtn) {
            inl.appendChild(endBtn);
            inl.appendChild(cbBtn);
            b.insertBefore(inl, b.firstChild);
            var dockEl = document.getElementById('aria-v04-controls');
            if (dockEl) dockEl.remove();
          }
        }
        if (tries > 30 || document.getElementById('aria-v04-inline')) clearInterval(retry);
      }, 500);
    }
  }

  function openCallbackModal() {
    if (document.getElementById('aria-v04-callback-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'aria-v04-callback-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,8,16,0.88);display:flex;align-items:center;justify-content:center;z-index:99999;font-family:Inter,system-ui,sans-serif;';
    modal.innerHTML = `
      <div style="max-width:420px;width:90%;background:#0a1219;border:1px solid #2dd4bf;padding:28px;color:#d8e0e6;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.22em;color:#2dd4bf;text-transform:uppercase;margin-bottom:14px;">Schedule a Contact Back</div>
        <p style="font-size:13px;line-height:1.6;margin:0 0 18px 0;color:#98a8b3;">Pick a date and time. We’ll email you a link to ARIA at that time and add it to our calendar.</p>
        <label style="display:block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;color:#98a8b3;text-transform:uppercase;margin-bottom:4px;">Date</label>
        <input id="aria-v04-cb-date" type="date" style="width:100%;padding:10px;background:#050810;border:1px solid #243a47;color:#d8e0e6;font-family:Inter,sans-serif;font-size:13px;margin-bottom:12px;">
        <label style="display:block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;color:#98a8b3;text-transform:uppercase;margin-bottom:4px;">Time</label>
        <input id="aria-v04-cb-time" type="time" style="width:100%;padding:10px;background:#050810;border:1px solid #243a47;color:#d8e0e6;font-family:Inter,sans-serif;font-size:13px;margin-bottom:18px;">
        <div style="display:flex;gap:10px;">
          <button id="aria-v04-cb-cancel" style="flex:1;padding:10px;background:transparent;border:1px solid #243a47;color:#98a8b3;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;cursor:pointer;text-transform:uppercase;">Cancel</button>
          <button id="aria-v04-cb-submit" style="flex:2;padding:10px;background:#2dd4bf;border:1px solid #2dd4bf;color:#050810;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.18em;cursor:pointer;text-transform:uppercase;font-weight:700;">Send Me The Link</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('aria-v04-cb-cancel').onclick = () => modal.remove();
    document.getElementById('aria-v04-cb-submit').onclick = async () => {
      const date = document.getElementById('aria-v04-cb-date').value;
      const time = document.getElementById('aria-v04-cb-time').value;
      if (!date || !time) { alert('Pick a date and time.'); return; }
      const sess = getSession();
      try {
        const resp = await fetch(CONTACT_BACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sess ? sess.sessionId : null,
            date, time,
            user: sess ? sess.user : null
          })
        });
        const data = await resp.json();
        modal.remove();
        if (data.ok) {
          injectAriaSystemMsg(`Scheduled. We’ll email you the ARIA link for ${date} at ${time}. Talk to you then.`);
        } else {
          injectAriaSystemMsg('Couldn’t schedule that. Please call ' + HELPDESK_NUMBER + '.');
        }
      } catch (e) {
        modal.remove();
        injectAriaSystemMsg('Network hiccup. Please call ' + HELPDESK_NUMBER + '.');
      }
    };
  }

  // ============ WIRE-UP ============
  function wireUp() {
    injectControls();

    // Hook the chat input — listen to user submits via Enter and form submission.
    const input = document.getElementById('askInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          const t = input.value.trim();
          if (t) {
            // pending topic answer check runs first
            if (!checkPendingTopicAnswer(t)) handleUserMessage(t);
          }
        }
      }, true);
    }

    // Also watch for new user messages appearing in DOM (covers programmatic submits)
    const chat = document.getElementById('chatMessages');
    if (chat) {
      const obs = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            const userBlock = n.matches && n.matches('.fade-in') ? n.querySelector('.you-block') : null;
            if (userBlock) {
              const text = (userBlock.textContent || '').trim();
              if (!checkPendingTopicAnswer(text)) handleUserMessage(text);
            }
          }
        }
      });
      obs.observe(chat, { childList: true });
    }

    startIdle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUp);
  } else {
    wireUp();
  }
})();
