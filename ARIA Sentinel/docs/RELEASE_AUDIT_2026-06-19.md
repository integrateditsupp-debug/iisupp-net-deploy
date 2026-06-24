# ARIA Sentinel Release Audit - 2026-06-19

## Build

- Product: ARIA Sentinel
- Version: 0.1.0
- Build type: unsigned Windows NSIS internal pilot artifact
- Generated artifact: `ARIA Sentinel/dist/ARIA-Sentinel-0.1.0-unsigned.exe`
- Artifact size: 102,108,634 bytes
- Blockmap size: 107,718 bytes
- Last local artifact write: 2026-06-19 09:18:20 America/Toronto

## Hashes

| Artifact | SHA-256 |
|---|---|
| `ARIA-Sentinel-0.1.0-unsigned.exe` | `BDA18BFD5314FA56BD57ACBBD5FBCB72DDD41F52D4981F0BFE9CB596716D4DE7` |
| `ARIA-Sentinel-0.1.0-unsigned.exe.blockmap` | `9658C96CC46E26A10CEC95FF4A033384760D8A8CA12906104F62048D4BD3E7D5` |
| `ARIA Sentinel/package-lock.json` | `82FA01F01C9D41E8A2F68F70E04A73A0EBAF1C1C9AFFDD0FFCB2C9ADB5D5E542` |
| `apps/sentinel-desktop/package-lock.json` | `0A12D9C6C7BECA731D37492992EE6D9A91A3A54F67B7F35978A7A023EE460EB8` |
| `package-lock.json` | `6BCE9BD9097869F9E3676945ED4D000CB4139E76EF6232FB6397E0CD0CE3B2A2` |
| `package.json` | `B15824084AAE33951BB528D48588431621AAC32679862BD7DA235C505D0CDA55` |
| `.github/workflows/sentinel-release-gates.yml` | `1CC66EC6C1213C425C7FD5E05C7216EEF5328502C2CA898EB689F1777317DD40` |
| `sentinel-admin/index.html` | `76B150F222776FBEA54D3B12F78DC53E15961A2BC73DD5FD052A5BD6FB6D040C` |
| `aria-sentinel/docs/index.html` | `3C837898077CC6B5E57AD1BCA49005B088FE9FB3C7DC72749C4880D4E23404F2` |
| `tests/sentinel/public-pages.spec.mjs` | `BCFF7DFE67AB94590846ED8BD5FF71AB9E655A6743CD3AB666BCE0E3D4DEFDE5` |

## Local Verification Record

These gates were run locally during the 2026-06-19 A-Z Sentinel hardening pass and are also represented in `.github/workflows/sentinel-release-gates.yml`.

- `npm run sentinel:test`
- `npm run sentinel:prototype:test`
- `node tests/run-all-smoke.mjs`
- `npm run sentinel:public-pages:test`
- `npm run kb:test`
- `node tests/run-1000-scenarios.js`
- `node tests/run-10k-scenarios.js`
- `node tests/run-mega-scenarios.js`
- `npm ci --dry-run --ignore-scripts`
- `npm --prefix "ARIA Sentinel" ci --dry-run --ignore-scripts`
- `npm --prefix apps/sentinel-desktop ci --dry-run --ignore-scripts`
- `npm --prefix "ARIA Sentinel" run package:win`
- `npm audit --audit-level=moderate`
- `npm --prefix "ARIA Sentinel" audit --audit-level=moderate`
- `npm --prefix apps/sentinel-desktop audit --audit-level=moderate`
- `npm --prefix "ARIA Sentinel" test`
- `node --check` for `src/main`, `src/renderer` and `src/shared`
- Packaged `dist/win-unpacked/ARIA Sentinel.exe` bridge health/state smoke
- Packaged duplicate-launch smoke for `EADDRINUSE` regression
- Packaged `/self-diagnose`, `/self-repair`, `/signature`, `/detect` and `/chat` bridge probes
- Desktop and narrow-viewport renderer preview QA: 7 Settings tabs plus separate 13-item Admin console, no console errors, no text overflow
- Desktop/Admin split QA: Settings has 7 desktop tabs; Admin console is separate and has 13 screenshot nav options; no console errors or horizontal overflow.

## Results Snapshot

- Sentinel content-leak, sanitizer and policy gates: passed.
- Windows prototype scenario/extension/privacy/endpoint/UI shell suite: passed.
- Sentinel public docs/admin route gate: passed.
- KB query suite: 10 / 10 queries passed across 72 indexed articles.
- Site smoke suite: 27 pass, 0 fail, 121 skipped.
- 1,896 scenario classifier suite: 100%.
- 29,072 scenario classifier suite: 100%.
- Mega synthetic classifier suite: 327,647 / 332,163, or 98.6%.
- Root, prototype and canonical desktop dependency audits: 0 moderate-or-higher vulnerabilities at last run.
- Root, prototype and canonical desktop `npm ci` dry-runs: passed.
- Local scenario suite: 25 scenarios, 26 recipes, 25 stop-code mappings.
- Renderer shell: 13 tabs active with desktop and narrow-viewport visual QA.
- Renderer split: desktop Settings is no longer the admin dashboard; local Admin console carries the screenshot-style admin tabs.
- Packaged duplicate-launch regression: passed; second process exits cleanly and does not raise a JavaScript main-process dialog.
- Packaged bridge smoke: passed on `127.0.0.1:37841` with no conflict.
- Unsigned Windows package rebuild: passed.

## Audit Notes

- The installer is unsigned. SmartScreen warnings are expected.
- The artifact is for internal pilot and controlled demo use only.
- Public Netlify deploys must keep `ARIA Sentinel/`, `apps/`, `.github/` and `tests/` source folders blocked from static serving.
- Formal SAST, CodeQL, secret scanning, license scan and external penetration testing remain enterprise-launch blockers.
