// Detection orchestrator — starts all 7 Windows watchers, routes their symbolic
// signals into the main process's content-blind detectIssue() path, and honours the
// pause + global kill switch at every tick.
//
// Each watcher emits ONLY a fixed symbolic code + an enum hint. No file path, machine
// name, URL or user string is ever handed to emit(). The orchestrator's emit() wrapper
// re-checks isBlocked() and debounces per-signal so a flapping source can't spam.
import { createDiskWatcher } from "./disk-watcher.mjs";
import { createEventLogWatcher } from "./event-log-watcher.mjs";
import { createPerfWatcher } from "./perf-watcher.mjs";
import { createCrashControlWatcher } from "./crash-control-watcher.mjs";
import { createServiceWatcher } from "./service-watcher.mjs";
import { createNetworkWatcher } from "./network-watcher.mjs";
import { createWerWatcher } from "./wer-watcher.mjs";
import { createDiskWatcher as createMacDiskWatcher } from "./macos/disk-watcher.mjs";
import { createEventLogWatcher as createMacEventLogWatcher } from "./macos/event-log-watcher.mjs";
import { createPerfWatcher as createMacPerfWatcher } from "./macos/perf-watcher.mjs";
import { createCrashWatcher as createMacCrashWatcher } from "./macos/crash-watcher.mjs";
import { createNetworkWatcher as createMacNetworkWatcher } from "./macos/network-watcher.mjs";

// Windows ships 7 watchers; macOS ships 5 native mirrors. Factories are selected ONCE by platform,
// so a Windows build never puts a Mac-command watcher in its live set (and vice-versa). Both lists
// are exported so the test suites can assert their shapes without toggling process.platform.
export const WINDOWS_WATCHER_FACTORIES = [
  createDiskWatcher,
  createEventLogWatcher,
  createPerfWatcher,
  createCrashControlWatcher,
  createServiceWatcher,
  createNetworkWatcher,
  createWerWatcher
];

export const MACOS_WATCHER_FACTORIES = [
  createMacDiskWatcher,
  createMacEventLogWatcher,
  createMacPerfWatcher,
  createMacCrashWatcher,
  createMacNetworkWatcher
];

const WATCHER_FACTORIES = process.platform === "darwin" ? MACOS_WATCHER_FACTORIES : WINDOWS_WATCHER_FACTORIES;

const DEBOUNCE_MS = 5 * 60 * 1000; // never emit the same signal more than once / 5 min

/**
 * @param {object} deps
 * @param {(input:{source:string,signal:string,issue:string})=>any} deps.detectIssue
 * @param {()=>boolean} deps.isBlocked   - true when paused OR globally killed
 * @param {(tag:string,text:string)=>void} [deps.logger]
 * @param {(name:string,err:Error)=>void} [deps.onError]
 */
export function createDetectionOrchestrator(deps = {}) {
  const detectIssue = deps.detectIssue || (() => {});
  const externalBlocked = deps.isBlocked || (() => false);
  const logger = deps.logger || (() => {});
  const onError = deps.onError || (() => {});

  let pausedUntil = 0;
  let lastTick = 0;
  let started = false;
  const lastEmit = new Map();
  const timers = [];

  const isBlocked = () => externalBlocked() || pausedUntil > Date.now();

  const emit = (signal, hint) => {
    if (isBlocked()) return;
    if (typeof signal !== "string" || !signal) return;
    const now = Date.now();
    const prev = lastEmit.get(signal) || 0;
    if (now - prev < DEBOUNCE_MS) return; // per-signal debounce
    lastEmit.set(signal, now);
    try {
      // Contract: signal is a symbolic enum, hint is an enum string. No raw content.
      detectIssue({ source: "detection-watcher", signal, issue: String(hint || signal) });
    } catch (err) {
      onError("emit", err instanceof Error ? err : new Error(String(err)));
    }
  };

  const watchers = WATCHER_FACTORIES.map((factory) => factory({ emit, isBlocked }));

  const safeTick = async (watcher) => {
    lastTick = Date.now();
    try {
      await watcher.tick();
    } catch (err) {
      // A watcher failure must never crash the agent. Log symbolically and continue.
      onError(watcher.name, err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    watchers,
    startAll() {
      logger("DETECT", `Detection orchestrator starting ${watchers.length} watchers.`);
      started = true;
      for (const watcher of watchers) {
        if (watcher.runAtStartup) safeTick(watcher);
        const timer = setInterval(() => safeTick(watcher), watcher.cadenceMs);
        timer.unref?.();
        timers.push(timer);
      }
      return this;
    },
    status() {
      return {
        running: started && timers.length > 0,
        count: watchers.length,
        lastTickAgeMs: lastTick ? Date.now() - lastTick : null
      };
    },
    stopAll() {
      while (timers.length) clearInterval(timers.pop());
      logger("DETECT", "Detection orchestrator stopped all watchers.");
    },
    pauseAll(ms = 24 * 60 * 60 * 1000) {
      pausedUntil = Date.now() + Math.max(0, Number(ms) || 0);
      logger("WATCH", `Detection watchers paused for ${Math.round((Number(ms) || 0) / 60000)} min.`);
    },
    resume() {
      pausedUntil = 0;
      logger("WATCH", "Detection watchers resumed.");
    },
    isBlocked
  };
}
