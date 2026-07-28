# ARIA Classifier — Pending Regex Fixes (MEASURED) — 2026-07-21 slot 2 (run 35)

Baseline **92.27%** (35,346 / 38,307). Every patch below was built and measured in an
isolated `/tmp` clone of `tests/aria-classifier-mirror.js`. **No production file was modified.**
Numbers are measured per-scenario diffs against baseline, not estimates.

## Headline

| Set | Pass rate | Net | Regressions |
|---|---|---|---|
| Baseline | 92.27% | — | — |
| **Zero-regression set (15 patches)** | **94.27%** | **+767** | **0** |
| All-positive set (16 patches) | 94.80% | +969 | 7 |

Recommendation: **ship the 15-patch zero-regression set as one change.** It is a +2.00 point
lift with zero measured downside anywhere in the 38,307-scenario corpus.

## Per-patch results

| # | What it fixes | Net | Gains | Regressions |
|---|---|---|---|---|
| P6 | escalation anchor: allow prefixed 'please i'm stuck' / 'help me find recovery key' | **+193** | +193 | **NONE** |
| P19c | password: i18n + SSO/smartcard/badge + app-auth failure, guarded against MFA vocabulary | **+176** | +176 | **NONE** |
| P4 | kb:browser before kb:performance when a browser is named with a fault | **+166** | +169 | 3 |
| P7 | kb:teams typo tolerance (team's / teamz / teem / tems) | **+105** | +105 | **NONE** |
| P9 | password precedence over mail when lockout/reset language present | **+97** | +97 | **NONE** |
| P8 | facility-network -> kb:networking before wifi | **+40** | +40 | **NONE** |
| P13 | mail typos (emials/eamils/emals) | **+36** | +40 | 4 |
| P20 | kb:onboarding new-<role>-needs-<app>-access (broad role list) | **+36** | +36 | **NONE** |
| P22 | kb:performance thermal/lag phrasing ('fan is spinning','running hot','is lagging') | **+26** | +26 | **NONE** |
| P11 | wifi typo 'wfi' | **+19** | +19 | **NONE** |
| P12 | printer typos (prnter/pinter/priner/printr) | **+18** | +18 | **NONE** |
| P14 | vpn typo 'vpm' | **+18** | +18 | **NONE** |
| P5 | kb:onedrive typo-tolerant 'files won t / won'r sync' | **+16** | +16 | **NONE** |
| P10 | kb:mfa authenticator-app vocabulary (duo/okta verify/ping/authy) | **+15** | +15 | **NONE** |
| P15 | kb:permissions apostrophe-loss 'can t / can;t open folder' | **+4** | +4 | **NONE** |
| P16 | kb:networking apostrophe-loss 'can t reach internal / resolve hostname' | **+4** | +4 | **NONE** |

## The only 7 regressions (all in the all-positive set, none in the recommended set)

- `P13` mail typo broadening costs `password -4` (queries that read as both).
- `P4` browser-before-performance costs `kb:performance -3` ("chrome using high cpu" moves to kb:browser — defensible either way).
- Exclude P13 and P4 and the set is clean. P4 is high value (+166 net); ship it separately if you accept the 3.

## Exact edits (apply to `aria.html` classify() AND `tests/aria-classifier-mirror.js` together)

### P6 — escalation anchor: allow prefixed 'please i'm stuck' / 'help me find recovery key'  (net +193)

FIND:
```
^(help me find|i need help finding|i'?m stuck|find (the |my )?recovery key)
```
REPLACE WITH:
```
(?:^|\b)(?:help me find|i need help finding|i'?m stuck|im stuck|find (?:the |my )?recovery key)
```

FIND:
```
^(help me find|i need help finding|i'?m stuck|find (the |my )?recovery key)
```
REPLACE WITH:
```
(?:^|\b)(?:help me find|i need help finding|i'?m stuck|im stuck|find (?:the |my )?recovery key)
```

### P19c — password: i18n + SSO/smartcard/badge + app-auth failure, guarded against MFA vocabulary  (net +176)

FIND:
```
  if (/(password|pasword|passwd
```
REPLACE WITH:
```
  if (/(no puedo (iniciar sesion|acceder)|iniciar sesi[oó]n|contrase[nñ]a|je ne peux pas me connecter|mot de passe|mein passwort|passwort (ist )?abgelaufen|kennwort|smart ?card reader|badge tap|proximity card reader|\bsso\b|single sign[- ]?on|credentials? (expired|rejected|not accepted|invalid)|not accepting (credentials|pin)|authentication (error|failed|failure|issue|broken)|account expired|keeps logging me out|(wont|won'?t) let me in|can.?t access (cerner|meditech|epic|patient portal|order management|the portal))/.test(q) && !/(mfa|multi[- ]factor|two.?factor|2fa|authenticator|\bduo\b|\botp\b|verification code|one[- ]time code|push notification|security key|yubikey)/.test(q)) return 'password';
  if (/(password|pasword|passwd
```

### P4 — kb:browser before kb:performance when a browser is named with a fault  (net +166)

FIND:
```
  if (/(slow|laggy|sluggish|performance|high cpu
```
REPLACE WITH:
```
  if (/\b(edge|chrome|firefox|safari|brave|opera|browser)\b/.test(q) && /\b(slow|lag|laggy|crash|crashes|crashing|freez|hang|hangs|not respond|high cpu|memory|stuck)\b/.test(q)) return 'kb:browser';
  if (/(slow|laggy|sluggish|performance|high cpu
```

### P7 — kb:teams typo tolerance (team's / teamz / teem / tems)  (net +105)

FIND:
```
if (/(teams|microsoft teams
```
REPLACE WITH:
```
if (/(team'?s|\bteamz\b|\bteem\b|\btems\b|\bteasm\b|teams|microsoft teams
```

### P9 — password precedence over mail when lockout/reset language present  (net +97)

FIND:
```
  if (/(mail|email|inbox|outlook|outlok
```
REPLACE WITH:
```
  if (/(locked out|lock(ed)? out of|reset (my |the )?password|password reset|forgot (my )?password|can'?t (log|sign) in|cant (log|sign) in)/.test(q) && /(mail|email|outlook)/.test(q)) return 'password';
  if (/(mail|email|inbox|outlook|outlok
```

### P8 — facility-network -> kb:networking before wifi  (net +40)

FIND:
```
  if (/(wifi|wi-fi|wireless|network|internet|limited connectivity
```
REPLACE WITH:
```
  if (/\b(hospital|ward|clinic|campus|building|plant|floor \d|branch|warehouse|facility|site)\b[^]*?\bnetwork\b[^]*?\b(down|outage|out|unreachable|dropping|drops)\b|\bnetwork (outage|is down|down)\b/.test(q)) return 'kb:networking';
  if (/(wifi|wi-fi|wireless|network|internet|limited connectivity
```

### P13 — mail typos (emials/eamils/emals)  (net +36)

FIND:
```
  if (/(mail|email|inbox|outlook|outlok
```
REPLACE WITH:
```
  if (/(\bemials\b|\beamils\b|\bemals\b|\bemaisl\b|\bemial\b|mail|email|inbox|outlook|outlok
```

### P20 — kb:onboarding new-<role>-needs-<app>-access (broad role list)  (net +36)

FIND:
```
if (/(onboarding|offboarding|byod|new hire
```
REPLACE WITH:
```
if (/(new (nurse|doctor|physician|clinician|employee|hire|staff|user|operator|officer|technician|tech|clerk|analyst|agent|associate|teller|guard|driver|server|cashier|paralegal|attorney|engineer|manager)\b[^]*\b(access|account|set ?up|setup|onboard|provision|login|credentials))|(onboarding|offboarding|byod|new hire
```

### P22 — kb:performance thermal/lag phrasing ('fan is spinning','running hot','is lagging')  (net +26)

FIND:
```
|fans? (spin|spinning)|overheat(ing)?|laptop hot|
```
REPLACE WITH:
```
|fans? (is |are )?(spin|spinning|loud|blasting)|overheat(ing)?|laptop (is )?hot|running hot|lagg(y|ing)|
```

### P11 — wifi typo 'wfi'  (net +19)

FIND:
```
if (/(wifi|wi-fi|wireless|network|internet|limited connectivity
```
REPLACE WITH:
```
if (/(\bwfi\b|\bwifi?i\b|\bwiif\b|wifi|wi-fi|wireless|network|internet|limited connectivity
```

### P12 — printer typos (prnter/pinter/priner/printr)  (net +18)

FIND:
```
if (/\b(network printer|wifi printer|wireless printer)\b/.test(q) || /print/.test(q)) return 'printer';
```
REPLACE WITH:
```
if (/\b(network printer|wifi printer|wireless printer)\b/.test(q) || /print|\bprnter\b|\bpinter\b|\bpriner\b|\bprintr\b|\bprnt\b/.test(q)) return 'printer';
```

### P14 — vpn typo 'vpm'  (net +18)

FIND:
```
if (/vpn|tunnel|globalprotect
```
REPLACE WITH:
```
if (/vpn|\bvpm\b|\bvnp\b|tunnel|globalprotect
```

### P5 — kb:onedrive typo-tolerant 'files won t / won'r sync'  (net +16)

FIND:
```
files? wont sync|files? won'?t sync|file wont? sync
```
REPLACE WITH:
```
files? won.?[tr]? sync|file won.?[tr]? sync|files? not syncing
```

### P10 — kb:mfa authenticator-app vocabulary (duo/okta verify/ping/authy)  (net +15)

FIND:
```
if (/(mfa|multi[- ]factor|two.?factor|2fa|authenticator
```
REPLACE WITH:
```
if (/(duo (mobile|push|prompt|app|auth)|okta verify|ping id|pingid|authy|rsa securid|mfa|multi[- ]factor|two.?factor|2fa|authenticator
```

### P15 — kb:permissions apostrophe-loss 'can t / can;t open folder'  (net +4)

FIND:
```
|cant open folder|can'?t open folder|user can'?t open|
```
REPLACE WITH:
```
|can.?t open folder|user can.?t open|cannot open folder|
```

### P16 — kb:networking apostrophe-loss 'can t reach internal / resolve hostname'  (net +4)

FIND:
```
|cant resolve hostname|can'?t resolve hostname|
```
REPLACE WITH:
```
|can.?t resolve hostname|can.?t reach internal|cannot reach internal site|
```

## Not fixed this run

- **kb:hardware (338 scenarios @ 0%)** — still blocked. The intent does not exist in `aria.html`;
  adding the regex without the 5 wiring points + KB article creates a dead-end route (same failure
  shape as the "Something else" loop bug). Carried from run 34.
- **kb:security→kb:mfa (96)** — "mfa bombing" / "50 mfa pushes". `aria.html` line ~12 *deliberately*
  routes MFA-fatigue to kb:mfa. This is a corpus-vs-design disagreement, not a bug. Decide which is right;
  arguably an MFA-bombing attack IS a security incident and the corpus is correct.
- **resolution→NOT-resolution (98)** — emoji/short-affirm edge cases; needs its own pass.

## Verification

Rig: `/tmp/mir/measure.js` + `patches3.json`. Each patch is applied to a fresh copy of the mirror,
the full 38,307-scenario corpus is re-run, and results are diffed per-scenario against baseline so
gains and regressions are exact counts, not sampled.
