import {
  buildStatusDigest,
  formatTelegramDigest,
  sendTelegramMessage
} from './_senior-director-core.mjs';

const ARIA_BASE = process.env.URL || 'https://iisupp.net';

export default async () => {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_OWNER_CHAT_ID) {
    console.log('[senior-director-digest-cron] Telegram env not configured; skipping.');
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'telegram-not-configured' }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  const digest = await buildStatusDigest(ARIA_BASE);
  const important =
    (digest.leads.hot || 0) > 0 ||
    (digest.queue.failed || 0) > 0 ||
    (digest.events.attention || []).length > 0;

  if (!important && process.env.SENIOR_DIRECTOR_DAILY_ALWAYS !== '1') {
    console.log('[senior-director-digest-cron] No important updates; skipping quiet digest.');
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no-important-updates' }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  const sent = await sendTelegramMessage(formatTelegramDigest(digest));
  console.log('[senior-director-digest-cron]', JSON.stringify({ sent: sent.ok, hot: digest.leads.hot, failed: digest.queue.failed }));
  return new Response(JSON.stringify({ ok: sent.ok, sent }), {
    headers: { 'content-type': 'application/json' }
  });
};

export const config = { schedule: '0 13 * * *' };
