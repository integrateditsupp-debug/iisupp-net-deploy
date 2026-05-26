// netlify/functions/aria-verifier.mjs
// ARIA Verifier - reconstruction-verification safety net (AROC operating law §6).
// POST /.netlify/functions/aria-verifier
//   body: { query, answer?, context?:{ answer?, steps?, environment? }, _trace? }
//   -> { answer, verified, confidence, checks, issues, recommendation, ts }
//
// Pure deterministic logic. NO external API, NO secrets, NO blobs writes -> $0 and
// safe to run on every answer. Designed to be the mesh "verify" phase gate: takes a
// candidate ARIA answer and scores it against AROC §6's seven checks before it
// reaches the user. Returns a calibrated confidence the mesh-router understands
// (success = confidence >= confidence_threshold), so a weak/unsafe answer naturally
// triggers the router's fallback cascade or escalation instead of shipping.
//
// Registered in mesh-registry.json as status:"planned" until reviewed + flipped to
// "active" by an operator (so it cannot alter live routing behaviour unsupervised).

const DESTRUCTIVE = [
  /\brm\s+-rf\b/i, /\bformat\s+[a-z]:/i, /\bdiskpart\b/i, /\bdel\s+\/[sfq]/i,
  /\bdrop\s+(table|database)\b/i, /\btruncate\s+table\b/i, /\bmkfs\b/i,
  /\bfdisk\b/i, /\breg\s+delete\b/i, /\bremove-item\b.*-recurse/i,
  /\bgit\s+reset\s+--hard\b/i, /\bgit\s+push\s+--force\b/i, /\bshutdown\b/i,
  /\bwipe\b/i, /\bfactory\s+reset\b/i, /\bdelete\s+all\b/i
];
const CONSENT = /\b(confirm|are you sure|with your approval|once you approve|back ?up first|backup first|irreversible|cannot be undone)\b/i;
const HEDGE = /\b(maybe|might|possibly|i think|not sure|unsure|probably|could be|i guess)\b/i;
const CERTAINTY = /\b(definitely|guaranteed|certainly|100%|always works|never fails|will absolutely)\b/i;
const SPECIFICITY = /(\d|\bstep\b|`[^`]+`|\b(restart|disable|enable|reinstall|update|reset|clear|flush|rebuild|check|run|open|navigate|settings|registry|driver|cache|dns|ip|port|profile|service)\b)/i;
const IT_SCOPE = /\b(wi-?fi|network|vpn|email|outlook|password|printer|browser|windows|mac|os|server|driver|update|m365|microsoft|account|login|firewall|backup|disk|cpu|ram|boot|bsod|dns|ip|router|switch|saas|app|software|hardware|phishing|security|patch)\b/i;
const FABRICATION = /\b(as of (january|february|march|april|may|june|july|august|september|october|november|december)|the current price is|live data shows|right now it is)\b/i;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function verify(query, answer, ctx) {
  const q = String(query || '');
  const a = String(answer || (ctx && ctx.answer) || '');
  const checks = {};
  const issues = [];

  // 1. EVIDENCE — does the answer say something concrete, not just vague reassurance?
  const hasSubstance = a.trim().length >= 24;
  const isSpecific = SPECIFICITY.test(a);
  checks.evidence = hasSubstance && isSpecific;
  if (!hasSubstance) issues.push('answer too thin to verify (no substantive content)');
  else if (!isSpecific) issues.push('answer is vague — no concrete step, value, or named system');

  // 2. CONTRADICTION — hedging and over-certainty in the same breath is a calibration smell.
  const contradicts = HEDGE.test(a) && CERTAINTY.test(a);
  checks.contradiction = !contradicts;
  if (contradicts) issues.push('internal conflict: hedged language mixed with absolute certainty');

  // 3. SAFETY — destructive operation proposed without an explicit consent/rollback gate.
  const destructive = DESTRUCTIVE.find((re) => re.test(a));
  const consented = CONSENT.test(a);
  checks.safety = !destructive || consented;
  if (destructive && !consented) {
    issues.push('destructive operation suggested without explicit consent / rollback awareness');
  }

  // 4. ENVIRONMENT / OPERATIONAL SCOPE — is this an IT-support answer at all?
  const inScope = IT_SCOPE.test(q) || IT_SCOPE.test(a);
  checks.scope = inScope;
  if (!inScope) issues.push('answer/query falls outside recognised IT-support scope — verify intent');

  // 5. FABRICATED-REALTIME — claims of live/current data we cannot vouch for here.
  const fabricates = FABRICATION.test(a) && !(ctx && ctx.liveContext);
  checks.noFabricatedRealtime = !fabricates;
  if (fabricates) issues.push('answer asserts real-time/current data without a live-context source');

  // 6. ROLLBACK AWARENESS — destructive answers should signal reversibility.
  checks.rollbackAware = !destructive || consented;

  // 7. OVER-CERTAINTY — flag unqualified absolutes even without hedging (calibration).
  const overCertain = CERTAINTY.test(a);
  checks.calibrated = !overCertain;
  if (overCertain) issues.push('over-confident phrasing — recommend qualifying the certainty');

  // ---- calibrated confidence ----
  const weights = { evidence: 0.28, contradiction: 0.12, safety: 0.25, scope: 0.12, noFabricatedRealtime: 0.13, calibrated: 0.10 };
  let score = 0;
  for (const k in weights) if (checks[k]) score += weights[k];
  // hard safety veto: an ungated destructive op can never pass.
  const safetyVeto = destructive && !consented;
  const confidence = safetyVeto ? clamp(Math.min(score, 0.35), 0, 0.35) : clamp(score, 0, 1);

  // A pass must be specific, safe, AND must not assert unverifiable real-time data.
  const verified = confidence >= 0.7 && checks.safety && checks.evidence && checks.noFabricatedRealtime;
  let recommendation;
  if (safetyVeto) recommendation = 'BLOCK — require explicit user consent + rollback plan before this action.';
  else if (verified) recommendation = 'PASS — answer is specific, in-scope, and safe to deliver.';
  else if (!checks.evidence) recommendation = 'REVISE — make the answer concrete (specific step/value) before delivering.';
  else recommendation = 'REVIEW — confidence below threshold; consider clarifying question or escalation.';

  return { answer: a, verified, confidence: Math.round(confidence * 100) / 100, checks, issues, recommendation };
}

export default async (req) => {
  const cors = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, service: 'aria-verifier', law: 'AROC §6', checks: ['evidence', 'contradiction', 'safety', 'scope', 'noFabricatedRealtime', 'rollbackAware', 'calibrated'] }), { headers: cors });
  }
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: cors });

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const { query = '', answer = '', context = {} } = body || {};
  const out = verify(query, answer, context);
  out.ts = Date.now();
  return new Response(JSON.stringify(out), { status: 200, headers: cors });
};

// Exported for local unit testing without a server.
export { verify };
