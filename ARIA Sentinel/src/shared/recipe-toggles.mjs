// recipe-toggles — the pure, content-blind model behind "turn a specific fix OFF so ARIA never
// auto-runs it". Two scopes:
//   • GLOBAL  — a recipe is off on this whole device (electron-store `recipeToggles.global`).
//   • PER-SITE — a browser recipe is off on ONE origin only (electron-store `recipeToggles.sites`).
// Default is ENABLED; we persist ONLY the OFF entries, so the store stays tiny and content-blind
// (it holds internal recipe ids + bare hostnames the admin explicitly typed — never page content).
//
// The desktop's gated executor/classifier calls isRecipeEnabled() before any auto-fire, so a disabled
// recipe can never auto-run. The Settings → Resolution surface renders each toggle from the same model.
// This module is Electron-free + dependency-free so tests/recipe-toggles.test.mjs can exercise it directly,
// and the browser extension already owns the complementary whole-site "leave me alone" list (site-prefs.js).

export const RECIPE_TOGGLES_KEY = "recipeToggles";

/** Reduce a URL / host string to a bare, comparable hostname (lowercased, no leading www., no path). */
export function normalizeOrigin(input) {
  if (!input) return "";
  let host = String(input);
  if (host.indexOf("://") !== -1) {
    try { host = new URL(host).hostname; } catch { /* fall through with raw string */ }
  }
  host = host.trim().toLowerCase();
  if (host.indexOf("/") !== -1) host = host.split("/")[0];
  if (host.indexOf("@") !== -1) host = host.split("@").pop();
  if (host.indexOf(":") !== -1) host = host.split(":")[0]; // drop any :port
  if (host.indexOf("www.") === 0) host = host.slice(4);
  return host;
}

/** Sanitize a recipe id to the safe id charset the registry uses (letters, digits, dot, underscore, dash). */
export function normalizeRecipeId(input) {
  return String(input == null ? "" : input).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "").slice(0, 120);
}

// Keep only the entries a scope explicitly turned OFF (value === false). Everything absent = enabled.
function collectOff(bucket) {
  const out = {};
  if (bucket && typeof bucket === "object") {
    for (const [rawId, value] of Object.entries(bucket)) {
      const id = normalizeRecipeId(rawId);
      if (id && value === false) out[id] = false;
    }
  }
  return out;
}

/** Normalize a possibly-partial / legacy value read from disk into a safe { global, sites } shape. */
export function normalizeToggles(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const global = collectOff(src.global);
  const sites = {};
  if (src.sites && typeof src.sites === "object") {
    for (const [rawOrigin, bucket] of Object.entries(src.sites)) {
      const origin = normalizeOrigin(rawOrigin);
      if (!origin) continue;
      const off = collectOff(bucket);
      if (Object.keys(off).length) sites[origin] = off;
    }
  }
  return { global, sites };
}

/**
 * Is this recipe allowed to auto-run? Disabled globally → false everywhere. Disabled for a given
 * origin → false only on that site. An unknown recipe/origin defaults to ENABLED (true).
 */
export function isRecipeEnabled(toggles, recipeId, origin = "") {
  const t = normalizeToggles(toggles);
  const id = normalizeRecipeId(recipeId);
  if (!id) return true;
  if (t.global[id] === false) return false;
  const host = normalizeOrigin(origin);
  if (host && t.sites[host] && t.sites[host][id] === false) return false;
  return true;
}

/**
 * Return a NEW toggles object with (recipeId[, origin]) set enabled/disabled. Pure — never mutates input.
 * Enabling prunes the OFF entry (and any now-empty site bucket) so the store only ever holds real rules.
 */
export function setRecipeEnabled(toggles, recipeId, enabled, origin = "") {
  const t = normalizeToggles(toggles);
  const id = normalizeRecipeId(recipeId);
  if (!id) return t;
  const host = normalizeOrigin(origin);
  const next = { global: { ...t.global }, sites: {} };
  for (const [o, bucket] of Object.entries(t.sites)) next.sites[o] = { ...bucket };

  if (host) {
    const bucket = { ...(next.sites[host] || {}) };
    if (enabled === false) bucket[id] = false;
    else delete bucket[id];
    if (Object.keys(bucket).length) next.sites[host] = bucket;
    else delete next.sites[host];
  } else {
    if (enabled === false) next.global[id] = false;
    else delete next.global[id];
  }
  return next;
}

/** Ids turned off globally (this device). */
export function disabledGlobalIds(toggles) {
  return Object.keys(normalizeToggles(toggles).global).sort();
}

/** Origins on which THIS recipe is turned off (per-site rules for one recipe). */
export function siteRulesForRecipe(toggles, recipeId) {
  const t = normalizeToggles(toggles);
  const id = normalizeRecipeId(recipeId);
  if (!id) return [];
  return Object.keys(t.sites).filter((origin) => t.sites[origin][id] === false).sort();
}

/** Small honest rollup for the UI meta line (real-or-empty; no invented numbers). */
export function toggleSummary(toggles) {
  const t = normalizeToggles(toggles);
  const globalDisabled = Object.keys(t.global).length;
  let siteRuleCount = 0;
  for (const bucket of Object.values(t.sites)) siteRuleCount += Object.keys(bucket).length;
  return { globalDisabled, siteRuleCount, sitesAffected: Object.keys(t.sites).length };
}
