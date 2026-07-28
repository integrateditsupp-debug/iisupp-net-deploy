// axis-charts.js — AXIS CC v2 chart library. Inline SVG only: a strict CSP blocks every external
// host, so D3/Chart.js/CDN are not an option and none is wanted. The visual language matches the
// barChart/funnelChart that shipped inside axis-app.js.
// Two laws carried over from docs/AXIS-CC-V2-CONTRACTS.md §5:
//   1. an empty series renders an honest empty state — never a fabricated baseline or padded series;
//   2. every mark is reachable by keyboard (tabindex + aria-label), not by hover alone.
// Colors come only from tokens declared in axis-tokens.css, so light/dark theming is automatic.
import { el, svg, fmtMoney } from './axis-dom.js';

const SERIES = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
const DAY = 86400000;

const fmtNum = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k';
  return String(Math.round(v * 100) / 100);
};
// x may arrive as an epoch number, a Date, or an ISO/date string from the snapshot.
const toX = (v) => {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : Number(v);
};
const isTime = (v) => Math.abs(v) > 1e11;
// UTC, always. The snapshot ships day buckets as 'YYYY-MM-DD', which Date.parse reads as UTC midnight.
// Formatting that in local time shifts every label back one day west of Greenwich (Toronto = UTC-4/-5),
// so 2026-07-01 printed as "Jun 30" while heatCal — which already pins timeZone:'UTC' — printed Jul 1.
// The Reports caption says "UTC days"; the axis must agree with it and with the calendar beside it.
const dateLabel = (v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

// ── Shared shell ────────────────────────────────────────────────────────────────
const emptyState = (msg) => el('div', { class: 'empty' }, msg);

// Wide charts scroll inside their own box; the page itself must never scroll sideways.
function frame(node, { minWidth = 0, maxWidth = 0 } = {}) {
  const inner = el('div', { style: `min-width:${minWidth}px` + (maxWidth ? `;max-width:${maxWidth}px` : '') }, [node]);
  return el('div', { class: 'axis-chart', style: 'overflow-x:auto;overflow-y:hidden;max-width:100%' }, [inner]);
}

function legend(items) {
  return el('div', { style: 'display:flex;gap:13px;flex-wrap:wrap;margin:0 0 9px' }, items.map((it) =>
    el('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--txt-2)' }, [
      el('span', { style: `width:9px;height:9px;border-radius:2px;flex:none;background:var(${it.colorVar})` }),
      it.value == null ? it.label : `${it.label} · ${it.value}`,
    ])));
}

// ── Tooltip (one node for the whole app, follows the cursor, mirrors the aria-label) ──
const TIP_CSS = 'position:fixed;z-index:120;display:none;pointer-events:none;background:var(--surface-3);' +
  'border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;font-family:var(--mono);' +
  'font-size:10.5px;line-height:1.5;color:var(--txt);box-shadow:0 14px 34px -20px #000;max-width:260px';
let tipBox = null;
function tipNode() {
  if (!tipBox || !tipBox.isConnected) {
    // aria-hidden: the same text is already on the mark's aria-label, so announcing twice is noise.
    tipBox = el('div', { class: 'axis-chart-tip', 'aria-hidden': 'true', style: TIP_CSS });
    document.body.append(tipBox);
  }
  return tipBox;
}
function showTip(lines, x, y) {
  const n = tipNode();
  n.textContent = '';
  lines.filter(Boolean).forEach((ln, i) => n.append(el('div', { style: i ? 'color:var(--txt-2)' : 'color:var(--txt);font-weight:600' }, ln)));
  n.style.display = 'block';
  placeTip(x, y);
}
function placeTip(x, y) {
  const n = tipNode(), r = n.getBoundingClientRect();
  n.style.left = Math.min(Math.max(8, x + 14), Math.max(8, window.innerWidth - r.width - 8)) + 'px';
  n.style.top = Math.max(8, y - r.height - 12) + 'px';
}
function hideTip() { if (tipBox) tipBox.style.display = 'none'; }
// A re-render can remove the hovered mark without ever firing pointerleave; scroll/press clears it.
addEventListener('scroll', hideTip, { capture: true, passive: true });
addEventListener('pointerdown', hideTip, { capture: true });

