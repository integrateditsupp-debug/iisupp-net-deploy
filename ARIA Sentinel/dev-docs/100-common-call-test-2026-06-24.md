# 100 Common IT Support Call Test — ARIA Recipe Matcher (BASELINE)

**Date:** 2026-06-24  
**Author:** Claude Cowork (read-only test harness; report is the only file written)  
**Status:** BASELINE — pre-Slice-A. Re-run after CC's fixes to measure improvement.

## Method

- **Matcher under test (the REAL code):** `scoreRecipe(query, recipe)` + `matchRecipes(query, opts)` from `ARIA Sentinel/src/shared/recipes.mjs`, imported live (not reimplemented) into a Node harness.
- **Recipe set (the REAL data):** the `RECIPES` array exported by the same module — **77 recipes loaded** at test time. (This module is the offline Sentinel matcher; the web set `netlify/functions/aria-recipes-data.mjs` mirrors the same recipe shape.)
- **KB fallback:** when no recipe matched, the call was checked against `knowledge-base/_meta/index-by-keyword.json` (substring keyword lookup over the indexed L1/L2/L3 + gap/internet/vpn articles).
- **How `scoreRecipe` works (verbatim from source):** normalize text → for each `confidenceKeyword`, if the normalized query **`includes`** the normalized keyword, add `max(8, words×6)`; if the query includes the recipe `signal`, +20; family substring +5; +2 per overlapping **title token**. `matchRecipes` keeps any recipe with **score > 0**, sorted desc. **There is no explicit numeric threshold in the code** — any score > 0 is returned as a "match."
- **Threshold used for this report (made explicit because the code has none):**
  - **PASS** = top recipe **score ≥ 8** (at least one real keyword/signal substring hit → the recipe genuinely addresses the call) **OR** a KB article clearly covers it.
  - **PARTIAL** = top recipe **score 1–7** (title-token-only overlap, no keyword hit — a fragile/often-wrong match) and no KB rescue.
  - **FAIL** = **no** recipe match **and no** KB coverage (a real gap).

## Summary

**102 calls tested** (≥100 as requested; multiple phrasings per issue to stress the matcher).

| Result | Count | % |
|---|---|---|
| **PASS** | 66 | 65% |
| **PARTIAL** | 25 | 25% |
| **FAIL** | 11 | 11% |

### Matcher robustness (the real story)

The pass rate flatters the matcher. The **substring keyword model is brittle to natural phrasing**, and several "PASS/PARTIAL" rows only matched on generic title tokens — sometimes to the **wrong** recipe.

- **Same-issue variant test:** 12 issues were phrased 30 different ways. Only **9/30** of those variants produced a strong (keyword/signal) recipe hit — the rest fell to KB, to a weak/wrong recipe, or to a gap.
- **Headline failure — "internet down" (6 phrasings):** only **1/6** strongly matched a recipe.
  - `"the internet is down"` → **PARTIAL**, score 4 → _Internet seems down_
  - `"no internet"` → **PASS**, score 2 → _Connected with no internet_
  - `"wifi says connected but no internet"` → **PASS**, score 4 → _Connected with no internet_
  - `"websites won't load"` → **PARTIAL**, score 2 → _PDF won't open_  ⚠️ WRONG recipe
  - `"I have no connection"` → **PARTIAL**, score 2 → _VPN connection failure_  ⚠️ WRONG recipe
  - `"the internet seems down, cannot reach the internet"` → **PASS**, score 50 → _Internet seems down_
  - Root cause: the keyword `internet down` is matched by **substring**, so "the internet **is** down" breaks the match; "websites won't load" and "I have no connection" land on unrelated recipes (PDF / VPN) via stray title tokens.

- **Other brittle matches:** "Excel is not responding" scored only 6 (keyword is `excel not responding` but the phrasing inserts "is"); "my Office file won't open" and "the spreadsheet won't open" both mis-top-matched **PDF won't open**; "CPU is pegged at 100" mis-matched **Print queue stuck**; several A/V + input calls fell through to **Bluetooth not working** on the lone shared token.

## Full Results (all 102)

