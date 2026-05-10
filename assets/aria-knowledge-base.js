/**
 * ARIA Knowledge Base — 25 years of IT pro greatest hits.
 * Used for instant pattern-match before calling AI (saves cost + latency).
 * If user message matches a known pattern, return the pro fix immediately.
 */
window.ARIA_KB = (function () {
  const KB = [
    // ─── SLOW COMPUTER (most common call) ───
    { match: /\b(slow|sluggish|lag|laggy|freezing|frozen)\b.*(pc|computer|laptop|machine|mac)/i,
      category: 'software',
      fix: "Slow computer — let's fix this. Three things to check right now:\n\n1. **Restart** if you haven't in the last 2 days — clears RAM and kills runaway processes.\n2. **Open Task Manager** (Ctrl+Shift+Esc on Windows, Cmd+Space → 'Activity Monitor' on Mac) — look for anything using 50%+ CPU or memory. Tell me what you see.\n3. **Check free disk space** — you need at least 15% free. Right-click your C: drive → Properties.\n\nWhich of those do you want to start with? Or tell me when the slowness started and I'll narrow it down faster." },

    // ─── WI-FI ───
    { match: /(wi.?fi|wireless|internet|network).{0,30}(slow|down|disconnect|drop|won.?t|cant|can.?t connect)/i,
      category: 'network',
      fix: "Wi-Fi trouble — let's diagnose this step by step:\n\n1. **Check other devices** — are they also affected? (If yes → router problem. If no → this device only.)\n2. **Restart your router** — unplug the power for a full 60 seconds, then plug back in. Wait 2 minutes for it to fully boot.\n3. **On your device** — go to Wi-Fi settings, tap 'Forget' on your network, then rejoin with the password.\n4. **Flush DNS** — on Windows: open Command Prompt and type 'ipconfig /flushdns'. On Mac: open Terminal and type 'sudo dscacheutil -flushcache'.\n\nStart with step 1 — are other devices on the same network also having issues?" },

    // ─── PRINTER ───
    { match: /\b(printer|printing|print queue)\b.*(not|won.?t|stuck|frozen|wrong|jam)/i,
      category: 'hardware',
      fix: "Printer acting up — let's clear it. Try these in order:\n\n1. **Clear the print queue** — on Windows: Settings → Devices → Printers → Open queue → Cancel all. On Mac: System Preferences → Printers → select printer → Open Print Queue → Cancel.\n2. **Restart the print spooler** — on Windows: open Services (type 'services.msc' in Start), find 'Print Spooler', right-click → Restart.\n3. **Check physical connection** — is it USB or network? If USB, try a different port. If network, make sure the printer is on the same Wi-Fi.\n4. **Reinstall the driver** — go to the printer manufacturer's website, download the latest driver for your model.\n\nWhich step do you want to try first? And is this a USB or network printer?" },

    // ─── EMAIL ───
    { match: /\b(outlook|gmail|email|inbox|mail)\b.*(not|won.?t|stuck|frozen|sync|password|loading)/i,
      category: 'email',
      fix: "Email not working — let's narrow it down:\n\n1. **Test webmail first** — open a browser and go to outlook.com or gmail.com. Can you log in there?\n   - If YES → the problem is with your app/client, not your account.\n   - If NO → this is an account or password issue.\n2. **Changed your password recently?** Many email apps need you to re-enter the new password manually.\n3. **Check for MFA** — is your phone receiving verification codes? Sometimes MFA tokens expire.\n4. **Remove and re-add the account** in your email app — this forces a fresh sync.\n\nTry step 1 first and tell me what happens." },

    // ─── PASSWORD / LOGIN ───
    { match: /\b(password|login|sign in|locked out|account)\b.*(not|won.?t|wrong|forgot|reset)/i,
      category: 'account',
      fix: "Login trouble — let's get you back in:\n\n1. **Check Caps Lock and Num Lock** — this catches 90% of 'wrong password' errors.\n2. **Account lockout** — if you tried too many times, most systems lock for 15–30 minutes. Wait and try once more.\n3. **Self-service password reset** — look for 'Forgot password?' on the login page. Use your recovery email or phone.\n4. **MFA check** — is your phone receiving the 2FA code? Try the SMS option if the authenticator app isn't working.\n5. **Try incognito/private browsing** — sometimes browser extensions or cached data interfere.\n\nWhich service or app are you trying to log into?" },

    // ─── BLUE SCREEN / WON'T BOOT ───
    { match: /\b(blue screen|bsod|won.?t (boot|start|turn on)|black screen|stuck on logo|spinning wheel)\b/i,
      category: 'hardware',
      fix: "Boot/crash issue — let's work through this carefully:\n\n1. **Hard power cycle** — hold the power button for 30 full seconds to drain all power, then try starting again.\n2. **Safe Mode** — during startup, press F8 (Windows) or hold Shift (Mac) to enter Safe Mode. If it boots in Safe Mode, a recent driver or software is the cause.\n3. **Check for blue screen error code** — if you see a stop code (like 0x0000007E or IRQL_NOT_LESS_OR_EQUAL), write it down and tell me.\n4. **Unplug external devices** — remove all USB devices, docks, and external monitors, then try booting.\n\nIf you can get into Safe Mode, we can uninstall the problem driver or update. Try step 1 first — does it power on at all?" },

    // ─── VIRUS / SECURITY ───
    { match: /\b(virus|malware|hacked|ransom|infected|trojan|phishing|scam)\b/i,
      category: 'security',
      fix: "Security concern — act quickly but stay calm.\n\n**Immediate steps:**\n1. **Disconnect from internet** — unplug ethernet or turn off Wi-Fi. This stops the threat from spreading.\n2. **Do NOT click any links, pay any ransom, or call any phone numbers shown on screen.**\n3. **Do NOT shut down** if you see ransomware — just disconnect.\n\n**Next steps (once disconnected):**\n4. **Run a full scan** — Windows Defender (built-in), or Malwarebytes (free) are both solid. Run in Safe Mode for best results.\n5. **Change your passwords** from a DIFFERENT clean device — start with email, then banking.\n6. **Check your email** for 'password reset' notifications you didn't request.\n\nIf this is an active ransomware attack or confirmed data breach affecting your business, call **(647) 581-3182** for live incident response. Otherwise, let me guide you through cleanup.",
      escalate: false },

    // ─── DATA LOSS ───
    { match: /\b(lost (file|data|photo|document)|deleted|recover|backup|gone|missing)\b/i,
      category: 'security',
      fix: "Data loss — there's still hope. Let's recover it:\n\n1. **Check Recycle Bin / Trash** — right-click the file → Restore. (Works more often than people think.)\n2. **Check cloud sync** — OneDrive, iCloud, Google Drive, and Dropbox all keep deleted files for 30 days. Check the 'Trash' or 'Deleted' folder in the cloud service.\n3. **File History / Time Machine** — Windows: right-click the folder → 'Restore previous versions'. Mac: open Time Machine from the menu bar.\n4. **Stop using the drive** — every new file written reduces recovery odds.\n5. **Shadow copies** — on Windows, try running 'vssadmin list shadows' in Command Prompt (as admin) to see if restore points have your file.\n\nWhich of these do you want to try first? And what type of file was lost?" },

    // ─── UPDATES / WINDOWS ───
    { match: /\b(windows update|software update|stuck (at|on)|installing|update (failed|stuck|loop))\b/i,
      category: 'software',
      fix: "Update stuck — let's fix it:\n\n1. **Wait 30 minutes** — sometimes it genuinely needs time, especially after a major update.\n2. **If still stuck** — hold the power button to force restart. Most updates can safely resume.\n3. **Run the troubleshooter** — Settings → Update & Security → Troubleshoot → Windows Update.\n4. **Clear update cache** — open Command Prompt as admin, run: 'net stop wuauserv' then 'ren C:\\Windows\\SoftwareDistribution SoftwareDistribution.old' then 'net start wuauserv'\n5. **Safe Mode** — boot into Safe Mode and try the update from there.\n\nWhich Windows version (10 or 11)? And how long has it been stuck?" },

    // ─── BLUETOOTH / DEVICES ───
    { match: /\b(bluetooth|wireless|airpods|mouse|keyboard|headphones)\b.*(not|won.?t|stuck|disconnect|pair)/i,
      category: 'hardware',
      fix: "Bluetooth pairing issue — try these steps:\n\n1. **Turn Bluetooth off and on** on your computer/phone.\n2. **Forget the device** — go to Bluetooth settings, find the device, click 'Remove' or 'Forget', then try pairing fresh.\n3. **Check the accessory** — make sure it's in pairing mode (usually hold the button until the light flashes). Also check the battery.\n4. **Restart Bluetooth service** — on Windows: open Device Manager, right-click your Bluetooth adapter → Disable, wait 10 seconds, Enable.\n5. **Check distance** — stay within 10 feet with no walls between.\n\nWhich device are you trying to connect, and what OS are you on?" },

    // ─── BROWSER ───
    { match: /\b(chrome|edge|firefox|safari|browser)\b.*(slow|won.?t|crash|frozen|loading)/i,
      category: 'software',
      fix: "Browser acting up — let's clear it:\n\n1. **Hard refresh** — press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac). This bypasses the cache.\n2. **Clear cache and cookies** — Settings → Privacy → Clear browsing data → select 'All time'.\n3. **Test in incognito/private mode** — if it works there, an extension is the problem. Disable extensions one by one to find the culprit.\n4. **Check for updates** — Settings → About → make sure browser is up to date.\n5. **Reset browser** — as a last resort, Settings → Reset settings → 'Restore settings to their original defaults'.\n\nWhich browser and which site or page is causing trouble?" },

    // ─── MICROSOFT 365 / OFFICE ───
    { match: /\b(office|microsoft|word|excel|teams|onedrive|sharepoint)\b.*(not|won.?t|crash|sync)/i,
      category: 'software',
      fix: "Microsoft 365 issue — let's fix it:\n\n1. **Sign out and back in** — this refreshes your auth tokens and fixes most sync issues.\n2. **Quick Repair** — Control Panel → Programs → Microsoft Office → Change → Quick Repair. If that doesn't work, try Online Repair.\n3. **OneDrive sync stuck?** — right-click the OneDrive cloud icon in the taskbar → Settings → Pause syncing → Resume.\n4. **Teams acting up?** — clear the cache: close Teams, delete everything in %appdata%\\Microsoft\\Teams\\Cache, reopen.\n5. **Update Office** — open any Office app → File → Account → Update Options → Update Now.\n\nWhich specific app is giving you trouble?" },

    // ─── MAC SPECIFIC ───
    { match: /\b(mac|macbook|imac|macos|safari)\b.*(slow|crash|spinning|beach ball|kernel)/i,
      category: 'software',
      fix: "Mac trouble — let's sort this out:\n\n1. **Restart** — Apple menu → Restart. If the first 5 minutes after restart are smooth but it slows down later, a specific app is the cause.\n2. **Check Activity Monitor** — open Spotlight (Cmd+Space), type 'Activity Monitor'. Sort by CPU or Memory to find the culprit.\n3. **Free disk space** — Apple menu → About This Mac → Storage. You need at least 15% free.\n4. **Reset NVRAM** — restart and immediately hold Option+Command+P+R for 20 seconds. Fixes display, boot, and audio quirks.\n5. **Safe Boot** — restart and hold Shift until you see the login screen. This clears caches and runs disk checks.\n\nWhich Mac model and macOS version are you running?" },

    // ─── BUSINESS IT QUESTIONS ───
    { match: /\b(small business|company|office|managed (it|services?)|business it|consult)/i,
      category: 'other',
      fix: "Business IT — I can help with technical questions right now, or point you to managed services:\n\nFor immediate tech issues (network, email, servers, security) — ask me and I'll walk you through it.\n\nFor managed IT plans:\n1. **Self-serve AI** — Personal ($599/mo) or Pro ($1,500/mo)\n2. **Managed retainers** — Small Business ($7,500/mo, up to 20 users), Mid-Size ($18,000/mo, up to 50), Enterprise ($30,000/mo, 51-200+)\n3. **Live consultation** — call (647) 581-3182\n\nWhat's the specific issue or question you need help with?" },

    // ─── PRICING QUESTIONS ───
    { match: /\b(price|cost|pricing|how much|plan|tier|subscription)\b/i,
      category: 'other',
      fix: "ARIA pricing:\n\n• **Personal** — $599/mo or $7,188/yr (1 device)\n• **Pro** — $1,500/mo or $18,000/yr (3 devices, voice + tickets)\n• **Small Business** — $7,500/mo (up to 20 users)\n• **Mid-Size** — $18,000/mo (up to 50 users)\n• **Enterprise** — $30,000/mo (51-200+ users)\n\nAll plans include AI helpdesk + escalation to live agents. Want me to walk through what each includes?" },

    // ─── GREETINGS / OPENERS ───
    { match: /^(hi|hello|hey|good morning|good afternoon|yo|sup)\s*[\.\!]?$/i,
      category: 'other',
      fix: "Hi — I'm ARIA, a senior IT technician with 25 years of experience. I'm here to actually fix your problem, not redirect you.\n\nI can help with:\n• Computer running slow, crashing, or won't boot\n• Wi-Fi, network, or internet issues\n• Email, password, or login problems\n• Printer, Bluetooth, or device issues\n• Software crashes, updates, or errors\n• Security concerns, data recovery\n• Business IT planning\n\nWhat's going on? Describe the issue and I'll start troubleshooting." },

    // ─── THANK YOU / RESOLVED ───
    { match: /^(thanks?|thank you|that worked|fixed|resolved|all good|perfect)/i,
      category: 'other',
      resolved: true,
      fix: "Glad we got it sorted. I've noted what fixed it for future reference. If the issue comes back or anything else comes up, just come back here — I'll pick up where we left off. Have a great day." },
  ];

  function lookup(message) {
    if (!message || typeof message !== 'string') return null;
    for (const entry of KB) {
      if (entry.match.test(message)) {
        return {
          text: entry.fix,
          category: entry.category,
          resolved: !!entry.resolved,
          escalate: !!entry.escalate,
          source: 'kb',
        };
      }
    }
    return null;
  }

  return { lookup, KB };
})();
