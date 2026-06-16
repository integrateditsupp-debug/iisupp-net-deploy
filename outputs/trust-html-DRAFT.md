# Trust Center Page — Draft for /trust.html

**Status:** DRAFT. Visual style mirrors existing /terms.html (no theme/font/color change). Ahmad approves before publish.

---

## Structure

```
<header>Trust Center</header>

SECTION 1 — Overview
SECTION 2 — Compliance status (SOC2, GDPR, PIPEDA, CCPA, HIPAA-ready)
SECTION 3 — Security controls (linked to SOC2 self-assess)
SECTION 4 — Sub-processors (every third-party that touches customer data)
SECTION 5 — Data flow diagram
SECTION 6 — Incident response & status
SECTION 7 — Request audit reports / DPA / BAA
```

---

## Section 1 — Overview

> Integrated IT Support Inc. operates ARIA — an AI-powered IT support assistant — for businesses, governments, and individuals across North America. We treat security, privacy, and uptime as product features, not afterthoughts. This page documents our security program, compliance posture, and the controls we have in place to protect customer data.

---

## Section 2 — Compliance status

| Framework | Status | Notes |
|---|---|---|
| SOC 2 Type I | Self-assessed (75% complete). Audit kickoff on first enterprise contract. | Public self-assessment available on request |
| SOC 2 Type II | Audit planned 2026-Q4 | Auditor selection in progress |
| PIPEDA (Canada) | Compliant | Privacy policy details data handling |
| GDPR (EU) | Compliant for ARIA data flows | DPA available on request |
| CCPA (California) | Compliant | Erasure within 30 days |
| HIPAA | BAA available | Healthcare customers only |
| ISO 27001 | Planned 2027 | After SOC 2 Type II close |

---

## Section 3 — Security controls (summary)

**Access:** Cloud-only infrastructure. PAT + SSH + OAuth for admin. Customer access via SSO (SAML/OIDC, coming Q3 2026). MFA required for admin.

**Encryption:** TLS 1.2+ in transit (HSTS preload). AES-256 at rest (Netlify Blobs + DigitalOcean managed Postgres).

**Logging:** All admin actions + ARIA query events logged to Aperture observability dashboard. Customer-scoped audit log on Mid-Size+ plans.

**Backups:** Git history = full code rollback. Atomic Netlify deploys (instant rollback to any previous deploy). Droplet daily snapshots.

**Vulnerability management:** GitHub Dependabot + npm audit. Annual self-pen-test (OWASP ZAP, Burp Community). External pen test pre-Type II audit.

**Data classification:** Three tiers — public (KB articles), internal (logs), confidential (customer queries + license tokens). Each handled per documented retention.

**Retention:** 30 days default for conversation records. Customer can request immediate erasure at any time.

---

## Section 4 — Sub-processors

The following third parties may process customer data while delivering ARIA. Each has a DPA on file.

| Sub-processor | Function | Data | Location | DPA |
|---|---|---|---|---|
| Netlify | Hosting + CDN + functions | Page requests, function payloads | US (multi-region) | Standard |
| DigitalOcean | Droplet hosting (ARIA brain) | KB queries, vector embeddings | Canada (Toronto) | Standard |
| Stripe | Payment processing | Billing data (no card storage on our side) | US | Standard |
| OpenAI | LLM (text-embedding-3-small only) | Query embeddings (no raw text persisted) | US | OpenAI DPA |
| Anthropic | LLM (Claude — chat reasoning) | Anonymized query patterns | US | Anthropic DPA |
| Resend | Transactional email | Customer email addresses | US | Standard |
| Google Workspace | Internal email | Internal communications | US/Canada | Workspace DPA |

We do not use third-party analytics that share PII. No customer data is sent to advertising platforms.

---

## Section 5 — Data flow diagram

```
[ Customer ]
    ↓ HTTPS (TLS 1.2+)
[ iisupp.net via Netlify CDN/edge ]
    ↓ Function call
[ Netlify Edge Function: aria.mts ]
    ├── (if Tier-1) → [ aria.iisupp.net DigitalOcean droplet → pgvector → response ]
    ├── (if Tier-2) → [ /assets/aria-kb-local-bundle.json (local fallback) ]
    └── Quota: per-license counter in Netlify Blobs
    ↓ Response
[ Customer ]

[ Aperture audit dashboard ] ← async log emission
[ Stripe webhook ] ← billing events only
[ Resend ] ← transactional email
```

No data crosses the customer ↔ ARIA boundary except the user's query text and ARIA's response. No tracking pixels. No third-party scripts on the chat UI.

---

## Section 6 — Incident response

**Detection:** Aperture observability dashboard + Netlify build alerts + Stripe webhook failures.

**Response:**
- P1 (data exposure): within 1 hour. Founder notified via WhatsApp + email.
- P2 (service degradation): within 4 hours.
- P3 (general): next business day.

**Disclosure to customers:** within 72 hours of confirmed data exposure (PIPEDA / GDPR requirement).

**Status page:** status.iisupp.net (coming Q3 2026). Until then, service health emails go to integrateditsupp@gmail.com / your account email.

---

## Section 7 — Request DPA, BAA, audit reports

**DPA:** Pre-signed template at `/legal/DPA-template.pdf` (coming with item #4). Counter-sign and return.

**BAA (HIPAA):** Available for Healthcare customers on Mid-Size+ plans. Email integrateditsupp@iisupp.net with subject "BAA Request — [Company]".

**SOC 2 self-assessment:** Available on request under NDA. Email "SOC 2 Self-Assessment Request — [Company]".

**Penetration test report:** Available on request under NDA. First report due 2026-Q3.

---

## Section 8 — Security contact

**Email:** security@iisupp.net (alias coming Q3 — until then use integrateditsupp@iisupp.net subject "Security")
**Phone:** (647) 581-3182 — Ahmad Wasee, Founder + Security Officer
**Bug bounty:** Coordinated disclosure welcomed. Email + 90-day responsible disclosure standard. No bounty program yet.

---

## Visual style

Use existing `/terms.html` CSS scaffold:
- Dark theme (#050505 bg, #c5a059 gold accents)
- Cinzel font for headings, Inter for body
- doc-wrap container
- callout boxes for emphasis
- mobile-responsive

No new colors, no new fonts. Inherits aria-core.css.

---

## Ship checklist

- [ ] Ahmad approves text
- [ ] Convert to HTML matching /terms.html scaffold
- [ ] Add nav link from footer
- [ ] Robots: noindex on first publish (internal review), then index after Ahmad reads live
- [ ] Verify no 404s on internal links
- [ ] Update Trust Center reference in SOC 2 self-assessment doc
