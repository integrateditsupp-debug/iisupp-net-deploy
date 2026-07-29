// p1-rendered-ask.test.mjs — RUN-P P1 exit criteria, test-locked.
// A complete packet renders a full ask artefact whose every claim traces to a record; an untraceable
// claim is refused BY NAME; a fixture never renders one; the whole chain is send-incapable.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  RENDERED_ASK_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT,
  REFUSAL_PREFIX, NO_PACKET_STATEMENT, FIXTURE_WARNING, DEFAULT_NEXT_STEP, TRACE_NOTE,
  renderAsk, renderedAskText, renderedAskMarkdown,
} from "../src/shared/rendered-ask.mjs";
import { buildSendPacket } from "../src/shared/send-packet.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const askReady = { key: "northline-logistics", quoteCad: 1200, floorCad: 900, artifactIds: ["sig-1", "eng-1", "PILOT-A"] };
const recipient = { name: "C. Okafor", address: "cio@northline.example", role: "CIO" };
const onePageAsk = { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" };
const proofPack = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A", claims: [
  { label: "Tickets resolved without escalation", value: "17 of 19", recordIds: ["t-1", "t-2"] },
  { label: "Observed delivery minutes", value: 800, recordIds: ["eng-1", "eng-2", "eng-3"] },
] };
const floorCheckResult = { key: "northline-logistics", blocked: false, status: "above-floor", quoteCad: 1200, floorCad: 900 };

function completePacket() {
  const p = buildSendPacket({ askReady, recipient, onePageAsk, proofPack, floorCheckResult }, { now: NOW });
  assert.equal(p.refused, false, "fixture setup must produce a complete packet");
  return p;
}

test("P1: belt-and-braces — nothing is sent, signed or charged", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
});

test("P1: a complete packet plus a real-account assertion renders the whole artefact", () => {
  const r = renderAsk({ sendPacket: completePacket(), realAccount: true }, { now: NOW });
  assert.equal(r.schema, RENDERED_ASK_SCHEMA);
  assert.equal(r.refused, false);
  assert.equal(r.rendered, true);
  assert.equal(r.fixture, false);
  const a = r.artefact;
  assert.ok(a.subject.includes("northline-logistics"), "the subject names the account");
  assert.equal(a.to.address, "cio@northline.example");
  assert.ok(a.opening.startsWith("C. Okafor"), "it opens to a named human");
  // Rule 17 — value before feature and before price.
  assert.equal(a.value.length, 2);
  assert.ok(a.text.indexOf(a.value[0]) < a.text.indexOf(String(a.price.quoteCad)), "value is stated before price");
  // The floor travels with the price.
  assert.equal(a.price.floorShown, true);
  assert.ok(a.price.sentence.includes("900"), "the observed floor is shown, not hidden");
  assert.ok(a.price.sentence.includes("300"), "the margin is shown");
  // A specific request, never a vague one.
  assert.equal(a.nextStep.requested, DEFAULT_NEXT_STEP);
  assert.ok(a.nextStep.sentence.includes(DEFAULT_NEXT_STEP));
});

test("P1: every sentence in the artefact carries at least one record id", () => {
  const r = renderAsk({ sendPacket: completePacket(), realAccount: true }, { now: NOW });
  assert.ok(r.artefact.sentences.length >= 6);
  for (const s of r.artefact.sentences) {
    assert.ok(s.recordIds.length > 0, `sentence "${s.id}" must trace to a record`);
    assert.ok(s.text.trim().length > 0);
  }
  assert.deepEqual(r.artefact.trace.claimRecordIds, ["t-1", "t-2", "eng-1", "eng-2", "eng-3"]);
});

test("P1: an untraceable claim is refused BY NAME and no artefact is produced", () => {
  const r = renderAsk({
    sendPacket: completePacket(),
    realAccount: true,
    extraSentences: [{ id: "puff", text: "We are the leading provider in Ontario.", recordIds: [] }],
  }, { now: NOW });
  assert.equal(r.refused, true);
  assert.equal(r.artefact, null, "not a partial artefact — nothing at all");
  assert.equal(r.untraceable.length, 1);
  assert.equal(r.untraceable[0].id, "puff");
  assert.ok(r.refusal.startsWith(REFUSAL_PREFIX));
  assert.ok(r.refusal.includes("We are the leading provider in Ontario."), "the refusal quotes the offending sentence");
});

test("P1: a sourced extra sentence is accepted on exactly the same terms", () => {
  const r = renderAsk({
    sendPacket: completePacket(),
    realAccount: true,
    extraSentences: [{ id: "note", text: "Your two longest outages both sat in the same queue.", recordIds: ["t-1"] }],
  }, { now: NOW });
  assert.equal(r.refused, false);
  assert.ok(r.artefact.sentences.some((s) => s.id === "note" && s.recordIds.length === 1));
});

test("P1: a fixture never renders an ask", () => {
  const r = renderAsk({ sendPacket: completePacket() }, { now: NOW }); // realAccount not asserted
  assert.equal(r.refused, true);
  assert.equal(r.fixture, true);
  assert.equal(r.artefact, null);
  assert.equal(r.fixtureWarning, FIXTURE_WARNING);
  assert.equal(r.refusal, FIXTURE_WARNING);
});

test("P1: a refused packet never becomes an ask, and the packet's own reason is carried", () => {
  const refusedPacket = buildSendPacket({ askReady, onePageAsk, proofPack, floorCheckResult }, { now: NOW }); // no recipient
  assert.equal(refusedPacket.refused, true);
  const r = renderAsk({ sendPacket: refusedPacket, realAccount: true }, { now: NOW });
  assert.equal(r.refused, true);
  assert.equal(r.artefact, null);
  assert.ok(r.refusal.startsWith(NO_PACKET_STATEMENT));
  assert.ok(r.refusal.includes("placeholder"), "the packet's own words survive rather than being re-derived");
});

test("P1: no packet at all is refused, not rendered empty", () => {
  const r = renderAsk({ realAccount: true }, { now: NOW });
  assert.equal(r.refused, true);
  assert.equal(r.artefact, null);
  assert.equal(r.refusal, NO_PACKET_STATEMENT);
  assert.equal(renderedAskText(r).includes("no ask rendered"), true);
  assert.ok(renderedAskMarkdown(r).includes(NO_PACKET_STATEMENT));
});

test("P1: the rendered text carries the trace note and the cannot-send note", () => {
  const r = renderAsk({ sendPacket: completePacket(), realAccount: true }, { now: NOW });
  const txt = renderedAskText(r);
  assert.ok(txt.includes(TRACE_NOTE));
  assert.ok(txt.includes("cannot send itself"));
  assert.ok(txt.startsWith("Subject: "));
});

test("P1: static-scan — the whole rendering chain is send-incapable", () => {
  const bad = [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/];
  for (const mod of ["rendered-ask.mjs", "send-packet.mjs", "ask-ledger.mjs", "first-account-walk.mjs"]) {
    const src = readFileSync(path.join(__dirname, "../src/shared/", mod), "utf8");
    for (const re of bad) assert.ok(!re.test(src), `${mod} must not contain ${re}`);
  }
});
