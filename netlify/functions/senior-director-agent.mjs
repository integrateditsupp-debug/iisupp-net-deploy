import { verifyAperture } from './aperture-auth.mjs';
import {
  SENIOR_DIRECTOR_ID,
  buildStatusDigest,
  corsHeaders,
  enqueueTask,
  findAgent,
  formatTelegramDigest,
  getBaseUrl,
  json,
  listAgents,
  parseAssignment,
  sendTelegramMessage,
  seniorDirectorPolicy
} from './_senior-director-core.mjs';

function isAuthed(req) {
  const secret = process.env.SENIOR_DIRECTOR_SECRET;
  const provided = req.headers.get('x-senior-director-secret');
  if (secret && provided === secret) return true;
  return !!verifyAperture(req);
}

function publicSetup() {
  return {
    ok: true,
    service: SENIOR_DIRECTOR_ID,
    configured: {
      seniorDirectorSecret: !!process.env.SENIOR_DIRECTOR_SECRET,
      telegramBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
      telegramOwnerChatId: !!process.env.TELEGRAM_OWNER_CHAT_ID,
      telegramWebhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET
    },
    policy: seniorDirectorPolicy(),
    note: 'POST actions require Aperture admin auth or x-senior-director-secret.'
  };
}

export default async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const url = new URL(req.url);
  const baseUrl = getBaseUrl(req);

  if (req.method === 'GET' && url.searchParams.get('setup') === '1') {
    return json(200, publicSetup(), headers);
  }

  if (!isAuthed(req)) {
    return json(401, { ok: false, reason: 'unauthorized' }, headers);
  }

  if (req.method === 'GET') {
    const digest = await buildStatusDigest(baseUrl);
    return json(200, { ok: true, digest }, headers);
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, reason: 'method-not-allowed' }, headers);
  }

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const action = String(body.action || 'status').toLowerCase();

  if (action === 'status' || action === 'brief') {
    const digest = await buildStatusDigest(baseUrl);
    const telegramText = formatTelegramDigest(digest);
    const telegram = body.notifyTelegram ? await sendTelegramMessage(telegramText) : { skipped: true };
    return json(200, { ok: true, digest, telegram }, headers);
  }

  if (action === 'agents') {
    return json(200, {
      ok: true,
      agents: listAgents().map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        tier: a.tier,
        capabilities: a.capabilities || [],
        tags: a.tags || []
      }))
    }, headers);
  }

  if (action === 'assign') {
    const assignment = body.target && body.instruction
      ? { target: String(body.target), instruction: String(body.instruction) }
      : parseAssignment(body.text || '');
    if (!assignment || !assignment.target || !assignment.instruction) {
      return json(400, { ok: false, reason: 'assignment-required', format: '/assign <agent> | <task>' }, headers);
    }
    if (!findAgent(assignment.target)) {
      return json(400, { ok: false, reason: 'unknown-agent', target: assignment.target }, headers);
    }
    const task = await enqueueTask({
      target: assignment.target,
      instruction: assignment.instruction,
      requestedBy: body.requestedBy || 'ahmad',
      priority: body.priority || 'normal',
      metadata: {
        ownerApproved: !!body.ownerApproved,
        channel: body.channel || 'senior-director-api'
      }
    });
    const telegram = body.notifyTelegram
      ? await sendTelegramMessage(`Queued task ${task.id}\nTarget: ${task.target}\nInstruction: ${task.payload.instruction}`)
      : { skipped: true };
    return json(200, { ok: true, task, telegram }, headers);
  }

  if (action === 'notify') {
    const text = body.text || body.message;
    if (!text) return json(400, { ok: false, reason: 'message-required' }, headers);
    const telegram = await sendTelegramMessage(text, body.chatId || process.env.TELEGRAM_OWNER_CHAT_ID);
    return json(200, { ok: telegram.ok, telegram }, headers);
  }

  return json(400, { ok: false, reason: 'unknown-action', action }, headers);
};

export const config = { path: '/api/senior-director-agent' };
