// RUN 23e — the public /plans matrix generator: sources cards + the 12×5 grid from pricing-tiers (site
// and app never drift), is env-aware (a tier renders live SUBSCRIBE only when its Stripe price env is
// set, else Contact-sales), preserves existing data-tier wiring, and hardcodes no checkout URL.
import assert from "node:assert/strict";
import {
  renderPlansCards, renderPlansMatrix, renderPlansFragment, injectFragment,
  CHECKOUT_TIER, SENTINEL_PRICE_ENV, isWired, MARKER_START, MARKER_END
} from "../scripts/build-plans-matrix.mjs";
import { TIERS, CLIENT_PLANS, planComparisonTable, monthlyDisplay, visitsLabel, SEPARATE_HUMAN_SUPPORT_NOTE } from "../src/shared/pricing-tiers.mjs";

// Env helpers for deterministic tests (never read the real process env).
const NONE = {};
const ALL = Object.fromEntries(Object.values(SENTINEL_PRICE_ENV).map((k) => [k, "price_x"]));
const ONLY_PERSONAL = { [SENTINEL_PRICE_ENV.personal]: "price_x" };

// Cards cover all five client tiers with their canonical prices (sourced from pricing-tiers).
const cardsAll = renderPlansCards(ALL);
for (const p of CLIENT_PLANS) {
  assert.ok(cardsAll.includes(TIERS[p].label), `card for ${TIERS[p].label}`);
  // R-ONE N5 — cards display the MONTHLY figure (business tiers: monthly-equivalent, billed annually).
  assert.ok(cardsAll.includes(monthlyDisplay(p)), `card shows ${p} monthly price ${monthlyDisplay(p)}`);
  // Business tiers also surface their bundled human-visit line.
  if (visitsLabel(p)) assert.ok(cardsAll.includes(visitsLabel(p)), `card shows ${p} bundled visits ${visitsLabel(p)}`);
}
// The separate-human-support note appears in the rendered fragment.
assert.ok(renderPlansFragment(ALL).includes(SEPARATE_HUMAN_SUPPORT_NOTE), "human-support note present");

// Env-awareness: no envs → every tier is Contact-sales (never a broken checkout).
const cardsNone = renderPlansCards(NONE);
assert.ok(!/data-tier=/.test(cardsNone), "no price envs → no live SUBSCRIBE buttons");
assert.equal((cardsNone.match(/CONTACT SALES/g) || []).length, 5, "all five fall back to Contact sales");
// All envs → every tier is a live SUBSCRIBE with its data-tier.
for (const p of CLIENT_PLANS) assert.ok(cardsAll.includes(`data-tier="${CHECKOUT_TIER[p]}"`), `${p} SUBSCRIBE wired`);
assert.ok(!/CONTACT SALES/.test(cardsAll), "no Contact-sales once all prices are set");
// Mixed: only personal set → personal SUBSCRIBE, the rest Contact-sales.
const cardsMixed = renderPlansCards(ONLY_PERSONAL);
assert.ok(cardsMixed.includes('data-tier="sentinel_personal_m"'), "personal is live when its env is set");
assert.ok(!cardsMixed.includes('data-tier="sentinel_pro_m"'), "pro stays Contact-sales without its env");
assert.equal(isWired("personal", ONLY_PERSONAL), true);
assert.equal(isWired("pro", ONLY_PERSONAL), false);

// Matrix: 12 feature rows from the source of truth; mode/fleet rows present; admin never a column.
const matrix = renderPlansMatrix();
assert.equal(planComparisonTable().rows.length, 12, "12 feature rows");
assert.ok(matrix.includes("Manual mode") && matrix.includes("Confirmed mode") && matrix.includes("Autonomous mode"), "mode rows present");
assert.ok(matrix.includes("Fleet view (multi-device)"), "fleet row present");
assert.ok(!/<th>Admin<\/th>/.test(matrix), "internal admin tier is not a public column");

// 🚫 Stop condition — NO hardcoded Stripe URL; checkout stays on the existing data-tier server map.
const fragment = renderPlansFragment(ALL);
assert.doesNotMatch(fragment, /stripe\.com|buy\.stripe|checkout\.stripe/i, "no hardcoded Stripe URL");
assert.doesNotMatch(fragment, /https?:\/\/[^"']*stripe/i, "no Stripe link");

// Existing checkout keys are preserved (no churn for already-live tiers).
assert.equal(CHECKOUT_TIER.personal, "sentinel_personal_m", "preserves the existing personal checkout key");
assert.equal(CHECKOUT_TIER.smb, "sentinel_business_y", "preserves the existing business checkout key");

// Idempotent build-time injection between markers; throws when the markers are missing.
const host = `before\n    ${MARKER_START}\n    OLD\n    ${MARKER_END}\nafter`;
const out = injectFragment(host, ALL);
assert.ok(out.includes(MARKER_START) && out.includes(MARKER_END), "markers preserved");
assert.ok(out.includes("sentinel-cards"), "fragment injected between markers");
assert.ok(out.startsWith("before") && out.trimEnd().endsWith("after"), "content outside markers untouched");
assert.throws(() => injectFragment("no markers here", ALL), /markers not found/, "fails closed without markers");

console.log("Plans-matrix test passed (env-aware cards + 12×5 grid from pricing-tiers · existing data-tier wiring preserved · marker injection · no hardcoded Stripe URL).");
