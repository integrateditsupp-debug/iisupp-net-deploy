// R-ONE N2 - implementation add-on selector routes custom scope to a quote request, not Stripe charge.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const home = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");

assert.match(home, /data-buy-options=/, "homepage has structured buy options");
assert.match(home, /"quote":true/, "buy options include quote-only choices");
assert.match(home, /Request Custom Quote/i, "buyer-facing custom quote option is visible");
assert.match(home, /data-quote="1"/, "quote option renders a dedicated quote button");
assert.match(home, /mailto:ahmad\.wasee@iisupp\.net\?subject=/, "quote path opens an email request");
assert.match(home, /Custom Quote Request/i, "quote email subject is explicit");

const quoteBranch = home.slice(home.indexOf("if (btn2.dataset.quote)"), home.indexOf("return;", home.indexOf("if (btn2.dataset.quote)")) + 80);
assert.match(quoteBranch, /window\.location\.href\s*=\s*'mailto:/, "quote branch uses mailto");
assert.doesNotMatch(quoteBranch, /stripe|checkout|fetch\(/i, "quote branch does not start Stripe checkout");

assert.match(home, /Environment details:/, "quote request asks for environment details");
assert.match(home, /Users \/ devices:/, "quote request collects users/devices");
assert.match(home, /Timeline:/, "quote request collects timeline");

console.log("Impl-addon-quote test passed (custom scope routes to quote request, no Stripe charge on quote branch).");
