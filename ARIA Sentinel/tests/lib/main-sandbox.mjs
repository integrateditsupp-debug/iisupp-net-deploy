// FAULT LAB (2026-10-14) — boot the REAL src/main/main.mjs on an injected, virtual platform.
//
// Why this exists: the advise-three-times rule lives in main.mjs, wired into the production pipeline (runSupervisedFix →
// executor → verify → audit → notify). A test that re-implemented that pipeline would only prove itself. This harness
// instead evaluates main.mjs's own source — every function, every gate, every IPC handler — with its 100+ real module
// imports bound to the real modules, and ONLY the platform faked:
//   electron        → windows/notifications/IPC recorders (no UI)              node:child_process → the lab's spawn
//   electron-store  → an in-memory store (seedable, so a "restart" is a re-boot) node:http → a no-op server (no port)
//   node:os         → homedir/hostname of the virtual machine                    process → platform "win32"
//   Date + timers   → the lab clock (virtual time; nothing waits in real time)   fetch → a recorder (NO network)
// Real modules that read the wall clock inside a synchronous call see the lab clock too (a scoped Date swap around every
// imported function — synchronous, so no other code can observe it); the four factories that keep their own clock or
// timers (countdown · outbound · approvals · notify) get the lab clock injected through their documented options.
//
// The source is compiled ONCE (vm.compileFunction, same realm — no cross-realm Set/Array surprises) and instantiated per
// boot, so every boot is a fresh main process. Nothing here touches the network, a real PowerShell, or a real port.
// 🔒 The only paths main sees are the virtual machine's home/userData folders under the test scratch dir.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";

import { setActiveLabSpawn, activeLabSpawn as _activeLabSpawn } from "./spawn-guard.mjs";
/** Test seam: which spawn the guard currently routes Windows tools to (null = ENOENT like Linux). */
export function activeLabSpawn() { return _activeLabSpawn(); }

export const APP_ROOT = path.resolve(import.meta.dirname, "..", "..");
export const MAIN_FILE = path.join(APP_ROOT, "src", "main", "main.mjs");
const MAIN_URL = pathToFileURL(MAIN_FILE).href;
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf8")).version;

// The main.mjs internals the lab drives or reads. A name that disappears from main.mjs makes boot fail LOUDLY.
export const MAIN_INTERNALS = Object.freeze([
  "store", "getState", "detectIssue", "addDetection", "autoFireIfEligible", "runSupervisedFix", "runRecipe",
  "advisoryMachine", "advisoryTick", "handleAdvisoryAck", "startAdvisoryEscalation", "advisoryTrackFor",
  "activateKillSwitch", "ensureTrialStarted", "approvals", "countdownManager", "cancelCountdown", "logEvent",
  "setLiveFixes", "recipeNeedsAdmin", "recipeColor",
  // KILL GATE 2026-10-14 (review P0-2) — the one gate, the launch-time watcher start, the bridge's /run-recipe and the poll.
  "killGateReason", "startDetectionAtLaunch", "bridgeRunRecipe", "approvalTick",
  // REVIEW P2-6 — the before-quit step that cancels a running countdown (a clean quit), so a suite can quit, then relaunch.
  "cancelCountdownsForQuit",
  // REVIEW P1-3 / P2-9 — the licence + trial surface (what the cache is worth, the trial clock, the consent gate).
  "refreshLicense", "enterLicense", "licenseStatus", "gateStatus", "trialState", "sendHeartbeat", "touchClockHighWater", "currentIsAdmin",
  // REVIEW P2-11 — the "What's new" loader (finds the shipped notes inside the package or in process.resourcesPath).
  "readReleaseNotes"
]);
// Platform globals main.mjs reads that the lab must own (shadowed as function parameters).
const SHADOWED = ["process", "Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "fetch"];

const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+"([^"]+)";?[^\n]*$/gm;

let compiled = null; // { fn, names, imports }

function parseImports(src) {
  const out = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) out.push({ clause: m[1].trim(), spec: m[2] });
  return out;
}

function localNames(clause) {
  const names = [];
  const ns = clause.match(/^\*\s+as\s+(\w+)$/);
  if (ns) return [{ kind: "ns", local: ns[1] }];
  const def = clause.match(/^(\w+)\s*(?:,|$)/);
  if (def && !clause.startsWith("{")) names.push({ kind: "default", local: def[1] });
  const named = clause.match(/\{([\s\S]*)\}/);
  if (named) {
    for (const part of named[1].split(",").map((s) => s.replace(/\/\/[^\n]*/g, "").trim()).filter(Boolean)) {
      const [orig, local] = part.split(/\s+as\s+/).map((s) => s.trim());
      names.push({ kind: "named", orig, local: local || orig });
    }
  }
  return names;
}

