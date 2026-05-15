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

  const IDLE_FIRST_MS = 60000;   // 30s -> "are you there?"
  const IDLE_SECOND_MS = 120000; // +120s -> "please reply"
  const IDLE_END_MS = 120000; // +120s -> drop chat

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
    try { maybeInjectResearchRecipe(text); } catch (e) {}

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

  // ============= AROC §4: symbolic operational state detection =============
  // Maps user surface forms → canonical state code → research-agent recipe.
  // Each regex uses word boundaries so e.g. "out of space" does NOT match "out of office".
  const STATE_PATTERNS = {
    'DISK.FULL':         /\b(out of (disk )?space|low on (disk )?space|no (disk )?space left|disk (is )?full|drive (is )?full|running (out of|low on) disk|low disk space|hard drive full|ssd (is )?full|c drive (is )?(full|out of space|low)|free up disk)\b/i,
    'OS.SLOW.PERF':      /\b((computer|laptop|pc|machine) (is )?(slow|sluggish|laggy|crawling)|running slow|performance lag|takes forever|frozen|freezes|hang(s|ing))\b/i,
    'OS.BOOT.FAIL':      /\b(won.?t boot|black screen|blue screen|bsod|stuck on boot|won.?t start|will not turn on)\b/i,
    'NET.WIFI.AUTH':     /\b(wifi (won.?t|cannot|can.?t) connect|wifi (not )?working|wrong password.*wifi|wifi password|incorrect (network )?password|connection refused.*wifi)\b/i,
    'NET.WIFI.NO.CONN':  /\b(can.?t connect to wifi|no wifi|no internet|wifi (is )?(down|broken|gone)|no network|disconnected|cannot reach internet)\b/i,
    'NET.SLOW':          /\b((internet|network|wifi|connection) (is )?slow|slow internet|slow connection|bandwidth (issue|problem))\b/i,
    'M365.OUTLOOK.SEND': /\b(outlook (won.?t|cannot|can.?t) send|email (won.?t|cannot|can.?t) send|stuck in outbox|cannot send (email|mail))\b/i,
    'M365.OUTLOOK.RECV': /\b(outlook (not |won.?t |cannot |can.?t )?(receiv|getting)|email not (coming|arriving|received))\b/i,
    'M365.OUTLOOK.OOO':  /\b(out of office|ooo|vacation responder|auto[-\s]?reply|automatic repl(y|ies)|outlook ooo|set ooo)\b/i,
    'M365.OUTLOOK.OPEN': /\b(outlook (won.?t|cannot|can.?t) open|outlook crash|outlook hangs|outlook frozen|outlook not responding)\b/i,
    'AUT.PW.RESET':      /\b(forgot (my )?password|need to reset (my )?password|password reset|reset password|cannot log ?in|locked out|account locked)\b/i,
    'AUT.MFA.LOCK':      /\b(mfa (not )?working|2fa (not )?working|authenticator|lost (my )?phone|lost (my )?authenticator|cannot get (the )?code)\b/i,
    'PRT.OFFLINE':       /\b(printer (is )?(offline|not (showing|working|connecting))|cannot (find|see) printer|printer not detected)\b/i,
    'PRT.QUEUE.STUCK':   /\b(print queue (is )?stuck|print job (is )?stuck|cannot clear print queue|printer paused|jam(med)?)\b/i,
    'SEC.PHISH':         /\b(suspicious (email|link|site|message)|phishing|is this (a )?scam|got a weird email|received .* link)\b/i,
    'SEC.MALWARE':       /\b(virus|malware|infected|ransom(ware)?|trojan|spyware|popups|browser hijack)\b/i,
    'VPN.AUTH.FAIL':     /\b(vpn (won.?t|cannot|can.?t) connect|vpn (authentication|auth) (failed|fail|error)|vpn login (failed|wrong))\b/i,
    'VPN.NO.TUNNEL':     /\b(vpn (connected )?but no internet|vpn slow|tunnel (won.?t|cannot) (open|establish)|vpn drops?)\b/i,
    'CLOUD.SYNC':        /\b(onedrive (not )?syncing|sharepoint (not )?syncing|dropbox (not )?syncing|google drive (not )?syncing|sync (error|failed|stuck))\b/i,
    'SW.INSTALL.FAIL':   /\b((install|installation) (failed|error|stuck)|cannot install|setup (failed|error)|msi error|installer (crash|fail))\b/i,
    'SW.UPDATE.FAIL':    /\b((update|upgrade) (failed|error|stuck)|windows update.*(fail|error|stuck)|cannot update|update loop)\b/i
  };

  function operationalStateOf(userText) {
    var t = (userText || '').toLowerCase().trim();
    if (!t || t.length < 5) return null;
    for (var key in STATE_PATTERNS) { if (STATE_PATTERNS[key].test(t)) return key; }
    return null;
  }

  function appendAriaResearchMessage(text, meta) {
    var chat = document.getElementById('chatMessages');
    if (!chat) return;
    var wrap = document.createElement('div');
    wrap.className = 'fade-in';
    wrap.innerHTML = '<div class="aria-block"><div class="aria-label">ARIA</div><div class="aria-text"></div></div>';
    var tx = wrap.querySelector('.aria-text');
    if (tx) { tx.style.whiteSpace = 'pre-wrap'; tx.textContent = text; }
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
    try {
      var detail = Object.assign({ source: 'research-agent', text: text }, meta || {});
      window.dispatchEvent(new CustomEvent('aria:assistant-message', { detail: detail }));
      window.dispatchEvent(new CustomEvent('aria:agent-signal', { detail: { agents: ['research','reasoning','kb','troubleshooting'], state: (meta && meta.state) || null, confidence: (meta && meta.confidence) || 0 } }));
    } catch (e) {}
  }

  var __ariaResearchInflight = false;
  function maybeInjectResearchRecipe(userText) {
    var state = operationalStateOf(userText);
    if (!state) return;
    if (__ariaResearchInflight) return;
    __ariaResearchInflight = true;
    var watchdog = setTimeout(function(){ __ariaResearchInflight = false; }, 30000);
    fetch('/.netlify/functions/aria-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userText, state: state })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      clearTimeout(watchdog);
      __ariaResearchInflight = false;
      if (!d || !d.ok || !d.steps || !d.steps.length) return;
      var msg = 'Here is the path I would walk through with you:\n\n';
      msg += d.title + '\n\n';
      for (var i = 0; i < d.steps.length; i++) msg += (i+1) + '. ' + d.steps[i] + '\n';
      if (d.caveat) msg += '\nNote: ' + d.caveat;
      msg += '\n\nTell me which step needs more detail, or if you want me to escalate.';
      setTimeout(function(){ appendAriaResearchMessage(msg, { state: state, confidence: d.confidence }); }, 1200);
    })
    .catch(function(){ clearTimeout(watchdog); __ariaResearchInflight = false; });
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


  // ============= AROC §6: uncertainty UX state machine =============
  // No-match user queries get a polite waiting state with timed escalation.
  // NEVER dump the /help menu in response to a real question.
  // Per Ahmad 2026-05-14 + project_aria_research_agent_law.md.
  //   T+0:   "Let me check into that — one moment, please."
  //   T+30s: "Still looking — give me one more moment."
  //   T+90s: escalate to helpdesk + offer callback ticket.
  //   Recipe arrives → cancel timers + deliver normally.

  var __HELPDESK_NUMBER_DISPLAY = '(647) 581-3182';
  var __HELPDESK_EMAIL_DISPLAY = 'integrateditsupp@iisupp.net';
  var __ariaUncertainState = null;

  function ariaUncertainEnter(userText) {
    try { clearIdle(); } catch(_) {}
    if (__ariaUncertainState) {
      if (__ariaUncertainState.tWait) clearTimeout(__ariaUncertainState.tWait);
      if (__ariaUncertainState.tEsc) clearTimeout(__ariaUncertainState.tEsc);
    }
    __ariaUncertainState = { startedAt: Date.now(), userText: userText, resolved: false, tWait: null, tEsc: null };

    appendAriaResearchMessage('Let me check into that — one moment, please.', { source: 'uncertain-state', stage: 'open' });

    // Research agent already kicked off by the original handleUserMessage path; do not dup-fire here.

    __ariaUncertainState.tWait = setTimeout(function () {
      if (!__ariaUncertainState || __ariaUncertainState.resolved) return;
      appendAriaResearchMessage('Still looking into this — give me one more moment.', { source: 'uncertain-state', stage: 'wait' });
    }, 30000);

    __ariaUncertainState.tEsc = setTimeout(function () {
      if (!__ariaUncertainState || __ariaUncertainState.resolved) return;
      var msg = "Unfortunately I don't have much information on that yet.\n\n" +
        'Our helpdesk can take it from here:\n' +
        '• Phone: ' + __HELPDESK_NUMBER_DISPLAY + '\n' +
        '• Email: ' + __HELPDESK_EMAIL_DISPLAY + '\n\n' +
        'Would you like me to open a callback ticket so a technician reaches out?';
      appendAriaResearchMessage(msg, { source: 'uncertain-state', stage: 'escalate' });
      __ariaUncertainState = null;
      try {
        window.dispatchEvent(new CustomEvent('aria:agent-signal', { detail: { agents: ['escalation', 'observability'], reason: 'uncertain-90s-escalate' } }));
      } catch (_) {}
    }, 90000);
  }

  function ariaUncertainResolve() {
    if (!__ariaUncertainState) return;
    __ariaUncertainState.resolved = true;
    if (__ariaUncertainState.tWait) clearTimeout(__ariaUncertainState.tWait);
    if (__ariaUncertainState.tEsc) clearTimeout(__ariaUncertainState.tEsc);
    __ariaUncertainState = null;
    try { setTimeout(startIdle, 500); } catch(_) {}
  }

  window.addEventListener('aria:assistant-message', function (e) {
    if (!__ariaUncertainState) return;
    if (e && e.detail && (e.detail.source === 'research-agent' || e.detail.source === 'kb-hit' || e.detail.source === 'live-vendor-fetch')) {
      ariaUncertainResolve();
    }
  });

  function __ariaInstallObserver() {
    var chat = document.getElementById('chatMessages');
    if (!chat) { setTimeout(__ariaInstallObserver, 500); return; }
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          var txt = (n.textContent || '');

          var youEl = n.classList && (n.classList.contains('you-block') || n.classList.contains('you-bubble'))
            ? n
            : (n.querySelector ? n.querySelector('.you-block, .you-bubble, [class*="you-text"]') : null);
          if (youEl) {
            var t = (youEl.textContent || '').trim();
            if (t && t.length > 0 && t.length < 1000) window.__lastUserText = t;
          }

          if (txt.indexOf("Here's what I can do") >= 0 &&
              txt.indexOf('Slash commands') >= 0 &&
              txt.indexOf('/kb') >= 0) {
            var lastUser = window.__lastUserText || '';
            if (lastUser && !/^\s*\/(help|capabilities|kb)\b/i.test(lastUser)) {
              n.style.display = 'none';
              setTimeout(function () { ariaUncertainEnter(lastUser); }, 50);
            }
          } else if (txt.indexOf("don't have a confident match") >= 0 || txt.indexOf("do not have a confident match") >= 0) {
            // Second no-match path: ARIA's 'Hmm I don't have a confident match' branch.
            // Suppress + delegate to state machine so user gets the polite wait + helpdesk escalation.
            var lastUser2 = window.__lastUserText || '';
            if (lastUser2 && !/^\s*\/(help|capabilities|kb)\b/i.test(lastUser2)) {
              n.style.display = 'none';
              setTimeout(function () { ariaUncertainEnter(lastUser2); }, 50);
            }
          }
        }
      }
    });
    obs.observe(chat, { childList: true, subtree: true });
  }
  __ariaInstallObserver();

  window.__ariaUncertainHook = ariaUncertainEnter;

})();
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
    try { maybeInjectResearchRecipe(text); } catch (e) {}

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

  // ============= AROC §4: symbolic operational state detection =============
  // Maps user surface forms → canonical state code → research-agent recipe.
  // Each regex uses word boundaries so e.g. "out of space" does NOT match "out of office".
  const STATE_PATTERNS = {
    'DISK.FULL':         /\b(out of (disk )?space|low on (disk )?space|no (disk )?space left|disk (is )?full|drive (is )?full|running (out of|low on) disk|low disk space|hard drive full|ssd (is )?full|c drive (is )?(full|out of space|low)|free up disk)\b/i,
    'OS.SLOW.PERF':      /\b((computer|laptop|pc|machine) (is )?(slow|sluggish|laggy|crawling)|running slow|performance lag|takes forever|frozen|freezes|hang(s|ing))\b/i,
    'OS.BOOT.FAIL':      /\b(won.?t boot|black screen|blue screen|bsod|stuck on boot|won.?t start|will not turn on)\b/i,
    'NET.WIFI.AUTH':     /\b(wifi (won.?t|cannot|can.?t) connect|wifi (not )?working|wrong password.*wifi|wifi password|incorrect (network )?password|connection refused.*wifi)\b/i,
    'NET.WIFI.NO.CONN':  /\b(can.?t connect to wifi|no wifi|no internet|wifi (is )?(down|broken|gone)|no network|disconnected|cannot reach internet)\b/i,
    'NET.SLOW':          /\b((internet|network|wifi|connection) (is )?slow|slow internet|slow connection|bandwidth (issue|problem))\b/i,
    'M365.OUTLOOK.SEND': /\b(outlook (won.?t|cannot|can.?t) send|email (won.?t|cannot|can.?t) send|stuck in outbox|cannot send (email|mail))\b/i,
    'M365.OUTLOOK.RECV': /\b(outlook (not |won.?t |cannot |can.?t )?(receiv|getting)|email not (coming|arriving|received))\b/i,
    'M365.OUTLOOK.OOO':  /\b(out of office|ooo|vacation responder|auto[-\s]?reply|automatic repl(y|ies)|outlook ooo|set ooo)\b/i,
    'M365.OUTLOOK.OPEN': /\b(outlook (won.?t|cannot|can.?t) open|outlook crash|outlook hangs|outlook frozen|outlook not responding)\b/i,
    'AUT.PW.RESET':      /\b(forgot (my )?password|need to reset (my )?password|password reset|reset password|cannot log ?in|locked out|account locked)\b/i,
    'AUT.MFA.LOCK':      /\b(mfa (not )?working|2fa (not )?working|authenticator|lost (my )?phone|lost (my )?authenticator|cannot get (the )?code)\b/i,
    'PRT.OFFLINE':       /\b(printer (is )?(offline|not (showing|working|connecting))|cannot (find|see) printer|printer not detected)\b/i,
    'PRT.QUEUE.STUCK':   /\b(print queue (is )?stuck|print job (is )?stuck|cannot clear print queue|printer paused|jam(med)?)\b/i,
    'SEC.PHISH':         /\b(suspicious (email|link|site|message)|phishing|is this (a )?scam|got a weird email|received .* link)\b/i,
    'SEC.MALWARE':       /\b(virus|malware|infected|ransom(ware)?|trojan|spyware|popups|browser hijack)\b/i,
    'VPN.AUTH.FAIL':     /\b(vpn (won.?t|cannot|can.?t) connect|vpn (authentication|auth) (failed|fail|error)|vpn login (failed|wrong))\b/i,
    'VPN.NO.TUNNEL':     /\b(vpn (connected )?but no internet|vpn slow|tunnel (won.?t|cannot) (open|establish)|vpn drops?)\b/i,
    'CLOUD.SYNC':        /\b(onedrive (not )?syncing|sharepoint (not )?syncing|dropbox (not )?syncing|google drive (not )?syncing|sync (error|failed|stuck))\b/i,
    'SW.INSTALL.FAIL':   /\b((install|installation) (failed|error|stuck)|cannot install|setup (failed|error)|msi error|installer (crash|fail))\b/i,
    'SW.UPDATE.FAIL':    /\b((update|upgrade) (failed|error|stuck)|windows update.*(fail|error|stuck)|cannot update|update loop)\b/i
  };

  function operationalStateOf(userText) {
    var t = (userText || '').toLowerCase().trim();
    if (!t || t.length < 5) return null;
    for (var key in STATE_PATTERNS) { if (STATE_PATTERNS[key].test(t)) return key; }
    return null;
  }

  function appendAriaResearchMessage(text, meta) {
    var chat = document.getElementById('chatMessages');
    if (!chat) return;
    var wrap = document.createElement('div');
    wrap.className = 'fade-in';
    wrap.innerHTML = '<div class="aria-block"><div class="aria-label">ARIA</div><div class="aria-text"></div></div>';
    var tx = wrap.querySelector('.aria-text');
    if (tx) { tx.style.whiteSpace = 'pre-wrap'; tx.textContent = text; }
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;
    try {
      var detail = Object.assign({ source: 'research-agent', text: text }, meta || {});
      window.dispatchEvent(new CustomEvent('aria:assistant-message', { detail: detail }));
      window.dispatchEvent(new CustomEvent('aria:agent-signal', { detail: { agents: ['research','reasoning','kb','troubleshooting'], state: (meta && meta.state) || null, confidence: (meta && meta.confidence) || 0 } }));
    } catch (e) {}
  }

  var __ariaResearchInflight = false;
  function maybeInjectResearchRecipe(userText) {
    var state = operationalStateOf(userText);
    if (!state) return;
    if (__ariaResearchInflight) return;
    __ariaResearchInflight = true;
    var watchdog = setTimeout(function(){ __ariaResearchInflight = false; }, 30000);
    fetch('/.netlify/functions/aria-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userText, state: state })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      clearTimeout(watchdog);
      __ariaResearchInflight = false;
      if (!d || !d.ok || !d.steps || !d.steps.length) return;
      var msg = 'Here is the path I would walk through with you:\n\n';
      msg += d.title + '\n\n';
      for (var i = 0; i < d.steps.length; i++) msg += (i+1) + '. ' + d.steps[i] + '\n';
      if (d.caveat) msg += '\nNote: ' + d.caveat;
      msg += '\n\nTell me which step needs more detail, or if you want me to escalate.';
      setTimeout(function(){ appendAriaResearchMessage(msg, { state: state, confidence: d.confidence }); }, 1200);
    })
    .catch(function(){ clearTimeout(watchdog); __ariaResearchInflight = false; });
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


  // ============= AROC §6: uncertainty UX state machine =============
  // No-match user queries get a polite waiting state with timed escalation.
  // NEVER dump the /help menu in response to a real question.
  // Per Ahmad 2026-05-14 + project_aria_research_agent_law.md.
  //   T+0:   "Let me check into that — one moment, please."
  //   T+30s: "Still looking — give me one more moment."
  //   T+90s: escalate to helpdesk + offer callback ticket.
  //   Recipe arrives → cancel timers + deliver normally.

  var __HELPDESK_NUMBER_DISPLAY = '(647) 581-3182';
  var __HELPDESK_EMAIL_DISPLAY = 'integrateditsupp@iisupp.net';
  var __ariaUncertainState = null;

  function ariaUncertainEnter(userText) {
    if (__ariaUncertainState) {
      if (__ariaUncertainState.tWait) clearTimeout(__ariaUncertainState.tWait);
      if (__ariaUncertainState.tEsc) clearTimeout(__ariaUncertainState.tEsc);
    }
    __ariaUncertainState = { startedAt: Date.now(), userText: userText, resolved: false, tWait: null, tEsc: null };

    appendAriaResearchMessage('Let me check into that — one moment, please.', { source: 'uncertain-state', stage: 'open' });

    // Research agent already kicked off by the original handleUserMessage path; do not dup-fire here.

    __ariaUncertainState.tWait = setTimeout(function () {
      if (!__ariaUncertainState || __ariaUncertainState.resolved) return;
      appendAriaResearchMessage('Still looking into this — give me one more moment.', { source: 'uncertain-state', stage: 'wait' });
    }, 30000);

    __ariaUncertainState.tEsc = setTimeout(function () {
      if (!__ariaUncertainState || __ariaUncertainState.resolved) return;
      var msg = "Unfortunately I don't have much information on that yet.\n\n" +
        'Our helpdesk can take it from here:\n' +
        '• Phone: ' + __HELPDESK_NUMBER_DISPLAY + '\n' +
        '• Email: ' + __HELPDESK_EMAIL_DISPLAY + '\n\n' +
        'Would you like me to open a callback ticket so a technician reaches out?';
      appendAriaResearchMessage(msg, { source: 'uncertain-state', stage: 'escalate' });
      __ariaUncertainState = null;
      try {
        window.dispatchEvent(new CustomEvent('aria:agent-signal', { detail: { agents: ['escalation', 'observability'], reason: 'uncertain-90s-escalate' } }));
      } catch (_) {}
    }, 90000);
  }

  function ariaUncertainResolve() {
    if (!__ariaUncertainState) return;
    __ariaUncertainState.resolved = true;
    if (__ariaUncertainState.tWait) clearTimeout(__ariaUncertainState.tWait);
    if (__ariaUncertainState.tEsc) clearTimeout(__ariaUncertainState.tEsc);
    __ariaUncertainState = null;
  }

  window.addEventListener('aria:assistant-message', function (e) {
    if (!__ariaUncertainState) return;
    if (e && e.detail && (e.detail.source === 'research-agent' || e.detail.source === 'kb-hit' || e.detail.source === 'live-vendor-fetch')) {
      ariaUncertainResolve();
    }
  });

  function __ariaInstallObserver() {
    var chat = document.getElementById('chatMessages');
    if (!chat) { setTimeout(__ariaInstallObserver, 500); return; }
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          var txt = (n.textContent || '');

          var youEl = n.classList && (n.classList.contains('you-block') || n.classList.contains('you-bubble'))
            ? n
            : (n.querySelector ? n.querySelector('.you-block, .you-bubble, [class*="you-text"]') : null);
          if (youEl) {
            var t = (youEl.textContent || '').trim();
            if (t && t.length > 0 && t.length < 1000) window.__lastUserText = t;
          }

          if (txt.indexOf("Here's what I can do") >= 0 &&
              txt.indexOf('Slash commands') >= 0 &&
              txt.indexOf('/kb') >= 0) {
            var lastUser = window.__lastUserText || '';
            if (lastUser && !/^\s*\/(help|capabilities|kb)\b/i.test(lastUser)) {
              n.style.display = 'none';
              setTimeout(function () { ariaUncertainEnter(lastUser); }, 50);
            }
          } else if (txt.indexOf("don't have a confident match") >= 0 || txt.indexOf("do not have a confident match") >= 0) {
            // Second no-match path: ARIA's 'Hmm I don't have a confident match' branch.
            // Suppress + delegate to state machine so user gets the polite wait + helpdesk escalation.
            var lastUser2 = window.__lastUserText || '';
            if (lastUser2 && !/^\s*\/(help|capabilities|kb)\b/i.test(lastUser2)) {
              n.style.display = 'none';
              setTimeout(function () { ariaUncertainEnter(lastUser2); }, 50);
            }
          }
        }
      }
    });
    obs.observe(chat, { childList: true, subtree: true });
  }
  __ariaInstallObserver();

  window.__ariaUncertainHook = ariaUncertainEnter;

})();
