// RUN-C C3 — 5-minute onboarding activation + time-to-first-value (TTFV).
//
// WHY this exists (and what it is NOT): app-config.mjs already has two click-through state machines —
// the 3-step ONBOARDING walkthrough and the 6-step SETUP wizard. Those answer "did the user click
// through the intro?". They do NOT answer the buyer's #1 question: "how fast does a brand-new user
// reach a REAL resolved issue?" This module is that activation/value layer. It models the C3 path
//   started -> mode_picked -> connect_done(skippable) -> first_value(real KB answer OR real safe fix) -> report_viewed
// and makes "time to first resolved issue" a real, measurable number that feeds the RUN-B metrics
// (metrics.mjs mttr/firstTouchResolution). No DOM, no I/O — the main process owns persistence; this
// module owns every decision so the whole mechanic is unit-tested.
//
// 🔒 Rule 14 (honesty IS the moat): TTFV is real-or-empty. No real start + real first-value event ->
//    timeToFirstValueMs() returns null and the label is "—". We NEVER invent a "5 min" countdown, and a
//    recorded value is IDEMPOTENT (the first real timestamp wins — it can't be rewritten to look faster
//    OR slower). A first_value with no valid kind is not a value at all and is refused.
// 🔒 No dead step: nextStep() always returns a real, known next action until the journey is complete;
//    deadStep is false by construction and the suite asserts it at every intermediate state.
// 🔒 R11: the only free-text we touch (deviceId) is path-scrubbed before it can be persisted.
//
// Real surfaces each milestone maps to (no invented features):
//   mode_picked   <- app-config setup mode step (Confirmed is the recommended pick for fastest value;
//                    Manual stays the safe wizard default — we measure the choice, we don't override it).
//   connect_done  <- optional Entra (entra-graph-client.mjs) / ServiceNow (servicenow.mjs) connect, or SKIP.
//   first_value   <- one real KB answer (aria-local-kb.mjs / symptom-kb.mjs) OR one real safe fix
//                    (recipe-runner.mjs / recommend-action.mjs). This is "first resolved issue".
//   report_viewed <- the session report (main/report-generator.mjs, renderer tabs/reports.mjs).

export const ONBOARDING_SCHEMA = "onboarding.v1";

// Ordered onboarding path. connect_done is skippable but still a real, accounted-for step (skip records it).
export const ONBOARDING_MILESTONES = ["started", "mode_picked", "connect_done", "first_value", "report_viewed"];

// The buyer criterion: first real value within 5 minutes. Used as the TTFV target, never as a fake countdown.
export const ONBOARDING_TARGET_MS = 5 * 60 * 1000;

// A "first value" is only real if it is one of these kinds. Anything else is not value and is refused.
export const FIRST_VALUE_KINDS = ["kb_answer", "safe_fix"];

// The user-facing next action for each completed milestone (drives a no-dead-step UI). The value for
// "report_viewed" is null == journey complete (the only legitimate null next step).
const NEXT_STEP = {
  none:          { id: "start",         label: "Start your free pilot" },
  started:       { id: "pick_mode",     label: "Pick a mode (Confirmed gets value fastest)" },
  mode_picked:   { id: "connect",       label: "Connect Entra/ServiceNow — or skip for now" },
  connect_done:  { id: "first_value",   label: "Get one real answer or run one safe fix" },
  first_value:   { id: "view_report",   label: "See your session report" },
  report_viewed: null
};

// 🔒 R11 — strip anything that looks like a filesystem path out of free text before persistence.
// (Mirrors pilot-state.scrubField; kept local so this module stays dependency-free.)
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

export function isKnownMilestone(m) {
  return ONBOARDING_MILESTONES.includes(m);
}

function tsToMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const ms = Date.parse(String(v));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Begin a journey with a REAL start timestamp.
 * @returns {{schema:string, started_at:string, milestones:Object<string,string>, value_kind:(string|null), device_id:string}}
 */
export function startJourney({ now = Date.now(), deviceId = "" } = {}) {
  const startedAt = new Date(now).toISOString();
  return {
    schema: ONBOARDING_SCHEMA,
    started_at: startedAt,
    milestones: { started: startedAt },
    value_kind: null,
    device_id: scrubField(deviceId)
  };
}

function cloneJourney(j) {
  const base = (j && typeof j === "object") ? j : {};
  return {
    schema: ONBOARDING_SCHEMA,
    started_at: base.started_at || null,
    milestones: { ...(base.milestones && typeof base.milestones === "object" ? base.milestones : {}) },
    value_kind: base.value_kind != null ? base.value_kind : null,
    device_id: base.device_id || ""
  };
}

/**
 * Record a milestone. IDEMPOTENT and honest:
 *  - unknown milestone -> no-op (returns an unchanged copy).
 *  - first_value requires a kind in FIRST_VALUE_KINDS; otherwise it is NOT value and is refused (no-op).
 *  - a milestone already recorded keeps its FIRST real timestamp (cannot be gamed faster or slower).
 *  - if there is no journey/start yet, only "started" can be recorded (others have nothing to anchor to).
 * @returns {object} new journey
 */
