// ask-ready-queue.mjs — RUN-M M1: ASK-READY QUEUE, RANKED BY REAL EVIDENCE
//
// WHY (RUN-M, 2026-07-28): twelve runs of machinery (G..L) now sit on one line, and revenue
// received to date is still none. Every prior run built a CAPABILITY. None of them put a priced,
// defensible ask in front of a named human. M1 answers exactly one question honestly:
// which accounts are genuinely ask-ready right now, and in what order do we ask?
//
// Honesty invariants (Rule 14 real-or-empty):
//   - AN ACCOUNT IS ASK-READY ONLY IF ALL FOUR ARE REAL: a demand record on the L1 conveyor, a real
//     first engagement artifact, an EARNED H1 proof pack, and a quote strictly ABOVE the L3 observed
//     delivery floor. Three of four is a NEAR-MISS with the missing artifact NAMED — never "almost".
//   - A BELOW-FLOOR OR UNKNOWN-FLOOR QUOTE CAN NEVER ENTER THE QUEUE. L3 is the gate, not a hint.
//   - RANKING IS BY EVIDENCE STRENGTH AND OBSERVED DELIVERY COST ONLY. Never recency, never deal
//     size, never optimism. Same inputs => same order, every time (deterministic, total ordering).
//   - AN EMPTY QUEUE IS A VALID OUTPUT. It says so plainly and names the single most common missing
//     artifact across the near-misses. It is never padded with "warm" or "nearly there" rows.
//   - Nothing sends, signs, prices externally, or charges. No network, no spawn, no filesystem reach.
//   - Rule 15 additive: the L1 conveyor, H1 pack and L3 floor stay read-only inputs, untouched.

export const ASK_READY_QUEUE_SCHEMA = "ask-ready-queue.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const EMPTY_STATEMENT =
  "No account is ask-ready. Nothing is queued, nothing is dressed up as pipeline.";

// The four gates, in the order a human would check them. Each names the EXACT artifact it wants.
export const GATES = [
  {
    key: "demand",
    label: "Real demand record",
    missing: "no real demand record on the conveyor — capture the signal first (G1 demand-intake.v1)",
  },
  {
    key: "engagement",
    label: "Real first engagement",
    missing: "no real engagement artifact — record an actual delivery/engagement event with an id and a timestamp; never backdate one",
  },
  {
    key: "evidence",
    label: "Earned proof pack (H1)",
    missing: "no EARNED proof-pack.v1 — the pack must be earned from real delivery records, not claimed",
  },
  {
    key: "priced",
    label: "Quote above the observed floor (L3)",
    missing: "no quote above the observed delivery floor — state the floor from real minutes and price above it before asking",
  },
];

export const GATE_KEYS = GATES.map((g) => g.key);

export const INTEGRITY_GAP_TEXT =
  "out-of-order artifact on the chain (integrity gap) — reconcile it before any ask";

function gateMissingText(key) {
  const g = GATES.find((x) => x.key === key);
  return g ? g.missing : "unknown gate";
}

function isConveyor(c) {
  return !!(c && c.schema === "demand-to-ask-conveyor.v1" && Array.isArray(c.rows));
}
function isEarnedPack(p) {
  return !!(p && p.schema === "proof-pack.v1" && p.earned === true && Array.isArray(p.claims) && p.claims.length > 0);
}
function reachedKeys(row) {
  return new Set((Array.isArray(row.reached) ? row.reached : []).map((r) => r.key));
}
function round2(n) { return Math.round(n * 100) / 100; }

// Evidence strength = the count of EVIDENCED claims in the earned pack plus the count of chain
// stages that carry a real artifact. Both are counts of things that actually exist. Nothing weighted,
// nothing modelled, nothing that rewards age or size.
function evidenceStrength(row, pack) {
  const claims = isEarnedPack(pack) ? pack.claims.length : 0;
  const stages = Array.isArray(row.reached) ? row.reached.length : 0;
  return { claims, stages, score: claims + stages };
}

/**
 * input: {
 *   conveyor,                       // L1 demand-to-ask-conveyor.v1 (read-only)
 *   floorResult,                    // L3 pricing-floor.v1 (read-only)
 *   evidenceByKey: { [key]: { proofPack, quoteCad } },
 *   floorCheck                      // (result, key, quoteCad) => L3 checkQuoteAgainstFloor shape
 * }
 * `floorCheck` is injected so this module never imports a pricing path it could mutate; the caller
 * passes L3's own exported checker. Without it, the priced gate cannot be satisfied — by design.
 */
