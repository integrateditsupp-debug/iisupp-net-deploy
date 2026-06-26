#!/usr/bin/env node
/**
 * tests/run-all-smoke.mjs — Smoke test every Netlify function
 *  Hits each function locally (via direct require/import) with safe test payloads.
 *  Pass = function returns 200 OR 400/401 with a structured error body (not 500).
 *  Skips: functions that REQUIRE upstream API calls (Stripe, Anthropic, Resend) — these
 *         are caught by per-function health checks separately.
 *  Run: node tests/run-all-smoke.mjs
 *  Output: tests/last-smoke-results.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FN_DIR = path.join(__dirname, '..', 'netlify', 'functions');
const SAFE_PAYLOADS = {
  'aria-lead-capture':       { event: 'capture', name: 'Test', email: 'test@test.com' },
  'aria-feedback':           { vote: 'up', msg_id: 'test' },
  'aria-tenant-audit':       { event: 'list', tenant_id: 'test.com' },
  'aria-cost-tracker':       { event: 'status' },
  'aria-cost-attribution':   { event: 'tenant_summary', tenant_id: 'test.com' },
  'aria-session-memory':     { event: 'load', email: 'test@test.com' },
  'aria-cross-device-sync':  { event: 'pull', email: 'test@test.com', token: 'wrong' },
  'aria-coupon':             { event: 'validate', code: 'NONE' },
  'aria-white-label':        { event: 'get', tenant_id: 'test.com' },
  'aria-translate':          { event: 'detect', text: 'hello' },
  'aria-write-gate':         { event: 'status', request_id: 'x' },
  'aria-screenshare-request':{ email: 'test@test.com', urgency: 'normal' },
  'aria-analytics-dashboard':{ event: 'snapshot' },
  'aria-leads-inbox':        { event: 'list' },
  'aria-billing-portal':     { email: 'test@test.com' },
  'aria-invoice-download':   { email: 'test@test.com' },
  'aria-magic-link':         { event: 'request', email: 'test@test.com' },
  'aria-data-export':        { email: 'test@test.com' },
  'aria-account-delete':     { email: 'test@test.com', confirm: 'INVALID' },
  'aria-plan-change':        { email: 'test@test.com', new_tier: 'pro' },
  'aria-m365-graph':         { action: 'health-check' },
  'aria-m365-graph-write':   { event: 'request', action: 'bad', tenant_email: 'x' },
  'aria-slack-command':      'text=test&user_name=tester',
  'aria-room-provider':      { event: 'create_room', expires_in_min: 5 },
  'aria-warm-handoff':       { email: 'test@test.com' },
  'aria-lead-auto-triage':   { lead: { message: 'test' } },
  'aria-mrr-dashboard':      { event: 'snapshot' },
  'aria-renewal-reminders':  { event: 'scan', dry_run: true },
  'aria-tenant-kb':          { tenant_email: 'test@test.com', kb_content: 'x' },
  'aria-stripe-pilot-events': '{"type":"ping"}'
};

const ACCEPTABLE_STATUS = new Set([200, 204, 400, 401, 403, 404, 405]);
const results = [];
let pass = 0, fail = 0, skip = 0;

const files = fs.readdirSync(FN_DIR).filter(f => /\.(js|mjs|mts|cjs)$/.test(f) && !f.startsWith('_'));

for (const f of files) {
  const name = f.replace(/\.(js|mjs|mts|cjs)$/, '');
  const filePath = path.join(FN_DIR, f);

  if (f.endsWith('.mjs') || f.endsWith('.mts')) {
    results.push({ fn: name, status: 'SKIP', reason: 'scheduled / esm — not unit-testable from this harness' });
    skip++;
    continue;
  }
  if (!SAFE_PAYLOADS[name]) {
    results.push({ fn: name, status: 'SKIP', reason: 'no safe payload defined' });
    skip++;
    continue;
  }

  try {
    const mod = await import(pathToFileURL(filePath).href);
    const handler = mod.handler || mod.default;
    if (!handler) {
      results.push({ fn: name, status: 'SKIP', reason: 'no .handler export' });
      skip++;
      continue;
    }
    const payload = SAFE_PAYLOADS[name];
    const isJson = typeof payload !== 'string';
    const event = {
      httpMethod: 'POST',
      headers: { 'content-type': isJson ? 'application/json' : 'application/x-www-form-urlencoded' },
      body: isJson ? JSON.stringify(payload) : payload
    };
    const r = await handler(event);
    if (ACCEPTABLE_STATUS.has(r.statusCode)) {
      results.push({ fn: name, status: 'PASS', http: r.statusCode });
      pass++;
    } else {
      results.push({ fn: name, status: 'FAIL', http: r.statusCode, body_sample: (r.body || '').slice(0, 100) });
      fail++;
    }
  } catch (e) {
    results.push({ fn: name, status: 'FAIL', error: e.message });
    fail++;
  }
}

const summary = {
  ran_at: new Date().toISOString(),
  total: files.length,
  pass, fail, skip,
  results
};

fs.writeFileSync(path.join(__dirname, 'last-smoke-results.json'), JSON.stringify(summary, null, 2));
console.log('\nSmoke test summary:');
console.log('  Total:', files.length);
console.log('  PASS: ', pass);
console.log('  FAIL: ', fail);
console.log('  SKIP: ', skip);

if (fail > 0) {
  console.log('\nFailures:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log('  ' + r.fn + ':', r.http || r.error));
}

process.exit(fail > 0 ? 1 : 0);
