// RUN-I I2 — RENEWAL EARNED, NOT ASSUMED (pure, local-only, Rule 14 real-or-empty).
// Decides renewal readiness for a paying account from REAL post-sale delivery records only. The default
// is never "on track" - an account with thin or silent evidence is reported AT RISK with the reason named.
//
// Honesty invariants (Rule 14):
//   - EVIDENCE OR NOT-ENOUGH-DATA. A verdict exists only where real records with real ids and real
//     parseable timestamps support it. No projected renewal, no assumed roll-over, no "likely".
//   - NO DEFAULT HEALTH. Silence is a churn signal, not an absence of one. An account with no activity
//     inside the window is AT RISK because it went quiet, and the module says so in those words.
//   - NOTHING BOOKED. `bookedRevenueCad` is a constant 0 - a renewal that has not been paid is not money.
//   - Churn signals print as plainly as healthy ones; every verdict cites the record ids behind it.
//   - Rule 15 additive: proof-pack / close-packet / billing-handoff / F+G modules untouched.

export const RENEWAL_SCHEMA = "renewal-readiness.v1";

/** Renewal revenue is never booked here. Structural. */
export const BOOKED_REVENUE_CAD = 0;

/** How much real delivery evidence an account must show before "healthy" is even reachable. */
export const MIN_RESOLVED_FOR_HEALTHY = 3;
/** Beyond this many days with no record at all, the account is treated as gone quiet. */
export const QUIET_DAYS = 30;
/** An escalation rate at or above this is called out, never averaged away. */
export const ESCALATION_RISK_RATIO = 0.25;

export const VERDICTS = ["healthy", "at-risk", "not-enough-data"];

export const NOT_ENOUGH_DATA_NOTE =
  "Not enough real delivery evidence to judge this renewal. Reported as unknown rather than assumed - " +
  "no record was estimated, and no renewal was counted.";

export const NO_ASSUMED_NOTE =
  "No renewal is treated as booked. Renewal revenue reads $" + BOOKED_REVENUE_CAD + " until money actually lands.";

// -- 1. A record counts only if it is fully real -------------------------------------------------------
export function usableRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;
  const stamp = record.resolvedAt || record.endedAt || record.at || null;
  const t = stamp ? Date.parse(stamp) : NaN;
  if (!stamp || Number.isNaN(t)) return null;
  const kind = String(record.kind || record.type || "resolved").trim().toLowerCase();
  return { recordId: id, at: new Date(t).toISOString(), t, kind };
}

export function splitRecords(records) {
  const list = Array.isArray(records) ? records : [];
  const usable = [];
  const excluded = [];
  for (const r of list) {
    const u = usableRecord(r);
    if (!u) {
      excluded.push({
        id: (r && typeof r === "object" && r.id) || "(missing id)",
        reason: "no verifiable record id + timestamp - excluded from the renewal verdict rather than counted",
      });
      continue;
    }
    usable.push(u);
  }
  return { usable, excluded };
}

