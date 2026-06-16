# Encryption Policy

**Owner:** Ahmad Wasee, CISO  |  **Version:** 1.0  |  **Effective:** 2026-06-15  |  **Review:** Annual

## Purpose

Define encryption standards for all Integrated IT Support Inc. data in transit, at rest, and in use. Aligned with SOC 2 CC6.7, NIST SP 800-175B, FIPS 140-2/3.

## Standards

### In transit
- **Minimum:** TLS 1.2.
- **Preferred:** TLS 1.3.
- **Cipher suites:** AEAD-only (AES-128-GCM, AES-256-GCM, ChaCha20-Poly1305). RC4, DES, 3DES, RSA key exchange, CBC modes — all DISABLED.
- **HSTS:** preload + 1-year max-age on all iisupp.net subdomains.
- **Certificate transparency:** monitored via Cloudflare CT logs.
- **Certificate rotation:** automatic via Netlify (Let's Encrypt 90-day cycle).

### At rest
- **Algorithm:** AES-256 (preferred AES-256-GCM with random IV).
- **Storage layer:** transparent encryption by managed providers (Netlify Blobs, DigitalOcean managed Postgres, Stripe).
- **Customer data:** AES-256-GCM with per-tenant data encryption keys (DEK) wrapped by key encryption keys (KEK) — planned Q3 2026 with multi-tenant rollout.
- **Backups:** same encryption as primary.
- **Secrets:** stored in Netlify environment variables (encrypted by Netlify) or per-tenant config table (AES-256 at column level with KMS-managed master key).

### In use
- Memory encryption: not enforceable in current cloud providers; mitigated via access controls + minimized data-in-memory windows.
- Customer-managed encryption keys (CMEK): Enterprise tier roadmap (Q4 2026).

## Key management

- **Master keys:** managed by Netlify + DigitalOcean (provider-managed; SOC 2 + ISO 27001 certified).
- **Per-tenant keys (planned):** wrapped by master KEK; rotated annually + on personnel change.
- **PAT / API tokens:** scoped to least privilege; documented at issuance; rotated annually or on suspicion of compromise.
- **SSH keys:** Ed25519 minimum; rotated annually.
- **Customer KMS integration (CMEK):** AWS KMS, Azure Key Vault, GCP KMS — Enterprise tier.

## Disposal

- **Cryptographic erasure:** for encrypted storage, deletion of encryption keys = effective data destruction.
- **Backup expiration:** rolling 90-day window; aged-out backups cryptographically erased.

## Exceptions

Documented exception required for any deviation; CISO approval; reviewed every 90 days.

## Related

- `compliance/policies/access-control.md`
- `compliance/policies/data-classification.md`
- `compliance/SOC2-controls-self-assessment.md` CC6.7
