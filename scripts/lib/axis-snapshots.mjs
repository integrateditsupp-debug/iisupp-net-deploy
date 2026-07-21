// axis-snapshots.mjs — compute sanitized read-model snapshots from the SQLite truth, and push them to
// Netlify Blobs for the authed /api/axis/snapshot endpoint. WORKER-OWNED. The UI never computes these.
//
// Contract (build plan §3 read-path):
//   - one Blobs key per module (store 'axis-snapshots'), value = { module, generatedAt, version, data }
//   - a 'version' key = { v, modules: {module: v}, tick } — UI polls this, refetches only changed modules
// Snapshots are SANITIZED: no secrets, business identity uses the Lead-NNN handle in list views; full
// name/contact only inside a record the authed operator opened (still behind the JWT).
import { SNAPSHOT_MODULES, PIPELINE_PHASES, PIPELINE_STAGES, ACTIONABLE_CLASSES, BLOBS, DEFAULT_RAILS } from './axis-constants.mjs';

const j = (row, col, fallback) => { try { return JSON.parse(row[col]); } catch { return fallback; } };

// ── Per-module computation. Each returns a plain JSON-able object. ──
export function computeSnapshots(db) {
  const out = {};
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const one = (sql, ...a) => db.prepare(sql).get(...a);

  // Pipeline: cards grouped by stage (Kanban) — list view uses handle, not name.
  const biz = all('SELECT * FROM businesses');
  out.pipeline = {
    phases: PIPELINE_PHASES,
    counts: Object.fromEntries(PIPELINE_STAGES.map(s => [s, biz.filter(b => b.pipeline_stage === s).length])),
    cards: biz.map(b => ({
      id: b.id, handle: b.handle, city: b.city, industry: b.industry,
      est_monthly_value: b.est_monthly_value, stage: b.pipeline_stage, stage_updated_at: b.stage_updated_at,
    })),
  };

  // Prospects: dense list (handles + maturity + opportunity value).
  out.prospects = {
    count: biz.length,
    rows: biz.map(b => ({
      id: b.id, handle: b.handle, industry: b.industry, city: b.city, size: b.size,
      maturity: { it: b.maturity_it, cyber: b.maturity_cyber, cloud: b.maturity_cloud, ai: b.maturity_ai },
      est_monthly_value: b.est_monthly_value, stage: b.pipeline_stage,
      has_public_email: !!b.public_email,
    })),
  };

  // Inbox: only actionable rows count for the badge (Law 2).
  const msgs = all('SELECT * FROM inbox_messages ORDER BY received_at DESC');
  const openActionable = msgs.filter(m => ACTIONABLE_CLASSES.includes(m.classification) && !m.actioned_at && !m.snoozed_until);
  out.inbox = {
    badge: openActionable.length, // exact number the red badge shows; 0 → UI renders no badge element
    rows: msgs.map(m => ({
      id: m.id, thread_id: m.thread_id, classification: m.classification, subject: m.subject,
      snippet: m.snippet, received_at: m.received_at, unread: !!m.unread,
      actioned: !!m.actioned_at, snoozed_until: m.snoozed_until, business_id: m.business_id,
    })),
    counts: {
      all: msgs.length,
      replies: msgs.filter(m => m.classification === 'reply_to_outreach').length,
      new_requests: msgs.filter(m => m.classification === 'new_inbound_request').length,
      snoozed: msgs.filter(m => m.snoozed_until).length,
      handled: msgs.filter(m => m.actioned_at).length,
    },
  };

  // Approvals: pending get the neutral count badge.
  const items = all('SELECT * FROM outreach_items ORDER BY created_at DESC');
  const pending = items.filter(i => i.status === 'pending');
  out.approvals = {
    pending: pending.length,
    tabs: {
      pending: pending.length,
      outbound: items.filter(i => i.status === 'approved' || i.status === 'outbound').length,
      rejected: items.filter(i => i.status === 'rejected').length,
      skipped: items.filter(i => i.status === 'skipped').length,
    },
    rows: items.map(i => ({
      id: i.id, channel: i.channel, kind: i.kind, subject: i.subject, status: i.status,
      business_id: i.business_id, created_at: i.created_at, facts: j(i, 'facts_json', []),
    })),
    rails: DEFAULT_RAILS,
  };

  // Outreach studio packs (grouped by business).
  out.outreach = {
    packs: items.filter(i => i.channel && i.kind).map(i => ({
      id: i.id, business_id: i.business_id, channel: i.channel, kind: i.kind, subject: i.subject, status: i.status,
    })),
  };

  // Follow-ups.
  const fups = all('SELECT * FROM follow_ups');
  const nowTs = j({ t: null }, 't', null); // snapshots are time-agnostic; UI computes due/overdue from due_at
  out.followups = {
    scheduled: fups.filter(f => f.status === 'scheduled').length,
    cancelled: fups.filter(f => f.status === 'cancelled').length,
    rows: fups.map(f => ({ id: f.id, business_id: f.business_id, due_at: f.due_at, status: f.status })),
  };

  // CRM (4 tabs derived from crm_records + businesses).
  const crm = all('SELECT * FROM crm_records ORDER BY updated_at DESC');
  out.crm = {
    counts: {
      contacts: crm.filter(r => r.type === 'contact').length,
      companies: crm.filter(r => r.type === 'company').length,
      deals: crm.filter(r => r.type === 'deal').length,
      activities: crm.filter(r => r.type === 'activity').length,
    },
    records: crm.map(r => ({ id: r.id, type: r.type, fields: j(r, 'fields_json', {}), business_id: r.business_id, updated_at: r.updated_at })),
  };

  // Documents.
  const docs = all('SELECT * FROM documents');
  out.documents = { rows: docs.map(d => ({ id: d.id, type: d.type, title: d.title, status: d.status })) };

  // Products discovered (Miner).
  const prods = all('SELECT * FROM products_discovered ORDER BY weighted_score DESC');
  out.products = { rows: prods.map(p => ({ id: p.id, name: p.name, category: p.category, weighted_score: p.weighted_score, status: p.status })) };

  // Fleet: latest run per agent.
  const runs = all('SELECT * FROM agent_runs ORDER BY started_at DESC');
  const byAgent = {};
  for (const r of runs) if (!byAgent[r.agent]) byAgent[r.agent] = r;
  out.fleet = { agents: Object.values(byAgent).map(r => ({ agent: r.agent, status: r.status, started_at: r.started_at, finished_at: r.finished_at, summary: r.summary })) };

  // Analytics (worker-computed aggregates; UI only renders).
  out.analytics = {
    funnel: {
      generated: items.length,
      approved: items.filter(i => ['approved', 'outbound', 'sent'].includes(i.status)).length,
      sent: items.filter(i => i.status === 'sent').length,
      replied: msgs.filter(m => m.classification === 'reply_to_outreach').length,
      won: biz.filter(b => b.pipeline_stage === 'Won').length,
    },
    pipeline_value: biz.reduce((s, b) => s + (b.est_monthly_value || 0), 0),
  };

  // Reports meta + settings + integrations status placeholders.
  out.reports = { workbook: null, lastGenerated: null };
  out.settings = { rails: DEFAULT_RAILS, suppression_count: (one('SELECT COUNT(*) c FROM suppression_list') || {}).c || 0 };

  // Overview KPIs (derived, never hardcoded).
  out.overview = {
    kpis: {
      pipeline_value: out.analytics.pipeline_value,
      awaiting_approval: pending.length,
      messages_waiting: openActionable.length,
      followups_due: fups.filter(f => f.status === 'scheduled').length,
      meetings_week: (one('SELECT COUNT(*) c FROM meetings') || {}).c || 0,
      mrr: (one("SELECT COALESCE(SUM(est_mrr),0) s FROM opportunities WHERE status='won'") || {}).s || 0,
    },
    needs_you_now: pending.slice(0, 5).map(i => ({ id: i.id, subject: i.subject, business_id: i.business_id, kind: i.kind })),
  };

  // Ensure every declared module exists (empty-but-present beats undefined).
  for (const m of SNAPSHOT_MODULES) if (!out[m]) out[m] = {};
  return out;
}

