# Password / Authentication Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual

## Purpose

Establish authentication standards aligned with NIST SP 800-63B (Digital Identity Guidelines, 2017 revision).

## Standards

### Password requirements (where passwords are used)
- **Minimum length:** 12 characters.
- **Maximum length:** 64 characters minimum allowed.
- **Composition:** allow all printable Unicode; reject if matches common-password lists (top 100,000 from breach corpora).
- **No forced periodic expiration** (per NIST 2017 — periodic resets reduce security in practice).
- **Forced reset triggers:** breach indicator, personnel suspicion, credential exposure, time-since-last-MFA-fail threshold.
- **Storage:** salted + hashed with Argon2id (memory cost ≥ 64 MiB, time cost ≥ 3) or bcrypt (cost ≥ 12).

### Multi-factor authentication (MFA)
- **REQUIRED** for all administrative access:
  - GitHub (Cowork PAT + repo admin).
  - Netlify project owner.
  - DigitalOcean account.
  - Stripe dashboard.
  - Resend dashboard.
  - Google Workspace admin.
- **REQUIRED** for customer admin access at Mid-Size+ tier (enforced via IdP).
- **Accepted factors:** TOTP (authenticator apps), FIDO2/WebAuthn (security keys, passkeys), push notification (Microsoft Authenticator, Duo, Okta Verify).
- **SMS:** discouraged but accepted as backup; not primary.

### Session management
- **Idle timeout:** 30 minutes default; configurable to 5–480 min per tenant policy.
- **Absolute timeout:** 8 hours default; reauth required.
- **Session token:** HttpOnly, Secure, SameSite=Lax cookie. JWT optional with 15-min access token + refresh token rotation.
- **Concurrent sessions:** allowed; tenant admin can configure limit.

### Account lockout
- **Threshold:** 5 failed sign-in attempts within 15 minutes.
- **Lockout duration:** 15-minute auto-unlock.
- **Permanent lockout:** after 20 consecutive failures within 24 hours → admin intervention required.
- **Notification:** user + admin notified on lockout.

### Service accounts / API keys
- Scoped to least privilege.
- Rotated annually or on compromise indicator.
- Documented at issuance with: owner, purpose, scope, expiration.
- Never committed to git or transmitted via insecure channels.

### Password recovery
- Email-based reset link (single-use, 1-hour expiry).
- MFA required if previously enabled.
- Password reset events logged to Aperture.

## Customer-facing requirements

Customer admin can configure (within bounds):
- Minimum password length (12–64).
- MFA enforcement (always / first-sign-in-only / per-tenant policy).
- Session lifetime.
- Lockout threshold.
- SSO-only (no local passwords) — recommended at Mid-Size+ tier.

## Related

- `compliance/policies/access-control.md`
- `compliance/SOC2-controls-self-assessment.md` CC6.1
- `aria-architecture/saml-sso-spec.md`
