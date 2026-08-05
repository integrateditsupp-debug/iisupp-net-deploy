// gmail-draft-send.mjs — send EXISTING Gmail-side drafts by draft id.
//
// outreach-send-batch.mjs drives the SQLite outbox: it composes a draft, sends it, journals it. But a
// pile of drafts was authored straight into Gmail and never represented in SQLite at all, so that driver
// could not see them. This one takes the drafts as they already exist — no recomposition, no re-render —
// and pushes them through the same sendDraft() rail so the deliverability guard, the Sent record and the
// threading behaviour are identical.
//
// Same rails as the outbox driver, for the same reasons:
//   1. --confirm or it is a dry run.
//   2. sendDraft() asserts SPF/DKIM/DMARC live at the wire; DELIVERABILITY_DOWN aborts the batch rather
//      than skipping, because every remaining send would land in spam.
//   3. Journal written immediately after each send, keyed by draft id, so a crash-and-rerun cannot
//      double-send a cold prospect.
//   4. Pacing with jitter — a young domain doing a synchronous burst reads as exactly what it is.
//
// Usage: node scripts/gmail-draft-send.mjs --list wave1.tsv --journal data/draft-send-journal.json --confirm
import fs from 'node:fs';
import { sendDraft, isConfigured } from './lib/gmail-outreach.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const CONFIRM = process.argv.includes('--confirm');
const LIST = arg('--list');
const JOURNAL = arg('--journal', 'data/draft-send-journal.json');
const GAP_MS = Number(arg('--gap', '75000'));

if (!isConfigured()) { console.error('FATAL: gmail secrets missing'); process.exit(2); }
if (!LIST) { console.error('FATAL: --list <tsv of "draftId\\temail"> required'); process.exit(2); }

const rows = fs.readFileSync(LIST, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  .map((l) => { const [id, to] = l.split('\t'); return { id, to }; });
const journal = fs.existsSync(JOURNAL) ? JSON.parse(fs.readFileSync(JOURNAL, 'utf8')) : {};
const queue = rows.filter((r) => !journal[r.id]);

console.log(`queue=${queue.length} already_sent=${Object.keys(journal).length} confirm=${CONFIRM} gap=${GAP_MS}ms`);
for (const r of queue) console.log(`  ${r.to}`);
if (!CONFIRM) { console.log('\nDRY RUN — pass --confirm to actually send.'); process.exit(0); }

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
let sent = 0, failed = 0;

for (const [i, r] of queue.entries()) {
  try {
    const out = await sendDraft(r.id);
    journal[r.id] = { to: r.to, message_id: out.messageId, thread_id: out.threadId, sent_at: Date.now() };
    fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 1));
    sent++;
    console.log(`SENT ${r.to} msg=${out.messageId}`);
  } catch (e) {
    failed++;
    const msg = e?.message || String(e);
    console.log(`FAIL ${r.to} :: ${msg.slice(0, 200)}`);
    if (/DELIVERABILITY_DOWN/.test(msg)) { console.log('ABORTING BATCH — deliverability down.'); break; }
  }
  if (i < queue.length - 1) await sleep(GAP_MS + Math.floor(Math.random() * 20000));
}

console.log(`\ndone sent=${sent} failed=${failed} journal=${JOURNAL}`);
