// RUN 21 §3 — startup registration: HKCU Run key + at-logon Task (belt + suspenders). HKCU ONLY (never
// HKLM → no admin elevation). Self-heals when an entry goes missing. R11-guarded.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registryRunEntry, taskDefinition, needsHeal, tamperSignal, safeStartupItems, RUN_KEY, RUN_VALUE_NAME, TASK_NAME, TASK_LOGON_DELAY_SECONDS } from "../src/main/startup-registrar.mjs";

const exe = "C:\\Program Files\\ARIA Sentinel\\ARIA-Sentinel.exe";

// Registry entry: HKCU ONLY, named ARIASentinel, value points at the exe with --startup.
const reg = registryRunEntry(exe);
assert.equal(reg.hive, "HKCU", "registry hive is HKCU (per-user, no elevation)");
assert.match(reg.key, /^HKCU\\/, "run key under HKCU");
assert.equal(reg.name, "ARIASentinel");
assert.match(reg.value, /--startup/, "value launches with --startup");
assert.equal(RUN_VALUE_NAME, "ARIASentinel");
assert.match(RUN_KEY, /^HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run$/);

// The module never references HKLM (would require admin elevation post-install).
const src = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "startup-registrar.mjs"), "utf8");
assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /HKLM/, "registrar never writes HKLM");

// Task: at-logon, 30s delay, limited (never elevated).
const task = taskDefinition(exe);
assert.equal(task.name, TASK_NAME);
assert.equal(task.trigger, "AtLogon");
assert.equal(task.delaySeconds, 30);
assert.equal(TASK_LOGON_DELAY_SECONDS, 30);
assert.equal(task.runLevel, "limited");

// needsHeal: re-register if EITHER entry is missing.
assert.equal(needsHeal({ registry: true, task: true }), false);
assert.equal(needsHeal({ registry: true, task: false }), true);
assert.equal(needsHeal({ registry: false, task: false }), true);

// tamperSignal: BOTH missing AND last-seen >24h ago.
const now = Date.parse("2026-07-05T00:00:00.000Z");
assert.equal(tamperSignal({ registry: false, task: false }, new Date(now - 25 * 3600e3).toISOString(), now), true);
assert.equal(tamperSignal({ registry: false, task: false }, new Date(now - 1 * 3600e3).toISOString(), now), false, "<24h heals silently");
assert.equal(tamperSignal({ registry: true, task: false }, new Date(now - 25 * 3600e3).toISOString(), now), false, "single missing is not tamper");

// 🔒 R11 — registering a private-folder exe path is blocked.
assert.throws(() => registryRunEntry("D:\\Private pics and Vids\\evil.exe"), /R11_BLOCKED/);
assert.throws(() => taskDefinition("D:\\private pics and vids\\x.exe"), /R11_BLOCKED/);

// safeStartupItems drops any startup entry inside the private folder.
const filtered = safeStartupItems([{ command: "C:\\app.exe" }, { command: "E:\\Private Pics and Vids\\run.exe" }]);
assert.equal(filtered.length, 1);

console.log("Startup-registrar test passed (HKCU only · at-logon 30s delay · heal-on-missing · R11-blocked).");
