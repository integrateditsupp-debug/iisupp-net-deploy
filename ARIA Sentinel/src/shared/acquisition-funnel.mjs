// RUN-F F3 — REPEATABLE ACQUISITION FUNNEL (pure, local-only, Rule 14 real-or-empty).
// Turns E3's single presented candidate into a REPEATABLE sourcing -> 5/5 vetting -> present funnel:
// every for-sale IT business (esp. retiring owners with real recurring revenue) flows
//   sourced -> vetting -> presented -> ahmad-review
// on the SAME 5-gate template used by revenue-board.mjs, each row carrying its exact next ONE-CLICK.
//
// Honesty invariants (Rule 14):
//   - real-or-empty: zero candidates => an honestly EMPTY funnel with all four stages empty. Never a
//     demo candidate, never an invented seller, never a fabricated multiple or DSCR.
//   - EVERY financial number is CLAIMED-BY-SELLER until NDA-gated diligence. Each row is stamped
//     claimsUnverified:true and carries the caveat verbatim. DSCR is computed ON CLAIMS ONLY and is
//     labelled as such - it is never presented as a verified number.
//   - a candidate reaches `presented` ONLY at 5/5 gates PASSED WITH EVIDENCE (same gate list + order
//     as revenue-board.mjs). 4/5 stays in `vetting` with the failing gate named. No partial credit.
//   - nothing executes: no network, no process-spawn, no filesystem reach in this module (static-scan locked).
//     Every action is {kind:"ahmad-one-click", staged:true, executed:false}. NDA, loan, purchase,
//     and any contact with a seller or broker are 100% Ahmad's click - this module scouts + vets +
//     presents only.
//   - Rule 15 additive: revenue-board.mjs / pilot-console.mjs / conversion-digest.mjs untouched.
//   - local-only: the rendered funnel is written under senior-director-state/ (untracked + force-404).
//     Seller names/brokers must never reach a tracked or serveable path.

export const ACQUISITION_FUNNEL_SCHEMA = "acquisition-funnel.v1";

export const VETTING_GATE_SOURCE =
  "senior-director-state/opportunity-engine/acquisition-vetting-template-2026-07-01.md (5/5 must pass WITH evidence)";

// Same five gates, same order, as revenue-board.mjs - one gate definition across the company.
export const GATES = ["recurringRevenue", "paybackMath", "transferable", "cleanTail", "fit"];

export const GATE_LABELS = {
  recurringRevenue: "Real recurring revenue (contracted MRR, not project spikes)",
  paybackMath: "Payback math (ask, SDE/EBITDA, DSCR on claims, loan serviceability)",
  transferable: "Transferable (contracts assignable, clients stay without the owner)",
  cleanTail: "Clean tail (no litigation / tax / key-man / concentration bomb)",
  fit: "Fit (Whitby/GTA-servable, stack we already run, no rebuild)",
};

export const STAGES = ["sourced", "vetting", "presented", "ahmad-review"];

export const CLAIMS_CAVEAT =
  "All figures are SELLER-CLAIMED and remain UNVERIFIED until NDA-gated diligence. NDA, LOI, loan and purchase are 100% Ahmad's one-click - no agent contacts a seller or broker.";

export const FUNNEL_EMPTY =
  "0 candidates in the funnel - honestly empty. The lane is OPEN, not fake: scout broker/for-sale listings for retiring-owner MSPs, then run every candidate through the same 5 gates. Nothing is invented to fill a stage.";

// -- Sourcing evidence gate ------------------------------------------------------------------------
// A candidate is only trackable with a real listing source and a real date it was seen. No source =>
// it is NOT a candidate, it is a rumour, and it is excluded with the reason (never silently ranked).
export function sourcingOk(candidate = {}) {
  const s = candidate.sourcing || {};
  return Boolean(
    s.listing && typeof s.listing === "string" && s.listing.trim() &&
    s.seenAt && !Number.isNaN(Date.parse(s.seenAt))
  );
}

