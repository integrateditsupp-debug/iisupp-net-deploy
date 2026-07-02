#!/usr/bin/env node
// CONCIERGE "AI SETUP WALK-THROUGH" — homepage service card + aria.html copy + services.html listing.
// Asserts the shipped HTML really carries the concierge offer wired to the existing inline-priceData
// /stripe-checkout flow (no new backend), that the hero still has exactly 3 responsive service cards,
// that AI Business Automation is preserved on /services (#ai-services), and that aria.html gained the
// learn-the-tools lead copy. Rule 14: only asserts what is really in the files — no fabricated state.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const index = read("index.html");
const aria = read("aria.html");
const services = read("services.html");

// 1 — the hero grid still has EXACTLY 3 service cards (nothing dropped / duplicated).
const grid = index.slice(index.indexOf('class="hero-svc-grid'));
const gridEnd = grid.indexOf("</div>\n\n            <h1"); // grid closes before the hero H1
const gridHtml = gridEnd > 0 ? grid.slice(0, gridEnd) : grid;
const cardCount = (index.match(/class="hero-svc-card/g) || []).length;
assert.equal(cardCount, 3, `hero must have exactly 3 service cards, saw ${cardCount}`);

// 2 — the MIDDLE hero card is the AI Setup Walk-Through concierge card. Locate its span in the file:
//     it starts at the concierge marker and ends before the third (Website + AI Assistant) card.
const midStart = index.indexOf("hero-svc-card--concierge");
assert.ok(midStart > 0, "middle card must be the concierge card (hero-svc-card--concierge)");
const thirdStart = index.indexOf("website-ai-deposit");
assert.ok(thirdStart > midStart, "the third hero card (website-ai-deposit) must follow the concierge card");
const firstStart = index.indexOf("tier1-first-month");
assert.ok(firstStart > 0 && firstStart < midStart, "the first hero card (tier1-first-month) must precede the concierge card (middle slot)");
const midCard = index.slice(midStart, thirdStart);

// 2a — required content lives IN the middle card.
assert.ok(/AI Setup Walk-Through/.test(midCard), "middle card title = AI Setup Walk-Through");
assert.ok(midCard.includes('data-stripe-amount-cents="700000"'), "middle card charges the $7,000 (700000 cents) starting amount");
assert.ok(midCard.includes('data-stripe-id="ai-setup-walkthrough"'), "middle card uses the ai-setup-walkthrough stripe id");
assert.ok(midCard.includes('data-stripe-name="AI Setup Walk-Through Concierge · Starting Package"'), "middle card uses the packet stripe name");
assert.ok(/>Get started<\/button>/.test(midCard), "middle card has a 'Get started' buy button");
assert.ok(/href="\/book\.html"[^>]*>\s*Talk to us\s*<\/a>/.test(midCard), "middle card has a 'Talk to us' link to /book.html");
assert.ok(midCard.includes("$7,000–$15,000"), "middle card states the $7,000–$15,000 range");
assert.ok(/Includes a 30-day ARIA Sentinel trial/.test(midCard), "middle card carries the 30-day ARIA Sentinel trial includes-line");
assert.ok(/Step-by-step walk-through guidance/.test(midCard), "middle card carries the walk-through description");
assert.ok(/Claude \(Cowork &amp; Code\), Codex, and Gemini/.test(midCard), "middle card names Claude (Cowork & Code), Codex, and Gemini");
assert.ok(/Starting at/.test(midCard), "middle card keeps the 'Starting at' price format");

// 2b — the buy button is wired to the EXISTING inline-priceData /stripe-checkout flow (no new backend).
assert.ok(index.includes(".hero-svc-cta[data-stripe-amount-cents]"), "hero buy buttons are wired to /stripe-checkout via the existing hero handler");
assert.ok(index.includes("/.netlify/functions/stripe-checkout"), "checkout posts to the existing stripe-checkout function");

// 3 — aria.html gained the learn-the-tools lead copy near the walk-through CTA (copy only).
assert.ok(
  aria.includes("Want to learn how to use Claude (Cowork &amp; Code), Codex, and Gemini?"),
  "aria.html must contain the learn-tools lead copy line"
);
assert.ok(aria.includes("Walk me through it in ARIA Sentinel"), "aria.html keeps the walk-through CTA the copy refers to");

// 4 — services.html lists the AI Setup Walk-Through service (same $7,000-start priceData) AND still
//      carries AI Business Automation under the #ai-services section (preserved, not deleted).
assert.ok(/id="ai-services"/.test(services), "services.html must have the #ai-services section");
const aiStart = services.indexOf('id="ai-services"');
const aiEnd = services.indexOf('id="cloud-automation"');
assert.ok(aiEnd > aiStart, "the #ai-services block must be a real, bounded section");
const aiBlock = services.slice(aiStart, aiEnd);
assert.ok(/AI Setup Walk-Through/.test(aiBlock), "services.html lists the AI Setup Walk-Through service");
assert.ok(aiBlock.includes('data-stripe-amount-cents="700000"'), "services AI Setup Walk-Through uses the same $7,000-start priceData");
assert.ok(aiBlock.includes('data-stripe-id="ai-setup-walkthrough"'), "services AI Setup Walk-Through uses the same stripe id as the hero button");
assert.ok(/AI Business Automation/.test(aiBlock), "services.html PRESERVES AI Business Automation under #ai-services");
assert.ok(services.includes(".svc-buy[data-stripe-amount-cents]"), "services.html wires its buy buttons to the /stripe-checkout flow");

console.log("concierge-service test passed (3 hero cards · concierge middle card @700000 with Get started + Talk to us + $7k–$15k + 30-day trial · aria.html learn-tools copy · services #ai-services lists Walk-Through + preserves AI Business Automation).");
