# ARIA Autonomous Fix Engine — Suggestions

**Run:** 2026-06-26T04:11:15.484Z
**Total scenarios:** 34209
**Pass:** 34106 (99.7%)
**Fail:** 103

## Top failure clusters + suggested fixes

### 1. printer→default (27 scenarios)
**Examples:**
- `prnter jammed again`
- `prnter jammed again please`
- `prnter jammed again asap`

**Common tokens:** prnter, jammed, again

**Recommendation:** ADD PATTERNS TO printer: tokens like {prnter, jammed, again} should trigger printer. Broaden the printer regex.

---

### 2. wifi→default (21 scenarios)
**Examples:**
- `wirless wont conect`
- `wirless wont conect please`
- `wirless wont conect asap`

**Common tokens:** wirless, conect

**Recommendation:** ADD PATTERNS TO wifi: tokens like {wirless, conect} should trigger wifi. Broaden the wifi regex.

---

### 3. vpn→default (18 scenarios)
**Examples:**
- `vpm wont conect`
- `vpm wont conect please`
- `vpm wont conect asap`

**Common tokens:** vpm, conect

**Recommendation:** ADD PATTERNS TO vpn: tokens like {vpm, conect} should trigger vpn. Broaden the vpn regex.

---

### 4. kb:bluetooth→default (9 scenarios)
**Examples:**
- `blutooth wont pair`
- `blutooth wont pair please`
- `blutooth wont pair asap`

**Common tokens:** blutooth, pair

**Recommendation:** ADD PATTERNS TO kb:bluetooth: tokens like {blutooth, pair} should trigger kb:bluetooth. Broaden the kb:bluetooth regex.

---

### 5. kb:webcam→default (9 scenarios)
**Examples:**
- `my wabcam is frozen on calls`
- `my wabcam is frozen on calls please`
- `my wabcam is frozen on calls asap`

**Common tokens:** wabcam, frozen, calls

**Recommendation:** ADD PATTERNS TO kb:webcam: tokens like {wabcam, frozen, calls} should trigger kb:webcam. Broaden the kb:webcam regex.

---

### 6. password→default (9 scenarios)
**Examples:**
- `no puedo iniciar sesion`
- `No puedo iniciar sesion`
- `no puedo iniciar sesion ?`

**Common tokens:** puedo, iniciar, sesion

**Recommendation:** ADD PATTERNS TO password: tokens like {puedo, iniciar, sesion} should trigger password. Broaden the password regex.

---

### 7. not-resolution→resolution (4 scenarios)
**Examples:**
- `perfect, no luck`
- `ok perfect, no luck`
- `oh perfect, no luck`

**Common tokens:** perfect,, luck

**Recommendation:** ROUTING COLLISION: ARIA picks resolution but should pick not-resolution. Either reorder (put not-resolution check before resolution) or add negative lookahead.

---

### 8. mail→default (3 scenarios)
**Examples:**
- `mi correo no abre`
- `Mi correo no abre`
- `mi correo no abre ?`

**Common tokens:** correo, abre

**Recommendation:** ADD PATTERNS TO mail: tokens like {correo, abre} should trigger mail. Broaden the mail regex.

---

### 9. kb:performance→default (2 scenarios)
**Examples:**
- `my fan is spinning and the laptop is hot`
- `the laptop is running hot and loud`

**Common tokens:** and, the, laptop, hot

**Recommendation:** ADD PATTERNS TO kb:performance: tokens like {and, the, laptop, hot} should trigger kb:performance. Broaden the kb:performance regex.

---

### 10. password→mail (1 scenarios)
**Examples:**
- `cant sign in to my email`

**Common tokens:** sign, email

**Recommendation:** ROUTING COLLISION: ARIA picks mail but should pick password. Either reorder (put password check before mail) or add negative lookahead.

---