/** Compile main.mjs once: imports stripped (bound as parameters), `export` dropped, import.meta.url pinned. */
async function compileMain() {
  if (compiled) return compiled;
  const src = fs.readFileSync(MAIN_FILE, "utf8");
  const imports = parseImports(src);
  const realMods = {};
  for (const imp of imports) {
    if (imp.spec.startsWith(".")) realMods[imp.spec] = await import(new URL(imp.spec, MAIN_URL).href);
    else if (!["electron", "electron-store", "node:child_process", "node:http", "node:os"].includes(imp.spec)) realMods[imp.spec] = await import(imp.spec);
  }
  const bindingNames = [];
  for (const imp of imports) for (const n of localNames(imp.clause)) bindingNames.push(n.local);
  if (new Set(bindingNames).size !== bindingNames.length) throw new Error("main-sandbox: duplicate import binding in main.mjs");
  let body = src.replace(IMPORT_RE, (t) => t.replace(/[^\n]/g, " "));
  body = body.replace(/^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm, "");
  body = body.split("import.meta.url").join(JSON.stringify(MAIN_URL));
  body = body.replace(/await import\("electron-updater"\)/g, 'await Promise.reject(new Error("electron-updater is not part of the fault lab"))');
  body = `"use strict";\n${body}\n;return { ${MAIN_INTERNALS.join(", ")}, __setWindows: (o, m) => { overlayWindow = o; mainWindow = m; } };`;
  const names = [...bindingNames, ...SHADOWED];
  const fn = vm.compileFunction(body, names, { filename: MAIN_FILE });
  compiled = { fn, names, imports, realMods };
  return compiled;
}

/** A Date class whose "now" is the lab clock (constructor with no args + Date.now). */
export function makeLabDate(clock) {
  const Real = Date;
  return class LabDate extends Real {
    constructor(...args) { if (args.length === 0) super(clock.now()); else super(...args); }
    static now() { return clock.now(); }
  };
}

/** In-memory electron-store: get/set(key|object)/delete/has/store, seeded from a snapshot (a "restart" re-uses it). */
export function makeFakeStoreClass(seed, sink) {
  return class FakeStore {
    constructor(opts = {}) {
      const defaults = JSON.parse(JSON.stringify(opts.defaults || {}));
      this.data = seed ? { ...defaults, ...JSON.parse(JSON.stringify(seed)) } : defaults;
      if (sink) sink.store = this;
    }
    get(key, dflt) { return Object.prototype.hasOwnProperty.call(this.data, key) && this.data[key] !== undefined ? this.data[key] : dflt; }
    set(key, value) {
      if (key && typeof key === "object") { for (const [k, v] of Object.entries(key)) this.data[k] = v === undefined ? undefined : JSON.parse(JSON.stringify(v)); return; }
      this.data[key] = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    }
    delete(key) { delete this.data[key]; }
    has(key) { return Object.prototype.hasOwnProperty.call(this.data, key); }
    clear() { this.data = {}; }
    get store() { return this.data; }
    snapshot() { return JSON.parse(JSON.stringify(this.data)); }
  };
}

const noop = () => undefined;
/** An object whose every method is a recorded no-op (for the Electron surfaces the lab does not care about). */
function inert(name, calls) {
  return new Proxy({}, { get(_t, prop) { if (prop === "then") return undefined; return (...args) => { calls.push({ api: `${name}.${String(prop)}`, args }); return undefined; }; } });
}

class FakeWebContents extends EventEmitter {
  constructor(win) { super(); this.win = win; this.sent = win.sent; }
  send(channel, payload) { this.sent.push({ channel, payload: payload === undefined ? undefined : JSON.parse(JSON.stringify(payload)) }); }
  isDestroyed() { return this.win.destroyed; }
  setWindowOpenHandler() {}
  executeJavaScript() { return Promise.resolve(); }
  openDevTools() {}
  getURL() { return "file:///lab"; }
}

