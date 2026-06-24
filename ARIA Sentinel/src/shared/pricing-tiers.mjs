// RUN 23e — single source of truth for ARIA Sentinel license tiers + their feature gates. PURE: no
// node/electron imports, so the renderer, the plan-picker overlay, the main process AND the website
// build step all import the SAME matrix and can never drift. Stripe is referenced by ENV-VAR NAME
// only (never a hardcoded URL) — main/openPlanCheckout + the site resolve the name at runtime.
// 🔒 R11 — tiers describe features + prices only; never a filesystem path.

export const MODES = Object.freeze(["manual", "confirmed", "autonomous"]);
export const PLAN_ORDER = Object.freeze(["personal", "pro", "smb", "midsize", "enterprise", "admin"]);
export const CLIENT_PLANS = Object.freeze(["personal", "pro", "smb", "midsize", "enterprise"]);

// The three business tiers are IDENTICAL in features — they differ only in seats + price.
const BUSINESS_FEATURES = Object.freeze({
  modes: ["manual", "confirmed", "autonomous"],
  recipesCount: 77,
  adminConsole: false,
  updatesPublish: false,
  fleetView: true,
  complianceEvidence: true,
  customRecipes: true,
  whiteLabel: true,
  quarterlyPdf: true,
  slaTracking: true,
  systemInventory: true
});

export const TIERS = Object.freeze({
  personal: {
    plan: "personal",
    label: "Personal",
    price: 599,
    priceDisplay: "$599",
    billing: "month",
    billingPeriod: "monthly",
    seats: "1 user · 1 device",
    stripeEnv: "STRIPE_PERSONAL_MONTHLY_URL",
    stripeYearlyEnv: "STRIPE_PERSONAL_YEARLY_URL",
    blurb: "Resident IT support with guided Manual-mode fixes.",
    features: {
      modes: ["manual"],
      recipesCount: 14,
      adminConsole: false,
      updatesPublish: false,
      fleetView: false,
      complianceEvidence: false,
      customRecipes: false,
      whiteLabel: false,
      quarterlyPdf: false,
      slaTracking: false,
      systemInventory: true
    }
  },
  pro: {
    plan: "pro",
    label: "Pro",
    price: 1500,
    priceDisplay: "$1,500",
    billing: "month",
    billingPeriod: "monthly",
    seats: "Small team",
    stripeEnv: "STRIPE_PRO_MONTHLY_URL",
    stripeYearlyEnv: "STRIPE_PRO_YEARLY_URL",
    blurb: "Full Confirmed + Autonomous modes, the complete recipe library, self-serve quarterly PDFs.",
    features: {
      modes: ["manual", "confirmed", "autonomous"],
      recipesCount: 77,
      adminConsole: false,
      updatesPublish: false,
      fleetView: false,
      complianceEvidence: false,
      customRecipes: false,
      whiteLabel: false,
      quarterlyPdf: true,
      slaTracking: true,
      systemInventory: true
    }
  },
  smb: {
    plan: "smb",
    label: "Small Business",
    price: 156000,
    priceDisplay: "$156K",
    billing: "year",
    billingPeriod: "yearly",
    seats: "Small business fleet",
    stripeEnv: "STRIPE_SMALL_BUSINESS_YEARLY_URL",
    stripeYearlyEnv: "STRIPE_SMALL_BUSINESS_YEARLY_URL",
    blurb: "Everything in Pro plus fleet view, compliance evidence and custom recipes.",
    features: { ...BUSINESS_FEATURES }
  },
  midsize: {
    plan: "midsize",
    label: "Mid Size",
    price: 312000,
    priceDisplay: "$312K",
    billing: "year",
    billingPeriod: "yearly",
    seats: "Mid-size org fleet",
    stripeEnv: "STRIPE_MIDSIZE_YEARLY_URL",
    stripeYearlyEnv: "STRIPE_MIDSIZE_YEARLY_URL",
    blurb: "Fleet, compliance and custom recipes scaled for a mid-size organization.",
    features: { ...BUSINESS_FEATURES }
  },
  enterprise: {
    plan: "enterprise",
    label: "Enterprise",
    price: 625000,
    priceDisplay: "$625K",
    billing: "year",
    billingPeriod: "yearly",
    seats: "Enterprise fleet",
    stripeEnv: "STRIPE_ENTERPRISE_YEARLY_URL",
    stripeYearlyEnv: "STRIPE_ENTERPRISE_YEARLY_URL",
    blurb: "Fleet, compliance and custom recipes at enterprise scale.",
    features: { ...BUSINESS_FEATURES }
  },
  admin: {
    plan: "admin",
    label: "Admin",
    price: 0,
    priceDisplay: "Internal",
    billing: "lifetime",
    billingPeriod: "lifetime",
    seats: "Owner",
    stripeEnv: null,
    stripeYearlyEnv: null,
    purchasable: false,
    blurb: "Everything, plus the admin console, OTA Updates publish and policy override.",
    features: {
      modes: ["manual", "confirmed", "autonomous"],
      recipesCount: 77,
      adminConsole: true,
      updatesPublish: true,
      fleetView: true,
      complianceEvidence: true,
      customRecipes: true,
      whiteLabel: true,
      quarterlyPdf: true,
      slaTracking: true,
      systemInventory: true
    }
  }
});

