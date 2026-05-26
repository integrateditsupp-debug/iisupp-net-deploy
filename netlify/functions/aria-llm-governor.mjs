// netlify/functions/aria-llm-governor.mjs
// ARIA LLM Governor — the cost/SLA gate (AROC + Ahmad's hard rules 2–4, 2026-05-25).
// THE BRAIN OF THE SPEND/SAFETY POLICY. Every potential LLM call MUST route through here.
// Nothing LLM-touching is allowed to fire unless this function returns { permit:true }.
//
// Hard rules encoded (Ahmad, 2026-05-25):
//   2. No LLM call unless pattern + KB + research are ALL exhausted AND the request is
//      breaching / repeatedly breaching SLA.
//   3. One-shot per issue: a given issue gets AT MOST ONE LLM call, ever. After that,
//      contact Ahmad and never call again for that issue.
//   4. Hard spend cap: never exceed ARIA_LLM_MONTHLY_CAP_USD (default $10, plan-bound).
//      At/over cap → refuse + Ahmad gets a back-to-back alert every ~3 min (via the
//      aria-governor-alert-cron) until he approves a higher limit / acknowledges.
//
// SLA gates (Ahmad confirmed): L1 60s, L2 90s, L3 180s interactive. "Breaching" = elapsed
// past 0.8× the tier SLA, OR this issue-class has a repeated-breach history. The 1-hour
// ticket get-back window means agents almost always find a free answer first — so this
// gate should trip rarely.
//
// This function NEVER calls an LLM itself — it AUTHORIZES one. Cost here = $0. Dormant-safe:
// with no RESEND_API_KEY it simply doesn't email; the gate logic still works.
//
// Endpoints:
//   POST {query, issueKey, tier, elapsedMs, patternFallthrough, researchEmpty,
//         estCostUsd?, repeatedBreach?, _trace}  -> authorize a call (default action)
//   POST {action:"commit", issueKey, actualCostUsd}   -> reconcile real cost after a call
//   POST {action:"ack"}        (JWT or x-aria-governor-secret) -> stop cap alerts / clear breach
//   POST {action:"raise-cap", newCapUsd}  (JWT or secret)     -> record an approved higher cap
//   POST {action:"kill", on:true|false}   (JWT or secret)     -> hard kill switch
//   GET  (Aperture JWT)        -> full ledger + SLA health + alert state (dashboard + kill switch)
//
// Registered in mesh-registry.json as a "gate" phase agent (status: active).

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

const STORE = 'aria-llm-governor';
const LEDGER_KEY = 'ledger.json';     // { month, spendUsd, calls, lastReset, capOverrideUsd? }
const ISSUES_KEY = 'issues.json';     // { [issueKey]: { ts, reason, costUsd } }  -> one-shot map
const ALERT_KEY = 'cap-alert.json';   // { breached, since, lastAlert, acknowledged, alertCount }
const KILL_KEY = 'kill.json';         // { on, since }

// Tier SLA (ms). Confirmed by Ahmad 2026-05-25.
const SLA_MS = { L1: 60000, L2: 90000, L3: 180000 };
const BREACH_FACTOR = 0.8; // "breaching" once elapsed crosses 80% of the SLA budget

function cap() {
  const v = parseFloat(process.env.ARIA_LLM_MONTHLY_CAP_USD || '10');
  return Number.isFinite(v) && v >= 0 ? v : 10;
}
function thisMonth() { return new Date().toISOString().slice(0, 7); } // YYYY-MM

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-aria-governor-secret',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
}
function jr(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: cors() }); }

async function safeJson(store, key, fallback) {
  try { const v = await store.get(key, { type: 'json' }); return v || fallback; } catch { return fallback; }
}
async function safeSet(store, key, obj) {
  try { await store.set(key, JSON.stringify(obj), { contentType: 'application/json' }); return true; } catch { return false; }
}

// Roll the ledger over on a new month (spend resets, cap override clears to plan default).
function rolledLedger(ledger) {
  const m = thisMonth();
  if (!ledger || ledger.month !== m) {
    return { month: m, spendUsd: 0, calls: 0, lastReset: Date.now(), capOverrideUsd: 0 };
  }
  return ledger;
}
function effectiveCap(ledger) {
  const base = cap();
  const override = (ledger && ledger.capOverrideUsd) || 0;
  return Math.max(base, override); // an approved higher limit wins, but only for this month
}

