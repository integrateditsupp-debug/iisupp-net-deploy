// p2-ask-staging.test.mjs — RUN-P P2 exit criteria, test-locked.
// Staging produces a human-sendable artefact and a matching ledger row; nothing in the codebase can
// transition an ask to sent; the static-scan proves no transport exists; superseding never deletes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ASK_STAGING_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT,
  CAN_MARK_SENT, HAS_TRANSPORT, MARK_SENT_REFUSAL, NO_ASK_STATEMENT, HANDOFF_NOTE, SUPERSEDED_MARKER,
  stageAskForHumanSend, markSent, supersedeStagingPath, askStagingMarkdown,
} from "../src/shared/ask-staging.mjs";
import { renderAsk } from "../src/shared/rendered-ask.mjs";
import { buildSendPacket } from "../src/shared/send-packet.mjs";
import { buildAskLedger, ZERO_SENT_STATEMENT } from "../src/shared/ask-ledger.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const askReady = { key: "northline-logistics", quoteCad: 1200, floorCad: 900, artifactIds: ["sig-1", "eng-1", "PILOT-A"] };
const recipient = { name: "C. Okafor", address: "cio@northline.example", role: "CIO" };
const onePageAsk = { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" };
const proofPack = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A", claims: [
  { label: "Tickets resolved without escalation", value: "17 of 19", recordIds: ["t-1", "t-2"] },
] };
const floorCheckResult = { key: "northline-logistics", blocked: false, status: "above-floor", quoteCad: 1200, floorCad: 900 };

function realAsk() {
  const packet = buildSendPacket({ askReady, recipient, onePageAsk, proofPack, floorCheckResult }, { now: NOW });
  const ask = renderAsk({ sendPacket: packet, realAccount: true }, { now: NOW });
  assert.equal(ask.refused, false, "fixture setup must render a real ask");
  return ask;
}

test("P2: belt-and-braces — nothing is sent, signed or charged, and nothing can be", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
  assert.equal(CAN_MARK_SENT, false);
  assert.equal(HAS_TRANSPORT, false);
});

test("P2: one action produces a human-sendable artefact", () => {
  const s = stageAskForHumanSend({ renderedAsk: realAsk() }, { now: NOW });
  assert.equal(s.schema, ASK_STAGING_SCHEMA);
  assert.equal(s.refused, false);
  assert.equal(s.staged, true);
  assert.equal(s.artefact.humanSendable, true);
  assert.equal(s.artefact.mime, "text/plain");
  assert.ok(s.artefact.filename.endsWith(".txt"));
  assert.equal(s.artefact.to.address, "cio@northline.example");
  assert.ok(s.artefact.body.startsWith("Subject: "), "the body is the thing a human pastes and sends");
  assert.equal(s.artefact.handoffNote, HANDOFF_NOTE);
});

test("P2: staging records who, what was claimed, and what price — at stage time", () => {
  const s = stageAskForHumanSend({ renderedAsk: realAsk() }, { now: NOW });
  const row = s.ledgerRow;
  assert.equal(row.type, "staged");
  assert.equal(row.account, "northline-logistics");
  assert.equal(row.at, new Date(NOW).toISOString());
  assert.equal(row.recipientAtStageTime.name, "C. Okafor");
  assert.deepEqual(row.claimedAtStageTime.claimRecordIds, ["t-1", "t-2"]);
  assert.ok(row.claimedAtStageTime.valueClaims.length >= 1);
  assert.equal(row.priceAtStageTime.quoteCad, 1200);
  assert.equal(row.priceAtStageTime.observedFloorCad, 900);
  assert.equal(row.priceAtStageTime.marginCad, 300);
});

