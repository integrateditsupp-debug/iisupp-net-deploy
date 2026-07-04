# Entra / Azure AD — 6-Click Quickstart (ARIA Sentinel)
*Your fast path. Also the script for the YouTube setup video — screenshot each step.*

You're signed into **entra.microsoft.com** with the **ARIA Sentinel** app already registered.

1. **Open the app** → Applications → App registrations → (if not under "Owned", click "View all applications in the directory") → click **ARIA Sentinel**.
2. **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Application permissions**.
3. Tick these 4 (read-only) → **Add permissions**: `User.Read.All`, `Group.Read.All`, `Device.Read.All`, `AuditLog.Read.All`.
4. Click **Grant admin consent for Default Directory** → **Yes** (green checks appear).
5. **Certificates & secrets** → **+ New client secret** → desc "ARIA Sentinel", expiry 24 mo → **Add** → **copy the Value** (shown once — keep it private).
6. **Overview** page → copy **Directory (tenant) ID** + **Application (client) ID**.

Then paste the 3 into ARIA Sentinel's Integrations → Entra **Configure** form (Tenant ID, Client ID, Secret) → **Test connection**. (Form ships in the updated build.)
