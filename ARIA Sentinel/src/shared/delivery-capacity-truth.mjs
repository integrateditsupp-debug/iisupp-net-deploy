// RUN-J J2 — DELIVERABLE CAPACITY TRUTH (pure, local-only, Rule 14 real-or-empty).
// How much delivery one operator can ACTUALLY carry, measured only from minutes we really observed,
// against what is already committed. If the staged pipeline would push us over, this says so BEFORE
// the deal is closed - over-committing at one-person scale is a churn machine.
//
// Honesty invariants (Rule 14):
//   - OBSERVED MINUTES ONLY. A record with no recorded duration contributes NOTHING and is listed in
//     `excluded`. There is no modelled, estimated, or "typical" fix time anywhere in this module.
//   - CAPACITY IS DECLARED, NOT INVENTED. Weekly operator minutes must be supplied as a real number.
//     Without it the verdict is `not-enough-data` - never an assumed 40-hour week.
//   - EVERY MINUTE IS TRACEABLE. Each account's load cites the record ids it was summed from.
//   - AN ACCOUNT WITHOUT ENOUGH REAL HISTORY IS NOT PROJECTED. It is excluded and named.
//   - Rule 15 additive: proof-pack / renewal-readiness / billing-handoff stay read-only inputs.

export const CAPACITY_SCHEMA = "delivery-capacity-truth.v1";

// An account needs this many usable records before we will state a weekly load for it.
export const MIN_RECORDS_FOR_LOAD = 3;

// Within this fraction of capacity counts as "at capacity" rather than "under".
export const AT_CAPACITY_BAND = 0.95;

export const VERDICTS = ["under", "at", "over", "not-enough-data"];

export const NO_CAPACITY_NOTE =
  "Operator weekly minutes were not recorded, so no capacity verdict is possible. This is not-enough-data, not a safe 'under'.";

export const OBSERVED_ONLY_NOTE =
  "Every minute here was observed on a real record. No fix time is modelled, estimated, or averaged in from anywhere else.";

export const OVER_NOTE =
  "Committed delivery already exceeds observed operator capacity. Closing more work without adding capacity is how delivery slips and accounts churn.";

function str(v) { return typeof v === "string" && v.trim() ? v.trim() : null; }

