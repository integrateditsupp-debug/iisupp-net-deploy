# Setup Video — Dynamics 365 / Dataverse (CRM) connector
*Build/config script. Cowork screenshots each `[SCREENSHOT]` while driving Power Platform admin + the app.*

**Outcome:** ARIA Sentinel reads CRM contacts/accounts **read-only** for customer context.
**Key idea:** Dynamics/Dataverse reuses the **same Entra app** from guide 01 — **no second secret**, just an
Application User + URL. **Cost:** $0 (Power Apps Developer Plan / Dataverse) or a 30-day Dynamics trial.

---

## What you need before recording
- Guide **01 (Entra app)** done — you'll reuse its **Application (client) ID**.
- A Dataverse environment — pick one (see `dev-docs/FREE-test-environment-setup-checklist.md` §2):
  - **Option A — free forever:** Power Apps **Developer Plan** → a **developer environment with Dataverse**
    (the contacts/accounts tables ARE the Dynamics CRM data — perfect for read testing).
  - **Option B — real Dynamics, 30 days:** a **Dynamics 365 Sales** free trial.

## Steps (record each)

1. **Get the environment URL.** Power Platform admin center → **Environments** → your env → copy the
   **Environment URL** (e.g. `https://yourorg.crm.dynamics.com`). This becomes `DYNAMICS_URL`.
   `[SCREENSHOT: environment URL]`

2. **Create the Application User on the SAME Entra app.** In the environment → **Settings → Users + permissions
   → Application users → + New app user** → **+ Add an app** → pick **ARIA Sentinel** (the client ID from guide 01).
   `[SCREENSHOT: app user picker showing ARIA Sentinel]`

3. **Assign a read-only security role.** Give the Application User a **read-only** role (a Dataverse role with
   read on `contact` / `account`, no create/update/delete). **Save**.
   `[SCREENSHOT: Application User with the read-only role]`

## Wire it into ARIA Sentinel (current 0.1.17 build)

```
DYNAMICS_URL = https://yourorg.crm.dynamics.com
# Auth reuses the Entra app from guide 01 — DIRECTORY_TENANT_ID / DIRECTORY_CLIENT_ID / DIRECTORY_CLIENT_SECRET.
# No separate Dynamics secret.
```

- **In 0.1.18 (recommended):** **Integrations → CRM → Configure** → paste the **Dynamics / Dataverse URL**
  (→ `DYNAMICS_URL`) and, if used, a **HubSpot private-app token** (masked + encrypted via `safeStorage`).
  Entra auth is reused from guide 01. **Test connection** does a read-only sample and flips the badge only on
  a real 2xx; until then the card honestly shows **Not configured**.
  `[SCREENSHOT: CRM → Configure panel]` · `[SCREENSHOT: CRM card → Test connection]`
  > **Build note for Forge:** the Configure panel stores `DYNAMICS_URL` today, but the live CRM badge currently
  > verifies through the **HubSpot** read path — the dedicated Dynamics/Dataverse **read connector** + dev-tenant
  > test harness remain a queued follow-up (per `FREE-test-environment-setup-checklist.md` "what happens after").
- **Alternative (headless / pre-0.1.18):** `DYNAMICS_URL` in `.env.local` alongside the `DIRECTORY_*` values.

## Safety to say on camera
Read-only context only — ARIA uses CRM data to understand the customer, never to write back without approval.
One Entra app, least-privilege Application User, URL stored encrypted local-only.
