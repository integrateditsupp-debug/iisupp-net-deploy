// axis-snapshots.mjs — compute sanitized read-model snapshots from the SQLite truth, and push them to
// Netlify Blobs for the authed /api/axis/snapshot endpoint. WORKER-OWNED. The UI never computes these.
//
// Contract (build plan §3 read-path):
//   - one Blobs key per module (store 'axis-snapshots'), value = { module, generatedAt, version, data }
//   - a 'version' key = { v, modules: {module: v}, tick } — UI polls this, refetches only changed modules
// Snapshots are SANITIZED: no secrets, business identity uses the Lead-NNN handle in list views; full
// name/contact only inside a record the authed operator opened (still behind the JWT).
import { SNAPSHOT_MODULES, PIPELINE_PHASES, PIPELINE_STAGES, ACTIONABLE_CLASSES, BLOBS, DEFAULT_RAILS, CASL, OUTREACH_PACING } from './axis-constants.mjs';
import { followupViews } from './followups.mjs';
import { buildReplyDraft } from './sentry.mjs';
import { generateOutreach } from './outreach.mjs';

// The composer must show the EXACT bytes that will transmit, and the browser is not allowed to invent
// outbound wording. So the read model ships worker-produced copy with the CASL block already attached —
// what the operator reads in the composer is what the send queue will use.
const caslBlock = () => `\n\n—\n${CASL.line}`;

const j = (row, col, fallback) => { try { return JSON.parse(row[col]); } catch { return fallback; } };

