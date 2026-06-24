// RUN 23e — pricing-tiers single-source-of-truth: 6 tiers, feature gates, comparison matrix.
import assert from "node:assert/strict";
import {
  TIERS, PLAN_ORDER, CLIENT_PLANS, MODES,
  normalizePlan, getTier, getFeatures, isModeAllowed, isAdmin, recipeQuotaFor, planComparisonTable
} from "../src/shared/pricing-tiers.mjs";

let n = 0; const t = () => { n++; };

// 1 — all six tiers exist.
for (const p of ["personal", "pro", "smb", "midsize", "enterprise", "admin"]) assert.ok(TIERS[p], `tier ${p} exists`);
t();

// 2 — Personal is Manual-ONLY.
assert.deepEqual(getFeatures("personal").modes, ["manual"], "personal manual only");
t();
// 3 — Personal mode gating.
assert.equal(isModeAllowed("personal", "manual"), true);
assert.equal(isModeAllowed("personal", "confirmed"), false);
assert.equal(isModeAllowed("personal", "autonomous"), false);
t();
// 4 — Pro has all three modes.
assert.deepEqual(getFeatures("pro").modes, ["manual", "confirmed", "autonomous"]);
t();
// 5 — Pro has quarterly PDF but NO fleet view.
assert.equal(getFeatures("pro").quarterlyPdf, true);
assert.equal(getFeatures("pro").fleetView, false);
t();
// 6 — SMB / Mid / Enterprise are feature-IDENTICAL (differ only in seats + price).
assert.deepEqual(getFeatures("smb"), getFeatures("midsize"), "smb == midsize features");
assert.deepEqual(getFeatures("midsize"), getFeatures("enterprise"), "midsize == enterprise features");
t();
// 7 — Business tiers unlock fleet + compliance + custom recipes.
for (const p of ["smb", "midsize", "enterprise"]) {
  const f = getFeatures(p);
  assert.equal(f.fleetView, true, `${p} fleet`);
  assert.equal(f.complianceEvidence, true, `${p} compliance`);
  assert.equal(f.customRecipes, true, `${p} custom recipes`);
}
t();
// 8 — Admin unlocks admin console + OTA publish; client tiers never do.
assert.equal(getFeatures("admin").adminConsole, true);
assert.equal(getFeatures("admin").updatesPublish, true);
for (const p of CLIENT_PLANS) assert.equal(getFeatures(p).adminConsole, false, `${p} no admin console`);
for (const p of CLIENT_PLANS) assert.equal(getFeatures(p).updatesPublish, false, `${p} no OTA publish`);
t();
// 9 — isAdmin: admin true, every client tier false.
assert.equal(isAdmin("admin"), true);
for (const p of CLIENT_PLANS) assert.equal(isAdmin(p), false, `isAdmin(${p}) false`);
t();
// 10 — recipe quotas.
assert.equal(recipeQuotaFor("personal"), 14);
assert.equal(recipeQuotaFor("pro"), 77);
assert.equal(recipeQuotaFor("smb"), 77);
assert.equal(recipeQuotaFor("admin"), 77);
t();
// 11 — alias normalization.
assert.equal(normalizePlan("Small Business"), "smb");
assert.equal(normalizePlan("mid"), "midsize");
assert.equal(normalizePlan("ENTERPRISE"), "enterprise");
assert.equal(normalizePlan("lifetime"), "admin");
assert.equal(normalizePlan("pro"), "pro");
t();
// 12 — fail-closed: unknown / empty / garbage → personal, NEVER admin.
assert.equal(normalizePlan(""), "personal");
assert.equal(normalizePlan(null), "personal");
assert.equal(normalizePlan("hacker-tier"), "personal");
assert.equal(normalizePlan(undefined), "personal");
t();
// 13 — getFeatures returns a copy; mutating it never corrupts the source tier.
const f1 = getFeatures("personal");
f1.modes.push("autonomous");
f1.adminConsole = true;
assert.deepEqual(getFeatures("personal").modes, ["manual"], "source modes intact after mutation");
assert.equal(getFeatures("personal").adminConsole, false, "source flags intact after mutation");
t();
// 14 — comparison matrix excludes admin by default, 12 feature rows, 5 client columns.
const table = planComparisonTable();
assert.equal(table.plans.length, 5, "5 client plan columns");
assert.equal(table.rows.length, 12, "12 feature rows");
assert.ok(!table.plans.some((p) => p.plan === "admin"), "admin not on the public matrix");
t();
// 15 — includeAdmin → 6 columns.
assert.equal(planComparisonTable({ includeAdmin: true }).plans.length, 6);
t();
// 16 — matrix cell values: confirmed row false for personal, true for pro; recipe row is a string.
const confirmedRow = table.rows.find((r) => r.key === "confirmed");
assert.equal(confirmedRow.values.personal, false);
assert.equal(confirmedRow.values.pro, true);
const recipeRow = table.rows.find((r) => r.key === "recipes");
assert.equal(recipeRow.values.personal, "14 recipes");
t();
// 17 — prices match the directive.
assert.equal(TIERS.personal.price, 599);
assert.equal(TIERS.pro.price, 1500);
assert.equal(TIERS.smb.price, 156000);
assert.equal(TIERS.midsize.price, 312000);
assert.equal(TIERS.enterprise.price, 625000);
t();
// 18 — Stripe is referenced by ENV-VAR NAME only — no hardcoded URL anywhere in the tier table.
for (const p of CLIENT_PLANS) {
  const env = TIERS[p].stripeEnv;
  assert.match(env, /^STRIPE_[A-Z_]+$/, `${p} stripeEnv is an env-var name`);
  assert.doesNotMatch(env, /https?:\/\//, `${p} stripeEnv is not a URL`);
}
t();
// 19 — plan-order shapes.
assert.deepEqual(PLAN_ORDER, ["personal", "pro", "smb", "midsize", "enterprise", "admin"]);
assert.deepEqual(CLIENT_PLANS, ["personal", "pro", "smb", "midsize", "enterprise"]);
assert.deepEqual(MODES, ["manual", "confirmed", "autonomous"]);
t();
// 20 — getTier carries label + seats for the picker/matrix headers.
assert.equal(getTier("pro").label, "Pro");
assert.ok(getTier("enterprise").seats, "enterprise has a seats descriptor");
t();

console.log(`Pricing-tiers test passed (${n} cases · 6 tiers · gates · fail-closed normalize · 12×matrix).`);