// Makes one SVG shape a first-class datum: hoverable, focusable, described, optionally clickable.
function mark(node, { lines, label, datum, onSelect }) {
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', onSelect ? 'button' : 'img');
  node.setAttribute('aria-label', label);
  if (onSelect) node.style.cursor = 'pointer';
  node.addEventListener('pointerenter', (e) => showTip(lines, e.clientX, e.clientY));
  node.addEventListener('pointermove', (e) => placeTip(e.clientX, e.clientY));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); showTip(lines, r.left + r.width / 2, r.top); });
  node.addEventListener('blur', hideTip);
  if (onSelect) {
    node.addEventListener('click', () => onSelect(datum));
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(datum); } });
  }
  return node;
}

const txt = (attrs, s) => svg('text', { 'font-family': 'var(--sans)', ...attrs }, String(s));

// ── lineChart · series: [{ label, points:[{x,y,meta}], colorVar }] ───────────────
export function lineChart(series, opts = {}) {
  // Tolerant of a hole in the series (null row / null point / non-array): a bad datum is skipped, never
  // guessed at, and never allowed to take the whole screen down with a TypeError.
  const norm = (Array.isArray(series) ? series : []).map((raw, i) => {
    const ser = raw && typeof raw === 'object' ? raw : {};
    return {
      label: ser.label || `Series ${i + 1}`,
      colorVar: ser.colorVar || SERIES[i % SERIES.length],
      points: (Array.isArray(ser.points) ? ser.points : [])
        .filter((p) => p != null && typeof p === 'object')
        .map((p) => ({ ...p, xv: toX(p.x), yv: Number(p.y) }))
        .filter((p) => Number.isFinite(p.xv) && Number.isFinite(p.yv))
        .sort((a, b) => a.xv - b.xv),
    };
  }).filter((ser) => ser.points.length);
  if (!norm.length) return emptyState(opts.empty || 'No time-series data recorded yet.');

  const W = opts.width || 640, H = opts.height || 210, padL = 46, padR = 14, padT = 12, padB = 26;
  const allX = norm.flatMap((s) => s.points.map((p) => p.xv));
  const allY = norm.flatMap((s) => s.points.map((p) => p.yv));
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  const yMin = Math.min(0, ...allY);
  let yMax = Math.max(...allY);
  if (yMax === yMin) yMax = yMin + 1; // a flat all-zero series still needs a finite scale to draw on
  const sx = (v) => padL + (W - padL - padR) * (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin));
  const sy = (v) => H - padB - (H - padT - padB) * ((v - yMin) / (yMax - yMin));
  const fmtY = opts.money ? fmtMoney : (opts.yFormat || fmtNum);
  const fmtXv = opts.xFormat || ((v) => (isTime(v) ? dateLabel(v) : fmtNum(v)));

  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: `max-width:${W}px;display:block`,
    role: 'group', 'aria-label': opts.title || 'Line chart' });

  for (let i = 0; i <= 4; i++) { // gridlines + y ticks
    const val = yMin + ((yMax - yMin) * i) / 4, y = sy(val);
    g.append(svg('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }));
    g.append(txt({ x: padL - 7, y: y + 3.5, fill: 'var(--txt-3)', 'font-size': 9.5, 'text-anchor': 'end', 'font-family': 'var(--mono)' }, fmtY(val)));
  }
  const uniqX = [...new Set(allX)].sort((a, b) => a - b);
  const xTicks = uniqX.length <= 5 ? uniqX : [0, 1, 2, 3, 4].map((i) => uniqX[Math.round((i * (uniqX.length - 1)) / 4)]);
  xTicks.forEach((v) => g.append(txt({ x: sx(v), y: H - 8, fill: 'var(--txt-3)', 'font-size': 9.5, 'text-anchor': 'middle', 'font-family': 'var(--mono)' }, fmtXv(v))));

  const cross = svg('line', { x1: 0, y1: padT, x2: 0, y2: H - padB, stroke: 'var(--gold)', 'stroke-width': 1, opacity: 0, 'pointer-events': 'none' });
  g.append(cross);

  norm.forEach((ser) => {
    const d = ser.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.xv).toFixed(1)} ${sy(p.yv).toFixed(1)}`).join(' ');
    g.append(svg('path', { d, fill: 'none', stroke: `var(${ser.colorVar})`, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    ser.points.forEach((p) => {
      const c = svg('circle', { cx: sx(p.xv), cy: sy(p.yv), r: 3.2, fill: `var(${ser.colorVar})`, stroke: 'var(--surface)', 'stroke-width': 1 });
      g.append(mark(c, {
        label: `${ser.label}, ${fmtXv(p.xv)}: ${fmtY(p.yv)}`,
        lines: [fmtXv(p.xv), `${ser.label} · ${fmtY(p.yv)}`],
        datum: { ...p, series: ser.label }, onSelect: opts.onSelect,
      }));
    });
  });

  // Crosshair: read every series at the x nearest the cursor, so one hover explains the whole column.
  const hit = svg('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB, fill: 'transparent' });
  const nearest = (clientX) => {
    const box = g.getBoundingClientRect();
    const vx = xMin + (((clientX - box.left) / box.width) * W - padL) / (W - padL - padR) * (xMax - xMin);
    return uniqX.reduce((best, v) => (Math.abs(v - vx) < Math.abs(best - vx) ? v : best), uniqX[0]);
  };
  hit.addEventListener('pointermove', (e) => {
    const v = nearest(e.clientX);
    cross.setAttribute('x1', sx(v)); cross.setAttribute('x2', sx(v)); cross.setAttribute('opacity', 0.55);
    const rows = norm.map((s) => { const p = s.points.find((q) => q.xv === v); return p ? `${s.label} · ${fmtY(p.yv)}` : null; });
    showTip([fmtXv(v), ...rows], e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('opacity', 0); hideTip(); });
  g.append(hit);

  const wrap = el('div', {}, norm.length > 1 ? [legend(norm), g] : [g]);
  return frame(wrap, { minWidth: 420, maxWidth: W });
}

// ── areaSpark · compact filled sparkline for a KPI tile ─────────────────────────
export function areaSpark(points, opts = {}) {
  // Accepts a bare number[] or {x,y}[]. A null/undefined slot is DROPPED, not coerced — Number(null) is 0,
  // and inventing a zero reading where the series has a hole would be a fabricated datum.
  const pts = (Array.isArray(points) ? points : [])
    .map((p, i) => (typeof p === 'number' ? { x: i, y: p } : p))
    .filter((p) => p != null && typeof p === 'object')
    .map((p, i) => ({ ...p, xv: Number.isFinite(toX(p.x)) ? toX(p.x) : i, yv: Number(p.y) }))
    .filter((p) => Number.isFinite(p.yv))
    .sort((a, b) => a.xv - b.xv);
  // A KPI tile cannot afford the full .empty block, but it still has to say the truth.
  if (!pts.length) return el('div', { class: 'mono', style: 'font-size:9.5px;color:var(--txt-3)' }, opts.empty || 'no history yet');

  const W = opts.width || 140, H = opts.height || 36, pad = 4;
  const colorVar = opts.colorVar || '--c1';
  const xs = pts.map((p) => p.xv), ys = pts.map((p) => p.yv);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  let yMax = Math.max(...ys); if (yMax === yMin) yMax = yMin + 1;
  const sx = (v) => pad + (W - pad * 2) * (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin));
  const sy = (v) => H - pad - (H - pad * 2) * ((v - yMin) / (yMax - yMin));
  const fmtY = opts.money ? fmtMoney : (opts.yFormat || fmtNum);
  const fmtXv = opts.xFormat || ((v) => (isTime(v) ? dateLabel(v) : fmtNum(v)));

  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: `max-width:${W}px;display:block`,
    role: 'group', 'aria-label': opts.title || `Trend, ${pts.length} points, latest ${fmtY(ys[ys.length - 1])}` });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.xv).toFixed(1)} ${sy(p.yv).toFixed(1)}`).join(' ');
  g.append(svg('path', { d: `${line} L${sx(xMax).toFixed(1)} ${H - pad} L${sx(xMin).toFixed(1)} ${H - pad} Z`, fill: `var(${colorVar})`, opacity: 0.16 }));
  g.append(svg('path', { d: line, fill: 'none', stroke: `var(${colorVar})`, 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  const dot = svg('circle', { r: 3, fill: `var(${colorVar})`, stroke: 'var(--surface)', 'stroke-width': 1, opacity: 0, 'pointer-events': 'none' });
  g.append(dot);
  pts.forEach((p) => { // invisible hit circles keep the spark clean while staying tab-reachable
    const h = svg('circle', { cx: sx(p.xv), cy: sy(p.yv), r: 5, fill: 'transparent' });
    const move = () => { dot.setAttribute('cx', sx(p.xv)); dot.setAttribute('cy', sy(p.yv)); dot.setAttribute('opacity', 1); };
    h.addEventListener('pointerenter', move); h.addEventListener('focus', move);
    h.addEventListener('pointerleave', () => dot.setAttribute('opacity', 0));
    h.addEventListener('blur', () => dot.setAttribute('opacity', 0));
    g.append(mark(h, { label: `${fmtXv(p.xv)}: ${fmtY(p.yv)}`, lines: [fmtXv(p.xv), fmtY(p.yv)], datum: p, onSelect: opts.onSelect }));
  });
  return g;
}

// ── barChart · rows: [{ label, value, meta }] — horizontal, original axis-app look ──
export function barChart(rows, opts = {}) {
  const { colorVar = '--c1', money = false, onSelect } = opts;
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object' && Number.isFinite(Number(r.value))).map((r) => ({ ...r, value: Number(r.value) }));
  if (!list.length) return emptyState(opts.empty || 'Nothing measured yet.');

  const W = 560, rowH = 26, pad = 150, h = list.length * rowH + 10;
  const max = Math.max(1, ...list.map((r) => r.value));
  const total = list.reduce((a, r) => a + r.value, 0);
  const fmtV = (v) => (money ? fmtMoney(v) : String(v));
  const g = svg('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', style: `max-width:${W}px;display:block`,
    role: 'group', 'aria-label': opts.title || 'Bar chart' });
  list.forEach((r, i) => {
    const y = i * rowH + 6, bw = Math.max(2, ((W - pad - 60) * r.value) / max);
    const label = (r.label == null ? '' : String(r.label));
    g.append(txt({ x: 0, y: y + 14, fill: 'var(--txt-2)', 'font-size': 11 }, label.slice(0, 22)));
    const bar = svg('rect', { x: pad, y: y + 4, width: bw, height: 14, rx: 3, fill: `var(${colorVar})`, opacity: 0.85 });
    g.append(mark(bar, {
      label: `${label}: ${fmtV(r.value)}`,
      lines: [label, fmtV(r.value), total > 0 ? `${pct(r.value, total)}% of ${fmtV(total)}` : null],
      datum: r, onSelect,
    }));
    g.append(txt({ x: pad + bw + 6, y: y + 15, fill: 'var(--txt-3)', 'font-size': 10, 'font-family': 'var(--mono)' }, fmtV(r.value)));
  });
  return frame(g, { minWidth: 380, maxWidth: W });
}

// ── stackedBar · rows: [{ label, parts:[{key,value,colorVar}] }] ─────────────────
export function stackedBar(rows, opts = {}) {
  // Rows whose parts are all zero are KEPT (label + a real "0"); only zero-width segments are dropped.
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r === 'object').map((r) => ({
    label: r.label == null ? '' : String(r.label),
    parts: (Array.isArray(r.parts) ? r.parts : [])
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({ ...p, key: p.key == null ? '' : String(p.key), value: Number(p.value) || 0 }))
      .filter((p) => p.value > 0),
  }));
  if (!list.length) return emptyState(opts.empty || 'No breakdown recorded yet.');

  const keys = [];
  list.forEach((r) => r.parts.forEach((p) => { if (!keys.some((k) => k.key === p.key)) keys.push({ key: p.key, colorVar: p.colorVar || SERIES[keys.length % SERIES.length] }); }));
  const colorOf = (k) => (keys.find((x) => x.key === k) || {}).colorVar || '--c1';
  const money = !!opts.money, fmtV = (v) => (money ? fmtMoney(v) : String(v));
  const W = 620, rowH = 30, pad = 150, h = list.length * rowH + 10;
  const totals = list.map((r) => r.parts.reduce((a, p) => a + p.value, 0));
  const max = Math.max(1, ...totals);

  const g = svg('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', style: `max-width:${W}px;display:block`,
    role: 'group', 'aria-label': opts.title || 'Stacked bar chart' });
  list.forEach((r, i) => {
    const y = i * rowH + 7, span = W - pad - 70, tot = totals[i];
    g.append(txt({ x: 0, y: y + 15, fill: 'var(--txt-2)', 'font-size': 11 }, r.label.slice(0, 22)));
    let x = pad;
    r.parts.forEach((p) => {
      const w = Math.max(2, (span * p.value) / max);
      const seg = svg('rect', { x, y: y + 3, width: w, height: 16, rx: 2, fill: `var(${colorOf(p.key)})`, opacity: 0.85 });
      g.append(mark(seg, {
        // An unlabelled segment reads as just its number — never as the literal string "undefined".
        label: `${r.label}${p.key ? `, ${p.key}` : ''}: ${fmtV(p.value)} of ${fmtV(tot)}`,
        lines: [r.label, p.key ? `${p.key} · ${fmtV(p.value)}` : fmtV(p.value), `${pct(p.value, tot)}% of row`],
        datum: { row: r.label, ...p }, onSelect: opts.onSelect,
      }));
      x += w;
    });
    g.append(txt({ x: x + 6, y: y + 16, fill: 'var(--txt-3)', 'font-size': 10, 'font-family': 'var(--mono)' }, fmtV(tot)));
  });
  return frame(el('div', {}, [legend(keys.map((k) => ({ label: k.key, colorVar: k.colorVar }))), g]), { minWidth: 420, maxWidth: W });
}

