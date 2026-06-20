const PATTERNS = [
  ["APP.SENTINEL.ERROR", 0.9, /\b(aria sentinel|sentinel|bridge|eaddrinuse|javascript error|main process|port 37841|self.?repair|self.?diagnose)\b/i],
  ["DISK.LOW_SPACE", 0.86, /\b(disk|drive|storage|c:)\b.*\b(full|low|space|free)\b|\bnot enough space\b/i],
  ["NET.DNS.FAIL", 0.82, /\b(dns|name not resolved|err_name_not_resolved|resolver|lookup failed)\b/i],
  ["NET.ADAPTER.APIPA", 0.8, /\b(apipa|169\.254|adapter|ethernet|wi-?fi)\b.*\b(fail|offline|self-assigned|limited)\b/i],
  ["PRINT.SPOOLER.STUCK", 0.84, /\b(print|printer|spooler|queue)\b.*\b(stuck|stopped|fail|error)\b/i],
  ["APP.OUTLOOK.OST_CORRUPT", 0.72, /\b(outlook|ost|pst|mail)\b.*\b(corrupt|sync|open|stuck|search)\b/i],
  ["APP.TEAMS.SIGNIN_LOOP", 0.78, /\b(teams)\b.*\b(sign.?in|login|loop|cache|stuck)\b/i],
  ["UPDATE.WINDOWS.STUCK", 0.76, /\b(windows update|update)\b.*\b(stuck|fail|loop|install)\b/i],
  ["SYSTEM.SLOW.TEMP_BLOAT", 0.68, /\b(slow|sluggish|lag|temp|temporary files)\b/i],
  ["BROWSER.CACHE.STALE", 0.84, /\b(cache|stale|hard refresh|old version|not updating)\b/i],
  ["BROWSER.SERVICE_WORKER.STUCK", 0.82, /\b(service worker|worker stuck|pwa|offline app)\b/i],
  ["AUTH.LOGIN.RETRY_LOOP", 0.7, /\b(login|password|mfa|authentication|sign.?in)\b.*\b(retry|failed|loop|wrong|locked)\b/i],
  ["BROWSER.ZOOM.WRONG", 0.94, /\b(zoom|scaled|too big|too small)\b/i],
  ["BROWSER.TAB_CRASH_LOOP", 0.72, /\b(tab|browser|chrome|edge)\b.*\b(crash|aw snap|reload loop)\b/i],
  ["BROWSER.DOWNLOAD.BLOCKED", 0.66, /\b(download)\b.*\b(blocked|unsafe|failed)\b/i],
  ["APP.ONEDRIVE.SYNC_STUCK", 0.76, /\b(onedrive)\b.*\b(sync|stuck|paused|processing)\b/i],
  ["VPN.CONNECT.FAIL", 0.74, /\b(vpn)\b.*\b(connect|fail|tunnel|gateway)\b/i],
  ["M365.LICENSE.ACTIVATION_FAIL", 0.72, /\b(office|microsoft 365|m365|license|activation)\b.*\b(fail|expired|unlicensed)\b/i],
  ["AUDIO.NO_OUTPUT", 0.78, /\b(audio|sound|speaker)\b.*\b(no|missing|muted|output)\b/i],
  ["MEDIA.PERMISSION_BLOCKED", 0.7, /\b(camera|microphone|mic|webcam)\b.*\b(blocked|permission|not working)\b/i],
  ["SECURITY.DEFENDER.STALE", 0.8, /\b(defender|antivirus|security)\b.*\b(stale|out of date|signature|definitions)\b/i]
];

