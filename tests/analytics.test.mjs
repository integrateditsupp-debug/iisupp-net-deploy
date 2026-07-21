// tests/analytics.test.mjs — P7 gate: every analytics dashboard number reconciles exactly to SQLite.
import { openDb } from '../scripts/lib/axis-db.mjs';
import { computeSnapshots } from '../scripts/lib/axis-snapshots.mjs';

const db = openDb(':memory:');
const now = Date.now();
const ins = (name, city, val, stage, real) => db.prepare("INSERT INTO businesses (name,city,region,est_monthly_value,pipeline_stage,is_real,created_at,provenance_json,opportunities_json) VALUES (?,?,?,?,?,?,?,?,?)")
  .run(name, city, 'ON', val, stage, real, now, '{}', '[]').lastInsertRowid;
ins('A Co', 'Toronto', 1000, 'Won', 1);
ins('B Co', 'Mississauga', 2000, 'Sent', 1);
ins('C Co', 'Toronto', 3000, 'Replied', 1);
ins('Fake', 'Toronto', 500, 'Researching', 0);
db.prepare("INSERT INTO outreach_items (channel,kind,status,created_at) VALUES ('email','initial','sent',?)").run(now);
db.prepare("INSERT INTO outreach_items (channel,kind,status,created_at) VALUES ('email','initial','pending',?)").run(now);
db.prepare("INSERT INTO inbox_messages (gmail_message_id,classification,received_at) VALUES ('x','reply_to_outreach',?)").run(now);
db.prepare("INSERT INTO meetings (business_id,scheduled_at,status) VALUES (1,?,?)").run(now, 'scheduled');
db.prepare("INSERT INTO opportunities (business_id,service,est_mrr,status) VALUES (1,'Managed IT',1200,'open')").run();

const a = computeSnapshots(db).analytics;
const q = (sql, ...p) => db.prepare(sql).get(...p);
let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error('  FAIL', n); } };

t('research.total == businesses', a.research.total === q('SELECT COUNT(*) n FROM businesses').n);
t('research.researched == is_real', a.research.researched === q('SELECT COUNT(*) n FROM businesses WHERE is_real=1').n);
t('geo Toronto exact', a.research.geo_coverage.Toronto === q("SELECT COUNT(*) n FROM businesses WHERE city LIKE 'Toronto%'").n);
t('sales.generated == initial outreach', a.sales.generated === q("SELECT COUNT(*) n FROM outreach_items WHERE kind='initial'").n);
t('sales.sent exact', a.sales.sent === q("SELECT COUNT(*) n FROM outreach_items WHERE status='sent'").n);
t('sales.replies exact', a.sales.replies === q("SELECT COUNT(*) n FROM inbox_messages WHERE classification='reply_to_outreach'").n);
t('sales.meetings exact', a.sales.meetings === q('SELECT COUNT(*) n FROM meetings').n);
t('sales.opportunities exact', a.sales.opportunities === q('SELECT COUNT(*) n FROM opportunities').n);
t('sales.won exact', a.sales.won === q("SELECT COUNT(*) n FROM businesses WHERE pipeline_stage='Won'").n);
t('insights.pipeline_value == SUM(est)', a.insights.pipeline_value === q('SELECT COALESCE(SUM(est_monthly_value),0) s FROM businesses').s);
t('insights.opportunity_mrr == SUM(est_mrr)', a.insights.opportunity_mrr === q('SELECT COALESCE(SUM(est_mrr),0) s FROM opportunities').s);
t('funnel Generated == generated', a.sales.funnel[0].n === a.sales.generated);
t('funnel Won == won', a.sales.funnel[4].n === a.sales.won);

db.close();
console.log(`[analytics] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
