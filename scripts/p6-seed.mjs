// p6-seed.mjs — P6 gate seed. Seeds the 16 DRAFT templates, schedules follow-ups across all 4 views,
// and prepares ONE document for a real prospect → Approvals. Idempotent-ish. No network, nothing sends.
import { openDb } from './lib/axis-db.mjs';
import { seedTemplates, prepareForClient } from './lib/documents.mjs';
import { scheduleFollowups, followupViews } from './lib/followups.mjs';

const DAY = 86400000;
const db = openDb();
const bizId = (h) => (db.prepare('SELECT id FROM businesses WHERE handle=?').get(h) || {}).id;

// 1) Documents: clear the P1 fictional versionless docs, then seed the 16 templates cleanly
db.exec("DELETE FROM document_versions; DELETE FROM documents;");
seedTemplates(db);
const docCount = db.prepare('SELECT COUNT(*) n FROM documents').get().n;

// 2) Follow-ups: clear any prior scheduled for these two, then schedule with varied "sent" dates so the
//    views populate (123 Dental sent 3d ago → touch1 due today; Accounting Plus sent 10d ago → overdue).
const dental = bizId('Lead-024'), acctPlus = bizId('Lead-027');
for (const id of [dental, acctPlus]) db.prepare("DELETE FROM follow_ups WHERE business_id=? AND status='scheduled'").run(id);
scheduleFollowups(db, dental, null, Date.now() - 3 * DAY);   // touch1 due today, touch2/3 upcoming
scheduleFollowups(db, acctPlus, null, Date.now() - 10 * DAY); // touch1/2 overdue, touch3 upcoming
const views = followupViews(db);

// 3) Prepare ONE document for a real prospect → Approvals (Managed IT Service Agreement for 123 Dental)
const doc = db.prepare("SELECT id FROM documents WHERE type='Managed IT Service Agreement'").get();
const prep = prepareForClient(db, doc.id, dental);

console.log('\n========== P6 GATE SEED ==========');
console.log('Documents seeded:', docCount, '(expect 16+ ; template DRAFTs)');
console.log('Follow-up views: due_today', views.due_today.length, '| overdue', views.overdue.length, '| upcoming', views.upcoming.length, '| auto_cancelled', views.auto_cancelled.length);
console.log(`Prepared: Managed IT Service Agreement for 123 Dental → document v${prep.version}, Approvals item ${prep.approvalId} (pending, channel=document) — NOT sent`);
// verify versioning: the prepared doc created a new version, template v1 retained
const vers = db.prepare('SELECT version FROM document_versions WHERE document_id=? ORDER BY version').all(doc.id).map(r => r.version);
console.log('Versioning (append-only): Managed IT Service Agreement versions =', vers.join(','), '(v1 template retained, v2 = client-merged)');
console.log('Approvals pending (all channels):', db.prepare("SELECT COUNT(*) n FROM outreach_items WHERE status='pending'").get().n);
db.close();
