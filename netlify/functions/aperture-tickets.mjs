// aperture-tickets — V2 ESM function · JWT-gated · lists recent ARIA sessions
// GET /.netlify/functions/aperture-tickets?limit=50
//   headers: Authorization: Bearer <jwt>
// Returns: { ok, tickets: [{sid, ticket, user, company, issueSummary, status, startedAt, endedAt, lastEventAt, msgCount}] }

import { getStore } from '@netlify/blobs';
import { verifyAperture } from './aperture-auth.mjs';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return jsonResp(405, cors, { error: 'GET only' });

  const claims = verifyAperture(request);
  if (!claims) return jsonResp(401, cors, { error: 'auth required' });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });

  // List all keys; each session writes to `${sid}/meta.json` and `${sid}/events.json`.
  // We collect unique sids by stripping the `/meta.json` suffix from meta keys.
  let listing;
  try {
    listing = await sessions.list();
  } catch (e) {
    console.error('[aperture-tickets] list failed', e);
    return jsonResp(500, cors, { error: 'blob list failed', detail: String(e && e.message || e) });
  }

  const blobs = listing && listing.blobs ? listing.blobs : [];
  const sids = [];
  for (const b of blobs) {
    if (b.key && b.key.endsWith('/meta.json')) {
      sids.push(b.key.slice(0, -'/meta.json'.length));
    }
  }

  // Fetch meta for each sid in parallel (bounded).
  const tickets = [];
  for (let i = 0; i < sids.length; i += 10) {
    const batch = sids.slice(i, i + 10);
    const metas = await Promise.all(batch.map(async sid => {
      try {
        const meta = await sessions.get(`${sid}/meta.json`, { type: 'json' });
        if (!meta) return null;
        let lastEventAt = meta.startedAt || null;
        let msgCount = 0;
        try {
          const events = await sessions.get(`${sid}/events.json`, { type: 'json' });
          if (events && Array.isArray(events.list)) {
            msgCount = events.list.length;
            if (msgCount > 0) {
              const last = events.list[msgCount - 1];
              if (last && last.ts) lastEventAt = last.ts;
            }
          }
        } catch (_) {}
        return {
          sid,
          ticket: meta.ticket || null,
          user: meta.user || {},
          company: (meta.user && meta.user.company) || meta.company || null,
          issueSummary: meta.issueSummary || meta.firstUserMessage || null,
          status: meta.status || 'open',
          startedAt: meta.startedAt || null,
          endedAt: meta.endedAt || null,
          lastEventAt,
          msgCount
        };
      } catch (e) {
        return null;
      }
    }));
    for (const t of metas) if (t) tickets.push(t);
  }

  // Sort newest first by lastEventAt or startedAt
  tickets.sort((a, b) => {
    const at = new Date(a.lastEventAt || a.startedAt || 0).getTime();
    const bt = new Date(b.lastEventAt || b.startedAt || 0).getTime();
    return bt - at;
  });

  return jsonResp(200, cors, {
    ok: true,
    count: tickets.length,
    tickets: tickets.slice(0, limit),
    user: claims.sub
  });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}
