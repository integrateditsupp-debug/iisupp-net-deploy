// STAGE 3 S2 — PLAN BOOT RECOVERY (the "resume-after-reboot WIRING" brain).
//
// What was missing, verified in the real code before writing a line:
//   `plan-journal.mjs` has shipped the pure per-run decision (`resumeDecision`) since S1, and
//   `tests/plan-resume-after-reboot.test.mjs` says so in its own header — "S1 ships the pure decision
//   (resumeDecision); the S2 watchdog wires it to startup-registrar." A repo-wide grep for
//   `resumeDecision` finds exactly ONE hit: its own definition. Nothing calls it. So on boot, an
//   interrupted Resolution Plan is today simply forgotten — the exact "half-applied" state the spec
//   forbids. This module is that missing wiring, expressed as a PURE sweep so it can be fully tested.
//
// What it is: given the set of plan-run journals found at startup, decide — per run, then as an ordered
// batch — what the watchdog must do: roll back + escalate, offer a resume, resume unattended (Autonomous
// mode only), or leave it alone. It EXECUTES NOTHING. There is no fs, no spawn, no Electron, no DOM here;
// the caller injects the journal text via a reader. That keeps the dangerous half (real I/O, the guarded
// spawn, the supervisor call) in main where it already lives, and makes every decision deterministic.
//
// The laws it enforces (each one is a test):
//   R11 is check #1 — a journal whose source/planId/planRunId touches the off-limits private folder is
//     BLOCKED before it is read. The reader is never even called for it, and the folder name never
//     appears in any output (banner or reason).
//   Kill-switch supremacy — if the kill-switch is engaged at boot, NOTHING resumes. Every interrupted
//     run becomes rollback-escalate. A kill is an abort + rollback, never a pause.
//   Never half-applied — mid-step, tampered, corrupt and unreadable journals all roll back and escalate;
//     they never resume. Only an intact chain that stopped on a step BOUNDARY may resume, at the next step.
//   Resume is never silent — a resume ALWAYS requires supervisor re-approval against live state plus the
//     countdown, even in Autonomous mode. Outside Autonomous mode it is only an OFFER (one user click).
//   A dry-run never claims anything and never triggers a real rollback — a rehearsal changed nothing,
//     so an interrupted dry-run is settled, not pending work.
//   Safety before progress — rollbacks are ordered ahead of resumes in the batch, and each rollback
//     replays completed steps in REVERSE order (the plan's reverse-order rollback policy).
//   Rule 14 real-or-empty — with nothing pending the banner is the EMPTY STRING, never a reassuring
//     "all clear" we did not verify. Counts are counts of real journals, nothing else.
//
// $0: local journals + pure logic, no new dependency, no network.
import { isBlockedPath, redactPrivate, R11_SURFACE } from "../shared/path-guard.mjs";
import { fromJsonl, verifyChain, replayState, resumeDecision } from "../shared/plan-journal.mjs";

export const BOOT_RECOVERY_VERSION = "plan-boot-recovery-v1";

// The complete action vocabulary a boot sweep can emit. Mutually exclusive, one per run.
export const BOOT_ACTIONS = Object.freeze([
  "blocked",           // R11 — off-limits source; never read, never acted on.
  "rollback-escalate", // unsafe/unknown state — undo in reverse order, then hand to a human.
  "resume-offer",      // safe boundary, but the user must click (Confirmed/Manual mode).
  "resume-unattended", // safe boundary + Autonomous mode — still supervisor + countdown gated.
  "none"               // settled: terminal, never approved, empty, or a dry-run rehearsal.
]);

// Actions that represent outstanding work the registrar must stay armed for.
const PENDING_ACTIONS = new Set(["rollback-escalate", "resume-offer", "resume-unattended"]);
// Rollbacks run before resumes: undo unsafe state before making any new progress.
const ACTION_ORDER = { "rollback-escalate": 0, "resume-offer": 1, "resume-unattended": 1, blocked: 2, none: 3 };

/** Autonomous is the only mode that may resume without a user click (still supervisor + countdown gated). */
export const AUTONOMOUS_MODE = "autonomous";

