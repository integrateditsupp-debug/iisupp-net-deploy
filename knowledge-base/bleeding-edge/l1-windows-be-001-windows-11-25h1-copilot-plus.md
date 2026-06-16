---
id: l1-windows-be-001
title: "Windows 11 25H1 Copilot+ PC features — Recall, Click to Do, Cocreator, Live Captions"
category: windows
support_level: L1
severity: low
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 11 25H1+"]
tech_generation: bleeding-edge
year_range: "2024-present (Copilot+ PCs launched June 2024)"
eol_status: "Current. Microsoft 24-month support window per Windows 11 release."
prerequisites: ["Copilot+ PC (Qualcomm Snapdragon X, Intel Core Ultra 200V, or AMD Ryzen AI 300 with 16GB+ RAM and 40+ TOPS NPU)"]
keywords:
  - copilot plus
  - copilot+
  - recall
  - click to do
  - cocreator
  - paint cocreator
  - live captions
  - studio effects
  - npu
  - snapdragon x
  - intel core ultra
  - ryzen ai
  - windows 11 25h1
  - on-device ai
related_articles:
  - l1-windows-006-app-wont-open
  - l1-mac-be-001-macos-16-apple-intelligence
  - l1-ai-be-001-ai-coding-agents-business
escalation_trigger: "Customer is enrolling 10+ Copilot+ PCs at once — design rollout (Recall policies, data governance, group policy) before mass deployment."
last_updated: 2026-05-11
version: 1.0
---

# Windows 11 25H1 Copilot+ PC features — Recall, Click to Do, Cocreator, Live Captions

## 1. Symptoms
User bought a new Surface, Dell XPS 13, HP OmniBook, or Lenovo with "Copilot+ PC" badge. They've heard about Recall, Click to Do, and Cocreator but can't find them, or they're greyed out, or they're concerned about privacy and want to disable them.

## 2. Likely Causes
1. **Features not yet enabled** — Recall shipped general availability with 24H2 and 25H1 builds. Some SKUs and regions stage features over weeks.
2. **Windows Update incomplete** — features land via cumulative updates after initial setup.
3. **Region / language not supported** — Recall initially English (US/UK), Simplified Chinese, French, German, Italian, Japanese, Spanish.
4. **Group policy disabled features** — corporate-managed devices may have Recall blocked by IT.
5. **User isn't signed into a Microsoft account** with Windows Hello biometric enrollment (Recall requires Hello).

## 3. Questions To Ask User
1. Exact PC model and chip? (Settings → System → About → Device specifications.)
2. Windows build number? (Settings → System → About → Windows specifications → "OS build".)
3. Is this a personal device or managed by an employer / IT department?
4. Are you signed in with a Microsoft account, work account, or local account?
5. What feature are you trying to use and what happens when you try?

## 4. Troubleshooting Steps
1. Confirm Copilot+ PC: Settings → System → About → look for "Copilot+ PC" badge.
2. Check build: must be Windows 11 build 26100 (24H2) or 26200+ (25H1).
3. Run Windows Update: Settings → Windows Update → Check for updates → install all.
4. Set up Windows Hello (face / fingerprint / PIN): Settings → Accounts → Sign-in options.
5. Verify NPU is active: Task Manager → Performance tab → look for "NPU 0" alongside CPU, GPU.

## 5. Resolution Steps — by feature

**Recall (timeline of snapshots):**
1. Settings → Privacy & security → Recall & snapshots.
2. Toggle "Save snapshots" ON.
3. Configure: storage limit (25 GB default), excluded apps (browsers in private tabs auto-excluded), filter sensitive content (passwords, ID numbers auto-redacted by AI).
4. Open Recall: Win+J or pinned Taskbar icon. Search natural language: "the spreadsheet I had open yesterday morning."
5. **Privacy guidance for business users:** Recall data is encrypted with BitLocker + VBS Enclaves. Snapshots never leave the device. But: anyone with the device's Windows Hello can access. Treat as you would a screen recording.

