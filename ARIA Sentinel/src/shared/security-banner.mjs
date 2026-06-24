// security-banner — RUN 17. Pure model for the audit-tamper alert banner shown at the top of the
// Settings window. Kept out of renderer.js so it is unit-testable without a DOM. The banner is driven
// purely by state.auditIntegrity (set at session start by verifyAuditIntegrity in main.mjs).

// Dismiss flag lives in sessionStorage (NOT localStorage / electron-store), so a dismiss is per-session
// and the banner re-appears on the next launch while auditIntegrity.ok is still false.
export const SECURITY_BANNER_DISMISS_KEY = "aria-sentinel:audit-tamper-dismissed";

// Visible iff the last integrity check failed AND it has not been dismissed this session.
export function bannerVisible(auditIntegrity, dismissed = false) {
  return Boolean(auditIntegrity && auditIntegrity.ok === false) && !dismissed;
}

// Title + subtitle text for the banner. Pure: derived only from the integrity finding.
export function bannerModel(auditIntegrity = {}) {
  const n = auditIntegrity.brokenAt;
  const where = (typeof n === "number" && n >= 0) ? `entry ${n}` : "an unknown entry";
  const when = auditIntegrity.detectedAt || "recently";
  return {
    title: "Security alert: Audit log tampered.",
    subtitle: `Entries modified or removed at ${where} · detected ${when}`
  };
}
