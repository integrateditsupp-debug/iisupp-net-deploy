---
id: l1-vpn-generic-001
title: "VPN won't connect — universal triage and when to call IT"
category: vpn
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to any SSL VPN / IPsec VPN client (Ivanti, Pulse, GlobalProtect, AnyConnect, FortiClient, OpenVPN, Zscaler ZPA, Cloudflare WARP, Tailscale, NordLayer)."
prerequisites: ["VPN client already installed and previously configured"]
keywords:
  - vpn
  - vpn not connecting
  - vpn troubleshooting
  - call it
  - escalation
  - self serve
  - ssl vpn
  - ipsec
  - globalprotect
  - cisco anyconnect
  - forticlient
  - zscaler
  - cloudflare warp
related_articles:
  - l1-vpn-001-cant-connect
  - l1-vpn-ivanti-001-ivanti-secure-access-connect
  - l1-vpn-mobilepass-001-mobilepass-token-setup
  - l1-wifi-001-cant-connect
  - l1-internet-001-no-internet
escalation_trigger: "After the 6 self-fix steps below all fail. Or any time the VPN gateway returns 'access denied' / 'policy violation.'"
last_updated: 2026-05-12
version: 1.0
---

# VPN won't connect — universal triage and when to call IT

## 1. Symptoms
"My VPN won't connect." Could be any client: Ivanti Secure Access, Pulse Secure, Cisco AnyConnect, Palo Alto GlobalProtect, FortiClient, Zscaler ZPA, Cloudflare WARP, NordLayer, OpenVPN, Tailscale, custom IPsec.

## 2. Universal Triage (do these IN ORDER)

### Step 1 — Confirm internet works WITHOUT the VPN
- Open a web browser → load `https://google.com` or `https://www.cloudflare.com`.
- If those don't load → your internet is broken. Fix that first (see `l1-internet-001`).
- If those load → continue.

