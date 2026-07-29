// n3-ask-dashboard.test.mjs — RUN-N N3 exit criteria, test-locked.
// the operator view renders truthfully from an empty state and from a populated one; zero is
// rendered as zero in M3's own words; it is internal-only and never public beyond a headline.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ASK_DASHBOARD_SCHEMA, SENT, SIGNED, CHARGED, NOTHING_SENT, INTERNAL_ONLY, PUBLIC_SAFE,
  EMPTY_HEADLINE, buildAskDashboard, askDashboardPublicHeadline, askDashboardMarkdown,
} from "../src/shared/ask-dashboard.mjs";
import { ZERO_SENT_STATEMENT, NO_REVENUE_STATEMENT, buildAskLedger } from "../src/shared/ask-ledger.mjs";
import { buildAskReadyQueue } from "../src/shared/ask-ready-queue.mjs";
import { runFirstPacketPass } from "../src/shared/first-packet-pass.mjs";

const NOW = Date.parse("2026-07-28T00:00:00Z");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const account = {
  key: "northline-logistics", seats: 40, region: "Ontario", need: "managed IT support",
  demandSignal: { id: "sig-1", kind: "site-enquiry", source: "iisupp.net contact form",
    firstSeenAt: "2026-06-02T09:00:00Z", email: "cio@northline.example", company: "Northline Logistics" },
  engagements: [
    { id: "eng-1", at: "2026-06-10T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-2", at: "2026-06-24T13:00:00Z", durationMinutes: 300, source: "ticket log" },
    { id: "eng-3", at: "2026-07-08T13:00:00Z", durationMinutes: 200, source: "ticket log" },
  ],
  costBasis: { sourceId: "cost-basis-2026-07", monthlyOperatorCostCad: 4000, monthlyAvailableMinutes: 8000 },
  quoteCad: 1200, quoteSource: "quote-2026-07-20 (operator)",
};
const proofPack = { schema: "proof-pack.v1", earned: true, pilotId: "PILOT-A", claims: [
  { label: "Tickets resolved without escalation", value: "17 of 19", recordIds: ["t-1", "t-2"] },
  { label: "Observed delivery minutes", value: 800, recordIds: ["eng-1", "eng-2", "eng-3"] },
] };
const artifacts = { proofPack,
  closePacket: { schema: "close-packet.v1", rendered: true, customer: "Northline Logistics" },
  billingHandoff: { schema: "billing-handoff.v1", produced: true, customer: "Northline Logistics" },
  onePageAsk: { schema: "one-page-ask.v1", rendered: true, customer: "Northline Logistics" } };

const pass = runFirstPacketPass({
  account, artifacts, recipient: { name: "C. Okafor", address: "cio@northline.example" }, costAccountMonths: 2,
}, { now: NOW });

test("N3: belt-and-braces flags — nothing is sent, signed or charged", () => {
  assert.equal(SENT, false);
  assert.equal(SIGNED, false);
  assert.equal(CHARGED, false);
  assert.equal(NOTHING_SENT, true);
});

test("N3: the empty state renders truthfully and implies no momentum", () => {
  const d = buildAskDashboard({}, { now: NOW });
  assert.equal(d.schema, ASK_DASHBOARD_SCHEMA);
  assert.equal(d.headline, EMPTY_HEADLINE);
  assert.equal(d.sentStatement, ZERO_SENT_STATEMENT);
  assert.equal(d.revenueStatement, NO_REVENUE_STATEMENT);
  assert.deepEqual(d.ready, []);
  assert.deepEqual(d.staged, []);
  assert.equal(d.counts.sent, 0);
  assert.equal(d.counts.paid, 0);
  // Momentum language is banned in everything the dashboard writes itself. M3's own statements are
  // excluded from the scan because they NEGATE those words ("not pipeline, not in motion") — the
  // point is that the dashboard may not soften them, and it is asserted above that it quotes them.
  const own = JSON.stringify({ ...d, sentStatement: undefined, revenueStatement: undefined });
  for (const banned of [/warming/i, /in motion/i, /nearly/i, /almost/i, /momentum/i, /soon/i, /pipeline/i]) {
    assert.ok(!banned.test(own), `empty state must not say ${banned}`);
  }
  assert.equal(d.sentStatement, ZERO_SENT_STATEMENT);
});

test("N3: zero is rendered as zero in M3's OWN words — imported, never re-worded", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/ask-dashboard.mjs"), "utf8");
  assert.ok(/import \{[^}]*ZERO_SENT_STATEMENT[^}]*\} from "\.\/ask-ledger\.mjs"/.test(src),
    "the zero-sent wording must be imported from M3");
  assert.ok(!/Zero asks sent\./.test(src.replace(/import[\s\S]*?;/, "")),
    "the wording must not be restated inline where it could drift");
});

test("N3: a staged packet is counted as staged and NEVER as sent", () => {
  assert.equal(pass.outcome, "packet");
  const d = buildAskDashboard({ packets: [pass.packet] }, { now: NOW });
  assert.equal(d.counts.staged, 1);
  assert.equal(d.counts.sent, 0);
  assert.equal(d.sentStatement, ZERO_SENT_STATEMENT);
  assert.equal(d.revenueStatement, NO_REVENUE_STATEMENT);
  assert.equal(d.staged[0].account, "northline-logistics");
  assert.equal(d.staged[0].sent, false);
});

