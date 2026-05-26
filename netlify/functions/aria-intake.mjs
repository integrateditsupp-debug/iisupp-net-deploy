// netlify/functions/aria-intake.mjs
// ARIA Intake - the mesh's "understand first" triage gate (front of the pipeline).
// POST /.netlify/functions/aria-intake
//   body: { query, history?, context?, _trace? }
//   -> { answer, intent, tier, difficulty, urgency, signals, recommendedPhase,
//        nextAgent, clarifyingQuestion?, confidence, ts }
//
// Pure deterministic classification. NO external API, NO secrets, NO blobs -> $0,
// fully testable, free-tier safe (mirrors aria-research's zero-LLM ethos). Runs
// BEFORE any expensive agent so the mesh-router knows intent, severity, and where
// to route. Vague input lowers confidence and returns one clarifying question
// (AROC §5 "ask one short question instead of guessing").
//
// Registered in mesh-registry.json as status:"planned" (diagnose phase) until an
// operator reviews + flips to "active" — so it cannot alter live routing unsupervised.

const INTENTS = [
  ['stock',       /\b(stock|stocks|share price|ticker|nasdaq|nyse|dow|s&p|sp500|quote)\b/i],
  ['weather',     /\b(weather|forecast|temperature|rain|snow|storm|humidity)\b/i],
  ['news',        /\b(news|headline|latest on|what happened|breaking)\b/i],
  ['pricing',     /\b(price|pricing|cost|quote|how much|rate|retainer|plan|tier|invoice|billing)\b/i],
  ['escalation',  /\b(human|agent|person|callback|call me|speak to|representative|manager|on-?site|technician come)\b/i],
  ['service',     /\b(service center|book|schedule|appointment|status of my|my ticket|order)\b/i],
  ['troubleshoot',/\b(not working|won'?t|can'?t|cannot|error|broken|slow|crash|freeze|stuck|fix|issue|problem|fail|down|offline|drop|dropping|disconnect|keeps|lag|hang|unresponsive|no connection|not connecting|blue screen|bsod)\b/i]
];

const URGENT = /\b(urgent|asap|emergency|critical|immediately|right now|production down|whole (office|team|company)|everyone|can'?t work|losing money|deadline)\b/i;
const BUSY   = /\b(busy|soon|today|quickly|in a meeting|client waiting)\b/i;

// severity signals -> tier
const L3 = /\b(server|domain controller|active directory|ransomware|breach|data loss|outage|whole network|multiple users|migration|datacenter|hyper-?v|vmware|san|failover|disaster)\b/i;
const L2 = /\b(vpn|firewall|group policy|exchange|m365 admin|dns|dhcp|backup|recovery|sql|database|certificate|sso|identity|multiple|recurring|keeps happening)\b/i;

const SYSTEMS = ['outlook','teams','zoom','onedrive','sharepoint','excel','word','windows','mac','vpn','wifi','wi-fi','printer','email','browser','chrome','edge','password','m365','office','server','firewall','dns','active directory','salesforce'];
const ERRCODE = /\b(0x[0-9a-f]{4,}|KB\d{5,}|error\s+\d{2,}|[A-Z]{2,5}_[A-Z_]{3,}|\b\d{3}\s+(error|status))\b/i;

function detectIntent(q) {
  for (const [name, re] of INTENTS) if (re.test(q)) return name;
  return 'general';
}
function extractSignals(q) {
  const sys = SYSTEMS.filter((s) => new RegExp('\\b' + s.replace(/[-]/g, '[- ]?') + '\\b', 'i').test(q));
  const codes = (q.match(new RegExp(ERRCODE, 'ig')) || []);
  return { systems: Array.from(new Set(sys)), errorCodes: Array.from(new Set(codes)) };
}

function triage(query, history, context) {
  const q = String(query || '');
  const wordCount = q.trim().split(/\s+/).filter(Boolean).length;
  const intent = detectIntent(q);
  const signals = extractSignals(q);

  // urgency
  const urgency = URGENT.test(q) ? 'urgent' : BUSY.test(q) ? 'busy' : 'normal';

  // tier
  let tier = 'L1';
  if (L3.test(q)) tier = 'L3';
  else if (L2.test(q)) tier = 'L2';
  if (urgency === 'urgent' && tier === 'L1') tier = 'L2';

  // difficulty (rough): more systems/codes + higher tier = harder
  const complexity = signals.systems.length + signals.errorCodes.length + (tier === 'L3' ? 2 : tier === 'L2' ? 1 : 0);
  const difficulty = complexity >= 3 ? 'hard' : complexity >= 1 ? 'mid' : 'easy';

  // routing recommendation
  let recommendedPhase = 'diagnose', nextAgent = 'aria-diagnostic';
  if (intent === 'escalation') { recommendedPhase = 'execute'; nextAgent = 'aria-escalation'; }
  else if (intent === 'pricing' || intent === 'service') { recommendedPhase = 'research'; nextAgent = 'aria-research'; }
  else if (intent === 'troubleshoot') { recommendedPhase = 'research'; nextAgent = 'aria-research'; }
  else if (intent === 'stock' || intent === 'weather' || intent === 'news') { recommendedPhase = 'research'; nextAgent = 'aria-research'; }

  // clarity / confidence
  const vague = wordCount < 4 || (intent === 'general' && signals.systems.length === 0);
  let clarifyingQuestion = null;
  if (vague) {
    clarifyingQuestion = signals.systems.length === 0
      ? 'Which system or app is this about (e.g. Outlook, Wi-Fi, VPN, a printer), and what exactly happens?'
      : 'Can you describe what you were doing and what went wrong, step by step?';
  }
  // confidence: clearer intent + concrete signals raise it
  let confidence = 0.5;
  if (intent !== 'general') confidence += 0.2;
  if (signals.systems.length) confidence += 0.15;
  if (signals.errorCodes.length) confidence += 0.1;
  if (vague) confidence -= 0.25;
  confidence = Math.max(0.2, Math.min(0.95, Math.round(confidence * 100) / 100));

  const answer = clarifyingQuestion
    ? clarifyingQuestion
    : `Understood: a ${urgency !== 'normal' ? urgency + ' ' : ''}${tier} ${intent} request${signals.systems.length ? ' about ' + signals.systems.join(', ') : ''}. Routing to ${nextAgent}.`;

  return { answer, intent, tier, difficulty, urgency, signals, recommendedPhase, nextAgent, clarifyingQuestion, confidence };
}

export default async (req) => {
  const cors = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, service: 'aria-intake', role: 'triage / understand-first', outputs: ['intent', 'tier', 'difficulty', 'urgency', 'signals', 'nextAgent'] }), { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: cors });

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const out = triage(body.query, body.history, body.context);
  out.ts = Date.now();
  return new Response(JSON.stringify(out), { status: 200, headers: cors });
};

export { triage };
