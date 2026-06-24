// DoD criterion 1 (partial, SAFE) — prove the Tier-0 execution path runs for REAL on a live Windows
// machine, using the harmless self-recovering `flush-dns-cache` recipe (ipconfig /flushdns). This does NOT
// run the 10 system-changing recipes (those need a VM, per the packet) — it proves the mechanism: real
// PowerShell spawn, before/after probe, LIVE exec (dryRun:false), audit events, and the kill path.
import { spawn } from "node:child_process";
import { executeTier0 } from "../src/main/tier-0-executor.mjs";

const children = new Set();                 // stand-in for main.mjs childProcesses (Ctrl+Alt+K kills these)
function psRun(command) {
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", String(command)], { windowsHide: true });
    children.add(child);
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => { children.delete(child); resolve({ stdout: out, stderr: err, exitCode: code == null ? 1 : code }); });
    child.on("error", () => { children.delete(child); resolve({ stdout: out, stderr: err || "error", exitCode: 1 }); });
  });
}

const log = (event, text) => console.log(`  [${event}] ${text}`);

console.log("\n=== DoD criterion 1 — LIVE Tier-0 execution proof (flush-dns-cache, safe) ===");

// 1) DRY-RUN first — proves the gate: no command spawned.
const dry = await executeTier0("flush-dns-cache", { run: psRun, dryRun: true, logger: log });
console.log(`DRY-RUN  → outcome=${dry.outcome} (expect "dry-run", no system change)\n`);

// 2) LIVE — dryRun:false → real ipconfig /flushdns runs; before/after DNS cache count probed for real.
const live = await executeTier0("flush-dns-cache", { run: psRun, dryRun: false, logger: log });
console.log(`LIVE     → outcome=${live.outcome} exitCode=${live.exitCode} before=${live.before} after=${live.after}`);
const ranForReal = live.outcome !== "dry-run" && live.exitCode === 0 && live.events.some((e) => e.event === "TIER0.EXEC" && e.dryRun !== true);
console.log(`           ran for REAL: ${ranForReal} · audit events: ${live.events.map((e) => e.event).join(" → ")}\n`);

// 3) KILL path (Ctrl+Alt+K) — spawn a long command, then kill the live child mid-run, like the kill-switch.
const longRun = psRun("Start-Sleep -Seconds 30; 'should-not-print'");
await new Promise((r) => setTimeout(r, 800));
let killed = 0;
for (const c of children) { c.kill(); killed++; }
const killResult = await longRun;
const abortedMidRun = killResult.exitCode !== 0 && !killResult.stdout.includes("should-not-print");
console.log(`KILL     → killed ${killed} live child process(es) mid-run; aborted-before-completion: ${abortedMidRun}\n`);

const pass = dry.outcome === "dry-run" && ranForReal && abortedMidRun;
console.log(`=== criterion 1 (execution-path proof on live Windows): ${pass ? "PASS" : "FAIL"} ===`);
console.log("Note: the 10-recipe + System-Restore-point verification of system-CHANGING recipes still needs a VM (Ahmad).");
process.exitCode = pass ? 0 : 1;
