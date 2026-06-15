# ARIA Knowledge Base

Enterprise-grade structured KB library for ARIA AI Assistant.
Designed for AI orchestration, semantic retrieval, and human readability.

## Structure

```
knowledge-base/
├── _meta/                  Schema, template, indexes, manifest
│   ├── _schema.md          KB article schema (every field defined)
│   ├── _template.md        Blank template — copy when authoring new articles
│   ├── manifest.json       Machine-readable catalog of every article
│   ├── routing.md          Triage rules — symptoms → article IDs
│   ├── escalation-matrix.md  When to bump L1→L2→L3 / human technician
│   └── index-by-keyword.md Keyword → article ID lookup
│
├── L1/                     Tier-1: end-user-facing, no admin rights required
│   └── (Windows, Outlook, M365, Teams, OneDrive, Wi-Fi, printers,
│        password resets, MFA basics, browser, email basics, slow PCs,
│        basic file recovery, drivers basics)
│
├── L2/                     Tier-2: admin/escalation engineer, tenant access
│   └── (VPN, Intune, Azure AD, Active Directory, DNS, DHCP, BitLocker,
│        drivers advanced, performance deep-dive, RDP, networking,
│        SharePoint admin, permissions, malware triage, endpoint config,
│        onboarding, device deployment)
│
├── L3/                     Tier-3: senior engineer / architect
│   └── (Servers, security architecture, SSO/SAML, certificates,
│        cloud services, enterprise infra, backup/DR, hybrid AD,
│        federation, network architecture, incident response)
│
└── general-assistant/      Non-IT user assistance — ARIA's broader value
    └── (Online shopping, product comparison, scam/phishing detection,
         safe checkout, vendor research, booking, form filling,
         senior-friendly support, simple-language explanation patterns)
```

## File naming

```
{level}-{category}-{NNN}-{slug}.md
```

Examples:
- `l1-windows-001-blue-screen-stop-error.md`
- `l2-azure-ad-014-conditional-access-block-loop.md`
- `l3-backup-dr-007-veeam-failover-orchestration.md`
- `ga-shopping-003-detect-fake-checkout-page.md`

## Article format

Every article follows the 15-field schema in `_meta/_schema.md`.
Each file has YAML frontmatter (machine-parseable) + Markdown body (human-readable).
This dual format lets ARIA's orchestrator retrieve by metadata while still
producing clean responses to end users.

## How ARIA uses this KB

1. **Intent classification** — incoming user query is classified and routed via `_meta/routing.md`.
2. **Retrieval** — orchestrator searches by `keywords`, `category`, and `support_level` from `manifest.json`.
3. **Response synthesis** — ARIA reads the matched article(s) and rewrites the relevant sections using the `user_friendly_explanation` field as the tone anchor.
4. **Escalation** — if the issue matches an `escalation_trigger`, ARIA flags for human handoff per `_meta/escalation-matrix.md`.

## Author guidelines

- **Use the schema.** Every field is mandatory — even if "N/A" — to keep retrieval deterministic.
- **Symptoms first, theory last.** Users describe what they see, not what they think is wrong.
- **Never expose unsafe admin commands** to L1 readers. Gate destructive steps behind L2/L3.
- **Always include verification.** "It works" must be objectively testable.
- **Cite escalation triggers explicitly.** No silent assumptions.
- **Keep articles modular.** One symptom cluster per article. Cross-reference with `related_articles`.

## Versioning

This KB is the source of truth for ARIA's IT brain. Treat changes as you would
production code: peer-review article edits, bump the version field on substantive
revision, and let the manifest regenerate.

---

**Owner:** Integrated IT Support Inc.
**Product:** ARIA — Real-Time AI Assistant
**Last full build:** 2026-05-07
