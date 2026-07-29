// demand-to-ask-conveyor.mjs — RUN-L L1: DEMAND-TO-ASK CONVEYOR
//
// WHY (RUN-L, 2026-07-22): eleven runs of machinery exist (G..K). Each demand record must be
// placed on the SAME K-chain and reported at exactly where a REAL artifact proves it stands —
// with the ONE next real step. Repeatability, not re-derivation. Rule 14 real-or-empty:
// a stage advances ONLY on the existence of a real artifact (schema + earned/rendered/produced/
// verified flag). Never on elapsed time. Never on optimism. A record with nothing real behind it
// past intake is reported "not started", never "in progress".
//
// STRUCTURALLY INCAPABLE OF SENDING (static-scan locked, as H3/K3): this module has no network,
// no mail, no outward call, no child process. It only READS real artifacts and REPORTS staged
// next steps. tests/l1-demand-to-ask-conveyor.test.mjs static-scans this source for that class.

export const CONVEYOR_SCHEMA = "demand-to-ask-conveyor.v1";

// Nothing this module produces is ever executed by it. Belt-and-braces flags, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// The K-chain, in order. Each stage advances ONLY when its `proof` predicate finds a real artifact.
export const CHAIN = [
  { key: "engagement", label: "First recorded engagement",
    from: "record a real engagement/delivery event for this account (id + timestamp) — never backdate one",
    proof: (a) => firstEngagement(a) !== null },
  { key: "evidence", label: "Evidence earned",
    from: "earn a proof pack (H1) — an EARNED proof-pack.v1, not a claimed one",
    proof: (a) => isEarnedProofPack(a.proofPack) },
  { key: "packet", label: "Close packet rendered",
    from: "render the close packet (H3) — a RENDERED close-packet.v1",
    proof: (a) => isRendered(a.closePacket, "close-packet.v1") },
  { key: "handoff", label: "Billing handoff produced",
    from: "produce the billing handoff (I1) — a PRODUCED billing-handoff.v1",
    proof: (a) => isProduced(a.billingHandoff, "billing-handoff.v1") },
  { key: "ask", label: "One-page ask rendered",
    from: "render the one-page ask (K3) — a RENDERED one-page-ask.v1 (stages for your click; nothing sends)",
    proof: (a) => isRendered(a.onePageAsk, "one-page-ask.v1") },
  { key: "payment", label: "Payment received",
    from: "record the verified receipt (K1) when the money actually lands — never before",
    proof: (a) => hasVerifiedReceiptFor(a) },
];

const STAGE_KEYS = CHAIN.map((s) => s.key);

function firstEngagement(a) {
  const recs = Array.isArray(a && a.records) ? a.records : [];
  let earliest = null;
  for (const r of recs) {
    if (!r || !r.id) continue;
    const t = Date.parse(r.at);
    if (Number.isNaN(t)) continue;
    if (earliest === null || t < earliest.t) earliest = { t, id: r.id };
  }
  if (a && a.engagementStartedAt) {
    const t = Date.parse(a.engagementStartedAt);
    if (!Number.isNaN(t) && (earliest === null || t < earliest.t)) earliest = { t, id: "engagementStartedAt" };
  }
  return earliest;
}
function isEarnedProofPack(p) { return !!(p && p.schema === "proof-pack.v1" && p.earned === true); }
function isRendered(x, schema) { return !!(x && x.schema === schema && x.rendered === true); }
function isProduced(x, schema) { return !!(x && x.schema === schema && x.produced === true); }
function hasVerifiedReceiptFor(a) {
  const l = a && a.ledger;
  if (!l || l.schema !== "payment-receipt-ledger.v1") return false;
  return Array.isArray(l.verified) && l.verified.length > 0;
}

function artifactIdFor(a, stageKey) {
  switch (stageKey) {
    case "engagement": { const e = firstEngagement(a); return e ? e.id : null; }
    case "evidence": return a.proofPack && (a.proofPack.pilotId ? "proof-pack:" + a.proofPack.pilotId : "proof-pack");
    case "packet": return a.closePacket && ("close-packet:" + (a.closePacket.customer || "?"));
    case "handoff": return a.billingHandoff && ("billing-handoff:" + (a.billingHandoff.customer || "?"));
    case "ask": return a.onePageAsk && ("one-page-ask:" + (a.onePageAsk.customer || "?"));
    case "payment": {
      const r = a.ledger && a.ledger.verified && a.ledger.verified[0];
      return r ? r.id + " (" + r.processor + " ref " + r.reference + ")" : null;
    }
    default: return null;
  }
}

