# ARIA Autonomous Fix Engine — Suggestions

**Run:** 2026-07-07T12:10:19.144Z
**Total scenarios:** 39321
**Pass:** 37185 (94.6%)
**Fail:** 2136

## Top failure clusters + suggested fixes

### 1. password→default (370 scenarios)
**Examples:**
- `no puedo iniciar sesion`
- `No puedo iniciar sesion`
- `no puedo iniciar sesion ?`

**Common tokens:** puedo, iniciar, sesion

**Recommendation:** ADD PATTERNS TO password: tokens like {puedo, iniciar, sesion} should trigger password. Broaden the password regex.

---

### 2. kb:hardware→default (316 scenarios)
**Examples:**
- `laptop won t charge`
- `laptop won'r charge`
- `laptop won t turn on`

**Common tokens:** laptop, won, charge

**Recommendation:** ADD PATTERNS TO kb:hardware: tokens like {laptop, won, charge} should trigger kb:hardware. Broaden the kb:hardware regex.

---

### 3. kb:onboarding→default (210 scenarios)
**Examples:**
- `new nurse needs epic access set up`
- `new nurse needs epic access set up please`
- `new nurse needs epic access set up urgent`

**Common tokens:** new, nurse, needs, epic, access

**Recommendation:** ADD PATTERNS TO kb:onboarding: tokens like {new, nurse, needs, epic, access} should trigger kb:onboarding. Broaden the kb:onboarding regex.

---

### 4. kb:onedrive→default (158 scenarios)
**Examples:**
- `cant access shared clinical drive`
- `cant access shared clinical drive please`
- `clinical policy documents folder missing`

**Common tokens:** access, shared, clinical, drive

**Recommendation:** ADD PATTERNS TO kb:onedrive: tokens like {access, shared, clinical, drive} should trigger kb:onedrive. Broaden the kb:onedrive regex.

---

### 5. kb:performance→default (134 scenarios)
**Examples:**
- `my fan is spinning and the laptop is hot`
- `the laptop is running hot and loud`
- `epic is running slow today`

**Common tokens:** and, the, laptop, hot, running

**Recommendation:** ADD PATTERNS TO kb:performance: tokens like {and, the, laptop, hot, running} should trigger kb:performance. Broaden the kb:performance regex.

---

### 6. kb:networking→wifi (132 scenarios)
**Examples:**
- `hospital network down on floor 3`
- `hospital network down on floor 3 please`
- `ward network outage`

**Common tokens:** hospital, network, down, floor

**Recommendation:** ROUTING COLLISION: ARIA picks wifi but should pick kb:networking. Either reorder (put kb:networking check before wifi) or add negative lookahead.

---

### 7. vpn→default (98 scenarios)
**Examples:**
- `vpm wont conect`
- `vpm wont conect please`
- `vpm wont conect asap`

**Common tokens:** vpm, conect

**Recommendation:** ADD PATTERNS TO vpn: tokens like {vpm, conect} should trigger vpn. Broaden the vpn regex.

---

### 8. kb:networking→default (73 scenarios)
**Examples:**
- `ethernet not working at nurse station`
- `ethernet not working at nurse station please`
- `hospital lan down`

**Common tokens:** ethernet, not, working, nurse, station

**Recommendation:** ADD PATTERNS TO kb:networking: tokens like {ethernet, not, working, nurse, station} should trigger kb:networking. Broaden the kb:networking regex.

---

### 9. kb:mfa→default (66 scenarios)
**Examples:**
- `duo mobile not working for epic`
- `duo mobile not working for epic please`
- `duo mobile not working for epic urgent`

**Common tokens:** duo, mobile, not, working, for

**Recommendation:** ADD PATTERNS TO kb:mfa: tokens like {duo, mobile, not, working, for} should trigger kb:mfa. Broaden the kb:mfa regex.

---

### 10. printer→default (40 scenarios)
**Examples:**
- `prnter jammed again`
- `prnter jammed again please`
- `prnter jammed again asap`

**Common tokens:** prnter, jammed, again

**Recommendation:** ADD PATTERNS TO printer: tokens like {prnter, jammed, again} should trigger printer. Broaden the printer regex.

---

### 11. kb:permissions→default (30 scenarios)
**Examples:**
- `cannot access matter workspace on imanage`
- `cannot access matter workspace on imanage please`
- `cannot access matter workspace on imanage urgent`

**Common tokens:** cannot, access, matter, workspace, imanage

**Recommendation:** ADD PATTERNS TO kb:permissions: tokens like {cannot, access, matter, workspace, imanage} should trigger kb:permissions. Broaden the kb:permissions regex.

---

### 12. wifi→default (27 scenarios)
**Examples:**
- `wirless wont conect`
- `wirless wont conect please`
- `wirless wont conect asap`

**Common tokens:** wirless, conect

**Recommendation:** ADD PATTERNS TO wifi: tokens like {wirless, conect} should trigger wifi. Broaden the wifi regex.

---

### 13. mail→default (24 scenarios)
**Examples:**
- `mi correo no abre`
- `Mi correo no abre`
- `mi correo no abre ?`

**Common tokens:** correo, abre

**Recommendation:** ADD PATTERNS TO mail: tokens like {correo, abre} should trigger mail. Broaden the mail regex.

