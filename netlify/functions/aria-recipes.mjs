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
import crypto from "node:crypto";
import { RECIPES, RECIPE_COUNT } from "./aria-recipes-data.mjs";

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

export const config = { path: "/aria-recipes" };
