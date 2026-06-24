// RUN 20 §4 — every Tier-0 recipe dry-runs cleanly, is content-blind, audit-logged, and allowlisted.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TIER0_RECIPES, preview, validateTier0, isAllowedTier0Command } from "../src/main/recipes/tier-0/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "src", "main", "recipes", "tier-0");

// 14 individual recipe files on disk, each importing to a valid descriptor.
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".recipe.mjs"));
assert.equal(files.length, 14, "14 Tier-0 recipe files");
assert.equal(TIER0_RECIPES.length, 14, "catalog exposes 14 recipes");

for (const f of files) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  const r = mod.default;
  assert.ok(r && r.id, `${f} default-exports a descriptor`);
  assert.equal(r.tier, "tier-0-safe-generic", `${f} is tier-0`);
}

for (const r of TIER0_RECIPES) {
  // Valid + safe by construction.
  const v = validateTier0(r);
  assert.ok(v.ok, `${r.id} valid: ${v.errors.join(", ")}`);
  assert.equal(r.touchesSystemFiles, false, `${r.id} never touches system files`);
  assert.equal(r.deletesUserData, false, `${r.id} never deletes user data`);
  assert.equal(r.disablesSecurity, false, `${r.id} never disables security`);
  assert.equal(r.requiresConfirm, true, `${r.id} requires confirmation`);
  for (const c of r.commands) assert.ok(isAllowedTier0Command(c), `${r.id} command allowlisted: ${c}`);

  // Dry-run preview: previews, never executes; carries an audit entry; content-blind (no usernames).
  const p = preview(r);
  assert.equal(p.ok, true, `${r.id} previews ok`);
  assert.equal(p.dryRun, true, `${r.id} defaults to dry-run`);
  assert.match(p.summary, /^\[dry-run\]/, `${r.id} preview marked dry-run`);
  assert.ok(p.audit && p.audit.recipeId === r.id && p.audit.dryRun === true && p.audit.outputHash, `${r.id} audit-logged`);
  assert.doesNotMatch(JSON.stringify(p), /C:\\Users\\[a-z0-9]/i, `${r.id} preview has no user paths`);
}

console.log(`Tier-0-recipes-dryrun test passed (14 recipes · dry-run default · allowlisted · audit-logged · content-blind).`);
