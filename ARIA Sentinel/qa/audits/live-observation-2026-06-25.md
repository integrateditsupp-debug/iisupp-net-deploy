# ARIA Sentinel — Live Observation Record
**Date:** 2026-06-25 ~17:40 UTC  **By:** Cowork (Director), live desktop  **Type:** live smoke + environment check (RULE 13)

## Azure auth
- `Azure MCP subscription_list` → **200 Success** after Ahmad re-authenticated (previously 5x timeout). Auth wall cleared.
- Result `subscriptions: []` → signed-in identity has **no Azure resource subscription** (expected if IIS is Entra/M365-only). Azure MCP therefore enumerates no Azure resources.
- **Implication:** live *directory* (Entra) read still goes through **MS Graph** using the `DIRECTORY_*` app-registration creds, NOT Azure MCP. That live read remains pending the app secret being placed in Sentinel config (see Entra client setup guide).

## Sentinel live smoke (app open on desktop)
- ARIA Sentinel app **running**; "ARIA Sentinel Settings" window foreground.
- **System Inventory recipe is LIVE with real machine data** — installed software (Python, Realtek, Samsung, RipGrep, KillerControl) + Windows Defender Security Intelligence Update history (KB2267602, multiple versions) populated correctly. Confirms recipe engine pulls real local system data. ✅ functional.
- **UI quality flag (Ahmad):** views render as raw ungrouped dumps + a blank middle panel = "a mess." Logged as W5 cleanup task to CC.
- Did NOT drive deep click-through: desktop shared with an active LinkedIn job-app browser session; avoided UI thrash to not disrupt it.

## Blocked (Ahmad-side)
- Live Entra Graph read: needs `DIRECTORY_TENANT_ID/CLIENT_ID/CLIENT_SECRET` in Sentinel config.
- Full 3-mode + L1–L3 click-through live pass: needs the desktop free of the job-app session.

## Actions taken from this observation
- Queued CC packet **W5**: dedicated Integrations tab (ServiceNow/CRM/Entra/RSA/Word/Excel/PPT/OneNote) + whole-UI cleanup + test all.