/** Build the per-boot fake Electron module. Every window's sends and every desktop notification are recorded. */
export function makeFakeElectron({ userData, home, recorder }) {
  const windows = [];
  const handlers = new Map();
  class FakeWindow extends EventEmitter {
    constructor(opts = {}) {
      super();
      this.opts = opts; this.sent = []; this.destroyed = false; this.visible = false;
      this.bounds = { x: Number(opts.x) || 0, y: Number(opts.y) || 0, width: Number(opts.width) || 800, height: Number(opts.height) || 600 };
      this.webContents = new FakeWebContents(this);
      windows.push(this);
      return new Proxy(this, { get(t, prop) { if (prop in t) return t[prop]; if (prop === "then") return undefined; return () => undefined; } });
    }
    static getAllWindows() { return windows.filter((w) => !w.destroyed); }
    static fromWebContents() { return null; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
    close() { this.destroyed = true; }
    isVisible() { return this.visible; }
    show() { this.visible = true; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    getBounds() { return { ...this.bounds }; }
    setBounds(b) { this.bounds = { ...this.bounds, ...b }; }
    getPosition() { return [this.bounds.x, this.bounds.y]; }
    getSize() { return [this.bounds.width, this.bounds.height]; }
    loadFile() { return Promise.resolve(); }
    loadURL() { return Promise.resolve(); }
    once(ev, fn) { return super.once(ev, fn); }
  }
  const notifications = [];
  class FakeNotification extends EventEmitter {
    static isSupported() { return true; }
    constructor(opts = {}) { super(); this.opts = { title: String(opts.title || ""), body: String(opts.body || "") }; }
    show() { notifications.push({ ...this.opts, at: recorder.now() }); }
  }
  const calls = [];
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 }, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, id: 1 };
  const electron = {
    app: {
      isReady: () => true, isPackaged: true, getVersion: () => PKG_VERSION, getName: () => "ARIA Sentinel",
      getPath: (name) => { const p = name === "home" ? home : path.join(userData, String(name)); fs.mkdirSync(p, { recursive: true }); return name === "userData" ? userData : p; },
      getAppPath: () => APP_ROOT, getLocale: () => "en-CA", getPreferredSystemLanguages: () => ["en-CA"],
      setAsDefaultProtocolClient: () => true, requestSingleInstanceLock: () => true, on: noop, once: noop, off: noop,
      whenReady: () => new Promise(() => {}), quit: noop, exit: noop, relaunch: noop, focus: noop,
      setLoginItemSettings: noop, getLoginItemSettings: () => ({ openAtLogin: false }), setAppUserModelId: noop
    },
    BrowserWindow: FakeWindow,
    Menu: { setApplicationMenu: noop, buildFromTemplate: () => inert("menu", calls) },
    Tray: class { constructor() { return inert("tray", calls); } },
    nativeImage: { createFromDataURL: () => inert("image", calls), createFromPath: () => inert("image", calls), createEmpty: () => inert("image", calls) },
    ipcMain: {
      handle: (name, fn) => { if (handlers.has(name)) throw new Error(`fault-lab: duplicate ipcMain.handle("${name}")`); handlers.set(name, fn); },
      removeHandler: (name) => handlers.delete(name), on: noop, once: noop
    },
    shell: { openExternal: async (u) => { calls.push({ api: "shell.openExternal", args: [String(u)] }); }, openPath: async () => "" },
    screen: { getPrimaryDisplay: () => display, getDisplayNearestPoint: () => display, getCursorScreenPoint: () => ({ x: 960, y: 540 }), getAllDisplays: () => [display], on: noop },
    session: { defaultSession: inert("session", calls) },
    globalShortcut: { register: () => true, isRegistered: () => true, unregister: noop, unregisterAll: noop },
    powerMonitor: { on: noop },
    clipboard: { writeText: noop, readText: () => "" },
    Notification: FakeNotification
  };
  return { electron, windows, handlers, notifications, calls, FakeWindow };
}

