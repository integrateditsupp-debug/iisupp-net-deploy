// library-download.mjs — serves Growth Library content ONLY after verifying a
// paid Stripe Checkout session. Content lives in _library-content.mjs (private,
// never served as a static asset). This is the paywall.
//
//   GET /library-download?session_id=cs_...            -> index of entitled items
//   GET /library-download?session_id=cs_...&id=gl-...   -> the guide (full or peek)
//
// Entitlement comes from session.metadata.tier set by stripe-checkout, which is
// the catalog's priceData.id = "<productId>-<full|peek>" (or "<bundleId>-full").

import Stripe from 'stripe';
import CONTENT, { BUNDLE_ITEMS } from './_library-content.mjs';

const BRAND = 'Integrated IT Support';
const EMAIL = 'ahmad.wasee@iisupp.net';

export default async (request) => {
  const url = new URL(request.url);
  const sid = url.searchParams.get('session_id');
  const id = url.searchParams.get('id');

  if (!sid) return page(400, 'Missing link', `<p>This download link is incomplete. Please use the link from your receipt, or email <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>`);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return page(500, 'Temporarily unavailable', `<p>Delivery isn't configured. Email <a href="mailto:${EMAIL}">${EMAIL}</a> with your receipt and we'll send your files.</p>`);

  let session;
  try {
    const stripe = new Stripe(key);
    session = await stripe.checkout.sessions.retrieve(sid);
  } catch (e) {
    return page(402, 'Could not verify purchase', `<p>We couldn't verify that checkout session. If you were charged, email <a href="mailto:${EMAIL}">${EMAIL}</a> and we'll deliver right away.</p>`);
  }

  if (!session || (session.payment_status !== 'paid' && session.status !== 'complete')) {
    return page(402, 'Payment not completed', `<p>This order isn't marked paid yet. If you just paid, wait a moment and refresh. Questions? <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>`);
  }

  // Resolve entitlement from metadata.tier = "<id>-<mode>"
  const tier = String((session.metadata && session.metadata.tier) || '');
  const m = tier.match(/^(.*)-(full|peek)$/);
  const mode = m ? m[2] : 'full';
  const baseId = m ? m[1] : tier;

  // Finder's-fee / concierge / device / tech-service purchases aren't library products.
  if (/^finder-/.test(baseId) || /^inv-/.test(baseId) || /^iis-concierge/.test(baseId) || baseId === 'tech-service' || baseId === '') {
    var kindMsg = /^finder-/.test(baseId) ? 'vetted source/answer'
      : /^inv-/.test(baseId) ? 'pickup or delivery details for your device'
      : 'confirmation and next steps';
    return page(200, 'Thank you — payment received', `
      <p>Your payment is confirmed. This purchase is fulfilled by our team directly — you'll receive your ${kindMsg} by email, typically within one business day.</p>
      <p>Need it sooner? Email <a href="mailto:${EMAIL}">${EMAIL}</a> or call (647) 581-3182 with your receipt.</p>`);
  }

  // Entitled product ids (bundle expands to its items)
  let entitled = BUNDLE_ITEMS[baseId] ? BUNDLE_ITEMS[baseId].slice() : [baseId];
  entitled = entitled.filter((x) => CONTENT[x]);

  if (!entitled.length) {
    return page(200, 'Thank you — payment received', `<p>Your payment is confirmed, but we couldn't auto-match the product. Email <a href="mailto:${EMAIL}">${EMAIL}</a> with your receipt and we'll send your files within one business day.</p>`);
  }

  // Single guide view
  if (id) {
    if (entitled.indexOf(id) < 0 || !CONTENT[id]) {
      return page(403, 'Not included in this order', `<p>That item isn't part of this purchase. <a href="/library-download?session_id=${encodeURIComponent(sid)}">See what you unlocked →</a></p>`);
    }
    const c = CONTENT[id];
    const body = mode === 'peek' ? c.peek : c.full;
    const tagline = mode === 'peek'
      ? `<div class="mode">Preview (30%) · credited toward full access — reply to your receipt</div>`
      : `<div class="mode ok">Full access · yours to keep</div>`;
    return guide(c.title, tagline + body, sid, entitled.length > 1 ? sid : null);
  }

  // Index of everything in this order
  const rows = entitled.map((x) => {
    const c = CONTENT[x];
    return `<li><a href="/library-download?session_id=${encodeURIComponent(sid)}&id=${encodeURIComponent(x)}">${esc(c.title)}</a> <span class="fmt">${esc(c.format || '')}</span></li>`;
  }).join('');
  const modeLine = mode === 'peek'
    ? `<p class="mode">You purchased the <b>30% preview</b>. Reply to your receipt to credit it toward full access.</p>`
    : `<p class="mode ok">Full access — open, read, and print to PDF anytime from this link.</p>`;
  return page(200, 'Your Growth Library', `${modeLine}<p>Tap any item to open it. Use your browser's <b>Print → Save as PDF</b> to keep a copy.</p><ul class="lib">${rows}</ul><p class="muted">Keep this link — it's tied to your paid order. Trouble? <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>`);
};