**Click to Do (right-click intelligence on anything on screen):**
1. Win+Click on any image, text, or area of the screen.
2. Options appear: summarize text, rewrite, copy text from image, blur background, erase object, search the web for similar image.
3. Works without internet for text + image features (NPU local). Web-search options call the network.

**Paint Cocreator (text-to-image inside Paint):**
1. Open Paint → click Cocreator button (top right).
2. Type a prompt like "watercolor painting of a coffee shop at sunrise."
3. Use credits (50 free per Microsoft account, then $0.10 each via Microsoft Designer credits).
4. Pick a style: pencil sketch, ink sketch, watercolor, oil painting, digital art, photographic.

**Live Captions (with translation):**
1. Win+Ctrl+L to toggle.
2. First use prompts to download the on-device speech model (~1.5 GB).
3. Settings (gear icon in caption bar) → Caption language: select from 44 languages. Pick "Translate to" for live translation.
4. Works on any audio — meetings, YouTube, in-person via mic input.

**Studio Effects (camera & mic AI):**
1. Settings → Bluetooth & devices → Cameras → Default camera → Studio effects.
2. Toggle: Automatic framing, Background blur (standard / portrait), Eye contact (standard / teleprompter), Creative filters.
3. Mic Studio Effects: Voice focus, Background noise suppression — same Settings page under Sound.
4. Applies system-wide (Zoom, Teams, Discord all benefit).

## 6. Verification Steps
- Task Manager shows NPU activity > 0% when Recall/Click to Do runs.
- Live Captions display within 1-2 seconds of speech.
- Recall search returns relevant snapshot in under 3 seconds.
- Studio Effects visible in camera preview without app-specific setting.

## 7. Escalation Trigger
- Deploying 10+ Copilot+ PCs simultaneously → group policy planning (Recall data retention, app exclusion lists, encryption verification).
- Customer reports Recall captured genuinely sensitive content (password fields, banking) → review filter exclusions + escalate to L2 for app-block list config.
- NPU shows 0% utilization while features run → potential driver issue, escalate to L2.

## 8. Prevention Tips
- **Buy Copilot+ PC if buying new Windows hardware in 2026** — features only get more useful, and AI keeps moving on-device.
- **Train staff on Recall privacy posture** before rollout — what it does, what it doesn't, how to exclude apps/sites.
- **Inventory NPU TOPS** when speccing PCs — 40 TOPS minimum (Snapdragon X = 45 TOPS, Core Ultra 200V = 48 TOPS, Ryzen AI 300 = 50 TOPS).

## 9. User-Friendly Explanation
Your new PC has a special AI chip that lets it do things older computers can't. Recall remembers what you've been doing so you can find it again by describing it. Click to Do lets you right-click on anything on screen and have AI explain or rewrite it. Cocreator makes art from a sentence. Live Captions transcribes any audio in real time and even translates. All of it works without sending anything to the cloud — it stays on your PC.

## 10. Internal Technician Notes
- Recall storage: encrypted SQLite database at `%UserProfile%\AppData\Local\CoreAIPlatform.00\UKP\` — encrypted with key released only after Windows Hello unlock.
- Recall opt-out via Group Policy: Computer Config → Admin Templates → Windows Components → Windows AI → "Disable saving snapshots for Windows" → Enabled.
- VBS Enclaves: Virtualization-based security; runs Recall processing in isolated VTL1 — even local admin can't dump the keys without Hello unlock.
- Click to Do is built on the Phi Silica small language model (3.8B parameters) — runs entirely on NPU.
- Live Captions speech model: derived from Azure AI Speech, packaged for on-device.
- For corporate IT: Microsoft Defender for Endpoint can monitor Recall data access — recommended for regulated industries even though storage is local-encrypted.

## 11. Related KB Articles
- `l1-windows-006` — App won't open
- `l1-mac-be-001` — macOS 16 Apple Intelligence
- `l1-ai-be-001` — AI coding agents for business

## 12. Keywords / Search Tags
copilot plus, copilot+, recall, click to do, cocreator, paint cocreator, live captions, studio effects, npu, snapdragon x, intel core ultra 200v, ryzen ai 300, windows 11 25h1, on-device ai, phi silica, vbs enclaves, windows hello
