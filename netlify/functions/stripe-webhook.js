/**
 * stripe-webhook — receives subscription lifecycle events from Stripe
 */
const Stripe = require('stripe');

exports.handler = async (event) => {
  const stripeKey   = process.env.STRIPE_SECRET_KEY;
  const webhookSec  = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSec) {
    return { statusCode: 500, body: 'Webhook not configured' };
  }
  const stripe = Stripe(stripeKey);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, webhookSec);
  } catch (err) {
    console.error('[stripe-webhook] Signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log('[stripe-webhook] Received:', evt.type);

  // Log all events for now; future iteration: update Netlify Identity tier metadata
  switch (evt.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed':
      console.log('[stripe-webhook] Event:', evt.type, 'customer:', evt.data.object.customer);
      break;
    default:
      console.log('[stripe-webhook] Unhandled:', evt.type);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
