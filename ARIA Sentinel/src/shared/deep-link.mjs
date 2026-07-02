// Slice C — pure parser/validator for aria-sentinel:// deep-links handed in from the web "Open with ARIA
// Sentinel" button. Kept OFF the Electron main process so the security-critical logic is unit-testable.
// A link NEVER carries a command — only a recipe id + an intent string. The id is validated against the
// local registry by the caller; an arbitrary browser-supplied id is rejected.
export const DEEP_LINK_SCHEME = "aria-sentinel";

/** Parse aria-sentinel://resolve?recipe=<id>&intent=<text>&mode=<walkthrough|apply>. Returns null for anything not our scheme. */
export function parseSentinelDeepLink(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "")); } catch { return null; }
  if (url.protocol !== DEEP_LINK_SCHEME + ":") return null;
  const action = (url.hostname || url.pathname.replace(/^\/+/, "")).toLowerCase();
  const recipeId = String(url.searchParams.get("recipe") || "").trim();
  const intent = String(url.searchParams.get("intent") || "").slice(0, 200); // cap — content-blind, no raw PII spill
  // mode selects the DESKTOP disposition only (never a command): "walkthrough" → open the Walk-through tab in
  // GUIDE mode (changes nothing); "apply"/absent → the gated apply flow. Anything else normalizes to "" (apply).
  const rawMode = String(url.searchParams.get("mode") || "").trim().toLowerCase();
  const mode = (rawMode === "walkthrough" || rawMode === "apply") ? rawMode : "";
  return { scheme: DEEP_LINK_SCHEME, action, recipeId, intent, mode };
}

/**
 * Build the canonical aria-sentinel://resolve?recipe=<id>&intent=<text> link that the web "Open with ARIA
 * Sentinel" button hands to the installed app. THIS is the single source of truth for the URL shape — the
 * web emitter (assets/aria-sentinel-handoff.js) mirrors this byte-for-byte and the contract test asserts
 * parse(build(...)) round-trips. Returns "" for a falsy recipe id so the caller never emits a junk link.
 */
export function buildSentinelResolveLink(recipeId, intent = "", mode = "") {
  const id = String(recipeId || "").trim();
  if (!id) return "";
  let link = `${DEEP_LINK_SCHEME}://resolve?recipe=${encodeURIComponent(id)}`;
  const cleanIntent = String(intent || "").slice(0, 200); // cap — content-blind, mirror of the parser
  if (cleanIntent) link += `&intent=${encodeURIComponent(cleanIntent)}`;
  const cleanMode = String(mode || "").trim().toLowerCase();
  if (cleanMode === "walkthrough" || cleanMode === "apply") link += `&mode=${cleanMode}`;
  return link;
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
