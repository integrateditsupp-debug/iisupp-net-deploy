// STAGE 3 S1 — Resolution Plan journal. Append-only JSONL (~/.aria-sentinel/plans/<planRunId>.jsonl),
// every transition is an entry carrying `prevHash` — the same tamper-evident hash-chain posture as
// audit-integrity. Journal replay = the resume logic: on boot the startup watchdog replays the journal
// and either resumes at a safe step boundary or rolls back + escalates — never half-applied.
// 🔒 R11 at the journal layer: every string field is redacted at the source, so an off-limits path can
// never persist to disk. Pure + node-safe (node:crypto only); fs wiring stays in main via `persist`.
import crypto from "node:crypto";
import { redactPrivate } from "./path-guard.mjs";

const GENESIS = "aria-plan-journal-genesis-v1";
export const JOURNAL_VERSION = "plan-journal-v1";
export const PLAN_EVENTS = Object.freeze([
  "PLAN.PROPOSED", "PLAN.APPROVED",
  "PLAN.STEP.PRE", "PLAN.STEP.EXEC", "PLAN.STEP.POST", "PLAN.STEP.ROLLBACK",
  "PLAN.RESOLVED", "PLAN.ABORTED", "PLAN.ESCALATED"
]);
const TERMINAL_EVENTS = new Set(["PLAN.RESOLVED", "PLAN.ABORTED", "PLAN.ESCALATED"]);
const MID_STEP_EVENTS = new Set(["PLAN.STEP.PRE", "PLAN.STEP.EXEC", "PLAN.STEP.ROLLBACK"]);

// Deep-redact: strings are R11-redacted; objects/arrays walked; anything unserializable dropped.
function sanitizeExtra(value) {
  if (typeof value === "string") return redactPrivate(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeExtra);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const sv = sanitizeExtra(v);
      if (sv !== undefined && typeof sv !== "function") out[redactPrivate(k)] = sv;
    }
    return out;
  }
  return undefined;
}

// Stable, field-ordered serialization (hash input; `hash` itself excluded).
function serialize(e) {
  return JSON.stringify({
    v: String(e.v || ""), seq: Number(e.seq) || 0, ts: String(e.ts || ""), event: String(e.event || ""),
    planId: String(e.planId || ""), planRunId: String(e.planRunId || ""),
    stepIndex: e.stepIndex == null ? null : Number(e.stepIndex),
    recipeId: String(e.recipeId || ""), detail: String(e.detail || ""),
    extra: e.extra && typeof e.extra === "object" ? e.extra : {},
    prevHash: String(e.prevHash || "")
  });
}

export function entryHash(entry) {
  return crypto.createHash("sha256").update(String(entry.prevHash || GENESIS) + "|" + serialize(entry)).digest("hex");
}

/**
 * Append one transition. Returns a NEW array (append-only; callers persist the last entry).
 * Throws on an unknown event — the vocabulary is closed so the replay logic is total.
 */
export function appendEntry(entries, fields = {}, now = Date.now) {
  const list = Array.isArray(entries) ? entries : [];
  if (!PLAN_EVENTS.includes(fields.event)) throw new Error(`plan-journal: unknown event "${fields.event}"`);
  const prev = list.length ? list[list.length - 1] : null;
  const e = {
    v: JOURNAL_VERSION,
    seq: list.length,
    ts: new Date(typeof now === "function" ? now() : now).toISOString(),
    event: fields.event,
    // 🔒 R11 — every string field is redacted before it can ever reach disk.
    planId: redactPrivate(String(fields.planId || "")),
    planRunId: redactPrivate(String(fields.planRunId || "")),
    stepIndex: fields.stepIndex == null ? null : Number(fields.stepIndex),
    recipeId: redactPrivate(String(fields.recipeId || "")),
    detail: redactPrivate(String(fields.detail || "")),
    extra: sanitizeExtra(fields.extra || {}),
    prevHash: prev ? prev.hash : GENESIS
  };
  e.hash = entryHash(e);
  return [...list, e];
}

/** Verify the whole chain: linkage, recomputed hashes, and seq order. */
export function verifyChain(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let prevHash = GENESIS;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || e.seq !== i || e.prevHash !== prevHash || entryHash(e) !== e.hash) {
      return { ok: false, tampered: true, brokenAt: i, reason: !e || e.seq !== i ? "sequence-broken" : (e.prevHash !== prevHash ? "chain-broken" : "entry-modified") };
    }
    prevHash = e.hash;
  }
  return { ok: true, tampered: false, brokenAt: -1, reason: "intact" };
}

export function toJsonl(entries) {
  return (Array.isArray(entries) ? entries : []).map((e) => JSON.stringify(e)).join("\n") + (entries && entries.length ? "\n" : "");
}

export function fromJsonl(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { out.push({ corrupt: true, seq: -1 }); }
  }
  return out;
}

/** Replay a journal into its current state (crash-safe view of a plan run). */
export function replayState(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const first = list[0] || null;
  const last = list.length ? list[list.length - 1] : null;
  const completedSteps = [];
  let approved = false;
  for (const e of list) {
    if (e.event === "PLAN.APPROVED") approved = true;
    if (e.event === "PLAN.STEP.POST" && e.stepIndex != null && !completedSteps.includes(e.stepIndex)) completedSteps.push(e.stepIndex);
  }
  const terminal = !!(last && TERMINAL_EVENTS.has(last.event));
  return {
    started: list.length > 0,
    planId: first ? first.planId : "",
    planRunId: first ? first.planRunId : "",
    approved,
    lastEvent: last ? last.event : "",
    lastStepIndex: last && last.stepIndex != null ? last.stepIndex : null,
    completedSteps,
    terminal,
    outcomeEvent: terminal ? last.event : "",
    interrupted: list.length > 0 && !terminal
  };
}

/**
 * Boot-time decision for an interrupted plan (the spec's "never half-applied" rule):
 *   - intact + ended at a step boundary (STEP.POST / APPROVED) → resume at the next step
 *   - mid-step (STEP.PRE/EXEC/ROLLBACK) or tampered chain      → rollback + escalate
 *   - terminal / never approved / empty                        → nothing to do
 */
export function resumeDecision(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return { action: "none", reason: "empty-journal" };
  const chain = verifyChain(list);
  if (!chain.ok) return { action: "rollback-escalate", reason: "journal-tampered", brokenAt: chain.brokenAt };
  const state = replayState(list);
  if (state.terminal) return { action: "none", reason: "already-terminal" };
  const last = list[list.length - 1];
  if (last.event === "PLAN.STEP.POST") return { action: "resume", nextStepIndex: Number(last.stepIndex) + 1, reason: "safe-step-boundary" };
  if (last.event === "PLAN.APPROVED") return { action: "resume", nextStepIndex: 0, reason: "approved-not-started" };
  if (MID_STEP_EVENTS.has(last.event)) return { action: "rollback-escalate", reason: "interrupted-mid-step", stepIndex: last.stepIndex };
  return { action: "none", reason: "not-approved" }; // PLAN.PROPOSED only — nothing was executed.
}
