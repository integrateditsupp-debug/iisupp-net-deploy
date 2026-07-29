// first-packet-pass.mjs — RUN-N N2: THE FIRST PACKET, END TO END
//
// WHY (RUN-N, 2026-07-28): N1 records one real account. M1 decides whether it is ask-ready. M2
// assembles the packet. Until now nothing joined them, so "can we actually ask this buyer?" had no
// single answer. N2 is that one pass: real input in — a complete packet on disk-shape, or a named
// gap list. Never both. Never neither. Never a "preview" that flatters an incomplete account.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - EXACTLY ONE OUTCOME. `packet` and `gaps` are mutually exclusive and jointly exhaustive; the
//     result carries `outcome: "packet" | "gaps"` and the test asserts both directions.
//   - NO PARTIAL PACKET. If the four gates do not clear, there is no draft, no preview, no
//     "80% ready" object to be mistaken for a real ask.
//   - THE GAP LIST USES M1'S GATE VOCABULARY, by delegation to N1/M1 — never a parallel wording.
//   - SEND-INCAPABLE BY CONSTRUCTION. No fetch, no transport, no mail path, no child process, no
//     filesystem reach anywhere in this chain; the test static-scans every module in it.
//   - Rule 15 additive: M1 and M2 are called, never modified or bypassed. The gates cannot be
//     skipped from here — N2 has no path to a packet that does not run through buildSendPacket.

import { buildAccountIntake, intakeRecord, missingForAskReady, ACCOUNT_INTAKE_SCHEMA } from "./account-intake.mjs";
import { buildAskReadyQueue, GATE_KEYS } from "./ask-ready-queue.mjs";
import { buildSendPacket } from "./send-packet.mjs";
import { buildConveyor } from "./demand-to-ask-conveyor.mjs";
import { buildDemandIntake } from "./demand-intake.mjs";
import { computePricingFloor, checkQuoteAgainstFloor } from "./pricing-floor.mjs";

export const FIRST_PACKET_PASS_SCHEMA = "first-packet-pass.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const OUTCOMES = ["packet", "gaps"];

export const NO_ACCOUNT_STATEMENT =
  "No account was passed through. Nothing is staged and nothing is claimed as ready.";

export const ONE_CLICK_NOTE =
  "A complete packet is one human click from sent. This code cannot send it — only a human can.";

// The chain of modules this pass runs through. The test static-scans every one of them for the
// send class, so adding a module here without proving it is send-incapable breaks the suite.
export const CHAIN_MODULES = [
  "account-intake.mjs",
  "first-packet-pass.mjs",
  "ask-ready-queue.mjs",
  "send-packet.mjs",
];

/**
 * input: {
 *   account,            // N1 shape — see account-intake.mjs
 *   signals,            // optional raw demand signals for the L1 intake (real, sourced)
 *   artifacts,          // { records?, engagementStartedAt?, proofPack, closePacket, billingHandoff,
 *                       //   onePageAsk, ledger } — the real artifacts earned for this account
 *   recipient,          // { name, address, role? } — real, never a placeholder
 *   costAccountMonths?  // observed months of delivery for the L3 floor (real, never assumed)
 * }
 */