/** Shape every decision identically so a caller can never read an undefined field. Frozen. */
function frameDecision(run, d) {
  return Object.freeze({
    v: BOOT_RECOVERY_VERSION,
    planRunId: redactPrivate(String(run.planRunId || "")),
    planId: redactPrivate(String(run.planId || "")),
    action: d.action,
    reason: String(d.reason || ""),
    stepIndex: d.stepIndex == null ? null : Number(d.stepIndex),
    nextStepIndex: d.nextStepIndex == null ? null : Number(d.nextStepIndex),
    completedSteps: Object.freeze(Array.isArray(d.completedSteps) ? d.completedSteps.slice() : []),
    rollbackOrder: Object.freeze(Array.isArray(d.rollbackOrder) ? d.rollbackOrder.slice() : []),
    escalate: d.escalate === true,
    needsSupervisorReapproval: d.needsSupervisorReapproval === true,
    needsCountdown: d.needsCountdown === true,
    surface: String(d.surface || ""),
    chainOk: d.chainOk === undefined ? null : d.chainOk
  });
}

/** True if any journal entry marks this run as a dry-run rehearsal. Pure, defensive. */
export function isDryRunJournal(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return list.some((e) => {
    if (!e || typeof e !== "object") return false;
    if (e.dryRun === true) return true;
    const x = e.extra;
    return !!(x && typeof x === "object" && (x.dryRun === true || x.dry_run === true));
  });
}

/** Reverse-order rollback list for an interrupted run: completed steps undone last-first. */
export function rollbackOrderFor(entries) {
  const state = replayState(entries);
  const done = Array.isArray(state.completedSteps) ? state.completedSteps.slice() : [];
  return done.sort((a, b) => a - b).reverse();
}

/**
 * Decide what to do with ONE plan-run journal at boot.
 *
 * `run` = { planRunId, planId, source, entries? , text? } — `source` is the file path the watchdog found.
 * `read` = injected (source) => jsonl text. Called ONLY for a non-blocked source, and only when the
 * caller did not already supply parsed `entries`/`text`. A throwing or empty reader is treated as an
 * UNREADABLE journal (rollback + escalate) — never as "nothing to do".
 */
export function classifyBootRun(rawRun = {}, rawCtx = {}) {
  const run = rawRun && typeof rawRun === "object" ? rawRun : {};
  const ctx = rawCtx && typeof rawCtx === "object" ? rawCtx : {};
  const { isKilled = false, mode = "", read = null } = ctx;
  const source = String(run.source || "");

  // R11: check #1 — before any read, before anything else.
  if (isBlockedPath(source) || isBlockedPath(String(run.planRunId || "")) || isBlockedPath(String(run.planId || ""))) {
    return frameDecision(run, { action: "blocked", reason: "r11-blocked", surface: R11_SURFACE });
  }

  // Obtain entries without ever doing I/O ourselves.
  let entries = null;
  let unreadable = false;
  if (Array.isArray(run.entries)) {
    entries = run.entries;
  } else {
    let text = typeof run.text === "string" ? run.text : null;
    if (text == null && typeof read === "function") {
      try { text = read(source); } catch { text = null; }
    }
    if (typeof text !== "string" || text.trim() === "") unreadable = true;
    else entries = fromJsonl(text);
  }

  if (unreadable) {
    // A journal file exists, so a plan run started — but we cannot prove its state. The one safe reading
    // of "unknown" is "possibly half-applied": undo and tell a human. Never resume blind.
    return frameDecision(run, { action: "rollback-escalate", reason: "journal-unreadable", escalate: true });
  }

  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return frameDecision(run, { action: "none", reason: "empty-journal" });

  // A line that is not a well-formed entry object (or that fromJsonl flagged) means the journal cannot be
  // replayed. Corrupt reads exactly like unreadable: unknown state -> undo what we can prove, then escalate.
  const malformed = list.some((e) => !e || typeof e !== "object" || Array.isArray(e) || e.corrupt === true);
  if (malformed) {
    const replayable = list.filter((e) => e && typeof e === "object" && !Array.isArray(e) && e.corrupt !== true);
    return frameDecision(run, {
      action: "rollback-escalate", reason: "journal-corrupt",
      rollbackOrder: rollbackOrderFor(replayable), escalate: true
    });
  }

  // A rehearsal changed nothing on the machine: it can neither claim success nor need a rollback.
  if (isDryRunJournal(list)) return frameDecision(run, { action: "none", reason: "dry-run-rehearsal" });

  const state = replayState(list);
  const decision = resumeDecision(list);

  if (decision.action === "none") return frameDecision(run, { action: "none", reason: decision.reason });

  if (decision.action === "rollback-escalate") {
    return frameDecision(run, {
      action: "rollback-escalate",
      reason: decision.reason,
      stepIndex: decision.stepIndex == null ? null : decision.stepIndex,
      rollbackOrder: rollbackOrderFor(list),
      escalate: true,
      chainOk: verifyChain(list).ok
    });
  }

  // decision.action === "resume" — a genuinely safe step boundary.
  // Kill-switch supremacy: a kill is an abort + rollback, never a pause. Nothing resumes after one.
  if (isKilled) {
    return frameDecision(run, {
      action: "rollback-escalate", reason: "kill-switch-engaged",
      rollbackOrder: rollbackOrderFor(list), escalate: true
    });
  }

  const unattended = String(mode || "").toLowerCase() === AUTONOMOUS_MODE;
  return frameDecision(run, {
    action: unattended ? "resume-unattended" : "resume-offer",
    reason: decision.reason,
    nextStepIndex: Number(decision.nextStepIndex) || 0,
    completedSteps: state.completedSteps,
    // A resume can NEVER skip the control plane. Both flags hold for BOTH resume actions.
    needsSupervisorReapproval: true,
    needsCountdown: true
  });
}

