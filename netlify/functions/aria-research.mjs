// aria-research v0.5 — Research Agent: maps user query → symbolic operational state → curated recipe.
// POST /.netlify/functions/aria-research  body: { query, state? }  →  { ok, state, title, steps, confidence, source }
//
// AROC §4 compliance: every problem is encoded as a symbolic state code (DISK.FULL, NET.WIFI.AUTH, ...).
// Recipes are curated (no external API → no cost, no latency, no TOS risk). Library grows by appending entries.
// AROC §6 compliance: never confident on low-evidence — confidence reported per match; below 0.7 → caveat surfaces.

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, cors, { error: 'invalid JSON' }); }

  const query = (body.query || '').toString().toLowerCase().trim();
  const stateHint = (body.state || '').toString().toUpperCase().trim();
  if (!query && !stateHint) return jsonResp(400, cors, { error: 'query or state required' });

  // Hash query to symbolic state (if no explicit state hint)
  const detected = stateHint || detectState(query);

  const recipe = LIBRARY[detected];
  if (!recipe) {
    return jsonResp(200, cors, {
      ok: true,
      state: detected || 'UNKNOWN',
      title: null,
      steps: [],
      confidence: 0.0,
      source: 'no-match',
      caveat: 'No curated recipe matched. Recommend specialist escalation.'
    });
  }

  // confidence: high for stateHint (caller already classified), medium when we did the hash
  const confidence = stateHint ? 0.92 : (recipe.confidence ?? 0.85);

  return jsonResp(200, cors, {
    ok: true,
    state: detected,
    title: recipe.title,
    steps: recipe.steps,
    confidence,
    source: 'curated-library-v1',
    caveat: confidence < 0.7 ? "Confidence is moderate — confirm with the user before acting on irreversible steps." : null
  });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

