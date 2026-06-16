/* ARIA reasoning engine v1 — clean, client-side, $0 (no API calls).
   Fixes the live defects:
     1) Ask ONE clarifying question, then WAIT. No more question + canned-dump in the same turn.
     2) Context carryover: a follow-up answer branches WITHIN the active topic (no re-route to "computer slow").
     3) Weighted intent classification (not first-keyword-wins) with an honest low-confidence path.
     4) Honest about capability: ARIA guides; it does not execute on the user's device from the browser.
   UI-agnostic: handleTurn(session, text) -> { say, ask, options, steps, escalate, stage, topic, confidence }.
   The page adapter renders these; ARIA never claims a fix it did not perform.
*/
(function (root) {
  'use strict';

  // ---- text utils ----
  function norm(s) {
    return (s || '').toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9\s\-\/\.]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function has(t, w) { return t.indexOf(w) >= 0; }
  function anyHas(t, arr) { return arr.some(function (w) { return has(t, w); }); }

  // ---- knowledge base ----
  // Each topic: id, label, tier, signals (weighted), the ONE clarifier, branches keyed by answer-signals,
  // a default guided path, and an escalation trigger. Steps are guidance the USER performs.
  var TOPICS = [
    {
      id: 'outlook', label: 'Outlook won\'t open / crashing', tier: 'L1',
      signals: [['outlook', 5], ['email client', 3], ['mail app', 2]],
      apps: ['outlook'],
      clarifier: {
        q: 'When you open Outlook right now, which happens?',
        options: ['Nothing happens', 'It freezes / hangs', 'It closes itself', 'I get an error message']
      },
      branches: [
        {
          when: ['freeze', 'frozen', 'hang', 'hung', 'not responding', 'loading profile', 'stuck', 'spinning', 'profile screen'],
          cause: 'Outlook is hanging at launch — most often a stuck profile or a bad add-in.',
          steps: [
            'End the stuck Outlook task: press Ctrl+Shift+Esc to open Task Manager -> Processes tab -> click "Microsoft Outlook" (or OUTLOOK.EXE) once to select it -> click "End task" at the bottom-right. Repeat for any other Outlook entries so none are left running.',
            'Hold Ctrl while reopening Outlook -> click Yes to start in Safe Mode. If it opens in Safe Mode, an add-in is the cause.',
            'In Safe Mode: File -> Options -> Add-ins -> Manage: COM Add-ins -> Go -> uncheck all -> OK -> restart normally.',
            'Still hanging at the profile? Press Win+R and run:  outlook.exe /resetnavpane',
            'If it still hangs: Control Panel -> Mail -> Show Profiles -> add a new profile -> set as default -> reopen Outlook.'
          ]
        },
        {
          when: ['nothing', 'no response', 'nothing happens', 'blank screen', 'just sits'],
          cause: 'Outlook isn\'t launching at all — usually a stuck background process or a damaged profile.',
          steps: [
            'End every Outlook task: press Ctrl+Shift+Esc -> Processes tab -> click each "Microsoft Outlook" / OUTLOOK.EXE entry and hit "End task". Then try opening Outlook again.',
            'Win+R -> run:  outlook.exe /safe . If it opens, disable COM add-ins (File -> Options -> Add-ins).',
            'If nothing: Win+R -> run:  outlook.exe /resetnavpane',
            'Still nothing: Control Panel -> Mail -> Show Profiles -> create a new profile -> set default -> reopen.'
          ]
        },
        {
          when: ['error', 'message', 'code', 'cannot start', 'set of folders', 'odbc', '0x'],
          cause: 'A specific startup error usually points to the data file or profile.',
          steps: [
            'Note the exact error text (it changes the fix).',
            '"Cannot start... set of folders cannot be opened": Win+R -> run  outlook.exe /resetnavpane .',
            'If it mentions a data file: Control Panel -> Mail -> Data Files -> select the .ost/.pst -> Settings -> and let it rebuild, or close Outlook and rename the .ost so it re-downloads.',
            'Persisting? Create a fresh mail profile (Control Panel -> Mail -> Show Profiles).'
          ]
        },
        {
          when: ['close', 'closes itself', 'crash', 'disappear', 'shuts'],
          cause: 'Outlook opens then crashes — typically an add-in or a corrupt navigation/profile state.',
          steps: [
            'Reopen holding Ctrl -> start in Safe Mode. Stable in Safe Mode = an add-in is crashing it.',
            'File -> Options -> Add-ins -> COM Add-ins -> Go -> uncheck all -> restart.',
            'If it still crashes: Win+R -> run  outlook.exe /resetnavpane .',
            'Then run an Office Quick Repair: Settings -> Apps -> Microsoft 365 -> Modify -> Quick Repair.'
          ]
        }
      ],
      escalate: 'If a new profile and Quick Repair both fail, this is likely a corrupt .ost or an Exchange/M365 mailbox issue — hand to a technician with the exact error text.'
    },
    {
      id: 'printer', label: 'Printer offline / won\'t print', tier: 'L1',
      signals: [['printer', 5], ['print', 3], ['spooler', 4], ['print queue', 4], ['printing', 3]],
      apps: ['printer'],
      clarifier: {
        q: 'What is the printer doing?',
        options: ['Shows "Offline"', 'Jobs stuck in the queue', 'Error / nothing prints', 'Not found at all']
      },
      branches: [
        {
          when: ['offline', 'off line', 'greyed', 'grayed'],
          cause: 'The printer shows Offline — usually a stuck status or connection drop.',
          steps: [
            'Settings -> Bluetooth & devices -> Printers & scanners -> open the printer -> uncheck "Use Printer Offline" if set.',
            'Power-cycle the printer (off 15s, back on) and confirm it\'s on the same network/USB.',
            'Remove and re-add the printer if it stays offline (Settings -> Printers & scanners -> Remove, then Add).'
          ]
        },
        {
          when: ['stuck', 'queue', 'pending', 'won\'t clear', 'wont clear', 'jam of jobs', 'documents'],
          cause: 'The print spooler is hung with stuck jobs.',
          steps: [
            'Win+R -> services.msc -> find "Print Spooler" -> right-click -> Stop.',
            'Open  C:\\Windows\\System32\\spool\\PRINTERS  and delete everything inside.',
            'Back in services.msc -> Print Spooler -> Start. Try printing a test page.'
          ]
        },
        {
          when: ['error', 'nothing', 'won\'t print', 'wont print', 'blank'],
          cause: 'Driver or connection problem.',
          steps: [
            'Print a Windows test page: Printers & scanners -> printer -> Printer properties -> Print Test Page.',
            'If it fails: remove the printer, reboot, and reinstall the latest driver from the maker\'s site.',
            'Check it\'s the default printer and not set to a disconnected port.'
          ]
        },
        {
          when: ['not found', 'missing', 'can\'t find', 'cant find', 'disappeared'],
          cause: 'Windows can\'t see the printer.',
          steps: [
            'Confirm power + cable/Wi-Fi; print the printer\'s own network-config page to get its IP.',
            'Settings -> Printers & scanners -> Add device -> if not listed, "Add manually" -> by TCP/IP using that IP.',
            'On Wi-Fi, make sure the PC and printer are on the same network (not a guest SSID).'
          ]
        }
      ],
      escalate: 'If the spooler restart + driver reinstall both fail, escalate — could be a print server, GPO deployment, or port/firewall issue.'
    },
    {
      id: 'wifi', label: 'Wi-Fi dropping / no internet', tier: 'L1',
      signals: [['wifi', 5], ['wi-fi', 5], ['wireless', 4], ['internet', 3], ['network', 3], ['dropping', 3], ['no connection', 3]],
      apps: ['wifi'],
      clarifier: {
        q: 'Which best describes it?',
        options: ['Keeps dropping/reconnecting', 'Connected but no internet', 'Won\'t connect at all', 'Only some sites/apps fail']
      },
      branches: [
        {
          when: ['drop', 'dropping', 'reconnect', 'keeps', 'intermittent', 'unstable'],
          cause: 'The wireless adapter or signal is unstable.',
          steps: [
            'Settings -> Network & internet -> Wi-Fi -> forget the network, then reconnect with the password.',
            'Update the Wi-Fi adapter driver: Device Manager -> Network adapters -> your Wi-Fi -> Update driver.',
            'Disable power saving on the adapter: Device Manager -> adapter -> Properties -> Power Management -> uncheck "Allow the computer to turn off this device".',
            'Test closer to the router to rule out signal/interference.'
          ]
        },
        {
          when: ['no internet', 'connected but', 'limited', 'can\'t browse', 'cant browse', 'no access'],
          cause: 'Connected to Wi-Fi but no IP/DNS path out.',
          steps: [
            'Open Command Prompt and run:  ipconfig /release  then  ipconfig /renew  then  ipconfig /flushdns .',
            'Reboot the router/modem (off 30s).',
            'If still none: Settings -> Network & internet -> Advanced -> Network reset (reboots and reinstalls adapters).'
          ]
        },
        {
          when: ['won\'t connect', 'wont connect', 'can\'t connect', 'cant connect', 'no networks', 'wrong password'],
          cause: 'The adapter isn\'t joining the network.',
          steps: [
            'Confirm Wi-Fi is on (Airplane mode off) and you see the SSID.',
            'Forget the network and re-enter the password (watch for a guest vs main SSID).',
            'Update/reinstall the Wi-Fi driver; if no networks show at all, that\'s usually a driver/hardware switch.'
          ]
        },
        {
          when: ['some sites', 'certain', 'only', 'specific app', 'one app'],
          cause: 'Selective failures point at DNS, a VPN, or a firewall/proxy.',
          steps: [
            'Try the failing site on another device on the same Wi-Fi to localize it.',
            'Set DNS to 1.1.1.1 / 8.8.8.8 (Adapter -> Properties -> IPv4).',
            'Disconnect any VPN/proxy and retest.'
          ]
        }
      ],
      escalate: 'If a network reset + driver update don\'t hold, escalate — could be router config, DHCP exhaustion, or an AP/controller issue.'
    },
    {
      id: 'password', label: 'Account locked / password reset', tier: 'L1',
      signals: [['locked out', 5], ['account locked', 5], ['locked', 3], ['password', 4], ['can\'t sign in', 4], ['cant sign in', 4], ['can\'t log in', 4], ['reset my password', 4], ['mfa', 2]],
      apps: ['password'],
      clarifier: {
        q: 'What\'s happening at sign-in?',
        options: ['Account is locked', 'Forgot / need a reset', 'Password rejected', 'MFA / verification fails']
      },
      branches: [
        {
          when: ['locked', 'too many', 'temporarily', 'disabled'],
          cause: 'The account is locked, usually after failed attempts.',
          steps: [
            'Wait 15-30 min if it\'s an auto-lockout, then try once carefully (check Caps Lock / keyboard language).',
            'Use the official self-service reset if your org has it (e.g., the company password-reset portal).',
            'If you administer it: unlock in your directory (Active Directory Users & Computers -> account -> Unlock; or Entra admin center -> the user -> Unlock).'
          ]
        },
        {
          when: ['forgot', 'reset', 'new password', 'don\'t know', 'dont know'],
          cause: 'Needs a password reset.',
          steps: [
            'Use your org\'s self-service reset portal if available.',
            'No SSPR? An admin resets it: Entra admin center / AD -> the user -> Reset password -> require change at next sign-in.',
            'After reset, update saved passwords on phone/Outlook so old ones stop locking the account.'
          ]
        },
        {
          when: ['rejected', 'wrong', 'incorrect', 'not accepted', 'keeps failing'],
          cause: 'Password is being refused.',
          steps: [
            'Confirm Caps Lock and keyboard layout; type it into a visible field first.',
            'Make sure no other device (phone mail, mapped drive) is hammering the old password.',
            'If genuinely unknown, do a reset (above).'
          ]
        },
        {
          when: ['mfa', 'verification', 'code', 'authenticator', '2fa', 'verify'],
          cause: 'Multi-factor step is failing.',
          steps: [
            'Check the time on the Authenticator phone is auto-set (TOTP codes fail if the clock drifts).',
            'Use a backup method (text/call/backup codes) if offered.',
            'If you lost the device, an admin must reset MFA registration for the account.'
          ]
        }
      ],
      escalate: 'If self-service and an admin reset both fail, escalate to identity admin — could be a sync, conditional-access, or federation problem.'
    },
    {
      id: 'disk', label: 'Disk full / low space', tier: 'L1',
      signals: [['disk full', 5], ['storage full', 5], ['low disk', 5], ['out of space', 5], ['disk space', 4], ['c drive', 4], ['full', 3], ['disk', 3], ['storage', 2], ['cleanup', 2]],
      apps: ['disk'],
      clarifier: {
        q: 'Where is space running out?',
        options: ['Windows C: drive', 'OneDrive / cloud', 'A specific app or folder', 'Not sure']
      },
      branches: [
        {
          when: ['c drive', 'c:', 'windows', 'system', 'whole', 'computer'],
          cause: 'The system drive is full — usually temp files, updates, and caches.',
          steps: [
            'Settings -> System -> Storage -> turn on Storage Sense, then "Cleanup recommendations".',
            'Win+R -> cleanmgr -> select Temporary files, Delivery Optimization, Recycle Bin -> clean. Use "Clean up system files" for old Windows Update files.',
            'Storage -> see what\'s biggest (Apps, Temporary, Other) and clear the heaviest.'
          ]
        },
        {
          when: ['onedrive', 'cloud', 'sync', 'sharepoint'],
          cause: 'OneDrive is keeping files locally.',
          steps: [
            'Turn on Files On-Demand: OneDrive -> Settings -> Sync and back up -> Advanced -> Files On-Demand.',
            'Right-click big synced folders -> "Free up space" to keep them cloud-only.'
          ]
        },
        {
          when: ['app', 'folder', 'game', 'specific', 'program'],
          cause: 'One app/folder is hogging space.',
          steps: [
            'Settings -> Storage -> Apps to see per-app size; uninstall what you don\'t need.',
            'Clear app caches (e.g., browser cache; Teams cache at %appdata%\\Microsoft\\Teams).'
          ]
        }
      ],
      escalate: 'If cleanup frees little and the drive refills fast, escalate — could be runaway logs, shadow copies, or a too-small disk needing imaging/upgrade.'
    },
    {
      id: 'slow', label: 'Computer slow / sluggish', tier: 'L1',
      signals: [['slow', 4], ['sluggish', 5], ['laggy', 4], ['freezing computer', 3], ['takes forever', 4], ['running slow', 5]],
      // NOTE: 'freeze/freezes' is intentionally NOT a strong signal here so Outlook-freeze
      // does not misroute to this topic. App context wins.
      apps: [],
      clarifier: {
        q: 'When is it slow?',
        options: ['All the time / since boot', 'Only one app', 'After it\'s been on a while', 'Started recently']
      },
      branches: [
        {
          when: ['all the time', 'boot', 'startup', 'always', 'since'],
          cause: 'Something is loading at startup or a resource is pinned.',
          steps: [
            'Task Manager -> Performance: see if CPU, Memory, or Disk sits near 100%.',
            'Task Manager -> Startup: disable heavy apps you don\'t need at boot, then reboot.',
            'If Disk is pinned: check for a running antivirus full scan or Windows Update and let it finish.'
          ]
        },
        {
          when: ['one app', 'only when', 'specific', 'browser', 'this program'],
          cause: 'A single app is the bottleneck.',
          steps: [
            'Task Manager -> sort by CPU/Memory -> confirm which app spikes.',
            'Update or reinstall that app; for browsers, clear cache and disable heavy extensions.'
          ]
        },
        {
          when: ['a while', 'over time', 'gets slow', 'heats', 'hot'],
          cause: 'Resource leak or thermal throttling over time.',
          steps: [
            'Reboot to confirm it\'s fixed fresh (leak), then watch Memory in Task Manager over time.',
            'Make sure vents aren\'t blocked; check Memory tab for a process climbing steadily.'
          ]
        },
        {
          when: ['recently', 'started', 'after update', 'new'],
          cause: 'A recent change introduced it.',
          steps: [
            'Think back to a recent install/update; uninstall the suspect or use System Restore to a point before it.',
            'Run a quick malware scan (Windows Security -> Quick scan).'
          ]
        }
      ],
      escalate: 'If CPU/Disk/RAM all look normal but it\'s still slow, escalate — could be failing storage (check drive health) or a deeper OS issue.'
    }
    ,
    {
      id: 'vpn', label: 'VPN won\'t connect / keeps dropping', tier: 'L2',
      signals: [['vpn', 5], ['anyconnect', 4], ['globalprotect', 4], ['forticlient', 4], ['remote access', 3]],
      apps: ['vpn'],
      clarifier: { q: 'What is the VPN doing?', options: ['Won\'t connect at all', 'Connects then drops', 'Connected but can\'t reach work resources', 'Login / authentication fails'] },
      branches: [
        { when: ['won\'t connect', 'wont connect', 'can\'t connect', 'cant connect', 'no connect', 'stuck connecting'], cause: 'The VPN client can\'t establish the tunnel.', steps: ['Confirm your internet works without the VPN (open any website).', 'Fully quit and reopen the VPN client, then sign in again.', 'Check the VPN address/profile is the exact one IT gave you.', 'Reboot once — a stale network adapter often blocks the tunnel.'] },
        { when: ['drop', 'drops', 'disconnect', 'keeps', 'unstable', 'reconnect'], cause: 'The tunnel is unstable — usually the underlying Wi-Fi or power settings.', steps: ['Test on a wired connection or closer to the router — weak Wi-Fi drops the VPN.', 'Device Manager -> your network adapter -> Properties -> Power Management -> uncheck "Allow the computer to turn off this device".', 'Turn off a second network (e.g., Wi-Fi while on Ethernet) so it doesn\'t switch mid-session.'] },
        { when: ['can\'t reach', 'cant reach', 'resources', 'shares', 'cant access', 'can\'t access', 'mapped drive', 'intranet'], cause: 'Tunnel is up but routing/DNS to work resources is off.', steps: ['Disconnect and reconnect the VPN to refresh routes.', 'Open Command Prompt -> run  ipconfig /flushdns .', 'Try the resource by IP vs by name to separate DNS from routing, and share the result with IT.'] },
        { when: ['auth', 'login', 'password', 'mfa', 'credentials', 'sign in', 'sign-in'], cause: 'Authentication to the VPN is failing.', steps: ['Re-enter your username exactly as IT specified.', 'Complete the MFA prompt if one appears (check your Authenticator app).', 'If it still rejects valid credentials, your VPN account or certificate may need a reset by IT.'] }
      ],
      escalate: 'If reconnect, reboot, and DNS flush don\'t fix it, escalate with the exact client name + error — could be a certificate, gateway, or account-policy issue.'
    },
    {
      id: 'teams', label: 'Microsoft Teams audio / video / join', tier: 'L1',
      signals: [['teams', 5], ['cant hear', 3], ['camera not', 3], ['mic not', 3], ['cant join', 3]],
      apps: ['teams'],
      clarifier: { q: 'What is Teams doing?', options: ['No mic / they can\'t hear me', 'No sound / I can\'t hear them', 'Camera not working', 'Can\'t join or it crashes'] },
      branches: [
        { when: ['mic', 'microphone', 'can\'t hear me', 'cant hear me', 'no one can hear'], cause: 'Teams isn\'t using the right microphone or lacks permission.', steps: ['In a call -> "..." -> Settings -> Devices -> pick the correct Microphone and speak to see the level move.', 'Windows Settings -> Privacy & security -> Microphone -> allow Microsoft Teams.', 'Unplug/replug a USB headset, or fully restart Teams (tray icon -> Quit, reopen).'] },
        { when: ['no sound', 'can\'t hear', 'cant hear them', 'speaker', 'no audio'], cause: 'Output device or volume is the issue.', steps: ['Teams -> Settings -> Devices -> set the correct Speaker, then "Make a test call".', 'Windows volume icon -> confirm the right output device and that it isn\'t muted.', 'Restart Teams if the device list looks wrong.'] },
        { when: ['camera', 'webcam', 'video'], cause: 'Camera not selected or blocked.', steps: ['Teams -> Settings -> Devices -> choose the correct Camera (preview should appear).', 'Windows Settings -> Privacy & security -> Camera -> allow Microsoft Teams.', 'Close other apps holding the camera (Zoom, Camera app), then retry.'] },
        { when: ['join', 'crash', 'won\'t open', 'wont open', 'freezes', 'stuck'], cause: 'Teams app is stuck — usually a cache issue.', steps: ['Fully quit Teams: right-click the tray icon -> Quit.', 'Clear the cache: delete the contents of  %appdata%\\Microsoft\\Teams  (new Teams: %localappdata%\\Packages\\MSTeams_*).', 'Reopen Teams and sign in again.'] }
      ],
      escalate: 'If devices are correct and a cache-clear doesn\'t help, escalate — could be a driver, headset hardware, or org-policy issue.'
    },
    {
      id: 'onedrive', label: 'OneDrive not syncing', tier: 'L1',
      signals: [['onedrive', 5], ['one drive', 5], ['not syncing', 3], ['sync error', 4]],
      apps: ['onedrive'],
      clarifier: { q: 'What\'s happening with OneDrive?', options: ['Stuck "syncing" / spinning', 'Sync paused or error', 'Files missing / not updating', 'Sign-in / account issue'] },
      branches: [
        { when: ['stuck', 'spinning', 'processing', 'forever', 'hung'], cause: 'OneDrive sync is stuck.', steps: ['Click the OneDrive cloud icon (system tray) -> if it says Paused, Resume.', 'Quit OneDrive (cloud icon -> gear -> Quit OneDrive), then reopen it from Start.', 'A single large or open file can block it — close Office apps and let it catch up.'] },
        { when: ['paused', 'error', 'red', 'failed'], cause: 'Sync is paused or erroring.', steps: ['OneDrive icon -> read the error; "Resume syncing" if paused.', 'Make sure you\'re signed in (icon -> gear -> Settings -> Account).', 'Check you have free disk and are under your storage quota (the error usually says which).'] },
        { when: ['missing', 'not updating', 'old version', 'not showing', 'gone'], cause: 'Files aren\'t reflecting the latest sync.', steps: ['In File Explorer, confirm the file shows a green check (synced) vs a cloud (online-only).', 'Right-click the folder -> "Always keep on this device" if you need it offline.', 'Check the same file on onedrive.com to see where the newest copy is.'] },
        { when: ['sign in', 'sign-in', 'account', 'login', 'wrong account'], cause: 'OneDrive account/sign-in problem.', steps: ['OneDrive -> gear -> Settings -> Account -> confirm it\'s the correct work account.', 'If wrong, "Unlink this PC" and sign back in with the right account.', 'Re-enter credentials/MFA if prompted.'] }
      ],
      escalate: 'If unlink/relink and resume don\'t fix it, escalate — could be known-folder-move, quota, or tenant policy.'
    },
    {
      id: 'mfa', label: 'MFA / Authenticator not working', tier: 'L1',
      signals: [['authenticator', 5], ['mfa', 4], ['2fa', 4], ['verification code', 4], ['not getting code', 4], ['approve sign', 4]],
      apps: ['password'],
      clarifier: { q: 'What\'s happening with the verification?', options: ['No prompt / no code arrives', 'Code is rejected', 'New phone / lost device', 'Too many / unexpected prompts'] },
      branches: [
        { when: ['no prompt', 'no code', 'not getting', 'didn\'t get', 'didnt get', 'nothing comes'], cause: 'The MFA prompt or code isn\'t reaching you.', steps: ['Open the Microsoft Authenticator app manually and check for a pending approval.', 'Confirm the phone has signal/Wi-Fi and notifications are on for Authenticator.', 'Use a backup method (text or call) via "Other ways to verify" if offered.'] },
        { when: ['rejected', 'wrong code', 'invalid', 'expired', 'not accepted'], cause: 'Codes are refused — usually a clock-sync issue.', steps: ['On the phone, set Date & Time to "Set automatically" — TOTP codes fail if the clock drifts.', 'Enter the code quickly (they rotate every 30 seconds).', 'In Authenticator, confirm you\'re on the correct work account.'] },
        { when: ['new phone', 'lost', 'lost device', 'replaced', 'broke', 'reset phone'], cause: 'MFA is tied to a device you no longer have.', steps: ['Use a remaining method (backup codes, text, or an old trusted device) to get in.', 'Then go to aka.ms/mfasetup and add the new phone\'s Authenticator.', 'If you have no working method, an admin must reset your MFA registration.'] },
        { when: ['too many', 'spam', 'keeps asking', 'unexpected', 'repeated', 'didn\'t start'], cause: 'Repeated prompts — do not approve any you didn\'t start.', steps: ['Do NOT approve a prompt you didn\'t trigger — it can mean someone has your password.', 'Change your password now if you suspect that.', 'Tell IT so they can review sign-in logs and lock it down.'] }
      ],
      escalate: 'Lost all methods or seeing unexpected prompts? Escalate to identity admin immediately for an MFA reset and account review.'
    },
    {
      id: 'browser', label: 'Browser slow / pages won\'t load / crashing', tier: 'L1',
      signals: [['browser', 5], ['chrome', 5], ['firefox', 5], ['edge', 4], ['page won\'t load', 4], ['website won\'t load', 4]],
      apps: ['browser'],
      clarifier: { q: 'What is the browser doing?', options: ['Pages won\'t load at all', 'Very slow / freezing', 'One site fails, others work', 'Crashes or won\'t open'] },
      branches: [
        { when: ['won\'t load', 'wont load', 'can\'t load', 'cant load', 'no internet', 'nothing loads'], cause: 'Likely connectivity or DNS, not the browser itself.', steps: ['Try another site — if all fail, it\'s the network (see the Wi-Fi/internet help).', 'Open Command Prompt -> run  ipconfig /flushdns .', 'Open an Incognito/InPrivate window to rule out extensions and cache.'] },
        { when: ['slow', 'freezing', 'laggy', 'memory', 'high cpu'], cause: 'Too many tabs/extensions or a stale cache.', steps: ['Clear cache: Ctrl+Shift+Delete -> Cached images and files -> Clear.', 'Disable heavy or unknown extensions (menu -> Extensions).', 'Close unused tabs and update the browser (menu -> Help -> About).'] },
        { when: ['one site', 'certain site', 'this site', 'specific', 'only on'], cause: 'A single-site issue — cache, cookies, or the site itself.', steps: ['Hard refresh the page: Ctrl+F5.', 'Clear cookies for that site (lock icon -> Site settings -> Clear data).', 'Open the site in another browser to tell if it\'s the site or your browser.'] },
        { when: ['crash', 'won\'t open', 'wont open', 'closes', 'freezes on open'], cause: 'Browser profile or extension is corrupt.', steps: ['Close all browser windows (Task Manager -> End task if needed), then reopen.', 'Launch without extensions (Incognito/InPrivate) to test.', 'If it persists, reset browser settings or create a new profile.'] }
      ],
      escalate: 'If a clean profile + network checks both fail, escalate — could be proxy, certificate, or a pushed-policy/extension issue.'
    },
    {
      id: 'bitlocker', label: 'BitLocker recovery key prompt', tier: 'L2',
      signals: [['bitlocker', 5], ['recovery key', 5], ['recovery screen', 4], ['asking for key', 4]],
      apps: ['bitlocker'],
      clarifier: { q: 'Where are you seeing it?', options: ['Blue BitLocker screen at boot', 'After a Windows/BIOS update', 'I don\'t have the key', 'It comes back every boot'] },
      branches: [
        { when: ['boot', 'startup', 'recovery screen', 'at start', 'blue screen asking'], cause: 'BitLocker tripped and wants the 48-digit recovery key.', steps: ['Note the Key ID on screen (first 8 characters).', 'Get the key: work device -> sign in at aka.ms/myrecoverykey, or give IT that Key ID.', 'Enter the 48-digit key to unlock and boot.'] },
        { when: ['update', 'bios', 'firmware'], cause: 'A firmware/secure-boot change triggered BitLocker.', steps: ['Enter the recovery key once to get in (see where to find it above).', 'It usually won\'t reprompt afterward; if a BIOS change caused it, IT can suspend/resume BitLocker to re-seal it.'] },
        { when: ['don\'t have', 'dont have', 'no key', 'can\'t find', 'lost key'], cause: 'You need to retrieve the recovery key.', steps: ['Work device: aka.ms/myrecoverykey signed in with your work account, or contact IT with the Key ID on screen.', 'Personal device: account.microsoft.com/devices -> the device -> BitLocker keys.', 'Without any key the drive cannot be unlocked — IT/recovery is required.'] },
        { when: ['every boot', 'keeps', 'again', 'each time'], cause: 'BitLocker re-prompts every start — protection isn\'t re-sealing.', steps: ['Get in with the key, then have IT suspend/resume BitLocker (or run manage-bde to re-enable protectors).', 'A failing TPM or a pending BIOS setting can cause this — flag it to IT.'] }
      ],
      escalate: 'If the recovery key can\'t be found or it loops every boot, escalate to IT — needs the key from the directory and a TPM/BIOS check.'
    },
    {
      id: 'bluescreen', label: 'PC crashing / blue screen / restarts', tier: 'L2',
      signals: [['blue screen', 5], ['bsod', 5], ['keeps restarting', 4], ['stop code', 4], ['keeps crashing', 4]],
      apps: [],
      clarifier: { q: 'When does it crash?', options: ['Random / anytime', 'During one specific app or task', 'On startup / boot loop', 'After a recent update or new hardware'] },
      branches: [
        { when: ['random', 'anytime', 'no pattern', 'out of nowhere'], cause: 'Random crashes — often a driver, memory, or overheating.', steps: ['Note the stop code on the blue screen (e.g., "MEMORY_MANAGEMENT") — it points at the cause.', 'Run Windows Memory Diagnostic (search it in Start) to test RAM.', 'Make sure vents/fans are clear; update graphics + chipset drivers.'] },
        { when: ['one app', 'specific', 'during', 'when i', 'a game', 'task'], cause: 'A single app or its driver triggers it.', steps: ['Update or reinstall that app and its related driver (e.g., GPU driver for a game/CAD app).', 'Note whether the same stop code appears each time and share it with IT.'] },
        { when: ['boot', 'startup', 'loop', 'won\'t start', 'wont start', 'before login'], cause: 'Boot-time crash — needs recovery options.', steps: ['Power on/off 3 times to trigger Automatic Repair -> Advanced options.', 'Try Startup Repair, then Safe Mode (Advanced options -> Startup Settings).', 'If it began after a change, use System Restore to a point before it.'] },
        { when: ['update', 'new hardware', 'after install', 'added', 'driver'], cause: 'A recent update/driver/hardware change caused it.', steps: ['Boot to Safe Mode and uninstall the recent update or roll back the driver (Device Manager -> device -> Driver -> Roll Back).', 'Reseat or remove newly added hardware (RAM, dock) and test.'] }
      ],
      escalate: 'Repeated blue screens with a consistent stop code, or boot loops Startup Repair can\'t fix, go to IT — likely hardware (RAM/disk) or a bad driver.'
    },
    {
      id: 'audio', label: 'No sound / audio not working', tier: 'L1',
      signals: [['no sound', 5], ['no audio', 5], ['sound not working', 5], ['speakers', 3], ['headphones', 3]],
      apps: [],
      clarifier: { q: 'Where is the sound missing?', options: ['Everywhere on the PC', 'Only in headphones / a device', 'Only in one app', 'Output is dead (mic still works)'] },
      branches: [
        { when: ['everywhere', 'all', 'whole', 'nothing', 'completely', 'no sound at all'], cause: 'No output device selected or the audio service stalled.', steps: ['Click the volume icon -> confirm the correct output device and that it isn\'t muted.', 'Right-click the volume icon -> Sound settings -> pick the right Output device.', 'Restart the audio service: Win+R -> services.msc -> "Windows Audio" -> Restart.'] },
        { when: ['headphone', 'headset', 'device', 'usb', 'bluetooth', 'plugged'], cause: 'The headset/device isn\'t the active output.', steps: ['Replug the headset; for Bluetooth, re-pair it (Settings -> Bluetooth).', 'Sound settings -> set the headset as the Output device.', 'Try another port or cable to rule out hardware.'] },
        { when: ['one app', 'only in', 'specific app', 'this program'], cause: 'That app is muted or pointed at the wrong device.', steps: ['Right-click volume -> Open Volume mixer -> make sure that app isn\'t muted or low.', 'In the app\'s own audio settings, pick the correct output device.', 'Restart the app.'] },
        { when: ['mic works', 'only output', 'can talk', 'they hear me', 'output'], cause: 'Output device specifically is wrong or disabled.', steps: ['Sound settings -> Output -> select the right device and click Test.', 'If the device is missing: Device Manager -> Sound -> enable/update the audio driver.', 'Reboot if the device still doesn\'t appear.'] }
      ],
      escalate: 'If no output device appears at all after a driver update + reboot, escalate — likely an audio driver or hardware fault.'
    },
  ];

  // generic low-confidence triage (no canned dump; asks a smart question)
  var TRIAGE = {
    q: 'Let\'s pin it down. Which is closest to the problem?',
    options: ['Email / Outlook', 'Printing', 'Wi-Fi / internet', 'Sign-in / password', 'Slow computer', 'Something else']
  };

  function scoreTopic(topic, t) {
    var s = 0;
    topic.signals.forEach(function (pair) { if (has(t, pair[0])) s += pair[1]; });
    return s;
  }

  function classify(t, ctx) {
    var ranked = TOPICS.map(function (tp) {
      var s = scoreTopic(tp, t);
      // context boost: if we were already on this topic, keep us there for follow-ups
      if (ctx && ctx.topic === tp.id) s += 2;
      return { topic: tp, score: s };
    }).sort(function (a, b) { return b.score - a.score; });
    return ranked[0];
  }

  function pickBranch(topic, t) {
    for (var i = 0; i < topic.branches.length; i++) {
      if (anyHas(t, topic.branches[i].when)) return topic.branches[i];
    }
    return null;
  }

  function topicById(id) { for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i]; return null; }

  var HONEST_TAIL = 'I\'m guiding you through this — I can\'t make changes on your device from here. Tell me what happens after a step and I\'ll adjust, or I can escalate to a technician.';

  function newSession() { return { topic: null, stage: 'start', turns: 0 }; }

  function answer(topic, branch, session) {
    if (session) session.stage = 'answered';
    return {
      topic: topic.id, stage: 'answered', confidence: 'high',
      say: branch.cause, steps: branch.steps, escalate: topic.escalate, tail: HONEST_TAIL
    };
  }
  function askClarifier(topic, lead) {
    return {
      topic: topic.id, stage: 'awaiting', confidence: 'high',
      say: lead, ask: topic.clarifier.q, options: topic.clarifier.options
    };
  }
  function triageResult() {
    return {
      topic: null, stage: 'triage', confidence: 'low',
      say: 'I want to get this right rather than guess.', ask: TRIAGE.q, options: TRIAGE.options
    };
  }

  // Main entry. Returns a structured result the UI renders.
  // RULE: never ask a question AND dump steps in the same turn. Ask-and-wait, or answer — never both.
  function handleTurn(session, text) {
    session = session || newSession();
    session.turns++;
    var t = norm(text);

    // 0) Farewell / thanks / resolved -> close warmly. Greeting -> friendly prompt. Never troubleshoot these.
    var BYE = ['thank', 'thanks', 'appreciate', 'have a good', 'have a great', 'goodbye', 'good bye', 'see you', 'cheers', 'that worked', 'it worked', 'that fixed', 'all good', 'all set', 'thats all', 'that is all', 'nothing else', 'im good', 'i am good', 'we are good', 'resolved', 'good day'];
    var CONT = ['still', 'wont', 'won t', 'not work', 'didnt', 'didn t', 'doesnt', 'doesn t', 'does not', 'no luck', 'broke', 'broken', 'same', 'again', 'nope', 'but it', 'fail', 'isnt', 'isn t', 'not fixed', 'cant', 'can t'];
    var GREET = ['hi', 'hello', 'hey', 'yo', 'good morning', 'good afternoon', 'good evening'];
    if ((anyHas(t, BYE) || t === 'bye' || t === 'no thanks') && !anyHas(t, CONT) && classify(t, {}).score < 4 && t.split(' ').length <= 8) {
      session.stage = 'closed';
      return { topic: session.topic, stage: 'closed', confidence: 'high',
        say: 'Glad I could help \u2014 have a great day! If anything else comes up, just open ARIA and ask. I can also email you a short summary of this session if you would like one.' };
    }
    if (anyHas(t, GREET) && classify(t, {}).score < 4 && t.split(' ').length <= 4) {
      return { topic: null, stage: 'greet', confidence: 'high',
        say: 'Hi \u2014 I\'m ARIA. What can I help you sort out? Outlook, printing, Wi-Fi, a sign-in/password issue, a slow PC, or something else?' };
    }

    // 1) Context first: if a topic is active, stay on it unless the user clearly switches topics.
    if (session.topic) {
      var cur = topicById(session.topic);
      var fresh0 = classify(t, {});            // classify WITHOUT the context boost
      var curScore = scoreTopic(cur, t);
      var switching = fresh0.topic.id !== cur.id && fresh0.score >= 5 && fresh0.score > curScore;
      if (!switching) {
        var b = pickBranch(cur, t);
        if (b) return answer(cur, b, session);                 // their answer/symptom -> real steps
        if (session.stage === 'awaiting') {                    // answer didn't match -> ask once more, no dump
          return {
            topic: cur.id, stage: 'awaiting', confidence: 'medium',
            say: 'Got it — to point you at the right fix:', ask: cur.clarifier.q, options: cur.clarifier.options
          };
        }
        session.stage = 'awaiting';
        return askClarifier(cur, 'Staying on ' + cur.label.toLowerCase() + ' — quick check:');
      }
    }

    // 2) Fresh classification.
    var best = classify(t, session);
    if (!best || best.score < 4) { session.topic = null; session.stage = 'triage'; return triageResult(); }

    var tp = best.topic; session.topic = tp.id;
    var bn = pickBranch(tp, t);
    if (bn) return answer(tp, bn, session);                    // symptom already clear -> answer now
    session.stage = 'awaiting';
    return askClarifier(tp, 'Sounds like ' + tp.label + '. One quick thing so I send you down the right path:');
  }

  var api = { newSession: newSession, handleTurn: handleTurn, classify: classify, _TOPICS: TOPICS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AriaBrain = api;
})(typeof window !== 'undefined' ? window : this);

