# ARIA Classifier Pending Fixes — 2026-06-30 (slot 1)

**Run:** Tuesday 2026-06-30 | **Corpus:** 39,321 | **Pass rate:** 94.6% | **Fail:** 2,136
**Measured against:** working-HEAD classifier (cc/run-a-a1 — includes unpushed `industryIntentOverride` + full 39,321 corpus).

> These fixes require changes to the **aria.html** classifier patterns.
> DO NOT auto-apply. Ahmad approval required per safety rule (NEVER modify aria.html classifier without review).
> Auto-applied this run: **0** (all 25 clusters are under-routing/collisions — none qualify as safe corpus expectation flips).

## ⚠️ RECONCILIATION NEEDED (drift surfaced this run)
- `origin/main` is **behind** working-HEAD on BOTH corpus and classifier logic.
  - main's committed `run-stats.json` claims 39,321 @ 94.6%, but main's actual corpus yields **38,307 @ 92.1%**, and main's classifier + the full 39,321 corpus yields **88.9%**.
  - working-HEAD (mount) yields the real **94.6%** because it carries the unpushed `INDUSTRY_APP_HINTS` + `industryIntentOverride()` block and the complete vertical corpus.
- **Action for CC/Ahmad:** merge the working-HEAD aria.html + mirror + corpus to main so deployed classifier == tested classifier (keeps tests honest, Rule 14). The mirror must NOT be pushed ahead of aria.html.

---

## Root causes (25 clusters → 3 mechanisms + collisions). Fixing all ≈ 94.6% → ~99.3% (~1,855 scenarios).

### ROOT 1 — Spanish-language inputs (no i18n in classifier) · ~394 scen
| # | Cluster | Count | Example | Recommended aria.html fix |
|---|---------|-------|---------|---------------------------|
| S1 | password→default | 370 | "no puedo iniciar sesion" | Add Spanish auth aliases to password regex: `puedo iniciar sesion`, `contrasena`, `clave`, `bloqueado` |
| S2 | mail→default | 24 | "mi correo no abre" | Add Spanish mail aliases to mail regex: `correo`, `correo electronico`, `bandeja`, `no abre` |

### ROOT 2 — Typo tolerance gaps · ~180 scen
| # | Cluster | Count | Example | Recommended aria.html fix |
|---|---------|-------|---------|---------------------------|
| T1 | vpn→default | 98 | "vpm wont conect" | Add typo variants to vpn: `vpm`, `conect`, `conexion`, `vpn wont conect` |
| T2 | printer→default | 40 | "prnter jammed again" | Add typo variants to printer: `prnter`, `priner`, `prntr` |
| T3 | wifi→default | 27 | "wirless wont conect" | Add typo variants to wifi: `wirless`, `wirelss`, `wifii` |
| T4 | kb:webcam→default | 15 | "my wabcam is frozen on calls" | Add typo variants to kb:webcam: `wabcam`, `web cam frozen` |

### ROOT 3 — Vertical vocabulary not yet mapped (industryIntentOverride gaps) · ~1,037 scen
| # | Cluster | Count | Example | Recommended aria.html fix |
|---|---------|-------|---------|---------------------------|
| V1 | kb:hardware→default | 316 | "laptop won t charge" | Add `won t charge`, `won't turn on`, `wont power` + vertical HW (WOW cart, POS terminal, kiosk) to kb:hardware |
| V2 | kb:onboarding→default | 210 | "new nurse needs epic access set up" | Add vertical titles+verbs: `new {nurse,pharmacist,clerk} needs {app} access/set up` to kb:onboarding |
| V3 | kb:onedrive→default | 158 | "cant access shared clinical drive" | Add vertical drive names to kb:onedrive: clinical drive, deal room, matter folder, SOP folder |
| V4 | kb:performance→default | 134 | "epic is running slow / laptop is hot" | Add thermal/slow-app framing to kb:performance: fan spinning, running hot/loud, `{app} slow` |
| V5 | kb:networking→default | 73 | "ethernet not working at nurse station" | Add vertical net phrases to kb:networking: nurse station, ward, hospital LAN, store LAN |
| V6 | kb:mfa→default | 66 | "duo mobile not working for epic" | Add app-specific MFA framing to kb:mfa: `duo+{app}`, `authenticator+{app}` |
| V7 | kb:permissions→default | 30 | "cannot access matter workspace on imanage" | Add legal terms to kb:permissions: iManage, matter workspace, NetDocuments |

### ROOT 4 — Routing-order collisions (reorder / negative lookahead) · ~197 scen
| # | Cluster | Count | ARIA picks → should be | Recommended aria.html fix |
|---|---------|-------|------------------------|---------------------------|
| C1 | kb:networking→wifi | 132 | wifi → kb:networking | Put kb:networking (ethernet/LAN/"network down") check before wifi |
| C2 | kb:mfa→kb:rsa | 24 | kb:rsa → kb:mfa | REVIEW: kb:rsa may be the correct label for "rsa token" — possible corpus fix, not aria.html |
| C3 | kb:mfa→password | 21 | password → kb:mfa | Put kb:mfa (`duo push`, `authenticator`) before password |
| C4 | kb:onedrive→shopping | 21 | shopping → kb:onedrive | Add negative lookahead: "deal room/documents" must not hit shopping |
| C5 | kb:onedrive→kb:permissions | 20 | kb:permissions → kb:onedrive | Put kb:onedrive ("shared folder/drive") before kb:permissions for file-access phrasing |
| C6 | kb:hardware→printer | 16 | printer → kb:hardware | "printer ... jammed" is hardware-adjacent; reorder or scope printer to print-job terms |
| C7 | password→printer | 15 | printer → password | "fingerprint reader wont scan" → password (auth), not printer |
| C8 | password→kb:m365 | 15 | kb:m365 → password | "azure ad locked out" → password reset path before m365 |
| C9 | password→kb:active-directory | 15 | kb:active-directory → password | "AD password reset" → password before kb:active-directory |
| C10 | kb:onedrive→wifi | 14 | wifi → kb:onedrive | "network drive unmapped" → kb:onedrive, not wifi |
| C11 | kb:onboarding→password | 12 | password → kb:onboarding | "new {role} needs login" → onboarding before password |
| C12 | kb:mfa→vpn | 12 | vpn → kb:mfa | "authenticator code for vpn" → kb:mfa before vpn |

---
**Next:** CC to apply ROOT 1+2 first (cheap, high-yield i18n+typo, ~574 scen, ~+1.5pts), then ROOT 3 vertical maps (~1,037 scen, ~+2.6pts), then ROOT 4 collisions (~197 scen). Re-run harness after each ROOT to confirm no regression before merge.
