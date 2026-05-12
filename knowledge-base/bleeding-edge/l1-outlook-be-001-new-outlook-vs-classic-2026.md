---
id: l1-outlook-be-001
title: "New Outlook vs Classic Outlook in 2026 — which one to use and how to switch"
category: outlook
support_level: L1
severity: medium
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+"]
tech_generation: bleeding-edge
year_range: "New Outlook GA 2024; Classic Outlook (Win32) supported through at least 2029 per Microsoft commitment"
eol_status: "Classic Outlook (Win32) on supported Microsoft 365 Apps tier — patched through Microsoft's Modern Lifecycle. New Outlook is the strategic future."
prerequisites: []
keywords:
  - new outlook
  - classic outlook
  - outlook web app
  - one outlook
  - monarch
  - outlook 365
  - outlook 2024
  - personal email
  - shared mailbox
  - pst
  - ost
  - msi vs c2r
  - click-to-run
related_articles:
  - l1-outlook-001-not-receiving-emails
  - l1-outlook-002-cant-send-emails
  - l1-office-legacy-001-office-2010-2013-mail-stopped
escalation_trigger: "Customer relies on a feature New Outlook doesn't support (PST import for offline work, third-party COM add-ins) and is forced to migrate — assess workflow rework before forcing."
last_updated: 2026-05-11
version: 1.0
---

# New Outlook vs Classic Outlook in 2026 — which one to use and how to switch

## 1. Symptoms
User sees a "Try the new Outlook" toggle in the corner of Outlook. They flipped it, things broke, they want classic back. Or: their machine only has New Outlook and they're missing a feature they're used to. Or: they were just deployed New Outlook and want to know if it's safe to use for business.

## 2. Likely Causes / Context
1. **Microsoft is migrating** the Outlook for Windows experience from the Win32 client to a web-based shell that wraps Outlook on the Web (formerly OWA). Internal codename "Monarch."
2. **Two products coexist** through at least 2029. Both ship with Microsoft 365.
3. **Default behavior varies** — new PCs may default to New Outlook; existing Classic users keep Classic unless toggled.
4. **Feature parity is improving but incomplete.** Several Classic-only features as of mid-2026.

## 3. Questions To Ask User
1. Are you on Windows 11 with a new install (likely New Outlook default) or did you upgrade from a machine with Classic?
2. Which version of Outlook is currently open? Look in the top right for a toggle "Try the new Outlook" (means you're on Classic) or "New Outlook" badge (means you're on New).
3. What was the trigger to switch — were you forced, or did you toggle by mistake?
4. What features do you rely on every day? (PST files, shared mailboxes, third-party add-ins, COM add-ins, rules, signatures, mail merge with Word?)
5. Are you on a personal account, work account, or both in the same Outlook?

## 4. Comparison — what's different (as of 2026-05)

