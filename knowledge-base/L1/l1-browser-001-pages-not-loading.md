---
id: l1-browser-001
title: "Browser issues: pages won't load, certificate errors, or constant crashes"
category: browser
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - browser
  - chrome
  - edge
  - firefox
  - safari
  - not loading
  - this site can't be reached
  - your connection is not private
  - net::err_cert
  - cache
  - cookies
related_articles:
  - l1-wifi-001
  - l1-windows-003
  - l2-networking-001
escalation_trigger: "Same site fails for many users, or genuine cert issue on internal service, or DNS poisoning suspected"
last_updated: 2026-05-07
version: 1.0
---

# Browser issues: pages not loading / cert errors / crashes

## 1. Symptoms
- "This site can't be reached".
- "Your connection is not private" / `NET::ERR_CERT_*`.
- Browser hangs and goes white.
- Specific site loads partially (no images, broken layout).
- Browser crashes immediately on launch.
- "Aw, snap!" / "He's dead, Jim" tab error.
- Search/address bar slow.

## 2. Likely Causes
1. Cached / stale cookies, cache files corrupted.
2. Extension conflict.
3. Browser version outdated.
4. Wrong system clock (kills SSL).
5. DNS server failing for that site.
6. Proxy / antivirus interception breaking cert chain.
7. Site itself is down.
8. GPU acceleration glitch (crashes on launch).

## 3. Questions To Ask User
1. Which browser (Chrome, Edge, Firefox, Safari)?
2. Does the issue happen on every site, one specific site, or just internal sites?
3. Does it work in another browser (Edge if you usually use Chrome)?
4. Does Incognito / Private mode work?
5. What does the error message say exactly?
6. When did this start?

## 4. Troubleshooting Steps
1. Open Incognito / Private window — site loads? Then it's a cache/extension issue.
2. Check time: Settings → Time & language → Sync now (cert errors often = clock skew).
3. Try a different network (mobile hotspot) — works? It's network/DNS-side.
4. Try the site on a phone — works? It's user-PC-side, not site-side.
5. Disable all extensions: Chrome → ⋮ → Extensions → toggle all off.

## 5. Resolution Steps
**Cache / cookies:**
1. Ctrl+Shift+Delete → choose "All time" → check Cached images, Cookies, Site data → Clear.
2. Restart browser.

**Extension conflict:**
1. Disable all → restart browser → re-enable one at a time.
2. Identify culprit; remove or update it.

**Reset browser settings:**
- Chrome: Settings → Reset settings → Restore settings to original defaults.
- Edge: Settings → Reset settings → Restore.
- Firefox: about:support → Refresh Firefox.

**Cert error specifically:**
1. Verify clock first.
2. If error says "issuer unknown" and it's an internal corporate site, the corp root CA may not be on this device — escalate to L2 to deploy.
3. Don't override cert warnings unless explicitly directed by IT for known internal site.

**Browser crashes on launch:**
1. Disable hardware acceleration:
   - Chrome: chrome://settings/system → Use hardware acceleration → off.
   - Edge: similar.
2. Reinstall: Settings → Apps → uninstall → reinstall fresh from official site.

**For Windows: reset HOSTS file if a single site fails:**
1. Open Notepad as admin → File → Open → `C:\Windows\System32\drivers\etc\hosts`.
2. Look for entries with the failing site domain → comment with `#` or remove.
3. Save → flush DNS: `ipconfig /flushdns`.

## 6. Verification Steps
- Site loads in regular browser window without errors.
- Cert padlock present, no warnings.
- Refresh works.
- Same in 2 other sites you use daily.
- 24h of normal use without recurrence.

## 7. Escalation Trigger
- Cert error on legitimate internal site after L1 steps — root CA missing.
- Same site fails for many users.
- Browser repeatedly crashes after reinstall — system-level issue.
- DNS poisoning suspicion (wrong content loading).
- → Escalate to **L2** with: error code (e.g., NET::ERR_CERT_AUTHORITY_INVALID), URL, browser version, network type, screenshot.

## 8. Prevention Tips
- Keep browser auto-updating.
- Don't install random extensions; vet via vendor.
- Don't use 5 browsers — pick 1 primary, 1 backup.
- Avoid "PC cleaner" apps that touch browser files.
- Don't ignore cert warnings — they're real signals.

## 9. User-Friendly Explanation
"Your browser is having trouble — usually it's a stash of old data tripping it up, or an extension misbehaving. We'll try Incognito first to confirm, clear out the cache if that fixes it, and turn off extensions one at a time. For certificate errors, we make sure your clock is right and check whether it's a real warning we should trust."

## 10. Internal Technician Notes
- Chrome cache locations: `%localappdata%\Google\Chrome\User Data\Default\` (Cache, Code Cache, IndexedDB, etc.).
- Edge: `%localappdata%\Microsoft\Edge\User Data\Default\`.
- Firefox profile: `%appdata%\Mozilla\Firefox\Profiles\`.
- For corporate proxy with TLS inspection (Zscaler, Netskope), the proxy's root CA must be in user / machine trust store; missing CA = NET::ERR_CERT_AUTHORITY_INVALID across all HTTPS.
- Net Internals export from chrome://net-export → Crucial diagnostic for L2 — captures all DNS / connection attempts.
- For mass internal-site cert failure, check whether AD certificate services renewed recently; CRL may be unreachable.

## 11. Related KB Articles
- l1-wifi-001 — Wi-Fi / network issues
- l1-windows-003 — Slow PC (browser is symptom)
- l2-networking-001 — DNS / proxy diagnosis

## 12. Keywords / Search Tags
browser, chrome, edge, firefox, safari, not loading, certificate, your connection is not private, net::err_cert, cache, cookies
