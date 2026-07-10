// aria-recipes-data.mjs — vetted recipe library for ARIA Guided Fix Phase A
// EVERY recipe is hand-reviewed for safety. NO arbitrary user input ever becomes a command.
// Risk classification: green=safe info, yellow=safe diagnostic, orange=repair w/consent+log, red=admin-only, black=never.
// This file is the single source of truth. Updates require code review.

export const RECIPES = [
  {
    id: 'outlook-restart-v1',
    title: 'Outlook won’t open or is frozen',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['outlook won’t open','outlook wont open','outlook not opening','outlook frozen','outlook stuck','outlook crash','outlook not responding','outlook hangs','outlook freezes'],
    matchPatterns: ['outlook.*(open|start|launch|load|frozen|stuck|crash|hang|respond)'],
    version: 1,
    riskOverall: 'yellow',
    description: 'Restart a frozen Outlook process cleanly without touching email data.',
    diagnostic: {
      cmd: 'Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,Responding,StartTime',
      shell: 'powershell',
      explainer: 'Check whether Outlook is currently running and whether it’s responding.',
      expectedReproduces: 'Output shows OUTLOOK with Responding=False or any OUTLOOK row',
      expectedNoIssue: 'Empty output: Outlook isn’t running. Different problem — try just opening it normally.'
    },
    fixSteps: [
      {
        id: 'kill', label: 'Force-close stuck Outlook process',
        cmd: 'Stop-Process -Name OUTLOOK -Force -ErrorAction SilentlyContinue',
        shell: 'powershell', risk: 'yellow', requiresConfirm: true,
        explainer: 'Closes the stuck process. Your emails and data are stored on disk + in your mailbox — nothing is deleted by this command.',
        rollback: null, estimatedSeconds: 2
      },
      {
        id: 'restart', label: 'Re-launch Outlook',
        cmd: 'Start-Process outlook',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Opens Outlook fresh.', rollback: null, estimatedSeconds: 8
      }
    ],
    ariaScript: {
      intro: 'I can help with Outlook. Want me to walk you through a safe restart? I’ll show every step before running.',
      consent: 'I’ll guide you through 2 commands: a diagnostic, then a fix. You see and approve each. Takes ~30 seconds. None of your email data is touched.',
      onCantReproduce: 'Outlook isn’t running on this machine right now — likely a different issue. Could you describe what happens when you try to open it? Or call (647) 581-3182.',
      onSuccess: 'Outlook should be open now. If still stuck, call (647) 581-3182 and we’ll dig deeper.'
    },
    allowlistTags: ['process-restart','m365']
  },
  {
    id: 'office-quick-repair-v1',
    title: 'Office apps crashing (Word, Excel, PowerPoint)',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['word crashes','excel crashes','powerpoint crashes','office crashing','word won’t open','excel won’t open','office not working','office repair'],
    matchPatterns: ['(word|excel|powerpoint|office).*(crash|fail|won.?t open|broken|repair)'],
    version: 1, riskOverall: 'orange',
    description: 'Run Microsoft Office Quick Repair via Programs and Features.',
    diagnostic: {
      cmd: 'Get-Package -Name "*Microsoft 365*","*Office*" -ErrorAction SilentlyContinue | Select-Object Name,Version',
      shell: 'powershell',
      explainer: 'Confirm which Office version is installed.',
      expectedReproduces: 'Returns a Microsoft 365 or Office product entry',
      expectedNoIssue: 'No Office product found — Office may not be installed.'
    },
    fixSteps: [
      {
        id: 'open-appwiz', label: 'Open Apps & Features',
        cmd: 'Start-Process appwiz.cpl',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Opens the Apps & Features control panel.', rollback: null, estimatedSeconds: 3
      },
      {
        id: 'manual-instruction', label: 'Run Quick Repair manually',
        cmd: null, manual: true, risk: 'orange', requiresConfirm: true,
        explainer: 'In Apps & Features, find Microsoft 365 (or Office), click Modify → Quick Repair → Repair. This takes 5–10 minutes and may close all Office apps. Quick Repair fixes broken installation files without deleting your documents.',
        rollback: 'If problems worsen, repeat with Online Repair (longer, more thorough)', estimatedSeconds: 600
      }
    ],
    ariaScript: {
      intro: 'When Office apps crash repeatedly, a Quick Repair usually fixes it. I’ll open Apps & Features for you and walk you through it.',
      consent: 'I’ll open the Apps & Features panel and guide you through Office’s built-in Quick Repair. It takes 5–10 minutes and won’t delete your documents.',
      onCantReproduce: 'I don’t see Microsoft Office installed on this machine. Are you on a different one? Or call (647) 581-3182.',
      onSuccess: 'Quick Repair done. Re-open the app that was crashing. If it still crashes, call (647) 581-3182 — you may need an Online Repair or full reinstall.'
    },
    allowlistTags: ['office-repair','m365']
  },
  {
    id: 'office-file-repair-v1',
    title: 'Excel / Word file won’t open (format not valid, corrupt, or locked)',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['file format not valid','excel won’t open file','excel wont open','spreadsheet won’t open','xlsx won’t open','word file won’t open','docx corrupt','file is corrupt','file is locked','file in use','cannot open the file','open and repair','excel file damaged','workbook corrupt','the file is locked for editing'],
    matchPatterns: ['(excel|word|powerpoint|xlsx|docx|pptx|spreadsheet|workbook).*(won.?t open|not valid|corrupt|damaged|locked|in use|repair|recover)','(file format|format).*(not valid|invalid)','file.*(locked|in use|corrupt)'],
    version: 1, riskOverall: 'orange',
    description: 'Recover an Office file that won’t open — Open-and-Repair, clear the Office file cache, release a locked file, and verify the extension.',
    diagnostic: {
      cmd: 'Get-ChildItem $env:TEMP, "$env:LOCALAPPDATA\\Microsoft\\Office\\UnsavedFiles" -Filter "~$*" -ErrorAction SilentlyContinue | Select-Object Name,LastWriteTime',
      shell: 'powershell',
      explainer: 'Look for stray Office owner-lock files (~$…) that can keep a document marked "locked for editing".',
      expectedReproduces: 'One or more ~$ lock files, or the file still won’t open after closing all Office apps',
      expectedNoIssue: 'No lock files and the app opens other files fine — the document itself may be corrupt; use Open-and-Repair.'
    },
    fixSteps: [
      {
        id: 'verify-extension', label: 'Verify the file extension matches its type',
        cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'In File Explorer turn on View → File name extensions. A file saved as the wrong type (e.g. a .csv renamed to .xlsx) shows "format not valid". Rename it back to the correct extension (.xlsx / .docx / .pptx) and try again.',
        rollback: null, estimatedSeconds: 30
      },
      {
        id: 'open-and-repair', label: 'Open and Repair from within the app',
        cmd: null, manual: true, risk: 'orange', requiresConfirm: true,
        explainer: 'Open Excel (or Word) → File → Open → Browse → single-click the file → click the small arrow next to the Open button → choose "Open and Repair". This rebuilds the file’s internal structure without changing the original until you save.',
        rollback: 'If repair fails, choose "Extract Data" on the same menu to pull values out of a damaged workbook.', estimatedSeconds: 60
      },
      {
        id: 'release-lock', label: 'Release a file locked "for editing"',
        cmd: null, manual: true, risk: 'orange', requiresConfirm: true,
        explainer: 'Close every Office app (check the system tray). If it’s a shared/network file, the lock clears when the other person closes it or after Office times out. Delete any leftover ~$<filename> owner-lock file in the same folder — it only stores who had it open, never your data.',
        rollback: null, estimatedSeconds: 45
      },
      {
        id: 'clear-office-cache', label: 'Clear the Office Document Cache (last resort)',
        cmd: 'Start-Process "ms-settings:" ; Write-Host "Close all Office apps first, then clear the Office Upload/Document Cache from File > Options > Save."',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'A stale upload cache can lock cloud files. Close all Office apps, then in any Office app go File → Options → Save → "Delete cached files". Your documents live in OneDrive/SharePoint and re-download.',
        rollback: null, estimatedSeconds: 60
      }
    ],
    ariaScript: {
      intro: 'When a file shows “format not valid”, won’t open, or says it’s locked, it’s usually fixable on your own machine. I’ll walk you through it — nothing changes the original until you save.',
      consent: 'I’ll guide you through 4 safe checks: verify the extension, Open-and-Repair, release a locked file, then clear the Office cache if needed. You approve each step.',
      onCantReproduce: 'The file opens for me here — it may be machine-specific or a permissions issue. Try opening it on another device, or call (647) 581-3182.',
      onSuccess: 'Your file should open now. If it stays corrupt, restore an earlier copy from OneDrive/SharePoint version history, or call (647) 581-3182.'
    },
    allowlistTags: ['office-repair','file-recovery','m365']
  },
  {
    id: 'teams-cache-reset-v1',
    title: 'Teams stuck loading or won’t sign in',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['teams not loading','teams stuck','teams won’t sign in','teams login','teams cache','teams reset'],
    matchPatterns: ['teams.*(load|sign.?in|stuck|cache|reset|broken)'],
    version: 1, riskOverall: 'orange',
    description: 'Clear Microsoft Teams cache. Teams will need to re-download some data on next launch but no chats/files are lost.',
    diagnostic: {
      cmd: 'Get-Process -Name "Teams","ms-teams" -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,Responding',
      shell: 'powershell',
      explainer: 'See if Teams is running.',
      expectedReproduces: 'Teams or ms-teams process appears',
      expectedNoIssue: 'Teams isn’t running — just try opening it; or check that Teams is installed.'
    },
    fixSteps: [
      {
        id: 'close-teams', label: 'Close Teams',
        cmd: 'Get-Process -Name "Teams","ms-teams" -ErrorAction SilentlyContinue | Stop-Process -Force',
        shell: 'powershell', risk: 'yellow', requiresConfirm: true,
        explainer: 'Closes all Teams windows. No chat history is lost — it’s stored in the cloud.',
        rollback: null, estimatedSeconds: 3
      },
      {
        id: 'clear-cache', label: 'Clear Teams cache folder',
        cmd: 'Remove-Item -Path "$env:APPDATA\\Microsoft\\Teams\\Cache","$env:APPDATA\\Microsoft\\Teams\\GPUCache","$env:APPDATA\\Microsoft\\Teams\\blob_storage","$env:APPDATA\\Microsoft\\Teams\\Code Cache","$env:APPDATA\\Microsoft\\Teams\\databases","$env:APPDATA\\Microsoft\\Teams\\IndexedDB","$env:APPDATA\\Microsoft\\Teams\\Local Storage","$env:APPDATA\\Microsoft\\Teams\\tmp" -Recurse -Force -ErrorAction SilentlyContinue',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'Deletes Teams’ local cache. Your chats, files, and settings are stored in the cloud and reload automatically on next launch.',
        rollback: 'No rollback needed — Teams rebuilds cache from cloud automatically', estimatedSeconds: 5
      },
      {
        id: 'restart-teams', label: 'Re-open Teams',
        cmd: 'Start-Process "ms-teams:"',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Re-launches Teams with a fresh cache.', rollback: null, estimatedSeconds: 15
      }
    ],
    ariaScript: {
      intro: 'Stuck Teams almost always means a corrupt local cache. I can clear it safely — no chats or files are lost.',
      consent: '3 steps: close Teams, delete the local cache folder, re-open. Your data lives in the cloud and reloads automatically. Takes ~30 seconds plus 1–2 minutes for Teams to re-sync.',
      onCantReproduce: 'Teams isn’t running. Try opening it normally first. If that fails, call (647) 581-3182.',
      onSuccess: 'Teams should sign in fresh. First launch is slower as it re-downloads cache. If it’s still stuck, call (647) 581-3182.'
    },
    allowlistTags: ['cache-clear','m365']
  },
  {
    id: 'onedrive-reset-v1',
    title: 'OneDrive sync paused or stuck',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['onedrive not syncing','onedrive stuck','onedrive paused','onedrive reset','onedrive sync'],
    matchPatterns: ['onedrive.*(sync|stuck|paus|reset|fail|broken)'],
    version: 1, riskOverall: 'orange',
    description: 'Reset the OneDrive client. Your files remain in the cloud and on disk.',
    diagnostic: {
      cmd: 'Get-Process -Name OneDrive -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,Responding,StartTime',
      shell: 'powershell',
      explainer: 'Check if OneDrive process is running.',
      expectedReproduces: 'OneDrive process exists',
      expectedNoIssue: 'OneDrive not running — may not be installed or signed in.'
    },
    fixSteps: [
      {
        id: 'reset', label: 'Reset OneDrive',
        cmd: '& "$env:LOCALAPPDATA\\Microsoft\\OneDrive\\onedrive.exe" /reset',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'Triggers a clean reset of the OneDrive sync client. Your files in OneDrive are untouched — only the client’s sync state is rebuilt.',
        rollback: 'Re-sign-in if prompted', estimatedSeconds: 10
      },
      {
        id: 'restart', label: 'Re-launch OneDrive (if it didn’t auto-restart)',
        cmd: '& "$env:LOCALAPPDATA\\Microsoft\\OneDrive\\onedrive.exe"',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Starts OneDrive fresh.', rollback: null, estimatedSeconds: 5
      }
    ],
    ariaScript: {
      intro: 'OneDrive sync issues are usually fixed by resetting the client. Your files stay safe in the cloud.',
      consent: 'I’ll run OneDrive’s built-in /reset flag. It re-syncs from scratch using cloud as truth. Your files are not deleted.',
      onCantReproduce: 'OneDrive isn’t running. Make sure you’re signed in. If you can’t sign in, call (647) 581-3182.',
      onSuccess: 'OneDrive is resetting. The icon may briefly show offline — normal. After a few minutes it should resume sync. If not, call (647) 581-3182.'
    },
    allowlistTags: ['client-reset','m365']
  },
  {
    id: 'wifi-no-internet-v1',
    title: 'Connected to Wi-Fi but no internet',
    category: 'network',
    os: ['windows'],
    matchKeywords: ['wifi no internet','connected but no internet','internet not working','can’t browse','no internet'],
    matchPatterns: ['(wifi|wi-fi|wireless|internet|connection).*(no|not|none|fail|broken|down|out)'],
    version: 1, riskOverall: 'orange',
    description: 'Reset network stack: flush DNS, release/renew IP, reset Winsock. Disconnects you briefly.',
    diagnostic: {
      cmd: 'Test-NetConnection -ComputerName 8.8.8.8 -InformationLevel Quiet; ipconfig /all | Select-String "IPv4 Address","Default Gateway","DNS Servers" | Select-Object -First 8',
      shell: 'powershell',
      explainer: 'Try to reach Google DNS at 8.8.8.8 and show your current IP/gateway/DNS.',
      expectedReproduces: 'Test returns False, or DNS entries empty, or IPv4 starts with 169.254 (no real IP)',
      expectedNoIssue: 'Test returns True — internet works. Issue may be browser- or DNS-specific.'
    },
    fixSteps: [
      {
        id: 'flush-dns', label: 'Flush DNS resolver cache',
        cmd: 'ipconfig /flushdns',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Clears cached DNS lookups. Harmless. Takes 1 second.', rollback: null, estimatedSeconds: 2
      },
      {
        id: 'release', label: 'Release current IP',
        cmd: 'ipconfig /release',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'Drops your current network connection so you can request a fresh one. Brief disconnect.',
        rollback: 'Run ipconfig /renew if not auto-renewed', estimatedSeconds: 3
      },
      {
        id: 'renew', label: 'Request a fresh IP',
        cmd: 'ipconfig /renew',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Asks your router for a new IP address.', rollback: null, estimatedSeconds: 8
      }
    ],
    ariaScript: {
      intro: 'Wi-Fi connected but no internet usually means a stuck DNS or IP. I can reset both safely — takes about 15 seconds with a brief blip.',
      consent: '3 steps: flush DNS cache, release IP, renew IP. You’ll lose internet for ~10 seconds then reconnect.',
      onCantReproduce: 'Your connection to 8.8.8.8 works — internet is fine. Might be a website-specific or browser-specific issue. Try a different browser, or call (647) 581-3182.',
      onSuccess: 'Should be reconnected now. Try loading a website. If still no internet, the issue may be your router/modem — try restarting it, or call (647) 581-3182.'
    },
    allowlistTags: ['network-reset']
  },
  {
    id: 'dns-flush-v1',
    title: 'Websites won’t load (DNS issue)',
    category: 'network',
    os: ['windows'],
    matchKeywords: ['website won’t load','can’t access website','dns error','site won’t resolve','flush dns'],
    matchPatterns: ['(website|site|domain|dns).*(not load|won.?t|can.?t|err|fail|broken)'],
    version: 1, riskOverall: 'green',
    description: 'Clear stale DNS cache.',
    diagnostic: {
      cmd: 'Resolve-DnsName -Name "example.com" -ErrorAction SilentlyContinue | Select-Object Name,IPAddress -First 2',
      shell: 'powershell',
      explainer: 'Try to resolve a known domain.',
      expectedReproduces: 'Returns no IP, or wrong/stale IP',
      expectedNoIssue: 'Returns valid IP — DNS works. Try a different browser or check your firewall.'
    },
    fixSteps: [
      {
        id: 'flush', label: 'Flush DNS cache',
        cmd: 'ipconfig /flushdns',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Empties cached DNS lookups so the next page-load is fresh. Always safe.', rollback: null, estimatedSeconds: 2
      }
    ],
    ariaScript: {
      intro: 'DNS cache issues are common. Quick flush fixes most of them.',
      consent: 'One safe command, no disconnect.',
      onCantReproduce: 'DNS is working fine. Issue likely browser-specific, or a firewall/VPN. Call (647) 581-3182.',
      onSuccess: 'DNS flushed. Try the site again.'
    },
    allowlistTags: ['network-cache-clear']
  },
  {
    id: 'printer-spooler-v1',
    title: 'Print queue stuck / printer offline',
    category: 'printer',
    os: ['windows'],
    matchKeywords: ['printer offline','print queue stuck','print spooler','printer won’t print','printer not responding'],
    matchPatterns: ['(printer|print|spooler).*(stuck|offline|frozen|not respond|jam|queue)'],
    version: 1, riskOverall: 'orange',
    description: 'Restart Windows Print Spooler service and clear stuck print jobs.',
    diagnostic: {
      cmd: 'Get-Service -Name Spooler | Format-Table Name,Status,StartType',
      shell: 'powershell',
      explainer: 'Check Print Spooler service status.',
      expectedReproduces: 'Spooler running but jobs not printing, OR Spooler stopped',
      expectedNoIssue: 'Spooler running and no jobs queued — issue may be at printer hardware. Power-cycle printer or call (647) 581-3182.'
    },
    fixSteps: [
      {
        id: 'stop-spooler', label: 'Stop Print Spooler service',
        cmd: 'Stop-Service -Name Spooler -Force',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'Stops the Windows service that manages print jobs. Required to clear stuck jobs.',
        rollback: 'Start-Service Spooler restarts it', estimatedSeconds: 3
      },
      {
        id: 'clear-jobs', label: 'Delete stuck print jobs',
        cmd: 'Remove-Item -Path "$env:WINDIR\\System32\\spool\\PRINTERS\\*.*" -Force -ErrorAction SilentlyContinue',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'Removes queued print jobs that are stuck. Documents you wanted to print won’t print automatically — you’ll need to print them again.',
        rollback: 'Jobs can be re-printed from source application', estimatedSeconds: 2
      },
      {
        id: 'start-spooler', label: 'Restart Print Spooler service',
        cmd: 'Start-Service -Name Spooler',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Brings the print service back online.', rollback: null, estimatedSeconds: 3
      }
    ],
    ariaScript: {
      intro: 'Stuck print queue is one of the most common Windows issues. I can clear it in 3 steps — 30 seconds total.',
      consent: '3 steps: stop the print service, delete the stuck jobs, restart the service. Heads-up: documents already queued won’t print — you’ll need to send them again.',
      onCantReproduce: 'Print Spooler looks healthy with no queued jobs. The issue may be at the printer itself — power-cycle it (off 30 seconds, then on). If still failing, call (647) 581-3182.',
      onSuccess: 'Print Spooler is reset. Try printing now. If still failing, the printer driver may need reinstalling — call (647) 581-3182.'
    },
    allowlistTags: ['service-restart','printer']
  },
  {
    id: 'browser-cache-clear-v1',
    title: 'Browser slow or showing old pages',
    category: 'browser',
    os: ['windows'],
    matchKeywords: ['browser slow','chrome slow','edge slow','firefox slow','clear cache','old page','outdated page'],
    matchPatterns: ['(chrome|edge|firefox|browser).*(slow|cache|old|outdated|broken|lag)'],
    version: 1, riskOverall: 'yellow',
    description: 'Open browser cache-clear settings. Manual step — you choose what to clear.',
    diagnostic: {
      cmd: '$browsers = @("chrome","msedge","firefox") | ForEach-Object { Get-Process -Name $_ -ErrorAction SilentlyContinue }; if ($browsers) { $browsers | Select-Object ProcessName,Id -Unique } else { "No browsers running" }',
      shell: 'powershell',
      explainer: 'Detect which browser is open.',
      expectedReproduces: 'Lists chrome/msedge/firefox',
      expectedNoIssue: 'No browser running. Open the browser, then run the fix.'
    },
    fixSteps: [
      {
        id: 'open-chrome-clear', label: 'Open Chrome’s Clear Browsing Data',
        cmd: 'Start-Process "chrome://settings/clearBrowserData"',
        shell: 'powershell', risk: 'yellow', requiresConfirm: true,
        explainer: 'Opens Chrome’s built-in cache clearing settings. You choose what to delete.',
        rollback: null, estimatedSeconds: 2
      }
    ],
    ariaScript: {
      intro: 'I’ll open the cache settings for you. You stay in control of what gets cleared.',
      consent: 'I open Chrome’s Clear Browsing Data settings. You select Cached images/files (recommended), then click Clear.',
      onCantReproduce: 'No browser is open. Open Chrome/Edge first, then try again.',
      onSuccess: 'Cache cleared. Reload the page that was acting up.'
    },
    allowlistTags: ['browser-settings']
  },
  {
    id: 'slow-pc-cleanup-v1',
    title: 'PC running slow',
    category: 'windows',
    os: ['windows'],
    matchKeywords: ['pc slow','computer slow','laptop slow','slow computer','speed up','clean temp'],
    matchPatterns: ['(pc|computer|laptop|machine|system).*(slow|sluggish|lag|hang)'],
    version: 1, riskOverall: 'orange',
    description: 'Clean temp files and show resource usage to identify slowness cause.',
    diagnostic: {
      cmd: 'Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 5 ProcessName,CPU,WS,Id | Format-Table; "---"; Get-PSDrive C | Select-Object Used,Free; "---"; (Get-WmiObject -Class Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize)',
      shell: 'powershell',
      explainer: 'Show top 5 CPU users, disk free space, and memory.',
      expectedReproduces: 'High-CPU app dominates, or disk almost full (less than 10GB free), or memory pressure',
      expectedNoIssue: 'All metrics normal. Slowness may be perceived — try a restart, or call (647) 581-3182.'
    },
    fixSteps: [
      {
        id: 'clean-temp', label: 'Clear user temp files',
        cmd: 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue; "Cleared user TEMP"; Get-PSDrive C | Select-Object Used,Free',
        shell: 'powershell', risk: 'orange', requiresConfirm: true,
        explainer: 'Deletes contents of your user TEMP folder. Apps will recreate any files they actually need. No documents or settings touched.',
        rollback: 'Temp files regenerate automatically', estimatedSeconds: 30
      }
    ],
    ariaScript: {
      intro: 'Slow PC is usually one of three things: heavy app, full disk, or too many startup items. I’ll check all three.',
      consent: 'First a read-only diagnostic to see what’s heavy. Then optional cleanup of temp files if low disk space.',
      onCantReproduce: 'Resource usage looks normal. A restart might help. If slowness continues, call (647) 581-3182 for a deeper look.',
      onSuccess: 'Temp cleaned. Restart for full effect. If still slow, call (647) 581-3182 — may need hardware check.'
    },
    allowlistTags: ['cleanup','windows']
  },
  {
    id: 'windows-update-check-v1',
    title: 'Check for Windows updates',
    category: 'windows',
    os: ['windows'],
    matchKeywords: ['windows update','update windows','check updates','install updates','windows out of date'],
    matchPatterns: ['windows.*(update|patch|out of date)'],
    version: 1, riskOverall: 'green',
    description: 'Open Windows Update settings.',
    diagnostic: {
      cmd: 'Get-ComputerInfo -Property "WindowsProductName","OsVersion","OsBuildNumber" | Format-List',
      shell: 'powershell',
      explainer: 'Show current Windows build.',
      expectedReproduces: 'Always returns version info',
      expectedNoIssue: ''
    },
    fixSteps: [
      {
        id: 'open-update', label: 'Open Windows Update',
        cmd: 'Start-Process "ms-settings:windowsupdate"',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Opens the Windows Update settings page.', rollback: null, estimatedSeconds: 2
      }
    ],
    ariaScript: {
      intro: 'I’ll open Windows Update for you. Click Check for updates inside.',
      consent: 'Single safe action: open settings.',
      onCantReproduce: '',
      onSuccess: 'Windows Update is open. Click Check for updates. Updates can take 10–60 minutes depending on what’s queued.'
    },
    allowlistTags: ['settings-open','windows']
  },
  {
    id: 'defender-status-v1',
    title: 'Check Windows Defender / antivirus status',
    category: 'security',
    os: ['windows'],
    matchKeywords: ['defender status','antivirus status','is my pc protected','virus protection','security check'],
    matchPatterns: ['(defender|antivirus|virus|security|protect).*(status|check|on|off|enabled)'],
    version: 1, riskOverall: 'green',
    description: 'Show Defender status and signature freshness.',
    diagnostic: {
      cmd: 'Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,AntispywareSignatureLastUpdated,AntivirusSignatureLastUpdated,QuickScanEndTime | Format-List',
      shell: 'powershell',
      explainer: 'Read-only check of Windows Defender state.',
      expectedReproduces: '',
      expectedNoIssue: ''
    },
    fixSteps: [
      {
        id: 'view', label: 'View result',
        cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'AntivirusEnabled=True and RealTimeProtectionEnabled=True means you’re protected. SignatureLastUpdated should be within the last 24 hours. If anything looks off, call (647) 581-3182.',
        rollback: null, estimatedSeconds: 0
      }
    ],
    ariaScript: {
      intro: 'I’ll show you the status of Windows Defender so you can confirm protection is active.',
      consent: 'One read-only check. No changes made.',
      onCantReproduce: '',
      onSuccess: 'Status displayed. If Antivirus or Real-Time Protection shows False, call (647) 581-3182 immediately.'
    },
    allowlistTags: ['security-check']
  },
  {
    id: 'teams-audio-reset-v1',
    title: 'Teams audio or microphone not working',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['teams audio','teams mic','teams microphone','can’t hear','no sound in teams','no mic in teams'],
    matchPatterns: ['teams.*(audio|sound|mic|speaker|hear)'],
    version: 1, riskOverall: 'yellow',
    description: 'Restart Windows audio service and open Teams device settings.',
    diagnostic: {
      cmd: 'Get-Service -Name AudioSrv,Audiosrv | Format-Table Name,Status; "---"; Get-WmiObject -Class Win32_SoundDevice | Select-Object Name,Status -First 3',
      shell: 'powershell',
      explainer: 'Check Windows audio service and connected audio devices.',
      expectedReproduces: 'AudioSrv stopped, or no audio devices',
      expectedNoIssue: 'AudioSrv running and devices present — may be Teams settings issue.'
    },
    fixSteps: [
      {
        id: 'restart-audio', label: 'Restart Windows Audio service',
        cmd: 'Restart-Service -Name Audiosrv -Force',
        shell: 'powershell', risk: 'yellow', requiresConfirm: true,
        explainer: 'Restarts the Windows service that manages all audio. Brief audio interruption.',
        rollback: 'Start-Service Audiosrv', estimatedSeconds: 5
      },
      {
        id: 'open-sound-settings', label: 'Open Sound settings',
        cmd: 'Start-Process "ms-settings:sound"',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Opens Windows Sound settings so you can verify input/output devices.', rollback: null, estimatedSeconds: 2
      }
    ],
    ariaScript: {
      intro: 'Teams audio issues are often a Windows audio service hiccup. I can restart it safely.',
      consent: 'Restart Windows audio + open sound settings. Brief audio interruption (1–2 sec).',
      onCantReproduce: 'Audio service running and devices look fine. Issue may be Teams-specific — in Teams, go to Settings → Devices → select correct mic/speaker. Or call (647) 581-3182.',
      onSuccess: 'Audio service restarted. In Teams, do a test call (Settings → Devices → Make a test call). If still no audio, call (647) 581-3182.'
    },
    allowlistTags: ['service-restart','m365']
  },
  {
    id: 'outlook-sendreceive-v1',
    title: 'Outlook stuck on send/receive',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['outlook send receive','outlook stuck syncing','outlook not sending','outlook not receiving','outlook updating inbox'],
    matchPatterns: ['outlook.*(send|receive|sync|inbox|update)'],
    version: 1, riskOverall: 'yellow',
    description: 'Close Outlook and re-open without modifying any data.',
    diagnostic: {
      cmd: 'Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue | Format-Table Id,ProcessName,Responding,StartTime',
      shell: 'powershell',
      explainer: 'Check Outlook process status.',
      expectedReproduces: 'OUTLOOK process exists and may show Responding=False',
      expectedNoIssue: 'Outlook isn’t running.'
    },
    fixSteps: [
      {
        id: 'close', label: 'Close Outlook',
        cmd: 'Stop-Process -Name OUTLOOK -Force -ErrorAction SilentlyContinue',
        shell: 'powershell', risk: 'yellow', requiresConfirm: true,
        explainer: 'Closes Outlook. Pending sends will retry on next launch — no email is lost.',
        rollback: null, estimatedSeconds: 2
      },
      {
        id: 'reopen', label: 'Re-open Outlook',
        cmd: 'Start-Process outlook',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Re-launches Outlook. It will retry the send/receive automatically.',
        rollback: null, estimatedSeconds: 8
      }
    ],
    ariaScript: {
      intro: 'Stuck send/receive is usually fixed by a clean restart. Your unsent emails are queued in the Outbox and will retry automatically.',
      consent: 'Close + re-open. ~10 seconds. No data touched.',
      onCantReproduce: 'Outlook isn’t running. Try opening it first.',
      onSuccess: 'Outlook should re-sync. If send/receive still stalls, call (647) 581-3182 — you may have a profile or mailbox issue.'
    },
    allowlistTags: ['process-restart','m365']
  },
  {
    id: 'printer-default-fix-v1',
    title: 'Default printer keeps changing',
    category: 'printer',
    os: ['windows'],
    matchKeywords: ['default printer changes','printer changes','wrong default printer','printer keeps switching'],
    matchPatterns: ['default.*printer.*(change|switch|wrong)'],
    version: 1, riskOverall: 'green',
    description: 'Open Printer settings so you can disable Windows’ auto-default behavior.',
    diagnostic: {
      cmd: 'Get-Printer | Select-Object Name,Type,PrinterStatus,Default | Format-Table',
      shell: 'powershell',
      explainer: 'Show all installed printers and which is default.',
      expectedReproduces: '',
      expectedNoIssue: ''
    },
    fixSteps: [
      {
        id: 'open-printer-settings', label: 'Open Printers & scanners settings',
        cmd: 'Start-Process "ms-settings:printers"',
        shell: 'powershell', risk: 'green', requiresConfirm: false,
        explainer: 'Opens Windows printer settings. Inside, turn OFF "Let Windows manage my default printer" to lock your choice.',
        rollback: null, estimatedSeconds: 2
      }
    ],
    ariaScript: {
      intro: 'Windows has a setting that auto-switches your default printer to whichever you used last. I’ll open the right page so you can turn that off.',
      consent: 'Single safe action: open settings.',
      onCantReproduce: '',
      onSuccess: 'In the printer settings, scroll down and toggle OFF "Let Windows manage my default printer," then set your preferred printer as default by clicking it → Set as default. If it still changes, call (647) 581-3182.'
    },
    allowlistTags: ['settings-open','printer']
  },
  {
    id: 'browser-extension-disable-v1',
    title: 'Suspicious browser behavior (new tabs, popups, redirects)',
    category: 'security',
    os: ['windows'],
    matchKeywords: ['browser hijacked','popups','redirects','new tabs','suspicious browser','adware'],
    matchPatterns: ['(browser|chrome|edge).*(hijack|popup|redirect|adware|suspicious|virus)'],
    version: 1, riskOverall: 'orange',
    description: 'Open Chrome/Edge extensions page so you can disable suspect extensions. We do not auto-remove extensions — you decide.',
    diagnostic: {
      cmd: '"Browser extension review requires manual visual inspection. Opening extensions page next."',
      shell: 'powershell',
      explainer: 'No safe automated way to determine which extension is malicious without false positives.',
      expectedReproduces: '',
      expectedNoIssue: ''
    },
    fixSteps: [
      {
        id: 'open-chrome-ext', label: 'Open Chrome extensions',
        cmd: 'Start-Process "chrome://extensions"',
        shell: 'powershell', risk: 'yellow', requiresConfirm: true,
        explainer: 'Opens the Chrome extensions page. Review extensions you don’t recognize and toggle them OFF (don’t delete — just disable to test).',
        rollback: 'Re-enable any extension that was needed', estimatedSeconds: 2
      }
    ],
    ariaScript: {
      intro: 'Hijacked browser is usually a rogue extension. I’ll open the extensions page — you decide what to disable. Then we test.',
      consent: 'I open chrome://extensions. You toggle off anything suspicious or unfamiliar. Restart browser and test.',
      onCantReproduce: '',
      onSuccess: 'Disable suspect extensions, close + reopen browser, and test. If suspicious behavior continues, escalate — you may have malware. Call (647) 581-3182 IMMEDIATELY.'
    },
    allowlistTags: ['browser-settings','security']
  },
  // ── Coverage Slice 1 — Tier 1/2 volume recipes (guided; the web never executes a local fix) ──────────
  {
    id: 'passkey-enroll-v1',
    title: 'Set up a passkey (passwordless sign-in)',
    category: 'identity',
    os: ['windows','macos'],
    matchKeywords: ['set up passkey','create passkey','enroll passkey','passwordless sign in','windows hello passkey','register passkey','add a passkey','use a passkey','fido2 key','phone as passkey'],
    matchPatterns: ['(set ?up|create|enroll|register|add|use).*(passkey|passwordless)','passkey.*(setup|enroll|register)'],
    version: 1, riskOverall: 'green',
    description: 'Enroll a passkey on this device (Windows Hello / Touch ID) or your phone so you can sign in without a password.',
    diagnostic: null,
    fixSteps: [
      { id: 'choose-method', label: 'Choose where the passkey lives', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'A passkey can live on this PC (Windows Hello — PIN/fingerprint/face), this Mac (Touch ID), or your phone. Phone passkeys roam between devices; a device passkey is fastest on that one machine. Pick at least one you always have with you.', rollback: null, estimatedSeconds: 20 },
      { id: 'open-security-info', label: 'Open your account security settings', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'For a work/Microsoft 365 account go to aka.ms/mysecurityinfo (or your IdP’s “Security info”). For a personal Microsoft account, account.microsoft.com → Security → Advanced security options. Choose “Add sign-in method → Passkey”.', rollback: null, estimatedSeconds: 30 },
      { id: 'create-passkey', label: 'Create the passkey', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Follow the prompt: verify with your PIN / fingerprint / face (or scan the QR code with your phone). The passkey is created and bound to your sign-in — no password to remember or phish.', rollback: 'Remove the passkey again from the same Security info page if you change your mind.', estimatedSeconds: 40 },
      { id: 'add-backup', label: 'Add a second method so you never get locked out', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Always register a SECOND passkey or method (e.g. phone + security key, or keep the authenticator app). If the only passkey device is lost you’d otherwise need an admin reset.', rollback: null, estimatedSeconds: 30 }
    ],
    ariaScript: {
      intro: 'A passkey replaces your password with your device’s fingerprint/face/PIN — nothing to phish. I’ll walk you through enrolling one.',
      consent: 'You open your account’s Security info, choose Add → Passkey, and verify with Hello/Touch ID or your phone. I never see the passkey.',
      onCantReproduce: '',
      onSuccess: 'Once it’s created, sign out and back in with the passkey to confirm, then add a second method as backup.'
    },
    allowlistTags: ['identity','passwordless']
  },
  {
    id: 'passkey-recovery-v1',
    title: 'Recover sign-in when a passkey device is lost',
    category: 'identity',
    os: ['windows','macos'],
    matchKeywords: ['lost passkey','passkey not working','new phone passkey','replace passkey','lost my passkey device','cant sign in passkey','passkey gone','remove old passkey','locked out passkey','passkey on old phone'],
    matchPatterns: ['(lost|new|replace|remove|broken|old).*(passkey|device).*(passkey)?','passkey.*(not working|won.?t|lost|gone|locked)','can.?t sign in.*passkey'],
    version: 1, riskOverall: 'yellow',
    description: 'Regain access after losing a passkey device, register a passkey on a new device, and remove the lost one from your account.',
    diagnostic: null,
    fixSteps: [
      { id: 'use-backup-method', label: 'Sign in with a backup method', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'At the sign-in screen choose “Other ways to sign in” / “Use another method” and pick a backup you still have (authenticator app, a second passkey, SMS, or a temporary access pass from your admin).', rollback: null, estimatedSeconds: 40 },
      { id: 'register-new-passkey', label: 'Register a passkey on your new device', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Once signed in, go to Security info → Add sign-in method → Passkey and enroll the new phone/PC (same flow as first-time setup).', rollback: null, estimatedSeconds: 40 },
      { id: 'remove-lost-passkey', label: 'Remove the lost device’s passkey', cmd: null, manual: true, risk: 'yellow', requiresConfirm: true,
        explainer: 'In Security info, find the passkey/credential tied to the lost device and delete it so it can no longer be used. Do this for any device you no longer control.', rollback: 'You cannot undo a deletion — but you can always enroll a fresh passkey on a device you hold.', estimatedSeconds: 30 },
      { id: 'all-lost-admin-reset', label: 'If every method is lost — request an admin reset', cmd: null, manual: true, risk: 'yellow', requiresConfirm: true,
        explainer: 'If you have no working method, your IT admin issues a Temporary Access Pass (Entra) or resets your security info so you can re-enroll. For a personal account use account.microsoft.com recovery. Call (647) 581-3182 if IIS manages your identity.', rollback: null, estimatedSeconds: 60 }
    ],
    ariaScript: {
      intro: 'Lost the device with your passkey? Let’s get you back in with a backup method, enroll a new passkey, and retire the lost one.',
      consent: 'You sign in with a backup method, add a new passkey, then delete the lost device’s credential. I never see your secrets.',
      onCantReproduce: '',
      onSuccess: 'After re-enrolling, always keep TWO methods so a single lost device never locks you out.'
    },
    allowlistTags: ['identity','passwordless','account-recovery']
  },
  {
    id: 'mail-auth-diagnostic-v1',
    title: 'Check email authentication (SPF / DKIM / DMARC)',
    category: 'email',
    os: ['windows','macos'],
    matchKeywords: ['spf','dkim','dmarc','email going to spam','mail marked as spam','we are being spoofed','email spoofing','dmarc record','spf record','mail authentication','external mail rejected','domain spoofed','email failing dmarc'],
    matchPatterns: ['(spf|dkim|dmarc)','(email|mail|domain).*(spoof|going to spam|marked spam|rejected|authentication)','(check|verify|fix).*(spf|dkim|dmarc|mail auth)'],
    version: 1, riskOverall: 'green',
    description: 'Read your domain’s SPF, DKIM, and DMARC DNS records to diagnose spoofing, spam placement, or rejected mail.',
    diagnostic: {
      cmd: 'Resolve-DnsName -Type TXT $env:USERDNSDOMAIN -ErrorAction SilentlyContinue | Where-Object { $_.Strings -match "spf1|DMARC" } | Select-Object -ExpandProperty Strings',
      shell: 'powershell',
      explainer: 'Looks up the TXT records for your domain so we can see the current SPF and DMARC policy (read-only DNS query — changes nothing).',
      expectedReproduces: 'Missing SPF/DMARC, an SPF that ends in ~all/?all, or DMARC p=none — all of which let spoofed mail through or land you in spam.',
      expectedNoIssue: 'A single SPF record ending in -all plus DMARC p=quarantine or p=reject with alignment — authentication is configured.'
    },
    fixSteps: [
      { id: 'read-spf', label: 'Review the SPF record', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'There must be exactly ONE “v=spf1 …” TXT record listing every service that sends as your domain (include:spf.protection.outlook.com etc.), ending in -all (hard fail) or ~all (soft fail). More than one SPF record, or exceeding the 10-DNS-lookup limit, breaks SPF.', rollback: null, estimatedSeconds: 60 },
      { id: 'verify-dkim', label: 'Verify DKIM signing + selector CNAMEs', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Confirm DKIM is enabled in your mail platform (e.g. M365 Defender → Email authentication) and that the selector CNAMEs (selector1._domainkey, selector2._domainkey) resolve. DKIM cryptographically signs outbound mail so receivers can trust it wasn’t altered.', rollback: null, estimatedSeconds: 60 },
      { id: 'set-dmarc', label: 'Publish / tighten the DMARC policy', cmd: null, manual: true, risk: 'yellow', requiresConfirm: true,
        explainer: 'Add a _dmarc TXT record: start at v=DMARC1; p=none; rua=mailto:dmarc@yourdomain to collect reports, then move to p=quarantine and finally p=reject once legitimate senders pass alignment. Never jump straight to p=reject before reviewing reports.', rollback: 'Lower the policy back to p=none if legitimate mail starts failing while you investigate.', estimatedSeconds: 90 }
    ],
    ariaScript: {
      intro: 'Mail landing in spam or your domain being spoofed almost always traces to SPF/DKIM/DMARC. I’ll read your DNS records and show what to fix.',
      consent: 'I run a read-only DNS lookup of your TXT records — no changes. You (or your DNS admin) apply any record updates.',
      onCantReproduce: 'If SPF -all, DKIM signing, and DMARC p=quarantine/reject are all present and aligned, authentication is healthy — the spam issue may be content or reputation; escalate for a deeper review.',
      onSuccess: 'Apply the record changes at your DNS host, wait for propagation, then re-check and watch DMARC aggregate reports for failures.'
    },
    allowlistTags: ['email','dns','security']
  },
  {
    id: 'suspicious-login-check-v1',
    title: 'Suspicious sign-in / conditional-access self-check',
    category: 'security',
    os: ['windows','macos'],
    matchKeywords: ['suspicious login','unusual sign in','someone signed into my account','impossible travel','sign in from another country','account compromised','conditional access blocked','blocked sign in','review sign in activity','was my account hacked','unfamiliar sign in'],
    matchPatterns: ['(suspicious|unusual|unfamiliar|strange).*(sign ?in|login)','(someone|unknown).*(signed|logged) in','impossible travel','conditional access.*(block|denied)','account.*(compromis|hack)'],
    version: 1, riskOverall: 'yellow',
    description: 'Review recent sign-in activity, lock down a possibly-compromised account, and understand a conditional-access block.',
    diagnostic: null,
    fixSteps: [
      { id: 'review-activity', label: 'Review recent sign-in activity', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Go to your account’s recent activity (personal: account.microsoft.com → Security → Sign-in activity; work: My Sign-ins → mysignins.microsoft.com). Look for sign-ins you don’t recognize — unfamiliar locations, devices, or times.', rollback: null, estimatedSeconds: 60 },
      { id: 'secure-if-compromised', label: 'If you don’t recognize a sign-in — secure now', cmd: null, manual: true, risk: 'yellow', requiresConfirm: true,
        explainer: 'Change your password immediately, sign out of all sessions, and confirm your MFA methods are still only yours (remove any unknown authenticator/phone). Report the activity. If it’s a work account, tell IT at once.', rollback: null, estimatedSeconds: 90 },
      { id: 'understand-ca-block', label: 'Understand a conditional-access block', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'A “you can’t get there from here” block is usually conditional access: device not compliant/managed, MFA required, an untrusted location, or a risky-sign-in flag. The block message has a request ID — give it to IT so they can read the exact policy that fired.', rollback: null, estimatedSeconds: 45 },
      { id: 'escalate', label: 'Escalate a confirmed compromise', cmd: null, manual: true, risk: 'yellow', requiresConfirm: true,
        explainer: 'If the account was truly accessed, IT should revoke sessions/tokens, reset credentials, review mailbox rules (auto-forwarding is a classic attacker move), and check for data access. Call (647) 581-3182 if IIS manages your tenant.', rollback: null, estimatedSeconds: 60 }
    ],
    ariaScript: {
      intro: 'Let’s check whether that sign-in was really you. I’ll point you to your account’s activity log and, if anything looks off, lock it down fast.',
      consent: 'You review your own sign-in activity and apply any password/MFA changes. I never see your credentials.',
      onCantReproduce: 'If every recent sign-in is yours and the block was conditional access, capture the request ID and have IT review the policy — your account is likely fine.',
      onSuccess: 'After securing the account, watch for re-blocks and review mailbox forwarding rules for anything you didn’t create.'
    },
    allowlistTags: ['security','identity','account-recovery']
  },
  {
    id: 'onedrive-kfm-repair-v1',
    title: 'Repair OneDrive Known Folder Move (Desktop/Docs/Pictures)',
    category: 'm365',
    os: ['windows'],
    matchKeywords: ['known folder move','kfm','desktop not syncing','documents not backed up','onedrive desktop folder','folder backup stopped','onedrive known folders','my desktop files missing','onedrive folder protection','backup my folders onedrive'],
    matchPatterns: ['(known folder|kfm)','(desktop|documents|pictures).*(not sync|not backed up|missing|onedrive)','onedrive.*(folder|backup).*(protect|stop|fail)'],
    version: 1, riskOverall: 'yellow',
    description: 'Restore OneDrive folder backup (Known Folder Move) when Desktop, Documents, or Pictures stop syncing or appear missing.',
    diagnostic: {
      cmd: 'Get-Process OneDrive -ErrorAction SilentlyContinue | Select-Object Name,Id; Get-ItemProperty "HKCU:\\Software\\Microsoft\\OneDrive\\Accounts\\Business1" -ErrorAction SilentlyContinue | Select-Object UserFolder,ConfiguredTenantId',
      shell: 'powershell',
      explainer: 'Confirms OneDrive is running and reads the configured account folder (read-only) so we know KFM is set up before changing anything.',
      expectedReproduces: 'OneDrive not running, or Desktop/Documents/Pictures not redirected into the OneDrive folder.',
      expectedNoIssue: 'OneDrive is running and the known folders already point into OneDrive — the issue may be a stuck sync; restart the client.'
    },
    fixSteps: [
      { id: 'check-onedrive-running', label: 'Confirm OneDrive is signed in and running', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Look for the OneDrive cloud icon in the system tray. If it’s missing, start OneDrive and sign in with your work account. KFM only works while OneDrive is connected.', rollback: null, estimatedSeconds: 30 },
      { id: 'open-backup-settings', label: 'Open “Manage backup” (Known Folder Move)', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'OneDrive tray icon → gear → Settings → Sync and back up → Manage backup. Turn ON Desktop, Documents, and Pictures so they’re protected and synced.', rollback: 'You can stop a folder’s backup from the same screen; files then live locally again.', estimatedSeconds: 45 },
      { id: 'resolve-sync-conflict', label: 'Clear any “files not syncing” warning', cmd: null, manual: true, risk: 'yellow', requiresConfirm: true,
        explainer: 'If sync is stuck: pause and resume sync, check for files over the path-length/size limits or with blocked characters (\" * : < > ? / \\ |), and free up space if the drive is full. As a last resort, “Reset OneDrive” (per Microsoft’s documented command) re-syncs without deleting cloud files.', rollback: 'A OneDrive reset re-downloads from the cloud; your files in OneDrive are not deleted.', estimatedSeconds: 90 },
      { id: 'verify', label: 'Verify the folders are protected', cmd: null, manual: true, risk: 'green', requiresConfirm: false,
        explainer: 'Manage backup should show Desktop/Documents/Pictures as “Backed up”, and those folders should show OneDrive status icons (green check / cloud). Open a file to confirm it opens from OneDrive.', rollback: null, estimatedSeconds: 30 }
    ],
    ariaScript: {
      intro: 'When Desktop or Documents stop backing up, it’s usually OneDrive Known Folder Move. I’ll help you re-enable folder protection and clear any stuck sync.',
      consent: 'You open OneDrive’s Manage backup screen and toggle the folders on; I only read whether OneDrive is running. Nothing is deleted.',
      onCantReproduce: 'If the folders already show “Backed up” and sync is current, your files are safe in OneDrive — the “missing” files may just need the cloud status to refresh.',
      onSuccess: 'After enabling backup, confirm each folder shows a sync status icon and that a test file appears in OneDrive on the web.'
    },
    allowlistTags: ['m365','onedrive','backup']
  }
];

export const RECIPE_COUNT = RECIPES.length;
