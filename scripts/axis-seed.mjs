// axis-seed.mjs — populate data/axis-sales.db with FICTIONAL Toronto/GTA SMB demo data and compute
// snapshots. Run: `node scripts/axis-seed.mjs [--push]`. --push writes snapshots to Netlify Blobs
// (needs NETLIFY_SITE_ID + token); without it, computes + prints + dumps to data/axis-snapshots.dump.json.
//
// RULE: every company/person/email here is invented (no real companies/people). Business identity in the
// UI is the Lead-NNN handle; names are demo-only until real research (Cartographer, P3) fills the DB.
import fs from 'node:fs';
import path from 'node:path';
import { openDb, DATA_DIR } from './lib/axis-db.mjs';
import { computeSnapshots, pushSnapshots, openSnapshotStore } from './lib/axis-snapshots.mjs';

const now = Date.now();
const days = (n) => now - n * 86400000;

// ── Fictional GTA SMBs across the pipeline ──
const BUSINESSES = [
  { handle: 'Lead-014', name: 'Harbourline Logistics', industry: 'Freight & Logistics', city: 'Toronto', region: 'ON', size: '30-50', email: 'ops@harbourline.example', it: 2, cy: 1, cl: 2, ai: 1, val: 2400, stage: 'Replied' },
  { handle: 'Lead-015', name: 'Queen West Dental', industry: 'Healthcare — Dental', city: 'Toronto', region: 'ON', size: '10-20', email: 'reception@qwdental.example', it: 2, cy: 2, cl: 3, ai: 1, val: 1100, stage: 'Waiting Approval' },
  { handle: 'Lead-016', name: 'Beltline Accounting Group', industry: 'Accounting', city: 'Mississauga', region: 'ON', size: '20-30', email: 'info@beltlineacct.example', it: 3, cy: 2, cl: 3, ai: 2, val: 1800, stage: 'Email Generated' },
  { handle: 'Lead-017', name: 'Northform Architects', industry: 'Architecture', city: 'Toronto', region: 'ON', size: '15-25', email: 'studio@northform.example', it: 2, cy: 1, cl: 2, ai: 2, val: 1500, stage: 'Profile Completed' },
  { handle: 'Lead-018', name: 'Lakeshore Physio Collective', industry: 'Healthcare — Physio', city: 'Etobicoke', region: 'ON', size: '10-15', email: 'admin@lakeshorephysio.example', it: 1, cy: 1, cl: 2, ai: 1, val: 950, stage: 'Researching' },
  { handle: 'Lead-019', name: 'Cabbagetown Legal LLP', industry: 'Legal', city: 'Toronto', region: 'ON', size: '20-40', email: 'clerk@cabbagetownlegal.example', it: 3, cy: 3, cl: 3, ai: 2, val: 3200, stage: 'Meeting Scheduled' },
  { handle: 'Lead-020', name: 'Riverdale Manufacturing Co', industry: 'Manufacturing', city: 'Scarborough', region: 'ON', size: '50-80', email: 'it@riverdalemfg.example', it: 2, cy: 2, cl: 1, ai: 1, val: 4100, stage: 'Proposal Sent' },
  { handle: 'Lead-021', name: 'Beaches Boutique Realty', industry: 'Real Estate', city: 'Toronto', region: 'ON', size: '8-12', email: 'hello@beachesrealty.example', it: 1, cy: 1, cl: 2, ai: 1, val: 700, stage: 'Won' },
];