// -- 1. Only a record with real observed minutes counts -----------------------------------------------
export function usableMinutes(record = {}) {
  if (!record || typeof record !== "object") return null;
  const id = str(record.id);
  if (!id) return null;
  const t = record.at ? Date.parse(record.at) : NaN;
  if (Number.isNaN(t)) return null;
  const m = Number(record.durationMinutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  return { id, at: new Date(t).toISOString(), minutes: Math.round(m) };
}

// -- 2. One account's observed weekly load ------------------------------------------------------------
export function accountLoad(account = {}, { now = Date.now() } = {}) {
  const customer = str(account && account.customer);
  if (!customer) return null;
  const raw = Array.isArray(account && account.records) ? account.records : [];
  const usable = [];
  const excluded = [];
  for (const r of raw) {
    const u = usableMinutes(r);
    if (u) usable.push(u);
    else excluded.push({ id: str(r && r.id) || "(no id)", why: "no recorded duration - contributes nothing" });
  }

  if (usable.length < MIN_RECORDS_FOR_LOAD) {
    return {
      customer, known: false, weeklyMinutes: null, recordIds: usable.map((u) => u.id), excluded,
      why: "only " + usable.length + " usable record" + (usable.length === 1 ? "" : "s") +
        " - " + MIN_RECORDS_FOR_LOAD + " are needed before a weekly load is stated",
    };
  }

  const times = usable.map((u) => Date.parse(u.at)).sort((a, b) => a - b);
  const spanMs = Math.max(times[times.length - 1] - times[0], 0);
  // The observed window is the real span between the first and last record, floored at one week so a
  // burst of same-day work is never inflated into an impossible weekly rate.
  const weeks = Math.max(spanMs / (7 * 86400000), 1);
  const total = usable.reduce((s, u) => s + u.minutes, 0);

  return {
    customer, known: true,
    weeklyMinutes: Math.round(total / weeks),
    totalMinutes: total,
    observedWeeks: Math.round(weeks * 100) / 100,
    recordIds: usable.map((u) => u.id),
    excluded,
    firstAt: new Date(times[0]).toISOString(),
    lastAt: new Date(times[times.length - 1]).toISOString(),
  };
}

// -- 3. The capacity picture ---------------------------------------------------------------------------
export function buildCapacityTruth(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};

  const loads = (Array.isArray(src.accounts) ? src.accounts : []).map((a) => accountLoad(a, { now })).filter(Boolean);
  const counted = loads.filter((l) => l.known);
  const excludedAccounts = loads.filter((l) => !l.known).map((l) => ({ customer: l.customer, why: l.why }));
  const excludedRecords = [];
  for (const l of loads) for (const e of l.excluded) excludedRecords.push({ customer: l.customer, ...e });

  const committedMinutes = counted.reduce((s, l) => s + l.weeklyMinutes, 0);

  const declared = Number(src.operatorWeeklyMinutes);
  const capacityMinutes = Number.isFinite(declared) && declared > 0 ? Math.round(declared) : null;

  // Staged pipeline only adds load when THAT customer has real observed history to add.
  const staged = [];
  for (const h of Array.isArray(src.handoffs) ? src.handoffs : []) {
    if (!h || h.schema !== "billing-handoff.v1" || h.produced !== true) continue;
    const customer = str(h.customer);
    if (!customer) continue;
    const load = counted.find((l) => l.customer === customer);
    if (load) staged.push({ customer, weeklyMinutes: load.weeklyMinutes, basis: load.recordIds.slice() });
    else excludedAccounts.push({ customer, why: "staged for close with no observed delivery history - its future load is unknown, not estimated" });
  }
  const stagedMinutes = staged.reduce((s, e) => s + e.weeklyMinutes, 0);
  // A staged customer that is already being delivered to is already inside committedMinutes.
  const projectedMinutes = committedMinutes;

  let verdict = "not-enough-data";
  let headline = NO_CAPACITY_NOTE;
  if (capacityMinutes !== null && counted.length > 0) {
    const ratio = committedMinutes / capacityMinutes;
    if (ratio > 1) { verdict = "over"; headline = OVER_NOTE; }
    else if (ratio >= AT_CAPACITY_BAND) { verdict = "at"; headline = "At observed capacity - there is no room for another delivery commitment without adding hours."; }
    else { verdict = "under"; headline = "Under observed capacity - " + (capacityMinutes - committedMinutes) + " observed minutes/week of real room."; }
  } else if (capacityMinutes !== null && counted.length === 0) {
    verdict = "not-enough-data";
    headline = "Operator capacity is recorded but no account has enough observed delivery to measure against it.";
  }

  return {
    schema: CAPACITY_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    verdict, headline,
    capacityMinutes,
    committedMinutes,
    stagedMinutes,
    projectedMinutes,
    freeMinutes: capacityMinutes === null ? null : capacityMinutes - committedMinutes,
    utilisation: capacityMinutes === null ? null : Math.round((committedMinutes / capacityMinutes) * 1000) / 1000,
    accounts: counted,
    staged,
    excludedAccounts,
    excludedRecords,
    empty: counted.length === 0,
    note: OBSERVED_ONLY_NOTE,
  };
}

// -- 4. Say it plainly ----------------------------------------------------------------------------------
export function capacityMarkdown(report) {
  if (!report || report.schema !== CAPACITY_SCHEMA) return "No delivery capacity report.";
  const out = [];
  out.push("# Delivery capacity - observed");
  out.push("");
  out.push("**" + report.verdict.toUpperCase() + "** - " + report.headline);
  out.push("");
  if (report.capacityMinutes === null) out.push("Operator weekly minutes: not recorded.");
  else out.push("Operator weekly minutes: " + report.capacityMinutes + ". Committed: " + report.committedMinutes + ".");

  out.push("");
  out.push("## Committed load by account");
  if (report.empty) out.push("Nothing with enough observed delivery to state a load.");
  else for (const a of report.accounts) {
    out.push("- " + a.customer + ": " + a.weeklyMinutes + " min/week observed over " + a.observedWeeks +
      " week(s) [" + a.recordIds.join(", ") + "]");
  }

  out.push("");
  out.push("## Excluded - counted as nothing");
  if (report.excludedAccounts.length === 0 && report.excludedRecords.length === 0) out.push("Nothing excluded.");
  for (const e of report.excludedAccounts) out.push("- " + e.customer + ": " + e.why);
  for (const e of report.excludedRecords) out.push("- " + e.customer + " record " + e.id + ": " + e.why);

  out.push("");
  out.push("_" + report.note + "_");
  return out.join("\n");
}
