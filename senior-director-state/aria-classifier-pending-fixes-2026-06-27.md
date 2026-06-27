# ARIA Classifier Pending Fixes — 2026-06-27

**Run date:** 2026-06-27
**Pass rate before:** 96.8% (28156/29072)
**Pass rate after safe corpus fix:** 97.0% (28204/29072)
**Safe fixes auto-applied:** 1 (headphone jack → kb:bluetooth corpus update)
**Regex fixes pending human review:** 24 clusters, 868 remaining failures

---

## HOW TO APPLY THESE FIXES

Each fix below requires editing `aria.html` classifier regexes.
**Do NOT apply without testing. Run `cd tests && node run-10k-scenarios.js` after each change.**

---

## HIGH PRIORITY (>50 failures each)

### FIX-1: kb:teams typo tolerance [107 failures]
**Pattern:** "team's not loading", "teamz not loading", "teem not loading"
**Root cause:** kb:teams regex doesn't match typo variants of "teams" (teamz, teem, team's)
**Suggested fix:** Broaden kb:teams regex to include: `/team[sz]?\s*(not|won|can|is)\s*(loading|working|open|connect)/i` or add fuzzy match for "teem"/"teamz"
**Expected gain:** +107 pass

### FIX-2: password vs mail collision [106 failures]
**Pattern:** "i'm locked out of my email", "reset password for outlook"
**Root cause:** mail regex fires before password check on email-related lockout phrases
**Suggested fix:** Move password check above mail check in classifier, OR add negative lookahead to mail regex excluding "locked out" phrases
**Expected gain:** +106 pass

### FIX-3: resolution vs NOT-resolution collision [98 failures]
**Pattern:** "great :)", "great 🎉", "yes great :)"
**Root cause:** NOT-resolution (negative ack) fires before resolution (positive ack) on short positive phrases with emoji
**Suggested fix:** Reorder: put resolution check before NOT-resolution, OR add emoji-positive signals to resolution regex
**Expected gain:** +98 pass

### FIX-4: kb:security vs kb:mfa collision [96 failures]
**Pattern:** "mfa bombing", "50 mfa pushes", "MFA BOMBING"
**Root cause:** kb:mfa fires on anything with "mfa" keyword, but mfa-bombing is a security attack pattern
**Suggested fix:** Add "bombing|attack|flood|fatigue|push" context to kb:security regex that overrides kb:mfa when present alongside "mfa"
**Expected gain:** +96 pass

### FIX-5: kb:onedrive vs password collision [54 failures]
**Pattern:** "onedrive keeps prompting for password"
**Root cause:** password regex fires on "password" keyword before onedrive check sees "onedrive"
**Suggested fix:** Move kb:onedrive check above password check, OR add onedrive-specific override: if "onedrive" present → route kb:onedrive regardless of "password"
**Expected gain:** +54 pass

---

## MEDIUM PRIORITY (40-50 failures each)

### FIX-6: wifi vs kb:networking collision [48 failures]
**Pattern:** "dhcp not assigning ip"
**Root cause:** kb:networking fires on "dhcp/ip" before wifi check
**Suggested fix:** Add DHCP/IP context to wifi regex OR reorder wifi before kb:networking
**Expected gain:** +48 pass

### FIX-7: kb:performance vs kb:security collision [48 failures]
**Pattern:** "antimalware service executable high cpu"
**Root cause:** kb:security fires on "antimalware" keyword before kb:performance sees "high cpu"
**Suggested fix:** Add compound check: "antimalware + (high cpu | slow)" → kb:performance
**Expected gain:** +48 pass

### FIX-8: kb:browser vs kb:performance collision [48 failures]
**Pattern:** "firefox slow"
**Root cause:** kb:performance fires on "slow" before kb:browser checks for browser name
**Suggested fix:** Move kb:browser above kb:performance, OR add browser-name + slow → kb:browser
**Expected gain:** +48 pass

