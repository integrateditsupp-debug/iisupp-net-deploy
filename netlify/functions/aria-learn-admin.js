/**
 * Admin: view learning data + daily summaries.
 * Auth via ARIA_ADMIN_TOKEN header.
 */
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const adminToken = process.env.ARIA_ADMIN_TOKEN;
  const provided = event.headers['x-admin-token'] || event.headers['X-Admin-Token'] ||
    (event.queryStringParameters && event.queryStringParameters.token);

  if (!adminToken || provided !== adminToken) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    const store = getStore({ name: 'aria-learning' });
    const params = event.queryStringParameters || {};
    const action = params.action || 'summary';

    if (action === 'summary') {
      const date = params.date || new Date().toISOString().slice(0, 10);
      const summary = await store.get(`summary/${date}`, { type: 'json' }).catch(() => null);
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(summary || { date, total: 0 }) };
    }

    if (action === 'list') {
      const date = params.date || new Date().toISOString().slice(0, 10);
      const { blobs } = await store.list({ prefix: `${date}/` });
      const out = [];
      for (const b of blobs.slice(0, 100)) {
        const r = await store.get(b.key, { type: 'json' }).catch(() => null);
        if (r) out.push({ key: b.key, ...r });
      }
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: out.length, records: out }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'action must be summary or list' }) };
  } catch (err) {
    console.error('[aria-learn-admin] error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
