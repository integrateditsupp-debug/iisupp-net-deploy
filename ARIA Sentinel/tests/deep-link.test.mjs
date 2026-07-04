// Q0b - aria-sentinel:// deep-link receiver: pure parser/validator, no commands, R11 gate.
import assert from "node:assert/strict";
import { DEEP_LINK_SCHEME, buildResolveDeepLink, parseSentinelDeepLink, validateResolveLink } from "../src/shared/deep-link.mjs";

let n = 0;
const t = () => { n++; };

assert.equal(DEEP_LINK_SCHEME, "aria-sentinel");
const link = buildResolveDeepLink({ recipeId: "dns-fail-v1", intent: "no internet", source: "web" });
assert.match(link, /^aria-sentinel:\/\/resolve\?/);
assert.doesNotMatch(link, /powershell|cmd\.exe|Start-Process/i);
t();

const parsed = parseSentinelDeepLink(link);
assert.equal(parsed.action, "resolve");
assert.equal(parsed.recipeId, "dns-fail-v1");
assert.equal(parsed.intent, "no internet");
t();

const valid = validateResolveLink(parsed, { isKnownRecipe: (id) => id === "dns-fail-v1" });
assert.deepEqual(valid, { ok: true, reason: "ok", recipeId: "dns-fail-v1", intent: "no internet", source: "web" });
assert.equal(validateResolveLink(parseSentinelDeepLink("aria-sentinel://resolve?recipe=bad id"), {}).reason, "bad_recipe");
assert.equal(validateResolveLink(parsed, { isKnownRecipe: () => false }).reason, "unknown_recipe");
t();

const blocked = parseSentinelDeepLink(buildResolveDeepLink({ recipeId: "dns-fail-v1", intent: "C:\\Users\\a\\private pics and vids\\x" }));
assert.equal(validateResolveLink(blocked, { isKnownRecipe: () => true, isBlocked: (s) => /private pics and vids/i.test(s) }).reason, "r11_blocked");
assert.equal(parseSentinelDeepLink("https://iisupp.net/aria"), null);
t();

assert.equal(n, 4, "4 deep-link groups");
console.log(`Deep-link test passed (${n} groups - build, parse, validate, R11 block).`);
