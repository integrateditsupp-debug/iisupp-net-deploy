// RUN-CU / CU4 — approvals flow: store transitions, expiry (skip vs proceed-green-only), approve → execute through
// an INJECTED runner, deny never executes, remote poll merge, and the main.mjs wiring (decideExecution in
// runSupervisedFix + autoFireIfEligible, maintenance window wired, Control Center section gated under control-center).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createApprovalsFlow, createApprovalRecord, applyDecision, duePending, approvalsForState, remoteDecisionOf, APPROVALS_DECIDED_SHOWN } from "../src/main/approvals.mjs";
import { GATED_TABS } from "../src/shared/tab-gating.mjs";

let n = 0; const t = () => { n++; };
const T0 = Date.parse("2026-10-08T12:00:00Z");

function harness({ now = T0, prefs = {}, runner } = {}) {
  let clock = now;
  let saved = [];
  const logs = [];
  const runs = [];
  const notified = [];
  const flow = createApprovalsFlow({
    now: () => clock,
    store: { get: () => saved, set: (v) => { saved = v; } },
    log: (tag, text, extra) => logs.push({ tag, text, extra }),
    prefs: () => ({ approver: { mode: "self", timeoutMinutes: 30, onTimeout: "skip", ...prefs } }),
    uuid: (() => { let i = 0; return () => `apr-${++i}`; })(),
    notify: async (event, ctx) => { notified.push({ event, ctx }); return { remote: { approvalId: `remote-${ctx.approvalId}` } }; },
    runner: runner || (async (job) => { runs.push(job); return { ok: true, dryRun: false, verdict: "approve", ran: true }; })
  });
  return { flow, logs, runs, notified, tick: (ms) => { clock += ms; }, saved: () => saved };
}

// 1 — pure record + transitions: pending → approved|denied|expired exactly once; nothing else moves.
{
  const rec = createApprovalRecord({ recipeId: "restart-print-spooler", title: "Restart print spooler", color: "green", tier: 0, requestedBy: "watcher", reason: "level-approve-first" }, { now: T0, timeoutMinutes: 30, id: "a1" });
  assert.equal(rec.status, "pending");
  assert.equal(rec.expiresAt, new Date(T0 + 30 * 60000).toISOString(), "expiry = createdAt + timeoutMinutes");
  assert.equal(createApprovalRecord({}, { now: T0, timeoutMinutes: 99999 }).expiresAt, new Date(T0 + 1440 * 60000).toISOString(), "timeout clamped to 24h");
  assert.equal(createApprovalRecord({ color: "purple" }, { now: T0 }).color, "yellow", "unknown colour → yellow (never green)");
  const ap = applyDecision([rec], "a1", "approved", { decidedBy: "sam", channel: "desktop", now: T0 + 1000 });
  assert.equal(ap.ok, true); assert.equal(ap.approval.status, "approved"); assert.equal(ap.approval.decidedBy, "sam"); assert.equal(ap.approval.channel, "desktop");
  assert.equal(ap.list[0].status, "approved", "returned list carries the decision"); assert.equal(rec.status, "pending", "input never mutated");
  const again = applyDecision(ap.list, "a1", "denied", { now: T0 + 2000 });
  assert.equal(again.ok, false); assert.equal(again.reason, "already-approved", "a decided record cannot be re-decided");
  assert.equal(applyDecision(ap.list, "nope", "approved").reason, "not-found");
  assert.equal(applyDecision([rec], "a1", "weird").reason, "bad-status");
  assert.deepEqual(duePending([rec], T0 + 29 * 60000), [], "not due yet");
  assert.equal(duePending([rec], T0 + 30 * 60000).length, 1, "due exactly at expiresAt");
}
t();

// 2 — request: persists, logs APPROVAL_REQUESTED, notifies approvers, records the remote id; a repeat ask for the same recipe reuses the open one.
{
  const h = harness();
  const rec = h.flow.request({ recipeId: "flush-dns-cache", title: "Flush DNS cache", color: "green", tier: 1, requestedBy: "user", reason: "safe-auto-yellow-needs-approval", source: "app" });
  assert.equal(rec.status, "pending"); assert.equal(h.saved().length, 1);
  assert.ok(h.logs.some((l) => l.tag === "APPROVAL_REQUESTED" && /Flush DNS cache/.test(l.text)), "APPROVAL_REQUESTED logged");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(h.notified[0].event, "approval-requested"); assert.equal(h.notified[0].ctx.approvalId, rec.id);
  assert.equal(h.saved()[0].remoteId, `remote-${rec.id}`, "remote approval id recorded from the notify result");
  const dup = h.flow.request({ recipeId: "flush-dns-cache", title: "Flush DNS cache", color: "green" });
  assert.equal(dup.id, rec.id); assert.equal(dup.reused, true); assert.equal(h.saved().length, 1, "one open ask per recipe");
}
t();

