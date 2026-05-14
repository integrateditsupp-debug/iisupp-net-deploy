// aperture-session — read session state for Aperture polling
// GET /.netlify/functions/aperture-session?sid=xxx&since=<ts>
// Returns: { meta, events, since: <newest ts> }

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'GET only' }) };

  const sid = (event.queryStringParameters || {}).sid;
  const since = parseInt((event.queryStringParameters || {}).since || '0', 10);
  if (!sid) return resp(400, cors, { error: 'sid required' });

  let sessions;
  try { sessions = getStore({ name: 'aria-sessions', consistency: 'strong' }); }
  catch (e) { return resp(500, cors, { error: 'storage unavailable' }); }

  const meta = await sessions.get(`${sid}/meta.json`, { type: 'json' });
  if (!meta) return resp(404, cors, { error: 'session not found' });

  const eventsRaw = (await sessions.get(`${sid}/events.jsonl`, { type: 'text' })) || '';
  const allEvents = eventsRaw.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  const newEvents = allEvents.filter(e => e.ts > since);
  const newestTs = allEvents.length ? allEvents[allEvents.length - 1].ts : since;

  return resp(200, cors, {
    meta,
    events: newEvents,
    since: newestTs,
    totalEvents: allEvents.length
  });
};

function resp(status, cors, obj) { return { statusCode: status, headers: cors, body: JSON.stringify(obj) }; }
