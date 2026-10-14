// PROD 2026-10-14 (audit M8) — the agent must not become the problem: ≤ 6 powershell.exe spawns per minute.
//
// Before: ≈21 spawns/min for the life of the process (perf every 5 s = 12/min, network every 30 s × 2 probes =
// 4/min, process scan every 30 s = 2/min, service/event-log/WER each 1/min) — constant CPU/fan/battery use and a
// textbook EDR-alert pattern (frequent PowerShell from an unsigned Electron binary), plus DNS/TCP probes to
// third-party hosts every 30 s. Now: perf samples natively (os.cpus()/os.freemem(), no spawn), the network
// watcher probes the machine's own gateway/DNS once per 120 s, the process scan is 120 s, and inline commands run
// under -ExecutionPolicy Restricted. This suite sums the budget from the live factories and pins each change.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { WINDOWS_WATCHER_FACTORIES, spawnBudgetPerMinute, createDetectionOrchestrator } from "../src/sub-agents/detection/index.mjs";
import { createPerfWatcher, samplePerfNative, cpuTotals, evaluatePerf } from "../src/sub-agents/detection/perf-watcher.mjs";
import { createNetworkWatcher, buildNetworkQuery, NETWORK_CADENCE_MS, DEFAULT_DNS_PROBE_NAME, evaluateNetwork, evaluateConnectivity } from "../src/sub-agents/detection/network-watcher.mjs";
import { createProcessDetector, POLL_MS } from "../src/main/process-detectors.mjs";
import { runPowerShellJson, configurePowerShellRunner } from "../src/sub-agents/detection/ps.mjs";
import { sanitizePrefs } from "../src/shared/app-config.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
let groups = 0; const g = () => { groups++; };

// 1 — the Windows watcher set + the process scan together cost ≤ 6 spawns/min.
const watchers = WINDOWS_WATCHER_FACTORIES.map((f) => f({ emit: () => {}, isBlocked: () => false }));
const proc = createProcessDetector({ runJson: async () => null });
const budget = spawnBudgetPerMinute([...watchers, proc]);
assert.ok(budget.total <= 6, `≤ 6 spawns/min (got ${budget.total}: ${budget.rows.map((r) => `${r.name}=${r.perMinute}`).join(", ")})`);
assert.ok(budget.total >= 3, "the watchers still probe (not switched off to win the number)");
const byName = Object.fromEntries(budget.rows.map((r) => [r.name, r]));
assert.equal(byName.perf.spawnsPerTick, 0, "perf samples natively");
assert.equal(byName.network.cadenceMs, 120_000, "network every 120 s");
assert.equal(byName.network.spawnsPerTick, 1, "network = ONE probe per tick");
assert.equal(byName["process-health"].cadenceMs, 120_000, "process scan every 120 s");
assert.equal(POLL_MS, 120_000);
assert.equal(NETWORK_CADENCE_MS, 120_000);
// The orchestrator reports the same number in its status.
const orch = createDetectionOrchestrator({ detectIssue: () => {}, isBlocked: () => false, factories: WINDOWS_WATCHER_FACTORIES });
assert.ok(orch.status().spawnsPerMinute <= 4, "watcher-only budget ≤ 4/min");
g();

// 2 — perf: native sampling from an injected os facade; evaluatePerf unchanged.
const fakeOs = (busy, idle, total = 16e9, free = 4e9) => ({ cpus: () => [{ times: { user: busy, nice: 0, sys: 0, irq: 0, idle } }, { times: { user: busy, nice: 0, sys: 0, irq: 0, idle } }], totalmem: () => total, freemem: () => free });
let s = samplePerfNative(fakeOs(100, 900), null);
assert.equal(s.sample.cpu, null, "first sample has no CPU delta yet");
assert.equal(s.sample.mem, 75, "memory % from totalmem/freemem");
s = samplePerfNative(fakeOs(1000, 900), s.prev); // +900 busy, +0 idle per core
assert.equal(s.sample.cpu, 100, "CPU % from the busy/total delta");
s = samplePerfNative(fakeOs(1100, 1900), s.prev); // +100 busy, +1000 idle
assert.equal(s.sample.cpu, 9.1);
assert.deepEqual(cpuTotals([{ times: { user: 1, nice: 2, sys: 3, irq: 4, idle: 10 } }]), { busy: 10, total: 20 });
assert.deepEqual(samplePerfNative({ cpus: () => { throw new Error("x"); } }, null), { sample: null, prev: null }, "a throwing facade never throws out");
// The watcher drives the SAME evaluator: 5 min sustained ≥90 % CPU → one signal, nothing before.
let t = 0; const sigs = [];
const osHigh = { n: 0, cpus() { this.n += 1000; return [{ times: { user: this.n, nice: 0, sys: 0, irq: 0, idle: 1 } }]; }, totalmem: () => 1, freemem: () => 1 };
const pw = createPerfWatcher({ emit: (sg) => sigs.push(sg), isBlocked: () => false, now: () => t, osFacade: osHigh });
assert.equal(pw.spawnsPerTick, 0);
for (let i = 0; i < 70; i++) { t = i * 5000; await pw.tick(); }
assert.deepEqual(sigs, ["SYSTEM.SLOW.HIGH_CPU"], "fires once after 5 min sustained, via native samples only");
const r = evaluatePerf({}, { cpu: 50, mem: 50 }, 0);
assert.deepEqual(r.signals, []);
g();

