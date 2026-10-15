// spawn-guard.mjs — a test battery never reaches the machine it runs on (found on the operator's Windows PC, 2026-10-15).
//
// The fault lab boots the REAL src/main/main.mjs with `node:child_process` swapped for a virtual machine — for main.mjs
// itself. The real modules main imports (detection/ps.mjs, the Tier-0 executor, the reg.exe probe) import `spawn` on
// their own. On Linux those spawns had always failed at once (ENOENT: no powershell.exe) and nobody noticed; on the
// first Windows run of the battery they spawned REAL PowerShell/reg.exe processes under a virtual clock — hundreds —
// and the run hung. This module is imported FIRST by tests/run-all.mjs and by the sandbox: for the life of the process
// every Windows system tool spawned ANYWHERE is routed to the active virtual machine, and when no machine is active it
// behaves exactly like Linux (an async ENOENT on the child) — never a real process. Ordinary tools (node, git, npm)
// pass through untouched, so the rest of the one-process registry keeps working. syncBuiltinESMExports() makes the
// ESM named-import bindings (`import { spawn } from "node:child_process"`) see the guarded functions.
import path from "node:path";
import cp from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { promisify } from "node:util";

const WINDOWS_TOOLS = new Set(["powershell.exe", "powershell", "pwsh.exe", "pwsh", "reg.exe", "reg", "cmd.exe", "cmd", "sc.exe", "sc",
  "net.exe", "net", "ipconfig.exe", "ipconfig", "w32tm.exe", "w32tm", "wmic.exe", "wmic", "taskkill.exe", "taskkill", "schtasks.exe", "schtasks",
  "netsh.exe", "netsh", "dism.exe", "dism", "sfc.exe", "sfc", "rundll32.exe", "rundll32", "msiexec.exe", "msiexec", "control.exe", "control"]);
let activeMachineSpawn = null;
/** The sandbox calls this on boot (a spawn) and on shutdown (null). */
export function setActiveLabSpawn(fn) { activeMachineSpawn = typeof fn === "function" ? fn : null; }
const realCp = { spawn: cp.spawn, execFile: cp.execFile, exec: cp.exec, spawnSync: cp.spawnSync, execSync: cp.execSync, execFileSync: cp.execFileSync };
const toolOf = (file) => path.basename(String(file || "")).toLowerCase();
function enoentChild(file) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = undefined; child.killed = false;
  child.kill = () => { child.killed = true; return true; };
  const err = Object.assign(new Error(`spawn ${file} ENOENT (fault-lab guard: no virtual machine is active, and a real process is never allowed here)`), { code: "ENOENT", errno: -2, syscall: `spawn ${file}`, path: String(file) });
  setImmediate(() => { child.emit("error", err); child.emit("close", -2, null); });
  return child;
}
cp.spawn = function guardedSpawn(file, args, opts) {
  if (!WINDOWS_TOOLS.has(toolOf(file))) return realCp.spawn.call(cp, file, args, opts);
  if (activeMachineSpawn) return activeMachineSpawn(file, Array.isArray(args) ? args : [], (Array.isArray(args) ? opts : args) || {});
  return enoentChild(file);
};
const refuseSync = (file) => { const e = new Error(`spawnSync ${file} ENOENT (fault-lab guard)`); e.code = "ENOENT"; return { error: e, status: null, stdout: "", stderr: "" }; };
cp.execFile = function guardedExecFile(file, ...rest) {
  if (!WINDOWS_TOOLS.has(toolOf(file))) return realCp.execFile.call(cp, file, ...rest);
  const cb = rest.find((x) => typeof x === "function");
  const child = enoentChild(file);
  if (cb) child.once("error", (e) => cb(e, "", ""));
  return child;
};
cp.exec = function guardedExec(command, ...rest) {
  const first = String(command || "").trim().split(/\s+/)[0];
  if (!WINDOWS_TOOLS.has(toolOf(first))) return realCp.exec.call(cp, command, ...rest);
  const cb = rest.find((x) => typeof x === "function");
  const child = enoentChild(first);
  if (cb) child.once("error", (e) => cb(e, "", ""));
  return child;
};
cp.spawnSync = function guardedSpawnSync(file, ...rest) { return WINDOWS_TOOLS.has(toolOf(file)) ? refuseSync(file) : realCp.spawnSync.call(cp, file, ...rest); };
cp.execFileSync = function guardedExecFileSync(file, ...rest) { if (WINDOWS_TOOLS.has(toolOf(file))) throw refuseSync(file).error; return realCp.execFileSync.call(cp, file, ...rest); };
cp.execSync = function guardedExecSync(command, ...rest) { const first = String(command || "").trim().split(/\s+/)[0]; if (WINDOWS_TOOLS.has(toolOf(first))) throw refuseSync(first).error; return realCp.execSync.call(cp, command, ...rest); };
// util.promisify(execFile) / (exec) must keep resolving { stdout, stderr } exactly like the real functions (they carry a
// custom promisify symbol; a plain wrapper would resolve with stdout only and break every suite that awaits run(...)).
for (const name of ["execFile", "exec"]) {
  cp[name][promisify.custom] = (...args) => new Promise((resolve, reject) => {
    cp[name](...args, (err, stdout, stderr) => { if (err) { err.stdout = stdout; err.stderr = stderr; reject(err); } else resolve({ stdout, stderr }); });
  });
}
syncBuiltinESMExports();
/** Test seam: which spawn the guard currently routes Windows tools to (null = ENOENT like Linux). */
export function activeLabSpawn() { return activeMachineSpawn; }

