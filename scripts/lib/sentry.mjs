// sentry.mjs — Sentry ingest + side-effects + Badge Law count. WORKER-OWNED. Deterministic side-effects,
// logged; nothing here sends. Enforces the guardrails: unsubscribe→suppress instantly, bounce→invalidate +
// pause sequence, reply→auto-cancel follow-ups + auto-move pipeline card to Replied (quiet system note).
import { classify, ACTIONABLE } from './sentry-classify.mjs';
import { INGEST_SUPPRESS } from './axis-constants.mjs';

const emailOf = (s) => (String(s || '').match(/[\w.+%-]+@[\w.-]+\.[\w-]+/) || [''])[0].toLowerCase();

// BUG B2 — INGEST-LEVEL suppression. Returns the matching rule name, or null to let the message in.
// This runs BEFORE classification and before any INSERT: a suppressed sender never becomes a row, so it
// never costs the founder a scroll and never dilutes the action inbox. It is a deterministic sender
// match only — we never drop mail on a content guess.
//
// The escape hatch matters: if a suppressed address is replying inside a thread we actually sent to,
// it is a real client reply and must survive. Bulk senders never thread with our outreach, so this
// costs nothing in practice and closes the one way this could swallow a genuine message.
export function ingestSuppressionRule(msg, ctx = {}) {
  const from = emailOf(msg.from);
  if (!from) return null;
  const threadsWithSent = !!(ctx.sentThreadIds && msg.thread_id && ctx.sentThreadIds.has(msg.thread_id));
  if (threadsWithSent) return null;
  const hit = INGEST_SUPPRESS.find(r => r.test.test(from));
  return hit ? hit.rule : null;
}

// Build classifier context from what we've sent + who we know.
export function buildCtx(db) {
  const sent = db.prepare("SELECT thread_id, gmail_message_id FROM outreach_items WHERE status='sent'").all();
  const contacts = db.prepare('SELECT public_email FROM businesses WHERE public_email IS NOT NULL').all()
    .concat(db.prepare('SELECT public_email FROM contacts WHERE public_email IS NOT NULL').all());
  return {
    sentThreadIds: new Set(sent.map(s => s.thread_id).filter(Boolean)),
    sentMessageIds: new Set(sent.map(s => s.gmail_message_id).filter(Boolean)),
    knownContacts: new Set(contacts.map(c => emailOf(c.public_email)).filter(Boolean)),
  };
}

// Resolve the business a message belongs to: sent-thread → business, else by sender email.
function resolveBusiness(db, msg) {
  if (msg.thread_id) {
    const o = db.prepare('SELECT business_id FROM outreach_items WHERE thread_id=? AND business_id IS NOT NULL LIMIT 1').get(msg.thread_id);
    if (o) return o.business_id;
  }
  const from = emailOf(msg.from);
  const b = db.prepare('SELECT id FROM businesses WHERE lower(public_email)=?').get(from);
  return b ? b.id : null;
}

function cancelFollowups(db, businessId) {
  if (!businessId) return 0;
  const r = db.prepare("UPDATE follow_ups SET status='cancelled' WHERE business_id=? AND status='scheduled'").run(businessId);
  return r.changes || 0;
}

