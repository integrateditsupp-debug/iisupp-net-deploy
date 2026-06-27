# ARIA Classifier — Breadth Gap-Close (2026-06-27)

Closes the routing gaps the 2026-06-27 breadth audit exposed, wires the 4 KB stubs
(hardware / mobile / office / ivanti) into the classifier, and ships the B5–B9 regex fixes.
**RULE 14: every number below is from `tests/run-breadth-coverage.cjs` on the full 338K corpus —
real, reproducible, no estimates.**

## Result

| Metric | Before | After |
|---|---|---|
| Taxonomy coverage (Part B) | 8 STRONG / 7 WEAK / 2 NONE | **17 STRONG / 0 WEAK / 0 NONE** |
| Full-corpus routing accuracy (Part A) | 98.64% | **99.02%** (UP) |
| 10k-scenario pass rate | 99.7% | 99.7% (held) |
| aria.html ↔ mirror parity | drift present (pre-existing macOS) | **0 drift / 30,197 samples** |
| New-route over-matches into genuine `default` | — | **0** |

Every previously-WEAK/NONE category is now STRONG (100% on its probes): hardware, RSA, Ivanti,
permissions, account-unlock, Office repair, mobile setup, Intune/Company-Portal, onboarding.

## Classifier changes (aria.html `classify()` + `tests/aria-classifier-mirror.js`, kept verbatim-in-sync)

New dedicated routes (each backed by a real article — no dead routes):
- **kb:rsa** — RSA SecurID token setup / app registration / resync / new fob.
- **kb:mobile** — iOS/Android work-email setup + MDM enrollment (setup/enroll intent only; malfunctions route elsewhere).
- **kb:hardware** — physical break/fix triage (power / display / input / dock); `wont boot` stays kb:windows.
- **kb:office** — Office/M365 app repair/reinstall (Word/Excel/PowerPoint/OneNote); Outlook stays `mail`.

B5–B9 (broaden existing routes, no new intents):
- **B5 Ivanti → vpn**: added `ivanti | ivanti secure access | pulse connect secure`.
- **B6 permissions**: file/folder/share block placed BEFORE wifi so "permission denied on the network drive" → kb:permissions.
- **B7 account-locked**: password regex broadened with `account (is )?locked | unlock my account | locked out of my account`.
- **B8 onboarding**: broadened with `deactivate a user account | provision a new employee | disable the user/account/access`.
- **B9 Company Portal → m365**: added `company portal`.

Also synced a pre-existing drift: added the early `kb:macos` guard to aria.html (so "macbook won't boot"
→ macOS not Windows), matching the tested mirror → 0 drift.

## No dead routes

- Inline `ARIA_KB` (aria.html `aria-kb-data`): **72 → 76** articles (added cat `hardware`, `mobile`,
  `office`, `rsa`); `INTENT_TO_CAT` maps each new intent to its cat → `kbForIntent()` always resolves an article.
- Master KB source markdown authored: `knowledge-base/L1/l1-hardware-001-triage.md`,
  `l1-mobile-001-setup-enroll.md`, `l1-office-001-repair-reinstall.md`, `knowledge-base/L2/l2-rsa-001-securid-token.md`.
  (Deeper RULE-16 L1/L2 split remains the Cowork "expand stubs" follow-up.)

## Honest corpus relabels (not metric-gaming)

The accuracy drop seen mid-work was traced (per-item) to corpus entries labelled `default` that are
genuinely hardware faults — they were only `default` because no hardware route existed:
- `tests/scenario-corpus-mega.js` TIER-3 hardware-vendor scenarios: each problem now carries its TRUE
  intent (kb:hardware for physical faults; kb:windows for BSOD; kb:bluetooth/webcam/usb/wifi/performance
  where a more-specific KB owns it).
- `tests/scenario-corpus.js` curated "uncategorized/default" block: 7 genuine hardware phrases
  (screen flickering, docking station, won't charge, battery dying, speakers crackling, won't turn on,
  no power) split out to kb:hardware; ambiguous/shell items left as `default`.

After relabel: residual over-matches into genuine `default` = **0**.

## Regression lock

- `tests/scenario-corpus.js`: a 21-probe NEW-ROUTES + B5–B9 regression block added to the base corpus.
- `tests/run-breadth-coverage.cjs`: accept-lists extended to include kb:hardware/kb:mobile/kb:office/kb:rsa.

## Recipe validation (Stage 7, logic) before auto-apply

The Windows-Update recipe (`restart-windows-update`) is logic-validated through the Stage-7
prove-before-prod gate before it can auto-apply: a real dry-run runs first; an unbound/blocked recipe
is rejected and never reaches prod; a failed restart is rolled back. See
`ARIA Sentinel/tests/stage7-tier0.test.mjs`.

**Not yet authored (Cowork packet items 3 & 4 — Codex authoring):** the dedicated multi-service
Windows-Update-stopped recipe (wuauserv + BITS + msiserver) and the **Hermes** corrupt-Electron/Squirrel
recipe. "Hermes" currently exists only as an agent-name test fixture — there is no recipe to validate.
When authored they MUST pass the Stage-7 gate (now the default real-execution path) before any auto-apply.
