// Re-runs deterministic inbox classification after classifier changes, and back-fills the BUG B2
// ingest-suppression decision onto rows that were ingested before that filter existed.
// It intentionally does not replay side effects: this is a read-model correction, not a new Gmail ingest.
//
// NON-DESTRUCTIVE BY CONSTRUCTION. This script only ever writes `classification` and `classify_reason`.
// It never DELETEs and never touches the body, the Gmail ids, or any actioned/snoozed state, so a row
// suppressed here can be restored by relaxing the rule and re-running. That matters because these are
// real messages from a real mailbox: 25 real businesses' worth of context sits behind this table, and a
// classifier change should never be able to destroy mail.
//
// Usage:
//   node scripts/reclassify-axis-inbox.mjs --dry-run   (default — prints the plan, writes nothing)
//   node scripts/reclassify-axis-inbox.mjs --apply     (writes)
import { openDb, setSetting } from './lib/axis-db.mjs';
import { buildCtx, ingestSuppressionRule } from './lib/sentry.mjs';
import { classify } from './lib/sentry-classify.mjs';

const apply = process.argv.includes('--apply');
const db = openDb();
const ctx = buildCtx(db);
const rows = db.prepare('SELECT id,gmail_message_id,thread_id,from_email,subject,snippet,body,classification FROM inbox_messages').all();

const plan = [];
const suppressedByRule = {};
for (const row of rows) {
  const msg = {
    gmail_message_id: row.gmail_message_id, thread_id: row.thread_id, from: row.from_email,
    subject: row.subject, snippet: row.snippet, body: row.body, headers: {},
  };
  // Ingest suppression outranks classification: had the filter existed at ingest time, this row would
  // never have been written at all, so its classification is not a meaningful question.
  const rule = ingestSuppressionRule(msg, ctx);
  const next = rule
    ? { classification: 'suppressed', reason: `ingest-suppressed: ${rule}` }
    : (() => { const c = classify(msg, ctx); return { classification: c.classification, reason: c.reason }; })();
  if (rule) suppressedByRule[rule] = (suppressedByRule[rule] || 0) + 1;
  if (next.classification !== row.classification) plan.push({ id: row.id, from: row.from_email, was: row.classification, now: next.classification, reason: next.reason });
  if (apply) {
    db.prepare('UPDATE inbox_messages SET classification=?, classify_reason=? WHERE id=?')
      .run(next.classification, next.reason, row.id);
  }
}

if (apply) setSetting(db, 'ingest_suppressed', { by_rule: suppressedByRule, total: Object.values(suppressedByRule).reduce((a, b) => a + b, 0), at: new Date().toISOString() });
db.close();

console.log(JSON.stringify({
  mode: apply ? 'APPLIED' : 'dry-run (pass --apply to write)',
  scanned: rows.length,
  changes: plan.length,
  suppressed_by_rule: suppressedByRule,
  plan,
}, null, 2));
