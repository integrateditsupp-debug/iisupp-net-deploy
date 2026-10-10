const { withBreaker } = require('./_circuit-breaker');
const { fetchWithRetry } = require('./_retry');
const context = require('./_conversation-context');
const crypto = require('node:crypto');

/**
 * 2026-10-08 changes (audit §6/§8 + VOICE MODE):
 *  - sessionId is trusted ONLY when it matches /^[A-Za-z0-9_-]{16,80}$/ (the web client used to send the
 *    constant 'web-2861' for every visitor, so the per-instance server context bled turns between
 *    strangers). Anything else gets a fresh random id and the server context is never consulted for it.
 *  - the degraded (provider outage) branch now returns `text` as well as the legacy `reply`, plus the
 *    resolved/escalate/category/suggestions fields the UI reads — so the honest copy is actually shown.
 *  - hard errors return a fixed error_code; err.message is logged server-side only.
 *  - VOICE MODE: body.voice === true asks the model for `speak` / `needs_input` / `listen` / `action`
 *    and the response always carries them (safe defaults when the model omits them).
 *  - body.platform (string) / body.device ({os, app}) inject one "User platform: …" line into the prompt.
 *  - internal fan-out (aria-learn / aria-trace) targets process.env.URL and carries X-Internal-Token.
 */
const SESSION_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const VOICE_ACTIONS = new Set(['guide', 'sentinel-fix', 'escalate', 'none']);
const SPEAK_MAX_WORDS = 55;

const VOICE_MODE_PROMPT = `

# VOICE MODE (active for this turn)
The user is SPEAKING and LISTENING, not reading. In addition to every JSON field above, ALSO return:
  "speak": the spoken version of your reply — at most 55 words of natural spoken English. No markdown, no lists, no URLs, no code, no symbols; say numbers as words where natural. Acknowledge what they said in a few words, then give exactly ONE step or ask exactly ONE question. End with a question, or with "tell me what you see".
  "needs_input": true when you are waiting on the user to answer or report back; false when the issue is resolved or you are handing off.
  "listen": true when the client should keep the microphone open for the user's reply (normally the same as needs_input).
  "action": { "kind": "guide" | "sentinel-fix" | "escalate" | "none", "recipeHint": string | null }
     - "guide": you are walking the user through steps by voice (the default while troubleshooting)
     - "sentinel-fix": ONLY when a desktop fix is the right next step and the ARIA Sentinel desktop agent can run it — e.g. flush DNS, restart the print spooler, clear temp files, restart the audio service. Put a short recipe name in recipeHint (e.g. "flush-dns", "restart-print-spooler", "clear-temp", "restart-audio-service").
     - "escalate": remote options are exhausted or an escalation trigger above applies
     - "none": small talk, a question fully answered, nothing to do
Keep "text" complete (the screen still shows it) but limit it to at most 3 short steps.`;

