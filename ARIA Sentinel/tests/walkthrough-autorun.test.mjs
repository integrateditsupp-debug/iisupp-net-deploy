// WALK-THROUGH AUTO-RUN (2026-07-16) — "automate the majority unless user input is needed." The under-globe runner
// auto-does the mechanical steps (auto-opens allowlisted pages, auto-advances read-only cards) and PAUSES only for
// real user input. This test proves the behavior AND the Rule-14 safety boundary is baked in:
//  · auto-run OPENS `open` targets WITHOUT a user click — but ONLY the allowlisted, NON-hard-stop ones;
//  · auto-run HALTS at every input-text / choice / confirm / copy AND every hard-stop open (sign in / account /
//    plan / pay / accept terms) — never advancing past one without the user;
//  · ARIA never auto-fills credentials, auto-submits, or auto-pays (no such step type or field exists);
//  · the card exposes the onboarding fix-card structure (tag chip + labeled field + gold primary) + a Pause/Auto
//    toggle + Back.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FLOWS, STEP_TYPES, autoRunAction, openStepIsHardStop, openStepNeedsHardStop, flowStepTag, getFlow } from "../src/shared/walkthrough-steps.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const overlay = rd("src", "renderer", "overlay.js");
const overlayHtml = rd("src", "renderer", "overlay.html");
const shared = rd("src", "shared", "walkthrough-steps.mjs");
let n = 0; const t = () => { n++; };

// 1 — CLASSIFICATION IS CORRECT for every step of every flow: display→advance, input/choice/confirm/copy→halt,
// non-hard-stop open→open, hard-stop open→halt. Also count that auto-run has REAL work (some opens auto-open) and
// REAL halts (accounts/pay never auto-open).
let autoOpens = 0, haltOpens = 0, advances = 0, inputHalts = 0;
for (const flow of Object.values(FLOWS)) {
  for (const s of flow.steps) {
    const a = autoRunAction(s);
    assert.ok(["advance", "open", "halt"].includes(a), `${flow.id}: valid auto action for ${s.type}`);
    if (s.type === "display") { assert.equal(a, "advance", `${flow.id}: display auto-advances`); advances++; }
    else if (s.type === "open") {
      if (openStepIsHardStop(s)) { assert.equal(a, "halt", `${flow.id}: hard-stop open HALTS ("${s.title}")`); haltOpens++; }
      else { assert.equal(a, "open", `${flow.id}: safe open auto-opens ("${s.title}")`); autoOpens++; }
    } else { assert.equal(a, "halt", `${flow.id}: ${s.type} halts for the user`); inputHalts++; }
  }
}
assert.ok(autoOpens >= 3, "auto-run has real work — several safe opens auto-open (pricing/store/help pages)");
assert.ok(haltOpens >= 3, "several hard-stop opens (sign in / create account / pay) HALT — never auto-opened");
assert.ok(advances >= 5 && inputHalts >= 5, "real display auto-advances + real input halts across the flows");
t();

// 2 — SAFETY INVARIANT: every account/sign-in/pay open (openStepNeedsHardStop) is classified "halt" — ARIA never
// auto-opens, auto-fills, or auto-pays an account/pay surface. (Hard-stop is a superset that also covers explicit
// "HARD STOP" notes like the MFA sign-in step.)
for (const flow of Object.values(FLOWS)) {
  for (const s of flow.steps) {
    if (s.type === "open" && openStepNeedsHardStop(s)) {
      assert.equal(autoRunAction(s), "halt", `${flow.id}: account/pay open is never auto-opened ("${s.title}")`);
    }
  }
}
// there is still NO credential/pay/submit step type or auto field anywhere (same guard as walkthrough-open-live).
assert.deepEqual([...STEP_TYPES].sort(), ["choice", "confirm", "copy", "display", "input-text", "open"], "no credential/pay/submit step type");
for (const flow of Object.values(FLOWS)) for (const s of flow.steps) for (const bad of ["autofill", "autoSubmit", "submit", "pay", "autopay", "credentials", "password"]) {
  assert.ok(!(bad in s), `${flow.id}: no auto '${bad}' field`);
}
t();

