# Setup Video — Microsoft Entra ID (Azure AD) directory connector
*Build/config script. Cowork screenshots each `[SCREENSHOT]` while driving entra.microsoft.com + the app.*

**Outcome:** ARIA Sentinel reads your directory (users, groups, devices, sign-in/lockout audit) **read-only**.
**Time:** ~6 minutes. **Cost:** $0 (works against a free Entra tenant). **One Entra app also covers Dynamics + Office docs.**

---

## What you need before recording
- A tenant where you are **Global Admin** (a free Microsoft Entra ID tenant is fine — see `dev-docs/FREE-test-environment-setup-checklist.md` §1).
- 2–3 test users + 1–2 groups in that tenant (so there is data to read back).

## Steps (record each)

1. **Register the app.** entra.microsoft.com → **Identity → Applications → App registrations → + New registration**.
   Name **`ARIA Sentinel`**, **Single tenant**, no redirect URI → **Register**.
   `[SCREENSHOT: registration form]`

2. **Copy the two IDs.** On the app **Overview**, copy **Directory (tenant) ID** and **Application (client) ID**.
   `[SCREENSHOT: Overview with both IDs]`

3. **Add read-only Graph scopes.** **API permissions → + Add a permission → Microsoft Graph → Application permissions**.
   Add exactly these four (read-only):
   ```
   User.Read.All
   Group.Read.All
   Device.Read.All
   AuditLog.Read.All
   ```
   `[SCREENSHOT: the 4 permissions listed]`
   *(Optional, for the Office-docs cards: also add `Files.Read.All`, `Notes.Read.All`.)*

4. **Grant admin consent.** **Grant admin consent for <tenant>** → **Yes**. Confirm green check marks.
   `[SCREENSHOT: green "Granted" state]`

5. **Create the client secret.** **Certificates & secrets → + New client secret** → description `ARIA Sentinel`,
   expiry 24 months → **Add** → **copy the Value immediately** (shown once).
   `[SCREENSHOT: secret created — blur the value in post]`

## Wire it into ARIA Sentinel (current 0.1.17 build)

The three values map to the env the directory provider reads:

```
DIRECTORY_TENANT_ID   = <Directory (tenant) ID>
DIRECTORY_CLIENT_ID   = <Application (client) ID>
DIRECTORY_CLIENT_SECRET = <secret Value>
```

- **Today (0.1.17):** place these in the app's secure config / `.env.local` in the app data folder that
  `main.mjs` `loadLocalEnv` reads. The **Integrations → Azure AD / Entra** card then shows live read-only
  status; **Test connection** does a token flow + a read-only lookup and flips the badge to **Connected**
  only on a real 2xx — never faked.
  `[SCREENSHOT: Integrations tab → Entra card → Test connection → Connected]`
- **Coming (creds-form follow-up):** the in-app **Configure** panel (Tenant/Client/Secret fields, encrypted
  via Electron `safeStorage`) lets you paste these directly in the UI — no file editing. Not in 0.1.17.

## Safety to say on camera
Read-only scopes only. Write actions (password reset / unlock) are a **separate, gated** step with a second
consent — never autonomous. The secret is stored encrypted locally, masked in the UI, never logged, and sent
only to Microsoft Graph's own token endpoint.
