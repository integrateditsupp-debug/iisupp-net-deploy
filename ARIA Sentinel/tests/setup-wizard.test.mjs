// RUN 33-E — first-launch Setup wizard state: 6-step flow, prefs persistence, never-replay-after-complete,
// and re-run (reopen without wiping prefs). Pure state core (the overlay UI just drives these).
import assert from "node:assert/strict";
import {
  defaultAppConfig, defaultSetupState, shouldShowSetup, advanceSetup, completeSetup, reopenSetup, SETUP_TOTAL_STEPS
} from "../src/shared/app-config.mjs";

let n = 0; const t = () => { n++; };

// 1 — fresh install: wizard shows; defaults are sane (Manual mode, notifications ON, tray ON).
const fresh = defaultAppConfig();
assert.equal(shouldShowSetup(fresh), true, "fresh install → show setup");
assert.equal(fresh.setup.prefs.mode, "manual", "Manual recommended default");
assert.equal(fresh.setup.prefs.kbNotifications, true);
assert.equal(fresh.setup.prefs.trayIcon, true);
assert.equal(fresh.setup.prefs.landOnAria, false, "auto-land on ARIA defaults OFF");
assert.equal(SETUP_TOTAL_STEPS, 6);
t();

// 2 — stepping through advances and auto-completes at the final step.
let c = fresh;
for (let i = 1; i < SETUP_TOTAL_STEPS; i++) {
  c = advanceSetup(c);
  assert.equal(c.setup.step, i);
  assert.equal(c.setup.completed, false, `step ${i} not complete`);
  assert.equal(shouldShowSetup(c), true, "mid-wizard still shows");
}
c = advanceSetup(c);
assert.equal(c.setup.step, SETUP_TOTAL_STEPS);
assert.equal(c.setup.completed, true, "final step completes setup");
t();

// 3 — completed → NEVER auto-shows again.
assert.equal(shouldShowSetup(c), false, "completed setup never replays");
assert.equal(shouldShowSetup({ setup: { completed: true } }), false);
t();

// 4 — completeSetup persists chosen prefs (and only valid ones).
const done = completeSetup(fresh, { mode: "confirmed", landOnAria: true, kbNotifications: false, trayIcon: true, bogus: "x" });
assert.equal(done.setup.completed, true);
assert.equal(done.setup.prefs.mode, "confirmed");
assert.equal(done.setup.prefs.landOnAria, true);
assert.equal(done.setup.prefs.kbNotifications, false);
assert.ok(!("bogus" in done.setup.prefs), "unknown prefs ignored");
assert.equal(completeSetup(fresh, { mode: "hacker" }).setup.prefs.mode, "manual", "invalid mode rejected → default");
t();

// 5 — "Re-run Setup": reopens from step 0 but KEEPS the saved prefs.
const reopened = reopenSetup(done);
assert.equal(reopened.setup.completed, false, "re-run shows the wizard again");
assert.equal(reopened.setup.step, 0);
assert.equal(reopened.setup.prefs.mode, "confirmed", "saved prefs preserved across a re-run");
assert.equal(shouldShowSetup(reopened), true);
t();

// 6 — normalize is forward/backward safe + preserves the onboarding block.
assert.equal(shouldShowSetup(null), true, "no config → show");
assert.equal(shouldShowSetup({}), true);
const merged = completeSetup({ onboarding: { completed: true } }, {});
assert.equal(merged.onboarding.completed, true, "onboarding block preserved");
assert.equal(merged.setup.completed, true);
t();

// 7 — wiring: main IPC (complete/reopen) + getState.setupNeeded; preload bridge; renderer shows it once +
//     a Settings "Re-run Setup" button; the wizard overlay exists with the 6-step controls.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const main = rd("src", "main", "main.mjs");
assert.match(main, /ipcMain\.handle\("setup:complete"/, "setup:complete IPC");
assert.match(main, /ipcMain\.handle\("setup:reopen"/, "setup:reopen IPC");
assert.match(main, /setupNeeded: shouldShowSetup/, "getState exposes setupNeeded");
assert.match(main, /m === "manual" \|\| m === "confirmed"/, "wizard never sets Autonomous silently");
const preload = rd("src", "main", "preload.cjs");
assert.match(preload, /completeSetup:/, "preload completeSetup");
assert.match(preload, /reopenSetup:/, "preload reopenSetup");
const rjs = rd("src", "renderer", "renderer.js");
assert.match(rjs, /function maybeShowSetupWizard\(state\)/, "wizard shows from render state");
assert.match(rjs, /state\.setupNeeded/, "gated on setupNeeded (shows once)");
assert.match(rjs, /SETUP_STEPS\b/, "6-step content");
const idx = rd("src", "renderer", "index.html");
assert.match(idx, /id="setupWizard"/, "wizard overlay");
assert.match(idx, /id="reRunSetup"/, "Settings re-run button");
t();

assert.equal(n, 7, "7 setup-wizard test groups");
console.log(`setup-wizard test passed (${n} groups · fresh-show · 6-step advance/complete · never-replay · prefs persist+validate · re-run keeps prefs · normalize safe).`);
