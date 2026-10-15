// RUN-CU / CU4 (2026-10-08) — the approvals ledger + flow. An "approval" is a pending fix that WILL NOT RUN
// until a person says yes (in-app Approve, a remote link, or voice "yes" in the companion). It replaces the
// 10-second countdown for anything the autonomy level does not let Sentinel decide alone.
//
// Injectable + Electron-free so tests/approvals-flow.test.mjs drives every transition with a fake store, a
// fake clock and an injected runner:
//   store   { get(): Approval[], set(Approval[]) }        (main: electron-store key "approvals")
//   runner  async ({ recipeId, approvalId, decidedBy, channel }) → execution result   (main: runSupervisedFix confirmed:true)
//   notify  async (event, ctx) → dispatch result (optional)  (main: notifyDispatcher.dispatch)
//   prefs   () → sanitized setup prefs (approver.timeoutMinutes / onTimeout)
//   log     (tag, text, extra)                              (main: logEvent)
//
// Record shape (store.approvals[]):
//   { id, createdAt, expiresAt, recipeId, title, color, tier, detectionId, requestedBy, status:
//     'pending'|'approved'|'denied'|'expired', decidedBy, decidedAt, channel, reason, source, remoteId }
// Invariants proven by the suite: deny never executes · expired never executes unless onTimeout is
// 'proceed-green-only' AND the fix is green · a decision is applied once (no double-run) · remote merge
// only ever moves pending → approved|denied.
//
// KILL GATE 2026-10-14 (review P0-2) — an approval was the one execution path the panic switch did not reach: an emailed
// "Approve" merged by the poll ran the fix with no countdown after Ctrl+Alt+K. Now:
//   gate    () → "" | reason   (main: killGateReason) — while it returns a reason, approve() / mergeRemote(approved) are
//           REFUSED before the record moves (the approval is not consumed), and an expiry never runs the timeout policy;
//   hold()  Ctrl+Alt+K puts every pending approval ON HOLD (status "held"): nothing can approve, run or expire it into a
//           run — not a click, not a link, not the timeout policy;
//   reaskHeld()  Start ARIA (the deliberate resume) asks again: each held approval is pending once more with a FRESH expiry
//           and NO remote id, so a link (or a decision) from before the kill can never run it — approvers get new links.
// Deny is never gated: refusing a fix is always allowed.
export const APPROVAL_STATUSES = Object.freeze(["pending", "approved", "denied", "expired", "held"]);
export const APPROVALS_MAX = 100;
export const APPROVALS_DECIDED_SHOWN = 10;

