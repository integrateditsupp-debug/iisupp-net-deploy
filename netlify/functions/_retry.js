/**
 * _retry - bounded retry with jitter for Netlify functions.
 *
 * Use for transient upstream failures only. It never retries 4xx style
 * application errors unless the caller's shouldRetry function allows it.
 */
'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultShouldRetry(error) {
  const status = Number(error && (error.status || error.statusCode || error.code));
  if (!status) return true;
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function withRetry(fn, options) {
  const cfg = Object.assign({
    attempts: 3,
    baseDelayMs: 180,
    maxDelayMs: 1800,
    jitterRatio: 0.35,
    shouldRetry: defaultShouldRetry,
    onRetry: null
  }, options || {});

  let lastError;
  for (let attempt = 1; attempt <= cfg.attempts; attempt += 1) {
    try {
      return await fn({ attempt });
    } catch (error) {
      lastError = error;
      if (attempt >= cfg.attempts || !cfg.shouldRetry(error)) break;
      const exp = Math.min(cfg.maxDelayMs, cfg.baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = exp * cfg.jitterRatio * Math.random();
      const delayMs = Math.round(exp + jitter);
      if (typeof cfg.onRetry === 'function') {
        cfg.onRetry({ attempt, delayMs, error });
      }
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function fetchWithRetry(url, options, retryOptions) {
  return withRetry(async () => {
    const response = await fetch(url, options);
    if (!response.ok && defaultShouldRetry({ status: response.status })) {
      const error = new Error('upstream_' + response.status);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return response;
  }, retryOptions);
}

module.exports = { withRetry, fetchWithRetry, defaultShouldRetry };
