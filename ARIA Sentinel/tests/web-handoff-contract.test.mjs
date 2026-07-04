// Q0b - web handoff contract: emitter link round-trips to desktop receiver and main gates as Confirmed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildResolveDeepLink, parseSentinelDeepLink, validateResolveLink } from "../src/shared/deep-link.mjs";

const root = resolve(import.meta.dirname, "..");
const main = readFileSync(join(root, "src", "main", "main.mjs"), "utf8");

const url = buildResolveDeepLink({ recipeId: "printer-spooler-v1", intent: "printer queue stuck" });
const parsed = parseSentinelDeepLink(url);
const verdict = validateResolveLink(parsed, { isKnownRecipe: (id) => id === "printer-spooler-v1" });
assert.equal(verdict.ok, true);
assert.equal(verdict.recipeId, "printer-spooler-v1");

assert.match(main, /setAsDefaultProtocolClient\(DEEP_LINK_SCHEME/, "desktop registers aria-sentinel protocol");
assert.match(main, /handleSentinelDeepLink/, "desktop has a deep-link handler");
assert.match(main, /mode:\s*"confirmed"/, "web-originated resolve is forced through Confirmed gating");
assert.doesNotMatch(main, /mode:\s*"autonomous"[\s\S]{0,120}Deep-link/, "deep-link does not request autonomous mode");

console.log("Web handoff contract test passed (safe resolve URL round-trip + desktop Confirmed gate).");