/** Stable ordering: rollbacks first (safety before progress), then resumes, then inert entries. */
export function orderBootActions(decisions = []) {
  return (Array.isArray(decisions) ? decisions : [])
    .map((d, i) => ({ d, i }))
    .sort((a, b) => ((ACTION_ORDER[a.d.action] ?? 9) - (ACTION_ORDER[b.d.action] ?? 9)) || (a.i - b.i))
    .map((x) => x.d);
}

/**
 * Honest boot banner. Real-or-empty: with nothing pending it is the EMPTY STRING — we never print a
 * reassuring "all clear" we did not verify. Content-blind: no plan id, no run id, no path, ever.
 * It states what ARIA FOUND and what it will ASK — never that anything was fixed.
 */
export function bootBannerLine(summary = {}) {
  const rollbacks = Number(summary.rollbacks) || 0;
  const offers = Number(summary.resumeOffers) || 0;
  const unattended = Number(summary.resumeUnattended) || 0;
  if (rollbacks + offers + unattended === 0) return "";
  const parts = [];
  if (rollbacks) parts.push(`${rollbacks} unfinished repair${rollbacks === 1 ? "" : "s"} to undo and report`);
  if (offers) parts.push(`${offers} safe to continue with your OK`);
  if (unattended) parts.push(`${unattended} safe to continue automatically`);
  return `ARIA found ${parts.join(" · ")} from before the restart. Nothing has been changed yet.`;
}

/** The registrar only stays armed while real work is outstanding. */
export function shouldRearmRegistrar(summary = {}) {
  return (Number(summary.pending) || 0) > 0;
}

/**
 * Sweep every plan-run journal found at boot into one ordered, honest recovery batch.
 * Pure: `read` is injected and nothing here touches the disk, the network, or a process.
 */
export function sweepBootRecovery(rawArgs = {}) {
  const { runs = [], isKilled = false, mode = "", read = null } = (rawArgs && typeof rawArgs === "object") ? rawArgs : {};
  const list = Array.isArray(runs) ? runs : [];
  const ordered = orderBootActions(list.map((r) => classifyBootRun(r, { isKilled, mode, read })));

  const count = (a) => ordered.filter((d) => d.action === a).length;
  const summary = {
    v: BOOT_RECOVERY_VERSION,
    total: ordered.length,
    blocked: count("blocked"),
    rollbacks: count("rollback-escalate"),
    resumeOffers: count("resume-offer"),
    resumeUnattended: count("resume-unattended"),
    settled: count("none"),
    killSwitchEngaged: isKilled === true
  };
  summary.pending = ordered.filter((d) => PENDING_ACTIONS.has(d.action)).length;
  summary.escalations = ordered.filter((d) => d.escalate).length;
  // The R11 surface shows only when something was actually excluded (real-or-empty).
  summary.r11Surface = summary.blocked > 0 ? R11_SURFACE : "";
  summary.banner = bootBannerLine(summary);
  summary.shouldRearm = shouldRearmRegistrar(summary);

  return Object.freeze({ ...summary, actions: Object.freeze(ordered) });
}

export default {
  BOOT_RECOVERY_VERSION, BOOT_ACTIONS, AUTONOMOUS_MODE,
  isDryRunJournal, rollbackOrderFor, classifyBootRun, orderBootActions,
  bootBannerLine, shouldRearmRegistrar, sweepBootRecovery
};