### Step 2 — Restart the VPN client
- Fully quit the VPN app (don't just close the window — right-click in system tray / menu bar → Quit).
- Wait 10 seconds.
- Reopen → try to connect again.
- *Solves about 30% of VPN issues.*

### Step 3 — Verify you have the right URL / server
- Check your IT documentation OR a previous connection screenshot.
- Sign-in URL must be EXACT — typos in `vpn.<company>.com` vs `vpn.<company>.co` fail silently or show generic errors.

### Step 4 — Test on mobile hotspot
- Turn on your phone's hotspot.
- Connect your laptop to that hotspot.
- Try VPN again.
- **If it works on hotspot but not your home/office Wi-Fi** → your network is the problem: captive portal, ISP DPI, double NAT, or local firewall blocking. See `l1-internet-001` to fix the network OR keep using the hotspot for now.
- **If it fails on both** → not a network issue. Continue to Step 5.

### Step 5 — Check credentials / MFA
- Open a company web app (webmail, intranet) → sign in with the SAME credentials → if that fails too, your password is wrong or expired. Reset it.
- If MFA fails: phone time wrong (Settings → Date & Time → "Set automatically"). Wait for next 30-second cycle and retype the new code.

### Step 6 — Update the VPN client
- VPN app → Help menu → Check for Updates.
- Install if available → restart computer → try again.
- *Outdated clients are the silent #1 cause for clients more than 6 months old.*

### Step 7 — Reboot the computer
- Yes really.
- *Solves another 10-15% of weird issues after Steps 1-6 fail.*

## 3. When to Call IT (Don't Self-Fix Beyond This Point)

**Call IT if you see any of these:**

| What you see | Why call IT |
|---|---|
| "Your account is locked" / "Account locked out" | IT must unlock from the back-end. Multiple failed attempts triggered this. |
| "Access denied — policy violation" | Conditional access policy (location, device compliance, group membership) is blocking you. Only IT can adjust. |
| Certificate error that persists after client update | The gateway certificate may be invalid OR your local certificate store is broken — needs IT diagnosis. |
| "Token revoked" or "Authentication failed" repeatedly with correct credentials | Token may be removed from the back-end. IT re-enrolls. |
| Brand new device, never connected, even after install | IT may need to pre-register the device or push a config profile. |
| Multiple coworkers all have the same problem at the same time | Gateway outage — IT should already know but report it. |
| You're traveling internationally and VPN suddenly stops working | Some countries block VPN protocols (China, UAE, Iran, Russia). IT can advise on alternative routes. |
| VPN connects but you can't reach ONE specific internal app | ACL / firewall rule on the gateway. Tell IT exactly which app + the URL or IP. |
| Repeated MFA fails despite correct codes AND phone time correct | Server-side clock drift OR token de-synced from server. |

## 4. Information To Give IT When You Call

To save time, have this ready:

1. **Your VPN client name and version** (Help → About).
2. **Your operating system + version** (Win 11 24H2, macOS 15.2, iOS 18.3, etc.).
3. **The exact error message you see** (screenshot is best).
4. **What you've already tried** (Steps 1-7 above).
5. **What network you're on** (home, office, hotel, mobile hotspot, public Wi-Fi).
6. **Any recent changes** (new phone, password reset, MFA re-enrollment, new laptop).
7. **Your username / email** (NEVER your password).

## 5. Information IT Should NEVER Ask You For

- **Your password.** IT never asks for it. Anyone asking for your password is a phishing attempt.
- **Your MFA code unprompted.** IT may ask you to read a code DURING a verified support call, but never to email it.
- **Remote control of your screen without verifying who they are first.** Always call IT back on the published number to verify identity.

## 6. Verification Steps After IT Helps You
- Connection establishes.
- An internal-only URL loads.
- File share or app you need to reach actually responds.

## 7. Prevention Tips
- **Test VPN before traveling.** Don't discover it's broken at 11 PM in a hotel.
- **Keep client updated.**
- **Save a screenshot of working VPN settings** when it works — gives you and IT a reference if it breaks.
- **Have a backup MFA method.** If your only token is on a phone that breaks, you lose VPN until IT re-enrolls.

## 8. User-Friendly Explanation
If your VPN isn't connecting, try these in order: 1) check the internet still works, 2) restart the VPN app, 3) check the URL is right, 4) try your phone's hotspot to rule out the network, 5) sign in to webmail to confirm your password works, 6) update the VPN app, 7) restart your computer. If you get past all seven and it still doesn't work — call IT with the exact error message and we'll fix it together.

## 9. Internal Technician Notes
- Capture session logs immediately when user reports — they overwrite on next attempt.
  - Ivanti: `%LocalAppData%\Pulse Secure\Logs\` (Win) / `~/Library/Logs/Pulse Secure/` (Mac).
  - GlobalProtect: `%ProgramFiles%\Palo Alto Networks\GlobalProtect\PanGPS.log`.
  - AnyConnect: `%ProgramData%\Cisco\Cisco AnyConnect Secure Mobility Client\`.
  - FortiClient: `%AppData%\FortiClient\` → `forticlient.log`.
- Gateway logs (server side): check session establishment / failure reason. SAML auth errors often misreport as generic "authentication failed" on the client.
- For frequent intermittent issues: check MTU. Default 1500 may be too high through some carriers; lower to 1400 in client config and test.
- For mobile carrier networks blocking IPsec UDP 500/4500: enable SSL fallback (TCP 443) in client settings.

## 10. Related KB Articles
- `l1-vpn-001` — Can't connect (legacy)
- `l1-vpn-ivanti-001` — Ivanti Secure Access connect
- `l1-vpn-mobilepass-001` — MobilePASS+ setup
- `l1-internet-001` — No internet
- `l1-wifi-001` — Wi-Fi won't connect

## 11. Keywords / Search Tags
vpn, vpn not connecting, vpn troubleshooting, when to call it, vpn escalation, self serve vpn, ssl vpn, ipsec, ivanti, pulse secure, globalprotect, cisco anyconnect, forticlient, zscaler, cloudflare warp, nordlayer, tailscale, openvpn
