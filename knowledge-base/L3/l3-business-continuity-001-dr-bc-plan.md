---
id: l3-business-continuity-001
title: "Disaster Recovery & Business Continuity program (planning + invocation)"
category: continuity
support_level: L3
severity: high
estimated_time_minutes: 240
audience: it-technician
os_scope: ["All"]
prerequisites: []
keywords:
  - business continuity
  - disaster recovery
  - business impact analysis
  - rto rpo
  - dr tiers
  - failover failback
  - restore testing
  - tabletop exercise
  - declare a disaster
  - runbook
  - bcp
  - recovery objectives
related_articles:
  - l3-disaster-recovery-001
  - l3-backup-dr-002
  - l3-security-001
  - l3-virtualization-001
escalation_trigger: "Declaring a disaster and invoking failover is a management decision; engage executive leadership, the BC/DR owner, and affected vendors before invoking, and whenever recovery objectives (RTO/RPO) are at risk of being missed."
last_updated: 2026-06-24
version: 1.0
---

# Disaster Recovery & Business Continuity program (planning + invocation)

## 1. Symptoms
- No documented, tested DR/BC plan, or one that is stale, untested, or owned by no one.
- An outage/disaster is unfolding and it's unclear who decides to "declare a disaster," in what order to recover, or what the targets are.
- Backups exist but restores have never been proven; recovery objectives (RTO/RPO) are undefined or unrealistic.
- Audit, insurance, or customer due-diligence asks for a BC/DR plan that doesn't exist or can't be evidenced.
- DR site/replication present but failover/failback procedures are unwritten or never rehearsed.

## 2. Likely Causes
- BC/DR treated as a document to file, not a tested, living capability.
- No Business Impact Analysis (BIA), so priorities, dependencies, and tolerable downtime/data-loss are unknown.
- Backups not validated, immutable, or offsite; recovery assumed rather than proven.
- Organizational growth/change outpaced the plan; new systems and dependencies never added.
- Unclear roles, authority, and communications, so even good technical recovery stalls on decisions.

## 3. Questions To Ask User
- What are the most critical business processes, and how long can each be down (RTO) and how much data loss is tolerable (RPO)?
- What systems/data/vendors do those processes depend on (including upstream/third-party services)?
- Where are backups, are they immutable/offsite, and when was a restore last successfully tested?
- Is there a DR site or replication, and have failover/failback ever been rehearsed?
- Who has authority to declare a disaster and invoke DR, and who must be notified (staff, customers, regulators)?
- Are there contractual/regulatory recovery or notification obligations?
- When was the plan last reviewed and tabletop-tested?

## 4. Troubleshooting Steps
> Planning is collaborative and human-led; invocation during a real disaster is a management decision. ARIA helps build, document, and maintain the program and supports coordination during invocation — it does not unilaterally declare disasters or execute failover.
1. **Run/refresh a Business Impact Analysis (BIA):** rank business processes by criticality, map dependencies (systems, data, people, vendors), and capture maximum tolerable downtime and data loss.
2. **Set RTO/RPO per system from the BIA** (recovery-time and recovery-point objectives) so targets are explicit and realistic, not aspirational.
3. **Assign DR tiers:** match each system to a recovery tier (e.g., hot/warm/cold) and recovery strategy proportional to its RTO/RPO and cost.
4. **Inventory current recovery capability** (backups, replication, DR site, runbooks) and identify gaps against the objectives — especially unproven restores.
5. **Clarify decision authority and roles** for declaring a disaster, plus the communications/notification matrix (staff, customers, regulators, vendors).
6. **Assess realism:** confirm objectives are achievable with current capability, or flag the gap to leadership for investment.