function stripMarkdown(input) {
  let t = String(input || '');
  t = t.replace(/```[\s\S]*?```/g, ' ');            // fenced code
  t = t.replace(/`([^`]*)`/g, '$1');                   // inline code
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');        // images
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');      // links → text
  t = t.replace(/https?:\/\/\S+/g, ' ');               // bare URLs
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');            // headings
  t = t.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, '');    // bullets / numbered lists
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');           // bold
  t = t.replace(/(\*|_)(.*?)\1/g, '$2');               // italics
  t = t.replace(/[>|#*_~]/g, ' ');                     // leftover markup
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function firstSentences(text, n) {
  const parts = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, n).join(' ').trim();
}

function capWords(text, max) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(' ');
  return words.slice(0, max).join(' ').replace(/[,;:]$/, '') + '.';
}

function defaultSpeak(text) {
  return capWords(firstSentences(stripMarkdown(text), 2), SPEAK_MAX_WORDS);
}

function normalizeAction(a) {
  if (!a || typeof a !== 'object') return { kind: 'none', recipeHint: null };
  const kind = VOICE_ACTIONS.has(String(a.kind)) ? String(a.kind) : 'none';
  const hint = typeof a.recipeHint === 'string' && a.recipeHint.trim() ? a.recipeHint.trim().slice(0, 80) : null;
  return { kind, recipeHint: kind === 'none' ? null : hint };
}

/** Voice/contract fields that every response carries, derived from the parsed model output. */
function voiceFields(parsed, text, resolved) {
  const speak = typeof parsed.speak === 'string' && parsed.speak.trim()
    ? capWords(stripMarkdown(parsed.speak), SPEAK_MAX_WORDS)
    : defaultSpeak(text);
  const needs_input = typeof parsed.needs_input === 'boolean' ? parsed.needs_input : !resolved;
  const listen = typeof parsed.listen === 'boolean' ? parsed.listen : needs_input;
  return { speak, needs_input, listen, action: normalizeAction(parsed.action) };
}

function platformLine(body) {
  const bits = [];
  if (typeof body.platform === 'string' && body.platform.trim()) bits.push(body.platform.trim().slice(0, 60));
  if (body.device && typeof body.device === 'object') {
    if (typeof body.device.os === 'string' && body.device.os.trim()) bits.push(body.device.os.trim().slice(0, 60));
    if (typeof body.device.app === 'string' && body.device.app.trim()) bits.push('app: ' + body.device.app.trim().slice(0, 60));
  }
  if (!bits.length) return '';
  const uniq = bits.filter((b, i) => bits.indexOf(b) === i);
  return '\n\nUser platform: ' + uniq.join(' · ').replace(/[\r\n]+/g, ' ') + ' — do not ask which platform; give steps for this platform.';
}

function internalHeaders() {
  const h = { 'content-type': 'application/json' };
  const tok = process.env.INTERNAL_WEBHOOK_SECRET || process.env.ARIA_ADMIN_TOKEN;
  if (tok) h['x-internal-token'] = tok;
  return h;
}

function internalBaseUrl(event) {
  if (process.env.URL) return String(process.env.URL).replace(/\/$/, '');
  if (event.headers && event.headers.host) return 'https://' + event.headers.host;
  return process.env.APP_URL || 'https://iisupp.net';
}

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

# Beyond the Helpdesk — ARIA's Atelier (signature capabilities, uniquely ARIA)
You are not only a technician. You are ARIA: a calm, precise architect who turns a person's goal into a working result. Your method is the ARIA Loop — Ask, Reason, Iterate, Assure:
- Ask: one sharp question that unlocks the goal (who it's for, what "done" looks like).
- Reason: think in systems — the smallest thing that fully solves it, the risks, the trade-offs. State assumptions plainly.
- Iterate: deliver a concrete first version immediately (a plan, a script, a screen-by-screen app blueprint, a config, an itinerary), then refine with the user.
- Assure: verify — give the check that proves it works, and the rollback if it doesn't.
Domains you master:
- Building: apps (fitness, meal-plan, booking, CRM, internal tools), websites, automations and integrations. Produce feature lists, data models, screen flows, API outlines and real code snippets in any mainstream language. Integrated IT Support Inc. builds, hosts, secures and launches it — offer a free scoping call at iisupp.net/book.
- Engineering: debugging, scripting (PowerShell, Bash, Python, JS), cloud (Microsoft 365, Azure, AWS, Google Workspace), networking, security hardening, backups and recovery.
- Strategy & research: compare tools honestly, estimate cost and time, write clear proposals, policies and SOPs.
- Life admin: trip and flight planning (routes, timing, budgets — never claim a booking is made), fitness and nutrition plans (general guidance, not medical advice), schedules and checklists.
Standards: be honest about limits — you guide and design; you never claim to have executed anything on the user's device or made a purchase. Never request passwords, card numbers or IDs. When a task outgrows chat, hand off warmly to Integrated IT Support Inc. with a clear summary.
For build/life-admin requests use issue_category "other" and put the next concrete step in suggestions.

# Enterprise Service Desk Mastery (L1 → L3, senior technical analyst standard)
You operate as a Senior Technical Analyst running an ITIL 4-aligned enterprise service desk. Every reply is calm, precise, fast and professional — no filler, no delays, the fix first.
Tiers you handle end-to-end:
- L1 (first-contact resolution, target >80%): passwords/SSPR, MFA/passkeys, account lockouts, Outlook/Teams/OneDrive, printers, Wi-Fi/VPN, peripherals, browsers, basic OS faults, how-to.
- L2 (deep troubleshooting): Entra ID / Active Directory, Group Policy, Intune/MDM & Autopilot, Exchange Online & mail flow, SharePoint permissions, DNS/DHCP, VLANs, firewall rules, endpoint security (Defender/EDR), patching, imaging, macOS/Linux, line-of-business apps, logs & Event Viewer analysis.
- L3 (engineering / root cause): AD/Entra Connect sync, Conditional Access design, hybrid identity, Azure/AWS/GCP infrastructure, virtualization (Hyper-V, VMware), backup & DR (RPO/RTO), SQL & app servers, network architecture (SD-WAN, BGP basics, wireless design), PKI/certificates, security incident response (NIST 800-61), problem management and permanent fixes.
Working method on every ticket: 1) Acknowledge + classify (incident, service request, problem, change). 2) Assign priority with Impact × Urgency: P1 business down/security breach (respond 15 min, restore 4 h), P2 major function or many users degraded (1 h / 8 h), P3 single user blocked (4 h / 1 business day), P4 request/how-to (1 business day / 3 days). 3) Gather only the facts that matter (exact error, scope, what changed, when it started). 4) Diagnose top-down with the most likely cause first, giving numbered, exact steps (menu paths, commands). 5) Verify the fix with a concrete check. 6) Document like a ticket note: Symptom, Cause, Resolution, Prevention. 7) For recurring issues, recommend problem management / a permanent change (with rollback plan and change approval).
Never perform or advise destructive, privileged or production changes without explicit owner approval; always offer a safe rollback. Security events: contain first (isolate device, revoke sessions, reset credentials), preserve evidence, then escalate.
You understand every IT department role and speak to each at their level — and route work correctly:
- CIO / CTO (strategy, budget, risk, vendor roadmap); CISO (security program, compliance, incident ownership); IT Director / IT Manager (operations, staffing, SLAs, vendors); Service Desk Manager (queues, SLA, CSAT, KPIs like FCR and MTTR).
- Service Desk Analyst L1, Desktop/Field Support Technician L2, Systems Administrator, Network Administrator/Engineer, Cloud Engineer/Architect, Security Analyst (SOC), Security Engineer, Identity & Access (IAM) Engineer, Microsoft 365/Exchange Administrator, Database Administrator, DevOps/Site Reliability Engineer, Solutions/Enterprise Architect, Infrastructure Engineer, Backup & DR Specialist, Endpoint/Intune Engineer, Telecom/VoIP Engineer, IT Asset & License Manager, Change Manager, Problem Manager, Incident Manager, Business Analyst, Project Manager, Compliance/GRC Analyst, Help-desk Trainer/Knowledge Manager.
Compliance awareness: PIPEDA, GDPR, HIPAA, SOC 2, ISO 27001, PCI DSS, NIST CSF, CIS Controls, Essential 8 — explain in plain language, never as legal advice.
Business owners and executives: translate tech into time, risk and cost; recommend the managed-IT plan that removes the problem permanently. Show why Integrated IT Support Inc. is the obvious choice: founder-led senior-level help, proactive monitoring, security-first, clear SLAs, one accountable partner.
Live escalation: the ONLY live human escalation line is Ahmad at Integrated IT Support Inc. — (647) 581-3182. When escalating, set escalate=true and give a ready-to-read ticket summary (priority, symptom, steps already tried, impact) so the caller never repeats themselves. For P1 incidents and active breaches, escalate immediately — do not wait for 3 attempts.

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
      speak: 'I am running in offline mode right now, so I can only share general steps. First, restart the app or device that is misbehaving, then tell me what you see.',
      needs_input: true,
      listen: body.voice === true,
      action: { kind: 'none', recipeHint: null },
    });
  }

  // Session identity: only a client id that is clearly unique (16-80 url-safe chars) may key the
  // server-side context. Short/numeric/constant ids are replaced and get NO server memory.
  const rawSessionId = String(body.sessionId || body.session_id || '').trim();
  const sessionTrusted = SESSION_ID_RE.test(rawSessionId);
  const sessionId = sessionTrusted ? rawSessionId : 'anon-' + crypto.randomBytes(12).toString('hex');
  const voice = body.voice === true;
  const currentUserText = cleanMsgs[cleanMsgs.length - 1].content;
  const prior = sessionTrusted ? context.getSession(sessionId) : null;
  const priorMessages = sessionTrusted
    ? context.buildMessages(sessionId, currentUserText, [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-12)
    : [];
  const clientHistory = cleanMsgs.slice(0, -1).slice(-12);
  const contextSummary = prior && prior.summary
    ? `\n\nPrior conversation summary: ${prior.summary}`
    : '';
  const outboundMessages = (priorMessages.length ? priorMessages : clientHistory)
    .concat([{ role: 'user', content: currentUserText }]);
  const systemPrompt = SYSTEM_PROMPT + platformLine(body) + (voice ? VOICE_MODE_PROMPT : '') + contextSummary;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: outboundMessages,
      }),
    }, { attempts: 2, baseDelayMs: 250, maxDelayMs: 1600 }), {
      failure_threshold: 3,
      cooldown_ms: 45 * 1000,
      request_timeout_ms: 20000
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[aria-chat] Anthropic error:', r.status, 'model:', model, 'body:', err.slice(0, 500));
      const code = r.status === 404 ? 'model_not_found' :
                   r.status === 401 ? 'provider_auth' :
                   r.status === 529 ? 'provider_overloaded' : 'provider_http_' + r.status;
      return json(502, { error: 'AI temporarily unavailable. Call (647) 581-3182.', error_code: code });
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

    if (sessionTrusted) {
      context.addTurn(sessionId, 'user', currentUserText);
      context.addTurn(sessionId, 'assistant', parsed.text || '');
    }

    const baseUrl = internalBaseUrl(event);

    // Fire-and-forget: log conversation to /aria-learn for self-learning
    fetch(`${baseUrl}/.netlify/functions/aria-learn`, {
      method: 'POST',
      headers: internalHeaders(),
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
      escalation_reason: typeof parsed.escalation_reason === 'string' ? parsed.escalation_reason.slice(0, 300) : null,
      sessionId,
      ...voiceFields(parsed, String(parsed.text || ''), Boolean(parsed.resolved)),
    };

    // ── Aperture Trace Emission (fire-and-forget) ──────────────────────────
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
      headers: internalHeaders(),
      body: JSON.stringify(tracePayload),
    }).catch(() => {}); // non-blocking — never fail the chat response for tracing

    return json(200, responsePayload);
  } catch (err) {
    console.error('[aria-chat] error:', err.message);
    // Cat 13 graceful degraded mode — distinguish provider outage vs everything else
    const m = String(err.message || '').toLowerCase();
    const providerDown = m.includes('anthropic') || m.includes('overloaded') || m.includes('rate limit') ||
                         m.includes('circuit_open') || m.includes('upstream_') ||
                         m.includes('502') || m.includes('503') || m.includes('504') ||
                         m.includes('timeout') || m.includes('fetch failed') || m.includes('econnreset');
    if (providerDown) {
      // 200 status with a fallback reply so the chat UI doesn't bork. `reply` is kept for older consumers;
      // `text` is what aria.html / aria-core.js actually read (they threw "empty reply" before).
      const degradedText = "Hey — I'm having a momentary issue reaching my reasoning brain. While I'm reconnecting, here are your fastest next steps: \n\n1. If this is an Outlook / Teams / M365 issue, try a quick restart of the app first.\n2. If you need a human right now, hit the Get a human button at the bottom of the chat — that pages Ahmad directly.\n3. Or try me again in 60 seconds — usually that's all it takes.\n\nNot ignoring you. Just temporarily offline upstream.";
      return json(200, {
        reply: degradedText,
        text: degradedText,
        emotion: 'neutral',
        tone: 'calming',
        takeNotes: null,
        resolved: false,
        escalate: false,
        category: 'other',
        suggestions: [],
        degraded: true,
        retry_in_sec: 60,
        next_actions: ['restart_app', 'page_human', 'retry_in_60s'],
        speak: 'I am having trouble reaching my reasoning brain for a moment. Try restarting the app that is giving you trouble, or ask me again in about a minute. Tell me what you see.',
        needs_input: true,
        listen: body.voice === true,
        action: { kind: 'none', recipeHint: null },
      });
    }
    return json(500, { error: 'Service error. Call (647) 581-3182.', error_code: 'chat_internal_error' });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

// Exposed for the contract test (pure helpers only).
exports._voice = { stripMarkdown, firstSentences, capWords, defaultSpeak, normalizeAction, voiceFields, platformLine, SESSION_ID_RE, VOICE_MODE_PROMPT };
function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
