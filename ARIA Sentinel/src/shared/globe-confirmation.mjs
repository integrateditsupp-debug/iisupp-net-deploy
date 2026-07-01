// globe-confirmation - RUN-B B5: the "issue resolved | email sent | ticket reference" message shown
// directly under the floating globe (and its web-ARIA equivalent) the moment ARIA REALLY resolves an issue.
// PURE + node-safe (no DOM, no Electron, no I/O). Ahmad requested this and wants to SEE it.
//
// Rule 14 (honesty IS the moat) - everything real, nothing faked:
//   1. The message renders ONLY after a real resolve that ACTUALLY completed and verified (a recipe/fix
//      applied + verified, or a gated Confirmed/Autonomous fix that succeeded). Never on failure, never
//      pre-emptively (buildGlobeConfirmation returns {show:false} unless completed===true && verified===true).
//   2. It NEVER claims an email was sent unless a real send actually returned success. If the send failed or
//      was not attempted, the copy says so honestly ("Email pending." / no email claim) - never a false "sent".
//   3. The ticket reference is a REAL ServiceNow number when connected, else a deterministic, RECORDED
//      IIS-YYYYMMDD-#### drawn from a real per-day counter - never a fake random number with no record.
//   4. R11: any free text (issue title, recipient) is path-scrubbed before it is shown or persisted.

export const GLOBE_CONFIRM_SCHEMA = "globe-confirmation.v1";
export const CONFIRM_DISMISS_MS = 9000;        // auto-dismiss ~8-10s (spec), or on click
export const TICKET_PREFIX = "IIS";
export const MAX_ISSUE_LEN = 80;

// R11 - strip anything path-like out of a free-text field before it is shown or persisted.
// (mirrors resolution-outcome.scrubField; kept local so this module has zero deps.)
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

// A short, human issue title. Real-or-empty: empty / whitespace / path-only => "" (no confirmation shown).
export function normalizeIssue(title) {
  const s = scrubField(title).replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > MAX_ISSUE_LEN ? s.slice(0, MAX_ISSUE_LEN - 3).trimEnd() + "..." : s;
}

// YYYYMMDD from a timestamp (UTC-stable so the reference is reproducible + verifiable in the audit log).
export function refDatePart(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
}

// Zero-pad the daily sequence to 4 digits. The sequence must be a REAL, recorded counter (main persists it).
export function padSeq(seq) {
  const n = Math.max(1, Math.floor(Number(seq) || 0));
  return String(n).padStart(4, "0");
}

// Compute the next daily ticket sequence from persisted state (resets each UTC day). Pure + testable so the
// #### in IIS-YYYYMMDD-#### is a genuine monotonic count, never random.
export function nextTicketSeq(state = {}, now = Date.now()) {
  const day = refDatePart(now);
  const sameDay = state && state.day === day;
  const seq = (sameDay ? Math.max(0, Math.floor(Number(state.seq) || 0)) : 0) + 1;
  return { day, seq };
}

// A ServiceNow incident number looks like INC0012345 (2-6 letters + 5+ digits).
export function isServiceNowNumber(value) {
  return /^[A-Z]{2,6}\d{5,}$/i.test(String(value == null ? "" : value).replace(/\s+/g, ""));
}

// Mint a REAL ticket reference. Preference: a real ServiceNow number (verbatim) else a deterministic local
// IIS-YYYYMMDD-#### from a recorded per-day sequence. Returns { ref, source, record } - `record` is what the
// caller MUST append to the tamper-evident audit log so a local ref is never "random with no record".
export function mintTicketRef({ serviceNowNumber = "", now = Date.now(), seq } = {}) {
  const sn = scrubField(serviceNowNumber).replace(/\s+/g, "");
  if (isServiceNowNumber(sn)) {
    const ref = sn.toUpperCase();
    return { ref, source: "servicenow",
      record: { schema: GLOBE_CONFIRM_SCHEMA, kind: "ticket-ref", ref, source: "servicenow", ts: new Date(now).toISOString() } };
  }
  const ref = `${TICKET_PREFIX}-${refDatePart(now)}-${padSeq(seq)}`;
  return { ref, source: "local",
    record: { schema: GLOBE_CONFIRM_SCHEMA, kind: "ticket-ref", ref, source: "local", ts: new Date(now).toISOString() } };
}

