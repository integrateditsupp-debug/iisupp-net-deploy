// Q0b — contract test for the web "Open with ARIA Sentinel" handoff. The website emitter
// (assets/aria-sentinel-handoff.js) and the desktop receiver (src/shared/deep-link.mjs) must agree on the
// aria-sentinel://resolve URL shape EXACTLY, and every intent the web maps must point at a REAL recipe id.
// This guards the web→desktop boundary without needing an installed app or a browser.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEEP_LINK_SCHEME, buildSentinelResolveLink, parseSentinelDeepLink, validateResolveLink } from "../src/shared/deep-link.mjs";
import { recipeById } from "../src/shared/recipes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_FILE = path.join(HERE, "..", "..", "assets", "aria-sentinel-handoff.js");

// 1 — desktop builder round-trips through the desktop parser, and validates as a known recipe.
for (const id of ["printer-spooler-v1", "wifi-no-internet-v1", "disk-low-space-v1", "browser-password-loop-v1"]) {
  const link = buildSentinelResolveLink(id, "printer");
  assert.ok(link.startsWith(DEEP_LINK_SCHEME + "://resolve?recipe="), `link shape for ${id}`);
  const parsed = parseSentinelDeepLink(link);
  assert.equal(parsed.action, "resolve", `action for ${id}`);
  assert.equal(parsed.recipeId, id, `recipe id round-trips for ${id}`);
  const verdict = validateResolveLink(parsed, { isKnownRecipe: (x) => Boolean(recipeById(x)), isBlocked: () => false });
  assert.ok(verdict.ok, `validates ok for ${id}: ${verdict.reason}`);
}

// 2 — falsy recipe id never emits a junk link.
assert.equal(buildSentinelResolveLink("", "x"), "", "empty recipe → empty link");
assert.equal(buildSentinelResolveLink(null), "", "null recipe → empty link");

// 3 — intent is capped at 200 chars on the build side, mirroring the parser cap (content-blind, no PII spill).
const longIntent = "a".repeat(500);
const capped = parseSentinelDeepLink(buildSentinelResolveLink("disk-low-space-v1", longIntent));
assert.equal(capped.intent.length, 200, "build caps intent at 200");

// 4 — the WEB emitter mirrors the desktop builder byte-for-byte (same scheme + same construction).
const web = fs.readFileSync(WEB_FILE, "utf8");
assert.match(web, /var DEEP_LINK_SCHEME = "aria-sentinel";/, "web uses the same scheme literal");
assert.match(web, /DEEP_LINK_SCHEME \+ ":\/\/resolve\?recipe=" \+ encodeURIComponent\(id\)/, "web builds the same recipe segment");
assert.match(web, /"&intent=" \+ encodeURIComponent\(cleanIntent\)/, "web builds the same intent segment");
assert.match(web, /\.slice\(0, 200\)/, "web mirrors the 200-char intent cap");

// 5 — every intent the web maps MUST resolve to a real recipe in the registry (no over-promising / dead ids).
const mapBlock = web.match(/var INTENT_RECIPE = \{([\s\S]*?)\};/);
assert.ok(mapBlock, "web exposes an INTENT_RECIPE map");
const mappedIds = [...mapBlock[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
assert.ok(mappedIds.length >= 4, "web maps at least 4 intents");
for (const id of mappedIds) {
  assert.ok(recipeById(id), `web-mapped recipe id is real: ${id}`);
}

// 6 — a forged/unknown recipe id is refused by the validator (browser cannot inject arbitrary fixes).
const forged = parseSentinelDeepLink(buildSentinelResolveLink("rm-rf-everything", "evil"));
const forgedVerdict = validateResolveLink(forged, { isKnownRecipe: (x) => Boolean(recipeById(x)), isBlocked: () => false });
assert.equal(forgedVerdict.ok, false, "unknown recipe refused");
assert.equal(forgedVerdict.reason, "unknown_recipe", "unknown recipe reason");

console.log("web-handoff-contract test passed (6 groups · build↔parse round-trip · empty-guard · 200-cap mirror · web emitter byte-parity · mapped ids real · forged id refused).");
