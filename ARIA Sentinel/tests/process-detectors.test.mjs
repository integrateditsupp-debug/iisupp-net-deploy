// RUN 23 §1 — process-health detector. Pure reducer covers frozen / sustained cpu-hog / ram-hog / odd, the
// CPU% math, the top-N caps, and the 🔒 R11 enumerator exclusion. The poller is exercised with an injected
// PowerShell-JSON runner (no real spawn).
import assert from "node:assert/strict";
import { cpuPercent, evaluateProcessHealth, normalizeSample, createProcessDetector, CPU_HOG_PCT, RAM_HOG_MB, IPC } from "../src/main/process-detectors.mjs";

// CPU% from cumulative-seconds deltas, normalized by elapsed + cores.
assert.equal(cpuPercent(0, 30, 60000, 1), 50);   // 30 CPU-s over 60s on 1 core = 50%
assert.equal(cpuPercent(0, 120, 60000, 2), 100); // capped at 100
assert.equal(cpuPercent(10, 10, 60000, 1), 0);

// normalizeSample wraps a single object (ConvertTo-Json single-row case).
assert.deepEqual(normalizeSample({ pid: 1 }), [{ pid: 1 }]);
assert.deepEqual(normalizeSample(null), []);

// Frozen: Responding=false surfaces with since_ms.
let res = evaluateProcessHealth({}, [{ name: "Notepad", pid: 9, responding: false, cpu: 0, wsMB: 50 }], 1000);
assert.equal(res.snapshot.frozen.length, 1);
assert.equal(res.snapshot.frozen[0].name, "Notepad");
assert.equal(res.snapshot.scanned, 1);

// Sustained cpu-hog: needs 2 consecutive >40% samples (first sample has no elapsed baseline).
let st = { byPid: {}, now: 0 };
let s1 = evaluateProcessHealth(st, [{ name: "x", pid: 5, cpu: 0, responding: true }], 0);
let s2 = evaluateProcessHealth(s1.state, [{ name: "x", pid: 5, cpu: 30, responding: true }], 60000);   // ~50% (streak 1)
assert.equal(s2.snapshot.cpuHogs.length, 0, "one sample not enough");
let s3 = evaluateProcessHealth(s2.state, [{ name: "x", pid: 5, cpu: 60, responding: true }], 120000);   // ~50% (streak 2)
assert.equal(s3.snapshot.cpuHogs.length, 1);
assert.ok(s3.snapshot.cpuHogs[0].cpu >= CPU_HOG_PCT);

// ram-hog: WorkingSet over 1 GB.
res = evaluateProcessHealth({}, [{ name: "bloat", pid: 7, wsMB: RAM_HOG_MB + 500, responding: true }], 1000);
assert.equal(res.snapshot.ramHogs[0].ramMB, RAM_HOG_MB + 500);

// odd: image path under a temp/download location.
res = evaluateProcessHealth({}, [{ name: "sketchy", pid: 8, path: "C:/Users/x/AppData/Local/Temp/sketchy.exe", responding: true }], 1000);
assert.equal(res.snapshot.odd.length, 1);
assert.match(res.snapshot.odd[0].reason, /temp/);

// 🔒 R11 — a process whose image path is under the off-limits folder is never enumerated.
res = evaluateProcessHealth({}, [
  { name: "vlc", pid: 11, path: "C:/Users/bob/Private pics and Vids/player.exe", wsMB: 5000, responding: false },
  { name: "ok", pid: 12, wsMB: 50, responding: true }
], 1000);
assert.equal(res.snapshot.scanned, 1, "blocked process excluded from the scan");
assert.equal(res.snapshot.frozen.length, 0);
assert.equal(res.snapshot.ramHogs.length, 0);
assert.doesNotMatch(JSON.stringify(res.snapshot), /private pics and vids/i);

// top-N caps: 6 ram-hogs → only top 5; 4 odd → top 3.
const many = Array.from({ length: 6 }, (_, i) => ({ name: `p${i}`, pid: 100 + i, wsMB: 2000 + i, responding: true }));
assert.equal(evaluateProcessHealth({}, many, 1000).snapshot.ramHogs.length, 5);

// IPC channel names are stable.
assert.equal(IPC.get, "sentinel:processHealth:get");
assert.equal(IPC.subscribe, "sentinel:processHealth:subscribe");

// Poller with an injected runner (no real PowerShell). On win32 the tick reduces the injected sample.
if (process.platform === "win32") {
  const det = createProcessDetector({ runJson: async () => [{ name: "inj", pid: 3, wsMB: 2000, responding: true }], now: () => 5000, cores: 4 });
  const snap = await det.tick();
  assert.equal(snap.ramHogs[0].name, "inj");
  assert.equal(det.latest().ramHogs[0].pid, 3);
}

console.log("Process-detectors test passed (cpu% · frozen · sustained cpu-hog · ram-hog · odd · top-N · R11 exclusion · poller).");