// ── donut · slices: [{ label, value, colorVar }] with a center total ────────────
export function donut(slices, opts = {}) {
  const list = (Array.isArray(slices) ? slices : []).filter((s) => s && typeof s === 'object').map((s, i) => ({
    label: s.label == null ? '' : String(s.label),
    value: Math.max(0, Number(s.value) || 0),
    colorVar: s.colorVar || SERIES[i % SERIES.length],
  }));
  if (!list.length) return emptyState(opts.empty || 'No distribution recorded yet.');

  const size = opts.size || 180, thick = opts.thickness || 26, c = size / 2, r = (size - thick) / 2, C = 2 * Math.PI * r;
  const total = list.reduce((a, s) => a + s.value, 0);
  const fmtV = (v) => (opts.money ? fmtMoney(v) : fmtNum(v));

  const g = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: 'flex:none;display:block',
    role: 'group', 'aria-label': `${opts.title || 'Distribution'}, total ${fmtV(total)}` });
  g.append(svg('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'var(--surface-3)', 'stroke-width': thick }));
  // total 0 keeps the empty track + a real "0" in the middle — an honest zero, not an invented split.
  if (total > 0) {
    const ring = svg('g', { transform: `rotate(-90 ${c} ${c})` });
    let acc = 0;
    list.filter((s) => s.value > 0).forEach((s) => {
      const len = (C * s.value) / total;
      const arc = svg('circle', { cx: c, cy: c, r, fill: 'none', stroke: `var(${s.colorVar})`, 'stroke-width': thick,
        'stroke-dasharray': `${len.toFixed(2)} ${(C - len).toFixed(2)}`, 'stroke-dashoffset': (-acc).toFixed(2) });
      ring.append(mark(arc, {
        label: `${s.label}: ${fmtV(s.value)}, ${pct(s.value, total)} percent`,
        lines: [s.label, fmtV(s.value), `${pct(s.value, total)}% of ${fmtV(total)}`],
        datum: s, onSelect: opts.onSelect,
      }));
      acc += len;
    });
    g.append(ring);
  }
  g.append(txt({ x: c, y: c + 2, fill: 'var(--txt)', 'font-size': 19, 'font-weight': 650, 'text-anchor': 'middle' }, fmtV(opts.total != null ? opts.total : total)));
  if (opts.centerLabel) g.append(txt({ x: c, y: c + 17, fill: 'var(--txt-3)', 'font-size': 9, 'text-anchor': 'middle', 'font-family': 'var(--mono)' }, opts.centerLabel));

  const rows = list.map((s) => el('div', { style: 'display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--txt-2)' }, [
    el('span', { style: `width:9px;height:9px;border-radius:2px;flex:none;background:var(${s.colorVar})` }),
    el('span', { style: 'flex:1' }, s.label),
    el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, `${fmtV(s.value)}${total > 0 ? ` · ${pct(s.value, total)}%` : ''}`),
  ]));
  return frame(el('div', { style: 'display:flex;align-items:center;gap:20px;flex-wrap:wrap' }, [
    g, el('div', { style: 'display:flex;flex-direction:column;gap:6px;min-width:170px;flex:1' }, rows),
  ]), { minWidth: 300 });
}