/* ARIA brain adapter — wires AriaBrain into the live aria.html chat UI.
   GATED: only activates with ?brain=new (or window.__ARIA_NEW_BRAIN=true). */
(function () {
  if (window.__AB_ADAPTER) return; window.__AB_ADAPTER = 1;
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    if (!/[?&]brain=new/.test(location.search) && !window.__ARIA_NEW_BRAIN) return;
    var cm = document.getElementById('chatMessages');
    var inp = document.getElementById('askInput');
    var send = document.getElementById('sendBtn');
    if (!cm || !inp || !window.AriaBrain) return;
    var inp2 = inp.cloneNode(true); inp.parentNode.replaceChild(inp2, inp); inp = inp2;
    if (send) { var s2 = send.cloneNode(true); send.parentNode.replaceChild(s2, send); send = s2; }
    var session = window.AriaBrain.newSession();
    var st = document.createElement('style'); st.textContent =
      '.abrow{margin:10px 0}.abrow.you{display:flex}'
      + '.abyou{margin-left:auto;max-width:80%;background:#1b1c20;border:1px solid #26282e;color:#dfe1e6;padding:9px 12px;border-radius:12px;font-size:14px}'
      + '.abaria{max-width:90%;color:#e9dfc4;font-size:14px;line-height:1.55}'
      + '.abaria .say{margin-bottom:4px}'
      + '.abq{color:#cda85c;font-weight:500;margin:6px 0 8px}'
      + '.abopts{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 2px}'
      + '.abopt{font-size:13px;color:#e9dfc4;background:#14130d;border:1px solid #2c2718;border-radius:18px;padding:7px 13px;cursor:pointer}'
      + '.abopt:hover{border-color:#cda85c;color:#f4ead0}'
      + '.absteps{counter-reset:s;margin:8px 0 2px;padding:0;list-style:none}'
      + '.absteps li{position:relative;padding:6px 0 6px 24px;border-bottom:1px solid #1c1a14;font-size:13.5px;color:#ded3b8}'
      + '.absteps li:before{content:counter(s);counter-increment:s;position:absolute;left:0;top:6px;width:17px;height:17px;border-radius:50%;background:#cda85c;color:#191307;font:600 10px sans-serif;display:flex;align-items:center;justify-content:center}'
      + '.abesc{margin-top:10px;font-size:12.5px;color:#9a937f;border-left:2px solid #3a3320;padding-left:10px}'
      + '.abtail{margin-top:8px;font-size:12.5px;color:#8f886f;font-style:italic}'
      + '.abnew{font:600 10px ui-monospace,monospace;letter-spacing:.12em;color:#0e0a04;background:#cda85c;border-radius:5px;padding:3px 8px;display:inline-block;margin:2px 0 6px}';
    document.head.appendChild(st);
    var banner = document.createElement('div'); banner.className = 'abrow'; banner.innerHTML = '<span class="abnew">NEW BRAIN · PREVIEW</span>'; cm.appendChild(banner);
    function youBubble(text){ var d=document.createElement('div'); d.className='abrow you'; var b=document.createElement('div'); b.className='abyou'; b.textContent=text; d.appendChild(b); cm.appendChild(d); cm.scrollTop=cm.scrollHeight; }
    function ariaBubble(r){
      var d=document.createElement('div'); d.className='abrow'; var box=document.createElement('div'); box.className='abaria'; d.appendChild(box);
      if(r.say){ var s=document.createElement('div'); s.className='say'; s.textContent=r.say; box.appendChild(s); }
      if(r.ask){ var q=document.createElement('div'); q.className='abq'; q.textContent=r.ask; box.appendChild(q); }
      if(r.options){ var o=document.createElement('div'); o.className='abopts'; r.options.forEach(function(opt){ var c=document.createElement('span'); c.className='abopt'; c.textContent=opt; c.onclick=function(){ submit(opt); }; o.appendChild(c); }); box.appendChild(o); }
      if(r.steps){ var ol=document.createElement('ol'); ol.className='absteps'; r.steps.forEach(function(x){ var li=document.createElement('li'); li.textContent=x; ol.appendChild(li); }); box.appendChild(ol); }
      if(r.escalate){ var e=document.createElement('div'); e.className='abesc'; e.textContent='If that does not resolve it: '+r.escalate; box.appendChild(e); }
      if(r.tail){ var t=document.createElement('div'); t.className='abtail'; t.textContent=r.tail; box.appendChild(t); }
      cm.appendChild(d); cm.scrollTop=cm.scrollHeight;
    }
    function submit(text){ if(!text||!text.trim()) return; youBubble(text); if(window.aexRun){ try{ window.aexRun(text); }catch(e){} } var r=window.AriaBrain.handleTurn(session,text); setTimeout(function(){ ariaBubble(r); }, 260); }
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); var v=inp.value; inp.value=''; submit(v); } });
    if(send) send.addEventListener('click', function(e){ e.preventDefault(); var v=inp.value; inp.value=''; submit(v); });
    window.__abSubmit = submit;
  });
})();
