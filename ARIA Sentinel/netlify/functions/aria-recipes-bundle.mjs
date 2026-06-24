// Netlify function: versioned + signed recipe bundle. Returns the content-blind recipe registry
// with an HMAC signature so the desktop agent can verify integrity before trusting a bundle.
// Project-local until copied to the live deploy dir — nothing is published by this file.
import crypto from "node:crypto";
import { RECIPES, SENTINEL_VERSION } from "../../src/shared/recipes.mjs";

function publicRecipe(r) {
  return { id: r.id, signal: r.signal, family: r.family, risk: r.risk, mode: r.mode, title: r.title };
}

export function buildSignedBundle(secret) {
  const payload = { version: SENTINEL_VERSION, count: RECIPES.length, recipes: RECIPES.map(publicRecipe) };
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", String(secret || "")).update(body).digest("hex");
  return { ...payload, signature, alg: "HMAC-SHA256" };
}

export async function handler() {
  const secret = process.env.RECIPE_BUNDLE_SECRET || "";
  const bundle = buildSignedBundle(secret);
  return {
    statusCode: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    body: JSON.stringify(bundle)
  };
}

export const config = { path: "/aria-recipes-bundle" };