---

### 14. kb:mfa→kb:rsa (24 scenarios)
**Examples:**
- `rsa token broken clinical`
- `rsa token broken clinical please`
- `rsa token broken clinical urgent`

**Common tokens:** rsa, token, broken, clinical

**Recommendation:** ROUTING COLLISION: ARIA picks kb:rsa but should pick kb:mfa. Either reorder (put kb:mfa check before kb:rsa) or add negative lookahead.

---

### 15. kb:mfa→password (21 scenarios)
**Examples:**
- `duo push not arriving for hospital login`
- `duo push not arriving for hospital login please`
- `duo push not arriving for hospital login urgent`

**Common tokens:** duo, push, not, arriving, for

**Recommendation:** ROUTING COLLISION: ARIA picks password but should pick kb:mfa. Either reorder (put kb:mfa check before password) or add negative lookahead.

---

### 16. kb:onedrive→shopping (21 scenarios)
**Examples:**
- `deal room documents not syncing`
- `deal room documents not syncing please`
- `deal room documents not syncing urgent`

**Common tokens:** deal, room, documents, not, syncing

**Recommendation:** ROUTING COLLISION: ARIA picks shopping but should pick kb:onedrive. Either reorder (put kb:onedrive check before shopping) or add negative lookahead.

---

### 17. kb:onedrive→kb:permissions (20 scenarios)
**Examples:**
- `shared folder with patient protocols gone`
- `shared folder with patient protocols gone please`
- `shared folder for lab results not accessible`

**Common tokens:** shared, folder, patient, protocols, gone

**Recommendation:** ROUTING COLLISION: ARIA picks kb:permissions but should pick kb:onedrive. Either reorder (put kb:onedrive check before kb:permissions) or add negative lookahead.

---

### 18. kb:hardware→printer (16 scenarios)
**Examples:**
- `printer at compliance desk jammed`
- `printer at compliance desk jammed please`
- `printer at compliance desk jammed urgent`

**Common tokens:** printer, compliance, desk, jammed

**Recommendation:** ROUTING COLLISION: ARIA picks printer but should pick kb:hardware. Either reorder (put kb:hardware check before printer) or add negative lookahead.

---

### 19. kb:webcam→default (15 scenarios)
**Examples:**
- `my wabcam is frozen on calls`
- `my wabcam is frozen on calls please`
- `my wabcam is frozen on calls asap`

**Common tokens:** wabcam, frozen, calls

**Recommendation:** ADD PATTERNS TO kb:webcam: tokens like {wabcam, frozen, calls} should trigger kb:webcam. Broaden the kb:webcam regex.

---

### 20. password→printer (15 scenarios)
**Examples:**
- `fingerprint reader wont scan at desk`
- `fingerprint reader wont scan at desk please`
- `fingerprint reader wont scan at desk urgent`

**Common tokens:** fingerprint, reader, scan, desk

**Recommendation:** ROUTING COLLISION: ARIA picks printer but should pick password. Either reorder (put password check before printer) or add negative lookahead.

---

### 21. password→kb:m365 (15 scenarios)
**Examples:**
- `azure ad locked out at hospital`
- `azure ad locked out at hospital please`
- `azure ad locked out at hospital urgent`

**Common tokens:** azure, locked, out, hospital

**Recommendation:** ROUTING COLLISION: ARIA picks kb:m365 but should pick password. Either reorder (put password check before kb:m365) or add negative lookahead.

---

### 22. password→kb:active-directory (15 scenarios)
**Examples:**
- `active directory password reset needed clinic`
- `active directory password reset needed clinic please`
- `active directory password reset needed clinic urgent`

**Common tokens:** active, directory, password, reset, needed

**Recommendation:** ROUTING COLLISION: ARIA picks kb:active-directory but should pick password. Either reorder (put password check before kb:active-directory) or add negative lookahead.

---

### 23. kb:onedrive→wifi (14 scenarios)
**Examples:**
- `network drive unmapped at workstation`
- `network drive unmapped at workstation please`
- `client database not accessible on network drive`

**Common tokens:** network, drive, unmapped, workstation

**Recommendation:** ROUTING COLLISION: ARIA picks wifi but should pick kb:onedrive. Either reorder (put kb:onedrive check before wifi) or add negative lookahead.

---

### 24. kb:onboarding→password (12 scenarios)
**Examples:**
- `new pharmacist needs dispensing system login`
- `new pharmacist needs dispensing system login please`
- `new pharmacist needs dispensing system login urgent`

**Common tokens:** new, pharmacist, needs, dispensing, system

**Recommendation:** ROUTING COLLISION: ARIA picks password but should pick kb:onboarding. Either reorder (put kb:onboarding check before password) or add negative lookahead.

---

### 25. kb:mfa→vpn (12 scenarios)
**Examples:**
- `google authenticator not generating code for firm vpn`
- `google authenticator not generating code for firm vpn please`
- `google authenticator not generating code for firm vpn urgent`

**Common tokens:** google, authenticator, not, generating, code

**Recommendation:** ROUTING COLLISION: ARIA picks vpn but should pick kb:mfa. Either reorder (put kb:mfa check before vpn) or add negative lookahead.

---

