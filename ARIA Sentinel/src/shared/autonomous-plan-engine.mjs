import { createHash } from "node:crypto";
import { isBlockedPath } from "./path-guard.mjs";

export const PLAN_MODES = ["confirmed"];
export const PLAN_STATUSES = ["planned", "running", "paused", "completed", "blocked", "rolled_back"];
export const AUTONOMY_LADDER = ["manual", "confirmed", "autonomous"];

function sha(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function safeText(value) {
  return String(value == null ? "" : value).slice(0, 500);
}

export function validatePlan(plan = {}) {
  const errors = [];
  if (!plan || typeof plan !== "object") errors.push("plan-required");
  if (!safeText(plan.id)) errors.push("id-required");
  if (!safeText(plan.goal)) errors.push("goal-required");
  if (!PLAN_MODES.includes(String(plan.mode || ""))) errors.push("confirmed-mode-required");
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) errors.push("steps-required");
  for (const [i, step] of (plan.steps || []).entries()) {
    if (!safeText(step.id)) errors.push(`step-${i}-id-required`);
    if (!safeText(step.action)) errors.push(`step-${i}-action-required`);
    if (step.risk === "red") errors.push(`step-${i}-red-risk-blocked`);
  }
  if (isBlockedPath(JSON.stringify(plan))) errors.push("r11-blocked");
  return { ok: errors.length === 0, errors };
}

export function createJournal(plan = {}, { now = Date.now() } = {}) {
  const genesis = { index: 0, type: "PLAN.OPEN", planId: safeText(plan.id), ts: new Date(now).toISOString(), prevHash: "0".repeat(64) };
  return [sealEntry(genesis)];
}

function sealEntry(entry) {
  const material = { ...entry };
  delete material.hash;
  return { ...entry, hash: sha(JSON.stringify(material)) };
}

export function appendJournal(journal = [], event = {}, { now = Date.now() } = {}) {
  const prev = journal[journal.length - 1];
  const entry = {
    index: journal.length,
    type: safeText(event.type || "PLAN.EVENT"),
    stepId: safeText(event.stepId || ""),
    outcome: safeText(event.outcome || ""),
    ts: new Date(now).toISOString(),
    prevHash: prev ? prev.hash : "0".repeat(64)
  };
  return [...journal, sealEntry(entry)];
}

export function verifyJournal(journal = []) {
  if (!Array.isArray(journal) || journal.length === 0) return { ok: false, reason: "empty" };
  for (let i = 0; i < journal.length; i++) {
    const entry = journal[i];
    const expectedPrev = i === 0 ? "0".repeat(64) : journal[i - 1].hash;
    if (entry.prevHash !== expectedPrev) return { ok: false, reason: "prev-hash", index: i };
    if (sealEntry(entry).hash !== entry.hash) return { ok: false, reason: "entry-hash", index: i };
  }
  return { ok: true };
}

export function evaluatePlanStart(plan = {}, context = {}) {
  if (context.killed === true) return { ok: false, reason: "kill-switch" };
  if (String(context.mode || plan.mode || "") !== "confirmed") return { ok: false, reason: "confirmed-only" };
  return validatePlan(plan);
}

export function supervisorBeforeStep(plan, step, context = {}) {
  if (context.killed === true) return { ok: false, reason: "kill-switch" };
  if (isBlockedPath(JSON.stringify({ plan, step }))) return { ok: false, reason: "r11-blocked" };
  const supervisor = typeof context.supervisor === "function" ? context.supervisor : () => ({ verdict: "approve" });
  const verdict = supervisor({ plan, step });
  if (verdict && verdict.verdict === "veto") return { ok: false, reason: verdict.code || "supervisor-veto", verdict };
  return { ok: true, reason: "approved", verdict };
}

export function rollbackPlan(completedSteps = []) {
  return (Array.isArray(completedSteps) ? completedSteps : [])
    .filter((s) => s && s.rollback)
    .slice()
    .reverse()
    .map((s) => ({ stepId: s.id, action: s.rollback }));
}

export function goalProbe(result = {}) {
  if (result.satisfied === true) return { status: "satisfied", canExecute: false };
  if (result.satisfied === false) return { status: "unsatisfied", canExecute: false };
  return { status: "unknown", canExecute: false };
}

export function resumePlan(plan = {}, journal = []) {
  const verified = verifyJournal(journal);
  if (!verified.ok) return { ok: false, reason: "journal-invalid", verified };
  const done = new Set(journal.filter((e) => e.type === "STEP.OK").map((e) => e.stepId));
  const next = (plan.steps || []).find((s) => !done.has(s.id)) || null;
  return { ok: true, completedStepIds: [...done], nextStepId: next ? next.id : null, status: next ? "paused" : "completed", requiresSupervisor: Boolean(next) };
}

export function autonomyDecision({ mode = "manual", planRequested = false } = {}) {
  if (!AUTONOMY_LADDER.includes(mode)) return { ok: false, reason: "unknown-mode" };
  if (planRequested && mode !== "confirmed") return { ok: false, reason: "plans-confirmed-only" };
  return { ok: true, mode };
}
