/**
 * _circuit-breaker — Process-local circuit breaker for upstream API calls
 *
 *  Usage:
 *    const { withBreaker } = require('./_circuit-breaker');
 *    const result = await withBreaker('anthropic', async () => {
 *      return await fetch('https://api.anthropic.com/v1/messages', {...});
 *    });
 *
 *  States:
 *    CLOSED   — calls pass through; failures counted
 *    OPEN     — calls rejected immediately (no upstream hit); auto-tries HALF_OPEN after cooldown
 *    HALF_OPEN — single probe call allowed; success closes, failure re-opens
 *
 *  Note: process-local (per-function-instance). For multi-instance coherence, replace
 *  state with Netlify Blobs in v0.2.
 *
 *  Cat 13 — Failure modes + recovery.
 */
const _state = {}; // { key: { failures, opened_at, last_attempt, state, success_count } }

const DEFAULT = {
  failure_threshold: 5,        // open after N consecutive failures
  cooldown_ms: 30 * 1000,      // wait 30s before HALF_OPEN probe
  half_open_success_to_close: 2,
  request_timeout_ms: 25000
};

function getOrInit(key) {
  if (!_state[key]) _state[key] = { failures: 0, opened_at: 0, last_attempt: 0, state: 'CLOSED', success_count: 0 };
  return _state[key];
}

async function withBreaker(key, fn, opts) {
  const cfg = Object.assign({}, DEFAULT, opts || {});
  const s = getOrInit(key);
  const now = Date.now();

  // If OPEN, check if cooldown expired -> HALF_OPEN probe
  if (s.state === 'OPEN') {
    if (now - s.opened_at < cfg.cooldown_ms) {
      const err = new Error('circuit_open');
      err.code = 'CIRCUIT_OPEN';
      err.retry_after_ms = cfg.cooldown_ms - (now - s.opened_at);
      err.key = key;
      throw err;
    }
    s.state = 'HALF_OPEN';
    s.success_count = 0;
  }

  // Run with timeout
  let result;
  try {
    result = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('circuit_timeout')), cfg.request_timeout_ms))
    ]);
  } catch (e) {
    s.failures += 1;
    s.last_attempt = now;
    if (s.state === 'HALF_OPEN' || s.failures >= cfg.failure_threshold) {
      s.state = 'OPEN';
      s.opened_at = now;
      console.warn('[breaker] OPENED', key, 'failures:', s.failures, 'reason:', e.message);
    }
    throw e;
  }

  // Success
  if (s.state === 'HALF_OPEN') {
    s.success_count += 1;
    if (s.success_count >= cfg.half_open_success_to_close) {
      s.state = 'CLOSED';
      s.failures = 0;
      console.log('[breaker] CLOSED', key);
    }
  } else if (s.state === 'CLOSED') {
    s.failures = 0; // reset on success
  }
  s.last_attempt = now;
  return result;
}

function getStatus() {
  const out = {};
  for (const k of Object.keys(_state)) {
    out[k] = Object.assign({}, _state[k]);
  }
  return out;
}

function reset(key) {
  if (key) delete _state[key]; else for (const k of Object.keys(_state)) delete _state[k];
}

module.exports = { withBreaker, getStatus, reset, DEFAULT };
