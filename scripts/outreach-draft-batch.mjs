// outreach-draft-batch.mjs — P4 DRAFT-ONLY mini-gate. Generates outreach (Ahmad's LOCKED template,
// personalized) for up to 5 REAL sendable prospects, lints, records CASL consent, verifies domain auth
// LIVE, evaluates SEND-TIME rails (DKIM-gated pacing), writes drafts to SQLite (pending → Approvals), and
// prints everything. SENDS NOTHING. Run: node scripts/outreach-draft-batch.mjs
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { openDb } from './lib/axis-db.mjs';
import { generateOutreach, caslFooter, lint, railsCheck } from './lib/outreach.mjs';
import { previewRfc822, isConfigured } from './lib/gmail-outreach.mjs';
import { OUTREACH_IDENTITY, CASL } from '../assets/axis-constants.js';

const TEMPLATE_ID = 'approved-v1-2026-06-25';
const BATCH_HANDLES = ['Lead-022', 'Lead-024', 'Lead-025', 'Lead-027', 'Lead-032'];

// ── Live domain-auth verification (P4 addendum: report SPF/DKIM/DMARC at the gate) ──
async function domainAuth(d = 'iisupp.net') {
  const out = { spf: null, dkim: null, dmarc: null };
  try { const t = await dns.resolveTxt(d); out.spf = t.map(x => x.join('')).find(x => /v=spf1/.test(x)) || 'ABSENT'; } catch { out.spf = 'ABSENT'; }
  try { const t = await dns.resolveTxt(`_dmarc.${d}`); out.dmarc = t.map(x => x.join('')).find(x => /v=DMARC1/.test(x)) || 'ABSENT'; } catch { out.dmarc = 'ABSENT'; }
  try { await dns.resolve(`google._domainkey.${d}`, 'TXT'); out.dkim = 'PRESENT'; } catch { out.dkim = 'ABSENT'; }
  return out;
}

const db = openDb();
const prov = (b, k) => { try { return JSON.parse(b.provenance_json)[k]?.value ?? null; } catch { return null; } };
const rows = BATCH_HANDLES.map(h => db.prepare('SELECT * FROM businesses WHERE handle=? AND is_real=1').get(h)).filter(Boolean);
const sendable = rows.filter(b => { const e = prov(b, 'public_email'); return e && /@/.test(e); });
if (sendable.length !== rows.length) { console.error('ABORT: a batch row lacked a real public email'); process.exit(1); }
for (const b of sendable) db.prepare('DELETE FROM outreach_items WHERE business_id=? AND kind=?').run(b.id, 'initial');

const auth = await domainAuth();
const dkim_ok = auth.dkim === 'PRESENT';

console.log(`\n========== P4 DRAFT-ONLY BATCH (${sendable.length} real prospects) ==========`);
console.log(`Identity: ${OUTREACH_IDENTITY.from_name} <${OUTREACH_IDENTITY.from_email}>  ·  Reply-To/Watch: ${OUTREACH_IDENTITY.watch_mailbox}`);
console.log(`Copy source: Ahmad-locked approved template (personalized only)`);
console.log(`Gmail OAuth configured? ${isConfigured()}  (false = nothing can send)\n`);
console.log(`── LIVE DOMAIN AUTH (iisupp.net) ──`);
console.log(`  SPF  : ${/v=spf1/.test(auth.spf) ? 'PASS' : 'FAIL'}  ${auth.spf}`);
console.log(`  DKIM : ${dkim_ok ? 'PASS' : 'ABSENT'}  ${dkim_ok ? '(google._domainkey present)' : '(no google._domainkey — enable Workspace DKIM before first send; batch is paced meanwhile)'}`);
console.log(`  DMARC: ${/v=DMARC1/.test(auth.dmarc) ? 'PASS' : 'FAIL'}  ${auth.dmarc}`);

const sendCtx = { now: new Date(), sentToday: 0, suppression: [], quietHours: { start: 21, end: 8 }, dkim_ok };
let allLintPass = true;

for (const b of sendable) {
  const email = prov(b, 'public_email');
  const gen = generateOutreach(b);
  const unsubToken = crypto.createHash('sha256').update(email + '|iis').digest('hex').slice(0, 16);
  const body = gen.body + caslFooter(unsubToken);
  const lintRes = lint(gen.body, b);
  allLintPass = allLintPass && lintRes.pass;
  const consent_basis = 'conspicuous_publication';
  const consent_evidence = prov(b, 'website');

  db.prepare(`INSERT INTO outreach_items
    (business_id,channel,kind,subject,body,to_email,template_id,consent_basis,consent_evidence,facts_json,lint_json,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.id, 'email', 'initial', gen.subject, body, email, TEMPLATE_ID, consent_basis, consent_evidence,
    JSON.stringify([{ c: 'approved template', s: gen.template }]), JSON.stringify(lintRes), 'pending', Date.now());
  db.prepare(`INSERT INTO consent_basis (contact_id,basis,evidence_url,recorded_at) VALUES (?,?,?,?)`).run(b.id, consent_basis, consent_evidence, Date.now());

  const rails = railsCheck({ to_email: email, template_id: TEMPLATE_ID, body, consent_basis, consent_evidence }, sendCtx);
  console.log(`\n──────── ${b.handle}  ${b.name}  →  ${email} ────────`);
  console.log(`SUBJECT: ${gen.subject}`);
  console.log('DRAFT (exact RFC822 that would become a Gmail draft):');
  console.log('┌' + '─'.repeat(78));
  previewRfc822({ to: email, subject: gen.subject, body, headers: { 'List-Unsubscribe': `<https://iisupp.net/unsubscribe?u=${unsubToken}>` } })
    .split('\n').forEach(l => console.log('│ ' + l));
  console.log('└' + '─'.repeat(78));
  console.log(`LINT: ${lintRes.pass ? 'PASS' : 'FAIL'}  (${lintRes.word_count} words)  ${lintRes.issues.length ? '· ' + lintRes.issues.join('; ') : '· conforms to approved template'}`);
  console.log(`CASL CONSENT: ${consent_basis}  ·  evidence: ${consent_evidence}`);
  console.log('SEND-TIME RAILS: ' + (rails.pass ? 'ALL PASS' : 'BLOCKED') + (dkim_ok ? '' : ' · PACED (DKIM off → ' + 5 + '/day cap, no ramp)'));
  for (const [k, v] of Object.entries(rails.checks)) console.log(`   ${v.pass ? (v.warn ? '⚠' : '✓') : '✗'} ${k}: ${v.detail}`);
}

console.log(`\n========== SUMMARY ==========`);
console.log(`Drafts → SQLite (pending → Approvals): ${sendable.length}  ·  Lint: ${allLintPass ? 'ALL PASS' : 'SOME FAILED'}  ·  Sent: 0`);
console.log(`Domain auth: SPF ${/v=spf1/.test(auth.spf) ? '✓' : '✗'} · DKIM ${dkim_ok ? '✓' : '✗ (enable before first send)'} · DMARC ${/v=DMARC1/.test(auth.dmarc) ? '✓' : '✗'}`);
console.log(`Pacing: ${dkim_ok ? 'ramped ok' : 'first-batch ≤5/day, personalized, NO ramp until DKIM on'}`);
console.log(`Excluded: 8 fictional seed rows (is_real=0), 10 real rows without a public email.`);
db.close();
