// axis-fleet.js — S12 Fleet: the live agent floor. Vanilla ESM, no framework (mirrors axis-app.js style).
// Renders ONLY what the fleet snapshot reports — agents, their run records, the worker's counts, and the
// activity log. Writes leave as intents (agent_run_request / pause); the browser never runs an agent and
// never computes a metric. agent_runs is empty today (0 rows), so every empty branch below is an honest
// empty state — no sample rows, no demo activity, no green dot for an agent that has never reported.
import { el, toast } from './axis-dom.js';
import { areaSpark } from './axis-charts.js';

// The shell already polls /api/axis/snapshot on this interval and re-renders the active screen.
// Exported so the copy on this screen and the shell's timer can never drift. NO timer is started here.
export const FLEET_POLL_MS = 15000;

// The fleet snapshot carries NO per-agent cadence field: contracts §2 `fleet.agents[]` has none and
// scripts/lib/agent-runs.mjs `fleetSnapshot()` emits none. Staleness is therefore UNKNOWABLE today.
// A default window (24h or anything else) would be an invented threshold rendered as fact and would
// raise "past the expected run window" warnings the worker never asserted — CC-BRIEF §3.3. So cadence
// stays null until a worker supplies cadence_ms / expected_every_ms, and nothing is called stale
// without one. Missing is not a number.
// Levels are exactly what fleetSnapshot() emits: 'ok' | 'error' | 'info' ('warn' reserved).
const LOG_LEVEL_COLOR = { error: 'var(--crit)', warn: 'var(--warn)', ok: 'var(--ok)', info: 'var(--txt-2)' };
const RUN_ROWS = 8;      // recent runs shown inline per agent
const SPARK_RUNS = 20;   // runs encoded into the success sparkline

// ── Pure value readers (never coerce a missing value into 0 — missing and zero are different facts) ──
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v
  : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null));
const toMs = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const parsed = Date.parse(v);           // ISO first: Date.parse('1721...') is NaN, so this order is safe
  return Number.isFinite(parsed) ? parsed : num(v);
};

/**
 * Pure derivation over the fleet snapshot. No DOM, no clock of its own, no throwing on junk input.
 * Returns exactly { agents, counts, staleAgents } so it stays trivially unit-testable.
 */
export function fleetDerive(data, now) {
  const d = data && typeof data === 'object' ? data : {};
  const t = num(now) ?? Date.now();
  const rawAgents = Array.isArray(d.agents) ? d.agents : [];
  const rawRuns = Array.isArray(d.runs) ? d.runs : [];

  // Runs grouped per agent, newest first — the inline expansion renders these verbatim.
  const runsByAgent = new Map();
  for (const r of rawRuns) {
    if (!r || typeof r !== 'object') continue;
    const key = String(r.agent ?? '');
    const list = runsByAgent.get(key) || [];
    list.push({ ...r, started_ms: toMs(r.started_at), duration_ms: num(r.duration_ms) });
    runsByAgent.set(key, list);
  }
  for (const list of runsByAgent.values()) list.sort((a, b) => (b.started_ms ?? 0) - (a.started_ms ?? 0));

  const staleAgents = [];
  const agents = rawAgents.filter(a => a && typeof a === 'object').map(a => {
    const name = String(a.agent ?? '');
    const runs = runsByAgent.get(name) || [];
    // last_run_at is the contract field; finished_at/started_at are the legacy shape the current worker
    // still emits (scripts/lib/axis-snapshots.mjs). Read whichever exists — never synthesize one.
    const last = toMs(a.last_run_at) ?? toMs(a.finished_at) ?? toMs(a.started_at) ?? (runs.length ? runs[0].started_ms : null);
    const cadence = num(a.cadence_ms) ?? num(a.expected_every_ms);   // null = the worker did not report one
    const ok24 = num(a.ok_24h), fail24 = num(a.fail_24h);
    const everRan = last != null || runs.length > 0 || (ok24 ?? 0) > 0 || (fail24 ?? 0) > 0;
    // never-run is a different state, not stale — and with no reported cadence there is no window to be past.
    const stale = cadence != null && last != null && t - last > cadence;
    if (stale) staleAgents.push(name);
    return {
      agent: name, role: a.role ?? null, status: a.status ?? null, current_task: a.current_task ?? null,
      last_run_at: last, duration_ms: num(a.duration_ms), ok_24h: ok24, fail_24h: fail24,
      streak: num(a.streak), summary: a.summary ?? null,
      cadence_ms: cadence, ever_ran: everRan, stale, runs,
    };
  });

  // Counts are worker-computed and passed straight through. The only fallback is `agents`, which is the
  // length of the very list being rendered — a row count, not a derived metric.
  const c = d.counts && typeof d.counts === 'object' ? d.counts : {};
  const counts = {
    agents: num(c.agents) ?? agents.length,
    running: num(c.running), ok_24h: num(c.ok_24h), fail_24h: num(c.fail_24h),
  };
  return { agents, counts, staleAgents };
}

