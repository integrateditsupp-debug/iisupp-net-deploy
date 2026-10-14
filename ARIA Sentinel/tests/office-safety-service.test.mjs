// JULY PORT 2026-10-14 (af5e03ab · 24a33108, cc/security-lockdown-2026-07-01) — the live Office File Safety Net service
// on a temp tree: 2 min backups, 3 min renamed-copy validation, corrupt-package retry, path-blind status, clean stop.
// ADAPTED to the production line: OPT-IN (store default off; launch starts nothing unless the person turned it on), the
// excluded-folder guard (path-guard.mjs) on every root / directory / file / manual path, and the Integrations panel.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOfficeSafetyService,
  validateOfficeBackupCopy
} from "../src/main/office-safety-service.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

function read(...parts) {
  return fs.readFileSync(path.join(appRoot, ...parts), "utf8");
}

function fakeOpenXml() {
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("aria sentinel test workbook"),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.alloc(18)
  ]);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aria-office-safety-"));
try {
  const docs = path.join(tmp, "docs");
  const backups = path.join(tmp, "backups");
  fs.mkdirSync(docs, { recursive: true });
  fs.mkdirSync(backups, { recursive: true });

  const workbook = path.join(docs, "Budget.xlsx");
  fs.writeFileSync(workbook, fakeOpenXml());
  // 🔒 an Office file INSIDE the excluded folder (by name) must never be listed, read, copied or counted.
  const privateDir = path.join(docs, PRIVATE_FOLDER_NAME);
  fs.mkdirSync(privateDir, { recursive: true });
  const privateDoc = path.join(privateDir, "Secret.xlsx");
  fs.writeFileSync(privateDoc, fakeOpenXml());

  let current = Date.parse("2026-07-04T12:00:00.000Z");
  const timers = [];
  const service = createOfficeSafetyService({
    fs,
    path,
    os,
    now: () => current,
    setInterval: (fn, ms) => {
      const timer = { fn, ms, active: true, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearInterval: (timer) => { timer.active = false; },
    log: () => {},
    config: {
      enabled: true,
      watchRoots: [docs],
      backupRoot: backups,
      userSid: "test-user",
      backupIntervalMs: 2 * 60 * 1000,
      validationIntervalMs: 3 * 60 * 1000,
      scanIntervalMs: 1000,
      activeWindowMs: 24 * 60 * 60 * 1000,
      maxScanDepth: 2,
      maxFilesPerScan: 20
    }
  });

  const first = service.start();
  assert.equal(first.ok, true, "service starts and runs first scan");
  assert.equal(timers.length, 1, "service owns one scan timer");
  assert.equal(first.status.filesTracked, 1, "ONE Office document tracked — the one inside the excluded folder is invisible");
  assert.equal(first.status.backupsCreated, 1, "first backup created");
  assert.equal(first.status.validationsPassed, 1, "first backup validated through renamed copy");
  assert.ok(first.status.excludedFolderSkips >= 1, "the excluded-folder skip is counted (a count, never a name)");
  assert.equal(first.status.safeContract.validationUsesRenamedCopy, true);
  assert.equal(first.status.safeContract.launchesOffice, false, "validation does not launch Office");
  assert.equal(first.status.safeContract.macrosRun, false, "validation never runs macros");
  assert.doesNotMatch(JSON.stringify(first.status), /Budget|aria-office-safety|Corrupt|Secret/i, "public status stays content-blind/path-blind");
  assert.doesNotMatch(JSON.stringify(first.status), new RegExp(PRIVATE_FOLDER_NAME.replace(/\s+/g, "\\s+"), "i"), "the excluded folder's name never surfaces");

  const filesAfterFirst = walk(backups).map((f) => path.basename(f));
  assert.ok(filesAfterFirst.some((f) => f.includes("__ARIA_BACKUP__")), "backup artifact exists");
  assert.ok(filesAfterFirst.some((f) => f.includes("__ARIA_VALIDATE__")), "validation artifact exists");
  assert.ok(!filesAfterFirst.some((f) => /Secret/.test(f)), "nothing from the excluded folder was copied into the vault");
  assert.equal(validateOfficeBackupCopy(walk(backups).find((f) => f.includes("__ARIA_VALIDATE__")), { fs, path }).ok, true, "validation copy is readable");

  current += 2 * 60 * 1000;
  const second = service.scanNow();
  assert.equal(second.status.backupsCreated, 2, "backup cadence creates another backup at 2 minutes");
  assert.equal(second.status.validationsPassed, 1, "3-minute validation cadence has not fired yet");

  current += 60 * 1000;
  const third = service.scanNow();
  assert.equal(third.status.validationsPassed, 2, "latest backup validates at 3 minutes");

  const corrupt = path.join(docs, "Corrupt.docx");
  fs.writeFileSync(corrupt, Buffer.from("not a zip package"));
  const failed = service.backupNow(corrupt);
  assert.equal(failed.status.validationFailures >= 1, true, "corrupt OpenXML validation is recorded");
  assert.equal(failed.status.backupsCreated >= 4, true, "failed validation triggers a fresh backup retry");
  assert.ok(failed.status.recentEvents.some((e) => e.type === "validation-failed"), "retry reason is visible without content");

  // 🔒 a manual path inside the excluded folder is refused by name, never read.
  const refused = service.backupNow(privateDoc);
  assert.equal(refused.ok, false);
  assert.equal(refused.error, "excluded-folder", "manual backup of an excluded-folder file is refused");
  assert.ok(!walk(backups).some((f) => /Secret/.test(f)), "…and nothing was copied");

  const stopped = service.stop();
  assert.equal(stopped.status.running, false, "service stops cleanly");
  assert.equal(timers[0].active, false, "timer cleared on stop");

  // 🔒 a vault inside the excluded folder is refused outright.
  const badVault = createOfficeSafetyService({ fs, path, os, log: () => {}, setInterval: () => ({ unref() {} }), clearInterval: () => {}, config: { enabled: true, watchRoots: [docs], backupRoot: path.join(tmp, PRIVATE_FOLDER_NAME, "vault"), scanIntervalMs: 1000 } });
  const badStart = badVault.start();
  assert.equal(badStart.ok, false); assert.equal(badStart.error, "excluded-folder"); assert.equal(badStart.status.running, false);

  // a disabled config never scans (opt-in contract)
  const off = createOfficeSafetyService({ fs, path, os, log: () => {}, setInterval: () => { throw new Error("must not arm a timer while off"); }, clearInterval: () => {}, config: { enabled: false, watchRoots: [docs], backupRoot: backups } });
  const offStart = off.start();
  assert.equal(offStart.ok, true); assert.equal(offStart.status.running, false); assert.equal(offStart.status.enabled, false);

  const main = read("src", "main", "main.mjs");
  const preload = read("src", "main", "preload.cjs");
  const renderer = read("src", "renderer", "renderer.js");
  const html = read("src", "renderer", "index.html");
  const css = read("src", "renderer", "sentinel.css");
  assert.match(main, /createOfficeSafetyService/, "main imports the Office Safety service");
  assert.match(main, /sentinel:office-safety-status/, "main exposes status IPC");
  assert.match(main, /sentinel:office-safety-set-enabled/, "main exposes enable IPC");
  assert.match(main, /sentinel:office-safety-scan/, "main exposes scan IPC");
  assert.match(main, /startOfficeSafety\(\); \/\/ JULY PORT/, "main calls startOfficeSafety on app ready");
  assert.match(main, /officeSafety: \{ enabled: false \}/, "OPT-IN: the store default is off");
  assert.match(main, /enabled: saved\.enabled === true, \/\/ opt-in/, "only an explicit true runs the scanner");
  assert.match(main, /if \(!cfg\.enabled\) return \{ ok: true, status: officeSafetyStatus\(\), skipped: "opt-in" \};/, "launch starts nothing while off");
  assert.match(main, /if \(isBlockedPath\(filePath\)\) \{[\s\S]*?r11AuditEntry\("office-safety-register"\)/, "a manual path inside an excluded folder is refused + audited through the existing guard");
  assert.match(main, /wanted\.filter\(\(root\) => !isBlockedPath\(root\)\)/, "watch roots pass the existing guard in main too");
  assert.match(main, /officeSafety: officeSafetyStatus\(\)/, "getState carries the path-blind status");
  assert.match(main, /officeSafetyService\.stop\(\)/, "the service is stopped on quit");
  assert.match(preload, /officeSafetyStatus:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:office-safety-status"\)/, "preload exposes status");
  assert.match(preload, /scanOfficeSafety:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:office-safety-scan"\)/, "preload exposes scan");
  assert.match(renderer, /loadOfficeSafety/, "renderer lazy-loads Office Safety panel");
  assert.match(renderer, /renderOfficeSafety\(state\.officeSafety\)/, "state broadcasts refresh Office Safety panel");
  assert.match(renderer, /Off — turn it on above/, "the panel says plainly when it is off (never a fake Healthy)");
  assert.match(html, /Office Safety Net/, "Integrations tab contains Office Safety panel");
  assert.match(html, /Off until you turn it on\./, "the panel copy states the opt-in");
  assert.match(css, /\.office-safety-toggle/, "Office Safety toggle is styled");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("Office Safety live service test passed (2m/3m cadence · renamed-copy validation · corrupt retry · excluded-folder guard on roots/dirs/files/manual/vault · opt-in · path-blind status · wiring).");
