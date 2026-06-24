---
id: l3-migration-001
title: "Microsoft 365 / Google Workspace tenant-to-tenant migration"
category: m365
support_level: L3
severity: high
estimated_time_minutes: 240
audience: it-technician
os_scope: ["Microsoft 365", "Google Workspace", "Cloud"]
prerequisites: []
keywords:
  - tenant to tenant migration
  - m365 migration
  - google workspace migration
  - domain move
  - upn smtp coexistence
  - mail onedrive sharepoint teams
  - cutover vs staged
  - mx autodiscover dns
  - throttling
  - rollback planning
  - migration tooling
  - post-cutover validation
related_articles:
  - l3-hybrid-ad-001
  - l3-cloud-001
  - l3-certificates-002
  - l3-business-continuity-001
escalation_trigger: "Engage the migration-tooling vendor and the platform vendor (Microsoft/Google) for unresolved throttling, identity/domain-move conflicts, or data-integrity issues; escalate to project sponsor before any irreversible cutover step."
last_updated: 2026-06-24
version: 1.0
---

# Microsoft 365 / Google Workspace tenant-to-tenant migration

## 1. Symptoms
- A business event (merger, acquisition, divestiture, rebrand, consolidation) requires moving users and data between two cloud tenants.
- Two tenants must temporarily coexist (mail routing, free/busy, directory) during the move.
- Risk areas surface: a domain can only live in one tenant at a time; large mailboxes/drives; Teams/SharePoint structures; external sharing; throttling on bulk migration.
- Post-move complaints: missing mail/permissions, broken Teams/SharePoint links, mail mis-routing, or sign-in confusion.

## 2. Likely Causes
- **Identity/domain constraints:** a custom domain (and its UPNs/SMTP addresses) can be verified in only one tenant at a time, forcing careful sequencing.
- Incomplete discovery: unknown mailboxes, shared/resource mailboxes, distribution/M365 groups, guests, OneDrive/SharePoint sites, Teams, and third-party app integrations.
- DNS/mail-flow dependencies: MX, Autodiscover, SPF/DKIM/DMARC, and CNAMEs must move in step with the cutover.
- Platform **throttling** limiting bulk migration throughput.
- Permission/sharing structures (SharePoint/Teams, OneDrive sharing links, group memberships) not being re-created in the target.
- No coexistence plan, so mail and collaboration break during the transition window.

## 3. Questions To Ask User
- What's the business driver and the hard deadline/constraints (e.g., domain handover date)?
- Source and target platforms (M365↔M365, M365↔Google, Google↔M365) and tenant sizes?
- Full inventory: how many users, mailbox/drive sizes, shared/resource mailboxes, groups, Teams, SharePoint sites, guests, and integrated apps?
- Domain handling: which domains move, what's the coexistence need (free/busy, mail routing) and for how long?
- Cutover style preference and tolerance for downtime: big-bang cutover vs staged/batched?
- Identity model: cloud-only, or synced from on-prem AD/AAD Connect (tie to l3-hybrid-ad-001)?
- Acceptable maintenance windows, comms plan, and what "rollback" means if a batch fails?

## 4. Troubleshooting Steps
> L3 migrations are project-led and human-driven. ARIA assists with discovery, documentation, validation, and coordination; senior engineers run the migration and own irreversible cutover decisions, with vendor support where needed.
1. **Discovery & inventory first.** Enumerate every object: users, mailboxes (incl. shared/resource), groups, OneDrive, SharePoint sites, Teams, guests, app registrations/integrations, and sizes. Gaps here cause the worst post-cutover surprises.
2. **Map identity & namespace.** Decide source→target UPN/SMTP mapping, how the custom domain(s) move (one tenant at a time), and whether on-prem AD/AAD Connect is involved (l3-hybrid-ad-001). Plan temporary routing domains for coexistence.
3. **Choose migration approach:** cutover/big-bang (simpler, more downtime, smaller orgs) vs staged/batched (coexistence, less disruption, more complex). Match to size, deadline, and downtime tolerance.
4. **Plan coexistence:** mail routing between tenants, free/busy/calendar sharing, and directory sync during the transition; define how long both tenants must interoperate.
5. **Select tooling** (a reputable third-party tenant-to-tenant migration tool, generically) for mailboxes/OneDrive/SharePoint/Teams, and confirm it handles permissions, versions, and Teams structures.
6. **Account for throttling:** plan batch sizes/windows and tooling concurrency to work within platform limits; pilot to measure realistic throughput.
7. **Build the DNS/mail-flow cutover plan** (MX, Autodiscover, SPF/DKIM/DMARC, CNAMEs) with TTLs lowered ahead of time.

