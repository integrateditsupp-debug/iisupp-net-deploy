# ARIA Classifier Pending Fixes — 2026-06-28 (Sunday Slot 3 — Run #28 FINAL)

**Generated:** 2026-06-28T17:30Z  
**Corpus:** 38,490 scenarios (+3,267 total Sunday growth: Healthcare+Finance+Legal+Gov+Mfg)
**Pass rate:** 95.5% (36,760 / 38,490) — 25 active clusters below

_See full cluster analysis at bottom of this file (slot3 section)._

---

# Previous runs this Sunday (slots 1 & 2)

**Slot 1 — Run #26 (Healthcare vertical):**
**Corpus:** 36,954 scenarios (+1,263 Healthcare + 468 Finance verticals added this Sunday)  
**Pass rate:** 97.4% (35,995 / 36,954)  
**Fail count:** 959  
**Safe auto-applies:** 0 (no expected=default→got=specific clusters)  
**All clusters below require aria.html regex changes — HUMAN REVIEW required before apply.**

---

## CATEGORY A — Regex Broadens (pattern too narrow, misses typos/new app names)

### A1. password→default [303 failures] ★★★ HIGH IMPACT
**Examples:** "no puedo iniciar sesion", "bloomberg terminal login not working", "market data system password expired"  
**Root cause:** Password regex doesn't cover Spanish ("puedo","iniciar","sesion") or financial app names (Bloomberg, Murex, Fidessa, OMS, Refinitiv, FactSet, Charles River IMS).  
**Suggested fix:** Add to password intent:
```
/puedo.*iniciar|iniciar.*ses[ií]on|sesion.*no.*abre?/i
/bloomberg.*login|trading.*platform.*login|oms.*login|murex.*login|fidessa.*auth/i
/market.*data.*password|treasury.*password|swift.*credential/i
/core.*banking.*login|digital.*banking.*locked|brokerage.*login/i
```
**Expected lift:** +303 scenarios → ~99.2% pass rate if combined with other fixes.

---

### A2. kb:hardware→default [113 failures] ★★★ HIGH IMPACT
**Examples:** "laptop won t charge", "trading desk monitor not displaying", "bloomberg b-unit not recognized"  
**Root cause:** Hardware regex misses: (a) typo "won t" for "won't", (b) financial hardware terms (trading desk monitor, Bloomberg B-unit, squawk box, turret phone, ticker screen, WOW cart from HC layer).  
**Suggested fix:** Add to kb:hardware:
```
/won[' ]?t (charge|turn on|boot)|laptop.*won[' ]?t/i
/trading.*desk.*monitor|bloomberg.*b.unit|bloomberg.*keyboard/i
/squawk.*box|turret.*phone|ticker.*screen|video.*wall.*trading/i
/ekg.*machine|wow.*cart|barcode.*scanner.*(broken|not work)/i
/dealing.*desk.*micro|headset.*trading.*desk/i
```
**Expected lift:** +113 scenarios.

---

### A3. vpn→default [62 failures] ★★ MEDIUM IMPACT
**Examples:** "vpm wont conect", "remote trading vpn not connecting", "vpn drops when accessing bloomberg"  
**Root cause:** VPN regex misses "vpm" typo and finance-context VPN phrases.  
**Suggested fix:** Add to vpn:
```
/vpm\s+(wont|won[' ]?t|not|cant)/i
/remote.*trading.*vpn|vpn.*bloomberg|vpn.*trading.*floor/i
/citrix.*disconnect.*trader|trader.*vpn.*timeout/i
```
**Expected lift:** +62 scenarios.

---

### A4. kb:performance→default [59 failures] ★★ MEDIUM IMPACT
**Examples:** "my fan is spinning and the laptop is hot", "bloomberg is lagging during market hours", "order management system running slow"  
**Root cause:** Performance regex misses fan/heat signals and financial app slowness.  
**Suggested fix:** Add to kb:performance:
```
/fan.*(spinning|loud|running)|laptop.*(hot|overheating)/i
/bloomberg.*(lag|slow|freeze)|trading.*platform.*freeze/i
/order.*management.*slow|market.*data.*delay|oms.*slow/i
/murex.*slow|factset.*slow|equity.*screen.*slow|risk.*system.*slow/i
/citrix.*(performance|degraded|slow).*trader/i
```
**Expected lift:** +59 scenarios.

