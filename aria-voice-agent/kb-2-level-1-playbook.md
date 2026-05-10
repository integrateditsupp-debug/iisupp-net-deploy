# KB-2 — Level-1 Playbook (solve on the call)

ARIA solves these on the line. Never escalate Level-1 unless caller explicitly asks for a human.

---

## L1-01 · Outlook keeps asking for password
**Symptom:** "Outlook keeps prompting me for my password" / "Won't accept my password."
**Triage:** "Is this Outlook on a desktop, or the web version? And is your work account Microsoft 365?"
**Fix:** Have them open Outlook → File → Account Settings → click their account → Repair. If that fails, Control Panel → Mail → Show Profiles → remove and re-add the account. For 365, also have them sign out and back into Office (top-right initials → Sign Out, then File → Office Account → Sign In).
**Sample line:** "That's almost always a stale credential — let's clear it out and re-sign in. Go to File at the top-left."
**Escalate if:** They say MFA push isn't arriving on their phone, or the account is on-premise Exchange.

## L1-02 · Cannot connect to Wi-Fi at all (laptop or phone)
**Triage:** "Can other devices in the same room reach the wifi? And does this device see the network name in the list?"
**Fix:** Toggle wifi off + on. Forget the network and rejoin with the password. Restart the device. On Windows: Settings → Network → Network reset (last resort). On Mac: remove and re-add the network in System Settings → Wi-Fi.
**Sample line:** "Let's start with the simplest thing — turn the wifi off, count to ten, turn it back on. Tell me when you've done that."
**Escalate if:** Multiple devices fail simultaneously (likely router/ISP issue → KB-3).

## L1-03 · Wi-Fi connected but no internet
**Triage:** "Does it say 'Connected, no internet' or just won't load pages? And can other devices reach the internet?"
**Fix:** Forget + rejoin the network. Reboot the router (unplug 30 sec). Try a different DNS (8.8.8.8 / 1.1.1.1). Flush DNS cache (Windows: `ipconfig /flushdns`).
**Sample line:** "Sometimes the wifi handshake half-finishes. Let's forget the network completely and join fresh."
**Escalate if:** Router reboot doesn't resolve and other devices also fail.

## L1-04 · Printer offline / won't print
**Triage:** "Is the printer powered on with no error lights? And is it the same wifi as your computer?"
**Fix:** Power-cycle printer (off 30 sec, on). Check default printer in Windows (Settings → Bluetooth & devices → Printers). Remove and re-add the printer. Clear the print queue (Settings → Printers → click printer → Open queue → Cancel All).
**Sample line:** "Printer queues love getting stuck. Let's clear it and try one fresh page."
**Escalate if:** Network printer with custom IP that won't reconnect — likely L2.

## L1-05 · No audio output / speakers silent
**Triage:** "Are headphones plugged in? And what does the speaker icon in the system tray show?"
**Fix:** Right-click the speaker icon → Sound settings → confirm the correct output device is selected (people often have Bluetooth headphones still selected). Increase volume. Try a different output device.
**Sample line:** "Nine times out of ten the audio is going to a Bluetooth headset that's still paired but in another room. Let's check."

## L1-06 · Microphone not detected (Zoom/Teams/Meet)
**Triage:** "Is the mic muted in the app, or not showing up at all?"
**Fix:** In the app's audio settings, check the input device dropdown. In Windows: Settings → Privacy & security → Microphone → confirm app permissions. In Mac: System Settings → Privacy & Security → Microphone → enable for the app. Restart the app.
**Sample line:** "Let's check the privacy permission first — Windows likes to silently revoke that after updates."

## L1-07 · Webcam not detected
**Fix:** Same privacy check pattern as the mic. Also: Device Manager → Cameras → right-click → enable. If it's covered by a privacy slider, nudge it open.
**Sample line:** "Let's also check the privacy slider on the laptop bezel — easy to miss."

