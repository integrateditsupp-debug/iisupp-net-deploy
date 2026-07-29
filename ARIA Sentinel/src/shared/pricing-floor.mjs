// pricing-floor.mjs — RUN-L L3: HONEST PRICING FLOOR
//
// WHY (RUN-L, 2026-07-22): a quote below what an account actually costs us to deliver is a slow way
// to go out of business. L3 states the floor from OBSERVED delivery minutes (J2) and a RECORDED
// operator cost basis only — and refuses to state one otherwise.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - NO MODELLED RATE, NO ASSUMED UTILISATION. Cost per minute comes from a recorded monthly
//     operator cost divided by recorded available minutes. Both must be real records with ids.
//   - WITHOUT A RECORDED COST BASIS THE ANSWER IS "cannot be stated" — never a comfortable default,
//     never an industry average, never a placeholder rate.
//   - OBSERVED MINUTES ONLY. An account with no observed delivery minutes gets no floor. It is
//     named in `unpriceable`, not filled with a neighbour's number.
//   - EVERY INPUT TRACES. Each floor cites the cost-basis id and the minute-record ids it summed.
//   - A QUOTE AT OR BELOW THE FLOOR IS FLAGGED before it can reach a K3 one-page ask.
//   - Nothing sends, signs, prices externally, or charges. No network, no spawn, no filesystem reach.
//   - Rule 15 additive: J2 capacity truth, K1 receipts and K3 ask stay read-only inputs, untouched.

export const PRICING_FLOOR_SCHEMA = "pricing-floor.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// Fewer than this many observed delivery records and we will not state a monthly floor for an account.
export const MIN_RECORDS_FOR_FLOOR = 3;

function isRealCostBasis(cb) {
  return !!(cb
    && typeof cb.sourceId === "string" && cb.sourceId.length > 0
    && Number.isFinite(cb.monthlyOperatorCostCad) && cb.monthlyOperatorCostCad > 0
    && Number.isFinite(cb.monthlyAvailableMinutes) && cb.monthlyAvailableMinutes > 0);
}

// Observed minutes only: a record counts only if it carries a real id and a real recorded duration.
function observedMinutes(records) {
  const used = [];
  let minutes = 0;
  const excluded = [];
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r.id !== "string" || !r.id.length) { excluded.push({ id: null, why: "record has no real id" }); continue; }
    const m = Number(r.durationMinutes);
    if (!Number.isFinite(m) || m <= 0) { excluded.push({ id: r.id, why: "no recorded duration — never estimated" }); continue; }
    minutes += m;
    used.push(r.id);
  }
  return { minutes, used, excluded };
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * input: {
 *   costBasis: { sourceId, monthlyOperatorCostCad, monthlyAvailableMinutes },
 *   accounts: [ { key, months, records: [{ id, durationMinutes }] } ]
 * }
 */
export function computePricingFloor(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: PRICING_FLOOR_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    observedOnly: true,
    modelled: false,
  };

  const costBasis = input && input.costBasis;
  const accounts = Array.isArray(input && input.accounts) ? input.accounts : [];

  if (!isRealCostBasis(costBasis)) {
    return {
      ...base,
      verdict: "floor-unknown",
      statement: "Cannot be stated: no recorded operator cost basis (monthly cost + available minutes, with a real source id). We will not invent a rate to make a number appear.",
      costPerMinuteCad: null,
      costBasisId: null,
      floors: [],
      unpriceable: accounts.map((a) => ({ key: a && a.key ? a.key : null, why: "no cost basis recorded" })),
    };
  }

  const costPerMinuteCad = costBasis.monthlyOperatorCostCad / costBasis.monthlyAvailableMinutes;

  const floors = [];
  const unpriceable = [];
  for (const a of accounts) {
    const key = a && typeof a.key === "string" && a.key.length ? a.key : null;
    if (!key) { unpriceable.push({ key: null, why: "account has no real key" }); continue; }
    const { minutes, used, excluded } = observedMinutes(a.records);
    if (used.length < MIN_RECORDS_FOR_FLOOR || minutes <= 0) {
      unpriceable.push({ key, why: `only ${used.length} usable observed record(s) — a floor needs at least ${MIN_RECORDS_FOR_FLOOR}; never filled from another account`, excluded });
      continue;
    }
    const months = Number.isFinite(a.months) && a.months > 0 ? a.months : 1;
    const monthlyMinutes = minutes / months;
    floors.push({
      key,
      observedMinutes: minutes,
      monthsObserved: months,
      monthlyMinutes: round2(monthlyMinutes),
      monthlyFloorCad: round2(monthlyMinutes * costPerMinuteCad),
      costBasisId: costBasis.sourceId,
      recordIds: used,
      excluded,
    });
  }

  return {
    ...base,
    verdict: floors.length ? "floor-known" : "floor-unknown",
    statement: floors.length
      ? `Floor stated for ${floors.length} account(s) from observed minutes and cost basis ${costBasis.sourceId}. ${unpriceable.length} account(s) have no stateable floor and are named, not guessed.`
      : "Cannot be stated: a real cost basis exists but no account has enough observed delivery minutes. No floor is invented.",
    costPerMinuteCad: round2(costPerMinuteCad * 10000) / 10000,
    costBasisId: costBasis.sourceId,
    floors,
    unpriceable,
  };
}