---

### A5. kb:onboarding→default [57 failures] ★★ MEDIUM IMPACT
**Examples:** "new nurse needs epic access set up", "new trader needs bloomberg terminal access", "junior analyst needs factset provisioned"  
**Root cause:** Onboarding regex doesn't know healthcare staff types (nurse, pharmacist, clinician) or finance roles (trader, analyst, quant, broker).  
**Suggested fix:** Add to kb:onboarding:
```
/new.*(nurse|doctor|clinician|pharmacist|locum|agency.*nurse)/i
/new.*(trader|analyst|quant|broker|portfolio.*manager|risk.*analyst)/i
/(bloomberg|factset|refinitiv|oms|murex).*access.*(set up|provision|new)/i
/new.*hire.*(trading|compliance|analyst|clinical)/i
```
**Expected lift:** +57 scenarios.

---

### A6. kb:onedrive→default [41 failures] ★★ MEDIUM IMPACT
**Examples:** "cant access shared clinical drive", "shared research folder not accessible for analyst", "deal room documents not syncing"  
**Root cause:** OneDrive regex misses clinical and finance file-access phrases.  
**Suggested fix:** Add to kb:onedrive:
```
/shared.*(clinical|research|compliance|deal.*room).*drive/i
/(equity|financial|pitch|investment).*model.*(missing|gone|folder)/i
/(deal.*room|research.*repo).*not.*sync/i
/shared.*folder.*(patient|lab|protocol|p&l|clinical)/i
```
**Expected lift:** +41 scenarios.

---

### A7. kb:networking→default [31 failures] ★★ MEDIUM IMPACT
**Examples:** "ethernet not working at nurse station", "market data feed not arriving at desk", "trading floor network switch down"  
**Root cause:** Networking regex misses nurse-station/hospital ethernet and finance market-data-feed terms.  
**Suggested fix:** Add to kb:networking:
```
/ethernet.*(nurse.*station|clinical|ward)/i
/market.*data.*feed.*(not|down|miss|delay)/i
/trading.*floor.*network|lan.*treasury|co.location.*network/i
/dark.*fiber|cross.connect|udp.*feed.*drop|multicast.*(not reach|drop)/i
```
**Expected lift:** +31 scenarios.

---

### A8. printer→default [31 failures] ★★ MEDIUM IMPACT
**Examples:** "prnter jammed again", "trade tickets not printing on floor"  
**Root cause:** Printer regex misses "prnter" typo and finance print context.  
**Suggested fix:** Add to printer:
```
/prnter|pritnter|prnitr/i
/trade.*ticket.*not.*print|compliance.*report.*not.*print/i
/settlement.*statement.*printer|clearing.*confirmation.*not.*print/i
```
**Expected lift:** +31 scenarios.

---

### A9. kb:mfa→default [21 failures] ★ LOW-MEDIUM IMPACT
**Examples:** "duo mobile not working for epic", "trading platform mfa push not arriving"  
**Root cause:** MFA regex misses Duo/Epic context and finance-app 2FA phrases.  
**Suggested fix:** Add to kb:mfa:
```
/duo.*(mobile|push).*(epic|hospital|clinic|trading|brokerage)/i
/trading.*platform.*mfa|mfa.*push.*(trading|oms|bloomberg)/i
/soft.*token.*(oms|citrix|trading)|authy.*(financial|trading)/i
```
**Expected lift:** +21 scenarios.

---

