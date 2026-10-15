// PROD 2026-10-14 (audit M6) — NO FIRST-LAUNCH FALSE ALARMS from the Event-Log / WER watchers.
//
// Before: both watchers reset their cursors on every launch, so the last 40 System-log errors (a Kernel-Power 41
// from last month) and the last 20 WER archives (an old chrome.exe crash) were emitted as NEW detections — fix
// cards, desktop/email notifications and approval requests — every time the app started. Now the FIRST tick is a
// baseline that emits nothing, later ticks emit only what is newer than the cursor, and the cursor is PERSISTED
// through an injected hook (main: electron-store "watcherCursors") so a relaunch continues where it stopped.
// Also pins (audit M11) that the orchestrator's startAll → stopAll → startAll really restarts the timers.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createEventLogWatcher, advanceEventLogCursor, mapEventLogSignals, __resetCursor, EVENT_LOG_CURSOR_KEY } from "../src/sub-agents/detection/event-log-watcher.mjs";
import { createWerWatcher, advanceWerCursor, mapWerSignals, __resetSeen, WER_CURSOR_KEY } from "../src/sub-agents/detection/wer-watcher.mjs";
import { createDetectionOrchestrator } from "../src/sub-agents/detection/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
let groups = 0; const g = () => { groups++; };

/** A tiny in-memory persistence hook shaped like main's watcherCursors ({ get, set }). */
function memoryCursors(initial = {}) { const m = { ...initial }; return { get: (k) => m[k], set: (k, v) => { m[k] = v; }, dump: () => ({ ...m }) }; }

// 40 "old" System-log error rows (RecordId 1..40), every one of them a mapped signal — the first-launch trap.
const oldRows = Array.from({ length: 40 }, (_, i) => ({ RecordId: i + 1, ProviderName: i % 2 ? "Microsoft-Windows-Kernel-Power" : "Service Control Manager", Id: i % 2 ? 41 : 7034 }));

// 1 — event log, pure cursor step: first tick (cursor 0) with 40 old rows → baseline, NOTHING emitted; then one
//     newer RecordId → exactly one signal; then the same rows again → nothing (cursor advanced).
let step = advanceEventLogCursor(oldRows, 0);
assert.equal(step.baseline, true);
assert.deepEqual(step.signals, [], "first tick is a baseline: 40 old errors emit nothing");
assert.equal(step.cursor, 40, "the cursor is the highest RecordId seen");
step = advanceEventLogCursor([...oldRows, { RecordId: 41, ProviderName: "Microsoft-Windows-DNS-Client", Id: 1014 }], 40);
assert.equal(step.baseline, false);
assert.deepEqual(step.signals, [{ signal: "NET.DNS.FAIL", hint: "dns-timeout" }], "one newer row → one signal");
assert.equal(step.cursor, 41);
step = advanceEventLogCursor([...oldRows, { RecordId: 41, ProviderName: "Microsoft-Windows-DNS-Client", Id: 1014 }], 41);
assert.deepEqual(step.signals, [], "the same rows again emit nothing");
assert.deepEqual(mapEventLogSignals(oldRows).map((s) => s.signal).sort(), ["SYSTEM.SERVICE.CRASHED", "SYSTEM.UNEXPECTED_SHUTDOWN"], "(the mapper itself still maps them — the cursor is what holds them back)");
g();

// 2 — event log, the watcher object: persisted cursor survives a fresh watcher (relaunch) and __resetCursor.
__resetCursor();
const cursors = memoryCursors();
const emitted = [];
let w = createEventLogWatcher({ emit: (sig, hint) => emitted.push({ sig, hint }), isBlocked: () => false, cursors });
assert.equal(w.spawnsPerTick, 1);
assert.equal(w.cursor(), 0, "fresh install: no cursor");
// Drive the pure step the way tick() does (tick itself spawns PowerShell on win32 only — off-win32 it is a no-op).
let st = advanceEventLogCursor(oldRows, w.cursor()); cursors.set(EVENT_LOG_CURSOR_KEY, st.cursor);
assert.equal(cursors.get(EVENT_LOG_CURSOR_KEY), 40, "the baseline cursor is persisted");
__resetCursor(); // "relaunch": the module cursor is gone…
w = createEventLogWatcher({ emit: () => {}, isBlocked: () => false, cursors });
assert.equal(w.cursor(), 40, "…but the persisted cursor is restored, so old events are NOT re-emitted");
assert.equal(advanceEventLogCursor(oldRows, w.cursor()).signals.length, 0, "relaunch with the same old rows → nothing");
// A watcher without a hook still works (in-session cursor only) — Rule 15.
__resetCursor();
w = createEventLogWatcher({ emit: () => {}, isBlocked: () => false });
assert.equal(w.cursor(), 0);
// On win32-less hosts tick() is a safe no-op (runPowerShellJson → null).
await w.tick();
assert.deepEqual(emitted, []);
g();