// The exact under-globe sentence. Kept as ONE function so desktop + web are byte-identical (parity-locked in
// the test). Grammar is correct "has been sent" (Ahmad's note said "send"; shipped correct).
export function confirmationText({ issue, ticketRef, emailState }) {
  const head = `${issue} issue has been resolved.`;
  if (emailState === "sent") return `${head} Email has been sent with ticket reference ${ticketRef}.`;
  if (emailState === "pending") return `${head} Email pending. Ticket reference ${ticketRef}.`;
  return `${head} Ticket reference ${ticketRef}.`;
}

// Derive the honest email state from a real send result. sent===true ONLY when a real send returned success.
export function emailStateOf(email = {}) {
  if (email && email.sent === true) return "sent";
  if (email && email.attempted === true) return "pending";   // attempted but not confirmed sent
  return "none";                                              // not attempted (e.g. no recipient) - claim nothing
}

// Core decision (desktop). resolve = {
//   completed:bool, verified:bool,               // a real fix APPLIED and VERIFIED (or gated confirmed success)
//   issueTitle|issue:string,
//   serviceNowNumber?:string, ticketRef?:string, // a real SN number, or a pre-minted real ref
//   email?: { attempted:bool, sent:bool, to?:string }
// }
// opts = { now, seq, source:'desktop'|'web' }
export function buildGlobeConfirmation(resolve = {}, opts = {}) {
  const now = Number(opts.now) || Date.now();

  // Rule 14 gate #1 - ONLY on a real completed + verified resolve. Anything else shows nothing.
  if (resolve.completed !== true || resolve.verified !== true) {
    return { show: false, reason: "not-resolved" };
  }
  const issue = normalizeIssue(resolve.issueTitle != null ? resolve.issueTitle : resolve.issue);
  if (!issue) return { show: false, reason: "no-issue" };

  // Ticket reference: a caller-supplied real ref wins; else mint (SN number or logged local counter).
  let ref = scrubField(resolve.ticketRef || "").replace(/\s+/g, "");
  let source = "provided";
  let record = null;
  if (!ref) {
    const sn = scrubField(resolve.serviceNowNumber || "").replace(/\s+/g, "");
    // Web has no local tamper-evident log to record a minted ref into, so it must receive a REAL reference
    // from the server/session (a ServiceNow number counts). Real-or-empty: no real ref => show nothing.
    if (!isServiceNowNumber(sn) && opts.mintIfMissing === false) return { show: false, reason: "no-ticket" };
    const minted = mintTicketRef({ serviceNowNumber: resolve.serviceNowNumber, now, seq: opts.seq });
    ref = minted.ref; source = minted.source; record = minted.record;
  } else if (isServiceNowNumber(ref)) {
    ref = ref.toUpperCase(); source = "servicenow";
  }

  const emailState = emailStateOf(resolve.email);
  const email = resolve.email || {};
  const text = confirmationText({ issue, ticketRef: ref, emailState });
  return {
    show: true,
    schema: GLOBE_CONFIRM_SCHEMA,
    ts: new Date(now).toISOString(),
    source: opts.source === "web" ? "web" : "desktop",
    issue,
    ticketRef: ref,
    ticketSource: source,
    email: { sent: emailState === "sent", pending: emailState === "pending", to: email.to ? scrubField(email.to) : null },
    text,
    ariaText: text,             // for the aria-live status region under the globe
    dismissMs: CONFIRM_DISMISS_MS,
    record                      // ticket-ref audit record to persist (null when the ref was provided/already logged)
  };
}

// Web-ARIA equivalent: web ARIA never runs local FIXES - it confirms a real KB resolution + email. Same
// sentence, same gates. Requires resolve.kbResolved === true (a real KB answer the user confirmed fixed it).
export function buildWebConfirmation(resolve = {}, opts = {}) {
  const norm = { ...resolve, completed: resolve.kbResolved === true, verified: resolve.kbResolved === true };
  return buildGlobeConfirmation(norm, { ...opts, source: "web", mintIfMissing: false });
}
