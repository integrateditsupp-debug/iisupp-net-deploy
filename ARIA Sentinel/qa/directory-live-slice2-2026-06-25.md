# Directory Live Integration — Slice 2 (Microsoft Graph read-only adapter)

| | |
|---|---|
| **Date** | 2026-06-25 |
| **Module** | `ARIA Sentinel/src/shared/entra-graph-client.mjs` |
| **Test** | `ARIA Sentinel/tests/entra-graph-client.test.mjs` (in `run-all`) |
| **Suite** | **194/194 green** |
| **Live tenant tested?** | **NO — creds not configured (FLAGGED, Ahmad/customer-gated)** |

## What shipped

The MOCK is replaced by a real Microsoft Graph `DirectoryProvider` adapter implementing the exact read-only
`client` interface `directory.mjs` consumes (`findUsers`, `getUser`, `getMemberGroups`, `getDevices`):

- **Auth:** OAuth2 **client-credentials** flow. App ID / Tenant ID / client secret are read from secure env
  (`DIRECTORY_TENANT_ID`, `DIRECTORY_CLIENT_ID`, `DIRECTORY_CLIENT_SECRET`) — never hardcoded, logged, or
  returned in any result. Token is cached and refreshed on expiry. **Least-privilege** scope:
  `https://graph.microsoft.com/.default` (resolves to the app's admin-consented READ scopes).
- **Read ops (live Graph v1.0):** users by `startswith(displayName/upn/mail)` with `$expand=manager`;
  account status (`accountEnabled`); group membership (`/memberOf/microsoft.graph.group`); registered
  devices (`operatingSystem`, `isCompliant`). All mapped to the directory.mjs shape and kept content-blind
  (opaque `uid-…` refs via directory.mjs).
- **Writes stay GATED:** `setLocked/setEnabled/addGroupMember/removeGroupMember/resetPassword` throw
  `directory_write_not_enabled` — they require write scopes + admin consent (a later, separately-gated slice).
  The full cannot-mess-up protocol in `directory.mjs` is unchanged.
- **Factory:** `createGraphClient(env)` returns the live client only when configured, else `null` (caller
  stays on mock/dry-run). `graphReadOnlySmoke(env)` is a flag-friendly connectivity check.

## Verification

- 8-group adapter test against an **injected mock Graph** (no live network): client-credentials token to the
  tenant-scoped endpoint, token cache + refresh, least-privilege `.default` scope, correct read-only Graph
  request URLs, response→shape mapping, **secret never on a read request / never in config output**, writes
  gated, and end-to-end through `directory.mjs` producing content-blind output.
- Privacy audit allowlist updated (explicit) to permit the customer's own `graph.microsoft.com` +
  `login.microsoftonline.com` — the same treatment as the ServiceNow customer integration.

## FLAG — live tenant verification is blocked on Ahmad/customer

`graphReadOnlySmoke(process.env)` →
`{ ok:false, configured:false, reason:"creds_not_configured", needs:[DIRECTORY_TENANT_ID, DIRECTORY_CLIENT_ID, DIRECTORY_CLIENT_SECRET] }`

To run the read-only ops against a real tenant, Ahmad/customer must: (1) register an Entra app, (2) grant
admin consent for the READ scopes (`User.Read.All`, `Group.Read.All`, `Device.Read.All`, `AuditLog.Read.All`),
(3) set the three env vars in the secure config. CC registers no app and touches no live tenant.
