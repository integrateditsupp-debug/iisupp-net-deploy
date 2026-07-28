// outreach-send-batch.mjs — the missing SEND driver for the approved outreach queue.
//
// gmail-outreach.mjs has always exposed createDraft() and sendDraft(), but nothing drove them: the batch
// sat pending forever. This is that driver. It is deliberately boring and resumable.
//
// Rails, in order, and none of them are optional:
//   1. Explicit --confirm flag. No accidental sends from a stray invocation.
//   2. assertDeliverabilityOrThrow() inside sendDraft() — SPF/DKIM/DMARC must be live at the wire.
//   3. draft-then-send, so replies thread and the message exists in Sent for audit.
//   4. A per-item journal written after EVERY send. If this process dies at item 7, item 7 is already
//      recorded and a rerun skips it. Double-sending a cold prospect is the one unrecoverable mistake here.
//   5. Pacing between sends — a 11-message burst from a domain whose DKIM went live days ago reads as
//      exactly what it is. Spread it out.
//
// Usage: node scripts/outreach-send-batch.mjs --in data/outbox-export.json --journal data/send-journal.json --confirm
import fs from 'node:fs';
import { createDraft, sendDraft, isConfigured } from './lib/gmail-outreach.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const CONFIRM = process.argv.includes('--confirm');
const IN = arg('--in', 'data/outbox-export.json');
const JOURNAL = arg('--journal', 'data/send-journal.json');
const GAP_MS = Number(arg('--gap', '32000'));
const LIMIT = Number(arg('--limit', '99'));

// Highest-pain leads first. If the batch gets throttled or something breaks midway, the leads most likely
// to convert are already out the door rather than stuck behind the filler.
const PRIORITY = ['info@123-dental.com', 'contact@findingclarity.ca', 'info@winchesters.ca', 'tds@tdspersonnel.com', 'info@matrix360.ca'];

if (!isConfigured()) { console.error('FATAL: gmail secrets missing'); process.exit(2); }

const items = JSON.parse(fs.readFileSync(IN, 'utf8'));
const journal = fs.existsSync(JOURNAL) ? JSON.parse(fs.readFileSync(JOURNAL, 'utf8')) : {};
const rank = (it) => { const i = PRIORITY.indexOf(it.to_email); return i === -1 ? 100 : i; };
const queue = items.filter((it) => !journal[it.id]).sort((a, b) => rank(a) - rank(b) || a.id - b.id).slice(0, LIMIT);

console.log(`queue=${queue.length} already_sent=${Object.keys(journal).length} confirm=${CONFIRM} gap=${GAP_MS}ms`);
for (const it of queue) console.log(`  #${it.id} ${it.to_email}`);
if (!CONFIRM) { console.log('\nDRY RUN — pass --confirm to actually send.'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sent = 0, failed = 0;

for (const [i, it] of queue.entries()) {
  try {
    const draft = await createDraft({ to: it.to_email, subject: it.subject, body: it.body });
    const draftId = draft.id || draft.draftId || draft?.message?.id;
    if (!draftId) throw new Error('no draft id returned: ' + JSON.stringify(draft).slice(0, 160));
    const res = await sendDraft(draftId);
    // Journal BEFORE logging success — a crash between send and journal is what causes a double-send.
    journal[it.id] = { to: it.to_email, draft_id: draftId, message_id: res.messageId, thread_id: res.threadId, sent_at: Date.now() };
    fs.writeFileSync(JOURNAL, JSON.stringify(journal, null, 1));
    sent++;
    console.log(`SENT #${it.id} ${it.to_email} msg=${res.messageId}`);
  } catch (e) {
    failed++;
    const msg = e?.message || String(e);
    console.log(`FAIL #${it.id} ${it.to_email} :: ${msg.slice(0, 200)}`);
    // Deliverability going down mid-batch is a STOP, not a skip: every remaining send would land in spam.
    if (/DELIVERABILITY_DOWN/.test(msg)) { console.log('ABORTING BATCH — deliverability down.'); break; }
  }
  if (i < queue.length - 1) await sleep(GAP_MS + Math.floor(Math.random() * 8000));
}

console.log(`\ndone sent=${sent} failed=${failed} journal=${JOURNAL}`);
