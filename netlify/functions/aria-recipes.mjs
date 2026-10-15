// Netlify function: aria-recipes — the live control-plane recipe index for ARIA Guided Fix and the
// ARIA Sentinel desktop agent (RECIPE_ENDPOINT).
//
// Content-blind: no customer content is accepted or stored. { privacy.uploadToIisupp:false } makes that
// contract explicit, and the x-aria-recipes-sha256 header lets clients detect tampering of the index in
// transit. The recipe library itself is IIS-vetted public IP (aria-recipes-data.mjs, single source of truth).
//
// CONTROL-PLANE KILL SWITCH (preserve — see ARIA Sentinel/src/shared/kill-switch.mjs): the desktop agent
// reads `killed` from this response and, when true, forces DETECT-ONLY mode fleet-wide (watchers keep
// running; no recipe may APPLY a change). Ops can flip the global kill without a code change by setting
// ARIA_RECIPES_KILLED=1 (optional ARIA_RECIPES_KILL_REASON). Default killed:false keeps remediation enabled.
//
// SENTINEL-BACKEND 2026-10-14 (audit B8): a v2 function with `config.path` is served ONLY at that path, and the
// desktop pulls /.netlify/functions/aria-recipes (ARIA Sentinel/src/shared/recipes.mjs RECIPE_ENDPOINT) — live
// that answered 404, so "Update knowledge" showed every endpoint red and the kill switch above never reached a
// single device. Both paths are declared now; /aria-recipes keeps working.
// (audit B18) x-aria-recipes-sha256 is an INTEGRITY CHECKSUM of the body computed by this server — it lets a
// client detect in-transit corruption, it is not a signature (anyone who can alter the body can recompute it).
import crypto from "node:crypto";
import { RECIPES, RECIPE_COUNT } from "./aria-recipes-data.mjs";

export const RECIPES_PATHS = Object.freeze(["/aria-recipes", "/.netlify/functions/aria-recipes"]);

function killState() {
  const killed = process.env.ARIA_RECIPES_KILLED === "1";
  return {
    killed,
    reason: killed ? String(process.env.ARIA_RECIPES_KILL_REASON || "control plane disabled fixes").slice(0, 200) : ""
  };
}

export function buildRecipeIndex() {
  const { killed, reason } = killState();
  return {
    ok: true,
    schema: "aria-recipes/v1",
    privacy: { uploadToIisupp: false },
    counts: { total: RECIPE_COUNT },
    killed,
    reason,
    recipes: RECIPES
  };
}

export default async function handler() {
  const body = JSON.stringify(buildRecipeIndex());
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "x-aria-recipes-sha256": sha256
    }
  });
}

// Netlify's bundler reads this export STATICALLY (an object literal of literals) — a spread of RECIPES_PATHS broke the
// 2026-10-15 production build ("configuration error on 'path': Must be a string or array of strings"). Keep the
// two literals in lockstep with RECIPES_PATHS; tests/netlify-function-config-static.test.mjs pins both.
export const config = { path: ["/aria-recipes", "/.netlify/functions/aria-recipes"] };