// Wrap a computed module payload with envelope metadata.
function envelope(module, data, version) {
  return { module, version, generatedAt: new Date().toISOString(), data };
}

// Push snapshots to the store, bump per-module + global version. `prevVersion` = the current version doc
// (or null). Returns the new version doc. Only modules whose JSON changed get a bumped version.
export function diffAndBump(snapshots, prevVersion) {
  const prev = prevVersion && prevVersion.modules ? prevVersion.modules : {};
  const prevHash = prevVersion && prevVersion.hashes ? prevVersion.hashes : {};
  const modules = {}, hashes = {};
  let bumped = false;
  for (const m of Object.keys(snapshots)) {
    const h = cheapHash(JSON.stringify(snapshots[m]));
    hashes[m] = h;
    if (prevHash[m] === h) { modules[m] = prev[m] || 1; }
    else { modules[m] = (prev[m] || 0) + 1; bumped = true; }
  }
  const v = (prevVersion && prevVersion.v ? prevVersion.v : 0) + (bumped ? 1 : 0);
  return { v, modules, hashes, changed: Object.keys(modules).filter(m => modules[m] !== prev[m]) };
}

function cheapHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Open the snapshot Blobs store the same way the worker opens axis-inbox (siteID + token, or null in dev).
export async function openSnapshotStore() {
  try {
    const { getStore } = await import('@netlify/blobs');
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
    if (siteID && token) return getStore({ name: BLOBS.snapshotStore, siteID, token, consistency: 'strong' });
    return getStore(BLOBS.snapshotStore); // dev / function context (implicit env)
  } catch { return null; }
}

// Full push: write each module key + the version key. Returns the version doc (or null if no store).
export async function pushSnapshots(store, snapshots, prevVersion) {
  const versionDoc = diffAndBump(snapshots, prevVersion);
  versionDoc.tick = new Date().toISOString();
  if (!store) return versionDoc; // dev without Blobs — caller may still inspect versionDoc
  for (const m of versionDoc.changed) {
    await store.setJSON(m, envelope(m, snapshots[m], versionDoc.modules[m]));
  }
  await store.setJSON(BLOBS.versionKey, versionDoc);
  return versionDoc;
}