## L1-08 · Browser slow / unresponsive
**Triage:** "Which browser, and is it slow on every site or just one?"
**Fix:** Clear cache + cookies for the affected site. Disable extensions one by one (Chrome: chrome://extensions). Try incognito mode to confirm. Restart the browser.
**Sample line:** "Let's open an incognito window and load the same page — that'll tell us if it's the cache or something deeper."

## L1-09 · Browser pop-ups / suspicious tabs (NOT phishing/breach)
**Triage:** "Are these popup windows opening on their own, or only when you click something?"
**Fix:** Run browser's Reset Settings (Chrome: Settings → Reset and clean up). Remove unfamiliar extensions. Check default search engine.
**Sample line:** "Let's reset Chrome — that nukes hijacked search engines and extensions in one shot."
**Escalate if:** Caller mentions "I clicked a link and now…" → likely phishing → KB-4.

## L1-10 · Cannot sign into Microsoft 365
**Triage:** "Is it asking for password, or rejecting it? And do you have MFA set up?"
**Fix:** Verify caps lock. Reset password at https://passwordreset.microsoftonline.com if they have access. Check MFA app for prompts.
**Sample line:** "Let's reset the password from the recovery page — I'll text you the link."
**Escalate if:** They have no recovery email/phone configured.

## L1-11 · Cannot sign into Google Workspace
**Fix:** Same pattern. Reset at https://accounts.google.com/signin/recovery. Check 2FA codes/app.
**Sample line:** "Same playbook — let's text you the recovery link."

## L1-12 · Forgot Windows password (local account)
**Fix:** If Microsoft account: passwordreset.microsoftonline.com. If pure local account: walk them through Windows recovery boot → Reset PC (keeps files). Warn it's a multi-hour process.
**Sample line:** "If it's a personal local account, this is a longer one — but I'll stay on the line through it."
**Escalate if:** Domain-joined / business AD account → L2/L3.

## L1-13 · Mouse or keyboard not working
**Triage:** "Wired or wireless? And is the device showing any lights?"
**Fix:** Replace batteries. Try a different USB port. For Bluetooth: forget + re-pair. Check Device Manager for unknown devices.
**Sample line:** "Let's swap to a different USB port first — sometimes one port goes flaky after a power blip."

## L1-14 · Computer slow on startup
**Fix:** Task Manager → Startup tab → disable non-essential apps (OneDrive can stay, Adobe/Steam/Skype can go). Run Disk Cleanup. Confirm at least 15% free disk space.
**Sample line:** "Most slow startups are 5–10 apps fighting to launch at once. Let's trim the herd."

## L1-15 · Bluetooth device won't pair
**Fix:** Toggle BT off + on. Forget the device. Make sure pairing mode is active (usually a held button). Move within 1m. On Windows, try re-installing BT driver via Device Manager.
**Sample line:** "Let's forget it completely and start the pairing dance fresh."

## L1-16 · iPhone or Android won't connect to PC
**Fix:** Check the cable (try another). Ensure phone is unlocked when connecting. On iPhone: tap "Trust this computer." On Android: enable USB debugging if needed for file transfer; otherwise switch USB mode to "File transfer."
**Sample line:** "On the phone, swipe down — there's usually a notification saying USB is set to charging only. Tap it and switch to file transfer."

## L1-17 · Display flickering / second monitor not detected
**Fix:** Reseat the cable. Try a different cable. Win+P to cycle display modes (extend/duplicate). Update display driver via Device Manager.
**Sample line:** "Let's hit Windows-key plus P and cycle through the display modes."

## L1-18 · Software won't open / "this app can't run on this PC"
**Fix:** Right-click → Run as Administrator. Check Windows version compatibility. Reinstall fresh from official source. Check antivirus quarantine.
**Sample line:** "Sometimes Windows quietly quarantines an app — let's check the security center."

## L1-19 · Zoom/Teams audio echo or low volume
**Fix:** In the app's audio settings, lower mic input volume. Enable noise suppression (Teams: Settings → Devices). Use headphones to eliminate room echo. Check that only one app has the mic open.
**Sample line:** "Echo is almost always two devices both hearing the speaker. Let's plug in headphones — instant fix."

## L1-20 · File won't open ("file format not supported")
**Fix:** Right-click → Open with → choose correct app. For .docx/.xlsx without Office: install LibreOffice or use Office Online (free). Confirm file isn't corrupted by trying to open it on another device.
**Sample line:** "Let me check what app it's trying to use — the Open With menu usually has the right one buried in there."

## L1-21 · Touchpad disabled / scrolling broken
**Fix:** Look for a function key with a touchpad icon (Fn+F5, F7, F9 vary by laptop). Settings → Bluetooth & devices → Touchpad → toggle on. Update touchpad driver.
**Sample line:** "Most laptops have a function key that toggles the touchpad — easy to hit by accident."

## L1-22 · Windows Update keeps prompting
**Fix:** Settings → Windows Update → Pause for 1 week. For an actually stuck update: run Windows Update Troubleshooter (Settings → System → Troubleshoot → Windows Update).
**Sample line:** "Let's pause it for a week so you're not nagged, then we can pick a quiet time to actually install."

## L1-23 · Browser bookmarks lost / profile restore
**Fix:** Chrome: chrome://settings → You and Google → Sync. If signed in, bookmarks restore. If not, check %localappdata%/Google/Chrome/User Data/Default/Bookmarks for the file.
**Sample line:** "If you're signed into Chrome, your bookmarks live in the cloud — let's get you re-synced."

## L1-24 · Email attachment too large
**Fix:** For Outlook/365: use OneDrive share link instead. For Gmail: Drive link. For Apple Mail: Mail Drop. File size limit is usually 25MB.
**Sample line:** "Anything over 25 megs you need to send as a link, not an attachment. Let me show you the OneDrive way."

## L1-25 · Cannot screen-share in Teams/Zoom
**Fix:** Mac: System Settings → Privacy & Security → Screen Recording → enable for the app + restart the app. Windows: usually works out of the box; if not, restart the app.
**Sample line:** "On Mac it's a privacy permission — let me walk you to the right setting."
