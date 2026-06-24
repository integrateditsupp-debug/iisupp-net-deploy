// RUN 9 — command palette. Asserts command building from recipes + the search filter ranking.
import assert from "node:assert/strict";
import { buildCommands, filterCommands } from "../src/shared/command-palette.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";

const commands = buildCommands(RECIPES);
// Fixed nav/action commands + one run command per recipe.
assert.ok(commands.some((c) => c.id === "nav:privacy"), "has nav commands");
assert.ok(commands.some((c) => c.id === "act:admin"), "has action commands");
assert.equal(commands.filter((c) => c.type === "recipe").length, RECIPES.length, "one Run command per recipe");

// Empty query returns the first N (the fixed actions lead).
const empty = filterCommands(commands, "", 6);
assert.equal(empty.length, 6);
assert.equal(empty[0].type, "nav", "actions/nav lead the default list");

// Searching "dns" surfaces the DNS recipe run command.
const dns = filterCommands(commands, "dns");
assert.ok(dns.some((c) => c.recipeId === "dns-fail-v1"), "dns query finds the DNS recipe");

// Searching "privacy" ranks the privacy nav highly.
const priv = filterCommands(commands, "privacy");
assert.equal(priv[0].id, "nav:privacy", "label-start match ranks first");

// Keyword-only match still surfaces (e.g. 'evidence' → privacy via keywords).
const ev = filterCommands(commands, "evidence");
assert.ok(ev.some((c) => c.id === "nav:privacy"), "keyword match works");

// Limit is respected; no match → empty.
assert.ok(filterCommands(commands, "a", 3).length <= 3);
assert.equal(filterCommands(commands, "zzzzznomatch").length, 0);

console.log(`Command-palette test passed (${commands.length} commands, ranked filter, recipe + nav search).`);
