// ask-dashboard.mjs — RUN-N N3: THE ASK DASHBOARD (operator-internal)
//
// WHY (RUN-N, 2026-07-28): the ask state lives in three places — M1 says who is ready, M2 says what
// is staged, M3 says what came back. An operator asking "where are we on revenue?" should not have
// to join three objects in their head at 1am. N3 is one honest screen model.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - ZERO IS RENDERED AS ZERO, IN M3'S OWN WORDS. ZERO_SENT_STATEMENT and NO_REVENUE_STATEMENT are
//     IMPORTED, never re-worded, so the dashboard can never soften what the ledger says.
//   - NO EMPTY-STATE THAT IMPLIES MOMENTUM. No "warming up", no "in motion", no counting staged
//     packets as sent, no counting near-misses as pipeline. Staged is its own number, always.
//   - EVERYONE WHO IS NOT READY IS LISTED WITH WHAT THEY ARE MISSING, in M1's gate vocabulary.
//   - OPERATOR-INTERNAL BY CONSTRUCTION. `internalOnly: true` and `publicSafe: false` are asserted
//     by the test; this model is never mirrored into `.well-known` — public status stays
//     headline-only. A helper is provided that produces the headline and nothing else.
//   - Rule 15 additive: reads M1/M2/M3 outputs, mutates nothing, replaces nothing.
//   - Nothing sends, signs, charges, or reaches the network/filesystem.

import { GATE_KEYS } from "./ask-ready-queue.mjs";
import { ZERO_SENT_STATEMENT, NO_REVENUE_STATEMENT, OUTCOMES, OUTCOME_LABELS } from "./ask-ledger.mjs";

export const ASK_DASHBOARD_SCHEMA = "ask-dashboard.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// This view is behind operator auth. It is never written to a serveable path.
export const INTERNAL_ONLY = true;
export const PUBLIC_SAFE = false;

export const EMPTY_HEADLINE = "No asks. Nothing ready, nothing staged, nothing sent.";

export { ZERO_SENT_STATEMENT, NO_REVENUE_STATEMENT };

function num(n) { return Number.isFinite(Number(n)) ? Number(n) : 0; }

/**
 * input: {
 *   queue,     // ask-ready-queue.v1 from M1
 *   packets,   // [ send-packet.v1 | refused-packet ] from M2 — staged, never sent
 *   ledger,    // ask-ledger.v1 from M3
 * }
 */
