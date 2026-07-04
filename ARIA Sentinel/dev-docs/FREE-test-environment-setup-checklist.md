# Free Test-Environment Setup — ARIA Sentinel (Windows + Entra + Dynamics 365 + ServiceNow)
**Date:** 2026-06-26 · **Cost: $0** · For: Ahmad (these are admin/account steps only you can do — I can't create tenants, register apps, or grant consent for you). One Microsoft Entra app covers Directory + Office + Dynamics.

## 0. Windows-issue testing (no setup, do now)
- Just run the installed ARIA Sentinel and trigger real issues (Wi-Fi drop, printer, Outlook, audio, BSOD recovery, etc.). Click "Run anyway" once on the unsigned app. $0. No tenant needed.

## 1. Microsoft Entra (Azure AD) — free directory tenant
1. Create a **free Microsoft Entra ID tenant** (or use an M365 work account you control). Add 2–3 **test users** + 1–2 **groups** (so there's data to read).
2. **App registrations → New registration** → name **ARIA Sentinel** → single tenant → Register. Copy **Directory (tenant) ID** + **Application (client) ID**.
3. **API permissions → Microsoft Graph → Application permissions**, add (read-only): `User.Read.All`, `Group.Read.All`, `Device.Read.All`, `AuditLog.Read.All` → **Grant admin consent** (green checks).
4. **Certificates & secrets → New client secret** → copy the **value** once.
5. Put into ARIA Sentinel secure config: `DIRECTORY_TENANT_ID`, `DIRECTORY_CLIENT_ID`, `DIRECTORY_CLIENT_SECRET`.
   → This unblocks the live Entra/AD directory test (read users, groups, lockout).

## 2. Dynamics 365 (CRM) — free, two options (pick one)
- **Option A — free forever (Dataverse):** sign up for the **Power Apps Developer Plan** → create a **developer environment with Dataverse**. (Note: full Dynamics 365 Sales app can't install in a *developer* env, but the **Dataverse contacts/accounts tables** ARE the Dynamics CRM data — perfect for testing CRM reads. $0, no expiry.)
- **Option B — real Dynamics, 30 days:** start a **Dynamics 365 Sales free trial** → real Dynamics environment for 30 days.
- Either way: copy the **environment/org URL** (e.g. `https://yourorg.crm.dynamics.com`) → this becomes `DYNAMICS_URL`.
- In the Power Platform admin / environment: create an **Application User** mapped to the **same ARIA Sentinel Entra app** (step 1) and give it a **read-only security role**. (Dynamics/Dataverse uses your Entra app — no second secret needed.)

## 3. ServiceNow — free Personal Developer Instance (PDI)
1. Sign up at **developer.servicenow.com** → **Request Instance** → pick a release → get the **instance URL** + admin creds.
2. Create a read-scoped **integration user** (or OAuth app) for ARIA.
3. Put into Sentinel: `SN_INSTANCE_URL`, `SN_USER`, `SN_PASSWORD` (read-only). (PDI reclaims if idle 10 days — just log in weekly.)

## 4. Office docs (optional)
- Word/Excel/PPT/OneNote read via the same Entra app + Graph (`Files.Read.All`, `Notes.Read.All`) — add those scopes in step 1 if you want to test doc reads. A free Entra tenant has no Office licenses, so use Option B's trial or an existing M365 if you want real doc data.

## What happens after you do the above
- Tell me which creds are in place. Forge wires the Dynamics/Dataverse read connector + the dev-tenant test harness; then I run + document: Windows issues → Entra directory → Dynamics CRM → ServiceNow.
