# ARIA Sentinel — 4-hour pass QA screenshots (2026-06-19)

Captured automatically via `scripts/capture-qa.mjs` (Electron `webContents.capturePage()`),
rendering each real surface. Re-run any time with:

```
node_modules/.bin/electron scripts/capture-qa.mjs
```

| File | Surface |
|---|---|
| `01_globe-floating.png` | Floating globe (overlay, idle SVG, 6-state) |
| `03_fix-card-detected.png` | Fix card — DISK · LOW SPACE, detected state (verbatim copy) |
| `04_admin-console-overview.png` | Admin console — Overview (unchanged) |
| `05_admin-console-recipes.png` | Admin console — Recipes panel (view-switch works) |
| `06_chrome-ext-popup.png` | Chrome extension popup chrome |
| `07_settings-mode.png` | Settings — Mode tab (no menubar, navy+gold) |
| `08_settings-privacy.png` | Settings — Privacy verifier + restore points + transparency log |
| `09_settings-servicenow.png` | Settings — ServiceNow + My-incidents panel |

## Captured live by a person (not scriptable headlessly)
- **Tray context menu** — right-click the gold tray globe; menu shows Open settings /
  Show globe / Open admin console / Update knowledge / Pause 24h / Privacy verifier /
  Simulate ARIA detection / Quit. (Native OS menu — not capturable via `capturePage`.)
- **Chrome extension in-page globe** — load `chrome-extension/` unpacked, visit any site;
  the in-page globe + "This page looks stale" card render bottom-right. (Needs a live
  browser + page context.)
