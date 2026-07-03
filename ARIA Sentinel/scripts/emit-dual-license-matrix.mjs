// Generates documents/product-engineering/SENTINEL-DUAL-LICENSE-TEST-MATRIX-2026-07-03.md from the SAME
// pure modules the app + the dual-license-matrix test use — so the doc can never drift from the code.
// Run: node scripts/emit-dual-license-matrix.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activePlan, enabledFeatures, licenseIsAdmin, isWalkthroughEntitled } from "../src/shared/license-features.mjs";
import { tabGateMap, appUnlocked, GATED_TABS, BASELINE_TABS, WALKTHROUGH_TAB } from "../src/shared/tab-gating.mjs";
import { STATES } from "../tests/dual-license-matrix.test.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Committed home = ARIA Sentinel/qa/ (tracked). Also mirror to the internal documents/ tree (gitignored by the
// security lockdown) when present, so Cowork sees it in the primary working tree where the directive named it.
const trackedPath = path.resolve(HERE, "../qa/SENTINEL-DUAL-LICENSE-TEST-MATRIX-2026-07-03.md");
const internalPath = path.resolve(HERE, "../../documents/product-engineering/SENTINEL-DUAL-LICENSE-TEST-MATRIX-2026-07-03.md");

const LABEL = {
  admin: "Admin (internal)", pro: "Pro", smb: "Small Business", personal: "Personal",
  trialActive: "Trial — active", trialExpired: "Trial — expired (free floor)", trialExpiredEnt: "Trial — expired + Walk-Through"
};
const order = ["admin", "pro", "smb", "personal", "trialActive", "trialExpired", "trialExpiredEnt"];
const yn = (b) => (b ? "✓" : "—");

function row(label, fn) { return `| ${label} | ${order.map((s) => fn(STATES[s])).join(" | ")} |`; }
const header = `| Capability / surface | ${order.map((s) => LABEL[s]).join(" | ")} |`;
const sep = `| --- | ${order.map(() => "---").join(" | ")} |`;

const featureRows = [
  ["Active plan (resolved)", (s) => "`" + activePlan(s) + "`"],
  ["Paid surface unlocked", (s) => yn(appUnlocked(s))],
  ["Admin console", (s) => yn(licenseIsAdmin(s))],
  ["Walk-Through entitled", (s) => yn(isWalkthroughEntitled(s))],
  ["Execution modes", (s) => enabledFeatures(s).modes.join("+") || "—"],
  ["Fix recipes", (s) => String(enabledFeatures(s).recipesCount)],
  ["Local system inventory", (s) => yn(enabledFeatures(s).systemInventory)],
  ["SLA tracking", (s) => yn(enabledFeatures(s).slaTracking)],
  ["Quarterly PDF reports", (s) => yn(enabledFeatures(s).quarterlyPdf)],
  ["Compliance evidence pack", (s) => yn(enabledFeatures(s).complianceEvidence)],
  ["Fleet view", (s) => yn(enabledFeatures(s).fleetView)],
  ["Custom recipes", (s) => yn(enabledFeatures(s).customRecipes)],
  ["White-label", (s) => yn(enabledFeatures(s).whiteLabel)],
];

const tabRows = [
  ...BASELINE_TABS.map((tab) => [`Tab: ${tab} (baseline)`, (s) => yn(tabGateMap(s)[tab])]),
  [`Tab: ${WALKTHROUGH_TAB}`, (s) => yn(tabGateMap(s)[WALKTHROUGH_TAB])],
  ...GATED_TABS.map((tab) => [`Tab: ${tab} (paid)`, (s) => yn(tabGateMap(s)[tab])]),
];

const doc = `# ARIA Sentinel — Dual-License Test Matrix — 2026-07-03

**Machine-generated** from the app's own pure modules (\`license-features.mjs\` · \`license-plan.mjs\` · \`pricing-tiers.mjs\` · \`tab-gating.mjs\`) by \`scripts/emit-dual-license-matrix.mjs\`, and **machine-checked** by \`tests/dual-license-matrix.test.mjs\` (in \`npm test\`). This table cannot drift from the shipping gate logic — regenerate to refresh.

Rule 14 (honest / real-or-empty), Rule 15 (every tab preserved — gating never deletes a tab, it locks a paid one behind a dismissible upsell while the baseline stays navigable), Rule 16 (verify every "done"). Legend: ✓ = available/enabled, — = locked/not included.

## How to reproduce
\`\`\`
cd "ARIA Sentinel"
node tests/run-all.mjs          # full suite incl. dual-license-matrix + gating tests
npm run audit                   # privacy audit
node tests/boot-smoke.mjs       # real Electron boot (nav + quick action + overlay one-box)
node scripts/emit-dual-license-matrix.mjs   # regenerate THIS doc
\`\`\`

## Feature × license state
${header}
${sep}
${featureRows.map(([l, f]) => row(l, f)).join("\n")}

## Navigable/locked tab map × license state
${header}
${sep}
${tabRows.map(([l, f]) => row(l, f)).join("\n")}

## What this proves (per the CC directive item 3)
- **Every state resolves to the right plan.** Admin→admin, Pro/Trial-active→pro, Personal→personal, SMB→smb, expired trial→\`free\` floor.
- **Gating is correct.** Paid tabs unlock on any paid plan or an active trial; they lock on the expired free floor. The admin console is admin-ONLY (fail-closed for every client tier).
- **Baseline always navigable — no dead-shell.** Dashboard · ARIA · Settings stay open in EVERY state, including the expired free floor, so the app is never a locked shell and the buy path (Settings) is always reachable.
- **Walk-Through entitlement is independent of the plan.** It is ON for an active trial, any paid plan whose tier includes it (Pro/SMB/Mid/Enterprise/Admin), and a Concierge buyer (\`walkthroughEntitled\` flag) even after the trial expires — and OFF for paid Personal (which doesn't include it) and the un-entitled expired floor.
- **Free floor ⊊ Personal.** The expired/unlicensed floor has no modes and no recipes, so buying Personal is a real upgrade.
- **Honest real-or-empty everywhere + premium UX.** The dashboard hero is the colored WORD (no redundant dot), SLA/KPI charts render real-or-empty with a clean axis, and every metric is real or shows "—" (covered by \`dashboard-hero-status\`, \`density-charts-collapse\`, and the honesty/fabrication suites).

## Coverage note (development-stage surfaces)
- **Shipped + gated:** all rows above (driven by live gate logic).
- **Dormant/partial:** autonomous overnight/reboot-resume, earned-autonomy ladder — flag-gated OFF; shown as roadmap on /plans, never implied shipped.
- **Planned-but-visible:** MSP portal/white-label depth, KB→1,000+ taxonomy, Edge/Safari + connector marketplace, macOS — listed under "Coming soon" (Rule 14 honest labeling).

_Regenerate after any change to the tier table or gate logic; the matrix test will fail first if the two disagree._
`;

fs.mkdirSync(path.dirname(trackedPath), { recursive: true });
fs.writeFileSync(trackedPath, doc, "utf8");
console.log("wrote", trackedPath, `(${doc.length} bytes)`);
try { fs.mkdirSync(path.dirname(internalPath), { recursive: true }); fs.writeFileSync(internalPath, doc, "utf8"); console.log("mirrored", internalPath); }
catch (e) { console.log("internal mirror skipped:", e.message); }
