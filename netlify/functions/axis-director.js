// AXIS — Director Agent Communication endpoint.
// Ahmad talks to AXIS (caveman / important-only persona). AXIS knows the named roster and routes
// intents to the right agent. It also accepts command + approval actions and LOGS them to a
// content-safe Blobs inbox that the local senior-director-worker pulls each tick.
//
// HARD GATE: this endpoint NEVER sends/applies/pays. It only writes an intent or an approval the
// worker executes behind its rails (template/cap/suppression/anomaly) — anything irreversible waits
// in Approvals. No secrets are stored or returned.

// Named roster (kept in sync with assets/axis-roster.json — names + what they do, no secrets).
const ROSTER = [
  ['Hunter','Find Leads','gov/contract bids daily 3pm'],
  ['Forager','Find Leads','weekday 9am bids + IT/AI leads, drafts outreach'],
  ['Prospector','Find Leads','daily 7am IT contracts, gigs, RFPs'],
  ['Globe','Find Leads','daily top-5 international contracts'],
  ['Tender','Find Leads','daily Ontario/MERX/CanadaBuys MSP tenders'],
  ['Bidwatch','Find Leads','weekly gov bid statuses + deadlines'],
  ['Pitch','Draft Emails','weekday 9am 5 cold drafts + inbound triage'],
  ['Closer','Draft Emails','Monday fresh Apollo leads + drafted batch'],
  ['Ops','Work Report','pre-dawn health check, lead drafts, CEO brief'],
  ['Scout','Work Report','daily 7am cross-agent status + pipeline + news'],
  ['Applicant','Apply LinkedIn','weekday 8am LinkedIn Easy Apply roles'],
  ['Tuner','ARIA Quality','3x/day ARIA classifier test + auto-fix'],
  ['Renew','Send Email','daily 8am Stripe renewal reminders'],
  ['Ledger','Finance','daily 9pm expenses to CRA workbook'],
  ['Auditor','Finance','month-end full expense sweep'],
  ['Compass','Ops Health','daily 6am keep loops aligned to top goal'],
  ['Observer','Ops Health','watch Forge commits + delta'],
  ['Dispatch','Ops Health','every 3h assign idle agents safe no-send work'],
  ['Mesh','Brain','daily 2am relink the Obsidian brain'],
  ['Vault','Brain','2x/day back up the brain'],
  ['Herald','Approvals','daily 8am list queued go-live items'],
  ['Dawn','Work Report','Sunday am revenue, uptime, priorities'],
  ['Dusk','Work Report','Sunday pm week recap + next priority'],
  ['Biller','Finance','one-off retry DigitalOcean payment'],
];
const NAMES = ROSTER.map((r) => r[0]);

const SYSTEM_PROMPT = `You are AXIS — the director of Integrated IT Support Inc.'s autonomous agent fleet. Ahmad talks to you; you dispatch the rest. Forge is the code builder (Claude Code).

VOICE — caveman, important-only. Short. Blunt. No fluff, no pleasantries, no emojis. Say the decision and who does it. 1-3 short lines max. Example: "Pitch redo drafts. Will hold for your ok before send." Never write paragraphs.

YOUR ROSTER (name — function — what they do):
${ROSTER.map((r) => `- ${r[0]} — ${r[1]} — ${r[2]}`).join('\n')}

ROUTING:
- If Ahmad names an agent ("Pitch, redo the drafts"), route to that agent.
- If he states an intent without a name, pick the best agent by function.
- You NEVER send, apply, pay, or publish yourself. You queue the intent; the worker runs it behind safe rails (approved template, daily caps, suppression list, anomaly check). Anything irreversible waits in Approvals for Ahmad.

Respond with ONLY JSON, no markdown:
{
  "text": "your short caveman reply, shown as AXIS",
  "routedAgent": one of [${NAMES.map((n) => '"' + n + '"').join(',')}] or null,
  "intent": "<=140 char plain-language summary of what you queued, or null if just talking",
  "needsApproval": true if the action is irreversible/anomalous and must wait for Ahmad, else false
}`;