// ============= SYMBOLIC STATE DETECTOR =============
// Per AROC §4: hash surface forms to a canonical operational state code.
// Each entry uses word-boundary regex to avoid false-matches (e.g. bare "out" must NOT match outlook OOO).
const STATE_PATTERNS = {
  // Disk / storage
  'DISK.FULL':           /\b(out of (disk )?space|low on (disk )?space|no (disk )?space left|disk (is )?full|drive (is )?full|running (out of|low on) disk|low disk space|hard drive full|ssd (is )?full|c drive (is )?(full|out of space|low)|free up disk)\b/i,
  // OS performance
  'OS.SLOW.PERF':        /\b((computer|laptop|pc|machine) (is )?(slow|sluggish|laggy|crawling)|running slow|performance lag|takes forever|frozen|freezes|hang(s|ing))\b/i,
  'OS.BOOT.FAIL':        /\b(won.?t boot|black screen|blue screen|bsod|stuck on boot|won.?t start|will not turn on)\b/i,
  // Network
  'NET.WIFI.AUTH':       /\b(wifi (won.?t|cannot|can.?t) connect|wifi (not )?working|wrong password.*wifi|wifi password|incorrect (network )?password|connection refused.*wifi)\b/i,
  'NET.WIFI.NO.CONN':    /\b(can.?t connect to wifi|no wifi|no internet|wifi (is )?(down|broken|gone)|no network|disconnected|cannot reach internet)\b/i,
  'NET.SLOW':            /\b((internet|network|wifi|connection) (is )?slow|slow internet|slow connection|bandwidth (issue|problem))\b/i,
  // M365 / Outlook
  'M365.OUTLOOK.SEND':   /\b(outlook (won.?t|cannot|can.?t) send|email (won.?t|cannot|can.?t) send|stuck in outbox|cannot send (email|mail))\b/i,
  'M365.OUTLOOK.RECV':   /\b(outlook (not |won.?t |cannot |can.?t )?(receiv|getting)|email not (coming|arriving|received))\b/i,
  'M365.OUTLOOK.OOO':    /\b(out of office|ooo|vacation responder|auto[-\s]?reply|automatic repl(y|ies)|outlook ooo|set ooo)\b/i,
  'M365.OUTLOOK.OPEN':   /\b(outlook (won.?t|cannot|can.?t) open|outlook crash|outlook hangs|outlook frozen|outlook not responding)\b/i,
  // Auth
  'AUT.PW.RESET':        /\b(forgot (my )?password|need to reset (my )?password|password reset|reset password|cannot log ?in|locked out|account locked)\b/i,
  'AUT.MFA.LOCK':        /\b(mfa (not )?working|2fa (not )?working|authenticator|lost (my )?phone|lost (my )?authenticator|cannot get (the )?code)\b/i,
  // Printer
  'PRT.OFFLINE':         /\b(printer (is )?(offline|not (showing|working|connecting))|cannot (find|see) printer|printer not detected)\b/i,
  'PRT.QUEUE.STUCK':     /\b(print queue (is )?stuck|print job (is )?stuck|cannot clear print queue|printer paused|jam(med)?)\b/i,
  // Security
  'SEC.PHISH':           /\b(suspicious (email|link|site|message)|phishing|is this (a )?scam|got a weird email|received .* link)\b/i,
  'SEC.MALWARE':         /\b(virus|malware|infected|ransom(ware)?|trojan|spyware|popups|browser hijack)\b/i,
  // VPN
  'VPN.AUTH.FAIL':       /\b(vpn (won.?t|cannot|can.?t) connect|vpn (authentication|auth) (failed|fail|error)|vpn login (failed|wrong))\b/i,
  'VPN.NO.TUNNEL':       /\b(vpn (connected )?but no internet|vpn slow|tunnel (won.?t|cannot) (open|establish)|vpn drops?)\b/i,
  // Cloud storage
  'CLOUD.SYNC':          /\b(onedrive (not )?syncing|sharepoint (not )?syncing|dropbox (not )?syncing|google drive (not )?syncing|sync (error|failed|stuck))\b/i,
  // Software install
  'SW.INSTALL.FAIL':     /\b((install|installation) (failed|error|stuck)|cannot install|setup (failed|error)|msi error|installer (crash|fail))\b/i,
  'SW.UPDATE.FAIL':      /\b((update|upgrade) (failed|error|stuck)|windows update.*(fail|error|stuck)|cannot update|update loop)\b/i
};

function detectState(query) {
  if (!query) return null;
  for (const [state, re] of Object.entries(STATE_PATTERNS)) {
    if (re.test(query)) return state;
  }
  return null;
}

