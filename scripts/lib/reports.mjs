// reports.mjs — AXIS CC v2 P7 report generator. WORKER-OWNED, LOCAL. Builds the Excel workbook (11 sheets),
// CSVs, and a PDF summary from SQLite into data/reports/ (gitignored + /data/* 404'd). Served only via an
// authed endpoint. Writes reports_meta to the settings table so the snapshot surfaces "last generated".
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { DATA_DIR } from './axis-db.mjs';
import { computeSnapshots } from './axis-snapshots.mjs';

const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const j = (v) => { try { return JSON.parse(v); } catch { return null; } };
const money = (n) => Number(n || 0);

const SHEETS = [
  ['Businesses', 'SELECT handle,name,industry,city,region,size,pipeline_stage,est_monthly_value,is_real FROM businesses'],
  ['Contacts', 'SELECT business_id,name,title,public_email,confidence FROM contacts'],
  ['Outreach', "SELECT business_id,channel,kind,subject,status,to_email,consent_basis FROM outreach_items"],
  ['Follow-ups', 'SELECT business_id,due_at,status FROM follow_ups'],
  ['Meetings', 'SELECT business_id,scheduled_at,channel,status FROM meetings'],
  ['Opportunities', 'SELECT business_id,service,est_mrr,status FROM opportunities'],
  ['Products', 'SELECT name,category,demand,ease,profitability,scalability,advantage,weighted_score,status FROM products_discovered'],
  ['Notes', "SELECT business_id,from_email,classification,classify_reason,sysnote FROM inbox_messages"],
];

export async function generateReports(db) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const snaps = computeSnapshots(db);
  const now = new Date();

  // ── Excel workbook (11 sheets) ──
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AXIS'; wb.created = new Date('2026-07-21T00:00:00Z');
  for (const [name, sql] of SHEETS) {
    const rows = db.prepare(sql).all();
    const ws = wb.addWorksheet(name);
    const cols = rows.length ? Object.keys(rows[0]) : ['(no rows)'];
    ws.columns = cols.map(c => ({ header: c, key: c, width: Math.min(28, Math.max(12, c.length + 4)) }));
    rows.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
  }
  // Analytics sheet (computed)
  const wa = wb.addWorksheet('Analytics');
  wa.columns = [{ header: 'Metric', key: 'm', width: 30 }, { header: 'Value', key: 'v', width: 16 }];
  const a = snaps.analytics;
  [['Businesses total', a.research.total], ['Researched (real)', a.research.researched],
  ['Toronto', a.research.geo_coverage.Toronto], ['GTA', a.research.geo_coverage.GTA],
  ['Generated', a.sales.generated], ['Approved', a.sales.approved], ['Sent', a.sales.sent],
  ['Replies', a.sales.replies], ['New requests', a.sales.new_requests], ['Meetings', a.sales.meetings],
  ['Opportunities', a.sales.opportunities], ['Won', a.sales.won],
  ['Pipeline value $/mo', a.insights.pipeline_value], ['Opportunity MRR $/mo', a.insights.opportunity_mrr]]
    .forEach(([m, v]) => wa.addRow({ m, v }));
  wa.getRow(1).font = { bold: true };
  // Revenue Forecast sheet
  const wf = wb.addWorksheet('Revenue Forecast');
  wf.columns = [{ header: 'Company', key: 'c', width: 34 }, { header: 'Est $/mo', key: 'm', width: 14 }, { header: 'Annualized $', key: 'y', width: 16 }];
  db.prepare('SELECT name,handle,est_monthly_value FROM businesses WHERE is_real=1 ORDER BY est_monthly_value DESC').all()
    .forEach(b => wf.addRow({ c: b.name || b.handle, m: money(b.est_monthly_value), y: money(b.est_monthly_value) * 12 }));
  wf.getRow(1).font = { bold: true };
  // Services sheet (opportunity services rolled up)
  const wsv = wb.addWorksheet('Services');
  wsv.columns = [{ header: 'Service', key: 's', width: 30 }, { header: 'Count', key: 'n', width: 10 }, { header: 'Total est MRR', key: 't', width: 16 }];
  const svc = {}; for (const o of db.prepare('SELECT service,est_mrr FROM opportunities').all()) { svc[o.service] = svc[o.service] || { n: 0, t: 0 }; svc[o.service].n++; svc[o.service].t += money(o.est_mrr); }
  Object.entries(svc).forEach(([s, v]) => wsv.addRow({ s, n: v.n, t: v.t }));
  wsv.getRow(1).font = { bold: true };

  const xlsxPath = path.join(REPORTS_DIR, 'axis-report.xlsx');
  await wb.xlsx.writeFile(xlsxPath);

  // ── CSVs ──
  const csv = (rows) => { if (!rows.length) return ''; const cols = Object.keys(rows[0]); return [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n'); };
  fs.writeFileSync(path.join(REPORTS_DIR, 'businesses.csv'), csv(db.prepare('SELECT handle,name,industry,city,est_monthly_value,pipeline_stage FROM businesses').all()));
  fs.writeFileSync(path.join(REPORTS_DIR, 'opportunities.csv'), csv(db.prepare('SELECT business_id,service,est_mrr,status FROM opportunities').all()));

  // ── PDF summary ──
  const pdfPath = path.join(REPORTS_DIR, 'summary.pdf');
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    doc.fontSize(20).text('AXIS — Sales & Research Summary', { align: 'left' });
    doc.moveDown(0.5).fontSize(10).fillColor('#666').text('Integrated IT Support Inc. · generated by the AXIS worker');
    doc.moveDown().fillColor('#000').fontSize(12);
    const line = (k, v) => doc.text(`${k}:  ${v}`);
    line('Businesses researched', `${a.research.researched} / ${a.research.total}`);
    line('Geo coverage', `Toronto ${a.research.geo_coverage.Toronto} · GTA ${a.research.geo_coverage.GTA}`);
    line('Funnel', a.sales.funnel.map(f => `${f.stage} ${f.n}`).join('  →  '));
    line('Meetings / Opportunities', `${a.sales.meetings} / ${a.sales.opportunities}`);
    line('Pipeline value', `$${a.insights.pipeline_value.toLocaleString()}/mo  (annualized $${(a.insights.pipeline_value * 12).toLocaleString()})`);
    doc.moveDown().fontSize(9).fillColor('#999').text('Figures computed from the SQLite system of record. Fictional demo prospects excluded from revenue where flagged.');
    doc.end();
    stream.on('finish', resolve); stream.on('error', reject);
  });

  // ── meta → settings table ──
  const files = ['axis-report.xlsx', 'businesses.csv', 'opportunities.csv', 'summary.pdf'].map(f => {
    const st = fs.statSync(path.join(REPORTS_DIR, f)); return { name: f, size: st.size };
  });
  const meta = { lastGenerated: now.toISOString(), files, sheets: [...SHEETS.map(s => s[0]), 'Analytics', 'Revenue Forecast', 'Services'] };
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('reports_meta', JSON.stringify(meta));
  return meta;
}