export function buildAskDashboard(input = {}, { now = Date.now() } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const queue = src.queue && src.queue.schema === "ask-ready-queue.v1" ? src.queue : null;
  const ledger = src.ledger && src.ledger.schema === "ask-ledger.v1" ? src.ledger : null;
  const packets = Array.isArray(src.packets) ? src.packets.filter((p) => p && typeof p === "object") : [];

  // --- ready (M1) ------------------------------------------------------------------------------
  const ready = queue && Array.isArray(queue.ready)
    ? queue.ready.map((r) => ({
        key: r.key,
        quoteCad: r.quoteCad,
        floorCad: r.floorCad,
        marginCad: r.marginCad,
        evidenceScore: r.evidenceScore,
        gates: Array.isArray(r.gates) ? r.gates.slice() : GATE_KEYS.slice(),
      }))
    : [];

  // --- not ready (M1 near-misses) — everyone, with what they are missing ------------------------
  const notReady = queue && Array.isArray(queue.nearMisses)
    ? queue.nearMisses.map((n) => ({
        key: n.key,
        missing: Array.isArray(n.missing) ? n.missing.slice() : [],
        missingText: Array.isArray(n.missingText) ? n.missingText.slice() : [],
      }))
    : [];

  // --- staged (M2) — its own number. A staged packet is NOT a sent ask. -------------------------
  const staged = packets
    .filter((p) => p.schema === "send-packet.v1" && p.refused !== true && p.packet)
    .map((p) => ({ account: (p.packet && p.packet.account) || null, staged: true, sent: false }));
  const refusedPackets = packets
    .filter((p) => p.refused === true)
    .map((p) => ({
      account: (p.packet && p.packet.account) || null,
      missing: Array.isArray(p.missing) ? p.missing.slice() : [],
      missingText: Array.isArray(p.missingText) ? p.missingText.slice() : [],
    }));

  // --- sent + outcomes (M3) ---------------------------------------------------------------------
  // Read the ledger's OWN counts and its OWN ask rows. Nothing is recomputed from a friendlier angle.
  const lc = (ledger && ledger.counts && typeof ledger.counts === "object") ? ledger.counts : {};
  const ledgerAsks = ledger && Array.isArray(ledger.asks) ? ledger.asks : [];
  const sentCount = num(lc.sent);
  const paidCount = num(lc.paid);
  const outcomeCounts = {};
  for (const o of OUTCOMES) outcomeCounts[o] = ledgerAsks.filter((a) => a && a.outcome === o).length;
  const unsubstantiated = num(lc.unsubstantiatedPaidClaims);

  // --- the honest headline ----------------------------------------------------------------------
  const nothingAnywhere = ready.length === 0 && staged.length === 0 && sentCount === 0;
  const sentLine = sentCount === 0 ? ZERO_SENT_STATEMENT : `${sentCount} ask(s) sent.`;
  const revenueLine = paidCount === 0 ? NO_REVENUE_STATEMENT : `${paidCount} paid on verified receipts.`;

  const headline = nothingAnywhere
    ? EMPTY_HEADLINE
    : `${ready.length} ready · ${staged.length} staged · ${sentCount} sent · ${paidCount} paid.`;

  return {
    schema: ASK_DASHBOARD_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    internalOnly: INTERNAL_ONLY,
    publicSafe: PUBLIC_SAFE,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    headline,
    sentStatement: sentLine,
    revenueStatement: revenueLine,
    ready,
    notReady,
    staged,
    refusedPackets,
    outcomes: outcomeCounts,
    outcomeLabels: { ...OUTCOME_LABELS },
    counts: {
      ready: ready.length,
      notReady: notReady.length,
      staged: staged.length,
      refused: refusedPackets.length,
      sent: sentCount,
      paid: paidCount,
      unsubstantiated,
      stagedNotSent: num(lc.stagedNotSent),
    },
    commonestGap: (queue && queue.commonestGap) || null,
  };
}

/**
 * The ONLY thing that may ever leave this module for a public surface: a headline with no account
 * names, no quotes, no gaps, no recipients. Public status stays headline-only.
 */
export function askDashboardPublicHeadline(dash) {
  if (!dash || dash.schema !== ASK_DASHBOARD_SCHEMA) return null;
  return {
    schema: "ask-dashboard-headline.v1",
    generatedAt: dash.generatedAt,
    headline: dash.headline,
    sentStatement: dash.sentStatement,
    revenueStatement: dash.revenueStatement,
    publicSafe: true,
  };
}

export function askDashboardMarkdown(dash) {
  if (!dash || dash.schema !== ASK_DASHBOARD_SCHEMA) return "_no dashboard_";
  const lines = ["## Asks — operator view (internal only)", "", dash.headline, "", dash.sentStatement, dash.revenueStatement, ""];

  lines.push("### Ready to ask", "");
  if (!dash.ready.length) lines.push("_none. Nothing is dressed up as nearly ready._", "");
  for (const r of dash.ready) lines.push(`- ${r.key} — ${r.quoteCad} CAD (floor ${r.floorCad}, margin ${r.marginCad})`);

  lines.push("", "### Staged, awaiting a human click", "");
  if (!dash.staged.length) lines.push("_none staged._", "");
  for (const s of dash.staged) lines.push(`- ${s.account || "(unnamed)"} — staged, not sent`);

  lines.push("", "### Not ready — what each one is missing", "");
  if (!dash.notReady.length) lines.push("_no accounts on the chain._", "");
  for (const n of dash.notReady) lines.push(`- ${n.key}: ${n.missingText.join("; ")}`);

  lines.push("", "### Outcomes", "");
  for (const o of OUTCOMES) lines.push(`- ${dash.outcomeLabels[o]}: ${dash.outcomes[o]}`);
  if (dash.counts.unsubstantiated > 0) lines.push(`- refused as unsubstantiated: ${dash.counts.unsubstantiated}`);
  lines.push("");
  return lines.join("\n");
}
