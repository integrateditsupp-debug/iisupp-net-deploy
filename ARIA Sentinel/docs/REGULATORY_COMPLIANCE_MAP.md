# Regulatory Compliance Map — ARIA Sentinel

**Product:** ARIA Sentinel — privacy-first Electron desktop IT-support agent
**Vendor:** Integrated IT Support Inc. (IIS), incorporated in Ontario, Canada
**Document date:** 2026-06-19
**Build basis:** Enterprise Readiness audit (RUN 15) — content-blind, local-first MVP; functions committed local only, nothing published
**Scope:** This map covers the ARIA Sentinel desktop client and its declared backend egress (the 6-host allowlist + the two additive update paths and two additive ARIA-brain paths). It does not cover IIS's separate marketing website or unrelated services.

> **How to read status:** *Compliant* = the regime's obligations are met by current architecture. *Compliant-with-conditions* = met in design, contingent on a named operational item (hosting region, published policy, appointed contact). *Gap + remediation* = a real shortfall with the fix named.

---

## Architecture facts this map relies on

These are the load-bearing technical facts; every table below maps to them rather than to marketing claims.

| Fact | Where it lives | Why it matters for compliance |
| --- | --- | --- |
| **Content-blind sanitization** — raw signals are reduced to symbolic signatures (e.g. `BROWSER.CACHE.STALE`, `BSOD.PAGE_FAULT_IN_NONPAGED_AREA`) before any storage or network egress. | `src/shared/safety.mjs` (`sanitizeToSignature`, `contentSafeContext`, `redactPIIForClassificationOnly`, `assertContentSafePayload`) | Personal information is largely never collected, not merely protected after collection — the strongest form of data minimization. |
| **Local-first processing** — browser/system signals are processed on-device and posted to `127.0.0.1`, not the cloud. | Enterprise Readiness audit ("browser signals go to `127.0.0.1`, not to iisupp.net") | Limits collection at source; keeps EU/CA personal data on the data subject's own machine. |
| **6-host egress allowlist** — the binary may only reach `iisupp.net`, `download.iisupp.net`, loopback (`127.0.0.1` / `localhost` / `::1`), and `*.service-now.com`. | `src/shared/network-capture.mjs` (`CAPTURE_HOST_ALLOWLIST`, `hostAllowed`, `classifyRequest`, `summarizeCapture`) | Bounds where any data can go; in-product verifier proves 0 disallowed hosts / 0 user-content payloads. |
| **Egress is opaque telemetry handles + pulls** — GET pulls (recipes, stop-codes, KB bundle), opt-in outcome-only POST (`{recipe_id, outcome, ts}`), license check-in, OTA update (manifest + binary prefix), and the two ARIA-brain paths. | `src/shared/recipes.mjs`, `UPDATE_OUTBOUND_PATHS`, `BRAIN_OUTBOUND_PATHS` | No PII in payloads; `assertContentSafePayload` rejects email/URL/path/card/SSN/SIN-shaped strings. |
| **HMAC license** — stateless, tamper-proof trial/license token; device check-in is idempotent. | RUN 10 / RUN 14 (license registry, device check-in) | License is an opaque handle, not a PII record. |
| **User-exportable audit log** — CSV + a zero-dependency PDF of local transparency events. | RUN 8 (human-readable audit export) | Satisfies access/portability rights directly in-product. |
| **Uninstall removes the local data dir** — local KB / audit / state are removed on uninstall. | Product behaviour (local data directory) | Satisfies erasure for on-device personal data. |
| **Email only on explicit user action** — license magic-link is the in-product email path; no marketing automation in-product. (The weekly digest email is an opt-in admin/operator feature, content-blind.) | RUN 6 (opt-in digest), license magic-link | Keeps email squarely transactional/solicited for CASL. |

---

## 1. PIPEDA (Canada — *Personal Information Protection and Electronic Documents Act*)

As an Ontario private-sector company handling personal information in the course of commercial activity, IIS is subject to PIPEDA (Ontario has no substituted private-sector law). The 10 Schedule 1 fair information principles are mapped below.

