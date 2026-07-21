// tests/axis-snapshots.test.mjs — AXIS CC v2 P1 read-model correctness.
// Proves the Badge Law (only un-actioned reply_to_outreach + new_inbound_request count), the approvals
// pending count, and that every declared snapshot module is present. Uses an in-memory SQLite DB.
import { openDb } from '../scripts/lib/axis-db.mjs';
import { computeSnapshots, diffAndBump } from '../scripts/lib/axis-snapshots.mjs';
import { SNAPSHOT_MODULES } from '../scripts/lib/axis-constants.mjs';

const db = openDb(':memory:');
const now = Date.now();

// Inbox: 2 open actionable, 1 actioned actionable, 1 noise, 1 OOO → badge must be 2
const im = db.prepare(`INSERT INTO inbox_messages (gmail_message_id,thread_id,classification,subject,snippet,received_at,actioned_at,unread) VALUES (?,?,?,?,?,?,?,?)`);
im.run('a', 'ta', 'reply_to_outreach', 'Re: hi', 's', now, null, 1);
im.run('b', 'tb', 'new_inbound_request', 'help', 's', now, null, 1);
im.run('c', 'tc', 'reply_to_outreach', 'Re: done', 's', now, now, 0); // actioned → excluded
im.run('d', 'td', 'noise', 'receipt', 's', now, null, 0);            // noise → excluded
im.run('e', 'te', 'out_of_office', 'away', 's', now, null, 0);       // OOO → excluded

// Approvals: 2 pending, 1 approved → pending must be 2
const oi = db.prepare(`INSERT INTO outreach_items (channel,kind,subject,status,created_at) VALUES (?,?,?,?,?)`);
oi.run('email', 'initial', 's1', 'pending', now);
oi.run('email', 'initial', 's2', 'pending', now);
oi.run('email', 'initial', 's3', 'approved', now);

const snaps = computeSnapshots(db);

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL', name); } };

t('Badge Law: badge counts only open actionable (=2)', snaps.inbox.badge === 2);
t('inbox counts.replies = 2 (both replies, incl actioned)', snaps.inbox.counts.replies === 2);
t('inbox counts.new_requests = 1', snaps.inbox.counts.new_requests === 1);
t('approvals.pending = 2', snaps.approvals.pending === 2);
t('overview.kpis.awaiting_approval mirrors pending', snaps.overview.kpis.awaiting_approval === 2);
t('overview.kpis.messages_waiting mirrors badge', snaps.overview.kpis.messages_waiting === 2);
t('every declared module present', SNAPSHOT_MODULES.every(m => snaps[m] !== undefined));

// Version diffing: unchanged module keeps its version; changed bumps
const v1 = diffAndBump(snaps, null);
const v2 = diffAndBump(snaps, v1);
t('diffAndBump: identical snapshot → no version bump', v2.v === v1.v && v2.changed.length === 0);
const snaps2 = { ...snaps, inbox: { ...snaps.inbox, badge: 99 } };
const v3 = diffAndBump(snaps2, v1);
t('diffAndBump: changed module → bump + listed in changed', v3.v === v1.v + 1 && v3.changed.includes('inbox'));

db.close();
console.log(`[axis-snapshots] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
