// tests/axis-criticality.test.mjs — E gate: only cost + reputation reach the Director queue, and an
// unreadable item always fails SAFE toward asking the human.
import { classifyCriticality, CRITICAL_REASONS } from '../scripts/lib/axis-criticality.mjs';

let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error('  FAIL', n); } };
const c = (item, ctx) => classifyCriticality(item, ctx);
const isCritical = (r, reason) => r.criticality === 'critical' && r.reason === reason;

// --- reputation: outbound email to a third party (initial | followup | reply) ---
const initial = c({ channel: 'email', kind: 'initial', status: 'pending', to_email: 'info@123-dental.com', subject: 'MSP & AI automation support' });
t('initial cold outbound → critical/reputation', isCritical(initial, 'reputation'));
t('initial detail names the recipient', initial.detail.includes('info@123-dental.com'));
t('followup → critical/reputation', isCritical(c({ channel: 'email', kind: 'followup', to_email: 'a@houserhenry.com' }), 'reputation'));
t('reply → critical/reputation', isCritical(c({ channel: 'email', kind: 'reply', to_email: 'jzavitz@houserhenry.com' }), 'reputation'));
t('kind alone (no channel) still counts as outbound', isCritical(c({ kind: 'initial', to_email: 'x@example.org' }), 'reputation'));
t('compose_send intent payload → critical/reputation', isCritical(c({ type: 'compose_send', contact_email: 'x@example.org', subject: 'hi' }), 'reputation'));
t('one external among internals → critical', isCritical(c({ channel: 'email', kind: 'reply', to_email: 'aria@iisupp.net, ceo@example.org' }), 'reputation'));
t('email with NO recipient fails safe to critical', isCritical(c({ channel: 'email', kind: 'initial', to_email: null }), 'reputation'));

// --- our own domain never leaves the building ---
t('iisupp.net recipient → routine', c({ channel: 'email', kind: 'reply', to_email: 'ahmad.wasee@iisupp.net' }).criticality === 'routine');
t('iisupp.net subdomain → routine', c({ channel: 'email', kind: 'initial', to_email: 'bot@mail.iisupp.net' }).criticality === 'routine');
t('routine carries reason null', c({ channel: 'email', kind: 'reply', to_email: 'aria@iisupp.net' }).reason === null);
t('ctx.internalDomains override honoured', c({ channel: 'email', kind: 'initial', to_email: 'x@example.org' }, { internalDomains: ['example.org'] }).criticality === 'routine');
t('look-alike domain is NOT treated as internal', isCritical(c({ channel: 'email', kind: 'initial', to_email: 'x@notiisupp.net' }), 'reputation'));

// --- cost ---
t('monetary amount → critical/cost', isCritical(c({ type: 'vendor_charge', amount: 499 }), 'cost'));
t('string amount parses → critical/cost', isCritical(c({ type: 'vendor_charge', amount: '$1,200' }), 'cost'));
t('payment flag → critical/cost', isCritical(c({ type: 'something_new', payment: true }), 'cost'));
t('subscription → critical/cost', isCritical(c({ type: 'renew_tool', subscription: 'Anthropic API' }), 'cost'));
t('payment wording → critical/cost', isCritical(c({ type: 'invoice_pay', channel: 'billing' }), 'cost'));
t('agreement document → critical/cost', isCritical(c({ channel: 'document', kind: 'prepare', subject: 'Managed IT Service Agreement — 123 Dental', template_id: 'doc-Managed IT Service Agreement', business_id: 3 }), 'cost'));
t('zero amount is not a spend', c({ type: 'note', amount: 0 }).criticality === 'routine');
t('est_monthly_value is an estimate, never a cost', c({ id: 1, name: 'Lead-022', est_monthly_value: 3000 }).reason !== 'cost');
t('cost words in an EMAIL subject do not become cost', c({ channel: 'email', kind: 'initial', to_email: 'x@example.org', subject: 'Proposal for your IT' }).reason === 'reputation');

// --- reputation: public artifact / named third party ---
t('public artifact → critical/reputation', isCritical(c({ type: 'publish', title: 'New case study' }), 'reputation'));
t('client-facing document names a third party', isCritical(c({ channel: 'document', kind: 'prepare', subject: 'Client Onboarding Package — 123 Dental', business_id: 3, to_email: 'info@123-dental.com' }), 'reputation'));
t('unassigned draft document → routine', c({ channel: 'document', kind: 'prepare', status: 'Draft', subject: 'Privacy Policy' }).criticality === 'routine');

// --- routine: internal-only state changes ---
for (const type of ['stage_override', 'note', 'snooze', 'mark_handled', 'csv_export', 'cadence_edit']) {
  t(`${type} → routine`, c({ type, business_id: 3 }).criticality === 'routine');
}
t('compose_draft stays a draft → routine even with an external recipient', c({ type: 'compose_draft', to_email: 'x@example.org', subject: 'hi' }).criticality === 'routine');
t('draft_reply → routine', c({ type: 'draft_reply', message_id: 18 }).criticality === 'routine');
t('internal channel → routine', c({ channel: 'internal', kind: 'sysnote' }).criticality === 'routine');

// --- fail-safe default: unknown / malformed ---
t('empty object → critical', c({}).criticality === 'critical');
t('empty object reason is null, not invented', c({}).reason === null);
t('null → critical', c(null).criticality === 'critical');
t('undefined (no args) → critical', classifyCriticality().criticality === 'critical');
t('string item → critical', c('send it').criticality === 'critical');
t('array item → critical', c([{ channel: 'email' }]).criticality === 'critical');
t('number item → critical', c(42).criticality === 'critical');
t('missing fields → critical', c({ id: 9, created_at: 0 }).criticality === 'critical');
t('fail-safe detail says why', c({}).detail.toLowerCase().includes('unrecognised'));

// --- contract shape ---
t('CRITICAL_REASONS is exactly [cost, reputation]', JSON.stringify(CRITICAL_REASONS) === JSON.stringify(['cost', 'reputation']));
const battery = [{}, null, 'x', { channel: 'email', kind: 'initial', to_email: 'x@example.org' }, { type: 'note' },
  { channel: 'email', kind: 'reply', to_email: 'a@iisupp.net' }, { amount: 12 }, { type: 'publish' }].map(x => c(x));
t('every verdict has the 3 contract keys', battery.every(r => Object.keys(r).sort().join(',') === 'criticality,detail,reason'));
t('criticality is only critical|routine', battery.every(r => r.criticality === 'critical' || r.criticality === 'routine'));
t('reason is only cost|reputation|null', battery.every(r => r.reason === null || CRITICAL_REASONS.includes(r.reason)));
t('routine never carries a reason', battery.every(r => r.criticality !== 'routine' || r.reason === null));
t('detail is always a non-empty string', battery.every(r => typeof r.detail === 'string' && r.detail.length > 0));

console.log(`[axis-criticality] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
