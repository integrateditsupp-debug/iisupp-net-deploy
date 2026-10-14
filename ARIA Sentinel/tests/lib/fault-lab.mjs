// FAULT LAB (2026-10-14) — a simulated Windows machine for proving the "advise three times, then act" rule.
//
// What it is: a virtual Windows box (services with status + start type, the print queue, the DNS resolver cache, the
// adapter / DHCP lease / Winsock state, temp + disk, default apps, the clock offset, Outlook / Teams / OneDrive, BitLocker,
// system files, the event log + WER reports + minidumps, System Restore points, and the files inside the excluded folder
// — which are NEVER readable) plus:
//   · run(cmd) / runElevated(cmd) — interpret EXACTLY the PowerShell / ipconfig statements the Tier-0 executor
//     (src/main/tier-0-executor.mjs) and the recipe registry (src/shared/recipes.mjs + recipe-runner VERIFY_COMMANDS +
//     restore-point.mjs RESTORE_COMMANDS) issue. An unknown statement THROWS — an untested command can never pass
//     silently — and is recorded in `unknownCommands` (every suite asserts it stays empty).
//   · the token model: Sentinel's own token is standard (`profile: "standard"`) or elevated (`"elevated-agent"`); an admin-only
//     statement on a standard token fails with the real stderr ("Cannot open Spooler service on computer '.'", "The
//     requested operation requires elevation."). runElevated is the UAC path — the prompt is the person's click
//     (`uac: "approve" | "deny" | "timeout"`), and every prompt is recorded (`uacPrompts`).
//   · spawn(file, args) — the child_process.spawn main.mjs uses, routed to run / runElevated (the RunAs wrapper's
//     -EncodedCommand is decoded) / a read-only `reg query`.
//   · snapshot() / diff(a, b) — the changed keys (dotted paths) between two snapshots.
//   · FAULTS — the catalogue (L1 · L2 · L3), each with the recipe the REAL detection path picks, its colour, the keys the
//     fix is allowed to change, and the path the rule must take; inject(id) / injectRandom(seed, count).
//   · scan() — the detection layer: the REAL pure watcher evaluators (service · network · disk · event log · WER ·
//     crash control) run over the machine's state and return the symbolic signals they would emit.
//   · a lab clock (virtual time) the escalation machine, the countdown and every main.mjs timer run on.
// Nothing here spawns a process, opens a socket or reads a real file outside the scratch dir.
// 🔒 The excluded folder's name is never written in this file: the paths are built from path-guard's own constant.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRIVATE_FOLDER_NAME, isBlockedPath } from "../../src/shared/path-guard.mjs";
import { evaluateServices } from "../../src/sub-agents/detection/service-watcher.mjs";
import { evaluateNetwork, evaluateConnectivity } from "../../src/sub-agents/detection/network-watcher.mjs";
import { mapDiskSignals } from "../../src/sub-agents/detection/disk-watcher.mjs";
import { mapEventLogSignals } from "../../src/sub-agents/detection/event-log-watcher.mjs";
import { mapWerSignals } from "../../src/sub-agents/detection/wer-watcher.mjs";
import { mapCrashControl } from "../../src/sub-agents/detection/crash-control-watcher.mjs";
import { evaluateClockDrift } from "../../src/sub-agents/detection/perf-watcher.mjs";
import { VERIFY_COMMANDS } from "../../src/shared/recipe-runner.mjs";
import { bootMain } from "./main-sandbox.mjs";

