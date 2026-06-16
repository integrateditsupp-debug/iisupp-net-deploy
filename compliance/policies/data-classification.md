# Data Classification & Handling Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review cycle:** Annual

## Purpose

Classify data handled by Integrated IT Support Inc. by sensitivity and define handling requirements per class. Aligned with SOC 2 C1 (Confidentiality), NIST SP 800-60, ISO 27001 A.8.

## Classification tiers

### Public (P1)
- **Definition:** information intentionally made available to the public.
- **Examples:** marketing copy, blog posts, public KB articles, /privacy.html, /terms.html, /trust.html, open-source code (if any), product names, pricing on iisupp.net.
- **Handling:** no restriction. May be freely shared.

### Internal (I1)
- **Definition:** operational data not intended for public disclosure but not customer-confidential.
- **Examples:** internal documentation, agent coordination protocols (`docs/COLLAB_BRIEF.md`), system architecture diagrams (high level), aggregate (anonymized) usage statistics.
- **Handling:** access limited to personnel and sub-processors with business need. May be shared under NDA.
- **Storage:** repository (private GitHub repo).
- **Transmission:** standard TLS.

### Confidential (C1)
- **Definition:** customer data, credentials, secrets, PII, financial information, business confidential.
- **Examples:** customer query content, customer-uploaded KB, customer credentials, billing data, license tokens, API keys, sub-processor credentials, security incident details, customer contract terms.
- **Handling:** strictly controlled access. Need-to-know basis. Documented justification required.
- **Storage:** encrypted at rest (AES-256). Per-tenant isolation (planned Q3 2026).
- **Transmission:** TLS 1.2+ only. No plain-text email or chat.
- **Retention:** 30 days for conversation records; 90 days for logs; per legal/contractual requirements otherwise.
- **Disposal:** hard delete within 60 days of authorization (post-termination or per erasure request).

### Restricted (R1) — special category
- **Definition:** PHI under HIPAA, payment cardholder data (handled by Stripe — out of scope here).
- **Examples:** healthcare customer PHI processed under BAA.
- **Handling:** technical safeguards per BAA Section 6 + HIPAA Security Rule. No third-party LLM calls.
- **Storage:** encrypted at rest, customer choice of region.
- **Transmission:** TLS 1.2+; no transmission outside ARIA Provider infrastructure without explicit Customer authorization.
- **Retention:** per BAA + customer policy.
- **Disposal:** secure deletion verified.

## Data handling matrix

| Data type | Tier | At-rest encryption | In-transit encryption | Access | Retention | Logging |
|---|---|---|---|---|---|---|
| Marketing copy | P1 | N/A | TLS | Public | Indefinite | N/A |
| KB articles (curated) | P1 | At-rest | TLS | Public | Indefinite | Access logged |
| Internal docs | I1 | Encrypted | TLS | Personnel | Until obsolete | Access logged |
| Customer queries | C1 | AES-256 | TLS 1.2+ | Personnel + customer | 30 days | Full Aperture |
| Customer KB upload | C1 | AES-256 | TLS 1.2+ | Personnel + customer | Customer-controlled | Full Aperture |
| Billing data | C1 | AES-256 | TLS 1.2+ | Founder + Stripe | 7 years | Full audit |
| API keys / secrets | C1 | Encrypted | TLS / never plain | Founder only | Until rotated | Full audit |
| PHI (BAA customers) | R1 | AES-256 | TLS 1.2+ | Strict need-to-know | Per BAA | Full + customer review |
| Stripe cardholder | R1 | Stripe holds — out of scope | Stripe TLS | N/A | N/A | Stripe responsibility |

## Labeling

- Repository files marked confidential should not appear in public-readable paths.
- Sensitive output files in `outputs/` are not committed to git unless approved.
- Memory entries flag sensitive data per `auto memory` rules in claudeMd.

## Handling rules

### Storage
- C1 + R1 data only in approved systems:
  - DigitalOcean droplet (Toronto, AES-256 at rest).
  - Netlify Blobs (AES-256 at rest).
  - Stripe (their secure storage).
- Personal devices: prohibited for C1 + R1 unless full-disk encrypted, MFA-protected, MDM-enrolled.

### Transmission
- C1 + R1: TLS 1.2+ required.
- Email: avoid putting C1 + R1 in body. Reference via secure link.
- Chat (Slack, Teams, WhatsApp): no C1 + R1 unless via encrypted, audited channel.

### Sharing
- C1: under NDA + DPA only.
- R1 (PHI): under BAA only.
- Sub-processor sharing: only listed sub-processors per DPA Section 6.

### Disposal
- C1: secure deletion (cryptographic erasure for encrypted storage; overwrite for unencrypted).
- R1: per BAA + HIPAA Security Rule disposal requirements.
- Hardware: not applicable (cloud-only).

### Backup
- C1 + R1 backups: same encryption + access controls as primary.
- Backup retention: 90 days rolling.
- Restore tests: quarterly.

## Customer obligations

Customers handling their own data within ARIA agree (per MSA + DPA):
- Not to upload data beyond agreed scope (e.g., no PHI without BAA).
- To manage their own user-side access controls.
- To notify ARIA Provider of data subject requests promptly.

## Enforcement

- Violations escalated to CISO immediately.
- Sanctions may include access revocation, contract termination, legal action.

## Related documents

- `compliance/policies/encryption.md`
- `compliance/policies/access-control.md`
- `legal/DPA-template.md`
- `legal/BAA-template.md`
- `compliance/SOC2-controls-self-assessment.md` Section C1
