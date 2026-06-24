# RUN 17 Report — Audit-integrity security banner (small)

**Date:** 2026-06-20
**Result:** Persistent audit-tamper banner added to the Settings window. Suite **75 → 77** green. `node --check` clean. 0 new deps. Local only.

## What shipped
- **Banner** at the top of the Settings window (above the shell, so it persists across every tab), shown only when `state.auditIntegrity.ok === false` (set at session start by `verifyAuditIntegrity` in RUN 16):
  - Title: **"Security alert: Audit log tampered."**
  - Subtitle: **"Entries modified or removed at entry &lt;brokenAt&gt; · detected &lt;detectedAt&gt;"**
  - **View audit log** → jumps to the Privacy verifier tab (which hosts `#logList`) and scrolls to it.
  - **Dismiss** → hides for **this session only** (writes a `sessionStorage` flag); it never touches the `auditIntegrity` state, so the banner re-appears on the next launch while the finding still stands.
- **Styling** (`sentinel.css`): cyber-noir — deep red gradient field, gold `border-bottom`, glowing red Cinzel title, gold-light subtitle, gold/ghost buttons. Fixed to the top; the shell is offset (`body.has-security-banner`) only while the banner is visible. Visual record: `design-review/run17-security-banner.png`.

## Wiring
- Pure model in **`src/shared/security-banner.mjs`** (`bannerVisible`, `bannerModel`, `SECURITY_BANNER_DISMISS_KEY`) — DOM-free, unit-tested.
- `renderer.js` imports it; `renderSecurityBanner(state)` runs inside the existing `renderState` (driven by the existing `sentinel.onState` channel); `wireSecurityBanner()` binds the two buttons once.
- Dismiss uses `sessionStorage` only — **never** `localStorage` / electron-store, and never mutates `auditIntegrity`.

## Tests (+2 → 77)
- `tests/security-banner.test.mjs` — visibility logic, model text, markup-above-shell, renderer wiring, cyber-noir styling.
- `tests/security-banner-dismiss.test.mjs` — per-session semantics: dismissed-this-session hides; fresh session (next launch) re-shows; `sessionStorage` (not `localStorage`); integrity state untouched.

## Acceptance
- 77/77 suites green · banner verified visible in the cyber-noir theme (screenshot) · dismiss is per-session · **admin console untouched** (no regression — change is renderer-only). Local commit only; nothing pushed.
