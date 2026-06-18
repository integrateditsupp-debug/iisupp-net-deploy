/**
 * aria-mrr-dashboard — Stripe-backed MRR / ARR / customer dashboard
 *  POST { event: 'snapshot' } -> returns live MRR, ARR, customer count,
 *                                churn proxy, top revenue plans
 *
 *  Cat 10 (Reporting + analytics). Pulls direct from Stripe — no DB.
 */
const Stripe = require('stripe');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
  const stripe = Stripe(stripeKey);

  try {
    // Pull active + trialing subscriptions
    let mrr_cents = 0;
    let active_count = 0;
    let trialing_count = 0;
    const by_plan = {};
    let starting_after = undefined;
    do {
      const opts = { status: 'all', limit: 100 };
      if (starting_after) opts.starting_after = starting_after;
      const page = await stripe.subscriptions.list(opts);
      for (const sub of page.data) {
        if (sub.status === 'active' || sub.status === 'trialing') {
          const isTrialing = sub.status === 'trialing';
          if (isTrialing) trialing_count++; else active_count++;
          for (const item of sub.items.data) {
            const price = item.price;
            const unit = Number(price.unit_amount || 0);
            const qty = Number(item.quantity || 1);
            const interval = (price.recurring && price.recurring.interval) || 'month';
            const intervalCount = Number((price.recurring && price.recurring.interval_count) || 1);
            // normalise to MONTHLY cents
            let monthly_cents = 0;
            if (interval === 'month')   monthly_cents = (unit * qty) / intervalCount;
            else if (interval === 'year') monthly_cents = (unit * qty) / (12 * intervalCount);
            else if (interval === 'week') monthly_cents = (unit * qty) * (4.345 / intervalCount);
            else if (interval === 'day')  monthly_cents = (unit * qty) * (30 / intervalCount);
            if (!isTrialing) mrr_cents += monthly_cents;
            const planKey = (price.nickname || price.id);
            by_plan[planKey] = by_plan[planKey] || { count: 0, monthly_cents: 0 };
            by_plan[planKey].count++;
            by_plan[planKey].monthly_cents += monthly_cents;
          }
        }
      }
      starting_after = page.has_more ? page.data[page.data.length - 1].id : null;
    } while (starting_after);

    // Recent churn (cancelled in last 30 days)
    const thirty = Math.floor(Date.now() / 1000) - (30 * 86400);
    const cancelled = await stripe.subscriptions.list({ status: 'canceled', limit: 100, created: { gte: thirty } });
    const churn_30d = (cancelled.data || []).filter(s => s.ended_at && s.ended_at >= thirty).length;

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true,
      snapshot_at: new Date().toISOString(),
      mrr_usd: round(mrr_cents / 100),
      arr_usd: round((mrr_cents / 100) * 12),
      active_subscriptions: active_count,
      trialing_subscriptions: trialing_count,
      churn_30d_count: churn_30d,
      by_plan: Object.entries(by_plan).map(([k, v]) => ({
        plan: k,
        active: v.count,
        monthly_usd: round(v.monthly_cents / 100)
      })).sort((a, b) => b.monthly_usd - a.monthly_usd),
      currency: 'USD',
      note: 'Live pull from Stripe — no caching.'
    }) };
  } catch (e) {
    console.error('[aria-mrr-dashboard]', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

function round(n) { return Math.round(n * 100) / 100; }
