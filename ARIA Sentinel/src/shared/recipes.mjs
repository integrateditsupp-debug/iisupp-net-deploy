export const SENTINEL_VERSION = "0.1.20";
export const BRIDGE_PORT = 37841;
export const CONTROL_PLANE_MVP_RECIPE_COUNT = 25;
export const CONTROL_PLANE_MVP_STOP_CODE_COUNT = 25;
export const RECIPE_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-recipes";
export const STOP_CODES_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-stop-codes";
export const KB_BUNDLE_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-kb-bundle";
export const RECIPE_FEEDBACK_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-recipe-feedback";

export const ALLOWED_OUTBOUND_PATHS = [
  {
    id: "recipes",
    method: "GET",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-recipes",
    direction: "inbound-data",
    purpose: "Pull signed local fix recipes."
  },
  {
    id: "stop-codes",
    method: "GET",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-stop-codes",
    direction: "inbound-data",
    purpose: "Pull Windows stop-code index."
  },
  {
    id: "kb-bundle",
    method: "GET",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-kb-bundle",
    direction: "inbound-data",
    purpose: "Pull content-blind KB metadata bundle."
  },
  {
    id: "recipe-feedback",
    method: "POST",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-recipe-feedback",
    direction: "opt-in-outcome-only",
    purpose: "Send { recipe_id, outcome, ts } only after opt-in. ts MUST be an ISO-8601 string, not epoch-ms — a 13-digit epoch number trips the content-blind payment-card-length check in assertContentSafePayload."
  },
  {
    id: "servicenow",
    method: "POST",
    host: "{customer-instance}.service-now.com",
    path: "/api/now/table/incident",
    direction: "customer-itsm-only",
    purpose: "Raise routed incidents only after customer configuration and confirmation."
  },
  {
    id: "update-manifest",
    method: "GET",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-sentinel-update-manifest",
    direction: "update-channel",
    purpose: "Self-hosted auto-update: pull the electron-updater latest.yml for this license (RUN 14)."
  },
  {
    id: "update-binary",
    method: "GET",
    host: "iisupp.net",
    path: "/sentinel-binaries/",
    direction: "update-channel",
    purpose: "Self-hosted auto-update: download the signed update binary (prefix path) (RUN 14)."
  },
  {
    id: "aria-chat",
    method: "POST",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-chat",
    direction: "brain-channel",
    purpose: "Live ARIA brain: the desktop wraps the iisupp.net/aria chat (prompt + symbolic context only) (RUN 15)."
  },
  {
    id: "aria-research",
    method: "POST",
    host: "iisupp.net",
    path: "/.netlify/functions/aria-research",
    direction: "brain-channel",
    purpose: "Live ARIA brain: research-agent escalation for unsolved issues (RUN 15)."
  }
];

export const STOP_CODES = [
  {
    code: "CRITICAL_PROCESS_DIED",
    hex: "0x000000EF",
    family: "bsod",
    likelyCauses: ["corrupt system files", "driver failure", "disk fault"],
    firstSteps: ["sfc /scannow", "DISM health restore", "review recent drivers"],
    escalation: "Desktop Support if repair confidence is low or minidump suggests hardware."
  },
  {
    code: "SYSTEM_SERVICE_EXCEPTION",
    hex: "0x0000003B",
    family: "bsod",
    likelyCauses: ["driver fault", "graphics stack", "security software conflict"],
    firstSteps: ["safe mode", "driver rollback", "Windows Update review"],
    escalation: "Desktop Support if the device loops or safe mode fails."
  },
  {
    code: "PAGE_FAULT_IN_NONPAGED_AREA",
    hex: "0x00000050",
    family: "bsod",
    likelyCauses: ["RAM fault", "bad driver", "disk paging issue"],
    firstSteps: ["Windows Memory Diagnostic", "driver rollback", "disk check"],
    escalation: "Hardware inspection if memory or storage warnings appear."
  },
  {
    code: "INACCESSIBLE_BOOT_DEVICE",
    hex: "0x0000007B",
    family: "bsod",
    likelyCauses: ["boot disk controller", "storage driver", "disk failure"],
    firstSteps: ["WinRE startup repair", "bootrec scan", "storage diagnostics"],
    escalation: "Desktop Support for reimaging or part replacement."
  },
  {
    code: "DPC_WATCHDOG_VIOLATION",
    hex: "0x00000133",
    family: "bsod",
    likelyCauses: ["storage driver timeout", "firmware", "device driver hang"],
    firstSteps: ["update storage driver", "firmware review", "event log review"],
    escalation: "Desktop Support if repeat crashes continue."
  },
  {
    code: "KMODE_EXCEPTION_NOT_HANDLED",
    hex: "0x0000001E",
    family: "bsod",
    likelyCauses: ["kernel driver exception", "memory corruption", "security software conflict"],
    firstSteps: ["safe mode", "driver rollback", "memory diagnostic"],
    escalation: "Desktop Support if repeat crashes continue."
  },
  {
    code: "IRQL_NOT_LESS_OR_EQUAL",
    hex: "0x0000000A",
    family: "bsod",
    likelyCauses: ["driver memory access", "RAM fault", "firmware"],
    firstSteps: ["driver review", "memory diagnostic", "firmware review"],
    escalation: "Desktop Support if repeat crashes continue."
  },
  {
    code: "SYSTEM_THREAD_EXCEPTION_NOT_HANDLED",
    hex: "0x0000007E",
    family: "bsod",
    likelyCauses: ["driver exception", "graphics driver", "firmware"],
    firstSteps: ["safe mode", "graphics rollback", "Windows Update review"],
    escalation: "Desktop Support if repeat crashes continue."
  },
  {
    code: "BAD_POOL_CALLER",
    hex: "0x000000C2",
    family: "bsod",
    likelyCauses: ["driver memory misuse", "security driver", "RAM"],
    firstSteps: ["recent driver review", "memory diagnostic", "safe mode"],
    escalation: "Desktop Support if repeat crashes continue."
  },
  {
    code: "MEMORY_MANAGEMENT",
    hex: "0x0000001A",
    family: "bsod",
    likelyCauses: ["RAM fault", "driver corruption", "disk paging issue"],
    firstSteps: ["Windows Memory Diagnostic", "driver review", "disk check"],
    escalation: "Hardware inspection if memory warnings appear."
  },
  {
    code: "NTFS_FILE_SYSTEM",
    hex: "0x00000024",
    family: "bsod",
    likelyCauses: ["disk corruption", "storage driver", "file system error"],
    firstSteps: ["storage diagnostics", "safe mode", "system file check"],
    escalation: "Desktop Support if disk health is poor."
  },
  {
    code: "DRIVER_POWER_STATE_FAILURE",
    hex: "0x0000009F",
    family: "bsod",
    likelyCauses: ["sleep resume driver", "USB device", "power management"],
    firstSteps: ["driver power review", "disconnect peripherals", "firmware update"],
    escalation: "Desktop Support if resume crashes repeat."
  },
  {
    code: "VIDEO_TDR_FAILURE",
    hex: "0x00000116",
    family: "bsod",
    likelyCauses: ["graphics driver timeout", "GPU fault", "firmware"],
    firstSteps: ["graphics driver rollback", "firmware review", "thermal check"],
    escalation: "Desktop Support if graphics timeouts repeat."
  },
  {
    code: "WHEA_UNCORRECTABLE_ERROR",
    hex: "0x00000124",
    family: "bsod",
    likelyCauses: ["hardware fault", "thermal issue", "firmware"],
    firstSteps: ["hardware diagnostics", "thermal review", "firmware review"],
    escalation: "Desktop Support because hardware confidence is high."
  },
  {
    code: "CLOCK_WATCHDOG_TIMEOUT",
    hex: "0x00000101",
    family: "bsod",
    likelyCauses: ["CPU deadlock", "firmware", "thermal instability"],
    firstSteps: ["firmware review", "thermal review", "hardware diagnostics"],
    escalation: "Desktop Support if repeated."
  },
  {
    code: "DRIVER_IRQL_NOT_LESS_OR_EQUAL",
    hex: "0x000000D1",
    family: "bsod",
    likelyCauses: ["driver memory access", "network driver", "storage driver"],
    firstSteps: ["driver rollback", "safe mode", "device review"],
    escalation: "Desktop Support if repeated."
  },
  {
    code: "BAD_SYSTEM_CONFIG_INFO",
    hex: "0x00000074",
    family: "bsod",
    likelyCauses: ["registry hive", "BCD config", "recent system change"],
    firstSteps: ["WinRE startup repair", "system restore", "recent change review"],
    escalation: "Desktop Support for boot repair."
  },
  {
    code: "ACPI_BIOS_ERROR",
    hex: "0x000000A5",
    family: "bsod",
    likelyCauses: ["BIOS firmware", "ACPI table", "hardware compatibility"],
    firstSteps: ["firmware review", "vendor advisory", "hardware inventory"],
    escalation: "Desktop Support for firmware or vendor support."
  },
  {
    code: "FAT_FILE_SYSTEM",
    hex: "0x00000023",
    family: "bsod",
    likelyCauses: ["file system corruption", "removable media", "storage driver"],
    firstSteps: ["disconnect removable media", "storage diagnostics", "system file check"],
    escalation: "Desktop Support if disk health or removable media is suspect."
  },
  {
    code: "UNEXPECTED_KERNEL_MODE_TRAP",
    hex: "0x0000007F",
    family: "bsod",
    likelyCauses: ["memory fault", "CPU fault", "driver exception"],
    firstSteps: ["memory diagnostic", "hardware diagnostics", "recent driver review"],
    escalation: "Desktop Support if repeated or hardware diagnostics fail."
  },
  {
    code: "MACHINE_CHECK_EXCEPTION",
    hex: "0x0000009C",
    family: "bsod",
    likelyCauses: ["CPU hardware fault", "thermal issue", "firmware"],
    firstSteps: ["thermal review", "firmware review", "hardware diagnostics"],
    escalation: "Desktop Support because hardware confidence is high."
  },
  {
    code: "THREAD_STUCK_IN_DEVICE_DRIVER",
    hex: "0x000000EA",
    family: "bsod",
    likelyCauses: ["graphics driver", "GPU timeout", "display firmware"],
    firstSteps: ["graphics driver rollback", "firmware review", "thermal check"],
    escalation: "Desktop Support if graphics hangs continue."
  },
  {
    code: "PFN_LIST_CORRUPT",
    hex: "0x0000004E",
    family: "bsod",
    likelyCauses: ["memory corruption", "driver fault", "RAM"],
    firstSteps: ["memory diagnostic", "driver review", "system file check"],
    escalation: "Desktop Support if memory diagnostics report errors."
  },
  {
    code: "REGISTRY_ERROR",
    hex: "0x00000051",
    family: "bsod",
    likelyCauses: ["registry hive corruption", "disk fault", "recent system change"],
    firstSteps: ["WinRE startup repair", "system restore", "disk diagnostics"],
    escalation: "Desktop Support for boot repair or reimage."
  },
  {
    code: "BOOTMGR_IMAGE_CORRUPT",
    hex: "0x000000C1",
    family: "bsod",
    likelyCauses: ["boot manager corruption", "disk fault", "failed update"],
    firstSteps: ["WinRE startup repair", "boot repair guidance", "disk diagnostics"],
    escalation: "Desktop Support for boot recovery."
  }
];

