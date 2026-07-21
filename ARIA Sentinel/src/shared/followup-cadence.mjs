// RUN-G G2 — FOLLOW-UP CADENCE THAT NEVER SENDS ITSELF (pure, local-only, Rule 14 real-or-empty).
// Per-qualified-lead state machine driven ONLY by real recorded dates:
//   touch-due · awaiting-reply · gone-quiet · closed
// Each DUE step emits ONE staged draft using the Ahmad-locked template BYTE-VERBATIM ([Name] only).
//
// Honesty + safety invariants (Rule 14 / Rule 12):
//   - `sent` is STRUCTURALLY always false. This module has no transport: no network, no spawn, no
//     filesystem reach (static-scan locked in the test). It cannot email, call, or post - ever.
//   - the body is NEVER improvised. It is `personalizeOutreach(name)` from revenue-board.mjs, which
//     returns null without a real name - so we never address a real inbox as "Hello [Name],".
//   - CONSENT GATE: no inbound consent and no prior real touch => NO draft is produced at all. The
//     first contact is Ahmad's click, not an agent's.
//   - GONE-QUIET OUTRANKS MONEY (same rule as F2): a silent thread gets a softer RE-ENGAGE step, never
//     a harder pitch, regardless of seats/deal size. Pressure is never the automated default.
//   - state advances ONLY on real, parseable dates. A missing lastTouchAt means "never touched", which
//     is stated - never backfilled, never assumed.
//   - real-or-empty: zero cadence-eligible leads => an honestly EMPTY board.
//   - Rule 15 additive: revenue-board / conversion-digest / pilot-console / demand-intake untouched.

import { personalizeOutreach, TEMPLATE_SOURCE, OUTREACH_TEMPLATE } from "./revenue-board.mjs";

export const FOLLOWUP_CADENCE_SCHEMA = "followup-cadence.v1";

export const CADENCE_STATES = ["touch-due", "awaiting-reply", "gone-quiet", "closed"];

/** Real, boring, explainable intervals. Days between our touches while a thread is alive. */
export const TOUCH_INTERVAL_DAYS = 4;      // our move is due 4d after the last touch
export const AWAITING_REPLY_DAYS = 4;      // inside 4d of our touch we are simply waiting
export const GONE_QUIET_DAYS = 14;         // 14d of silence after our touch = gone quiet
export const MAX_TOUCHES = 4;              // after 4 real touches with no reply, we stop. No pestering.

export const CADENCE_EMPTY =
  "0 leads in cadence - honestly empty. Cadence only runs on real qualified leads with real recorded dates. No thread is invented, and no draft exists without a real name and real consent.";

export const CONSENT_BLOCKED =
  "No inbound consent and no prior real touch on record - first contact is YOUR one-click, not an agent's. No draft produced.";

export const NEVER_SENDS =
  "This board drafts only. `sent` is always false and this module has no transport - sending is 100% your click.";

const DAY = 24 * 60 * 60 * 1000;

