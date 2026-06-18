/**
 * aria-invoice-download — Fetch + proxy a Stripe invoice PDF for the user
 *  POST { email, invoice_id? }
 *    -> finds customer, lists invoices, returns either:
 *       - specific invoice URL if invoice_id provided
 *       - list of last 12 invoices with hosted_invoice_url + invoice_pdf
 *
 *  No file proxying (Stripe serves PDFs directly via the URL). We surface the URLs.
 *  Cat 5 — Account management.
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://iisupp.net',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.email || '').toLowerCase().trim();
  if (!email || !/.+@.+\..+/.test(email)) return ok({ ok: false, error: 'valid email required' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return ok({ ok: false, error: 'billing service unavailable' });

  try {
    // 1. Find customer
    const searchUrl = 'https://api.stripe.com/v1/customers/search?query=' +
      encodeURIComponent('email:"' + email + '"');
    const sr = await fetch(searchUrl, { headers: { 'Authorization': 'Bearer ' + key } });
    const sj = await sr.json();
    if (!sr.ok || !sj.data || sj.data.length === 0) {
      return ok({ ok: false, error: 'no_customer' });
    }
    const customerId = sj.data[0].id;

    // 2. Specific invoice or list
    if (body.invoice_id) {
      const ir = await fetch('https://api.stripe.com/v1/invoices/' + body.invoice_id, {
        headers: { 'Authorization': 'Bearer ' + key }
      });
      const ij = await ir.json();
      if (!ir.ok) return ok({ ok: false, error: 'invoice_not_found' });
      if (ij.customer !== customerId) return ok({ ok: false, error: 'access_denied' });
      return ok({
        ok: true,
        invoice_id: ij.id,
        amount_paid: ij.amount_paid / 100,
        currency: ij.currency,
        status: ij.status,
        hosted_invoice_url: ij.hosted_invoice_url,
        invoice_pdf: ij.invoice_pdf,
        period_start: ij.period_start,
        period_end: ij.period_end
      });
    }

    // 3. List last 12 invoices
    const lr = await fetch('https://api.stripe.com/v1/invoices?customer=' + customerId + '&limit=12', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const lj = await lr.json();
    if (!lr.ok) return ok({ ok: false, error: 'list_failed' });
    const invoices = (lj.data || []).map(inv => ({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf
    }));
    return ok({ ok: true, count: invoices.length, invoices });
  } catch (e) {
    console.error('[invoice-download] err:', e.message);
    return ok({ ok: false, error: 'unexpected', detail: e.message });
  }

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
