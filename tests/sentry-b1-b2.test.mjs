// tests/sentry-b1-b2.test.mjs — regression gate for CC-BRIEF bugs B1 and B2.
//
// B1: a genuine client reply (Houser Henry, id 18) was filed as `new_inbound_request` because the
//     outreach it replied to was sent BY HAND from Gmail and therefore carries no thread_id — so the
//     classifier's thread-linkage path could never fire and `reply_to_outreach` sat at 0 table-wide.
// B2: ARIA's own digests, DMARC XML, LinkedIn and retail newsletters were being classified as noise
//     AFTER landing in inbox_messages, leaving the founder's action inbox 96% junk around one real reply.
//     They must be dropped at INGEST so they never become a row at all.
import { classify, campaignMarkerHits } from '../scripts/lib/sentry-classify.mjs';
import { ingestSuppressionRule, ingestMessage, buildCtx } from '../scripts/lib/sentry.mjs';
import { openDb } from '../scripts/lib/axis-db.mjs';

let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error('  FAIL', n); } };
const msg = (o) => ({ headers: {}, ...o });

// ── B1: campaign-marker recognition ──────────────────────────────────────────────────────────────
const REAL_18 = 'RE: Managed IT Services & AI automation — quick 15-min demo';

t('B1 marker count on the real id-18 subject >= 2', campaignMarkerHits(REAL_18) >= 2);
t('B1 em-dash normalizes (same score without it)', campaignMarkerHits(REAL_18) === campaignMarkerHits(REAL_18.replace('—', '-')));
t('B1 strips a stacked Re: chain', campaignMarkerHits('RE: Re: FW: Managed IT & AI automation for X') >= 2);
t('B1 unrelated reply scores 0', campaignMarkerHits('Re: lunch tomorrow?') === 0);
t('B1 invoice reply scores 0', campaignMarkerHits('Re: your invoice is overdue') === 0);
t('B1 marker count tolerates null', campaignMarkerHits(null) === 0);
t('B1 marker count tolerates undefined', campaignMarkerHits(undefined) === 0);

const c18 = classify(msg({ from: 'jzavitz@houserhenry.com', subject: REAL_18, snippet: 'currently we are not looking for a MSP.' }), {});
t('B1 id-18 classifies reply_to_outreach', c18.classification === 'reply_to_outreach');
t('B1 id-18 is deterministic (not an AI guess)', c18.deterministic === true);
t('B1 id-18 reason names the campaign-phrase bridge', /campaign subject phrases/i.test(c18.reason));

// The bridge must be narrow: markers WITHOUT a reply prefix is our own outbound, not a reply.
const noRe = classify(msg({ from: 'someone@example.com', subject: 'Managed IT Services & AI automation — quick 15-min demo' }), {});
t('B1 same subject WITHOUT Re: is not a reply', noRe.classification !== 'reply_to_outreach');

// A single marker is not enough — two independent phrase hits is the bar.
t('B1 one marker alone is below the bar', campaignMarkerHits('Re: managed it question') < 2);

// Real thread linkage must still outrank the bridge when it is available.
const threaded = classify(msg({ from: 'new@client.com', subject: 'Re: anything at all', thread_id: 'T1' }), { sentThreadIds: new Set(['T1']) });
t('B1 thread linkage still wins', threaded.reason === 'threads with a sent outreach message');

// ── B2: ingest-level suppression ─────────────────────────────────────────────────────────────────
const suppressed = [
  ['aria@iisupp.net', 'internal'],
  ['hello@iisupp.net', 'internal'],
  ['noreply@iisupp.net', 'internal'],
  ['noreply-dmarc-support@google.com', 'dmarc'],
  ['no-reply@us-1.mimecastreport.com', 'dmarc'],
  ['notifications-noreply@linkedin.com', 'linkedin'],
  ['messages-noreply@linkedin.com', 'linkedin'],
  ['updates-noreply@linkedin.com', 'linkedin'],
  ['newsletter@e.bestbuy.ca', 'retail-newsletter'],
];
for (const [from, rule] of suppressed) {
  t(`B2 suppresses ${from} (${rule})`, ingestSuppressionRule(msg({ from }), {}) === rule);
}

// Must NOT suppress real humans or real prospects.
const allowed = ['jzavitz@houserhenry.com', 'info@apbs.ca', 'contact@forlaw.ca', 'someone@gmail.com', 'devportalprod@service-now.com'];
for (const from of allowed) t(`B2 lets ${from} through`, ingestSuppressionRule(msg({ from }), {}) === null);

t('B2 tolerates a missing sender', ingestSuppressionRule(msg({}), {}) === null);
t('B2 tolerates junk input', ingestSuppressionRule(msg({ from: 'not-an-email' }), {}) === null);
t('B2 is case-insensitive', ingestSuppressionRule(msg({ from: 'ARIA@IISUPP.NET' }), {}) === 'internal');

// The escape hatch: a suppressed sender replying INSIDE a thread we sent to is a real client and lives.
t('B2 escape hatch — suppressed sender in a sent thread survives',
  ingestSuppressionRule(msg({ from: 'aria@iisupp.net', thread_id: 'T9' }), { sentThreadIds: new Set(['T9']) }) === null);

// ── B2: ingestMessage must not write a row for a suppressed sender ───────────────────────────────
const db = openDb(':memory:');
const ctx = buildCtx(db);
const before = db.prepare('SELECT COUNT(*) c FROM inbox_messages').get().c;
const supRes = ingestMessage(db, msg({ gmail_message_id: 'g-sup-1', from: 'aria@iisupp.net', subject: '[IIS Daily] MRR $0.00' }), ctx);
const afterSup = db.prepare('SELECT COUNT(*) c FROM inbox_messages').get().c;
t('B2 suppressed message writes NO row', afterSup === before);
t('B2 suppressed result flags ingested:false', supRes.ingested === false);
t('B2 suppressed result names the rule', supRes.suppressedRule === 'internal');
t('B2 suppressed message is never actionable', supRes.actionable === false);

const keepRes = ingestMessage(db, msg({ gmail_message_id: 'g-keep-1', from: 'jzavitz@houserhenry.com', subject: REAL_18, snippet: 'not looking for a MSP' }), ctx);
const afterKeep = db.prepare('SELECT COUNT(*) c FROM inbox_messages').get().c;
t('B2 real reply DOES write a row', afterKeep === before + 1);
t('B2 real reply flags ingested:true', keepRes.ingested === true);
t('B1+B2 together — the real reply lands as reply_to_outreach', keepRes.classification === 'reply_to_outreach');
t('B1+B2 together — the real reply is actionable (drives the badge)', keepRes.actionable === true);

db.close();
console.log(`[sentry-b1-b2] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
