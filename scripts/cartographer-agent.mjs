// cartographer-agent.mjs — AXIS CC v2 research agent (P3). WORKER-OWNED, LOCAL ONLY. RESEARCH ONLY:
// it discovers + profiles businesses and writes them to SQLite. It NEVER generates or sends outreach
// (that is Pitch/Closer in P4) and never writes to the vault (Mesh does anonymized Lead-NNN sync).
//
// Geo ladder (widen only when a tier is exhausted): Toronto → GTA → Ontario → Canada.
// Public, ToS-respecting sources ONLY: Apollo (the team's own B2B account), the company's own public
// website, public LinkedIn/socials, public news, CanadaBuys/MERX. No scraping against a site's robots/ToS.
//
// PROVENANCE LAW (§2.3): every business FACT is stored as {value, source_url, confidence, last_verified}.
// Maturity + opportunity are ASSESSMENTS (derived inferences) stored with an explicit `basis`, never
// dressed up as sourced facts. Anything unknown is left null and renders "Not found — never guessed".
//
// Real names/emails live in data/axis-sales.db (gitignored) ONLY — never committed, never in the vault.
// This file contains the generic pipeline; the input profiles JSON (real data) is a gitignored data/ file.
//
// CLI: node scripts/cartographer-agent.mjs --ingest data/<profiles>.json [--reset-real]
import fs from 'node:fs';
import { openDb, assertStage } from './lib/axis-db.mjs';

export const GEO_LADDER = ['Toronto', 'GTA', 'Ontario', 'Canada'];
export const SOURCES = ['apollo', 'company_website', 'public_linkedin', 'public_news', 'canadabuys_merx', 'google_maps'];

// A provenance-tagged fact. confidence 0..1; last_verified ISO date string.
export const fact = (value, source_url, confidence = 0.8, last_verified = null) =>
  (value == null || value === '') ? null : { value, source_url, confidence, last_verified };

// Deterministic maturity scoring (1–5) from observable signals. Returns {score, basis} per dimension.
// Rules are intentionally simple + explainable so a human can audit every score.
export function assessMaturity(sig = {}) {
  const clamp = (n) => Math.max(1, Math.min(5, n));
  const it = clamp(1 + (sig.cloud_tools ? 2 : 0) + (sig.it_staff ? 1 : 0) + (sig.online_booking || sig.portal ? 1 : 0));
  const cloud = clamp(1 + (sig.cloud_tools ? 2 : 0) + (sig.online_booking ? 1 : 0) + (sig.portal ? 1 : 0));
  // Cyber: regulated data raises stakes; a visible security posture raises the score, its absence lowers it.
  const cyber = clamp(2 + (sig.security_page ? 2 : 0) + (sig.it_staff ? 1 : 0) - (sig.regulated_data && !sig.security_page ? 0 : 0));
  const ai = clamp(1 + (sig.ai_feature ? 3 : 0));
  const note = (dim, score, why) => ({ score, basis: why });
  return {
    it: note('it', it, sig.cloud_tools
      ? `Uses named cloud tools${sig.it_staff ? ' + has internal IT staff' : ''}`
      : (sig.it_staff ? 'Has internal IT staff; no public cloud-tool signal' : 'No public cloud-tool or IT-staff signal')),
    cyber: note('cyber', cyber, sig.security_page ? 'Publishes a security/privacy posture' : (sig.regulated_data ? 'Handles regulated data with no visible security posture — gap' : 'No visible security posture')),
    cloud: note('cloud', cloud, (sig.cloud_tools || sig.portal || sig.online_booking) ? 'Cloud tools / portal / online booking present' : 'No public cloud adoption signal'),
    ai: note('ai', ai, sig.ai_feature ? 'AI/chatbot feature present' : 'No AI feature present'),
  };
}

