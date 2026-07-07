import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { createHash } from "node:crypto";
import {
  OFFICE_BACKUP_INTERVAL_MS,
  OFFICE_VALIDATION_INTERVAL_MS,
  isSupportedOfficeFile,
  officeAppForFile,
  planOfficeBackupSet,
  evaluateBackupValidation,
  retentionPlan
} from "../shared/office-file-safety.mjs";

export const OFFICE_SCAN_INTERVAL_MS = 30 * 1000;
export const OFFICE_ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const OFFICE_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const OFFICE_MAX_FILES_PER_SCAN = 500;
export const OFFICE_MAX_DIRECTORIES_PER_SCAN = 200;
export const OFFICE_MAX_SCAN_DEPTH = 6;

const OPEN_XML_EXTENSIONS = new Set([".docx", ".docm", ".dotx", ".dotm", ".xlsx", ".xlsm", ".xltx", ".xltm", ".pptx", ".pptm", ".potx", ".potm"]);
const SKIP_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "appdata",
  "program files",
  "program files (x86)",
  "programdata",
  "windows",
  "$recycle.bin",
  "system volume information"
]);

function hashId(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function cleanError(error) {
  if (!error) return "";
  if (error.code) return String(error.code);
  return "office-safety-error";
}

function safeNumber(value, fallback, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((v) => String(v || "").trim()).filter(Boolean)));
}

function isPathInside(pathMod, root, target) {
  const base = pathMod.resolve(String(root || ""));
  const next = pathMod.resolve(String(target || ""));
  const rel = pathMod.relative(base, next);
  return rel === "" || (rel && !rel.startsWith("..") && !pathMod.isAbsolute(rel));
}

function officeFileIsTemporary(pathMod, filePath) {
  const base = pathMod.basename(String(filePath || "")).toLowerCase();
  return !base || base.startsWith("~$") || base.endsWith(".tmp");
}

function defaultBackupRoot({ pathMod, osMod }) {
  const home = osMod.homedir?.() || process.cwd();
  return pathMod.join(home, ".aria-sentinel", "office-rescue-backups");
}

export function defaultOfficeWatchRoots({ pathMod = nodePath, osMod = nodeOs, env = process.env } = {}) {
  const home = osMod.homedir?.() || "";
  const candidates = [
    home ? pathMod.join(home, "Documents") : "",
    home ? pathMod.join(home, "Desktop") : "",
    env.ONEDRIVE,
    env.OneDrive,
    env.OneDriveCommercial,
    env.OneDriveConsumer
  ];
  return uniqueStrings(candidates);
}

export function normalizeOfficeSafetyConfig(input = {}, deps = {}) {
  const pathMod = deps.path || nodePath;
  const osMod = deps.os || nodeOs;
  const env = deps.env || process.env;
  const backupRoot = String(input.backupRoot || defaultBackupRoot({ pathMod, osMod }));
  return {
    enabled: input.enabled !== false,
    scanIntervalMs: safeNumber(input.scanIntervalMs, OFFICE_SCAN_INTERVAL_MS, 1000),
    backupIntervalMs: safeNumber(input.backupIntervalMs, OFFICE_BACKUP_INTERVAL_MS, 1000),
    validationIntervalMs: safeNumber(input.validationIntervalMs, OFFICE_VALIDATION_INTERVAL_MS, 1000),
    activeWindowMs: safeNumber(input.activeWindowMs, OFFICE_ACTIVE_WINDOW_MS, 60 * 1000),
    maxFileBytes: safeNumber(input.maxFileBytes, OFFICE_MAX_FILE_BYTES, 1024),
    maxFilesPerScan: safeNumber(input.maxFilesPerScan, OFFICE_MAX_FILES_PER_SCAN, 1),
    maxDirectoriesPerScan: safeNumber(input.maxDirectoriesPerScan, OFFICE_MAX_DIRECTORIES_PER_SCAN, 1),
    maxScanDepth: safeNumber(input.maxScanDepth, OFFICE_MAX_SCAN_DEPTH, 0),
    maxVersionsPerDocument: safeNumber(input.maxVersionsPerDocument, 120, 1),
    backupRoot,
    userSid: String(input.userSid || env.USERNAME || env.USER || "local-user").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80) || "local-user",
    watchRoots: uniqueStrings(input.watchRoots?.length ? input.watchRoots : defaultOfficeWatchRoots({ pathMod, osMod, env }))
  };
}

