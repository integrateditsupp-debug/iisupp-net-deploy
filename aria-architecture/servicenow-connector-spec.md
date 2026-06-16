# ServiceNow Connector Specification — ARIA Enterprise Integration

**Owner spec:** Cowork  |  **Implementation owner:** Claude Code  |  **Version:** 1.0  |  **Status:** SPEC — ready for build

## Purpose

Bidirectional integration between ARIA and customer ServiceNow ITSM instance. Required for 60% of enterprise pipeline (ServiceNow is the dominant enterprise ITSM platform). Unlocks Mid-Size+ tier ($312K/yr) deals.

## Scope

### In scope (v1)
- **Outbound (ARIA → ServiceNow):** create incident from escalated ARIA conversation; create request from user-initiated request; attach ARIA conversation transcript.
- **Inbound (ServiceNow → ARIA):** ServiceNow webhook on ticket close/comment → update ARIA conversation; sync ticket state for end-user visibility.
- **Catalog item integration:** ARIA can submit ServiceNow Service Catalog requests on user's behalf with approval flow.
- **User mapping:** map ServiceNow user record to ARIA user via email or sys_id.

### Out of scope (v1)
- ServiceNow Change Management module integration (planned v2).
- ServiceNow Problem Management integration.
- ServiceNow CMDB sync (planned v2).
- On-prem ServiceNow instances (cloud only for v1).

## Architecture

```
[ End user via ARIA ]
        ↓ "I need to request a new laptop"
[ ARIA conversation ]
        ↓ recognizes catalog-item intent (symbolic state: SVC.CATALOG.REQUEST)
        ↓ confirms with user
[ ARIA Edge Function: /api/servicenow/create-request ]
        ↓ tenant lookup → ServiceNow OAuth token
        ↓ POST https://<tenant>.service-now.com/api/sn_sc/servicecatalog/items/<sys_id>/order_now
        ↓ payload: { sysparm_quantity: 1, sysparm_requested_for: <user_sys_id>, variables: {...} }
[ ServiceNow ]
        ↓ creates request (REQ-XXXX) + request items (RITM-XXXX)
        ↓ returns sys_id + number
[ ARIA Edge Function ]
        ↓ persists association: aria_conversation_id ↔ servicenow_record_id
        ↓ tells user: "Request REQ12345 submitted. You'll get email when approved."

[ ServiceNow agent updates ticket ]
        ↓ ServiceNow Business Rule fires webhook on update
[ ARIA webhook: /api/servicenow/webhook ]
        ↓ verify HMAC signature
        ↓ look up associated conversation
        ↓ update conversation status
        ↓ if user is active in chat: push notification "Your request was approved"
        ↓ else: send email
```

## Authentication

### Customer-side OAuth setup
Customer ServiceNow admin creates an OAuth Application Registry in their instance:
1. System OAuth → Application Registry → New → "Create an OAuth API endpoint for external clients".
2. Name: "ARIA Integration".
3. Client ID + Client Secret generated.
4. Scopes: `useraccount` (basic profile) + necessary table CRUD scopes.

Customer pastes Client ID + Client Secret + instance URL into ARIA admin console.

### Token flow
- ARIA uses OAuth 2.0 Client Credentials (or Resource Owner Password Grant for legacy).
- Token cached per tenant, refreshed before expiry.
- Stored encrypted in `tenant_servicenow_config.access_token` (AES-256 via KMS).

## API endpoints used (ServiceNow Table API)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/now/table/incident` | POST | Create incident |
| `/api/now/table/incident/{sys_id}` | PATCH | Update incident |
| `/api/now/table/incident/{sys_id}` | GET | Read incident |
| `/api/now/table/sc_request` | POST | Create service request |
| `/api/sn_sc/servicecatalog/items/{sys_id}/order_now` | POST | Order catalog item |
| `/api/now/table/sys_user` | GET | Look up user |
| `/api/now/import/{table}` | POST | Bulk import (rate-limited use only) |

## Data model

### Table: `tenant_servicenow_config`

