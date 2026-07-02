// Walk-through tab — the guided step-by-step fix surface. Proves: the tab is registered + switchable; the ONE
// shared step source returns REAL steps for an authored issue and [] for an unauthored one (real-or-empty); and
// the renderer shows an HONEST fallback (verified KB article + gated resolve) — never a fabricated or blank walk.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { walkStepsFor, hasWalkSteps, WALK_STEPS } from "../src/shared/walkthrough-steps.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const indexHtml = rd("src", "renderer", "index.html");
const renderer = rd("src", "renderer", "renderer.js");
let n = 0; const t = () => { n++; };

// 1 — the tab is registered in the nav + has a matching view panel + a body mount.
assert.match(indexHtml, /<button class="nav-item" data-tab="walkthrough">.*Walk-through<\/button>/, "nav button present");
assert.match(indexHtml, /<section id="walkthrough" class="tab-panel">/, "walkthrough tab panel present");
assert.match(indexHtml, /id="walkthroughBody"/, "walkthrough body mount present");
t();

// 2 — the switch is wired exactly like the other tabs (TAB_TITLES entry + lazy loader).
assert.match(renderer, /walkthrough:\s*"Walk-through"/, "TAB_TITLES has walkthrough");
assert.match(renderer, /if \(target === "walkthrough"\) loadWalkthrough\(\);/, "runTabLoaders switches to loadWalkthrough");
assert.match(renderer, /function renderWalkthrough\(/, "renderWalkthrough exists");
assert.match(renderer, /walkStepsFor/, "renderer uses the shared step source (walkStepsFor)");
t();

// 3 — REAL steps for an authored issue (the 5 vetted Tier-0 bindings + web-mapped recipes), each {title, sub}.
for (const id of ["restart-print-spooler", "flush-dns-cache", "wifi-no-internet-v1", "printer-spooler-v1"]) {
  const steps = walkStepsFor(id);
  assert.ok(Array.isArray(steps) && steps.length >= 3, `authored steps for ${id}`);
  for (const s of steps) { assert.ok(s.title && s.sub, `each step has title + sub for ${id}`); }
  assert.equal(hasWalkSteps(id), true, `hasWalkSteps true for ${id}`);
}
// aliases resolve to the same canonical steps (web intent + executor alias).
assert.deepEqual(walkStepsFor("printer"), WALK_STEPS["printer-spooler-v1"], "intent alias → canonical steps");
assert.deepEqual(walkStepsFor("flush-dns"), WALK_STEPS["flush-dns-cache"], "executor alias → canonical steps");
t();

// 4 — REAL-OR-EMPTY: an unknown/unauthored id returns [] (so the UI shows the honest fallback, not a fake walk).
assert.deepEqual(walkStepsFor("totally-unknown-recipe-xyz"), [], "unknown recipe → empty (no fabricated steps)");
assert.equal(hasWalkSteps("totally-unknown-recipe-xyz"), false, "hasWalkSteps false for unknown recipe");
assert.deepEqual(walkStepsFor(""), [], "empty id → empty");
t();

// 5 — the renderer's no-steps branch is an HONEST fallback (KB article + gated resolve), never a blank/fake walk.
const fn = renderer.match(/function renderWalkthrough\([\s\S]*?\n}/)[0];
assert.match(fn, /if \(!steps\.length\)/, "renderer has a no-steps fallback branch");
assert.match(fn, /Guided steps for this exact issue are being written/, "honest 'being written' fallback copy");
assert.match(fn, /Open the KB article/, "fallback offers the verified KB article");
assert.match(fn, /data-walkthrough-resolve=/, "fallback offers the gated resolve path");
// honesty: guide mode never claims a fix happened.
assert.doesNotMatch(fn, /issue resolved|已解决|successfully fixed|has been fixed/i, "guide mode never fakes a resolution");
t();

// 6 — empty state (no issue) offers a Fix-a-problem entry that routes into the ARIA chat (never a dead end).
assert.match(fn, /Fix a problem/, "empty state offers a Fix-a-problem entry");
assert.match(fn, /activateTab\("aria"\)/, "empty state routes into the ARIA chat");
t();

assert.equal(n, 6, "6 walkthrough-tab-render groups");
console.log(`walkthrough-tab-render test passed (${n} groups · tab registered + switchable · real steps for authored issues · real-or-empty [] for unauthored · honest fallback · empty-state routes to chat).`);
