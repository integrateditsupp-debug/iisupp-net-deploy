// The web deep-link carries a `mode`: "walkthrough" → open the desktop Walk-through tab in GUIDE mode (changes
// nothing); "apply"/absent → the gated apply flow. This locks: (a) the pure parser/builder handle mode without
// weakening the existing trust boundary, and (b) main.mjs routes walkthrough to the guide tab (NO fix) and
// apply/absent to runSupervisedFix — all still R11-checked + vetted-gated (mode never bypasses validation).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseSentinelDeepLink, buildSentinelResolveLink, validateResolveLink } from "../src/shared/deep-link.mjs";

const known = new Set(["wifi-no-internet-v1", "printer-spooler-v1"]);
const isKnownRecipe = (id) => known.has(id);
const isBlocked = (s) => /private pics and vids/i.test(String(s || ""));
let n = 0; const t = () => { n++; };

// 1 — mode=walkthrough parses to "walkthrough"; validation is unaffected (still ok for a known recipe).
const w = parseSentinelDeepLink("aria-sentinel://resolve?recipe=wifi-no-internet-v1&intent=no%20net&mode=walkthrough");
assert.equal(w.mode, "walkthrough", "walkthrough mode parsed");
assert.equal(w.action, "resolve");
assert.deepEqual(validateResolveLink(w, { isKnownRecipe, isBlocked }), { ok: true, reason: "" }, "walkthrough still validates");
t();

// 2 — mode=apply parses to "apply"; absent parses to "" (both go through the gated apply flow in main).
assert.equal(parseSentinelDeepLink("aria-sentinel://resolve?recipe=printer-spooler-v1&mode=apply").mode, "apply", "apply mode parsed");
assert.equal(parseSentinelDeepLink("aria-sentinel://resolve?recipe=printer-spooler-v1").mode, "", "absent mode → empty");
// a garbage mode normalizes to "" (never trusts an arbitrary browser value).
assert.equal(parseSentinelDeepLink("aria-sentinel://resolve?recipe=printer-spooler-v1&mode=rm-rf").mode, "", "garbage mode → empty");
t();

// 3 — builder appends mode and round-trips through the parser byte-for-byte.
const link = buildSentinelResolveLink("wifi-no-internet-v1", "no internet", "walkthrough");
assert.ok(link.includes("&mode=walkthrough"), "builder appends mode");
assert.equal(parseSentinelDeepLink(link).mode, "walkthrough", "build→parse round-trips mode");
assert.equal(buildSentinelResolveLink("wifi-no-internet-v1", "x", "bogus").includes("mode="), false, "builder drops a bogus mode");
t();

// 4 — SAFETY: mode does NOT bypass R11 or the known-recipe gate.
const blocked = parseSentinelDeepLink("aria-sentinel://resolve?recipe=wifi-no-internet-v1&intent=Private%20pics%20and%20Vids&mode=walkthrough");
assert.equal(validateResolveLink(blocked, { isKnownRecipe, isBlocked }).reason, "r11_blocked", "R11 still blocks even in walkthrough mode");
const forged = parseSentinelDeepLink("aria-sentinel://resolve?recipe=rm-rf-everything&mode=walkthrough");
assert.equal(validateResolveLink(forged, { isKnownRecipe, isBlocked }).reason, "unknown_recipe", "unknown recipe still refused in walkthrough mode");
t();

// 5 — main.mjs wiring: walkthrough → the guide tab (NO fix), apply/absent → the gated runSupervisedFix.
const main = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "main", "main.mjs"), "utf8");
const handler = main.match(/function handleSentinelDeepLink[\s\S]*?\n}/)[0];
assert.match(handler, /const wantsWalkthrough = parsed\.mode === "walkthrough";/, "handler branches on walkthrough mode");
assert.match(handler, /if \(wantsWalkthrough\) \{[\s\S]*?openWalkthroughTab\(parsed\.recipeId/, "walkthrough opens the guide tab");
// the walkthrough branch returns BEFORE the apply flow — it must not call runSupervisedFix.
const walkBranch = handler.match(/if \(wantsWalkthrough\) \{[\s\S]*?return;\n\s*\}/)[0];
assert.doesNotMatch(walkBranch, /runSupervisedFix/, "walkthrough (guide) never runs a fix");
assert.match(handler, /runSupervisedFix\(\{ recipeId: parsed\.recipeId, mode: "confirmed"/, "apply/absent → gated supervised fix");
// openWalkthroughTab never executes a recipe (guide mode is pure display).
const openFn = main.match(/function openWalkthroughTab[\s\S]*?\n}/)[0];
assert.doesNotMatch(openFn, /runSupervisedFix|runRecipe\(/, "openWalkthroughTab changes nothing on the machine");
t();

assert.equal(n, 5, "5 deep-link-walkthrough-mode groups");
console.log(`deep-link-walkthrough-mode test passed (${n} groups · mode parse/build round-trip · garbage/bogus normalized · R11 + known-recipe gate still enforced · main routes walkthrough→guide(no fix) vs apply→gated).`);