// -- 1. Real touch history only ---------------------------------------------------------------------
// A touch counts only with a parseable date and a direction we recorded ourselves.
export function realTouches(lead = {}) {
  const list = Array.isArray(lead.touches) ? lead.touches : [];
  return list
    .filter((t) => t && typeof t === "object" && t.at && !Number.isNaN(Date.parse(t.at)) &&
      (t.direction === "out" || t.direction === "in"))
    .map((t) => ({ at: t.at, direction: t.direction, note: typeof t.note === "string" ? t.note : "" }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function lastTouch(lead = {}, direction = null) {
  const t = realTouches(lead).filter((x) => !direction || x.direction === direction);
  return t.length ? t[t.length - 1] : null;
}

// -- 2. Consent gate --------------------------------------------------------------------------------
// Either they came to us (inbound consent), or a real prior touch already exists (a live thread).
export function consentOk(lead = {}) {
  if (lead.inboundConsent === true) return true;
  return realTouches(lead).length > 0;
}

// -- 3. State machine — real dates only --------------------------------------------------------------
export function cadenceState(lead = {}, now = Date.now()) {
  if (lead.closed === true || (typeof lead.closedReason === "string" && lead.closedReason.trim())) {
    return { state: "closed", why: `closed: ${String(lead.closedReason || "marked closed").trim()}` };
  }
  const touches = realTouches(lead);
  const out = touches.filter((t) => t.direction === "out");
  const lastIn = lastTouch(lead, "in");
  const lastOut = out.length ? out[out.length - 1] : null;

  if (!touches.length) {
    return { state: "touch-due", why: "never touched - no real touch on record (not backfilled)" };
  }
  // They replied AFTER our last outbound => our move is due, thread is warm.
  if (lastIn && (!lastOut || Date.parse(lastIn.at) > Date.parse(lastOut.at))) {
    return { state: "touch-due", why: `they replied ${lastIn.at} - our move` };
  }
  if (out.length >= MAX_TOUCHES) {
    return { state: "closed", why: `${out.length} real touches with no reply - stop, do not pester (cap ${MAX_TOUCHES})` };
  }
  const sinceOut = lastOut ? Math.floor((now - Date.parse(lastOut.at)) / DAY) : null;
  if (sinceOut === null) return { state: "touch-due", why: "no outbound recorded yet" };
  if (sinceOut >= GONE_QUIET_DAYS) {
    return { state: "gone-quiet", why: `${sinceOut}d of silence since our ${lastOut.at} touch` };
  }
  if (sinceOut >= TOUCH_INTERVAL_DAYS) {
    return { state: "touch-due", why: `${sinceOut}d since our last touch (interval ${TOUCH_INTERVAL_DAYS}d)` };
  }
  return { state: "awaiting-reply", why: `only ${sinceOut}d since our touch - waiting, not chasing (window ${AWAITING_REPLY_DAYS}d)` };
}

// -- 4. Draft — Ahmad-locked template, byte-verbatim, [Name] only ------------------------------------
// GONE-QUIET OUTRANKS MONEY: a silent thread gets a soft re-engage FRAMING; the body itself is the
// same locked template (we never write new sales copy), and the framing is a note to Ahmad, not text
// smuggled into the email.
export function cadenceDraft(lead = {}, state = "touch-due") {
  if (state === "closed" || state === "awaiting-reply") {
    return { draft: null, reason: state === "closed" ? "closed - no draft" : "inside the wait window - no draft, no chasing" };
  }
  if (!consentOk(lead)) return { draft: null, reason: CONSENT_BLOCKED };
  const body = personalizeOutreach(lead.name);
  if (!body) return { draft: null, reason: "no real contact name on record - no draft (never 'Hello [Name],' to a real inbox)" };
  const to = typeof lead.email === "string" && lead.email.includes("@") ? lead.email : null;
  if (!to) return { draft: null, reason: "no real email on record - no draft" };
  return {
    draft: {
      to,
      body,                                  // byte-verbatim locked template, [Name] substituted only
      templateSource: TEMPLATE_SOURCE,
      framing: state === "gone-quiet"
        ? "GONE QUIET - re-engage gently. Do NOT escalate the ask; silence is not an invitation to push harder."
        : "Warm thread - our move is due.",
      sent: false,                           // structurally always false
      staged: true,
      executed: false,
      kind: "ahmad-one-click",
    },
    reason: null,
  };
}

// -- 5. Build the cadence board ----------------------------------------------------------------------
export function buildFollowupCadence(input, { now = Date.now() } = {}) {
  const list = Array.isArray(input) ? input : Array.isArray(input && input.leads) ? input.leads : [];
  const rows = [];
  const excluded = [];

  for (const lead of list) {
    if (!lead || typeof lead !== "object" || !lead.id) {
      excluded.push({ id: (lead && lead.id) || "(missing id)", reason: "malformed lead - no id" });
      continue;
    }
    if (lead.qualified !== true) {
      excluded.push({ id: lead.id, reason: "not qualified by intake (G1) - cadence never runs on an unqualified lead" });
      continue;
    }
    const { state, why } = cadenceState(lead, now);
    const { draft, reason } = cadenceDraft(lead, state);
    const touches = realTouches(lead);
    const out = touches.filter((t) => t.direction === "out");
    rows.push({
      id: lead.id,
      state,
      why,
      touchesOut: out.length,
      touchesIn: touches.length - out.length,
      lastTouchAt: touches.length ? touches[touches.length - 1].at : null,
      draft,
      draftBlockedReason: reason,
      sent: false,
      action: draft
        ? { kind: "ahmad-one-click", staged: true, executed: false, id: "cadence-send-draft",
            label: state === "gone-quiet"
              ? "Review + send the RE-ENGAGE draft (same locked template, softer intent) - your click"
              : "Review + send the due follow-up draft (locked template) - your click" }
        : { kind: "ahmad-one-click", staged: true, executed: false, id: "cadence-no-draft",
            label: `No draft: ${reason}` },
    });
  }

  // Deterministic priority: touch-due first (our move), then gone-quiet, then awaiting, then closed.
  const order = { "touch-due": 0, "gone-quiet": 1, "awaiting-reply": 2, closed: 3 };
  rows.sort((a, b) =>
    (order[a.state] - order[b.state]) ||
    (Date.parse(a.lastTouchAt || 0) - Date.parse(b.lastTouchAt || 0)) ||
    String(a.id).localeCompare(String(b.id))
  );

  const counts = CADENCE_STATES.reduce((acc, s) => (acc[s] = rows.filter((r) => r.state === s).length, acc), {});
  const drafts = rows.filter((r) => r.draft);
  return {
    schema: FOLLOWUP_CADENCE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: true,
    neverSends: NEVER_SENDS,
    templateSource: TEMPLATE_SOURCE,
    total: rows.length,
    counts,
    draftCount: drafts.length,
    empty: rows.length === 0,
    emptyCopy: CADENCE_EMPTY,
    rows,
    excluded,
  };
}

// -- 6. Markdown render (local-only board section) ----------------------------------------------------
export function followupCadenceMarkdown(board) {
  const b = board || buildFollowupCadence([]);
  const L = [];
  L.push("# FOLLOW-UP CADENCE - drafts only, never sends");
  L.push("");
  L.push(`Generated: ${b.generatedAt} · schema ${b.schema}`);
  L.push(`> ${b.neverSends}`);
  L.push(`Template: ${b.templateSource}`);
  L.push("");
  if (b.empty) {
    L.push(`**${b.emptyCopy}**`);
    L.push("");
  } else {
    L.push(`States: touch-due ${b.counts["touch-due"]} · gone-quiet ${b.counts["gone-quiet"]} · awaiting-reply ${b.counts["awaiting-reply"]} · closed ${b.counts.closed} · staged drafts ${b.draftCount}`);
    L.push("");
    L.push("| Lead | State | Why (real dates) | Out/In | Draft | NEXT ONE-CLICK (Ahmad) |");
    L.push("|------|-------|------------------|--------|-------|------------------------|");
    for (const r of b.rows) {
      L.push(`| ${r.id} | ${r.state} | ${r.why} | ${r.touchesOut}/${r.touchesIn} | ${r.draft ? "staged (sent: false)" : "none"} | ${r.action.label} |`);
    }
    L.push("");
  }
  if (b.excluded.length) {
    L.push("## Excluded (honesty log)");
    L.push("");
    for (const x of b.excluded) L.push(`- ${x.id}: ${x.reason}`);
    L.push("");
  }
  L.push("---");
  L.push("Rule 14: every state above is derived from a real recorded touch date; no thread, reply, or send is invented. Gone-quiet gets a gentler step, never a harder pitch. Nothing was sent - `sent` is structurally false and this module has no transport.");
  return L.join("\n") + "\n";
}

export { OUTREACH_TEMPLATE };
