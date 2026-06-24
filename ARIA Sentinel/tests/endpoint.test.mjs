import assert from "node:assert/strict";
import recipesHandler from "../../netlify/functions/aria-recipes.mjs";
import stopCodesHandler from "../../netlify/functions/aria-stop-codes.mjs";

const recipeResponse = await recipesHandler(new Request("https://iisupp.net/.netlify/functions/aria-recipes"));
assert.equal(recipeResponse.status, 200);
assert.ok(recipeResponse.headers.get("x-aria-recipes-sha256"));
const recipeJson = await recipeResponse.json();
assert.equal(recipeJson.ok, true);
assert.equal(recipeJson.privacy.uploadToIisupp, false);
assert.ok(recipeJson.counts.total >= 10);

const stopCodeResponse = await stopCodesHandler(new Request("https://iisupp.net/.netlify/functions/aria-stop-codes?q=CRITICAL_PROCESS_DIED"));
assert.equal(stopCodeResponse.status, 200);
assert.ok(stopCodeResponse.headers.get("x-aria-stop-codes-sha256"));
const stopCodeJson = await stopCodeResponse.json();
assert.equal(stopCodeJson.ok, true);
assert.equal(stopCodeJson.stopCodes[0].code, "CRITICAL_PROCESS_DIED");

console.log("Netlify endpoint tests passed.");