function iso(ms) { return new Date(ms).toISOString(); }
function clampMinutes(v, dflt = 30) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(1440, Math.max(5, n)) : dflt; }
function fallbackId(now) { return `apr-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

/** Pure: build a pending approval record. */
export function createApprovalRecord(input = {}, { now = Date.now(), timeoutMinutes = 30, id } = {}) {
  const t = Number(now) || Date.now();
  return {
    id: String(id || fallbackId(t)),
    createdAt: iso(t),
    expiresAt: iso(t + clampMinutes(timeoutMinutes) * 60000),
    recipeId: String(input.recipeId || "").slice(0, 80),
    title: String(input.title || input.recipeId || "Fix").replace(/[^\w .,:;'()\-\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
    color: ["green", "yellow", "red"].includes(input.color) ? input.color : "yellow",
    tier: Number.isInteger(input.tier) ? input.tier : 2,
    detectionId: input.detectionId ? String(input.detectionId).slice(0, 64) : null,
    requestedBy: String(input.requestedBy || "sentinel").slice(0, 40),
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    channel: null,
    reason: String(input.reason || "").slice(0, 80),
    source: String(input.source || "detection").slice(0, 40),
    remoteId: null
  };
}

/** Pure: apply a decision. Only a PENDING record can move; anything else is returned unchanged with ok:false. */
export function applyDecision(list = [], id, status, { decidedBy = "self", channel = "desktop", now = Date.now() } = {}) {
  const arr = Array.isArray(list) ? list : [];
  const idx = arr.findIndex((a) => a && a.id === id);
  if (idx === -1) return { ok: false, reason: "not-found", list: arr, approval: null };
  const cur = arr[idx];
  if (cur.status !== "pending") return { ok: false, reason: `already-${cur.status}`, list: arr, approval: cur };
  if (!["approved", "denied", "expired"].includes(status)) return { ok: false, reason: "bad-status", list: arr, approval: cur };
  const next = { ...cur, status, decidedBy: String(decidedBy || "self").slice(0, 40), decidedAt: iso(Number(now) || Date.now()), channel: String(channel || "desktop").slice(0, 20) };
  const out = arr.slice(); out[idx] = next;
  return { ok: true, reason: "", list: out, approval: next };
}

/** Pure: Ctrl+Alt+K — every PENDING record becomes "held" (nothing can approve, run or expire it into a run). */
export function holdPending(list = [], { now = Date.now(), reason = "kill-switch" } = {}) {
  const arr = Array.isArray(list) ? list : [];
  const held = [];
  const at = iso(Number(now) || Date.now());
  const out = arr.map((a) => {
    if (!a || a.status !== "pending") return a;
    const next = { ...a, status: "held", decidedBy: String(reason || "kill-switch").slice(0, 40), decidedAt: at, channel: "kill-switch", heldAt: at };
    held.push(next);
    return next;
  });
  return { list: out, held };
}

/**
 * Pure: the deliberate resume (Start ARIA) asks again. Every HELD record is pending once more with a fresh expiry and
 * its remote id DROPPED — an approval link (or a server-side decision) from before the kill can never run it. A held
 * record whose recipe already has a new pending ask stays held (one open ask per recipe).
 */
export function reaskHeld(list = [], { now = Date.now(), timeoutMinutes = 30 } = {}) {
  const arr = Array.isArray(list) ? list : [];
  const t = Number(now) || Date.now();
  const reasked = [];
  const pendingRecipes = new Set(arr.filter((a) => a && a.status === "pending").map((a) => a.recipeId));
  const out = arr.map((a) => {
    if (!a || a.status !== "held" || pendingRecipes.has(a.recipeId)) return a;
    pendingRecipes.add(a.recipeId);
    const next = { ...a, status: "pending", decidedBy: null, decidedAt: null, channel: null, remoteId: null, expiresAt: iso(t + clampMinutes(timeoutMinutes) * 60000), reaskedAt: iso(t) };
    reasked.push(next);
    return next;
  });
  return { list: out, reasked };
}
const reaskHeldPure = reaskHeld; // the flow's own reaskHeld() method shadows the name inside createApprovalsFlow

/** Pure: which pending records are past expiresAt. */
export function duePending(list = [], now = Date.now()) {
  return (Array.isArray(list) ? list : []).filter((a) => a && a.status === "pending" && Date.parse(a.expiresAt) <= Number(now));
}

/** Pure: the renderer slice — pending first, then the last N decided (newest first). */
export function approvalsForState(list = [], limit = APPROVALS_DECIDED_SHOWN) {
  const arr = (Array.isArray(list) ? list : []).filter(Boolean);
  const byTime = (a, b) => Date.parse(b.decidedAt || b.createdAt) - Date.parse(a.decidedAt || a.createdAt);
  return {
    pending: arr.filter((a) => a.status === "pending").sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    decided: arr.filter((a) => a.status !== "pending").sort(byTime).slice(0, limit),
    pendingCount: arr.filter((a) => a.status === "pending").length
  };
}

/** Pure: normalize a remote poll body into a decision, or null when it carries none. */
export function remoteDecisionOf(body) {
  if (!body || typeof body !== "object") return null;
  const status = String(body.status || "").toLowerCase();
  if (status !== "approved" && status !== "denied") return null;
  return { status, decidedBy: String(body.decidedBy || "remote").slice(0, 40), decidedAt: body.decidedAt ? String(body.decidedAt).slice(0, 30) : null };
}

/**
 * The flow. Everything that touches the world (runner / notify / log) is injected.
 */
export function createApprovalsFlow(deps = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const prefs = typeof deps.prefs === "function" ? deps.prefs : () => ({});
  const store = deps.store || (() => { let v = []; return { get: () => v, set: (n) => { v = n; } }; })();
  const uuid = typeof deps.uuid === "function" ? deps.uuid : null;
  const onChange = typeof deps.onChange === "function" ? deps.onChange : () => {};
  // KILL GATE (review P0-2) — "" = fixes may run; anything else = the reason nothing may run right now. A throwing gate
  // reads as CLOSED (fail-safe: a broken gate never lets a fix through).
  const gate = typeof deps.gate === "function" ? () => { try { return String(deps.gate() || ""); } catch { return "gate-unavailable"; } } : () => "";
  const running = new Set(); // approval ids whose runner is in flight — a decision executes at most once

  const read = () => { try { const v = store.get(); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (list) => { try { store.set(list.slice(0, APPROVALS_MAX)); } catch { /* best-effort */ } onChange(); };

  function approverPrefs() { const p = prefs() || {}; return p.approver || {}; }

  async function execute(approval, meta) {
    if (!approval || running.has(approval.id)) return { ok: false, reason: "already-running" };
    if (typeof deps.runner !== "function") return { ok: false, reason: "no-runner" };
    running.add(approval.id);
    try {
      const res = await deps.runner({ recipeId: approval.recipeId, approvalId: approval.id, decidedBy: meta.decidedBy, channel: meta.channel, color: approval.color });
      return res == null ? { ok: false, reason: "no-result" } : res;
    } catch (err) {
      return { ok: false, reason: String((err && err.message) || "runner-error").slice(0, 60) };
    } finally { running.delete(approval.id); }
  }

  /** Create + persist a pending approval, log it, notify approvers. Returns the record (notify result on .notify when awaited). */
  function request(input = {}) {
    const t = now();
    const rec = createApprovalRecord(input, { now: t, timeoutMinutes: approverPrefs().timeoutMinutes, id: uuid ? uuid() : undefined });
    const list = read();
    // one pending approval per recipe at a time — a second detection of the same thing re-uses the open ask
    const open = list.find((a) => a && a.status === "pending" && a.recipeId === rec.recipeId);
    if (open) return { ...open, reused: true };
    write([rec, ...list]);
    log("APPROVAL_REQUESTED", `Approval requested: ${rec.title} (${rec.color}) — waits ${clampMinutes(approverPrefs().timeoutMinutes)} min.`, { recipeId: rec.recipeId, approvalId: rec.id, source: rec.source });
    if (typeof deps.notify === "function") {
      Promise.resolve(deps.notify("approval-requested", { title: rec.title, recipeId: rec.recipeId, severity: rec.color, approvalId: rec.id, expiresAt: rec.expiresAt, requestedBy: rec.requestedBy }))
        .then((r) => {
          const remoteId = r && r.remote && r.remote.approvalId;
          if (remoteId) { const cur = read(); const i = cur.findIndex((a) => a && a.id === rec.id); if (i >= 0) { cur[i] = { ...cur[i], remoteId: String(remoteId) }; write(cur); } }
        })
        .catch(() => undefined);
    }
    return rec;
  }

  async function approve(id, { decidedBy = "self", channel = "desktop" } = {}) {
    // KILL GATE (review P0-2) — refused BEFORE the record moves: the approval is not consumed, nothing runs.
    const closed = gate();
    if (closed) {
      const cur = read().find((a) => a && a.id === id) || null;
      log("APPROVAL_REFUSED", `Approval not applied${cur ? `: ${cur.title}` : ""} (via ${channel}) — ${closed}. Nothing was run.`, { recipeId: cur ? cur.recipeId : "", approvalId: id, channel, gate: closed });
      return { ok: false, reason: "kill-gate", gate: closed, approval: cur };
    }
    const r = applyDecision(read(), id, "approved", { decidedBy, channel, now: now() });
    if (!r.ok) return { ok: false, reason: r.reason, approval: r.approval };
    write(r.list);
    log("APPROVAL_APPROVED", `Approved: ${r.approval.title} (by ${decidedBy} via ${channel}).`, { recipeId: r.approval.recipeId, approvalId: id });
    const result = await execute(r.approval, { decidedBy, channel });
    return { ok: true, approval: r.approval, result };
  }

  async function deny(id, { decidedBy = "self", channel = "desktop" } = {}) {
    const r = applyDecision(read(), id, "denied", { decidedBy, channel, now: now() });
    if (!r.ok) return { ok: false, reason: r.reason, approval: r.approval };
    write(r.list);
    log("APPROVAL_DENIED", `Denied: ${r.approval.title} (by ${decidedBy} via ${channel}) — nothing was changed.`, { recipeId: r.approval.recipeId, approvalId: id });
    return { ok: true, approval: r.approval, result: null }; // never executes
  }

  /** Expire overdue pendings. onTimeout 'proceed-green-only' runs GREEN fixes only; everything else just expires. */
  async function expire(at = now()) {
    const due = duePending(read(), at);
    const out = { expired: [], executed: [] };
    const onTimeout = approverPrefs().onTimeout === "proceed-green-only" ? "proceed-green-only" : "skip";
    for (const a of due) {
      const r = applyDecision(read(), a.id, "expired", { decidedBy: "timeout", channel: onTimeout, now: at });
      if (!r.ok) continue;
      write(r.list);
      out.expired.push(r.approval);
      // KILL GATE (review P0-2) — the timeout policy never runs a fix while the gate is closed (stopped / killed / paused).
      const closed = onTimeout === "proceed-green-only" && r.approval.color === "green" ? gate() : "";
      if (closed) {
        log("APPROVAL_TIMEOUT", `No answer in time — NOT run (${closed}): ${r.approval.title}. Nothing was changed.`, { recipeId: r.approval.recipeId, approvalId: a.id, gate: closed });
      } else if (onTimeout === "proceed-green-only" && r.approval.color === "green") {
        log("APPROVAL_TIMEOUT", `No answer in time — green fix proceeds per your timeout setting: ${r.approval.title}.`, { recipeId: r.approval.recipeId, approvalId: a.id });
        out.executed.push({ approval: r.approval, result: await execute(r.approval, { decidedBy: "timeout-policy", channel: "timeout" }) });
      } else {
        log("APPROVAL_TIMEOUT", `No answer in time — skipped: ${r.approval.title} (nothing was changed).`, { recipeId: r.approval.recipeId, approvalId: a.id });
      }
    }
    return out;
  }

  /** Merge a remote (server) decision for a pending record. (An "approved" goes through approve(), so the gate holds.) */
  async function mergeRemote(id, body) {
    const decision = remoteDecisionOf(body);
    if (!decision) return { ok: false, reason: "no-decision" };
    if (decision.status === "approved") return approve(id, { decidedBy: decision.decidedBy, channel: "remote" });
    return deny(id, { decidedBy: decision.decidedBy, channel: "remote" });
  }

  /** Ctrl+Alt+K: every pending approval goes ON HOLD (audited). Returns the held records. */
  function hold(reason = "kill-switch") {
    const r = holdPending(read(), { now: now(), reason });
    if (!r.held.length) return { held: [] };
    write(r.list);
    for (const a of r.held) log("APPROVAL_HELD", `On hold (${reason}): ${a.title} — it cannot be approved or run, and no earlier approval link works for it. Start ARIA asks again.`, { recipeId: a.recipeId, approvalId: a.id, reason });
    return { held: r.held };
  }

  /** Start ARIA after Ctrl+Alt+K: every held approval is asked AGAIN (fresh expiry, new approval links, audited). */
  function reaskHeld() {
    const r = reaskHeldPure(read(), { now: now(), timeoutMinutes: approverPrefs().timeoutMinutes });
    if (!r.reasked.length) return { reasked: [] };
    write(r.list);
    for (const rec of r.reasked) {
      log("APPROVAL_REQUESTED", `Asked again after Start ARIA: ${rec.title} (${rec.color}) — the approval links sent before Ctrl+Alt+K no longer work; waits ${clampMinutes(approverPrefs().timeoutMinutes)} min.`, { recipeId: rec.recipeId, approvalId: rec.id, source: rec.source, reasked: true });
      if (typeof deps.notify === "function") {
        Promise.resolve(deps.notify("approval-requested", { title: rec.title, recipeId: rec.recipeId, severity: rec.color, approvalId: rec.id, expiresAt: rec.expiresAt, requestedBy: rec.requestedBy }))
          .then((res) => {
            const remoteId = res && res.remote && res.remote.approvalId;
            if (remoteId) { const cur = read(); const i = cur.findIndex((a) => a && a.id === rec.id && a.status === "pending"); if (i >= 0) { cur[i] = { ...cur[i], remoteId: String(remoteId) }; write(cur); } }
          })
          .catch(() => undefined);
      }
    }
    return { reasked: r.reasked };
  }

  return {
    list: read,
    pending: () => read().filter((a) => a && a.status === "pending"),
    held: () => read().filter((a) => a && a.status === "held"),
    forState: (limit) => approvalsForState(read(), limit),
    request, approve, deny, expire, mergeRemote, hold, reaskHeld,
    byId: (id) => read().find((a) => a && a.id === id) || null
  };
}
