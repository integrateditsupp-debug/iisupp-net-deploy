// RUN 23 §5 — supervisor/critic. 6 ordered checks, first FAIL = VETO; R11 is check #1 and absolute. Every
// veto path + the fast-path + the high-risk-autonomous confirm gate is covered (20+ assertions).
import assert from "node:assert/strict";
import { superviseProposal, recipeSideEffects, supervisorAuditEntry } from "../src/main/supervisor-agent.mjs";

const NOW = 1_700_000_000_000;
const MIN = 60 * 1000;
const ok = (recipeId, extra = {}) => ({ recipeId, expectedImpact: ["spooler"], riskTier: "medium", ...extra });

// 1 — 🔒 R11 veto: an off-limits path in expectedImpact.
let r = superviseProposal({ recipeId: "restart-print-spooler", expectedImpact: ["C:/Users/bob/Private pics and Vids"] }, { now: NOW });
assert.equal(r.verdict, "veto");
assert.equal(r.code, "R11_BLOCKED");

// 1b — 🔒 R11 veto wins even when the recipe is ALSO unvetted (order: R11 before signature).
r = superviseProposal({ recipeId: "Private pics and Vids fix" }, { now: NOW });
assert.equal(r.code, "R11_BLOCKED");

// 2 — signature veto: recipe not in the signed catalog.
r = superviseProposal({ recipeId: "rm-rf-everything", expectedImpact: [] }, { now: NOW });
assert.equal(r.verdict, "veto");
assert.equal(r.code, "UNVETTED_RECIPE");
// 2b — empty recipe id → veto.
assert.equal(superviseProposal({ recipeId: "" }, { now: NOW }).code, "UNVETTED_RECIPE");

// 3 — clean approve: known recipe, declared impact, no history.
r = superviseProposal(ok("restart-print-spooler"), { now: NOW, mode: "confirmed" });
assert.equal(r.verdict, "approve");
assert.equal(r.supervisorEvidence.fastPath, false);
assert.ok(Array.isArray(r.supervisorEvidence.checks));

// 5 — side-effect veto: recipe touches Spooler but nothing is declared.
r = superviseProposal({ recipeId: "restart-print-spooler", expectedImpact: [], riskTier: "medium" }, { now: NOW });
assert.equal(r.verdict, "veto");
assert.equal(r.code, "SIDE_EFFECT_UNDECLARED");
assert.equal(r.supervisorEvidence.sideEffects.escalate, true);
// 5b — declaring the service clears the check.
assert.equal(superviseProposal(ok("restart-print-spooler"), { now: NOW }).verdict !== "veto", true);

// 6 — cooldown veto: identical recipe attempted 2 min ago.
r = superviseProposal(ok("restart-print-spooler"), { now: NOW, history: [{ recipeId: "restart-print-spooler", ts: NOW - 2 * MIN, ok: true }] });
assert.equal(r.code, "COOLDOWN");
// 6b — older than 5 min → no cooldown.
r = superviseProposal(ok("restart-print-spooler"), { now: NOW, history: [{ recipeId: "restart-print-spooler", ts: NOW - 6 * MIN, ok: true }] });
assert.notEqual(r.verdict, "veto");

// 3b — fast-path: last 5 runs (within 30d, >5min apart) all OK → approve-fast.
const five = [6, 7, 8, 9, 10].map((m) => ({ recipeId: "restart-print-spooler", ts: NOW - m * MIN, ok: true })).reverse();
r = superviseProposal(ok("restart-print-spooler"), { now: NOW, mode: "autonomous", history: five });
assert.equal(r.verdict, "approve-fast");
assert.equal(r.supervisorEvidence.fastPath, true);
// 3c — only 4 runs → no fast-path (plain approve).
r = superviseProposal(ok("restart-print-spooler"), { now: NOW, history: five.slice(0, 4) });
assert.equal(r.verdict, "approve");
// 3d — fast-path candidate STILL vetoed by cooldown if the most-recent run is <5min ago.
const fiveRecent = [1, 7, 8, 9, 10].map((m) => ({ recipeId: "restart-print-spooler", ts: NOW - m * MIN, ok: true }));
assert.equal(superviseProposal(ok("restart-print-spooler"), { now: NOW, history: fiveRecent }).code, "COOLDOWN");

// 4 — risk vs mode: HIGH risk in Autonomous still requires confirm → plain approve (never fast-path).
r = superviseProposal(ok("reset-network-stack", { riskTier: "high", expectedImpact: [] }), { now: NOW, mode: "autonomous", history: five.map((h) => ({ ...h, recipeId: "reset-network-stack" })) });
assert.equal(r.verdict, "approve");
assert.equal(r.supervisorEvidence.needsConfirm, true);
// 4b — high risk in manual mode → not flagged as autonomous-confirm.
r = superviseProposal(ok("reset-network-stack", { riskTier: "high", expectedImpact: [] }), { now: NOW, mode: "manual" });
assert.equal(r.supervisorEvidence.needsConfirm, false);

// custom vetted catalog gate.
assert.equal(superviseProposal({ recipeId: "x", expectedImpact: [] }, { now: NOW, vettedCatalog: new Set(["x"]) }).verdict, "approve");

// recipeSideEffects parses -Name args.
assert.deepEqual(recipeSideEffects("restart-print-spooler"), ["spooler"]);
assert.deepEqual(recipeSideEffects("flush-dns"), []);

// audit entries.
assert.equal(supervisorAuditEntry({ verdict: "approve-fast" }, { recipeId: "restart-print-spooler" }).event, "SUPERVISOR.APPROVE");
assert.equal(supervisorAuditEntry({ verdict: "veto", code: "COOLDOWN" }, { recipeId: "x" }).event, "SUPERVISOR.VETO");
assert.equal(supervisorAuditEntry({ verdict: "approve-fast" }, {}).fastPath, true);

console.log("Supervisor-agent test passed (R11 first · signature · history fast-path · risk/mode · side-effect · cooldown · audit).");