// 3 — approve → execute through the injected runner (confirmed, with the approval id); deny NEVER executes.
{
  const h = harness();
  const a = h.flow.request({ recipeId: "restart-print-spooler", title: "Restart print spooler", color: "green" });
  const b = h.flow.request({ recipeId: "teams-cache-v1", title: "Clear Teams cache", color: "yellow" });
  const ap = await h.flow.approve(a.id, { decidedBy: "sam", channel: "desktop" });
  assert.equal(ap.ok, true); assert.equal(ap.approval.status, "approved");
  assert.equal(h.runs.length, 1); assert.deepEqual(h.runs[0], { recipeId: "restart-print-spooler", approvalId: a.id, decidedBy: "sam", channel: "desktop", color: "green" });
  assert.equal(ap.result.ran, true, "runner result surfaced");
  const dn = await h.flow.deny(b.id, { decidedBy: "sam", channel: "desktop" });
  assert.equal(dn.ok, true); assert.equal(dn.approval.status, "denied"); assert.equal(dn.result, null);
  assert.equal(h.runs.length, 1, "deny executed NOTHING");
  assert.ok(h.logs.some((l) => l.tag === "APPROVAL_DENIED" && /nothing was changed/i.test(l.text)));
  const twice = await h.flow.approve(a.id);
  assert.equal(twice.ok, false); assert.equal(h.runs.length, 1, "a second approve never re-runs");
  const st = h.flow.forState();
  assert.equal(st.pending.length, 0); assert.equal(st.decided.length, 2); assert.equal(st.pendingCount, 0);
}
t();

// 4 — expiry: 'skip' expires without running; 'proceed-green-only' runs GREEN only (yellow still expires untouched).
{
  const h = harness({ prefs: { onTimeout: "skip" } });
  h.flow.request({ recipeId: "restart-print-spooler", title: "Spooler", color: "green" });
  h.tick(31 * 60000);
  const r = await h.flow.expire();
  assert.equal(r.expired.length, 1); assert.equal(r.executed.length, 0); assert.equal(h.runs.length, 0, "skip never runs");
  assert.equal(h.flow.list()[0].status, "expired"); assert.equal(h.flow.list()[0].channel, "skip");

  const g = harness({ prefs: { onTimeout: "proceed-green-only" } });
  g.flow.request({ recipeId: "restart-print-spooler", title: "Spooler", color: "green" });
  g.flow.request({ recipeId: "teams-cache-v1", title: "Teams cache", color: "yellow" });
  g.tick(31 * 60000);
  const r2 = await g.flow.expire();
  assert.equal(r2.expired.length, 2);
  assert.equal(r2.executed.length, 1); assert.equal(r2.executed[0].approval.recipeId, "restart-print-spooler");
  assert.equal(g.runs.length, 1); assert.equal(g.runs[0].recipeId, "restart-print-spooler", "only the green fix proceeded on timeout");
  assert.equal(g.runs[0].decidedBy, "timeout-policy");
  const still = g.flow.list().find((a) => a.recipeId === "teams-cache-v1");
  assert.equal(still.status, "expired", "the yellow ask expired without running");
  assert.equal((await g.flow.expire()).expired.length, 0, "expiry is idempotent");
}
t();

// 5 — remote poll merge: only a pending record moves; approved runs, denied does not; garbage is ignored.
{
  assert.equal(remoteDecisionOf(null), null); assert.equal(remoteDecisionOf({ status: "pending" }), null);
  assert.deepEqual(remoteDecisionOf({ status: "APPROVED", decidedBy: "it@acme.com", decidedAt: "2026-10-08T12:05:00Z" }), { status: "approved", decidedBy: "it@acme.com", decidedAt: "2026-10-08T12:05:00Z" });
  const h = harness();
  const a = h.flow.request({ recipeId: "restart-print-spooler", title: "Spooler", color: "green" });
  const b = h.flow.request({ recipeId: "flush-dns-cache", title: "DNS", color: "green" });
  assert.equal((await h.flow.mergeRemote(a.id, { status: "nonsense" })).ok, false);
  const m1 = await h.flow.mergeRemote(a.id, { status: "approved", decidedBy: "it@acme.com" });
  assert.equal(m1.ok, true); assert.equal(m1.approval.channel, "remote"); assert.equal(m1.approval.decidedBy, "it@acme.com"); assert.equal(h.runs.length, 1);
  const m2 = await h.flow.mergeRemote(b.id, { status: "denied", decidedBy: "it@acme.com" });
  assert.equal(m2.ok, true); assert.equal(m2.approval.status, "denied"); assert.equal(h.runs.length, 1, "remote deny never runs");
  assert.equal((await h.flow.mergeRemote(a.id, { status: "denied" })).ok, false, "already decided → ignored");
}
t();

