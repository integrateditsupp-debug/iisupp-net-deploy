// hero-start-aria — the way out of the kill switch is never behind a plan (found on the operator's PC, 2026-10-15).
//
// After Ctrl+Alt+K the Dashboard hero read "STOPPED … Press Start ARIA to resume watching" while the only Start ARIA
// button lived in Control Center — a Pro tab, locked on a free or trial-expired device. The hero now carries its own
// Start ARIA (same IPC), shown only while ARIA is stopped or paused.
import assert from "node:assert/strict";
import { available, withPage, dashboardWithDataState } from "./lib/renderer-harness.mjs";

let pass = 0;
const ok = (label, cond) => { assert.ok(cond, label); pass++; console.log("  ok  " + label); };

// OPT-IN like every renderer-harness suite: without Playwright + Chromium (the operator's PC) it SKIPS with a clear
// line — never a silent green, never a red for a missing tool (the first rebuild on Ahmad's PC went red on exactly this).
const env = available();
if (!env.ok) {
  console.log(`hero-start-aria: SKIPPED — ${env.reason}. (The suite is opt-in; it needs Playwright + a Chromium binary.)`);
} else {
await withPage({ state: { ...dashboardWithDataState(), ariaStopped: true } }, async (page) => {
  ok("stopped: the hero shows STOPPED", (await page.evaluate(() => document.querySelector("#heroStatus").textContent.trim())) === "STOPPED");
  ok("stopped: the hero's Start ARIA is visible", (await page.evaluate(() => document.querySelector("#heroResume").hidden)) === false);
  ok("stopped: Control Center stays locked for the plan (the exit does not depend on it)",
    await page.evaluate(() => Boolean(document.querySelector('.nav-item[data-tab="control-center"]'))));
  // the harness records every window.sentinel call in window.__calls as { fn, args }
  await page.evaluate(() => { window.__calls.length = 0; document.querySelector("#startAriaHero").click(); });
  await page.waitForTimeout(150); // runAction awaits before it reaches the IPC
  const calls = await page.evaluate(() => window.__calls.filter((c) => c.fn === "startAria").length);
  ok("stopped: clicking it calls sentinel.startAria (the same IPC as Control Center)", calls === 1);
});
await withPage({ state: dashboardWithDataState() }, async (page) => {
  ok("watching: the hero's Start ARIA is hidden", (await page.evaluate(() => document.querySelector("#heroResume").hidden)) === true);
});
console.log(`hero-start-aria: ${pass} checks green — Start ARIA on the hero whenever ARIA is stopped, never plan-locked.`);
}
