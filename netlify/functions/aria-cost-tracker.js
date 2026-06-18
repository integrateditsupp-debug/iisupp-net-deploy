/**
 * aria-cost-tracker - LLM token usage logger + budget alert
 *
 * POST { event: 'log', tokens_in, tokens_out, model, customer_id? }
 * POST { event: 'status' } -> returns current month spend + cap
 *
 * Round 6 upgrade:
 * - durable monthly summary in Netlify Blobs
 * - JSONL event ledger for auditing
 * - threshold dedupe at 80 / 95 / 100 percent of monthly cap
 * - graceful fallback to in-memory cache when Blobs are unavailable
 */
'use strict';

const { getStore } = require('@netlify/blobs');

const PRICES = {
  'claude-opus-4-7': { in: 15, out: 75 },
  'claude-opus-4-6': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-4-20250514': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'gpt-4o': { in: 5, out: 20 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 }
};

const ALERT_THRESHOLDS = [80, 95, 100];
let memorySummary = emptySummary(currentMonth());

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) };
  }

  const eventName = String(body.event || 'log').trim().toLowerCase();
  const month = currentMonth();
  if (memorySummary.month !== month) {
    memorySummary = emptySummary(month);
  }

  const store = getDurableStore();
  let summary = store ? await loadSummary(store, month) : cloneSummary(memorySummary);

  if (eventName === 'status') {
    const cap = monthlyCap();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formatStatus(summary, cap, !!store))
    };
  }

  if (eventName !== 'log') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };
  }

  const model = String(body.model || 'claude-sonnet-4-6').toLowerCase();
  const tokensIn = normalizeTokenCount(body.tokens_in);
  const tokensOut = normalizeTokenCount(body.tokens_out);
  if (tokensIn < 0 || tokensOut < 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'token counts must be >= 0' }) };
  }

  const price = PRICES[model] || PRICES['claude-sonnet-4-6'];
  const cost = (tokensIn / 1_000_000) * price.in + (tokensOut / 1_000_000) * price.out;
  const now = new Date().toISOString();
  const customerId = String(body.customer_id || '').trim().slice(0, 120);

  summary.total_usd += cost;
  summary.events_count += 1;
  summary.last_event_at = now;
  summary.by_model[model] = summary.by_model[model] || { tokens_in: 0, tokens_out: 0, cost_usd: 0, events: 0 };
  summary.by_model[model].tokens_in += tokensIn;
  summary.by_model[model].tokens_out += tokensOut;
  summary.by_model[model].cost_usd += cost;
  summary.by_model[model].events += 1;
  if (customerId) {
    summary.customers[customerId] = {
      last_seen_at: now,
      month_cost_usd: round((summary.customers[customerId]?.month_cost_usd || 0) + cost),
      tokens_in: (summary.customers[customerId]?.tokens_in || 0) + tokensIn,
      tokens_out: (summary.customers[customerId]?.tokens_out || 0) + tokensOut
    };
  }

  const cap = monthlyCap();
  const pct = cap > 0 ? (summary.total_usd / cap) * 100 : 0;
  const threshold = ALERT_THRESHOLDS.find((value) => pct >= value && !summary.alerts_sent[String(value)]);
  if (threshold) {
    summary.alerts_sent[String(threshold)] = now;
    await alertAhmad(threshold, summary.total_usd, cap, summary.month);
  }

  memorySummary = cloneSummary(summary);
  if (store) {
    await saveSummary(store, month, summary);
    await appendLedgerEvent(store, month, {
      ts: now,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: round(cost),
      customer_id: customerId || null
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      durable: !!store,
      logged_cost_usd: round(cost),
      month_total_usd: round(summary.total_usd),
      pct_of_cap: round(pct),
      events_count: summary.events_count
    })
  };
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthlyCap() {
  return Number(process.env.ARIA_LLM_MONTHLY_CAP_USD || 100);
}

function emptySummary(month) {
  return {
    month,
    total_usd: 0,
    by_model: {},
    customers: {},
    events_count: 0,
    last_event_at: null,
    alerts_sent: {}
  };
}

function cloneSummary(summary) {
  return JSON.parse(JSON.stringify(summary));
}

function normalizeTokenCount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Math.round(num) : -1;
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function getDurableStore() {
  try {
    return getStore({ name: 'aria-cost-tracker', consistency: 'strong' });
  } catch (error) {
    console.warn('[cost-tracker] blobs unavailable:', error.message);
    return null;
  }
}

async function loadSummary(store, month) {
  try {
    const summary = await store.get(month + '/summary.json', { type: 'json' });
    return summary ? normalizeSummary(summary, month) : emptySummary(month);
  } catch (_error) {
    return emptySummary(month);
  }
}

function normalizeSummary(summary, month) {
  const base = emptySummary(month);
  const merged = Object.assign(base, summary || {});
  merged.by_model = merged.by_model || {};
  merged.customers = merged.customers || {};
  merged.alerts_sent = merged.alerts_sent || {};
  merged.events_count = Number(merged.events_count || 0);
  merged.total_usd = Number(merged.total_usd || 0);
  return merged;
}

async function saveSummary(store, month, summary) {
  await store.set(month + '/summary.json', JSON.stringify(summary, null, 2));
}

async function appendLedgerEvent(store, month, entry) {
  const key = month + '/events.jsonl';
  const prior = (await store.get(key, { type: 'text' })) || '';
  const next = prior + JSON.stringify(entry) + '\n';
  await store.set(key, next);
}

function formatStatus(summary, cap, durable) {
  const pct = cap > 0 ? (summary.total_usd / cap) * 100 : 0;
  return {
    ok: true,
    durable,
    month: summary.month,
    total_usd: round(summary.total_usd),
    by_model: summarizeModels(summary.by_model),
    cap_usd: cap,
    pct_of_cap: round(pct),
    remaining_usd: round(Math.max(0, cap - summary.total_usd)),
    events_count: Number(summary.events_count || 0),
    last_event_at: summary.last_event_at || null,
    alerts_sent: summary.alerts_sent || {},
    note: durable ? 'Durable via Netlify Blobs.' : 'Fallback in-memory only (Blobs unavailable).'
  };
}

function summarizeModels(byModel) {
  const out = {};
  Object.keys(byModel || {}).forEach((model) => {
    out[model] = {
      tokens_in: Number(byModel[model].tokens_in || 0),
      tokens_out: Number(byModel[model].tokens_out || 0),
      cost_usd: round(byModel[model].cost_usd || 0),
      events: Number(byModel[model].events || 0)
    };
  });
  return out;
}

async function alertAhmad(threshold, total, cap, month) {
  const to = process.env.ARIA_LLM_ALERT_TO || 'ahmad.wasee@iisupp.net';
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const subject = '[ARIA cost] ' + threshold + '% of monthly LLM cap consumed';
  const html = [
    '<p>ARIA LLM spend crossed <strong>' + threshold + '%</strong> of the monthly cap.</p>',
    '<p>Month: <strong>' + month + '</strong></p>',
    '<p>Total this month: <strong>$' + round(total) + '</strong> of $' + cap + ' cap.</p>',
    '<p>Check: <code>POST /.netlify/functions/aria-cost-tracker {"event":"status"}</code></p>'
  ].join('');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
        to: [to],
        subject,
        html
      })
    });
  } catch (error) {
    console.warn('[cost-tracker] alert mail failed:', error.message);
  }
}