| Feature | Classic Outlook | New Outlook |
|---|---|---|
| PST file open / archive | Yes, full | **NOT supported** (read-only import in preview) |
| OST (offline cache) | Yes | Online-only by default; partial offline added 2025 |
| Shared mailboxes | Yes, full | Yes (as of 2025 update) |
| COM add-ins (Acrobat, DocuSign, third-party CRM) | Yes | **Limited** — web add-ins only; old COM add-ins blocked |
| Rules (client-side AND server-side) | Yes, both | Server-side only |
| Signatures | Per-account, rich HTML | Per-account, rich HTML, syncs across devices |
| Categories / colors | Yes | Yes |
| Mail merge to Outlook from Word | Yes | No (use Word's modern flow or third-party) |
| Multiple personal accounts | Yes (POP/IMAP/Exchange) | Yes (M365, Gmail, Yahoo, iCloud) |
| Offline support | Full | Partial (last 30 days online M365 mail cached) |
| Group calendars / shared calendars | Yes, full | Yes, full (better since 2024 update) |
| Copilot integration | Limited | **Native, deep** — Summarize, Draft, Coach |
| Performance on low-RAM PCs | Heavy | Lighter |
| Update model | Microsoft 365 Apps channel | Web shell — updates near-continuously |

## 5. Resolution Steps

**Path A — Stay on Classic Outlook for now (recommended for most business users mid-2026):**
1. In New Outlook, click the toggle in the top-right corner: "New Outlook" → switch OFF.
2. Outlook closes. Classic Outlook (`OUTLOOK.EXE`) opens next time you launch.
3. If toggle is missing: open Settings → General → Switch to classic Outlook.
4. Group Policy or Intune can lock the experience: search "Default Outlook" policy.

**Path B — Switch TO New Outlook (when Copilot and lightweight UX matter more than legacy features):**
1. In Classic Outlook, top right "Try the new Outlook" toggle ON.
2. New Outlook downloads + opens. Sign in if prompted.
3. Mail, calendar, contacts sync via M365 — no PST migration needed (server-side).
4. **Pre-migration checklist:**
   - Export any PST data you need locally to a server location (OneDrive or shared drive).
   - List your COM add-ins (Classic → File → Options → Add-ins) — flag any that aren't yet web add-ins.
   - Note your client-side rules — manually recreate any server-side rule isn't already covering.

**Path C — Use both side-by-side (developer / power user pattern):**
1. Both Outlook clients can be installed concurrently on Windows 11.
2. New Outlook from the Start menu, Classic from `OUTLOOK.EXE` (Microsoft 365 Apps install).
3. Two profiles, two sets of running rules — be cautious about duplicate / overlapping rules.

## 6. Verification Steps
- After switching to Classic: Outlook 2016-style ribbon visible, File → Account Settings shows your accounts, PST files accessible.
- After switching to New: top-right has user avatar + lightweight modern shell, settings is a gear icon, Copilot button visible in compose.
- Mail counts match across devices (sanity check sync).

## 7. Escalation Trigger
- Customer's business workflow depends on a COM add-in (industry-specific CRM plugin, document signing, AP automation) with no web add-in equivalent → STAY on Classic, escalate vendor-add-in roadmap conversation.
- 50+ users to migrate → planning project, L2 owns staged rollout.
- Customer can't switch back from New (toggle missing, locked by IT) → check Group Policy / Intune config.

## 8. Prevention Tips
- **Don't auto-roll New Outlook to all users yet** — mid-2026 it still has feature gaps for many business users.
- **Inventory add-ins** before migration projects start.
- **PST → OneDrive archive** strategy now — gets your business off PST as a critical dependency before New Outlook is forced.

## 9. User-Friendly Explanation
Microsoft has two versions of Outlook right now — a "Classic" one that's been around for years, and a "New" one that's leaner and has more AI features. Most businesses are still on Classic because the New one is missing a few things. You can flip a switch in the corner to go either way. If you flipped to New by mistake and something broke, flip it back. If you want the new AI features and don't use older add-ins, the New one is great.

## 10. Internal Technician Notes
- New Outlook product family naming: Microsoft has settled on "New Outlook for Windows" (NOX) as the public name; codename "Monarch" used internally.
- Classic Outlook = `OUTLOOK.EXE` from Microsoft 365 Apps for Enterprise (Current Channel / Monthly Enterprise Channel / Semi-Annual Enterprise Channel).
- New Outlook = `olk.exe` Web-shell wrapper, mostly OWA + Electron-like host. Updates via Microsoft Store + automatic background.
- Microsoft committed to support Classic Outlook with security updates "at least through 2029" per blog post Jan 2025.
- COM add-in roadmap: many ISVs ported to web add-ins through 2024-2026 but holdouts remain (DocuSign for Word→Outlook flow, several CRM connectors).
- Default policy: Intune setting `com.microsoft.outlook.windows.newOutlookDefault` — Boolean. Group Policy ADMX template in latest Office ADMX bundle.
- New Outlook does NOT support add-ins that use VSTO, Office Add-in Manifest XML v1, or COM. Web Add-in Manifest v1.1 + JSON manifest both work.
- PST roadmap: read-only PST import in New Outlook reached general availability mid-2025; write/archive PST has no announced timeline as of mid-2026.

## 11. Related KB Articles
- `l1-outlook-001` — Outlook not receiving emails
- `l1-outlook-002` — Outlook can't send emails
- `l1-office-legacy-001` — Office 2010/2013 mail stopped

## 12. Keywords / Search Tags
new outlook, classic outlook, outlook for windows, monarch, nox, pst file, ost file, com add-in, web add-in, copilot in outlook, microsoft 365 apps, click-to-run, c2r, server-side rules, outlook on the web, owa
