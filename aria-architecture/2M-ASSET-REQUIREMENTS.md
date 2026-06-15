# ARIA $2M Asset Requirements — Master Reference

**Purpose:** The definitive "what we need to build" document so ARIA can charge $625K–$2M/yr per customer at the enterprise tier (Moveworks / Aisera / IBM watsonx Assistant comp band).

**Locked:** 2026-06-15 by Ahmad. Update only via versioned amendments.

**Constraint:** Zero new paid services for build. SOC 2 Type II audit ($15–40K) is the ONLY future hidden cost — triggered on first $625K+ contract signing.

**Companion files:**
- `outputs/ARIA-2M-READY-PLAN.md` — execution checklist (30 items, status tracker)
- `compliance/SOC2-controls-self-assessment.md` — current compliance posture
- `senior-director-state/loop-engineer/loop-board.md` — active loop status
- `docs/LOOP-ENGINEER.md` — how loops route work

---

## Section 1 — Market position at $2M

ARIA targets the **Custom AI Tier-1 Deflection** enterprise band. Comparable products at this price point:

| Vendor | Annual price | Anchor product |
|---|---|---|
| Moveworks | $500K–$2M | Enterprise IT/HR AI assistant |
| Aisera | $300K–$1.5M | AI service desk |
| Espressive Barista | $300K–$1M | Virtual support agent |
| ServiceNow Now Assist | $200K–$1M (add-on) | ITSM AI augmentation |
| IBM watsonx Assistant | $300K–$2M | Enterprise virtual agent |
| Forethought | $200K–$700K | AI deflection |
| DigitalGenius | $200K–$800K | AI customer support |

ARIA differentiator:
- **Voice-first + chat + multi-channel** (most competitors are chat-first).
- **Bit-native KB** (1,891 chunks → 93% per-query cost reduction vs typical RAG).
- **Symbolic operational state codes** (AROC pattern-first architecture — operational instinct after 3 hot fires, $0 LLM cost).
- **Phased response** (ask before dump — quality wins).
- **Live-fetch + bit-write self-improvement loop** (KB grows itself from real user gaps, zero LLM cost).

---

## Section 2 — Tier 1: Procurement unblockers (REQUIRED to enter RFP)

Every enterprise procurement team requires these before signing. Without them, no deal closes.

### 2.1 SOC 2

- **Type I attestation:** required to start RFP. Self-assessed today (75% coverage). External attestation pending auditor selection.
- **Type II report (12-month observation period):** required to close $625K+ deals. Audit kickoff on first signed enterprise contract.
- **Mapping document:** `compliance/SOC2-controls-self-assessment.md` (shipped 2026-06-15).
- **Cost line:** $15–40K audit fee, $3–8K/yr ongoing maintenance.
- **Owner:** Ahmad signs MSA with auditor. Cowork prepares all collateral.

### 2.2 Authentication & user lifecycle

- **SAML SSO (SP- and IdP-initiated)** for Entra, Okta, Google Workspace, Ping, OneLogin, Auth0.
- **OIDC** as fallback for newer IdPs.
- **SCIM 2.0 provisioning** for automated user lifecycle (create, update, deprovision).
- **Just-In-Time (JIT) provisioning** for IdPs without SCIM.
- **Session management:** configurable timeout, forced reauth, idle lockout per customer policy.
- **MFA enforcement:** customer policy-driven; respect IdP MFA where present.
- **Owner:** Codex/Claude Code build per spec.

### 2.3 Compliance frameworks (beyond SOC 2)

| Framework | Required by | Status |
|---|---|---|
| GDPR (EU) | EU customers | DPA + privacy expansion needed |
| PIPEDA (Canada) | Canadian customers | Compliant; privacy policy aligned |
| CCPA + CPRA (California) | CA customers | Privacy expansion needed |
| HIPAA | Healthcare | BAA template + technical safeguards |
| ISO 27001 | International enterprise | Planned 2027 post-Type II |
| FedRAMP Moderate | US federal | $625K tier; massive effort, defer until specific gov deal |
| StateRAMP | US state gov | Lighter than FedRAMP; consider for Ontario gov contracts |
| CSA STAR (Level 1 self-assess) | Cloud-conscious enterprise | Free self-assessment; do alongside SOC 2 |

### 2.4 Legal artifacts

