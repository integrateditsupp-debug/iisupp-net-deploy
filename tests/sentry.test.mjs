// tests/sentry.test.mjs — P5 Sentry classifier + Badge Law. Pure unit test (no DB, no network).
import { classify, ACTIONABLE } from '../scripts/lib/sentry-classify.mjs';

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('  FAIL', name); } };
const ctx = { sentThreadIds: new Set(['t-sent']), sentMessageIds: new Set(['<m-sent>']), knownContacts: new Set(['contact@forlaw.ca']) };

// Deterministic classifications
t('reply via thread match', classify({ thread_id: 't-sent', from: 'contact@forlaw.ca', subject: 'Re: hi', snippet: 'yes' }, ctx).classification === 'reply_to_outreach');
t('reply via In-Reply-To', classify({ from: 'x@y.com', subject: 'Re: hi', snippet: 'yes', headers: { 'In-Reply-To': '<m-sent>' } }, ctx).classification === 'reply_to_outreach');
t('new request (humanish + asks)', classify({ from: 'ops@newco.ca', subject: 'IT help — email down', snippet: 'Can you help us today?' }, ctx).classification === 'new_inbound_request');
t('newsletter -> noise (List-Unsubscribe)', classify({ from: 'news@tc.com', subject: 'weekly', snippet: '...', headers: { 'List-Unsubscribe': '<u>' } }, ctx).classification === 'noise');
t('receipt bulk -> noise', classify({ from: 'receipts@stripe.com', subject: 'Your receipt #1', snippet: 'payment received', headers: { 'Auto-Submitted': 'auto-generated' } }, ctx).classification === 'noise');
t('OOO -> out_of_office', classify({ from: 'jane@f.com', subject: 'Automatic reply: Out of office', snippet: 'away', headers: { 'Auto-Submitted': 'auto-replied' } }, ctx).classification === 'out_of_office');
t('bounce -> bounce', classify({ from: 'mailer-daemon@googlemail.com', subject: 'Delivery Status Notification (Failure)', snippet: '550 not found' }, ctx).classification === 'bounce');
t('unsubscribe -> unsubscribe_request', classify({ from: 'p@co.com', subject: 'stop', snippet: 'please unsubscribe me' }, ctx).classification === 'unsubscribe_request');

// Badge Law: only reply + new request are actionable
t('ACTIONABLE = reply + new request only', ACTIONABLE.length === 2 && ACTIONABLE.includes('reply_to_outreach') && ACTIONABLE.includes('new_inbound_request'));
t('noise not actionable', !ACTIONABLE.includes('noise'));
t('bounce not actionable', !ACTIONABLE.includes('bounce'));
t('out_of_office not actionable', !ACTIONABLE.includes('out_of_office'));

// Safety default: unsure human sender → actionable (never silently dropped)
t('unsure human -> actionable', ACTIONABLE.includes(classify({ from: 'someone@realbiz.com', subject: 'hello', snippet: 'saw your site' }, ctx).classification));
// A no-reply bulk-less machine with nothing actionable → noise
t('no-reply empty -> noise', classify({ from: 'no-reply@service.com', subject: 'notice', snippet: 'system notice' }, ctx).classification === 'noise');

console.log(`[sentry] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
