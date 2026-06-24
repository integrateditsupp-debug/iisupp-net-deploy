// RUN 4 — content-blind fuzz on the macOS detection watchers (the darwin mirror of watchers.test).
// Each watcher's PURE mapper is fed shell output / objects stuffed with fake PII (emails, SSNs,
// POSIX paths, hostnames, app names) and we assert NO canary ever appears in an emitted signal/hint
// and every signal is a well-formed symbolic code. Runs on any OS — the mappers never shell out.
import assert from "node:assert/strict";
import { mapDiskSignals } from "../src/sub-agents/detection/macos/disk-watcher.mjs";
import { mapEventLogSignals } from "../src/sub-agents/detection/macos/event-log-watcher.mjs";
import { parseTop } from "../src/sub-agents/detection/macos/perf-watcher.mjs";
import { evaluatePerf } from "../src/sub-agents/detection/perf-watcher.mjs";
import { mapCrashSignals } from "../src/sub-agents/detection/macos/crash-watcher.mjs";
import { hasResolvers, pingOk, evaluateNetwork } from "../src/sub-agents/detection/macos/network-watcher.mjs";
import { MACOS_WATCHER_FACTORIES, WINDOWS_WATCHER_FACTORIES } from "../src/sub-agents/detection/index.mjs";

const CANARIES = [
  "jdoe@contoso.com",
  "123-45-6789",
  "/Users/jdoe/Documents/Q4-Acquisition.pages",
  "Johns-MacBook-Pro.local",
  "Confidential Acquisition Plan",
  "4111111111111111",
  "com.contoso.SecretApp"
];
const SIGNAL_RE = /^[A-Z][A-Z0-9_]*(\.[A-Z0-9_]+)+$/;
const poison = (i) => CANARIES[i % CANARIES.length] + " #" + i;

function assertClean(signals, label) {
  const text = JSON.stringify(signals);
  for (const canary of CANARIES) assert.ok(!text.includes(canary), `${label}: leaked "${canary}" -> ${text}`);
  for (const s of signals) {
    assert.ok(SIGNAL_RE.test(s.signal), `${label}: malformed signal "${s.signal}"`);
    assert.ok(/^[a-z0-9-]+$/.test(s.hint), `${label}: hint must be enum kebab "${s.hint}"`);
  }
}

let total = 0;

// disk — df text with poisoned device/mount columns + a capacity %
for (let i = 0; i < 100; i++) {
  const cap = i % 3 === 0 ? 98 : 40;
  const text = `Filesystem Size Used Avail Capacity iused ifree %iused Mounted on\n/dev/${poison(i)} 466Gi 450Gi 10Gi ${cap}% 1 1 1% /`;
  assertClean(mapDiskSignals(text), "mac-disk");
  total++;
}
assert.deepEqual(mapDiskSignals("Filesystem ...\n/dev/disk3 466Gi 460Gi 6Gi 99% / "), [{ signal: "DISK.LOW_SPACE", hint: "disk-low-space" }]);
assert.deepEqual(mapDiskSignals("Filesystem ...\n/dev/disk3 466Gi 200Gi 266Gi 43% / "), []);

// event-log — unknown subsystems (poisoned) drop; known ones map without echoing eventMessage
for (let i = 0; i < 100; i++) {
  const known = ["com.apple.shutdown", "com.apple.fsck", "com.apple.SystemConfiguration", poison(i)][i % 4];
  const rows = [{ subsystem: known, messageType: "Error", eventMessage: poison(i), category: poison(i + 1) }];
  assertClean(mapEventLogSignals(rows), "mac-event-log");
  total++;
}
assert.deepEqual(mapEventLogSignals([{ subsystem: "com.apple.shutdown", eventMessage: "secret" }]), [
  { signal: "SYSTEM.UNEXPECTED_SHUTDOWN", hint: "unexpected-shutdown" }
]);
assert.deepEqual(mapEventLogSignals([{ subsystem: "com.contoso.SecretApp", eventMessage: "x" }]), [], "unknown subsystem dropped");