// ── Formatters ──
function relTime(ms, now) {
  if (ms == null) return 'never run';
  const s = Math.round((now - ms) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function fmtDuration(ms) {
  if (ms == null) return '—';          // not reported
  if (ms === 0) return '0ms';          // a real zero is a real number
  if (ms < 1000) return Math.round(ms) + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return Math.floor(ms / 60000) + 'm ' + Math.round((ms % 60000) / 1000) + 's';
}
// null must never render as "0h" — an unreported cadence is unknown, not zero.
const fmtCadence = (ms) => (ms == null ? '—' : ms % 3600000 === 0 ? ms / 3600000 + 'h' : Math.round(ms / 60000) + 'm');
const clock = (ms) => (ms == null ? '--:--:--' : new Date(ms).toTimeString().slice(0, 8));

// An agent with no run on file is neutral + "idle" — never a green dot, never "ok".
function statusView(a) {
  if (!a.ever_ran) return { color: 'var(--line-2)', word: 'idle', cls: '' };
  const s = String(a.status || '').toLowerCase();
  if (s === 'running') return { color: 'var(--gold)', word: 'running', cls: '' };
  if (s === 'ok' || s === 'success') return { color: '', word: 'ok', cls: 'dot-ok' };
  if (s === 'fail' || s === 'failed' || s === 'error') return { color: '', word: s, cls: 'dot-crit' };
  if (s === 'paused') return { color: 'var(--line-2)', word: 'paused', cls: '' };
  return { color: '', word: s || 'unknown', cls: 'dot-warn' };
}

// Encodes each recent run as ok=1 / not-ok=0, oldest→newest. This is a visual encoding of the run rows
// themselves, not a computed KPI. Signature-tolerant: a chart failure must never take the screen down.
function successSpark(a) {
  const series = a.runs.slice(0, SPARK_RUNS).reverse()
    .map(r => (String(r.status || '').toLowerCase() === 'ok' ? 1 : 0));
  if (series.length < 2) return el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3)' }, '—');
  try {
    const node = areaSpark(series, { colorVar: '--c3', width: 84, height: 20, max: 1 });
    return node && node.nodeType ? node : el('span', { class: 'unknown', style: 'font-size:10px' }, 'no trend');
  } catch { return el('span', { class: 'unknown', style: 'font-size:10px' }, 'no trend'); }
}

// ── Screen state. Module-scoped so it survives the shell's 15s re-render of this screen. ──
const ui = { expanded: new Set(), logPaused: false, frozen: [], pausedAt: 0 };
const logScroll = { atFresh: true, top: 0, height: 0 };
let ctx = null;   // { container, data, onIntent } of the current mount, for local re-renders

const COL = { status: 104, role: 150, last: 96, dur: 84, tally: 92, spark: 96 };
const cell = (w, style = '') => `width:${w}px;flex:none;${style}`;

export function renderFleet(container, { data, onIntent } = {}) {
  ctx = { container, data, onIntent };
  container.innerHTML = '';
  const now = Date.now();
  const d = data && typeof data === 'object' ? data : {};
  const { agents, counts, staleAgents } = fleetDerive(d, now);
  const log = Array.isArray(d.log) ? d.log : [];

  container.append(el('div', { class: 'screen-head' }, [
    el('div', { class: 'screen-title' }, 'Fleet'),
    el('span', { class: 'eyebrow' }, `live agent floor · snapshot refreshes every ${FLEET_POLL_MS / 1000}s`),
  ]));

  container.append(countsStrip(counts, agents, staleAgents));
  container.append(sectionHead('Agents', 'one row per agent reporting to the worker'));
  container.append(agentTable(agents, now));
  container.append(sectionHead('Activity log', 'newest first · streamed from the worker', 'margin-top:22px'));
  container.append(logPanel(log));
}

function rerender() {
  if (ctx) renderFleet(ctx.container, { data: ctx.data, onIntent: ctx.onIntent });
}
function sectionHead(title, eyebrow, style) {
  return el('div', { class: 'screen-head', style: style || 'margin-top:20px' }, [
    el('div', { style: 'font-weight:650;font-size:13.5px' }, title),
    eyebrow ? el('span', { class: 'eyebrow' }, eyebrow) : null,
  ]);
}

// ── 1. Counts strip ──
function countsStrip(counts, agents, staleAgents) {
  const wrap = el('div', {});
  const cells = [['Agents', counts.agents], ['Running now', counts.running],
    ['Ok · last 24h', counts.ok_24h], ['Failed · last 24h', counts.fail_24h]];
  wrap.append(el('div', { class: 'kpi-grid' }, cells.map(([label, v]) => el('div', { class: 'kpi' }, [
    el('div', { class: 'label' }, label),
    // null = the worker did not report this number; 0 = it reported zero. They must not look the same.
    el('div', { class: 'value', style: v == null ? 'color:var(--txt-3)' : (label.startsWith('Failed') && v > 0 ? 'color:var(--crit)' : '') }, v == null ? '—' : v),
  ]))));

  const allZero = cells.every(([, v]) => (v ?? 0) === 0);
  if (allZero) {
    wrap.append(el('div', { class: 'card', style: 'margin-top:12px;padding:11px 14px;font-size:12.5px;color:var(--txt-2)' },
      ['No agent has reported a run yet. ',
        el('span', { class: 'unknown' }, 'agent_runs is empty — this screen shows nothing until an agent writes a real run record.')]));
  }
  if (staleAgents.length) {
    wrap.append(el('div', { class: 'card', style: 'margin-top:12px;padding:11px 14px;font-size:12.5px;border-color:var(--warn)' }, [
      el('span', { class: 'dot dot-warn', style: 'margin-right:8px' }),
      `${staleAgents.length} agent${staleAgents.length === 1 ? '' : 's'} past the expected run window: `,
      el('span', { class: 'mono', style: 'color:var(--warn)' }, staleAgents.join(', ')),
    ]));
  }
  return wrap;
}

// ── 2. Agent table (click a row → recent runs + actions inline) ──
function agentTable(agents, now) {
  const scroller = el('div', { class: 'card', style: 'padding:0;overflow-x:auto' });
  if (!agents.length) {
    scroller.append(el('div', { class: 'empty' }, 'No agents on the floor. The fleet snapshot lists an agent the first time it writes a run record.'));
    return scroller;
  }
  const table = el('div', { style: 'min-width:940px' });
  table.append(el('div', { class: 'row', style: 'font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--txt-3)' }, [
    el('div', { style: cell(COL.status) }, 'Status'), el('div', { style: 'flex:1;min-width:120px' }, 'Agent'),
    el('div', { style: cell(COL.role) }, 'Role'), el('div', { style: 'flex:1.4;min-width:150px' }, 'Current task'),
    el('div', { style: cell(COL.last) }, 'Last run'), el('div', { style: cell(COL.dur) }, 'Duration'),
    el('div', { style: cell(COL.tally) }, '24h ok / fail'), el('div', { style: cell(COL.spark) }, 'Trend'),
  ]));
  agents.forEach(a => { table.append(agentRow(a, now)); if (ui.expanded.has(a.agent)) table.append(agentDetail(a, now)); });
  scroller.append(table);
  return scroller;
}

function agentRow(a, now) {
  const sv = statusView(a);
  const open = ui.expanded.has(a.agent);
  const toggle = () => { open ? ui.expanded.delete(a.agent) : ui.expanded.add(a.agent); rerender(); };
  return el('div', {
    class: 'row', style: 'cursor:pointer', role: 'button', tabindex: '0',
    'aria-expanded': open ? 'true' : 'false', 'aria-label': `${a.agent || 'agent'} — ${sv.word}`,
    onclick: toggle,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } },
  }, [
    el('div', { style: cell(COL.status, 'display:flex;align-items:center;gap:7px') }, [
      el('span', { class: 'dot ' + sv.cls, style: sv.color ? 'background:' + sv.color : '' }),
      el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-2)' }, sv.word),
    ]),
    el('div', { style: 'flex:1;min-width:120px;font-weight:600;display:flex;align-items:center;gap:7px' }, [
      el('span', { style: 'color:var(--gold);font-size:10px' }, open ? '▾' : '▸'), a.agent || '(unnamed)',
      a.stale ? el('span', { class: 'stage-tag', style: 'color:var(--warn);border-color:var(--warn)', title: `expected every ${fmtCadence(a.cadence_ms)}` }, 'stale') : null,
    ]),
    el('div', { style: cell(COL.role, 'color:var(--txt-2);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap') },
      a.role || el('span', { class: 'unknown' }, 'no role')),
    el('div', { style: 'flex:1.4;min-width:150px;font-size:12px;color:var(--txt-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap' },
      a.current_task || el('span', { class: 'unknown' }, a.ever_ran ? 'idle — no task assigned' : 'no task assigned')),
    el('div', { class: 'mono', style: cell(COL.last, `font-size:10.5px;color:${a.last_run_at == null ? 'var(--txt-3)' : a.stale ? 'var(--warn)' : 'var(--txt-2)'}`) },
      relTime(a.last_run_at, now)),
    el('div', { class: 'mono', style: cell(COL.dur, 'font-size:10.5px;color:var(--txt-2)') }, a.ever_ran ? fmtDuration(a.duration_ms) : '—'),
    el('div', { class: 'mono', style: cell(COL.tally, 'font-size:10.5px') }, [
      el('span', { style: 'color:' + ((a.ok_24h ?? 0) > 0 ? 'var(--ok)' : 'var(--txt-3)') }, a.ok_24h == null ? '—' : a.ok_24h),
      el('span', { style: 'color:var(--txt-3)' }, ' / '),
      el('span', { style: 'color:' + ((a.fail_24h ?? 0) > 0 ? 'var(--crit)' : 'var(--txt-3)') }, a.fail_24h == null ? '—' : a.fail_24h),
    ]),
    el('div', { style: cell(COL.spark, 'display:flex;align-items:center') }, [successSpark(a)]),
  ]);
}