// -- 5/5 gate scoring - a gate counts ONLY with pass===true AND a non-empty evidence string ---------
export function scoreGates(candidate = {}) {
  const gates = candidate.gates || {};
  const passed = [];
  const failing = [];
  for (const g of GATES) {
    const v = gates[g];
    const ok = Boolean(v && v.pass === true && typeof v.evidence === "string" && v.evidence.trim());
    (ok ? passed : failing).push(g);
  }
  return { passed, failing, score: passed.length, of: GATES.length, full: failing.length === 0 };
}

// -- DSCR on CLAIMS ONLY - annual seller-claimed cash flow / annual debt service --------------------
// Returns null (never a guess) whenever either side of the ratio is missing or non-positive.
export function dscrOnClaims(candidate = {}) {
  const p = (candidate.claims || {});
  const cash = Number(p.annualCashFlow);
  const debt = Number(p.annualDebtService);
  if (!Number.isFinite(cash) || !Number.isFinite(debt) || debt <= 0 || cash <= 0) {
    return { dscr: null, basis: "claims", serviceability: "unknown", note: "insufficient claimed numbers - no DSCR invented" };
  }
  const dscr = Math.round((cash / debt) * 100) / 100;
  const serviceability = dscr >= 1.25 ? "serviceable-on-claims" : dscr >= 1.0 ? "thin-on-claims" : "not-serviceable-on-claims";
  return {
    dscr,
    basis: "claims",
    serviceability,
    note: "computed from SELLER-CLAIMED figures only - unverified until diligence",
  };
}

// -- Stage assignment - derived from evidence, never asserted by hand -------------------------------
// sourced      : real listing, gates not started (0 passed)
// vetting      : gate work under way (1..4 passed) - the failing gates are named
// presented    : 5/5 passed with evidence - ready to put in front of Ahmad
// ahmad-review : 5/5 AND already put in front of Ahmad (presentedAt stamped) - awaiting HIS decision
export function stageFor(candidate = {}, gateScore = null) {
  const s = gateScore || scoreGates(candidate);
  if (!s.full) return s.score === 0 ? "sourced" : "vetting";
  return candidate.presentedAt && !Number.isNaN(Date.parse(candidate.presentedAt)) ? "ahmad-review" : "presented";
}

// -- The exact next one-click - ALWAYS staged, NEVER executed by an agent ---------------------------
export function nextOneClick(stage, gateScore, dscr) {
  const base = { kind: "ahmad-one-click", staged: true, executed: false };
  if (stage === "sourced") {
    return { ...base, id: "stage-open-vetting", label: "Open vetting: pull the public listing numbers into the 5-gate template (free, no contact)" };
  }
  if (stage === "vetting") {
    return { ...base, id: "stage-request-diligence", label: `Close gate(s): ${gateScore.failing.join(", ")} - needs seller data, so NDA request is YOUR click` };
  }
  if (stage === "presented") {
    return { ...base, id: "stage-ahmad-decision", label: `Decide go/no-go on claims (DSCR ${dscr.dscr ?? "unknown"} ${dscr.serviceability}) - then NDA + LOI is your click` };
  }
  return { ...base, id: "stage-awaiting-ahmad", label: "Awaiting your decision - nothing moves until you click" };
}

