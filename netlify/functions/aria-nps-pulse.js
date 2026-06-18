/**
 * aria-nps-pulse — Schedule + record customer NPS
 *  POST { event:'send', customer_email, name } - sends 1-question NPS email
 *  POST { event:'record', score, comment, email } - records NPS response (called by mailto link)
 *  POST { event:'snapshot', admin_token } - returns current NPS rolling 90-day
 *  Cat 5 + Cat 10 — account mgmt + reporting.
 */
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || '').trim();
  let store;
  try { ({ getStore } = require('@netlify/blobs')); store = require('@netlify/blobs').getStore({ name: 'aria-nps', consistency: 'strong' }); }
  catch { return ok({ ok: false, error: 'blobs unavailable' }); }

  if (ev === 'send') {
    const email = String(body.customer_email || '').toLowerCase();
    const name = String(body.name || 'there');
    if (!email) return ok({ ok: false, error: 'customer_email required' });
    if (!process.env.RESEND_API_KEY) return ok({ ok: false, error: 'RESEND_API_KEY missing' });
    const base = process.env.SITE_BASE_URL || 'https://iisupp.net';
    // Generate score links 0-10
    const scoreLinks = Array.from({ length: 11 }, (_, i) =>
      '<a href="mailto:ahmad.wasee@iisupp.net?subject=NPS%20' + i + '%20from%20' + encodeURIComponent(email) + '&body=Score%3A%20' + i + '%0AOptional%20comment%3A%20" style="display:inline-block;padding:8px 12px;margin:2px;background:' + (i >= 9 ? '#22c55e' : i >= 7 ? '#d4af37' : '#dc2626') + ';color:#fff;text-decoration:none;border-radius:4px;font-family:monospace">' + i + '</a>'
    ).join('');
    const html = '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#111;line-height:1.6;padding:20px">' +
      '<p>Hi ' + name + ',</p>' +
      '<p>30 days into your ARIA pilot — quick question:</p>' +
      '<p style="font-size:18px;font-weight:600">On a 0-10 scale, how likely are you to recommend ARIA to another ' + (body.vertical || 'similar') + ' firm?</p>' +
      '<p style="text-align:center;margin:20px 0">' + scoreLinks + '</p>' +
      '<p style="font-size:13px;color:#666">Click a number — opens an email pre-addressed. Add a comment if you want.</p>' +
      '<p>— Ahmad</p></div>';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Ahmad at IIS <ahmad.wasee@iisupp.net>',
          to: [email], subject: 'Quick NPS — 30-day pulse', html
        })
      });
      return ok({ ok: true, sent: true });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  if (ev === 'record') {
    const score = Number(body.score || -1);
    const email = String(body.email || '').toLowerCase();
    if (score < 0 || score > 10) return ok({ ok: false, error: 'score 0-10 required' });
    if (!email) return ok({ ok: false, error: 'email required' });
    try {
      await store.setJSON('response-' + Date.now() + '-' + email, {
        score, email,
        comment: String(body.comment || '').slice(0, 1000),
        recorded_at: Date.now()
      });
      return ok({ ok: true, recorded: true });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  if (ev === 'snapshot') {
    const expected = process.env.APERTURE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!expected || body.admin_token !== expected) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'admin token required' }) };
    }
    try {
      const list = await store.list();
      const since = Date.now() - 90 * 86400000;
      let promoters = 0, passives = 0, detractors = 0, total = 0, sumScore = 0;
      for (const item of (list.blobs || [])) {
        const r = await store.get(item.key, { type: 'json' });
        if (!r || (r.recorded_at || 0) < since) continue;
        total++;
        sumScore += r.score;
        if (r.score >= 9) promoters++;
        else if (r.score >= 7) passives++;
        else detractors++;
      }
      const nps = total > 0 ? Math.round(((promoters / total) - (detractors / total)) * 100) : null;
      return ok({ ok: true, nps_rolling_90d: nps, total_responses: total, avg_score: total > 0 ? Math.round((sumScore / total) * 10) / 10 : null, breakdown: { promoters, passives, detractors } });
    } catch (e) { return ok({ ok: false, error: e.message }); }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
