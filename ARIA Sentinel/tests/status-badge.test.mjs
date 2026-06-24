// RUN 5 — embeddable status badge. Asserts the iframe HTML is well-formed, shows the score, is
// CSP-locked, and contains NO inline/any <script> (so it can never execute in the embedding page).
import assert from "node:assert/strict";
import { renderStatusBadge, BADGE_CSP } from "../src/shared/status-badge.mjs";

const html = renderStatusBadge({ tenant: "acme-corp", score: 94, fixes: 12 });

// Well-formed document.
assert.match(html, /^<!doctype html>/i, "is an HTML document");
assert.match(html, /<\/html>\s*$/i, "closes the document");

// Shows the mock score + a label.
assert.match(html, />94</, "renders the score");
assert.match(html, /Healthy/, "renders the health label for 94");
assert.match(html, /12 fixes/, "renders the fix count");
assert.match(html, /acme-corp/, "renders the tenant");

// CSP-safe: a locked policy is present and there is NO script of any kind.
assert.match(html, /Content-Security-Policy/i, "carries a CSP");
assert.ok(html.includes(BADGE_CSP), "uses the locked badge CSP");
assert.ok(BADGE_CSP.includes("default-src 'none'"), "CSP denies everything by default");
assert.ok(!/<script/i.test(html), "NO <script> tag anywhere");
// Real inline handlers are ` on<name>=` (preceded by space/quote) — e.g. onclick=, onerror=.
assert.ok(!/[\s"']on[a-z]+\s*=/i.test(html), "no inline event handlers");
assert.ok(!/javascript:/i.test(html), "no javascript: URLs");

// Score clamps to [0,100] and bad input never throws.
assert.match(renderStatusBadge({ score: 250 }), />100</, "clamps high");
assert.match(renderStatusBadge({ score: -5 }), />0</, "clamps low");
assert.match(renderStatusBadge({}), />0</, "missing score → 0, no throw");
assert.match(renderStatusBadge({ score: 40 }), /Critical/, "low score → Critical label");

// Tenant input is HTML-escaped (cannot inject markup).
const injected = renderStatusBadge({ tenant: '"><img src=x onerror=alert(1)>', score: 80 });
assert.ok(!injected.includes("<img"), "tenant markup is escaped");

console.log("Status-badge test passed (well-formed iframe HTML · CSP-locked · no script · score clamped · tenant escaped).");
