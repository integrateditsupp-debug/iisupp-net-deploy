// REAL BOOT SMOKE TEST (2026-07-02) — the one units can't do: actually launch the packaged Electron app,
// wait for the renderer to init, click a nav tab + a Quick Action, and assert the UI RESPONDS. This is what
// caught the P0 dead-shell: renderer.js was silently not executing (node:crypto CSP block), so `activateTab`
// never switched the panel. A passing node suite meant nothing; only a boot proved it.
//
// Runs the real main (src/main/main.mjs) headless via the env-gated ARIA_BOOT_SMOKE hook in createMainWindow,
// which after did-finish-load clicks .nav-item[data-tab="aria"] + #dashDiagnose and writes a JSON probe. We
// assert the ARIA panel became active and the nav styled. Requires Electron installed (npm i); SKIPS cleanly
// otherwise so CI without a display never false-fails. Run on a real machine: `npm run test:boot`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
// Prefer the real Electron executable (spawning the .cmd shim is unreliable via spawnSync on Windows).
const candidates = [
  path.join(APP, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron"),
  path.join(APP, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron")
];
const electronBin = candidates.find((p) => fs.existsSync(p));

if (!electronBin) {
  console.log("boot-smoke SKIPPED — Electron is not installed (run `npm install` first). This test must be run on a real machine.");
  process.exit(0);
}
const useShell = electronBin.endsWith(".cmd");

const outFile = path.join(os.tmpdir(), `aria-boot-smoke-${process.pid}.txt`);
try { fs.rmSync(outFile, { force: true }); } catch { /* ignore */ }

const res = spawnSync(electronBin, ["."], {
  cwd: APP,
  env: { ...process.env, ARIA_BOOT_SMOKE: "1", ARIA_SENTINEL_DRY_RUN: "1", ARIA_BOOT_SMOKE_OUT: outFile },
  timeout: 90000,
  encoding: "utf8",
  shell: useShell
});

const out = (fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "") || res.stdout || "";
try { fs.rmSync(outFile, { force: true }); } catch { /* ignore */ }

assert.ok(out.includes("[probe]"), `boot produced no probe output — the window never finished loading.\n${out}\n${res.stderr || ""}`);
// No renderer CSP / node: import violation (the exact P0 cause).
assert.doesNotMatch(out, /node:crypto.*Content Security Policy|violates the following Content Security Policy/i, `the renderer hit a CSP/module-load violation (P0 regression):\n${out}`);

const m = out.match(/\[probe\]\s*(\{.*\})/);
assert.ok(m, `could not find the probe JSON in the boot output:\n${out}`);
const probe = JSON.parse(m[1]);

assert.equal(probe.hasSentinel, true, "preload bridge (window.sentinel) is present");
assert.equal(probe.before, "dashboard", "app starts on the Dashboard panel");
assert.equal(probe.navStyled, true, "clicking the ARIA nav item styles it active (the click handler fired)");
assert.equal(probe.afterNav, "aria", "clicking the ARIA nav item SWITCHES to the ARIA panel (the dead-shell is gone)");
assert.equal(probe.afterQa, "aria", "the Dashboard 'Diagnose issue' Quick Action fired (routed to ARIA)");

console.log(`boot-smoke test passed — real Electron boot: nav switches (dashboard→aria), nav styles active, Quick Action fires, no CSP/module violation. ${JSON.stringify(probe)}`);