// perf — parseTop ignores everything but the numbers, then the shared sustain evaluator runs
for (let i = 0; i < 100; i++) {
  const text = `Processes: 400 total, ${poison(i)}\nCPU usage: 4.0% user, 6.0% sys, 90.0% idle\nPhysMem: 14G used (2G wired), 1655M unused.\n${poison(i + 1)}`;
  const sample = parseTop(text);
  assert.ok(sample.cpu === null || typeof sample.cpu === "number", "cpu numeric");
  let st = {};
  const r = evaluatePerf(st, sample, i * 6000);
  assertClean(r.signals, "mac-perf");
  total++;
}
// parseTop reads CPU = 100 - idle and a memory percentage
const top = parseTop("CPU usage: 4.55% user, 6.81% sys, 88.64% idle\nPhysMem: 12G used (2G wired), 4G unused.");
assert.equal(top.cpu, 11.4, "cpu = 100 - idle");
assert.ok(top.mem > 70 && top.mem < 80, "mem ratio parsed");
// sustained 5 min high fires both symbolic codes (reusing the Windows evaluator)
let ps = {};
const fired = [];
for (let t = 0; t <= 6 * 60 * 1000; t += 5000) {
  const r = evaluatePerf(ps, { cpu: 99, mem: 99 }, t);
  ps = r.state;
  fired.push(...r.signals.map((s) => s.signal));
}
assert.ok(fired.includes("SYSTEM.SLOW.HIGH_CPU") && fired.includes("SYSTEM.SLOW.HIGH_RAM"), "mac perf sustains then fires");

// crash — counts only; a new report fires a generic symbolic code, no filename ever involved
for (let i = 0; i < 100; i++) {
  const { signals } = mapCrashSignals({ crashCount: 5, panicCount: 1 }, { crash: 4, panic: 1 });
  assertClean(signals, "mac-crash");
  total++;
}
assert.deepEqual(mapCrashSignals({ crashCount: 5, panicCount: 0 }, { crash: 4, panic: 0 }).signals, [
  { signal: "APP.CRASH.REPORTED", hint: "crash-report-created" }
]);
assert.deepEqual(mapCrashSignals({ crashCount: 2, panicCount: 1 }, { crash: 2, panic: 0 }).signals, [
  { signal: "SYSTEM.KERNEL_PANIC", hint: "panic-report-created" }
]);
assert.deepEqual(mapCrashSignals({ crashCount: 9, panicCount: 9 }, {}).signals, [], "no baseline yet = no fire");

// network — scutil/ping text reduced to booleans; addresses never surface
for (let i = 0; i < 100; i++) {
  const scutil = `resolver #1\n  nameserver[0] : 1.1.1.1  ${poison(i)}\n  domain : ${poison(i + 1)}`;
  const ping = `PING 1.1.1.1 (${poison(i)}): 56 data bytes\n1 packets transmitted, 1 packets received, 0.0% packet loss`;
  const r = evaluateNetwork({ resolvers: hasResolvers(scutil), ping: pingOk(ping) }, {});
  assertClean(r.signals, "mac-network");
  total++;
}
assert.equal(hasResolvers("  nameserver[0] : 8.8.8.8"), true);
assert.equal(hasResolvers("no resolvers here"), false);
assert.equal(pingOk("1 packets transmitted, 1 packets received"), true);
assert.equal(pingOk("1 packets transmitted, 0 packets received, 100.0% packet loss"), false);
assert.deepEqual(evaluateNetwork({ resolvers: false, ping: false }, {}).signals, [{ signal: "NET.ADAPTER.DOWN", hint: "no-resolvers" }]);
assert.deepEqual(evaluateNetwork({ resolvers: true, ping: false }, {}).signals, [{ signal: "NET.DNS.FAIL", hint: "ping-probe-failed" }]);

// factory shapes — macOS ships 5 watchers; Windows keeps 7. A blocked tick must be a safe no-op
// (and on this non-darwin host the shell runner is hard-guarded, so no Mac command can run).
assert.equal(MACOS_WATCHER_FACTORIES.length, 5, "5 macOS watchers");
assert.equal(WINDOWS_WATCHER_FACTORIES.length, 7, "7 Windows watchers");
const emitted = [];
for (const factory of MACOS_WATCHER_FACTORIES) {
  const w = factory({ emit: (sig, hint) => emitted.push({ sig, hint }), isBlocked: () => true });
  assert.ok(typeof w.name === "string" && typeof w.cadenceMs === "number" && typeof w.tick === "function", `${w.name} has a valid shape`);
  await w.tick(); // blocked → must not throw and must emit nothing
}
assert.equal(emitted.length, 0, "blocked macOS watchers emit nothing");

console.log(`macOS watchers content-blind test passed (${total} fuzzed inputs across 5 watchers, 0 leaks, ${MACOS_WATCHER_FACTORIES.length} factories).`);