const STOP_CODE_MAP = {
  "0X000000EF": "BSOD.CRITICAL_PROCESS_DIED",
  CRITICAL_PROCESS_DIED: "BSOD.CRITICAL_PROCESS_DIED",
  "0X0000003B": "BSOD.SYSTEM_SERVICE_EXCEPTION",
  SYSTEM_SERVICE_EXCEPTION: "BSOD.SYSTEM_SERVICE_EXCEPTION",
  "0X00000050": "BSOD.PAGE_FAULT_IN_NONPAGED_AREA",
  PAGE_FAULT_IN_NONPAGED_AREA: "BSOD.PAGE_FAULT_IN_NONPAGED_AREA",
  "0X0000007B": "BSOD.INACCESSIBLE_BOOT_DEVICE",
  INACCESSIBLE_BOOT_DEVICE: "BSOD.INACCESSIBLE_BOOT_DEVICE",
  "0X00000133": "BSOD.DPC_WATCHDOG_VIOLATION",
  DPC_WATCHDOG_VIOLATION: "BSOD.DPC_WATCHDOG_VIOLATION",
  KMODE_EXCEPTION_NOT_HANDLED: "BSOD.KMODE_EXCEPTION_NOT_HANDLED",
  IRQL_NOT_LESS_OR_EQUAL: "BSOD.IRQL_NOT_LESS_OR_EQUAL",
  SYSTEM_THREAD_EXCEPTION_NOT_HANDLED: "BSOD.SYSTEM_THREAD_EXCEPTION_NOT_HANDLED",
  BAD_POOL_CALLER: "BSOD.BAD_POOL_CALLER",
  MEMORY_MANAGEMENT: "BSOD.MEMORY_MANAGEMENT",
  NTFS_FILE_SYSTEM: "BSOD.NTFS_FILE_SYSTEM",
  DRIVER_POWER_STATE_FAILURE: "BSOD.DRIVER_POWER_STATE_FAILURE",
  VIDEO_TDR_FAILURE: "BSOD.VIDEO_TDR_FAILURE",
  WHEA_UNCORRECTABLE_ERROR: "BSOD.WHEA_UNCORRECTABLE_ERROR",
  CLOCK_WATCHDOG_TIMEOUT: "BSOD.CLOCK_WATCHDOG_TIMEOUT",
  DRIVER_IRQL_NOT_LESS_OR_EQUAL: "BSOD.DRIVER_IRQL_NOT_LESS_OR_EQUAL",
  BAD_SYSTEM_CONFIG_INFO: "BSOD.BAD_SYSTEM_CONFIG_INFO",
  ACPI_BIOS_ERROR: "BSOD.ACPI_BIOS_ERROR",
  FAT_FILE_SYSTEM: "BSOD.FAT_FILE_SYSTEM",
  UNEXPECTED_KERNEL_MODE_TRAP: "BSOD.UNEXPECTED_KERNEL_MODE_TRAP",
  MACHINE_CHECK_EXCEPTION: "BSOD.MACHINE_CHECK_EXCEPTION",
  THREAD_STUCK_IN_DEVICE_DRIVER: "BSOD.THREAD_STUCK_IN_DEVICE_DRIVER",
  PFN_LIST_CORRUPT: "BSOD.PFN_LIST_CORRUPT",
  REGISTRY_ERROR: "BSOD.REGISTRY_ERROR",
  BOOTMGR_IMAGE_CORRUPT: "BSOD.BOOTMGR_IMAGE_CORRUPT"
};

export function sanitizeToSignature(raw = {}) {
  const input = typeof raw === "string" ? { issue: raw } : raw || {};
  const source = sanitizeSource(input.source);
  const osVersion = sanitizeOsVersion(input.osVersion || input.os_version);
  const explicitCode = resolveExplicitCode(input.signal) || resolveExplicitCode(input.stopCode);
  if (explicitCode) return withOs({ code: explicitCode, family: familyFor(explicitCode), confidence: 0.94, source }, osVersion);

  const classifierText = redactPIIForClassificationOnly([
    input.signal,
    input.issue,
    input.title,
    input.originCategory,
    collapseUrlToDomainCategory(input.url),
    collapsePathToFileClass(input.path)
  ].filter(Boolean).join(" "));
  const stopCodeFromText = resolveStopCodeFromText(classifierText);
  if (stopCodeFromText) return withOs({ code: stopCodeFromText, family: "BSOD", confidence: 0.9, source }, osVersion);

  for (const [code, confidence, pattern] of PATTERNS) {
    if (pattern.test(classifierText)) return withOs({ code, family: familyFor(code), confidence, source }, osVersion);
  }
  if (/\b(bsod|blue screen|stop code)\b/i.test(classifierText)) {
    return withOs({ code: "BSOD.UNKNOWN", family: "BSOD", confidence: 0.52, source }, osVersion);
  }
  return withOs({ code: "UNKNOWN.SIGNAL", family: "UNKNOWN", confidence: 0.2, source }, osVersion);
}

