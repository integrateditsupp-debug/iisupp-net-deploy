# ARIA Sentinel — SOC 2 Type II Readiness Map

**Product:** ARIA Sentinel — privacy-first Electron desktop IT-support agent
**Vendor:** Integrated IT Support Inc. (IIS)
**Assessment date:** 2026-06-19
**Framework:** AICPA SOC 2 Trust Services Criteria (TSC 2017, including the 2022 revised points of focus)
**Assessment type:** Internal self-assessment / pre-audit readiness map (not an attestation)

## Scope

This map assesses the controls of the **ARIA Sentinel desktop agent** (Electron/Windows + macOS, content-blind local-first architecture) together with its **supporting Netlify serverless backend functions** (`aria-chat`, `aria-research`, `aria-recipes`, `aria-stop-codes`, `aria-kb-bundle`, `aria-recipe-feedback`, `aria-admin-auth`, `aria-self-heal-report`, `aria-sentinel-update-manifest`, `sentinel-binaries`). It covers the system boundary from the customer endpoint through the 6-host telemetry allowlist to the IIS-controlled Netlify backend and the customer-configured ServiceNow lane.

**Out of system boundary:** the customer's own Windows/macOS hosts and physical premises, the customer's ServiceNow tenant, and third-party SaaS the agent diagnoses (browsers, Microsoft 365). Endpoint physical and OS-level security is the customer's responsibility under a shared-responsibility model.

This is a self-assessment performed by the founder/operator. **No independent SOC 2 auditor has yet been engaged**, so nothing here constitutes a Type I or Type II report — it is the control inventory a service auditor would request when an audit window opens.

---

## How to read the status column

| Status | Meaning |
|--------|---------|
| **Mapped** | A concrete, testable control exists in product or process and substantially satisfies the criterion. |
| **Partial** | A control exists but is incomplete, undocumented, or not yet operating over a full audit period. |
| **Gap** | No control yet; remediation required before audit. |

A Type II audit tests controls *over a period* (typically 3–12 months). Several controls below are technically present today but are marked **Partial** because they have **no operating-effectiveness history** — that history only accrues once the audit window starts.

---

## CC1 — Control Environment

What SOC 2 expects: integrity/ethics, board oversight, organizational structure, commitment to competence, and accountability.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC1.1 | Commitment to integrity & ethical values | Privacy-first architecture is enforced *in code*, not policy: content-blind sanitization (`safety.mjs`, `redactPIIForClassificationOnly`), receiver-side rejection of any leaking report (`isHealReportSafe`, 422 on `aria-self-heal-report.js`). Documented "What To Avoid" governance rules. | **Partial** | Publish a signed Code of Conduct / Acceptable Use policy as a standalone artifact. |
| CC1.2 | Board / governance oversight | Single-founder operation; governance is exercised through the documented approval-gate model (Rule 6 hold gates, Ahmad sign-off for any external send/publish). | **Partial** | Formalize a lightweight governance charter or advisory review cadence; record decisions. |
| CC1.3 | Organizational structure & reporting lines | Documented agent/role hierarchy (Cowork, Codex, Claude Code agents) and escalation routing in `self-heal.mjs` (`escalationRoute`). | **Mapped** | — |
| CC1.4 | Commitment to competence | Test-gated engineering culture: 60 green test suites, `node --check` clean gate, every feature ships with a unit test + self-heal hook (RUN 15 directive). | **Mapped** | — |
| CC1.5 | Accountability (HR, background checks, discipline) | No formal HR program, background-check policy, or onboarding/offboarding control — single-founder ops. | **Gap** | Author HR security policy; even for solo ops, document a background-check attestation and a personnel-security policy for future hires/contractors. |

## CC2 — Communication & Information

What SOC 2 expects: quality information internally and externally, and communication of objectives and responsibilities.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC2.1 | Quality information for internal control | Content-blind `telemetry-event-v1` contract, 30-day local audit log with ISO-8601 timestamps, self-heal audit reports (`buildHealReport`, `summarizeAudit`). | **Mapped** | — |
| CC2.2 | Internal communication of objectives & responsibilities | RUN reports, `ENTERPRISE_READINESS.md`, `PRIVACY_AND_SECURITY.md`, in-repo COLLAB_BRIEF and loop board document objectives and ownership. | **Mapped** | — |
| CC2.3 | External communication (customers, privacy commitments) | `PRIVACY_AND_SECURITY.md` (public principle + outbound-path disclosure), in-product live network verifier (proves the 6-host allowlist to a buyer), RFP evidence pack (6 artifacts), public status page, security disclosure addendum. | **Mapped** | — |