| # | Principle | ARIA Sentinel implementation | Assessment |
| --- | --- | --- | --- |
| 1 | **Accountability** | IIS is the responsible organization; this map + `docs/PRIVACY_AND_SECURITY.md` document the program. A named privacy contact must be published (see Conditions). | Compliant-with-conditions |
| 2 | **Identifying purposes** | Purposes are narrow and stated in `PRIVACY_AND_SECURITY.md`: local IT diagnosis/repair, opt-in outcome feedback, licensing, updates, and (RUN 15) ARIA-brain support chat. Each outbound path declares a `purpose`/`direction` in `recipes.mjs`. | Compliant |
| 3 | **Consent** | Install is the consent for local diagnosis; **autonomous fixes require an explicit opt-in modal (cannot enable silently)**; recipe-feedback POST is opt-in; ServiceNow egress is customer-configured + confirmed; the digest email is opt-in. License email is user-initiated. | Compliant |
| 4 | **Limiting collection** | **On-device processing + content-blind sanitization** mean raw personal content is collapsed to symbolic codes/enums before any boundary; `127.0.0.1` keeps signals local. This is collection limitation by architecture. | Compliant |
| 5 | **Limiting use, disclosure & retention** | Egress is bounded by the 6-host allowlist; payloads are content-blind handles only (`assertContentSafePayload` blocks leaks). Local retention is user-controlled and **wiped on uninstall**. No third-party disclosure beyond the customer's own ServiceNow instance. | Compliant |
| 6 | **Accuracy** | Symbolic signatures carry a confidence score; the user/operator confirms yellow+ actions, so the human is the accuracy check before any change. No long-lived PII profile is built that could drift. | Compliant |
| 7 | **Safeguards** | Local-first reduces attack surface; HMAC license + admin HMAC session + env-only admin creds; 6-host verifier; dry-run-by-default command execution; allowlisted reversible recipes. **Encrypted-at-rest local KB (SQLite) is still pending** (Enterprise Readiness "what blocks" list). | Compliant-with-conditions |
| 8 | **Openness** | `PRIVACY_AND_SECURITY.md` + in-product Privacy tab + RFP evidence pack make the data boundary inspectable. A **public privacy policy URL** should be published for external openness. | Compliant-with-conditions |
| 9 | **Individual access** | User can export the full audit log (CSV/PDF) of local transparency events directly in-product; because little/no PII leaves the device, the on-device record is the access record. | Compliant |
| 10 | **Challenging compliance** | Requires a published complaint/contact channel and the named privacy contact (see Conditions). | Compliant-with-conditions |

**Overall — PIPEDA: Compliant-with-conditions.** Architecture satisfies all 10 principles; the conditions are operational (publish a privacy policy + privacy contact + complaint route) and the at-rest encryption hardening already on the do-buy list.

---

## 2. GDPR (EU — Regulation 2016/679)

GDPR applies only if IIS offers ARIA Sentinel to data subjects in the EU. Where it does, IIS is typically a **processor** acting on the deploying customer's (controller's) instructions for any incidental personal data, and a controller for licensing/account data.

