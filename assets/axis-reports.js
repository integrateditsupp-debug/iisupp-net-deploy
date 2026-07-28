// axis-reports.js — S13 Reports (the REPORTS half of the shared Reports & Settings screen).
// The shell calls renderReports() and then renders the settings half after it, so this module owns
// exactly one <section> it appends and never clears the container (that would wipe Settings).
//
// Laws honoured here: the UI never computes a business metric — the worker ships `reports.daily`,
// `reports.quarterly` and `reports.trends`; the .xlsx is built worker-side and served from the authed
// reports endpoint; zero renders as zero and an empty quarter renders as an empty quarter.
import { el, toast, head } from './axis-dom.js';
import { lineChart, heatCal } from './axis-charts.js';

// ── Pure roll-up (DOM-free, unit-testable) — the worker and the UI must agree on these numbers ──

// "YYYY-Qn" from an ISO date. Parsed off the string prefix rather than through Date() on purpose:
// new Date('2026-04-01') is UTC midnight, which in a western timezone falls back into Q1.
export function quarterOf(dateISO) {
  const d = isoDay(dateISO);
  if (!d) return '';
  return `${d.slice(0, 4)}-Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}`;
}

// dailyRows: [{ date, agent, runs, ok, fail, duration_ms, items }] → one row per quarter present.
// Never throws: non-arrays, nulls, bad dates and string numbers all degrade to skipped/0.
export function rollupQuarterly(dailyRows) {
  const groups = new Map();
  for (const r of Array.isArray(dailyRows) ? dailyRows : []) {
    if (!r || typeof r !== 'object') continue;
    const q = quarterOf(r.date);
    if (!q) continue; // a row we cannot date cannot be attributed to a quarter — dropping beats guessing
    if (!groups.has(q)) groups.set(q, []);
    groups.get(q).push(r);
  }
  return [...groups.keys()].sort().map(quarter => {
    const a = aggregate(groups.get(quarter));
    return {
      quarter, agents: a.agents.length, runs: a.runs, ok: a.ok, fail: a.fail,
      hours: Math.round((a.ms / 36e5) * 10) / 10,
      top_agent: a.agents.length ? a.agents[0].agent : null,
    };
  });
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const safeRows = (v) => (Array.isArray(v) ? v.filter(r => r && typeof r === 'object') : []);

// Accepts an ISO string, a Date or epoch ms; returns 'YYYY-MM-DD' or '' when it is not a real date.
function isoDay(v) {
  let s = '';
  if (typeof v === 'string') s = v.trim();
  else if (v instanceof Date && !isNaN(v)) s = v.toISOString();
  else if (typeof v === 'number' && Number.isFinite(v)) s = new Date(v).toISOString();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  const mo = +m[2], dy = +m[3];
  return mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31 ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// Shared accumulator: totals + per-agent breakdown, busiest agent first (ties broken by name so the
// "busiest agent" headline is stable between renders and between worker and UI).
function aggregate(rows) {
  const per = new Map();
  let runs = 0, ok = 0, fail = 0, ms = 0, items = 0;
  for (const r of safeRows(rows)) {
    const rOk = num(r.ok), rFail = num(r.fail);
    const rRuns = num(r.runs) || rOk + rFail;
    const rMs = num(r.duration_ms), rItems = num(r.items);
    runs += rRuns; ok += rOk; fail += rFail; ms += rMs; items += rItems;
    const agent = String(r.agent || '').trim();
    if (!agent) continue; // unattributed work still counts in the totals, but names no agent
    const a = per.get(agent) || { agent, runs: 0, ok: 0, fail: 0, ms: 0, items: 0 };
    a.runs += rRuns; a.ok += rOk; a.fail += rFail; a.ms += rMs; a.items += rItems;
    per.set(agent, a);
  }
  const agents = [...per.values()].sort((a, b) => b.runs - a.runs || b.ms - a.ms || a.agent.localeCompare(b.agent));
  return { runs, ok, fail, ms, items, agents };
}

// ── View state (module-scoped so period + drill position survive a shell re-render) ──
const PERIODS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter']];
const view = { period: 'quarter', bucket: null, agent: null, date: null, requested: null };
let mount = null, ctx = null;

// Bucket key for a date under the selected period. Week is Monday-anchored and computed in UTC so a
// browser timezone can never slide a run into the neighbouring week.
function bucketKey(dateISO, period) {
  const d = isoDay(dateISO);
  if (!d) return '';
  if (period === 'day') return d;
  if (period === 'month') return d.slice(0, 7);
  if (period === 'quarter') return quarterOf(d);
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 864e5).toISOString().slice(0, 10);
}
const bucketLabel = (key, period) => period === 'week' ? 'Week of ' + key : key;
const hoursTxt = (ms) => (Math.round((num(ms) / 36e5) * 10) / 10).toFixed(1) + ' h';
function durTxt(ms) {
  const s = Math.round(num(ms) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.round((s % 3600) / 60) + 'm';
}

/**
 * @param {HTMLElement} container  the screen node; we append to it and never clear it
 * @param {{data:object, settings:object, analytics:object, onIntent:Function, runs?:Array}} o
 *        `runs` is the fleet snapshot's run records (contract §2 `fleet.runs`) — the reports module
 *        has no per-run array of its own, so the day-level drill-down reads them from here when the
 *        shell passes them (also accepted as `data.runs`).
 */
export function renderReports(container, o = {}) {
  ctx = {
    data: o.data || {},
    settings: o.settings || {},
    analytics: o.analytics || {},
    onIntent: typeof o.onIntent === 'function' ? o.onIntent : async () => false,
    runs: safeRows(o.runs).length ? safeRows(o.runs) : safeRows((o.data || {}).runs),
  };
  mount = el('section', { class: 'axis-reports', 'aria-label': 'Reports' });
  container.append(mount);
  paint();
  return mount;
}

function paint() {
  if (!mount) return;
  mount.innerHTML = ''; // local re-render only — the Settings half lives outside this section
  const d = ctx.data;
  const daily = safeRows(d.daily);
  const shipped = safeRows(d.quarterly);
  // Prefer the worker's quarterly rows; fall back to the shared roll-up so the two can never diverge.
  const quarterly = shipped.length ? shipped : rollupQuarterly(daily);

  mount.append(head('Agent Work Report', 'quarterly roll-up of daily agent runs · drill to the individual record'));

  if (!daily.length && !quarterly.length) {
    mount.append(emptyReport());
    mount.append(exportCard('workbook', null, null, null));
    return;
  }

  const buckets = bucketList(daily, quarterly);
  if (!buckets.includes(view.bucket)) { view.bucket = buckets[buckets.length - 1] || null; view.agent = null; view.date = null; }
  const inBucket = daily.filter(r => bucketKey(r.date, view.period) === view.bucket);

  mount.append(periodBar(buckets));
  mount.append(breadcrumb());

  if (view.agent && view.date) mount.append(...levelRuns(inBucket));
  else if (view.agent) mount.append(...levelAgent(inBucket));
  else mount.append(...levelSummary(inBucket, quarterly));

  mount.append(trendsBlock(daily));
  mount.append(exportCard(exportScope(), quarterOf(bucketStart(view.bucket)), view.agent, view.date));
}

// Buckets are derived only from dates that actually carry work — never padded to make a full year.
function bucketList(daily, quarterly) {
  const set = new Set();
  daily.forEach(r => { const k = bucketKey(r.date, view.period); if (k) set.add(k); });
  if (view.period === 'quarter') quarterly.forEach(q => { if (q && q.quarter) set.add(String(q.quarter)); });
  return [...set].sort();
}
// First day of a bucket, for the export payload's `date` bound. Quarters resolve to their first month.
function bucketStart(key) {
  if (!key) return '';
  const q = /^(\d{4})-Q([1-4])$/.exec(key);
  if (q) return `${q[1]}-${String((+q[2] - 1) * 3 + 1).padStart(2, '0')}-01`;
  if (/^\d{4}-\d{2}$/.test(key)) return key + '-01';
  return isoDay(key);
}

function periodBar(buckets) {
  const bar = el('div', { class: 'thread-bar' }, PERIODS.map(([id, lbl]) =>
    el('button', {
      class: 'chip', 'aria-selected': view.period === id,
      onclick: () => { view.period = id; view.bucket = null; view.agent = null; view.date = null; paint(); },
    }, lbl)));
  bar.append(el('div', { style: 'flex:1' }));
  const sel = el('select', {
    class: 'chip', style: 'padding:6px 10px;color:var(--txt);background:var(--surface-2)',
    'aria-label': 'Period to report on',
    onchange: (e) => { view.bucket = e.target.value; view.agent = null; view.date = null; paint(); },
  });
  buckets.slice().reverse().forEach(b => sel.append(el('option', { value: b, selected: b === view.bucket }, bucketLabel(b, view.period))));
  bar.append(sel);
  return bar;
}

function breadcrumb() {
  const crumbs = [['Reports', () => { view.agent = null; view.date = null; paint(); }]];
  if (view.bucket) crumbs.push([bucketLabel(view.bucket, view.period), () => { view.agent = null; view.date = null; paint(); }]);
  if (view.agent) crumbs.push([view.agent, () => { view.date = null; paint(); }]);
  if (view.date) crumbs.push([view.date, null]);
  const wrap = el('nav', { class: 'eyebrow', style: 'display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:2px 0 12px', 'aria-label': 'Report drill-down path' });
  crumbs.forEach(([label, back], i) => {
    if (i) wrap.append(el('span', { style: 'color:var(--txt-3)' }, '/'));
    wrap.append(back
      ? el('button', { class: 'chip', style: 'padding:2px 9px;font-size:11px', onclick: back }, label)
      : el('span', { style: 'color:var(--gold)' }, label));
  });
  return wrap;
}

// ── Level 0 — the quarter (or period) summary ──
function levelSummary(inBucket, quarterly) {
  const out = [];
  // For the headline quarter, render the worker's own quarterly row so the page and the workbook match.
  const qRow = view.period === 'quarter' ? quarterly.find(q => q && String(q.quarter) === view.bucket) : null;
  const agg = aggregate(inBucket);
  const runs = qRow ? num(qRow.runs) : agg.runs;
  const ok = qRow ? num(qRow.ok) : agg.ok;
  const fail = qRow ? num(qRow.fail) : agg.fail;
  const hours = qRow ? (Math.round(num(qRow.hours) * 10) / 10).toFixed(1) + ' h' : hoursTxt(agg.ms);
  const top = qRow ? (qRow.top_agent || null) : (agg.agents[0] ? agg.agents[0].agent : null);
  const agents = qRow ? num(qRow.agents) : agg.agents.length;

  out.push(kpiRow([
    ['Total runs', runs], ['Succeeded', ok], ['Failed', fail],
    ['Agent time', hours], ['Agents active', agents], ['Busiest agent', top || '—'],
  ]));
  out.push(head('Per agent', 'click an agent for the daily breakdown', 'margin-top:20px'));

  const card = el('div', { class: 'card', style: 'padding:0' });
  card.append(tableHead(['Agent', 'Runs', 'OK', 'Fail', 'Time', 'Share']));
  if (!agg.agents.length) {
    // Three genuinely different situations — never explain one with the wording of another.
    // (a) daily rows are present but unattributed; (b) the worker shipped a roll-up with no daily rows
    // behind it, so the split is simply absent from this snapshot; (c) nothing ran.
    card.append(el('div', { class: 'empty' }, inBucket.length
      ? 'Runs recorded in this period carry no agent name — nothing to break down by agent.'
      : runs
        ? 'This snapshot carries the roll-up above but no daily rows for this period, so there is no per-agent split to show — export the period to .xlsx for the breakdown.'
        : 'No agent runs recorded in this period.'));
  } else {
    agg.agents.forEach(a => card.append(drillRow(
      [
        el('div', { style: 'flex:1;font-weight:600' }, a.agent),
        cell(a.runs, 60), cell(a.ok, 50), cell(a.fail, 50, a.fail ? 'var(--crit)' : null),
        cell(hoursTxt(a.ms), 70),
        el('div', { style: 'width:120px' }, [shareBar(agg.runs ? a.runs / agg.runs : 0)]),
      ],
      () => { view.agent = a.agent; view.date = null; paint(); },
      `${a.agent} — daily breakdown`)));
  }
  out.push(card);
  return out;
}

// ── Level 1 — one agent, day by day inside the period ──
function levelAgent(inBucket) {
  const rows = inBucket.filter(r => String(r.agent || '').trim() === view.agent)
    .slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const agg = aggregate(rows);
  const out = [
    kpiRow([['Runs', agg.runs], ['Succeeded', agg.ok], ['Failed', agg.fail], ['Agent time', hoursTxt(agg.ms)], ['Days active', rows.length], ['Items', agg.items]]),
    head(view.agent, `daily work in ${bucketLabel(view.bucket, view.period)} · click a day for the run records`, 'margin-top:20px'),
  ];
  const card = el('div', { class: 'card', style: 'padding:0' });
  card.append(tableHead(['Date (UTC)', 'Runs', 'OK', 'Fail', 'Time', 'Items']));
  if (!rows.length) card.append(el('div', { class: 'empty' }, 'No days recorded for this agent in this period.'));
  else rows.forEach(r => {
    const day = isoDay(r.date);
    card.append(drillRow([
      el('div', { class: 'mono', style: 'flex:1' }, day || String(r.date || '—')),
      cell(num(r.runs) || num(r.ok) + num(r.fail), 60), cell(num(r.ok), 50),
      cell(num(r.fail), 50, num(r.fail) ? 'var(--crit)' : null),
      cell(hoursTxt(r.duration_ms), 70), cell(num(r.items), 60),
    ], () => { view.date = day; paint(); }, `${day} — run records`));
  });
  out.push(card);
  return out;
}

// ── Level 2 — the individual run records for one agent on one day ──
function levelRuns(inBucket) {
  const dayRow = inBucket.find(r => String(r.agent || '').trim() === view.agent && isoDay(r.date) === view.date);
  const recs = ctx.runs.filter(r => String(r.agent || '').trim() === view.agent && isoDay(r.started_at) === view.date)
    .slice().sort((a, b) => num(b.started_at) - num(a.started_at));
  const out = [head(`${view.agent} · ${view.date}`, `${recs.length} run record${recs.length === 1 ? '' : 's'}`, 'margin-top:4px')];

  if (dayRow) out.push(el('div', { class: 'card', style: 'display:flex;gap:22px;flex-wrap:wrap;margin-bottom:12px' }, [
    stat('Runs', num(dayRow.runs) || num(dayRow.ok) + num(dayRow.fail)), stat('OK', num(dayRow.ok)),
    stat('Fail', num(dayRow.fail)), stat('Time', hoursTxt(dayRow.duration_ms)), stat('Items', num(dayRow.items)),
  ]));

  const card = el('div', { class: 'card', style: 'padding:0' });
  if (!recs.length) {
    card.append(el('div', { class: 'empty' }, dayRow
      ? 'The daily roll-up above is what the worker recorded for this day. Individual run records are not in this snapshot — export the day to .xlsx for the full records.'
      : 'No run records for this agent on this day.'));
  } else recs.forEach(r => {
    const okRun = r.status === 'ok' || r.status === 'success';
    const body = el('div', { class: 'row', style: 'align-items:flex-start' }, [
      el('span', { class: 'dot ' + (okRun ? 'dot-ok' : 'dot-crit'), style: 'margin-top:5px' }),
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-weight:600' }, r.summary || '(no summary)'),
        r.detail ? el('div', { style: 'font-size:12px;color:var(--txt-3);white-space:pre-line;margin-top:3px' }, r.detail) : null,
        r.error ? el('div', { style: 'font-size:12px;color:var(--crit);margin-top:3px' }, String(r.error)) : null,
      ]),
      el('span', { class: 'stage-tag' }, r.status || 'unknown'),
      el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);width:120px;text-align:right' },
        `${clockOf(r.started_at)} · ${durTxt(r.duration_ms || (num(r.finished_at) - num(r.started_at)))}`),
      el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);width:80px;text-align:right' },
        `${num(r.items_in)}→${num(r.items_out)}`),
    ]);
    card.append(body);
  });
  out.push(card);
  return out;
}
const clockOf = (ts) => { const d = isoDay(ts) ? new Date(typeof ts === 'number' ? ts : Date.parse(ts)) : null; return d && !isNaN(d) ? d.toISOString().slice(11, 16) + 'Z' : '—'; };

