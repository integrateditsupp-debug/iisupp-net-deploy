// axis-priorities.js — S15 Priorities: one queue of everything open, ordered by when it is due.
// Ahmad, 2026-08-11: "add a priority section of all items being worked on and due dates."
//
// This screen INVENTS NOTHING. Every row is lifted from a snapshot module that already exists
// (followups / approvals / inbox / documents / outreach / fleet) and every date is that record's
// own field. Where a source genuinely has no due date — approvals and inbox carry `created_at`,
// not a deadline — the row says "no due date" and is aged instead. Rule 14: an honest gap beats a
// plausible number, and a fabricated deadline is the worst thing this screen could show.
import { el, ago } from './axis-dom.js';

const DAY = 86400000;

// " · raised 3d" only when the age is genuinely known — never a dangling "raised " with nothing after.
const aged = (ts) => { const a = ago(ts); return a ? ' · raised ' + a : ''; };

// Whole-day difference in LOCAL time. Comparing raw timestamps makes something due at 9am today
// read as "overdue" at 10am, which is wrong — a due date is a day, not an instant.
export function daysUntil(dueAt, now = new Date()) {
  // `new Date(null)` is the 1970 epoch, NOT an invalid date — without this guard an item with no
  // deadline renders as "20677 days overdue", which is the exact fabrication this screen must avoid.
  if (dueAt === null || dueAt === undefined || dueAt === '') return null;
  const d = new Date(dueAt);
  if (isNaN(d)) return null;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY);
}

export function dueLabel(dueAt, now = new Date()) {
  const n = daysUntil(dueAt, now);
  if (n === null) return { text: 'no due date', tone: 'none' };
  if (n < -1) return { text: Math.abs(n) + ' days overdue', tone: 'over' };
  if (n === -1) return { text: 'yesterday', tone: 'over' };
  if (n === 0) return { text: 'today', tone: 'today' };
  if (n === 1) return { text: 'tomorrow', tone: 'soon' };
  if (n <= 7) return { text: 'in ' + n + ' days', tone: 'soon' };
  return { text: new Date(dueAt).toISOString().slice(0, 10), tone: 'later' };
}

// Rank: overdue first, then soonest. Undated work sorts last — it is real work, but it cannot
// out-rank something with an actual deadline.
const rank = (it) => (it.dueAt ? daysUntil(it.dueAt) : 9999);

// Flatten the snapshot into one list. `dueAt: null` is meaningful and preserved, never defaulted.
export function collectPriorities(snap, now = new Date()) {
  const mod = (m) => (snap && snap[m] && snap[m].data) || {};
  const items = [];

  const fu = mod('followups');
  for (const [bucket, rows] of [['overdue', fu.overdue], ['due_today', fu.due_today], ['upcoming', fu.upcoming]])
    for (const f of rows || [])
      // fid/bid are the record ids, carried so a voice removal (board.remove) can name the real
      // follow_ups row instead of guessing from the title.
      items.push({ title: f.company || 'Prospect', source: 'Follow-up', dueAt: f.due_at || null,
        detail: 'queued → Approvals', bucket, screen: 'followups',
        fid: f.id || null, bid: f.business_id || null });

  for (const r of mod('approvals').rows || [])
    if (r.status === 'pending')
      items.push({ title: r.subject || '(no subject)', source: 'Approval', dueAt: null,
        detail: 'waiting on you' + aged(r.created_at), screen: 'approvals' });

  const ACTIONABLE = ['reply_to_outreach', 'new_inbound_request'];
  for (const m of mod('inbox').rows || [])
    if (ACTIONABLE.includes(m.classification) && !m.actioned && !m.snoozed_until)
      items.push({ title: m.subject || '(no subject)', source: 'Inbox', dueAt: null,
        detail: 'client waiting' + (ago(m.received_at) ? ' · ' + ago(m.received_at) : ''), screen: 'inbox' });

  for (const d of mod('documents').rows || [])
    if ((d.status || '').toLowerCase() === 'draft')
      items.push({ title: d.title || d.type || 'Document', source: 'Document', dueAt: d.due_at || null,
        detail: 'draft — not sent', screen: 'documents' });

  return items.sort((a, b) => rank(a) - rank(b));
}

// "All items being worked on" — the in-flight half. An agent counts as working only if the fleet
// snapshot says so; there is no derived/guessed activity here.
export function collectInFlight(snap) {
  const mod = (m) => (snap && snap[m] && snap[m].data) || {};
  const out = [];
  for (const a of mod('fleet').agents || [])
    if (a.status && /run|active|working/i.test(a.status))
      out.push({ title: a.name || 'agent', detail: a.role || a.status, source: 'Agent' });
  const drafts = mod('outreach').drafts;
  const n = Array.isArray(drafts) ? drafts.length : (typeof drafts === 'number' ? drafts : 0);
  if (n) out.push({ title: n + (n === 1 ? ' outreach draft' : ' outreach drafts'), detail: 'awaiting approval', source: 'Outreach' });
  return out;
}