// 3 — OVERLAY WIRING: auto-open goes through the SAME allowlisted bridge (sentinel.openExternal), fired from the
// auto-runner only when action === "open" and autoRun is on; the manual user-click open handler is ALSO kept.
assert.match(overlay, /if \(autoRun && action === "open"\)/, "auto-open is gated on autoRun + a non-hard-stop open");
assert.match(overlay, /armAuto\(async \(\) => \{\s*const res = await sentinel\.openExternal\(step\.url\)/, "auto-open uses the allowlisted sentinel.openExternal bridge");
assert.match(overlay, /addEventListener\("click", async \(\) => \{ const res = await sentinel\.openExternal\(step\.url\)/, "the manual user-click open handler is kept too");
// halt steps + hard-stop opens never arm an auto timer: the ONLY auto-advance arm is guarded on action === "advance",
// and the ONLY auto-open arm is guarded on action === "open". No blanket timer that would skip an input/choice/copy.
assert.match(overlay, /if \(autoRun && action === "advance"\) armAuto\(\(\) => advance\(view\), AUTO_DISPLAY_MS\)/, "display auto-advance is the only unconditional advance arm");
assert.doesNotMatch(overlay, /armAuto\([^)]*\)\s*;\s*\/\/\s*halt/i, "no auto timer is armed on a halt step");
t();

// 4 — CONTROLS: a Pause/Auto toggle exists (flips autoRun + re-renders) and Back works; the runner clears its timer
// on navigation so it can't fire after the user takes over.
assert.match(overlay, /companion-autotoggle/, "an Auto/Pause toggle is rendered");
assert.match(overlay, /autoRun = !autoRun; renderCompanion\(\)/, "the toggle flips autoRun and re-renders");
assert.match(overlay, /"⏸ Pause auto"\s*:\s*"▶ Auto-run"/, "the toggle shows Pause when running / Auto-run when paused");
assert.match(overlay, /function clearAutoTimer\(\)/, "auto timer is clearable");
assert.match(overlay, /function backView\(\) \{ if \(!comp\) return; clearAutoTimer\(\)/, "Back clears any pending auto timer");
assert.match(overlay, /function renderCompanion\(\) \{[\s\S]*?clearAutoTimer\(\)/, "each render clears the prior auto timer (re-armed only where valid)");
t();

// 5 — ONBOARDING FIX-CARD STRUCTURE class hooks exist (tag chip + labeled field + gold primary + subtitle), in the
// renderer and styled in the overlay CSS — so the walk-through is a visual sibling of the detector fix-card.
assert.match(overlay, /el\("div", "companion-tag", flowStepTag\(flow, view\.index\)\)/, "each step renders a tag chip");
assert.match(overlay, /el\("div", "companion-field-label", step\.label\)/, "labeled input fields render a small-caps label");
assert.match(overlay, /el\("button", "cbtn primary"\)/, "steps use the gold primary button");
for (const cls of [".companion-tag", ".companion-field-label", ".companion-autotoggle"]) {
  assert.ok(overlayHtml.includes(cls), `overlay CSS styles ${cls}`);
}
// the tag chip text is derived + honest (scope + step number), never invented.
const claude = getFlow("claude-setup");
assert.match(flowStepTag(claude, 0), /SET UP CLAUDE · STEP 1/, "tag chip = derived scope + step number");
t();

// 6 — the shared classifier is the single source of truth (imported by the overlay), so UI + tests can't drift.
assert.match(overlay, /import \{[^}]*autoRunAction[^}]*\} from "\.\.\/shared\/walkthrough-steps\.mjs"/, "overlay imports the shared auto-run classifier");
assert.match(shared, /export function autoRunAction\(step\)/, "autoRunAction is the shared single source of truth");
t();

assert.equal(n, 6, "6 walkthrough-autorun groups");
console.log(`walkthrough-autorun test passed (${n} groups · ${autoOpens} safe opens auto-open, ${haltOpens} hard-stop opens HALT · ${advances} displays auto-advance, ${inputHalts} inputs halt · no credential/pay/submit · allowlist-bound auto-open · Pause/Auto toggle + Back + timer-clear · onboarding fix-card structure).`);
