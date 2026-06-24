// DoD criterion 1 — prove the Tier-0 execution path runs system-CHANGING recipes for REAL on a live
// Windows machine. The Tier-0 executor set is 5 recipes (DNS flush + 4 service restarts) — all safe and
// self-recovering. To avoid disrupting an ACTIVE session, the 3 low-disruption ones (DNS, Print Spooler,
// Windows Update) run LIVE here; Audio + Bluetooth are exercised via the executor in DRY-RUN only (their
// restart would blip an in-use speaker / BT mouse). The full ≥10 destructive-recipe + System-Restore-point
// sweep is a VM task per the packet. Also proves the dry-run gate + the Ctrl+Alt+K kill path.
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
const log = () => {};

console.log("\n=== DoD criterion 1 — LIVE Tier-0 execution proof (Windows) ===\n");

// (a) DRY-RUN gate holds — no command spawned.
const dry = await executeTier0("flush-dns-cache", { run: psRun, dryRun: true, logger: log });
console.log(`gate    flush-dns-cache DRY-RUN → outcome=${dry.outcome} (expect dry-run; no system change)`);

// (b) LIVE — these 3 representative system-changing recipes run for REAL.
const liveIds = ["flush-dns-cache", "restart-print-spooler", "restart-windows-update"];
let liveOk = 0;
for (const id of liveIds) {
  const r = await executeTier0(id, { run: psRun, dryRun: false, logger: log });
  const real = r.outcome !== "dry-run" && r.events.some((e) => e.event === "TIER0.EXEC" && e.dryRun !== true);
  const audit = r.events.map((e) => e.event).join("→");
  const ok = real && ["success", "no-op-neutral", "no-op"].includes(r.outcome) || (real && r.exitCode === 0);
  if (ok) liveOk++;
  console.log(`LIVE    ${id.padEnd(22)} → outcome=${String(r.outcome).padEnd(8)} exit=${r.exitCode} before=${r.before} after=${r.after} audit=${audit} REAL=${real}`);
}

// (c) The 2 disruptive Tier-0 recipes — exercised via the executor in DRY-RUN (proves they're wired,
//     without interrupting an in-use audio device / Bluetooth input on the live session).
for (const id of ["restart-audio", "restart-bluetooth"]) {
  const r = await executeTier0(id, { run: psRun, dryRun: true, logger: log });
  console.log(`wired   ${id.padEnd(22)} → outcome=${r.outcome} (dry-run on a live session by choice; runs live in a VM)`);
}

// (d) KILL path (Ctrl+Alt+K) — kill a live child mid-run.
const longRun = psRun("Start-Sleep -Seconds 30; 'should-not-print'");
await new Promise((r) => setTimeout(r, 800));
let killed = 0; for (const c of children) { c.kill(); killed++; }
const killResult = await longRun;
const abortedMidRun = killResult.exitCode !== 0 && !killResult.stdout.includes("should-not-print");
console.log(`\nKILL    killed ${killed} live child mid-run; aborted-before-completion=${abortedMidRun}`);

const pass = dry.outcome === "dry-run" && liveOk === liveIds.length && abortedMidRun;
console.log(`\n=== execution-path proof on live Windows: ${pass ? "PASS" : "FAIL"} (${liveOk}/${liveIds.length} live recipes ran for real) ===`);
console.log("Remaining for full criterion 1: ≥10 system-CHANGING recipes + System Restore points on a VM (Ahmad).");
process.exitCode = pass ? 0 : 1;
