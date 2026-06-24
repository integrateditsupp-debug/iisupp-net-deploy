// RUN 20 §1 — installed-apps + hardware/system inventory enumerator. LOCAL ONLY: nothing here leaves
// the device. The PowerShell/registry collection is injected (runPS) so the merge/dedupe/sanitize logic
// is unit-testable without spawning, and so the module imports cleanly in node (no top-level Electron).
//
// READ-ONLY: every collector uses `reg query` / `Get-*` / `Get-ItemProperty` enumeration. There is no
// `reg add`, `reg delete`, `Set-ItemProperty`, `New-ItemProperty`, or any write anywhere in this file.

import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";

export const REQUIRED_APP_FIELDS = ["name", "version", "publisher", "installDate", "installSize", "installLocation", "uninstallString"];

// Read-only collection commands (constants — asserted by the registry-read-only test).
export const REGISTRY_UNINSTALL_KEYS = [
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
];
export const REGISTRY_RUN_KEYS = [
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
  "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run"
];

// ── Content-blind sanitization ────────────────────────────────────────────────────────────────────
// Strip usernames, machine names, emails and PII-bearing file paths before anything is stored/shown.
const USER_PATH = /([a-z]:)\\users\\[^\\/:*?"<>|\r\n]+/gi;
const UNC_MACHINE = /\\\\[A-Za-z0-9._-]+/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const HOMEDIR = /\/(?:home|Users)\/[^/\s:*?"<>|]+/g;

export function sanitizeText(value) {
  // 🔒 R11 — redact the off-limits "Private pics and Vids" folder FIRST, then strip user/machine/email PII.
  return redactPrivate(value)
    .replace(USER_PATH, "$1\\Users\\<user>")
    .replace(HOMEDIR, "/Users/<user>")
    .replace(UNC_MACHINE, "\\\\<machine>")
    .replace(EMAIL, "<email>");
}

// An app whose name/publisher itself carries PII (an email or a user-path) is redacted to a placeholder.
const PII_IN_NAME = /(@[A-Z0-9.-]+\.[A-Z]{2,})|([a-z]:\\users\\)/i;
export function sanitizeApp(app = {}) {
  const out = {};
  for (const f of REQUIRED_APP_FIELDS) out[f] = app[f] == null ? null : sanitizeText(app[f]);
  if (out.name && PII_IN_NAME.test(String(app.name))) out.name = "<redacted app>";
  return out;
}

export function sanitizeEventLog(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((e) => ({
    level: String(e.level || "Error"),
    source: sanitizeText(e.source || ""),
    id: e.id != null ? Number(e.id) : null,
    message: sanitizeText(e.message || "")
  }));
}

// ── Merge + dedupe installed apps from the 3 sources ────────────────────────────────────────────────
function normalizeApp(raw = {}, source = "unknown") {
  return {
    name: raw.name || raw.DisplayName || raw.Name || null,
    version: raw.version || raw.DisplayVersion || raw.Version || null,
    publisher: raw.publisher || raw.Publisher || null,
    installDate: raw.installDate || raw.InstallDate || null,
    installSize: raw.installSize ?? raw.EstimatedSize ?? null,
    installLocation: raw.installLocation || raw.InstallLocation || null,
    uninstallString: raw.uninstallString || raw.UninstallString || null,
    source
  };
}

/** Merge registry + Get-Package + Get-AppxPackage app lists, deduped by lower(name)+version. */
export function mergeInstalledApps(registryApps = [], packageApps = [], storeApps = []) {
  const seen = new Map();
  const add = (list, source) => {
    for (const raw of list || []) {
      const app = normalizeApp(raw, source);
      if (!app.name) continue;
      // 🔒 R11 — never inventory anything located in / named after the off-limits private folder.
      if (isBlockedPath(app.installLocation) || isBlockedPath(app.name)) continue;
      const key = `${String(app.name).toLowerCase().trim()}@@${String(app.version || "").toLowerCase().trim()}`;
      if (!seen.has(key)) seen.set(key, app);
      else { // merge: fill any missing fields from the additional source
        const prev = seen.get(key);
        for (const f of REQUIRED_APP_FIELDS) if (prev[f] == null && app[f] != null) prev[f] = app[f];
        prev.source = `${prev.source}+${source}`;
      }
    }
  };
  add(registryApps, "registry");
  add(packageApps, "get-package");
  add(storeApps, "appx-store");
  return [...seen.values()].map((a) => ({ ...sanitizeApp(a), source: a.source }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// ── Assemble the full sanitized system-context shape (pure) ─────────────────────────────────────────
export function buildSystemContext(parts = {}, now = new Date().toISOString()) {
  const apps = mergeInstalledApps(parts.registryApps, parts.packageApps, parts.storeApps);
  return {
    generatedAt: now,
    schema: 1,
    contentBlind: true,
    apps,
    appCount: apps.length,
    cpu: parts.cpu || null,
    ram: parts.ram || null,
    gpu: parts.gpu || null,
    disk: parts.disk || (Array.isArray(parts.disks) && parts.disks[0]) || null,
    disks: parts.disks || [],
    network: parts.network || [],
    os: parts.os || null,
    drivers: parts.drivers || [],
    services: parts.services || [],
    startup: parts.startup || [],
    recentUpdates: parts.recentUpdates || [],
    eventLog: parts.eventLog || { errorsBySubsystem: {}, critical24h: 0, error24h: 0, error7d: 0, entries: [] }
  };
}

const noopPS = async () => "[]";
const parseJson = (s) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : (v ? [v] : []); } catch { return []; } };

/**
 * Collect the full context. `runPS(label, command)` is injected (Electron/main supplies a real
 * child_process spawn of powershell -NoProfile -Command). Tests inject a fast canned runner.
 */
export async function enumerate({ runPS = noopPS, now = new Date().toISOString() } = {}) {
  const [reg, pkg, store, hw] = await Promise.all([
    runPS("registry-apps", "reg query (read-only enumeration)").then(parseJson).catch(() => []),
    runPS("get-package", "Get-Package | ConvertTo-Json").then(parseJson).catch(() => []),
    runPS("appx", "Get-AppxPackage | ConvertTo-Json").then(parseJson).catch(() => []),
    runPS("hardware", "Get-CimInstance (cpu/ram/gpu/disk/net/os) | ConvertTo-Json").then((s) => { try { return JSON.parse(s); } catch { return {}; } }).catch(() => ({}))
  ]);
  return buildSystemContext({
    registryApps: reg,
    packageApps: pkg,
    storeApps: store,
    cpu: hw.cpu || null,
    ram: hw.ram || null,
    gpu: hw.gpu || null,
    disks: hw.disks || [],
    network: hw.network || [],
    os: hw.os || null,
    drivers: hw.drivers || [],
    services: hw.services || [],
    startup: hw.startup || [],
    recentUpdates: hw.recentUpdates || [],
    eventLog: hw.eventLog ? { ...hw.eventLog, entries: sanitizeEventLog(hw.eventLog.entries) } : undefined
  }, now);
}