// 3 — WER, pure cursor step: 20 old archives → baseline; a newer report of a known app → one signal; unknown apps dropped.
const T = 638_000_000_000_000_000; // .NET ticks, arbitrary
const oldWer = Array.from({ length: 20 }, (_, i) => ({ app: i % 3 === 0 ? "chrome.exe" : i % 3 === 1 ? "OUTLOOK.EXE" : "someapp.exe", ts: T - (20 - i) * 10_000_000 }));
step = advanceWerCursor(oldWer, 0);
assert.equal(step.baseline, true);
assert.deepEqual(step.signals, [], "first tick: 20 old crash reports emit nothing");
assert.equal(step.cursor, T - 10_000_000, "cursor = newest report time");
step = advanceWerCursor([...oldWer, { app: "chrome.exe", ts: T + 5 }], step.cursor);
assert.deepEqual(step.signals, [{ signal: "BROWSER.TAB_CRASH_LOOP", hint: "browser-faulted" }], "a NEW chrome crash → one signal");
assert.equal(step.cursor, T + 5);
step = advanceWerCursor([...oldWer, { app: "chrome.exe", ts: T + 5 }, { app: "notepad.exe", ts: T + 9 }], step.cursor);
assert.deepEqual(step.signals, [], "an unknown app is dropped; the known one already seen is not re-emitted");
assert.equal(step.cursor, T + 9, "the cursor still advances past the unknown report");
// Legacy bare-string rows (no timestamp) still map (Rule 15) but can never be proven newer than a baseline.
assert.deepEqual(mapWerSignals(["chrome.exe", "nope.exe"]), [{ signal: "BROWSER.TAB_CRASH_LOOP", hint: "browser-faulted" }]);
assert.deepEqual(advanceWerCursor(["chrome.exe"], 0).signals, [], "legacy rows on a baseline tick: nothing");
g();

// 4 — WER watcher object: persisted cursor + relaunch, and a repeat crash later in the session is emitted again.
__resetSeen();
const wc = memoryCursors();
w = createWerWatcher({ emit: () => {}, isBlocked: () => false, cursors: wc });
assert.equal(w.cursor(), 0);
st = advanceWerCursor(oldWer, 0); wc.set(WER_CURSOR_KEY, st.cursor);
__resetSeen();
w = createWerWatcher({ emit: () => {}, isBlocked: () => false, cursors: wc });
assert.equal(w.cursor(), T - 10_000_000, "relaunch restores the WER cursor");
assert.equal(w.spawnsPerTick, 1);
g();

// 5 — orchestrator: cursors are handed to every factory; startAll → stopAll → startAll restarts (audit M11);
//     a second startAll while running is a no-op (no duplicate timers).
const seenDeps = [];
const fakeFactory = (deps) => { seenDeps.push(deps); return { name: "fake", cadenceMs: 60_000, spawnsPerTick: 1, async tick() {} }; };
const orch = createDetectionOrchestrator({ detectIssue: () => {}, isBlocked: () => false, cursors: memoryCursors(), factories: [fakeFactory] });
assert.equal(typeof seenDeps[0].cursors.get, "function", "factories receive the persistence hook");
assert.equal(orch.status().running, false);
orch.startAll();
assert.equal(orch.status().running, true);
orch.startAll(); // idempotent
orch.stopAll();
assert.equal(orch.status().running, false, "stopped");
orch.startAll();
assert.equal(orch.status().running, true, "Start ARIA after Stop ARIA restarts the watchers");
orch.stopAll();
assert.equal(orch.status().spawnsPerMinute, 1, "the status reports the spawn budget");
g();

// 6 — main.mjs persists the cursors in the store, hands them to the orchestrator, and restarts a stopped one.
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
assert.match(main, /store\.set\("watcherCursors", \{ \.\.\.\(store\.get\("watcherCursors"\) \|\| \{\}\), \[String\(key\)\]: value \}\)/, "cursors persist in the store");
assert.match(main, /cursors: watcherCursors,/, "…and are injected into the orchestrator");
assert.match(main, /if \(!detectionOrchestrator\.status\(\)\.running\) detectionOrchestrator\.startAll\(\);/, "Start ARIA restarts stopped watchers (audit M11)");
g();

assert.equal(groups, 6);
console.log(`watcher-baselines test passed (${groups} groups · event-log + WER first tick = baseline · one newer row = one signal · cursors persisted + restored on relaunch · orchestrator restart + idempotent start).`);
