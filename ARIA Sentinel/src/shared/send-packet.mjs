// send-packet.mjs — RUN-M M2: THE SEND PACKET, ONE CLICK FROM SENT
//
// WHY (RUN-M, 2026-07-28): M1 says WHO is genuinely ask-ready. M2 assembles everything a real send
// needs into ONE reviewable packet — and then stops dead. The distance from here to revenue is a
// human reading it and clicking send. That click is Ahmad's and only Ahmad's.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - STRUCTURALLY INCAPABLE OF SENDING. No transport, no network, no mail client, no child process,
//     no filesystem reach. The packet is a returned object. Static-scan locked by the test.
//   - EVERY CLAIM TRACES TO A REAL IN-REPO ARTIFACT. A claim with no artifact behind it is OMITTED —
//     never softened, never estimated, never rewritten as a range.
//   - A MISSING ARTIFACT PRODUCES A REFUSAL THAT NAMES THE GAP. Never a partial packet passed off
//     as complete, never a placeholder recipient, never a "TBD" price.
//   - THE FLOOR CHECK IS SHOWN, NOT HIDDEN. The buyer-facing quote carries the cost basis behind it
//     so the price is defensible in the room, not just in a spreadsheet.
//   - Rule 15 additive: M1 queue, K3 ask, H1 pack and L3 floor are read-only inputs, untouched.
//   - Rule 17 value-first: the packet leads with what the buyer gets, then the evidence, then price.

export const SEND_PACKET_SCHEMA = "send-packet.v1";

// Belt-and-braces, asserted by the test. Nothing here ever flips true inside this module.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

export const REFUSAL_PREFIX = "Send packet refused - missing real input:";

export const ONE_CLICK_NOTE =
  "STAGED ONLY. This packet cannot send, sign, or charge. It exists so a human can read it once and " +
  "then send it themselves. Nothing leaves this machine without that click.";

export const TRACE_NOTE =
  "Every line below traces to a real artifact id in this repo. Anything we could not evidence was " +
  "left out rather than softened.";

// The parts a real send needs. Each names the exact artifact it wants when it is absent.
export const REQUIRED_PARTS = [
  { key: "askReady", label: "Ask-ready record (M1)",
    missing: "no ask-ready record from the M1 queue — an account that has not cleared all four gates is not a send" },
  { key: "recipient", label: "Exact recipient",
    missing: "no exact recipient (real name + real address) — we never stage a send to a placeholder" },
  { key: "onePageAsk", label: "One-page ask (K3)",
    missing: "no RENDERED one-page-ask.v1 — render the ask before staging a send" },
  { key: "proofPack", label: "Proof pack (H1)",
    missing: "no EARNED proof-pack.v1 — evidence is what makes the ask defensible; a claimed pack is not evidence" },
  { key: "quote", label: "Priced quote with its floor check (L3)",
    missing: "no quote that clears the observed delivery floor with the check shown — price it above the floor first" },
];

export const PART_KEYS = REQUIRED_PARTS.map((p) => p.key);

function partMissingText(key) {
  const p = REQUIRED_PARTS.find((x) => x.key === key);
  return p ? p.missing : "unknown part";
}

function isAskReadyRow(r) {
  return !!(r && typeof r.key === "string" && r.key.length
    && Number.isFinite(r.quoteCad) && Number.isFinite(r.floorCad)
    && Array.isArray(r.artifactIds));
}
// A recipient is real only when BOTH a human name and a routable address exist. No inference.
function isRealRecipient(x) {
  if (!x || typeof x !== "object") return false;
  const name = typeof x.name === "string" ? x.name.trim() : "";
  const address = typeof x.address === "string" ? x.address.trim() : "";
  if (name.length < 2 || address.length < 5) return false;
  if (!address.includes("@")) return false;
  if (/^(tbd|todo|placeholder|unknown|n\/a)$/i.test(name)) return false;
  return true;
}
function isRenderedAsk(a) { return !!(a && a.schema === "one-page-ask.v1" && a.rendered === true); }
function isEarnedPack(p) {
  return !!(p && p.schema === "proof-pack.v1" && p.earned === true && Array.isArray(p.claims) && p.claims.length > 0);
}
function round2(n) { return Math.round(n * 100) / 100; }

// Claims survive into the packet ONLY if they carry evidence that names a record. Everything else
// is dropped and counted, so the omission is visible rather than silent.
function traceableClaims(pack) {
  const kept = [];
  const omitted = [];
  for (const c of (isEarnedPack(pack) ? pack.claims : [])) {
    const ids = Array.isArray(c && c.recordIds) ? c.recordIds.filter((i) => typeof i === "string" && i.length) : [];
    const label = typeof (c && c.label) === "string" && c.label.trim() ? c.label.trim() : null;
    const value = (c && c.value !== undefined && c.value !== null) ? c.value : null;
    if (!label || value === null || ids.length === 0) {
      omitted.push({ label: label || "(unlabelled claim)", why: "no record id behind it — omitted rather than softened" });
      continue;
    }
    kept.push({ label, value, recordIds: ids.slice() });
  }
  return { kept, omitted };
}