// Plan aliases → canonical key. Unknown / empty → "personal" (lowest tier, never admin: fail-closed).
const ALIASES = {
  personal: "personal", individual: "personal",
  pro: "pro", professional: "pro",
  smb: "smb", "small-business": "smb", "small business": "smb", smallbusiness: "smb", business: "smb",
  midsize: "midsize", mid: "midsize", "mid-size": "midsize", "mid size": "midsize",
  enterprise: "enterprise", ent: "enterprise",
  admin: "admin", lifetime: "admin", owner: "admin"
};

/** Canonicalize any plan label to a known tier key. Fail-closed to "personal" (never admin). */
export function normalizePlan(plan) {
  const raw = String(plan == null ? "" : plan).trim().toLowerCase();
  if (TIERS[raw]) return raw;
  if (ALIASES[raw]) return ALIASES[raw];
  if (/small/.test(raw)) return "smb";
  if (/mid/.test(raw)) return "midsize";
  if (/enter/.test(raw)) return "enterprise";
  if (/admin|lifetime|owner/.test(raw)) return "admin";
  return "personal";
}

/** The full tier record for a plan. */
export function getTier(plan) {
  return TIERS[normalizePlan(plan)];
}

/** The features object for a plan (a fresh shallow copy — callers must not mutate the source). */
export function getFeatures(plan) {
  const f = getTier(plan).features;
  return { ...f, modes: [...f.modes] };
}

/** Is `mode` (manual/confirmed/autonomous) allowed on this plan? */
export function isModeAllowed(plan, mode) {
  return getTier(plan).features.modes.includes(String(mode || "").toLowerCase());
}

/** Admin tier ONLY — gates the admin console + OTA publish. Fail-closed for every client tier. */
export function isAdmin(plan) {
  return getTier(plan).features.adminConsole === true;
}

/** Recipe quota (count) unlocked for a plan. */
export function recipeQuotaFor(plan) {
  return getTier(plan).features.recipesCount;
}

// The 12 feature rows shown in the public + in-app comparison matrix. Each row carries a per-plan value
// (boolean → ✓/—, or a string/number). Price + seats are rendered separately as card headers.
const COMPARISON_ROWS = [
  { key: "manual", label: "Manual mode" },
  { key: "confirmed", label: "Confirmed mode" },
  { key: "autonomous", label: "Autonomous mode" },
  { key: "recipes", label: "Fix-recipe library" },
  { key: "systemInventory", label: "Local system inventory" },
  { key: "quarterlyPdf", label: "Quarterly PDF reports" },
  { key: "slaTracking", label: "SLA tracking" },
  { key: "complianceEvidence", label: "Compliance evidence pack" },
  { key: "fleetView", label: "Fleet view (multi-device)" },
  { key: "customRecipes", label: "Custom recipes" },
  { key: "whiteLabel", label: "White-label" },
  { key: "adminConsole", label: "Admin console + OTA publish" }
];

function rowValue(key, f) {
  switch (key) {
    case "manual": return f.modes.includes("manual");
    case "confirmed": return f.modes.includes("confirmed");
    case "autonomous": return f.modes.includes("autonomous");
    case "recipes": return `${f.recipesCount} recipes`;
    default: return Boolean(f[key]);
  }
}

/**
 * Build the comparison matrix: { plans:[...tier headers], rows:[{key,label,values:{plan→value}}] }.
 * `plans` excludes the internal admin tier by default (it is never sold on the public page).
 */
export function planComparisonTable({ includeAdmin = false } = {}) {
  const plans = (includeAdmin ? PLAN_ORDER : CLIENT_PLANS).map((p) => {
    const t = TIERS[p];
    return { plan: p, label: t.label, priceDisplay: t.priceDisplay, billing: t.billing, seats: t.seats, blurb: t.blurb };
  });
  const rows = COMPARISON_ROWS.map((r) => ({
    key: r.key,
    label: r.label,
    values: Object.fromEntries(plans.map((p) => [p.plan, rowValue(r.key, TIERS[p.plan].features)]))
  }));
  return { plans, rows };
}