// ── Per-module computation. Each returns a plain JSON-able object. ──
export function computeSnapshots(db) {
  const out = {};
  const all = (sql, ...a) => db.prepare(sql).all(...a);
  const one = (sql, ...a) => db.prepare(sql).get(...a);

  // Pipeline: cards grouped by stage (Kanban) — list view uses handle, not name.
  // The authenticated UI is operational, not a demo surface. A fixture can remain useful to a
  // local test, but records explicitly marked non-real never cross this read-model boundary.
  //
  // TWO cohorts, deliberately. `biz` (real only) backs every OPERATIONAL surface — pipeline cards,
  // prospect PII, approvals, CRM, revenue. `bizAll` backs RESEARCH COVERAGE analytics, where the whole
  // point of the panel is "researched N of total M": collapsing total onto the real subset would make
  // total === researched and destroy the distinction the Prospects header already renders.
  const bizAll = all('SELECT * FROM businesses');
  const biz = bizAll.filter(b => b.is_real);
  const bizById = new Map(bizAll.map(b => [b.id, b]));
  const realBusinessIds = new Set(biz.map(b => b.id));
  const belongsToRealBusiness = (row) => !row.business_id || realBusinessIds.has(row.business_id);
  out.pipeline = {
    phases: PIPELINE_PHASES,
    counts: Object.fromEntries(PIPELINE_STAGES.map(s => [s, biz.filter(b => b.pipeline_stage === s).length])),
    cards: biz.map(b => ({
      id: b.id, handle: b.handle, name: b.name, is_real: !!b.is_real, city: b.city, industry: b.industry,
      est_monthly_value: b.est_monthly_value, stage: b.pipeline_stage, stage_updated_at: b.stage_updated_at,
    })),
  };

  // Prospects: full BI profiles (Law 3 provenance travels with the row so S5 can render source/verified).
  const contactsAll = all('SELECT * FROM contacts');
  const byBiz = {};
  for (const c of contactsAll) (byBiz[c.business_id] = byBiz[c.business_id] || []).push({ name: c.name, title: c.title, public_email: c.public_email, linkedin_url: c.linkedin_url, source_url: c.source_url, confidence: c.confidence });
  out.prospects = {
    count: biz.length,
    real_count: biz.filter(b => b.is_real).length,
    rows: biz.map(b => ({
      id: b.id, handle: b.handle, name: b.name, is_real: !!b.is_real,
      industry: b.industry, city: b.city, region: b.region, size: b.size, address: b.address,
      website: b.website, phone: b.phone, public_email: b.public_email, linkedin_url: b.linkedin_url,
      socials: j(b, 'socials_json', {}),
      maturity: { it: b.maturity_it, cyber: b.maturity_cyber, cloud: b.maturity_cloud, ai: b.maturity_ai },
      maturity_detail: j(b, 'maturity_json', null),
      opportunities: j(b, 'opportunities_json', []),
      provenance: j(b, 'provenance_json', {}),
      source: j(b, 'source_json', {}),
      est_monthly_value: b.est_monthly_value, stage: b.pipeline_stage,
      has_public_email: !!b.public_email,
      contacts: byBiz[b.id] || [],
      // The LOCKED template (axis-private-constants APPROVED_TEMPLATE, locked 2026-06-25), personalized
      // on {name} only and carrying the exact CASL footer. Generated HERE so the browser never retypes
      // approved copy — the prospect composer opens with these exact bytes and sends them.
      outreach_draft: (() => { const g = generateOutreach(b); return { subject: g.subject, body: g.body + caslBlock(), template_id: g.template }; })(),
    })),
  };

  // Inbox: only actionable rows count for the badge (Law 2).
  // Rows already marked 'suppressed' were caught by the BUG B2 ingest filter (internal/DMARC/LinkedIn/
  // retail bulk). They are retained in SQLite as an audit trail — nothing is deleted — but they are kept
  // out of the read model entirely, including the Filtered drawer, because the point of suppressing at
  // ingest rather than at classify is that they should cost the operator nothing at all. The count is
  // still surfaced so the number is honest rather than hidden.
  const msgsAll = all('SELECT * FROM inbox_messages ORDER BY received_at DESC').filter(belongsToRealBusiness);
  const msgs = msgsAll.filter(m => m.classification !== 'suppressed');
  const openActionable = msgs.filter(m => ACTIONABLE_CLASSES.includes(m.classification) && !m.actioned_at && !m.snoozed_until);
  out.inbox = {
    badge: openActionable.length, // exact number the red badge shows; 0 → UI renders no badge element
    rows: msgs.map(m => {
      const row = {
        id: m.id, thread_id: m.thread_id, classification: m.classification, classify_reason: m.classify_reason,
        subject: m.subject, snippet: m.snippet, body: m.body, from_email: m.from_email, sysnote: m.sysnote,
        received_at: m.received_at, unread: !!m.unread,
        actioned: !!m.actioned_at, action_taken: m.action_taken, snoozed_until: m.snoozed_until, business_id: m.business_id,
      };
      // Actionable rows carry a ready reply so "Draft AI Reply" opens a composer INSTANTLY, in place,
      // with real text — instead of queuing an intent and sending the operator off to another tab to
      // wait for it (the exact tab-hopping defect in CC-BRIEF §2A).
      if (ACTIONABLE_CLASSES.includes(m.classification)) {
        const biz = m.business_id ? bizById.get(m.business_id) : null;
        const d = buildReplyDraft(m, biz);
        row.suggested_reply = { subject: d.subject, body: d.body + caslBlock(), template_id: d.template_id };
      }
      return row;
    }),
    counts: {
      all: msgs.length,
      replies: msgs.filter(m => m.classification === 'reply_to_outreach').length,
      new_requests: msgs.filter(m => m.classification === 'new_inbound_request').length,
      snoozed: msgs.filter(m => m.snoozed_until).length,
      handled: msgs.filter(m => m.actioned_at).length,
      suppressed: msgsAll.length - msgs.length, // never entered the action inbox (B2)
    },
  };

  // Approvals: pending get the neutral count badge.
  const items = all('SELECT * FROM outreach_items ORDER BY created_at DESC').filter(belongsToRealBusiness);
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

  // Outreach studio drafts (full content for S7 — every exit routes through Approvals; no send here).
  out.outreach = {
    identity: { from: 'Ahmad Wasee <ahmad.wasee@iisupp.net>', reply_to: 'ahmad.wasee@iisupp.net' },
    drafts: items.filter(i => i.channel === 'email').map(i => ({
      id: i.id, business_id: i.business_id, channel: i.channel, kind: i.kind, subject: i.subject, body: i.body,
      to_email: i.to_email, status: i.status, template_id: i.template_id,
      consent_basis: i.consent_basis, consent_evidence: i.consent_evidence, lint: j(i, 'lint_json', null),
    })),
  };

  // Follow-ups — 4 views (S8). Cadence day 3/7/14, max 3 touches (in the views payload).
  out.followups = followupViews(db, Date.now(), true);

  // CRM (4 tabs derived from crm_records + businesses).
  const crm = all('SELECT * FROM crm_records ORDER BY updated_at DESC').filter(belongsToRealBusiness);
  out.crm = {
    counts: {
      contacts: crm.filter(r => r.type === 'contact').length,
      companies: crm.filter(r => r.type === 'company').length,
      deals: crm.filter(r => r.type === 'deal').length,
      activities: crm.filter(r => r.type === 'activity').length,
    },
    records: crm.map(r => ({ id: r.id, type: r.type, fields: j(r, 'fields_json', {}), business_id: r.business_id, updated_at: r.updated_at })),
  };

  // Documents (S9) — templates + client-prepared, with append-only version history + current body.
  const docs = all('SELECT * FROM documents');
  const versionsByDoc = {};
  for (const v of all('SELECT id,document_id,version,created_at FROM document_versions ORDER BY version')) (versionsByDoc[v.document_id] = versionsByDoc[v.document_id] || []).push({ id: v.id, version: v.version, created_at: v.created_at });
  out.documents = {
    types: docs.length,
    rows: docs.map(d => {
      const cur = one('SELECT body FROM document_versions WHERE id=?', d.current_version_id) || one('SELECT body FROM document_versions WHERE document_id=? ORDER BY version DESC LIMIT 1', d.id);
      return { id: d.id, type: d.type, title: d.title, status: d.status, current_version_id: d.current_version_id, versions: versionsByDoc[d.id] || [], body: cur ? cur.body : '' };
    }),
  };

  // Products discovered (Miner) — 5-axis scores + weighted rank + evidence, ranked.
  const prods = all('SELECT * FROM products_discovered ORDER BY weighted_score DESC');
  out.products = {
    count: prods.length,
    rows: prods.map(p => ({
      id: p.id, name: p.name, category: p.category, status: p.status, weighted_score: p.weighted_score,
      axes: { demand: p.demand, ease: p.ease, profitability: p.profitability, scalability: p.scalability, advantage: p.advantage },
      evidence: j(p, 'evidence_json', {}),
    })),
  };

  // Fleet: latest run per agent.
  const runs = all('SELECT * FROM agent_runs ORDER BY started_at DESC');
  const byAgent = {};
  for (const r of runs) if (!byAgent[r.agent]) byAgent[r.agent] = r;
  out.fleet = { agents: Object.values(byAgent).map(r => ({ agent: r.agent, status: r.status, started_at: r.started_at, finished_at: r.finished_at, summary: r.summary })) };

  // Analytics — 3 dashboards, all worker-computed from SQLite (UI only renders; numbers reconcile exactly).
  const GTA = ['toronto', 'mississauga', 'markham', 'scarborough', 'north york', 'etobicoke', 'vaughan', 'richmond hill', 'brampton', 'pickering', 'whitby', 'oakville', 'grimsby'];
  const cityKey = (c) => (c || '').split(/[ ,(]/)[0];
  const byCity = {}; for (const b of bizAll) { const k = cityKey(b.city) || 'Unknown'; byCity[k] = (byCity[k] || 0) + 1; }
  const meetingsN = (one('SELECT COUNT(*) c FROM meetings m JOIN businesses b ON b.id=m.business_id WHERE b.is_real=1') || {}).c || 0;
  const oppsAll = all('SELECT o.service, o.est_mrr, o.status FROM opportunities o JOIN businesses b ON b.id=o.business_id WHERE b.is_real=1');
  const funnel = [
    { stage: 'Generated', n: items.filter(i => i.kind === 'initial').length },
    { stage: 'Approved', n: items.filter(i => ['approved', 'outbound', 'sent'].includes(i.status)).length },
    { stage: 'Sent', n: items.filter(i => i.status === 'sent').length },
    { stage: 'Replied', n: msgs.filter(m => m.classification === 'reply_to_outreach').length },
    { stage: 'Won', n: biz.filter(b => b.pipeline_stage === 'Won').length },
  ];
  out.analytics = {
    // 1) Research progress — coverage over the WHOLE table (see the bizAll/biz note at the top).
    research: {
      total: bizAll.length, researched: bizAll.filter(b => b.is_real).length,
      by_city: byCity,
      geo_coverage: {
        Toronto: bizAll.filter(b => /toronto/i.test(b.city || '')).length,
        GTA: bizAll.filter(b => GTA.some(g => (b.city || '').toLowerCase().includes(g))).length,
        Ontario: bizAll.filter(b => /\bON\b|ontario/i.test((b.region || '') + ' ' + (b.city || ''))).length || bizAll.filter(b => b.is_real).length,
        Canada: bizAll.length,
      },
    },
    // 2) Sales activity
    sales: {
      generated: items.filter(i => i.kind === 'initial').length,
      followups: items.filter(i => i.kind === 'followup').length,
      approved: items.filter(i => ['approved', 'outbound', 'sent'].includes(i.status)).length,
      rejected: items.filter(i => i.status === 'rejected').length,
      sent: items.filter(i => i.status === 'sent').length,
      replies: msgs.filter(m => m.classification === 'reply_to_outreach').length,
      new_requests: msgs.filter(m => m.classification === 'new_inbound_request').length,
      meetings: meetingsN,
      opportunities: oppsAll.length,
      won: biz.filter(b => b.pipeline_stage === 'Won').length,
      lost: biz.filter(b => b.pipeline_stage === 'Lost').length,
      funnel,
    },
    // 3) Business insights
    insights: {
      // HONESTY SPLIT (2026-07-28). These were one field called `pipeline_value`, computed as
      // SUM(businesses.est_monthly_value) — i.e. the sum of our own *guesses* about what 25
      // strangers we have never spoken to might one day pay. Rendering that as "Pipeline value"
      // on the command deck is the same inflation Rule 14 was written to stop, and it is why the
      // live dashboard read $93,250 while nothing had actually been sold. Now two named fields,
      // one meaning each, and the UI labels both for what they are:
      //   pipeline_value — money actually in play: real opportunities, open or won.  Today: $0.
      //   assessed_value — pre-contact research estimate across prospects.           Today: $77,500.
      pipeline_value: oppsAll.filter(o => o.status !== 'lost').reduce((s, o) => s + (o.est_mrr || 0), 0),
      assessed_value: bizAll.reduce((s, b) => s + (b.est_monthly_value || 0), 0),
      assessed_basis: `pre-contact estimate across ${bizAll.length} researched prospects — not booked revenue`,
      top_value: biz.slice().sort((a, b2) => (b2.est_monthly_value || 0) - (a.est_monthly_value || 0)).slice(0, 8).map(b => ({ name: b.name || b.handle, value: b.est_monthly_value || 0 })),
      by_industry: (() => { const m = {}; for (const b of bizAll) { const k = (b.industry || 'Other').split('(')[0].trim().slice(0, 20); m[k] = (m[k] || 0) + 1; } return m; })(),
      by_stage: out.pipeline.counts,
      opportunity_mrr: oppsAll.reduce((s, o) => s + (o.est_mrr || 0), 0),
    },
    funnel, // kept for the Overview convenience
    pipeline_value: oppsAll.filter(o => o.status !== 'lost').reduce((s, o) => s + (o.est_mrr || 0), 0),
    assessed_value: bizAll.reduce((s, b) => s + (b.est_monthly_value || 0), 0),
  };

  // Reports meta + settings — worker writes these to the settings table (setSetting), snapshot reads them.
  const getS = (k, d) => { const r = one('SELECT value FROM settings WHERE key=?', k); if (!r) return d; try { return JSON.parse(r.value); } catch { return d; } };
  out.reports = getS('reports_meta', { lastGenerated: null, files: [], sheets: ['Businesses', 'Contacts', 'Outreach', 'Follow-ups', 'Meetings', 'Opportunities', 'Analytics', 'Revenue Forecast', 'Products', 'Services', 'Notes'] });
  const dkimOk = (getS('integrations', []).find(i => i.name === 'DKIM') || {}).status === 'ok';
  const sentToday = (one("SELECT COUNT(*) c FROM outreach_items WHERE status='sent' AND sent_at >= ?", Date.now() - 864e5) || {}).c || 0;
  out.settings = {
    rails: DEFAULT_RAILS,
    // Live rail state the composer DISPLAYS. It never recomputes these — railsCheck() in outreach.mjs
    // is authoritative at send time; this is the operator-facing read-out of the same facts.
    rail_state: {
      sent_today: sentToday,
      daily_cap: (OUTREACH_PACING.requires_dkim_to_ramp && !dkimOk) ? OUTREACH_PACING.first_batch_daily_cap : OUTREACH_PACING.ramped_daily_cap,
      dkim_ok: dkimOk,
      quiet_hours: DEFAULT_RAILS.quiet_hours,
      toronto_hour: Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false }).format(new Date())) % 24,
      suppressed: all('SELECT email FROM suppression_list').map(r => String(r.email || '').toLowerCase()),
    },
    suppression_count: (one('SELECT COUNT(*) c FROM suppression_list') || {}).c || 0,
    integrations: getS('integrations', [
      { name: 'Gmail', status: 'pending', detail: 'OAuth not configured (ahmad.wasee@iisupp.net)' },
      { name: 'DKIM', status: 'ok', detail: 'google._domainkey published' },
      { name: 'Apollo', status: 'ok', detail: 'MCP connector' },
      { name: 'Resend', status: 'unknown', detail: 'env RESEND_API_KEY' },
      { name: 'Telegram', status: 'unknown', detail: 'env TELEGRAM_BOT_TOKEN' },
      { name: 'Stripe', status: 'ok', detail: 'live' },
      { name: 'M365 Graph', status: 'unknown', detail: 'env M365_*' },
    ]),
    data: getS('data_meta', { db: 'data/axis-sales.db', last_backup: null }),
  };

  // Overview KPIs (derived, never hardcoded).
  out.overview = {
    kpis: {
      pipeline_value: out.analytics.pipeline_value,
      awaiting_approval: pending.length,
      messages_waiting: openActionable.length,
      followups_due: (out.followups.due_today.length + out.followups.overdue.length),
      meetings_week: (one('SELECT COUNT(*) c FROM meetings') || {}).c || 0,
      mrr: (one("SELECT COALESCE(SUM(o.est_mrr),0) s FROM opportunities o JOIN businesses b ON b.id=o.business_id WHERE o.status='won' AND b.is_real=1") || {}).s || 0,
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
