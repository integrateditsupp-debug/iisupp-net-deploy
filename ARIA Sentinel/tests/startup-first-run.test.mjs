// PROD 2026-10-14 (audit M7) — honest first run, one launcher per logon, headless auto-start.
//
// Before: (a) a clean first launch probed the Run key + the task, found neither, and recorded a SECURITY
// "Startup disabled (unknown)" row + an "ARIA removed from startup" toast before startup had ever been registered
// (and did so at EVERY launch on macOS); (b) registration wrote BOTH an HKCU Run entry and an at-logon task, so
// Windows launched ARIA twice per logon and the second launch popped the Settings window via second-instance;
// (c) `--startup` was never honoured, so the 1280×820 window appeared at every auto-start.
// This suite pins the pure decisions (startup-registrar.mjs) and the main.mjs wiring.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startupHealDecision, shouldShowWindowAtLaunch, shouldShowWindowOnSecondInstance, isStartupLaunch, STARTUP_ARG, tamperSignal, TAMPER_GRACE_MS, registryRunEntry } from "../src/main/startup-registrar.mjs";

const root = path.resolve(import.meta.dirname, "..");
const main = fs.readFileSync(path.join(root, "src/main/main.mjs"), "utf8");
const NOW = Date.parse("2026-10-14T12:00:00Z");
let groups = 0; const g = () => { groups++; };

// 1 — clean first run: nothing registered, never seen → register, NO tamper (no audit row, no toast).
let d = startupHealDecision({ platform: "win32", startupEnabled: undefined, status: { registry: false, task: false }, lastBothPresentAt: undefined, now: NOW });
assert.deepEqual(d, { action: "register", reason: "never-registered", tamper: false });
// …and within the 24h grace after it was last seen (a reinstall, a profile sync blip): heal silently.
d = startupHealDecision({ platform: "win32", status: { registry: false, task: false }, lastBothPresentAt: new Date(NOW - 2 * 3600_000).toISOString(), now: NOW });
assert.deepEqual(d, { action: "register", reason: "within-grace", tamper: false });
// Both gone AND last seen 25h ago → that is a removal: register + tamper audit.
d = startupHealDecision({ platform: "win32", status: { registry: false, task: false }, lastBothPresentAt: new Date(NOW - 25 * 3600_000).toISOString(), now: NOW });
assert.deepEqual(d, { action: "register", reason: "removed-after-grace", tamper: true });
assert.equal(tamperSignal({ registry: false, task: false }, new Date(NOW - 25 * 3600_000).toISOString(), NOW), true);
assert.equal(TAMPER_GRACE_MS, 24 * 3600_000);
g();

// 2 — the Run key alone is enough (the task is only the self-heal, never required); a lone task = key missing → heal, no tamper.
assert.deepEqual(startupHealDecision({ platform: "win32", status: { registry: true, task: false }, now: NOW }), { action: "ok", reason: "run-key-present", tamper: false });
assert.deepEqual(startupHealDecision({ platform: "win32", status: { registry: true, task: true }, now: NOW }), { action: "ok", reason: "both-present", tamper: false });
d = startupHealDecision({ platform: "win32", status: { registry: false, task: true }, lastBothPresentAt: new Date(NOW - 48 * 3600_000).toISOString(), now: NOW });
assert.equal(d.action, "register");
assert.equal(d.tamper, false, "one entry still present is never a tamper (single missing entry self-heals silently)");
g();

// 3 — never on macOS / Linux (no registry, no task scheduler): skip, no registration, no tamper, no "Registered…" log.
for (const platform of ["darwin", "linux"]) {
  assert.deepEqual(startupHealDecision({ platform, status: { registry: false, task: false }, now: NOW }), { action: "skip", reason: "not-windows", tamper: false });
}
assert.deepEqual(startupHealDecision({ platform: "win32", startupEnabled: false, status: { registry: false, task: false }, now: NOW }), { action: "skip", reason: "user-disabled", tamper: false });
g();

// 4 — `--startup`: the Run key launches with it; such a launch shows no window and a second instance with it never pops Settings.
assert.equal(STARTUP_ARG, "--startup");
assert.match(registryRunEntry("C:\\Program Files\\ARIA Sentinel\\ARIA Sentinel.exe").value, /" --startup$/, "the Run key passes --startup");
assert.equal(isStartupLaunch(["C:\\app.exe", "--startup"]), true);
assert.equal(isStartupLaunch(["C:\\app.exe"]), false);
assert.equal(shouldShowWindowAtLaunch(["C:\\app.exe", "--startup"], {}), false, "auto-start: no window");
assert.equal(shouldShowWindowAtLaunch(["C:\\app.exe"], {}), true, "a person launched it: window");
assert.equal(shouldShowWindowAtLaunch(["C:\\app.exe"], { ARIA_BOOT_SMOKE: "1" }), false, "boot smoke stays headless");
assert.equal(shouldShowWindowOnSecondInstance(["C:\\app.exe", "--startup"]), false, "auto-start relaunch never pops Settings");
assert.equal(shouldShowWindowOnSecondInstance(["C:\\app.exe", "aria-sentinel://resolve?recipe=x"]), true);
g();

// 5 — main.mjs wiring: the pure decision drives the heal; registration is key-only unless healing; the window + second-instance honour --startup.
assert.match(main, /const decision = startupHealDecision\(\{ platform: process\.platform/, "heal uses the pure decision");
assert.match(main, /if \(decision\.tamper\) recordStartupTamper\(/, "tamper audit only when the decision says so");
assert.match(main, /await registerStartup\(\{ withTask: decision\.reason !== "never-registered" \}\)/, "first run registers the key only; a heal adds the task");
assert.match(main, /async function registerStartup\(\{ withTask = false \} = \{\}\)/, "registerStartup defaults to key-only");
assert.match(main, /if \(withTask\) \{[\s\S]*?schtasks/, "the task is created only with withTask");
assert.match(main, /if \(process\.platform !== "win32"\) return \{ action: "skip", reason: "not-windows" \};/, "heal skips off win32");
assert.match(main, /show: shouldShowWindowAtLaunch\(process\.argv, process\.env\)/, "window visibility honours --startup");
assert.match(main, /const byPerson = shouldShowWindowOnSecondInstance\(argv\);[\s\S]*?if \(byPerson\) showMainWindow\("mode"\);/, "second-instance pops Settings only for a person");
assert.doesNotMatch(main, /recordStartupTamper\(classifyRemoval\(\{ registryMissing: true, taskMissing: true \}\)\);\n  await registerStartup\(\); \/\/ self-heal/, "the unconditional first-run tamper path is gone");
g();

assert.equal(groups, 5);
console.log(`startup-first-run test passed (${groups} groups · clean first run = register without tamper · 24h grace · key alone ok · off-win32 skip · --startup headless + no Settings pop · main wired).`);
