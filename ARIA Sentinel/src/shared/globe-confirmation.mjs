// Under-globe completion confirmation. Real-or-empty: show only for a verified completed fix.
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
}

function scrub(text) {
  return String(text == null ? "" : text)
    .replace(/[A-Za-z]:\\[^\s"'()<>]+/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"'()<>]+/gi, "[path]")
    .slice(0, 240);
}

export function nextTicketSeq(previous = {}, now = Date.now()) {
  const day = dayKey(now);
  const seq = previous && previous.day === day ? Number(previous.seq || 0) + 1 : 1;
  return { day, seq };
}

export function mintTicketRef({ serviceNowNumber = "", seq = 1, now = Date.now() } = {}) {
  const sn = String(serviceNowNumber || "").trim();
  const ref = sn || `ARIA-${dayKey(now)}-${String(Math.max(1, Number(seq) || 1)).padStart(4, "0")}`;
  const source = sn ? "servicenow" : "local";
  return { ref, source, record: { ref, source, ts: new Date(now).toISOString() } };
}

export function buildGlobeConfirmation({ completed, verified, issueTitle = "", ticketRef = "", email = {} } = {}) {
  if (!(completed === true && verified === true) || !ticketRef) {
    return { show: false, reason: "not-verified" };
  }
  const attempted = Boolean(email.attempted);
  const sent = Boolean(email.sent);
  const emailStatus = sent ? "sent" : attempted ? "pending" : "not-attempted";
  const emailText = sent ? "email sent" : attempted ? "email pending" : "email not sent";
  return {
    show: true,
    text: `Issue resolved | ${emailText} | ticket ${scrub(ticketRef)}`,
    issueTitle: scrub(issueTitle),
    ticketRef: scrub(ticketRef),
    email: { attempted, sent, status: emailStatus, to: email.to ? "[configured]" : null }
  };
}

export const GLOBE_CONFIRMATION_WINDOW_MS = DAY_MS;
