# ARIA Sentinel — Setup Video Guides (build/config scripts)

These are the **build/config halves** of the integration setup videos. Each file is a step-by-step
script with the exact values, env vars, scopes, and config blocks. **Cowork captures the live
screenshots** while driving the installed app + the admin portals; drop them into the
`[SCREENSHOT: …]` placeholders during edit.

> Source build for these guides: **ARIA Sentinel 0.1.18** (installed on Ahmad's machine 2026-06-26).
> The in-app **Integrations → Configure** credentials form (encrypted via Electron `safeStorage`) **ships
> in 0.1.18** — creds are pasted directly in the UI, encrypted on-device, and fed into the providers'
> read-only checks. (Pre-0.1.18 the only path was a hand-edited `.env.local`; the guides note both.)

| Guide | What it covers | Who does it |
|---|---|---|
| [`01-entra-azure-ad.md`](01-entra-azure-ad.md) | Register the Entra app, read-only Graph scopes, admin consent, secret, the 3 IDs | Tenant admin (Ahmad) |
| [`02-servicenow.md`](02-servicenow.md) | Free PDI, read-scoped integration user, instance URL + creds | ServiceNow admin (Ahmad) |
| [`03-dynamics-dataverse.md`](03-dynamics-dataverse.md) | Free Dataverse/Dynamics env, Application User on the **same** Entra app, `DYNAMICS_URL` | Power Platform admin (Ahmad) |
| [`04-code-signing-azure-trusted.md`](04-code-signing-azure-trusted.md) | Wire Azure Trusted Signing into the electron-builder Windows build | Build owner (Forge) + Ahmad supplies 3 values |
| [`05-flagship-write-role-and-notifications.md`](05-flagship-write-role-and-notifications.md) | Flagship gated-write case: ServiceNow write role + Entra write scope + ServiceNow email notification rule | ServiceNow + tenant admin (Ahmad) |

Companion client-facing source docs (already in the repo):
- `sales/client-guides/ClientGuide-ARIA-Sentinel-Integrations.md` — full Integrations tab walkthrough.
- `sales/client-guides/Entra-6-clicks-quickstart.md` — the fast Entra path.
- `dev-docs/FREE-test-environment-setup-checklist.md` — $0 dev tenants for Entra / Dynamics / ServiceNow.

**Safety stance shown in every video:** read-only first · no write without per-customer approval ·
least-privilege scopes · tamper-evident audit · secrets never logged or sent anywhere but the
provider's own endpoint.
