# RUN 16 §D — Security battery results (2026-06-19)
**Suite:** tests/security-battery.test.mjs · **Status:** PASS
- Hardened BrowserWindows: contextIsolation:true + nodeIntegration:false everywhere; no remote module; webSecurity never disabled.
- No eval / Function constructor in main or preload; preload never leaks raw ipcRenderer.
- CSP in every renderer HTML. Constant-time HMAC (timingSafeEqual) for license + admin session.
- Admin auth env-var only, bcrypt-validated, refuses when unconfigured, no hardcoded credential.
- Destructive-command denylist holds even on a green recipe with full authority + restore point; dry-run never executes; nothing runs without explicit allowSystemFixes.
- eslint-plugin-security NOT added — hand-rolled static checks cover the same rule intents at zero new dependency.