// ── Trends ──
function trendsBlock(daily) {
  const t = (ctx.data.trends && typeof ctx.data.trends === 'object') ? ctx.data.trends : {};
  const wrap = el('div', {});
  wrap.append(head('Trends', 'worker-computed series · UTC days', 'margin-top:22px'));
  const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px' });
  const series = [
    ['Runs per day', safeRows(t.runs_by_day), '--c1'],
    ['Outreach per day', safeRows(t.outreach_by_day), '--c2'],
    ['Replies per day', safeRows(t.replies_by_day), '--c3'],
  ];
  series.forEach(([label, rows, colorVar]) => {
    const scoped = scopeSeries(rows);
    // axis-charts lineChart takes [{label,colorVar,points:[{x,y}]}]; the snapshot ships {date,n}.
    const points = scoped.rows.map(p => ({ x: p.date, y: num(p.n != null ? p.n : p.value) }));
    grid.append(chartBlock(label, scoped.rows, scoped.note, () => lineChart([{ label, colorVar, points }], { height: 180 })));
  });
  wrap.append(grid);
  // Heat calendar of daily agent activity, summed across agents so one square = one day of work.
  const byDay = new Map();
  daily.forEach(r => { const d = isoDay(r.date); if (!d) return; byDay.set(d, (byDay.get(d) || 0) + (num(r.runs) || num(r.ok) + num(r.fail))); });
  const heat = [...byDay.entries()].sort().map(([date, value]) => ({ date, value }));
  wrap.append(el('div', { style: 'margin-top:12px' }, [chartBlock('Daily agent activity', heat, '', () => heatCal(heat, { colorVar: '--c1', unit: 'runs' }))]));
  // Echo only the Analytics figures this snapshot actually carries. A missing field is missing, not 0 —
  // printing `replies 0` for an absent `sales.replies` would invent the one number this page must not.
  const sales = (ctx.analytics && ctx.analytics.sales) || {};
  const echo = [];
  if (sales.sent != null) echo.push(`sent ${num(sales.sent)}`);
  if (sales.replies != null) echo.push(`replies ${num(sales.replies)}`);
  if (echo.length) {
    wrap.append(el('div', { class: 'footnote', style: 'display:inline-block;margin-top:10px' },
      ['same figures as Analytics — ' + echo.join(' · ')]));
  }
  return wrap;
}
// Charts follow the selected period when that period holds more than one point; a single-point
// "trend" is not a trend, so we widen back to the full series and say so instead.
function scopeSeries(rows) {
  const scoped = rows.filter(p => p && bucketKey(p.date, view.period) === view.bucket);
  if (scoped.length > 1) return { rows: scoped, note: bucketLabel(view.bucket, view.period) };
  return { rows, note: rows.length ? 'full recorded range' : '' };
}
function chartBlock(title, rows, note, draw) {
  const box = el('div', { class: 'card' }, [el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px' }, [
    el('div', { class: 'eyebrow' }, title), note ? el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, note) : null])]);
  if (!rows.length) { box.append(el('div', { class: 'empty', style: 'padding:26px' }, 'No data recorded yet.')); return box; }
  // axis-charts already frames itself with overflow-x:auto, so no wrapper here. It is a sibling module
  // owned elsewhere: a signature drift must degrade this one card, not take the whole screen down.
  try { box.append(draw()); }
  catch { box.append(el('div', { class: 'unknown', style: 'padding:14px' }, 'Chart unavailable — assets/axis-charts.js did not accept this series.')); }
  return box;
}

