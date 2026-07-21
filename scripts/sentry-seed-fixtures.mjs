// sentry-seed-fixtures.mjs — P5 gate fixtures. Seeds 6 inbound messages (1 real reply + 1 new request +
// newsletter + receipt + OOO + bounce), with a sent outreach + pending follow-up so the reply's side-effects
// (auto-cancel follow-ups + auto-move to Replied) are demonstrable. Prints the Badge Law count. No network.
import { openDb } from './lib/axis-db.mjs';
import { ingestMessage, buildCtx, actionableCount, draftReplyToInbox } from './lib/sentry.mjs';

const db = openDb();
const bizId = (h) => (db.prepare('SELECT id FROM businesses WHERE handle=?').get(h) || {}).id;
const forlaw = bizId('Lead-022');   // Accounting for Law — will "reply"
const toplaw = bizId('Lead-025');   // Top Law Firm — will "bounce"

// reset P5 state
db.exec("DELETE FROM inbox_messages;");
db.exec("DELETE FROM outreach_items WHERE status='sent';");
db.exec("DELETE FROM follow_ups WHERE business_id IN (" + [forlaw, toplaw].filter(Boolean).join(',') + ");");
db.exec("DELETE FROM suppression_list WHERE reason='unsubscribe_request';");
// restore both to a pre-reply/pre-bounce stage + a scheduled follow-up
for (const id of [forlaw, toplaw]) {
  db.prepare("UPDATE businesses SET pipeline_stage='Sent', email_invalid=0 WHERE id=?").run(id);
  db.prepare("INSERT INTO outreach_items (business_id,channel,kind,subject,status,thread_id,gmail_message_id,to_email,created_at,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id, 'email', 'initial', 'Managed IT & AI automation', 'sent',
      id === forlaw ? 'thread-forlaw' : 'thread-toplaw', id === forlaw ? 'msg-sent-forlaw' : 'msg-sent-toplaw',
      id === forlaw ? 'contact@forlaw.ca' : 'info@toplawfirm.ca', Date.now() - 5 * 864e5, Date.now() - 5 * 864e5);
  db.prepare("INSERT INTO follow_ups (outreach_item_id,business_id,due_at,status) VALUES (?,?,?,?)").run(0, id, Date.now() + 2 * 864e5, 'scheduled');
}

const now = Date.now();
const FIXTURES = [
  { label: 'REPLY', gmail_message_id: 'm-reply-1', thread_id: 'thread-forlaw', from: 'contact@forlaw.ca',
    subject: 'Re: Managed IT & AI automation for Accounting for Law Inc.', snippet: 'Thanks for reaching out — yes, can you send that one-pager and some times this week?',
    headers: { 'In-Reply-To': '<msg-sent-forlaw>', 'References': '<msg-sent-forlaw>' }, received_at: now - 300000 },
  { label: 'NEW REQUEST', gmail_message_id: 'm-new-1', thread_id: 'thread-new-1', from: 'operations@queenswaydental.ca',
    subject: 'IT help — our email is down', snippet: 'Our whole office lost Outlook this morning. Can you help us today? We are not sure who to call.',
    headers: {}, received_at: now - 600000 },
  { label: 'NEWSLETTER', gmail_message_id: 'm-news-1', thread_id: 'thread-news', from: 'newsletter@techcrunch.com',
    subject: 'This week in tech: 12 stories you missed', snippet: 'Top headlines and deals...',
    headers: { 'List-Unsubscribe': '<https://techcrunch.com/unsub>', 'Precedence': 'bulk' }, received_at: now - 900000 },
  { label: 'RECEIPT', gmail_message_id: 'm-rcpt-1', thread_id: 'thread-rcpt', from: 'receipts@stripe.com',
    subject: 'Your receipt from Acme SaaS #4192', snippet: 'Payment received. Amount: $49.00. This is an automated receipt.',
    headers: { 'Auto-Submitted': 'auto-generated' }, received_at: now - 1200000 },
  { label: 'OOO', gmail_message_id: 'm-ooo-1', thread_id: 'thread-ooo', from: 'jane@somefirm.com',
    subject: 'Automatic reply: Out of office', snippet: 'I am currently out of the office and will return Monday.',
    headers: { 'Auto-Submitted': 'auto-replied' }, received_at: now - 1500000 },
  { label: 'BOUNCE', gmail_message_id: 'm-bounce-1', thread_id: 'thread-toplaw', from: 'mailer-daemon@googlemail.com',
    subject: 'Delivery Status Notification (Failure)', snippet: 'Address not found. 550 5.1.1 The email account that you tried to reach does not exist.',
    headers: { 'Content-Type': 'multipart/report; report-type=delivery-status' }, received_at: now - 1800000 },
];

const ctx = buildCtx(db);
console.log('\n========== P5 SENTRY GATE — SEEDED FIXTURES ==========\n');
for (const f of FIXTURES) {
  const r = ingestMessage(db, f, ctx);
  const mark = r.actionable ? '🔴 ACTIONABLE' : '   filtered  ';
  console.log(`${mark}  ${f.label.padEnd(12)} → ${r.classification.padEnd(20)} (${r.reason})`);
  if (r.sysnote) console.log(`              ↳ side-effect: ${r.sysnote}`);
}
const badge = actionableCount(db);
console.log(`\nBADGE (un-actioned actionable only): ${badge}  ${badge === 2 ? '✓ (reply + new request)' : '✗ expected 2'}`);
console.log('Filtered (never counted):', db.prepare("SELECT COUNT(*) n FROM inbox_messages WHERE classification NOT IN ('reply_to_outreach','new_inbound_request')").get().n);
// verify side-effects
const fl = db.prepare('SELECT pipeline_stage FROM businesses WHERE id=?').get(forlaw);
const flFu = db.prepare("SELECT status FROM follow_ups WHERE business_id=?").get(forlaw);
const tl = db.prepare('SELECT email_invalid FROM businesses WHERE id=?').get(toplaw);
const tlFu = db.prepare("SELECT status FROM follow_ups WHERE business_id=?").get(toplaw);
console.log(`\nSIDE-EFFECTS:`);
console.log(`  reply  → Lead-022 stage=${fl.pipeline_stage} (expect Replied), follow-up=${flFu.status} (expect cancelled)`);
console.log(`  bounce → Lead-025 email_invalid=${tl.email_invalid} (expect 1), follow-up=${tlFu.status} (expect cancelled)`);

// Draft AI Reply → Approvals (demonstrates the reply action landing a pending draft, never a send)
const replyMsg = db.prepare("SELECT id FROM inbox_messages WHERE gmail_message_id='m-reply-1'").get();
const draftId = draftReplyToInbox(db, replyMsg.id);
console.log(`\nDraft AI Reply → Approvals: outreach_item ${draftId} (kind=reply, status=pending) — NOT sent`);
db.close();
