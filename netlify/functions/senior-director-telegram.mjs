import {
  buildStatusDigest,
  corsHeaders,
  enqueueTask,
  findAgent,
  formatTelegramDigest,
  getBaseUrl,
  json,
  listAgents,
  parseAssignment,
  sendTelegramMessage
} from './_senior-director-core.mjs';

function telegramSecretOk(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  return req.headers.get('x-telegram-bot-api-secret-token') === expected;
}

function ownerOk(update) {
  const owner = process.env.TELEGRAM_OWNER_CHAT_ID;
  const chatId = update?.message?.chat?.id || update?.edited_message?.chat?.id;
  if (!owner || !chatId) return false;
  return String(chatId) === String(owner);
}

function extractText(update) {
  return String(update?.message?.text || update?.edited_message?.text || '').trim();
}

function helpText() {
  return [
    'Senior Director Agent online.',
    '',
    'Commands:',
    '/status - company/agent/lead brief',
    '/leads - latest Lead Radar summary',
    '/agents - active/planned agent list',
    '/assign <agent> | <task> - queue work for an agent',
    '',
    'Examples:',
    '/assign aria-research | find no-cost lead sources for Ontario MSP buyers',
    'tell senior-director-agent review site growth opportunities this week',
    '',
    'Guardrails: no spend, no external outreach, no credential/security changes, and no public promises without approval.'
  ].join('\n');
}

export default async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') {
    return json(200, {
      ok: true,
      service: 'senior-director-telegram',
      configured: {
        telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
        telegramOwnerChatId: !!process.env.TELEGRAM_OWNER_CHAT_ID,
        telegramWebhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET
      },
      note: 'Telegram sends POST updates here after setWebhook.'
    }, headers);
  }

  if (!telegramSecretOk(req)) {
    return json(403, { ok: false, reason: 'bad-webhook-secret' }, headers);
  }

  let update = {};
  try { update = await req.json(); } catch (_) {}

  if (!ownerOk(update)) {
    return json(200, { ok: true, ignored: true, reason: 'not-owner-chat' }, headers);
  }

  const chatId = update?.message?.chat?.id || update?.edited_message?.chat?.id;
  const text = extractText(update);
  const baseUrl = getBaseUrl(req);
  let reply = '';

  try {
    if (!text || /^\/start\b|^\/help\b/i.test(text)) {
      reply = helpText();
    } else if (/^\/status\b|^\/brief\b/i.test(text)) {
      reply = formatTelegramDigest(await buildStatusDigest(baseUrl));
    } else if (/^\/leads\b/i.test(text)) {
      const digest = await buildStatusDigest(baseUrl);
      const rows = (digest.leads.matches || []).slice(0, 8).map((m, i) => {
        const hot = m.hot ? 'HOT ' : '';
        return `${i + 1}. ${hot}${m.title || 'Untitled'}${m.org ? ` - ${m.org}` : ''}${m.close ? ` (closes ${m.close})` : ''}${m.url ? `\n${m.url}` : ''}`;
      });
      reply = rows.length
        ? `Lead Radar: ${digest.leads.count} matches, ${digest.leads.hot} hot, ${digest.leads.scanned} scanned\n\n${rows.join('\n\n')}`
        : `Lead Radar: no current matches. Scanned ${digest.leads.scanned}.`;
    } else if (/^\/agents\b/i.test(text)) {
      const rows = listAgents().map((a) => `${a.status === 'active' ? 'ACTIVE' : 'PLANNED'} ${a.id} - ${a.type || 'agent'}`);
      reply = rows.join('\n').slice(0, 3600);
    } else {
      const assignment = parseAssignment(text);
      if (assignment) {
        if (!findAgent(assignment.target)) {
          reply = `I do not know agent "${assignment.target}". Send /agents for the registry.`;
        } else {
          const task = await enqueueTask({
            target: assignment.target,
            instruction: assignment.instruction,
            requestedBy: 'telegram-owner',
            priority: 'owner',
            metadata: { channel: 'telegram', ownerApproved: true }
          });
          reply = `Queued task ${task.id}\nTarget: ${task.target}\nInstruction: ${task.payload.instruction}`;
        }
      } else {
        const task = await enqueueTask({
          target: 'senior-director-agent',
          instruction: text,
          requestedBy: 'telegram-owner',
          priority: 'owner',
          metadata: { channel: 'telegram', ownerApproved: true, note: 'Owner free-form request; director should triage/delegate.' }
        });
        reply = `I queued this for Senior Director Agent to triage/delegate.\nTask: ${task.id}`;
      }
    }
  } catch (e) {
    reply = `Senior Director Agent error: ${e?.message || String(e)}`;
  }

  const sent = await sendTelegramMessage(reply, chatId);
  return json(200, { ok: true, sent }, headers);
};

export const config = { path: '/api/senior-director-telegram' };