// ── $0 local answers ─────────────────────────────────────────────────────────
// When the reasoning brain is unavailable (out of credit, bad key, network), AXIS still answers
// the questions that only need the board — no LLM, no API call, no spend. Every number below is
// read straight from the snapshot; if a question needs reasoning, this returns null and the caller
// reports the real reason instead of guessing. Rule 14 all the way down.
const listBits = (items, n = 3) => items.slice(0, n)
  .map(i => `${i.title} (${dueLabel(i.dueAt).text})`).join(', ');

// Subjects the priorities board has no data about. If one of these appears, the board declines and
// lets a layer that actually knows answer instead.
const OFF_BOARD = /\b(youtube|videos?|vids?|shorts?|channel|clips?|thumbnail|subscribers?|upload(?:s|ed|ing)?|stripe|invoice|payroll|ticket)\b/i;

// The board ANSWERS questions; it never performs them — and a command that merely NAMES a board
// noun must not be answered as if it were a question about that noun. Ahmad, 2026-08-12: "remove
// the items that are in priority list" contained the word "priority", so the next-item branch below
// claimed it and recited "Next up is Accounting Plus Business Services…" — a request to act,
// answered with a status line, twice in a row. The verbs here are unambiguous: none of them ever
// opens a question the board can answer, so declining costs nothing and sends the utterance on to
// the layers that can actually act (the intent ops, then the brain — which sees the conversation).
const COMMAND_ANYWHERE = /\b(remove|delete|clear|drop|dismiss|archive|get rid of|wipe|purge|cancel|resched(?:ule)?|reprioriti[sz]e|action (?:it|them|these|those)|open(?:ing)? up)\b/i;
// Verbs that are commands only when they LEAD the sentence — embedded, they appear in genuine
// board questions ("what is waiting on me to approve") that the branches below exist to answer.
const COMMAND_LEADING = /^(?:(?:ok(?:ay)?|all right|alright|please|now|just|yes|yeah|and|then|so)[,\s]+)*(?:go ahead(?: and)?\s+)?(approve|reject|snooze|skip|park|mark|close|complete|finish|handle|move|open|do|work with|talk to|ask)\b/i;
const isCommand = (q) => COMMAND_ANYWHERE.test(q) || COMMAND_LEADING.test(q);