export function validateOfficeBackupCopy(filePath, deps = {}) {
  const fsMod = deps.fs || nodeFs;
  const pathMod = deps.path || nodePath;
  const ext = pathMod.extname(String(filePath || "")).toLowerCase();
  let handle = null;
  try {
    const stat = fsMod.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) {
      return { ok: false, validationCopyOpened: false, packageReadable: false, reason: "empty-backup" };
    }
    handle = fsMod.openSync(filePath, "r");
    const head = Buffer.alloc(Math.min(8, stat.size));
    fsMod.readSync(handle, head, 0, head.length, 0);
    if (OPEN_XML_EXTENSIONS.has(ext)) {
      const hasZipHeader = head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b;
      const tailLength = Math.min(66000, stat.size);
      const tail = Buffer.alloc(tailLength);
      fsMod.readSync(handle, tail, 0, tail.length, stat.size - tailLength);
      const hasCentralDirectory = tail.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])) || tail.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
      const ok = hasZipHeader && hasCentralDirectory;
      return { ok, validationCopyOpened: true, packageReadable: ok, reason: ok ? "" : "openxml-package-check-failed" };
    }
    return { ok: true, validationCopyOpened: true, packageReadable: true, reason: "" };
  } catch (error) {
    return { ok: false, validationCopyOpened: false, packageReadable: false, reason: cleanError(error) };
  } finally {
    if (handle != null) {
      try { fsMod.closeSync(handle); } catch { /* ignore close errors */ }
    }
  }
}