```sql
CREATE TABLE tenant_servicenow_config (
  tenant_id              UUID PRIMARY KEY REFERENCES tenants(id),
  instance_url           TEXT NOT NULL,
  oauth_client_id        TEXT NOT NULL,
  oauth_client_secret    TEXT NOT NULL,  -- encrypted at rest
  oauth_access_token     TEXT,
  oauth_refresh_token    TEXT,
  oauth_expires_at       TIMESTAMPTZ,
  webhook_hmac_secret    TEXT NOT NULL,  -- for inbound webhook verification
  default_assignment_group TEXT,
  default_caller_lookup_field TEXT DEFAULT 'email',  -- or 'employee_number'
  enabled                BOOL DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `aria_servicenow_link`

```sql
CREATE TABLE aria_servicenow_link (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id),
  aria_conversation_id   UUID NOT NULL,
  servicenow_table       TEXT NOT NULL,  -- 'incident' | 'sc_request' | 'sc_req_item'
  servicenow_sys_id      TEXT NOT NULL,
  servicenow_number      TEXT NOT NULL,  -- e.g. 'INC0012345'
  state                  TEXT,  -- current ServiceNow state
  last_sync_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, servicenow_sys_id)
);
CREATE INDEX idx_aria_sn_link_conversation ON aria_servicenow_link(aria_conversation_id);
```

## Webhook (inbound from ServiceNow)

### Customer-side setup
Customer admin creates a Business Rule in ServiceNow:
1. Table: Incident (or Service Catalog Request, as needed).
2. When: after update.
3. Filter conditions: state changes OR comments added OR work_notes added.
4. Script: send HTTP POST to ARIA webhook URL with HMAC signature.

ARIA provides a copy-paste Business Rule script in the admin console setup wizard.

### ARIA webhook endpoint

`POST /api/servicenow/webhook`

**Headers:**
- `X-ARIA-Signature`: HMAC-SHA256 of body using `webhook_hmac_secret`.
- `X-ARIA-Tenant`: tenant UUID.

**Body (JSON):**
```json
{
  "sys_id": "abc123",
  "number": "INC0012345",
  "table": "incident",
  "state": "Resolved",
  "comments": "Issue resolved by clearing browser cache.",
  "updated_at": "2026-06-15T16:30:00Z",
  "updated_by": "agent@customer.com"
}
```

**ARIA action:**
1. Verify HMAC signature; reject if invalid.
2. Look up `aria_servicenow_link` by `(tenant_id, sys_id)`.
3. Update linked conversation's state.
4. If user is actively in chat: push update via SSE or WebSocket.
5. If user is not active: trigger email notification.

## Configuration UX (admin console)

Tenant admin flow:
1. Navigate to `/admin/integrations/servicenow`.
2. Enter ServiceNow instance URL (e.g., `https://acme.service-now.com`).
3. Enter OAuth Client ID + Secret (from their ServiceNow OAuth setup).
4. Click "Test connection" → ARIA performs OAuth token exchange + reads `sys_user` count to verify.
5. Configure default assignment group, caller lookup field.
6. Generate webhook HMAC secret; display copy-able URL + script for ServiceNow Business Rule.
7. Click "Enable integration".
8. Optionally configure catalog item mappings (which ServiceNow catalog items ARIA can submit on behalf of users).

## Symbolic state additions

For ARIA pattern recognition:

| State | Pattern | Action |
|---|---|---|
| `SVC.ESCALATE.SERVICENOW` | "create a ticket", "open a ticket", "escalate this" | Open incident in ServiceNow |
| `SVC.CATALOG.REQUEST` | "request a [device/access/software]", "I need access to..." | Catalog item search + order |
| `SVC.TICKET.STATUS` | "what's the status of my ticket", "where is my request" | Look up linked tickets |

Add to `aria-architecture/symbolic-state-dictionary-v1.json` as v1.1 amendment.

## Security requirements

- OAuth tokens encrypted at rest with per-tenant key.
- HMAC verification on every webhook.
- Webhook secret rotatable from admin console.
- All ServiceNow API calls logged to Aperture (tenant, action, sys_id, success/failure).
- Rate limiting: 100 req/min per tenant outbound to ServiceNow (respect ServiceNow's defaults).
- IP allowlisting: optional; ARIA can publish its egress IPs for customer firewall rules.

## Error handling

- ServiceNow API 401: refresh OAuth token; retry once; if still failing, alert tenant admin.
- ServiceNow API 429 (rate limit): exponential backoff with jitter; max 5 retries.
- ServiceNow API 500: retry with backoff; alert if persistent.
- Network timeout: 30 sec; retry with backoff.
- All errors logged to Aperture.

## Testing

### Unit
- Mock ServiceNow API responses; verify OAuth flow, request building, response parsing.

### Integration
- Set up ServiceNow PDI (Personal Developer Instance — free) for ARIA test tenant.
- Run end-to-end create-incident, update-incident, catalog-order flows.
- Test webhook (use ServiceNow PDI to trigger Business Rule).

### Negative
- Invalid OAuth credentials → clear error.
- Webhook with bad HMAC → reject + alert.
- Tampered request → reject.

## Time estimate

- OAuth flow + token mgmt: 1 day.
- Outbound API client (incident, request, catalog): 2 days.
- Inbound webhook + HMAC verification: 1 day.
- Admin console UI: 2 days.
- Symbolic state pattern additions: 0.5 day.
- Testing + docs: 2 days.

**Total:** ~8.5 days of Claude Code engineering.

## Deliverables

1. `netlify/functions/servicenow/create-incident.mjs`
2. `netlify/functions/servicenow/create-request.mjs`
3. `netlify/functions/servicenow/catalog-order.mjs`
4. `netlify/functions/servicenow/webhook.mjs`
5. `netlify/functions/servicenow/oauth-token-mgr.mjs`
6. `assets/admin/integrations/servicenow.html` + JS
7. Postgres migrations: `migrations/202606-servicenow-tables.sql`
8. `aria-architecture/symbolic-state-dictionary-v1.json` v1.1 amendment with 3 new states
9. Tests: `tests/servicenow/*.test.mjs`
10. Docs: `docs/servicenow-customer-setup.md`

## Approval gates

- Spec review by Ahmad: required.
- ServiceNow PDI test environment results: required before production.
- First paying customer pilot test: before promoting to GA.

## Related

- `aria-architecture/2M-ASSET-REQUIREMENTS.md` Section 3.1.
- `senior-director-state/loop-engineer/claude-code-next-prompt.md` PACKET (add as E).