// ============= CURATED RECIPE LIBRARY =============
// 5-step recipes per state. Steps are USER-FACING (not admin commands).
// AROC §4: each state code replaces N surface-string KB entries — store less, understand more.
const LIBRARY = {
  'DISK.FULL': {
    title: 'C drive / disk is out of space',
    steps: [
      'Open Settings → System → Storage. Check which drive is full.',
      'Click "Temporary files" → tick Recycle Bin, Temporary files, Delivery Optimization Files → Remove.',
      'Open Storage Sense (toggle on) → Run Storage Sense now. This frees Windows.old + cache.',
      'In File Explorer, right-click the drive → Properties → Disk Cleanup → "Clean up system files" → tick everything safe.',
      'If still under 10% free: move Downloads + OneDrive cache to another drive, or run "wmic logicaldisk get caption, freespace" to confirm.'
    ],
    confidence: 0.92
  },
  'OS.SLOW.PERF': {
    title: 'Computer is slow / sluggish',
    steps: [
      'Press Ctrl+Shift+Esc → open Task Manager → Performance tab. Check CPU, Memory, Disk, Network for anything stuck at 100%.',
      'If Memory is at 100%: Processes tab → sort by Memory → end the top non-essential process.',
      'If Disk is at 100%: same Processes tab → sort by Disk → check for SearchIndexer, Windows Update, antivirus scan. Pause antivirus full scan if running.',
      'Settings → Apps → Startup → disable everything not essential (browsers, chat apps, etc.). Reboot.',
      'If still slow: Settings → System → Recovery → "Reset this PC" → "Keep my files" is the last-resort fix.'
    ],
    confidence: 0.90
  },
  'OS.BOOT.FAIL': {
    title: 'PC won\'t boot / black screen / BSOD',
    steps: [
      'Hard-power-off (hold power 10 sec). Disconnect all USB devices except keyboard + mouse. Power on.',
      'If still no boot: power on → hard-off three times in a row → Windows enters Automatic Repair.',
      'In Automatic Repair: Advanced options → Troubleshoot → Startup Repair. Let it finish.',
      'If repair fails: same menu → Command Prompt → run `sfc /scannow` then `chkdsk C: /f /r` → reboot.',
      'If BSOD with a stop code: photograph the code (e.g., MEMORY_MANAGEMENT) and escalate — likely hardware.'
    ],
    confidence: 0.85
  },
  'NET.WIFI.AUTH': {
    title: 'WiFi authentication / password issue',
    steps: [
      'Settings → Network → WiFi → Manage known networks → forget the network.',
      'Reconnect — re-enter the password carefully (case sensitive).',
      'If still rejected: confirm the password with whoever owns the router. Default routers often have the password printed on the device.',
      'On corporate WiFi (802.1X): check that your account isn\'t locked and that the device certificate is current.',
      'Last resort: `netsh wlan delete profile name="<SSID>"` then re-add the network.'
    ],
    confidence: 0.90
  },
  'NET.WIFI.NO.CONN': {
    title: 'WiFi / network not connecting',
    steps: [
      'Confirm airplane mode is OFF. Right-click WiFi icon → Diagnose problems.',
      'Try other networks (phone hotspot). If those work, the issue is the target network, not your device.',
      'Restart the router: unplug power, wait 30 sec, plug back. Wait 2 min for full boot.',
      'Run `ipconfig /flushdns` then `ipconfig /release` then `ipconfig /renew` in an admin Command Prompt.',
      'If still failing: Device Manager → Network adapters → right-click WiFi adapter → Update driver. Then reboot.'
    ],
    confidence: 0.88
  },
  'NET.SLOW': {
    title: 'Internet is slow',
    steps: [
      'Run a speed test (fast.com or speedtest.net). Compare against your plan\'s rated speed.',
      'If speedtest is OK but specific sites are slow: clear browser cache, try a different browser.',
      'If speedtest is slow too: restart router. Move closer if WiFi. Plug in via Ethernet to isolate WiFi vs ISP.',
      'Task Manager → Performance → Network tab. If Disk + Network are both pegged: pause OneDrive / Dropbox syncs and Windows Update.',
      'If consistently slow: ISP issue. Call the ISP with your speedtest results.'
    ],
    confidence: 0.85
  },
  'M365.OUTLOOK.SEND': {
    title: 'Outlook won\'t send email',
    steps: [
      'Check Outbox folder. If the message sits there: right-click → Move to Drafts → reopen → re-send.',
      'Send/Receive tab → "Work Offline" — confirm it is OFF (button shouldn\'t look depressed).',
      'File → Account Settings → check Repair on the email account.',
      'If repeated send failures: confirm SMTP server settings match your tenant (port 587, TLS, your username).',
      'If the message is large: attachments over 25 MB get rejected. Move large files to OneDrive and share a link instead.'
    ],
    confidence: 0.88
  },
  'M365.OUTLOOK.OOO': {
    title: 'Set Out of Office / auto-reply',
    steps: [
      'Open Outlook → File → Automatic Replies (Out of Office).',
      'Select "Send automatic replies". Optionally set a date range.',
      'Type your reply for "Inside my organization" tab. Then click "Outside My Organization" tab and write a version for external senders.',
      'Click OK. Outlook will start auto-replying to incoming mail within ~1 minute.',
      'On the web: Outlook.com → Settings (gear) → Mail → Automatic replies. Same fields.'
    ],
    confidence: 0.95
  },
  'M365.OUTLOOK.OPEN': {
    title: 'Outlook won\'t open / crashes / not responding',
    steps: [
      'Close Outlook completely (Task Manager → end Outlook.exe if needed).',
      'Reopen Outlook holding Ctrl — it asks to start in Safe Mode. If Safe Mode works → an add-in is the culprit.',
      'File → Options → Add-ins → at bottom select COM Add-ins → Go → uncheck all → restart.',
      'If still won\'t open: run "Outlook.exe /resetnavpane" (Win+R, paste it). Then try opening normally.',
      'Last resort: File → Account Settings → uncheck "Use Cached Exchange Mode" → restart Outlook → recheck after sign-in.'
    ],
    confidence: 0.85
  },
  'AUT.PW.RESET': {
    title: 'Password reset / locked out',
    steps: [
      'Go to https://passwordreset.microsoftonline.com (for M365) or the company SSO sign-in page → click "Forgot my password".',
      'Confirm identity via phone / authenticator / backup email.',
      'Choose a new password meeting policy: 12+ chars, mixed case, number, symbol. Avoid prior passwords.',
      'After reset, sign out of EVERY device (Outlook on phone, Teams, OneDrive) and sign back in with the new password.',
      'If locked out repeatedly: contact our helpdesk at (647) 581-3182 — admin can unlock from Entra/AD directly.'
    ],
    confidence: 0.92
  },
  'AUT.MFA.LOCK': {
    title: 'MFA / authenticator not working',
    steps: [
      'If you lost the phone with the authenticator: helpdesk must reset MFA from the admin console. Call (647) 581-3182.',
      'If the authenticator is on a new phone: open Microsoft Authenticator → scan the QR from https://aka.ms/mfasetup after admin re-issues the enrollment.',
      'If you have backup codes: use one to sign in, then re-enroll the authenticator.',
      'If the code seems wrong: phone time is off. Settings → Date & time → enable automatic time. The TOTP code depends on accurate time.',
      'For SMS fallback: confirm your phone number is current in https://account.microsoft.com → Security info.'
    ],
    confidence: 0.85
  },
  'PRT.OFFLINE': {
    title: 'Printer is offline / not showing',
    steps: [
      'Confirm the printer is powered on and connected to the same WiFi as your computer.',
      'Settings → Bluetooth & devices → Printers & scanners → click the printer → "Open print queue" → Printer menu → uncheck "Use Printer Offline".',
      'If it\'s still offline: remove and re-add the printer. Manufacturer website + model number gets you the latest driver.',
      'For network printers: ping the printer\'s IP from Command Prompt. If no response, the printer dropped off the network — restart it.',
      'If shared via a print server: try restarting the Print Spooler service (services.msc → Print Spooler → Restart).'
    ],
    confidence: 0.88
  },
  'PRT.QUEUE.STUCK': {
    title: 'Print queue is stuck / jam',
    steps: [
      'Open print queue (Settings → Printers → printer → Open queue). Cancel all jobs.',
      'If they won\'t clear: services.msc → Print Spooler → Stop. Open File Explorer → C:\\Windows\\System32\\spool\\PRINTERS → delete everything inside. Restart Print Spooler.',
      'For paper jams: open the printer, follow the jam-clearing diagram on the printer (it usually lights up the jammed section).',
      'After clearing: send a test print from Notepad — simplest possible print to isolate driver issues.',
      'If queue keeps getting stuck on the same job: that job is malformed. Re-create the PDF or recopy the document.'
    ],
    confidence: 0.85
  },
  'SEC.PHISH': {
    title: 'Suspicious email / link / phishing check',
    steps: [
      'DO NOT click the link or reply. Do not download attachments.',
      'Hover the sender name to reveal the actual email address — phishing often uses look-alike domains (microsft.com vs microsoft.com).',
      'Hover the link to see the destination URL. If it doesn\'t match what the text claims, it\'s suspicious.',
      'If you must verify: open a new browser tab and navigate to the supposed sender\'s site directly (don\'t click the email link).',
      'Forward the message to integrateditsupp@iisupp.net for review. Then delete from your inbox.'
    ],
    confidence: 0.95
  },
  'SEC.MALWARE': {
    title: 'Suspected virus / malware / ransomware',
    steps: [
      'Disconnect the device from the network immediately (turn off WiFi, unplug Ethernet) to prevent spread.',
      'DO NOT shut down — many incident-response tools need a live state. Take a photo of any ransom note or pop-up.',
      'Open Windows Security → Virus & threat protection → Quick scan first, then Full scan.',
      'If ransomware (files renamed, ransom note present): DO NOT pay. Call (647) 581-3182 immediately. We have incident-response procedures.',
      'After scan: change passwords for any account accessed on this device from a CLEAN device. Enable MFA everywhere.'
    ],
    confidence: 0.92
  },
  'VPN.AUTH.FAIL': {
    title: 'VPN authentication failed',
    steps: [
      'Confirm username + password are current. If you recently reset your password, the VPN may still have the old one cached — re-enter.',
      'If MFA-protected: ensure you\'re approving the MFA prompt promptly (most VPNs time out at 30 sec).',
      'Check the VPN client for an update. Old clients often fail against modern servers.',
      'If your account was recently created: confirm with admin that VPN access was granted to your group.',
      'Last resort: uninstall the VPN client, reboot, reinstall the latest version from our IT portal.'
    ],
    confidence: 0.85
  },
  'VPN.NO.TUNNEL': {
    title: 'VPN connects but no internet / drops',
    steps: [
      'Disconnect + reconnect the VPN once. Sometimes the route table is corrupted on first connect.',
      'Check split tunneling: if enabled, you should reach internet + corporate; if not, all traffic goes through corporate gateway.',
      'In an admin Command Prompt: `ipconfig /all` — confirm the VPN adapter has an IP. If not, the tunnel isn\'t fully up.',
      'If WiFi underneath is unstable, VPN drops will follow. Try ethernet.',
      'If consistently dropping: collect the VPN client log (Help → Diagnostic Report) and send to helpdesk.'
    ],
    confidence: 0.83
  },
  'CLOUD.SYNC': {
    title: 'OneDrive / SharePoint / Drive not syncing',
    steps: [
      'Right-click the cloud icon in the system tray → check for "Paused" or error indicators.',
      'If paused: click → Resume sync. If error: click the error → follow the prompt.',
      'For OneDrive specifically: Settings (cloud icon → gear → Settings) → Account tab → "Unlink this PC" → re-link with your account.',
      'If a specific file is stuck: rename it (sometimes special characters like # or % block sync), or delete the local copy and let cloud re-download.',
      'For files larger than 100 GB: OneDrive blocks them. Move to SharePoint document libraries instead.'
    ],
    confidence: 0.85
  },
  'SW.INSTALL.FAIL': {
    title: 'Software install failed',
    steps: [
      'Confirm the installer matches your OS architecture (x64 vs ARM64 vs x86). Win+R → "msinfo32" shows yours.',
      'Right-click the installer → Run as administrator. UAC blocks many installers from regular accounts.',
      'Check disk space: at least 10 GB free recommended for large installs.',
      'Uninstall any previous version cleanly via Settings → Apps before reinstalling.',
      'If you hit a specific MSI error code (e.g., 1603), search that exact code — most have known fixes documented.'
    ],
    confidence: 0.82
  },
  'SW.UPDATE.FAIL': {
    title: 'Windows / app update failed',
    steps: [
      'Settings → Windows Update → Update history. Find the failed update and note the KB number + error code.',
      'Run the Windows Update Troubleshooter: Settings → Troubleshoot → Other → Windows Update → Run.',
      'Disk Cleanup → "Clean up system files" → tick "Windows Update Cleanup". Clears stuck update files.',
      'Manually: download the KB from the Microsoft Update Catalog (catalog.update.microsoft.com) and install the .msu.',
      'If update loops: Settings → Update → Pause updates for 1 week → let the issue settle, then resume.'
    ],
    confidence: 0.83
  }
};
