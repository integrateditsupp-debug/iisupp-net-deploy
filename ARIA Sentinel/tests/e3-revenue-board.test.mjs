// RUN-E E3 — REVENUE-NOW BOARD + ACQUISITION-SCOUT LANE battery. 🔒 Rule 14 real-or-empty: an empty
// pipeline renders an honestly empty board; unevidenced leads are EXCLUDED with a reason, never ranked;
// the outreach draft is the Ahmad-locked template BYTE-VERBATIM except [Name]; the module cannot send
// anything (static scan locks out network/child-process); acquisition candidates are presented ONLY
// when all 5 vetting gates pass with evidence. All fixtures below are obviously fixtures — no real
// prospect name ever enters the tracked tree (axis-state.json incident lesson, R11).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  REVENUE_BOARD_SCHEMA, OUTREACH_TEMPLATE, TEMPLATE_SOURCE, personalizeOutreach, STATUS_WEIGHTS,
  deadlineUrgency, evidenceOk, readinessScore, nextOneClick, buildRevenueBoard, boardMarkdown,
} from "../src/shared/revenue-board.mjs";

const NOW = Date.parse("2026-07-02T00:00:00.000Z");
const ev = { source: "fixture-note.md", lastTouch: "2026-07-01T00:00:00.000Z" };

// ── real-or-empty ────────────────────────────────────────────────────────────────────────────────
const empty = buildRevenueBoard({}, { now: NOW });
assert.equal(empty.schema, REVENUE_BOARD_SCHEMA);
assert.equal(empty.ready, false, "no inputs => honestly empty board");
assert.equal(empty.rows.length, 0);
assert.equal(empty.nothingSent, true);
assert.match(boardMarkdown(empty), /honestly EMPTY/, "empty board SAYS it is empty instead of inventing rows");

// ── evidence gate: no evidence => excluded with reason, never ranked ─────────────────────────────
const gated = buildRevenueBoard({ leads: [{ id: "fx-1", name: "Fixture Lead One", kind: "prospect", status: "replied-warm" }] }, { now: NOW });
assert.equal(gated.rows.length, 0, "unevidenced lead is NOT ranked");
assert.equal(gated.excluded.length, 1);
assert.match(gated.excluded[0].reason, /evidence/, "exclusion states the honest reason");
assert.equal(evidenceOk({ evidence: ev }), true);
assert.equal(evidenceOk({ evidence: { source: "x" } }), false, "lastTouch required");

// ── locked template: byte-verbatim except [Name] ─────────────────────────────────────────────────
assert.equal((OUTREACH_TEMPLATE.match(/\[Name\]/g) || []).length, 1, "exactly one [Name] slot");
assert.ok(OUTREACH_TEMPLATE.includes("https://calendar.app.google/LUyV5pHxkqJRg5vp8"), "booking link intact");
assert.ok(OUTREACH_TEMPLATE.includes("647-581-3182") && OUTREACH_TEMPLATE.includes("Founder | Director"), "contact + signature intact");
const draft = personalizeOutreach("Fixture Lead One");
assert.equal(draft, OUTREACH_TEMPLATE.replace("[Name]", "Fixture Lead One"), "personalization touches ONLY [Name] — byte-verbatim otherwise");
assert.equal(personalizeOutreach(""), null, "no name => no draft (never emails 'Hello [Name]')");
assert.match(TEMPLATE_SOURCE, /Ahmad-locked 2026-06-25/);

// ── deterministic readiness + deadline urgency ───────────────────────────────────────────────────
assert.equal(readinessScore({ status: "demo-confirmed" }, { now: NOW }), 90);
assert.equal(readinessScore({ status: "tender-active", deadline: "2026-07-03T00:00:00.000Z" }, { now: NOW }), 90, "60 + 30 (<=3d)");
assert.equal(readinessScore({ status: "tender-active", deadline: "2026-07-28T00:00:00.000Z" }, { now: NOW }), 70, "60 + 10 (<=31d)");
assert.equal(deadlineUrgency("2026-06-30T00:00:00.000Z", NOW).overdue, true);
assert.ok(readinessScore({ status: "tender-active", deadline: "2026-06-01T00:00:00.000Z" }, { now: NOW }) <= 50, "past deadline is stale, not urgent — verify before ranking high");
const board = buildRevenueBoard({
  leads: [
    { id: "fx-tender-far", kind: "tender", status: "tender-active", deadline: "2026-07-28T00:00:00.000Z", evidence: ev, nextAction: "Pull RFP and draft bid" },
    { id: "fx-demo", name: "Fixture Lead One", org: "Fixture Clinic", kind: "prospect", status: "demo-confirmed", evidence: ev },
    { id: "fx-tender-near", kind: "tender", status: "tender-active", deadline: "2026-07-03T00:00:00.000Z", evidence: ev },
    { id: "fx-cold", name: "Fixture Lead Two", kind: "prospect", status: "cold", evidence: ev },
  ],
}, { now: NOW });
assert.deepEqual(board.rows.map((r) => r.id), ["fx-tender-near", "fx-demo", "fx-tender-far", "fx-cold"], "deterministic rank: tie at 90 breaks by SOONER deadline (near tender before undated demo), then 70, then cold");
assert.equal(board.rows[0].readiness, 90);
assert.equal(board.rows[1].readiness, 90);
assert.equal(board.ready, true);

