# Setup Video — Flagship case: write role + Entra write scope + ServiceNow notifications
*Build/config script for the gated-write flagship demo. Cowork screenshots each `[SCREENSHOT]`.*

This is the config that turns the **read-only** integrations into the full **supported-case** flow:
web "Resolve it for me" → ServiceNow Interaction + Incident → Entra remediation → resolve/close → email.
Everything below is **instance/tenant configuration Ahmad does once** — it is NOT Sentinel code.

> **Honesty (RULE 14):** ARIA writes only after these are granted. Until then it flags
> "ServiceNow write user not configured" / "Entra remediation not authorized" — it never fakes a ticket
> number or a fake "unlocked". A cloud Entra account is never "locked" like on-prem AD; the remediation is
> **revoke sign-in sessions** (forces re-auth) or **force password change at next sign-in**, labeled truthfully.

---

## A · ServiceNow write-enabled integration user (MODULE 1)
The read-only guide (`02-servicenow.md`) created a read user. For the write lifecycle, the integration user
needs **write** on the Interaction + Incident tables.

1. **User Administration → Users →** open `aria.integration` (or create it) → **Web service access only** = true.
2. Give it a role with **create/write** on `interaction` and `incident` — the built-in **`itil`** role covers
   incident; add **`interaction_agent`** (or a custom role with write ACL on `interaction`) for interactions.
   For a pure API integration, a scoped **`web_service`**-style role with write ACLs on those two tables is cleanest.
   `[SCREENSHOT: integration user + itil/interaction roles]`
3. Confirm the same `SN_INSTANCE_URL` / `SN_USER` / `SN_PASS` are saved in **Integrations → ServiceNow → Configure**.
   `[SCREENSHOT: ServiceNow Configure panel saved]`

What ARIA does with it (all gated + read-back-verified): `POST /api/now/table/interaction` → `POST /api/now/table/incident`
(correlated to the interaction) → `PATCH` work notes → `PATCH state=6` resolve with close notes → close the interaction.
Each write is followed by a `GET` read-back; the **real** returned number is what ARIA reports — never an invented one.

## B · Entra additional WRITE scope + admin consent (MODULE 2)
The read guide (`01-entra-azure-ad.md`) granted read scopes. Remediation needs a **write** application permission
+ admin consent:

| Remediation | Graph call | Application permission to add + consent |
|---|---|---|
| Revoke sign-in sessions (force re-auth) | `POST /users/{id}/revokeSignInSessions` | `User.RevokeSessions.All` (or Directory write) |
| Force password change at next sign-in | `PATCH /users/{id}` passwordProfile | `User.ReadWrite.All` |

1. **App registrations → ARIA Sentinel → API permissions → + Add → Microsoft Graph → Application permissions** →
   add the permission(s) above → **Grant admin consent**. `[SCREENSHOT: write permission granted (green)]`
2. Have an **exact test user** (object id GUID or UPN) to remediate. ARIA refuses any non-exact target (STOP).

If the scope/consent is absent, ARIA returns **"Not authorized (HTTP 403) — needs the write scope + admin consent"**
and the case **escalates** (no fake remediation). `[SCREENSHOT: honest 'Not authorized' result]`

## C · ServiceNow email-to-company NOTIFICATION rule (instance config, not Sentinel code)
The company gets the same data ARIA emails — via a **ServiceNow notification** Ahmad configures in the instance:

1. **System Notification → Email → Notifications → New.**
2. **Table:** `Incident`. **When to send → Send when:** Record inserted/updated.
3. **Conditions:** `State` *is* `Resolved` **OR** `State` *changes to* `New` (one rule per event, or use an OR condition)
   — so the company is notified on **incident created** and on **incident resolved**.
4. **Who will receive:** add `integrateditsupp@gmail.com` (Users/Email field).
5. **What it will contain:** subject `ARIA Sentinel · ${number} · ${state}`, body with number / short description / state /
   close notes. `[SCREENSHOT: notification rule]`
6. **Activate.** Test by resolving a sample incident and confirming the email arrives. `[SCREENSHOT: delivered email]`

This is the company-side notification. ARIA's own **session-end email** (to the user + the company, the same data ARIA
web shares) is separate and already built — it fires once at case end with the case summary + real SLA.

## D · The flagship flow on camera (after A–C)
1. On the website, click **"Resolve it for me"** → it deep-links `aria-sentinel://` into the installed app. `[SCREENSHOT]`
2. ARIA opens a **case**, confirms the gated action (10-second countdown), then: Interaction → Incident (real numbers)
   → Entra **revoke sign-in sessions** on the test user (read-back verified) → **Resolve + close** the incident →
   fires the **session-end email**. `[SCREENSHOT: each step]`
3. ServiceNow's notification rule (C) emails the company on create + resolve. `[SCREENSHOT: both emails]`

## E · Proactive background resolution (MODULE 4) — what to show
While idle in **Confirmed/Autonomous** mode, ARIA silently resolves only **safe (green)** local issues (e.g. clock
drift, small temp bloat, stale DNS cache), logs a ServiceNow ticket per fix, and on a cadence emails the user:
*"ARIA resolved X and prevented Y in the background — so you weren't bothered."* Risky/destructive fixes are **never**
auto-run; they wait for the prompted, gated path. `[SCREENSHOT: the user summary email]`