export const RECIPES = [
  {
    id: "disk-low-space-v1",
    family: "DISK",
    signal: "DISK.LOW_SPACE",
    title: "Disk almost full",
    chip: "DISK - LOW SPACE",
    risk: "orange",
    mode: "confirmed",
    confidenceKeywords: ["disk full", "low space", "storage full", "c drive full", "3% free", "not enough space"],
    summary: "Recover space by clearing safe temp locations and old browser cache.",
    detector: "windows.disk.freePercent < 8",
    diagnostic: {
      shell: "powershell",
      command: "Get-PSDrive C | Select-Object Name,Used,Free"
    },
    actions: [
      {
        id: "restore-point",
        label: "Create restore point",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Checkpoint-Computer -Description 'ARIA pre-fix' -RestorePointType 'MODIFY_SETTINGS'",
        dryRunResult: "Restore point request queued. Dry-run did not modify the machine."
      },
      {
        id: "clear-user-temp",
        label: "Clear user temp files",
        shell: "powershell",
        risk: "orange",
        requiresConfirm: true,
        command: "Remove-Item -Path \"$env:TEMP\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
        dryRunResult: "Would clear the current user's temp folder."
      }
    ],
    success: "Recovered local temp space. Restart for full effect.",
    escalation: "Desktop Support if free space remains below 5% or disk SMART health is poor."
  },
  {
    id: "dns-fail-v1",
    family: "NETWORK",
    signal: "NET.DNS.FAIL",
    title: "DNS lookup failed",
    chip: "NETWORK - DNS",
    risk: "green",
    mode: "confirmed",
    confidenceKeywords: ["dns", "website won't load", "site wont load", "can't browse", "cannot resolve", "err_name_not_resolved"],
    summary: "Flush stale DNS cache and retry the current connection.",
    detector: "Resolve-DnsName failure or browser DNS error.",
    diagnostic: {
      shell: "powershell",
      command: "Resolve-DnsName -Name example.com -ErrorAction SilentlyContinue | Select-Object Name,IPAddress -First 2"
    },
    actions: [
      {
        id: "flush-dns",
        label: "Flush DNS cache",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "ipconfig /flushdns",
        dryRunResult: "Would flush Windows DNS resolver cache."
      },
      {
        id: "register-dns",
        label: "Re-register DNS",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "ipconfig /registerdns",
        dryRunResult: "Would re-register the client's DNS records."
      },
      {
        id: "restart-dnscache",
        label: "Restart DNS Client service",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Restart-Service Dnscache -Force",
        dryRunResult: "Would restart the DNS Client (Dnscache) service; it rebuilds on next lookup."
      }
    ],
    success: "DNS cache cleared. Reload the page.",
    escalation: "Network Team if multiple devices on the same network cannot resolve names."
  },
  {
    id: "wifi-no-internet-v1",
    family: "NETWORK",
    signal: "NET.WIFI.DROP",
    title: "Connected with no internet",
    chip: "NETWORK - WIFI",
    risk: "orange",
    mode: "confirmed",
    confidenceKeywords: ["wifi no internet", "connected no internet", "internet down", "wireless drop", "169.254"],
    summary: "Renew the IP address after a safe DNS reset.",
    detector: "Test-NetConnection fails or APIPA address appears.",
    diagnostic: {
      shell: "powershell",
      command: "Test-NetConnection -ComputerName 8.8.8.8 -InformationLevel Quiet"
    },
    actions: [
      {
        id: "flush-dns",
        label: "Flush DNS",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "ipconfig /flushdns",
        dryRunResult: "Would flush DNS."
      },
      {
        id: "renew-ip",
        label: "Renew IP",
        shell: "powershell",
        risk: "orange",
        requiresConfirm: true,
        command: "ipconfig /release; ipconfig /renew",
        dryRunResult: "Would briefly disconnect and renew the network address."
      },
      {
        id: "restart-wlan",
        label: "Restart WLAN service",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Restart-Service WlanSvc -Force",
        dryRunResult: "Would restart the WLAN AutoConfig service so Windows reconnects to saved networks."
      }
    ],
    success: "Network stack refreshed. Try the connection again.",
    escalation: "Network Team if DHCP renewal fails or the issue affects many users."
  },
  {
    id: "printer-spooler-v1",
    family: "PRINT",
    signal: "PRINT.OFFLINE",
    title: "Print queue stuck",
    chip: "PRINT - SPOOLER",
    risk: "orange",
    mode: "confirmed",
    confidenceKeywords: ["printer offline", "print queue", "spooler", "printer won't print", "stuck print"],
    summary: "Restart Print Spooler and clear stuck queued jobs.",
    detector: "Spooler stopped or queue stuck.",
    diagnostic: {
      shell: "powershell",
      command: "Get-Service -Name Spooler | Select-Object Name,Status,StartType"
    },
    actions: [
      {
        id: "restart-spooler",
        label: "Restart Print Spooler",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Restart-Service Spooler -Force",
        dryRunResult: "Would restart the Print Spooler service so the stuck queue is re-read."
      }
    ],
    success: "Print Spooler reset. Try printing again.",
    escalation: "Desktop Support if the queue resets but the printer remains offline."
  },
  {
    id: "teams-cache-v1",
    family: "APP",
    signal: "TEAMS.STUCK",
    title: "Teams stuck loading",
    chip: "APP - TEAMS",
    risk: "orange",
    mode: "confirmed",
    confidenceKeywords: ["teams stuck", "teams not loading", "teams won't sign in", "teams cache"],
    summary: "Close Teams and clear local cache that is safe to rebuild from cloud.",
    detector: "Teams process not responding or repeated sign-in loop.",
    diagnostic: {
      shell: "powershell",
      command: "Get-Process -Name Teams,ms-teams -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Responding"
    },
    actions: [
      {
        id: "close-teams",
        label: "Close Teams",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Get-Process -Name Teams,ms-teams -ErrorAction SilentlyContinue | Stop-Process -Force",
        dryRunResult: "Would close Teams."
      },
      {
        id: "clear-cache",
        label: "Clear Teams cache",
        shell: "powershell",
        risk: "orange",
        requiresConfirm: true,
        command: "Remove-Item -Path \"$env:APPDATA\\Microsoft\\Teams\\Cache\",\"$env:APPDATA\\Microsoft\\Teams\\GPUCache\",\"$env:APPDATA\\Microsoft\\Teams\\blob_storage\",\"$env:APPDATA\\Microsoft\\Teams\\Code Cache\",\"$env:APPDATA\\Microsoft\\Teams\\databases\",\"$env:APPDATA\\Microsoft\\Teams\\IndexedDB\",\"$env:APPDATA\\Microsoft\\Teams\\Local Storage\",\"$env:APPDATA\\Microsoft\\Teams\\tmp\" -Recurse -Force -ErrorAction SilentlyContinue",
        dryRunResult: "Would clear rebuildable Teams cache folders."
      }
    ],
    success: "Teams cache reset. Open Teams and sign in again.",
    escalation: "Service Desk if sign-in still fails after cache reset."
  },
  {
    id: "browser-cache-stale-v1",
    family: "BROWSER",
    signal: "CACHE.STALE",
    title: "This page looks stale",
    chip: "BROWSER - CACHE.STALE",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["stale page", "old page", "cache stale", "hard reload", "service worker"],
    summary: "Clear cache for the current origin and unregister stuck service workers.",
    detector: "Extension sees repeated reloads, service-worker mismatch, or user request.",
    actions: [
      {
        id: "clear-origin-cache",
        label: "Clear current origin cache",
        shell: "chrome-extension",
        risk: "yellow",
        requiresConfirm: true,
        command: "chrome.browsingData.remove({origins:[origin]}, {cache:true, serviceWorkers:true})",
        dryRunResult: "Would clear cache and service worker data for the current origin only."
      },
      {
        id: "hard-reload",
        label: "Hard reload tab",
        shell: "chrome-extension",
        risk: "green",
        requiresConfirm: false,
        command: "chrome.tabs.reload(tabId, { bypassCache: true })",
        dryRunResult: "Would hard reload the current tab."
      }
    ],
    success: "Cache cleared for this site. Page reloaded.",
    escalation: "Service Desk if the site remains broken after origin cache reset."
  },
  {
    id: "browser-password-loop-v1",
    family: "BROWSER",
    signal: "PASSWORD.RETRY.2",
    title: "Repeated login failure",
    chip: "BROWSER - LOGIN",
    risk: "yellow",
    mode: "manual",
    confidenceKeywords: ["password retry", "login failed", "wrong password twice", "mfa loop"],
    summary: "Guide the user through safe login recovery without touching credentials.",
    detector: "Extension observes repeated password form submissions on the same origin.",
    actions: [
      {
        id: "manual-login-check",
        label: "Walk through login checks",
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: "Manual: check caps lock, account lockout delay, MFA prompt, and password manager entry.",
        dryRunResult: "Manual walkthrough only. No credentials read or transmitted."
      }
    ],
    success: "Login recovery walkthrough opened.",
    escalation: "Service Desk if account lockout or MFA reset is needed."
  },
  {
    id: "service-worker-stuck-v1",
    family: "BROWSER",
    signal: "SERVICE.WORKER.STUCK",
    title: "Site worker stuck",
    chip: "BROWSER - SERVICE WORKER",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["service worker", "offline page", "pwa stuck", "site won't update"],
    summary: "Unregister service workers for the current origin and hard reload.",
    detector: "Extension sees controller errors or user selects site-worker reset.",
    actions: [
      {
        id: "unregister-service-workers",
        label: "Unregister service workers",
        shell: "content-script",
        risk: "yellow",
        requiresConfirm: true,
        command: "navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))",
        dryRunResult: "Would unregister service workers for this origin."
      }
    ],
    success: "Service workers reset. Page reloaded.",
    escalation: "Service Desk if the app still serves old assets."
  },
  {
    id: "zoom-weird-v1",
    family: "BROWSER",
    signal: "ZOOM.WEIRD",
    title: "Page zoom looks wrong",
    chip: "BROWSER - ZOOM",
    risk: "green",
    mode: "autonomous",
    confidenceKeywords: ["zoom weird", "page too big", "page too small", "reset zoom"],
    summary: "Reset current tab zoom to 100%.",
    detector: "Extension sees tab zoom not equal to 1.0.",
    actions: [
      {
        id: "reset-zoom",
        label: "Reset zoom",
        shell: "chrome-extension",
        risk: "green",
        requiresConfirm: false,
        command: "chrome.tabs.setZoom(tabId, 1)",
        dryRunResult: "Would reset tab zoom to 100%."
      }
    ],
    success: "Zoom reset to 100%.",
    escalation: "None."
  },
  {
    id: "bsod-critical-process-v1",
    family: "BSOD",
    signal: "BLUE.SCREEN",
    title: "Blue screen detected",
    chip: "BSOD - CRITICAL_PROCESS_DIED",
    risk: "red",
    mode: "manual",
    confidenceKeywords: ["blue screen", "bsod", "critical_process_died", "0x000000ef", "stop code"],
    summary: "Read stop code, match likely cause, then apply only safe local repair guidance.",
    detector: "Crash-on-resume or minidump stop code.",
    diagnostic: {
      shell: "powershell",
      command: "Get-ChildItem C:\\Windows\\Minidump -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name,LastWriteTime,Length"
    },
    actions: [
      {
        id: "read-minidump-list",
        label: "Read minidump list",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: false,
        command: "Get-ChildItem C:\\Windows\\Minidump -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name,LastWriteTime,Length",
        dryRunResult: "Would list recent minidumps without uploading them."
      },
      {
        id: "system-file-check",
        label: "Run system file check",
        shell: "powershell",
        risk: "red",
        requiresConfirm: true,
        command: "sfc /scannow",
        dryRunResult: "Would run Windows system file checker. Disabled in MVP dry-run."
      }
    ],
    success: "BSOD evidence collected locally.",
    escalation: "This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."
  },
  {
    id: "sentinel-self-repair-v1",
    family: "APP",
    signal: "APP.SENTINEL.ERROR",
    title: "ARIA Sentinel self-repair",
    chip: "ARIA - SELF REPAIR",
    risk: "green",
    mode: "autonomous",
    confidenceKeywords: ["aria sentinel", "javascript error", "main process", "eaddrinuse", "port 37841", "self repair", "bridge error"],
    summary: "Diagnose and repair ARIA Sentinel runtime faults without exposing stack traces.",
    detector: "Main process, renderer, bridge and extension self-error events.",
    actions: [
      {
        id: "self-diagnose",
        label: "Run self diagnosis",
        shell: "internal",
        risk: "green",
        requiresConfirm: false,
        command: "selfDiagnose",
        dryRunResult: "Checks bridge, renderer, overlay, local store and safe-mode policy."
      },
      {
        id: "repair-bridge",
        label: "Repair local bridge",
        shell: "internal",
        risk: "green",
        requiresConfirm: false,
        command: "selfRepair",
        dryRunResult: "Restarts only ARIA Sentinel local services when safe."
      }
    ],
    success: "ARIA Sentinel self-repair completed.",
    escalation: "Restart ARIA Sentinel or contact Desktop Support if the same internal error repeats."
  },
  {
    id: "outlook-ost-repair-v1",
    family: "APP",
    signal: "APP.OUTLOOK.OST_CORRUPT",
    title: "Outlook local cache repair",
    chip: "APP - OUTLOOK",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["outlook ost", "outlook pst", "mail corrupt", "outlook search", "outlook sync stuck", "ost corrupt", "outlook crash", "outlook keeps crashing"],
    summary: "Close Outlook, set the cached mailbox file aside (renamed, never deleted), then reopen so Outlook rebuilds it from the server.",
    detector: "Outlook cache errors, repeated crashes, or user-selected mail repair.",
    actions: [
      {
        id: "close-outlook",
        label: "Close Outlook",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue | Stop-Process -Force",
        dryRunResult: "Would close Outlook so the cached mailbox file is not locked."
      },
      {
        id: "rename-ost",
        label: "Set OST file aside (rename, not delete)",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Get-ChildItem \"$env:LOCALAPPDATA\\Microsoft\\Outlook\\*.ost\" -ErrorAction SilentlyContinue | Rename-Item -NewName { $_.Name + '.aria.bak' } -ErrorAction SilentlyContinue",
        dryRunResult: "Would rename the .ost cache to .ost.aria.bak (reversible — nothing is deleted)."
      },
      {
        id: "relaunch-outlook",
        label: "Reopen Outlook",
        shell: "powershell",
        risk: "green",
        requiresConfirm: true,
        command: "Start-Process outlook.exe",
        dryRunResult: "Would reopen Outlook so it rebuilds the cached mailbox from the server."
      }
    ],
    success: "Outlook reopened with a fresh local cache. Your mail re-downloads from the server.",
    escalation: "Service Desk if profile rebuild or mailbox repair is needed."
  },
  {
    id: "windows-update-stuck-v1",
    family: "UPDATE",
    signal: "UPDATE.WINDOWS.STUCK",
    title: "Windows Update stuck",
    chip: "UPDATE - WINDOWS",
    risk: "orange",
    mode: "confirmed",
    confidenceKeywords: ["windows update stuck", "update failed", "update loop", "installing updates stuck"],
    summary: "Reset Windows Update services and caches after confirmation.",
    detector: "Windows Update pending or failed state repeats.",
    actions: [
      {
        id: "restart-update-services",
        label: "Restart update services",
        shell: "powershell",
        risk: "orange",
        requiresConfirm: true,
        command: "Restart-Service wuauserv,bits,cryptsvc -Force",
        dryRunResult: "Would restart Windows Update, BITS and Cryptographic Services."
      }
    ],
    success: "Windows Update services refreshed.",
    escalation: "Desktop Support if updates still fail after reset."
  },
  {
    id: "slow-pc-temp-bloat-v1",
    family: "SYSTEM",
    signal: "SYSTEM.SLOW.TEMP_BLOAT",
    title: "PC slowed by temporary files",
    chip: "SYSTEM - SLOW PC",
    risk: "green",
    mode: "manual",
    confidenceKeywords: ["pc slow", "computer slow", "temp files", "sluggish", "lag"],
    summary: "Offer a safe cleanup and startup review before deeper remediation.",
    detector: "Sustained CPU/RAM thresholds or user selected slow-PC flow.",
    actions: [
      {
        id: "review-startup",
        label: "Review startup apps",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location",
        dryRunResult: "Would list startup entries without changing them."
      }
    ],
    success: "Slow-PC review opened.",
    escalation: "Desktop Support if performance remains degraded."
  },
  {
    id: "onedrive-sync-stuck-v1",
    family: "APP",
    signal: "APP.ONEDRIVE.SYNC_STUCK",
    title: "OneDrive sync stuck",
    chip: "APP - ONEDRIVE",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["onedrive sync stuck", "onedrive paused", "onedrive processing", "sync error"],
    summary: "Reset OneDrive sync client state without reading file names.",
    detector: "OneDrive sync queue stuck or red sync state.",
    actions: [
      {
        id: "reset-onedrive",
        label: "Reset OneDrive client",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Start-Process \"$env:LOCALAPPDATA\\Microsoft\\OneDrive\\OneDrive.exe\" -ArgumentList '/reset'",
        dryRunResult: "Would reset OneDrive and let it rebuild sync state."
      },
      {
        id: "relaunch-onedrive",
        label: "Relaunch OneDrive",
        shell: "powershell",
        risk: "green",
        requiresConfirm: true,
        command: "Start-Process \"$env:LOCALAPPDATA\\Microsoft\\OneDrive\\OneDrive.exe\"",
        dryRunResult: "Would relaunch OneDrive so it resumes syncing."
      }
    ],
    success: "OneDrive reset started.",
    escalation: "Service Desk if sync errors continue."
  },
  {
    id: "net-down-troubleshoot-v1",
    family: "NETWORK",
    signal: "NET.DOWN.TROUBLESHOOT",
    title: "Internet seems down",
    chip: "NETWORK - INTERNET DOWN",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["internet seems down", "no internet connection", "network down troubleshoot", "cannot reach the internet"],
    summary: "Renew the network address, flush DNS and restart the DNS/DHCP client services, then re-test connectivity.",
    detector: "Two consecutive reachability probes to a public resolver failed.",
    diagnostic: { shell: "powershell", command: "Test-NetConnection -ComputerName 1.1.1.1 -Port 53 -InformationLevel Quiet" },
    actions: [
      { id: "renew-ip", label: "Renew network address", shell: "powershell", risk: "yellow", requiresConfirm: true, command: "ipconfig /release; ipconfig /renew", dryRunResult: "Would release and renew the network address." },
      { id: "flush-dns", label: "Flush DNS", shell: "powershell", risk: "green", requiresConfirm: true, command: "ipconfig /flushdns", dryRunResult: "Would flush the DNS resolver cache." },
      { id: "restart-net-services", label: "Restart DNS + DHCP clients", shell: "powershell", risk: "yellow", requiresConfirm: true, command: "Restart-Service Dnscache,Dhcp -Force", dryRunResult: "Would restart the DNS Client and DHCP Client services." }
    ],
    success: "Network stack refreshed. Re-testing connectivity.",
    escalation: "Network Team if the internet stays down after the refresh."
  },
  {
    id: "bluetooth-off-v1",
    family: "SYSTEM",
    signal: "BLUETOOTH.OFF",
    title: "Bluetooth not working",
    chip: "SYSTEM - BLUETOOTH",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["bluetooth", "bluetooth off", "bluetooth not working", "headphones won't connect", "bluetooth disconnected", "bluetooth missing"],
    summary: "Restart the Bluetooth Support Service so adapters and paired devices re-initialise.",
    detector: "Bluetooth Support Service stopped or adapter missing.",
    diagnostic: {
      shell: "powershell",
      command: "Get-Service -Name bthserv | Select-Object Name,Status,StartType"
    },
    actions: [
      {
        id: "restart-bthserv",
        label: "Restart Bluetooth service",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Restart-Service bthserv -Force",
        dryRunResult: "Would restart the Bluetooth Support Service so adapters re-initialise."
      }
    ],
    success: "Bluetooth service restarted. Re-pair the device if it does not reconnect.",
    escalation: "Desktop Support if the Bluetooth adapter is missing from Device Manager."
  },
  {
    id: "vpn-connect-fail-v1",
    family: "NETWORK",
    signal: "VPN.CONNECT.FAIL",
    title: "VPN connection failure",
    chip: "NETWORK - VPN",
    risk: "orange",
    mode: "manual",
    confidenceKeywords: ["vpn failed", "vpn connect fail", "vpn tunnel", "vpn gateway"],
    summary: "Check VPN adapter and guide safe reconnect steps.",
    detector: "VPN adapter disconnected or tunnel setup failure.",
    actions: [
      {
        id: "list-vpn",
        label: "List VPN profiles",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Get-VpnConnection -AllUserConnection",
        dryRunResult: "Would list VPN profiles without exposing credentials."
      },
      {
        id: "restart-rasman",
        label: "Restart Remote Access service",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Restart-Service RasMan -Force",
        dryRunResult: "Would restart Remote Access Connection Manager so the VPN tunnel can re-establish."
      }
    ],
    success: "VPN diagnosis opened.",
    escalation: "Network Team if tunnel or gateway errors continue."
  },
  {
    id: "m365-activation-fail-v1",
    family: "M365",
    signal: "M365.LICENSE.ACTIVATION_FAIL",
    title: "Microsoft 365 activation failure",
    chip: "M365 - LICENSE",
    risk: "yellow",
    mode: "manual",
    confidenceKeywords: ["office activation failed", "m365 license", "office unlicensed", "microsoft 365 expired"],
    summary: "Repair local licensing state without touching documents.",
    detector: "Office activation or licensing state failure.",
    actions: [
      {
        id: "open-office-repair",
        label: "Open Office repair guidance",
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: "Manual: Office account, license and repair checklist.",
        dryRunResult: "Would open local M365 activation checklist."
      }
    ],
    success: "M365 activation repair walkthrough opened.",
    escalation: "Service Desk if license assignment needs admin action."
  },
  {
    id: "audio-no-output-v1",
    family: "AUDIO",
    signal: "AUDIO.NO_OUTPUT",
    title: "No audio output",
    chip: "AUDIO - OUTPUT",
    risk: "green",
    mode: "autonomous",
    confidenceKeywords: ["no audio", "no sound", "speaker muted", "audio output missing"],
    summary: "Restart safe audio services and re-check output devices.",
    detector: "Audio output missing or audio service stopped.",
    actions: [
      {
        id: "restart-audio",
        label: "Restart audio services",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Restart-Service Audiosrv,AudioEndpointBuilder -Force",
        dryRunResult: "Would restart Windows Audio and Audio Endpoint Builder."
      }
    ],
    success: "Audio services refreshed.",
    escalation: "Desktop Support if no output device appears."
  },
  {
    id: "media-permission-blocked-v1",
    family: "MEDIA",
    signal: "MEDIA.PERMISSION_BLOCKED",
    title: "Camera or microphone blocked",
    chip: "MEDIA - PERMISSION",
    risk: "green",
    mode: "manual",
    confidenceKeywords: ["camera blocked", "microphone blocked", "webcam permission", "mic permission"],
    summary: "Guide browser and Windows privacy permission reset.",
    detector: "Browser or OS media permission denied.",
    actions: [
      {
        id: "open-media-checklist",
        label: "Open media permission checklist",
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: "Manual: Windows privacy and browser site permission checklist.",
        dryRunResult: "Would open camera/microphone permission walkthrough."
      }
    ],
    success: "Media permission walkthrough opened.",
    escalation: "Desktop Support if camera hardware is missing."
  },
  {
    id: "defender-stale-v1",
    family: "SECURITY",
    signal: "SECURITY.DEFENDER.STALE",
    title: "Defender signatures stale",
    chip: "SECURITY - DEFENDER",
    risk: "yellow",
    mode: "confirmed",
    confidenceKeywords: ["defender stale", "antivirus out of date", "security definitions", "defender signatures"],
    summary: "Update Microsoft Defender signatures through the local updater.",
    detector: "Defender signature age exceeds policy.",
    actions: [
      {
        id: "update-defender",
        label: "Update Defender signatures",
        shell: "powershell",
        risk: "yellow",
        requiresConfirm: true,
        command: "Update-MpSignature",
        dryRunResult: "Would trigger Microsoft Defender signature update."
      }
    ],
    success: "Defender update requested.",
    escalation: "Security Team if updates fail or malware is suspected."
  },
  {
    id: "browser-tab-crash-loop-v1",
    family: "BROWSER",
    signal: "BROWSER.TAB_CRASH_LOOP",
    title: "Browser tab crash loop",
    chip: "BROWSER - TAB CRASH",
    risk: "orange",
    mode: "manual",
    confidenceKeywords: ["tab crash", "aw snap", "browser crash loop", "chrome crash"],
    summary: "Recover the tab and guide extension-safe-mode checks.",
    detector: "Repeated tab crash events from Chromium extension.",
    actions: [
      {
        id: "recover-tab",
        label: "Recover crashed tab",
        shell: "chrome-extension",
        risk: "yellow",
        requiresConfirm: true,
        command: "chrome.tabs.reload(tabId, { bypassCache: true })",
        dryRunResult: "Would reload the current tab after recording symbolic crash state."
      }
    ],
    success: "Tab recovery started.",
    escalation: "Service Desk if the same site keeps crashing."
  },
  {
    id: "browser-download-blocked-v1",
    family: "BROWSER",
    signal: "BROWSER.DOWNLOAD.BLOCKED",
    title: "Download blocked",
    chip: "BROWSER - DOWNLOAD",
    risk: "yellow",
    mode: "manual",
    confidenceKeywords: ["download blocked", "unsafe download", "download failed", "browser blocked file"],
    summary: "Explain safe download handling without bypassing security policy.",
    detector: "Browser download blocked event.",
    actions: [
      {
        id: "download-guidance",
        label: "Open safe download guidance",
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: "Manual: verify source, scan file, request allowlist if needed.",
        dryRunResult: "Would open download safety checklist."
      }
    ],
    success: "Download guidance opened.",
    escalation: "Security Team if business-critical download is blocked."
  },
  {
    id: "browser-cert-expired-v1",
    family: "BROWSER",
    signal: "BROWSER.CERT.EXPIRED",
    title: "Certificate or clock issue",
    chip: "BROWSER - CERT",
    risk: "yellow",
    mode: "manual",
    confidenceKeywords: ["certificate expired", "net::err_cert_date_invalid", "cert date invalid", "clock wrong"],
    summary: "Check device clock first; do not bypass unsafe certificates.",
    detector: "Browser certificate date error.",
    actions: [
      {
        id: "check-time",
        label: "Check Windows time",
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: "Get-Date",
        dryRunResult: "Would check local device date and time."
      }
    ],
    success: "Certificate safety check opened.",
    escalation: "Service Desk if the site certificate is actually expired."
  },
  {
    id: "browser-mixed-content-v1",
    family: "BROWSER",
    signal: "BROWSER.MIXED_CONTENT",
    title: "Mixed content warning",
    chip: "BROWSER - MIXED CONTENT",
    risk: "green",
    mode: "manual",
    confidenceKeywords: ["mixed content", "insecure content", "https warning"],
    summary: "Explain the warning and clear safe current-origin state.",
    detector: "Repeated mixed-content warning for the current origin.",
    actions: [
      {
        id: "mixed-content-guidance",
        label: "Open mixed-content guidance",
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: "Manual: explain site-side HTTPS issue and safe retry.",
        dryRunResult: "Would open mixed-content explanation."
      }
    ],
    success: "Mixed-content guidance opened.",
    escalation: "Service Desk or site owner if the business app is broken."
  },
  {
    id: "browser-extension-conflict-v1",
    family: "BROWSER",
    signal: "BROWSER.EXT.CONFLICT",
    title: "Extension conflict suspected",
    chip: "BROWSER - EXTENSION",
    risk: "yellow",
    mode: "manual",
    confidenceKeywords: ["extension conflict", "browser extension broke site", "ad blocker broke site"],
    summary: "Walk through a binary-search disable flow without reading page content.",
    detector: "Current-origin failures with multiple enabled extensions.",
    actions: [
      {
        id: "extension-binary-search",
        label: "Open extension conflict guide",
        shell: "manual",
        risk: "yellow",
        requiresConfirm: true,
        command: "Manual: disable half of extensions, reload, narrow conflict.",
        dryRunResult: "Would open extension conflict walkthrough."
      }
    ],
    success: "Extension conflict guide opened.",
    escalation: "Service Desk if the business app stays broken."
  },
  {
    id: "browser-slow-load-v1",
    family: "BROWSER",
    signal: "BROWSER.SLOW_LOAD",
    title: "Site loading slowly",
    chip: "BROWSER - SLOW LOAD",
    risk: "green",
    mode: "manual",
    confidenceKeywords: ["slow load", "site slow", "ttfb", "page takes forever"],
    summary: "Trace DNS/TCP/TLS stage locally and offer DNS refresh.",
    detector: "Repeated high load time for current origin category.",
    actions: [
      {
        id: "slow-load-guidance",
        label: "Open slow-load diagnosis",
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: "Manual: DNS, TCP and TLS stage checklist.",
        dryRunResult: "Would open slow-load diagnosis flow."
      }
    ],
    success: "Slow-load diagnosis opened.",
    escalation: "Network Team if multiple sites are slow."
  },
  // ===== RUN 7 expansion (25 → 50): 8 green service-restart recipes + 15 desktop/browser recipes =====
  svcRecipe("svc-spooler-stopped-v1", "SPOOLER", "Spooler", "Print Spooler", ["spooler service stopped", "print spooler not running", "spooler service is stopped"]),
  svcRecipe("svc-audiosrv-stopped-v1", "AUDIOSRV", "Audiosrv", "Windows Audio", ["windows audio service stopped", "audiosrv not running", "audio service is stopped"]),
  svcRecipe("svc-bits-stopped-v1", "BITS", "BITS", "Background Intelligent Transfer", ["bits service stopped", "background intelligent transfer stopped", "bits not running"]),
  svcRecipe("svc-wuauserv-stopped-v1", "WUAUSERV", "wuauserv", "Windows Update", ["windows update service stopped", "wuauserv not running", "update service is stopped"]),
  svcRecipe("svc-dnscache-stopped-v1", "DNSCACHE", "Dnscache", "DNS Client", ["dns client service stopped", "dnscache not running", "dns client is stopped"]),
  svcRecipe("svc-wlansvc-stopped-v1", "WLANSVC", "WlanSvc", "WLAN AutoConfig", ["wlan autoconfig service stopped", "wlansvc not running", "wlan service is stopped"]),
  svcRecipe("svc-workstation-stopped-v1", "WORKSTATION", "LanmanWorkstation", "Workstation", ["workstation service stopped", "lanmanworkstation not running", "workstation service is stopped"]),
  svcRecipe("svc-rasman-stopped-v1", "RASMAN", "RasMan", "Remote Access Connection Manager", ["remote access service stopped", "rasman not running", "ras service is stopped"]),
  {
    id: "system-high-cpu-v1", family: "SYSTEM", signal: "SYSTEM.SLOW.HIGH_CPU", title: "Sustained high CPU", chip: "SYSTEM - HIGH CPU",
    risk: "green", mode: "manual", confidenceKeywords: ["cpu sustained high", "high cpu usage stuck", "cpu pegged at 100"],
    summary: "List the top CPU consumers (read-only) and offer safe next steps.", detector: "CPU over threshold for 5+ minutes.",
    diagnostic: { shell: "powershell", command: "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name,CPU" },
    actions: [{ id: "review-cpu", label: "Review top CPU processes", shell: "powershell", risk: "green", requiresConfirm: false, command: "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name,CPU", dryRunResult: "Would list the top CPU processes without changing anything." }],
    success: "Top CPU processes listed.", escalation: "Desktop Support if a runaway process needs to be ended."
  },
  {
    id: "system-high-ram-v1", family: "SYSTEM", signal: "SYSTEM.SLOW.HIGH_RAM", title: "Sustained high memory", chip: "SYSTEM - HIGH RAM",
    risk: "green", mode: "manual", confidenceKeywords: ["high ram usage", "memory pegged high", "ram sustained high"],
    summary: "List the top memory consumers (read-only) and offer safe next steps.", detector: "Committed memory over threshold for 5+ minutes.",
    diagnostic: { shell: "powershell", command: "Get-Process | Sort-Object WS -Descending | Select-Object -First 5 Name,WS" },
    actions: [{ id: "review-ram", label: "Review top memory processes", shell: "powershell", risk: "green", requiresConfirm: false, command: "Get-Process | Sort-Object WS -Descending | Select-Object -First 5 Name,WS", dryRunResult: "Would list the top memory processes without changing anything." }],
    success: "Top memory processes listed.", escalation: "Desktop Support if memory stays exhausted."
  },
  {
    id: "bsod-unexpected-shutdown-v1", family: "BSOD", signal: "BSOD.UNEXPECTED_SHUTDOWN", title: "Unexpected shutdown", chip: "BSOD - SHUTDOWN",
    risk: "red", mode: "manual", confidenceKeywords: ["unexpected shutdown", "kernel power 41", "computer rebooted unexpectedly"],
    summary: "Surface the most recent unexpected-shutdown event for review. Never auto-acts.", detector: "Kernel-Power 41 in the System log.",
    actions: [{ id: "read-shutdown", label: "Review shutdown history", shell: "manual", risk: "red", requiresConfirm: true, command: "Manual: review Kernel-Power 41 and recent driver/hardware changes.", dryRunResult: "Would open the unexpected-shutdown review checklist." }],
    success: "Shutdown review opened.", escalation: "Desktop Support / Hardware if shutdowns repeat."
  },
  {
    id: "hardware-whea-v1", family: "BSOD", signal: "HARDWARE.WHEA_ERROR", title: "Hardware (WHEA) error", chip: "HARDWARE - WHEA",
    risk: "red", mode: "manual", confidenceKeywords: ["whea error", "whea uncorrectable", "hardware error event"],
    summary: "Flag a Windows Hardware Error and route to hardware inspection. Never auto-acts.", detector: "WHEA-Logger error event.",
    actions: [{ id: "whea-review", label: "Open hardware error review", shell: "manual", risk: "red", requiresConfirm: true, command: "Manual: WHEA error class, temps, and component check.", dryRunResult: "Would open the hardware-error review checklist." }],
    success: "Hardware error review opened.", escalation: "Hardware inspection — likely CPU, RAM or thermal."
  },
  {
    id: "disk-hardware-fault-v1", family: "DISK", signal: "DISK.HARDWARE_FAULT", title: "Disk hardware fault", chip: "DISK - HARDWARE",
    risk: "orange", mode: "manual", confidenceKeywords: ["disk hardware fault", "smart failure predicted", "disk is failing"],
    summary: "Read SMART/health status (read-only) and advise immediate backup.", detector: "SMART predictive failure or disk health degraded.",
    diagnostic: { shell: "powershell", command: "Get-PhysicalDisk | Select-Object FriendlyName,HealthStatus,OperationalStatus" },
    actions: [{ id: "disk-health", label: "Check disk health", shell: "powershell", risk: "green", requiresConfirm: false, command: "Get-PhysicalDisk | Select-Object HealthStatus,OperationalStatus", dryRunResult: "Would read disk health status without changing anything." }],
    success: "Disk health read. Back up now if degraded.", escalation: "Desktop Support for drive replacement."
  },
  {
    id: "outlook-profile-corrupt-v1", family: "APP", signal: "APP.OUTLOOK.PROFILE_CORRUPT", title: "Outlook profile corrupt", chip: "APP - OUTLOOK PROFILE",
    risk: "yellow", mode: "manual", confidenceKeywords: ["outlook profile corrupt", "outlook profile rebuild", "outlook cannot open profile"],
    summary: "Guide a safe Outlook profile rebuild without reading mail content.", detector: "Outlook fails to open with a profile error.",
    actions: [{ id: "profile-guide", label: "Open profile rebuild guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: Mail control panel, new profile, set as default.", dryRunResult: "Would open the Outlook profile rebuild checklist." }],
    success: "Profile rebuild walkthrough opened.", escalation: "Service Desk if mailbox rebuild is needed."
  },
  {
    id: "onedrive-storage-full-v1", family: "APP", signal: "APP.ONEDRIVE.STORAGE_FULL", title: "OneDrive storage full", chip: "APP - ONEDRIVE FULL",
    risk: "green", mode: "manual", confidenceKeywords: ["onedrive storage full", "onedrive out of space", "onedrive quota exceeded"],
    summary: "Explain quota and guide safe free-up without reading file names.", detector: "OneDrive reports quota exceeded.",
    actions: [{ id: "storage-guide", label: "Open storage guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: review quota, archive/free space, or request more.", dryRunResult: "Would open the OneDrive storage checklist." }],
    success: "Storage guidance opened.", escalation: "Service Desk to raise the storage quota."
  },
  {
    id: "browser-autofill-wrong-v1", family: "BROWSER", signal: "BROWSER.AUTOFILL.WRONG", title: "Autofill filling wrong data", chip: "BROWSER - AUTOFILL",
    risk: "green", mode: "manual", confidenceKeywords: ["autofill wrong data", "autofill wrong address", "form autofill incorrect"],
    summary: "Guide clearing the bad autofill entry for this form only.", detector: "User reports wrong autofill values.",
    actions: [{ id: "autofill-guide", label: "Open autofill fix guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: edit/remove saved autofill entry for this site.", dryRunResult: "Would open the autofill cleanup walkthrough." }],
    success: "Autofill guidance opened.", escalation: "Service Desk if the wrong data persists."
  },
  {
    id: "browser-adblock-break-v1", family: "BROWSER", signal: "BROWSER.ADBLOCK.BREAK", title: "Ad blocker breaking page", chip: "BROWSER - ADBLOCK",
    risk: "green", mode: "manual", confidenceKeywords: ["ad blocker breaking page", "adblock broke checkout", "pause adblock this site"],
    summary: "Guide pausing the ad blocker for this site only.", detector: "Page breaks only with an ad blocker enabled.",
    actions: [{ id: "adblock-guide", label: "Open ad-blocker guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: pause the ad blocker for this origin and reload.", dryRunResult: "Would open the ad-blocker pause walkthrough." }],
    success: "Ad-blocker guidance opened.", escalation: "Service Desk if the business app stays broken."
  },
  {
    id: "printer-driver-stuck-v1", family: "PRINT", signal: "PRINT.DRIVER.STUCK", title: "Printer driver stuck", chip: "PRINT - DRIVER",
    risk: "orange", mode: "manual", confidenceKeywords: ["printer driver stuck", "printer driver crash", "reinstall printer driver"],
    summary: "Guide a safe printer driver reset without removing other printers.", detector: "Print driver host repeatedly crashing.",
    actions: [{ id: "driver-guide", label: "Open driver reset guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: remove and re-add the printer driver for this device.", dryRunResult: "Would open the printer driver reset checklist." }],
    success: "Driver reset guidance opened.", escalation: "Desktop Support if the driver keeps faulting."
  },
  {
    id: "browser-cookies-blocked-v1", family: "BROWSER", signal: "BROWSER.COOKIES.BLOCKED", title: "Cookies blocked on site", chip: "BROWSER - COOKIES",
    risk: "green", mode: "manual", confidenceKeywords: ["cookies blocked", "site needs cookies enabled", "enable cookies this site"],
    summary: "Guide allowing cookies for this site only.", detector: "Site login fails with cookies disabled.",
    actions: [{ id: "cookies-guide", label: "Open cookies guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: allow cookies for this origin and reload.", dryRunResult: "Would open the cookies-allow walkthrough." }],
    success: "Cookies guidance opened.", escalation: "Service Desk if login still fails."
  },
  {
    id: "browser-popup-blocked-v1", family: "BROWSER", signal: "BROWSER.POPUP.BLOCKED", title: "Pop-up blocked", chip: "BROWSER - POPUP",
    risk: "green", mode: "manual", confidenceKeywords: ["popup blocked", "allow popups this site", "popup window blocked"],
    summary: "Guide allowing pop-ups for this trusted site only.", detector: "Required pop-up window blocked.",
    actions: [{ id: "popup-guide", label: "Open pop-up guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: allow pop-ups for this origin and retry.", dryRunResult: "Would open the pop-up allow walkthrough." }],
    success: "Pop-up guidance opened.", escalation: "Service Desk if the app needs broader settings."
  },
  {
    id: "system-time-drift-v1", family: "SYSTEM", signal: "SYSTEM.TIME.DRIFT", title: "System clock drift", chip: "SYSTEM - TIME",
    risk: "green", mode: "manual", confidenceKeywords: ["system clock drift", "windows time out of sync", "time service drift"],
    summary: "Guide a safe Windows Time resync (read-only status first).", detector: "System time differs from the time source.",
    diagnostic: { shell: "powershell", command: "Get-Service -Name W32Time | Select-Object Name,Status" },
    actions: [{ id: "time-guide", label: "Open time resync guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: resync Windows Time against the domain/NTP source.", dryRunResult: "Would open the time resync checklist." }],
    success: "Time resync guidance opened.", escalation: "Network Team if the time source is unreachable."
  },
  {
    id: "net-proxy-misconfig-v1", family: "NETWORK", signal: "NET.PROXY.MISCONFIG", title: "Proxy misconfigured", chip: "NETWORK - PROXY",
    risk: "orange", mode: "manual", confidenceKeywords: ["proxy misconfigured", "wrong proxy settings", "proxy auto config broken"],
    summary: "Read current proxy state (read-only) and guide a safe correction.", detector: "Browsing fails via a misconfigured proxy.",
    diagnostic: { shell: "powershell", command: "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' | Select-Object ProxyEnable,ProxyServer" },
    actions: [{ id: "proxy-guide", label: "Open proxy guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: verify proxy/PAC against policy and correct.", dryRunResult: "Would open the proxy correction checklist." }],
    success: "Proxy guidance opened.", escalation: "Network Team for policy-managed proxy settings."
  },
  {
    id: "browser-download-stuck-v1", family: "BROWSER", signal: "BROWSER.DOWNLOAD.STUCK", title: "Download stuck", chip: "BROWSER - DOWNLOAD STUCK",
    risk: "green", mode: "manual", confidenceKeywords: ["download stuck pending", "download stuck at 100", "download not finishing"],
    summary: "Guide clearing a stuck download without touching other files.", detector: "Download stalls at pending or 100%.",
    actions: [{ id: "download-stuck-guide", label: "Open download fix guidance", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: cancel and retry the stuck download.", dryRunResult: "Would open the stuck-download walkthrough." }],
    success: "Download guidance opened.", escalation: "Service Desk if downloads consistently stall."
  },
  // ===== RUN 8 expansion (50 → 75): 25 long-tail content-blind guidance recipes =====
  guideRecipe("app-excel-hang-v1", "APP", "APP.EXCEL.NOT_RESPONDING", "Excel not responding", "APP - EXCEL", "yellow", ["excel not responding", "excel hangs on open", "excel frozen"]),
  guideRecipe("app-word-hang-v1", "APP", "APP.WORD.NOT_RESPONDING", "Word not responding", "APP - WORD", "yellow", ["word not responding", "word freezes on open", "word frozen"]),
  guideRecipe("app-chrome-profile-locked-v1", "BROWSER", "APP.CHROME.PROFILE_LOCKED", "Chrome profile locked", "BROWSER - PROFILE", "yellow", ["chrome profile locked", "chrome profile in use", "chrome won't open profile"]),
  guideRecipe("app-edge-sync-broken-v1", "BROWSER", "APP.EDGE.SYNC_BROKEN", "Edge sync broken", "BROWSER - EDGE SYNC", "green", ["edge sync broken", "edge not syncing", "edge sync paused"]),
  guideRecipe("net-wifi-weak-v1", "NETWORK", "NET.WIFI.WEAK_SIGNAL", "Weak Wi-Fi signal", "NETWORK - WIFI SIGNAL", "green", ["wifi weak signal", "wifi keeps dropping", "weak wireless signal"]),
  guideRecipe("net-ethernet-unplugged-v1", "NETWORK", "NET.ETHERNET.UNPLUGGED", "Ethernet unplugged", "NETWORK - ETHERNET", "green", ["ethernet cable unplugged", "no ethernet link", "network cable unplugged"]),
  guideRecipe("net-captive-portal-v1", "NETWORK", "NET.CAPTIVE_PORTAL", "Captive portal not loading", "NETWORK - CAPTIVE", "green", ["captive portal won't load", "hotel wifi login page", "guest wifi portal stuck"]),
  guideRecipe("audio-mic-not-detected-v1", "AUDIO", "AUDIO.MIC_NOT_DETECTED", "Microphone not detected", "AUDIO - MIC", "green", ["microphone not detected", "mic not detected on calls", "no microphone found"]),
  guideRecipe("display-second-monitor-blank-v1", "SYSTEM", "DISPLAY.SECOND_MONITOR_BLANK", "Second monitor blank", "DISPLAY - MONITOR", "green", ["second monitor blank", "second monitor not detected", "external display black"]),
  guideRecipe("display-resolution-wrong-v1", "SYSTEM", "DISPLAY.RESOLUTION_WRONG", "Wrong screen resolution", "DISPLAY - RESOLUTION", "green", ["screen resolution wrong", "display stretched resolution", "resolution looks wrong"]),
  guideRecipe("input-keyboard-layout-v1", "SYSTEM", "INPUT.KEYBOARD_WRONG_LAYOUT", "Keyboard typing wrong characters", "INPUT - KEYBOARD", "green", ["keyboard typing wrong characters", "keyboard wrong layout", "keyboard layout changed"]),
  guideRecipe("input-touchpad-disabled-v1", "SYSTEM", "INPUT.TOUCHPAD_DISABLED", "Touchpad not working", "INPUT - TOUCHPAD", "green", ["touchpad not working", "touchpad disabled", "trackpad not responding"]),
  guideRecipe("app-pdf-wont-open-v1", "APP", "APP.PDF.WONT_OPEN", "PDF won't open", "APP - PDF", "green", ["pdf won't open", "adobe reader won't open pdf", "cannot open pdf file"]),
  guideRecipe("app-zoom-no-audio-v1", "APP", "APP.ZOOM.NO_AUDIO", "Zoom has no audio", "APP - ZOOM AUDIO", "green", ["zoom no audio", "zoom can't hear meeting", "zoom audio not working"]),
  guideRecipe("app-teams-camera-black-v1", "APP", "APP.TEAMS.CAMERA_BLACK", "Teams camera black", "APP - TEAMS CAMERA", "green", ["teams camera black", "teams camera black screen", "teams video not showing"]),
  guideRecipe("security-bitlocker-recovery-v1", "SECURITY", "SECURITY.BITLOCKER_RECOVERY", "BitLocker recovery prompt", "SECURITY - BITLOCKER", "red", ["bitlocker recovery key prompt", "bitlocker asking for recovery key", "bitlocker locked out"]),
  guideRecipe("security-firewall-block-v1", "SECURITY", "SECURITY.FIREWALL_BLOCKING_APP", "Firewall blocking app", "SECURITY - FIREWALL", "orange", ["firewall blocking application", "firewall blocked the app", "app blocked by firewall"]),
  guideRecipe("storage-usb-not-recognized-v1", "DISK", "STORAGE.USB_NOT_RECOGNIZED", "USB drive not recognized", "STORAGE - USB", "green", ["usb drive not recognized", "usb stick not showing", "flash drive not detected"]),
  guideRecipe("storage-eject-fail-v1", "DISK", "STORAGE.EXTERNAL_EJECT_FAIL", "Cannot eject external drive", "STORAGE - EJECT", "green", ["cannot eject external drive", "drive in use cannot eject", "safely remove hardware fails"]),
  guideRecipe("system-startup-slow-v1", "SYSTEM", "SYSTEM.STARTUP_SLOW", "Slow Windows startup", "SYSTEM - STARTUP", "green", ["windows startup very slow", "slow boot time", "computer slow to start up"]),
  guideRecipe("system-search-broken-v1", "SYSTEM", "SYSTEM.SEARCH_BROKEN", "Windows Search broken", "SYSTEM - SEARCH", "green", ["windows search not working", "search not returning results", "start search broken"]),
  guideRecipe("system-start-menu-broken-v1", "SYSTEM", "SYSTEM.START_MENU_BROKEN", "Start menu not opening", "SYSTEM - START MENU", "green", ["start menu not opening", "start menu broken", "start button not working"]),
  guideRecipe("app-m365-stuck-updating-v1", "M365", "APP.M365.STUCK_UPDATING", "Office stuck updating", "M365 - UPDATE", "green", ["office stuck updating", "microsoft 365 stuck updating", "office update hangs"]),
  guideRecipe("browser-translate-broken-v1", "BROWSER", "BROWSER.TRANSLATE_BROKEN", "Page translate not working", "BROWSER - TRANSLATE", "green", ["page translate not working", "browser translate broken", "translate this page fails"]),
  guideRecipe("browser-password-not-saving-v1", "BROWSER", "BROWSER.PASSWORD_NOT_SAVING", "Browser not saving passwords", "BROWSER - PASSWORDS", "green", ["browser not saving passwords", "password save prompt missing", "passwords not being saved"]),
  // ===== RUN 11 — patch management surface (detection + guided install; restore-point before install) =====
  {
    id: "patch-available-v1", family: "SYSTEM", signal: "PATCH.AVAILABLE", title: "Updates available", chip: "SYSTEM - PATCH",
    risk: "yellow", mode: "confirmed",
    confidenceKeywords: ["updates available", "patch available", "software out of date", "missing windows updates"],
    summary: "Surface missing Windows + third-party updates (Chrome · Edge · Firefox · Adobe · Zoom · Java) and guide a safe install. A restore point is taken before any install.",
    detector: "Windows Update scan or a vendor version-check reports a newer version.",
    actions: [
      { id: "review-patches", label: "Review available updates", shell: "manual", risk: "green", requiresConfirm: false, command: "Manual: list missing Windows + 3rd-party updates (version numbers only).", dryRunResult: "Would list the available updates without installing anything." }
    ],
    success: "Update review opened. A restore point is taken before any install.",
    escalation: "Desktop Support for fleet-wide patch rollout or a failed update."
  }
];

// Helper for the 25 RUN 8 long-tail recipes — content-blind manual guidance, one safe action.
function guideRecipe(id, family, signal, title, chip, risk, keywords) {
  return {
    id, family, signal, title, chip, risk, mode: "manual",
    confidenceKeywords: keywords,
    summary: `Guide a safe, content-blind fix for: ${title.toLowerCase()}.`,
    detector: `User-reported or signal-matched: ${signal}.`,
    actions: [
      {
        id: "open-guidance",
        label: `Open ${title} guidance`,
        shell: "manual",
        risk: "green",
        requiresConfirm: false,
        command: `Manual: step-by-step checklist for ${signal} (no page or file content is read).`,
        dryRunResult: `Would open the ${title} walkthrough.`
      }
    ],
    success: `${title} guidance opened.`,
    escalation: "Service Desk if the issue persists after the guided steps."
  };
}

// Helper for the 8 RUN 7 service-restart recipes — identical reversible shape, one per service.
function svcRecipe(id, codeSuffix, serviceName, displayName, keywords) {
  return {
    id,
    family: "SYSTEM",
    signal: `SYSTEM.SERVICE.STOPPED.${codeSuffix}`,
    title: `${displayName} service stopped`,
    chip: "SYSTEM - SERVICE",
    risk: "green",
    mode: "confirmed",
    confidenceKeywords: keywords,
    summary: `Restart the stopped ${displayName} service.`,
    detector: `${serviceName} service in a Stopped state.`,
    diagnostic: { shell: "powershell", command: `Get-Service -Name ${serviceName} | Select-Object Name,Status` },
    actions: [
      {
        id: "restart-service",
        label: `Restart ${displayName} service`,
        shell: "powershell",
        risk: "green",
        requiresConfirm: false,
        command: `Restart-Service ${serviceName} -Force`,
        dryRunResult: `Would restart the ${displayName} service.`
      }
    ],
    success: `${displayName} service restarted.`,
    escalation: "Desktop Support if the service will not stay running."
  };
}

export const ROUTING_TARGETS = [
  { signal: "BSOD", group: "Desktop Support", priority: "2 - High" },
  { signal: "DISK", group: "Desktop Support", priority: "3 - Moderate" },
  { signal: "NETWORK", group: "Network Team", priority: "3 - Moderate" },
  { signal: "SECURITY", group: "Security Team", priority: "2 - High" },
  { signal: "APP", group: "Service Desk", priority: "4 - Low" },
  { signal: "BROWSER", group: "Service Desk", priority: "4 - Low" },
  { signal: "PURCHASING", group: "Purchasing", priority: "4 - Low" }
];

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.%_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreRecipe(query, recipe) {
  const q = normalizeText(query);
  if (!q) return 0;
  let score = 0;
  for (const kw of recipe.confidenceKeywords || []) {
    const n = normalizeText(kw);
    if (n && q.includes(n)) score += Math.max(8, n.split(" ").length * 6);
  }
  if (q.includes(normalizeText(recipe.signal))) score += 20;
  if (recipe.family && q.includes(recipe.family.toLowerCase())) score += 5;
  const titleTokens = new Set(normalizeText(recipe.title).split(" ").filter((t) => t.length > 2));
  for (const token of q.split(" ")) {
    if (titleTokens.has(token)) score += 2;
  }
  return score;
}

export function matchRecipes(query, options = {}) {
  const limit = options.limit || 5;
  return RECIPES
    .map((recipe) => ({ recipe, score: scoreRecipe(query, recipe) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recipeById(id) {
  return RECIPES.find((recipe) => recipe.id === id) || null;
}

export function routeForRecipe(recipe) {
  const target = ROUTING_TARGETS.find((entry) => recipe.family && entry.signal === recipe.family);
  return target || ROUTING_TARGETS.find((entry) => entry.signal === "APP");
}

export function buildIncidentDraft(recipe, context = {}) {
  const route = routeForRecipe(recipe);
  return {
    shortDescription: `${recipe.title} (${recipe.signal})`,
    assignmentGroup: route.group,
    priority: route.priority,
    caller: "ARIA Sentinel local user",
    body: [
      recipe.summary,
      `Signal: ${recipe.signal}`,
      `Risk: ${recipe.risk}`,
      context.symbolicCode ? `Symbolic code: ${context.symbolicCode}` : null,
      context.domainCategory ? `Origin category: ${context.domainCategory}` : null,
      "Diagnostic context is stored locally unless the customer ServiceNow connector is configured."
    ].filter(Boolean).join("\n")
  };
}