export const config = { path: '/library-download' };

/* ---------- rendering ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function shell(title, inner) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · ${BRAND}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;600&display=swap');
:root{--gold:#b8954f}
*{box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:#f6f5f2;color:#1a1a1a;margin:0;line-height:1.65}
.wrap{max-width:760px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 0 60px rgba(0,0,0,.08)}
header{background:#0a0a0a;color:#fff;padding:26px 40px;display:flex;align-items:center;justify-content:space-between;gap:16px}
header .b{display:flex;align-items:center;gap:12px}
header .mk{width:34px;height:34px;border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--gold);font-family:'Cinzel',serif;font-weight:700}
header .nm{font-family:'Cinzel',serif;letter-spacing:.18em;font-size:13px;text-transform:uppercase}
header .pr{background:var(--gold);color:#1a1407;border:none;padding:9px 16px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;border-radius:5px;cursor:pointer;text-decoration:none}
main{padding:40px 48px 60px}
h1{font-family:'Cinzel',serif;font-size:26px;letter-spacing:.02em;margin:0 0 6px}
h2{font-family:'Cinzel',serif;font-size:17px;margin:30px 0 10px;color:#0a0a0a;border-bottom:1px solid #eee;padding-bottom:6px}
p,li{font-size:15px}ul,ol{padding-left:22px}li{margin:5px 0}
pre{background:#0d1117;color:#e6edf3;padding:14px 16px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.6;white-space:pre-wrap}
code{background:#eee;padding:1px 5px;border-radius:4px;font-size:13px}
.mode{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6d2f;background:#faf4e6;border:1px solid #ead9b0;border-radius:6px;padding:8px 12px;display:inline-block;margin:0 0 18px}
.mode.ok{color:#1f7a4d;background:#eef9f1;border-color:#bfe6cd}
.peek-cut{margin-top:26px;padding:18px 20px;border:1px dashed var(--gold);border-radius:8px;background:#faf4e6;font-size:14px}
.lib{list-style:none;padding:0}.lib li{border:1px solid #eee;border-radius:8px;padding:14px 16px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;gap:12px}
.lib a{color:#0a0a0a;font-weight:600;text-decoration:none}.lib .fmt{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.08em}
.muted{color:#888;font-size:13px}a{color:#8a6d2f}
footer{padding:22px 48px 40px;border-top:1px solid #eee;color:#999;font-size:12px}
@media print{header .pr{display:none}body{background:#fff}.wrap{box-shadow:none}}
</style></head><body><div class="wrap">
<header><div class="b"><div class="mk">I</div><div class="nm">Integrated IT&nbsp;Support</div></div><a class="pr" href="javascript:window.print()">Save as PDF</a></header>
<main>${inner}</main>
<footer>© Integrated IT Support Inc. · Original material licensed for your use — please don't redistribute. · ${esc(EMAIL)} · (647) 581-3182</footer>
</div></body></html>`;
}
function guide(title, inner, sid) {
  return resp(200, shell(title, `<h1>${esc(title)}</h1><p class="muted"><a href="/library-download?session_id=${encodeURIComponent(sid)}">← All your items</a></p>${inner}`));
}
function page(status, title, inner) {
  return resp(status, shell(title, `<h1>${esc(title)}</h1>${inner}`));
}
function resp(status, html) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
