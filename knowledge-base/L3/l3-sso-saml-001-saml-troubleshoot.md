---
id: l3-sso-saml-001
title: "SSO / SAML / OIDC: federation troubleshooting"
category: sso-saml
support_level: L3
severity: high
estimated_time_minutes: 60
audience: technician
prerequisites: ["IdP admin", "SP / app config access"]
os_scope: ["Multi-platform"]
keywords:
  - sso
  - saml
  - oidc
  - federation
  - identity provider
  - service provider
  - assertion
  - claims
  - jwt
  - okta
  - entra
  - certificate rollover
related_articles:
  - l2-azure-ad-001
  - l3-security-001
escalation_trigger: "Federation-wide outage, IdP cert compromise, SAML response replay attack"
last_updated: 2026-05-07
version: 1.0
---

# SSO / SAML / OIDC troubleshooting

## 1. Symptoms
- SAML "AssertionConsumerService URL mismatch".
- "Certificate validation failure" / cert expired in IdP.
- "Authentication succeeded but app says unauthorized".
- "Login loop" — IdP and SP redirect endlessly.
- Claims missing / wrong format.

## 2. Diagnostic
- Capture SAML / OIDC trace: SAML-tracer Firefox / Chrome ext, or browser DevTools network.
- Decode SAML assertion: Base64 → XML; or jwt.io for OIDC tokens.
- Verify timestamps (not before / not on or after).
- Verify signatures with IdP cert.
- Verify Audience / Issuer / Subject.

## 3. Common fixes
**ACS URL mismatch:**
- Update SP SAML config to exact ACS URL expected by IdP and vice-versa. Trailing slash matters.

**Cert expired:**
- IdP cert rollover: generate new cert at IdP, distribute via metadata.
- SP imports new cert from updated metadata URL.
- Coordinate cutover; some SPs support multiple sig certs.

**Claims wrong:**
- IdP attribute mapping: ensure correct user attribute → SAML claim name.
- For Entra, custom claims via Enterprise application → User attributes & claims.
- For OIDC, ensure scopes requested match what app expects.

**Subject NameID:**
- Format mismatch — most apps want `emailAddress` or `persistent`. Check SP requirements.

**Login loop:**
- Typically Audience / Issuer mismatch — check both configs.
- Or session cookie blocked / SameSite issue on browser.

## 4. Verification
- User signs in cleanly; SAML trace shows clean assertion.
- App receives expected claims.
- Certs valid + monitored for renewal.
- Failure rate <0.1% over 24h.

## 5. Escalation
- IdP outage → IdP vendor.
- App vendor non-compliance with SAML spec.
- Replay attack indicator → security incident.

## 6. Prevention
- Monitor cert expiry — 90/30/7 alerts.
- Use metadata URL not static cert (auto-pull for rollover).
- Maintain test users for each app.
- Inventory of all SAML/OIDC apps + integration owners.
- Document each app's claim mapping.

## 7. Notes
- SAML clock skew: IdP and SP clocks must be within 5 min.
- Encrypted assertions: require SP private key for decoding; harder to debug.
- Just-in-Time provisioning: ensure attributes present before user's first login.
- For Microsoft Entra: SAML for legacy SaaS, OIDC preferred for new.

## 8. Related Articles
- l2-azure-ad-001 — Conditional Access often gates SSO apps
- l3-security-001 — Replay / token theft

## 9. Keywords
sso, saml, oidc, federation, identity provider, service provider, assertion, claims, jwt, okta, entra, certificate rollover