// The read-only probes the lab suites never count as a change: status reads + every registry verify probe.
// FAULT LAB 2026-10-14 (defect 3) — the gating verify probes start with `try {` / `if (` (they exit non-zero when the
// problem is still there), so "is this a probe?" is answered from VERIFY_COMMANDS itself, not from a command prefix.
export const PROBE_RE = /^\(Get-|^Get-Service -Name \w+ \| Select-Object|^Get-ComputerRestorePoint|^\[math\]::Round|^Test-NetConnection/;
const VERIFY_PROBES = new Set(Object.values(VERIFY_COMMANDS));
export function isReadOnlyProbe(cmd) { return PROBE_RE.test(String(cmd)) || VERIFY_PROBES.has(String(cmd)); }

const MIN = 60 * 1000;
const GB = 1024 ** 3;

// ── the lab clock ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Virtual time. advance(ms) fires due timers in order and lets the (real) child-process completions settle between. */
export function createLabClock(startMs, { busy = () => 0 } = {}) {
  let t = Number(startMs);
  let seq = 0;
  const timers = new Map();
  const errors = [];
  const handleOf = (id) => ({ id, unref() { return this; }, ref() { return this; }, hasRef() { return false; }, refresh() { return this; }, [Symbol.toPrimitive]() { return id; } });
  const idOf = (h) => (h && typeof h === "object" ? h.id : Number(h));
  const add = (fn, ms, args, every) => { const id = ++seq; timers.set(id, { at: t + Math.max(0, Number(ms) || 0), fn, args, every, seq: id }); return handleOf(id); };
  async function settle() {
    let idle = 0;
    for (let i = 0; i < 20000 && idle < 2; i++) {
      await new Promise((r) => setImmediate(r));
      idle = busy() > 0 ? 0 : idle + 1;
    }
  }
  const clock = {
    now: () => t,
    setTimeout: (fn, ms, ...args) => add(fn, ms, args, 0),
    setInterval: (fn, ms, ...args) => add(fn, ms, args, Math.max(1, Number(ms) || 1)),
    clearTimeout: (h) => { timers.delete(idOf(h)); },
    clearInterval: (h) => { timers.delete(idOf(h)); },
    pendingTimers: () => timers.size,
    errors,
    settle,
    /** Advance virtual time by ms, firing every due timer in (time, creation) order. */
    async advance(ms) {
      const target = t + Math.max(0, Number(ms) || 0);
      for (let guard = 0; guard < 200000; guard++) {
        await settle();
        let next = null;
        for (const [id, x] of timers) if (x.at <= target && (!next || x.at < next.x.at || (x.at === next.x.at && x.seq < next.x.seq))) next = { id, x };
        if (!next) break;
        t = Math.max(t, next.x.at);
        if (next.x.every) next.x.at = t + next.x.every; else timers.delete(next.id);
        try { next.x.fn(...(next.x.args || [])); } catch (err) { errors.push(err); }
      }
      t = target;
      await settle();
    }
  };
  return clock;
}

/** Seeded PRNG (mulberry32) — the soak's sequences are reproducible from their seed. */
export function mulberry32(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ── the machine ───────────────────────────────────────────────────────────────────────────────────────────────────
const SERVICE_INFO = {
  Spooler: { display: "Print Spooler", startType: "Automatic", status: "Running" },
  Audiosrv: { display: "Windows Audio", startType: "Automatic", status: "Running" },
  AudioEndpointBuilder: { display: "Windows Audio Endpoint Builder", startType: "Automatic", status: "Running" },
  wuauserv: { display: "Windows Update", startType: "Manual", status: "Stopped" },
  BITS: { display: "Background Intelligent Transfer Service", startType: "Manual", status: "Stopped" },
  cryptsvc: { display: "Cryptographic Services", startType: "Automatic", status: "Running" },
  Dnscache: { display: "DNS Client", startType: "Automatic", status: "Running", protected: true },
  Dhcp: { display: "DHCP Client", startType: "Automatic", status: "Running" },
  WlanSvc: { display: "WLAN AutoConfig", startType: "Automatic", status: "Running" },
  bthserv: { display: "Bluetooth Support Service", startType: "Manual", status: "Running" },
  RasMan: { display: "Remote Access Connection Manager", startType: "Manual", status: "Running" },
  LanmanWorkstation: { display: "Workstation", startType: "Automatic", status: "Running" },
  W32Time: { display: "Windows Time", startType: "Manual", status: "Running" }
};

/** The paths inside the excluded folder on this machine — they exist, and nothing may ever read, list or name them. */
export function excludedFolderPaths() {
  return [
    `C:\\Users\\Sam\\Pictures\\${PRIVATE_FOLDER_NAME}\\IMG_0007.jpg`,
    `C:\\Users\\Sam\\Pictures\\${PRIVATE_FOLDER_NAME}\\VID_0012.mp4`,
    `C:\\Users\\Sam\\OneDrive\\${PRIVATE_FOLDER_NAME}\\scan.pdf`
  ];
}

export function healthyState() {
  const services = {};
  for (const [name, s] of Object.entries(SERVICE_INFO)) services[name] = { status: s.status, startType: s.startType, restarts: 0, hung: false };
  return {
    services,
    printQueue: { jobs: 0, frozen: false },
    dns: { cacheEntries: 120, staleEntries: 0, registrations: 0 },
    network: { adapterUp: true, wifiConnected: true, leaseValid: true, apipa: false, gatewayReachable: true, winsockOk: true },
    updates: { stuck: false },
    bits: { transfersStuck: false },
    disk: { sizeBytes: 256 * GB, freeBytes: 80 * GB },
    tempBytes: Math.round(1.2 * GB),
    defaultApps: { ".txt": "NOTEPAD.EXE" },
    time: { offsetSec: 0 },
    outlook: { running: true, ostCurrent: 1, ostBackups: 0, credential: "cached" },
    teams: { running: true, responding: true, cacheBytes: 300 * 1024 * 1024 },
    onedrive: { running: true, syncState: "up-to-date" },
    bitlocker: { recoveryPrompt: false },
    systemFiles: { corrupt: false },
    eventLog: [],
    werReports: [],
    minidumps: { count: 2, lastStopCode: "" },
    restorePoints: [{ seq: 41, description: "Windows Update", at: 0 }],
    excludedFolderPaths: excludedFolderPaths()
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));
function flatten(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) { out[prefix] = JSON.stringify(obj); return out; }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  out[prefix] = obj;
  return out;
}
/** The keys (dotted paths; arrays compared whole) whose values differ between two snapshots. Sorted. */
export function diff(a, b) {
  const fa = flatten(a || {}), fb = flatten(b || {});
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  return [...keys].filter((k) => fa[k] !== fb[k]).sort();
}

const ELEVATION_TEXT = "Windows IP Configuration\r\n\r\nThe requested operation requires elevation.\r\n";

/**
 * createVirtualWindows({ profile, strictAdmin, uac, clock })
 *   profile     "standard" (Sentinel runs as the signed-in user — the default install) | "elevated-agent" (its token is
 *               elevated, e.g. launched "as administrator")
 *   strictAdmin also treat `ipconfig /registerdns` + `Clear-DnsClientCache` as admin-only (real Windows behaviour the
 *               registry does NOT declare — used by one scenario to show what happens if that belief is right)
 *   uac         "approve" | "deny" | "timeout" — what the person does with a UAC prompt
 */
export function createVirtualWindows({ profile = "standard", strictAdmin = false, uac = "approve", clock = null } = {}) {
  const machine = {
    profile, strictAdmin, uac,
    state: healthyState(),
    commands: [],          // { at, cmd, elevated, exitCode }
    uacPrompts: [],        // { at, cmd, answer }
    unknownCommands: [],   // statements the interpreter does not know (must stay empty)
    violations: [],        // excluded-folder reads / references (must stay empty)
    pendingChildren: 0,
    now: () => (clock ? clock.now() : Date.now())
  };
  const st = () => machine.state;
  const svcKey = (name) => Object.keys(st().services).find((k) => k.toLowerCase() === String(name || "").toLowerCase()) || null;
  const svcDisplay = (k) => (SERVICE_INFO[k] || {}).display || k;

  function internetUp() {
    const n = st().network;
    return n.adapterUp && n.wifiConnected && n.leaseValid && !n.apipa && n.gatewayReachable && n.winsockOk;
  }
  function dnsResolves() {
    const s = st();
    // Windows still resolves names with the DNS Client service stopped (no caching); stale entries are what break it.
    return internetUp() && s.dns.staleEntries === 0;
  }
  machine.internetUp = internetUp;
  machine.dnsResolves = dnsResolves;

  // The side effects of a service coming (back) up.
  function afterServiceStart(k) {
    const s = st();
    s.services[k].hung = false;
    if (k === "Spooler" && s.services.Spooler.startType !== "Disabled") { if (s.printQueue.frozen) { s.printQueue.frozen = false; s.printQueue.jobs = 0; } }
    if (k === "WlanSvc") { s.network.wifiConnected = true; s.network.adapterUp = true; }
    if (k === "wuauserv" || k === "BITS") { if (s.services.wuauserv.status === "Running" && !s.services.wuauserv.hung && (k === "wuauserv")) s.updates.stuck = false; if (k === "BITS") s.bits.transfersStuck = false; }
  }

  // One service-control statement on one service. Returns { ok, err }.
  function serviceControl(verb, name, elevated) {
    const k = svcKey(name);
    if (!k) return { ok: false, err: `${verb} : Cannot find any service with service name '${name}'.` };
    const s = st().services[k];
    const display = svcDisplay(k);
    if (!elevated) {
      const what = verb === "Start-Service" ? "started" : "stopped";
      return { ok: false, err: `${verb} : Service '${display} (${k})' cannot be ${what} due to the following error: Cannot open ${k} service on computer '.'.` };
    }
    if ((SERVICE_INFO[k] || {}).protected && verb !== "Get") {
      return { ok: false, err: `${verb} : Service '${display} (${k})' cannot be ${verb === "Start-Service" ? "started" : "stopped"} due to the following error: Cannot ${verb === "Start-Service" ? "start" : "stop"} ${k} service on computer '.'.` };
    }
    if (verb === "Stop-Service") { s.status = "Stopped"; return { ok: true }; }
    if (s.startType === "Disabled") {
      s.status = "Stopped";
      return { ok: false, err: `${verb} : Service '${display} (${k})' cannot be started due to the following error: Cannot start service ${k} on computer '.'.` };
    }
    if (verb === "Restart-Service") s.restarts += 1;
    if (verb === "Start-Service" && s.status === "Running") return { ok: true };
    s.status = "Running";
    afterServiceStart(k);
    return { ok: true };
  }

  const PROC_TEAMS = /^Get-Process -Name Teams,ms-teams -ErrorAction SilentlyContinue \| Stop-Process -Force$/;
  const TEAMS_CACHE = /^Remove-Item -Path "\$env:APPDATA\\Microsoft\\Teams\\Cache",.*-Recurse -Force -ErrorAction SilentlyContinue$/;

  /** Interpret ONE statement. Returns { out, err, ok }. Throws on an unknown statement. */
  function statement(s, elevated) {
    const S = st();
    let m;
    // — services —
    if ((m = s.match(/^(Restart-Service|Stop-Service|Start-Service)\s+(?:-Name\s+)?([A-Za-z0-9_,]+)(?:\s+-Force)?$/))) {
      const names = m[2].split(",").filter(Boolean);
      const errs = [];
      for (const n of names) { const r = serviceControl(m[1], n, elevated); if (!r.ok) errs.push(r.err); }
      return { out: "", err: errs.join("\r\n"), ok: errs.length === 0 };
    }
    if ((m = s.match(/^\(Get-Service(?:\s+-Name)?\s+([A-Za-z0-9_]+)\)\.Status$/))) {
      const k = svcKey(m[1]);
      if (!k) return { out: "", err: `Get-Service : Cannot find any service with service name '${m[1]}'.`, ok: false };
      return { out: `${S.services[k].status}\r\n`, err: "", ok: true };
    }
    if ((m = s.match(/^Get-Service -Name ([A-Za-z0-9_]+) \| Select-Object Name,Status(?:,StartType)?$/))) {
      const k = svcKey(m[1]);
      if (!k) return { out: "", err: `Get-Service : Cannot find any service with service name '${m[1]}'.`, ok: false };
      return { out: `\r\nName    Status  StartType\r\n----    ------  ---------\r\n${k} ${S.services[k].status} ${S.services[k].startType}\r\n`, err: "", ok: true };
    }
    // — DNS —
    if (s === "ipconfig /flushdns") {
      if (S.services.Dnscache.status !== "Running") return { out: "\r\nWindows IP Configuration\r\n\r\nCould not flush the DNS Resolver Cache: Function failed during execution.\r\n", err: "", ok: false };
      S.dns.cacheEntries = 0; S.dns.staleEntries = 0;
      return { out: "\r\nWindows IP Configuration\r\n\r\nSuccessfully flushed the DNS Resolver Cache.\r\n", err: "", ok: true };
    }
    if (s === "ipconfig /registerdns") {
      if (machine.strictAdmin && !elevated) return { out: ELEVATION_TEXT, err: "", ok: false };
      S.dns.registrations += 1;
      return { out: "\r\nWindows IP Configuration\r\n\r\nRegistration of the DNS resource records for all adapters of this computer has been initiated. Any errors will be reported in the Event Viewer in 15 minutes.\r\n", err: "", ok: true };
    }
    if (s === "Clear-DnsClientCache") {
      if (machine.strictAdmin && !elevated) return { out: "", err: "Clear-DnsClientCache : Access is denied.", ok: false };
      if (S.services.Dnscache.status !== "Running") return { out: "", err: "Clear-DnsClientCache : The DNS Client service is not running.", ok: false };
      S.dns.cacheEntries = 0; S.dns.staleEntries = 0;
      return { out: "", err: "", ok: true };
    }
    if (s === "(Get-DnsClientCache | Measure-Object).Count") return { out: `${S.dns.cacheEntries + S.dns.staleEntries}\r\n`, err: "", ok: true };
    // — network —
    if (s === "ipconfig /release" || s === "ipconfig /renew") {
      if (!elevated) return { out: ELEVATION_TEXT, err: "", ok: false };
      if (s === "ipconfig /release") { S.network.leaseValid = false; return { out: "\r\nWindows IP Configuration\r\n", err: "", ok: true }; }
      if (S.services.Dhcp.status !== "Running" || !S.network.winsockOk || !S.network.adapterUp) return { out: "\r\nAn error occurred while renewing interface Wi-Fi : unable to contact your DHCP server.\r\n", err: "", ok: false };
      S.network.leaseValid = true; S.network.apipa = false; S.network.gatewayReachable = true;
      return { out: "\r\nWindows IP Configuration\r\n", err: "", ok: true };
    }
    if (s === "Test-NetConnection -ComputerName 1.1.1.1 -Port 53 -InformationLevel Quiet") return { out: internetUp() ? "True\r\n" : "False\r\n", err: "", ok: true };
    // — the GATING verify probes (recipe-runner VERIFY_GATES): they EXIT 1 when the problem is still there —
    // dns-fail-v1: resolve the NCSI name through the configured resolver (DNS only). Reachability comes from the network
    // state (adapter · Wi-Fi · lease · gateway · Winsock) and a stale cache entry still breaks it.
    if (s === "try { Resolve-DnsName -Name dns.msftncsi.com -Type A -DnsOnly -QuickTimeout -ErrorAction Stop | Out-Null } catch { exit 1 }") {
      return dnsResolves() ? { out: "", err: "", ok: true } : { out: "", err: "", ok: false, exit: 1 };
    }
    // svc-dhcp-stopped-v1: the service is Running…
    if ((m = s.match(/^if \(\(Get-Service -Name ([A-Za-z0-9_]+)\)\.Status -ne 'Running'\) \{ exit 1 \}$/))) {
      const k = svcKey(m[1]);
      if (!k) return { out: "", err: `Get-Service : Cannot find any service with service name '${m[1]}'.`, ok: false, exit: 1 };
      return S.services[k].status === "Running" ? { out: "", err: "", ok: true } : { out: "", err: "", ok: false, exit: 1 };
    }
    // …and a connected DHCP-enabled interface holds a DHCP lease (an APIPA address is no lease).
    if (s === "if ((Get-NetIPInterface -AddressFamily IPv4 -Dhcp Enabled -ConnectionState Connected -ErrorAction SilentlyContinue) -and -not (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp -ErrorAction SilentlyContinue)) { exit 1 }") {
      const n = S.network;
      const dhcpInterfaceUp = n.adapterUp && n.wifiConnected;
      const lease = n.leaseValid && !n.apipa;
      return dhcpInterfaceUp && !lease ? { out: "", err: "", ok: false, exit: 1 } : { out: "", err: "", ok: true };
    }
    // — restore points —
    if (s === "Get-ComputerRestorePoint | Select-Object -ExpandProperty SequenceNumber") {
      if (!elevated) return { out: "", err: "Get-ComputerRestorePoint : Access is denied.", ok: false };
      return { out: S.restorePoints.map((p) => p.seq).join("\r\n") + "\r\n", err: "", ok: true };
    }
    if ((m = s.match(/^Checkpoint-Computer -Description ["']([^"']{1,80})["'] -RestorePointType ["']?MODIFY_SETTINGS["']?$/))) {
      if (!elevated) return { out: "", err: "Checkpoint-Computer : Access is denied.", ok: false };
      // Windows' own throttle: within 24 h of the last point the cmdlet silently does nothing and still succeeds.
      const last = S.restorePoints.reduce((mx, p) => Math.max(mx, Number(p.at) || 0), 0);
      if (last && machine.now() - last < 24 * 60 * MIN) return { out: "", err: "WARNING: A new system restore point cannot be created because one has already been created within the past 1440 minutes.", ok: true };
      S.restorePoints.push({ seq: Math.max(...S.restorePoints.map((p) => p.seq)) + 1, description: m[1], at: machine.now() });
      return { out: "", err: "", ok: true };
    }
    // — temp / disk —
    if (s === 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue') {
      const residual = Math.min(S.tempBytes, 5 * 1024 * 1024); // files in use stay (SilentlyContinue)
      S.disk.freeBytes += S.tempBytes - residual;
      S.tempBytes = residual;
      return { out: "", err: "", ok: true };
    }
    if (s === "[math]::Round((Get-PSDrive C).Free/1GB,1)") return { out: `${Math.round((S.disk.freeBytes / GB) * 10) / 10}\r\n`, err: "", ok: true };
    // — Teams / Outlook / OneDrive (user processes + the user's own caches) —
    if (PROC_TEAMS.test(s)) { S.teams.running = false; S.teams.responding = true; return { out: "", err: "", ok: true }; }
    if (TEAMS_CACHE.test(s)) { S.teams.cacheBytes = 0; return { out: "", err: "", ok: true }; }
    if (s === "(Get-Process -Name Teams,ms-teams -ErrorAction SilentlyContinue | Measure-Object).Count") return { out: `${S.teams.running ? 1 : 0}\r\n`, err: "", ok: true };
    if (s === "Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue | Stop-Process -Force") { S.outlook.running = false; return { out: "", err: "", ok: true }; }
    if (s === "Get-ChildItem \"$env:LOCALAPPDATA\\Microsoft\\Outlook\\*.ost\" -ErrorAction SilentlyContinue | Rename-Item -NewName { $_.Name + '.aria.bak' } -ErrorAction SilentlyContinue") {
      if (S.outlook.ostCurrent > 0) { S.outlook.ostBackups += S.outlook.ostCurrent; S.outlook.ostCurrent = 0; }
      return { out: "", err: "", ok: true };
    }
    if (s === "Start-Process outlook.exe") { S.outlook.running = true; if (S.outlook.ostCurrent === 0) S.outlook.ostCurrent = 1; return { out: "", err: "", ok: true }; }
    if (s === "(Get-Process -Name OUTLOOK -ErrorAction SilentlyContinue | Measure-Object).Count") return { out: `${S.outlook.running ? 1 : 0}\r\n`, err: "", ok: true };
    if (s === "Start-Process \"$env:LOCALAPPDATA\\Microsoft\\OneDrive\\OneDrive.exe\" -ArgumentList '/reset'") { S.onedrive.running = false; S.onedrive.syncState = "reset"; return { out: "", err: "", ok: true }; }
    if (s === "Start-Process \"$env:LOCALAPPDATA\\Microsoft\\OneDrive\\OneDrive.exe\"") { S.onedrive.running = true; S.onedrive.syncState = "up-to-date"; return { out: "", err: "", ok: true }; }
    if (s === "(Get-Process -Name OneDrive -ErrorAction SilentlyContinue | Measure-Object).Count") return { out: `${S.onedrive.running ? 1 : 0}\r\n`, err: "", ok: true };
    if (s === "(Get-VpnConnection -ErrorAction SilentlyContinue | Measure-Object).Count") return { out: "0\r\n", err: "", ok: true };
    throw new Error(`fault-lab: unknown command statement: ${s}`);
  }

  /** Split a -Command string into top-level statements (`;` outside quotes/braces). */
  function statements(cmd) {
    const out = [];
    let cur = "", depth = 0, q = null;
    for (const ch of String(cmd)) {
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
      if (ch === "{") depth++;
      if (ch === "}") depth = Math.max(0, depth - 1);
      if (ch === ";" && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /** Execute a full -Command string as PowerShell would (statement by statement; `$?`; the exit guard). */
  function execute(cmd, elevated) {
    const text = String(cmd || "");
    if (isBlockedPath(text)) {
      machine.violations.push({ at: machine.now(), kind: "excluded-folder-referenced", elevated });
      return { stdout: "", stderr: "Access to the path is denied.", exitCode: 1 };
    }
    let stdout = "", stderr = "", lastOk = true;
    for (const s of statements(text)) {
      if (s === "if(-not $?){exit 1}") { if (!lastOk) return { stdout, stderr, exitCode: 1 }; continue; }
      const r = statement(s, elevated);
      stdout += r.out || "";
      if (r.err) stderr += (stderr ? "\r\n" : "") + r.err;
      if (Number.isInteger(r.exit)) return { stdout, stderr, exitCode: r.exit }; // an `exit N` ends the session there
      lastOk = r.ok;
    }
    return { stdout, stderr, exitCode: lastOk ? 0 : 1 };
  }

  machine.run = (cmd) => {
    const r = execute(cmd, machine.profile === "elevated-agent");
    machine.commands.push({ at: machine.now(), cmd: String(cmd), elevated: machine.profile === "elevated-agent", via: "run", exitCode: r.exitCode });
    return r;
  };
  machine.runElevated = (cmd) => {
    const r = execute(cmd, true);
    machine.commands.push({ at: machine.now(), cmd: String(cmd), elevated: true, via: "uac", exitCode: r.exitCode });
    return r;
  };
  /** Read-only `reg query` (the .txt association guard). Returns the text reg.exe would print. */
  machine.regQuery = (args = []) => {
    const key = String(args[1] || "");
    if (isBlockedPath(args.join(" "))) { machine.violations.push({ at: machine.now(), kind: "excluded-folder-referenced", via: "reg" }); return { stdout: "", stderr: "", exitCode: 1 }; }
    if (/FileExts\\\.txt\\UserChoice$/i.test(key)) return { stdout: `\r\n${key}\r\n    ProgId    REG_SZ    txtfilelegacyDDE\r\n`, stderr: "", exitCode: 0 };
    if (/^HKCR\\\.txt$/i.test(key)) return { stdout: `\r\n${key}\r\n    (Default)    REG_SZ    txtfile\r\n`, stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 1 };
  };

  /** child_process.spawn as main.mjs uses it → the interpreter. Completion is asynchronous (like a real child). */
  machine.spawn = (file, args = [], opts = {}) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.pid = 10000 + machine.commands.length;
    let done = false;
    child.kill = () => { if (!done) { done = true; machine.pendingChildren--; setImmediate(() => child.emit("close", null, "SIGTERM")); } return true; };
    machine.pendingChildren++;
    let outcome;
    try {
      const f = String(file || "").toLowerCase();
      if (f === "powershell.exe" || f === "powershell") {
        const i = args.indexOf("-Command");
        const cmd = i >= 0 ? String(args[i + 1] || "") : "";
        const enc = /'-EncodedCommand','([A-Za-z0-9+/=]+)'/.exec(cmd);
        if (/-Verb RunAs/.test(cmd) && enc) {
          const inner = Buffer.from(enc[1], "base64").toString("utf16le");
          machine.uacPrompts.push({ at: machine.now(), cmd: inner, answer: machine.uac });
          if (machine.uac === "deny") outcome = { stdout: "", stderr: "", exitCode: 1223 };
          else if (machine.uac === "timeout") outcome = { stdout: "", stderr: "", exitCode: null, signal: "SIGTERM" };
          else { const r = machine.runElevated(inner); outcome = { stdout: "", stderr: "", exitCode: r.exitCode }; }
        } else outcome = machine.run(cmd);
      } else if (f === "reg" || f === "reg.exe") outcome = machine.regQuery(args);
      else throw new Error(`fault-lab: unknown executable ${file}`);
    } catch (err) {
      machine.unknownCommands.push({ at: machine.now(), file: String(file), args: (args || []).map(String), error: String((err && err.message) || err) });
      outcome = { stdout: "", stderr: "fault-lab: unknown command", exitCode: 1 };
    }
    setImmediate(() => {
      if (done) return;
      done = true;
      machine.pendingChildren--;
      if (outcome.stdout) child.stdout.emit("data", Buffer.from(outcome.stdout));
      if (outcome.stderr) child.stderr.emit("data", Buffer.from(outcome.stderr));
      child.emit("close", outcome.signal ? null : outcome.exitCode, outcome.signal || null);
    });
    return child;
  };

  machine.snapshot = () => clone(st());
  machine.diff = diff;

  // — the detection layer: the REAL watcher evaluators over this machine's state —
  const scanMemo = { services: null, net: { down: false, dnsFail: false }, conn: { fails: 0, down: false }, eventIdx: 0, werIdx: 0, dumps: -1, clock: {} };
  // FAULT LAB 2026-10-14 (defect 6) — what the perf watcher's clock sub-check reads: the time service's computed offset
  // (absolute, microseconds) against its NTP source.
  const clockSample = () => ({ offsetUs: Math.round(Math.abs(Number(st().time.offsetSec) || 0) * 1e6) });
  function serviceRows() {
    return Object.entries(st().services).map(([Name, s]) => ({ Name, Status: s.status, StartType: s.startType, Failing: s.hung === true }));
  }
  function networkRow() {
    const n = st().network;
    return { adapters: [n.adapterUp && n.wifiConnected ? "Up" : "Disconnected"], dnsOk: dnsResolves(), ok: internetUp(), hasGateway: n.leaseValid && !n.apipa };
  }
  /** Baseline every watcher on the current (healthy) state — nothing is emitted, like a watcher's first tick. */
  machine.baseline = () => {
    scanMemo.services = evaluateServices({}, serviceRows()).state;
    const ev = evaluateNetwork(networkRow(), {}); scanMemo.net = ev.state;
    scanMemo.conn = evaluateConnectivity({ fails: 0, down: false }, networkRow().ok).state;
    scanMemo.eventIdx = st().eventLog.length;
    scanMemo.werIdx = st().werReports.length;
    scanMemo.dumps = mapCrashControl({ dumpCount: st().minidumps.count, stopCode: "" }, -1).count;
    scanMemo.clock = evaluateClockDrift({}, clockSample()).state;
  };
  /** One watcher round (the network probe twice — reachability needs two failures). Returns [{ signal, hint, watcher }]. */
  machine.scan = () => {
    const out = [];
    const svc = evaluateServices(scanMemo.services || {}, serviceRows());
    scanMemo.services = svc.state;
    for (const s of svc.signals) out.push({ ...s, watcher: "service" });
    for (let i = 0; i < 2; i++) {
      const row = networkRow();
      const ev = evaluateNetwork(row, scanMemo.net); scanMemo.net = ev.state;
      for (const s of ev.signals) out.push({ ...s, watcher: "network" });
      const cn = evaluateConnectivity(scanMemo.conn, row.ok); scanMemo.conn = cn.state;
      for (const s of cn.signals) out.push({ ...s, watcher: "network" });
    }
    for (const s of mapDiskSignals([{ Size: st().disk.sizeBytes, FreeSpace: st().disk.freeBytes }])) out.push({ ...s, watcher: "disk" });
    const evRows = st().eventLog.slice(scanMemo.eventIdx); scanMemo.eventIdx = st().eventLog.length;
    for (const s of mapEventLogSignals(evRows)) out.push({ ...s, watcher: "event-log" });
    const werRows = st().werReports.slice(scanMemo.werIdx); scanMemo.werIdx = st().werReports.length;
    for (const s of mapWerSignals(werRows)) out.push({ ...s, watcher: "wer" });
    const cc = mapCrashControl({ dumpCount: st().minidumps.count, stopCode: st().minidumps.lastStopCode }, scanMemo.dumps);
    scanMemo.dumps = cc.count;
    for (const s of cc.signals) out.push({ ...s, watcher: "crash-control" });
    const clock = evaluateClockDrift(scanMemo.clock, clockSample());
    scanMemo.clock = clock.state;
    for (const s of clock.signals) out.push({ ...s, watcher: "perf" });
    const seen = new Set();
    return out.filter((s) => (seen.has(s.signal) ? false : (seen.add(s.signal), true)));
  };
  return machine;
}

// ── the fault catalogue ───────────────────────────────────────────────────────────────────────────────────────────
// level      L1 reversible user-level · L2 service / network · L3 admin / irreversible / red
// recipe     what the REAL detection path picks (detectIssue → matchRecipes) for the fault's signal
// needsAdmin the recipe has a step that needs administrator rights (no unattended elevated runner exists)
// path       what the rule must do in Autonomous mode with live fixes on and nobody answering:
//              auto-fix       3 notices → the countdown → the fix → verify (the recipe must be vetted for unattended runs —
//                             locally, or by the vendor floor for a green recipe with a gating verify + inverse: defect 4)
//              not-resolved   3 notices → the countdown → the fix runs → its GATING verify fails → `not_resolved` (never
//                             "fixed and verified") → the IT contact is told through the escalation path (defect 3)
//              escalate       3 notices → the IT contact is told (notify + webhook) → NEVER executed
//              attempt-fails  3 notices → the fix runs and fails honestly (nothing changed) → fix-failed notify
//              guide-only     no notices: the recipe is a guide, ARIA cannot apply it (nothing ever runs)
// kind       the escalation's kind for an `escalate` path: needs-admin · red · needs-confirm (yellow — always needs a yes)
// fixKeys    the ONLY keys its fix may change (a fix that touches anything else fails the lab)
// report     how the problem reaches Sentinel: a watcher (scan) or a person (chat → detectIssue)
// gap        a known product gap the lab exposes (reported, never encoded as a pass)
export const FAULTS = Object.freeze([
  {
    id: "stale-dns", level: "L1", title: "Stale DNS cache (lookups fail)", recipe: "dns-fail-v1", color: "green", needsAdmin: false, path: "auto-fix",
    fixKeys: ["dns.cacheEntries", "dns.registrations", "dns.staleEntries"], report: "watcher",
    inject: (s) => { s.dns.staleEntries = 7; s.dns.cacheEntries = 140; s.eventLog.push({ ProviderName: "Microsoft-Windows-DNS-Client", Id: 1014 }); },
    resolved: (m) => m.dnsResolves()
  },
  {
    id: "spooler-stuck", level: "L1", title: "Print spooler stopped, queue frozen", recipe: "svc-spooler-stopped-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["printQueue.frozen", "printQueue.jobs", "services.Spooler.restarts", "services.Spooler.status"], report: "watcher",
    inject: (s) => { s.services.Spooler.status = "Stopped"; s.printQueue = { jobs: 3, frozen: true }; },
    resolved: (m) => m.state.services.Spooler.status === "Running" && !m.state.printQueue.frozen
  },
  {
    id: "audio-stopped", level: "L1", title: "Windows Audio service stopped", recipe: "svc-audiosrv-stopped-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["services.Audiosrv.restarts", "services.Audiosrv.status"], report: "watcher",
    inject: (s) => { s.services.Audiosrv.status = "Stopped"; },
    resolved: (m) => m.state.services.Audiosrv.status === "Running"
  },
  {
    id: "temp-bloat", level: "L1", title: "Temp files filling the disk (under 5% free)", recipe: "disk-low-space-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["disk.freeBytes", "restorePoints", "tempBytes"], optionalKeys: ["restorePoints"], report: "watcher",
    inject: (s) => { s.tempBytes = 72 * GB; s.disk.freeBytes = 9 * GB; },
    resolved: (m) => m.state.disk.freeBytes / m.state.disk.sizeBytes >= 0.05
  },
  {
    // FAULT LAB 2026-10-14 (defect 6) — the perf watcher's clock sub-check now reports drift beyond 2 minutes itself (it was
    // "person reports a 95 s drift"). The fault drifts past the watcher's threshold; under it (e.g. 95 s) the watcher stays
    // quiet by design (tests/fault-lab-defects.test.mjs). The recipe is still a guide: nothing to apply.
    id: "time-drift", level: "L1", title: "Clock drift (5 min)", recipe: "system-time-drift-v1", color: "green", needsAdmin: false, path: "guide-only",
    fixKeys: [], report: "watcher",
    inject: (s) => { s.time.offsetSec = 300; },
    resolved: (m) => m.state.time.offsetSec === 0
  },
  {
    id: "teams-stuck", level: "L1", title: "Teams hung (cache bloated)", recipe: "teams-cache-v1", color: "yellow", needsAdmin: false, path: "escalate", kind: "needs-confirm", needsWindow: true,
    fixKeys: ["restorePoints", "teams.cacheBytes", "teams.responding", "teams.running"], optionalKeys: ["restorePoints"], report: "watcher",
    inject: (s) => { s.teams.responding = false; s.teams.cacheBytes = Math.round(2.4 * GB); s.werReports.push({ app: "teams.exe", ts: 1 }); },
    resolved: (m) => m.state.teams.cacheBytes === 0
  },
  {
    id: "wu-stuck", level: "L2", title: "Windows Update stuck", recipe: "windows-update-stuck-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["services.BITS.restarts", "services.BITS.status", "services.cryptsvc.restarts", "services.wuauserv.hung", "services.wuauserv.restarts", "updates.stuck"], report: "watcher",
    inject: (s) => { s.services.wuauserv.status = "Running"; s.services.wuauserv.hung = true; s.updates.stuck = true; s.eventLog.push({ ProviderName: "Microsoft-Windows-WindowsUpdateClient", Id: 20 }); },
    // the update service was running (hung) when injected; the "before" snapshot is taken after injection
    resolved: (m) => !m.state.updates.stuck
  },
  {
    id: "bits-stopped", level: "L2", title: "BITS stopped mid-transfer", recipe: "svc-bits-stopped-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["bits.transfersStuck", "services.BITS.restarts", "services.BITS.status"], report: "watcher",
    preBaseline: (s) => { s.services.BITS.startType = "Automatic"; s.services.BITS.status = "Running"; },
    inject: (s) => { s.services.BITS.status = "Stopped"; s.bits.transfersStuck = true; },
    resolved: (m) => m.state.services.BITS.status === "Running" && !m.state.bits.transfersStuck
  },
  {
    // (defect 2 closed the gap noted here: the network watcher's NET.ADAPTER.DOWN / NET.DOWN for the same outage now route
    // to the net-adapter-down-v1 guide instead of "No local recipe matched".)
    id: "wlan-stopped", level: "L2", title: "Wi-Fi dropped (WLAN AutoConfig stopped)", recipe: "svc-wlansvc-stopped-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["network.adapterUp", "network.wifiConnected", "services.WlanSvc.restarts", "services.WlanSvc.status"], report: "watcher",
    inject: (s) => { s.services.WlanSvc.status = "Stopped"; s.network.wifiConnected = false; s.network.adapterUp = false; },
    resolved: (m) => m.state.services.WlanSvc.status === "Running" && m.internetUp()
  },
  {
    id: "dnscache-stopped", level: "L2", title: "DNS Client service stopped", recipe: "svc-dnscache-stopped-v1", color: "green", needsAdmin: false, path: "attempt-fails",
    fixKeys: [], report: "watcher",
    gap: "The DNS Client service cannot be restarted from a session; its recipe only refreshes the resolver, which fails while the service is down (a reboot or a person is needed).",
    inject: (s) => { s.services.Dnscache.status = "Stopped"; },
    resolved: (m) => m.state.services.Dnscache.status === "Running"
  },
  {
    // FAULT LAB 2026-10-14 (defects 2 + 3) — was path "auto-fix" with "ARIA reports it fixed and verified, but the root cause is
    // still there". dns-fail-v1's verify is now a GATING probe (the NCSI name must resolve), so the refresh ends `not_resolved`
    // and the IT contact is told; NET.DOWN now also reaches the person as the net-adapter-down-v1 guide.
    id: "dhcp-lease-stale", level: "L2", title: "Wi-Fi connected, no internet (DHCP lease stale)", recipe: "dns-fail-v1", color: "green", needsAdmin: false, path: "not-resolved",
    fixKeys: ["dns.cacheEntries", "dns.registrations", "dns.staleEntries"], report: "watcher", fixesSymptomOnly: true,
    gap: "The DNS refresh (dns-fail-v1) cannot renew a stale lease — renewing it needs `ipconfig /renew`, which needs administrator rights — so the item ends `not resolved` and goes to the IT contact; NET.DOWN gives the person the network guide meanwhile.",
    inject: (s) => { s.network.leaseValid = false; s.network.apipa = true; s.network.gatewayReachable = false; s.dns.staleEntries = 3; },
    resolved: (m) => m.internetUp()
  },
  {
    // FAULT LAB 2026-10-14 (defect 5) — was report "person" via PRINT.OFFLINE → printer-spooler-v1 because the service watcher
    // ignored a Disabled service. The watcher now reports a watched service stopped with start type Disabled as the
    // stopped-service signal with startType "disabled" → svc-spooler-stopped-v1, needs an administrator, never automatic.
    id: "spooler-disabled", level: "L3", title: "Print spooler disabled (start type Disabled)", recipe: "svc-spooler-stopped-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: [], report: "watcher",
    gap: "No recipe may change a start type: the restart that Fix now or an approval runs fails honestly until an administrator re-enables the Print Spooler (the card says so).",
    inject: (s) => { s.services.Spooler.startType = "Disabled"; s.services.Spooler.status = "Stopped"; s.printQueue = { jobs: 2, frozen: true }; },
    resolved: (m) => m.state.services.Spooler.status === "Running"
  },
  {
    id: "system-files-corrupt", level: "L3", title: "System files corrupt (CRITICAL_PROCESS_DIED)", recipe: "bsod-critical-process-v1", color: "red", needsAdmin: false, path: "escalate", kind: "red",
    fixKeys: [], report: "watcher",
    inject: (s) => { s.systemFiles.corrupt = true; s.minidumps = { count: s.minidumps.count + 1, lastStopCode: "CRITICAL_PROCESS_DIED" }; },
    resolved: (m) => !m.state.systemFiles.corrupt
  },
  {
    id: "bitlocker-recovery", level: "L3", title: "BitLocker asking for the recovery key", recipe: "security-bitlocker-recovery-v1", color: "red", needsAdmin: false, path: "escalate", kind: "red",
    fixKeys: [], report: "person", signal: "SECURITY.BITLOCKER_RECOVERY",
    inject: (s) => { s.bitlocker.recoveryPrompt = true; },
    resolved: (m) => !m.state.bitlocker.recoveryPrompt
  },
  {
    // FAULT LAB 2026-10-14 (defect 3) — was path "auto-fix" ("fixed and verified" while the internet stayed down): the gating
    // verify now fails, so the DNS refresh ends `not_resolved` and the IT contact is told. The L3 fix itself still never runs.
    id: "winsock-corrupt", level: "L3", title: "Winsock catalog corrupt (needs netsh winsock reset + reboot)", recipe: "dns-fail-v1", color: "green", needsAdmin: false, path: "not-resolved",
    fixKeys: ["dns.cacheEntries", "dns.registrations", "dns.staleEntries"], report: "watcher", fixesSymptomOnly: true, l3FixNeverRuns: /netsh\s+winsock\s+reset/i, rootKeys: ["network.winsockOk"],
    gap: "The real fix (netsh winsock reset + reboot) exists only as an unbound Tier-0 catalog entry, so it can never run — correct for an L3 change; the DNS refresh now ends `not resolved` and the IT contact is told.",
    inject: (s) => { s.network.winsockOk = false; s.dns.staleEntries = 2; },
    resolved: (m) => m.state.network.winsockOk === true
  },
  {
    id: "print-driver-crash", level: "L3", title: "Printer driver crashing (driver reset)", recipe: "printer-driver-stuck-v1", color: "yellow", needsAdmin: false, path: "guide-only",
    fixKeys: [], report: "person", signal: "PRINT.DRIVER.STUCK",
    inject: (s) => { s.printQueue = { jobs: 1, frozen: true }; s.services.Spooler.hung = true; },
    resolved: (m) => !m.state.printQueue.frozen
  },
  {
    // FAULT LAB 2026-10-14 (defect 1) — SYSTEM.SERVICE.STOPPED.DHCP used to route to system-time-drift-v1 (a clock guide).
    // It now has svc-dhcp-stopped-v1: a Restart-Service that needs administrator rights (never unattended) and a gating
    // verify (service Running + lease present). Vendor-vetted (defect 4), so a fresh install asks for approval in
    // Confirmed instead of holding it — and in Autonomous it still goes to the IT contact (needs administrator rights).
    id: "dhcp-stopped", level: "L2", title: "DHCP Client service stopped", recipe: "svc-dhcp-stopped-v1", color: "green", needsAdmin: true, path: "escalate", kind: "needs-admin",
    fixKeys: ["services.Dhcp.restarts", "services.Dhcp.status"], report: "watcher",
    inject: (s) => { s.services.Dhcp.status = "Stopped"; },
    resolved: (m) => m.state.services.Dhcp.status === "Running"
  }
]);

export function faultById(id) { return FAULTS.find((f) => f.id === id) || null; }

// Faults that act on the same piece of state are never combined in one random sequence (their outcomes would be the
// state's, not the rule's): the print path, the network path, the DNS resolver, and Windows Update / BITS.
// A fault may sit in several groups (the DHCP lease is on both the resolver path and the Wi-Fi path).
export const CONFLICT_GROUPS = Object.freeze([
  ["spooler-stuck", "spooler-disabled", "print-driver-crash"],
  // (2026-10-14, defect 3) wlan-stopped joins the resolver path: dns-fail-v1's verify now really resolves a name, which needs
  // the network up — with WLAN stopped the DNS refresh is (correctly) NOT RESOLVED, so the two outcomes are no longer
  // independent. (The soak caught it: the old exit-code-only verify called that combination "fixed (verified)".)
  ["stale-dns", "dnscache-stopped", "dhcp-lease-stale", "winsock-corrupt", "wlan-stopped"],
  // (2026-10-14) dhcp-stopped joins the network path: a DHCP restart's lease check reads the same lease state.
  ["dhcp-lease-stale", "winsock-corrupt", "wlan-stopped", "dhcp-stopped"],
  ["wu-stuck", "bits-stopped"]
]);

/** Seeded pick of `count` distinct, non-conflicting fault ids (1–6 in the soak). Same seed → same faults. */
export function pickRandomFaults(seed, count) {
  const rnd = mulberry32(seed);
  const pool = FAULTS.map((f) => f.id);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [];
  for (const id of pool) {
    if (out.length >= count) break;
    if (CONFLICT_GROUPS.some((gr) => gr.includes(id) && out.some((x) => gr.includes(x)))) continue;
    out.push(id);
  }
  return out;
}

// ── the lab: a machine + the REAL main process booted on it ───────────────────────────────────────────────────────
const DEFAULT_TECH = [{ name: "Jordan Lee", email: "jordan@example.com", phone: "", role: "admin" }];

/**
 * bootLab(options) → lab
 *   mode            "autonomous" | "confirmed" | "manual"           (default autonomous)
 *   level           the autonomy level (default: the one the mode maps to)
 *   liveFixes       the live-fix consent (default true)
 *   profile         machine profile (default "standard"), strictAdmin, uac
 *   vetted          { recipeId: count } — earned vetted runs in recipe-history.json (≥10 = may run unattended)
 *   interval        advisoryIntervalMinutes (default 3) · snooze: advisorySnoozeHours (default 4)
 *   window          true → a maintenance window covering "now" (yellow fixes are considered only inside one)
 *   techContacts    the configured IT contacts (default one admin contact)
 *   trial           "active" (default) | "expired"
 *   storeSeed/machine — for a restart: the previous store snapshot and the SAME machine
 */
export async function bootLab(options = {}) {
  const startMs = options.startMs || Math.floor(Date.now() / MIN) * MIN;
  let machineRef = options.machine || null;
  const clock = options.clock || createLabClock(startMs, { busy: () => (machineRef ? machineRef.pendingChildren : 0) });
  const machine = machineRef || createVirtualWindows({ profile: options.profile || "standard", strictAdmin: options.strictAdmin === true, uac: options.uac || "approve", clock });
  machineRef = machine;
  if (!options.machine) {
    for (const f of options.preBaseline || []) { const fault = faultById(f); if (fault && fault.preBaseline) fault.preBaseline(machine.state); }
    machine.baseline();
  }
  const root = options.root || fs.mkdtempSync(path.join(os.tmpdir(), "fault-lab-"));
  const mode = options.mode || "autonomous";
  const level = options.level || { autonomous: "full-auto", confirmed: "safe-auto", manual: "approve-first" }[mode];
  let storeSeed = options.storeSeed || null;
  if (!storeSeed) {
    const t = new Date(clock.now());
    const hh = String(t.getHours()).padStart(2, "0"), mm = String(t.getMinutes()).padStart(2, "0");
    const prefs = {
      mode, identity: { kind: "business", orgName: "Acme Dental" }, deviceUser: { name: "Sam", email: "sam@example.com", phone: "", smsOptIn: false },
      techContacts: options.techContacts || DEFAULT_TECH, autonomyLevel: level, fullAutoUnderstood: level === "full-auto",
      approver: { mode: "self", contacts: [], timeoutMinutes: 1440, onTimeout: "skip" }, reportRecipients: [], reportCadence: "per-fix",
      maintenanceWindow: options.window ? { enabled: true, windows: [{ days: "daily", start: `${hh}:${mm}`, durationMin: 1440 }] } : { enabled: false, windows: [] },
      notifyChannels: { desktop: true, email: true, sms: false },
      advisoryIntervalMinutes: options.interval == null ? 3 : options.interval,
      ...(options.snooze != null ? { advisorySnoozeHours: options.snooze } : {})
    };
    storeSeed = { mode, liveFixesEnabled: options.liveFixes !== false, dryRun: options.liveFixes === false, setupConfig: { onboarding: { completed: true, skipped: false, step: 3, version: 1 }, setup: { completed: true, step: 12, prefs } } };
  }
  const booted = await bootMain({ clock, spawn: machine.spawn, storeSeed, root, env: {} });
  const { main } = booted;
  // userData/recipe-history.json — the vetted-count ledger the execution policy reads (earned trust).
  if (options.vetted && !options.storeSeed) {
    const recipes = {};
    for (const [id, n] of Object.entries(options.vetted)) recipes[id] = { vetted: n, runs: [], lastTs: clock.now() - 10 * 24 * 60 * MIN, tier: n >= 100 ? 0 : n >= 10 ? 1 : 2 };
    fs.writeFileSync(path.join(root, "userData", "recipe-history.json"), JSON.stringify({ recipes }));
  }
  // The trial: a fresh install starts it at first launch (main's own ensureTrialStarted); "expired" back-dates it.
  if (options.trial === "expired") {
    fs.mkdirSync(path.join(root, "home", ".aria-sentinel"), { recursive: true });
    fs.writeFileSync(path.join(root, "home", ".aria-sentinel", "trial.json"), JSON.stringify({ started_at: new Date(clock.now() - 45 * 24 * 60 * MIN).toISOString() }));
  } else if (!options.storeSeed) main.ensureTrialStarted();
  // Fake globe + app windows so the card pushes (sentinel:advisory) are observable.
  const overlay = new booted.FakeWindow({ width: 360, height: 420 });
  const appWin = new booted.FakeWindow({ width: 1366, height: 768 });
  main.__setWindows(overlay, appWin);
  main.startAdvisoryEscalation();
  await clock.settle();

  const lab = {
    clock, machine, main, ipc: booted.ipc, store: booted.store, root, booted,
    notifications: booted.notifications, outbound: booted.outbound, overlay, appWin,
    humanActions: [],
    /** Inject a fault (by id) into the machine. */
    inject(id) { const f = faultById(id); if (!f) throw new Error(`unknown fault ${id}`); f.inject(machine.state); return f; },
    /** Inject `count` seeded random faults (pass the same pick as `preBaseline` at boot for faults that need it). */
    injectRandom(seed, count) { const ids = pickRandomFaults(seed, count); for (const id of ids) lab.inject(id); return ids; },
    /** One watcher round → detectIssue for every signal (the REAL main path). Person-reported faults go through chat. */
    async detect({ person = [], poison = null } = {}) {
      const signals = machine.scan();
      for (const fid of person) { const f = faultById(fid); if (f && f.signal) signals.push({ signal: f.signal, hint: "user-report", watcher: "person" }); }
      const results = [];
      for (const s of signals) {
        const issue = poison ? `${s.hint} at ${poison}` : s.hint;
        // (defect 5) exactly what the detection orchestrator forwards: the fixed enum startType "disabled", nothing else.
        const startType = s.watcher !== "person" && s.startType === "disabled" ? { startType: "disabled" } : {};
        results.push({ ...s, result: await main.detectIssue({ source: s.watcher === "person" ? "chat" : "detection-watcher", signal: s.signal, issue, ...startType }) });
      }
      await clock.settle();
      return results;
    },
    advance: (ms) => clock.advance(ms),
    minutes: (n) => clock.advance(n * MIN),
    state: () => main.getState(),
    advisories: () => main.getState().advisories,
    audit: () => (main.store.get("transparencyLog") || []).slice().reverse(), // oldest first
    auditText: () => lab.audit().map((r) => `${r.tag}: ${r.text}`),
    advisoryRows: (recipeId) => lab.audit().filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/\d: /.test(r.text) && (!recipeId || r.recipeId === recipeId)),
    async ack(id, choice) { lab.humanActions.push({ at: clock.now(), kind: "ack", id, choice }); const r = await lab.ipc.invoke("sentinel:advisory-ack", { id, choice }); await clock.settle(); return r; },
    async approve(approvalId) { lab.humanActions.push({ at: clock.now(), kind: "approve", id: approvalId }); const r = await lab.ipc.invoke("sentinel:approve-fix", { id: approvalId }); await clock.settle(); return r; },
    async deny(approvalId) { lab.humanActions.push({ at: clock.now(), kind: "deny", id: approvalId }); const r = await lab.ipc.invoke("sentinel:deny-fix", { id: approvalId }); await clock.settle(); return r; },
    async kill() { lab.humanActions.push({ at: clock.now(), kind: "kill" }); const r = await lab.ipc.invoke("sentinel:kill-switch"); await clock.settle(); return r; },
    /** Close this main process and boot a fresh one on the SAME machine with the persisted store (an app restart). */
    async restart() { const seed = booted.store.snapshot(); booted.shutdown(); return bootLab({ ...options, machine, clock, root, storeSeed: seed, startMs }); },
    /** Every string the lab captured from main: audit · notifications · outbound bodies · window pushes · state. */
    capturedText() {
      return [
        JSON.stringify(main.store.get("transparencyLog") || []),
        JSON.stringify(booted.notifications),
        JSON.stringify(booted.outbound),
        JSON.stringify(booted.windows.map((w) => w.sent)),
        JSON.stringify(main.getState())
      ].join("\n");
    }
  };
  return lab;
}