### A10. wifi→default [21 failures] ★ LOW-MEDIUM IMPACT
**Examples:** "wirless wont conect", "trading floor wireless signal weak"  
**Root cause:** WiFi regex misses "wirless" typo and trading-floor wireless context.  
**Suggested fix:** Add to wifi:
```
/wirless|wifii|wfi/i
/wireless.*(trading.*floor|trading.*desk|dealer.*desk)/i
```
**Expected lift:** +21 scenarios.

---

## CATEGORY B — Routing Collisions (wrong intent wins due to pattern ordering)

### B1. kb:networking→wifi [30 failures]
"hospital network down on floor 3", "ward network outage"  
→ ARIA picks wifi (network keyword) over kb:networking.  
**Fix:** Put hospital/ward/floor network check BEFORE wifi broad match.

### B2. password→printer [15 failures]
"fingerprint reader wont scan at desk"  
→ ARIA picks printer ("scan"). Fingerprint = biometric auth = password.  
**Fix:** Add negative lookahead to printer scan → exclude "fingerprint.*scan".

### B3. password→kb:m365 [15 failures]
"azure ad locked out at hospital"  
→ ARIA picks kb:m365. "locked out" = password reset.  
**Fix:** "locked out" + "azure ad" → password wins.

### B4. password→kb:active-directory [15 failures]
"active directory password reset needed clinic"  
→ ARIA picks kb:active-directory. Explicit "password reset" should win.  
**Fix:** "password reset" check BEFORE active-directory match.

### B5. kb:onboarding→password [9 failures]
"new pharmacist needs dispensing system login"  
→ ARIA picks password. "new [role] needs [system] login" = onboarding.  
**Fix:** "new [person] needs [system] login/access" → kb:onboarding priority.

### B6. kb:onedrive→kb:permissions [8 failures]
"shared folder with patient protocols gone"  
→ ARIA picks kb:permissions. Clinical/finance shared drive = kb:onedrive context.  
**Fix:** Add clinical/finance drive context to kb:onedrive before kb:permissions.

### B7. kb:hardware→wifi [6 failures]
"ekg machine network issue"  
→ ARIA picks wifi. Medical/financial hardware with "network issue" = kb:hardware.  
**Fix:** ekg/medical-device/trading-terminal context check before wifi broad match.

### B8. kb:mfa→kb:rsa [6 failures]
"rsa token broken clinical"  
→ ARIA picks kb:rsa. Clinical context = kb:mfa intent.  
**Fix:** "rsa token broken [clinical/hospital]" → kb:mfa.

### B9. not-resolution→resolution [4 failures]
"perfect, no luck"  
→ ARIA picks resolution ("perfect"). "perfect, no luck" = negation.  
**Fix:** resolution "perfect" requires absence of following "no luck / didn't work".

### B10. kb:performance→kb:webcam [3 failures]
"telemedicine video call quality bad"  
→ ARIA picks kb:webcam. Telemedicine video quality = kb:performance.  
**Fix:** Telemedicine video quality → kb:performance.

### B11. kb:mfa→password [3 failures]
"duo push not arriving for hospital login"  
→ ARIA picks password. Duo push = MFA issue.  
**Fix:** "duo push" check BEFORE password login match.

### B12. kb:onboarding→mail [3 failures]
"agency nurse needs email account"  
→ ARIA picks mail. New staff needing email = onboarding.  
**Fix:** "new/agency [role] needs email account" → kb:onboarding.

---

## Impact Summary

| Category | Clusters | Scenarios | If All Applied |
|----------|----------|-----------|----------------|
| A (regex broadens) | 10 | 682 | ~99.2% |
| B (routing collisions) | 12 | 277 | ~99.9% |
| **Combined** | **22** | **~959** | **~99.8%** |

## Priority Order (descending ROI)
1. **A1** — password Spanish + finance apps (+303)
2. **A2** — kb:hardware typo + trading HW (+113)
3. **A7** — kb:networking hospital + market data (+31)
4. **A8** — printer typo + finance print (+31)
5. **A4** — kb:performance finance lag (+59)
6. **A5** — kb:onboarding clinical/finance roles (+57)
7. **B2+B3+B4+B11** — password collision cluster (+33 combined)
8. Remaining A/B clusters