function agentDetail(a, now) {
  const wrap = el('div', { style: 'padding:12px 14px 16px 32px;border-bottom:1px solid var(--line);background:var(--surface-2)' });
  wrap.append(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px' }, [
    el('button', {
      class: 'chip', style: 'border-color:var(--gold);color:var(--gold)',
      disabled: String(a.status || '').toLowerCase() === 'running' || null,
      onclick: (e) => { e.stopPropagation(); runNow(a); },
    }, 'Run now'),
    String(a.status || '').toLowerCase() === 'paused'
      ? el('button', { class: 'chip', disabled: true, title: 'Paused by the worker' }, 'Paused')
      : el('button', { class: 'chip', onclick: (e) => { e.stopPropagation(); pauseAgent(a); } }, 'Pause'),
    a.streak != null ? el('span', { class: 'footnote' }, ['streak ', el('span', { class: 'src' }, a.streak)]) : null,
    // .src is this app's "verified fact" marker (.footnote .src is green in axis-tokens.css), so it may
    // only wrap a cadence the worker actually reported. Otherwise say so in plain words.
    a.cadence_ms != null
      ? el('span', { class: 'footnote' }, ['expected every ', el('span', { class: 'src' }, fmtCadence(a.cadence_ms))])
      : el('span', { class: 'footnote' }, ['expected cadence ', el('span', { class: 'unknown' }, 'not reported')]),
  ]));
  if (a.summary) wrap.append(el('div', { style: 'font-size:12px;color:var(--txt-2);margin-bottom:12px;white-space:pre-line' }, a.summary));
  wrap.append(el('div', { class: 'eyebrow', style: 'margin-bottom:7px' }, `recent runs (${a.runs.length})`));
  if (!a.runs.length) {
    wrap.append(el('div', { class: 'unknown', style: 'font-size:12px' }, 'No run records for this agent yet.'));
    return wrap;
  }
  a.runs.slice(0, RUN_ROWS).forEach(r => {
    const failed = /fail|error/i.test(String(r.status || ''));
    wrap.append(el('div', { style: 'display:flex;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line);font-size:12px' }, [
      el('span', { class: 'stage-tag', style: failed ? 'color:var(--crit)' : '' }, r.status || 'unknown'),
      el('span', { class: 'mono', style: 'font-size:10.5px;color:var(--txt-3);width:86px;flex:none' }, relTime(r.started_ms, now)),
      el('span', { class: 'mono', style: 'font-size:10.5px;color:var(--txt-3);width:70px;flex:none' }, fmtDuration(r.duration_ms)),
      el('span', { style: 'flex:1;color:var(--txt-2);min-width:0' }, r.error
        ? el('span', { style: 'color:var(--crit)' }, String(r.error))
        : (r.summary || r.detail || el('span', { class: 'unknown' }, 'no summary recorded'))),
      (r.items_in != null || r.items_out != null)
        ? el('span', { class: 'mono', style: 'font-size:10px;color:var(--txt-3);flex:none' }, `${r.items_in ?? '—'} → ${r.items_out ?? '—'}`)
        : null,
    ]));
  });
  if (a.runs.length > RUN_ROWS) wrap.append(el('div', { class: 'eyebrow', style: 'margin-top:8px' }, `+${a.runs.length - RUN_ROWS} older runs in Reports`));
  return wrap;
}

