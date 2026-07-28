# ARIA classifier — pending fixes (2026-07-28, slot 3)

Status: **MEASURED, NOT APPLIED.** No edit was made to `aria.html`. Everything below was
measured against `tests/aria-classifier-mirror.js` over the full 38,307-scenario corpus.

## Baseline

- 38,307 scenarios, 35,346 pass, 2,961 fail → **92.27%**

## Zero-regression patch set (ready for review)

File: `tests/aria-classifier-measured-patches-2026-07-28-slot3-combined.json` (19 patches)

Applying the whole set: **36,573 / 38,307 = 95.47%** — net **+1,227**, gain 1,227, **regressions 0**.

| Patch | Net | Gains |
|---|---|---|
| P30-hardware-v3 (new `kb:hardware` intent) | +269 | kb:hardware |
| P6 escalation prefix anchors | +193 | escalation |
| P19c password i18n / SSO / smartcard | +176 | password |
| P7 kb:teams typo tolerance | +105 | kb:teams |
| P31-resolution-v1 | +101 | resolution, not-resolution |
| P9 password precedence over mail | +97 | password |
| **P33-antimalware-perf (new this slot)** | **+48** | kb:performance |
| **P34-deactivate-onboarding (new this slot)** | **+48** | kb:onboarding |
| P8 facility-network → kb:networking | +40 | kb:networking |
| P20 kb:onboarding role/app access | +36 | kb:onboarding |
| P32 contraction normalisation | +28 | 6 intents |
| P22 kb:performance thermal phrasing | +26 | kb:performance |
| P11 / P12 / P14 / P10 / P5 / P15 / P16 typo + vocab | +76 | mixed |

### New this slot

**P33-antimalware-perf** — `kb:security` was swallowing `antimalware service executable high cpu`
because the `malware` token matches inside `antimalware`. Fix: negative lookbehind `(?<!anti)malware`.
Anchor: `|malware|ransomware|trojan` on the security rule.

**P34-deactivate-onboarding** — `deactivate user` / `provision user` sit in the `kb:m365` rule, which
runs before `kb:onboarding`, so `need to deactivate user` routed to licensing. Fix: remove those two
tokens from `kb:m365`; `kb:onboarding` already owns them.
Anchor: `|deactivate user|provision user|new hire (account|license))`.

## Excluded (carry regressions — do NOT ship as-is)

- **P4** kb:browser before kb:performance — +169 kb:browser but **−3 kb:performance**
- **P13** mail typo tolerance — +40 mail but **−4 password**

Including both reaches 95.75% but breaks 7 previously-passing scenarios. Needs a guard rewrite.

## Residual clusters after the zero-regression set (next targets)

| Count | Cluster | Read |
|---|---|---|
| 169 | kb:browser→kb:performance | needs the guarded P4 rewrite |
| 168 | kb:onboarding→default | `resident needs emr access provisioned` — role list still short |
| 153 | kb:onedrive→default | `cant access shared clinical drive` — share/drive vocab missing |
| 98 | kb:networking→wifi | `clinical network dropping` — facility qualifiers |
| 96 | kb:security→kb:mfa | **expectation dispute** — `mfa bombing` is an attack; classifier deliberately routes to kb:mfa. Ahmad to decide which is correct before either side changes. |
| 93 | kb:hardware→default | `portable device wont charge` — extend P30 |
| 54 | kb:onedrive→password | `onedrive keeps prompting for password` — password rule needs a OneDrive guard |
| 48 | wifi→kb:networking | **corpus is likely wrong** — `dhcp not assigning ip` is genuinely kb:networking |

## Auto-applied this run

None. Every top-25 cluster resolves to a regex change, not a safe expectation flip, so nothing was
auto-applied per the loop's safety rules.

## Approval needed

Ahmad: approve porting the 19-patch zero-regression set into `aria.html`'s `classify()` /
`looksLikeResolution()`. Expected effect on the mirror corpus is 92.27% → 95.47% with zero measured
regressions.
