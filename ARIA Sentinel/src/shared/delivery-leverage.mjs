// RUN-G G3 — DELIVERY LEVERAGE PER PILOT (pure, local-only, Rule 14 real-or-empty).
// Answers the only ops question that matters while scaling: as pilots go UP, do the human minutes
// per pilot go DOWN? Measured from REAL tracked fix/escalation records - and stated honestly when
// the line gets WORSE or when there is not enough data to say anything at all.
//
// Honesty invariants (Rule 14):
//   - OBSERVED ONLY. Minutes come from real recorded start/end stamps (or a recorded durationMinutes).
//     A record without real time data contributes NOTHING and is logged in `excluded`. We never model
//     a "typical" fix time and never present a modelled saving as observed.
//   - real-or-empty: no usable records => enoughData:false + honest copy. No zero-value chart, no
//     invented baseline, no "estimated savings" headline.
//   - REGRESSION IS REPORTED. If minutes-per-pilot rose between periods, the board says "WORSE" in the
//     same plain words it would say "better". The trend is never spun.
//   - candidate automations are CANDIDATES: each names the real sink, the real observed minutes, and
//     the real occurrence count. Projected savings are labelled projected:true / observed:false and
//     are arithmetic on observed minutes only - never presented as money already saved.
//   - nothing executes: no network, no spawn, no filesystem reach (static-scan locked in the test).
//     Building an automation or publishing a KB entry stays a staged one-click.
//   - Rule 15 additive: pilot-console / conversion-digest / acquisition-funnel / revenue-board /
//     demand-intake / followup-cadence untouched.

export const DELIVERY_LEVERAGE_SCHEMA = "delivery-leverage.v1";

/** Below this many usable records we refuse to draw a trend. Two points is not a trend. */
export const MIN_RECORDS_FOR_TREND = 6;
export const MIN_PILOTS_FOR_TREND = 2;
/** A sink must actually repeat before we call it repeatable. */
export const MIN_OCCURRENCES_FOR_SINK = 3;

export const LEVERAGE_EMPTY =
  "Not enough real delivery records to measure leverage - honestly empty. Minutes per pilot are computed only from real recorded fix/escalation times. No modelled fix time, no estimated saving, no placeholder trend.";

export const NOT_ENOUGH_FOR_TREND =
  "Not enough real data to state a trend yet - the number below is a single-period observation, not a direction. It becomes a trend only with at least " +
  MIN_RECORDS_FOR_TREND + " usable records across " + MIN_PILOTS_FOR_TREND + " pilots in each period.";

// -- 1. Observed minutes only ------------------------------------------------------------------------
export function observedMinutes(record = {}) {
  const start = record.startedAt ? Date.parse(record.startedAt) : NaN;
  const end = record.endedAt ? Date.parse(record.endedAt) : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
    return Math.round((end - start) / 60000);
  }
  const d = Number(record.durationMinutes);
  if (Number.isFinite(d) && d > 0) return Math.round(d);
  return null; // no real time => contributes nothing, ever
}

// -- 2. Normalize a sink label (what kind of work ate the time) ---------------------------------------
export function sinkKey(record = {}) {
  const raw = String(record.category || record.issueType || "").trim().toLowerCase().replace(/\s+/g, " ");
  return raw || null; // uncategorized work cannot be called a repeatable sink
}

// -- 3. Aggregate real records -----------------------------------------------------------------------
export function aggregate(records) {
  const list = Array.isArray(records) ? records : [];
  const excluded = [];
  const usable = [];
  for (const r of list) {
    if (!r || typeof r !== "object" || !r.id) {
      excluded.push({ id: (r && r.id) || "(missing id)", reason: "malformed record - no id" });
      continue;
    }
    if (!r.pilotId) {
      excluded.push({ id: r.id, reason: "no pilotId - cannot attribute minutes to a pilot" });
      continue;
    }
    const minutes = observedMinutes(r);
    if (minutes === null) {
      excluded.push({ id: r.id, reason: "no real recorded time (startedAt/endedAt or durationMinutes) - contributes nothing, never estimated" });
      continue;
    }
    const at = r.endedAt || r.startedAt || r.at || null;
    if (!at || Number.isNaN(Date.parse(at))) {
      excluded.push({ id: r.id, reason: "no real date - cannot be placed in a period" });
      continue;
    }
    usable.push({ id: r.id, pilotId: String(r.pilotId), minutes, at, sink: sinkKey(r), automated: r.automated === true });
  }
  return { usable, excluded };
}

// -- 4. Minutes per pilot ------------------------------------------------------------------------------
export function minutesPerPilot(usable) {
  const list = Array.isArray(usable) ? usable : [];
  if (!list.length) return { pilots: 0, records: 0, totalMinutes: 0, perPilot: null };
  const pilots = new Set(list.map((r) => r.pilotId));
  const totalMinutes = list.reduce((n, r) => n + r.minutes, 0);
  return {
    pilots: pilots.size,
    records: list.length,
    totalMinutes,
    perPilot: Math.round((totalMinutes / pilots.size) * 10) / 10,
  };
}

