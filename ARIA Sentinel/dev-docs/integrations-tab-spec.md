# ARIA Sentinel — Integrations Tab + UI Cleanup Build Spec
**Owner:** CC (build)  **Author:** Cowork (Director)  **Date:** 2026-06-25  **Ref:** queue packet W5

Build blueprint for the W5 packet. Follow the contracts here so cards/tests are uniform.

## 1. Navigation
- Add ONE left-nav entry: **Integrations** (icon: plug/link). Place it directly under "ServiceNow"
  if that nav item exists — then REMOVE the standalone ServiceNow nav item (it becomes a card).
- Route/view id: `integrations`. Keep ARIA chat tab, Dashboard, Control Center, Recipes,
  Compliance, Reports, Knowledge, System, Settings intact.

## 2. The Integrations view = a responsive grid of cards
Order the cards in two groups with headers:

**Group A — "Identity & Service" (Integrated edition):**
1. ServiceNow — "ITSM tickets, incidents, change requests."
2. CRM — "Customer records & deal context (Dynamics / HubSpot)."
3. Azure AD / Microsoft Entra ID — "Directory: users, groups, lockouts, devices (read-only first)."
4. RSA admin — "ID verification & token admin — middleman only, never biometrics."

**Group B — "Microsoft 365 Documents":**
5. MS Word — "Read/generate .docx (reports, guides)."
6. Excel — "Read/generate .xlsx (inventories, exports)."
7. PowerPoint — "Generate .pptx (client decks)."
8. OneNote — "Read/append notes."

## 3. Card component contract
Each card renders from a uniform descriptor:
```
{
  id: 'servicenow' | 'crm' | 'entra' | 'rsa' | 'word' | 'excel' | 'powerpoint' | 'onenote',
  name, icon, description,            // static
  edition: 'integrated' | 'any',      // gating
  status: 'connected'|'not_configured'|'error',  // from provider.getStatus()
  statusDetail: string,               // e.g. "Token OK, read-only" or "Creds missing"
  testConnection(): Promise<{ok:boolean, message:string}>  // read-only health check
}
```
- Status badge colors: connected=green, not_configured=grey, error=red.
- "Test connection" button: disabled in Slice 1; enabled in Slice 2. On click → call
  `testConnection()`, show inline pass/fail + message, never throw to a crash.
- Edition gating: if app edition === 'standalone', hide all `edition:'integrated'` cards
  (don't grey them — hide, so Standalone looks clean).

## 4. Provider wiring (reuse, don't reinvent)
- ServiceNow → existing `src/shared/servicenow.mjs` health check.
- Entra/Azure AD → existing `src/shared/directory.mjs` + `entra-graph-client.mjs`. Status =
  `not_configured` when DIRECTORY_TENANT_ID/CLIENT_ID/CLIENT_SECRET unset; `connected` when a
  read-only token + sample read succeed; `error` on token/scope failure.
- CRM, RSA → no adapter yet. Create thin stubs `src/shared/crm.mjs`, `src/shared/rsa-admin.mjs`
  each exporting `getStatus()` → 'not_configured' and `testConnection()` → {ok:false,'Not configured'}.
- Word/Excel/PPT/OneNote → if an office/Graph adapter exists, use it; else stub
  `src/shared/office-msgraph.mjs` with per-app `getStatus()`/`testConnection()` returning
  'not_configured' cleanly. (We already ship docx/xlsx/pptx generation elsewhere — wire later.)

## 5. Tests — `tests/integrations.test.mjs`
- Each of the 8 descriptors exists, has required fields, valid edition + status enum.
- Standalone edition hides the 4 integrated cards; Integrated shows all 8.
- `testConnection()` on a stubbed provider returns {ok:false} without throwing.
- Run with the existing `tests/run-all.mjs` harness; keep the suite green.

## 6. UI cleanup pass (Slice 3) — "no more mess"
Ahmad reviewed the live build and called it "a lot of mess." Fix across views:
- **System Inventory:** the flat dump of installed software + Defender updates → group by
  category (Apps / Drivers / Security updates), collapsible sections, a count per group,
  a search/filter box. Remove the blank dead panel in the middle.
- **Settings:** group settings under clear headers; consistent row height + spacing.
- Global: consistent card/section styling, real headings, no raw unstyled lists, no empty panels.
- Keep the black+gold ARIA theme.

## 7. Slices (ship in order, stop after each for review)
- **Slice 1:** nav + 8 static cards + status badges from existing checks + stubs. Screenshot.
- **Slice 2:** enable Test connection (read-only) per provider + integrations.test.mjs green.
- **Slice 3:** UI cleanup pass (System Inventory + Settings + global).

## 8. Hard gates (STOP — Ahmad only)
- No live writes to directory/RSA/ServiceNow. Read-only health checks only.
- No paid SDKs/APIs, no external sends, no Netlify publish.
- Entra app registration + admin consent = Ahmad's tenant-admin action.
- Build in /tmp clone (mount git index corrupt); origin is truth; verify line counts.

## 9. Definition of done
8 cards, uniform status + Test connection, edition-gated, tests green, UI cleaned,
screenshots captured (feed the client setup guide + sales deck).
