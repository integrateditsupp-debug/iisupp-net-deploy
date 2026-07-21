// RUN-G G1 — DEMAND INTAKE, DEDUPED AND QUALIFIED (pure, local-only, Rule 14 real-or-empty).
// One honest front door for every real inbound signal already tracked locally:
//   site enquiry · tender/registration hit · referral note
// -> normalized -> deduped -> deterministically qualified -> ranked, with every exclusion logged.
//
// Honesty invariants (Rule 14):
//   - real-or-empty: zero real signals => an honestly EMPTY queue. Never a demo lead, never an
//     invented company, never a "sample" row to make the board look alive.
//   - EVIDENCE OR EXCLUDED: a signal without a source + a parseable firstSeenAt is NOT a lead. It is
//     logged in `excluded` with the exact reason. Nothing is silently dropped, nothing is silently
//     ranked without proof.
//   - qualification is DETERMINISTIC and EXPLAINABLE: three sub-scores (icpFit, urgency, reachability),
//     each computed only from fields actually present, each carrying a one-line `why`. A missing field
//     scores 0 and says so - never estimated, never inferred.
//   - DEDUPE IS EVIDENCE-PRESERVING: merging keeps BOTH sources and the EARLIEST firstSeenAt. A
//     duplicate never inflates the count and never destroys provenance.
//   - nothing executes: no network, no spawn, no filesystem reach (static-scan locked in the test).
//     Sending, replying, and registering stay Ahmad's one-click.
//   - Rule 15 additive: pilot-console / conversion-digest / acquisition-funnel / revenue-board untouched.
//   - local-only: rendered under senior-director-state/ (untracked + force-404). Real names/emails/
//     companies never reach a tracked or serveable path (vault Rule 11).

export const DEMAND_INTAKE_SCHEMA = "demand-intake.v1";

/** The only signal kinds we accept. An unknown kind is excluded, never coerced into a lead. */
export const SIGNAL_KINDS = ["site-enquiry", "tender-hit", "referral"];

export const DEMAND_INTAKE_EMPTY =
  "0 qualified demand signals - honestly empty. The intake is OPEN, not fake: real site enquiries, real tender/registration hits, and real referral notes land here with their source and first-seen date. Nothing is invented to make the queue look busy.";

export const PRIVACY_NOTE =
  "LOCAL ONLY. Real names/emails/companies stay in senior-director-state/ (untracked + force-404) and in Ahmad's own CRM/inbox - never in a tracked or serveable path (vault Rule 11).";

const DAY = 24 * 60 * 60 * 1000;

// -- 1. Evidence gate ------------------------------------------------------------------------------
export function signalEvidenceOk(signal = {}) {
  const source = signal.source;
  return Boolean(
    typeof source === "string" && source.trim() &&
    signal.firstSeenAt && !Number.isNaN(Date.parse(signal.firstSeenAt))
  );
}

// -- 2. Identity key for dedupe --------------------------------------------------------------------
// Deterministic, lowercase, whitespace-collapsed. Email wins, then domain, then company name.
// No fuzzy matching - a guess would silently merge two real businesses.
export function identityKey(signal = {}) {
  const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  const email = norm(signal.email);
  if (email && email.includes("@")) return `email:${email}`;
  const domain = norm(signal.domain).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (domain) return `domain:${domain}`;
  const company = norm(signal.company);
  if (company) return `company:${company}`;
  return null; // no identity => cannot be deduped honestly => excluded
}

// -- 3. Qualification: three deterministic sub-scores, each explainable in one line -----------------
export function scoreIcpFit(signal = {}) {
  const reasons = [];
  let score = 0;
  const seats = Number(signal.seats);
  if (Number.isFinite(seats) && seats > 0) {
    if (seats >= 10 && seats <= 250) { score += 20; reasons.push(`${seats} seats in the 10-250 sweet spot`); }
    else { score += 5; reasons.push(`${seats} seats - outside 10-250, servable but not ideal`); }
  } else reasons.push("seat count unknown - scored 0, not estimated");

  const region = String(signal.region || "").trim().toLowerCase();
  if (region) {
    if (/whitby|durham|gta|toronto|ontario/.test(region)) { score += 15; reasons.push(`${signal.region} - on-site servable`); }
    else { score += 5; reasons.push(`${signal.region} - remote-only servable`); }
  } else reasons.push("region unknown - scored 0, not assumed local");

  const need = String(signal.need || "").trim().toLowerCase();
  if (need) {
    if (/managed|msp|helpdesk|support contract|monitor/.test(need)) { score += 15; reasons.push("stated need is recurring managed support"); }
    else { score += 5; reasons.push("stated need is project/one-off"); }
  } else reasons.push("stated need unknown - scored 0");

  return { score, of: 50, why: reasons.join("; ") };
}

