// fault-lab-spawn-guard — a lab never reaches the machine it runs on (found on Windows, 2026-10-15).
//
// The first battery run on the operator's Windows PC hung inside the fault lab: the REAL modules main imports
// (detection/ps.mjs, the Tier-0 executor, the reg.exe probe) import `spawn` on their own, so under the lab's
// virtual clock they spawned real PowerShell/reg.exe processes — on Linux those had always failed silently
// with ENOENT. tests/lib/main-sandbox.mjs now installs a process-wide guard: every Windows system tool spawned
// ANYWHERE goes to the active virtual machine, or fails like Linux (async ENOENT) when no machine is active.
// Ordinary tools (node) still run for real, so the rest of the one-process registry is unaffected.
import assert from "node:assert/strict";
import { spawn, execFile, spawnSync } from "node:child_process";   // ESM named bindings — the ones ps.mjs/executor hold
import { activeLabSpawn } from "./lib/main-sandbox.mjs";
import { setActiveLabSpawn } from "./lib/spawn-guard.mjs";
import { bootLab } from "./lib/fault-lab.mjs";

let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log("  ok  " + label); };
const settle = (child) => new Promise((resolve) => { let err = null; child.on("error", (e) => { err = e; }); child.on("close", (code, signal) => resolve({ err, code, signal })); });

// 1 — no lab active: a Windows tool never becomes a real process, on any platform. (In the one-process registry an
// earlier lab may still be the active machine — release it explicitly so this suite proves the no-machine path.)
setActiveLabSpawn(null);
ok("no machine active", activeLabSpawn() === null);
{
  const r = await settle(spawn("powershell.exe", ["-NoProfile", "-Command", "Get-Service Spooler"]));
  ok("powershell.exe with no lab → async ENOENT error (never a real process)", r.err && r.err.code === "ENOENT");
  const r2 = await settle(spawn("reg", ["query", "HKCU\\Software"]));
  ok("reg with no lab → async ENOENT error", r2.err && r2.err.code === "ENOENT");
  const sync = spawnSync("powershell.exe", ["-Command", "1"]);
  ok("spawnSync of a Windows tool is refused with ENOENT", sync.error && sync.error.code === "ENOENT");
  const viaExecFile = await new Promise((resolve) => execFile("cmd.exe", ["/c", "echo hi"], (e) => resolve(e)));
  ok("execFile of a Windows tool reports ENOENT", viaExecFile && viaExecFile.code === "ENOENT");
}

// 2 — ordinary tools pass through untouched (the registry's other suites spawn node).
{
  const r = await settle(spawn(process.execPath, ["-e", "process.exit(7)"]));
  ok("node still runs for real (exit code observed)", r.err === null && r.code === 7);
}

// 3 — with a lab booted, a transitive importer's module-level `spawn` binding STILL gets Linux semantics (ENOENT) and
// never touches the machine's ledger: main.mjs's own spawns go to the machine through the sandbox, nothing else does.
{
  const lab = await bootLab({ mode: "manual" });
  ok("a booted lab is the active machine", activeLabSpawn() !== null);
  const ledger = () => lab.machine.commands.length + lab.machine.unknownCommands.length;
  const before = ledger();
  const r = await settle(spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-Service Spooler"]));
  ok("powershell.exe from a transitive importer is ENOENT even while a lab is booted", r.err && r.err.code === "ENOENT");
  ok("…and nothing landed on the machine's ledger (probes the lab does not model never reach it)", ledger() === before);
  ok("…while main's own path to the machine is intact", typeof lab.machine.spawn === "function" && activeLabSpawn() === lab.machine.spawn);
  lab.booted.shutdown();
  ok("shutdown releases the machine", activeLabSpawn() === null);
  const after = await settle(spawn("powershell.exe", ["-Command", "1"]));
  ok("after shutdown a Windows tool is ENOENT, as before", after.err && after.err.code === "ENOENT");
}

console.log(`fault-lab-spawn-guard: ${pass} checks green — Windows tools never run for real inside the battery; node does.`);