// ---- pure decision (exported for unit testing without blobs) ----
export function decide(input, ledger, issues, killed) {
  const {
    query = '', issueKey, tier = 'L1', elapsedMs = 0,
    patternFallthrough = false, researchEmpty = false,
    estCostUsd = 0.02, repeatedBreach = false
  } = input || {};

  const key = String(issueKey || query || '').trim().slice(0, 200);
  const slaMs = SLA_MS[tier] || SLA_MS.L1;
  const breaching = repeatedBreach || (elapsedMs > BREACH_FACTOR * slaMs);
  const freeExhausted = patternFallthrough === true && researchEmpty === true;
  const spend = (ledger && ledger.spendUsd) || 0;
  const limit = effectiveCap(ledger);
  const alreadyUsed = !!(issues && key && issues[key]);
  const wouldExceed = (spend + Math.max(0, estCostUsd)) > limit;

  // Kill switch wins over everything.
  if (killed) return mk(false, 'kill-switch', 'LLM use is hard-disabled (kill switch on). Escalate to human.', { key, slaMs, breaching, spend, limit });

  // One-shot rule (rule 3): an issue already spent its single call.
  if (alreadyUsed) return mk(false, 'one-shot-exhausted', `This issue already used its one allowed LLM call (${new Date(issues[key].ts).toISOString()}). Do NOT call again — escalate to a human.`, { key, slaMs, breaching, spend, limit });

  // Spend cap (rule 4): absolute.
  if (wouldExceed) return mk(false, 'cap-reached', `Monthly LLM cap reached ($${spend.toFixed(2)} of $${limit.toFixed(2)}). Refusing. Ahmad is being alerted to approve a higher limit.`, { key, slaMs, breaching, spend, limit, capReached: true });

  // Free path must be exhausted first (rule 2, part 1).
  if (!freeExhausted) return mk(false, 'free-path-open', 'Pattern/KB/research not yet exhausted — keep using the free path (you have up to the 1-hour get-back window).', { key, slaMs, breaching, spend, limit });

  // Must be breaching SLA (rule 2, part 2).
  if (!breaching) return mk(false, 'within-sla', `Still within SLA (${elapsedMs}ms of ${slaMs}ms). Keep researching free sources before any LLM call.`, { key, slaMs, breaching, spend, limit });

  // All gates pass -> permit exactly one call.
  return mk(true, 'permit', 'Free path exhausted AND SLA breaching AND under cap AND first time for this issue. ONE LLM call authorized, then Ahmad is notified and this issue is locked.', { key, slaMs, breaching, spend, limit, estCostUsd });
}
function mk(permit, code, reason, extra) { return { permit, code, reason, ...extra, ts: Date.now() }; }

// ---- alert email (the "ARIA used the LLM for X — why" note, and cap-reached note) ----
async function sendAlert(kind, detail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'ARIA <onboarding@resend.dev>';
  const to = process.env.ARIA_LLM_ALERT_TO || process.env.EVOLUTION_REPORT_TO || process.env.SALES_NOTIFY_EMAIL || 'integrateditsupp@gmail.com';
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set (dormant)' };
  const subject = kind === 'cap'
    ? '🔴 ARIA LLM cap reached — approval needed to raise the limit'
    : `ARIA used the LLM — ${detail.issueKey || 'an issue'}`;
  const body = kind === 'cap'
    ? `ARIA has hit the monthly LLM spend cap of $${detail.limit?.toFixed?.(2)}.\n\nSpend this month: $${detail.spend?.toFixed?.(2)}\nAll further LLM calls are REFUSED until you approve a higher limit.\nYou will get this alert every ~3 minutes until you acknowledge.\n\nApprove a higher cap from Aperture, or reply to acknowledge.`
    : `ARIA just used its ONE allowed LLM call for this issue (one-shot rule — it will not call again for it).\n\nIssue: ${detail.issueKey}\nTier: ${detail.tier}\nWhy: free path (pattern+KB+research) was exhausted and the request was breaching SLA.\nEst. cost: $${(detail.estCostUsd || 0).toFixed(4)}\nMonth-to-date spend: $${(detail.spend || 0).toFixed(2)} of $${(detail.limit || 0).toFixed(2)}.`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body })
    });
    return { sent: r.ok, status: r.status, to };
  } catch (e) { return { sent: false, reason: e?.message || String(e) }; }
}

