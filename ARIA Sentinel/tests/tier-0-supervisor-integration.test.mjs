// RUN 23b §2 — the executor stays gated by the RUN 23 control plane. A Tier-0 executor recipe must pass the
// supervisor + the vetted-tier policy before it can run, and the recommend-action → executor id chain binds.
import assert from "node:assert/strict";
import { superviseProposal } from "../src/main/supervisor-agent.mjs";
import { executionPolicy } from "../src/main/dry-run-policy.mjs";
import { recommendAction } from "../src/shared/recommend-action.mjs";
import { resolveExecutorId, TIER0_EXECUTOR_IDS } from "../src/main/tier-0-executor.mjs";

const vetted = new Set(TIER0_EXECUTOR_IDS);

// The Spooler chain: detection → recommendation → executor binding.
const rec = recommendAction({ type: "service-stopped", service: "Spooler" });
assert.equal(rec.recipeId, "restart-print-spooler");
assert.equal(resolveExecutorId(rec.recipeId), "restart-print-spooler", "recommendation binds to an executor");

// Supervisor approves the bound recipe (declared impact = the service it touches), with no history.
const proposal = { recipeId: "restart-print-spooler", riskTier: "medium", expectedImpact: ["spooler"] };
const verdict = superviseProposal(proposal, { now: 1_700_000_000_000, mode: "confirmed", vettedCatalog: vetted });
assert.equal(verdict.verdict, "approve");

// An executor recipe with NOTHING declared is still vetoed for the undeclared side-effect (gate holds).
assert.equal(superviseProposal({ recipeId: "restart-print-spooler", expectedImpact: [] }, { now: 1, vettedCatalog: vetted }).code, "SIDE_EFFECT_UNDECLARED");

// Policy: fresh machine (Tier-2, dry-run ON) → no live execution even when approved.
let p = executionPolicy({ vettedCount: 0, mode: "manual", supervisorVerdict: "approve" });
assert.equal(p.dryRun, true);
assert.equal(p.execute, false, "dormant by default");
// Opted-in (checkbox off) Tier-2 in Manual → executes with the Ahmad prompt + countdown.
p = executionPolicy({ vettedCount: 0, mode: "manual", dryRunCheckbox: false, supervisorVerdict: "approve" });
assert.equal(p.execute, true);
assert.equal(p.requiresAhmadPrompt, true);
assert.equal(p.requiresCountdown, true);
// Fully vetted (Tier-0) in Autonomous, fast-path → live + auto-fire, countdown skipped.
p = executionPolicy({ vettedCount: 150, mode: "autonomous", supervisorVerdict: "approve-fast" });
assert.equal(p.canAutoFire, true);
assert.equal(p.requiresCountdown, false);

// The audio alias also binds through the chain.
assert.equal(resolveExecutorId(recommendAction({ type: "service-stopped", service: "AudioSrv" }).recipeId), "restart-audio");

console.log("Tier-0-supervisor-integration test passed (recommend→bind · supervisor approve/veto · dormant-by-default · opt-in · fast-path).");