## CC3 — Risk Assessment

What SOC 2 expects: specify objectives, identify and analyze risk, assess fraud risk, and evaluate change-related risk.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC3.1 | Specifies objectives clearly | Documented enterprise-readiness rating, roadmap to v1, explicit "what blocks launch" list. | **Mapped** | — |
| CC3.2 | Identifies & analyzes risk | Tiered recipe risk model (green/yellow/orange/red), content-leak fuzz CI (10K-input nightly), policy-injection + sanitizer fuzz gates. | **Mapped** | — |
| CC3.3 | Assesses fraud / abuse risk | License tamper-resistance (`license.mjs` HMAC + constant-time compare), admin-session HMAC with `timingSafeEqual`, autonomous-mode runtime brakes (3×/24h cap, 30-min cooldown, 5%-of-fleet rate-limit). | **Mapped** | — |
| CC3.4 | Assesses change-related risk | Staged rollout (10/50/100%), sha512-verified update manifests, restore-point before yellow actions. | **Mapped** | — |
| CC3.5 | Formal documented risk register | No standalone risk register with likelihood/impact scoring and owners. | **Gap** | Produce a formal risk register mapping each identified risk to a control and a review date. |

## CC4 — Monitoring Activities

What SOC 2 expects: ongoing and separate evaluations, and communication of deficiencies.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC4.1 | Ongoing & separate evaluations | **Self-heal engine** (`self-heal.mjs`): `auditFeatures` probes every feature each run, `runSelfHeal()` in `main.mjs` re-runs probes and auto-heals; in-product live network verifier; CI release gate. | **Mapped** | — |
| CC4.2 | Evaluates & communicates deficiencies | `summarizeAudit` flags deficiencies; `escalationRoute` routes code-fixes to a Claude Code agent and design-fixes to the Cowork agent via a content-blind `self-heal-report-v1` queued to the backend. | **Mapped** | — |
| CC4.3 | Independent monitoring of the control environment | Monitoring is self-operated; no independent/third-party monitoring or periodic management review sign-off. | **Partial** | Establish a recurring documented control-review (e.g., monthly) with retained sign-off evidence. |

## CC5 — Control Activities

What SOC 2 expects: select/develop control activities, technology general controls, and policy deployment.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC5.1 | Control activities that mitigate risk | Recipes are **allowlisted + dry-run-by-default**; destructive command families denylisted; yellow tier always requires explicit confirm regardless of mode; `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES` master gate. | **Mapped** | — |
| CC5.2 | General control activities over technology | 6-host telemetry allowlist with additive update/brain path lists (`network-capture.mjs`), HMAC license & admin sessions, sha512 manifest verification. | **Mapped** | — |
| CC5.3 | Deploys control activities through policies & procedures | Controls are enforced in code and tests; procedural policy documents (SDLC, access, IR) are partially documented in RUN reports but not consolidated as signed SOPs. | **Partial** | Consolidate code-enforced controls into a signed policy/SOP set referenced by the audit. |

## CC6 — Logical & Physical Access Controls

