// RUN 19 §3 — panic kill-switch (Ctrl+Alt+K). Single purpose: kill ARIA child processes, undo the last
// action, dim the globe. The pure decision layer is tested here; main.mjs wiring is asserted by source.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KILL_HOTKEY, KILL_TOAST, buildKillResult, pickUndoTarget } from "../src/shared/kill-switch.mjs";

// Hotkey definition: Ctrl+Alt+K with the Ctrl+Shift+Pause fallback, single danger action.
assert.equal(KILL_HOTKEY.combo, "CommandOrControl+Alt+K");
assert.equal(KILL_HOTKEY.fallback, "CommandOrControl+Shift+Pause");
assert.equal(KILL_HOTKEY.action, "kill-aria");
assert.equal(KILL_HOTKEY.danger, true);

// pickUndoTarget = newest restore point that is NOT already rolled back.
assert.equal(pickUndoTarget([]), null);
assert.equal(pickUndoTarget([{ id: "a", rolledBack: true }, { id: "b" }]).id, "b", "skips already-rolled-back points");
assert.equal(pickUndoTarget([{ id: "x" }, { id: "y" }]).id, "x", "newest-first → first un-rolled-back");

// buildKillResult: counts children, picks the undo target, dims the globe, carries the toast.
const r = buildKillResult({ children: [{}, {}, {}], restorePoints: [{ id: "rp1" }] });
assert.equal(r.killedCount, 3);
assert.equal(r.undoId, "rp1");
assert.equal(r.undone, true);
assert.equal(r.globeState, "dim");
assert.equal(r.toast, KILL_TOAST);
assert.match(r.toast, /terminated/i);
assert.match(r.toast, /undone/i);

// No restore point → still terminates, just nothing to undo.
const r2 = buildKillResult({ children: [{}], restorePoints: [] });
assert.equal(r2.killedCount, 1);
assert.equal(r2.undone, false);
assert.equal(r2.undoId, null);

// main.mjs wiring: tracks children, registers the kill hotkey via the hardened binder, kills with SIGKILL,
// rolls back the last action, dims the globe, and sends the renderer toast — all synchronously (≤2s).
const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
assert.match(main, /const childProcesses = new Set\(\)/, "tracks every spawned child");
assert.match(main, /childProcesses\.add\(child\)/, "registers spawned children");
assert.match(main, /function activateKillSwitch\(\)/, "kill-switch handler exists");
assert.match(main, /function killAllChildren\(\)/, "kills all tracked children");
assert.match(main, /child\.kill\("SIGKILL"\)/, "terminates immediately with SIGKILL");
assert.match(main, /registerWithFallback\(\s*KILL_HOTKEY/, "kill hotkey bound via the hardened binder");
assert.match(main, /rollbackRestorePoint\(result\.undoId\)/, "undoes the last action on kill");
assert.match(main, /webContents\.send\("sentinel:kill-switch"/, "notifies the renderer (toast + dim globe)");
// Single purpose: the handler must not open a menu/dialog or sleep before acting.
const handler = main.match(/function activateKillSwitch\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(handler, "handler body found");
assert.doesNotMatch(handler[0], /setTimeout|dialog\.show|Menu\.|prompt\(/, "kill-switch does nothing but kill+undo (no prompt/menu/delay)");

// preload exposes the kill-switch listener + manual trigger.
const preload = fs.readFileSync(path.join(root, "src", "main", "preload.cjs"), "utf8");
assert.match(preload, /onKillSwitch:/, "preload exposes onKillSwitch");
assert.match(preload, /killSwitch:/, "preload exposes manual killSwitch");

// renderer reacts: dims the globe + shows the danger toast.
const rendererJs = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
assert.match(rendererJs, /onKillSwitch\?\.\(/, "renderer subscribes to the kill-switch event");
assert.match(rendererJs, /setGlobeState\("dim"\)/, "renderer dims the globe on kill");

console.log("Kill-switch-hotkey test passed (Ctrl+Alt+K · SIGKILL children · undo last action · dim globe · single-purpose).");