// 3 — network: one probe, against the device's own edge by default; third-party anchors only when configured.
const q = buildNetworkQuery();
assert.match(q, /Get-NetRoute -DestinationPrefix '0\.0\.0\.0\/0'/, "default gateway from the routing table");
assert.match(q, /Get-DnsClientServerAddress/, "the configured DNS server");
assert.match(q, /Test-Connection -ComputerName \$gw -Count 1 -Quiet/, "reachability = ping the gateway");
assert.ok(q.includes(`Resolve-DnsName -Name '${DEFAULT_DNS_PROBE_NAME}'`), "DNS probe = the NCSI name Windows itself resolves");
assert.doesNotMatch(q, /1\.1\.1\.1|microsoft\.com'/, "no third-party anchor by default");
assert.match(q, /adapters=@\(\$a\|ForEach-Object\{\$_\.Status\}\);dnsOk=\[bool\]\$dns;ok=\[bool\]\$reach/, "ONE JSON row carries adapters + dns + reachability");
const q2 = buildNetworkQuery({ probeHost: "1.1.1.1", dnsProbeName: "example.org" });
assert.match(q2, /Test-NetConnection -ComputerName '1\.1\.1\.1' -Port 53/, "configurable public anchor");
assert.match(q2, /Resolve-DnsName -Name 'example\.org'/);
const q3 = buildNetworkQuery({ probeHost: "1.1.1.1; Remove-Item C:\\", dnsProbeName: "x'y" });
assert.doesNotMatch(q3, /Remove-Item|x'y/, "an option that is not a host/IP shape is dropped, never interpolated");
assert.deepEqual(sanitizePrefs({ networkProbe: { probeHost: "10.0.0.1", dnsProbeName: "bad host!" } }).networkProbe, { probeHost: "10.0.0.1" }, "prefs sanitizer keeps only host-shaped values");
const nw = createNetworkWatcher({ emit: () => {}, isBlocked: () => false, options: {} });
assert.equal(nw.cadenceMs, 120_000); assert.equal(nw.spawnsPerTick, 1);
// Evaluators unchanged: edge-triggered adapter/DNS, 2 consecutive failures → NET.DOWN.
assert.deepEqual(evaluateNetwork({ adapters: ["Up"], dnsOk: false }, {}).signals, [{ signal: "NET.DNS.FAIL", hint: "dns-probe-failed" }]);
assert.deepEqual(evaluateConnectivity(evaluateConnectivity({ fails: 0, down: false }, false).state, false).signals, [{ signal: "NET.DOWN", hint: "internet-unreachable" }]);
g();

// 4 — one tracked runner: ps.mjs registers children with the injected tracker; main installs it (audit M27).
let tracked = 0, untracked = 0;
configurePowerShellRunner({ track: () => { tracked++; return () => { untracked++; }; } });
await runPowerShellJson("Get-Date"); // off-win32 → null without spawning; on win32 it would be tracked
assert.ok(tracked === untracked, "every tracked child is untracked on close");
configurePowerShellRunner({});
assert.match(main, /configurePowerShellRunner\(\{ track: \(child\) => \{ childProcesses\.add\(child\); return \(\) => childProcesses\.delete\(child\); \} \}\)/, "main registers childProcesses as the tracker");
assert.doesNotMatch(main, /exec\(`powershell/, "scanDisk no longer shell-execs an untracked powershell");
assert.match(main, /if \(process\.platform !== "win32"\) return \{ ok: false, error: "not-windows", skipped: true \};/, "scanDisk is platform-guarded");
g();

// 5 — Restricted everywhere: no -ExecutionPolicy Bypass remains in the main process or the watchers.
for (const rel of ["src/main/main.mjs", "src/sub-agents/detection/ps.mjs", "src/main/tier-0-executor.mjs", "src/shared/recipe-runner.mjs"]) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, rel), "utf8"), /"Bypass"/, `${rel}: no ExecutionPolicy Bypass`);
}
assert.match(main, /\["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Restricted", "-Command", command\]/, "runPowerShell is Restricted");
g();

assert.equal(groups, 5);
console.log(`spawn-budget test passed (${groups} groups · ${budget.total} spawns/min ≤ 6 · perf native · network 120 s single local probe (configurable, sanitized) · process scan 120 s · one tracked runner · Restricted).`);
