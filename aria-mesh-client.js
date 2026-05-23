// public/aria-mesh-client.js
// Browser-side mesh client. Drop into iisupp.net <head>.
// aria-core.js calls window.AriaMesh.ask(query, opts) instead of direct fetch to agent endpoints.
// Feature-flagged via window.ARIA_MESH = true. When false, all calls fall through to legacy behavior.

(function () {
  const ROUTER_URL = '/api/mesh-router';
  const EVENTS_URL = '/api/mesh-events';

  function dispatchExternal(envelope) {
    // External executors (OpenCode, Claude SDK) â surface to client for local dispatch.
    // Phase 2: wire actual local handler. For now: log + no-op stub.
    if (window && window.console) {
      console.info('[ARIA Mesh] External dispatch required:', envelope.result?.target, envelope.result?.payload);
    }
    if (typeof window.AriaMeshExternalHandler === 'function') {
      return window.AriaMeshExternalHandler(envelope.result);
    }
    return { ok: false, reason: 'external-handler-not-wired', envelope };
  }

  async function ask(query, opts = {}) {
    if (!window.ARIA_MESH) {
      // Feature flag OFF â caller should fall back to legacy direct call.
      return { ok: false, reason: 'mesh-disabled', useLegacy: true };
    }
    const payload = {
      query,
      requestedCapability: opts.capability || null,
      phase: opts.phase || null,
      context: opts.context || {},
      payloadOverride: opts.payload || null
    };
    let envelope;
    try {
      const r = await fetch(ROUTER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      envelope = await r.json();
    } catch (e) {
      return { ok: false, reason: 'router-fetch-failed', error: e?.message };
    }
    if (envelope?.result?.__external) {
      return dispatchExternal(envelope);
    }
    return envelope;
  }

  async function events(opts = {}) {
    const qs = new URLSearchParams();
    if (opts.agent) qs.set('agent', opts.agent);
    if (opts.since) qs.set('since', String(opts.since));
    if (opts.limit) qs.set('limit', String(opts.limit));
    const r = await fetch(`${EVENTS_URL}?${qs.toString()}`);
    return await r.json();
  }

  window.AriaMesh = { ask, events, ROUTER_URL, EVENTS_URL };
})();
