# ARIA Sentinel — Integrations Setup Guide
### Connect ServiceNow, your CRM, Microsoft Entra ID, RSA, and Microsoft 365 · Integrated IT Support Inc.

> **What this is.** A step-by-step guide to connect ARIA Sentinel's **Integrations** tab to your business systems so ARIA can read tickets, customer context, your directory, and Microsoft 365 documents — safely, read-only first, every write gated by approval.
>
> **Prefer we set it up for you?** One-time done-for-you setup, or a managed line for ongoing changes — book a 15-minute [Appointment](https://calendar.app.google/LUyV5pHxkqJRg5vp8).

---

## The Integrations tab at a glance
Open ARIA Sentinel → **Integrations**. You'll see eight connector cards in two groups. Each card shows a **status badge** — **Connected** (green), **Not configured** (grey), or **Error** (red) — and a **Test connection** button. ARIA never reports "Connected" unless a real read-only check passes.

**Edition note.** The four *Identity & Service* connectors (ServiceNow, CRM, Entra, RSA) are part of the **Integrated edition**. On Standalone they're hidden. Microsoft 365 document connectors are available where you're licensed.

| Group | Connectors |
|---|---|
| **Identity & Service** | ServiceNow · CRM · Azure AD / Microsoft Entra ID · RSA admin |
| **Microsoft 365 Documents** | Word · Excel · PowerPoint · OneNote |

---

## Group A — Identity & Service

### 1. ServiceNow (ITSM tickets, incidents, change requests)
**You'll need:** a ServiceNow instance URL + an OAuth app (or service account) with read scope on incident/change tables.
1. In ServiceNow, create an OAuth application registry entry (or a least-privilege integration user).
2. In ARIA → Integrations → ServiceNow card → enter instance URL + credentials in secure config.
3. Click **Test connection** → expect a read-only sample (open-incident count). The card's **Manage incidents →** link opens the incident bridge.
> Read-only first. ARIA proposes ticket actions; it does not auto-write changes without approval.

### 2. CRM (customer records & deal context — Dynamics / HubSpot)
**You'll need:** API access to your CRM (Dynamics 365 app registration, or HubSpot private-app token) with read scope on contacts/accounts/deals.
1. Generate the read-only token/app in your CRM.
2. Enter it in the CRM card's secure config.
3. **Test connection** → expect a sample read (e.g., a contact lookup). ARIA uses this for context only.

### 3. Azure AD / Microsoft Entra ID (directory)
**You'll need:** a tenant admin to register an app and grant least-privilege **read** Graph scopes.
1. Register an app named **ARIA Sentinel** (single tenant). Copy **Tenant ID** + **Client ID**.
2. Add read-only Graph application permissions: `User.Read.All`, `Group.Read.All`, `Device.Read.All`, `AuditLog.Read.All` → **Grant admin consent**.
3. Create a client secret; copy the value once.
4. Place `DIRECTORY_TENANT_ID / DIRECTORY_CLIENT_ID / DIRECTORY_CLIENT_SECRET` in ARIA's secure config.
5. **Test connection** → healthy = token flow + a read-only lookup succeeded.
> Full detail in the dedicated *Entra ID Integration* guide. Write actions (reset/unlock) are a separate, gated step with a second consent — never autonomous.

### 4. RSA admin (ID verification & token admin)
**You'll need:** RSA admin API access (or your IDV portal endpoint).
1. Provide the RSA/IDV endpoint + a read-scoped credential.
2. Enter it in the RSA admin card.
3. **Test connection** → confirms reachability.
> ARIA is a **middleman only** — it never handles ID photos or biometrics. End-user identity is confirmed through *your* trusted verifier (PingOne / RSA).

---

## Group B — Microsoft 365 Documents
**You'll need:** Microsoft 365 with Graph access (the same Entra app can carry document scopes, e.g. `Files.Read.All`, `Notes.Read.All`) — added by your tenant admin.

- **Word** — read/generate `.docx` (reports, client guides).
- **Excel** — read/generate `.xlsx` (inventories, exports).
- **PowerPoint** — generate `.pptx` (client decks).
- **OneNote** — read/append notes.

For each: enter Graph credentials in the card's secure config → **Test connection** → expect a read-only sample (e.g., list recent files). Until configured, the card honestly shows **Not configured**.

---

## How ARIA keeps this safe (for your security team)
- **Read-only first.** No write access to any system until you explicitly grant it.
- **Never autonomous on a write.** Every change is approved, executed, then read back to verify, with auto-rollback on mismatch.
- **Least-privilege scopes** everywhere; **tamper-evident audit** of every action.
- **Identity verification delegated** to your trusted verifier — ARIA never handles biometrics.
- **Per-customer approval** required before any connector goes live.

## Need help?
One-time setup done for you, or ongoing managed changes by phone — book an [Appointment](https://calendar.app.google/LUyV5pHxkqJRg5vp8).
ahmad.wasee@iisupp.net · 647-581-3182 · [iisupp.net](https://iisupp.net/)

*© Integrated IT Support Inc. — Client Setup Guide. For your environment only; do not redistribute.*