function seed(db) {
  // Clear (idempotent demo state)
  for (const t of ['businesses', 'contacts', 'outreach_items', 'inbox_messages', 'follow_ups', 'pipeline_events', 'meetings', 'opportunities', 'crm_records', 'documents', 'document_versions', 'products_discovered', 'suppression_list', 'agent_runs', 'approvals_audit', 'consent_basis']) {
    db.exec(`DELETE FROM ${t};`);
  }

  const insBiz = db.prepare(`INSERT INTO businesses
    (handle,name,website,industry,city,region,size,public_email,maturity_it,maturity_cyber,maturity_cloud,maturity_ai,opportunities_json,est_monthly_value,pipeline_stage,stage_updated_at,source_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const bizIds = {};
  for (const b of BUSINESSES) {
    const opps = JSON.stringify([{ service: 'Managed IT', est_mrr: b.val, confidence: 0.6 }]);
    const src = JSON.stringify({ source_url: `https://${b.handle.toLowerCase()}.example`, confidence: 0.7, last_verified: new Date(days(2)).toISOString() });
    const r = insBiz.run(b.handle, b.name, `https://${b.handle.toLowerCase()}.example`, b.industry, b.city, b.region, b.size, b.email, b.it, b.cy, b.cl, b.ai, opps, b.val, b.stage, days(1), src, days(7));
    bizIds[b.handle] = Number(r.lastInsertRowid);
  }

  // Contacts (public, sourced)
  const insC = db.prepare(`INSERT INTO contacts (business_id,name,title,public_email,linkedin_url,source_url,confidence) VALUES (?,?,?,?,?,?,?)`);
  insC.run(bizIds['Lead-014'], 'Dana Whitmore', 'Operations Manager', 'ops@harbourline.example', null, 'https://harbourline.example/about', 0.7);
  insC.run(bizIds['Lead-019'], 'M. Osei', 'Office Administrator', 'clerk@cabbagetownlegal.example', null, 'https://cabbagetownlegal.example/team', 0.65);

  // Outreach items — some PENDING (drive the approvals count), one approved, one rejected
  const insO = db.prepare(`INSERT INTO outreach_items (business_id,contact_id,channel,kind,subject,body,facts_json,status,created_at,approved_at,rejected_reason)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const facts = JSON.stringify([{ c: 'runs 12 trucks on a paper dispatch log', s: 'harbourline.example/fleet' }]);
  insO.run(bizIds['Lead-015'], null, 'email', 'initial', 'Quick question on QW Dental\'s backup', 'Problem-first opener…', facts, 'pending', days(1), null, null);
  insO.run(bizIds['Lead-016'], null, 'email', 'initial', 'Beltline: month-end IT bottleneck', 'Problem-first opener…', facts, 'pending', days(1), null, null);
  insO.run(bizIds['Lead-014'], null, 'linkedin', 'initial', 'Harbourline dispatch resilience', 'LinkedIn note…', facts, 'pending', days(2), null, null);
  insO.run(bizIds['Lead-020'], null, 'email', 'initial', 'Riverdale: proposal follow-through', 'Proposal recap…', facts, 'approved', days(3), days(1), null);
  insO.run(bizIds['Lead-017'], null, 'email', 'initial', 'Northform cloud tidy-up', 'Draft…', facts, 'rejected', days(4), null, 'bad timing');

  // Inbox — 2 ACTIONABLE (badge=2), plus filtered noise that must NOT count
  const insM = db.prepare(`INSERT INTO inbox_messages (gmail_message_id,thread_id,business_id,direction,classification,subject,snippet,received_at,unread) VALUES (?,?,?,?,?,?,?,?,?)`);
  insM.run('g-1', 't-1', bizIds['Lead-014'], 'inbound', 'reply_to_outreach', 'Re: Harbourline dispatch resilience', 'Yes, can you send times this week?', days(0), 1);
  insM.run('g-2', 't-2', null, 'inbound', 'new_inbound_request', 'IT help — email down', 'Our whole office lost Outlook this morning', days(0), 1);
  insM.run('g-3', 't-3', null, 'inbound', 'noise', 'Your invoice from Acme SaaS', 'Receipt #4192', days(0), 0);
  insM.run('g-4', 't-4', null, 'inbound', 'out_of_office', 'Automatic reply: away', 'I am OOO until Monday', days(0), 0);

  // Follow-ups
  const insF = db.prepare(`INSERT INTO follow_ups (outreach_item_id,business_id,due_at,status) VALUES (?,?,?,?)`);
  insF.run(4, bizIds['Lead-020'], days(-2), 'scheduled');
  insF.run(1, bizIds['Lead-015'], days(-5), 'scheduled');

  // Meeting, opportunity (won → MRR)
  db.prepare(`INSERT INTO meetings (business_id,scheduled_at,channel,status) VALUES (?,?,?,?)`).run(bizIds['Lead-019'], days(-3), 'call', 'scheduled');
  db.prepare(`INSERT INTO opportunities (business_id,service,est_mrr,status) VALUES (?,?,?,?)`).run(bizIds['Lead-021'], 'Managed IT', 700, 'won');
  db.prepare(`INSERT INTO opportunities (business_id,service,est_mrr,status) VALUES (?,?,?,?)`).run(bizIds['Lead-020'], 'Cybersecurity', 1200, 'open');

  // CRM records (4 types)
  const insR = db.prepare(`INSERT INTO crm_records (type,fields_json,business_id,created_at,updated_at) VALUES (?,?,?,?,?)`);
  insR.run('company', JSON.stringify({ name: 'Harbourline Logistics', handle: 'Lead-014', city: 'Toronto' }), bizIds['Lead-014'], days(7), days(1));
  insR.run('contact', JSON.stringify({ name: 'Dana Whitmore', title: 'Operations Manager', handle: 'Lead-014' }), bizIds['Lead-014'], days(7), days(1));
  insR.run('deal', JSON.stringify({ title: 'Riverdale MSP', stage: 'Proposal Sent', value: 4100 }), bizIds['Lead-020'], days(5), days(1));
  insR.run('activity', JSON.stringify({ kind: 'note', text: 'Left voicemail; try email' }), bizIds['Lead-014'], days(1), days(1));

  // Documents (a couple seeded types)
  db.prepare(`INSERT INTO documents (type,title,status) VALUES (?,?,?)`).run('Managed IT Service Agreement', 'Managed IT Service Agreement — Ontario (DRAFT)', 'Template');
  db.prepare(`INSERT INTO documents (type,title,status) VALUES (?,?,?)`).run('Proposal', 'MSP Proposal — Riverdale Manufacturing', 'Draft');

  // Product discovered (Miner)
  db.prepare(`INSERT INTO products_discovered (name,category,demand,ease,profitability,scalability,advantage,weighted_score,evidence_json,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('Dental-practice backup bundle', 'managed expansion', 4, 4, 4, 3, 3, 3.7, JSON.stringify([{ note: '3 dental prospects on paper backups' }]), 'Recommended', days(2));

  // Agent runs — the 3 new agents report through the same channel
  const insRun = db.prepare(`INSERT INTO agent_runs (agent,started_at,finished_at,status,summary) VALUES (?,?,?,?,?)`);
  insRun.run('Cartographer', days(0), days(0), 'ok', 'Profiled 8 GTA SMBs with provenance');
  insRun.run('Sentry', days(0), days(0), 'ok', '2 actionable messages surfaced, 2 filtered');
  insRun.run('Miner', days(1), days(1), 'ok', '1 product opportunity scored');

  // Suppression + consent basis samples
  db.prepare(`INSERT INTO suppression_list (email,reason,added_at) VALUES (?,?,?)`).run('unsub@example.com', 'unsubscribe_request', days(3));
  db.prepare(`INSERT INTO consent_basis (contact_id,basis,evidence_url,recorded_at) VALUES (?,?,?,?)`).run(1, 'conspicuous_publication', 'https://harbourline.example/contact', days(2));
}

async function main() {
  const push = process.argv.includes('--push');
  const db = openDb();
  seed(db);
  const snaps = computeSnapshots(db);

  console.log('[axis-seed] DB seeded. Snapshot summary:');
  console.log('  overview.kpis        :', JSON.stringify(snaps.overview.kpis));
  console.log('  inbox.badge          :', snaps.inbox.badge, '(should be 2: 1 reply + 1 new request)');
  console.log('  approvals.pending    :', snaps.approvals.pending, '(should be 3)');
  console.log('  pipeline cards       :', snaps.pipeline.cards.length);
  console.log('  crm.counts           :', JSON.stringify(snaps.crm.counts));
  console.log('  analytics.funnel     :', JSON.stringify(snaps.analytics.funnel));

  const dump = path.join(DATA_DIR, 'axis-snapshots.dump.json');
  fs.writeFileSync(dump, JSON.stringify(snaps, null, 2));
  console.log('  wrote                :', dump, '(gitignored)');

  if (push) {
    const store = await openSnapshotStore();
    if (!store) { console.log('  --push: no Blobs store (need NETLIFY_SITE_ID + token) — skipped'); }
    else {
      const prev = await store.get('version', { type: 'json' }).catch(() => null);
      const ver = await pushSnapshots(store, snaps, prev);
      console.log('  pushed to Blobs      : version v' + ver.v + ', changed:', ver.changed.join(','));
    }
  }
  db.close();
}

main().catch(e => { console.error('[axis-seed] FAILED:', e); process.exit(1); });