### FIX-9: kb:onboarding vs kb:m365 collision [48 failures]
**Pattern:** "need to deactivate user"
**Root cause:** kb:m365 fires on "user" context before kb:onboarding checks for offboarding keywords
**Suggested fix:** Add "deactivate|offboard|remove user|disable account" → kb:onboarding explicitly
**Expected gain:** +48 pass

### FIX-10: mail→default typo tolerance [48 failures]
**Pattern:** "emials not sending", "eamils not sending"
**Root cause:** mail regex doesn't match typo variants (emials/eamils for emails)
**Suggested fix:** Broaden mail regex: `/em[ai]+ls?\s*(not|won|can)/i` or add fuzzy email typo list
**Expected gain:** +48 pass

---

## LOWER PRIORITY (<40 failures each)

### FIX-11: mail vs outlook_ooo collision [37 failures]
**Pattern:** "outloook won't open", "outloook wont open"
**Root cause:** outlook_ooo fires on "outlo*k" typo variants, but open/crash = mail issue
**Suggested fix:** Add negative match in outlook_ooo: exclude "open|crash|load|launch" from OOO path
**Expected gain:** +37 pass

### FIX-12: escalation vs kb:bitlocker collision [36 failures]
**Pattern:** "please help me find my recovery key"
**Root cause:** kb:bitlocker fires on "recovery key" before escalation checks for help-request framing
**Suggested fix:** Add "help me find + recovery key" → escalation override, OR escalation check first
**Expected gain:** +36 pass

### FIX-13: escalation→default gap [36 failures]
**Pattern:** "please i'm stuck", "i need help with i'm stuck"
**Root cause:** escalation regex doesn't match vague "stuck" + help-framing without specific tech term
**Suggested fix:** Add `/i'?m stuck|completely stuck|totally stuck/i` to escalation regex
**Expected gain:** +36 pass

### FIX-14–25: Small clusters (2–17 failures each)
See `tests/suggested-fixes.md` for details on:
- wifi typo "wfi" [17 fail] — add wfi\b to wifi regex
- kb:onedrive "files won t sync" [8 fail] — apostrophe-missing typo tolerance
- kb:windows "won t boot" [6 fail] — same pattern
- kb:security "suspicious emial" [6 fail] — email typo tolerance
- kb:permissions "user can t open folder" [4 fail]
- kb:networking "can t reach internal site" [4 fail]
- kb:macos "mac won t start" [4 fail]
- not-resolution "no longer working" [3 fail]
- password vs outlook_ooo "outloook" [2 fail]
- wifi vs password "wfii password" [2 fail]
- wifi vs kb:performance "office wfi slow" [2 fail]

---

## SUMMARY TABLE

| Fix # | Cluster | Failures | Type | Priority |
|-------|---------|----------|------|----------|
| 1 | kb:teams typo | 107 | regex broaden | HIGH |
| 2 | password/mail reorder | 106 | reorder | HIGH |
| 3 | resolution/NOT-res reorder | 98 | reorder | HIGH |
| 4 | kb:security/mfa context | 96 | regex + reorder | HIGH |
| 5 | kb:onedrive/password reorder | 54 | reorder | HIGH |
| 6 | wifi/kb:networking reorder | 48 | reorder | MED |
| 7 | kb:performance/security | 48 | regex | MED |
| 8 | kb:browser/performance reorder | 48 | reorder | MED |
| 9 | kb:onboarding/m365 | 48 | regex | MED |
| 10 | mail typo | 48 | regex broaden | MED |
| 11 | mail/outlook_ooo | 37 | reorder | MED |
| 12 | escalation/bitlocker | 36 | reorder | MED |
| 13 | escalation vague | 36 | regex broaden | MED |
| 14-25 | misc small clusters | 93 | various | LOW |

**Total recoverable with these fixes: ~868 → estimated 99.0%+ pass rate**

---
*Generated by autonomous loop run 2026-06-27. Apply via aria.html classifier with Ahmad approval.*