export function scoreUrgency(signal = {}, now = Date.now()) {
  const reasons = [];
  let score = 0;
  const deadline = signal.deadlineAt ? Date.parse(signal.deadlineAt) : NaN;
  if (!Number.isNaN(deadline)) {
    const days = Math.ceil((deadline - now) / DAY);
    if (days < 0) reasons.push(`deadline passed ${Math.abs(days)}d ago - no urgency credit`);
    else if (days <= 7) { score += 30; reasons.push(`closes in ${days}d`); }
    else if (days <= 30) { score += 20; reasons.push(`closes in ${days}d`); }
    else { score += 10; reasons.push(`closes in ${days}d`); }
  } else reasons.push("no real deadline on record - scored 0, never invented");

  const first = Date.parse(signal.firstSeenAt);
  if (!Number.isNaN(first)) {
    const age = Math.floor((now - first) / DAY);
    if (age <= 2) { score += 10; reasons.push(`fresh (${age}d old)`); }
    else if (age <= 14) { score += 5; reasons.push(`${age}d old`); }
    else reasons.push(`${age}d old - stale, no freshness credit`);
  }
  return { score, of: 40, why: reasons.join("; ") };
}

export function scoreReachability(signal = {}) {
  const reasons = [];
  let score = 0;
  const hasEmail = typeof signal.email === "string" && signal.email.includes("@");
  const hasPhone = typeof signal.phone === "string" && signal.phone.trim().length >= 7;
  if (hasEmail) { score += 6; reasons.push("email on record"); }
  if (hasPhone) { score += 4; reasons.push("phone on record"); }
  if (!hasEmail && !hasPhone) reasons.push("no reachable channel - scored 0");
  if (signal.inboundConsent === true) reasons.push("they contacted us (inbound) - reply is expected");
  else reasons.push("not inbound-consented - any first contact is Ahmad's one-click");
  return { score, of: 10, why: reasons.join("; "), reachable: hasEmail || hasPhone };
}

export function qualify(signal = {}, now = Date.now()) {
  const icpFit = scoreIcpFit(signal);
  const urgency = scoreUrgency(signal, now);
  const reachability = scoreReachability(signal);
  const score = icpFit.score + urgency.score + reachability.score;
  // Qualified = enough real ICP evidence AND an actual way to reply. Both, never one.
  const qualified = icpFit.score >= 20 && reachability.reachable === true;
  const blockers = [];
  if (icpFit.score < 20) blockers.push("not enough real ICP evidence (seats/region/need)");
  if (!reachability.reachable) blockers.push("no reachable channel on record");
  return { score, of: 100, qualified, blockers, icpFit, urgency, reachability };
}