// -- 2. The verdict ------------------------------------------------------------------------------------
export function assessAccount(account = {}, { now = Date.now() } = {}) {
  const name = typeof account.customer === "string" && account.customer.trim() ? account.customer.trim() : null;
  const base = {
    schema: RENEWAL_SCHEMA,
    customer: name,
    assessedAt: new Date(now).toISOString(),
    bookedRevenueCad: BOOKED_REVENUE_CAD,
    note: NO_ASSUMED_NOTE,
  };
  if (!name) {
    return { ...base, verdict: "not-enough-data", reasons: ["no real account name - nothing is assessed for an unnamed account"], citations: [], excluded: [], signals: null };
  }

  const { usable, excluded } = splitRecords(account.records);
  if (usable.length === 0) {
    return { ...base, verdict: "not-enough-data", reasons: [NOT_ENOUGH_DATA_NOTE], citations: [], excluded, signals: null };
  }

  const resolved = usable.filter((r) => r.kind === "resolved" || r.kind === "fix");
  const escalations = usable.filter((r) => r.kind === "escalation" || r.kind === "escalated");
  const latest = usable.reduce((a, b) => (b.t > a.t ? b : a));
  const daysSince = Math.floor((now - latest.t) / 86400000);
  const escalationRatio = usable.length ? escalations.length / usable.length : 0;

  const signals = {
    recordsUsed: usable.length,
    resolvedCount: resolved.length,
    escalationCount: escalations.length,
    escalationRatio: Math.round(escalationRatio * 100) / 100,
    daysSinceLastRecord: daysSince,
    lastRecordId: latest.recordId,
    lastRecordAt: latest.at,
  };

  const reasons = [];
  if (daysSince >= QUIET_DAYS) {
    reasons.push(
      "Gone quiet: no delivery record in " + daysSince + " days (last was " + latest.recordId + " on " + latest.at +
      "). Silence is reported as a churn signal, not as everything being fine."
    );
  }
  if (escalations.length && escalationRatio >= ESCALATION_RISK_RATIO) {
    reasons.push(
      "Escalation rate " + Math.round(escalationRatio * 100) + "% (" + escalations.length + " of " + usable.length +
      " records). Reported whether it flatters us or not."
    );
  }
  if (resolved.length < MIN_RESOLVED_FOR_HEALTHY) {
    reasons.push(
      "Only " + resolved.length + " verifiable resolved record(s) - fewer than the " + MIN_RESOLVED_FOR_HEALTHY +
      " required before this renewal could be called healthy. Thin delivery is not renewal evidence."
    );
  }

  const verdict = reasons.length ? "at-risk" : "healthy";
  if (!reasons.length) {
    reasons.push(
      resolved.length + " verifiable resolved records, " + escalations.length + " escalation(s), last activity " +
      daysSince + " day(s) ago (" + latest.recordId + "). Healthy because the records say so, not by default."
    );
  }

  return { ...base, verdict, reasons, citations: usable.map((u) => u.recordId), excluded, signals };
}

// -- 3. Portfolio -------------------------------------------------------------------------------------
export function assessRenewals(accounts, { now = Date.now() } = {}) {
  const list = Array.isArray(accounts) ? accounts : [];
  const assessments = list.map((a) => assessAccount(a, { now }));
  const counts = { healthy: 0, "at-risk": 0, "not-enough-data": 0 };
  for (const a of assessments) counts[a.verdict] += 1;
  return {
    schema: RENEWAL_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    accounts: assessments,
    counts,
    assumedRenewals: 0,
    bookedRevenueCad: BOOKED_REVENUE_CAD,
    note: NO_ASSUMED_NOTE,
  };
}

// -- 4. Markdown - risk is on the face of the report ---------------------------------------------------
export function renewalMarkdown(report) {
  if (!report || report.schema !== RENEWAL_SCHEMA) return "No renewal report.";
  const out = [];
  out.push("# Renewal readiness");
  out.push("");
  if (!report.accounts.length) {
    out.push("No paying accounts with real delivery records. Honestly empty - nothing is projected.");
    out.push("");
    out.push("_" + report.note + "_");
    return out.join("\n");
  }
  out.push(
    report.counts.healthy + " healthy / " + report.counts["at-risk"] + " at risk / " +
    report.counts["not-enough-data"] + " not enough data. Assumed renewals: " + report.assumedRenewals + "."
  );
  for (const a of report.accounts) {
    out.push("");
    out.push("## " + (a.customer || "(unnamed account)") + " - " + a.verdict.toUpperCase());
    for (const r of a.reasons) out.push("- " + r);
    if (a.citations.length) out.push("- Records: " + a.citations.join(", "));
    if (a.excluded.length) out.push("- Excluded (not verifiable): " + a.excluded.map((e) => e.id).join(", "));
  }
  out.push("");
  out.push("_" + report.note + "_");
  return out.join("\n");
}
