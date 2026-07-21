// outreach-draft-batch.mjs — P4 DRAFT-ONLY mini-gate. Generates outreach for up to 5 REAL sendable
// prospects, lints, records CASL consent, evaluates SEND-TIME rails, writes drafts to SQLite (status
// 'pending' → Approvals), and prints the exact drafts. IT SENDS NOTHING (Gmail OAuth is not configured;
// even if it were, sending requires per-item approval + the outbound queue). Run: node scripts/outreach-draft-batch.mjs
import crypto from 'node:crypto';
import { openDb } from './lib/axis-db.mjs';
import { generateOutreach, caslFooter, lint, railsCheck } from './lib/outreach.mjs';
import { previewRfc822, isConfigured } from './lib/gmail-outreach.mjs';
import { OUTREACH_IDENTITY, CASL } from '../assets/axis-constants.js';

const TEMPLATE_ID = 'msp-security-v1';
const BATCH_HANDLES = ['Lead-022', 'Lead-024', 'Lead-025', 'Lead-027', 'Lead-032']; // clean-domain public emails

const db = openDb();
const prov = (b, k) => { try { return JSON.parse(b.provenance_json)[k]?.value ?? null; } catch { return null; } };
const rows = BATCH_HANDLES.map(h => db.prepare('SELECT * FROM businesses WHERE handle=? AND is_real=1').get(h)).filter(Boolean);

// Guard: NEVER the 8 fictional seed rows; NEVER a business without a real public email.
const sendable = rows.filter(b => { const e = prov(b, 'public_email'); return e && /@/.test(e); });
if (sendable.length !== rows.length) { console.error('ABORT: a batch row lacked a real public email'); process.exit(1); }

// Clear any prior drafts for these businesses (idempotent).
for (const b of sendable) db.prepare('DELETE FROM outreach_items WHERE business_id=? AND kind=?').run(b.id, 'initial');

console.log(`\n========== P4 DRAFT-ONLY BATCH (${sendable.length} real prospects) ==========`);
console.log(`Identity: ${OUTREACH_IDENTITY.from_name} <${OUTREACH_IDENTITY.from_email}>  ·  Reply-To/Watch: ${OUTREACH_IDENTITY.watch_mailbox}`);
console.log(`Gmail OAuth configured? ${isConfigured()}  (false = nothing can send; drafts are content-only until you approve)\n`);

const sendCtx = { now: new Date(), sentToday: 0, dailyCap: 25, suppression: [], approvedTemplates: [TEMPLATE_ID], quietHours: { start: 21, end: 8 } };
let allLintPass = true;

for (const b of sendable) {
  const email = prov(b, 'public_email');
  const site = (prov(b, 'website') || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  const gen = generateOutreach(b);
  const subject = gen.subjects[0];
  const unsubToken = crypto.createHash('sha256').update(email + '|iis').digest('hex').slice(0, 16);
  const body = gen.initial + caslFooter(unsubToken);
  const lintRes = lint(gen.initial, b);
  allLintPass = allLintPass && lintRes.pass;

  const consent_basis = 'conspicuous_publication';
  const consent_evidence = prov(b, 'website');

  // write draft (pending → Approvals); record consent
  const info = db.prepare(`INSERT INTO outreach_items
    (business_id,channel,kind,subject,body,to_email,template_id,consent_basis,consent_evidence,facts_json,lint_json,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.id, 'email', 'initial', subject, body, email, TEMPLATE_ID, consent_basis, consent_evidence,
    JSON.stringify([{ c: gen.anchor, s: consent_evidence }]), JSON.stringify(lintRes), 'pending', Date.now());
  db.prepare(`INSERT INTO consent_basis (contact_id,basis,evidence_url,recorded_at) VALUES (?,?,?,?)`).run(b.id, consent_basis, consent_evidence, Date.now());

  const railItem = { to_email: email, template_id: TEMPLATE_ID, body, consent_basis, consent_evidence };
  const rails = railsCheck(railItem, sendCtx);

  console.log(`\n──────── ${b.handle}  ${b.name}  →  ${email} ────────`);
  console.log('SUBJECT OPTIONS:'); gen.subjects.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  console.log('\nDRAFT (exact RFC822 that would become a Gmail draft):');
  console.log('┌' + '─'.repeat(78));
  previewRfc822({ to: email, subject, body, headers: { 'List-Unsubscribe': `<https://iisupp.net/unsubscribe?u=${unsubToken}>` } })
    .split('\n').forEach(l => console.log('│ ' + l));
  console.log('└' + '─'.repeat(78));
  console.log(`LINT: ${lintRes.pass ? 'PASS' : 'FAIL'}  (${lintRes.word_count} words)  ${lintRes.issues.length ? '· issues: ' + lintRes.issues.join('; ') : ''}`);
  console.log(`CASL CONSENT: ${consent_basis}  ·  evidence: ${consent_evidence}`);
  console.log('SEND-TIME RAILS: ' + (rails.pass ? 'ALL PASS' : 'BLOCKED'));
  for (const [k, v] of Object.entries(rails.checks)) console.log(`   ${v.pass ? '✓' : '✗'} ${k}: ${v.detail}`);
}

console.log(`\n========== SUMMARY ==========`);
console.log(`Drafts written to SQLite (status=pending → Approvals): ${sendable.length}`);
console.log(`Lint: ${allLintPass ? 'ALL PASS' : 'SOME FAILED'}`);
console.log(`Sent: 0  (Gmail OAuth not configured; sending requires per-item approval + outbound queue)`);
console.log(`Excluded: 8 fictional seed rows (is_real=0), 10 real rows with no public email (honest unknowns).`);
db.close();
