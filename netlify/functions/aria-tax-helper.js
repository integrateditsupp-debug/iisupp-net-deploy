/**
 * aria-tax-helper — Canadian sales tax calculator for customer's location
 *  POST { province, plan_amount_usd, customer_type } -> { tax_breakdown, total_with_tax }
 *  Provinces:
 *    BC, MB - GST 5% (PST 7% in BC + RST 7% in MB)
 *    ON - HST 13%
 *    AB, NT, NU, YT - GST 5%
 *    NS, NB, NL, PE - HST 15%
 *    QC - GST 5% + QST 9.975%
 *    SK - GST 5% + PST 6%
 *  US/intl: no Canadian tax (customer responsible for their own jurisdiction)
 *  Cat 16 — Pricing.
 */
const TAX_RATES = {
  AB: { gst: 0.05 }, BC: { gst: 0.05, pst: 0.07 }, MB: { gst: 0.05, rst: 0.07 },
  NB: { hst: 0.15 }, NL: { hst: 0.15 }, NS: { hst: 0.15 }, NT: { gst: 0.05 },
  NU: { gst: 0.05 }, ON: { hst: 0.13 }, PE: { hst: 0.15 },
  QC: { gst: 0.05, qst: 0.09975 }, SK: { gst: 0.05, pst: 0.06 }, YT: { gst: 0.05 }
};
const USD_TO_CAD = 1.36;

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const province = String(body.province || '').toUpperCase();
  const planUsd = Number(body.plan_amount_usd || 0);
  const isB2B = body.customer_type === 'business' || body.customer_type === 'b2b';
  const planCad = planUsd * USD_TO_CAD;

  if (!province || !TAX_RATES[province]) {
    return ok({ ok: true, applicable: false, total_with_tax_cad: planCad.toFixed(2), note: 'Non-Canadian or unknown province — no Canadian sales tax applied. Customer responsible for own jurisdiction.' });
  }

  const rates = TAX_RATES[province];
  const breakdown = {};
  let totalTax = 0;
  for (const [tax, rate] of Object.entries(rates)) {
    const amount = planCad * rate;
    breakdown[tax.toUpperCase()] = { rate_pct: rate * 100, amount_cad: Math.round(amount * 100) / 100 };
    totalTax += amount;
  }

  return ok({
    ok: true,
    applicable: true,
    province,
    is_b2b: isB2B,
    plan_amount_usd: planUsd,
    plan_amount_cad: Math.round(planCad * 100) / 100,
    breakdown,
    total_tax_cad: Math.round(totalTax * 100) / 100,
    total_with_tax_cad: Math.round((planCad + totalTax) * 100) / 100,
    note: isB2B ? 'B2B customer can typically claim input tax credit on GST/HST portion.' : 'B2C: tax is final cost.'
  });
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
