/**
 * aria-winback-cron - draft-only churn and win-back playbook.
 *
 * POST { event:'scan', customers:[...] } returns recommended drafts.
 * It never sends email, changes billing, or reactivates subscriptions.
 */
'use strict';

function scoreCustomer(c) {
  let score = 0;
  const days = Number(c.days_since_churn || c.days_since_cancel || 0);
  if (days <= 30) score += 30;
  if (days > 30 && days <= 90) score += 18;
  if (String(c.reason || '').match(/price|budget|cost/i)) score += 16;
  if (String(c.reason || '').match(/missing|feature|integration/i)) score += 14;
  if (Number(c.mrr || 0) >= 99) score += 18;
  if (c.responded_recently) score += 12;
  if (c.bad_fit || c.legal_hold || c.do_not_contact) score -= 100;
  return Math.max(0, Math.min(100, score));
}

function draftFor(c, score) {
  const name = c.name || c.company || 'there';
  const angle = String(c.reason || '').match(/price|budget|cost/i)
    ? 'founding-customer pricing or annual prepay'
    : 'new ARIA coverage shipped since your cancellation';
  return {
    email: c.email || null,
    company: c.company || null,
    winback_score: score,
    subject: 'ARIA update for ' + name,
    draft: 'Hi ' + name + ', checking back because ' + angle + ' may change the value case. If useful, I can stage a no-pressure reactivation review for Ahmad to approve.',
    final_action_required: 'Ahmad must review and send manually.'
  };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const customers = Array.isArray(body.customers) ? body.customers : [];
  const candidates = customers
    .map((customer) => ({ customer, score: scoreCustomer(customer) }))
    .filter((item) => item.score >= Number(body.min_score || 35))
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(body.limit || 25))
    .map((item) => draftFor(item.customer, item.score));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      mode: 'draft_only',
      scanned: customers.length,
      candidate_count: candidates.length,
      candidates,
      sent: 0,
      note: 'No messages were sent. Use CEO final review before outreach.'
    })
  };
};