// -- Build the funnel ------------------------------------------------------------------------------
export function buildAcquisitionFunnel(input, { now = Date.now() } = {}) {
  const list = Array.isArray(input) ? input : Array.isArray(input && input.candidates) ? input.candidates : [];
  const stages = { sourced: [], vetting: [], presented: [], "ahmad-review": [] };
  const excluded = [];

  for (const c of list) {
    if (!c || typeof c !== "object" || !c.id) {
      excluded.push({ id: (c && c.id) || "(missing id)", reason: "malformed candidate - no id" });
      continue;
    }
    if (!sourcingOk(c)) {
      excluded.push({ id: c.id, reason: "no sourcing evidence (listing + seenAt required) - a rumour is not a candidate" });
      continue;
    }
    const gateScore = scoreGates(c);
    const dscr = dscrOnClaims(c);
    const stage = stageFor(c, gateScore);
    stages[stage].push({
      id: c.id,
      stage,
      sourcing: { listing: c.sourcing.listing, seenAt: c.sourcing.seenAt },
      retiringOwner: c.retiringOwner === true,
      ask: Number.isFinite(Number(c.claims && c.claims.ask)) ? Number(c.claims.ask) : null,
      claimedMrr: Number.isFinite(Number(c.claims && c.claims.mrr)) ? Number(c.claims.mrr) : null,
      claimsUnverified: true,
      caveat: CLAIMS_CAVEAT,
      gateScore: `${gateScore.score}/${gateScore.of}`,
      gatesPassed: gateScore.passed,
      gatesFailing: gateScore.failing,
      dscr,
      action: nextOneClick(stage, gateScore, dscr),
    });
  }

  // Deterministic order inside each stage: most gates passed, then better claimed DSCR, then id.
  for (const s of STAGES) {
    stages[s].sort((a, b) =>
      (b.gatesPassed.length - a.gatesPassed.length) ||
      ((b.dscr.dscr ?? -1) - (a.dscr.dscr ?? -1)) ||
      String(a.id).localeCompare(String(b.id))
    );
  }

  const counts = STAGES.reduce((acc, s) => (acc[s] = stages[s].length, acc), {});
  const total = STAGES.reduce((n, s) => n + stages[s].length, 0);

  return {
    schema: ACQUISITION_FUNNEL_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingExecuted: true,
    claimsUnverified: true,
    gate: VETTING_GATE_SOURCE,
    empty: total === 0,
    emptyCopy: FUNNEL_EMPTY,
    total,
    counts,
    stages,
    excluded,
  };
}

// -- Markdown render (local-only board section) -----------------------------------------------------
export function acquisitionFunnelMarkdown(funnel) {
  const f = funnel || buildAcquisitionFunnel([]);
  const L = [];
  L.push("# ACQUISITION FUNNEL - repeatable sourcing -> 5/5 vetting -> present");
  L.push("");
  L.push(`Generated: ${f.generatedAt} · schema ${f.schema} · LOCAL ONLY (senior-director-state/, untracked + force-404).`);
  L.push(`Gate: ${f.gate}`);
  L.push("");
  L.push(`> ${CLAIMS_CAVEAT}`);
  L.push("");
  if (f.empty) {
    L.push(`**${f.emptyCopy}**`);
    L.push("");
  } else {
    L.push(`Funnel: sourced ${f.counts.sourced} -> vetting ${f.counts.vetting} -> presented ${f.counts.presented} -> your review ${f.counts["ahmad-review"]}`);
    L.push("");
    for (const s of STAGES) {
      L.push(`## ${s} (${f.counts[s]})`);
      L.push("");
      if (!f.stages[s].length) {
        L.push("_honestly empty - nothing invented to fill this stage._");
        L.push("");
        continue;
      }
      L.push("| Candidate | Retiring owner | Ask (claimed) | MRR (claimed) | Gates | DSCR on claims | NEXT ONE-CLICK (Ahmad) |");
      L.push("|-----------|----------------|---------------|---------------|-------|----------------|------------------------|");
      for (const r of f.stages[s]) {
        L.push(`| ${r.id} | ${r.retiringOwner ? "yes" : "-"} | ${r.ask ?? "-"} | ${r.claimedMrr ?? "-"} | ${r.gateScore}${r.gatesFailing.length ? ` (missing: ${r.gatesFailing.join(", ")})` : ""} | ${r.dscr.dscr ?? "unknown"} · ${r.dscr.serviceability} | ${r.action.label} |`);
      }
      L.push("");
    }
  }
  if (f.excluded.length) {
    L.push("## Excluded (honesty log - fix the data, don't fake a candidate)");
    L.push("");
    for (const x of f.excluded) L.push(`- ${x.id}: ${x.reason}`);
    L.push("");
  }
  L.push("---");
  L.push("Rule 14: every figure above is seller-claimed and labelled as such; no verified claim is asserted. Nothing was contacted, signed, borrowed, or bought - every row's action is staged for your click.");
  return L.join("\n") + "\n";
}
