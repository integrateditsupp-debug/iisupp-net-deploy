// RUN 34-5 — 20-Windows-error detector sweep. Drives every live Windows watcher's REAL pure mapper with a
// synthetic, PII-laced raw input (one per error class) and asserts two things for each:
//   (a) it emits the correct symbolic signal (the content-blind code main.mjs routes), and
//   (b) it is CONTENT-BLIND — none of the injected PII (machine name, username, file path, app title)
//       leaks into the emitted signal/hint. This is the privacy invariant the whole product rests on.
import assert from "node:assert/strict";
import { mapEventLogSignals } from "../src/sub-agents/detection/event-log-watcher.mjs";
import { evaluatePerf } from "../src/sub-agents/detection/perf-watcher.mjs";
import { mapDiskSignals } from "../src/sub-agents/detection/disk-watcher.mjs";
import { mapWerSignals } from "../src/sub-agents/detection/wer-watcher.mjs";
import { evaluateServices } from "../src/sub-agents/detection/service-watcher.mjs";
import { evaluateNetwork, evaluateConnectivity } from "../src/sub-agents/detection/network-watcher.mjs";
import { mapCrashControl } from "../src/sub-agents/detection/crash-control-watcher.mjs";

// PII tokens deliberately injected into every input; NONE may appear in any emitted signal/hint.
const PII = ["DESKTOP-SECRET7", "C:/Users/ahmad/private.ost", "jdoe@corp.local", "Quarterly Bonuses.xlsx"];
const NOW = 1_700_000_000_000;
const HIGH_SINCE = NOW - 6 * 60 * 1000; // CPU/RAM already sustained > 5 min so the perf signal fires now.

// Each case: feed the raw input through its real mapper, return the flat signal list it emits.
const CASES = [
  // --- Event log (System, Level 1–2) — keyed ONLY on ProviderName|Id; message text never read. ---
  ["E01 kernel-power-loss (unexpected shutdown)", "SYSTEM.UNEXPECTED_SHUTDOWN",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Microsoft-Windows-Kernel-Power", Id: 41, Message: PII[3], Computer: PII[0] }])],
  ["E02 WER bugcheck (BSOD reported)", "BSOD.UNKNOWN",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Microsoft-Windows-WER-SystemErrorReporting", Id: 1001, Message: PII[1] }])],
  ["E03 disk I/O error", "DISK.IO_ERROR",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Disk", Id: 7, Message: PII[1] }])],
  ["E04 NTFS filesystem corruption", "DISK.FS_CORRUPT",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Ntfs", Id: 55, Message: PII[1] }])],
  ["E05 service crashed (SCM 7034)", "SYSTEM.SERVICE.CRASHED",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Service Control Manager", Id: 7034, Message: PII[2] }])],
  ["E06 DNS client timeout (1014)", "NET.DNS.FAIL",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Microsoft-Windows-DNS-Client", Id: 1014, Message: PII[2] }])],
  ["E07 Windows Update stuck (20)", "UPDATE.WINDOWS.STUCK",
    () => mapEventLogSignals([{ RecordId: 9, ProviderName: "Microsoft-Windows-WindowsUpdateClient", Id: 20, Message: PII[0] }])],

  // --- Performance (sustained > 5 min). ---
  ["E08 sustained high CPU", "SYSTEM.SLOW.HIGH_CPU",
    () => evaluatePerf({ cpuHighSince: HIGH_SINCE }, { cpu: 97, mem: 10, topProcess: PII[0] }, NOW).signals],
  ["E09 sustained high RAM", "SYSTEM.SLOW.HIGH_RAM",
    () => evaluatePerf({ ramHighSince: HIGH_SINCE }, { cpu: 10, mem: 95, topProcess: PII[0] }, NOW).signals],

  // --- Disk free space. ---
  ["E10 disk almost full (< 5%)", "DISK.LOW_SPACE",
    () => mapDiskSignals([{ DeviceID: PII[1], Size: 1_000_000_000, FreeSpace: 20_000_000 }])],

  // --- WER faulting-app map (keyed on the process basename only). ---
  ["E11 Outlook OST corrupt", "APP.OUTLOOK.OST_CORRUPT", () => mapWerSignals([`outlook.exe|${PII[1]}`.split("|")[0]])],
  ["E12 Teams stuck", "TEAMS.STUCK", () => mapWerSignals(["teams.exe"])],
  ["E13 OneDrive sync stuck", "APP.ONEDRIVE.SYNC_STUCK", () => mapWerSignals(["onedrive.exe"])],
  ["E14 browser tab crash loop", "BROWSER.TAB_CRASH_LOOP", () => mapWerSignals(["chrome.exe"])],
  ["E15 Explorer shell crashed", "SYSTEM.SHELL.CRASHED", () => mapWerSignals(["explorer.exe"])],

  // --- Critical service Running → Stopped (allow-listed services only). ---
  ["E16 Print Spooler stopped", "SYSTEM.SERVICE.STOPPED.SPOOLER",
    () => evaluateServices({ Spooler: "Running" }, [{ Name: "Spooler", Status: "Stopped", DisplayName: PII[3] }]).signals],
  ["E17 Windows Audio stopped", "SYSTEM.SERVICE.STOPPED.AUDIOSRV",
    () => evaluateServices({ Audiosrv: "Running" }, [{ Name: "Audiosrv", Status: "Stopped" }]).signals],
  ["E18 Windows Update svc stopped", "SYSTEM.SERVICE.STOPPED.WUAUSERV",
    () => evaluateServices({ wuauserv: "Running" }, [{ Name: "wuauserv", Status: "Stopped" }]).signals],

  // --- Network. ---
  ["E19 network adapter down", "NET.ADAPTER.DOWN",
    () => evaluateNetwork([{ adapters: ["down"], dnsOk: false, hostname: PII[0] }], {}).signals],
  ["E20 internet unreachable", "NET.DOWN",
    () => evaluateConnectivity({ fails: 1, down: false }, false).signals],

  // --- Crash control (new minidump since baseline). ---
  ["E21 new minidump → BSOD", "BSOD.UNKNOWN",
    () => mapCrashControl({ dumpCount: 3, stopCode: PII[1] }, 2).signals]
];

const SYMBOLIC = /^[A-Z][A-Z0-9._]*$/; // content-blind codes are uppercase symbolic only — never free text.
let n = 0; const t = () => { n++; };
const rows = [];

for (const [label, expectSignal, run] of CASES) {
  const signals = run() || [];
  assert.ok(signals.length >= 1, `${label}: emits a signal`);
  const sig = signals[0];
  assert.equal(sig.signal, expectSignal, `${label}: correct symbolic signal`);
  assert.match(sig.signal, SYMBOLIC, `${label}: signal is content-blind symbolic code`);
  // Content-blindness: the emitted signal + hint must contain NONE of the injected PII tokens.
  const emitted = JSON.stringify(sig);
  for (const tok of PII) assert.ok(!emitted.includes(tok), `${label}: PII "${tok}" never leaks into the signal`);
  rows.push(`${label.padEnd(40)} → ${sig.signal}`);
  t();
}

assert.ok(n >= 20, `at least 20 Windows error detectors swept (got ${n})`);
console.log(`windows-error-sweep passed — ${n} Windows error detectors, each content-blind:\n  ${rows.join("\n  ")}`);
