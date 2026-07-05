# ARIA Sentinel — project instructions

> **AXIS** is the voice layer that will eventually wrap the Sentinel shell. Read `aria-vault/07_Cortex/AXIS.md` before any voice-related work. AXIS uses `SENTINEL_ADMIN_TOKEN` for any admin endpoints (same as Sentinel — single source of admin truth). The Phase-1 voice-in scaffold lives in `axis/` (stubs only; see `axis/README.md` + `axis/docs/ARCHITECTURE.md`).

## What this is
Privacy-first Electron desktop agent (Windows/macOS) + Chrome/Edge/Safari MV3 extensions + a local admin console + project-local Netlify functions, for Integrated IT Support Inc. See `README-MVP.md`.

## Working rules
- **Tests:** `npm test` runs `tests/run-all.mjs`. Keep every suite green; add a suite per new feature. `node --check` all touched `.mjs`/`.cjs`/`.js`.
- **Zero new runtime deps** (electron-updater is the one documented exception). Hand-roll utilities (ZIP, PDF, HMAC) with node built-ins.
- **Privacy invariants UNCHANGED:** content-blind sanitization; the 6-host telemetry allowlist + update/ARIA-brain outbound paths in `src/shared/network-capture.mjs` must not grow without an explicit test.
- **Customer build (`npm run package:win`) excludes** admin-console, tests, fixtures, design-review, docs, and `axis/` — `build.files` is an allow-list of customer paths only.
- **Local commits only** — never push/publish/upload binaries (Cowork handles git).
- Preview customer-facing visual changes before applying. Never break ARIA / Aperture / Sentinel runtime.
- The RUN 17 audit-tamper security banner must keep working (`tests/security-banner*.test.mjs`).

## 2026-07-05 active handoff
- Ahmad asked for Sentinel to proactively warn/prevent user mistakes, starting with `.txt` files being associated with Adobe/Acrobat instead of Notepad.
- Live machine check: `C:\Users\Ahmad Wasee\Desktop\ARIA sentinel test.xml.txt` exists; current `.txt` `UserChoice` resolves to Microsoft Windows Notepad; `Acrobat.exe` is present only in OpenWith history.
- Codex added `src/shared/file-association-guard.mjs`, recipes, read-only startup/60-second interval/autonomous-mode scans, manual scan IPC, globe prompts, and `Fix in Settings` remediation. Verified `227/227` suites green and rebuilt `dist/win-unpacked/ARIA Sentinel.exe`.
- Do not silently write default-app registry/UserChoice keys. Safe behavior is scan -> notify/list -> user-approved one-by-one remediation. True "block before commit" needs a future shell-extension/policy/endpoint hook.