// ── actions: always staged, never executed; cold gets the verbatim draft, warm does NOT ──────────
for (const r of board.rows) {
  assert.equal(r.action.kind, "ahmad-one-click");
  assert.equal(r.action.staged, true);
  assert.equal(r.action.executed, false);
}
assert.equal(board.rows.find((r) => r.id === "fx-cold").action.draft, OUTREACH_TEMPLATE.replace("[Name]", "Fixture Lead Two"), "cold lead stages the locked template");
assert.equal(board.rows.find((r) => r.id === "fx-demo").action.draft, null, "warm lead does NOT get template spam — uses its real prepared reply");
assert.equal(board.rows.find((r) => r.id === "fx-tender-far").action.label, "Pull RFP and draft bid", "explicit nextAction is used verbatim");

// ── acquisition lane: 5/5 gates with evidence or it is NOT presented ─────────────────────────────
const gates5 = Object.fromEntries(["recurringRevenue", "paybackMath", "transferable", "cleanTail", "fit"].map((g) => [g, { pass: true, evidence: "fixture-sellerdoc.pdf p.2" }]));
gates5.paybackMath.dscr = 1.4;
const acq = buildRevenueBoard({ acquisitions: [
  { id: "fx-msp-vetted", source: "fixture-listing", ask: 100000, gates: gates5 },
  { id: "fx-msp-half", gates: { recurringRevenue: { pass: true, evidence: "x" } } },
  { id: "fx-msp-noev", gates: Object.fromEntries(Object.entries(gates5).map(([k, v]) => [k, { pass: true, evidence: "" }])) },
] }, { now: NOW });
assert.equal(acq.acquisitions.vetted.length, 1, "only the 5/5-with-evidence candidate is presented");
assert.equal(acq.acquisitions.vetted[0].id, "fx-msp-vetted");
assert.match(acq.acquisitions.vetted[0].verdict, /Ahmad/, "purchase stays Ahmad's one-click");
assert.equal(acq.acquisitions.notVetted.length, 2, "failing candidates listed honestly with failing gates");
assert.ok(acq.acquisitions.notVetted.every((n) => n.failing.length > 0));
const acqMd = boardMarkdown(buildRevenueBoard({}, { now: NOW }));
assert.match(acqMd, /0 vetted candidates yet — honestly empty/, "empty acquisition lane says so");

// ── board markdown: local-only banner + staged-not-sent footer ───────────────────────────────────
const md = boardMarkdown(board);
assert.match(md, /LOCAL ONLY/, "board states it is local-only (senior-director-state, untracked, force-404)");
assert.match(md, /Nothing was sent, signed, paid, registered, or purchased/, "staged-not-sent line present");
assert.ok(md.includes("| 2 | Fixture Lead One (Fixture Clinic) |"), "rank table renders (demo fixture at rank 2 behind the near tender)");

// ── NO-SEND lock: module has zero network/exec capability (static scan) ──────────────────────────
const root = path.resolve(import.meta.dirname, "..");
const src = fs.readFileSync(path.join(root, "src", "shared", "revenue-board.mjs"), "utf8");
for (const bad of ["fetch(", "node:http", "node:https", "node:net", "node:tls", "node:dgram", "child_process", "XMLHttpRequest", "WebSocket", "nodemailer", "smtp"]) {
  assert.ok(!src.includes(bad), `revenue-board.mjs must not contain "${bad}" — the board can never send`);
}
assert.ok(!src.includes("process.env"), "no hidden env-driven behavior");

// ── wiring locks: runner exists, writes ONLY under senior-director-state, registered in run-all ──
const runner = fs.readFileSync(path.join(root, "..", "scripts", "revenue-board-run.mjs"), "utf8");
assert.ok(runner.includes("senior-director-state"), "runner is pinned to the untracked local state dir");
assert.ok(runner.includes("revenue-board.mjs"), "runner uses the shared module (single source of truth)");
assert.ok(runner.includes('includes("senior-director-state")'), "runner refuses to write outside senior-director-state");
const runAll = fs.readFileSync(path.join(root, "tests", "run-all.mjs"), "utf8");
assert.ok(runAll.includes("e3-revenue-board.test.mjs"), "run-all registers the E3 battery");
assert.ok(runAll.indexOf("deploy-safety-denylist") < runAll.indexOf("e3-revenue-board"), "registered AFTER the denylist gate");

console.log("e3-revenue-board: all assertions passed (real-or-empty board; evidence-gated ranks; verbatim locked template ([Name] only); staged-never-sent; 5/5-gated acquisition lane; local-only surface).");