/** The fake process main.mjs sees: Windows, packaged, no developer override of the live-fix consent. */
export function makeFakeProcess({ env = {}, resourcesPath = "C:\\Program Files\\ARIA Sentinel\\resources" } = {}) {
  const ev = new EventEmitter();
  return {
    platform: "win32", arch: "x64", type: "browser", pid: 4242,
    env: { ...env }, argv: ["C:\\Program Files\\ARIA Sentinel\\ARIA Sentinel.exe"],
    execPath: "C:\\Program Files\\ARIA Sentinel\\ARIA Sentinel.exe", resourcesPath,
    defaultApp: false, versions: process.versions, exitCode: undefined,
    on: (...a) => { ev.on(...a); }, once: (...a) => { ev.once(...a); }, off: (...a) => { ev.off(...a); }, removeListener: (...a) => { ev.removeListener(...a); },
    nextTick: process.nextTick.bind(process), hrtime: process.hrtime, memoryUsage: process.memoryUsage.bind(process),
    cwd: () => APP_ROOT, uptime: () => 60, getSystemMemoryInfo: () => ({ total: 16 * 1024 * 1024, free: 8 * 1024 * 1024 })
  };
}

/**
 * fetch recorder — NO network, ever. Only allow-listed hosts reach it (outbound.mjs refuses the rest first).
 * `respond(url, init)` (optional, 2026-10-14 review P0-2) lets a suite answer a call — e.g. the approval poll saying
 * "approved" — with a JSON body of its own; undefined keeps the default answer.
 */
export function makeFakeFetch(outboundLog, clock, respond = null) {
  return async (url, init = {}) => {
    const u = String(url);
    outboundLog.push({ url: u, method: String(init.method || "GET"), body: typeof init.body === "string" ? init.body : init.body == null ? "" : String(init.body), at: clock.now() });
    const custom = typeof respond === "function" ? respond(u, init) : undefined;
    const json = custom !== undefined ? custom : /aria-sentinel-notify/.test(u) ? { ok: true, email: { sent: 1 }, sms: { sent: 0, dormant: true } } : { ok: true };
    return { ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json), headers: { get: () => null } };
  };
}

function wrapWithLabDate(fn, LabDate) {
  if (typeof fn !== "function") return fn;
  if (/^class\b/.test(Function.prototype.toString.call(fn))) return fn;
  const wrapped = function (...args) {
    const prev = globalThis.Date;
    globalThis.Date = LabDate;
    try { return new.target ? Reflect.construct(fn, args, fn) : fn.apply(this, args); }
    finally { globalThis.Date = prev; }
  };
  Object.defineProperty(wrapped, "name", { value: fn.name });
  return wrapped;
}

/**
 * Boot one main process on a virtual platform.
 * @param {object} platform
 *   clock        — { now(), setTimeout, setInterval, clearTimeout, clearInterval } (the lab clock)
 *   spawn        — (file, args, opts) → ChildProcess-like (the lab's PowerShell / reg interpreter)
 *   storeSeed    — electron-store data to start from (a restart passes the previous snapshot)
 *   root         — a scratch directory for this machine (home + userData live under it)
 *   env          — process.env for main (default: empty → the stored live-fix consent decides)
 *   respond      — (url, init) → JSON | undefined: answer an outbound call (default: { ok: true })
 *   licenseVerify — (verdict, sig) → boolean: the licence-verdict check main's cache decisions use (default: the
 *                  embedded production public key) — REVIEW P1-3, for verdicts signed with a throwaway test pair
 *   resourcesPath — process.resourcesPath main sees (REVIEW P2-11: where a packaged build keeps app.asar / resources)
 * @returns {{ main, ipc, windows, notifications, outbound, store, electronCalls }}
 */
