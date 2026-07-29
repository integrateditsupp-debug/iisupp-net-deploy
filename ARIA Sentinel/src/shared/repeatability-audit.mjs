// repeatability-audit.mjs — RUN-L L2: SECOND-CUSTOMER REPEATABILITY
//
// WHY (RUN-L, 2026-07-22): a machine that only works for the first account is not a machine, it is
// a memory. L2 proves the SAME modules carry a SECOND real account with zero bespoke code and zero
// hand-derived values — and names, honestly, every value a human still had to type.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - SAME CODE, DIFFERENT RECORDS. Every account is placed by the shared L1 conveyor. This module
//     contains no per-account branch, no account name, no special case. (Static-scan locked.)
//   - NO INHERITANCE. An account with no real intake fails honestly and carries NOTHING from any
//     other account. Cross-account artifact reuse is reported as contamination, never absorbed.
//   - HAND-ENTRY IS NAMED, NOT ABSORBED. Any artifact supplied without a real upstream sourceId
//     is listed as a repeatability gap. A short list is progress; an empty claim would be a lie.
//   - IDENTICAL OUTPUT FOR TWO DIFFERENT ACCOUNTS IS A DEFECT, and is reported as one.
//   - Nothing sends, signs, or charges. No network, no spawn, no filesystem reach.
//   - Rule 15 additive: L1 conveyor and every G..K module stay read-only inputs, untouched.

import { buildConveyor, CONVEYOR_SCHEMA } from "./demand-to-ask-conveyor.mjs";

export const REPEATABILITY_SCHEMA = "repeatability-audit.v1";

// Belt-and-braces, asserted by the test.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// Two independent accounts is the minimum that can prove anything about repeatability.
export const MIN_ACCOUNTS_FOR_VERDICT = 2;

// Artifact slots the chain reads. Each must carry a real upstream sourceId to count as derived.
const TRACED_SLOTS = [
  { slot: "records", label: "engagement records" },
  { slot: "proofPack", label: "proof pack (H1)" },
  { slot: "closePacket", label: "close packet (H3)" },
  { slot: "billingHandoff", label: "billing handoff (I1)" },
  { slot: "onePageAsk", label: "one-page ask (K3)" },
  { slot: "ledger", label: "payment receipt ledger (K1)" },
];

function hasSource(x) {
  if (x === null || x === undefined) return false;
  if (Array.isArray(x)) return x.length > 0 && x.every((r) => r && typeof r.id === "string" && r.id.length > 0);
  return typeof x.sourceId === "string" && x.sourceId.length > 0;
}
function present(x) {
  if (x === null || x === undefined) return false;
  if (Array.isArray(x)) return x.length > 0;
  return typeof x === "object";
}

// Every artifact id an account's placement actually leaned on. Used to detect cross-contamination.
function artifactIdsOf(conv) {
  const ids = [];
  for (const row of conv.rows || []) {
    for (const r of row.reached || []) if (r.artifactId) ids.push(String(r.artifactId));
  }
  return ids;
}

function auditOne(account) {
  const key = account && typeof account.key === "string" && account.key.length ? account.key : null;
  const input = account && account.conveyorInput;

  if (!key) {
    return {
      key: null,
      ok: false,
      failedHonestly: true,
      refusal: "Account has no real key — refused rather than placed under a borrowed identity.",
      conveyor: null, artifactIds: [], handEntry: [], counts: null,
    };
  }

  // SAME module, no bespoke path. A missing/invalid intake returns the conveyor's own honest refusal.
  const conveyor = buildConveyor(input || {}, { now: Date.parse("1970-01-01T00:00:00Z") });
  const usable = conveyor.schema === CONVEYOR_SCHEMA && !conveyor.empty;

  const artifacts = (input && input.artifactsByKey) || {};
  const handEntry = [];
  for (const rowKey of Object.keys(artifacts)) {
    const a = artifacts[rowKey] || {};
    for (const { slot, label } of TRACED_SLOTS) {
      if (!present(a[slot])) continue;
      if (hasSource(a[slot])) continue;
      handEntry.push({ account: key, row: rowKey, slot, label,
        why: "supplied directly with no upstream sourceId — a human still has to re-derive this per account" });
    }
  }

  return {
    key,
    ok: usable,
    failedHonestly: !usable,
    refusal: usable ? null : (conveyor.refusal || "No real records for this account — reported empty, never filled from another account."),
    conveyor,
    artifactIds: usable ? artifactIdsOf(conveyor) : [],
    handEntry,
    counts: usable ? conveyor.counts : null,
  };
}

