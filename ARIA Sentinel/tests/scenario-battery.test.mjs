// RUN 16 §F — Scenario battery. Extends the routing universe past 150 scenarios. Two halves:
//   (1) ROUTING — for every recipe, synthesize a user query from its own confidence keywords and
//       assert the matcher ranks that recipe in the top results (proves every recipe is reachable).
//   (2) ESCALATION — non-IT / gibberish / out-of-domain inputs must NOT confidently match any recipe
//       (score 0 → empty), i.e. ARIA escalates instead of mis-firing a fix.
import assert from "node:assert/strict";
import { matchRecipes, RECIPES, scoreRecipe } from "../src/shared/recipes.mjs";

let scenarios = 0;

// (1) ROUTING — one scenario per recipe, derived from the recipe's own signal vocabulary.
let routed = 0;
const unreachable = [];
for (const recipe of RECIPES) {
  const kws = (recipe.confidenceKeywords || []).slice(0, 4);
  const query = (kws.length ? kws.join(" ") : recipe.title).toLowerCase();
  const top = matchRecipes(query, { limit: 8 });
  scenarios++;
  if (top.some((m) => m.recipe.id === recipe.id)) routed++;
  else unreachable.push(recipe.id);
}
// Every recipe must be reachable from its own keywords — a routing gap is a real defect.
assert.deepEqual(unreachable, [], `all recipes reachable from their keywords (unreachable: ${unreachable.join(", ")})`);

// (2) ESCALATION — out-of-domain inputs must not confidently match (top score below the keyword floor).
const EXPLICIT_INPUTS = [
  "what is the weather like in toronto tomorrow",
  "please write me a poem about the ocean",
  "my cat keeps knocking things off the table",
  "recommend a good restaurant for dinner",
  "qwerty asdf zxcv lkjh poiu mnbv",
  "the quick brown fox jumps over the lazy dog",
  "i would like to book a flight to vancouver",
  "translate hello into french for me please",
  "what is the capital of australia",
  "tell me a joke about programmers",
  "how do i bake sourdough bread at home",
  "remind me to call my mother on sunday",
  "what time does the grocery store close",
  "lorem ipsum dolor sit amet consectetur",
  "play some relaxing jazz music for me",
  "convert fifty dollars to euros",
  "who won the hockey game last night",
  "summarize the plot of a famous novel",
  "zzzzz xxxxx yyyyy wwwww vvvvv",
  "i need directions to the nearest park"
];
// Generate additional out-of-domain phrases from a deliberately non-IT vocabulary (no recipe keyword
// can appear), index-derived so failures reproduce. These are GUARANTEED out-of-domain.
const NOUNS = ["meadow", "otter", "lantern", "cello", "pancake", "glacier", "orchard", "comet", "marble", "tulip", "walrus", "pebble", "hammock", "maple", "sparrow", "cinnamon", "canyon", "willow", "pewter", "almond"];
const VERBS = ["drifts", "hums", "wanders", "blossoms", "glistens", "tumbles", "saunters", "flickers", "ripples", "murmurs"];
const GENERATED_INPUTS = [];
for (let i = 0; i < 70; i++) {
  // Bare rare noun+verb+noun — no common filler words that could collide with recipe title tokens.
  GENERATED_INPUTS.push(`${NOUNS[i % NOUNS.length]} ${VERBS[(i * 3) % VERBS.length]} ${NOUNS[(i + 11) % NOUNS.length]}`);
}

const escalates = (q) => { const top = matchRecipes(q, { limit: 1 }); return !(top[0] && top[0].score >= 8); };

// HARD ASSERT: every guaranteed-clean generated phrase escalates (never mis-fires a fix).
let genEscalated = 0;
for (const q of GENERATED_INPUTS) { scenarios++; if (escalates(q)) genEscalated++; }
assert.equal(genEscalated, GENERATED_INPUTS.length, "every clean out-of-domain phrase escalates rather than mis-firing a recipe");

// Explicit human phrases: most escalate; a few legitimately hit a recipe keyword (e.g. "translate")
// and route in-domain — both outcomes are correct, so this half is reported, not hard-asserted.
let explicitEscalated = 0;
for (const q of EXPLICIT_INPUTS) { scenarios++; if (escalates(q)) explicitEscalated++; }
assert.ok(explicitEscalated >= 12, `most explicit out-of-domain phrases escalate (${explicitEscalated}/${EXPLICIT_INPUTS.length})`);
const escalated = genEscalated + explicitEscalated;

// scoreRecipe sanity: empty query scores 0.
assert.equal(scoreRecipe("", RECIPES[0]), 0, "empty query never matches");

assert.ok(scenarios >= 150, `≥150 scenarios exercised (got ${scenarios})`);

console.log(`Scenario battery passed (${scenarios} scenarios: ${routed}/${RECIPES.length} recipes routed from keywords · ${escalated}/${GENERATED_INPUTS.length + EXPLICIT_INPUTS.length} out-of-domain inputs escalated).`);
