# ARIA Classifier — Pending Regex Fixes (HUMAN REVIEW REQUIRED)

**Run:** 2026-06-26T04:11:15Z (autonomous classifier loop, run #22)
**Harness:** tests/run-10k-scenarios.js — 34,209 scenarios, 99.7% pass (34,106 / 103 fail)
**aria.html touched:** NO. Nothing below was auto-applied. All require approval.
**Delta from last run:** 0.0% (stable at 99.7% — same 10 clusters, carryover from 2026-06-21 adversarial layer)

---

## Safe auto-applied corpus flips: 0
All 10 failure clusters are expected=specific → got=default (regex broaden) or routing collisions.
Zero qualify as safe expectation-flip.

---

## Category B: Pattern Broadens (require aria.html edits)

### 1. printer +27
- Examples: `prnter jammed again`
- Fix: add `|prntr?e?r|jammed` to printer regex
- Risk: LOW

### 2. wifi +21
- Examples: `wirless wont conect`
- Fix: add `|wirles+|conect` to wifi regex
- Risk: LOW

### 3. vpn +18
- Examples: `vpm wont conect`
- Fix: add `|vpm\b` to vpn regex (vpm → vpn typo)
- Risk: LOW

### 4. kb:bluetooth +9
- Examples: `blutooth wont pair`
- Fix: add `|blu?tooth|blutoo` to bluetooth regex
- Risk: LOW

### 5. kb:webcam +9
- Examples: `my wabcam is frozen on calls`
- Fix: add `|wabcam|web\s*cam\b.*froz` to webcam regex
- Risk: LOW

### 6. password +9 (i18n — Spanish)
- Examples: `no puedo iniciar sesion`
- Fix: add `|iniciar\s+sesion|contrase[nñ]a` to password regex OR defer to localization sprint
- Risk: MEDIUM (i18n scope; defer recommended)

### 7. kb:performance +2
- Examples: `my fan is spinning and the laptop is hot`, `the laptop is running hot and loud`
- Fix: add `fan.*spin|running hot|laptop.*hot` to performance regex
- Risk: LOW

### 8. mail +3 (i18n — Spanish)
- Examples: `mi correo no abre`
- Fix: add `|correo\b` to mail regex OR defer to localization sprint
- Risk: MEDIUM (i18n scope; defer recommended)

---

## Category C: Routing Collisions (require reorder or lookahead)

### 9. not-resolution vs resolution +4
- Examples: `perfect, no luck` (expected=not-resolution, got=resolution)
- Fix: check for negative outcome words before firing resolution; e.g. `(?=.*\bno luck\b)` negative lookahead in resolution pattern
- Risk: MEDIUM (modify resolution precedence)

### 10. password vs mail +1
- Examples: `cant sign in to my email`
- Fix: password check should run before mail when `sign in` appears with `email`; add negative lookahead or reorder
- Risk: LOW-MEDIUM

---

## Recommended Action (Ahmad)

If you want to clear all 103 remaining fails in one pass, approve fixes 1–5+7 (typo broadens, low risk, +84 scenarios fixed).
Fixes 6+8 (i18n ES) and fixes 9–10 (routing collisions) can follow in a second pass.

**Total recoverable if ALL applied: 103 (→ 100%)**

Apply via aria.html directly. After edit, run:
```
cd tests && node run-10k-scenarios.js
```
Confirm 100%, then commit + Netlify publish.