## Finance Vertical Insights (new this run)
ARIA has zero financial app vocabulary. Key gaps:
- Bloomberg, Murex, Fidessa, OMS, Refinitiv, FactSet → all fall to `default`
- Trading-floor hardware (B-unit, squawk

---

# SLOT 3 — Run #28 Full Cluster Analysis (38,490 corpus, 95.5%)

## CATEGORY A — Regex Broadens (expected=specific, got=default)

**A1 · password · +348 hits ← HIGHEST IMPACT**
Gaps: Spanish auth ("no puedo iniciar sesion"), vertical app names (epic/imanage/clio/phoenix/maximo/mes/gcdocs/gckey/relativity/westlaw/lexisnexis)
Fix: Add to password regex: `epic|cerner|imanage|netdocs|clio|phoenix.*pay|maximo|plex|epicor|sap.*login|mes.*login|gcdocs|gckey|relativity|westlaw|lexisnexis|puedo.*iniciar|iniciar.*sesion|correo.*no.*abre`

**A2 · kb:hardware · +224 hits**
Gaps: shop floor terminals, RF terminals, barcode scanners, ruggedized devices, kofax scanner, forklift computers, panel PCs, "laptop won t charge" typo
Fix: `shop.floor.terminal|rf.terminal|handheld.terminal|panel.pc|rugged.*laptop|barcode.scanner|kofax|fujitsu.*scanner|forklift.*computer|won.{0,2}t.charge|won.{0,2}t.turn.on`

**A3 · kb:onboarding · +150 hits**
Gaps: vertical job titles (nurse/operator/technician/officer/paralegal/associate/inspector/pharmacist/clerk/auditor/trader/attorney/counsel) not triggering onboarding
Fix: `new\s+(nurse|operator|technician|paralegal|associate|officer|analyst|inspector|supervisor|trader|lawyer|attorney|counsel|pharmacist|clerk|auditor|contractor|student|articling|lateral).*needs`

**A4 · kb:onedrive · +125 hits**
Gaps: clinical drive, matter folder, sop folder, gcdocs folder, engineering drawings, deal room docs, policy folder, work instructions
Fix: `clinical.drive|matter.folder|sop.folder|gcdocs.folder|engineering.draw|shared.deal.room|policy.documents.folder|maintenance.procedure.folder|work.instruction|calibration.records`

**A5 · kb:performance · +110 hits**
Gaps: "fan is spinning and the laptop is hot", "laptop running hot and loud", vertical-specific slowness (epic/relativity/mes/sap/phoenix/plex/imanage/gcdocs slow)
Fix: `fan.*spin|running.*hot|laptop.*hot|epic.*slow|relativity.*slow|mes.*slow|sap.*slow|phoenix.*slow|plex.*slow|maximo.*slow|imanage.*slow|gcdocs.*slow`

**A6 · vpn · +95 hits**
Gaps: "vpm" typo, gc secure remote access, goc vpn, pulse secure gc
Fix: `vpm\b|gc.*remote.access|goc.*vpn|pulse.secure.*not|secure.remote.access.*broken`

**A7 · kb:networking · +61 hits** (→default, separate from B1 wifi collision)
Gaps: "ethernet not working at nurse station", "hospital lan down", "plant floor network down", "industrial network switch", "gc network down", "firm network down"
Fix: `ethernet.*(nurse|station|plant|floor|attorney|officer)|hospital.*lan|plant.*floor.*network|industrial.*ethernet|gc.*network.*down|firm.*network.*down`

**A8 · kb:mfa · +54 hits**
Gaps: "duo mobile not working for epic/imanage/plant/gc", "mfa token expired for plant erp", "two factor authentication not working for mes"
Fix: `duo.*(epic|imanage|plant|gc|relativity|mes)|mfa.*(epic|plant|gc)|two.factor.*mes`

**A9 · printer · +40 hits**
Gaps: "prnter" typo, thermal label printers, zebra printers
Fix: `prnter|thermal.*label.*printer|zebra.*printer|label.*printer.*(jammed|not.*print|offline)`

**A10 · mail · +24 hits**
Gaps: "mi correo no abre", "gc email not delivering", "compliance email not delivering"
Fix: `mi.*correo|correo.*no.*abre|gc.*email.*not.*deliver|compliance.*email.*not`

---

## CATEGORY B — Routing Collisions

**B1 · kb:networking → wifi · +87 hits ← HIGH IMPACT**
"hospital network down on floor 3", "ward network outage", "plant floor network down" → fires wifi instead
Fix: Add `hospital.*network|ward.*network|plant.*network` as kb:networking BEFORE wifi check, or add negative lookahead in wifi

**B2 · kb:permissions → default · +21 hits**
"cannot access matter workspace on imanage", "ethics wall blocking file access", "document vault access denied"
Fix: `matter.workspace|dms.*access.denied|ethics.wall|sealed.matter|document.vault.*denied`

**B3 · password → printer · +15 hits**
"fingerprint reader wont scan at desk" → printer (because "scan")
Fix: `fingerprint.*reader` should match password; add negative lookahead in printer for "fingerprint"

**B4 · password → kb:m365 · +15 hits**
"azure ad locked out at hospital" → m365
Fix: `azure.*ad.*locked.*out` → password should precede m365 check

**B5 · password → kb:active-directory · +15 hits**
"active directory password reset needed clinic" → AD
Fix: When "password reset" is explicit, password should win over AD routing

**B6 · kb:onboarding → password · +9 hits**
"new pharmacist needs dispensing system login" → password
Fix: new-employee context rule fires before password check

**B7 · kb:mfa → kb:rsa · +9 hits**
"rsa token broken clinical" → rsa when should be mfa
Fix: Reorder mfa before rsa OR add clinical/hospital/plant context exclusion in rsa

**B8 · kb:onboarding → mail · +6 hits**
"agency nurse needs email account" → mail
Fix: `new.*(nurse|hire|associate|employee|operator).*needs.*email.account` → onboarding

**B9 · kb:mfa → password · +6 hits**
"duo push not arriving for hospital login" → password
Fix: `duo.*push` → always mfa, add explicit match

**B10 · kb:onedrive → kb:permissions · +8 hits**
"shared folder with patient protocols gone" → permissions
Fix: "gone"+"missing"+"disappeared" with folder context → onedrive; "access denied" → permissions

**B11 · not-resolution → resolution · +4 hits**
"perfect, no luck" → resolution (word "perfect" matches)
Fix: Add `no luck|still not|didn.t work|no joy` as negative signal after resolution words

**B12 · default → trade · +6 hits** ← REJECT AUTO-APPLY
"how to submit a trade error report" → trade; corpus says default (compliance Q, not IT)
ARIA over-triggering on "trade". Fix: Negative pattern `how.*(submit|file|report).*trade.*error` → skip trade intent

---

## RECOMMENDED PRIORITY ORDER
1. B1 (networking→wifi, +87) — ordering fix only
2. A1 (password+verticals, +348) — regex expand
3. A3 (onboarding job titles, +150) — keyword list
4. A2 (hardware+verticals, +224) — keyword list
5. B3+B4+B5 (password collision group, +45) — ordering
6. A4+B10 (onedrive+permissions, +133) — paired fix
7. A5 (performance fan/heat+verticals, +110) — regex
8. A6 (vpn typo+gov, +95) — 2 additions
9. B6+B8+B9 (onboarding/mfa collisions, +21) — ordering
10. B12 (trade error false-positive, +6) — negative lookahead

**Estimated impact if all applied: 95.5% → ~99.5% pass rate**

---

_Sunday total growth: +3,267 scenarios (Healthcare+Finance+Legal+Gov+Mfg)_
_Run #28 complete. Next auto-run ~8h. ARIA/Aperture untouched. No spend incurred._