// Deterministic opportunity assessment from maturity gaps + sector. Each carries est_mrr + basis + confidence.
export function assessOpportunities(sig = {}, maturity = {}) {
  const opps = [];
  const push = (service, est_mrr, confidence, basis) => opps.push({ service, est_mrr, confidence, basis });
  if (sig.regulated_data && (maturity.cyber?.score ?? 3) <= 2) push('Cybersecurity', 1200, 0.6, `Regulated ${sig.sector || 'client'} data + weak visible security posture`);
  if (sig.multi_site) push('Managed IT', 1800, 0.55, 'Multiple office locations need consolidated support');
  else push('Managed IT', 1100, 0.5, 'SMB with no visible managed-IT provider');
  if (sig.regulated_data) push('Backup & Business Continuity', 700, 0.55, `${sig.sector || 'Client'} records require compliant backup/DR`);
  if ((maturity.cloud?.score ?? 3) <= 2) push('Microsoft 365 / Cloud', 800, 0.45, 'Low visible cloud adoption');
  if (sig.it_staff) push('Co-managed IT', 1000, 0.5, 'Has internal IT — augment rather than replace');
  if ((maturity.ai?.score ?? 1) <= 1) push('AI automation', 600, 0.35, 'No AI adoption — bookkeeping/intake automation potential');
  return opps;
}

// Ingest a profile object into SQLite (businesses + contacts + provenance). Research-only writes.
export function ingestProfile(db, p) {
  const now = Date.now();
  const g = (f) => p.provenance?.[f]?.value ?? null;             // sourced fact value
  const maturity = p.maturity || assessMaturity(p.signals);
  const opps = p.opportunities || assessOpportunities(p.signals, maturity);
  const est = opps.reduce((s, o) => s + (o.est_mrr || 0), 0);
  const stage = assertStage(p.stage || 'Profile Completed');

  const row = db.prepare(`INSERT INTO businesses
    (handle,name,website,industry,city,region,size,address,phone,public_email,maps_url,linkedin_url,socials_json,
     maturity_it,maturity_cyber,maturity_cloud,maturity_ai,maturity_json,opportunities_json,est_monthly_value,
     pipeline_stage,stage_updated_at,source_json,provenance_json,is_real,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`).run(
    p.handle, p.name, g('website'), g('industry'), g('city'), g('region'), g('size'), g('address'), g('phone'),
    g('public_email'), g('maps_url'), g('linkedin_url'), JSON.stringify(p.socials || {}),
    maturity.it.score, maturity.cyber.score, maturity.cloud.score, maturity.ai.score,
    JSON.stringify(maturity), JSON.stringify(opps), est,
    stage, now, JSON.stringify(p.source || { source: 'apollo' }), JSON.stringify(p.provenance || {}), now);
  const bizId = Number(row.lastInsertRowid);

  for (const c of (p.contacts || [])) {
    db.prepare(`INSERT INTO contacts (business_id,name,title,public_email,linkedin_url,source_url,confidence)
      VALUES (?,?,?,?,?,?,?)`).run(bizId, c.name, c.title, c.public_email || null, c.linkedin_url || null, c.source_url || null, c.confidence ?? 0.6);
  }
  // Record the discovery→profile transition (deterministic + logged; manual override via stage_override intent).
  db.prepare(`INSERT INTO pipeline_events (business_id,from_stage,to_stage,cause,at) VALUES (?,?,?,?,?)`)
    .run(bizId, 'Researching', stage, 'cartographer:profile_completed', now);
  return bizId;
}

// CLI
function main() {
  const args = process.argv.slice(2);
  const ingestIdx = args.indexOf('--ingest');
  if (ingestIdx === -1) { console.log('usage: cartographer-agent.mjs --ingest <profiles.json> [--reset-real]'); return; }
  const file = args[ingestIdx + 1];
  const profiles = JSON.parse(fs.readFileSync(file, 'utf8'));
  const db = openDb();
  if (args.includes('--reset-real')) { db.exec('DELETE FROM contacts WHERE business_id IN (SELECT id FROM businesses WHERE is_real=1); DELETE FROM pipeline_events WHERE business_id IN (SELECT id FROM businesses WHERE is_real=1); DELETE FROM businesses WHERE is_real=1;'); }
  const ids = profiles.map(p => ingestProfile(db, p));
  console.log(`[cartographer] ingested ${ids.length} real profiles → business ids ${ids.join(', ')}`);
  db.close();
}
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('cartographer-agent.mjs')) main();