- **MSA (Master Services Agreement):** customer-facing master contract. Template required.
- **DPA (Data Processing Agreement):** required by GDPR + most enterprise procurement. Template required.
- **BAA (Business Associate Agreement):** required for any healthcare customer using ARIA with PHI. Template required.
- **SLA:** documented uptime + response time commitments (99.9% target).
- **Sub-processor list:** all third parties touching customer data; updated quarterly.
- **DPIA template:** Data Protection Impact Assessment template for customer compliance teams.
- **Owner:** Cowork drafts; Ahmad final review with optional lawyer pass.

### 2.5 Security policies (must be documented + reviewable)

12-policy bundle (templates from SANS Institute, all free):
1. Acceptable Use Policy (AUP)
2. Access Control Policy
3. Business Continuity & Disaster Recovery Plan
4. Change Management Policy
5. Data Classification & Handling Policy
6. Encryption Policy
7. Incident Response Plan
8. Password / Authentication Policy
9. Physical Security Policy (cloud-only caveat)
10. Risk Management Policy
11. Vendor Management Policy
12. Vulnerability Management Policy

### 2.6 Security testing

- **Annual penetration test:** Year 1 = self-conducted (OWASP ZAP + Burp Community + GitHub CodeQL + npm audit). Year 2+ = external pentest firm (~$5–15K).
- **Vulnerability scanning:** continuous via GitHub Dependabot + npm audit weekly.
- **Code scanning:** GitHub CodeQL on every PR.
- **Container scanning:** Trivy on droplet images (free).
- **DAST:** OWASP ZAP weekly against staging URL (free).

### 2.7 Procurement collateral kit

- Pre-filled SIG-Lite (Shared Assessments Standardized Information Gathering questionnaire)
- Pre-filled CAIQ-Lite (Cloud Security Alliance Consensus Assessments Initiative Questionnaire)
- Pre-filled VSAQ (Vendor Security Alliance Questionnaire)
- Security one-pager (PDF)
- Architecture diagram (PNG + editable)
- Data flow diagram
- ROI calculator (Excel/Sheets)
- Reference customer list (gated by NDA)
- Insurance certificate (Cyber Liability ≥$5M)

---

## Section 3 — Tier 2: Integration requirements (must connect to where IT lives)

### 3.1 ITSM connectors

