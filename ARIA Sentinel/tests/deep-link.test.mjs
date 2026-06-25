// Slice C — the aria-sentinel:// deep-link is a trust boundary: a web page hands a fix to the local app.
// These cases lock the parse + validate contract so only a KNOWN recipe id (never an arbitrary/forged id
// or a command) is ever actioned, R11 is enforced, and the intent string is capped (content-blind).
import assert from "node:assert/strict";
import { parseSentinelDeepLink, validateResolveLink, DEEP_LINK_SCHEME } from "../src/shared/deep-link.mjs";

const known = new Set(["wifi-no-internet-v1", "office-file-repair-v1", "zoom-weird-v1"]);
const isKnownRecipe = (id) => known.has(id);
const isBlocked = (s) => /private pics and vids/i.test(String(s || ""));

assert.equal(DEEP_LINK_SCHEME, "aria-sentinel");

// 1. happy path — known recipe, resolve action → ok.
const a = parseSentinelDeepLink("aria-sentinel://resolve?recipe=wifi-no-internet-v1&intent=no%20internet");
assert.equal(a.action, "resolve");
assert.equal(a.recipeId, "wifi-no-internet-v1");
assert.equal(a.intent, "no internet");
assert.deepEqual(validateResolveLink(a, { isKnownRecipe, isBlocked }), { ok: true, reason: "" });

// 2. unknown / forged recipe id → rejected (never trust a browser-supplied id).
const b = parseSentinelDeepLink("aria-sentinel://resolve?recipe=rm-rf-everything");
assert.equal(validateResolveLink(b, { isKnownRecipe, isBlocked }).reason, "unknown_recipe");

// 3. wrong action → rejected.
const c = parseSentinelDeepLink("aria-sentinel://exec?recipe=wifi-no-internet-v1");
assert.equal(validateResolveLink(c, { isKnownRecipe, isBlocked }).reason, "unsupported_action");

// 4. R11 — a private-folder reference anywhere → blocked before anything else.
const d = parseSentinelDeepLink("aria-sentinel://resolve?recipe=wifi-no-internet-v1&intent=Private%20pics%20and%20Vids");
assert.equal(validateResolveLink(d, { isKnownRecipe, isBlocked }).reason, "r11_blocked");

// 5. wrong scheme (e.g. a normal https link) → not ours, parse returns null.
assert.equal(parseSentinelDeepLink("https://iisupp.net/aria?recipe=x"), null);
assert.equal(parseSentinelDeepLink("javascript:alert(1)"), null);
assert.equal(parseSentinelDeepLink("not a url"), null);

// 6. missing recipe → no_recipe.
const e = parseSentinelDeepLink("aria-sentinel://resolve");
assert.equal(validateResolveLink(e, { isKnownRecipe, isBlocked }).reason, "no_recipe");

// 7. intent is length-capped (content-blind — no unbounded PII spill).
const long = "x".repeat(500);
const f = parseSentinelDeepLink(`aria-sentinel://resolve?recipe=zoom-weird-v1&intent=${long}`);
assert.equal(f.intent.length, 200);

console.log("deep-link test passed (7 cases · only known recipe ids actioned · R11 enforced · intent capped · foreign schemes rejected).");