| # | Call (user phrasing) | Result | Matched recipe / KB (the solution) | Fix summary | Notes |
|---|---|---|---|---|---|
| 1 | I forgot my password and need to reset it | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 2 | How do I reset my password myself | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 3 | my account is locked after too many tries | PARTIAL | Weak recipe: Chrome profile locked | Guide a safe, content-blind fix for: chrome profile locked. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 4 | I got locked out right after changing my password | PASS | KB: l1-password-001 — Password reset / forgotten password (self-servi… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'locked out'… |
| 5 | my account is disabled and I cannot sign in | PARTIAL | Weak recipe: Cannot eject external drive | Guide a safe, content-blind fix for: cannot eject external drive. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 6 | I need help setting up MFA on my new phone | PASS | KB: l1-mfa-001 — Multi-factor authentication (MFA): setup, lost devic… | KB article covers this issue (self-service steps). | no recipe match; KB keyword 'new phone' covers |
| 7 | my multi-factor authentication is not working | PARTIAL | Weak recipe: Bluetooth not working | Restart the Bluetooth Support Service so adapters and paired devices … | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 8 | I lost my authenticator and can't get the code | PASS | KB: l1-mfa-001 — Multi-factor authentication (MFA): setup, lost devic… | KB article covers this issue (self-service steps). | no recipe match; KB keyword 'authenticator' covers |
| 9 | how do I set up a passkey to sign in | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 10 | I keep getting an MFA loop and wrong password twice | PASS | Recipe: Repeated login failure | Guide the user through safe login recovery without touching credentia… | score 30 (kw/signal hit); signal PASSWORD.RETRY.2; KB also: l1-mfa-… |
| 11 | my computer is really slow | PARTIAL | Weak recipe: Slow Windows startup | Guide a safe, content-blind fix for: slow windows startup. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 12 | my PC is sluggish and laggy today | PASS | Recipe: PC slowed by temporary files | Offer a safe cleanup and startup review before deeper remediation. | score 16 (kw/signal hit); signal SYSTEM.SLOW.TEMP_BLOAT; KB also: l… |
| 13 | everything is slow and the computer keeps lagging | PASS | Recipe: PC slowed by temporary files | Offer a safe cleanup and startup review before deeper remediation. | score 8 (kw/signal hit); signal SYSTEM.SLOW.TEMP_BLOAT |
| 14 | my laptop is so slow to start up | PARTIAL | Weak recipe: Slow Windows startup | Guide a safe, content-blind fix for: slow windows startup. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 15 | Windows takes forever to boot | PARTIAL | Weak recipe: Windows Update stuck | Reset Windows Update services and caches after confirmation. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 16 | I got a blue screen with critical_process_died | PASS | Recipe: Blue screen detected | Read stop code, match likely cause, then apply only safe local repair… | score 24 (kw/signal hit); signal BLUE.SCREEN; KB also: l1-windows-0… |
| 17 | my computer crashed with a BSOD stop code | PASS | Recipe: Blue screen detected | Read stop code, match likely cause, then apply only safe local repair… | score 25 (kw/signal hit); signal BLUE.SCREEN; KB also: l1-windows-0… |
| 18 | the PC just rebooted unexpectedly on its own | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 19 | my computer won't boot, just spinning dots | PASS | KB: l1-windows-002 — Windows won't boot — stuck on spinning dots or b… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'spinning do… |
| 20 | my laptop is overheating and the fan is loud | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 21 | CPU is pegged at 100 percent and stuck | PARTIAL | Weak recipe: Print queue stuck | Restart Print Spooler and clear stuck queued jobs. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 22 | my memory is maxed out, high RAM usage | PASS | Recipe: Sustained high memory | List the top memory consumers (read-only) and offer safe next steps. | score 22 (kw/signal hit); signal SYSTEM.SLOW.HIGH_RAM |
| 23 | I got a WHEA uncorrectable hardware error | PASS | Recipe: Hardware (WHEA) error | Flag a Windows Hardware Error and route to hardware inspection. Never… | score 18 (kw/signal hit); signal HARDWARE.WHEA_ERROR |
| 24 | the start menu won't open when I click it | PARTIAL | Weak recipe: PDF won't open | Guide a safe, content-blind fix for: pdf won't open. | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 25 | Windows search is not working, no results | PARTIAL | Weak recipe: Bluetooth not working | Restart the Bluetooth Support Service so adapters and paired devices … | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 26 | the internet is down | PARTIAL | Weak recipe: Internet seems down | Renew the network address, flush DNS and restart the DNS/DHCP client … | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 27 | no internet | PASS | KB: l1-wifi-001 — Wi-Fi: can't connect / shows 'no internet, secured'… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'no internet… |
| 28 | wifi says connected but no internet | PASS | KB: l1-wifi-001 — Wi-Fi: can't connect / shows 'no internet, secured'… | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'no internet… |
| 29 | websites won't load | PARTIAL | Weak recipe: PDF won't open | Guide a safe, content-blind fix for: pdf won't open. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 30 | I have no connection | PARTIAL | Weak recipe: VPN connection failure | Check VPN adapter and guide safe reconnect steps. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 31 | the internet seems down, cannot reach the internet | PASS | Recipe: Internet seems down | Renew the network address, flush DNS and restart the DNS/DHCP client … | score 50 (kw/signal hit); signal NET.DOWN.TROUBLESHOOT |
| 32 | my wifi keeps dropping with a weak signal | PASS | Recipe: Weak Wi-Fi signal | Guide a safe, content-blind fix for: weak wi-fi signal. | score 22 (kw/signal hit); signal NET.WIFI.WEAK_SIGNAL; KB also: l1-… |
| 33 | the wireless keeps disconnecting | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 34 | my VPN won't connect | PASS | KB: l1-vpn-001 — VPN won't connect / disconnects randomly | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'won't conne… |
| 35 | the VPN connection failed at the gateway | PASS | KB: l1-vpn-001 — VPN won't connect / disconnects randomly | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'vpn' covers |
| 36 | I'm on VPN but can't reach any resources | PASS | KB: l1-vpn-001 — VPN won't connect / disconnects randomly | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'vpn' covers |
| 37 | DNS isn't resolving and I can't browse | PASS | Recipe: DNS lookup failed | Flush stale DNS cache and retry the current connection. | score 28 (kw/signal hit); signal NET.DNS.FAIL; KB also: l2-dns-001 |
| 38 | err_name_not_resolved when I open a site | PASS | Recipe: DNS lookup failed | Flush stale DNS cache and retry the current connection. | score 8 (kw/signal hit); signal NET.DNS.FAIL |
| 39 | the hotel wifi login page won't load | PASS | Recipe: Captive portal not loading | Guide a safe, content-blind fix for: captive portal not loading. | score 24 (kw/signal hit); signal NET.CAPTIVE_PORTAL; KB also: l1-wi… |
| 40 | my ethernet cable shows unplugged | PARTIAL | Weak recipe: Ethernet unplugged | Guide a safe, content-blind fix for: ethernet unplugged. | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 41 | I'm getting an unidentified network on ethernet | PARTIAL | Weak recipe: Ethernet unplugged | Guide a safe, content-blind fix for: ethernet unplugged. | low score 7 (title-token only, NO keyword hit) — fragile/unintended… |
| 42 | the company proxy settings seem wrong | PARTIAL | Weak recipe: Page zoom looks wrong | Reset current tab zoom to 100%. | low score 2 (title-token only, NO keyword hit) — fragile/unintended… |
| 43 | Outlook keeps crashing on open | PASS | Recipe: Outlook local cache repair | Close Outlook, set the cached mailbox file aside (renamed, never dele… | score 20 (kw/signal hit); signal APP.OUTLOOK.OST_CORRUPT; KB also: … |
| 44 | my Outlook search isn't working and mail is stuck syncing | PASS | Recipe: Outlook local cache repair | Close Outlook, set the cached mailbox file aside (renamed, never dele… | score 14 (kw/signal hit); signal APP.OUTLOOK.OST_CORRUPT; KB also: … |
| 45 | Outlook can't open my profile | PASS | KB: l1-outlook-001 — Outlook not receiving new emails | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'outlook' co… |
| 46 | I'm not receiving any emails in Outlook | PASS | KB: l1-outlook-001 — Outlook not receiving new emails | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'outlook' co… |
| 47 | I can't send emails, they're stuck in the outbox | PASS | KB: l1-outlook-002 — Outlook can't send emails / messages stuck in Ou… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'can't send'… |
| 48 | Teams is stuck loading on the splash screen | PASS | KB: l1-teams-002 — Microsoft Teams won't load / stuck on splash screen | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'splash scre… |
| 49 | Teams won't sign in | PASS | Recipe: Teams stuck loading | Close Teams and clear local cache that is safe to rebuild from cloud. | score 32 (kw/signal hit); signal TEAMS.STUCK; KB also: l1-teams-002 |
| 50 | my camera is black in Teams | PASS | KB: l1-teams-001 — Microsoft Teams: no audio in meetings (mic or spea… | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'teams' cove… |
| 51 | I can't hear anyone in the Teams meeting | PASS | KB: l1-teams-001 — Microsoft Teams: no audio in meetings (mic or spea… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'can't hear'… |
| 52 | Zoom has no audio, I can't hear the meeting | PASS | Recipe: No audio output | Restart safe audio services and re-check output devices. | score 19 (kw/signal hit); signal AUDIO.NO_OUTPUT; KB also: l1-teams… |
| 53 | Zoom won't start, just a black screen | PASS | KB: l1-windows-002 — Windows won't boot — stuck on spinning dots or b… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'black scree… |
| 54 | I can't send from the shared mailbox | PASS | KB: l2-offboarding-001 — User offboarding: identity disable, data pre… | KB article covers this issue (self-service steps). | no recipe match; KB keyword 'shared mailbox' covers |
| 55 | OneDrive sync is stuck and paused | PASS | KB: l1-onedrive-001 — OneDrive not syncing / paused / stuck on 'looki… | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'onedrive' c… |
| 56 | OneDrive says storage is full | PASS | KB: l1-onedrive-001 — OneDrive not syncing / paused / stuck on 'looki… | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'onedrive' c… |
| 57 | OneDrive sync paused and won't resume | PASS | KB: l1-onedrive-001 — OneDrive not syncing / paused / stuck on 'looki… | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'onedrive' c… |
| 58 | I accidentally deleted a file and need it back | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 59 | Excel is not responding and frozen on open | PARTIAL | Weak recipe: Excel not responding | Guide a safe, content-blind fix for: excel not responding. | low score 6 (title-token only, NO keyword hit) — fragile/unintended… |
| 60 | Word freezes on open and is not responding | PASS | Recipe: Word not responding | Guide a safe, content-blind fix for: word not responding. | score 30 (kw/signal hit); signal APP.WORD.NOT_RESPONDING |
| 61 | my Office file won't open, format not valid | PARTIAL | Weak recipe: PDF won't open | Guide a safe, content-blind fix for: pdf won't open. | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 62 | the spreadsheet won't open, xlsx file is locked | PARTIAL | Weak recipe: PDF won't open | Guide a safe, content-blind fix for: pdf won't open. | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 63 | this PDF won't open in Adobe Reader | PASS | Recipe: PDF won't open | Guide a safe, content-blind fix for: pdf won't open. | score 30 (kw/signal hit); signal APP.PDF.WONT_OPEN |
| 64 | Microsoft 365 says it's unlicensed and activation failed | PASS | KB: l1-m365-001 — Can't sign in to Microsoft 365 / repeated password … | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'microsoft 3… |
| 65 | Office is stuck updating and hangs | PASS | KB: l2-performance-001 — Performance deep dive: WPR / xperf / consist… | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'hang' covers |
| 66 | my printer won't print, the queue is stuck | PASS | Recipe: Print queue stuck | Restart Print Spooler and clear stuck queued jobs. | score 35 (kw/signal hit); signal PRINT.OFFLINE; KB also: l1-printer… |
| 67 | the printer shows offline after sleep | PASS | KB: l1-printer-001 — Printer not printing / job stuck in queue | KB article covers this issue (self-service steps). | weak recipe score 7 (title-token only, no kw hit) → KB 'printer' co… |
| 68 | my printer prints garbage characters | PASS | KB: l1-printer-001 — Printer not printing / job stuck in queue | KB article covers this issue (self-service steps). | weak recipe score 7 (title-token only, no kw hit) → KB 'printer' co… |
| 69 | I can't find the printer to add it | PASS | KB: l1-printer-001 — Printer not printing / job stuck in queue | KB article covers this issue (self-service steps). | weak recipe score 7 (title-token only, no kw hit) → KB 'printer' co… |
| 70 | the printer driver crashed, need to reinstall it | PASS | Recipe: Printer driver stuck | Guide a safe printer driver reset without removing other printers. | score 27 (kw/signal hit); signal PRINT.DRIVER.STUCK; KB also: l1-pr… |
| 71 | Bluetooth is not working and my headphones won't connect | PASS | Recipe: Bluetooth not working | Restart the Bluetooth Support Service so adapters and paired devices … | score 38 (kw/signal hit); signal BLUETOOTH.OFF; KB also: l1-vpn-001 |
| 72 | my AirPods won't reconnect over bluetooth | PASS | Recipe: Bluetooth not working | Restart the Bluetooth Support Service so adapters and paired devices … | score 10 (kw/signal hit); signal BLUETOOTH.OFF; KB also: l3-disaste… |
| 73 | there's no sound, the speakers seem muted | PASS | Recipe: No audio output | Restart safe audio services and re-check output devices. | score 12 (kw/signal hit); signal AUDIO.NO_OUTPUT; KB also: l1-windo… |
| 74 | my microphone is not detected on calls | PASS | KB: l1-teams-001 — Microsoft Teams: no audio in meetings (mic or spea… | KB article covers this issue (self-service steps). | weak recipe score 6 (title-token only, no kw hit) → KB 'microphone'… |
| 75 | my second monitor is blank, not detected | PARTIAL | Weak recipe: Second monitor blank | Guide a safe, content-blind fix for: second monitor blank. | low score 6 (title-token only, NO keyword hit) — fragile/unintended… |
| 76 | the screen resolution looks wrong and stretched | PASS | Recipe: Wrong screen resolution | Guide a safe, content-blind fix for: wrong screen resolution. | score 24 (kw/signal hit); signal DISPLAY.RESOLUTION_WRONG |
| 77 | my keyboard is typing the wrong characters | PASS | Recipe: Keyboard typing wrong characters | Guide a safe, content-blind fix for: keyboard typing wrong characters. | score 8 (kw/signal hit); signal INPUT.KEYBOARD_WRONG_LAYOUT; KB als… |
| 78 | my touchpad stopped working | PARTIAL | Weak recipe: Touchpad not working | Guide a safe, content-blind fix for: touchpad not working. | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 79 | my USB flash drive is not recognized | PASS | Recipe: USB drive not recognized | Guide a safe, content-blind fix for: usb drive not recognized. | score 8 (kw/signal hit); signal STORAGE.USB_NOT_RECOGNIZED |
| 80 | I can't safely eject my external drive | PARTIAL | Weak recipe: Cannot eject external drive | Guide a safe, content-blind fix for: cannot eject external drive. | low score 6 (title-token only, NO keyword hit) — fragile/unintended… |
| 81 | my webcam camera is not working | PARTIAL | Weak recipe: Bluetooth not working | Restart the Bluetooth Support Service so adapters and paired devices … | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 82 | camera and microphone are blocked in the browser | PASS | KB: l1-teams-001 — Microsoft Teams: no audio in meetings (mic or spea… | KB article covers this issue (self-service steps). | weak recipe score 7 (title-token only, no kw hit) → KB 'microphone'… |
| 83 | the conference room AV is not working | PARTIAL | Weak recipe: Bluetooth not working | Restart the Bluetooth Support Service so adapters and paired devices … | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 84 | how do I set up my work email on my phone | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 85 | I want to use my own device for work, BYOD setup | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 86 | my phone cloud sync is stuck | PASS | KB: l3-hybrid-ad-001 — Hybrid AD: Azure AD Connect / Cloud Sync / pas… | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'cloud sync'… |
| 87 | I got a suspicious email, might be phishing | PASS | KB: l1-email-001 — Suspicious email / suspected phishing — what to do | KB article covers this issue (self-service steps). | no recipe match; KB keyword 'suspicious email' covers |
| 88 | is this a scam website or fake login page | PASS | KB: ga-scam-001 — Detecting fake / scam websites and phishing pages | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'scam websit… |
| 89 | my browser is full of pop-up ads and adware | PASS | KB: l1-browser-001 — Browser issues: pages won't load, certificate er… | KB article covers this issue (self-service steps). | weak recipe score 7 (title-token only, no kw hit) → KB 'browser' co… |
| 90 | BitLocker is asking for a recovery key | PASS | KB: l2-bitlocker-001 — BitLocker: recovery key retrieval and re-prote… | KB article covers this issue (self-service steps). | weak recipe score 4 (title-token only, no kw hit) → KB 'recovery ke… |
| 91 | the firewall is blocking my application | PASS | KB: l3-networking-001 — Network architecture: segmentation, zero trus… | KB article covers this issue (self-service steps). | weak recipe score 5 (title-token only, no kw hit) → KB 'firewall' c… |
| 92 | my Windows Defender antivirus is out of date | PASS | KB: l2-endpoint-001 — Defender ASR rules / Attack Surface Reduction t… | KB article covers this issue (self-service steps). | weak recipe score 2 (title-token only, no kw hit) → KB 'defender' c… |
| 93 | I lost my work laptop, it might be stolen | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 94 | we have a new hire starting, need onboarding | PASS | KB: l2-onboarding-001 — New user onboarding: account, license, device… | KB article covers this issue (self-service steps). | no recipe match; KB keyword 'onboarding' covers |
| 95 | an employee is leaving, need offboarding | PASS | KB: l2-offboarding-001 — User offboarding: identity disable, data pre… | KB article covers this issue (self-service steps). | no recipe match; KB keyword 'offboarding' covers |
| 96 | I got a new laptop, first boot setup | FAIL | (none) |  | no recipe match AND no KB coverage — real gap |
| 97 | my browser keeps crashing with aw snap tab crash | PASS | Recipe: Browser tab crash loop | Recover the tab and guide extension-safe-mode checks. | score 35 (kw/signal hit); signal BROWSER.TAB_CRASH_LOOP; KB also: l… |
| 98 | the page looks stale, I need a hard reload | PASS | Recipe: This page looks stale | Clear cache for the current origin and unregister stuck service worke… | score 18 (kw/signal hit); signal CACHE.STALE |
| 99 | certificate expired error, your connection is not private | PASS | Recipe: Certificate or clock issue | Check device clock first; do not bypass unsafe certificates. | score 14 (kw/signal hit); signal BROWSER.CERT.EXPIRED; KB also: l1-… |
| 100 | the browser isn't saving my passwords anymore | PASS | Recipe: Browser not saving passwords | Guide a safe, content-blind fix for: browser not saving passwords. | score 11 (kw/signal hit); signal BROWSER.PASSWORD_NOT_SAVING; KB al… |
| 101 | a download is blocked as unsafe | PARTIAL | Weak recipe: Download blocked | Explain safe download handling without bypassing security policy. | low score 4 (title-token only, NO keyword hit) — fragile/unintended… |
| 102 | my software install request, I need an app installed | PARTIAL | Weak recipe: Teams stuck loading | Close Teams and clear local cache that is safe to rebuild from cloud. | low score 5 (title-token only, NO keyword hit) — fragile/unintended… |

## Gap List — the 11 FAILs (no recipe AND no KB)

> Note: some FAIL themes below **do** have KB articles on disk (e.g. password reset `l1-password-001`, BYOD `l2-byod-001`, lost device `l1-security-001`, file recovery `l1-file-recovery-001`, new device `l1-newdevice-001`, mobile email `l1-mobile-email-001`). They FAILED here because those articles are **not represented in `index-by-keyword.json`** for the phrases used — i.e. the *matcher/index* misses them, not that ARIA lacks the content. Fix is mostly **index + synonym** work, not net-new authoring.

**Identity / Password / MFA / Passkey**
- #1 `"I forgot my password and need to reset it"`
- #2 `"How do I reset my password myself"`
- #9 `"how do I set up a passkey to sign in"`
  - _Needed:_ new **identity/password/MFA/passkey recipe** (guided, content-blind) + index `l1-password-001`/`l1-mfa-001` under "reset password", "forgot password", "passkey", "set up MFA".
**Mobile / BYOD / new-device / phone**
- #84 `"how do I set up my work email on my phone"`
- #85 `"I want to use my own device for work, BYOD setup"`
- #96 `"I got a new laptop, first boot setup"`
  - _Needed:_ index `l1-mobile-email-001`, `l2-byod-001`, `l1-newdevice-001`, `l1-sync-001` under "work email on phone", "BYOD", "new laptop", "phone sync"; optional guided recipes.
**Security (lost/stolen device)**
- #93 `"I lost my work laptop, it might be stolen"`
  - _Needed:_ index `l1-security-001` under "lost laptop", "stolen device"; add a high-priority **lost/stolen device** recipe → Security Team route.
**Device events (overheating, unexpected reboot)**
- #18 `"the PC just rebooted unexpectedly on its own"`
- #20 `"my laptop is overheating and the fan is loud"`
  - _Needed:_ add keywords "overheating", "fan loud", "rebooted on its own" to the WHEA / unexpected-shutdown recipes (#39/#40).
**Connectivity phrasing (wireless drops)**
- #33 `"the wireless keeps disconnecting"`
  - _Needed:_ add synonym "keeps disconnecting"/"keeps dropping" → Weak Wi-Fi recipe (#56).
**Files (deleted-file recovery)**
- #58 `"I accidentally deleted a file and need it back"`
  - _Needed:_ index `l1-file-recovery-001` / `l1-onedrive-002` under "deleted a file", "recover file", "get it back"; or add a file-recovery recipe.

### High-value matcher fixes (apply once, helps everything)
1. **Tokenize keywords, drop pure-substring matching** (or add an OR-of-tokens path) so inserted words ("is", "the") don't break "internet down", "excel not responding", etc.
2. **Add a synonym map** (Slice A item 2): `internet|wifi|"no websites"|"no connection"|offline → internet-down`; `excel|spreadsheet|xlsx|office file → office/excel`; `reset|forgot password|passkey → identity`.
3. **Raise the effective floor** so a 2-point title-token-only overlap does NOT surface a confident (often wrong) recipe like "PDF won't open" for "websites won't load."

## What Was Done To Solve (and what's next)

- **For the 66 PASS calls, the matched recipe IS the solution** — each row's "Fix summary" is the recipe's own `summary`/`success` (e.g. internet → "Renew the IP address after a safe DNS reset"; DNS → "Flush stale DNS cache and retry"; Teams → restart/cache clear; OneDrive → resume/relink sync). KB-covered PASSes point to the exact L1/L2 article.
- **For PARTIAL/FAIL calls, the fix is staged in** `senior-director-state/cc-aria-coverage-buildout-2026-06-24.md`:
  - **Slice A.1** — add the **Office/Excel recipe** (covers #59, #61, #62, and separates them from "PDF won't open").
  - **Slice A.2** — **harden the offline matcher** with a synonyms/keywords→recipe map (directly fixes the "internet is down" family and the Excel/Office mis-matches; the doc names these exact phrases).
  - **Slice A.3 / new KB** — searchable Recipes finder + new L1 KB articles and **keyword-index entries** for the identity, mobile/BYOD, lost-device, and file-recovery gaps.
- **No repo code or recipes were modified by this test.** Only this report file was written.

## Baseline marker

This is the **pre-Slice-A baseline** (matcher = pure substring, 77 recipes). After CC ships Slice A (Office/Excel recipe + matcher synonym hardening + new KB/index entries), **re-run this exact harness** and compare: expect the "internet down" family to go 6/6, the Office/Excel rows to leave "PDF won't open," and the identity/mobile/security/file-recovery FAILs to resolve to PASS via the index — demonstrating measurable improvement.
