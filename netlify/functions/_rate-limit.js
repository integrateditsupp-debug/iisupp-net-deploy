/**
 * _rate-limit - process-local token bucket with optional caller hashing.
 *
 * Intended as a low-cost guard for public endpoints. Durable distributed rate
 * limiting can be swapped in later via Netlify Blobs or an edge provider.
 */
'use strict';

const crypto = require('crypto');

const buckets = new Map();

function hashKey(value) {
  return crypto.createHash('sha256').update(String(value || 'anonymous')).digest('hex').slice(0, 24);
}

function getCaller(event, scope) {
  const headers = event.headers || {};
  const ip = headers['x-nf-client-connection-ip'] || headers['client-ip'] || headers['x-forwarded-for'] || 'unknown';
  return hashKey((scope || 'global') + ':' + String(ip).split(',')[0].trim());
}

function checkRateLimit(event, options) {
  const cfg = Object.assign({
    scope: 'default',
    limit: 60,
    windowMs: 60 * 1000,
    now: Date.now()
  }, options || {});
  const key = cfg.key || getCaller(event || {}, cfg.scope);
  const bucket = buckets.get(key) || { count: 0, resetAt: cfg.now + cfg.windowMs };

  if (cfg.now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = cfg.now + cfg.windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, cfg.limit - bucket.count);
  return {
    ok: bucket.count <= cfg.limit,
    key,
    limit: cfg.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - cfg.now) / 1000))
  };
}

function rateLimitResponse(result, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    'Retry-After': String(result.retryAfterSec)
  }, extraHeaders || {});
  return {
    statusCode: 429,
    headers,
    body: JSON.stringify({ ok: false, error: 'rate_limited', retry_after_sec: result.retryAfterSec })
  };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = { checkRateLimit, rateLimitResponse, resetRateLimits, hashKey };
