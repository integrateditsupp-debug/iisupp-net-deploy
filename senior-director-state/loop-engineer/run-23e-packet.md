# RUN 23e — License-tier-gated single build (collapse 2 .exe → 1)

**Build on:** whatever HEAD is after RUN 23d. Hold readiness 10.0.

## 🔒 R11 first

Same rules. R11 path-guard intact. No new file surfaces, no plan field leaks user paths.

## 🐛 Hotfix bundled — shouldBump regex

`shouldBump()` in `src/shared/ota-release.mjs` matches `[no-bump]` anywhere in commit message including documentation body. CC's own RUN 23c commit body contained the literal `[no-bump]` as feature documentation → version-bump silent-skipped, broke OTA test.

Fix: subject-line-only check.
```js
export function shouldBump(commitMessage) {
  const subject = String(commitMessage || "").split("\n")[0];
  return !/\[no-bump\]/i.test(subject);
}
```

Add tests: subject `[no-bump]` → false (don't bump) · body mention → true (bump) · empty → true.

## 🎯 Why this RUN

Today: TWO builds (admin .exe vs customer .exe). Admin features gate on `IS_ADMIN_BUILD` build-time flag. License `plan` field is decorative.

Ahmad's directive 2026-06-22:
> "If its the same app but when entering admin license it enables admin features then I want a lifetime admin key and a client key... we activate the client version and when doing admin tasks we show only the admin window."

Plus tier definitions:
- **Personal $599/mo** — Manual mode only, no autonomous/confirmed, 14 Tier-0 recipes
- **Pro $1,500/mo** — Full modes, 77 recipes, quarterly PDF self-serve, NO fleet view
- **SMB / Mid / Enterprise** — SAME features as each other (fleet view + compliance evidence + custom recipes); differ only in seat count + price ($156K/$312K/$625K/yr)
- **Admin** — everything + admin console + Updates publish + override

## 📦 8 deliverables

### 1. `src/shared/pricing-tiers.mjs` — Single source of truth

Pure data module. Every consumer (Sentinel renderer, ota-build, website, in-app plan picker) reads from here.

```js
export const TIERS = {
  "admin-lifetime": {
    display: "Admin (IIS internal)",
    monthlyUsd: 0,
    yearlyUsd: 0,
    seats: Infinity,
    features: {
      modes: ["manual", "confirmed", "autonomous"],
      recipesCount: 77,
      adminConsole: true,
      updatesPublish: true,
      fleetView: true,
      complianceEvidence: true,
      customRecipes: true,
      whiteLabel: true,
      quarterlyPdf: "auto-email-and-self-serve",
      slaTracking: "full",
      systemInventory: "full+audit-api"
    }
  },
  "client-personal": {
    display: "Personal",
    monthlyUsd: 599,
    yearlyUsd: 7188,
    seats: 1,
    features: {
      modes: ["manual"],                    // <-- KEY: no autonomous/confirmed
      recipesCount: 14,
      adminConsole: false,
      updatesPublish: false,
      fleetView: false,
      complianceEvidence: false,
      customRecipes: false,
      whiteLabel: false,
      quarterlyPdf: false,
      slaTracking: false,
      systemInventory: "basic"
    }
  },
  "client-pro": {
    display: "Pro",
    monthlyUsd: 1500,
    yearlyUsd: 18000,
    seats: 1,
    features: {
      modes: ["manual", "confirmed", "autonomous"],
      recipesCount: 77,
      adminConsole: false,
      updatesPublish: false,
      fleetView: false,                     // <-- KEY: fleet is SMB+ only
      complianceEvidence: "summary",
      customRecipes: false,
      whiteLabel: false,
      quarterlyPdf: "self-serve",
      slaTracking: "basic",
      systemInventory: "full"
    }
  },
  "client-smb": {
    display: "Small Business",
    monthlyUsd: 13000,
    yearlyUsd: 156000,
    seats: 25,
    features: {
      modes: ["manual", "confirmed", "autonomous"],
      recipesCount: 77,
      adminConsole: false,
      updatesPublish: false,
      fleetView: true,
      complianceEvidence: "full",
      customRecipes: true,
      whiteLabel: false,
      quarterlyPdf: "auto-email-and-self-serve",
      slaTracking: "full",
      systemInventory: "full+audit-api"
    }
  },
  "client-mid": {
    display: "Mid Size",
    monthlyUsd: 26000,
    yearlyUsd: 312000,
    seats: 100,
    features: { /* SAME as client-smb */ }   // <-- KEY: features identical, only seats+price differ
  },
  "client-enterprise": {
    display: "Enterprise",
    monthlyUsd: 52083,
    yearlyUsd: 625000,
    seats: Infinity,
    features: { /* SAME as client-smb */ +whiteLabel: true }
  }
};

export function getFeatures(plan) { return TIERS[plan]?.features ?? TIERS["client-personal"].features; }
export function isModeAllowed(plan, mode) { return getFeatures(plan).modes.includes(mode); }
export function isAdmin(plan) { return getFeatures(plan).adminConsole === true; }
export function recipeQuotaFor(plan) { return getFeatures(plan).recipesCount; }
export function planComparisonTable() { /* returns 2D matrix for plan picker UI */ }
```

Tests: `tests/pricing-tiers.test.mjs` — 15+ cases covering each tier's feature map + helper functions.

### 2. `src/shared/license-features.mjs` — License → enabled features

Wraps `pricing-tiers.mjs` with the runtime license check. Single function `enabledFeatures(licenseStatus)` → returns the feature object for the active plan.

### 3. `src/main/main.mjs` refactor

- Delete `const IS_ADMIN_BUILD = isAdminBuild(process.env);`
- Replace with `function currentPlanFeatures() { return enabledFeatures(licenseStatus()); }`
- `openAdminConsole()` checks `currentPlanFeatures().adminConsole` (not IS_ADMIN_BUILD)
- Tray menu shows "Open admin console" only when `currentPlanFeatures().adminConsole === true`
- Mode tab picker: hide Confirmed + Autonomous options if `!currentPlanFeatures().modes.includes("confirmed"/"autonomous")`
- Renderer broadcast: `adminBuild` → `features` (full feature object, no boolean shortcut)
- All IPC channels that gate by IS_ADMIN_BUILD now gate by feature object instead

### 4. `src/renderer/renderer.js` refactor

- `state.adminBuild` → `state.features`
- Mode tab: only render Confirmed/Autonomous tiles if in `state.features.modes`
- For locked tiers, show **upsell card** in their place: *"Confirmed mode auto-applies fixes once you approve them — upgrade to Pro $1,500/mo to enable"* with [Upgrade] button → opens Stripe URL
- Recipes tab: gray out Tier-1/2 recipes if Personal license; click → upsell card
- Fleet view tab: only renders for SMB+ plans
- Reports tab: PDF generator hidden for Personal; self-serve for Pro; auto-email for SMB+

### 5. `package.json` build config — Drop the dual build

- `extraResources` always includes `admin-console/` (folder always bundled, just locked at runtime by license check)
- Delete `package:win:admin` script entirely
- Single `package:win` produces the only customer .exe
- Update `ota-build.bat`: drop Step 3 (admin build), keep Step 4 (customer build) as the only build. Saves ~3 min/build.
- Drop `IS_ADMIN_BUILD` env var path everywhere

### 6. **In-app plan picker UI** — `src/overlay/plan-picker.html`

New surface. Triggered when:
- 12h trial expires (existing hook)
- User clicks "Enter license" → has no license yet → "Pick a plan" button OR "Paste existing key" button
- Settings → About → "Upgrade plan"

UI = side-by-side comparison cards (mobile-responsive). Data sourced from `pricing-tiers.mjs`. Each card:
- Plan name + price (monthly OR yearly toggle)
- Feature checkmark grid (the comparison table)
- **Highlight current plan** (if licensed)
- "Subscribe" button → opens existing Stripe URL (env vars already wired per memory)

### 7. **iisupp.net `/plans` page comparison matrix update**

Ahmad directive 2026-06-22:
> "update the price comparison option under the plans tab in the iisupp.net website and on the app when prompted for plan selection"

Update `public/plans.html` (or whatever the current plans page is):
- Replace existing price cards with the new tier matrix
- Feature comparison grid below: 12-row × 6-column table (features × plans)
- Source the data from `pricing-tiers.mjs` at build time (Netlify build injection) so website + app stay in sync forever
- Preserve all existing Stripe wiring (STRIPE_PERSONAL_MONTHLY_URL, STRIPE_PRO_MONTHLY_URL, STRIPE_SMALL_BUSINESS_YEARLY_URL, STRIPE_MIDSIZE_YEARLY_URL, STRIPE_ENTERPRISE_YEARLY_URL — all already in Netlify env)
- Render preview Artifact for Ahmad approval BEFORE pushing to live site (visual change → preview-first rule)

### 8. **Upsell triggers for Personal tier**

When license = client-personal and detector catches an issue requiring Confirmed/Autonomous mode:
- Mode chat shows: *"⚡ Autonomous mode caught WUAUSERV stopped — upgrade to Pro $1,500/mo to enable auto-fix → [Upgrade]"*
- Once per detection class per 7 days (don't be spammy)
- Monthly nudge in About tab: *"You've spent 8h on manual fixes this month — Pro would have saved you ~6h → [See Pro features]"*
- Globe panel (RUN 23) for Personal: shows the finding + a "lock" badge on the action button → click goes to upsell card

## 🧪 Test target

RUN 23d: 168 → **RUN 23e: 195** (27 new tests):
- `pricing-tiers.test.mjs` (15+)
- `license-features.test.mjs` (8+)
- `plan-picker-render.test.mjs` (6+)
- `upsell-triggers.test.mjs` (5+)
- `single-build-no-IS_ADMIN.test.mjs` (3+: regression — no references to deleted flag)

## 🚫 Don't break

- Every existing widget renders the same way for admin-tier license (admin sees what current admin .exe shows)
- License paste flow unchanged (still 64-hex local check; server-side stays for future)
- Trial flow unchanged (12h trial still applies, just unlocks at lowest tier)
- Existing fix recipes still vetted/categorized the same way

## ✋ Stop conditions

- R11 path in any feature gate output → HARD STOP
- Admin features unlock for a non-admin license → HARD STOP (security bug)
- Stripe URL hardcoded anywhere (must use env vars per existing memory) → STOP, fix
- Website plans page push without preview Artifact approval → STOP, preview first

## 📋 Reference: 6 lifetime test keys (Ahmad's keys — do NOT embed in code)

For Cowork's manual testing. CC should NEVER hardcode these. The license file is at `~/.aria-sentinel/license.json`.

| Plan | Key | Email |
|---|---|---|
| admin-lifetime | `5be774fc950212ae9daac6ae367dcfe123bc69a735bfb18bb055f35efd24b4b9` | ahmad.wasee@iisupp.net |
| client-personal | `8a6f94c05cb4b9cd202d5492c60d177615a50297fe287f68d05d5679b8a21f37` | ahmad.wasee+personal@iisupp.net |
| client-pro | `c4983e8c6aab4f9bd891816e23285f012709011fd1cb9406785b4bfa3b171b50` | ahmad.wasee+pro@iisupp.net |
| client-smb | `3f980929e961aabade3544dfd8904705304afd1fb866bbcfaf307d9020294983` | ahmad.wasee+smb@iisupp.net |
| client-mid | `dc175dce719c6736efc0becdd2f7e31ef9a68f81426e254eeee55b2b4e6c3537` | ahmad.wasee+mid@iisupp.net |
| client-enterprise | `bb5e7cc6917bee65622f696483f9b5dcb248b7881d6bfebd1e424bb6bb5c5370` | ahmad.wasee+enterprise@iisupp.net |

Cowork uses these to verify each tier behaves correctly after CC ships. The `plan` field in license.json drives gating; CC's `enabledFeatures(licenseStatus())` reads that plan from the existing `licenseStatus()` function.

## ⏭️ On-device verification (Ahmad after ship)

1. Paste `client-personal` key → Mode tab shows only Manual option, Confirmed/Autonomous have lock icons + upsell card
2. Stop Spooler → detection fires → fix card shows "🔒 Upgrade to Pro for autonomous fix"
3. Reports tab → shows "🔒 Quarterly PDF available on Pro tier"
4. Tray menu → "Open admin console" is HIDDEN
5. Log out → paste `client-pro` key → Confirmed + Autonomous appear, fleet view stays hidden, quarterly PDF self-serve appears
6. Log out → paste `client-smb` key → fleet view appears, compliance evidence pack appears, custom recipes appears
7. Log out → paste `admin-lifetime` key → admin console appears in tray menu, Updates publish form appears
8. Visit https://iisupp.net/plans → new comparison matrix renders, prices match, Stripe checkout URLs still work

## Commit

`[sentinel] RUN 23e: single build + license-tier feature gating + plan picker UI + iisupp.net plans matrix (N/N tests, preview approved)`

---

**Standing by for RUN 23e report. Cowork.**
