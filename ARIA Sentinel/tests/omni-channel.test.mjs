// G-OMNI — Slack/Teams front-end. Locks: honest status (never a fake "connected"), Slack signature verify
// + replay guard, event/activity parsing, the answer→escalate handler, the content-blind metric recording
// (so omni usage counts toward the real deflection number), and the read-only / no-new-authority posture.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  OMNI_PROVIDERS, OMNI_CONF, getOmniStatus, getProviderStatus,
  verifySlackSignature, parseSlackEvent, formatSlackResponse,
  parseTeamsActivity, formatTeamsResponse, defaultAnswerer, humanHandoff, handleMessage
} from "../src/shared/omni-channel.mjs";
import { sanitizeEvent, aggregate, PROOF_SOURCES } from "../src/shared/proof-metrics.mjs";

const root = path.resolve(import.meta.dirname, "..");
let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── 1 — honest status: no token → not_configured; token present → configured (NEVER "connected") ──
const none = getOmniStatus({});
assert.equal(none.slack.status, "not_configured", "slack not_configured without a token");
assert.equal(none.teams.status, "not_configured", "teams not_configured without a token");
for (const p of [none.slack, none.teams]) assert.notEqual(p.status, "connected", "status is never a fake 'connected'");
const withSlack = getProviderStatus("slack", { SLACK_BOT_TOKEN: "x", SLACK_SIGNING_SECRET: "y" });
assert.equal(withSlack.status, "configured", "slack configured when both creds present");
assert.notEqual(withSlack.status, "connected", "configured is not a claimed live connection");
assert.equal(getProviderStatus("slack", { SLACK_BOT_TOKEN: "x" }).status, "not_configured", "partial creds → not_configured");
assert.deepEqual(OMNI_PROVIDERS, ["slack", "teams"], "two providers");
ok("status is honest: not_configured w/o token, configured (not 'connected') with token");

// ── 2 — Slack signature verify + replay window ──
const secret = "shhh";
const ts = 1700000000;
const body = "payload=hello";
const good = "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
const nowMs = (ts + 5) * 1000;
assert.equal(verifySlackSignature({ signingSecret: secret, timestamp: ts, body, signature: good }, { now: nowMs }), true, "valid signature passes");
assert.equal(verifySlackSignature({ signingSecret: secret, timestamp: ts, body, signature: "v0=deadbeef" }, { now: nowMs }), false, "wrong signature fails");
assert.equal(verifySlackSignature({ signingSecret: secret, timestamp: ts, body, signature: good }, { now: (ts + 6000) * 1000 }), false, "stale timestamp (replay) rejected");
assert.equal(verifySlackSignature({ signingSecret: "", timestamp: ts, body, signature: good }, { now: nowMs }), false, "missing secret fails");
ok("Slack v0 signature verifies + rejects forgery, replay, and missing secret");

// ── 3 — Slack event parsing (challenge / message / ignore + mention strip) ──
assert.deepEqual(parseSlackEvent({ type: "url_verification", challenge: "C123" }), { kind: "challenge", challenge: "C123" }, "url_verification → challenge");
const msg = parseSlackEvent({ type: "event_callback", event: { type: "app_mention", text: "<@U1> printer wont print", user: "U9", channel: "C9" } });
assert.equal(msg.kind, "message", "app_mention → message");
assert.equal(msg.text, "printer wont print", "mention prefix stripped");
assert.equal(parseSlackEvent({ type: "event_callback", event: { type: "message", bot_id: "B1", text: "echo" } }).kind, "ignore", "bot echo ignored");
assert.equal(parseSlackEvent({ type: "event_callback", event: { type: "message", subtype: "message_changed" } }).kind, "ignore", "edits ignored");
ok("Slack events parse to challenge/message/ignore with mention strip");

// ── 4 — Teams activity parsing + response formatters ──
const tmsg = parseTeamsActivity({ type: "message", text: "no internet", from: { id: "29:u" }, conversation: { id: "19:c" } });
assert.equal(tmsg.kind, "message", "teams message parsed");
assert.equal(tmsg.text, "no internet", "teams text captured");
assert.equal(parseTeamsActivity({ type: "typing" }).kind, "ignore", "non-message ignored");
const sres = formatSlackResponse({ text: "hi", escalated: true });
assert.match(JSON.stringify(sres), /Escalated to a human/, "escalation adds a Slack context note");
assert.equal(formatTeamsResponse({ text: "hi" }).type, "message", "teams response shape");
ok("Teams parsing + Slack/Teams response formatters");

