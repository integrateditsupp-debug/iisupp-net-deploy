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

- **In 0.1.18 (recommended):** open **Integrations → Azure AD / Entra → Configure** and paste Tenant ID /
  Client ID / Client secret directly. They're encrypted on-device via Electron `safeStorage` (no file
  editing), then **Test connection** does a token flow + a read-only lookup and flips the badge to
  **Connected** only on a real 2xx — never faked. The secret field is masked, never echoed back, never logged.
  `[SCREENSHOT: Integrations → Entra → Configure panel]` · `[SCREENSHOT: Entra card → Test connection → Connected]`
- **Alternative (headless / pre-0.1.18):** place the same values in the app's `.env.local` that `main.mjs`
  `loadLocalEnv` reads — the providers read the identical env keys.

## Safety to say on camera
Read-only scopes only. Write actions (password reset / unlock) are a **separate, gated** step with a second
consent — never autonomous. The secret is stored encrypted locally, masked in the UI, never logged, and sent
only to Microsoft Graph's own token endpoint.