## 5. Resolution Steps
> Section 5 is for a senior engineer running the project. Irreversible steps (domain move, MX cutover) require sponsor sign-off; vendor engagement is noted.
1. **Prepare the target tenant:** licensing, provisioned users/groups, SharePoint/Teams scaffolding, security/compliance settings, and verified routing domains.
2. **Pilot migration:** migrate a representative pilot group end-to-end (mail, OneDrive, SharePoint, Teams), validate fidelity and permissions, and measure throughput vs throttling. Fix issues before scaling.
3. **Pre-stage bulk data:** run incremental/pre-sync passes so the final delta at cutover is small (lowers downtime). Stagger batches within throttling limits.
4. **Stand up coexistence:** enable cross-tenant mail routing and free/busy so users in both tenants interoperate during a staged move.
5. **Cutover (the irreversible part — sponsor sign-off):** schedule the maintenance window; perform the final delta sync; **move the custom domain** (remove from source, verify in target) and **cut MX/Autodiscover/SPF/DKIM/DMARC/CNAME DNS** to the target. Sequence carefully — the domain can exist in only one tenant at this moment.
6. **Engage vendors for blockers:** the migration-tool vendor for fidelity/permission/throttling issues; Microsoft/Google for tenant-side domain-move, throttling, or routing problems.
7. **Hold a rollback plan:** keep the source tenant intact and data retained until validation passes; define per-batch rollback (re-point routing back, re-enable source) so a failed batch doesn't strand users. True cutover rollback is costly — minimize risk with pilot + pre-staging rather than relying on it.

## 6. Verification Steps
- Mail flows correctly to/from the target tenant; no NDRs or mis-routing; SPF/DKIM/DMARC valid; Autodiscover resolves; no mail looping between tenants.
- Mailboxes, OneDrive, SharePoint, and Teams content migrated with correct permissions, versions, and structures (spot-check across user types).
- Distribution/M365 groups, shared/resource mailboxes, and guest access function as expected.
- Users sign in with the correct UPN/SMTP; the custom domain is verified only in the target and removed from source.
- Pilot/batch validation sign-offs recorded; no orphaned or duplicated objects.
- Integrated apps re-authorized and working; source tenant retained per rollback/retention plan until acceptance.

## 7. Escalation Trigger
Engage the migration-tooling vendor for data-fidelity/permission/throttling issues and the platform vendor (Microsoft/Google) for domain-move conflicts, tenant-side throttling, or mail-routing problems. Escalate to the project sponsor before any irreversible cutover step (domain move, MX change) and whenever a batch fails validation or data integrity is in question.

## 8. Prevention Tips
- Invest heavily in discovery — the inventory you miss is the outage you get. Re-run discovery close to cutover to catch drift.
- Always pilot before bulk; validate fidelity, permissions, and throughput, and tune batch sizes to throttling limits.
- Lower DNS TTLs days ahead so MX/Autodiscover cutover propagates quickly.
- Pre-stage/pre-sync data so the cutover delta (and downtime) is minimal.
- Plan coexistence explicitly for staged moves; don't let mail/free-busy break mid-migration.
- Keep the source tenant and data intact until post-cutover validation and user acceptance are complete.
- Communicate clearly to users (new sign-in/UPN, what to expect, support channel) and provide a cutover-day runbook and comms.

## 9. User-Friendly Explanation
Moving your organization from one cloud tenant to another (for a merger, sale, or rebrand) is like relocating an entire office: people, email, files, shared sites, and chats all have to move without losing anything or breaking how you work. The tricky parts are identity (your email domain can only "live" in one place at a time, so the switch has to be timed precisely) and the sheer volume of data, which the platforms deliberately rate-limit. We reduce risk by inventorying everything, testing with a small pilot group, pre-copying data so the final switch is quick, and keeping the old tenant intact until we've confirmed the new one works. There's a short, planned window where email cuts over to the new home.

## 10. Internal Technician Notes
- Discovery is the make-or-break phase; the missed shared mailbox / Teams site / app integration is the classic post-cutover incident.
- Domain identity is the hard constraint: a custom domain can be verified in only one tenant — sequence the remove-from-source / verify-in-target and DNS cutover tightly.
- Pre-stage with incremental syncs so the cutover delta is small; this is the main lever for low downtime.
- Throttling is real — pilot to measure throughput, then size batches/windows accordingly; don't promise timelines before measuring.
- Rollback of a completed cutover is expensive; prefer to de-risk (pilot + pre-stage + per-batch rollback) and keep the source retained until acceptance.
- For synced identity, coordinate with l3-hybrid-ad-001 (AAD Connect/UPN/source-of-authority) before touching domains.

## 11. Related KB Articles
- l3-hybrid-ad-001 — AAD Connect / hybrid identity and UPN considerations
- l3-cloud-001 — Target tenant design and configuration
- l3-certificates-002 — Cert/SAML federation dependencies affected by namespace change
- l3-business-continuity-001 — Cutover risk, rollback, and downtime planning

## 12. Keywords / Search Tags
tenant to tenant migration, m365 migration, google workspace migration, domain move, upn smtp coexistence, mail onedrive sharepoint teams, cutover vs staged, mx autodiscover dns, throttling, rollback planning, migration tooling, post-cutover validation
