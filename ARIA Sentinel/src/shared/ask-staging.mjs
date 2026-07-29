// ask-staging.mjs — RUN-P P2: THE GATED MOMENT.
//
// WHY (RUN-P, 2026-07-28): P1 renders the artefact. P2 is the single operator action that carries it
// to the exact edge of the building and stops. After this call the ONLY remaining step is a human
// opening their own mail client and pressing send. That is not a limitation we are apologising for —
// it is the design. Software that can send on our behalf is software that can lie about having sent.
//
// Honesty invariants (Rule 14 real-or-empty):
//   - NOTHING IN THIS MODULE CAN SEND. No transport, no credential, no queue, no scheduler, no
//     network, no child process, no filesystem reach. Static-scan locked by the test.
//   - SENT CANNOT BE SET FROM INSIDE THE SOFTWARE. `markSent()` exists ONLY to refuse, in M3's own
//     words. Sent is asserted by a human against a real artefact, exactly as `paid` needs a receipt.
//   - STAGED IS NOT SENT, EVER. The row this produces is a `staged` event and nothing else. It can
//     never be counted, phrased, or rounded into a sent one (P3 locks that across every surface).
//   - IT RECORDS WHAT WAS CLAIMED, AT STAGE TIME. Who it is for, what was claimed, what price — so a
//     real reply can later be matched to a real ask without anyone retyping anything from memory.
//   - SUPERSEDING NEVER DELETES (Rule 15). An older staging path is MARKED superseded and stays
//     readable, with the id of the thing that replaced it.
//   - Rule 15 additive: the P1 artefact and the M3 ledger vocabulary are read-only inputs.

import { RENDERED_ASK_SCHEMA } from "./rendered-ask.mjs";
import { ZERO_SENT_STATEMENT, OUTCOMES } from "./ask-ledger.mjs";

export const ASK_STAGING_SCHEMA = "ask-staging.v1";

// Belt-and-braces, asserted by the test. None of these can flip true anywhere in this module.
export const SENT = false;
export const SIGNED = false;
export const CHARGED = false;
export const NOTHING_SENT = true;

// The whole point of the module, stated as a constant so a test can assert it rather than trust it.
export const CAN_MARK_SENT = false;
export const HAS_TRANSPORT = false;

export { ZERO_SENT_STATEMENT, OUTCOMES };

export const MARK_SENT_REFUSAL =
  "Refused: nothing in this software may mark an ask as sent. Sent is asserted by a human against a " +
  "real artefact they actually sent, exactly as paid requires a real receipt. " + ZERO_SENT_STATEMENT;

export const NO_ASK_STATEMENT =
  "No rendered ask. Staging exists to carry a real artefact to the edge - never to manufacture one.";

export const HANDOFF_NOTE =
  "STAGED FOR A HUMAN. Open this file, read it once, and send it yourself from your own mail client. " +
  "This software has no way to send it, and no way to record that you did - come back and assert that.";

export const SUPERSEDED_MARKER = "SUPERSEDED";

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/**
 * The single operator action.
 * input: { renderedAsk }   // P1 renderAsk() result — must be rendered:true
 * Returns the human-sendable artefact plus the matching M3 `staged` ledger row. It returns them;
 * it never writes them. Writing is the caller's job, outside this send-incapable chain.
 */
export function stageAskForHumanSend(input = {}, { now = Date.now() } = {}) {
  const base = {
    schema: ASK_STAGING_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    honest: true,
    nothingSent: NOTHING_SENT,
    sent: SENT,
    signed: SIGNED,
    charged: CHARGED,
    canMarkSent: CAN_MARK_SENT,
    hasTransport: HAS_TRANSPORT,
    handoffNote: HANDOFF_NOTE,
  };

  const src = input && typeof input === "object" ? input : {};
  const ask = src.renderedAsk;

  const ok = !!(ask && ask.schema === RENDERED_ASK_SCHEMA && ask.rendered === true
    && ask.refused === false && ask.fixture === false && ask.artefact && ask.artefact.text);

  if (!ok) {
    const carried = ask && ask.schema === RENDERED_ASK_SCHEMA && typeof ask.refusal === "string" ? ask.refusal : null;
    return {
      ...base,
      refused: true,
      staged: false,
      artefact: null,
      ledgerRow: null,
      refusal: carried ? `${NO_ASK_STATEMENT} Carried from the ask: ${carried}` : NO_ASK_STATEMENT,
    };
  }

  const a = ask.artefact;
  const at = new Date(now).toISOString();
  const askId = `ask-${slug(a.account)}-${at.slice(0, 10)}`;

  const artefact = {
    filename: `${askId}.txt`,
    mime: "text/plain",
    body: a.text,
    to: { name: a.to.name, address: a.to.address, role: a.to.role || null },
    subject: a.subject,
    humanSendable: true,
    handoffNote: HANDOFF_NOTE,
  };

  // Exactly the shape M3's buildAskLedger() consumes. Type is "staged" and can be nothing else here.
  const ledgerRow = {
    askId,
    account: a.account,
    at,
    type: "staged",
    packetRefused: false,
    // What was claimed, at stage time, so a later reply matches a real ask instead of a memory.
    claimedAtStageTime: {
      valueClaims: a.value.slice(),
      claimRecordIds: a.trace.claimRecordIds.slice(),
      chainArtifactIds: a.trace.chainArtifactIds.slice(),
    },
    priceAtStageTime: {
      quoteCad: a.price.quoteCad,
      observedFloorCad: a.price.observedFloorCad,
      marginCad: a.price.marginCad,
    },
    recipientAtStageTime: { name: a.to.name, address: a.to.address, role: a.to.role || null },
  };

  return { ...base, refused: false, staged: true, askId, artefact, ledgerRow, refusal: null };
}

/**
 * Exists solely to refuse. Kept as a named export so the impossibility is discoverable and testable
 * rather than merely absent — an absent function is an invitation to write one.
 */
export function markSent() {
  return { schema: ASK_STAGING_SCHEMA, refused: true, sent: false, canMarkSent: CAN_MARK_SENT, refusal: MARK_SENT_REFUSAL };
}

/**
 * Rule 15: replacing a staging path marks the old one, it never removes it.
 * Returns a new record; the input object is not mutated.
 */
export function supersedeStagingPath(previous, supersededById, { now = Date.now() } = {}) {
  const prev = previous && typeof previous === "object" ? previous : {};
  return {
    ...prev,
    superseded: true,
    supersededMarker: SUPERSEDED_MARKER,
    supersededBy: typeof supersededById === "string" && supersededById.trim() ? supersededById.trim() : null,
    supersededAt: new Date(now).toISOString(),
    deleted: false,
    stillReadable: true,
  };
}

export function askStagingMarkdown(result) {
  if (!result || result.schema !== ASK_STAGING_SCHEMA) return "_no staging_";
  if (result.refused) {
    return ["## Staged ask", "", result.refusal, "", "_Nothing was staged._"].join("\n") + "\n";
  }
  return [
    `## Staged ask — ${result.ledgerRow.account}`,
    "",
    `**File:** ${result.artefact.filename} · **To:** ${result.artefact.to.name} <${result.artefact.to.address}>`,
    `**Price staged:** ${result.ledgerRow.priceAtStageTime.quoteCad} CAD/mo (floor ${result.ledgerRow.priceAtStageTime.observedFloorCad})`,
    "",
    HANDOFF_NOTE,
    "",
    `_${ZERO_SENT_STATEMENT}_`,
    "",
  ].join("\n");
}