## 5. Resolution Steps
> Section 5 covers building the program and the invocation sequence for a senior engineer / DR owner. Declaring a disaster and any failover/failback are management-authorized; vendor engagement is noted.
1. **Author tiered DR runbooks** with explicit recovery order (dependencies first), step-by-step actions, owners, and verification points (align technical runbooks with l3-disaster-recovery-001).
2. **Validate backups and prove restores:** schedule regular restore tests to verified-clean, immutable/offline copies (l3-backup-dr-002). An untested backup is not a recovery capability.
3. **Document and rehearse failover AND failback:** failback is frequently neglected and is where unrehearsed plans fail — plan the return to primary, not just the jump to DR.
4. **Define the disaster-declaration process:** criteria, the authorized decision-maker(s), invocation trigger, and the communications plan. **Declaration and invocation are leadership decisions**, not technician calls.
5. **Run tabletop exercises** (and, where feasible, live failover tests) at least periodically; capture findings and remediate the plan.
6. **Invocation (during a real event):** confirm the declaration from the authorized decision-maker → activate the comms plan and roles → execute runbooks in recovery order → engage vendors (cloud, storage, hypervisor) where required → meet RTO/RPO and validate before returning to service → plan failback once primary is healthy.
7. **Maintain the program:** review after every change/incident and on a fixed cadence; keep contacts, dependencies, and objectives current.

## 6. Verification Steps
- A current BIA exists with agreed RTO/RPO per critical system, signed off by business owners.
- Tiered runbooks exist with recovery order, owners, and verification steps; stored accessibly (and out-of-band).
- Backups validated by recent successful restore tests to clean/immutable copies; results recorded.
- Failover and failback procedures documented and exercised; last tabletop/live-test date current.
- Disaster-declaration authority, roles, and communications matrix defined and known to participants.
- During invocation: declared by the authorized party, runbooks executed in order, RTO/RPO met and verified, and a failback plan in place.

## 7. Escalation Trigger
Declaring a disaster and invoking failover are management decisions — engage executive leadership and the BC/DR owner to declare, and notify affected vendors, customers, and regulators per the communications plan. Escalate immediately whenever recovery objectives (RTO/RPO) are at risk of being missed, when restores fail during invocation, or when the event is also a security incident (coordinate with l3-security-001).

## 8. Prevention Tips
- Treat BC/DR as a tested capability, not a binder: regular restore tests and tabletop/live exercises are the program.
- Keep the BIA, dependency map, and RTO/RPO current as the business changes; add new systems to the plan at onboarding.
- Use immutable/offsite backups and verify them; assume primary infrastructure can be fully lost (including to ransomware).
- Document and rehearse failback, not just failover.
- Store the plan, runbooks, and contact lists out-of-band so they're reachable when primary systems and email are down.
- Pre-define disaster-declaration authority and the communications matrix so decisions don't stall mid-crisis.
- Review the plan after every incident and on a fixed schedule; close gaps with owners and due dates.

## 9. User-Friendly Explanation
Business continuity is your plan for keeping the business running when something major breaks — a fire, a flood, a cyberattack, a cloud outage. We start by figuring out which activities matter most and how long they can pause and how much recent data you can afford to lose. From there we decide how each system should be protected and recovered, write clear step-by-step recovery guides, and — crucially — actually test that backups restore and that we can switch to a backup site and back again. We also agree in advance who has the authority to "declare a disaster" and how we'll communicate. A plan that's never tested tends to fail when you need it, so practice is the whole point.

## 10. Internal Technician Notes
- The BIA drives everything: no BIA means RTO/RPO and tiering are guesses. Get business sign-off on the objectives.
- "We have backups" is not recovery — only a tested restore is. Untested backups are the single most common false sense of security.
- Failback is the neglected half. Many plans rehearse failover and have no idea how to get back to primary cleanly.
- Declaration authority and comms must be pre-agreed; technical recovery often stalls on "who decides?" not on technology.
- Store plans/runbooks/contacts out-of-band — they're useless if they live only on the systems that are down.
- If the disaster is a security incident, coordinate with l3-security-001 (recover from clean/immutable backups, don't restore the compromise back).

## 11. Related KB Articles
- l3-disaster-recovery-001 — Technical DR runbook this program operationalizes
- l3-backup-dr-002 — Immutable/offline backups the program depends on
- l3-security-001 — When the disaster is a cyber incident
- l3-virtualization-001 — Failover of virtualized workloads during invocation

## 12. Keywords / Search Tags
business continuity, disaster recovery, business impact analysis, rto rpo, dr tiers, failover failback, restore testing, tabletop exercise, declare a disaster, runbook, bcp, recovery objectives