export function floorFor(result, key) {
  if (!result || result.schema !== PRICING_FLOOR_SCHEMA) return null;
  return (result.floors || []).find((f) => f.key === key) || null;
}

/**
 * Gate a quote against the floor. Additive — returns a flag, never mutates the ask.
 * Below-or-equal floor => blocked:true so it cannot reach a K3 one-page ask unflagged.
 */
export function checkQuoteAgainstFloor(result, key, quoteCad) {
  const floor = floorFor(result, key);
  if (!Number.isFinite(quoteCad) || quoteCad <= 0) {
    return { key, status: "no-quote", blocked: true, floorCad: floor ? floor.monthlyFloorCad : null,
      message: "No real quote supplied — nothing to check." };
  }
  if (!floor) {
    return { key, status: "floor-unknown", blocked: true, floorCad: null,
      message: "Floor cannot be stated for this account — quoting before we know our own cost is how a business loses money on delivery. Record the cost basis and observed minutes first." };
  }
  if (quoteCad <= floor.monthlyFloorCad) {
    return { key, status: "quote-below-floor", blocked: true, floorCad: floor.monthlyFloorCad, quoteCad,
      message: `Quote ${quoteCad} CAD/mo is at or below the observed delivery floor of ${floor.monthlyFloorCad} CAD/mo (cost basis ${floor.costBasisId}). This loses money. Raise it or state why deliberately.` };
  }
  return { key, status: "above-floor", blocked: false, floorCad: floor.monthlyFloorCad, quoteCad,
    marginCad: round2(quoteCad - floor.monthlyFloorCad),
    message: `Quote ${quoteCad} CAD/mo clears the observed floor of ${floor.monthlyFloorCad} CAD/mo.` };
}

/** K3 integration, additive: annotate an ask with the floor check without touching the ask module. */
export function flagAskAgainstFloor(ask, result, quoteCad) {
  const key = ask && (ask.customer || ask.key) ? String(ask.customer || ask.key) : null;
  const check = checkQuoteAgainstFloor(result, key, quoteCad);
  return { schema: "pricing-floor-ask-flag.v1", askKey: key, ...check, staged: true, executed: false };
}

export function pricingFloorMarkdown(result) {
  if (!result || result.schema !== PRICING_FLOOR_SCHEMA) return "_no pricing floor_";
  const lines = ["## Honest pricing floor", "", `**${result.verdict}** — ${result.statement}`, ""];
  if (result.costPerMinuteCad !== null) lines.push(`_Cost per delivered minute: ${result.costPerMinuteCad} CAD (basis ${result.costBasisId})_`, "");
  for (const f of result.floors) {
    lines.push(`- **${f.key}** — floor ${f.monthlyFloorCad} CAD/mo from ${f.observedMinutes} observed minute(s) over ${f.monthsObserved} month(s) (${f.recordIds.length} record id(s))`);
  }
  if (result.unpriceable.length) {
    lines.push("", "### No stateable floor");
    for (const u of result.unpriceable) lines.push(`- ${u.key || "(no key)"} — ${u.why}`);
  }
  lines.push("", "_Observed only. No modelled rate, no assumed utilisation. Nothing here sends or charges._");
  return lines.join("\n") + "\n";
}
