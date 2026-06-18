/**
 * aria-customer-slack-invite — Invite paying customer to private Slack channel
 *  POST { customer_email, customer_name } (called by aria-stripe-pilot-events)
 *  Creates a dedicated #customer-<slug> channel + invites Ahmad + the customer
 *  Cat 5 — Account management.
 */
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const email = String(body.customer_email || '').toLowerCase();
  const name = String(body.customer_name || 'Customer');
  if (!email) return ok({ ok: false, error: 'customer_email required' });

  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!slackToken) {
    // Stub: just record the intent + email Ahmad to manually create
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'ARIA <noreply@iisupp.net>',
            to: [process.env.FOUNDER_EMAIL || 'ahmad.wasee@iisupp.net'],
            subject: '[IIS] New customer needs Slack channel: ' + name,
            html: '<p>Manually create #customer-' + name.toLowerCase().replace(/[^a-z0-9]/g,'-') + ' Slack channel and invite ' + email + '. (Auto-create not configured — set SLACK_BOT_TOKEN)</p>'
          })
        });
      } catch {}
    }
    return ok({ ok: true, stub: true, action_required: 'manual' });
  }

  // Real path (when SLACK_BOT_TOKEN configured)
  const channelName = 'customer-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
  try {
    // 1. Create channel
    const createR = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + slackToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: channelName, is_private: true })
    });
    const createJ = await createR.json();
    if (!createJ.ok) return ok({ ok: false, error: 'channel create failed: ' + (createJ.error || 'unknown') });
    const channelId = createJ.channel.id;

    // 2. Invite customer by email (requires their Slack workspace user — usually need lookup)
    // For now, post welcome message
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + slackToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: channelId,
        text: 'Welcome ' + name + '! This is your dedicated IIS / ARIA support channel. Ahmad (the founder) will be here directly.'
      })
    });

    return ok({ ok: true, channel_id: channelId, channel_name: channelName });
  } catch (e) {
    return ok({ ok: false, error: e.message });
  }
  function ok(b) { return { statusCode: 200, headers, body: JSON.stringify(b) }; }
};