// ── 5 — handler: confident KB match → resolved auto-answer; miss → human escalation ──
const recorded = [];
const record = (e) => recorded.push(e);
const matchAnswer = async () => ({ matched: true, score: 0.9, id: "diagnostics/printer.md", text: "Try restarting the spooler." });
const missAnswer = async () => ({ matched: false, score: 0.1 });

const hit = await handleMessage({ provider: "slack", text: "printer wont print" }, { answer: matchAnswer, record, now: () => 1000 });
assert.equal(hit.resolved, true, "confident match resolves");
assert.equal(hit.escalated, false, "confident match does not escalate");
assert.equal(hit.matchedKb, true, "kb hit recorded");
assert.match(hit.text, /spooler/, "answer text returned");

const miss = await handleMessage({ provider: "teams", text: "configure my SAP gateway" }, { answer: missAnswer, record, now: () => 2000, contact: { email: "it@x.co", phone: "555" } });
assert.equal(miss.resolved, false, "miss does not resolve");
assert.equal(miss.escalated, true, "miss escalates to a human");
assert.match(miss.text, /human/i, "escalation hands off to a human");
assert.match(miss.text, /it@x\.co|555/, "escalation surfaces the contact");
ok("handler: confident match auto-answers; a miss escalates to a human");

// ── 6 — metric recording is content-blind + counts toward deflection (source slack/teams) ──
assert.equal(recorded.length, 2, "exactly one event per handled message");
assert.ok(PROOF_SOURCES.includes("slack") && PROOF_SOURCES.includes("teams"), "proof-metrics accepts omni sources");
for (const e of recorded) {
  const blind = sanitizeEvent(e);
  assert.deepEqual(Object.keys(blind).sort(), ["escalated", "matchedKb", "resolveMs", "resolved", "source", "ts"], "recorded event is content-blind");
  assert.ok(["slack", "teams"].includes(blind.source), "source is the channel provider");
  assert.doesNotMatch(JSON.stringify(e), /printer|SAP|spooler|gateway/i, "no message/answer text in the metric event");
}
const agg = aggregate(recorded.map(sanitizeEvent));
assert.equal(agg.queriesHandled, 2, "omni events count as handled queries");
assert.equal(agg.autoResolved, 1, "the hit counts as auto-resolved");
assert.equal(agg.escalated, 1, "the miss counts as escalated");
assert.equal(agg.deflectionPct, 50, "omni usage feeds the real deflection number (1/2 = 50%)");
ok("metric events are content-blind and feed the real deflection aggregate");

// ── 7 — empty message does not record; default answerer honors the confidence floor ──
const empties = [];
const empty = await handleMessage({ provider: "slack", text: "   " }, { answer: matchAnswer, record: (e) => empties.push(e) });
assert.equal(empty.empty, true, "blank message flagged empty");
assert.equal(empties.length, 0, "an empty message records no metric");
const ans = defaultAnswerer([{ id: "d/x.md", title: "Printers", text: "printer spooler restart fix print queue", _tokenSet: new Set(["printer", "spooler", "restart", "print", "queue", "fix"]) }]);
const r1 = ans("printer spooler restart", "");
assert.equal(r1.matched, true, "default answerer matches a confident question");
assert.ok(r1.score >= OMNI_CONF, "match clears the confidence floor");
assert.equal(ans("quarterly revenue forecast", "").matched, false, "off-topic does not match");
ok("empty message records nothing; default answerer honors the confidence floor");

// ── 8 — READ-ONLY / no new authority: the module never wires an executor or write path ──
const src = fs.readFileSync(path.join(root, "src", "shared", "omni-channel.mjs"), "utf8");
for (const forbidden of ["tier-0-executor", "runSupervisedFix", "execApply", "child_process", "executionPolicy", "spawn("]) {
  assert.ok(!src.includes(forbidden), `omni-channel never imports/calls ${forbidden} (chat is input, not authority)`);
}
assert.match(src, /READ-ONLY/, "read-only posture documented");
ok("read-only: omni never executes a fix/write — escalation only");

assert.equal(tests, 8, "omni-channel runs exactly 8 test cases");
console.log(`Omni-channel test passed (${tests}/8 · honest status · sig+replay · parse · answer/escalate · content-blind metric → deflection · read-only).`);