- **ServiceNow** (mandatory — 60% of enterprise pipeline). Bidirectional ticket sync, incident, request, change, problem.
- **Jira Service Management** (Atlassian's ITSM).
- **Zendesk** (customer support angle).
- **Freshservice** (mid-market alternative to ServiceNow).
- **TopDesk, ManageEngine ServiceDesk Plus, Cherwell** — nice-to-have.

### 3.2 Collaboration channel integrations

- **Microsoft Teams app:** ARIA bot in Teams. Required for 70% of enterprises.
- **Slack app:** ARIA bot in Slack. Required for tech-forward customers.
- **Discord:** smaller market but free to build.
- **Email channel:** ARIA replies to support@customer.com via Netlify Forms + functions.
- **Phone / IVR:** future v2 (Twilio integration — paid surface).

### 3.3 Identity & directory connectors

- **Microsoft Entra ID (Azure AD)** — live user context, group membership.
- **Okta** — same.
- **Google Workspace** — same.
- **Active Directory on-prem** — via Entra Connect / AD FS bridge.
- **JumpCloud, OneLogin** — smaller market, build on demand.

### 3.4 Endpoint / MDM connectors (for tier-1 IT context)

- **Microsoft Intune** — device compliance state, enrolled-device list.
- **JAMF Pro** — Mac fleet management.
- **Kandji** — Mac alternative.
- **Workspace ONE / VMware Workspace** — legacy enterprise.

### 3.5 Knowledge sources

- **SharePoint** (M365) — pull customer documentation into customer-specific KB.
- **Confluence** — Atlassian docs.
- **Notion** — modern customer.
- **Google Drive** — Workspace customers.
- **Web URL ingest** — ARIA reads customer-owned URLs (their internal wiki).

### 3.6 Outbound webhooks

Standard event publishing for customer SIEM / observability:
- `aria.query.started`
- `aria.query.completed`
- `aria.escalated`
- `aria.kb.miss`
- `aria.live_fetch.hit`
- `aria.session.ended`

Customer subscribes to whichever events feed their tooling (Splunk, Datadog, Sentry, PagerDuty).

### 3.7 Single sign-on standards reference

| Standard | Status |
|---|---|
| SAML 2.0 | Required |
| OIDC | Required |
| OAuth 2.0 (for app-level) | Required |
| WS-Federation | Optional (legacy) |
| Kerberos / NTLM | Not supported (cloud-only) |

---

## Section 4 — Tier 3: Multi-tenancy architecture

### 4.1 Data isolation

- **Per-tenant pgvector schema** on the droplet's Postgres. One schema per customer. Schema name = `t_<customer_uuid>`.
- **Per-tenant Netlify Blob namespace** for quota counters, session state, KB-live cache. Key prefix = `<customer_uuid>/`.
- **Per-tenant secrets / API keys** stored encrypted with customer-derived key (KEK / DEK pattern).
- **Cross-tenant query prevention:** middleware injects `WHERE tenant_id = $1` on every query; integration tests verify isolation.
- **Backup isolation:** per-tenant restore without affecting others.

### 4.2 Customer-specific KB

- **Customer KB upload UI:** admin uploads markdown, PDF, DOCX. ARIA ingests + embeds.
- **KB priority order:** customer-KB → global-KB → research agent live-fetch.
- **KB versioning:** customer can revert KB to prior version. Diff view.
- **KB review queue:** customer admin approves auto-generated KBs before they go live.

### 4.3 Data residency

- **Canada-only:** droplet in Toronto. Required for Canadian gov + healthcare.
- **US-only:** US droplet (future provisioning).
- **EU-only:** Frankfurt or Dublin droplet (future, $60/mo).
- **Customer choice at signup.** Cannot move tenant region post-signup without explicit migration project.

### 4.4 Tenant lifecycle

- **Provisioning:** automated within 24 hours of contract execution. Self-service from admin console.
- **Suspension:** read-only mode (for non-payment, security incident). Data retained 90 days.
- **Offboarding:** customer data export (JSON + Markdown) within 30 days of termination. Hard delete within 60 days.

---

## Section 5 — Tier 4: Enterprise UX

### 5.1 Admin console

Customer-facing admin web app at `https://<subdomain>.iisupp.net/admin` (white-labelable).

Required panels:
- **Users:** list, invite, role assignment, suspend, delete.
- **KB:** upload, edit, version history, approve auto-generated entries.
- **Analytics:** deflection rate, top topics, escalation reasons, CSAT, monthly query burn.
- **Billing:** current plan, query usage, top-up purchase, invoice history.
- **Audit log:** all admin actions, exportable to SIEM.
- **Branding:** logo, colors, name, custom domain.
- **Integrations:** ServiceNow, Teams, Slack, etc. setup wizards.
- **Compliance:** download DPA, SOC 2 report (gated), sub-processor list.
- **Settings:** session timeout, MFA enforcement, data residency, retention period.

### 5.2 RBAC matrix

| Role | Users | KB | Analytics | Billing | Audit | Branding | Integrations |
|---|---|---|---|---|---|---|---|
| Owner | Full | Full | Full | Full | Full | Full | Full |
| Admin | Full | Full | Full | View | View | Full | Full |
| Supervisor | View | Edit | Full | None | View own | None | None |
| Agent | None | View | View own | None | None | None | None |
| Viewer | None | View | View | None | None | None | None |
| API | Custom scopes | — | — | — | — | — | — |

### 5.3 Analytics dashboard

- **Deflection rate** (queries resolved without human): real-time + 30/90/365 day windows.
- **Top topics:** word-cloud + ranked list of queried operational states.
- **Escalation reasons:** breakdown of why ARIA handed off to human.
- **CSAT proxy:** thumbs-up/down rate on responses.
- **Query burn:** monthly query count vs plan quota; trend line.
- **Coverage gap:** which KBs are missing based on live-fetch frequency.
- **Time savings estimate:** queries × avg-tier-1-cost ($25/ticket benchmark) → dollars saved.

### 5.4 White-label

- **CSS custom properties** for brand colors (`--aria-primary`, `--aria-accent`, `--aria-text`, `--aria-bg`).
- **Logo URL** per tenant (rendered top-left).
- **Custom domain** per tenant (e.g., `support.customer.com`).
- **Email sender** per tenant (e.g., `aria@customer.com`).
- **No iisupp.net branding** on customer-facing UI in white-label mode.

### 5.5 Internationalization

- **Languages at $625K tier:** EN, ES, FR, DE, PT, IT, JA, ZH-CN, ZH-TW, KO, AR.
- **Translation pipeline:** UI strings in i18n JSON. KB articles translated per-tenant on demand.
- **RTL support** for Arabic + Hebrew.
- **Date / number / currency localization.**

### 5.6 Accessibility

- **WCAG 2.1 AA** for all customer-facing UI.
- **Screen reader compatible.**
- **Keyboard-only navigation.**
- **Contrast ratio ≥ 4.5:1.**
- **Captions for any audio output (voice mode).**

---

## Section 6 — Tier 5: GTM credibility (sales enablement)

### 6.1 Reference customers

- **3 named enterprise references** for procurement to call.
- **Case study pack:** 1-page PDF per reference with metrics (deflection rate, time saved, ROI).
- **NDA-gated detailed case study** with full architecture + integration story.

### 6.2 Analyst recognition

- **Gartner briefing** (free for vendors): submit ARIA for inclusion in Magic Quadrant / Market Guide for AI in IT Service Management.
- **Forrester briefing** (free): same.
- **IDC analyst briefing** (free).
- **G2 / Capterra / TrustRadius profiles** with verified customer reviews.

### 6.3 Public credibility signals

- **SOC 2 logo** on iisupp.net (post-audit).
- **AICPA SOC 2 mark** licensed for use.
- **ISO 27001 logo** (post-cert).
- **Compliance badges** for GDPR / HIPAA / PIPEDA / CCPA.
- **Cyber insurance certificate** on Trust Center.

### 6.4 Sales engineering capacity

- **Standardized demo environment** (`demo.iisupp.net`) — fully populated KB + scripted scenarios.
- **POC sandbox provisioning** in <24 hours per RFP.
- **Sales engineering deck** with talk track.
- **Objection handling matrix.**
- **Competitive battlecards** (Moveworks, Aisera, Espressive, IBM watsonx, ServiceNow Now Assist).

### 6.5 Support tiers

- **Mid-Size ($312K/yr):** 24/5 support, named CSM, monthly QBR.
- **Enterprise ($625K/yr):** 24/7 support, dedicated CSM + TAM, weekly QBR for first 90 days.
- **Custom (>$1M):** on-prem deployment support, joint solution architects.

### 6.6 Pilot offer (early)

- **3-month pilot at $50K** with conversion to $156K SBA tier on success.
- **Success criteria documented** upfront: deflection rate target, CSAT target, time-to-value.
- **Case study commitment** in exchange for discounted pilot.

---

## Section 7 — Reliability commitments at $2M tier

### 7.1 SLA targets

| Metric | Mid-Size ($312K) | Enterprise ($625K) | Custom (>$1M) |
|---|---|---|---|
| Uptime | 99.9% | 99.95% | 99.99% (with multi-region) |
| Response time p95 | 3 sec | 1.5 sec | 1 sec |
| P1 incident response | 30 min | 15 min | 5 min |
| P1 incident resolution target | 4 hr | 2 hr | 1 hr |
| Scheduled maintenance window | Off-peak only | Off-peak only | Customer-coordinated |

### 7.2 Multi-region architecture

For $625K+ tier:
- **Active-passive failover** between Toronto + (US or EU) droplets.
- **DNS-based failover** via Cloudflare (or Netlify Edge).
- **State replication** via Postgres logical replication or Aurora-style.
- **RPO:** ≤ 5 minutes. **RTO:** ≤ 15 minutes.

### 7.3 Observability stack

- **APM:** Aperture (in-house) + optional Datadog / New Relic export.
- **Logging:** Aperture audit log → optional customer SIEM (Splunk, Sumo Logic, Elastic, Sentinel).
- **Metrics:** Prometheus-format export.
- **Alerting:** PagerDuty / Opsgenie integration via webhooks.
- **Status page:** `status.iisupp.net` (statusgator or self-hosted Cachet).

### 7.4 Incident management

- **Runbook per incident class:** brownouts, full outages, data breaches, sub-processor outages.
- **Tabletop exercise quarterly.**
- **Post-incident reviews (PIR)** within 5 business days; shared with customers.
- **Status page updates within 15 min** of incident detection.

---

## Section 8 — Pricing rationalization

| Plan | Annual | Per-query | Quota | Justifies via |
|---|---|---|---|---|
| Personal | $7,188 ($599/mo) | $1.20 | 500 | Personal subscriptions, voice + chat |
| Pro | $18,000 ($1,500/mo) | $0.75 | 2,000 | Small business owners, attorneys, consultants |
| Small Business | $156,000 | $0.52 | 25,000 | 50–200 employee company |
| Mid-Size | $312,000 | $0.26 | 100,000 | 200–1,000 employee company |
| Enterprise | $625,000 | $0.10 | 500,000 | 1,000–10,000 employee company |
| Custom (TBD) | $1M–$2M | $0.05–$0.02 | Unmetered | F500, gov, multi-tenant rollout |

Cost-justified per ticket: industry average human-handled tier-1 ticket = $25–$35. ARIA at Enterprise tier = $0.10/query → 250× cost reduction. Customer ROI obvious.

---

## Section 9 — Roadmap milestones

| Milestone | Trigger | Outputs |
|---|---|---|
| **M0 (today):** Self-assessment + Trust Center | 2026-06-15 | SOC 2 self-assess, Trust Center draft |
| **M1:** Procurement-ready (Tier 1) | +30 days | 12 policies, DPA, MSA, BAA, SIG/CAIQ, pen test |
| **M2:** Connectivity-ready (Tier 2) | +60 days | SAML/SCIM, ServiceNow, Teams, Slack |
| **M3:** Multi-tenant + admin console (Tier 3+4) | +90 days | Per-tenant pgvector, admin UI, RBAC |
| **M4:** First pilot signed | +120 days | $50K pilot live, case study in progress |
| **M5:** SOC 2 Type II audit start | +180 days (or first $625K deal) | Auditor selected, contracts signed |
| **M6:** SOC 2 Type II report issued | +540 days | Public SOC 2 logo, gated full report |
| **M7:** First $625K+ enterprise deal closed | TBD | F500 logo, case study |
| **M8:** First $1M+ deal closed | TBD | Procurement-mature; FedRAMP planning |

---

## Section 10 — Stop-rules + ownership

### What requires Ahmad approval (cannot proceed without):
- Any code touching production routes (`aria.mts`, `aria-core.js`, `aria.html`, `index.html`, `aria-core.css`, `governance/*`, `netlify.toml`).
- Any legal text going live (DPA, MSA, BAA, privacy policy edits, Trust Center publish).
- Any pricing public change.
- Any new sub-processor added.
- Any external send (email campaign, RFP submission, contract signing).
- Any spend > $0 not pre-approved.
- Any public claim of compliance (cannot say "SOC 2 certified" until audit issued).

### What proceeds autonomously (per loop-engineer + spending rules):
- Drafting any document to `outputs/` or `aria-architecture/` or `compliance/`.
- Writing specs that Claude Code / Codex will implement.
- KB authoring + bundle rebuilds + pushes.
- Memory updates.
- Loop critiques in `senior-director-state/loop-engineer/`.
- Pre-fill of procurement collateral (SIG / CAIQ / etc.).

### Routing per loop-engineer (since Codex is offline 2026-06-15 onward until further notice):
- Code work → Claude Code via packet handoff in `senior-director-state/loop-engineer/claude-code-next-prompt.md`.
- Docs/spec/legal/KB work → Cowork (here).
- Strategy critique → Cowork.

---

## Section 11 — Carry-forward law (binding)

Every Cowork session opens with:
1. Read `senior-director-state/loop-engineer/loop-board.md`.
2. Read this file (`aria-architecture/2M-ASSET-REQUIREMENTS.md`).
3. Read `outputs/ARIA-2M-READY-PLAN.md` for the next "queued" item.
4. Execute → push → mark done.

If a packet requires Claude Code:
1. Write the spec to `aria-architecture/<topic>-spec.md`.
2. Write packet to `senior-director-state/loop-engineer/claude-code-next-prompt.md`.
3. Push so Claude Code's next session sees it.
4. Mark item "awaiting Claude Code" in the plan tracker.

If Ahmad approval is needed:
1. Output draft to `outputs/` with `-DRAFT.md` suffix.
2. Note in CEO brief: "needs your read before publish."
3. Do NOT push the live version to production paths until approval.

---

## Section 12 — Amendment history

| Date | Amendment | Author |
|---|---|---|
| 2026-06-15 | v1.0 created. 30-item plan locked. Codex offline → Claude Code routing. | Cowork (kb-agent) |
