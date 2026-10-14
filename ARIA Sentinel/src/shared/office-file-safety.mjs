// office-file-safety - pure planning helpers for ARIA's Office File Safety Net.
//
// This module does not open Office or copy user files. It defines the safe contract the endpoint
// service must follow: supported extensions, 2-minute backup cadence, 3-minute validation cadence,
// unique two-layer names, validation-copy-only checks, retry signals, and retention planning.
import path from "node:path";
import { createHash } from "node:crypto";

export const OFFICE_BACKUP_INTERVAL_MS = 2 * 60 * 1000;
export const OFFICE_VALIDATION_INTERVAL_MS = 3 * 60 * 1000;
export const DEFAULT_OFFICE_BACKUP_ROOT = "C:\\ProgramData\\ARIA Sentinel\\RescueBackups";

export const OFFICE_EXTENSIONS = Object.freeze({
  word: [".doc", ".docx", ".docm", ".dotx", ".dotm"],
  excel: [".xls", ".xlsx", ".xlsm", ".xlsb", ".xltx", ".xltm"],
  powerpoint: [".ppt", ".pptx", ".pptm", ".potx", ".potm"]
});

const OPEN_XML_EXTENSIONS = new Set([".docx", ".docm", ".dotx", ".dotm", ".xlsx", ".xlsm", ".xltx", ".xltm", ".pptx", ".pptm", ".potx", ".potm"]);
const MACRO_EXTENSIONS = new Set([".docm", ".dotm", ".xlsm", ".xltm", ".pptm", ".potm"]);
const ALL_OFFICE_EXTENSIONS = new Set(Object.values(OFFICE_EXTENSIONS).flat());

function extOf(filePath) {
  return path.extname(String(filePath || "")).toLowerCase();
}

export function officeAppForFile(filePath) {
  const ext = extOf(filePath);
  for (const [app, exts] of Object.entries(OFFICE_EXTENSIONS)) {
    if (exts.includes(ext)) return app;
  }
  return null;
}

export function isSupportedOfficeFile(filePath) {
  return ALL_OFFICE_EXTENSIONS.has(extOf(filePath));
}

export function officeBackupVersion(n) {
  const value = Math.max(1, Math.floor(Number(n) || 1));
  return String(value).padStart(3, "0");
}

export function formatOfficeBackupTimestamp(value) {
  const d = new Date(value == null ? Date.now() : value);
  if (!Number.isFinite(d.getTime())) throw new Error("invalid-backup-timestamp");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function safeBaseName(filePath) {
  // Cross-platform: strip any Windows (\) OR POSIX (/) directory prefix BEFORE parsing,
  // so "C:\Work\Budget.xlsx" and "/home/u/Budget.xlsx" both reduce to "Budget" regardless
  // of which `path` flavor is active. Without this, POSIX path.parse keeps the whole
  // "C:\Work\Budget" as the name and sanitizing ':' + '\' yields "C__Work_Budget".
  const leaf = String(filePath || "").split(/[\\/]/).pop() || "";
  const parsed = path.parse(leaf);
  return (parsed.name || "Untitled").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120);
}

function docKey(filePath, documentId) {
  const src = String(documentId || filePath || "unsaved-office-document");
  return createHash("sha256").update(src).digest("hex").slice(0, 24);
}

export function buildOfficeBackupNames({ filePath, timestamp = Date.now(), version = 1 } = {}) {
  if (!isSupportedOfficeFile(filePath)) return { ok: false, errors: ["unsupported-office-file"] };
  const ext = extOf(filePath);
  const stamp = formatOfficeBackupTimestamp(timestamp);
  const versionText = officeBackupVersion(version);
  const base = safeBaseName(filePath);
  return {
    ok: true,
    errors: [],
    originalBackupName: `${base}__ARIA_BACKUP__${stamp}__v${versionText}${ext}`,
    validationCopyName: `${base}__ARIA_VALIDATE__${stamp}__v${versionText}${ext}`
  };
}

export function planOfficeBackupSet({
  filePath,
  userSid = "unknown-user",
  documentId = "",
  root = DEFAULT_OFFICE_BACKUP_ROOT,
  timestamp = Date.now(),
  version = 1,
  // Windows-only in production (Sentinel is a Windows desktop agent) so paths default to win32.
  // Injectable so the service can pass the SAME path module it uses for isPathInside — otherwise a
  // posix host (tests/CI) builds a win32 path the posix isPathInside rejects as outside-vault.
  pathImpl = path.win32
} = {}) {
  const names = buildOfficeBackupNames({ filePath, timestamp, version });
  if (!names.ok) return { ok: false, errors: names.errors, plan: null };

  const app = officeAppForFile(filePath);
  const folder = pathImpl.join(root, String(userSid || "unknown-user"), docKey(filePath, documentId));
  const originalBackupPath = pathImpl.join(folder, names.originalBackupName);
  const validationCopyPath = pathImpl.join(folder, names.validationCopyName);
  const ext = extOf(filePath);

  return {
    ok: true,
    errors: [],
    plan: {
      schema: "office-backup-plan.v1",
      app,
      liveFilePath: String(filePath || ""),
      folder,
      originalBackupPath,
      validationCopyPath,
      backupIntervalMs: OFFICE_BACKUP_INTERVAL_MS,
      validationIntervalMs: OFFICE_VALIDATION_INTERVAL_MS,
      validateLiveFile: false,
      validationUsesRenamedCopy: true,
      twoLayerBackup: true,
      macrosAllowedDuringValidation: false,
      openXmlPackageValidation: OPEN_XML_EXTENSIONS.has(ext),
      macroEnabled: MACRO_EXTENSIONS.has(ext),
      retention: { keepLatestKnownGood: true, maxVersionsPerDocument: 120 }
    }
  };
}

export function evaluateBackupValidation({
  validationCopyOpened,
  packageReadable,
  previousKnownGood = null,
  attempts = 1
} = {}) {
  const ok = validationCopyOpened === true && packageReadable !== false;
  if (ok) {
    return {
      healthy: true,
      needsRetry: false,
      preservePreviousKnownGood: Boolean(previousKnownGood),
      status: "healthy",
      warning: ""
    };
  }
  return {
    healthy: false,
    needsRetry: true,
    preservePreviousKnownGood: true,
    status: Number(attempts) > 1 ? "validation-retry-failed" : "validation-failed-retry-required",
    warning: "Latest validation copy failed. Keep the previous known-good backup and create a new backup set."
  };
}

export function shouldBackupBeforeAutonomousEdit({ filePath, willModify = true } = {}) {
  return willModify === true && isSupportedOfficeFile(filePath);
}

export function retentionPlan(backups = [], { maxVersions = 120, keepLatestKnownGood = true } = {}) {
  const rows = Array.isArray(backups) ? backups.slice() : [];
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const keep = new Set(rows.slice(0, Math.max(1, Number(maxVersions) || 120)).map((b) => b.id));
  if (keepLatestKnownGood) {
    const good = rows.find((b) => b.healthy === true || b.status === "healthy");
    if (good && good.id) keep.add(good.id);
  }
  return rows.map((b) => ({ ...b, retain: keep.has(b.id), deleteCandidate: !keep.has(b.id) }));
}
