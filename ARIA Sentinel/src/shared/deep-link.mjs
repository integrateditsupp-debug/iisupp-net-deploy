// Slice C — pure parser/validator for aria-sentinel:// deep-links handed in from the web "Open with ARIA
// Sentinel" button. Kept OFF the Electron main process so the security-critical logic is unit-testable.
// A link NEVER carries a command — only a recipe id + an intent string. The id is validated against the
// local registry by the caller; an arbitrary browser-supplied id is rejected.
export const DEEP_LINK_SCHEME = "aria-sentinel";

/** Parse aria-sentinel://resolve?recipe=<id>&intent=<text>. Returns null for anything not our scheme. */
export function parseSentinelDeepLink(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch { return null; }
  if (url.protocol !== DEEP_LINK_SCHEME + ":") return null;
  const action = (url.hostname || url.pathname.replace(/^\/+/, "")).toLowerCase();
  const recipeId = String(url.searchParams.get("recipe") || "").trim();
  const intent = String(url.searchParams.get("intent") || "").slice(0, 200); // cap — content-blind, no raw PII spill
  return { scheme: DEEP_LINK_SCHEME, action, recipeId, intent };
}

/**
 * Decide whether a parsed link is safe to act on. `isKnownRecipe(id)` MUST be supplied by the caller (the
 * local recipe registry) so an unknown/forged id is refused. `isBlocked(s)` applies R11 (private folder).
 */
export function validateResolveLink(parsed, { isKnownRecipe, isBlocked } = {}) {
  if (!parsed) return { ok: false, reason: "unparseable" };
  if (typeof isBlocked === "function" && (isBlocked(parsed.recipeId) || isBlocked(parsed.intent))) {
    return { ok: false, reason: "r11_blocked" };
  }
  if (parsed.action !== "resolve") return { ok: false, reason: "unsupported_action" };
  if (!parsed.recipeId) return { ok: false, reason: "no_recipe" };
  if (typeof isKnownRecipe === "function" && !isKnownRecipe(parsed.recipeId)) {
    return { ok: false, reason: "unknown_recipe" };
  }
  return { ok: true, reason: "" };
}
