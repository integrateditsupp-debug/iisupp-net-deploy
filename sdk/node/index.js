/**
 * @iisupp/aria-sdk v0.2
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
  getMemory(memory_key)  { return this._post('aria-session-memory', { event: 'get', memory_key }); }
  rememberMemory(p)      { return this._post('aria-session-memory', { event: 'remember', ...p }); }
  forgetMemory(memory_key, fields) {
    return this._post('aria-session-memory', { event: 'forget', memory_key, fields: Array.isArray(fields) ? fields : undefined });
  }
  submitTenantKB(p)      { return this._post('aria-tenant-kb', p); }
  approvalSubmit(p)      { return this._post('aria-write-gate', { event: 'request', ...p }); }
  approvalStatus(request_id) { return this._post('aria-write-gate', { event: 'status', request_id }); }
  approvalApprove(p)     { return this._post('aria-write-gate', { event: 'approve', ...p }); }
  approvalDeny(p)        { return this._post('aria-write-gate', { event: 'deny', ...p }); }
  renewalScan(dryRun)    { return this._post('aria-renewal-reminders', { event: 'scan', dry_run: !!dryRun }); }
}

module.exports = ARIA;
module.exports.default = ARIA;
module.exports.ARIA = ARIA;
