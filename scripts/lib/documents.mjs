// documents.mjs — Documents Center (S9) engine. WORKER-OWNED. Templates are generic (committed);
// merged client documents live in SQLite ONLY and route to Approvals (never auto-sent). Versioning is
// append-only (edits never overwrite; old versions retained). E-sign is future-ready status only.
import { TEMPLATES, renderTemplate } from './document-templates.mjs';

// Seed the 16 Ontario DRAFT templates as documents (version 1, status 'Template'). Idempotent by title.
export function seedTemplates(db) {
  for (const t of TEMPLATES) {
    const title = `${t.type} — Ontario (DRAFT)`;
    if (db.prepare('SELECT id FROM documents WHERE title=?').get(title)) continue;
    const doc = db.prepare("INSERT INTO documents (type,title,status) VALUES (?,?,?)").run(t.type, title, 'Template');
    const docId = Number(doc.lastInsertRowid);
    const ver = db.prepare("INSERT INTO document_versions (document_id,version,body,merge_fields_json,created_at) VALUES (?,?,?,?,?)")
      .run(docId, 1, renderTemplate(t), JSON.stringify(t.merge), Date.now());
    db.prepare("UPDATE documents SET current_version_id=? WHERE id=?").run(Number(ver.lastInsertRowid), docId);
  }
}

const fmtMoney = (n) => n == null ? '$—' : '$' + Number(n).toLocaleString();
const prov = (b, k) => { try { return JSON.parse(b.provenance_json)[k]?.value ?? null; } catch { return null; } };

// Build the merge-field map from a real prospect (SQLite). Unknowns stay as an explicit placeholder,
// never invented.
function mergeMap(db, business) {
  const opps = (() => { try { return JSON.parse(business.opportunities_json) || []; } catch { return []; } })();
  const contact = db.prepare('SELECT name FROM contacts WHERE business_id=? LIMIT 1').get(business.id);
  const today = new Date().toISOString().slice(0, 10);
  return {
    client_name: business.name,
    client_address: prov(business, 'address') || '[address — not on file]',
    effective_date: today,
    monthly_fee: fmtMoney(business.est_monthly_value),
    project_fee: fmtMoney((opps[0]?.est_mrr || 0) * 3),
    term_months: '12',
    sla_response: '1 business hour',
    uptime_target: '99.9%',
    rpo: '24 hours', rto: '4 hours',
    quote_valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    timeline: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    scope: (opps[0] ? `${opps[0].service} — ${opps[0].basis}` : 'managed IT and security'),
    client_signer: contact ? contact.name : '[authorized signer]',
  };
}
function applyMerge(body, map) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => (map[k] != null ? map[k] : `{{${k}}}`));
}

// Prepare a document for a real client: merge → NEW append-only version → route to Approvals (pending
// outreach_item channel='document'). NEVER sends. Returns { versionId, approvalId }.
export function prepareForClient(db, docId, businessId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(docId);
  const business = db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  if (!doc || !business) return null;
  const cur = db.prepare('SELECT * FROM document_versions WHERE id=?').get(doc.current_version_id) ||
    db.prepare('SELECT * FROM document_versions WHERE document_id=? ORDER BY version DESC LIMIT 1').get(docId);
  const map = mergeMap(db, business);
  const merged = applyMerge(cur.body, map);
  const nextV = (db.prepare('SELECT MAX(version) v FROM document_versions WHERE document_id=?').get(docId).v || 0) + 1;
  const ver = db.prepare("INSERT INTO document_versions (document_id,version,body,merge_fields_json,created_at) VALUES (?,?,?,?,?)")
    .run(docId, nextV, merged, JSON.stringify(map), Date.now());
  db.prepare("UPDATE documents SET current_version_id=?, status='Ready' WHERE id=?").run(Number(ver.lastInsertRowid), docId);
  // route to Approvals
  const appr = db.prepare(`INSERT INTO outreach_items (business_id,channel,kind,subject,body,to_email,template_id,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(businessId, 'document', 'prepare', `${doc.type} — ${business.name}`, merged, prov(business, 'public_email'), 'doc-' + doc.type, 'pending', Date.now());
  db.prepare("INSERT INTO approvals_audit (item_id,action,actor,detail,at) VALUES (?,?,?,?,?)")
    .run(Number(appr.lastInsertRowid), 'prepared', 'documents', `${doc.type} for ${business.name} (v${nextV})`, Date.now());
  return { versionId: Number(ver.lastInsertRowid), approvalId: Number(appr.lastInsertRowid), version: nextV };
}

// Edit → append a NEW version (old retained). Returns new version number.
export function newVersion(db, docId, body) {
  const nextV = (db.prepare('SELECT MAX(version) v FROM document_versions WHERE document_id=?').get(docId).v || 0) + 1;
  const ver = db.prepare("INSERT INTO document_versions (document_id,version,body,merge_fields_json,created_at) VALUES (?,?,?,?,?)")
    .run(docId, nextV, body, '{}', Date.now());
  db.prepare("UPDATE documents SET current_version_id=? WHERE id=?").run(Number(ver.lastInsertRowid), docId);
  return nextV;
}

export function duplicate(db, docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(docId);
  const cur = db.prepare('SELECT * FROM document_versions WHERE id=?').get(doc.current_version_id);
  const nd = db.prepare("INSERT INTO documents (type,title,status) VALUES (?,?,?)").run(doc.type, doc.title + ' (copy)', 'Draft');
  const ndId = Number(nd.lastInsertRowid);
  const ver = db.prepare("INSERT INTO document_versions (document_id,version,body,merge_fields_json,created_at) VALUES (?,?,?,?,?)")
    .run(ndId, 1, cur.body, cur.merge_fields_json, Date.now());
  db.prepare("UPDATE documents SET current_version_id=? WHERE id=?").run(Number(ver.lastInsertRowid), ndId);
  return ndId;
}
