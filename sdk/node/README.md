# @iisupp/aria-sdk

Official Node.js client for [ARIA](https://iisupp.net/aria) — the AI-powered IT support API by Integrated IT Support Inc.

## Install

```bash
npm install @iisupp/aria-sdk
```

## Quick start

```js
const ARIA = require('@iisupp/aria-sdk');
const client = new ARIA();

// Capture a lead from your chat
await client.captureLead({
  name: 'Jane Doe',
  email: 'jane@acme.com',
  company: 'Acme Inc.',
  message: 'Looking for managed IT support'
});

// Get live MRR snapshot
const stats = await client.mrr();
console.log('Current MRR:', stats.mrr_usd);

// PIPEDA data export
const data = await client.exportMyData({ email: 'user@co.com' });

// M365 Graph read-only
const users = await client.m365Graph({
  action: 'list-users',
  params: { top: 25 }
});
```

## All methods

See [docs.iisupp.net/api](https://iisupp.net/docs/api) for the full API reference. The SDK is a thin wrapper — every endpoint documented there is callable here.

## License

MIT