// Honest contiguity: a stage is REACHED only if it and every prior stage have a real artifact.
// A downstream artifact on top of a missing upstream one is a GAP, reported at the break.
function placeRow(row, artifacts) {
  const a = artifacts && typeof artifacts === "object" ? artifacts : {};
  const reached = [];
  let brokeAt = null;
  let gap = false;

  for (const stage of CHAIN) {
    const real = stage.proof(a);
    if (real && brokeAt === null) {
      reached.push({ key: stage.key, label: stage.label, artifactId: artifactIdFor(a, stage.key) });
      continue;
    }
    if (!real && brokeAt === null) { brokeAt = stage; continue; }
    if (real && brokeAt !== null) { gap = true; }
  }

  const stageKey = reached.length ? reached[reached.length - 1].key : "intake";
  const started = reached.length > 0;
  const paid = reached.some((r) => r.key === "payment");
  const askReady = !paid && reached.some((r) => r.key === "ask");

  let bucket;
  if (!started) bucket = "not-started";
  else if (paid) bucket = "paid";
  else if (askReady) bucket = "ask-ready";
  else bucket = "mid-chain";

  const nextStage = brokeAt;
  const nextStep = paid
    ? { stage: null, label: "Paid. Nothing to advance on this chain — move this account to renewal/repeat, honestly.", staged: true, executed: false }
    : nextStage
      ? { stage: nextStage.key, label: nextStage.from + (gap ? " — and reconcile the out-of-order artifact above it (integrity gap)" : ""), staged: true, executed: false }
      : { stage: null, label: "All chain stages have a real artifact but no verified payment — record the receipt only when money lands.", staged: true, executed: false };

  return {
    key: row.key,
    ids: Array.isArray(row.ids) ? row.ids.slice() : [],
    qualified: !!row.qualified,
    stage: stageKey,
    bucket,
    reached,
    gap,
    nextStep,
  };
}

// input: { intake } (demand-intake.v1) + artifactsByKey: { [demandKey]: {records, engagementStartedAt,
//         proofPack, closePacket, billingHandoff, onePageAsk, ledger} }
export function buildConveyor(input = {}, { now = Date.now() } = {}) {
  const intake = input && input.intake && input.intake.schema === "demand-intake.v1" ? input.intake : null;
  const artifactsByKey = input && input.artifactsByKey && typeof input.artifactsByKey === "object" ? input.artifactsByKey : {};

  const base = {
    schema: CONVEYOR_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
  };

  if (!intake) {
    return { ...base, empty: true, refusal: "No real demand-intake.v1 record — the conveyor reports nothing rather than invent a pipeline.", rows: [], counts: emptyCounts() };
  }

  const sourceRows = Array.isArray(intake.rows) ? intake.rows : [];
  const rows = sourceRows.map((r) => placeRow(r, artifactsByKey[r.key]));

  const counts = emptyCounts();
  for (const r of rows) counts[r.bucket] += 1;
  counts.total = rows.length;
  counts.gaps = rows.filter((r) => r.gap).length;

  const order = { paid: 0, "ask-ready": 1, "mid-chain": 2, "not-started": 3 };
  rows.sort((a, b) =>
    (order[a.bucket] - order[b.bucket]) ||
    (Number(b.qualified) - Number(a.qualified)) ||
    a.key.localeCompare(b.key)
  );

  return { ...base, empty: rows.length === 0, refusal: null, rows, counts };
}

function emptyCounts() {
  return { total: 0, "not-started": 0, "mid-chain": 0, "ask-ready": 0, paid: 0, gaps: 0 };
}

export function conveyorMarkdown(conv) {
  if (!conv || conv.schema !== CONVEYOR_SCHEMA) return "_no conveyor_";
  if (conv.empty) return "## Demand-to-ask conveyor\n\n" + (conv.refusal || "_nothing on the chain yet._") + "\n";
  const c = conv.counts;
  const lines = [
    "## Demand-to-ask conveyor",
    "",
    `_${c.total} account(s): ${c["not-started"]} not started · ${c["mid-chain"]} mid-chain · ${c["ask-ready"]} ask-ready · ${c.paid} paid_` +
      (c.gaps ? ` · **${c.gaps} integrity gap(s)**` : ""),
    "",
  ];
  for (const r of conv.rows) {
    lines.push(`- **${r.key}** — ${r.bucket} (at: ${r.stage})${r.gap ? " ⚠ gap" : ""}`);
    lines.push(`  - next: ${r.nextStep.label}`);
  }
  lines.push("");
  lines.push("_Staged only. This conveyor cannot send, sign, or charge — it reports the next real step for a human one-click._");
  return lines.join("\n") + "\n";
}

export { STAGE_KEYS };
