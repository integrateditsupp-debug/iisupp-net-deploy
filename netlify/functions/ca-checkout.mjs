import Stripe from 'stripe';
import {
  CONTENT_ASSURANCE_LEDGER,
  CONTENT_ASSURANCE_STORE,
  getScopedStore,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  sanitizeEmail
} from './lib/content-assurance.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'POST only' });

  const body = parseJsonBody(event);
  if (!body) return jsonResponse(400, { error: 'Invalid JSON.' });

  const action = String(body.action || 'status').trim();
  const sessionId = String(body.sessionId || '').trim();
  const email = sanitizeEmail(body.email);
  if (!sessionId || !email) return jsonResponse(400, { error: 'sessionId and valid email are required.' });

  const contentStore = getScopedStore(CONTENT_ASSURANCE_STORE);
  const session = await contentStore.get('session-' + sessionId, { type: 'json' });
  if (!session) return jsonResponse(404, { error: 'Session not found.' });

  const ledgerStore = getScopedStore(CONTENT_ASSURANCE_LEDGER);
  const ledger = await ledgerStore.get('ledger-' + email, { type: 'json' });

  if (action === 'status') {
    return jsonResponse(200, { ok: true, status: resolveCheckoutStatus(ledger) });
  }

  if (action === 'create') {
    const choice = String(body.choice || '').trim();
    if (choice === 'use-credit') {
      return jsonResponse(200, { ok: true, unlockNow: true, status: resolveCheckoutStatus(ledger) });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return jsonResponse(500, { error: 'Stripe is not configured in this environment.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = event.headers.origin || event.headers.Origin || ('https://' + event.headers.host);
    const sessionUrlBase = '/services/content-assurance?ca_session=' + encodeURIComponent(sessionId);

    const mode = choice === 'subscription' ? 'subscription' : 'payment';
    const metadata = {
      product_family: 'content-assurance',
      ca_session: sessionId,
      ca_email: email,
      ca_goal: session.goal,
      ca_choice: choice
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      customer_email: email,
      billing_address_collection: 'auto',
      success_url: origin + sessionUrlBase + '&checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + sessionUrlBase + '&checkout=canceled',
      line_items: [buildLineItem(choice)],
      metadata
    });

    return jsonResponse(200, {
      ok: true,
      url: checkoutSession.url,
      id: checkoutSession.id
    });
  }

  return jsonResponse(400, { error: 'Unknown action.' });
};

function resolveCheckoutStatus(ledger) {
  const now = Date.now();
  if (ledger && ledger.activeUntil && new Date(ledger.activeUntil).getTime() > now) {
    if ((ledger.creditsRemaining || 0) > 0) {
      return {
        kind: 'use-credit',
        label: 'Use one included credit',
        creditsRemaining: ledger.creditsRemaining,
        activeUntil: ledger.activeUntil
      };
    }
    return {
      kind: 'overage',
      label: 'Pay $2 overage',
      creditsRemaining: 0,
      activeUntil: ledger.activeUntil
    };
  }
  return {
    kind: 'new',
    label: 'Choose single report or subscription',
    singlePriceCad: 5,
    subscriptionPriceCad: 20
  };
}

function buildLineItem(choice) {
  if (choice === 'subscription') {
    return {
      price_data: {
        currency: 'cad',
        product_data: {
          name: 'Content Assurance Monthly',
          description: '20 report credits per 30-day cycle for Content Assurance.'
        },
        recurring: { interval: 'month' },
        unit_amount: 2000
      },
      quantity: 1
    };
  }
  if (choice === 'overage') {
    return {
      price_data: {
        currency: 'cad',
        product_data: {
          name: 'Content Assurance Overage Credit',
          description: 'One additional report credit beyond the active monthly allowance.'
        },
        unit_amount: 200
      },
      quantity: 1
    };
  }
  return {
    price_data: {
      currency: 'cad',
      product_data: {
        name: 'Content Assurance Single Report',
        description: 'One unlocked Content Assurance report and delivery bundle.'
      },
      unit_amount: 500
    },
    quantity: 1
  };
}
