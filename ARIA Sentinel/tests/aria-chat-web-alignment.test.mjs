// 2026-07-04 - Sentinel ARIA Chat mirrors the live iisupp.net/aria entry flow.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ARIA_WEB_QUICK_ACTIONS, ARIA_WEB_WELCOME } from "../src/shared/aria-web-surface.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const index = read("src", "renderer", "index.html");
const renderer = read("src", "renderer", "renderer.js");
const css = read("src", "renderer", "sentinel.css");

assert.equal(ARIA_WEB_WELCOME.title, "How can I help you today?", "welcome matches ARIA web");
assert.match(ARIA_WEB_WELCOME.body, /walk you through it|gated local fix/i, "welcome bridges web chat to Sentinel");
assert.ok(ARIA_WEB_QUICK_ACTIONS.length >= 12, "desktop exposes the web quick issue chips");
for (const label of ["VPN Diagnostic", "Reset Password", "Teams Audio", "OneDrive Sync", "MFA Help", "Printer Queue", "Slow Computer", "Security Scan"]) {
  assert.ok(ARIA_WEB_QUICK_ACTIONS.some((item) => item.label === label), `${label} quick chip is present`);
}

assert.match(index, /id="ariaWebWelcomeTitle"/, "welcome title host exists");
assert.match(index, /id="ariaWebWelcomeBody"/, "welcome body host exists");
assert.match(index, /id="ariaWebQuickActions"/, "quick action host exists");
assert.match(index, /How can I help you today\?/, "static fallback has web greeting");

assert.match(renderer, /ARIA_WEB_QUICK_ACTIONS/, "renderer imports web quick actions");
assert.match(renderer, /ARIA_WEB_WELCOME/, "renderer imports web welcome copy");
assert.match(renderer, /function submitAriaQuestion\(text\)/, "quick chips submit a normal chat question");
assert.match(renderer, /data-aria-web-ask/, "quick chips preserve the web ask payload");
assert.match(renderer, /form\.requestSubmit\(\)/, "quick chip uses existing submit pipeline");

assert.match(css, /\.aria-web-quick-actions/, "quick action row is styled");
assert.match(css, /\.aria-web-chip/, "quick chips are styled");

console.log(`aria-chat-web-alignment passed (${ARIA_WEB_QUICK_ACTIONS.length} web quick actions).`);