test("P2: the row M3 receives is a staged event and M3 counts it as staged, never as sent", () => {
  const s = stageAskForHumanSend({ renderedAsk: realAsk() }, { now: NOW });
  const ledger = buildAskLedger({ events: [s.ledgerRow] }, { now: NOW });
  const json = JSON.stringify(ledger);
  assert.ok(json.includes(s.ledgerRow.askId), "the staged ask reaches the ledger under its own id");
  assert.equal(ledger.sent, false);
  const entry = ledger.asks.find((e) => e.askId === s.ledgerRow.askId);
  assert.ok(entry, "the staged ask is an entry in the ledger");
  assert.equal(entry.sentAt, null, "staged sets no sent timestamp");
  assert.ok(entry.stagedAt !== null, "staged does set a staged timestamp");
  assert.equal(ledger.counts.staged, 1);
  assert.equal(ledger.counts.sent, 0);
  assert.equal(ledger.counts.stagedNotSent, 1);
  assert.ok(ledger.statement.includes(ZERO_SENT_STATEMENT), "the ledger still says zero sent, in its own words");
  // Nothing in the produced ledger may claim this ask was sent.
  assert.ok(!/"sentAt":"20/.test(json), "a staged row must never populate a sent timestamp");
});

test("P2: nothing in the software can mark an ask as sent — the function exists only to refuse", () => {
  const r = markSent({ askId: "ask-northline-logistics-2026-07-28" });
  assert.equal(r.refused, true);
  assert.equal(r.sent, false);
  assert.equal(r.canMarkSent, false);
  assert.equal(r.refusal, MARK_SENT_REFUSAL);
  assert.ok(r.refusal.includes(ZERO_SENT_STATEMENT), "it refuses in M3's own words");
});

test("P2: a refused or fixture ask is never staged", () => {
  const fixture = renderAsk({ sendPacket: buildSendPacket({ askReady, recipient, onePageAsk, proofPack, floorCheckResult }, { now: NOW }) }, { now: NOW });
  const a = stageAskForHumanSend({ renderedAsk: fixture }, { now: NOW });
  assert.equal(a.refused, true);
  assert.equal(a.staged, false);
  assert.equal(a.artefact, null);
  assert.equal(a.ledgerRow, null);
  assert.ok(a.refusal.startsWith(NO_ASK_STATEMENT));

  const b = stageAskForHumanSend({}, { now: NOW });
  assert.equal(b.refused, true);
  assert.equal(b.ledgerRow, null);
  assert.equal(b.refusal, NO_ASK_STATEMENT);
  assert.ok(askStagingMarkdown(b).includes(NO_ASK_STATEMENT));
});

test("P2: superseding a staging path marks it and never deletes it (Rule 15)", () => {
  const prev = { id: "staging-v1", path: "docs/ask-staging-v1.md" };
  const next = supersedeStagingPath(prev, "staging-v2", { now: NOW });
  assert.equal(next.superseded, true);
  assert.equal(next.supersededMarker, SUPERSEDED_MARKER);
  assert.equal(next.supersededBy, "staging-v2");
  assert.equal(next.deleted, false);
  assert.equal(next.stillReadable, true);
  assert.equal(next.id, "staging-v1", "every original field survives");
  assert.equal(next.path, "docs/ask-staging-v1.md");
  assert.equal(prev.superseded, undefined, "the input is not mutated");
});

test("P2: static-scan — no transport, no credential, no queue anywhere in the staging chain", () => {
  const bad = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /\bexec\s*\(/,
    /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/, /sendgrid/i, /mailgun/i, /postmark/i,
    /process\.env/, /setInterval\s*\(/, /setTimeout\s*\(/,
  ];
  for (const mod of ["ask-staging.mjs", "rendered-ask.mjs", "send-packet.mjs", "ask-ledger.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});

test("P2: no module in the staging chain contains a path that sets sent to true", () => {
  for (const mod of ["ask-staging.mjs", "rendered-ask.mjs", "send-packet.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    assert.ok(!/\bsent\s*[:=]\s*true/.test(src), `${mod} must contain no path that sets sent true`);
    assert.ok(!/\bcharged\s*[:=]\s*true/.test(src), `${mod} must contain no path that sets charged true`);
    assert.ok(!/\bsigned\s*[:=]\s*true/.test(src), `${mod} must contain no path that sets signed true`);
  }
});
