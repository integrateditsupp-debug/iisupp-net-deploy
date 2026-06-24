# ARIA Sentinel — UI Copy & Voice

All product-UI copy. Use these strings verbatim where shown. The globe is **calm, never chatty**.

## Voice & tone rules (locked)
- Calm, competent, never alarmed. Short sentences. CEO/operator voice.
- Never "Oops" / "Whoops". No exclamation marks. Never apologize for errors that aren't ARIA's fault.
- Confirmation pattern: "I detected X. Fixing now." / "Done. Refresh to finish."
- Manual pattern: "I think this is a printer driver issue. Want me to walk you through it?"
- **No emojis in product UI.**
- **No testimonials, no star ratings, no "guarantee" / "money-back" / "risk-free".**
- Experience claims: **"15+ years" only** (never 21+). **Never mention Raymond James.**
- Company: Integrated IT Support Inc., trading as iisupp.net. Founder: Ahmad Wasee.

## Product strings
- **Name:** ARIA Sentinel
- **Tagline:** Resident IT support that never sleeps.
- **One-liner:** ARIA Sentinel lives on your PC, watches for tech problems, and fixes them before they slow you down — without sending your data anywhere.

## Globe states (labels for tooltips/aria-labels, not shown by default)
idle · listening · diagnosing · fixing · done · escalation
- Diagnosing caption (optional, Cinzel italic 11px): "Diagnosing…"

## Fix card
- Detected (Confirmed mode): chip "DISK · LOW SPACE" · title "Disk almost full" · body "3% free on C:\. I can recover ~4.2 GB by clearing temp files, browser caches and old downloads." · buttons "FIX IT NOW" / "DETAILS"
- In progress: chip "FIXING · STEP 2/4" · title "Clearing temp files…" · body "Cleared 1.7 GB · working on browser caches" · footnote "A System Restore point was created before any change."
- Done: chip "DISK · RESOLVED" · title "Recovered 4.2 GB" · body "Disk is healthy. Your work won't be interrupted by space issues." · buttons "DISMISS" / "VIEW LOG"
- Autonomous post-fix example: "I cleared your Chrome cache for [domain]. Refresh the page."

## BSOD takeover (recovery screen)
- Eyebrow "ARIA SENTINEL" · title "Solve it for me"
- Body: "I can read this stop code and apply a known fix locally — or raise a routed ServiceNow incident if hardware support is needed."
- CTA "SOLVE IT FOR ME" · hint "Press F8 → Recovery menu → ARIA"
- Stop code line (mono): "Stop code: CRITICAL_PROCESS_DIED  (0x000000EF)"

## ServiceNow escalation (compose) — routing is AUTOMATIC, not user-editable
- Chip "COULD NOT RESOLVE LOCALLY" · title "Routing to Desktop Support"
- Body: "I tried 2 recipes without success. Raising a ServiceNow incident so the right team can take over."
- Fields: Assignment group (AUTO) · Short description · Caller · Priority
- Footnote: "Team auto-assigned from the signal · minidump + recipe attempts attach automatically · no PII leaves the device."
- Button: "RAISE INCIDENT"  (NO "change team" — the bin is chosen by ARIA from the issue)
- Hardware-failure escalation (locked wording): "This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."

## Ticket created (confirmation)
- Chip "INCIDENT CREATED" · number e.g. "INC0042781" · body "Desktop Support has it. You'll hear back here and by email."
- Fields: State (New) · Priority (3 — Moderate) · Assignment group (DSS) · Response SLA (4h 00m)
- Attachment line: "minidump-0619.dmp · recipe-log.json attached"
- Buttons: "VIEW IN SERVICENOW" / "COPY #"

## My tickets (incident list, newest first — pulled from ServiceNow)
- Header: "My incidents" · "Synced with ServiceNow · newest first"
- Per incident: number, status pill (NEW / IN PROGRESS / RESOLVED), priority, assignment group, relative time, issue title, "Issue described: …", WORK NOTES (timestamp + author + note).
- User comment composer: placeholder "Ask for an update…" · button "POST" · note "Posts to ServiceNow as your comment — the assigned team is notified you're waiting."
- "YOUR COMMENTS" thread shows the user's posted comments inline.

