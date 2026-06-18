/**
 * aria-room-provider — Create a one-time video room via Whereby (default) or Daily.co fallback
 *  POST { event: 'create_room', expires_in_min?, max_participants?, name_hint? }
 *    -> { ok, room_url, room_name, expires_at, provider }
 *  POST { event: 'delete_room', room_name }
 *
 *  Env vars (Ahmad to set when provider account is up):
 *    WHEREBY_API_KEY  -- preferred
 *    DAILY_API_KEY    -- fallback
 *  Without either, returns a stub URL on meet.iisupp.net/r/<slug> so dev still works.
 *
 *  Cat 20 — Live remote support.
 */
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const ev = String(body.event || 'create_room').trim();

  if (ev === 'create_room') {
    const expiresMin = Math.min(Number(body.expires_in_min || 60), 480);
    const maxP = Math.min(Number(body.max_participants || 4), 20);
    const hint = String(body.name_hint || 'session').replace(/[^a-z0-9-]/gi, '').slice(0, 20);

    // Try Whereby first
    if (process.env.WHEREBY_API_KEY) {
      try {
        const r = await fetch('https://api.whereby.dev/v1/meetings', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.WHEREBY_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            roomMode: 'normal',
            endDate: new Date(Date.now() + expiresMin * 60000).toISOString(),
            fields: ['hostRoomUrl']
          })
        });
        const j = await r.json();
        if (r.ok) {
          return ok({
            ok: true,
            provider: 'whereby',
            room_url: j.roomUrl,
            host_room_url: j.hostRoomUrl,
            room_name: j.meetingId,
            expires_at: j.endDate
          });
        }
        console.warn('[room-provider] whereby err:', j);
      } catch (e) { console.warn('[room-provider] whereby ex:', e.message); }
    }

    // Try Daily fallback
    if (process.env.DAILY_API_KEY) {
      try {
        const slug = hint + '-' + crypto.randomBytes(4).toString('hex');
        const r = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.DAILY_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: slug,
            properties: {
              exp: Math.floor(Date.now() / 1000) + expiresMin * 60,
              max_participants: maxP,
              enable_screenshare: true,
              start_video_off: false
            }
          })
        });
        const j = await r.json();
        if (r.ok) {
          return ok({
            ok: true,
            provider: 'daily',
            room_url: j.url,
            room_name: j.name,
            expires_at: new Date(j.config.exp * 1000).toISOString()
          });
        }
      } catch (e) { console.warn('[room-provider] daily ex:', e.message); }
    }

    // Stub for dev
    const slug = hint + '-' + crypto.randomBytes(6).toString('hex');
    return ok({
      ok: true,
      provider: 'stub',
      room_url: 'https://meet.iisupp.net/r/' + slug,
      room_name: slug,
      expires_at: new Date(Date.now() + expiresMin * 60000).toISOString(),
      note: 'No provider key configured (WHEREBY_API_KEY or DAILY_API_KEY). Returning stub URL — set up provider before live use.'
    });
  }

  if (ev === 'delete_room') {
    const name = String(body.room_name || '');
    if (!name) return ok({ ok: false, error: 'room_name required' });
    if (process.env.WHEREBY_API_KEY) {
      try {
        const r = await fetch('https://api.whereby.dev/v1/meetings/' + name, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + process.env.WHEREBY_API_KEY }
        });
        return ok({ ok: r.ok, provider: 'whereby' });
      } catch (e) { return ok({ ok: false, error: e.message }); }
    }
    if (process.env.DAILY_API_KEY) {
      try {
        const r = await fetch('https://api.daily.co/v1/rooms/' + name, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + process.env.DAILY_API_KEY }
        });
        return ok({ ok: r.ok, provider: 'daily' });
      } catch (e) { return ok({ ok: false, error: e.message }); }
    }
    return ok({ ok: true, provider: 'stub', note: 'stub URLs expire on their own' });
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'unknown event' }) };

  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