/**
 * input: { accounts: [ { key, conveyorInput } ] }
 * Returns repeatability-audit.v1 — honest, staged-only, never sends.
 */
export function auditRepeatability(input = {}, { now = Date.now() } = {}) {
  const accounts = Array.isArray(input && input.accounts) ? input.accounts : [];
  const base = {
    schema: REPEATABILITY_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
  };

  const results = accounts.map(auditOne);
  const produced = results.filter((r) => r.ok);

  // Cross-contamination: the same real artifact id leaned on by two different accounts.
  const seen = new Map();
  const contamination = [];
  for (const r of produced) {
    for (const id of r.artifactIds) {
      if (seen.has(id) && seen.get(id) !== r.key) {
        contamination.push({ artifactId: id, accounts: [seen.get(id), r.key],
          why: "one artifact cannot belong to two accounts — the second account inherited the first's evidence" });
      } else if (!seen.has(id)) {
        seen.set(id, r.key);
      }
    }
  }

  // Two different accounts must not produce byte-identical placements.
  const identicalOutputs = [];
  for (let i = 0; i < produced.length; i += 1) {
    for (let j = i + 1; j < produced.length; j += 1) {
      const a = JSON.stringify(produced[i].conveyor.rows);
      const b = JSON.stringify(produced[j].conveyor.rows);
      if (a === b) {
        identicalOutputs.push({ accounts: [produced[i].key, produced[j].key],
          why: "identical placement for two different accounts — output is not actually account-specific" });
      }
    }
  }

  const handEntry = results.flatMap((r) => r.handEntry);

  let verdict;
  if (produced.length < MIN_ACCOUNTS_FOR_VERDICT) {
    verdict = "not-enough-accounts";
  } else if (contamination.length || identicalOutputs.length) {
    verdict = "not-repeatable";
  } else {
    verdict = handEntry.length ? "repeatable-with-hand-entry" : "repeatable";
  }

  const statement =
    verdict === "not-enough-accounts"
      ? `Cannot be stated: ${produced.length} account(s) produced real output; repeatability needs ${MIN_ACCOUNTS_FOR_VERDICT}.`
      : verdict === "not-repeatable"
        ? "NOT repeatable: an account inherited another account's data or produced a non-specific placement. Named below."
        : verdict === "repeatable-with-hand-entry"
          ? `Repeatable — same modules, different records, honest output for ${produced.length} accounts — but ${handEntry.length} value(s) still require hand entry. Named below, not absorbed.`
          : `Repeatable — same modules, different records, honest output for ${produced.length} accounts, zero hand-derived values.`;

  return {
    ...base,
    verdict,
    statement,
    accountsIn: accounts.length,
    accountsProduced: produced.length,
    accountsRefused: results.filter((r) => r.failedHonestly).map((r) => ({ key: r.key, refusal: r.refusal })),
    results,
    contamination,
    identicalOutputs,
    handEntry,
  };
}

export function repeatabilityMarkdown(rep) {
  if (!rep || rep.schema !== REPEATABILITY_SCHEMA) return "_no repeatability audit_";
  const lines = ["## Second-customer repeatability", "", `**${rep.verdict}** — ${rep.statement}`, ""];
  for (const r of rep.results) {
    if (!r.ok) { lines.push(`- **${r.key || "(no key)"}** — refused honestly: ${r.refusal}`); continue; }
    const c = r.counts;
    lines.push(`- **${r.key}** — ${c.total} row(s): ${c["not-started"]} not started · ${c["mid-chain"]} mid-chain · ${c["ask-ready"]} ask-ready · ${c.paid} paid`);
  }
  if (rep.contamination.length) {
    lines.push("", "### Contamination (must fix)");
    for (const x of rep.contamination) lines.push(`- \`${x.artifactId}\` shared by ${x.accounts.join(" + ")} — ${x.why}`);
  }
  if (rep.identicalOutputs.length) {
    lines.push("", "### Non-specific output (must fix)");
    for (const x of rep.identicalOutputs) lines.push(`- ${x.accounts.join(" + ")} — ${x.why}`);
  }
  lines.push("", "### Hand-entry still required");
  if (!rep.handEntry.length) lines.push("- none recorded.");
  for (const h of rep.handEntry) lines.push(`- ${h.account} / ${h.row} — ${h.label}: ${h.why}`);
  lines.push("", "_Read-only audit. Nothing here sends, signs, or charges._");
  return lines.join("\n") + "\n";
}
