exports.handler = async () => ({
  statusCode: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    status: 'ok',
    service: 'ARIA',
    version: '1.4.0',
    time: new Date().toISOString(),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    stripe: !!process.env.STRIPE_SECRET_KEY,
  }),
});