export function contentSafeContext(raw = {}) {
  const input = typeof raw === "string" ? { issue: raw } : raw || {};
  const signature = sanitizeToSignature(input);
  const context = {
    symbolicCode: signature.code,
    family: signature.family,
    confidence: signature.confidence,
    source: signature.source
  };
  if (signature.os_version) context.os_version = signature.os_version;
  // originCategory must be one of the fixed enum values; a free-text value is ignored and
  // we fall back to deriving the category from the URL (itself collapsed to an enum).
  const declared = String(input.originCategory || "").toLowerCase();
  const domainCategory = DOMAIN_CATEGORIES.has(declared) ? declared : collapseUrlToDomainCategory(input.url);
  if (domainCategory && domainCategory !== "unknown") context.domainCategory = domainCategory;
  const fileClass = collapsePathToFileClass(input.path);
  if (fileClass !== "unknown") context.fileClass = fileClass;
  return context;
}

export function redactPIIForClassificationOnly(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[phone]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]")
    .replace(/\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g, "[sin]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[card]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/\b[a-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+/gi, "[win-path]")
    .replace(/\/(?:Users|home|var|etc|tmp|mnt)\/[^\s"'<>]+/gi, "[posix-path]")
    .replace(/\b[A-F0-9]{32,}\b/gi, "[token]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[guid]");
}

export function collapseUrlToDomainCategory(value) {
  try {
    const parsed = new URL(String(value || ""));
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return "localhost";
    if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".corp") || host.startsWith("intranet.")) return "internal";
    if (/(login|auth|sso|okta|entra|microsoftonline|accounts\.google)/i.test(host)) return "sso";
    if (/(service-now|salesforce|hubspot|slack|teams|sharepoint|zoom|atlassian|github)/i.test(host)) return "saas";
    return "public";
  } catch {
    return "unknown";
  }
}

export function collapsePathToFileClass(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "unknown";
  if (text.includes("\\windows\\minidump") || text.endsWith(".dmp")) return "minidump";
  if (text.includes("\\windows\\") || text.includes("/etc/") || text.includes("/var/")) return "system";
  if (text.includes("\\temp\\") || text.includes("/tmp/")) return "temp";
  if (text.includes("chrome") || text.includes("edge") || text.includes("browser cache")) return "browser-cache";
  if (text.includes("outlook") || text.includes(".ost") || text.includes(".pst")) return "office-cache";
  if (text.endsWith(".log") || text.includes("\\logs\\") || text.includes("/logs/")) return "log";
  if (text.includes("\\users\\") || text.includes("/users/") || text.includes("/home/")) return "user-profile";
  return "unknown";
}

export function assertContentSafePayload(payload) {
  const text = JSON.stringify(payload);
  const leakPatterns = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /https?:\/\/[^\s"'<>]+/i,
    /\b[a-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+/i,
    /\b(?:\d[ -]*?){13,19}\b/, // payment-card length runs
    /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
    /\b\d{3}[ -]\d{3}[ -]\d{3}\b/ // CA SIN
  ];
  return !leakPatterns.some((pattern) => pattern.test(text));
}

function resolveExplicitCode(value) {
  const raw = String(value || "").trim();
  // An explicit symbolic code is a single TOKEN — never free text. Anything with
  // whitespace is a user sentence and must go through the redacting classifier instead,
  // so PII like "... 987-65-4320" can never be echoed into the symbolic code.
  if (!raw || /\s/.test(raw)) return null;
  // Accept only a code-shaped token: a hex stop code (0x…) or a LETTER-led code token.
  if (!/^0x[0-9a-f]+$/i.test(raw) && !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(raw)) return null;
  const normalized = normalizeSymbolicCode(raw);
  if (!normalized) return null;
  const stopMapped = STOP_CODE_MAP[normalized.replace(/\./g, "_")] || STOP_CODE_MAP[normalized];
  if (stopMapped) return stopMapped;
  if (/^[A-Z]+(\.[A-Z0-9_-]+){1,3}$/.test(normalized)) return normalized;
  return null;
}

// The only domain categories that may ever surface — anything else is dropped, so a raw
// originCategory string can never carry content past the boundary.
const DOMAIN_CATEGORIES = new Set(["localhost", "internal", "sso", "saas", "public"]);

function resolveStopCodeFromText(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z0-9_]+/g, " ");
  for (const [token, code] of Object.entries(STOP_CODE_MAP)) {
    if (normalized.includes(token.replace(/\./g, "_"))) return code;
  }
  return null;
}

function normalizeSymbolicCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function familyFor(code) {
  return normalizeSymbolicCode(code).split(".")[0] || "UNKNOWN";
}

function sanitizeOsVersion(value) {
  const match = String(value || "").match(/\b(?:Windows\s*)?(10|11|Server\s*20\d{2})(?:\s+[A-Za-z0-9().-]+){0,3}/i);
  return match?.[0]?.replace(/\s+/g, " ").slice(0, 40);
}

