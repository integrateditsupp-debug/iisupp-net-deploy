// Slice A — the offline intent matcher must resolve natural symptom phrasing to the right recipe WITHOUT the
// cloud LLM (so all recipes stay usable during the aria-chat 400 outage). The live 3-mode test surfaced that
// the old substring-only matcher missed "the internet is down" (the filler "is" broke "internet down") and
// had nothing for "excel". This proves the 6 phrases each resolve to the correct recipe as the top match.
import assert from "node:assert/strict";
import { matchRecipes } from "../src/shared/recipes.mjs";

const CASES = [
  ["zoom", "zoom-weird-v1"],
  ["page zoom looks wrong", "zoom-weird-v1"],
  ["the internet is down", "wifi-no-internet-v1"],     // was the regression — token-overlap now resolves it
  ["no internet access", "wifi-no-internet-v1"],
  ["excel won't open my file", "office-file-repair-v1"], // had no recipe before Slice A
  ["my spreadsheet is corrupt", "office-file-repair-v1"],
];

let n = 0;
for (const [phrase, expectedId] of CASES) {
  const matches = matchRecipes(phrase, { limit: 5 });
  assert.ok(matches.length > 0, `"${phrase}" resolves to at least one recipe (got none)`);
  assert.equal(matches[0].recipe.id, expectedId, `"${phrase}" → top match ${expectedId} (got ${matches[0].recipe.id})`);
  n++;
}

assert.equal(n, 6, "6 phrase cases");
console.log(`offline-matcher test passed (${n} phrases · token-overlap resolves "internet is down" / "no internet access" · Office/Excel phrasing resolves office-file-repair-v1).`);