test("N3: everyone who is not ready is listed with what they are missing", () => {
  const conveyor = {
    schema: "demand-to-ask-conveyor.v1", rows: [
      { key: "acct-a", stage: "engagement", bucket: "mid-chain", reached: [{ key: "engagement", artifactId: "eng-1" }] },
      { key: "acct-b", stage: "intake", bucket: "not-started", reached: [] },
    ],
  };
  const queue = buildAskReadyQueue({ conveyor }, { now: NOW });
  const d = buildAskDashboard({ queue }, { now: NOW });
  assert.equal(d.counts.ready, 0);
  assert.equal(d.counts.notReady, 2);
  for (const n of d.notReady) {
    assert.ok(n.missing.length > 0);
    assert.equal(n.missing.length, n.missingText.length);
    for (const t of n.missingText) assert.ok(typeof t === "string" && t.length > 10);
  }
  assert.ok(d.commonestGap);
});

test("N3: a refused packet is its own number, never folded into staged", () => {
  const refused = runFirstPacketPass({ account, artifacts, recipient: { name: "TBD", address: "tbd@" }, costAccountMonths: 2 }, { now: NOW });
  assert.equal(refused.outcome, "gaps");
  // build the refusal object directly through M2 by way of a pass that reaches the packet stage
  const d = buildAskDashboard({ packets: [pass.packet, { schema: "send-packet.v1", refused: true, packet: null, missing: ["recipient"], missingText: ["no exact recipient"] }] }, { now: NOW });
  assert.equal(d.counts.staged, 1);
  assert.equal(d.counts.refused, 1);
  assert.equal(d.counts.sent, 0);
});

test("N3: a sent-but-unpaid ledger reads as sent with revenue still none", () => {
  const ledger = buildAskLedger({ events: [
    { askId: "ask-1", account: "northline-logistics", at: "2026-07-20T10:00:00Z", type: "staged" },
    { askId: "ask-1", account: "northline-logistics", at: "2026-07-21T10:00:00Z", type: "sent" },
    { askId: "ask-1", account: "northline-logistics", at: "2026-07-24T10:00:00Z", type: "outcome", outcome: "negotiating" },
  ] }, { now: NOW });
  const d = buildAskDashboard({ ledger }, { now: NOW });
  assert.equal(d.counts.sent, 1);
  assert.equal(d.counts.paid, 0);
  assert.equal(d.revenueStatement, NO_REVENUE_STATEMENT);
  assert.equal(d.outcomes.negotiating, 1);
  assert.equal(d.outcomes.paid, 0);
});

test("N3: a paid claim WITHOUT a verified receipt never becomes revenue on this screen", () => {
  const ledger = buildAskLedger({ events: [
    { askId: "ask-2", account: "acct-x", at: "2026-07-20T10:00:00Z", type: "staged" },
    { askId: "ask-2", account: "acct-x", at: "2026-07-21T10:00:00Z", type: "sent" },
    { askId: "ask-2", account: "acct-x", at: "2026-07-25T10:00:00Z", type: "outcome", outcome: "paid", receiptId: "not-a-real-receipt" },
  ] }, { now: NOW });
  const d = buildAskDashboard({ ledger }, { now: NOW });
  assert.equal(d.counts.paid, 0);
  assert.equal(d.revenueStatement, NO_REVENUE_STATEMENT);
  assert.ok(d.counts.unsubstantiated >= 1, "the unsubstantiated claim must stay visible, not vanish");
});

test("N3: internal-only by construction; only a headline may ever go public", () => {
  assert.equal(INTERNAL_ONLY, true);
  assert.equal(PUBLIC_SAFE, false);
  const d = buildAskDashboard({ queue: buildAskReadyQueue({}, { now: NOW }), packets: [pass.packet] }, { now: NOW });
  assert.equal(d.internalOnly, true);
  assert.equal(d.publicSafe, false);
  const head = askDashboardPublicHeadline(d);
  assert.equal(head.publicSafe, true);
  const json = JSON.stringify(head);
  assert.ok(!/northline/i.test(json), "no account names in the public headline");
  assert.ok(!/@/.test(json), "no addresses in the public headline");
  assert.ok(!/1200|quote|floor/i.test(json), "no prices in the public headline");
});

test("N3: deterministic — same input, same output", () => {
  const input = { queue: buildAskReadyQueue({}, { now: NOW }), packets: [pass.packet] };
  assert.deepEqual(buildAskDashboard(input, { now: NOW }), buildAskDashboard(input, { now: NOW }));
});

test("N3: markdown says none rather than dressing an empty section up", () => {
  const md = askDashboardMarkdown(buildAskDashboard({}, { now: NOW }));
  assert.match(md, /Nothing is dressed up as nearly ready/);
  assert.match(md, /none staged/);
  assert.match(md, new RegExp(ZERO_SENT_STATEMENT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("N3: static-scan — no send, transport, spawn or filesystem reach", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/ask-dashboard.mjs"), "utf8");
  for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /nodemailer/, /child_process/, /\bspawn\s*\(/, /sendMail/, /smtp/i, /node:fs/, /node:net/, /node:http/]) {
    assert.ok(!bad.test(src), `N3 must not contain ${bad}`);
  }
});

test("N3: the dashboard is never written to a serveable public path", () => {
  const src = readFileSync(path.join(__dirname, "../src/shared/ask-dashboard.mjs"), "utf8");
  assert.ok(!/\.well-known/.test(src.replace(/\/\/[^\n]*/g, "")), "no code path may target .well-known");
});