/**
 * input: {
 *   askReady,     // one row from the M1 queue (ask-ready-queue.v1 ready[])
 *   recipient,    // { name, address, role? } — real, never a placeholder
 *   onePageAsk,   // K3 one-page-ask.v1, rendered
 *   proofPack,    // H1 proof-pack.v1, earned
 *   floorCheckResult  // L3 checkQuoteAgainstFloor output for this account
 * }
 */
export function buildSendPacket(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: SEND_PACKET_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    staged: true,
    executed: false,
    oneClickNote: ONE_CLICK_NOTE,
  };

  const src = input && typeof input === "object" ? input : {};
  const askReady = src.askReady;
  const recipient = src.recipient;
  const ask = src.onePageAsk;
  const pack = src.proofPack;
  const check = src.floorCheckResult;

  const missing = [];
  if (!isAskReadyRow(askReady)) missing.push("askReady");
  if (!isRealRecipient(recipient)) missing.push("recipient");
  if (!isRenderedAsk(ask)) missing.push("onePageAsk");
  if (!isEarnedPack(pack)) missing.push("proofPack");

  const quoteOk = !!(check && check.blocked === false && check.status === "above-floor"
    && Number.isFinite(check.quoteCad) && Number.isFinite(check.floorCad));
  if (!quoteOk) missing.push("quote");

  if (missing.length) {
    return {
      ...base,
      refused: true,
      packet: null,
      missing,
      missingText: missing.map(partMissingText),
      refusal: REFUSAL_PREFIX + " " + missing.map(partMissingText).join("; ") + ".",
    };
  }

  // The account on the ask must be the account we priced. A mismatch is a refusal, not a fixup.
  if (String(check.key) !== String(askReady.key)) {
    return {
      ...base,
      refused: true,
      packet: null,
      missing: ["quote"],
      missingText: ["the floor check is for a different account than the ask-ready record — never reconcile these silently"],
      refusal: REFUSAL_PREFIX + " the floor check is for a different account than the ask-ready record.",
    };
  }

  const { kept, omitted } = traceableClaims(pack);
  if (kept.length === 0) {
    return {
      ...base,
      refused: true,
      packet: null,
      missing: ["proofPack"],
      missingText: ["the proof pack carries no claim with a record id behind it — there is nothing defensible to send"],
      refusal: REFUSAL_PREFIX + " the proof pack carries no claim with a record id behind it.",
    };
  }

  const packet = {
    account: askReady.key,
    recipient: {
      name: String(recipient.name).trim(),
      address: String(recipient.address).trim(),
      role: typeof recipient.role === "string" && recipient.role.trim() ? recipient.role.trim() : null,
    },
    // Rule 17 — what the buyer gets, first. Stated from what we actually evidenced, nothing more.
    valueFirst: kept.map((c) => `${c.label}: ${c.value}`),
    evidence: {
      proofPackId: pack.pilotId,
      claims: kept,
      omittedClaims: omitted,
      verifyNote: TRACE_NOTE,
    },
    price: {
      quoteCad: round2(check.quoteCad),
      observedFloorCad: round2(check.floorCad),
      marginCad: round2(check.quoteCad - check.floorCad),
      floorCheckStatus: check.status,
      floorShown: true,
      basis: "Floor is our own observed delivery cost, not a market guess. It is shown so the price is defensible.",
    },
    ask: { schema: ask.schema, rendered: true, customer: ask.customer || askReady.key },
    trace: {
      chainArtifactIds: askReady.artifactIds.slice(),
      proofPackId: pack.pilotId,
      claimRecordIds: kept.flatMap((c) => c.recordIds),
    },
  };

  return {
    ...base,
    refused: false,
    packet,
    missing: [],
    missingText: [],
    refusal: null,
  };
}

export function sendPacketMarkdown(result) {
  if (!result || result.schema !== SEND_PACKET_SCHEMA) return "_no send packet_";
  if (result.refused) {
    return ["## Send packet", "", result.refusal, "", "_Nothing was assembled. A partial packet is never passed off as complete._"].join("\n") + "\n";
  }
  const p = result.packet;
  const lines = [
    `## Send packet — ${p.account}`,
    "",
    `**To:** ${p.recipient.name}${p.recipient.role ? ` (${p.recipient.role})` : ""} · ${p.recipient.address}`,
    "",
    "### What you get",
  ];
  for (const v of p.valueFirst) lines.push(`- ${v}`);
  lines.push("", "### Verify it yourself", p.evidence.verifyNote, "");
  lines.push("| Claim | Value | Verify against record(s) |", "| --- | --- | --- |");
  for (const c of p.evidence.claims) lines.push(`| ${c.label} | ${c.value} | ${c.recordIds.join(", ")} |`);
  if (p.evidence.omittedClaims.length) {
    lines.push("", `_${p.evidence.omittedClaims.length} claim(s) were left out for want of a record id, not softened._`);
  }
  lines.push(
    "",
    "### Price",
    `**${p.price.quoteCad} CAD/mo.** Our observed delivery floor for this account is ${p.price.observedFloorCad} CAD/mo (margin ${p.price.marginCad}).`,
    p.price.basis,
    "",
    "---",
    ONE_CLICK_NOTE,
  );
  return lines.join("\n") + "\n";
}
