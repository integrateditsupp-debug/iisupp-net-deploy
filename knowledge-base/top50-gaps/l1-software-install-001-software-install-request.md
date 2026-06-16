---
id: l1-software-install-001
title: "Requesting software install on work computer — process and self-serve options"
category: software
support_level: L1
severity: low
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - software install
  - install request
  - app store
  - company portal
  - winget
  - chocolatey
  - homebrew
  - software center
  - intune company portal
  - jamf self service
  - admin rights
  - request software
  - allowed software
  - approved software
related_articles:
  - l1-windows-006-app-wont-open
  - l1-m365-002-license-activation-issues
escalation_trigger: "Software not in self-serve catalog AND business case is clear (regulated industry tool, compliance need, customer-required) → IT submits formal request through procurement; user notified within 2 business days."
last_updated: 2026-05-12
version: 1.0
---

# Requesting software install on work computer

## 1. Symptoms
- User needs an app installed on their work computer.
- They don't have admin rights (typical).
- Don't know how to request it formally.

## 2. Step-by-Step

### Step 1 — Check self-serve catalog FIRST

Most companies pre-approve common software. Try the self-serve portal:

**Windows (Microsoft Intune):**
1. Start menu → search **Company Portal** → open.
2. Browse or search for the app.
3. Click **Install**.
4. Wait — typically 2-10 minutes.

**Windows (Microsoft Endpoint Configuration Manager / SCCM):**
1. Start menu → **Software Center**.
2. Browse → click → Install.

**Mac (Jamf):**
1. Apps → **Self Service.app**.
2. Browse or search.
3. Click **Install**.

**Mac (Kandji):**
1. Apps → **Kandji Self Service**.
2. Same pattern.

### Step 2 — Common pre-approved software (probably available)

Typically pre-approved in self-serve catalogs:
- Slack, Zoom, Teams, Discord
- Chrome, Firefox, Edge
- VS Code, IntelliJ Idea Community, Visual Studio Community
- 1Password, Bitwarden
- Notion, Obsidian, Logseq
- Adobe Acrobat Reader
- 7-Zip, Keka
- ImgBurn / Rufus
- Postman, Insomnia
- DBeaver, Sequel Pro
- Cisco AnyConnect, GlobalProtect (VPNs)
- Microsoft Authenticator, Duo Mobile
- Outlook, OneDrive, OneNote (usually part of Office install)

### Step 3 — If NOT in self-serve

Submit a request:
1. Email IT: `it@<company>.com` OR formal ticketing system if your company uses one.
2. Include in the email:
   - Software name + version + vendor website.
   - Business reason (which job task needs it).
   - Manager approval (CC manager or include in the message).
   - Whether you've paid for a license already or need IT to procure.

### Step 4 — While waiting

**For one-off tasks, web alternatives often suffice:**
- Need a quick PDF edit? smallpdf.com, ilovepdf.com.
- Need a quick file format conversion? cloudconvert.com.
- Need a quick image edit? photopea.com (free Photoshop clone in browser).

**Some apps run portable without install:**
- WinSCP, PuTTY portable, VLC portable — but check with IT first; some companies block portable .exe execution.

### Step 5 — Self-install options (Windows users with command line)

**winget** (built into Windows 11):
```
winget search <app>
winget install <appid>
```
*(If you don't have admin rights, winget will fail — that's expected. Use Company Portal.)*

**Chocolatey** (only if pre-installed by IT):
```
choco install <pkg>
```

### Step 6 — Self-install options (Mac users with command line)

**Homebrew** (only if your company allows it — check first):
```
brew install <pkg>
brew install --cask <gui-app>
```

## 3. Why some software gets denied

Software requests are evaluated against:
- **Security:** does it have known vulnerabilities? Open-source vs commercial vendor reputation?
- **Cost:** seat license per user × team size.
- **Compliance:** does it handle regulated data? PCI / HIPAA / GDPR audit footprint?
- **Maintenance:** can IT keep it patched / supported?
- **Duplication:** does an already-approved tool do the same job?

If denied, ask:
- What's the security concern?
- Is there an approved alternative?
- Can you submit a security review + revisit?

## 4. Verification Steps
- App appears in Start menu (Win) or Applications folder (Mac).
- Launches without error.
- License (if any) activates successfully.

## 5. When to Call IT
- Self-serve portal isn't installed on your computer — IT to deploy it (usually 1-day SLA).
- "This installation is blocked by your administrator" error — software not in approved list.
- Critical business need with a deadline — emphasize urgency in the request + CC your manager.

## 6. Prevention Tips
- **Bookmark your company's Self Service portal** — saves 5 minutes vs digging through menus every time.
- **Keep a list of your essential apps** for migration to new computers.
- **Don't install pirated / cracked software.** Even on a personal device used for work — security risk, IP risk, audit risk. Use trial → buy if needed.

## 7. User-Friendly Explanation
First check the Company Portal (Windows) or Self Service (Mac) on your computer — most common apps are there and self-install with one click. If your app isn't listed, email IT with the name of the software, why you need it, and your manager's approval. While waiting, check if there's a web version. Most companies turn requests around in 1-3 business days.

## 8. Internal Technician Notes
- Intune Company Portal apps are deployed as Win32 LOB apps, .intunewin format, or via Microsoft Store for Business / new Windows Package Manager (winget).
- Jamf Self Service shows policies + packages user-scoped. Restrict by user group / smart group.
- Application reputation services (Microsoft Defender SmartScreen, Apple Gatekeeper) block unsigned binaries by default — sometimes blocks legitimate freeware.
- Application Control / WDAC on Windows 11 Enterprise blocks unsigned binaries entirely.
- macOS Gatekeeper: System Settings → Privacy & Security → "Allow apps from" → "App Store & Identified Developers" is standard.
- For self-installable but rare apps: keep a curated "advanced" tier in Self Service for engineering staff vs locked-down for general staff.
- SCCM (now MECM / Configuration Manager) is the legacy on-prem deployment tool, Intune is cloud successor.

## 9. Related KB Articles
- `l1-windows-006` — App won't open
- `l1-m365-002` — License activation

## 10. Keywords / Search Tags
software install, install request, app store, company portal, winget, chocolatey, homebrew, software center, intune company portal, jamf self service, admin rights, request software, approved software, mecm, sccm
