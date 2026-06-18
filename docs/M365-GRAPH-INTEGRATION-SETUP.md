# M365 Graph Integration — Setup Guide
**v0.1 scaffold · 2026-06-18 · read-only operations**

## What this enables
ARIA can now read directly from a customer's Microsoft 365 tenant (with admin consent) — no more "go check the admin center yourself" punts. The MVP scaffold ships these read-only actions:

| Action | What it returns |
|---|---|
| `health-check` | Whether env vars are set + which actions are available |
| `list-users` | First N users with display name, UPN, mail, enabled state |
| `get-user` | Full user record by UPN/email — incl. licenses, signInActivity |
| `check-license` | License details for a user |
| `list-groups` | First N security/M365 groups with type + members count |
| `list-devices` | Intune-managed devices with compliance + last sync |

## Setup steps (per IIS — one-time)

### 1. Register an Azure AD app
1. Sign in to https://entra.microsoft.com as a global admin
2. Identity → Applications → App registrations → New registration
3. Name: `ARIA Graph Reader`
4. Supported account types: **Multitenant** (so any customer tenant can grant consent)
5. Register. Note the `Application (client) ID`.

### 2. Add API permissions
Application permissions (NOT delegated):
- `User.Read.All`
- `Group.Read.All`
- `Directory.Read.All`
- `DeviceManagementManagedDevices.Read.All`

Then click "Grant admin consent for IIS Inc." (the home tenant).

### 3. Create a client secret
App → Certificates & secrets → New client secret → 24 months. Copy the value immediately (only shown once).

### 4. Set Netlify env vars
| Key | Value |
|---|---|
| `M365_TENANT_ID` | (your IIS tenant id — for testing, or customer's tenant id for per-tenant deploys) |
| `M365_CLIENT_ID` | (the Application client ID from step 1) |
| `M365_CLIENT_SECRET` | (the client secret value from step 3) |

### 5. Verify
```
POST https://iisupp.net/.netlify/functions/aria-m365-graph
{ "action": "health-check" }
```
Should return `ready: true` + the env-var status table.

### 6. First real call
```
POST https://iisupp.net/.netlify/functions/aria-m365-graph
{ "action": "list-users", "params": { "top": 5 } }
```

## Per-customer tenant pattern (v0.2)

For each customer:
1. Customer's global admin opens an admin-consent URL:
   `https://login.microsoftonline.com/<their-tenant-id>/adminconsent?client_id=<our-client-id>`
2. They consent on their side — no IIS-side config change
3. ARIA can now call Graph against THEIR tenant by passing `tenant_id` per request
4. We store the consenting tenant_id keyed by the ARIA customer_id (Stripe subscription → tenant_id mapping)

This is the multi-tenant unlock for the $156K SMB plan and above. Scaffold is here; per-tenant routing comes in v0.2 (~1-2 days work).

## What ARIA can do today vs after this lands

| Question | Before | After |
|---|---|---|
| "Is user X's account enabled?" | "Open Entra → Users → search..." | Read directly + answer in 2 sec |
| "What licenses does Y have?" | "Open M365 admin → Licenses..." | Direct lookup |
| "Is device Z compliant?" | "Open Intune → Devices..." | Direct lookup with last sync time |
| "List all guests in group G" | "Open Entra → Groups → ..." | Direct lookup |

This converts ARIA from "advisor" to "operator" for the most common L1-L2 admin questions. **10× perceived value.**

## Spend impact
- Microsoft Graph API: **free** at this volume (5K/day Per-app limit covers any IIS customer count for now)
- No new SaaS, no extra Netlify cost (function is in existing free tier)
- App registration: **free**

Per [spend cap rule](../senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md): no spend ask required.