const DEPRECATED_MODELS = /claude-sonnet-4-20250514|claude-sonnet-4-5-20250929|claude-3-5-sonnet-202(40|41)|claude-3-opus-20240229|claude-3-haiku-20240307/;

const { bearerFromEvent } = require('./_verify-bearer.cjs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST required' });

  // HARD GATE (2026-07-21): this endpoint writes command/approval intents to the axis-inbox the
  // local worker executes from, and burns ANTHROPIC_API_KEY on chat. It was previously UNAUTHENTICATED
  // — an anonymous caller could forge {action:'approval',decision:'approve'} and bypass the approval
  // gate. Now requires a valid Aperture admin JWT (same login as the console).
  if (!bearerFromEvent(event)) return json(401, { error: 'unauthorized — Aperture login required' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const action = String(body.action || 'chat');

  // ── command / approval: log to the content-safe inbox the worker pulls (never executes here) ──
  if (action === 'command' || action === 'approval') {
    const entry = {
      id: 'axis-' + Date.now().toString(36),
      ts: new Date().toISOString(),
      action,
      agent: NAMES.includes(body.agent) ? body.agent : null,
      intent: sanitize(body.intent || body.title, 200),
      approvalId: typeof body.approvalId === 'string' ? body.approvalId.slice(0, 60) : null,
      decision: action === 'approval' ? (body.decision === 'reject' ? 'reject' : 'approve') : null,
      source: 'axis-command-center'
    };
    let queued = false;
    try {
      const { getStore } = require('@netlify/blobs');
      const store = getStore('axis-inbox');
      const key = `pending/${entry.id}`;
      await store.setJSON(key, entry);
      queued = true;
    } catch (e) {
      // Blobs unavailable (local/dev) — still acknowledge; nothing is lost server-side, just not durable.
      console.warn('[axis-director] inbox store unavailable:', e.message);
    }
    return json(200, {
      ok: true, queued,
      text: action === 'approval'
        ? (entry.decision === 'approve' ? 'Approved · queued, runs next sync (not instant).' : 'Rejected. Held.')
        : `Queued for ${entry.agent || 'the fleet'} · runs next sync. Behind rails — irreversible waits for your ok.`,
      entry: { id: entry.id, agent: entry.agent, intent: entry.intent, decision: entry.decision }
    });
  }

  // ── chat: talk to AXIS ──
  // COST CASCADE (2026-08-11). Before spending a metered API token, try — in order — the ARIA
  // brain, the research agents, then Ahmad's Claude Max plan via the local worker. Only if all
  // three come back empty do we fall through to the Anthropic API below, exactly as before.
  // Nothing in this block can break the old path: any failure returns null and we carry on.
  const lastUser = Array.isArray(body.messages)
    ? [...body.messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string')
    : null;
  const askText = lastUser ? String(lastUser.content).slice(0, 4000) : '';
  if (askText && body.cascade !== false) {
    try {
      const { askBrain } = require('./lib/axis-brain.cjs');
      const host = (event.headers && (event.headers.host || event.headers.Host)) || '';
      const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
      const hit = await askBrain({ query: askText, origin: host ? `https://${host}` : '', auth });
      if (hit && hit.text) {
        return json(200, {
          text: hit.text.slice(0, 2000), routedAgent: null, intent: null, needsApproval: false,
          brainTier: hit.tier, brainSource: hit.source, tried: hit.tried, cost: 0,
        });
      }
    } catch (e) { console.warn('[axis-director] cascade unavailable:', e.message); }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(200, { text: 'No API key is configured, so I have no reasoning brain. Set ANTHROPIC_API_KEY in Netlify. I answer from the board until then.', reason: 'no_key', routedAgent: null, intent: null, degraded: true });

  const envModel = process.env.ARIA_MODEL;
  const model = (envModel && !DEPRECATED_MODELS.test(envModel)) ? envModel : 'claude-sonnet-4-6';

  const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const cleanMsgs = messages
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));
  if (!cleanMsgs.length || cleanMsgs[cleanMsgs.length - 1].role !== 'user') {
    return json(400, { error: 'Last message must be user' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 600, system: SYSTEM_PROMPT, messages: cleanMsgs }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      console.error('[axis-director] Anthropic error', r.status, errBody.slice(0, 300));
      // Say what is actually wrong. "Brain busy. Try again in a sec." was returned for EVERY
      // failure — including an out-of-credit account, where retrying can never work. Ahmad chased
      // that for a day (2026-08-11). The reason code lets the console answer locally instead.
      const { text, reason } = classifyBrainError(r.status, errBody);
      return json(200, { text, reason, routedAgent: null, intent: null, degraded: true });
    }
    const data = await r.json();
    const txt = (data.content && data.content[0] && data.content[0].text) || '';
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch { parsed = { text: txt || 'Heard you.', routedAgent: null, intent: null, needsApproval: false }; }

    const routedAgent = NAMES.includes(parsed.routedAgent) ? parsed.routedAgent : null;
    const out = {
      text: String(parsed.text || 'Heard you.').slice(0, 600),
      routedAgent,
      intent: parsed.intent ? sanitize(parsed.intent, 140) : null,
      needsApproval: Boolean(parsed.needsApproval)
    };

    // If AXIS routed a real intent, queue it to the inbox (still behind worker rails — no send here).
    if (out.routedAgent && out.intent) {
      try {
        const { getStore } = require('@netlify/blobs');
        await getStore('axis-inbox').setJSON(`pending/axis-${Date.now().toString(36)}`, {
          id: 'axis-' + Date.now().toString(36), ts: new Date().toISOString(), action: 'command',
          agent: out.routedAgent, intent: out.intent, needsApproval: out.needsApproval, source: 'axis-chat'
        });
        out.queued = true;
      } catch { out.queued = false; }
    }
    // The KB-agent step: bank a metered answer into the ARIA brain so tier 1 serves this question
    // for free from now on. Gated by worthLearning() — greetings and non-answers are never banked.
    try {
      const { learnBack } = require('./lib/axis-brain.cjs');
      const res = await learnBack({ query: askText, answer: out.text, tier: 'anthropic', source: 'anthropic-api' });
      out.learned = !!res.learned;
    } catch (_) { /* banking is best-effort; never fail a good answer over it */ }
    out.brainTier = 'anthropic';
    return json(200, out);
  } catch (err) {
    console.error('[axis-director] error', err.message);
    return json(200, { text: 'I could not reach the reasoning service at all — likely a network fault. I answer from the board until it is back.', reason: 'unreachable', routedAgent: null, intent: null, degraded: true });
  }
};

// Translate an Anthropic failure into something Ahmad can act on. Never invent a cause: anything
// unrecognised is reported with its real status code rather than dressed up as a transient blip.
// `reason` is a stable machine code the console keys its local fallback + banner off.
function classifyBrainError(status, body) {
  const msg = String(body || '');
  if (/credit balance is too low/i.test(msg))
    return { reason: 'no_credit', text: 'My reasoning brain is out of credit. Top up the Anthropic account (Plans & Billing) and I am back. Until then I answer from the board only.' };
  if (status === 401 || /authentication_error|invalid x-api-key/i.test(msg))
    return { reason: 'auth', text: 'My API key is being rejected. Check ANTHROPIC_API_KEY in Netlify. I answer from the board until it is fixed.' };
  if (status === 403 || /permission_error/i.test(msg))
    return { reason: 'permission', text: 'My API key lacks permission for this model. Until that is fixed I answer from the board only.' };
  if (status === 404 || /not_found_error/i.test(msg))
    return { reason: 'bad_model', text: 'The configured model was not found. Check ARIA_MODEL in Netlify. I answer from the board until it is fixed.' };
  if (status === 429) return { reason: 'rate_limit', text: 'Rate limited. Give it a minute and ask again.' };
  if (status === 529 || status >= 500) return { reason: 'overloaded', text: 'The brain is overloaded right now. Worth trying again shortly.' };
  return { reason: 'error_' + status, text: 'Reasoning failed with status ' + status + '. I answer from the board until it is fixed.' };
}

function sanitize(text, max) {
  return String(text || '').replace(/`[^`]*`/g, '…').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
exports.classifyBrainError = classifyBrainError; // exported for tests/axis-brain-fallback.test.mjs
function json(statusCode, b) { return { statusCode, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(b) }; }
function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization' }; }
