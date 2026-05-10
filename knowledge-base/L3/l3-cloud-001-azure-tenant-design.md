---
id: l3-cloud-001
title: "Azure tenant + subscription design / landing zones"
category: cloud
support_level: L3
severity: high
estimated_time_minutes: 120
audience: technician
prerequisites: ["Azure global admin or owner-tier"]
os_scope: ["Azure"]
keywords:
  - azure
  - tenant
  - subscription
  - landing zone
  - management groups
  - azure policy
  - rbac
  - cost management
  - identity
related_articles:
  - l3-security-001
  - l3-networking-001
escalation_trigger: "Tenant restructure, sovereignty constraint, M&A integration"
last_updated: 2026-05-07
version: 1.0
---

# Azure tenant + subscription design

## 1. Hierarchy
- Tenant (Entra) — top-level identity boundary.
- Management groups → enable policy/RBAC inheritance.
- Subscriptions → billing and access boundary.
- Resource groups → application boundary.
- Resources.

## 2. Landing zone (Microsoft Cloud Adoption Framework)
- Platform subscriptions (identity, mgmt, connectivity).
- Workload (landing zone) subscriptions per app or BU.
- Sandbox subscriptions for experimentation, no peering to prod.

## 3. Identity
- One Entra tenant per company; multi-tenant only for separations of legal entity.
- Privileged Identity Management (PIM) for time-bound elevation.
- Conditional Access protects all admin paths.
- Entra ID Governance for access reviews + access packages.

## 4. RBAC
- Use built-in roles. Custom roles only when required.
- Assign at lowest scope necessary.
- Avoid Owner / Contributor at subscription unless justified.
- Separate workload teams from platform teams.

## 5. Policy
- Azure Policy enforces compliance: tagging, locations, SKU restrictions.
- Initiatives bundle policies (CIS, ISO, custom).
- Audit-first, then enforce.
- Inheritance from MG → SUB → RG.

## 6. Cost management
- Tagging baseline: env, owner, costcenter, app.
- Budgets per subscription with alerts.
- Reservations + savings plans for stable workloads.
- Monthly review with Finance.

## 7. Network
- Hub-and-spoke standard. Hub in connectivity sub.
- Azure Firewall or NVA in hub.
- Private endpoints for PaaS.
- DNS private zones tied to hub.
- ExpressRoute or VPN to on-prem.

## 8. M&A / restructure
- Tenant migrations are painful — plan months ahead.
- Use B2B for short-term cross-tenant access.
- Cross-tenant sync (CTS) for identity continuity.
- Subscription transfer between tenants with care + validation.

## 9. Verification
- Landing zone deployed via IaC (Bicep / Terraform).
- Policies in compliance.
- RBAC reviewed.
- Cost trending healthy.
- DR + backup tested.

## 10. Related
- l3-security-001 — IR scope
- l3-networking-001 — Network architecture

## 11. Keywords
azure, tenant, subscription, landing zone, management groups, azure policy, rbac, cost management, identity
