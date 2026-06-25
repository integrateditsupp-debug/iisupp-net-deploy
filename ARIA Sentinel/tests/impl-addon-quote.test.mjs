// R-ONE N2 — implementation add-on selector → quote request. Verifies the connector allow-list, the
// validator (≥1 connector + valid email), the front-end payload builder, and that NO Stripe charge path
// exists (quote-to-contract only).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..", "..");
const fn = require(path.join(root, "netlify/functions/aria-impl-quote.js"));
const ui = require(path.join(root, "assets/aria-impl-addon.js"));

// 1 — the 10 connectors from the directive are the allow-list (server + client agree).
const EXPECT = ["AD/Entra", "On-prem AD", "RSA SecurID", "PingOne Verify", "Dynamics 365",
  "Outlook/Exchange", "Excel", "Word", "PowerPoint", "OneNote"];
assert.deepEqual(fn.CONNECTORS, EXPECT, "server connector allow-list");
assert.deepEqual(ui.CONNECTORS, EXPECT, "client connector list matches server");

// 2 — validator: needs ≥1 connector + a valid email; drops non-allowlisted connectors.
assert.equal(fn.validateQuote({ connectors: [], email: "a@b.co" }).ok, false, "no connector → invalid");
assert.equal(fn.validateQuote({ connectors: ["AD/Entra"], email: "" }).ok, false, "no email → invalid");
assert.equal(fn.validateQuote({ connectors: ["AD/Entra"], email: "bad" }).ok, false, "bad email → invalid");
const good = fn.validateQuote({ connectors: ["AD/Entra", "NOT_REAL", "Excel"], email: "it@acme.com", orgSize: "50 staff" });
assert.equal(good.ok, true, "valid request");
assert.deepEqual(good.quote.connectors, ["AD/Entra", "Excel"], "non-allowlisted connector dropped");
assert.equal(good.quote.kind, "implementation");

// 3 — client payload builder mirrors the rules.
const built = ui.buildQuotePayload({ connectors: ["PingOne Verify", "bogus"], email: "x@y.com" });
assert.equal(built.ok, true);
assert.deepEqual(built.payload.connectors, ["PingOne Verify"]);
assert.equal(ui.buildQuotePayload({ connectors: ["Word"], email: "" }).ok, false);

// 4 — NO Stripe charge PATH in the quote function (quote-to-contract only; the word may appear in comments).
const src = fs.readFileSync(path.join(root, "netlify/functions/aria-impl-quote.js"), "utf8");
assert.ok(!/require\(\s*['"]stripe['"]\s*\)/.test(src), "quote function must not load the Stripe SDK");
assert.ok(!/api\.stripe\.com/.test(src), "quote function must not call the Stripe API");
assert.ok(!/stripe-checkout/.test(src), "quote function must not invoke the checkout function");
assert.ok(!/\bStripe\s*\(/.test(src), "quote function must not construct a Stripe client");

// 5 — selector is mounted on /plans + the script is loaded.
const plans = fs.readFileSync(path.join(root, "plans/index.html"), "utf8");
assert.ok(plans.includes("data-aria-impl-addon"), "selector mount present on /plans");
assert.ok(plans.includes("/assets/aria-impl-addon.js"), "selector script loaded on /plans");

console.log("impl-addon-quote test passed (10-connector allow-list server=client · validator ≥1+email · drops bad connectors · NO Stripe path · mounted on /plans).");