| Article / topic | Requirement | ARIA Sentinel implementation | Assessment |
| --- | --- | --- | --- |
| **Art. 6** — Lawful basis | A valid basis per processing purpose. | Licensing/support contract = *performance of a contract* (Art. 6(1)(b)); opt-in feedback/digest = *consent* (Art. 6(1)(a)); on-device diagnosis carries minimal/no personal data. | Compliant |
| **Art. 5** — Principles incl. data minimization & storage limitation | Minimize, purpose-limit, store no longer than necessary. | Content-blind sanitization + local-first = minimization by design; uninstall wipe = storage limitation. | Compliant |
| **Art. 15 / Art. 20** — Right of access & data portability | Provide a copy / machine-readable export. | In-product audit export (CSV = portable, PDF = human-readable). Little PII exists off-device to begin with. | Compliant |
| **Art. 17** — Right to erasure | Erase on request. | **Uninstall removes the local data directory**; no durable off-device PII store to purge. | Compliant |
| **Art. 28** — Processor obligations | Written controller–processor contract; only process on instructions; sub-processor terms; assist with rights. | **A DPA template must be issued and executed** with each EU customer (flagged in Enterprise Readiness: "No legal DPA/EULA/SLA package attached"). Architecture already supports the substantive obligations. | Gap + remediation: publish + execute the DPA template (and EULA/SLA) before EU sale. |
| **Art. 30** — Records of processing | Maintain a processing record. | This map + `PRIVACY_AND_SECURITY.md` + the per-path `purpose`/`direction` declarations in `recipes.mjs` form the basis of an Art. 30 record; **formalize as a standalone RoPA**. | Compliant-with-conditions |
| **Ch. V** — International transfers | Lawful transfer mechanism if EU personal data leaves the EEA. | EU customer **content stays on-device** (no transfer). However, the Netlify backend functions (license/recipes/KB/update/brain) may be **US-hosted**; any incidental personal data in those calls would be a transfer needing SCCs/region pinning. Payloads are content-blind, which sharply lowers but does not formally eliminate the question. | Compliant-with-conditions: confirm Netlify region; add SCCs / EU region pinning if any EU personal data could touch the functions. |
| **Art. 37** — DPO appointment | Required only for large-scale special-category or systematic-monitoring core activity. | ARIA Sentinel collects content-blind symbolic data, not special categories, and is not large-scale systematic monitoring of individuals — **a DPO is likely NOT triggered**. Document the assessment; revisit if the customer base scales into systematic monitoring. | Compliant (DPO not required) — document the negative assessment. |

**Overall — GDPR: Compliant-with-conditions.** Core data-subject rights are met by architecture; the binding conditions are the executed **DPA/EULA/SLA package** (currently a gap) and **confirming the backend hosting region** for transfer posture.

---

## 3. CCPA / CPRA (California)

CCPA/CPRA applies to a "business" meeting thresholds (≥ US$25M gross revenue; OR buys/sells/shares the personal information of ≥ 100,000 consumers/households; OR derives ≥ 50% of revenue from selling/sharing PI).

| Topic | Requirement | ARIA Sentinel implementation | Assessment |
| --- | --- | --- | --- |
| **Threshold applicability** | Business must meet a threshold to be in scope. | ARIA Sentinel collects content-blind symbolic data and **does not sell/share** PI; IIS as an MVP-stage vendor **likely falls below the CCPA business thresholds**. Posture is documented regardless. | Likely out of scope — document the posture |
| **"Do not sell / do not share"** | Honor opt-out of sale/sharing; provide the link. | **N/A — no PII is collected, sold, or shared** (no cross-context behavioral advertising; egress is opaque handles). | Compliant (N/A) |
| **Right to know / access** | Disclose categories + specifics collected. | In-product audit export covers on-device records; categories disclosed in the privacy policy (to be published). | Compliant-with-conditions |
| **Right to delete** | Delete on verified request. | Uninstall wipes the local data dir; minimal/no off-device PII to delete. | Compliant |
| **Right to correct** | Correct inaccurate PI. | Little/no durable PII is held; symbolic signatures are regenerated each run, so there is no stale PII record to correct. | Compliant (effectively N/A) |
| **Notice at collection** | Inform consumers at/before collection. | Provided via install consent + privacy policy URL (to be published). | Compliant-with-conditions |

**Overall — CCPA/CPRA: Compliant (largely N/A / below threshold).** No sale/sharing and no PII collection neutralize the core obligations; remaining items (notice at collection, right-to-know disclosures) resolve when the public privacy policy is published.

---

## 4. CASL (Canada — *Canada's Anti-Spam Legislation*)

CASL governs **commercial electronic messages (CEMs)**: they require (a) consent (express or implied), (b) sender identification, and (c) a working unsubscribe mechanism.