// ── heatCal · days: [{ date:'YYYY-MM-DD', value }] GitHub-style calendar ─────────
export function heatCal(days, opts = {}) {
  const byDay = new Map();
  (Array.isArray(days) ? days : []).forEach((d) => {
    if (!d || typeof d !== 'object') return;
    const t = Date.parse(String(d.date).slice(0, 10) + 'T00:00:00Z'); // UTC keeps a day from drifting a column
    if (Number.isFinite(t)) byDay.set(t, (byDay.get(t) || 0) + (Number(d.value) || 0));
  });
  if (!byDay.size) return emptyState(opts.empty || 'No runs recorded yet.');

  const stamps = [...byDay.keys()].sort((a, b) => a - b);
  const end = stamps[stamps.length - 1];
  const first = Math.max(stamps[0], end - 370 * DAY); // cap at ~53 weeks so the strip stays readable
  const start = first - new Date(first).getUTCDay() * DAY; // snap back to the Sunday of that week
  const weeks = Math.floor((end - start) / (7 * DAY)) + 1;
  const cell = opts.cell || 11, gap = 3, step = cell + gap, padL = 26, padT = 15;
  const W = padL + weeks * step, H = padT + 7 * step;
  const colorVar = opts.colorVar || '--c3';
  const max = Math.max(...byDay.values(), 1);
  const opacity = (v) => (v <= 0 ? 0 : v >= max * 0.75 ? 1 : v >= max * 0.5 ? 0.72 : v >= max * 0.25 ? 0.48 : 0.26);
  const unit = opts.unit || 'runs';

  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: 'display:block',
    role: 'group', 'aria-label': opts.title || `Activity calendar, ${byDay.size} days with data` });
  ['Mon', 'Wed', 'Fri'].forEach((d, i) => g.append(txt({ x: 0, y: padT + (i * 2 + 1) * step + cell - 2, fill: 'var(--txt-3)', 'font-size': 8.5, 'font-family': 'var(--mono)' }, d)));

  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * DAY;
      if (t < stamps[0] || t > end) continue; // never pad the range with days the data does not cover
      const dt = new Date(t), v = byDay.get(t) || 0;
      if (d === 0 && dt.getUTCMonth() !== lastMonth) {
        lastMonth = dt.getUTCMonth();
        g.append(txt({ x: padL + w * step, y: 9, fill: 'var(--txt-3)', 'font-size': 8.5, 'font-family': 'var(--mono)' }, dt.toLocaleDateString([], { month: 'short', timeZone: 'UTC' })));
      }
      const iso = dt.toISOString().slice(0, 10);
      const known = byDay.has(t);
      const rect = svg('rect', { x: padL + w * step, y: padT + d * step, width: cell, height: cell, rx: 2,
        fill: v > 0 ? `var(${colorVar})` : 'var(--surface-3)', opacity: v > 0 ? opacity(v) : 1 });
      g.append(mark(rect, {
        label: `${iso}: ${known ? `${v} ${unit}` : 'no data'}`,
        lines: [iso, known ? `${v} ${unit}` : 'no data recorded'],
        datum: { date: iso, value: known ? v : null }, onSelect: opts.onSelect,
      }));
    }
  }
  return frame(g, { minWidth: W });
}

