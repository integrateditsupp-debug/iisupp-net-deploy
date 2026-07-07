// recipe-toggles test — the per-recipe / per-site enable-disable model behind Settings → Resolution.
// Pure functions, no Electron. Asserts: default enabled; global OFF wins everywhere; per-site OFF is scoped
// to one origin; enabling prunes rules (and empty site buckets); normalize keeps only real OFF entries and
// is content-blind; setRecipeEnabled never mutates its input; the summary counts are honest.
import assert from "node:assert/strict";
import {
  RECIPE_TOGGLES_KEY,
  normalizeOrigin,
  normalizeRecipeId,
  normalizeToggles,
  isRecipeEnabled,
  setRecipeEnabled,
  disabledGlobalIds,
  siteRulesForRecipe,
  toggleSummary
} from "../src/shared/recipe-toggles.mjs";

// 0) The store key is the stable string main.mjs persists under.
assert.equal(RECIPE_TOGGLES_KEY, "recipeToggles");

// 1) normalizeOrigin reduces any URL/host to a bare comparable hostname.
assert.equal(normalizeOrigin("https://www.Example.com/some/path?q=1"), "example.com");
assert.equal(normalizeOrigin("HTTP://Portal.Contoso.COM:8443"), "portal.contoso.com");
assert.equal(normalizeOrigin("www.site.io"), "site.io");
assert.equal(normalizeOrigin("user@host.local"), "host.local");
assert.equal(normalizeOrigin(""), "");
assert.equal(normalizeOrigin(null), "");

// 2) normalizeRecipeId sanitizes to the registry's id charset.
assert.equal(normalizeRecipeId("Teams-Cache-v1"), "teams-cache-v1");
assert.equal(normalizeRecipeId("bad id!!<script>"), "badidscript");

// 3) Default (nothing stored) → every recipe is enabled.
assert.equal(isRecipeEnabled(undefined, "dns-fail-v1"), true);
assert.equal(isRecipeEnabled({}, "teams-cache-v1", "example.com"), true);

// 4) A GLOBAL disable turns the recipe off everywhere (with or without an origin).
const g = setRecipeEnabled({}, "dns-fail-v1", false);
assert.equal(isRecipeEnabled(g, "dns-fail-v1"), false);
assert.equal(isRecipeEnabled(g, "dns-fail-v1", "anything.com"), false);
assert.equal(isRecipeEnabled(g, "teams-cache-v1"), true, "other recipes untouched");
assert.deepEqual(disabledGlobalIds(g), ["dns-fail-v1"]);

// 5) A PER-SITE disable is scoped to exactly one origin; the recipe stays enabled elsewhere.
const s = setRecipeEnabled({}, "browser-cache-stale-v1", false, "https://mail.google.com/inbox");
assert.equal(isRecipeEnabled(s, "browser-cache-stale-v1", "mail.google.com"), false);
assert.equal(isRecipeEnabled(s, "browser-cache-stale-v1", "www.mail.google.com"), false, "origin normalized on read");
assert.equal(isRecipeEnabled(s, "browser-cache-stale-v1", "other.com"), true);
assert.equal(isRecipeEnabled(s, "browser-cache-stale-v1"), true, "no origin → global scope still enabled");
assert.deepEqual(siteRulesForRecipe(s, "browser-cache-stale-v1"), ["mail.google.com"]);

// 6) Enabling prunes the rule — global.
const g2 = setRecipeEnabled(g, "dns-fail-v1", true);
assert.deepEqual(disabledGlobalIds(g2), [], "global disable pruned on enable");
assert.equal(isRecipeEnabled(g2, "dns-fail-v1"), true);

// 7) Enabling prunes the rule — per-site, and drops the now-empty origin bucket.
const s2 = setRecipeEnabled(s, "browser-cache-stale-v1", true, "mail.google.com");
assert.deepEqual(siteRulesForRecipe(s2, "browser-cache-stale-v1"), []);
assert.equal(Object.keys(normalizeToggles(s2).sites).length, 0, "empty site bucket pruned");

// 8) setRecipeEnabled is pure — it never mutates the input object.
const base = { global: {}, sites: {} };
const frozenIn = JSON.parse(JSON.stringify(base));
setRecipeEnabled(base, "x-v1", false);
setRecipeEnabled(base, "y-v1", false, "a.com");
assert.deepEqual(base, frozenIn, "input toggles object is not mutated");

// 9) Two site rules on the same origin coexist; disabling one leaves the other.
let multi = setRecipeEnabled({}, "zoom-weird-v1", false, "app.co");
multi = setRecipeEnabled(multi, "browser-cache-stale-v1", false, "app.co");
assert.equal(isRecipeEnabled(multi, "zoom-weird-v1", "app.co"), false);
assert.equal(isRecipeEnabled(multi, "browser-cache-stale-v1", "app.co"), false);
const sum = toggleSummary(multi);
assert.deepEqual(sum, { globalDisabled: 0, siteRuleCount: 2, sitesAffected: 1 });

// 10) normalizeToggles is content-blind: it keeps ONLY explicit false entries and drops junk/true/empty.
const messy = {
  global: { "keep-v1": false, "on-v1": true, "num-v1": 0, "str-v1": "false" },
  sites: { "WWW.Site.Com/": { "a-v1": false, "b-v1": true }, "empty.com": { "c-v1": true }, "": { "z-v1": false } }
};
const norm = normalizeToggles(messy);
assert.deepEqual(norm.global, { "keep-v1": false }, "only real OFF kept globally");
assert.deepEqual(Object.keys(norm.sites), ["site.com"], "blank + all-true origins dropped, host normalized");
assert.deepEqual(norm.sites["site.com"], { "a-v1": false });

// 11) Round-trip: normalize(normalize(x)) is stable (safe to persist + reload).
assert.deepEqual(normalizeToggles(norm), norm);

// 12) A global disable AND a re-enable-on-one-site is coherent (global wins — still off there).
let combo = setRecipeEnabled({}, "audio-no-output-v1", false);        // globally off
combo = setRecipeEnabled(combo, "audio-no-output-v1", false, "x.com"); // also a site rule
assert.equal(isRecipeEnabled(combo, "audio-no-output-v1", "x.com"), false, "global off dominates");

console.log("recipe-toggles test passed (origin/id normalize · global + per-site scope · prune-on-enable · pure · content-blind · summary).");
