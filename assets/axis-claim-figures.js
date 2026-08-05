// axis-claim-figures.js — RUN-AM / AM2 (carried unchanged from AL2).
//
// Staleness existed in the internal payload and NOWHERE A PERSON READS. Every figure has carried
// `{ value, measuredAt, source, kind }` since RUN-AK and an `ageHours` / `stale` annotation since the
// same cycle — and the operator surface rendered none of it. A number read six cycles ago and a
// number read this cycle appeared on screen as the same number.
//
// This module turns the annotated claims map into rows the AXIS console renders: the value, how old
// the read behind it is, and a visible marker on anything past its class's freshness window.
//
// Three rules, all deliberate:
//   1. NOTHING IS HIDDEN BY STALENESS. A stale figure is rendered with an accusation attached, never
//      dropped. A figure that disappears is a figure nobody can challenge.
//   2. THE PUBLIC HEADLINE NEVER GETS THIS. All of it is operator-internal, served only behind the
//      Aperture login through /api/axis-status. The leak gate stays headline-only.
//   3. PURE. No DOM, no fetch, no clock except the `now` passed in. The console does the injection;
//      this file only decides what the row says, so a test can assert it.
//
// Shipped as an ES module so the v2 console (assets/axis-app.js, type="module") imports it directly
// and the module-graph test can walk the edge. It ALSO publishes window.AxisClaimFigures for the v1
// command centre, which is a classic script — neither surface is removed to serve the other.

export const SCHEMA = 'axis-claim-figures.v1';
export const MARKER = 'STALE';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Turn a camelCase claim name into something a person reads without decoding it. */
export function label(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function ageLabel(hours) {
  if (hours == null || isNaN(hours)) return 'age unknown';
  if (hours < 1) return 'read ' + Math.max(1, Math.round(hours * 60)) + 'm ago';
  if (hours < 48) return 'read ' + Math.round(hours) + 'h ago';
  return 'read ' + Math.round(hours / 24) + 'd ago';
}

function hoursSince(iso, now) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, (now.getTime() - t) / 3600000);
}

function renderValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

/**
 * claims: the annotated map from the authed /api/axis-status payload.
 * Returns one row per figure: { name, label, value, ageHours, ageLabel, stale, marker, source,
 * provenance, unmeasured, unmeasurableReason }.
 *
 * Age is RECOMPUTED from `measuredAt` against `now` rather than trusted from the payload's own
 * `ageHours`: that annotation was written when the feed was written, and the whole point of this
 * surface is that a figure keeps aging after nobody is left to re-annotate it.
 */
export function claimRows(claims, opts) {
  const now = (opts && opts.now) ? new Date(opts.now) : new Date();
  if (!isObj(claims)) return [];
  return Object.keys(claims).map((name) => {
    const c = claims[name];
    if (!isObj(c)) {
      return { name, label: label(name), value: renderValue(c), ageHours: null, ageLabel: 'age unknown',
        stale: true, marker: MARKER, maxAgeHours: 24, source: '', provenance: null, unmeasured: false, unmeasurableReason: '' };
    }
    const age = hoursSince(c.measuredAt, now);
    const max = typeof c.maxAgeHours === 'number' ? c.maxAgeHours : 24;
    const stale = age === null ? true : age > max;
    return {
      name,
      label: label(name),
      value: renderValue(c.value),
      ageHours: age === null ? null : Math.round(age * 10) / 10,
      ageLabel: ageLabel(age),
      stale,
      marker: stale ? MARKER : '',
      maxAgeHours: max,
      source: c.source || '',
      provenance: c.provenance || null,
      unmeasured: c.provenance === 'declared-unmeasurable',
      unmeasurableReason: c.unmeasurableReason || '',
    };
  });
}

/** How many rendered rows are stale. Shown on the card so it cannot be scrolled past. */
export function staleCount(rows) {
  return (rows || []).filter((r) => r.stale).length;
}

/** HTML for the operator card. Every value escaped; nothing dropped for being stale. */
export function renderFiguresHTML(claims, opts) {
  const rows = claimRows(claims, opts);
  if (!rows.length) return '<div class="axis-empty">No program figures published yet.</div>';
  const n = staleCount(rows);
  const head = '<div class="cf-head">' +
    '<span class="cf-n">' + rows.length + ' figures</span>' +
    (n ? '<span class="cf-stalen">' + n + ' stale</span>' : '<span class="cf-fresh">all fresh</span>') +
    '</div>';
  const body = rows.map((r) =>
    '<div class="cf-row' + (r.stale ? ' cf-is-stale' : '') + '" data-figure="' + esc(r.name) + '">' +
      '<div class="cf-l">' + esc(r.label) + '</div>' +
      '<div class="cf-v">' + esc(r.value) +
        (r.unmeasured ? '<span class="cf-unmeasured" title="' + esc(r.unmeasurableReason) + '">not measurable here</span>' : '') +
      '</div>' +
      '<div class="cf-a">' + esc(r.ageLabel) +
        (r.stale ? '<span class="cf-stale">' + MARKER + '</span>' : '') +
      '</div>' +
    '</div>').join('');
  return head + '<div class="cf-rows">' + body + '</div>' +
    '<div class="cf-note">Age is measured from when each figure was read, not from when this page loaded. ' +
    'A figure past its window is marked, never removed.</div>';
}

/** Styles for the card. The surface owns its own look; injected once by whichever console mounts it. */
export const STYLES =
  '.cf-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}' +
  '.cf-n{color:#74889a}.cf-fresh{color:#137a45}.cf-stalen{color:#b3261e}' +
  '.cf-rows{display:flex;flex-direction:column;max-height:280px;overflow:auto}' +
  '.cf-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:baseline;padding:6px 0;border-top:1px solid rgba(128,150,170,.18)}' +
  '.cf-l{font-size:11px;opacity:.82;line-height:1.35;min-width:0}' +
  '.cf-v{font-size:12.5px;font-weight:700;white-space:nowrap}' +
  '.cf-a{font-size:10px;opacity:.6;white-space:nowrap}' +
  '.cf-row.cf-is-stale .cf-v{color:#b3261e}' +
  '.cf-stale{margin-left:6px;font-size:9px;font-weight:800;letter-spacing:.1em;background:#fdecec;color:#b3261e;padding:2px 6px;border-radius:99px}' +
  '.cf-unmeasured{margin-left:6px;font-size:9px;font-weight:700;letter-spacing:.06em;background:#fdf3e3;color:#9a6a12;padding:2px 6px;border-radius:99px}' +
  '.cf-note{font-size:10px;opacity:.6;line-height:1.5;margin-top:9px}';

/** Inject STYLES once. Safe to call on every render; no-op outside a browser. */
export function ensureFigureStyles(doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d || d.getElementById('axis-cf-style')) return;
  const s = d.createElement('style');
  s.id = 'axis-cf-style';
  s.textContent = STYLES;
  d.head.appendChild(s);
}

// v1 command centre (classic script) consumer. Additive — v2 imports the named exports above.
if (typeof window !== 'undefined') {
  window.AxisClaimFigures = { SCHEMA, MARKER, STYLES, label, ageLabel, claimRows, staleCount, renderFiguresHTML, ensureFigureStyles };
}