// Ingest one message: classify, persist, apply side-effects. Returns { classification, sysnote, businessId }.
// A sender on the ingest suppression list short-circuits here — no row, no side-effects, no badge impact.
// We return the rule name so the caller can keep an honest tally of what was filtered and why.
export function ingestMessage(db, msg, ctx = buildCtx(db)) {
  const suppressed = ingestSuppressionRule(msg, ctx);
  if (suppressed) return { classification: 'suppressed', reason: `ingest-suppressed: ${suppressed}`, suppressedRule: suppressed, sysnote: null, businessId: null, actionable: false, ingested: false };

  const c = classify(msg, ctx);
  const businessId = resolveBusiness(db, msg);
  const from = emailOf(msg.from);
  let sysnote = null;

  if (c.classification === 'reply_to_outreach') {
    const cancelled = cancelFollowups(db, businessId);
    if (businessId) {
      const cur = db.prepare('SELECT pipeline_stage FROM businesses WHERE id=?').get(businessId);
      if (cur && cur.pipeline_stage !== 'Replied') {
        db.prepare("UPDATE businesses SET pipeline_stage='Replied', stage_updated_at=? WHERE id=?").run(Date.now(), businessId);
        db.prepare('INSERT INTO pipeline_events (business_id,from_stage,to_stage,cause,at) VALUES (?,?,?,?,?)')
          .run(businessId, cur.pipeline_stage, 'Replied', 'auto:reply', Date.now());
      }
    }
    sysnote = `Reply received — ${cancelled} pending follow-up${cancelled === 1 ? '' : 's'} auto-cancelled; pipeline card moved to Replied.`;
  } else if (c.classification === 'unsubscribe_request') {
    if (from) db.prepare('INSERT INTO suppression_list (email,reason,added_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET reason=excluded.reason').run(from, 'unsubscribe_request', Date.now());
    cancelFollowups(db, businessId);
    sysnote = `Unsubscribe — ${from} added to suppression list (instant); sequence stopped.`;
  } else if (c.classification === 'bounce') {
    if (businessId) db.prepare('UPDATE businesses SET email_invalid=1 WHERE id=?').run(businessId);
    cancelFollowups(db, businessId);
    sysnote = `Bounce — email marked invalid; sequence paused.`;
  }

  db.prepare(`INSERT INTO inbox_messages
    (gmail_message_id,thread_id,business_id,from_email,direction,classification,classify_reason,subject,snippet,body,sysnote,received_at,unread)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
    ON CONFLICT(gmail_message_id) DO UPDATE SET classification=excluded.classification, sysnote=excluded.sysnote`).run(
    msg.gmail_message_id, msg.thread_id || null, businessId, from, 'inbound', c.classification, c.reason,
    msg.subject || '', msg.snippet || '', msg.body || msg.snippet || '', sysnote, msg.received_at || Date.now());

  return { classification: c.classification, reason: c.reason, sysnote, businessId, actionable: ACTIONABLE.includes(c.classification), ingested: true };
}

// Draft an AI reply to an inbox message → writes a PENDING outreach_item (kind='reply') into Approvals.
// NEVER sends. Confident, warm, peer-to-peer (the approved reply-mindset). Threads onto the original.
export function draftReplyToInbox(db, inboxMsgId) {
  const m = db.prepare('SELECT * FROM inbox_messages WHERE id=?').get(inboxMsgId);
  if (!m) return null;
  const biz = m.business_id ? db.prepare('SELECT * FROM businesses WHERE id=?').get(m.business_id) : null;
  const subject = /^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || '');
  const body =
`Hi,

Great to hear from you${biz ? ` — thanks for the note` : ''}. Here's the one-pager I mentioned; it's a quick read on what I'd check first, no obligation.

If it's useful, grab any 15 minutes here: https://calendar.app.google/LUyV5pHxkqJRg5vp8 — otherwise I'm happy to answer over email.

Either way, I'll keep it low-touch and won't chase.

— Ahmad Wasee, Integrated IT Support Inc.`;
  const info = db.prepare(`INSERT INTO outreach_items
    (business_id,channel,kind,subject,body,to_email,template_id,status,thread_id,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    m.business_id, 'email', 'reply', subject, body, m.from_email, 'reply-mindset-v1', 'pending', m.thread_id, Date.now());
  return Number(info.lastInsertRowid);
}

// Badge Law: count un-actioned actionable messages ONLY. 0 → caller renders NO badge (never gray 0).
export function actionableCount(db) {
  return db.prepare(`SELECT COUNT(*) n FROM inbox_messages
    WHERE classification IN ('reply_to_outreach','new_inbound_request') AND actioned_at IS NULL AND (snoozed_until IS NULL OR snoozed_until=0)`).get().n;
}