## Routing targets (assignment groups, v1)
Desktop Support (DSS) — hardware, reimaging, physical faults ·
Network Team — VPN infra, DNS server-side, connectivity outages ·
Security Team — suspected malware, policy violations, quarantine ·
System Admins — AD, GPO, server-side config ·
Purchasing — replacement parts, license renewals ·
Service Desk — catch-all triage when class is ambiguous.

## Settings
- Tabs: Mode · Recipes · ServiceNow · Knowledge & policy · Privacy verifier · Hotkeys · About
- Modes: Manual ("DEFAULT · FREE" — "ARIA detects issues and walks you through fixes in chat. Nothing is applied automatically.") · Confirmed ("PAID" — "ARIA proposes a fix card and applies it once you confirm.") · Autonomous ("PAID · OPT-IN" — "ARIA silently applies low-risk fixes and tells you after. Risky fixes still confirm.")

## Company knowledge & policy
- Intro: ARIA prompts (at setup, startup, and in Settings) to upload company procedures, policies, workflows, culture, security, compliance, audit and regulatory docs. ARIA reads this corpus before applying any fix or making any suggestion; culture/tone docs shape how it talks to users.
- Dropzone: "Drop documents or browse" · "PDF · DOCX · MD · TXT · indexed locally into the KB"
- Source rows + status: "Indexed · N docs" / "Processing…"
- Governance gate: Detect issue → Check against policy corpus → Allowed → apply fix / Restricted → escalate
- Note: "ARIA never acts outside your documented policy. Culture & tone docs tune how it speaks to users — your voice, your rules." · "Stored encrypted on-device; never uploaded."

## Installer (4 steps)
1. Welcome — "Welcome to ARIA Sentinel" · "Resident IT support that never sleeps. Watches for problems, fixes them on-device, and keeps your data where it belongs." · "GET STARTED"
2. Permissions — "What ARIA needs": Run elevated fixes (UAC) · Add a recovery boot entry (enables BSOD "Solve it for me") · Read system event logs (local only)
3. Mode select — "Choose how ARIA helps" (Manual default)
4. Done — "ARIA is watching" · "The globe is in your corner. It stays calm until something needs attention. BSOD recovery is live." · "FINISH"

## First-run explainers
- SmartScreen: "Windows may show 'Windows protected your PC' because ARIA is newly published. Click More info → Run anyway. This is expected until code signing reputation builds — it's not a problem with the app."
- UAC: "You'll see 'Do you want to allow this app to make changes?' once. ARIA needs elevation to run fixes and add the recovery boot entry. Click Yes — it won't ask again unless a fix requires it." · Publisher: Integrated IT Support Inc.

## Tray menu
Header "ARIA Sentinel" / "Manual mode · watching" · Mode ▸ · Pause for 24 hours · Update knowledge · Open settings · Privacy verifier · Quit ARIA Sentinel.
(Pausing NEVER disables BSOD takeover.)

## Privacy verifier
- "0 data-upload paths to iisupp.net"
- Allowed outbound: GET aria-recipes · GET aria-stop-codes (inbound data, from iisupp.net) · POST {your-instance}.service-now.com/api/now/table/incident (your ITSM only).
- "KB stored encrypted in SQLite at %APPDATA%\AriaSentinel. Telemetry off by default." · "SOURCE-AVAILABLE HARNESS".

## Transparency log (mono, local only)
DETECT → RESTORE PT → RUN → RUN → DONE, each with HH:MM timestamp and the exact command/result. Closes with "Recovered 4.2 GB · 0 errors · no data left device".

## Restore point
"Restore point created" · name "ARIA pre-fix · 0619-1402" · "I saved a snapshot before clearing files. If anything looks wrong, roll back instantly." · "ROLL BACK THIS FIX".
