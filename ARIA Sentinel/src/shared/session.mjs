// ARIA Sentinel — support session lifecycle + content-safe end-of-session report.
// Spec: dev-docs/sentinel-profile-and-session-email-spec.md (B/C).
// A "session" = issue start (Resolve-for-me handoff or a chat) → end (user ends / resolved / escalated / timeout).
// We compile the issue, the transcript, the backend recipe steps, the outcome, and REAL measured SLA metrics.
// HARD RULE 14: metrics come from measured timestamps (never fabricated); an escalation says "escalated",
// never "fixed"; the payload is content-blind for secrets/paths/the R11 private folder.

export const SESSION_OUTCOMES = ["resolved", "escalated", "user_ended", "timeout"];
const SLA_RESOLVE_MS = 2 * 24 * 60 * 60 * 1000;       // resolve target ≤ 2 business days (proxy)
const SLA_RESPOND_MS = 60 * 60 * 1000;                // respond target ≤ 1h

// ── content-blind scrub: strip the R11 private folder + absolute paths + obvious secrets from any free text.
const PRIVATE_FOLDER_RE = /([a-z]:\\)?[^\r\n"<>|]*?private\s+pics\s+and\s+vids[^\r\n"<>|]*/gi;
const WIN_PATH_RE = /[A-Za-z]:\\[^\s"'()<>]+/g;
const FILE_URL_RE = /file:\/\/\/?[^\s"')]+/gi;
const SECRET_RE = /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|AKIA[A-Z0-9]{12,}|eyJ[A-Za-z0-9_-]{20,})\b/g;
export function scrub(text) {
  return String(text == null ? "" : text)
    .replace(PRIVATE_FOLDER_RE, "<private-folder>")
    .replace(FILE_URL_RE, "[path]")
    .replace(WIN_PATH_RE, "[path]")
    .replace(SECRET_RE, "[redacted]")
    .slice(0, 6000);
}

export function createSession({ id, issue, intent, startedAt } = {}) {
  const t = Number(startedAt) || 0;
  return {
    id: String(id || "sess-" + t),
    issue: scrub(issue).slice(0, 500),
    intent: String(intent || "").slice(0, 80),
    startedAt: t,
    firstResponseAt: null,
    endedAt: null,
    outcome: null,
    transcript: [],   // [{ role:'user'|'aria', text, ts }]
    actions: []        // [{ recipeId, step, outcome, ts }] — backend recipe steps
  };
}

export function recordTurn(session, role, text, ts) {
  const r = role === "user" ? "user" : "aria";
  if (r === "aria" && session.firstResponseAt == null) session.firstResponseAt = Number(ts);
  session.transcript.push({ role: r, text: scrub(text).slice(0, 4000), ts: Number(ts) });
  return session;
}

export function recordAction(session, action = {}, ts) {
  session.actions.push({
    recipeId: String(action.recipeId || "").slice(0, 80),
    step: scrub(action.step).slice(0, 200),
    outcome: String(action.outcome || "").slice(0, 40),
    ts: Number(ts)
  });
  return session;
}

// Ends a session. Outcome is clamped to the known set; unknown → user_ended (never silently "resolved").
export function endSession(session, outcome, endedAt) {
  session.outcome = SESSION_OUTCOMES.includes(outcome) ? outcome : "user_ended";
  session.endedAt = Number(endedAt);
  return session;
}

// SLA computed from REAL timestamps. `met` is null unless the session actually resolved (you can't "meet" a
// resolve SLA on an escalation). respondMet uses the first ARIA turn.
export function slaStatus(session) {
  if (!session.endedAt) return null;
  const elapsed = session.endedAt - session.startedAt;
  const respondMs = session.firstResponseAt != null ? session.firstResponseAt - session.startedAt : null;
  return {
    timeToResolveMs: elapsed,
    timeToResolveText: humanDuration(elapsed),
    respondMs,
    respondText: respondMs == null ? null : humanDuration(respondMs),
    target: "Respond ≤ 1h · resolve ≤ 2 business days",
    respondMet: respondMs == null ? null : respondMs <= SLA_RESPOND_MS,
    resolveMet: session.outcome === "resolved" ? elapsed <= SLA_RESOLVE_MS : null
  };
}

function outcomeSummary(session) {
  switch (session.outcome) {
    case "resolved":  return "Resolved on your device — the fix ran through the gated pipeline and verified.";
    case "escalated": return "Escalated to a human technician — NOT resolved automatically. Someone will follow up.";
    case "timeout":   return "Session ended (timeout) — not resolved.";
    default:          return "Session ended by you — not resolved automatically.";
  }
}

// Build the content-safe report. THROWS if the session is not ended — enforces "never send mid-session".
// `resolved` is true ONLY when the outcome is truly "resolved"; escalation is reported as escalated.
export function buildSessionReport(session, profile = {}) {
  if (!session.endedAt) throw new Error("session not ended — never build or send a report mid-session");
  const resolved = session.outcome === "resolved";
  const escalated = session.outcome === "escalated";
  return {
    sessionId: session.id,
    outcome: session.outcome,
    resolved,
    escalated,
    issue: session.issue,
    summary: outcomeSummary(session),
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(session.endedAt).toISOString(),
    sla: slaStatus(session),
    transcript: session.transcript.map((t) => ({ role: t.role, text: t.text })),
    actions: session.actions.map((a) => ({ recipeId: a.recipeId, step: a.step, outcome: a.outcome })),
    user: {
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      company: profile.company || "",
      email: profile.email || "",
      phone: profile.phone || ""
    }
  };
}

function humanDuration(ms) {
  ms = Math.max(0, Number(ms) || 0);
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.round(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60), rem = m % 60;
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