// 6 — a throwing / silent runner never breaks the flow; forState caps the decided slice at APPROVALS_DECIDED_SHOWN.
{
  const h = harness({ runner: async () => { throw new Error("boom"); } });
  const a = h.flow.request({ recipeId: "x", title: "X", color: "green" });
  const r = await h.flow.approve(a.id);
  assert.equal(r.ok, true); assert.equal(r.approval.status, "approved"); assert.equal(r.result.ok, false); assert.match(r.result.reason, /boom/);
  const many = harness();
  for (let i = 0; i < 15; i++) { const rec = many.flow.request({ recipeId: `r${i}`, title: `R${i}`, color: "green" }); await many.flow.deny(rec.id); }
  const st = many.flow.forState();
  assert.equal(st.decided.length, APPROVALS_DECIDED_SHOWN, "last 10 decided shown"); assert.equal(approvalsForState(many.flow.list(), 3).decided.length, 3);
}
t();

// 7 — main.mjs wiring: decideExecution in BOTH entry points, maintenance window wired, deep link → approval,
//     approve/deny IPC, remote poll, Control Center section gated under control-center (GATED_TABS).
{
  const root = path.resolve(import.meta.dirname, "..");
  const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
  const sup = main.match(/function runSupervisedFix[\s\S]*?\n\}/)[0];
  const auto = main.match(/async function autoFireIfEligible[\s\S]*?\n\}/)[0];
  assert.match(sup, /decideExecution\(/, "runSupervisedFix consults the approval policy");
  assert.match(sup, /executionPolicy\([\s\S]*decideExecution\(/, "…between the policy read and execute");
  assert.match(sup, /approvals\.request\(/, "request-approval creates an approval record");
  assert.match(sup, /source === "deep-link"/, "a deep link never executes instantly (approval instead)");
  assert.match(sup, /const countdown = approved \? false/, "an approval replaces the countdown");
  assert.match(auto, /decideExecution\(/, "autoFireIfEligible consults the approval policy");
  assert.match(auto, /maintenanceWindowNow\(/, "…and the maintenance window");
  assert.match(main, /import \{ checkMaintenanceWindow \} from "\.\/plan-maintenance-window\.mjs"/, "plan-maintenance-window.mjs is wired (was unwired)");
  assert.match(main, /ipcMain\.handle\("sentinel:approve-fix"/); assert.match(main, /ipcMain\.handle\("sentinel:deny-fix"/);
  assert.ok(/APPROVAL_ENDPOINT\}\?poll=1&id=/.test(main) && /aria-sentinel-approval"/.test(main), "remote decisions are polled from aria-sentinel-approval");
  assert.match(main, /setInterval\(\(\) => \{ approvalTick\(\)/, "poll/expiry tick every 60s while pending");
  assert.match(main, /approvals\.expire\(/, "expiry runs per approver.onTimeout");
  assert.match(main, /approvals: approvals\.forState\(\)/, "getState().approvals lists pending + decided");
  const idx = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
  const cc = idx.slice(idx.indexOf('<section id="control-center"'), idx.indexOf('<section id="recipes"'));
  assert.match(cc, /id="approvalsPanel"/, "Approvals section lives inside the Control Center tab");
  assert.ok(GATED_TABS.includes("control-center"), "…which is a gated (paid) tab");
  const rjs = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
  assert.match(rjs, /data-approve=/); assert.match(rjs, /data-deny=/); assert.match(rjs, /sentinel\.approveFix\?\./); assert.match(rjs, /sentinel\.denyFix\?\./);
}
t();

assert.equal(n, 7, "7 approvals-flow groups");
console.log(`approvals-flow test passed (${n} groups · record/transitions once-only · request+notify+remoteId · approve→injected runner · deny never runs · expiry skip vs green-only · remote merge · main wiring + CC gating).`);
