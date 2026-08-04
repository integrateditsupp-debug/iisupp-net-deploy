import Stripe from 'stripe';
import {
  CONTENT_ASSURANCE_LEDGER,
  CONTENT_ASSURANCE_STORE,
  buildPdfBuffer,
  buildZipBundle,
  createDeliveryToken,
  getScopedStore,
  initBlobs,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  sanitizeEmail
} from './lib/content-assurance.mjs';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const handler = async (event) => {
  initBlobs(event);
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod === 'GET') return handleDownload(event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'POST only' });

  const body = parseJsonBody(event);
  if (!body) return jsonResponse(400, { error: 'Invalid JSON.' });

  const sessionId = String(body.sessionId || '').trim();
  const email = sanitizeEmail(body.email);
  const checkoutSessionId = String(body.checkoutSessionId || '').trim();
  if (!sessionId || !email) return jsonResponse(400, { error: 'sessionId and valid email are required.' });

  const store = getScopedStore(CONTENT_ASSURANCE_STORE);
  const session = await store.get('session-' + sessionId, { type: 'json' });
  if (!session) return jsonResponse(404, { error: 'Session not found.' });

  if (session.unlocked && session.deliveryToken && session.checkoutEmail === email) {
    return jsonResponse(200, buildDeliveryPayload(session));
  }

  const ledgerStore = getScopedStore(CONTENT_ASSURANCE_LEDGER);
  let ledger = await ledgerStore.get('ledger-' + email, { type: 'json' });

  if (checkoutSessionId) {
    if (!process.env.STRIPE_SECRET_KEY) return jsonResponse(500, { error: 'Stripe is not configured in this environment.' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (!checkout || checkout.metadata?.ca_session !== sessionId || sanitizeEmail(checkout.customer_email) !== email) {
      return jsonResponse(400, { error: 'Checkout session does not match this report.' });
    }
    if (checkout.payment_status !== 'paid' && checkout.status !== 'complete') {
      return jsonResponse(400, { error: 'Checkout session is not paid yet.' });
    }
    const choice = checkout.metadata?.ca_choice || 'single';
    if (choice === 'subscription') {
      ledger = {
        email,
        activeUntil: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        creditsRemaining: 19,
        lastPurchaseAt: new Date().toISOString(),
        lastMode: 'subscription',
        checkoutSessionId
      };
      await ledgerStore.setJSON('ledger-' + email, ledger);
    } else if (choice === 'overage' && ledger) {
      ledger.overageCount = (ledger.overageCount || 0) + 1;
      ledger.lastPurchaseAt = new Date().toISOString();
      ledger.lastMode = 'overage';
      await ledgerStore.setJSON('ledger-' + email, ledger);
    }
  } else {
    if (!ledger || !ledger.activeUntil || new Date(ledger.activeUntil).getTime() <= Date.now() || (ledger.creditsRemaining || 0) < 1) {
      return jsonResponse(400, { error: 'No active included credit is available for this email.' });
    }
    ledger.creditsRemaining -= 1;
    ledger.lastUseAt = new Date().toISOString();
    ledger.lastMode = 'credit';
    await ledgerStore.setJSON('ledger-' + email, ledger);
  }

  session.unlocked = true;
  session.paid = true;
  session.checkoutEmail = email;
  session.deliveryToken = session.deliveryToken || createDeliveryToken();
  session.deliveryAudit = Array.isArray(session.deliveryAudit) ? session.deliveryAudit : [];
  session.deliveryAudit.push({
    at: new Date().toISOString(),
    email,
    via: checkoutSessionId ? 'stripe' : 'credit'
  });
  await store.setJSON('session-' + sessionId, session);
  await sendHubSpotLead(session, email);

  return jsonResponse(200, buildDeliveryPayload(session));
};

async function handleDownload(event) {
  const params = event.queryStringParameters || {};
  const sessionId = String(params.sessionId || '').trim();
  const token = String(params.token || '').trim();
  const format = String(params.format || 'zip').trim().toLowerCase();
  if (!sessionId || !token) return textResponse(400, 'Missing session token.');

  const store = getScopedStore(CONTENT_ASSURANCE_STORE);
  const session = await store.get('session-' + sessionId, { type: 'json' });
  if (!session || !session.unlocked || session.deliveryToken !== token) {
    return textResponse(403, 'Delivery session not available.');
  }

  if (format === 'pdf') {
    const pdf = await buildPdfBuffer(session);
    return binaryResponse(pdf, 'application/pdf', `content-assurance-${sessionId}.pdf`);
  }

  if (format === 'json') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="content-assurance-${sessionId}.json"`
      },
      body: JSON.stringify(session.report, null, 2)
    };
  }

  const zip = await buildZipBundle(session);
  return binaryResponse(zip, 'application/zip', `content-assurance-${sessionId}.zip`);
}

// This function runs in Netlify's Lambda-compatible mode (named `handler` export), so every
// return value must be a { statusCode, headers, body } object — NOT a Response. Returning a
// Response here is what produced "error decoding lambda response: unexpected end of JSON input".
function textResponse(statusCode, text) {
  return { statusCode, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: text };
}

function binaryResponse(buffer, contentType, filename) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`
    },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true
  };
}

function buildDeliveryPayload(session) {
  const base = '/.netlify/functions/ca-delivery?sessionId=' + encodeURIComponent(session.sessionId) + '&token=' + encodeURIComponent(session.deliveryToken);
  return {
    ok: true,
    unlocked: true,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    token: session.deliveryToken,
    downloads: {
      zip: base + '&format=zip',
      pdf: base + '&format=pdf',
      json: base + '&format=json'
    }
  };
}

async function sendHubSpotLead(session, email) {
  const token = String(process.env.HUBSPOT_PRIVATE_APP_TOKEN || '').trim();
  if (!token) return;
  try {
    await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          email,
          lifecyclestage: 'lead',
          company: 'Content Assurance lead',
          jobtitle: session.goal,
          hs_lead_status: 'NEW',
          content_assurance_goal: session.goal,
          content_assurance_modules: (session.modules || []).join(', '),
          content_assurance_source: 'services/content-assurance',
          content_assurance_file_type: session.sourceMeta?.fileType || ''
        }
      })
    });
  } catch {}
}
