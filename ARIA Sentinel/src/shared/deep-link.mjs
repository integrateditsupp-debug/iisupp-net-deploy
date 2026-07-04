// Safe aria-sentinel:// handoff links. Pure parser/validator only.
// A link may request a known recipe id and a short intent string; it never carries commands.
export const DEEP_LINK_SCHEME = "aria-sentinel";

const RECIPE_RE = /^[a-z0-9][a-z0-9_.-]{1,100}$/i;

export function buildResolveDeepLink({ recipeId, intent = "", source = "web" } = {}) {
  const id = String(recipeId || "").trim();
  const params = new URLSearchParams();
  if (id) params.set("recipe", id);
  if (intent) params.set("intent", String(intent).slice(0, 500));
  if (source) params.set("source", String(source).slice(0, 40));
  return `${DEEP_LINK_SCHEME}://resolve?${params.toString()}`;
}

export function parseSentinelDeepLink(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.startsWith(`${DEEP_LINK_SCHEME}://`)) return null;
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== `${DEEP_LINK_SCHEME}:`) return null;
  const action = (url.hostname || url.pathname.replace(/^\/+/, "") || "").toLowerCase();
  return {
    action,
    recipeId: String(url.searchParams.get("recipe") || url.searchParams.get("recipeId") || "").trim(),
    intent: String(url.searchParams.get("intent") || "").slice(0, 500),
    source: String(url.searchParams.get("source") || "").slice(0, 40),
    raw: rawUrl
  };
}

export function validateResolveLink(parsed, options = {}) {
  if (!parsed || parsed.action !== "resolve") return { ok: false, reason: "unsupported_action" };
  const recipeId = String(parsed.recipeId || "").trim();
  const intent = String(parsed.intent || "");
  const isBlocked = typeof options.isBlocked === "function" ? options.isBlocked : () => false;
  const isKnownRecipe = typeof options.isKnownRecipe === "function" ? options.isKnownRecipe : () => true;
  if (!RECIPE_RE.test(recipeId)) return { ok: false, reason: "bad_recipe", recipeId, intent };
  if (isBlocked(`${recipeId} ${intent}`)) return { ok: false, reason: "r11_blocked", recipeId, intent };
  if (!isKnownRecipe(recipeId)) return { ok: false, reason: "unknown_recipe", recipeId, intent };
  return { ok: true, reason: "ok", recipeId, intent, source: parsed.source || "" };
}
