# ARIA Classifier Pending Fixes — 2026-06-29 (slot 2)

**Run:** Sunday 2026-06-29 slot 2 | **Corpus:** 39,321 | **Pass rate:** 94.6% | **Fail:** 2,136

> These fixes require changes to aria.html classifier patterns.
> DO NOT auto-apply. Ahmad approval required per safety rule.

---

## A-TYPE: Regex Broadens (expected=specific, got=default)

| # | Cluster | Count | Example | Recommended Fix |
|---|---------|-------|---------|-----------------|
| A1 | password→default | 354 | "no puedo iniciar sesion" | Add Spanish auth phrases + EMR/vertical app names to password regex |
| A2 | kb:hardware→default | 260 | "laptop won t charge" | Add typo variants (won t, wont, wont') + vertical HW terms (WOW cart, POS terminal, kiosk) |
| A3 | kb:onboarding→default | 177 | "new nurse needs epic access set up" | Add vertical job titles: nurse, cashier, operator, server, dealer, therapist |
| A4 | kb:onedrive→default | 137 | "cant access shared clinical drive" | Add vertical drive names: clinical drive, matter folder, sop folder, planogram folder, banquet event order |
| A5 | kb:performance→default | 116 | "my fan is spinning and the laptop is hot" | Add thermal/slow-app framing: fan spinning, laptop hot, running loud, EMR slow |
| A6 | vpn→default | 98 | "vpm wont conect" | Add typo variants: vpm, vpm, vpm wont, conect, connexion |
| A7 | kb:networking→default | 67 | "ethernet not working at nurse station" | Add vertical networking phrases: nurse station, ward, hospital LAN, store LAN, floor network |
| A8 | kb:mfa→default | 57 | "duo mobile not working for epic" | Add app-specific MFA framing: duo+app-name, authenticator+app-name |
| A9 | printer→default | 40 | "prnter jammed again" | Add typo variants: prnter, priner, prirter |
| A10 | kb:permissions→default | 30 | "cannot access matter workspace on imanage" | Add legal/vertical terms: iManage, matter workspace, void transaction |
| A11 | wifi→default | 24 | "wirless wont conect" | Add typo variants: wirless, wirelss, wifii |
| A12 | mail→default | 24 | "mi correo no abre" | Add Spanish email phrases: correo, correo electronico, bandeja |
| A13 | kb:webcam→default | 15 | "my wabcam is frozen on calls" | Add typo variants: wabcam, webcam frozen |
| A14 | password→kb:permissions | 10 | "refinitiv eikon access denied" | Access denied for financial apps → expect password not permissions |

## B-TYPE: Routing Collisions (expected=A, got=B)

| # | Cluster | Count | Example | Recommended Fix |
|---|---------|-------|---------|-----------------|
| B1 | kb:networking→wifi | 108 | "hospital network down on floor 3" | networking should take precedence when "floor N" present; reorder patterns |
| B2 | kb:mfa→password | 21 | "duo push not arriving for hospital login" | duo/authenticator-specific → kb:mfa, not password; tighten password regex |
| B3 | kb:mfa→kb:rsa | 21 | "rsa token broken clinical" | rsa token → kb:mfa not kb:rsa; rsa pattern too broad |
| B4 | kb:onedrive→shopping | 21 | "deal room documents not syncing" | "deal room" triggers shopping; add onedrive check before shopping |
| B5 | kb:onedrive→kb:permissions | 17 | "shared folder with patient protocols gone" | "shared folder gone" → onedrive not permissions |
| B6 | password→printer | 15 | "fingerprint reader wont scan at desk" | fingerprint reader → hardware/password not printer |
| B7 | password→kb:m365 | 15 | "azure ad locked out at hospital" | azure ad lockout → password not m365 |
| B8 | password→kb:active-directory | 15 | "active directory password reset needed clinic" | ad password reset → password intent takes precedence |
| B9 | kb:onedrive→wifi | 14 | "network drive unmapped at workstation" | network drive → onedrive not wifi |
| B10 | kb:hardware→printer | 12 | "printer at compliance desk jammed" | when "printer jammed/not printing" → printer intent wins |
| B11 | kb:hardware→shopping | 12 | "shop floor terminal frozen on production line" | "shop floor" triggers shopping; add mfg context check |

---

## Hospitality Vertical New Gaps (this run)

New failures from hospitality layer exposing:
- opera pms / micros pos / agilysys / mews → not in auth regex → password→default (+~40)
- kitchen display screen / room key encoder / casino chip dispenser → not in hw regex → kb:hardware→default (+~35)
- hotel back of house network → kb:networking→wifi collision (+~15)
- new front desk agent / new restaurant server / new spa therapist → kb:onboarding→default (+~25)

---

## Impact Summary

Approving A1+B1+A2+A3 alone recovers ~699 failures → ~96.4% pass rate  
Approving all A+B = ~99.8% pass rate target

**⚠️ ARIA HTML MUST NOT BE TOUCHED without Ahmad approval — per safety rule.**