export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  const store = getStore({ name: STORE, consistency: 'strong' });
  const secret = request.headers.get('x-aria-governor-secret');
  const secretAuthed = secret && process.env.ARIA_AUDIT_SECRET && secret === process.env.ARIA_AUDIT_SECRET;
  const jwtAuthed = !!verifyAperture(request);

  // ---- GET: ledger + health for Aperture (JWT only) ----
  if (request.method === 'GET') {
    if (!jwtAuthed) return jr({ error: 'unauthorized — Aperture JWT required' }, 401);
    const ledger = rolledLedger(await safeJson(store, LEDGER_KEY, null));
    const issues = await safeJson(store, ISSUES_KEY, {});
    const alert = await safeJson(store, ALERT_KEY, { breached: false });
    const kill = await safeJson(store, KILL_KEY, { on: false });
    const limit = effectiveCap(ledger);
    return jr({
      ok: true,
      cap: { planCapUsd: cap(), effectiveCapUsd: limit, capOverrideUsd: ledger.capOverrideUsd || 0 },
      spend: { month: ledger.month, spendUsd: ledger.spendUsd, calls: ledger.calls, remainingUsd: Math.max(0, limit - ledger.spendUsd) },
      sla: SLA_MS, breachFactor: BREACH_FACTOR,
      oneShotIssues: Object.keys(issues).length,
      capAlert: alert, killSwitch: kill
    });
  }

  if (request.method !== 'POST') return jr({ error: 'POST only' }, 405);

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const action = body.action || 'authorize';

  // ---- privileged control actions (JWT or audit secret) ----
  if (['ack', 'raise-cap', 'kill'].includes(action)) {
    if (!jwtAuthed && !secretAuthed) return jr({ error: 'unauthorized — JWT or x-aria-governor-secret required' }, 401);
    if (action === 'ack') {
      await safeSet(store, ALERT_KEY, { breached: false, acknowledged: true, since: Date.now(), lastAlert: 0, alertCount: 0 });
      return jr({ ok: true, action, message: 'Cap alert acknowledged — back-to-back alerts stopped.' });
    }
    if (action === 'raise-cap') {
      const ledger = rolledLedger(await safeJson(store, LEDGER_KEY, null));
      const newCap = parseFloat(body.newCapUsd);
      if (!Number.isFinite(newCap) || newCap < 0) return jr({ error: 'newCapUsd must be a non-negative number' }, 400);
      ledger.capOverrideUsd = newCap;
      await safeSet(store, LEDGER_KEY, ledger);
      await safeSet(store, ALERT_KEY, { breached: false, acknowledged: true, since: Date.now(), lastAlert: 0, alertCount: 0 });
      return jr({ ok: true, action, effectiveCapUsd: effectiveCap(ledger), note: 'Override applies for this month only; resets to plan cap next month.' });
    }
    if (action === 'kill') {
      const on = body.on !== false;
      await safeSet(store, KILL_KEY, { on, since: Date.now() });
      return jr({ ok: true, action, killSwitch: { on } });
    }
  }

  // ---- commit: reconcile real cost after an authorized call ----
  if (action === 'commit') {
    const ledger = rolledLedger(await safeJson(store, LEDGER_KEY, null));
    const delta = parseFloat(body.actualCostUsd);
    if (Number.isFinite(delta)) {
      // we pre-charged estCost at authorize time; adjust by the difference if provided
      ledger.spendUsd = Math.max(0, ledger.spendUsd + delta);
      await safeSet(store, LEDGER_KEY, ledger);
    }
    return jr({ ok: true, action, spendUsd: ledger.spendUsd });
  }

  // ---- authorize (default): the gate ----
  const ledger = rolledLedger(await safeJson(store, LEDGER_KEY, null));
  const issues = await safeJson(store, ISSUES_KEY, {});
  const killState = await safeJson(store, KILL_KEY, { on: false });
  const killed = !!killState.on || process.env.ARIA_LLM_KILL === '1';

  const verdict = decide(body, ledger, issues, killed);

  if (verdict.permit) {
    // Lock the issue (one-shot), pre-charge the estimate, persist.
    const key = verdict.key;
    issues[key] = { ts: Date.now(), reason: 'one-shot LLM call authorized', costUsd: body.estCostUsd || 0.02 };
    ledger.spendUsd = (ledger.spendUsd || 0) + Math.max(0, body.estCostUsd || 0.02);
    ledger.calls = (ledger.calls || 0) + 1;
    await safeSet(store, ISSUES_KEY, issues);
    await safeSet(store, LEDGER_KEY, ledger);
    // Notify Ahmad (rule 3): one call happened, here's why.
    const email = await sendAlert('used', { issueKey: key, tier: body.tier, estCostUsd: body.estCostUsd || 0.02, spend: ledger.spendUsd, limit: effectiveCap(ledger) });
    return jr({ ...verdict, ledger: { spendUsd: ledger.spendUsd, calls: ledger.calls, limit: effectiveCap(ledger) }, alertEmail: email });
  }

  // If refused because cap reached, raise/keep the breach flag so the 3-min cron alerts Ahmad.
  if (verdict.code === 'cap-reached') {
    const alert = await safeJson(store, ALERT_KEY, { breached: false });
    if (!alert.breached) {
      await safeSet(store, ALERT_KEY, { breached: true, acknowledged: false, since: Date.now(), lastAlert: 0, alertCount: 0 });
    }
  }
  return jr(verdict);
};

export { SLA_MS, effectiveCap };