What SOC 2 expects: restrict logical/physical access, authentication, provisioning/deprovisioning, and protection of data at rest/in transit.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC6.1 | Logical access security (auth) | Two-layer admin gate: build flag (`IS_ADMIN_BUILD`; customer builds **exclude** admin-console from `build.files`) **plus** runtime HMAC admin session (`admin-gate.mjs`, `timingSafeEqual`, 24h expiry). Backend `aria-admin-auth` uses env-var creds with **bcrypt** password hash; denies if creds/bcrypt absent. | **Mapped** | — |
| CC6.2 | Registration / provisioning of access | Admin creds are env-var only (`ARIA_ADMIN_USERNAME` / `ARIA_ADMIN_PASSWORD_HASH`); no hardcoded creds; per-license device registry with idempotent check-in. | **Mapped** | — |
| CC6.3 | Role-based access / least privilege | Admin surface is wholly absent from customer builds (compile-time exclusion); ServiceNow routing is automatic and not user-editable. | **Mapped** | — |
| CC6.4 | Restrict physical access | Backend is Netlify-hosted (their physically-secured data centers, covered by Netlify's own SOC 2). Endpoint physical security is the customer's responsibility. | **Partial** | Obtain & file Netlify's SOC 2 report as a subservice-organization carve-out; document the shared-responsibility boundary in the customer agreement. |
| CC6.5 | Data disposal / de-provisioning | 30-day audit-log retention (rolling). Deprovisioning of admin access = env-var rotation. | **Partial** | Document a formal data-retention & secure-disposal procedure and an access-revocation runbook. |
| CC6.6 | Protect against external threats (boundary) | 6-host allowlist enforced + verifiable in-product; content-blind sanitization at every network boundary; loopback-only browser-signal lane (`127.0.0.1`, never iisupp.net). | **Mapped** | — |
| CC6.7 | Restrict transmission / movement of data | Raw signals reduced to symbolic signatures before storage *or* network; outbound bodies pass `assertContentSafePayload` or are rejected as `leak`. | **Mapped** | — |
| CC6.8 | Protect against malicious software | OTA updates are sha512-verified against a signed manifest with rollback; no third-party telemetry SDKs in runtime; zero new runtime deps policy. | **Partial** | Windows build is currently **unsigned** (triggers SmartScreen). Obtain an EV code-signing cert + Apple Developer ID. |

## CC7 — System Operations

What SOC 2 expects: detect/monitor anomalies, security incident response, evaluate events, and recovery.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC7.1 | Detect configuration & vulnerability anomalies | Self-heal probes detect dropped hotkeys/handlers/watchers; internet-down detection (2 consecutive fails → NET.DOWN); SBOM-lite + signed-bundle hash. | **Mapped** | — |
| CC7.2 | Monitor for anomalies / security events | Live network verifier classifies every outbound request (0 disallowed / 0 user-content on clean run); 30-day audit log; status page. | **Mapped** | — |
| CC7.3 | Evaluate security events | Self-heal escalation taxonomy (recoverable / needs-code-fix / needs-design-fix) with routing; content-leak fuzz alerts. | **Partial** | No documented severity classification or formal triage SLA for *security* incidents specifically. Author an incident-severity matrix. |
| CC7.4 | Respond to incidents (IR plan) | No formal, signed-off incident-response runbook (roles, comms, breach-notification timelines). | **Gap** | Author and sign an incident-response runbook including a 72-hour breach-notification path and customer comms template. |
| CC7.5 | Recovery from incidents | OTA rollback (per-license / bulk / all-machines, double-confirm + admin-token re-entry); restore-point before yellow actions; staged rollout limits blast radius. | **Mapped** | — |

## CC8 — Change Management

What SOC 2 expects: authorize, design, develop/acquire, configure, test, and approve changes.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC8.1 | Manage changes (authorize → test → deploy) | Test-gated SDLC (60 suites, `node --check`), CI release gate workflow, approval-gate holds (Rule 6) for customer-facing changes, sha512-verified staged-rollout deploys with rollback, restore-point before reversible system changes. | **Mapped** | — |
| CC8.1b | Segregation of duties in deploys | Build/verify (engineering agents) is separated from publish/ship (founder approval); functions committed local-only until Ahmad ships. | **Partial** | Single operator means SoD is procedural, not enforced; document the approval gate as a formal change-authorization control with retained evidence. |

## CC9 — Risk Mitigation

What SOC 2 expects: mitigate risk from business disruptions and manage vendor/business-partner risk.

| # | Point of focus | Mapped control / evidence | Status | Remediation |
|---|----------------|---------------------------|--------|-------------|
| CC9.1 | Mitigate disruptions (BCP/insurance) | OTA rollback + staged rollout + version-disable bound blast radius; license never hard-locks (falls back to free Manual mode, no lockout). | **Partial** | No formal business-continuity / disaster-recovery plan or cyber-insurance documented. Author a BCP/DR summary. |
| CC9.2 | Vendor & business-partner risk management | Minimal vendor surface by design: zero runtime third-party telemetry SDKs; sole documented runtime-dep exception (`electron-updater`) dynamically guarded; backend on Netlify; optional `bcryptjs` deploy-only. | **Partial** | Maintain a vendor inventory and collect subservice SOC 2 reports (Netlify, Stripe). Document a vendor-review cadence. |

---

## Additional (Category-Specific) Criteria — Scope Decisions

| Category | In / Out of scope | Rationale |
|----------|-------------------|-----------|
| **Security (Common Criteria)** | **In scope** | The default and primary category; assessed in full above (CC1–CC9). |
| **Confidentiality** | **In scope** | Core product promise. Content-blind sanitization, symbolic-only storage, 6-host allowlist, loopback-only browser lane, and content-blind report receivers directly support confidentiality (C1.1 information identified/protected; C1.2 disposal via 30-day retention). Strongly mapped; the data-retention/disposal SOP gap (CC6.5) carries over. |
| **Privacy** | **In scope (recommended)** | The product is marketed as privacy-first and processes signals derived from personal devices. AICPA Privacy criteria (notice, choice, collection, use/retention, disclosure) are well-supported by design (notice via PRIVACY_AND_SECURITY.md, choice via opt-in autonomous/notify, minimization via symbolic signatures). **Gap:** no formal published privacy notice/DPA. Recommend including once a DPA/EULA package exists. |
| **Availability** | **Out of scope (initial audit)** | No contractual uptime SLA is yet offered; the agent is local-first and degrades gracefully offline (local-KB fallback), so availability commitments are minimal. Bring in scope once an SLA is sold. |
| **Processing Integrity** | **Out of scope (initial audit)** | Sentinel performs diagnostics and reversible fixes, not transactional/financial processing. Dry-run-by-default + restore-points provide integrity safeguards, but there are no processing-completeness/accuracy commitments warranting the category. Revisit if billing/transactional features are added. |

---

## Readiness Scorecard

Counting the individual points of focus assessed above (CC1–CC9, 36 points):

| Status | Count |
|--------|-------|
| **Mapped** | 22 |
| **Partial** | 10 |
| **Gap** | 4 |
| **Total assessed** | 36 |

**Weighted readiness** (Mapped = 1.0, Partial = 0.5, Gap = 0):

`(22 × 1.0) + (10 × 0.5) + (4 × 0) = 27.0 / 36 = 75.0%`

**Strict readiness** (Mapped only): `22 / 36 = 61.1%`

> **Overall readiness: ~75% weighted (61% fully-mapped).** This exceeds the ≥70% weighted target. The engineering/technical control surface (CC4–CC8 logical access, monitoring, change, ops) is strong and largely **Mapped**; the gaps are predominantly **organizational/process artifacts** (policies, formal plans, third-party attestations) rather than missing technical controls — which is the expected and healthy profile for a single-founder product entering a SOC 2 program.

---

## Top 6 Gaps to Close Before a SOC 2 Type II Audit Window Opens

Prioritized by audit-blocking weight and effort-to-impact:

1. **Engage a SOC 2 auditor & define the audit window** *(blocks everything; no control history accrues until the window starts).* Select a CPA firm, scope Security + Confidentiality (+ Privacy), and set the observation period.
2. **Author & sign a formal incident-response runbook** *(CC7.4 Gap)* — roles, severity matrix, 72-hour breach-notification path, customer comms template. Highest-risk missing process control.
3. **Code-sign the builds** *(CC6.8 Partial → blocking for trust)* — obtain an EV Windows code-signing cert + Apple Developer ID so updates are OS-trust-verified, not just sha512-self-verified.
4. **Commission an independent penetration test / external security assessment** *(no third-party test yet)* — required evidence for CC6/CC7; covers the desktop agent + Netlify backend boundary.
5. **Produce the policy/governance artifact set** *(CC1.5, CC3.5, CC5.3, CC6.5 Gaps/Partials)* — HR/personnel-security policy + background-check attestation, formal risk register, consolidated SDLC/access/data-retention SOPs, and a governance charter.
6. **File subservice-organization SOC 2 reports & a DPA/EULA/privacy notice** *(CC6.4, CC9.2, Privacy)* — collect Netlify's and Stripe's SOC 2 reports as carve-outs, document the shared-responsibility boundary (endpoint physical security is the customer's), and publish a DPA + privacy notice + BCP/DR summary.
