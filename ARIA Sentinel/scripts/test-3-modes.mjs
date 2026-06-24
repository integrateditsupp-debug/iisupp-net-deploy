#!/usr/bin/env node
// RUN 32-B — on-device 3-mode proof Ahmad runs locally. It drives the REAL decision pipeline (supervisor critic
// → executionPolicy → countdown gate) for a safe Tier-0 recipe (network-flush-dns) across Manual / Confirmed /
// Autonomous and writes a pass/fail matrix to docs/3-mode-smoke-results.md. It NEVER executes a real OS command
// (the recipe is only routed through the decision logic, never spawned), so it is safe to run anywhere.
//
//   node "ARIA Sentinel/scripts/test-3-modes.mjs"
//
// (The full UI screenshot pass — launching the Electron app and capturing each mode's screen — is a separate
//  on-device step; this proves the execution LOGIC each mode applies, which is what actually gates a fix.)
import { superviseProposal } from "../src/main/supervisor-agent.mjs";
import { executionPolicy } from "../src/main/dry-run-policy.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const RECIPE = "network-flush-dns";
const VETTED = new Set([RECIPE]);
const TIER0 = 150;
const NOW = 1_700_000_000_000;
const okHistory = (count) => Array.from({ length: count }, (_, i) => ({ recipeId: RECIPE, ts: NOW - (i + 1) * 86_400_000, ok: true }));

function pipeline({ mode, history = [], dryRunCheckbox }) {
  const v = superviseProposal({ recipeId: RECIPE, riskTier: "low", expectedImpact: [] }, { mode, vettedCatalog: VETTED, history, now: NOW });
  const p = executionPolicy({ vettedCount: TIER0, mode, dryRunCheckbox, supervisorVerdict: v.verdict });
  return { verdict: v.verdict, dryRun: p.dryRun, execute: p.execute, countdown: p.requiresCountdown, autoFire: p.canAutoFire };
}

// Expected behaviour per mode (the contract proven in tests/mode-execution.test.mjs).
const CASES = [
  { name: "Manual — default (preview)", got: pipeline({ mode: "manual" }), want: { execute: false, dryRun: true } },
  { name: "Manual — user confirms", got: pipeline({ mode: "manual", dryRunCheckbox: false }), want: { execute: true, countdown: true } },
  { name: "Confirmed — countdown + exec", got: pipeline({ mode: "confirmed" }), want: { execute: true, countdown: true, dryRun: false } },
  { name: "Autonomous — proven, fast-path", got: pipeline({ mode: "autonomous", history: okHistory(5) }), want: { execute: true, countdown: false, autoFire: true } },
  { name: "Autonomous — unproven, keeps countdown", got: pipeline({ mode: "autonomous" }), want: { execute: true, countdown: true } }
];

let fails = 0;
const rows = CASES.map(({ name, got, want }) => {
  const ok = Object.entries(want).every(([k, v]) => got[k] === v);
  if (!ok) fails++;
  console.log(`${ok ? "✅" : "❌"} ${name.padEnd(40)} ${JSON.stringify(got)}`);
  return `| ${name} | ${ok ? "✅ pass" : "❌ fail"} | \`${JSON.stringify(got)}\` |`;
});

const md = [
  "# 3-Mode Smoke Test — Results",
  "",
  `**Outcome:** ${fails === 0 ? "✅ ALL MODES PASS" : `❌ ${fails} failure(s)`}  ·  recipe: \`${RECIPE}\` (safe Tier-0, never spawned)`,
  "",
  "| Case | Result | Decision |",
  "|---|---|---|",
  ...rows,
  "",
  "_Decision pipeline only (supervisor → executionPolicy → countdown gate). No OS command is executed._",
  ""
].join("\n");
try { mkdirSync(new URL("../docs/", import.meta.url), { recursive: true }); } catch { /* exists */ }
writeFileSync(new URL("../docs/3-mode-smoke-results.md", import.meta.url), md);
console.log(`\nWrote ARIA Sentinel/docs/3-mode-smoke-results.md  ·  ${fails === 0 ? "ALL PASS" : fails + " failure(s)"}`);
process.exit(fails === 0 ? 0 : 1);
