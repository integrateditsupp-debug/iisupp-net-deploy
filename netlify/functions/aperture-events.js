// aperture-events — event ingestion for Aperture observability
// Phase B stub: logs events for now; will write to Netlify Blobs in v0.2

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const payload = JSON.parse(event.body || '{}');
    const eventType = payload.event || 'unknown';
    const sessionId = payload.session_id || payload.sid || null;

    // Phase B: write to Blobs. For now: console log + return 200.
    console.log('[aperture-events]', JSON.stringify({
      ts: Date.now(), eventType, sessionId,
      keys: Object.keys(payload)
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, received: eventType, session_id: sessionId })
    };
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: e.message }) };
  }
};
