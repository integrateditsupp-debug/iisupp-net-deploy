# ARIA Classifier — Pending Regex Fixes (HUMAN REVIEW REQUIRED)

**Run:** 2026-06-25T20:12:36Z (autonomous classifier loop, run #21)
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
- Fix: add `|prntr?e?r|jammed` to printer regex  Risk: LOW

### 2. wifi +21
- Examples: `wirless wont conect`
- Fix: add `|wirles+|conect` to wifi regex  Risk: LOW

### 3. vpn +18
- Examples: `vpm wont conect`
- Fix: add `|vpm\b` to vpn regex  Risk: LOW

### 4. kb:bluetooth +9
- Examples: `blutooth wont pair`
- Fix: add `|bluto+th` to bluetooth regex  Risk: LOW

### 5. kb:webcam +9
- Examples: `my wabcam is frozen on calls`
- Fix: add `|wa[be]cam` to webcam regex  Risk: LOW

### 6. password +9 (Spanish i18n)
- Examples: `no puedo iniciar sesion`
- Fix: DEFER to localization sprint  Risk: MEDIUM

### 7. kb:performance +2
- Examples: `my fan is spinning and the laptop is hot`
- Fix: add `|fan.{0,10}spin|running.hot|overheating`  Risk: LOW

### 8. mail +3 (Spanish i18n)
- Examples: `mi correo no abre`
- Fix: DEFER to localization sprint  Risk: MEDIUM

---

## Category C: Routing Collisions

### 9. not-resolution collision +4
- Examples: `perfect, no luck`
- Fix: negative lookahead on resolution or reorder  Risk: MEDIUM

### 10. password→mail collision +1
- Examples: `cant sign in to my email`
- Fix: LOW VALUE — accept as-is  Risk: LOW

---

## Total recoverable: 103 → 0 (100.0%) if all applied
## Next growth slot: Sunday 2026-06-29 (+5K next vertical layer)
