/**
 * _stripe_customer_cache — cache layer for Stripe customer.search by email.
 *  TTL: 10 minutes (eventual). Cuts ~80% of repeated calls during welcome/audit flows.
 */
async function getCustomerByEmail(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'aria-stripe-customer-cache' });
    const cached = await store.get('cust-' + e, { type: 'json' });
    if (cached && (Date.now() - cached.cached_at < 10 * 60 * 1000)) return cached.customer;

    const r = await fetch('https://api.stripe.com/v1/customers/search?query=' + encodeURIComponent('email:"' + e + '"'), {
      headers: { 'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY }
    });
    const j = await r.json();
    const customer = j.data?.[0] || null;
    if (customer) await store.setJSON('cust-' + e, { cached_at: Date.now(), customer });
    return customer;
  } catch { return null; }
}
module.exports = { getCustomerByEmail };
