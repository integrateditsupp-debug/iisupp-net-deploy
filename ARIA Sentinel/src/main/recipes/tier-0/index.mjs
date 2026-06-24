// RUN 20 §4 — Tier-0 recipe contract: validation, content-blind dry-run preview, and audit shape.
// Pure + node-safe; main.mjs wires the (still dry-run-default, user-confirmed) execution on top.
import { TIER0, TIER0_RECIPES, TIER0_IDS, TIER0_ALLOWED_PREFIXES, TIER0_DENY, recipes } from "./catalog.mjs";

export { TIER0, TIER0_RECIPES, TIER0_IDS, recipes };

const firstToken = (cmd) => String(cmd || "").trim().split(/\s+/)[0];

/** Is a single command on the Tier-0 allowlist (and not on the deny list)? */
export function isAllowedTier0Command(cmd) {
  if (!cmd || TIER0_DENY.test(cmd)) return false;
  // clear-temp's Remove-Item is allowed ONLY when scoped to %TEMP% — never Windows/System32/Users docs.
  if (/^Remove-Item/i.test(cmd) && !/\$env:TEMP/i.test(cmd)) return false;
  return TIER0_ALLOWED_PREFIXES.includes(firstToken(cmd));
}

/** Validate a Tier-0 descriptor: safe flags + every command allowlisted. Returns {ok, errors[]}. */
export function validateTier0(recipe) {
  const errors = [];
  if (!recipe || recipe.tier !== TIER0) errors.push("not a tier-0 recipe");
  if (!recipe?.id || !recipe?.title) errors.push("missing id/title");
  if (recipe?.touchesSystemFiles) errors.push("tier-0 must not touch system files");
  if (recipe?.deletesUserData) errors.push("tier-0 must not delete user data");
  if (recipe?.disablesSecurity) errors.push("tier-0 must not disable security");
  if (recipe?.requiresConfirm !== true) errors.push("tier-0 must require confirmation");
  if (recipe?.dryRunDefault !== true) errors.push("tier-0 must default to dry-run");
  for (const c of recipe?.commands || []) if (!isAllowedTier0Command(c)) errors.push(`command not allowlisted: ${c}`);
  // clear-temp scope guard: a delete recipe must be scoped to TEMP, never the Windows dir.
  if ((recipe?.commands || []).some((c) => /Remove-Item/i.test(c))) {
    if ((recipe.commands || []).some((c) => /Remove-Item/i.test(c) && /(windows\\|system32|\\users\\(?!.*temp))/i.test(c))) {
      errors.push("delete touches a protected location");
    }
  }
  return { ok: errors.length === 0, errors };
}

// Tiny content-blind hash (djb2) — no crypto dep; never includes PII (commands use $env:TEMP, not names).
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** The audit entry every Tier-0 run appends (content-blind: ids + flags + an output hash only). */
export function auditEntry(recipe, { dryRun = true, exitCode = null, output = "" } = {}) {
  return {
    recipeId: recipe.id,
    tier: TIER0,
    dryRun: Boolean(dryRun),
    exitCode,
    outputHash: hash(String(output || recipe.commands.join("|"))),
    readOnly: Boolean(recipe.readOnly)
  };
}

/**
 * Dry-run preview: shows the user EXACTLY what will run, never executes. Content-blind.
 * @returns {{ ok, dryRun, recipeId, title, summary, commands, requiresReboot, requiresConfirm, audit }}
 */
export function preview(recipe) {
  const valid = validateTier0(recipe);
  return {
    ok: valid.ok,
    dryRun: true,
    recipeId: recipe.id,
    title: recipe.title,
    summary: `[dry-run] ${recipe.whatItDoes}`,
    commands: recipe.commands.slice(),
    requiresReboot: Boolean(recipe.requiresReboot),
    requiresConfirm: true,
    readOnly: Boolean(recipe.readOnly),
    audit: auditEntry(recipe, { dryRun: true }),
    errors: valid.errors
  };
}

export function tier0ById(id) { return recipes[id] || null; }
