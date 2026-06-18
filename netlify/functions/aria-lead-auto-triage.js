/**
 * aria-lead-auto-triage — Auto-scores + categorizes inbound leads
 *  Called by aria-lead-capture after every new lead persists to Blobs.
 *  Outputs: priority (P1/P2/P3), vertical_inferred, urgent_reply_needed boolean.
 *  Updates the lead's blob with these scores so /leads-admin sorts by priority.
 *  Cat 10 — Reporting / lead scoring.
 */
const VERTICAL_KEYWORDS = {
  healthcare: ['clinic', 'practice', 'patient', 'medical', 'dental', 'physician', 'health', 'epic', 'cerner', 'emr', 'phipa', 'hipaa'],
  legal: ['law firm', 'lawyer', 'attorney', 'litigation', 'clio', 'leap', 'paralegal', 'court', 'matter', 'privilege'],
  finance: ['accounting', 'cpa', 'bookkeep', 'tax', 'audit', 'quickbooks', 'xero', 'sage', 'payroll', 'cfo'],
  education: ['school', 'university', 'college', 'k-12', 'canvas', 'blackboard', 'moodle', 'student', 'faculty'],
  manufacturing: ['factory', 'plant', 'shopfloor', 'erp', 'sap', 'mrp', 'oem', 'manufacturing']
};

const HIGH_INTENT_KEYWORDS = ['urgent', 'broken', 'down', 'asap', 'emergency', 'today', 'now', 'crisis', 'fix this'];
const COMPLIANCE_KEYWORDS = ['compliance', 'audit', 'soc 2', 'hipaa', 'sox', 'pci', 'iso 27001', 'rfp', 'rfi'];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const lead = body.lead || body;
  const text = ((lead.message || '') + ' ' + (lead.company || '') + ' ' + (lead.last_intent || '')).toLowerCase();

  // Score vertical
  let bestVertical = null;
  let bestScore = 0;
  for (const [v, keys] of Object.entries(VERTICAL_KEYWORDS)) {
    const score = keys.filter(k => text.includes(k)).length;
    if (score > bestScore) { bestScore = score; bestVertical = v; }
  }

  // High-intent / urgent detection
  const urgent = HIGH_INTENT_KEYWORDS.some(k => text.includes(k));
  // Compliance / RFP signal = high-value enterprise lead
  const compliance = COMPLIANCE_KEYWORDS.some(k => text.includes(k));

  // Priority logic
  let priority = 'P3';
  if (urgent) priority = 'P1';
  else if (compliance || (lead.source === 'webinar-page' && bestVertical)) priority = 'P1';
  else if (lead.source === 'pilot' || lead.last_intent?.includes('pilot')) priority = 'P1';
  else if (lead.company && lead.company.length > 0) priority = 'P2';

  // Email-only with no message = lowest
  if (!lead.message || lead.message.length < 20) priority = 'P3';

  const result = {
    ok: true,
    priority,
    vertical_inferred: bestVertical,
    urgent_reply_needed: urgent || compliance,
    scored_at: Date.now()
  };

  // Persist to lead blob if possible
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'aria-leads', consistency: 'strong' });
    if (lead.id) {
      const existing = await store.get(lead.id, { type: 'json' });
      if (existing) {
        Object.assign(existing, { priority, vertical_inferred: bestVertical, urgent_reply_needed: result.urgent_reply_needed, scored_at: result.scored_at });
        await store.setJSON(lead.id, existing);
      }
    }
  } catch (e) { result.persist_err = e.message; }

  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
