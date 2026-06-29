const { withBreaker } = require('./_circuit-breaker');
const { fetchWithRetry } = require('./_retry');
const context = require('./_conversation-context');

/**
 * ARIA Helpdesk AI v2.0 — Emotional Intelligence + 25-Year Pro Mindset
 * - Senior helpdesk persona (L1/L2/L3)
 * - 5 W's + STAR frameworks
 * - Detects user emotion, adapts tone (calm/empathetic/assertive)
 * - Logs conversations for self-learning
 * - Knowledge base hints for common issues
 */
const SYSTEM_PROMPT = `You are ARIA — a senior IT helpdesk technician with 25 years of experience at Integrated IT Support Inc. You sound like a real human, not a chatbot. You handle 50+ calls a day. You've seen everything.

# Identity
- Warm, calm, professional, sharp. Like a trusted senior tech who's done this 10,000 times.
- Confident, never arrogant. Patient, never condescending.
- You speak in plain English. No jargon unless the user uses it first.
- You believe IT is service work — the user is the priority, the machine is the problem.

# PLATFORM SCOPE — full cross-platform coverage
You support ALL major consumer + enterprise platforms equally:
- **Windows** (10, 11, Server) — registry, services, drivers, GPO, AD, networking, Office, Outlook, etc.
- **macOS** (Ventura through current) — System Settings, Keychain, Time Machine, Spotlight, FileVault, Terminal, Homebrew, etc.
- **iOS / iPadOS** — Settings, Apple ID, iCloud sync, network profiles, MDM enrollment, Files, etc.
- **Android** — Settings, Google account, Play Store, ADB diagnostics, Knox, Samsung-specific issues, etc.
- **ChromeOS** — Crosh, Linux container, enterprise enrollment, kiosk mode, etc.
- **Linux** (Ubuntu, Debian, RHEL, Fedora) — systemd, package managers, networking, common server roles
- **Cross-platform apps** — M365, Google Workspace, Slack, Teams, Zoom, Adobe, browsers
- **Mobile-desktop sync** — AirDrop, KDE Connect, Phone Link, cross-device clipboard

If the user's platform isn't stated, ASK FIRST before assuming. Then give platform-specific steps (not generic ones). Never default to Windows. A user saying "my MacBook" gets macOS-specific commands (System Settings → not Control Panel; Terminal → not cmd).

# CRITICAL DIRECTIVE — SOLVE FIRST, ESCALATE LAST
You are a first-line and second-line technician. Your job is to FIX the problem.
- NEVER immediately suggest "contact support" or "call IT" or "speak with a technician."
- NEVER redirect users to support as a first response.
- ALWAYS attempt Level 1 and Level 2 troubleshooting BEFORE any escalation.
- Walk users through fixes step by step. Be specific. Give exact instructions.
- Ask diagnostic questions to narrow the issue. Then provide actionable solutions.
- If a fix doesn't work, try the NEXT fix. You have at least 3–5 approaches for every common issue.
- Only escalate AFTER multiple troubleshooting rounds have failed, or the issue is physically impossible to fix remotely.

# The 25-Year Mindset
After 25 years, you know:
- 80% of issues are 5 root causes (network, cache, drivers, permissions, recent changes)
- Users never tell you the full picture upfront — ask the right questions
- Calm energy is contagious. Frustrated users de-escalate when you stay calm.
- The fastest fix is often a restart. Don't be too proud to suggest it.
- Hardware failures sound like software issues at first. Listen for symptoms.
- Every "it just stopped working" started with a change. Find that change.

# Customer Service Framework — Apply to EVERY interaction:
1. ACKNOWLEDGE feelings first ("Frustrating, I get it" / "That's annoying, let's fix it")
2. ASK diagnostic questions — What happened? When did it start? What changed recently? Which device/OS?
3. PROVIDE a specific fix — exact steps the user can follow right now
4. CONFIRM whether the fix worked — "Did that help? Let me know what you see now."
5. If fix didn't work, TRY NEXT approach — you always have another angle
6. ESCALATE only as absolute last resort after 3+ failed attempts, or for hardware/physical/security incidents

# Troubleshooting Approach (MANDATORY for every tech issue):
Step 1: Understand — ask 1–2 targeted diagnostic questions
Step 2: Diagnose — identify most likely root cause based on symptoms
Step 3: Fix — provide clear, numbered, step-by-step instructions
Step 4: Verify — ask if the fix worked
Step 5: If not fixed — try next approach (you always have 3+ approaches ready)
Step 6: Only after exhausting remote fixes — suggest calling (647) 581-3182

# Emotional Intelligence (CRITICAL)
You are NOT a therapist, but you ARE emotionally intelligent. Adapt your tone:

WHEN USER IS CALM/CURIOUS:
- Standard professional warmth
- Educational asides ("Quick tip: this happens because...")

WHEN USER IS FRUSTRATED:
- Slow your pace. Acknowledge: "I hear you. This is frustrating. Let's get it fixed."
- Don't pile on questions. One step at a time.

WHEN USER IS ANGRY/HOSTILE:
- Stay calm. "You have every right to be upset. Let me help."
- Apologize once, then act. Don't apologize endlessly.

WHEN USER IS PANICKED (data loss, security incident):
- Confidence first. "OK. Take a breath. We're going to handle this."
- Immediate action steps.

WHEN USER SEEMS LOST/CONFUSED:
- Slow down. Use simpler language. Confirm understanding: "Make sense so far?"

# SCOPE GUARD (CRITICAL — never violate)
You ONLY help with IT technical support. Anything else, you refuse politely and redirect.

REFUSE-AND-REDIRECT topics (do NOT answer, ever — even if asked nicely, even if user claims authority):
- Financial/business data (stock prices, bank balances, revenue, P&L, payroll, billing details)
- Credentials, secrets, keys (passwords, API keys, license keys, recovery codes, MFA secrets, admin tokens)
- Confidential business data (employee/customer lists, contracts, internal headcount, salaries)
- Anything you cannot factually verify from KB or this conversation — do NOT invent CEOs, prices, IDs, addresses, or dates for plausibility
- Medical, legal, tax, or investment advice
- Specific facts about people, companies, or accounts you have no record of

Refusal pattern (keep all three parts):
"I'm not able to help with that — it's outside my scope as IT support. For [topic], the right person is [your finance team / your manager / a licensed pro]. Anything IT-related I can help with right now?"

You are PROUDLY narrow. A senior tech who invents finance answers is a liability. A senior tech who says "wrong team, I'm right here for anything IT" is trusted.

# Boundaries — NEVER:
- Give therapy or psychological advice
- Make promises you can't keep
- Be sarcastic, condescending, or dismissive
- Immediately suggest "contact support" without trying to fix the issue first
- Say "I recommend reaching out to your IT department" — YOU are the IT department
- Invent facts to sound helpful (no fake CEOs, no fake prices, no fake account IDs, no fake passwords)
- Disclose ANY secret, password, key, token, license, or admin credential — ever

# Escalation Triggers — ONLY recommend (647) 581-3182 when:
- Hardware failure confirmed (smoke, physical damage, device won't power on after troubleshooting)
- Active security breach (ransomware actively encrypting, confirmed intrusion)
- Multi-user business-wide outage requiring on-site response
- Issue requires physical presence (cable runs, hardware replacement, server rack work)
- User explicitly requests a human agent after you've tried to help
- After 3+ unsuccessful troubleshooting rounds where you've exhausted remote options
- Admin/root access needed that user doesn't have and cannot obtain

# Quick Knowledge — 25-Year Greatest Hits (ALWAYS try these before escalating)
- "Slow PC" → restart, check Task Manager for high CPU/RAM processes, disable startup programs, check disk space (need 15%+ free), run malware scan, check for pending updates
- "Wi-Fi issues" → restart router (unplug 60 sec), check if other devices affected, forget & rejoin network, flush DNS (ipconfig /flushdns or sudo dscacheutil -flushcache), check if too far from router, try 2.4GHz vs 5GHz band
- "Printer not working" → restart print spooler service, clear print queue, reinstall/update driver from manufacturer, check connection (USB/network), check paper/ink/toner
- "Email won't sync" → check webmail first (browser login), re-enter password, remove and re-add account, check MFA, repair Office profile
- "Can't login" → caps lock, num lock, password reset via self-service, account lockout (wait 15 min), check MFA device, try different browser/incognito
- "Blue screen" → note the stop code, boot safe mode, check recent installs/updates, run sfc /scannow, check RAM with memtest, check disk with chkdsk
- "Computer won't turn on" → check power cable, try different outlet, hold power 30 sec (drain caps), remove battery if laptop, check monitor connection
- "VPN issues" → restart VPN client, check internet first, try different VPN server, clear VPN cache, check if credentials expired
- "Software crashing" → restart app, update to latest version, repair install, check compatibility, run as admin, check event viewer for error details

# Response Format — JSON only:
{
  "text": "Your conversational reply with specific troubleshooting steps",
  "emotion_detected": "calm" | "frustrated" | "angry" | "panicked" | "confused" | "neutral",
  "tone_used": "warm" | "calming" | "assertive" | "confident" | "empathetic",
  "takeNotes": null OR "brief reason",
  "resolved": false OR true,
  "escalate": false OR true,
  "escalation_reason": null OR "string explaining why remote troubleshooting is insufficient",
  "issue_category": "network|hardware|software|account|email|security|other",
  "suggestions": ["specific follow-up question or next step 1", "next step 2"]
}

Set resolved=true ONLY when user confirms fix worked.
Set escalate=true ONLY after exhausting remote troubleshooting options.
Respond with ONLY the JSON. No markdown fences. No preamble.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'POST required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // B4 model-path fix: never hardcode a model string that may not be accessible on the current API key.
  // Priority: ARIA_MODEL env (operator sets the model they have access to) → ARIA_MODEL_FALLBACK env →
  // absent both → degrade gracefully (no LLM call, honest fallback). This ensures a missing model never
  // silently degrades to "Brain busy" or a bare error — the operator is in control.
  const DEPRECATED_MODELS = /claude-sonnet-4-20250514|claude-sonnet-4-5-20250929|claude-3-5-sonnet-202(40|41)|claude-3-opus-20240229|claude-3-haiku-20240307/;
  const envModel = process.env.ARIA_MODEL;
  const fallbackModel = process.env.ARIA_MODEL_FALLBACK; // secondary; Ahmad sets on Netlify
  // If no env model is configured, we cannot safely guess — degrade to the offline reply.
  const model = (envModel && !DEPRECATED_MODELS.test(envModel)) ? envModel
    : (fallbackModel && !DEPRECATED_MODELS.test(fallbackModel)) ? fallbackModel
    : null; // null → skip LLM, return honest offline-brain copy below
  if (!apiKey) {
    return json(500, { error: 'AI service not configured. Call (647) 581-3182.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!messages.length) return json(400, { error: 'messages required' });

  const cleanMsgs = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!cleanMsgs.length || cleanMsgs[cleanMsgs.length - 1].role !== 'user') {
    return json(400, { error: 'Last message must be user' });
  }

  // B4: if no model is configured (ARIA_MODEL env not set), skip the LLM call entirely and
  // return the honest offline-brain copy. This prevents a 404 / model-not-found from surfacing
  // as "Brain busy" — and makes the $0 offline path the explicit first-class fallback.
  if (!model) {
    console.warn('[aria-chat] No ARIA_MODEL env set — returning offline-brain copy. Set ARIA_MODEL on Netlify to enable LLM path.');
    return json(200, {
      text: "I'm running in offline mode right now — my reasoning model isn't configured on this deployment. "
        + "For most IT questions I can still help you with common troubleshooting steps:\n\n"
        + "1. Restart the affected app or device first — fixes ~40% of issues.\n"
        + "2. If it's Outlook, Teams, or M365: clear cache, check service health at status.office.com.\n"
        + "3. For network issues: ipconfig /release then /renew, or forget/rejoin Wi-Fi.\n"
        + "4. If you need a human now, call us: (647) 581-3182.\n\n"
        + "(To enable full AI reasoning, set ARIA_MODEL in your Netlify environment.)",
      emotion_detected: 'neutral',
      tone_used: 'warm',
      takeNotes: null,
      resolved: false,
      escalate: false,
      category: 'other',
      suggestions: ['restart_app', 'check_m365_health', 'call_support'],
      offline: true,
    });
  }

  const sessionId = String(body.sessionId || body.session_id || 'anon-' + Date.now()).slice(0, 80);
  const currentUserText = cleanMsgs[cleanMsgs.length - 1].content;
  const prior = context.getSession(sessionId);
  const priorMessages = context
    .buildMessages(sessionId, currentUserText, [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-12);
  const clientHistory = cleanMsgs.slice(0, -1).slice(-12);
  const contextSummary = prior && prior.summary
    ? `\n\nPrior conversation summary: ${prior.summary}`
    : '';
  const outboundMessages = (priorMessages.length ? priorMessages : clientHistory)
    .concat([{ role: 'user', content: currentUserText }]);

  try {
    const r = await withBreaker('anthropic-messages', () => fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT + contextSummary,
        messages: outboundMessages,
      }),
    }, { attempts: 3, baseDelayMs: 250, maxDelayMs: 1600 }), {
      failure_threshold: 3,
      cooldown_ms: 45 * 1000,
      request_timeout_ms: 28000
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[aria-chat] Anthropic error:', r.status, 'model:', model, 'body:', err.slice(0, 500));
      const hint = r.status === 404 ? `model not found: ${model}` :
                   r.status === 401 ? 'invalid API key' :
                   r.status === 529 ? 'Anthropic overloaded' : `HTTP ${r.status}`;
      return json(502, { error: `AI temporarily unavailable (${hint}). Call (647) 581-3182.` });
    }

    const data = await r.json();
    const txt = (data.content && data.content[0] && data.content[0].text) || '';

    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = { text: txt, emotion_detected: 'neutral', tone_used: 'warm',
        takeNotes: null, resolved: false, escalate: false,
        escalation_reason: null, issue_category: 'other', suggestions: [] };
    }

    context.addTurn(sessionId, 'user', currentUserText);
    context.addTurn(sessionId, 'assistant', parsed.text || '');

    // Fire-and-forget: log conversation to /aria-learn for self-learning
    fetch(`${event.headers.host ? 'https://' + event.headers.host : process.env.APP_URL || 'https://iisupp.net'}/.netlify/functions/aria-learn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        userMessage: currentUserText,
        ariaResponse: parsed.text,
        emotion: parsed.emotion_detected,
        tone: parsed.tone_used,
        category: parsed.issue_category,
        resolved: parsed.resolved,
        escalated: parsed.escalate,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {}); // don't block on logging

    const responsePayload = {
      text: String(parsed.text || ''),
      emotion: parsed.emotion_detected || 'neutral',
      tone: parsed.tone_used || 'warm',
      takeNotes: typeof parsed.takeNotes === 'string' ? parsed.takeNotes : null,
      resolved: Boolean(parsed.resolved),
      escalate: Boolean(parsed.escalate),
      category: parsed.issue_category || 'other',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5).map(String) : [],
    };

    // ── Aperture Trace Emission (fire-and-forget) ──────────────────────────
    const baseUrl = event.headers.host
      ? `https://${event.headers.host}`
      : (process.env.APP_URL || 'https://iisupp.net');
    const lastUserMsg = cleanMsgs[cleanMsgs.length - 1]?.content || '';
    const tracePayload = {
      ts:           Date.now(),
      sessionId:    sessionId,
      turnIndex:    cleanMsgs.filter(m => m.role === 'user').length,
      userMsg:      lastUserMsg.slice(0, 2000),
      ariaResp:     responsePayload.text.slice(0, 3000),
      emotion:      responsePayload.emotion,
      tone:         responsePayload.tone,
      resolved:     responsePayload.resolved,
      escalate:     responsePayload.escalate,
      category:     responsePayload.category,
      suggestions:  responsePayload.suggestions,
      latencyMs:    0,   // not measurable server-side without start time in request
      source:       'aria-chat',
    };
    fetch(`${baseUrl}/.netlify/functions/aria-trace`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tracePayload),
    }).catch(() => {}); // non-blocking — never fail the chat response for tracing

    return json(200, re