// Removes only the confirmed AXIS demo and Sentry fixture records from the local worker database.
// Run after copying the database to a backup. This never calls Gmail or sends anything.
import { openDb, setSetting } from './lib/axis-db.mjs';

const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice('--backup='.length) || null;
const db = openDb();
const fixtureMessages = ['m-reply-1', 'm-new-1', 'm-news-1', 'm-rcpt-1', 'm-ooo-1', 'm-bounce-1'];
const fixtureBusinessIds = db.prepare('SELECT id FROM businesses WHERE is_real=0').all().map(r => r.id);
const placeholders = fixtureBusinessIds.map(() => '?').join(',');
const changes = {};
const run = (name, sql, args = []) => { changes[name] = (db.prepare(sql).run(...args).changes || 0); };

try {
  db.exec('BEGIN');
  if (fixtureBusinessIds.length) {
    run('approvals_audit', `DELETE FROM approvals_audit WHERE item_id IN (SELECT id FROM outreach_items WHERE business_id IN (${placeholders}))`, fixtureBusinessIds);
    run('consent_basis', `DELETE FROM consent_basis WHERE contact_id IN (SELECT id FROM contacts WHERE business_id IN (${placeholders}))`, fixtureBusinessIds);
    run('crm_records', `DELETE FROM crm_records WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('meetings', `DELETE FROM meetings WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('opportunities', `DELETE FROM opportunities WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('pipeline_events', `DELETE FROM pipeline_events WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('follow_ups', `DELETE FROM follow_ups WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('outreach_items', `DELETE FROM outreach_items WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('contacts', `DELETE FROM contacts WHERE business_id IN (${placeholders})`, fixtureBusinessIds);
    run('businesses', `DELETE FROM businesses WHERE id IN (${placeholders})`, fixtureBusinessIds);
  }

  run('fixture_inbox', `DELETE FROM inbox_messages WHERE gmail_message_id IN (${fixtureMessages.map(() => '?').join(',')})`, fixtureMessages);
  run('fixture_outreach', "DELETE FROM outreach_items WHERE gmail_message_id IN ('msg-sent-forlaw','msg-sent-toplaw') OR thread_id IN ('thread-forlaw','thread-toplaw')");
  run('fixture_followups', 'DELETE FROM follow_ups WHERE outreach_item_id=0 AND business_id IN (15,18)');
  run('fixture_events', "DELETE FROM pipeline_events WHERE business_id IN (15,18) AND cause='auto:reply'");
  run('fixture_products', "DELETE FROM products_discovered WHERE name='Dental-practice backup bundle'");
  run('fixture_agents', "DELETE FROM agent_runs WHERE (agent='Cartographer' AND summary='Profiled 8 GTA SMBs with provenance') OR (agent='Sentry' AND summary='2 actionable messages surfaced, 2 filtered') OR (agent='Miner' AND summary='1 product opportunity scored')");
  run('fixture_suppression', "DELETE FROM suppression_list WHERE email='unsub@example.com' AND reason='unsubscribe_request'");

  for (const businessId of [15, 18]) {
    const prior = db.prepare("SELECT to_stage FROM pipeline_events WHERE business_id=? AND cause<>'auto:reply' ORDER BY at DESC LIMIT 1").get(businessId);
    if (prior?.to_stage) db.prepare('UPDATE businesses SET pipeline_stage=?, stage_updated_at=?, email_invalid=0 WHERE id=?').run(prior.to_stage, Date.now(), businessId);
  }
  setSetting(db, 'data_meta', { db: 'data/axis-sales.db', last_backup: backup || null });
  db.exec('COMMIT');
  console.log(JSON.stringify({ removed: changes, backup }, null, 2));
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  throw error;
} finally {
  db.close();
}
