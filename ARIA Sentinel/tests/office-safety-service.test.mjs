import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOfficeSafetyService,
  validateOfficeBackupCopy
} from "../src/main/office-safety-service.mjs";

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
  assert.equal(first.status.filesTracked, 1, "Office document tracked");
  assert.equal(first.status.backupsCreated, 1, "first backup created");
  assert.equal(first.status.validationsPassed, 1, "first backup validated through renamed copy");
  assert.equal(first.status.safeContract.validationUsesRenamedCopy, true);
  assert.equal(first.status.safeContract.launchesOffice, false, "validation does not launch Office");
  assert.equal(first.status.safeContract.macrosRun, false, "validation never runs macros");
  assert.doesNotMatch(JSON.stringify(first.status), /Budget|aria-office-safety|Corrupt/i, "public status stays content-blind/path-blind");

  const filesAfterFirst = walk(backups).map((f) => path.basename(f));
  assert.ok(filesAfterFirst.some((f) => f.includes("__ARIA_BACKUP__")), "backup artifact exists");
  assert.ok(filesAfterFirst.some((f) => f.includes("__ARIA_VALIDATE__")), "validation artifact exists");
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

  const stopped = service.stop();
  assert.equal(stopped.status.running, false, "service stops cleanly");
  assert.equal(timers[0].active, false, "timer cleared on stop");

  const main = read("src", "main", "main.mjs");
  const preload = read("src", "main", "preload.cjs");
  const renderer = read("src", "renderer", "renderer.js");
  const html = read("src", "renderer", "index.html");
  const css = read("src", "renderer", "sentinel.css");
  assert.match(main, /createOfficeSafetyService/, "main imports the Office Safety service");
  assert.match(main, /sentinel:office-safety-status/, "main exposes status IPC");
  assert.match(main, /sentinel:office-safety-set-enabled/, "main exposes enable IPC");
  assert.match(main, /startOfficeSafety\(\)/, "main starts Office Safety on app ready");
  assert.match(preload, /officeSafetyStatus:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:office-safety-status"\)/, "preload exposes status");
  assert.match(preload, /scanOfficeSafety:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("sentinel:office-safety-scan"\)/, "preload exposes scan");
  assert.match(renderer, /loadOfficeSafety/, "renderer lazy-loads Office Safety panel");
  assert.match(renderer, /renderOfficeSafety\(state\.officeSafety\)/, "state broadcasts refresh Office Safety panel");
  assert.match(html, /Office Safety Net/, "Integrations tab contains Office Safety panel");
  assert.match(css, /\.office-safety-toggle/, "Office Safety toggle is styled");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("Office Safety live service test passed.");
