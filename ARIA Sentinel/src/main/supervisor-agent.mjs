// RUN 23 §5 — Audit/Supervisor pre-execution critic. Actor-critic separation: the recipe selector (actor)
// proposes a fix; THIS module (critic) must approve it BEFORE the 10s countdown runs. Design refs: NIST AI
// RMF Manage 4.1 (manage residual risk before action), IEC 61511 Safety-Instrumented-Systems (independent
// protection layer), ISO 31010 (structured risk assessment), the financial two-person rule / Constitutional
// AI (a second agent vetoes unsafe acts). Pure + node-safe so every veto path is unit-testable. Lives in the
// MAIN process — never the renderer. 🔒 R11 is check #1 and an absolute hard VETO.
import { isBlockedPath, redactPrivate } from "../shared/path-guard.mjs";
import { recipes } from "./recipes/tier-0/catalog.mjs";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 5 * 60 * 1000; // identical recipe within 5 min → veto (the gate that held WUAUSERV)
const FAST_PATH_RUNS = 5;          // last N runs must all be OK for a fast-path approval

const veto = (code, reason, evidence) => ({ verdict: "veto", code, reason, supervisorEvidence: evidence });

/** Service short-names a Tier-0 recipe actually touches, parsed from its `-Name <svc>` command args. */
export function recipeSideEffects(recipeId) {
  const r = recipes[recipeId];
  if (!r || !Array.isArray(r.commands)) return [];
  const svc = new Set();
  for (const cmd of r.commands) {
    const m = String(cmd).matchAll(/-Name\s+([A-Za-z0-9_.-]+)/g);
    for (const hit of m) svc.add(hit[1].toLowerCase());
  }
  return [...svc];
}

/**
 * Run the proposal through the ordered safety checks. First failing veto-check returns immediately.
 * @param {{recipeId:string,args?:object,riskTier?:string,expectedImpact?:string[],rollbackPlan?:string}} proposal
 * @param {{mode?:string,history?:Array,recentAttempts?:Array,vettedCatalog?:Set,now?:number}} context
 * @returns {{verdict:"approve"|"approve-fast"|"veto", code?:string, reason:string, supervisorEvidence:object}}
 */
export function superviseProposal(proposal = {}, context = {}) {
  const now = Number.isFinite(context.now) ? context.now : Date.now();
  const recipeId = String(proposal.recipeId || "");
  const evidence = { checks: [] };
  const pass = (id, detail) => { evidence.checks.push({ id, status: "pass", detail: detail || "" }); };

  // 1 — 🔒 R11 path scan. Any off-limits reference ANYWHERE in the proposal is an absolute VETO.
  const blob = safeStringify(proposal);
  const impact = Array.isArray(proposal.expectedImpact) ? proposal.expectedImpact : [];
  if (isBlockedPath(blob) || impact.some(isBlockedPath)) {
    evidence.r11 = "blocked";
    return veto("R11_BLOCKED", "Proposal references the off-limits private folder.", evidence);
  }
  pass("r11");

  // 2 — recipe signature. Must be a known/signed recipe id in the vetted catalog.
  const vetted = context.vettedCatalog instanceof Set ? context.vettedCatalog : new Set(Object.keys(recipes));
  if (!recipeId || !vetted.has(recipeId)) {
    evidence.signature = "unknown";
    return veto("UNVETTED_RECIPE", `Recipe "${redactPrivate(recipeId) || "(none)"}" is not in the signed catalog.`, evidence);
  }
  pass("signature", recipeId);

  // 3 — history check. Exact recipe, last 5 runs (within 30d) all OK → fast-path candidate (skip countdown).
  const history = Array.isArray(context.history) ? context.history : [];
  const recent = history.filter((h) => h && h.recipeId === recipeId && now - (h.ts || 0) <= THIRTY_DAYS);
  const last5 = recent.slice(-FAST_PATH_RUNS);
  const fastPathEligible = last5.length >= FAST_PATH_RUNS && last5.every((h) => h.ok === true);
  pass("history", fastPathEligible ? `last ${FAST_PATH_RUNS} runs OK (fast-path eligible)` : `${recent.length} runs in 30d`);

  // 4 — risk vs mode gate. A high-risk recipe in Autonomous mode STILL requires explicit confirm.
  const riskTier = String(proposal.riskTier || proposal.risk || "medium");
  const mode = String(context.mode || "manual");
  const needsConfirm = riskTier === "high" && mode === "autonomous";
  pass("risk-mode", `${riskTier} risk / ${mode} mode${needsConfirm ? " → confirm required" : ""}`);

  // 5 — side-effect analysis. The recipe must not touch services NOT named in expectedImpact.
  const declared = impact.map((s) => String(s).toLowerCase());
  const actual = recipeSideEffects(recipeId);
  const undeclared = actual.filter((s) => !declared.some((d) => d.includes(s) || s.includes(d)));
  if (undeclared.length) {
    evidence.sideEffects = { declared, actual, undeclared, escalate: true };
    return veto("SIDE_EFFECT_UNDECLARED", `Touches ${undeclared.join(", ")} not in expectedImpact — escalating to chat.`, evidence);
  }
  pass("side-effect", actual.length ? `bounded: ${actual.join(", ")}` : "no service side-effects");

  // 6 — cooldown. Identical recipe attempted within 5 minutes → veto (anti-thrash; held WUAUSERV).
  const attempts = Array.isArray(context.recentAttempts) ? context.recentAttempts : history;
  const lastAttempt = attempts
    .filter((h) => h && h.recipeId === recipeId)
    .reduce((acc, h) => ((h.ts || 0) > (acc?.ts || 0) ? h : acc), null);
  if (lastAttempt && now - (lastAttempt.ts || 0) < COOLDOWN_MS) {
    evidence.cooldown = { sinceMs: now - (lastAttempt.ts || 0), windowMs: COOLDOWN_MS };
    return veto("COOLDOWN", `Identical recipe attempted ${Math.round((now - lastAttempt.ts) / 1000)}s ago (<5 min cooldown).`, evidence);
  }
  pass("cooldown", "no recent identical attempt");

  // All veto-checks cleared. High-risk-in-autonomous never fast-paths; otherwise honor fast-path eligibility.
  if (fastPathEligible && !needsConfirm) {
    return { verdict: "approve-fast", reason: "Repeat-success pattern — fast-path (countdown skipped).", supervisorEvidence: { ...evidence, needsConfirm, fastPath: true } };
  }
  return { verdict: "approve", reason: needsConfirm ? "Approved — high-risk requires explicit confirm." : "Approved — all safety checks passed.", supervisorEvidence: { ...evidence, needsConfirm, fastPath: false } };
}

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

/** Audit entry for ~/.aria-sentinel/audit.log — SUPERVISOR.APPROVE / SUPERVISOR.VETO (R11-redacted). */
export function supervisorAuditEntry(result = {}, proposal = {}) {
  const tag = result.verdict === "veto" ? "VETO" : "APPROVE";
  return {
    event: `SUPERVISOR.${tag}`,
    recipeId: redactPrivate(String(proposal.recipeId || "")),
    verdict: result.verdict || "veto",
    code: result.code || "",
    reason: redactPrivate(String(result.reason || "")),
    fastPath: result.verdict === "approve-fast"
  };
}
