// aria-resend-helper.mjs — one-shot Resend domain setup via API
// Uses existing RESEND_API_KEY env var, no dashboard login needed.
// Actions (querystring):
//   ?action=list                          → list all domains
//   ?action=add&name=iisupp.net           → add a new domain, returns DNS records
//   ?action=get&id=xxx                    → get domain status + DNS records
//   ?action=verify&id=xxx                 → trigger verification check

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return jr({ error: 'RESEND_API_KEY not set in Netlify env' }, 500);
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  try {
    if (action === 'list') {
      const r = await fetch('https://api.resend.com/domains', { headers });
      return jr({ status: r.status, body: await r.json() });
    }
    if (action === 'add') {
      const name = url.searchParams.get('name') || 'iisupp.net';
      const region = url.searchParams.get('region') || 'us-east-1';
      const r = await fetch('https://api.resend.com/domains', {
        method: 'POST', headers,
        body: JSON.stringify({ name, region })
      });
      return jr({ status: r.status, body: await r.json() });
    }
    if (action === 'get') {
      const id = url.searchParams.get('id');
      if (!id) return jr({ error: 'id required' }, 400);
      const r = await fetch(`https://api.resend.com/domains/${id}`, { headers });
      return jr({ status: r.status, body: await r.json() });
    }
    if (action === 'verify') {
      const id = url.searchParams.get('id');
      if (!id) return jr({ error: 'id required' }, 400);
      const r = await fetch(`https://api.resend.com/domains/${id}/verify`, {
        method: 'POST', headers
      });
      return jr({ status: r.status, body: await r.json() });
    }
    return jr({ error: 'unknown action: ' + action, available: ['list', 'add', 'get', 'verify'] }, 400);
  } catch (e) {
    return jr({ error: e.message || String(e) }, 500);
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}
function jr(o, s = 200) {
  return new Response(JSON.stringify(o, null, 2), { status: s, headers: cors() });
}
