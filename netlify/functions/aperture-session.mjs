// aperture-session — V2 ESM function (auto-wires Netlify Blobs)
// GET /.netlify/functions/aperture-session?sid=xxx&since=<ts>

import { getStore } from '@netlify/blobs';

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return jsonResp(405, cors, { error: 'GET only' });

  const url = new URL(request.url);
  const sid = url.searchParams.get('sid');
  const since = parseInt(url.searchParams.get('since') || '0', 10);
  if (!sid) return jsonResp(400, cors, { error: 'sid required' });

  const sessions = getStore({ name: 'aria-sessions', consistency: 'strong' });

  const meta = await sessions.get(`${sid}/meta.json`, { type: 'json' });
  if (!meta) return jsonResp(404, cors, { error: 'session not found' });

  const eventsRaw = (await sessions.get(`${sid}/events.jsonl`, { type: 'text' })) || '';
  const allEvents = eventsRaw.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  const newEvents = allEvents.filter(e => e.ts > since);
  const newestTs = allEvents.length ? allEvents[allEvents.length - 1].ts : since;

  return jsonResp(200, cors, {
    meta,
    events: newEvents,
    since: newestTs,
    totalEvents: allEvents.length
  });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}
