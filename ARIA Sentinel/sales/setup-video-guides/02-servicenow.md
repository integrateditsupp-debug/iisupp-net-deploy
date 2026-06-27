# Setup Video — ServiceNow (ITSM) connector
*Build/config script. Cowork screenshots each `[SCREENSHOT]` while driving developer.servicenow.com + the app.*

**Outcome:** ARIA Sentinel reads ServiceNow incidents/changes **read-only** and can open the incident bridge.
**Time:** ~8 minutes (most of it is the PDI provisioning wait). **Cost:** $0 with a Personal Developer Instance.

---

## What you need before recording
- A free **ServiceNow Personal Developer Instance (PDI)** — see `dev-docs/FREE-test-environment-setup-checklist.md` §3.

## Steps (record each)

1. **Request the PDI.** developer.servicenow.com → sign in → **Request Instance** → pick the current release.
   Note the **instance URL** (e.g. `https://devXXXXX.service-now.com`) + the admin credentials shown.
   `[SCREENSHOT: instance details — blur the admin password in post]`

2. **Create a read-scoped integration user** (least privilege — do **not** reuse the admin login for the connector):
   - **User Administration → Users → New** → user ID `aria.integration`, set a strong password, **Web service access only** = true.
   - Assign a **read-only** role limited to the ITSM tables ARIA reads (e.g. an `itil`-read or a custom role with read on `incident`, `change_request`). No write/delete.
   `[SCREENSHOT: the integration user + its read-only role]`

3. *(Optional, OAuth instead of basic)* **System OAuth → Application Registry → New → Create an OAuth API endpoint for external clients**; capture the client ID/secret. Basic auth with the read-only user is sufficient for the read-only Test connection.
   `[SCREENSHOT: OAuth app registry (if used)]`

## Wire it into ARIA Sentinel (current 0.1.17 build)

```
SN_INSTANCE_URL = https://devXXXXX.service-now.com
SN_USER         = aria.integration
SN_PASS         = <read-only user's password>
```

- **In 0.1.18 (recommended):** **Integrations → ServiceNow → Configure** → paste Instance URL / integration
  user / password (the password field is masked + encrypted via `safeStorage`, never echoed or logged) →
  **Save** → **Test connection** runs a read-only sample (open-incident count). The **Manage incidents →**
  link opens the incident bridge. Badge stays **Not configured** (grey) until a real read succeeds — never faked.
  `[SCREENSHOT: ServiceNow → Configure panel]` · `[SCREENSHOT: Test connection → open-incident count]`
- **Alternative (headless / pre-0.1.18):** the same `SN_INSTANCE_URL` / `SN_USER` / `SN_PASS` in `.env.local`.
- **PDI housekeeping note for the video:** a PDI is reclaimed after ~10 idle days — log in weekly to keep it.

## Safety to say on camera
Read-only first: ARIA *proposes* ticket actions; it never auto-writes a change without per-customer approval.
The integration user is least-privilege (read-only on ITSM tables), credentials encrypted local-only and sent
only to your ServiceNow instance.