export function createOfficeSafetyService(options = {}) {
  const fsMod = options.fs || nodeFs;
  const pathMod = options.path || nodePath;
  const osMod = options.os || nodeOs;
  const now = options.now || (() => Date.now());
  const setIntervalFn = options.setInterval || setInterval;
  const clearIntervalFn = options.clearInterval || clearInterval;
  const log = options.log || (() => {});
  const onChange = options.onChange || (() => {});

  let config = normalizeOfficeSafetyConfig(options.config || {}, { path: pathMod, os: osMod, env: options.env || process.env });
  let timer = null;
  let running = false;
  let lastScanAt = 0;
  let lastBackupAt = 0;
  let lastValidationAt = 0;
  let backupsCreated = 0;
  let validationsPassed = 0;
  let validationFailures = 0;
  let lastError = "";
  const docs = new Map();
  const recentEvents = [];

  function pushEvent(type, detail = {}) {
    const row = {
      at: toIso(now()),
      type,
      label: detail.label || "",
      app: detail.app || "",
      result: detail.result || ""
    };
    recentEvents.unshift(row);
    recentEvents.splice(10);
  }

  function publicDoc(record) {
    return {
      id: record.id,
      label: `${record.app || "office"} document ${record.id.slice(0, 6)}`,
      app: record.app,
      version: record.version || 0,
      healthy: record.latestHealthy === true,
      lastSeenAt: toIso(record.lastSeenAt),
      lastBackupAt: toIso(record.lastBackupAt),
      lastValidatedAt: toIso(record.lastValidatedAt)
    };
  }

  function status() {
    const rows = Array.from(docs.values()).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    return {
      ok: !lastError,
      enabled: Boolean(config.enabled),
      running,
      backupIntervalMs: config.backupIntervalMs,
      validationIntervalMs: config.validationIntervalMs,
      scanIntervalMs: config.scanIntervalMs,
      activeWindowMs: config.activeWindowMs,
      watchRootsCount: config.watchRoots.length,
      backupVault: "local-user-vault",
      backupRootConfigured: Boolean(config.backupRoot),
      filesTracked: docs.size,
      backupsCreated,
      validationsPassed,
      validationFailures,
      lastScanAt: toIso(lastScanAt),
      lastBackupAt: toIso(lastBackupAt),
      lastValidationAt: toIso(lastValidationAt),
      lastError,
      documents: rows.slice(0, 8).map(publicDoc),
      recentEvents: recentEvents.slice(0, 10),
      safeContract: {
        localOnly: true,
        cloudUpload: false,
        validatesLiveFile: false,
        validationUsesRenamedCopy: true,
        launchesOffice: false,
        macrosRun: false
      }
    };
  }

  function emitChanged() {
    try { onChange(status()); } catch { /* change notifications must not break backups */ }
  }

  function logSafe(message) {
    try { log("OFFICE-SAFETY", message); } catch { /* logging is best effort */ }
  }

  function ensureParentDir(filePath) {
    fsMod.mkdirSync(pathMod.dirname(filePath), { recursive: true });
  }

  function deleteIfInsideBackupRoot(filePath) {
    if (!isPathInside(pathMod, config.backupRoot, filePath)) return false;
    try {
      fsMod.rmSync(filePath, { force: true });
      return true;
    } catch {
      return false;
    }
  }

  function applyRetention(record) {
    if (!record.backupFolder) return;
    let files = [];
    try {
      files = fsMod.readdirSync(record.backupFolder).filter((name) => name.includes("__ARIA_BACKUP__"));
    } catch {
      return;
    }
    const rows = files.map((name) => {
      const fullPath = pathMod.join(record.backupFolder, name);
      let stat = null;
      try { stat = fsMod.statSync(fullPath); } catch { stat = null; }
      return {
        id: fullPath,
        path: fullPath,
        createdAt: stat ? new Date(stat.mtimeMs).toISOString() : "",
        healthy: fullPath === record.latestKnownGoodPath
      };
    });
    for (const row of retentionPlan(rows, { maxVersions: config.maxVersionsPerDocument, keepLatestKnownGood: true })) {
      if (row.deleteCandidate) deleteIfInsideBackupRoot(row.path);
    }
  }

  function trackDocument(filePath, stat = null) {
    const normalized = pathMod.resolve(String(filePath || ""));
    const id = hashId(normalized.toLowerCase());
    const app = officeAppForFile(normalized) || "office";
    const existing = docs.get(id) || {
      id,
      app,
      filePath: normalized,
      version: 0,
      firstSeenAt: now(),
      lastBackupAt: 0,
      lastValidatedAt: 0,
      lastBackupSourceMtimeMs: 0,
      lastBackupSourceSize: 0,
      latestBackupPath: "",
      latestValidationPath: "",
      latestKnownGoodPath: "",
      latestHealthy: false,
      backupFolder: ""
    };
    existing.lastSeenAt = now();
    existing.lastModifiedMs = stat?.mtimeMs || existing.lastModifiedMs || 0;
    existing.lastSize = stat?.size || existing.lastSize || 0;
    docs.set(id, existing);
    return existing;
  }

  function sourceAllowed(filePath, stat = null) {
    if (!isSupportedOfficeFile(filePath)) return { ok: false, reason: "unsupported-office-file" };
    if (officeFileIsTemporary(pathMod, filePath)) return { ok: false, reason: "temporary-office-lock-file" };
    if (isPathInside(pathMod, config.backupRoot, filePath)) return { ok: false, reason: "inside-backup-vault" };
    const row = stat || fsMod.statSync(filePath);
    if (!row.isFile()) return { ok: false, reason: "not-a-file" };
    if (row.size <= 0) return { ok: false, reason: "empty-file" };
    if (row.size > config.maxFileBytes) return { ok: false, reason: "file-too-large" };
    return { ok: true, stat: row };
  }

  function backupDocument(record, stat, reason = "interval") {
    const source = sourceAllowed(record.filePath, stat);
    if (!source.ok) return { ok: false, reason: source.reason };
    const version = (record.version || 0) + 1;
    const planned = planOfficeBackupSet({
      filePath: record.filePath,
      userSid: config.userSid,
      documentId: record.id,
      root: config.backupRoot,
      timestamp: now(),
      version,
      pathImpl: pathMod
    });
    if (!planned.ok) return { ok: false, reason: planned.errors?.[0] || "backup-plan-failed" };
    if (!isPathInside(pathMod, config.backupRoot, planned.plan.originalBackupPath)) {
      return { ok: false, reason: "backup-path-outside-vault" };
    }
    try {
      ensureParentDir(planned.plan.originalBackupPath);
      fsMod.copyFileSync(record.filePath, planned.plan.originalBackupPath);
      record.version = version;
      record.lastBackupAt = now();
      record.lastBackupSourceMtimeMs = source.stat.mtimeMs;
      record.lastBackupSourceSize = source.stat.size;
      record.latestBackupPath = planned.plan.originalBackupPath;
      record.latestValidationPath = planned.plan.validationCopyPath;
      record.backupFolder = planned.plan.folder;
      record.latestHealthy = false;
      backupsCreated += 1;
      lastBackupAt = record.lastBackupAt;
      pushEvent("backup-created", { app: record.app, label: publicDoc(record).label, result: reason });
      logSafe(`Created local backup for a ${record.app} document.`);
      applyRetention(record);
      return { ok: true, record };
    } catch (error) {
      lastError = cleanError(error);
      pushEvent("backup-failed", { app: record.app, label: publicDoc(record).label, result: lastError });
      logSafe(`Office backup failed (${lastError}).`);
      return { ok: false, reason: lastError };
    } finally {
      emitChanged();
    }
  }

  function validationCopyPath(record) {
    const planned = planOfficeBackupSet({
      filePath: record.filePath,
      userSid: config.userSid,
      documentId: record.id,
      root: config.backupRoot,
      timestamp: now(),
      version: Math.max(1, record.version || 1),
      pathImpl: pathMod
    });
    return planned.ok ? planned.plan.validationCopyPath : record.latestValidationPath;
  }

  function validateDocument(record, reason = "interval") {
    if (!record.latestBackupPath) return { ok: false, reason: "no-backup" };
    let sourceStat = null;
    try { sourceStat = fsMod.statSync(record.filePath); } catch { sourceStat = null; }
    const copyPath = validationCopyPath(record);
    try {
      if (!isPathInside(pathMod, config.backupRoot, copyPath)) {
        return { ok: false, reason: "validation-path-outside-vault" };
      }
      ensureParentDir(copyPath);
      fsMod.copyFileSync(record.latestBackupPath, copyPath);
      const probe = validateOfficeBackupCopy(copyPath, { fs: fsMod, path: pathMod });
      const verdict = evaluateBackupValidation({
        validationCopyOpened: probe.validationCopyOpened,
        packageReadable: probe.packageReadable,
        previousKnownGood: record.latestKnownGoodPath ? { id: record.latestKnownGoodPath } : null,
        attempts: reason === "validation-failed-retry" ? 2 : 1
      });
      record.latestValidationPath = copyPath;
      record.lastValidatedAt = now();
      lastValidationAt = record.lastValidatedAt;
      if (verdict.healthy) {
        record.latestHealthy = true;
        record.latestKnownGoodPath = record.latestBackupPath;
        validationsPassed += 1;
        lastError = "";
        pushEvent("validation-passed", { app: record.app, label: publicDoc(record).label, result: "renamed-copy-opened" });
        logSafe(`Validated latest backup for a ${record.app} document.`);
        emitChanged();
        return { ok: true, record };
      }
      validationFailures += 1;
      record.latestHealthy = false;
      pushEvent("validation-failed", { app: record.app, label: publicDoc(record).label, result: probe.reason || verdict.status });
      logSafe(`Backup validation failed for a ${record.app} document; creating a fresh backup.`);
      if (sourceStat) backupDocument(record, sourceStat, "validation-failed-retry");
      emitChanged();
      return { ok: false, reason: probe.reason || verdict.status, retried: Boolean(sourceStat) };
    } catch (error) {
      lastError = cleanError(error);
      validationFailures += 1;
      record.latestHealthy = false;
      pushEvent("validation-error", { app: record.app, label: publicDoc(record).label, result: lastError });
      if (sourceStat) backupDocument(record, sourceStat, "validation-error-retry");
      emitChanged();
      return { ok: false, reason: lastError, retried: Boolean(sourceStat) };
    }
  }

  function backupDue(record, stat) {
    if (!record.lastBackupAt) return true;
    const intervalDue = now() - record.lastBackupAt >= config.backupIntervalMs;
    const changed = stat && (stat.mtimeMs !== record.lastBackupSourceMtimeMs || stat.size !== record.lastBackupSourceSize);
    return intervalDue || (changed && intervalDue);
  }

  function validationDue(record) {
    return Boolean(record.latestBackupPath) && (!record.lastValidatedAt || now() - record.lastValidatedAt >= config.validationIntervalMs);
  }

  function scanDirectory(root) {
    const candidates = [];
    const cutoff = now() - config.activeWindowMs;
    const stack = [{ dir: root, depth: 0 }];
    let visitedFiles = 0;
    let visitedDirs = 0;
    while (stack.length && visitedFiles < config.maxFilesPerScan && visitedDirs < config.maxDirectoriesPerScan) {
      const { dir, depth } = stack.pop();
      visitedDirs += 1;
      if (isPathInside(pathMod, config.backupRoot, dir)) continue;
      let entries = [];
      try { entries = fsMod.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        const fullPath = pathMod.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (depth >= config.maxScanDepth) continue;
          if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
          stack.push({ dir: fullPath, depth: depth + 1 });
          continue;
        }
        if (!entry.isFile()) continue;
        visitedFiles += 1;
        if (!isSupportedOfficeFile(fullPath) || officeFileIsTemporary(pathMod, fullPath)) continue;
        let stat = null;
        try { stat = fsMod.statSync(fullPath); } catch { continue; }
        if (!stat.isFile() || stat.size <= 0 || stat.size > config.maxFileBytes) continue;
        if (stat.mtimeMs < cutoff && !docs.has(hashId(pathMod.resolve(fullPath).toLowerCase()))) continue;
        candidates.push({ filePath: fullPath, stat });
        if (candidates.length >= config.maxFilesPerScan) break;
      }
    }
    return candidates;
  }

  function scanNow() {
    if (!config.enabled) {
      running = false;
      return { ok: true, status: status() };
    }
    try {
      fsMod.mkdirSync(config.backupRoot, { recursive: true });
      const candidates = [];
      for (const root of config.watchRoots) {
        let stat = null;
        try { stat = fsMod.statSync(root); } catch { continue; }
        if (!stat.isDirectory()) continue;
        candidates.push(...scanDirectory(root));
        if (candidates.length >= config.maxFilesPerScan) break;
      }
      candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      for (const candidate of candidates.slice(0, config.maxFilesPerScan)) {
        const record = trackDocument(candidate.filePath, candidate.stat);
        if (backupDue(record, candidate.stat)) backupDocument(record, candidate.stat, "scan");
        if (validationDue(record)) validateDocument(record, "scan");
      }
      lastScanAt = now();
      lastError = "";
      pushEvent("scan-complete", { result: `${candidates.length} candidate(s)` });
      emitChanged();
      return { ok: true, status: status() };
    } catch (error) {
      lastError = cleanError(error);
      pushEvent("scan-failed", { result: lastError });
      logSafe(`Office Safety scan failed (${lastError}).`);
      emitChanged();
      return { ok: false, error: lastError, status: status() };
    }
  }

  function backupNow(filePath) {
    try {
      const allowed = sourceAllowed(filePath);
      if (!allowed.ok) return { ok: false, error: allowed.reason, status: status() };
      const record = trackDocument(filePath, allowed.stat);
      const backup = backupDocument(record, allowed.stat, "manual");
      if (backup.ok) validateDocument(record, "manual");
      return { ok: backup.ok, error: backup.ok ? "" : backup.reason, status: status() };
    } catch (error) {
      lastError = cleanError(error);
      return { ok: false, error: lastError, status: status() };
    }
  }

  function registerFile(filePath) {
    return backupNow(filePath);
  }

  function stop() {
    if (timer) clearIntervalFn(timer);
    timer = null;
    running = false;
    emitChanged();
    return { ok: true, status: status() };
  }

  function start(nextConfig = {}) {
    config = normalizeOfficeSafetyConfig({ ...config, ...nextConfig }, { path: pathMod, os: osMod, env: options.env || process.env });
    if (timer) clearIntervalFn(timer);
    timer = null;
    running = Boolean(config.enabled);
    if (!config.enabled) return { ok: true, status: status() };
    timer = setIntervalFn(() => {
      try { scanNow(); } catch (error) { lastError = cleanError(error); emitChanged(); }
    }, config.scanIntervalMs);
    timer?.unref?.();
    const first = scanNow();
    return { ok: first.ok, status: status() };
  }

  function configure(nextConfig = {}) {
    return start({ ...config, ...nextConfig });
  }

  return {
    start,
    stop,
    configure,
    status,
    scanNow,
    backupNow,
    registerFile,
    validateOfficeBackupCopy: (filePath) => validateOfficeBackupCopy(filePath, { fs: fsMod, path: pathMod })
  };
}