export function localAnswer(question, snap, now = new Date()) {
  const q = String(question || '').toLowerCase();
  const items = collectPriorities(snap, now);
  const overdue = items.filter(i => dueLabel(i.dueAt, now).tone === 'over');
  const today = items.filter(i => dueLabel(i.dueAt, now).tone === 'today');
  const kpis = (snap && snap.overview && snap.overview.data && snap.overview.data.kpis) || {};
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

  // The board knows approvals, the inbox and follow-ups. It knows NOTHING about the YouTube channel,
  // a specific client's file, or anything else — so a question that merely CONTAINS a board word
  // must not be answered from the board. Ahmad, 2026-08-12: "what is the status on the YouTube
  // videos" was answered with follow-up counts, three times, because the word "status" was enough to
  // claim it. Refusing here sends the question on to the intent layer and then the brain, which is
  // where a topic question belongs. Answering the wrong question confidently is worse than pausing.
  if (OFF_BOARD.test(q)) return null;

  // A command is never a board question, whatever nouns it contains. See isCommand above.
  if (isCommand(q)) return null;

  if (/\b(status|going on|today|update|briefing|summary|board)\b/.test(q)) {
    const a = num(kpis.awaiting_approval), m = num(kpis.messages_waiting), f = num(kpis.followups_due);
    if (a === null && m === null && f === null && !items.length) return 'I do not have the board yet.';
    const bits = [];
    if (a) bits.push(`${a} ${a === 1 ? 'approval' : 'approvals'} waiting`);
    if (m) bits.push(`${m} client ${m === 1 ? 'reply' : 'replies'} waiting`);
    if (f) bits.push(`${f} ${f === 1 ? 'follow-up' : 'follow-ups'} due`);
    if (overdue.length) bits.push(`${overdue.length} overdue`);
    if (!bits.length) return 'All quiet. Nothing needs you.';
    return bits.join(', ') + '.' + (items.length ? ' Top: ' + listBits(items) + '.' : '');
  }
  if (/\b(need|needs me|waiting on me|my attention|approve|approvals?)\b/.test(q)) {
    const ap = items.filter(i => i.source === 'Approval');
    const inbox = items.filter(i => i.source === 'Inbox');
    if (!ap.length && !inbox.length) return 'Nothing is waiting on you.';
    const bits = [];
    if (ap.length) bits.push(`${ap.length} ${ap.length === 1 ? 'approval' : 'approvals'}`);
    if (inbox.length) bits.push(`${inbox.length} client ${inbox.length === 1 ? 'message' : 'messages'}`);
    return bits.join(' and ') + ' waiting on you.';
  }
  if (/\b(next|most urgent|first|priority|priorities)\b/.test(q)) {
    if (!items.length) return 'Nothing open. Every queue is clear.';
    const top = items[0];
    // Written as a sentence, not a row. The old form was "Next: <title> — <due>. <detail>." which
    // is three fields with punctuation between them; spoken aloud it sounded like a database.
    const due = dueLabel(top.dueAt, now);
    const when = due.tone === 'none' ? '' : due.tone === 'over' ? `, ${due.text}` : `, due ${due.text}`;
    const what = top.detail ? ` It is ${top.detail}.` : '';
    return `Next up is ${top.title}${when}.${what}`;
  }
  if (/\b(overdue|late|behind)\b/.test(q))
    return overdue.length ? `${overdue.length} overdue: ${listBits(overdue)}.` : 'Nothing is overdue.';
  if (/\b(due|follow.?up|deadline)\b/.test(q))
    return today.length ? `${today.length} due today: ${listBits(today)}.` : 'Nothing is due today.';
  if (/\b(working on|in flight|agents?|fleet|running)\b/.test(q)) {
    const flight = collectInFlight(snap);
    return flight.length ? 'Being worked on: ' + flight.map(f => f.title).join(', ') + '.'
      : 'No agent is reporting active work right now.';
  }
  return null;   // needs reasoning — the caller reports the real outage instead of inventing one
}

const TONE_VAR = { over: 'var(--crit)', today: 'var(--gold)', soon: 'var(--txt-2)', later: 'var(--txt-3)', none: 'var(--txt-3)' };

export function renderPriorities(c, { snap, go, head }) {
  const items = collectPriorities(snap);
  const flight = collectInFlight(snap);
  const n = (t) => items.filter(i => dueLabel(i.dueAt).tone === t).length;

  c.append(head('Priorities', 'every open item, ordered by when it is due — nothing here is invented'));

  // Counters. A zero renders as a plain zero, never hidden and never dressed up.
  const counts = [['Overdue', n('over'), 'var(--crit)'], ['Due today', n('today'), 'var(--gold)'],
    ['This week', n('soon'), 'var(--txt)'], ['No due date', n('none'), 'var(--txt-3)'],
    ['In flight', flight.length, 'var(--txt)']];
  c.append(el('div', { class: 'kpi-grid' }, counts.map(([l, v, col]) =>
    el('div', { class: 'kpi' }, [el('div', { class: 'label' }, l), el('div', { class: 'value', style: 'color:' + col }, String(v))]))));

  c.append(head('Open items', items.length ? items.length + ' total' : 'nothing open', 'margin-top:22px'));
  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!items.length) card.append(el('div', { class: 'empty' }, 'Nothing open. Every queue is clear.'));
  else items.forEach((it) => {
    const d = dueLabel(it.dueAt);
    card.append(el('div', { class: 'row axis-pri-row' }, [
      el('span', { class: 'axis-pri-bar', style: 'background:' + TONE_VAR[d.tone] }),
      el('span', { class: 'stage-tag' }, it.source),
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, it.title),
        el('div', { style: 'font-size:12px;color:var(--txt-3)' }, it.detail)]),
      el('span', { class: 'mono axis-pri-due', style: 'color:' + TONE_VAR[d.tone] }, d.text),
      el('button', { class: 'chip', onclick: () => go(it.screen) }, 'Open'),
    ]));
  });
  c.append(card);

  c.append(head('Being worked on', 'reported by the fleet, not inferred', 'margin-top:22px'));
  const fc = el('div', { class: 'card', style: 'padding:0' });
  if (!flight.length) fc.append(el('div', { class: 'empty' }, 'No agent is reporting active work right now.'));
  else flight.forEach(f => fc.append(el('div', { class: 'row' }, [
    el('span', { class: 'stage-tag' }, f.source),
    el('div', { style: 'flex:1' }, f.title),
    el('span', { style: 'font-size:12px;color:var(--txt-3)' }, f.detail)])));
  c.append(fc);
}
