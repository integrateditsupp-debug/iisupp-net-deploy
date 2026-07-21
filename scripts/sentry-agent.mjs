// sentry-agent.mjs — Sentry inbox monitor. WORKER-OWNED, LOCAL. Polls ahmad.wasee@iisupp.net (the SAME
// mailbox we send from) every 2–5 min, classifies inbound, applies side-effects, and Telegram-pings when
// the actionable count RISES. DORMANT until Gmail OAuth exists (scripts/gmail-auth.mjs). Reads only; never
// sends. Run: node scripts/sentry-agent.mjs [--once]. Install: scripts/install-sentry-worker.ps1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, DATA_DIR } from './lib/axis-db.mjs';
import { buildCtx, ingestMessage, actionableCount } from './lib/sentry.mjs';
import { isConfigured, listInbound, getMessageParsed } from './lib/gmail-outreach.mjs';

const STATE = path.join(DATA_DIR, 'sentry-state.json');
const INTERVAL_MS = Number(process.env.SENTRY_INTERVAL_MS || 3 * 60 * 1000); // 3 min (2–5 min band)

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chat) return false;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
    });
    return true;
  } catch { return false; }
}

async function tick() {
  if (!isConfigured()) { console.log('[sentry] dormant — Gmail OAuth not configured (run scripts/gmail-auth.mjs). No polling.'); return { dormant: true }; }
  const db = openDb();
  const before = actionableCount(db);
  let last = 0; try { last = JSON.parse(fs.readFileSync(STATE, 'utf8')).last_epoch || 0; } catch {}
  const sinceSec = last ? Math.floor(last / 1000) : undefined;
  const ids = await listInbound(sinceSec);
  const known = new Set(db.prepare('SELECT gmail_message_id FROM inbox_messages').all().map(r => r.gmail_message_id));
  const ctx = buildCtx(db);
  let ingested = 0, newest = last;
  const newlyActionable = [];
  for (const id of ids) {
    if (known.has(id)) continue;
    const msg = await getMessageParsed(id);
    const r = ingestMessage(db, msg, ctx);
    ingested++; newest = Math.max(newest, msg.received_at || 0);
    if (r.actionable) newlyActionable.push({ business: r.businessId, classification: r.classification });
  }
  fs.writeFileSync(STATE, JSON.stringify({ last_epoch: newest || Date.now() }));
  const after = actionableCount(db);
  if (after > before) {
    // Name the company on the newest actionable if we can.
    const b = newlyActionable[0]?.business ? db.prepare('SELECT name FROM businesses WHERE id=?').get(newlyActionable[0].business) : null;
    const who = b ? b.name : 'a client';
    await telegram(`Client replied — ${who}. ${after} waiting.`);
  }
  console.log(`[sentry] tick: ${ingested} new, actionable ${before}→${after}`);
  db.close();
  return { ingested, before, after };
}

async function main() {
  const once = process.argv.includes('--once');
  if (once) { await tick(); return; }
  await tick();
  while (true) { await new Promise(r => setTimeout(r, INTERVAL_MS)); try { await tick(); } catch (e) { console.error('[sentry] tick error', e.message); } }
}
main().catch(e => { console.error('[sentry] fatal', e); process.exit(1); });
