---
id: l3-enterprise-001
title: "Enterprise / MSP architecture: multi-tenant operations, segregation, automation"
category: enterprise
support_level: L3
severity: medium
estimated_time_minutes: 90
audience: technician
prerequisites: ["MSP / IT services architect"]
os_scope: ["Multi-platform"]
keywords:
  - msp
  - multi tenant
  - lighthouse
  - delegated administration
  - psa
  - rmm
  - automation
  - itil
  - itsm
related_articles:
  - l3-cloud-001
  - l3-security-001
escalation_trigger: "Cross-tenant breach, contractual SLA breach, regulatory change"
last_updated: 2026-05-07
version: 1.0
---

# MSP / enterprise architecture

## 1. Operating model
- **Tools:** PSA (ConnectWise / Autotask / Kaseya BMS) + RMM (Datto, NinjaOne, N-able) + ticketing + remote access + documentation (IT Glue, Hudu).
- **Process:** ITIL incident / problem / change / request flows.
- **Tiers:** L1 dispatch, L2 engineering, L3 architecture, vCIO.
- **Metrics:** First-touch resolution, SLA adherence, CSAT, MRR per client.

## 2. Multi-tenant architecture
- Per-client isolation: separate Entra tenants when possible (regulatory) or per-tenant boundaries within a single MSP tenant.
- **Microsoft Lighthouse / Partner Center** for delegated access — better than shared admin accounts.
- GDAP (Granular Delegated Admin Privileges) — least-privilege, time-bound.
- Per-client documentation, separation of credentials.
- No shared admin user across customers.

## 3. Automation playbooks
- Onboarding: new client tenant build via IaC.
- New user: from PSA ticket → Entra + Intune via PowerShell / Graph.
- Offboarding: same automation chain in reverse.
- Patching: RMM + WUFB rings.
- Backup: immutable + monitored with alerting.
- Reporting: SLA dashboards per client.

## 4. Security operations
- 24/7 SOC (in-house or partnered).
- SIEM ingesting from all tenants.
- IR runbook adapted per client tier (premium vs base).
- Tabletop with each client annually.

## 5. Commercial discipline
- MSA + SOW per client; SLA tiers documented.
- Service catalog with sticky pricing.
- Recurring revenue focus: managed services, not break-fix.
- Quarterly business reviews with each client.
- vCIO function for strategic clients.

## 6. Scaling
- Document everything; no tribal knowledge.
- Automate the top 20 ticket categories — that's where 80% of L1 time goes.
- Right-size org: ~1 tech per 50–80 endpoints managed.
- Specialize: cloud, security, networking experts; not generalists at scale.
- KPIs: utilization, revenue per tech, churn, CSAT.

## 7. Compliance
- Per-client compliance (HIPAA, SOX, PCI, ISO) reflected in stack + processes.
- Audit-ready evidence collection automated.
- Contracts include data handling + breach notification clauses.

## 8. Verification
- Per-client SLAs met.
- Security posture per client measurable.
- Automation rate increasing (manual ticket time decreasing).
- Profitable per-client P&L.

## 9. Related
- l3-cloud-001 — Cloud landing zones (per client)
- l3-security-001 — IR runbook (per client)

## 10. Keywords
msp, multi tenant, lighthouse, delegated administration, psa, rmm, automation, itil, itsm