export function recordMilestone(journey, milestone, { now = Date.now(), kind = null } = {}) {
  const j = cloneJourney(journey);
  if (!isKnownMilestone(milestone)) return j;

  if (milestone === "started") {
    if (!j.started_at) {
      const startedAt = new Date(now).toISOString();
      j.started_at = startedAt;
      j.milestones.started = startedAt;
    }
    return j;
  }

  // Every non-start milestone needs a real start to anchor against.
  if (!j.started_at) return j;

  if (milestone === "first_value") {
    if (!FIRST_VALUE_KINDS.includes(kind)) return j;        // not a real value -> refuse
    if (j.milestones.first_value) return j;                  // idempotent: keep the first real value
    j.milestones.first_value = new Date(now).toISOString();
    j.value_kind = kind;
    return j;
  }

  if (j.milestones[milestone]) return j;                     // idempotent for the rest too
  j.milestones[milestone] = new Date(now).toISOString();
  return j;
}

/** ISO of the first real value, or null. */
export function firstValueAt(journey) {
  const m = journey && journey.milestones;
  return (m && m.first_value) ? m.first_value : null;
}

/**
 * Real time-to-first-value in ms (first_value - started), or null if either is missing.
 * Corrupt order (value before start) -> null, never a negative or invented number. Rule 14.
 */
export function timeToFirstValueMs(journey) {
  if (!journey || !journey.milestones) return null;
  const start = tsToMs(journey.started_at || journey.milestones.started);
  const value = tsToMs(journey.milestones.first_value);
  if (start == null || value == null) return null;
  const delta = value - start;
  return delta >= 0 ? delta : null;
}

/** Human duration: "—" for null, "<1s", "42s", "3m 42s". Never fabricates. */
export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return "<1s";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** The highest contiguous milestone reached, for next-step routing. */
function reachedStage(journey) {
  const m = (journey && journey.milestones) || {};
  let stage = "none";
  for (const ms of ONBOARDING_MILESTONES) {
    if (m[ms]) stage = ms; else break;
  }
  return stage;
}

/** The next real action (or null only when the journey is complete). No dead step. */
export function nextStep(journey) {
  return NEXT_STEP[reachedStage(journey)] || null;
}

/**
 * Full activation status.
 * - reachedValue: a real first value was recorded (the "first resolved issue" — the RUN-B activation KPI).
 * - activated: same as reachedValue (reaching real value == activated). completed: saw the session report too.
 * - withinTarget: reachedValue AND ttfvMs <= targetMs. An over-target activation is still activated — we
 *   measure slow, we never hide it.
 * - deadStep: always false (nextStep is defined until complete); the suite asserts this invariant.
 */
export function activationStatus(journey, { targetMs = ONBOARDING_TARGET_MS, now = Date.now() } = {}) {
  const m = (journey && journey.milestones) || {};
  const started = !!(journey && (journey.started_at || m.started));
  const reachedValue = !!m.first_value;
  const completed = !!m.report_viewed;
  const ttfvMs = timeToFirstValueMs(journey);
  const ns = nextStep(journey);
  return {
    schema: ONBOARDING_SCHEMA,
    started,
    reachedValue,
    activated: reachedValue,
    completed,
    valueKind: (journey && journey.value_kind) || null,
    ttfvMs,
    ttfvLabel: formatDuration(ttfvMs),
    withinTarget: reachedValue && ttfvMs != null && ttfvMs <= targetMs,
    targetMs,
    nextStepId: ns ? ns.id : null,
    nextStepLabel: ns ? ns.label : null,
    deadStep: ns == null && !completed   // a null next step is only legitimate once completed
  };
}

/**
 * Fold REAL existing product signals into a journey, proving this layer is fed by real state (not standalone).
 *  - setupComplete: app-config setup.completed (mode was picked in the wizard).
 *  - connectChoiceMade: user connected Entra/ServiceNow OR explicitly skipped (skippable step satisfied).
 *  - valueEvent: { kind: 'kb_answer'|'safe_fix', at } a REAL KB hit or safe-fix success — or null/none.
 *  - reportViewed: the session report was opened.
 * Timestamps are taken from the events when present so TTFV stays real; absent -> not recorded.
 */
export function deriveJourney(signals = {}, { now = Date.now(), startedAt = null, deviceId = "" } = {}) {
  const startMs = tsToMs(startedAt) != null ? tsToMs(startedAt) : now;
  let j = startJourney({ now: startMs, deviceId });
  if (signals.setupComplete) {
    j = recordMilestone(j, "mode_picked", { now: tsToMs(signals.modePickedAt) ?? startMs });
  }
  if (signals.connectChoiceMade) {
    j = recordMilestone(j, "connect_done", { now: tsToMs(signals.connectAt) ?? startMs });
  }
  const ve = signals.valueEvent;
  if (ve && FIRST_VALUE_KINDS.includes(ve.kind)) {
    j = recordMilestone(j, "first_value", { now: tsToMs(ve.at) ?? now, kind: ve.kind });
  }
  if (signals.reportViewed) {
    j = recordMilestone(j, "report_viewed", { now: tsToMs(signals.reportAt) ?? now });
  }
  return j;
}