// ── 4. Per-agent actions — optimistic, rolled back the moment the worker declines ──
async function optimistic(apply, revert, type, payload, label) {
  apply(); rerender();
  const ok = ctx && typeof ctx.onIntent === 'function' ? await ctx.onIntent(type, payload) : false;
  if (!ok) { revert(); rerender(); toast(label + ' failed — nothing changed'); return false; }
  toast(label + ' queued');
  return true;
}
function runNow(a) {
  const src = ((ctx && ctx.data && ctx.data.agents) || []).find(x => x && x.agent === a.agent);
  if (!src) return;
  const prev = { status: src.status, current_task: src.current_task };
  return optimistic(
    () => { src.status = 'running'; src.current_task = a.current_task || prev.current_task; },
    () => { src.status = prev.status; src.current_task = prev.current_task; },
    'agent_run_request', { agent: a.agent, task: a.current_task || null }, 'Run ' + a.agent);
}
function pauseAgent(a) {
  const src = ((ctx && ctx.data && ctx.data.agents) || []).find(x => x && x.agent === a.agent);
  if (!src) return;
  const prev = src.status;
  return optimistic(() => { src.status = 'paused'; }, () => { src.status = prev; },
    'pause', { agent: a.agent }, 'Pause ' + a.agent);
}

// ── 3. Streaming activity log ──
function logPanel(entries) {
  // While paused the operator reads a frozen copy; new lines are counted, never dropped or invented.
  const shown = ui.logPaused ? ui.frozen : entries;
  const arrived = ui.logPaused
    ? entries.filter(e => (toMs(e && e.ts) ?? 0) > ui.pausedAt).length || Math.max(0, entries.length - ui.frozen.length)
    : 0;
  const card = el('div', { class: 'card', style: 'padding:0' });
  card.append(el('div', { style: 'display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--line)' }, [
    el('span', { class: 'eyebrow' }, `${shown.length} line${shown.length === 1 ? '' : 's'}`),
    ui.logPaused && arrived ? el('span', { class: 'stage-tag', style: 'color:var(--gold)' }, `${arrived} new while paused`) : null,
    el('div', { style: 'flex:1' }),
    el('button', {
      class: 'chip', 'aria-pressed': ui.logPaused ? 'true' : 'false',
      onclick: () => {
        ui.logPaused = !ui.logPaused;
        if (ui.logPaused) { ui.frozen = entries.slice(); ui.pausedAt = Date.now(); } else { ui.frozen = []; logScroll.atFresh = true; }
        rerender();
      },
    }, ui.logPaused ? '▶ Resume' : '❚❚ Pause'),
  ]));

  const box = el('div', { style: 'max-height:320px;overflow-y:auto;padding:8px 0', tabindex: '0', role: 'log', 'aria-label': 'Agent activity log' });
  if (!shown.length) {
    box.append(el('div', { class: 'empty' }, 'No activity logged yet. Lines appear here as agents run — nothing is replayed or simulated.'));
    card.append(box);
    return card;
  }
  // Newest first: line 0 is the freshest, so the "fresh edge" of this list is its TOP. We only auto-follow
  // when the operator is parked on that edge; otherwise we hold their exact reading position (offsetting by
  // the height the new lines added) so a poll never yanks the text they were mid-sentence on.
  shown.forEach(e => box.append(logLine(e)));
  box.addEventListener('scroll', () => { logScroll.top = box.scrollTop; logScroll.atFresh = box.scrollTop <= 4; });
  card.append(box);
  requestAnimationFrame(() => {
    if (logScroll.atFresh) box.scrollTop = 0;
    else box.scrollTop = Math.max(0, logScroll.top + (box.scrollHeight - logScroll.height));
    logScroll.height = box.scrollHeight;
  });
  return card;
}

function logLine(e) {
  const level = String((e && e.level) || 'info').toLowerCase();
  const color = LOG_LEVEL_COLOR[level] || 'var(--txt-2)';
  return el('div', {
    class: 'mono',
    style: `display:flex;gap:10px;padding:3px 14px;font-size:11px;line-height:1.5;color:${color};` +
      (level === 'error' ? 'background:color-mix(in srgb, var(--crit) 8%, transparent);' : ''),
  }, [
    el('span', { style: 'color:var(--txt-3);flex:none' }, clock(toMs(e && e.ts))),
    el('span', { style: 'color:var(--gold);flex:none;width:104px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, (e && e.agent) || '—'),
    el('span', { style: 'flex:none;width:44px;color:var(--txt-3)' }, level),
    el('span', { style: 'flex:1;min-width:0;overflow-wrap:anywhere' }, (e && e.msg) || ''),
  ]);
}
