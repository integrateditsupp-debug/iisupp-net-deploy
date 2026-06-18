/**
 * @iisupp/aria-sdk v0.1
 *  Node client for ARIA Public API
 *  Docs: https://iisupp.net/docs/api
 *
 *  Usage:
 *    const ARIA = require('@iisupp/aria-sdk');
 *    const client = new ARIA();
 *    await client.captureLead({ name, email, message });
 *    await client.requestHandoff({ email, chat_summary });
 *    const stats = await client.mrr();
 *    const out = await client.exportMyData({ email });
 */
'use strict';

const DEFAULT_BASE = 'https://iisupp.net/.netlify/functions';

class ARIA {
  constructor(opts) {
    opts = opts || {};
    this.base = (opts.base || DEFAULT_BASE).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs || 30000;
  }

  async _post(path, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const r = await fetch(this.base + '/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('ARIA ' + path + ' ' + r.status + ': ' + (j.error || r.statusText));
      return j;
    } finally {
      clearTimeout(t);
    }
  }

  async _get(path, params) {
    const url = new URL(this.base + '/' + path);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('ARIA ' + path + ' ' + r.status + ': ' + (j.error || r.statusText));
      return j;
    } finally {
      clearTimeout(t);
    }
  }

  captureLead(p)         { return this._post('aria-lead-capture', p); }
  requestHandoff(p)      { return this._post('aria-warm-handoff', p); }
  exportMyData(p)        { return this._post('aria-data-export', p); }
  deleteMyAccount(p)     { return this._post('aria-account-delete', p); }
  changePlan(p)          { return this._post('aria-plan-change', p); }
  m365Graph(p)           { return this._post('aria-m365-graph', p); }
  requestMagicLink(email){ return this._post('aria-magic-link', { event: 'request', email }); }
  verifyMagicLink(token) { return this._post('aria-magic-link', { event: 'verify', token }); }
  feedback(p)            { return this._post('aria-feedback', p); }
  mrr()                  { return this._post('aria-mrr-dashboard', { event: 'snapshot' }); }
  costStatus()           { return this._post('aria-cost-tracker', { event: 'status' }); }
  costLog(p)             { return this._post('aria-cost-tracker', { event: 'log', ...p }); }
  submitTenantKB(p)      { return this._post('aria-tenant-kb', p); }
  renewalScan(dryRun)    { return this._post('aria-renewal-reminders', { event: 'scan', dry_run: !!dryRun }); }
  analyticsSnapshot(p)   { return this._post('aria-analytics-dashboard', { event: 'snapshot', ...(p || {}) }); }
  analyticsSeries(p)     { return this._post('aria-analytics-dashboard', { event: 'series', ...(p || {}) }); }
  winbackScan(p)         { return this._post('aria-winback-cron', { event: 'scan', ...(p || {}) }); }
  couponAdmin(p)         { return this._post('aria-coupon-admin', p || { event: 'list' }); }
  slackAuthorizeUrl(p)   { return this._post('aria-slack-install', { event: 'authorize_url', ...(p || {}) }); }
  whiteLabelTheme(tenantId) { return this._get('aria-white-label', { tenant_id: tenantId, format: 'json' }); }
  whiteLabelSet(p)       { return this._post('aria-white-label', { event: 'set', ...(p || {}) }); }
  costAttributionSummary(p) { return this._post('aria-cost-attribution', { event: 'tenant_summary', ...(p || {}) }); }
  breakerStatus()        { return this._post('aria-breaker-status', { event: 'status' }); }
}

module.exports = ARIA;
module.exports.default = ARIA;
module.exports.ARIA = ARIA;