| Requirement | ARIA Sentinel implementation | Assessment |
| --- | --- | --- |
| **Is any in-product email a CEM?** | The only in-product email is the **license magic-link**, sent **only on the user's explicit action** — it is transactional/solicited, not a CEM promoting participation in commercial activity. | Out of CASL's CEM scope (transactional) |
| **Consent for CEMs** | **No CEMs are sent from the product without express opt-in.** No marketing automation runs in-product. | Compliant |
| **Sender identification** | Transactional license emails identify IIS (sender, contact). | Compliant — verify the live template carries full identification |
| **Unsubscribe mechanism** | Required for CEMs; the license magic-link is transactional so a CEM unsubscribe is not triggered, but **any future opt-in marketing list must include a functioning unsubscribe**. | Compliant for current scope; conditional for any future marketing list |
| **Opt-in digest email (RUN 6)** | Operator/admin weekly digest is **opt-in** and content-blind (fixes, hours saved, escalations) — solicited by the operator who enabled it. | Compliant (opt-in) |

**Overall — CASL: Compliant.** In-product email is transactional and user-initiated; no unsolicited CEMs are sent. The sole forward-looking condition is that any future marketing list must carry express consent + identification + unsubscribe.

---

## Cross-cutting controls

These controls do the compliance work across all four regimes:

- **Content-blind sanitization** (`safety.mjs`): raw signals → symbolic signatures before storage or egress; `assertContentSafePayload` rejects email/URL/Windows-path/POSIX-path/payment-card/SSN/SIN/token/GUID-shaped strings. This is the backbone of PIPEDA limiting-collection, GDPR Art. 5 minimization, and the CCPA "no PII" posture.
- **Local-first processing**: device signals processed on-device and posted to `127.0.0.1`; the EU "data stays on-device" transfer position rests on this.
- **6-host egress allowlist + in-product verifier** (`network-capture.mjs`): bounds disclosure; the live `webRequest` capture proves 0 disallowed hosts / 0 user-content payloads, and the RFP evidence pack exports the proof.
- **User-exportable audit log** (CSV/PDF): satisfies access/portability rights (PIPEDA #9, GDPR Art. 15/20, CCPA right-to-know) directly in-product.
- **Uninstall wipe**: satisfies erasure (GDPR Art. 17, CCPA delete) for on-device data.
- **Explicit consent points**: autonomous-mode opt-in modal, opt-in recipe feedback, customer-configured ServiceNow, opt-in digest, user-initiated license email — mapping cleanly to consent under each regime.

## Conditions & open items

Operational items required to convert the *Compliant-with-conditions* and *Gap* ratings above into clean *Compliant*:

1. **Confirm the Netlify backend region** (license / recipes / KB / update / ARIA-brain functions) for EU data-residency posture; add SCCs or pin an EU region if any EU personal data could touch the functions. *(GDPR Ch. V)*
2. **Publish a public privacy policy URL** with categories collected, purposes, retention, and consumer/data-subject rights + request channel. *(PIPEDA #8, GDPR transparency, CCPA notice)*
3. **Appoint and publish a privacy contact** (and complaint route) — the accountable individual under PIPEDA #1/#10. *(PIPEDA, GDPR Art. 37 follow-on)*
4. **Issue and execute the DPA template** plus the EULA/SLA package before any EU/enterprise sale. *(GDPR Art. 28 — current gap)*
5. **Formalize a standalone Records of Processing (RoPA)** from the per-path `purpose`/`direction` declarations. *(GDPR Art. 30)*
6. **Ship encrypted-at-rest local KB (SQLite)** to fully close the PIPEDA #7 safeguards condition (already on the do-buy list).
7. **Document the DPO negative-assessment** and the CCPA below-threshold posture, and diarize a re-check as the customer base scales.
8. **Verify the live license-email template** carries full IIS sender identification (CASL), and keep any future marketing list gated behind express opt-in + unsubscribe.

---

*Prepared for internal procurement and enterprise-buyer review. Not legal advice; have counsel review the DPA/EULA/SLA package and the published privacy policy before external use.*