// ── Export (worker-side, always) ──
const exportScope = () => view.date ? 'day' : view.agent ? 'agent' : view.period;
function exportCard(scope, quarter, agent, date) {
  const r = ctx.data;
  const files = safeRows(r.files);
  // `sheets` is contracted as an array, but this whole module degrades rather than throws: one malformed
  // snapshot field must not take the Reports screen down (and with it the Settings half rendered after it).
  const sheets = Array.isArray(r.sheets) ? r.sheets.filter(s => s != null && s !== '').map(String) : [];
  const key = [scope, quarter, agent, date].join('|');
  const busy = view.requested === key;
  const btn = el('button', {
    class: 'chip', style: 'border-color:var(--gold);color:var(--gold)', disabled: busy || null,
    onclick: async () => {
      view.requested = key; paint(); // optimistic: the button states the request before the worker answers
      const ok = await ctx.onIntent('generate_report', { scope, quarter: quarter || null, agent: agent || null, date: date || null });
      view.requested = null; paint();
      toast(ok ? 'Report queued — the worker builds the .xlsx' : 'Could not queue the report');
    },
  }, busy ? 'Requesting…' : 'Export .xlsx');

  const card = el('div', { class: 'card', style: 'margin-top:18px' }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap' }, [
      el('div', {}, [
        el('div', { style: 'font-weight:600' }, 'Export this view'),
        el('div', { style: 'font-size:12px;color:var(--txt-2);margin-top:3px' },
          `scope: ${scope}${quarter ? ' · ' + quarter : ''}${agent ? ' · ' + agent : ''}${date ? ' · ' + date : ''}`),
      ]),
      btn,
    ]),
    el('div', { style: 'font-size:12px;color:var(--txt-2);margin-top:10px' },
      'The spreadsheet is built by the worker from SQLite — the browser never assembles one. When it is ready it is served from the authed reports endpoint; nothing downloads until the worker has written the file.'),
    el('div', { class: 'eyebrow', style: 'margin-top:10px' },
      r.lastGenerated ? 'last generated ' + String(r.lastGenerated).slice(0, 16).replace('T', ' ') : 'never generated'),
    sheets.length ? el('div', { style: 'font-size:12px;color:var(--txt-2);margin-top:6px' }, 'Sheets: ' + sheets.join(' · ')) : null,
    files.length
      ? el('div', { style: 'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap' }, files.map(f =>
        el('span', { class: 'footnote' }, `${f.name} (${Math.max(1, Math.round(num(f.size) / 1024))} KB)`)))
      : el('div', { class: 'unknown', style: 'font-size:12px;margin-top:8px' }, 'No files produced yet.'),
    ctx.settings.data && ctx.settings.data.db
      ? el('div', { class: 'eyebrow', style: 'margin-top:10px' }, 'source of record: ' + ctx.settings.data.db)
      : null,
  ]);
  return card;
}

