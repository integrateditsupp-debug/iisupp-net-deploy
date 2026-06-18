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

// Escalate into a human-approved screen-share request
await client.requestScreenShare({
  email: 'jane@acme.com',
  name: 'Jane Doe',
  urgency: 'normal',
  context: 'Need help with Outlook and screen walkthrough'
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

// Durable anonymous memory key for repeat sessions
const memory = await client.rememberMemory({
  summary: 'User keeps asking about Outlook add-ins.',
  recent_turns: [
    { role: 'user', content: 'Outlook crashes on launch.' },
    { role: 'assistant', content: 'Start with safe mode and disable COM add-ins.' }
  ],
  source: 'server-demo'
});

// Approval-gate scaffold for write-like agent actions
const gate = await client.approvalSubmit({
  action: 'kb.add_entry',
  tenant_email: 'ops@acme.com',
  requested_by: 'ARIA operator'
});
```

## All methods

See [iisupp.net/docs/api](https://iisupp.net/docs/api) for the full API reference. The SDK is a thin wrapper — every endpoint documented there is callable here.

Highlights in `v0.2`:

- `costStatus()` / `costLog()` now map to the durable Netlify Blobs-backed tracker
- `getMemory()` / `rememberMemory()` / `forgetMemory()` expose the anonymous cross-session memory scaffold on `aria-session-memory`
- `approvalSubmit()` / `approvalStatus()` / `approvalApprove()` / `approvalDeny()` expose the existing `aria-write-gate` safety rail

## License

MIT
