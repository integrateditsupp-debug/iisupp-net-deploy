# ARIA Sentinel — Microsoft Entra ID (Azure AD) Integration
### Client Self-Setup Guide · Integrated IT Support Inc.

> **What this is.** A step-by-step guide to connect your corporate directory (Microsoft Entra ID / Azure AD) to ARIA Sentinel so it can perform **verified, audited identity actions** — look up users, check lockouts and group membership, and (once write access is granted) reset/unlock accounts under approval. Read-only first, by design.
>
> **Premium DIY guide.** Prefer we do it for you, or want a managed phone line for ongoing changes? Book a 15-minute [Appointment](https://calendar.app.google/LUyV5pHxkqJRg5vp8).

---

## Who needs this
- A Microsoft 365 / Entra ID **tenant administrator** (or Global Admin) to register the app and grant consent.
- ARIA Sentinel **Integrated edition** installed.

## What you'll end up with
- An **app registration** named *ARIA Sentinel* with least-privilege **read-only** Graph permissions.
- Three values placed in ARIA Sentinel's secure config: **Tenant ID, Client ID, Client Secret.**
- A working, audited **read-only** directory connection. (Write actions — reset/unlock — are a separate, gated step.)

---

## Step 1 — Register the app
1. Go to **entra.microsoft.com** (or portal.azure.com → **Microsoft Entra ID**).
2. **App registrations → New registration.**
3. Name: **ARIA Sentinel**. Supported account types: **Accounts in this organizational directory only (single tenant).** Redirect URI: leave blank. **Register.**
4. On the **Overview** page, copy the **Application (client) ID** and **Directory (tenant) ID**.

## Step 2 — Grant least-privilege READ permissions
1. **API permissions → Add a permission → Microsoft Graph → Application permissions.**
2. Add exactly these (read-only):
   - `User.Read.All`
   - `Group.Read.All`
   - `Device.Read.All`
   - `AuditLog.Read.All`
3. Click **Grant admin consent for [your tenant]** → confirm. (Status should show green check marks.)

> **Security note.** These are **read-only**. ARIA cannot change anything in your directory with these scopes. Write actions (password reset, unlock) require separate scopes + a second admin consent — only enable them when you're ready, and they remain **never-autonomous, approval-gated** in ARIA.

## Step 3 — Create a client secret
1. **Certificates & secrets → New client secret.** Description: *ARIA Sentinel*. Expiry: 12–24 months. **Add.**
2. **Copy the secret VALUE immediately** (it's shown only once). Treat it like a password.

## Step 4 — Configure ARIA Sentinel
Place the three values into ARIA Sentinel's secure configuration (never in plain text / email / chat):
- `DIRECTORY_TENANT_ID` = your Directory (tenant) ID
- `DIRECTORY_CLIENT_ID` = your Application (client) ID
- `DIRECTORY_CLIENT_SECRET` = the secret value from Step 3

## Step 5 — Verify (read-only)
- In ARIA Sentinel, run the **directory connection check**. A healthy result confirms the token flow and a read-only lookup (e.g., find a user, check lockout status). If it reports *creds not configured*, re-check Step 4.

---

## How ARIA keeps this safe (what to tell your security team)
- **Read-only first.** No write access until you explicitly grant it.
- **Never autonomous on a write.** Every change is admin-approved, executed, then **read back to verify it landed**, with **auto-rollback** on mismatch.
- **Identity certainty.** ARIA never acts on an ambiguous target — if it isn't 100% sure who you mean, it stops and asks.
- **Verification is delegated.** End-user identity is confirmed through **your** trusted verifier (PingOne / RSA / your portal) — ARIA never handles ID photos or biometrics.
- **Least-privilege + tamper-evident audit.** Minimum scopes; every action logged immutably.

## Need help?
- One-time setup done for you, or ongoing managed changes by phone: book an [Appointment](https://calendar.app.google/LUyV5pHxkqJRg5vp8).
- ahmad.wasee@iisupp.net · 647-581-3182 · [iisupp.net](https://iisupp.net/)

*© Integrated IT Support Inc. — Client Setup Guide. For your environment only; do not redistribute.*