export async function bootMain(platform = {}) {
  const c = await compileMain();
  const clock = platform.clock;
  if (!clock || typeof clock.now !== "function") throw new Error("main-sandbox: a lab clock is required");
  const LabDate = makeLabDate(clock);
  // Per-boot timers on the shared lab clock, so a "restart" can stop the old process completely (shutdown()).
  const bootTimers = new Set();
  const track = (h) => { bootTimers.add(h.id); return h; };
  const timers = {
    setTimeout: (...a) => track(clock.setTimeout(...a)),
    setInterval: (...a) => track(clock.setInterval(...a)),
    clearTimeout: (h) => { clock.clearTimeout(h); },
    clearInterval: (h) => { clock.clearInterval(h); }
  };
  const root = platform.root || fs.mkdtempSync(path.join(os.tmpdir(), "fault-lab-"));
  const home = path.join(root, "home");
  const userData = path.join(root, "userData");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
  const recorder = { now: () => clock.now() };
  const fakeE = makeFakeElectron({ userData, home, recorder });
  const storeSink = {};
  const FakeStore = makeFakeStoreClass(platform.storeSeed || null, storeSink);
  const outboundLog = [];
  const fakeFetch = makeFakeFetch(outboundLog, clock, platform.respond || null);
  const fakeOs = { ...os, default: undefined, homedir: () => home, hostname: () => "LAB-PC", platform: () => "win32", tmpdir: () => path.join(root, "tmp"), userInfo: () => ({ username: "labuser", homedir: home }) };
  delete fakeOs.default;
  fs.mkdirSync(path.join(root, "tmp"), { recursive: true });
  const special = {
    electron: fakeE.electron,
    "electron-store": { default: FakeStore },
    "node:child_process": { spawn: platform.spawn || (() => { throw new Error("fault-lab: no spawn wired"); }), default: undefined },
    "node:http": { createServer: () => ({ listen: noop, on: noop, close: noop, address: () => ({ port: 0 }) }) },
    "node:os": { ...fakeOs, default: fakeOs }
  };
  // Factories that keep their own clock / timers / network get the lab's (through their documented options).
  // The process-wide guard (top of this file) routes every Windows-tool spawn in ANY module to this boot's machine.
  if (typeof platform.spawn === "function") setActiveLabSpawn(platform.spawn);
  const shims = {
    createCountdown: (real) => (opts = {}) => real({ setIntervalFn: timers.setInterval, clearIntervalFn: timers.clearInterval, ...opts }),
    createOutbound: (real) => (opts = {}) => real({ ...opts, fetchImpl: fakeFetch, now: clock.now }),
    createApprovalsFlow: (real) => (deps = {}) => real({ now: clock.now, ...deps }),
    createNotifyDispatcher: (real) => (deps = {}) => real({ now: clock.now, ...deps })
  };
  // REVIEW P1-3 — `licenseVerify(verdict, sig)` (optional) replaces the embedded public key in main's cache decisions, so a
  // suite can sign verdicts with a THROWAWAY Ed25519 pair. Test-only: main.mjs itself has no way to change the key.
  if (typeof platform.licenseVerify === "function") {
    const withVerify = (real) => wrapWithLabDate((cache, nowMs, opts = {}) => real(cache, nowMs, { ...opts, verify: platform.licenseVerify }), LabDate);
    shims.effectiveFromCache = withVerify;
    shims.cacheIsFresh = withVerify;
  }
  const values = [];
  for (const imp of c.imports) {
    const mod = special[imp.spec] || c.realMods[imp.spec];
    if (!mod) throw new Error(`main-sandbox: unresolved import ${imp.spec}`);
    for (const n of localNames(imp.clause)) {
      let v;
      if (n.kind === "ns") { v = {}; for (const [k, val] of Object.entries(mod)) v[k] = wrapWithLabDate(val, LabDate); }
      else if (n.kind === "default") v = mod.default;
      else {
        if (!(n.orig in mod)) throw new Error(`main-sandbox: ${imp.spec} has no export "${n.orig}"`);
        v = mod[n.orig];
        if (special[imp.spec] === undefined) v = shims[n.orig] ? shims[n.orig](v) : wrapWithLabDate(v, LabDate);
      }
      values.push(v);
    }
  }
  const fakeProcess = makeFakeProcess({ env: platform.env || {}, ...(platform.resourcesPath ? { resourcesPath: platform.resourcesPath } : {}) });
  const shadow = { process: fakeProcess, Date: LabDate, setTimeout: timers.setTimeout, setInterval: timers.setInterval, clearTimeout: timers.clearTimeout, clearInterval: timers.clearInterval, fetch: fakeFetch };
  for (const name of SHADOWED) values.push(shadow[name]);
  const main = c.fn(...values);
  const ipc = {
    handlers: fakeE.handlers,
    async invoke(name, ...args) {
      const h = fakeE.handlers.get(name);
      if (!h) throw new Error(`fault-lab: no ipcMain handler "${name}"`);
      return h({ sender: { id: 1 } }, ...args);
    }
  };
  /** The process exits: every timer it owns is cleared (its countdowns die with it, like a real quit). */
  const shutdown = () => { for (const id of bootTimers) clock.clearTimeout(id); bootTimers.clear(); if (_activeLabSpawn() === platform.spawn) setActiveLabSpawn(null); };
  return { main, ipc, windows: fakeE.windows, FakeWindow: fakeE.FakeWindow, notifications: fakeE.notifications, outbound: outboundLog, store: storeSink.store, electronCalls: fakeE.calls, root, shutdown };
}
