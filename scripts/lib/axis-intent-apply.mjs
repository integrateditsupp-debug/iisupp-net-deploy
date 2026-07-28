// axis-intent-apply.mjs — the WORKER side of the AXIS Command Center v2 write path. LOCAL ONLY.
//
// Why this exists: the CC v2 UI posts intents to /api/axis/intent, which queues them into the axis-inbox
// Blobs store as { schema:'axis-cc-v2', type, payload }. The legacy approve-hop (processAxisInbox) only
// recognises the older { action:'command'|'approval', intent } shape, so EVERY v2 intent fell into `hold`
// and nothing ever applied it. The Waiting Reply → "Delegate" button therefore queued a record and then
// did nothing forever. This module is the missing applier.
//
// Rails (unchanged): nothing here sends, pays, or contacts anyone. `delegate_followup` only writes
// PENDING outreach_items + scheduled follow_ups rows — every one of which still has to clear Approvals
// before a byte leaves the building. That is what makes it safe to apply automatically.
//
// Anything this module does not explicitly know how to apply stays HELD for Ahmad. Forged/garbage payloads
// are REJECTED (consumed with a reason) rather than held, so one bad record cannot jam the queue forever.
import { scheduleFollowups, CADENCE_DAYS } from './followups.mjs';

const DAY = 86400000;
export const V2_SCHEMA = 'axis-cc-v2';

const int = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

// ── delegate_followup ─────────────────────────────────────────────────────────────────────────────
// Ahmad's ask, verbatim: "if we do not hear back pass it to director agent to delegate to the follow up
// agent we already might have so it follows up then shows in the follow up tab".
// The Director's delegation IS scheduleFollowups() — it is the follow-up engine that already exists.
//
// Anchor: the initial went out N days ago and drew silence, so anchoring the cadence at sent_at would
// make all three touches instantly overdue and dump the whole ladder into Approvals at once. Anchoring at
// `now` would make the first chase 3 days away, which is slower than the operator who just clicked
// "Delegate" expects. So we anchor at now - cadence[0]: touch 1 is due immediately, 2 and 3 keep their
// real spacing. Still pending, still approval-gated.
function applyDelegateFollowup(db, payload) {
  const businessId = int(payload.business_id);
  const itemId = int(payload.outreach_item_id);
  if (!businessId) return { ok: false, reason: 'business_id required' };

  const biz = db.prepare('SELECT id FROM businesses WHERE id=?').get(businessId);
  if (!biz) return { ok: false, reason: `business ${businessId} not found` };

  // Only delegate off a real SENT initial. Guards against a malformed/forged payload scheduling outreach
  // against a business that was never actually contacted.
  if (itemId) {
    const item = db.prepare('SELECT id,business_id,status,kind FROM outreach_items WHERE id=?').get(itemId);
    if (!item) return { ok: false, reason: `outreach_item ${itemId} not found` };
    if (item.business_id !== businessId) return { ok: false, reason: 'outreach_item does not belong to business' };
    if (item.status !== 'sent') return { ok: false, reason: `outreach_item ${itemId} is ${item.status}, not sent — nothing to follow up` };
  }

  const anchor = Date.now() - (CADENCE_DAYS[0] || 3) * DAY;
  const ids = scheduleFollowups(db, businessId, itemId || null, anchor);
  // Zero is a legitimate outcome, not a failure: the cadence is already exhausted (max touches reached),
  // which is exactly the STOP rail doing its job.
  return { ok: true, scheduled: ids.length, follow_up_ids: ids, business_id: businessId, capped: ids.length === 0 };
}

export const V2_HANDLERS = {
  delegate_followup: applyDelegateFollowup,
};

// Pure-ish dispatcher (side effects are confined to the handlers, which write SQLite).
// items: the raw axis-inbox entries the worker just read.
// Returns { applied, rejected, held } — the worker consumes applied + rejected, and leaves held alone.
export function applyAxisV2Intents(db, items, opts = {}) {
  const handlers = opts.handlers || V2_HANDLERS;
  const applied = [], rejected = [], held = [];
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || !it.id) continue;
    if (it.schema !== V2_SCHEMA) { held.push(it); continue; }       // legacy shape — not ours
    const fn = handlers[it.type];
    if (typeof fn !== 'function') { held.push(it); continue; }      // unknown v2 type — hold for Ahmad
    let res;
    try {
      res = fn(db, it.payload && typeof it.payload === 'object' ? it.payload : {});
    } catch (e) {
      res = { ok: false, reason: e?.message || String(e) };
    }
    (res && res.ok ? applied : rejected).push(Object.assign({ item: it, type: it.type }, res));
  }
  return { applied, rejected, held };
}
