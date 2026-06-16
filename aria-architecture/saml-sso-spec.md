# SAML SSO Specification — ARIA Enterprise Authentication

**Owner spec:** Cowork  |  **Implementation owner:** Claude Code (per loop-engineer routing)  |  **Version:** 1.0  |  **Status:** SPEC — ready for build

## Purpose

Enable enterprise customers to authenticate ARIA admin and end-user access via their existing Identity Provider (IdP) using SAML 2.0. Required for Mid-Size+ tier ($312K/yr) and a procurement-unblocker for any enterprise deal.

## Scope

### In scope (v1)
- SAML 2.0 Service Provider (SP) implementation.
- SP-initiated and IdP-initiated flows.
- Per-tenant configuration (each customer brings their own IdP).
- Just-In-Time (JIT) provisioning on first sign-in.
- IdP support: Microsoft Entra ID, Okta, Google Workspace, Ping, OneLogin, Auth0, Duo SSO.
- Configurable session lifetime per customer.

### Out of scope (v1)
- SCIM 2.0 provisioning (separate spec — `scim-spec.md`).
- OIDC (separate spec — `oidc-spec.md`, planned post-SAML).
- Multi-IdP per tenant.
- Federated MFA (rely on IdP's MFA).

## Architecture

```
[ Customer end user ]
        ↓ navigate to https://customer-tenant.iisupp.net/admin or /aria
[ ARIA Edge Function (Netlify) ]
        ↓ check session cookie
        ├── valid session → serve app
        └── no session → redirect to /saml/login?tenant=<tenant>
                            ↓
                    [ /saml/login ]
                            ↓ build SAML AuthnRequest
                            ↓ redirect to IdP SSO URL
                    [ Customer's IdP ]
                            ↓ user authenticates
                            ↓ MFA if required
                            ↓ POST SAMLResponse to /saml/acs
                    [ /saml/acs (Netlify function) ]
                            ↓ verify SAMLResponse signature
                            ↓ verify issuer + audience + timestamps
                            ↓ extract NameID + attributes
                            ↓ JIT provision user if first-time
                            ↓ create session token (HttpOnly cookie)
                            ↓ redirect to original destination
                    [ ARIA app — authenticated ]
```

## Function endpoints

| Path | Method | Purpose |
|---|---|---|
| `/saml/login` | GET | Initiate SP-initiated SAML AuthnRequest |
| `/saml/acs` | POST | Assertion Consumer Service — receive SAMLResponse from IdP |
| `/saml/metadata` | GET | Publish SP metadata XML for IdP configuration |
| `/saml/logout` | GET | Initiate SLO (Single Logout) if IdP supports |
| `/saml/slo` | POST | Receive LogoutResponse |
| `/admin/saml/configure` | POST | Tenant admin uploads IdP metadata XML or pastes URL |
| `/admin/saml/test` | POST | Tenant admin runs test sign-in to verify config |

## Library

- **Node:** `@node-saml/passport-saml` (MIT, free, widely used, active maintenance).
- **Why this:** native Node, integrates cleanly with Netlify functions, no external dependency on auth0/okta SDKs.
- **Alternative considered:** SAMLify — chose passport-saml for ecosystem maturity.

## Data model

### Table: `tenant_saml_config`

```sql
CREATE TABLE tenant_saml_config (
  tenant_id        UUID PRIMARY KEY REFERENCES tenants(id),
  idp_entity_id    TEXT NOT NULL,
  idp_sso_url      TEXT NOT NULL,
  idp_slo_url      TEXT,
  idp_x509_cert    TEXT NOT NULL,
  sp_entity_id     TEXT NOT NULL DEFAULT 'https://iisupp.net/saml',
  sp_assertion_url TEXT NOT NULL,
  default_role     TEXT DEFAULT 'agent',
  attribute_map    JSONB DEFAULT '{}',
  session_lifetime_minutes INT DEFAULT 480,
  enabled          BOOL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `user_saml_session`

```sql
CREATE TABLE user_saml_session (
  session_token    TEXT PRIMARY KEY,
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  saml_name_id     TEXT NOT NULL,
  attributes       JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  last_seen_at     TIMESTAMPTZ DEFAULT NOW(),
  revoked          BOOL DEFAULT false
);
CREATE INDEX idx_user_saml_session_user ON user_saml_session(user_id);
CREATE INDEX idx_user_saml_session_expires ON user_saml_session(expires_at);
```

## Attribute mapping

Default mapping from SAML attributes to ARIA user record:

| SAML attribute | ARIA field | Required |
|---|---|---|
| NameID (email format) | `users.email` | Yes |
| `givenName` | `users.first_name` | No |
| `sn` (surname) | `users.last_name` | No |
| `displayName` | `users.full_name` | No |
| `groups` (multi-value) | `users.role` (mapped via tenant config) | No |
| Custom attribute → `aria.role` | `users.role` (direct) | No |

Tenant admin can override mapping in `attribute_map` JSONB column.

## JIT provisioning

On first sign-in:
1. Verify SAMLResponse.
2. Extract NameID (email).
3. Look up user by `(tenant_id, email)`. If not found, create user record with default role from tenant config.
4. Issue session token.
5. Log JIT provisioning event to Aperture.

## Configuration UX (admin console)

Tenant admin flow:
1. Navigate to `/admin/saml`.
2. View ARIA's SP metadata (entity ID, ACS URL, certificate). Provide as URL or downloadable XML.
3. Configure in their IdP (Entra/Okta/Google/etc) using ARIA's metadata.
4. Upload IdP's metadata XML or paste metadata URL into ARIA.
5. Click "Test sign-in" — opens new window, performs full SAML flow, reports result.
6. Click "Enable" to activate for all tenant users.

## Security requirements

- **Signature verification:** every SAMLResponse signature MUST be verified against `idp_x509_cert`. Reject if signature invalid.
- **Audience restriction:** SAMLResponse must specify ARIA's `sp_entity_id` as audience. Reject otherwise.
- **NotBefore / NotOnOrAfter:** enforce timestamp validity (5-min clock skew tolerance).
- **InResponseTo:** if SP-initiated, verify InResponseTo matches our AuthnRequest ID.
- **Replay protection:** track AuthnRequest IDs for 1 hour; reject duplicate Response IDs.
- **Encryption:** if IdP encrypts assertions, support decryption with ARIA's private key.
- **HTTPS only:** ACS endpoint must be HTTPS. Reject non-HTTPS callbacks.
- **HttpOnly + Secure cookies:** session token in HttpOnly, Secure, SameSite=Lax cookie.

## Environment variables

Required Netlify env vars:
- `SAML_SP_PRIVATE_KEY` (PEM) — for signing AuthnRequests + decrypting encrypted assertions.
- `SAML_SP_CERTIFICATE` (PEM) — public cert published in SP metadata.
- `SAML_SP_ENTITY_ID` — default `https://iisupp.net/saml`.

## Testing

### Unit
- Mock IdP responses; verify signature validation, attribute extraction, JIT provisioning logic.

### Integration
- Set up test tenant with Okta dev account (free tier).
- Run full sign-in flow including JIT provisioning.
- Test logout (SLO).
- Test re-sign-in (no JIT, session resume).

### Negative
- Tampered SAMLResponse (signature mismatch) → reject.
- Expired NotOnOrAfter → reject.
- Wrong audience → reject.
- Replay attack (duplicate Response ID) → reject.

### Performance
- ACS handler should complete in under 500ms p95.

## Migration path for existing customers

Customers currently using ARIA without SSO:
1. Tenant admin configures SAML in admin console.
2. SSO enabled for new sign-ins.
3. Existing sessions remain valid until expiry.
4. Optionally: admin can force-revoke all sessions to require fresh SSO sign-in.

## Compliance hooks

- SAML sign-in events logged to Aperture audit log (timestamp, tenant, user, source IP, success/failure).
- Failed sign-ins flagged at 5+ failures per user per hour.
- Per-customer audit log export available (Mid-Size+ tier).

## Deliverables (Claude Code packet)

1. `netlify/functions/saml/login.mjs` — SP-initiated AuthnRequest generation.
2. `netlify/functions/saml/acs.mjs` — Assertion Consumer Service.
3. `netlify/functions/saml/metadata.mjs` — SP metadata XML publication.
4. `netlify/functions/saml/logout.mjs` + `slo.mjs` — Single Logout.
5. `assets/admin/saml-config.html` + `assets/admin/saml-config.js` — admin console SAML config UI.
6. Postgres migrations: `migrations/202606-saml-tables.sql`.
7. Tests: `tests/saml/*.test.mjs`.
8. Docs: `docs/saml-customer-setup.md` (customer-facing guide for IdP configuration).

## Time estimate

- Library setup + base routes: 2 days.
- Database migrations + JIT logic: 1 day.
- Admin console config UI: 2 days.
- Testing (Okta + Entra + Google): 2 days.
- Documentation: 1 day.

**Total:** ~8 days of Claude Code engineering.

## Approval gates

- Spec review by Ahmad before build start: required.
- Netlify preview deploy + test sign-in: required before production.
- Penetration test of SAML endpoints: before first paying customer.
- Public announcement: after first successful customer integration.

## Related

- `aria-architecture/scim-spec.md` (to be drafted next — SCIM provisioning).
- `aria-architecture/2M-ASSET-REQUIREMENTS.md` Section 2.2.
- `senior-director-state/loop-engineer/claude-code-next-prompt.md` PACKET C.
