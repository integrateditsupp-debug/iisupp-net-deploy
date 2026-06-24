// command-palette — pure command list + filter for the Cmd/Ctrl+K palette. No API: recipes are
// turned into "Run …" commands and combined with fixed navigation/action commands. The renderer
// owns the keybinding + DOM; this owns the data + ranking so it is unit-testable.

// Build the full command set from the recipe catalog + the standard app actions.
export function buildCommands(recipes = []) {
  const recipeCommands = (Array.isArray(recipes) ? recipes : []).map((r) => ({
    id: `run:${r.id}`,
    type: "recipe",
    label: `Run: ${r.title || r.id}`,
    keywords: `${r.id} ${r.signal || ""} ${r.title || ""}`.toLowerCase(),
    recipeId: r.id
  }));
  const actions = [
    { id: "nav:mode", type: "nav", label: "Go to: Mode", keywords: "mode autonomous manual confirmed", tab: "mode" },
    { id: "nav:recipes", type: "nav", label: "Go to: Recipes", keywords: "recipes catalog", tab: "recipes" },
    { id: "nav:privacy", type: "nav", label: "Go to: Privacy verifier", keywords: "privacy verifier capture evidence audit", tab: "privacy" },
    { id: "nav:about", type: "nav", label: "Go to: About", keywords: "about roi low power diagnostics", tab: "about" },
    { id: "act:admin", type: "action", label: "Open admin console", keywords: "admin console fleet" },
    { id: "act:globe", type: "action", label: "Open globe", keywords: "globe overlay show" }
  ];
  return [...actions, ...recipeCommands];
}

/**
 * Filter + rank commands for a query. Empty query returns the first `limit` commands. Ranking:
 * exact label-start > word-start > substring > keyword substring. Pure + deterministic.
 */
export function filterCommands(commands, query, limit = 8) {
  const q = String(query || "").trim().toLowerCase();
  const list = Array.isArray(commands) ? commands : [];
  if (!q) return list.slice(0, limit);
  const scored = [];
  for (const c of list) {
    const label = String(c.label || "").toLowerCase();
    const kw = String(c.keywords || "");
    let score = 0;
    if (label.startsWith(q)) score = 100;
    else if (label.includes(` ${q}`)) score = 70;
    else if (label.includes(q)) score = 50;
    else if (kw.includes(q)) score = 30;
    if (score > 0) scored.push({ c, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.c.label.localeCompare(b.c.label))
    .slice(0, limit)
    .map((s) => s.c);
}