// -- 4. Build the intake queue ---------------------------------------------------------------------
export function buildDemandIntake(input, { now = Date.now() } = {}) {
  const list = Array.isArray(input) ? input : Array.isArray(input && input.signals) ? input.signals : [];
  const merged = new Map();
  const excluded = [];
  let rawAccepted = 0;

  for (const s of list) {
    if (!s || typeof s !== "object" || !s.id) {
      excluded.push({ id: (s && s.id) || "(missing id)", reason: "malformed signal - no id" });
      continue;
    }
    if (!SIGNAL_KINDS.includes(s.kind)) {
      excluded.push({ id: s.id, reason: `unknown signal kind "${s.kind}" - only ${SIGNAL_KINDS.join(", ")} are accepted` });
      continue;
    }
    if (!signalEvidenceOk(s)) {
      excluded.push({ id: s.id, reason: "no evidence (source + firstSeenAt required) - an unsourced signal is not a lead" });
      continue;
    }
    const key = identityKey(s);
    if (!key) {
      excluded.push({ id: s.id, reason: "no identity (email, domain, or company required) - cannot be deduped honestly" });
      continue;
    }
    rawAccepted += 1;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, {
        key,
        ids: [s.id],
        kinds: [s.kind],
        sources: [{ id: s.id, kind: s.kind, source: s.source, firstSeenAt: s.firstSeenAt }],
        firstSeenAt: s.firstSeenAt,
        signal: { ...s },
      });
      continue;
    }
    // DEDUPE: keep both sources, keep the EARLIEST first-seen, fill only MISSING fields.
    prev.ids.push(s.id);
    if (!prev.kinds.includes(s.kind)) prev.kinds.push(s.kind);
    prev.sources.push({ id: s.id, kind: s.kind, source: s.source, firstSeenAt: s.firstSeenAt });
    if (Date.parse(s.firstSeenAt) < Date.parse(prev.firstSeenAt)) prev.firstSeenAt = s.firstSeenAt;
    for (const [k, v] of Object.entries(s)) {
      const empty = prev.signal[k] === undefined || prev.signal[k] === null || prev.signal[k] === "";
      if (empty && v !== undefined && v !== null && v !== "") prev.signal[k] = v;
    }
    // Earliest real deadline wins (tightest true clock), never a later invented one.
    if (s.deadlineAt && !Number.isNaN(Date.parse(s.deadlineAt))) {
      const cur = Date.parse(prev.signal.deadlineAt);
      if (Number.isNaN(cur) || Date.parse(s.deadlineAt) < cur) prev.signal.deadlineAt = s.deadlineAt;
    }
  }

  const rows = [];
  for (const m of merged.values()) {
    const mergedSignal = { ...m.signal, firstSeenAt: m.firstSeenAt };
    const q = qualify(mergedSignal, now);
    rows.push({
      key: m.key,
      ids: m.ids.slice(),
      duplicateOf: m.ids.length > 1 ? m.ids.slice(1) : [],
      kinds: m.kinds.slice(),
      sources: m.sources.slice(),
      firstSeenAt: m.firstSeenAt,
      deadlineAt: mergedSignal.deadlineAt || null,
      qualified: q.qualified,
      blockers: q.blockers,
      score: q.score,
      of: q.of,
      why: {
        icpFit: `${q.icpFit.score}/${q.icpFit.of} - ${q.icpFit.why}`,
        urgency: `${q.urgency.score}/${q.urgency.of} - ${q.urgency.why}`,
        reachability: `${q.reachability.score}/${q.reachability.of} - ${q.reachability.why}`,
      },
      action: q.qualified
        ? { kind: "ahmad-one-click", staged: true, executed: false, id: "intake-open-cadence",
            label: "Qualified - start the follow-up cadence (drafts stage for your click; nothing sends itself)" }
        : { kind: "ahmad-one-click", staged: true, executed: false, id: "intake-fill-evidence",
            label: `Not qualified yet: ${q.blockers.join(" + ")} - fill the real field, never guess it` },
    });
  }

  // Deterministic: qualified first, then score, then earliest first-seen, then key.
  rows.sort((a, b) =>
    (Number(b.qualified) - Number(a.qualified)) ||
    (b.score - a.score) ||
    (Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt)) ||
    a.key.localeCompare(b.key)
  );

  const qualifiedRows = rows.filter((r) => r.qualified);
  return {
    schema: DEMAND_INTAKE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: true,
    privacy: PRIVACY_NOTE,
    rawSignals: list.length,
    accepted: rawAccepted,
    deduped: rawAccepted - rows.length,
    unique: rows.length,
    qualifiedCount: qualifiedRows.length,
    empty: qualifiedRows.length === 0,
    emptyCopy: DEMAND_INTAKE_EMPTY,
    rows,
    queue: qualifiedRows,
    excluded,
  };
}

// -- 5. Markdown render (local-only board section) --------------------------------------------------
export function demandIntakeMarkdown(intake) {
  const q = intake || buildDemandIntake([]);
  const L = [];
  L.push("# DEMAND INTAKE - deduped + qualified (real signals only)");
  L.push("");
  L.push(`Generated: ${q.generatedAt} · schema ${q.schema}`);
  L.push(`${q.privacy}`);
  L.push("");
  L.push(`Raw ${q.rawSignals} -> accepted ${q.accepted} -> unique ${q.unique} (deduped ${q.deduped}) -> qualified ${q.qualifiedCount}`);
  L.push("");
  if (q.empty) {
    L.push(`**${q.emptyCopy}**`);
    L.push("");
  } else {
    L.push("| Lead key | Sources | First seen | Score | Why (ICP · urgency · reach) | NEXT ONE-CLICK (Ahmad) |");
    L.push("|----------|---------|------------|-------|------------------------------|------------------------|");
    for (const r of q.queue) {
      L.push(`| ${r.key} | ${r.kinds.join(" + ")} (${r.ids.length}) | ${r.firstSeenAt} | ${r.score}/${r.of} | ${r.why.icpFit} · ${r.why.urgency} · ${r.why.reachability} | ${r.action.label} |`);
    }
    L.push("");
  }
  const notYet = q.rows.filter((r) => !r.qualified);
  if (notYet.length) {
    L.push("## Not qualified yet (honest - the data is missing, the lead is not fake)");
    L.push("");
    for (const r of notYet) L.push(`- ${r.key}: ${r.blockers.join(" + ")}`);
    L.push("");
  }
  if (q.excluded.length) {
    L.push("## Excluded (honesty log - fix the record, don't invent a lead)");
    L.push("");
    for (const x of q.excluded) L.push(`- ${x.id}: ${x.reason}`);
    L.push("");
  }
  L.push("---");
  L.push("Rule 14: every row above traces to a real recorded signal with a source and a first-seen date; unknown fields score 0 and say so. Nothing was sent, replied to, or registered - every action is staged for your click.");
  return L.join("\n") + "\n";
}
