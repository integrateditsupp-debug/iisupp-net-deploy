# SCIM 2.0 Provisioning Specification

**Owner spec:** Cowork  |  **Implementation owner:** Claude Code  |  **Version:** 1.0  |  **Status:** SPEC

## Purpose

Automate user lifecycle (create, update, deactivate) from customer Identity Provider into ARIA. Required for enterprise IT shops that mandate SCIM provisioning for SaaS apps. Pairs with SAML SSO (`saml-sso-spec.md`).

## Scope

### In scope (v1)
- SCIM 2.0 (RFC 7643 + 7644) compliant.
- User CRUD operations.
- Group CRUD operations (mapped to ARIA roles).
- Bearer token authentication (per-tenant token).
- Push model: IdP pushes changes to ARIA (no polling).
- Microsoft Entra ID + Okta + OneLogin verified compatibility.

### Out of scope (v1)
- Pull model.
- Custom schema extensions (defer to v2).
- Role / permission attribute mapping beyond basic group → role.

## Architecture

```
[ Customer IdP ]
        ↓ SCIM API call (HTTPS + Bearer token)
[ ARIA Netlify Function: /scim/v2/Users or /scim/v2/Groups ]
        ↓ verify Bearer token
        ↓ verify tenant
        ↓ process create / update / patch / delete
[ Postgres users + roles tables ]
```

## Endpoints

Base URL: `https://iisupp.net/scim/v2`

| Endpoint | Methods | Purpose |
|---|---|---|
| `/Users` | GET, POST | List or create user |
| `/Users/{id}` | GET, PUT, PATCH, DELETE | Read, replace, partial update, delete |
| `/Groups` | GET, POST | List or create group |
| `/Groups/{id}` | GET, PUT, PATCH, DELETE | Read, replace, partial update, delete |
| `/Schemas` | GET | Discovery |
| `/ResourceTypes` | GET | Discovery |
| `/ServiceProviderConfig` | GET | Discovery |
| `/Bulk` | POST | Bulk operations (max 100 ops per request) |

## Authentication

- **Per-tenant Bearer token** issued at SCIM enablement.
- Token stored in `tenant_scim_config.bearer_token_hash` (Argon2id hash).
- Customer admin can rotate token from admin console.
- Token in `Authorization: Bearer <token>` header on every SCIM request.
- Token revocation: immediate effect; all subsequent SCIM requests rejected.

## Data model

### Table: `tenant_scim_config`

```sql
CREATE TABLE tenant_scim_config (
  tenant_id           UUID PRIMARY KEY REFERENCES tenants(id),
  bearer_token_hash   TEXT NOT NULL,  -- Argon2id hash of the actual token
  bearer_token_last4  TEXT NOT NULL,  -- for admin console display
  scim_enabled        BOOL DEFAULT true,
  default_role        TEXT DEFAULT 'agent',
  group_role_map      JSONB DEFAULT '{}',  -- IdP group → ARIA role
  attribute_map       JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  last_scim_event_at  TIMESTAMPTZ
);
```

## SCIM User schema (mapped to ARIA)

| SCIM attribute | ARIA field | Notes |
|---|---|---|
| `userName` | `users.email` | Required; lowercase normalized |
| `name.givenName` | `users.first_name` | Optional |
| `name.familyName` | `users.last_name` | Optional |
| `displayName` | `users.full_name` | Optional |
| `active` | `users.active` | True = enabled; false = soft-deactivate |
| `emails[].value (type=work)` | `users.email` | Same as userName typically |
| `phoneNumbers[].value (type=work)` | `users.phone` | Optional |
| `groups[].value` | `users.role` (via `group_role_map`) | Many-to-one mapping |
| `externalId` | `users.external_id` | IdP's user identifier (immutable) |

## SCIM Group schema (mapped to ARIA roles)

| SCIM attribute | ARIA field | Notes |
|---|---|---|
| `displayName` | `roles.name` | Maps to `group_role_map` keys |
| `members[].value` | join table | User-role assignment |
| `externalId` | `roles.external_id` | IdP's group ID |

## Lifecycle operations

### Create user (POST `/Users`)

1. Verify Bearer token + tenant.
2. Validate request body against SCIM schema.
3. Check uniqueness on `(tenant_id, email)`.
4. Insert user record.
5. Assign default role (or mapped role from groups[]).
6. Return `201 Created` with `Location` header pointing to created resource.

### Update user (PATCH `/Users/{id}`)

1. Verify Bearer token.
2. Apply PATCH operations per RFC 6902.
3. Common ops: `replace active`, `replace name`, `add groups`, `remove groups`.
4. Update user record.
5. Return `200 OK` with full resource.

### Deactivate user (PATCH active=false or DELETE)

1. Soft-deactivate: set `users.active = false`.
2. Revoke all active sessions.
3. Retain user record for audit; reactivable.
4. Hard delete (DELETE method): only on explicit IdP request; flag for review if customer policy requires retention.

### Group sync

1. Group create / update: insert / update `roles` table.
2. Group membership change: update join table `user_roles`.
3. Role propagation: refresh user's effective permissions on next session.

## Error responses

Per SCIM RFC 7644:
- `400` invalid request (malformed JSON, missing required fields).
- `401` invalid Bearer token.
- `403` insufficient permissions / tenant SCIM disabled.
- `404` resource not found.
- `409` uniqueness conflict.
- `429` rate limited (1000 req/min per tenant).
- `500` server error.

All errors return SCIM standard JSON error body.

## Configuration UX

Tenant admin flow:
1. Navigate to `/admin/scim`.
2. Click "Enable SCIM provisioning".
3. ARIA generates a Bearer token; display once (admin copies to clipboard).
4. Admin provides SCIM endpoint URL + Bearer token to IdP.
5. IdP test: click "Test from IdP" → ARIA verifies inbound /ServiceProviderConfig call.
6. Configure group → role mapping in admin console.
7. Activate.

## Compliance

- All SCIM events logged to Aperture audit log.
- Per-tenant audit log export available for SOC 2 / regulatory review.
- Bearer token rotation cadence: customer-configurable (default 365 days).

## Testing

### Unit
- Mock requests for each endpoint + method.
- Verify schema validation.

### Integration
- Test against Okta dev tenant (free).
- Test against Entra ID dev tenant.
- Verify lifecycle: create → update → group change → deactivate.

## Time estimate

- Endpoints + schema + Bearer auth: 3 days.
- Group / role mapping logic: 1 day.
- Admin console UI: 2 days.
- Testing (Okta + Entra): 2 days.

**Total:** ~8 days of Claude Code engineering.

## Deliverables

1. `netlify/functions/scim/users.mjs` — CRUD + PATCH.
2. `netlify/functions/scim/groups.mjs` — CRUD + PATCH.
3. `netlify/functions/scim/discovery.mjs` — Schemas, ResourceTypes, ServiceProviderConfig.
4. `assets/admin/scim-config.html` + JS.
5. `migrations/202606-scim-tables.sql`.
6. Tests: `tests/scim/*.test.mjs`.
7. Docs: `docs/scim-customer-setup.md`.

## Approval gates

- Spec review by Ahmad before build.
- Okta + Entra test harness pass before production.
- First paying customer SCIM integration before public GA.

## Related

- `aria-architecture/saml-sso-spec.md`
- `aria-architecture/2M-ASSET-REQUIREMENTS.md` Section 2.2
- `senior-director-state/loop-engineer/claude-code-next-prompt.md` (will add as PACKET F)