// -- 5. Repeatable time sinks --------------------------------------------------------------------------
export function topSinks(usable, { limit = 5 } = {}) {
  const byKey = new Map();
  for (const r of Array.isArray(usable) ? usable : []) {
    if (!r.sink) continue; // uncategorized work is never promoted to a named sink
    const cur = byKey.get(r.sink) || { sink: r.sink, occurrences: 0, minutes: 0, pilots: new Set(), evidence: [] };
    cur.occurrences += 1;
    cur.minutes += r.minutes;
    cur.pilots.add(r.pilotId);
    if (cur.evidence.length < 3) cur.evidence.push(`${r.id} (${r.minutes}m @ ${r.at})`);
    byKey.set(r.sink, cur);
  }
  return [...byKey.values()]
    .filter((s) => s.occurrences >= MIN_OCCURRENCES_FOR_SINK)
    .map((s) => ({
      sink: s.sink,
      occurrences: s.occurrences,
      observedMinutes: s.minutes,
      pilots: s.pilots.size,
      avgMinutes: Math.round((s.minutes / s.occurrences) * 10) / 10,
      evidence: s.evidence,
      repeatable: true,
      projectedSavingIfAutomated: {
        minutes: s.minutes,
        projected: true,
        observed: false,
        basis: `${s.occurrences} real occurrences totalling ${s.minutes} observed minutes - saving is arithmetic, NOT money already saved`,
      },
      action: { kind: "ahmad-one-click", staged: true, executed: false, id: "leverage-build-automation",
        label: `Automate or KB-cover "${s.sink}" (${s.occurrences}x, ${s.minutes} observed minutes) - your click to greenlight` },
    }))
    .sort((a, b) => (b.observedMinutes - a.observedMinutes) || (b.occurrences - a.occurrences) || a.sink.localeCompare(b.sink))
    .slice(0, limit);
}

// -- 6. Build the leverage board -------------------------------------------------------------------------
export function buildDeliveryLeverage(input, { now = Date.now(), periodDays = 30 } = {}) {
  const records = Array.isArray(input) ? input : Array.isArray(input && input.records) ? input.records : [];
  const { usable, excluded } = aggregate(records);
  const cut = now - periodDays * 24 * 60 * 60 * 1000;
  const current = usable.filter((r) => Date.parse(r.at) >= cut);
  const previous = usable.filter((r) => Date.parse(r.at) < cut);

  const cur = minutesPerPilot(current);
  const prev = minutesPerPilot(previous);

  const enoughData = usable.length > 0;
  const enoughForTrend =
    cur.records >= MIN_RECORDS_FOR_TREND && prev.records >= MIN_RECORDS_FOR_TREND &&
    cur.pilots >= MIN_PILOTS_FOR_TREND && prev.pilots >= MIN_PILOTS_FOR_TREND;

  let trend = { direction: "unknown", deltaPerPilot: null, honest: NOT_ENOUGH_FOR_TREND };
  if (enoughForTrend && cur.perPilot !== null && prev.perPilot !== null) {
    const delta = Math.round((cur.perPilot - prev.perPilot) * 10) / 10;
    trend = {
      direction: delta < 0 ? "better" : delta > 0 ? "WORSE" : "flat",
      deltaPerPilot: delta,
      honest: delta > 0
        ? `Minutes per pilot went UP by ${delta} - leverage got WORSE this period. Stated plainly, not spun.`
        : delta < 0
          ? `Minutes per pilot went DOWN by ${Math.abs(delta)} - leverage improved this period.`
          : "Minutes per pilot are flat between periods.",
    };
  }

  return {
    schema: DELIVERY_LEVERAGE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    observedOnly: true,
    periodDays,
    enoughData,
    enoughForTrend,
    emptyCopy: LEVERAGE_EMPTY,
    current: cur,
    previous: prev,
    trend,
    sinks: topSinks(current.length ? current : usable),
    usableRecords: usable.length,
    excluded,
  };
}

// -- 7. Markdown render (local-only board section) ----------------------------------------------------------
export function deliveryLeverageMarkdown(board) {
  const b = board || buildDeliveryLeverage([]);
  const L = [];
  L.push("# DELIVERY LEVERAGE - real human minutes per pilot");
  L.push("");
  L.push(`Generated: ${b.generatedAt} · schema ${b.schema} · period ${b.periodDays}d · OBSERVED MINUTES ONLY`);
  L.push("");
  if (!b.enoughData) {
    L.push(`**${b.emptyCopy}**`);
    L.push("");
  } else {
    L.push(`This period: ${b.current.records} records · ${b.current.pilots} pilots · ${b.current.totalMinutes} observed minutes · **${b.current.perPilot ?? "-"} minutes per pilot**`);
    L.push(`Prior period: ${b.previous.records} records · ${b.previous.pilots} pilots · ${b.previous.perPilot ?? "-"} minutes per pilot`);
    L.push("");
    L.push(`Trend: **${b.trend.direction}** - ${b.trend.honest}`);
    L.push("");
    if (b.sinks.length) {
      L.push("## Top repeatable time sinks (candidate automations / KB entries)");
      L.push("");
      L.push("| Sink | Times | Observed minutes | Avg | Pilots | Evidence | NEXT ONE-CLICK (Ahmad) |");
      L.push("|------|-------|------------------|-----|--------|----------|------------------------|");
      for (const s of b.sinks) {
        L.push(`| ${s.sink} | ${s.occurrences} | ${s.observedMinutes} | ${s.avgMinutes} | ${s.pilots} | ${s.evidence.join("; ")} | ${s.action.label} |`);
      }
      L.push("");
    } else {
      L.push(`_No sink has repeated at least ${MIN_OCCURRENCES_FOR_SINK}x with real recorded time yet - nothing is promoted to "repeatable" on thin evidence._`);
      L.push("");
    }
  }
  if (b.excluded.length) {
    L.push("## Excluded records (honesty log - fix the tracking, don't estimate the minutes)");
    L.push("");
    for (const x of b.excluded) L.push(`- ${x.id}: ${x.reason}`);
    L.push("");
  }
  L.push("---");
  L.push("Rule 14: every minute above was recorded, not modelled. Projected savings are labelled projected and are arithmetic on observed minutes - never money already saved. A worsening trend is reported in the same words as an improving one.");
  return L.join("\n") + "\n";
}
