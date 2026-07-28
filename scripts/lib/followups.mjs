// followups.mjs — AXIS CC v2 P6 follow-up cadence engine. WORKER-OWNED. Generates follow-ups AHEAD and
// queues them through Approvals (pending outreach_items kind='followup'); the follow_ups table tracks the
// schedule. Cadence day 3/7/14, MAX 3 touches then STOP. Auto-cancel on reply is handled by sentry.mjs
// (cancelFollowups) — reused, not duplicated. Nothing sends.
import { DEFAULT_RAILS, OUTREACH_IDENTITY, CASL } from './axis-constants.mjs';

const DAY = 86400000;
export const CADENCE_DAYS = DEFAULT_RAILS.followup_days;   // [3, 7, 14]
export const MAX_TOUCHES = DEFAULT_RAILS.max_followups;    // 3

// Short, confident follow-up bodies (peer-to-peer, no chasing past the limit). One per touch.
function followupBody(p, touch) {
  const name = p?.name || 'there';
  if (touch === 1) return `Hi ${name} team,\n\nQuick nudge on my last note — happy to send the one-pager on what I'd check first, no obligation. Just reply "send it".\n\n— ${OUTREACH_IDENTITY.from_name}, ${CASL.company}`;
  if (touch === 2) return `Hi ${name} team,\n\nOne genuinely useful thing regardless of whether we ever work together: a 5-point IT/security self-check for firms your size. Want me to send it over?\n\n— ${OUTREACH_IDENTITY.from_name}, ${CASL.company}`;
  return `Hi ${name} team,\n\nLast note from me — I'll leave it here so I'm not cluttering your inbox. If anything changes on the IT/security side, ${OUTREACH_IDENTITY.from_email} reaches me directly. All the best.\n\n— ${OUTREACH_IDENTITY.from_name}, ${CASL.company}`;
}

// Schedule up to MAX_TOUCHES follow-ups for a business whose initial went out at `sentAt`. Each touch is a
// pending outreach_item (→ Approvals) + a follow_ups row (the schedule). Returns the created follow_up ids.
export function scheduleFollowups(db, businessId, initialItemId, sentAt = Date.now()) {
  const existing = db.prepare("SELECT COUNT(*) n FROM follow_ups WHERE business_id=? AND status IN ('scheduled','sent')").get(businessId).n;
  const p = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  const to = p?.public_email || null;
  const ids = [];
  for (let i = existing; i < MAX_TOUCHES; i++) {
    const touch = i + 1;
    const due = sentAt + CADENCE_DAYS[i] * DAY;
    const oi = db.prepare(`INSERT INTO outreach_items (business_id,channel,kind,subject,body,to_email,template_id,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(businessId, 'email', 'followup', `Follow-up ${touch}`, followupBody(p, touch), to, 'followup-v1', 'pending', Date.now());
    const fu = db.prepare("INSERT INTO follow_ups (outreach_item_id,business_id,due_at,status) VALUES (?,?,?,?)")
      .run(Number(oi.lastInsertRowid), businessId, due, 'scheduled');
    ids.push(Number(fu.lastInsertRowid));
  }
  return ids;
}

// Views for S8. `now` is injectable for tests. Overdue = past & still scheduled; Due today = within today;
// Upcoming = future; Auto-cancelled = status cancelled.
export function followupViews(db, now = Date.now(), realOnly = false) {
  const rows = db.prepare(`SELECT f.*, b.name AS company, b.handle FROM follow_ups f LEFT JOIN businesses b ON b.id=f.business_id${realOnly ? ' WHERE b.is_real=1' : ''}`).all();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = startOfDay.getTime() + DAY;
  const enrich = (r) => ({ id: r.id, business_id: r.business_id, company: r.company || r.handle, due_at: r.due_at, status: r.status, outreach_item_id: r.outreach_item_id });
  return {
    due_today: rows.filter(r => r.status === 'scheduled' && r.due_at >= startOfDay.getTime() && r.due_at < endOfDay).map(enrich),
    overdue: rows.filter(r => r.status === 'scheduled' && r.due_at < startOfDay.getTime()).map(enrich),
    upcoming: rows.filter(r => r.status === 'scheduled' && r.due_at >= endOfDay).map(enrich),
    auto_cancelled: rows.filter(r => r.status === 'cancelled').map(enrich),
    cadence: CADENCE_DAYS, max_touches: MAX_TOUCHES,
  };
}
