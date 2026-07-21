// tests/p6.test.mjs — P6 follow-up cadence + document versioning/merge. In-memory DB, no network.
import { openDb } from '../scripts/lib/axis-db.mjs';
import { scheduleFollowups, followupViews, CADENCE_DAYS, MAX_TOUCHES } from '../scripts/lib/followups.mjs';
import { seedTemplates, prepareForClient, newVersion } from '../scripts/lib/documents.mjs';

const db = openDb(':memory:');
const now = Date.now(), DAY = 86400000;
const biz = db.prepare("INSERT INTO businesses (handle,name,public_email,est_monthly_value,pipeline_stage,provenance_json,opportunities_json,is_real,created_at) VALUES (?,?,?,?,?,?,?,1,?)")
  .run('Lead-900', 'Test Dental Co', 'info@testco.example', 3600, 'Sent', JSON.stringify({ address: { value: '1 Main St' } }), JSON.stringify([{ service: 'Cybersecurity', est_mrr: 1200, basis: 'x' }]), now);
const bizId = Number(biz.lastInsertRowid);

let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error('  FAIL', n); } };

// Cadence: max 3 touches then STOP
scheduleFollowups(db, bizId, null, now - 3 * DAY);
scheduleFollowups(db, bizId, null, now);         // second call must NOT exceed 3 total
const fu = db.prepare('SELECT COUNT(*) n FROM follow_ups WHERE business_id=?').get(bizId).n;
t(`max ${MAX_TOUCHES} touches then stop`, fu === MAX_TOUCHES);
t('cadence is 3/7/14', JSON.stringify(CADENCE_DAYS) === JSON.stringify([3, 7, 14]));

// Views: touch1 (sent 3d ago) due today; touch2/3 upcoming
const v = followupViews(db, now);
t('due_today has 1', v.due_today.length === 1);
t('upcoming has the rest', v.upcoming.length === 2);
t('none overdue yet', v.overdue.length === 0);

// Follow-ups queue through Approvals (pending outreach_items kind=followup)
t('followups queued as pending outreach', db.prepare("SELECT COUNT(*) n FROM outreach_items WHERE kind='followup' AND status='pending'").get().n === MAX_TOUCHES);

// Documents: seed 16
seedTemplates(db);
t('16 templates seeded', db.prepare('SELECT COUNT(*) n FROM documents').get().n === 16);
t('every template marked DRAFT — not legal advice', db.prepare("SELECT COUNT(*) n FROM document_versions WHERE body LIKE '%DRAFT — not legal advice%'").get().n === 16);

// Prepare for client: merges {{client_name}}, new version (old retained), routes to Approvals (channel=document)
const doc = db.prepare("SELECT id FROM documents WHERE type='NDA'").get();
const prep = prepareForClient(db, doc.id, bizId);
const v2 = db.prepare('SELECT body FROM document_versions WHERE id=?').get(prep.versionId).body;
t('merge filled {{client_name}} → business name', v2.includes('Test Dental Co') && !v2.includes('{{client_name}}'));
t('append-only: v1 retained', db.prepare('SELECT COUNT(*) n FROM document_versions WHERE document_id=?').get(doc.id).n === 2);
t('prepared doc → Approvals (channel=document, pending)', db.prepare("SELECT COUNT(*) n FROM outreach_items WHERE channel='document' AND status='pending'").get().n === 1);

// Edit → new version, old retained
const before = db.prepare('SELECT COUNT(*) n FROM document_versions WHERE document_id=?').get(doc.id).n;
newVersion(db, doc.id, 'edited body');
t('edit appends a version (old retained)', db.prepare('SELECT COUNT(*) n FROM document_versions WHERE document_id=?').get(doc.id).n === before + 1);

db.close();
console.log(`[p6] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