export function buildAskReadyQueue(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: ASK_READY_QUEUE_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    deterministic: true,
  };

  const conveyor = input && input.conveyor;
  if (!isConveyor(conveyor)) {
    return {
      ...base,
      empty: true,
      refusal: "No real demand-to-ask-conveyor.v1 — the queue reports nothing rather than invent a buyer.",
      statement: EMPTY_STATEMENT,
      ready: [],
      nearMisses: [],
      commonestGap: null,
      counts: { total: 0, ready: 0, nearMiss: 0, blockedByFloor: 0 },
    };
  }

  const evidenceByKey = (input && input.evidenceByKey && typeof input.evidenceByKey === "object") ? input.evidenceByKey : {};
  const floorResult = input && input.floorResult;
  const floorCheck = typeof input.floorCheck === "function" ? input.floorCheck : null;

  const ready = [];
  const nearMisses = [];
  let blockedByFloor = 0;

  for (const row of conveyor.rows) {
    if (!row || typeof row.key !== "string" || !row.key.length) continue;
    // Already paid accounts are not asks. They are not "ready" and they are not a near-miss.
    if (row.bucket === "paid") continue;

    const ev = evidenceByKey[row.key] && typeof evidenceByKey[row.key] === "object" ? evidenceByKey[row.key] : {};
    const reached = reachedKeys(row);
    const pack = ev.proofPack;
    const quoteCad = Number(ev.quoteCad);

    const passed = [];
    const failed = [];

    // gate 1 — a real demand record is the row itself existing on a real conveyor
    passed.push("demand");

    // gate 2 — real first engagement artifact
    if (reached.has("engagement")) passed.push("engagement"); else failed.push("engagement");

    // gate 3 — EARNED proof pack
    if (isEarnedPack(pack)) passed.push("evidence"); else failed.push("evidence");

    // gate 4 — quote strictly above the L3 observed floor. No checker or no floor => not priced.
    let priceCheck = null;
    if (floorCheck && floorResult) {
      priceCheck = floorCheck(floorResult, row.key, Number.isFinite(quoteCad) ? quoteCad : NaN);
    }
    const pricedOk = !!(priceCheck && priceCheck.blocked === false && priceCheck.status === "above-floor");
    if (pricedOk) passed.push("priced"); else failed.push("priced");
    if (priceCheck && priceCheck.blocked === true && Number.isFinite(quoteCad) && quoteCad > 0) blockedByFloor += 1;

    // An integrity gap on the chain disqualifies regardless of gate count — an out-of-order artifact
    // means we do not actually know where this account stands.
    if (row.gap === true) {
      nearMisses.push({
        key: row.key,
        missing: ["integrity"],
        missingText: [INTEGRITY_GAP_TEXT],
        passed,
      });
      continue;
    }

    if (failed.length === 0) {
      const strength = evidenceStrength(row, pack);
      ready.push({
        key: row.key,
        stage: row.stage,
        evidenceClaims: strength.claims,
        stagesWithArtifact: strength.stages,
        evidenceScore: strength.score,
        quoteCad: round2(quoteCad),
        floorCad: priceCheck.floorCad,
        marginCad: round2(quoteCad - priceCheck.floorCad),
        deliveryCostCad: priceCheck.floorCad,
        artifactIds: (Array.isArray(row.reached) ? row.reached : []).map((r) => r.artifactId).filter(Boolean),
        proofPackId: pack.pilotId || null,
        gates: GATE_KEYS.slice(),
      });
    } else {
      nearMisses.push({
        key: row.key,
        missing: failed.slice(),
        missingText: failed.map(gateMissingText),
        passed,
      });
    }
  }

  // Deterministic total ordering: strongest evidence first; ties broken by the CHEAPEST observed
  // delivery cost (best margin per delivered minute), then by key. No recency, no size, no optimism.
  ready.sort((a, b) =>
    (b.evidenceScore - a.evidenceScore) ||
    (a.deliveryCostCad - b.deliveryCostCad) ||
    a.key.localeCompare(b.key)
  );
  nearMisses.sort((a, b) => (a.missing.length - b.missing.length) || a.key.localeCompare(b.key));

  // The commonest gap across near-misses — the ONE thing to go fix. Deterministic on ties (gate order).
  let commonestGap = null;
  if (nearMisses.length) {
    const tally = new Map();
    for (const nm of nearMisses) for (const m of nm.missing) tally.set(m, (tally.get(m) || 0) + 1);
    let bestKey = null; let bestCount = -1;
    for (const gk of [...GATE_KEYS, "integrity"]) {
      const c = tally.get(gk) || 0;
      if (c > bestCount) { bestCount = c; bestKey = gk; }
    }
    if (bestCount > 0) {
      commonestGap = {
        gate: bestKey,
        count: bestCount,
        text: bestKey === "integrity" ? INTEGRITY_GAP_TEXT : gateMissingText(bestKey),
      };
    }
  }

  const counts = { total: conveyor.rows.length, ready: ready.length, nearMiss: nearMisses.length, blockedByFloor };

  return {
    ...base,
    empty: ready.length === 0,
    refusal: null,
    statement: ready.length
      ? `${ready.length} account(s) are ask-ready on real artifacts. ${nearMisses.length} near-miss(es) are named with the exact artifact each is missing.`
      : EMPTY_STATEMENT + (commonestGap ? ` The single commonest gap across ${nearMisses.length} near-miss(es): ${commonestGap.text}.` : ""),
    ready,
    nearMisses,
    commonestGap,
    counts,
  };
}

export function topAskReady(queue) {
  if (!queue || queue.schema !== ASK_READY_QUEUE_SCHEMA) return null;
  return queue.ready && queue.ready.length ? queue.ready[0] : null;
}

export function askReadyQueueMarkdown(queue) {
  if (!queue || queue.schema !== ASK_READY_QUEUE_SCHEMA) return "_no ask-ready queue_";
  const lines = ["## Ask-ready queue", "", queue.refusal || queue.statement, ""];
  if (queue.ready.length) {
    lines.push("| # | Account | Evidence | Quote CAD/mo | Observed floor | Margin |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    queue.ready.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.key} | ${r.evidenceClaims} evidenced claim(s), ${r.stagesWithArtifact} stage(s) with a real artifact | ${r.quoteCad} | ${r.floorCad} | ${r.marginCad} |`);
    });
    lines.push("");
  }
  if (queue.nearMisses.length) {
    lines.push("### Near-misses — the exact artifact each one is missing");
    for (const nm of queue.nearMisses) {
      lines.push(`- **${nm.key}** — ${nm.missingText.join("; ")}`);
    }
    lines.push("");
  }
  lines.push("_Ranked by evidence strength then observed delivery cost. Never by recency, deal size, or optimism. Nothing here sends, signs, or charges._");
  return lines.join("\n") + "\n";
}