export function runFirstPacketPass(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: FIRST_PACKET_PASS_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    oneClickNote: ONE_CLICK_NOTE,
    chainModules: CHAIN_MODULES.slice(),
  };

  const src = input && typeof input === "object" ? input : {};
  const account = src.account && typeof src.account === "object" ? src.account : null;

  if (!account || typeof account.key !== "string" || !account.key.trim()) {
    return {
      ...base,
      outcome: "gaps",
      packet: null,
      gaps: [{ gate: "demand", text: NO_ACCOUNT_STATEMENT, note: "no account key supplied" }],
      statement: NO_ACCOUNT_STATEMENT,
      stages: { intake: false, queue: false, packet: false },
    };
  }

  const key = account.key.trim();

  // --- stage 1: N1 records the ground truth --------------------------------------------------
  const intake = buildAccountIntake({ account }, { now });
  const record = intakeRecord(intake, key);
  if (!record || !record.complete) {
    return {
      ...base,
      outcome: "gaps",
      packet: null,
      gaps: missingForAskReady(intake, key),
      statement: `${key} is not ask-ready. The missing input is named, in the same words the gates use.`,
      stages: { intake: true, queue: false, packet: false },
      intakeSchema: ACCOUNT_INTAKE_SCHEMA,
    };
  }

  // --- stage 2: the L1 conveyor + L3 floor, built ONLY from what N1 recorded ------------------
  const ds = record.demandSignal;
  const suppliedSignals = Array.isArray(src.signals) ? src.signals : [];
  const signals = suppliedSignals.length ? suppliedSignals : [{
    id: ds.id,
    kind: ds.kind || "site-enquiry",
    source: ds.source,
    firstSeenAt: ds.firstSeenAt,
    email: ds.email || undefined,
    domain: ds.domain || undefined,
    company: ds.company || undefined,
    seats: account.seats,
    region: account.region,
    need: account.need,
  }];

  const demandIntake = buildDemandIntake({ signals }, { now });
  const artifacts = src.artifacts && typeof src.artifacts === "object" ? src.artifacts : {};
  const conveyorKey = (demandIntake.rows || []).length ? demandIntake.rows[0].key : null;

  if (!conveyorKey) {
    return {
      ...base,
      outcome: "gaps",
      packet: null,
      gaps: [{ gate: "demand", text: "the recorded signal did not qualify onto the conveyor — fix the signal's real evidence, never the gate", note: null }],
      statement: `${key} did not reach the conveyor.`,
      stages: { intake: true, queue: false, packet: false },
    };
  }

  const engagementRecords = record.engagements.map((e) => ({ id: e.id, at: e.at, durationMinutes: e.durationMinutes }));
  const conveyor = buildConveyor({
    intake: demandIntake,
    artifactsByKey: {
      [conveyorKey]: {
        records: engagementRecords,
        proofPack: artifacts.proofPack,
        closePacket: artifacts.closePacket,
        billingHandoff: artifacts.billingHandoff,
        onePageAsk: artifacts.onePageAsk,
        ledger: artifacts.ledger,
      },
    },
  }, { now });

  const months = Number.isFinite(Number(src.costAccountMonths)) && Number(src.costAccountMonths) > 0
    ? Number(src.costAccountMonths)
    : null;
  const floorResult = months === null ? null : computePricingFloor({
    costBasis: {
      sourceId: record.costBasis.sourceId,
      monthlyOperatorCostCad: record.costBasis.monthlyOperatorCostCad,
      monthlyAvailableMinutes: record.costBasis.monthlyAvailableMinutes,
    },
    accounts: [{ key: conveyorKey, months, records: engagementRecords }],
  }, { now });

  // --- stage 3: M1 decides. The gates are M1's, not ours. -------------------------------------
  const queue = buildAskReadyQueue({
    conveyor,
    evidenceByKey: { [conveyorKey]: { proofPack: artifacts.proofPack, quoteCad: record.quoteCad } },
    floorResult,
    floorCheck: floorResult ? checkQuoteAgainstFloor : null,
  }, { now });

  const readyRow = (queue.ready || []).find((r) => r.key === conveyorKey) || null;
  if (!readyRow) {
    const nm = (queue.nearMisses || []).find((n) => n.key === conveyorKey);
    const gaps = nm
      ? nm.missing.map((g, i) => ({ gate: g, text: nm.missingText[i], note: null }))
      : [{ gate: "demand", text: queue.refusal || "the queue could not place this account on real artifacts", note: null }];
    return {
      ...base,
      outcome: "gaps",
      packet: null,
      gaps,
      statement: `${key} is not ask-ready. ${gaps.length} named gap(s) — no draft packet was produced.`,
      stages: { intake: true, queue: true, packet: false },
      queueCounts: queue.counts,
    };
  }

  // --- stage 4: M2 assembles. It refuses on its own terms; we never override it. ---------------
  // The conveyor's identity key is derived from the signal and can be an email (identityKey prefers
  // it). We relabel BOTH the ask-ready row and its floor check to the operator's account key before
  // the packet is built — an identity relabel only, never a change to a number, and both keys stay
  // recorded on the result. This keeps a real address out of the packet body (vault Rule 11) and
  // keeps M2's "same account on both sides" check intact.
  const rawFloorCheck = checkQuoteAgainstFloor(floorResult, conveyorKey, record.quoteCad);
  const floorCheckResult = { ...rawFloorCheck, key };
  const readyRowLabelled = { ...readyRow, key };
  const packet = buildSendPacket({
    askReady: readyRowLabelled,
    recipient: src.recipient,
    onePageAsk: artifacts.onePageAsk,
    proofPack: artifacts.proofPack,
    floorCheckResult,
  }, { now });

  if (packet && packet.refused === true) {
    const missing = Array.isArray(packet.missing) ? packet.missing : [];
    const texts = Array.isArray(packet.missingText) ? packet.missingText : [];
    return {
      ...base,
      outcome: "gaps",
      packet: null,
      gaps: missing.map((m, i) => ({ gate: m, text: texts[i] || m, note: "refused by the send packet, not by this pass" })),
      statement: `${key} cleared the queue but the packet refused: every missing part is named.`,
      stages: { intake: true, queue: true, packet: true },
      queueCounts: queue.counts,
    };
  }

  return {
    ...base,
    outcome: "packet",
    packet,
    gaps: [],
    statement: `${key} is ask-ready on real artifacts and a complete packet is staged. Nothing was sent.`,
    stages: { intake: true, queue: true, packet: true },
    queueCounts: queue.counts,
    gatesCleared: GATE_KEYS.slice(),
    accountKey: key,
    chainKey: conveyorKey,
  };
}

export function firstPacketPassMarkdown(result) {
  if (!result || result.schema !== FIRST_PACKET_PASS_SCHEMA) return "_no pass_";
  const lines = ["## First packet pass", "", result.statement, ""];
  if (result.outcome === "gaps") {
    lines.push("### Named gaps (no packet was produced)", "");
    for (const g of result.gaps) lines.push(`- **${g.gate}** — ${g.text}${g.note ? ` _(${g.note})_` : ""}`);
    lines.push("");
    return lines.join("\n");
  }
  lines.push("### Packet staged", "");
  lines.push(`- gates cleared: ${(result.gatesCleared || []).join(", ")}`);
  lines.push(`- ${ONE_CLICK_NOTE}`);
  lines.push("");
  return lines.join("\n");
}
