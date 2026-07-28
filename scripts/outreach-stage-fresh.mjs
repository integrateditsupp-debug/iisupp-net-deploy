// outreach-stage-fresh.mjs — stage cold-email DRAFTS for every FRESH sendable prospect, and NOTHING else.
// "Fresh sendable" = is_real=1, has a valid public email, has a usable name (merge-safe), NOT already
// sent/approved/queued, and NOT on the suppression list (exact email OR @domain). Each target gets one
// pending outreach_item (kind='initial') generated from the LOCKED approved template (personalized on
// {name} only, via the merge-guarded renderer) + the exact CASL footer, plus a consent_basis row.
//
// This SENDS NOTHING. Drafts land as status='pending' → they surface in Approvals on the live dashboard at
// the next worker snapshot tick. A human still approves every send. Run: node scripts/outreach-stage-fresh.mjs
import crypto from 'node:crypto';
import { openDb } from './lib/axis-db.mjs';
import { generateOutreach, caslFooter, lint, cleanName } from './lib/outreach.mjs';

const TEMPLATE_ID = 'approved-v1-2026-06-25';
const db = openDb();
const prov = (b, k) => { try { return JSON.parse(b.provenance_json)[k]?.value ?? null; } catch { return null; } };

const supp = new Set(db.prepare('SELECT LOWER(email) e FROM suppression_list').all().map(r => r.e));
const isSupp = (email) => { const e = (email || '').toLowerCase(); return supp.has(e) || supp.has('@' + e.split('@')[1]); };
const alreadySent = new Set(db.prepare("SELECT DISTINCT business_id id FROM outreach_items WHERE status IN ('sent','approved','queued')").all().map(r => r.id));

const targets = [], skipped = [];
for (const b of db.prepare('SELECT * FROM businesses WHERE is_real=1').all()) {
  const em = prov(b, 'public_email');
  if (!(em && /@/.test(em))) { skipped.push([b.handle, 'no email']); continue; }
  if (!cleanName(b.name)) { skipped.push([b.handle, 'no name']); continue; }
  if (alreadySent.has(b.id)) { skipped.push([b.handle, 'already sent']); continue; }
  if (isSupp(em)) { skipped.push([b.handle, 'SUPPRESSED']); continue; }
  targets.push(b);
}

let staged = 0, lintFail = 0;
console.log(`\n===== STAGE FRESH DRAFTS (draft-only, SENDS NOTHING) =====`);
for (const b of targets) {
  const em = prov(b, 'public_email');
  db.prepare("DELETE FROM outreach_items WHERE business_id=? AND kind='initial' AND status='pending'").run(b.id);
  const gen = generateOutreach(b);           // merge-guarded: throws before it could ever render "Hello ,"
  const unsub = crypto.createHash('sha256').update(em + '|iis').digest('hex').slice(0, 16);
  const body = gen.body + caslFooter(unsub);
  const lr = lint(gen.body, b);
  if (!lr.pass) lintFail++;
  const consent_basis = 'conspicuous_publication', consent_evidence = prov(b, 'website') || '';
  db.prepare(`INSERT INTO outreach_items
    (business_id,channel,kind,subject,body,to_email,template_id,consent_basis,consent_evidence,facts_json,lint_json,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.id, 'email', 'initial', gen.subject, body, em, TEMPLATE_ID, consent_basis, consent_evidence,
    JSON.stringify([{ c: 'approved template', s: gen.template }]), JSON.stringify(lr), 'pending', Date.now());
  db.prepare('INSERT INTO consent_basis (contact_id,basis,evidence_url,recorded_at) VALUES (?,?,?,?)').run(b.id, consent_basis, consent_evidence, Date.now());
  staged++;
  console.log(`  ✓ ${b.handle}  ${b.name}  → ${em}  | LINT ${lr.pass ? 'PASS' : 'FAIL: ' + lr.issues.join('; ')} (${lr.word_count}w)`);
}
console.log(`\nStaged ${staged} pending drafts · lint failures: ${lintFail} · sent: 0`);
console.log(`Skipped ${skipped.length}: ${skipped.map(s => s[0] + '(' + s[1] + ')').join(', ')}`);
db.close();
