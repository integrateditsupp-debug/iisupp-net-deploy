/**
 * ARIA Self-Learning Logger
 * Stores anonymized conversation data to Netlify Blobs for analysis.
 * Patterns from logs feed back into ARIA's knowledge over time.
 */
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST required' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  try {
    const store = getStore({ name: 'aria-learning' });

    // Hash session ID so we can group turns without storing raw IDs
    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const turnId = `${dateKey}/${body.sessionId || 'anon'}/${Date.now()}`;

    const record = {
      session: String(body.sessionId || 'anon').slice(0, 64),
      userMessage: String(body.userMessage || '').slice(0, 2000),
      ariaResponse: String(body.ariaResponse || '').slice(0, 2000),
      emotion: String(body.emotion || 'neutral').slice(0, 32),
      tone: String(body.tone || 'warm').slice(0, 32),
      category: String(body.category || 'other').slice(0, 32),
      resolved: Boolean(body.resolved),
      escalated: Boolean(body.escalated),
      timestamp: body.timestamp || new Date().toISOString(),
    };

    await store.setJSON(turnId, record);

    // Also append to a daily summary for quick analytics
    const summaryKey = `summary/${dateKey}`;
    let summary = await store.get(summaryKey, { type: 'json' }).catch(() => null);
    summary = summary || { date: dateKey, total: 0, resolved: 0, escalated: 0, byCategory: {}, byEmotion: {} };
    summary.total++;
    if (record.resolved) summary.resolved++;
    if (record.escalated) summary.escalated++;
    summary.byCategory[record.category] = (summary.byCategory[record.category] || 0) + 1;
    summary.byEmotion[record.emotion] = (summary.byEmotion[record.emotion] || 0) + 1;
    await store.setJSON(summaryKey, summary);

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id: turnId }) };
  } catch (err) {
    console.error('[aria-learn] error:', err.message);
    // Never fail caller — this is fire-and-forget
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