// ── funnelChart · stages: [{ stage|label, n|value }] — original look + drill-down ──
export function funnelChart(stages, opts = {}) {
  const list = (Array.isArray(stages) ? stages : []).filter((s) => s && typeof s === 'object').map((s) => ({
    ...s,
    stage: s.stage != null ? String(s.stage) : String(s.label == null ? '' : s.label),
    n: Number(s.n != null ? s.n : s.value) || 0,
  }));
  if (!list.length) return emptyState(opts.empty || 'No funnel activity recorded yet.');

  const W = 620, sh = 46, h = list.length * sh + 10;
  const max = Math.max(1, ...list.map((s) => s.n));
  const top = list[0].n;
  const g = svg('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', style: `max-width:${W}px;display:block`,
    role: 'group', 'aria-label': opts.title || 'Funnel' });
  list.forEach((s, i) => {
    const y = i * sh + 6, w = Math.max(30, ((W - 40) * s.n) / max), x = (W - w) / 2;
    const prev = i ? list[i - 1].n : null;
    const conv = prev != null ? `${pct(s.n, prev)}% from ${list[i - 1].stage}` : null;
    const rect = svg('rect', { x, y, width: w, height: sh - 12, rx: 5, fill: `var(--c${(i % 6) + 1})`, opacity: 0.8 });
    g.append(mark(rect, {
      label: `${s.stage}: ${s.n}${conv ? `, ${conv}` : ''}`,
      lines: [s.stage, `${s.n}`, conv, top > 0 && i ? `${pct(s.n, top)}% of ${list[0].stage}` : null],
      datum: s, onSelect: opts.onSelect,
    }));
    // #fff on the saturated --c1..--c6 palette (identical in both themes) — matches the shipped look.
    g.append(svg('text', { x: W / 2, y: y + 22, fill: '#fff', 'font-size': 12, 'font-weight': 600, 'text-anchor': 'middle',
      'font-family': 'var(--sans)', 'pointer-events': 'none' }, `${s.stage} · ${s.n}`));
    if (conv) g.append(txt({ x: W - 6, y: y + 22, fill: 'var(--txt-3)', 'font-size': 9.5, 'text-anchor': 'end', 'font-family': 'var(--mono)' }, conv));
  });
  return frame(g, { minWidth: 420, maxWidth: W });
}
