# ARIA Sentinel — Browser-Outcome Fleet Ingestion (DESIGN ONLY — NOT WIRED)

Status: **design + frozen client contract only** (2026-07-07, Phase E).
Live wiring is gated on: a safe test tenant, real tenant auth, and explicit Ahmad approval.
Nothing in this document is implemented as a live endpoint. No Sentinel build sends fleet packets anywhere.

## 1 · What already exists (the frozen client side)

- `src/shared/browser-outcome.mjs` → `buildBrowserOutcomeFleetPacket(events, { now, endpointSeed })`
  produces the ONLY payload a future fleet backend may ever receive.
- `tests/browser-outcome-fleet-contract.test.mjs` **freezes that shape**: 9 top-level keys, locked
  window/counts/bucket/recent key sets, opaque handles + ISO timestamps only. URL / email / raw
  domain / path / epoch-ms / raw issue id are all rejected by the test. Any drift fails the suite.
- The packet is served read-only on the local loopback bridge: `GET /browser-outcomes/fleet-packet`.

**Rule: the backend adapts to the client contract, never the reverse.** A backend needing more data
is a privacy regression by definition (Rule 14 / content-blind invariant).

## 2 · Target architecture (customer-owned)

```
Sentinel endpoint (per device)
  └─ POST fleet-packet ────────► Customer-owned ingestion endpoint (their tenant, their infra)
                                   ├─ Tenant auth (per-customer credential, never shared)
                                   ├─ RBAC (who may read aggregates)
                                   ├─ Append-only audit log (every write + read)
                                   └─ Aggregate store (counts only — the packet is already content-blind)
```

- **Customer-owned**: the ingestion endpoint runs in the CUSTOMER's tenancy (their Netlify/Azure
  function or on-prem service). IIS ships the reference implementation; the customer holds the data.
  Sentinel is a data *source*, never a data *warehouse*.
- **Push model, device-initiated**: the endpoint only ever POSTs outbound on the customer's schedule
  (e.g. hourly). No inbound connection to the device, no remote query of an endpoint.

## 3 · Tenant auth

- Per-customer HMAC credential, provisioned exactly like the existing license scheme
  (`sentinel-resolve` pattern: secret server-side only, hash-only cache on device).
- Request signature: `X-Aria-Tenant: <customerId>` + `X-Aria-Signature: HMAC-SHA256(body, tenantSecret)`.
- Fail-closed: missing/invalid signature → 401, packet dropped, audit event recorded. No retry queue
  on the server side that could hold unauthenticated payloads.
- The tenant secret NEVER ships in the desktop build (same posture as `SENTINEL_LICENSE_SECRET`).

## 4 · RBAC (read side)

| Role            | May do                                                        |
|-----------------|---------------------------------------------------------------|
| `device`        | POST fleet packets for its own endpoint handle only           |
| `customer-admin`| read aggregates for their tenant; rotate tenant secret        |
| `iis-support`   | read aggregates ONLY when the customer grants a support scope |
| nobody          | read raw per-device history (it never leaves the device)      |

## 5 · Audit

- Append-only, hash-chained log (reuse the `plan-journal-hashchain` pattern) of: packet accepted /
  rejected (+reason code), aggregate read (who/when), secret rotation.
- Audit entries are content-blind by construction — they reference endpoint handles and counts only.

## 6 · Validation pipeline (server side, reference impl)

1. Verify tenant signature (fail-closed).
2. Re-run the SAME shape assertions the client contract test pins (shared validator module — the
   contract test file is the spec). Reject anything with an extra key. Reject any string matching
   the URL/email/domain/path/long-digit-run leak patterns.
3. Clamp counts to sane bounds; drop and audit malformed packets (never "fix up" data).
4. Store aggregates keyed by (tenant, endpoint handle, ISO day).

## 7 · Explicitly out of scope until gated approval

- Any live endpoint deployment (needs safe test tenant + Ahmad approval).
- Any real tenant-secret provisioning flow.
- Cross-customer aggregation of any kind.
- Growing the packet shape (would fail `browser-outcome-fleet-contract.test.mjs` — by design).
- Any device-side change: the client is DONE and frozen; Phase E work is backend-only.

## 8 · Next concrete steps (in order, each gated)

1. Ahmad approves a safe test tenant (e.g. an IIS-internal Netlify site with a throwaway secret).
2. Extract the contract assertions into a shared validator consumable by the backend reference impl.
3. Reference ingestion function + its own suite (signature verify · shape reject · audit chain).
4. End-to-end dry run: local Sentinel → test tenant, verified content-blind at the wire.
5. Customer pilot only after the dry run is reviewed (Codex review for the safety-critical diff).
