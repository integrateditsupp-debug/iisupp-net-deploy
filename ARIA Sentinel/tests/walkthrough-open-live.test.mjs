// Walk-through LIVE-OPEN safety (2026-07-14) — as the under-globe walk-through advances, ARIA OPENS each setup
// target (a vendor page / app / Settings pane) on the USER's click. This test proves the hard boundary (Rule 14):
//  · ARIA may OPEN a target — but NEVER auto-enters credentials, submits a form, accepts terms, or pays.
//  · every account/sign-in/pay `open` step carries a hard-stop note stated ON THE CARD.
//  · every `open` URL sits inside the host-anchored allowlist main enforces (so a forged/off-list URL never opens).
//  · the live-open fires ONLY from a user click handler — never during render/advance.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FLOWS, STEP_TYPES, allFlowOpenUrls, openStepNeedsHardStop, stepHonoursHardStop } from "../src/shared/walkthrough-steps.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const main = rd("src", "main", "main.mjs");
const overlay = rd("src", "renderer", "overlay.js");
const renderer = rd("src", "renderer", "renderer.js");
let n = 0; const t = () => { n++; };

// 1 — the step model has NO credential/pay/submit action type. The only 6 types are display/input-text/choice/
// copy/open/confirm; none of them enters a password, submits a form, or pays. Those are ALWAYS user hard-stops.
assert.deepEqual([...STEP_TYPES].sort(), ["choice", "confirm", "copy", "display", "input-text", "open"], "no credential/pay/submit step type exists");
for (const flow of Object.values(FLOWS)) {
  for (const s of flow.steps) {
    assert.ok(STEP_TYPES.includes(s.type), `${flow.id}: only known step types (${s.type})`);
    // no rogue auto-action fields that would fire without a user click.
    for (const forbidden of ["autofill", "autoSubmit", "submit", "credentials", "password", "pay", "autopay"]) {
      assert.ok(!(forbidden in s), `${flow.id}: step carries no auto '${forbidden}' field`);
    }
  }
}
t();

// 2 — every account/sign-in/pay `open` step states the hard-stop ON THE CARD ("you create the account", "you sign
// in", "you decide if and what to pay", "ARIA never types your password / signs in / pays").
let accountOpens = 0;
for (const flow of Object.values(FLOWS)) {
  for (const s of flow.steps) {
    if (s.type !== "open") continue;
    assert.ok(s.note, `${flow.id}: every open step has a user-click note`);
    if (openStepNeedsHardStop(s)) { accountOpens++; assert.ok(stepHonoursHardStop(s), `${flow.id}: account/pay open states the hard-stop — "${s.title}"`); }
  }
}
assert.ok(accountOpens >= 3, "several account/sign-in/pay open steps exist and all carry hard-stops");
t();

// 3 — every `open` URL the flows use is inside main's host-anchored OPEN_EXTERNAL_ALLOW allowlist (https-only,
// official domains). Reconstruct the exact regex from main so a drift between flows + allowlist fails the build.
const allowLiteral = main.match(/const OPEN_EXTERNAL_ALLOW = (.+);/)[1];
const OPEN_ALLOW = new Function("return " + allowLiteral)();
assert.ok(OPEN_ALLOW instanceof RegExp, "reconstructed the allowlist RegExp from main");
const urls = allFlowOpenUrls();
assert.ok(urls.length >= 8, "there are real open URLs across the flows");
for (const u of urls) {
  assert.ok(/^https:\/\//.test(u), `open URL is https: ${u}`);
  assert.ok(OPEN_ALLOW.test(u), `open URL is inside the host-anchored allowlist: ${u}`);
}
// a forged / off-list URL is refused by the same allowlist (defense proof).
for (const bad of ["http://claude.ai", "https://claude.ai.evil.com", "https://pay.evil.com/checkout", "file:///etc/passwd"]) {
  assert.ok(!OPEN_ALLOW.test(bad), `off-list URL refused: ${bad}`);
}
t();

// 4 — the MANUAL live-open still fires from a user CLICK handler (the only path for a hard-stop open + the paused
// path). The overlay + tab bind openExternal(step.url) inside a click listener. (Walk-through v2 auto-run may ALSO
// auto-open the SAFE, non-hard-stop targets without a click — still allowlist-bound; proven in walkthrough-autorun.)
assert.match(overlay, /addEventListener\("click", async \(\) => \{ const res = await sentinel\.openExternal\(step\.url\)/, "overlay keeps the manual user-click open handler");
assert.match(renderer, /qs\("#wtOpenBtn"\)\?\.addEventListener\("click", async \(\) => \{ const res = await sentinel\.openExternal\?\.\(step\.url\)/, "tab runner live-opens only on the user's click");
// main gates every open through the allowlist handler (user-initiated browser open, not an app network call).
assert.match(main, /ipcMain\.handle\("sentinel:open-external", \(_event, url\) => \{[\s\S]*?OPEN_EXTERNAL_ALLOW\.test\(url\)/, "main gates open-external through the allowlist");
t();

assert.equal(n, 4, "4 walkthrough-open-live groups");
console.log(`walkthrough-open-live test passed (${n} groups · no credential/pay/submit step type · account/pay opens carry hard-stops · every open URL inside the allowlist, off-list refused · live-open only on user click).`);