// ── Honest empty state — agent_runs has 0 rows today and the page says exactly that ──
function emptyReport() {
  return el('div', { class: 'card', style: 'text-align:center;padding:34px 22px' }, [
    el('div', { style: 'font-weight:600;margin-bottom:8px' }, 'No agent work recorded yet'),
    el('div', { style: 'color:var(--txt-2);font-size:12.5px;max-width:560px;margin:0 auto' },
      'The quarterly report is built from the run records agents write when they work. None have been written yet, so there is nothing to roll up — no runs, no hours, no per-agent split. This page fills in on its own the first time an agent records a run; nothing here is placeholder or sample data.'),
    el('div', { class: 'eyebrow', style: 'margin-top:14px' }, 'reports.daily 0 rows · reports.quarterly 0 rows'),
  ]);
}

// ── Small local bits (head/el/toast come from axis-dom.js — never redefined here) ──
function kpiRow(pairs) {
  return el('div', { class: 'kpi-grid' }, pairs.map(([l, v]) => el('div', { class: 'kpi' }, [
    el('div', { class: 'label' }, l),
    // A real 0 prints as 0. An ABSENT value prints as '—' — rendering unknown as zero is the same lie
    // in the other direction, and this page is the one place that must not do either.
    el('div', { class: 'value', style: typeof v === 'string' && v.length > 9 ? 'font-size:15px' : null }, v ?? '—'),
  ])));
}
function stat(label, value) {
  return el('div', {}, [el('div', { class: 'eyebrow' }, label), el('div', { style: 'font-size:16px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums' }, value)]);
}
function tableHead(cols) {
  const widths = [null, 60, 50, 50, 70, 120];
  return el('div', { class: 'row', style: 'font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--txt-3)' },
    cols.map((c, i) => el('div', { style: i === 0 ? 'flex:1' : `width:${widths[i] || 60}px;text-align:right` }, c)));
}
function cell(v, w, color) {
  return el('div', { style: `width:${w}px;text-align:right;font-variant-numeric:tabular-nums${color ? ';color:' + color : ''}` }, v);
}
function shareBar(frac) {
  const pct = Math.max(0, Math.min(1, Number(frac) || 0));
  return el('div', { style: 'height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden', title: Math.round(pct * 100) + '% of runs' },
    [el('div', { style: `height:100%;width:${(pct * 100).toFixed(1)}%;background:var(--gold)` })]);
}
// Drill rows are real buttons to keyboard users — Enter/Space open the next level.
function drillRow(cells, onOpen, label) {
  return el('div', {
    class: 'row', role: 'button', tabindex: '0', 'aria-label': label, style: 'cursor:pointer',
    onclick: onOpen,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } },
  }, cells);
}
