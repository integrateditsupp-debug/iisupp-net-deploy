// miner.mjs — Product Discovery agent (S11). WORKER-OWNED. Logs recurring needs across the real prospect
// base + strategic offerings, scores each 1–5 on demand/ease/profitability/scalability/advantage, computes
// a weighted rank, attaches evidence, and writes to products_discovered → AXIS review + Needs You Now.
// Deterministic + auditable; nothing sends.
const WEIGHTS = { demand: 0.3, profitability: 0.25, ease: 0.15, scalability: 0.15, advantage: 0.15 };
export function weightedScore(s) {
  return +(WEIGHTS.demand * s.demand + WEIGHTS.profitability * s.profitability + WEIGHTS.ease * s.ease + WEIGHTS.scalability * s.scalability + WEIGHTS.advantage * s.advantage).toFixed(2);
}

// Per-service heuristics for the non-demand axes (demand comes from real prospect counts).
const SERVICE_PROFILE = {
  'Cybersecurity': { ease: 3, profitability: 4, scalability: 4, advantage: 4, category: 'managed expansion' },
  'Managed IT': { ease: 3, profitability: 4, scalability: 3, advantage: 3, category: 'core managed' },
  'Backup & Business Continuity': { ease: 4, profitability: 4, scalability: 5, advantage: 3, category: 'managed expansion' },
  'Microsoft 365 / Cloud': { ease: 4, profitability: 3, scalability: 5, advantage: 3, category: 'resale' },
  'Co-managed IT': { ease: 3, profitability: 4, scalability: 3, advantage: 4, category: 'managed expansion' },
  'AI automation': { ease: 2, profitability: 4, scalability: 5, advantage: 5, category: 'own-SaaS / AI' },
};
const demandFromCount = (n, total) => Math.max(1, Math.min(5, Math.round((n / Math.max(1, total)) * 5) + (n >= 3 ? 1 : 0)));

export function discoverProducts(db) {
  db.exec("DELETE FROM products_discovered;");
  const biz = db.prepare('SELECT id,name,opportunities_json FROM businesses WHERE is_real=1').all();
  const total = biz.length || 1;
  // Aggregate recurring needs from real prospects' assessed opportunities.
  const counts = {}; const evidence = {};
  for (const b of biz) {
    let opps = []; try { opps = JSON.parse(b.opportunities_json) || []; } catch {}
    for (const o of opps) { counts[o.service] = (counts[o.service] || 0) + 1; (evidence[o.service] = evidence[o.service] || []).push(b.name); }
  }
  const ids = [];
  const insert = (name, category, s, evidenceArr, status) => {
    const ws = weightedScore(s);
    const info = db.prepare(`INSERT INTO products_discovered (name,category,demand,ease,profitability,scalability,advantage,weighted_score,evidence_json,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(name, category, s.demand, s.ease, s.profitability, s.scalability, s.advantage, ws, JSON.stringify(evidenceArr), status, Date.now());
    ids.push(Number(info.lastInsertRowid));
  };
  // Productize recurring prospect needs
  for (const [service, n] of Object.entries(counts).sort((a, b2) => b2[1] - a[1])) {
    const prof = SERVICE_PROFILE[service] || { ease: 3, profitability: 3, scalability: 3, advantage: 3, category: 'service' };
    const s = { demand: demandFromCount(n, total), ease: prof.ease, profitability: prof.profitability, scalability: prof.scalability, advantage: prof.advantage };
    insert(`${service} for GTA professional-services SMBs`, prof.category, s,
      { need_count: n, of_prospects: total, sample: (evidence[service] || []).slice(0, 4) }, n >= 3 ? 'Recommended' : 'Validating');
  }
  // Strategic offerings from the spec (SaaS resale, reseller, own-SaaS, AI) — evidence = market signal, not fabricated counts.
  insert('Compliant-backup bundle (reseller program)', 'resale', { demand: 4, ease: 4, profitability: 3, scalability: 5, advantage: 3 },
    { market_signal: 'regulated SMBs (dental/legal/accounting) with weak visible backup posture in the researched set' }, 'Validating');
  insert('ARIA AI helpdesk (own-SaaS) — SMB tier', 'own-SaaS / AI', { demand: 3, ease: 2, profitability: 4, scalability: 5, advantage: 5 },
    { market_signal: 'existing IIS ARIA product; AI maturity 1/5 across researched prospects = greenfield' }, 'Idea');
  return ids;
}
