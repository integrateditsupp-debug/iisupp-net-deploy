---
id: l1-vpn-pulse-001
title: "Pulse Secure (legacy) — same product as Ivanti Secure Access, when you see the old name"
category: vpn
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Pulse Secure (Juniper era 2004; rebranded Ivanti Secure Access 2021)"
eol_status: "Pulse Secure brand discontinued 2021. Current product is Ivanti Secure Access. Older installer versions still work but should be updated."
prerequisites: ["Existing Pulse Secure install OR ability to download Ivanti Secure Access"]
keywords:
  - pulse secure
  - pulse vpn
  - juniper pulse
  - junos pulse
  - ivanti secure access
  - rebrand
  - legacy installer
related_articles:
  - l1-vpn-ivanti-001-ivanti-secure-access-connect
  - l1-vpn-001-cant-connect
escalation_trigger: "Company is still on Pulse Secure pre-9.1R12 — major CVEs unpatched. Escalate to L2/L3 for gateway upgrade plan."
last_updated: 2026-05-12
version: 1.0
---

# Pulse Secure (legacy) — same product as Ivanti Secure Access

## 1. Symptoms
User says they use "Pulse Secure" for VPN. The icon in their system tray says "Pulse." Their IT documentation says Pulse. They want to know if they have the right app.

## 2. Background
- **Pulse Secure** was originally Juniper Pulse / Junos Pulse (2004-2014), then sold to a private company called Pulse Secure LLC (2014-2020), then sold to Ivanti (2020).
- **Ivanti renamed the product to "Ivanti Secure Access"** in 2021.
- Same product, same protocol. The newer installer just rebranded.
- Many companies haven't pushed the rebranded client to users yet, so the old "Pulse Secure" icon is still extremely common in 2026.

## 3. Questions To Ask User
1. What does the system tray icon look like? (Pulse Secure was a stylized "p" / Ivanti uses a different mark.)
2. What's the version number? (Help menu → About.)
3. Has IT told you to "update to Ivanti" yet?

## 4. Action

**Path A — User just wants to use it as is:**
- Treat exactly the same as Ivanti Secure Access — see `l1-vpn-ivanti-001` for connection steps.

**Path B — User should update (recommended):**
1. Uninstall Pulse Secure (Settings → Apps → Pulse Secure → Uninstall).
2. Reboot.
3. Download Ivanti Secure Access from your company's IT portal OR https://forums.ivanti.com (corporate-issued login required).
4. Install. Same VPN URL works.
5. First-time setup: see `l1-vpn-ivanti-001` Step 2.

**Path C — User can't update without IT involvement:**
- Don't force it. Some companies have specific Pulse Secure versions pinned for compatibility with their gateway.
- Call IT to confirm before updating.

## 5. Security Note
- If running Pulse Secure **older than 9.1R12** (released Aug 2021): SEVERAL major CVEs unpatched. Escalate.
- If running Ivanti Secure Access **older than 22.6R2** (released Apr 2024): newer CVEs unpatched. Escalate.

## 6. Verification Steps
- Help → About shows the version number.
- Test connection works with company VPN URL.

## 7. Escalation Trigger
- Gateway-side Pulse Secure version pre-9.1R12 → critical security gap, immediate L3 escalation.

## 8. Prevention Tips
- Keep client updated quarterly.
- Subscribe to Ivanti security advisories (or follow KrebsOnSecurity / CISA for major CVE alerts).

## 9. User-Friendly Explanation
"Pulse Secure" is the older name for the same VPN app — it's now called "Ivanti Secure Access." You don't have to change anything. If you'd like the newer version, IT can swap it for you, or we'll do it together in 10 minutes.

## 10. Internal Technician Notes
- Configuration profiles built for Pulse Secure transfer cleanly to Ivanti Secure Access — same XML format.
- Group Policy / Intune deployment scripts referencing `PulseSecure.msi` need updating to `IvantiSecureAccess.msi` post-2024.
- Pulse Workspace mobile container product also rebranded — Ivanti Neurons for Mobile or Ivanti UEM.

## 11. Related KB Articles
- `l1-vpn-ivanti-001` — Ivanti Secure Access connect steps
- `l1-vpn-001` — Generic VPN can't connect

## 12. Keywords / Search Tags
pulse secure, pulse vpn, juniper pulse, junos pulse, ivanti secure access, ivanti rebrand, pulse connect secure, pcs
