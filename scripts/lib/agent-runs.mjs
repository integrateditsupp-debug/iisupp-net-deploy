// agent-runs.mjs — AXIS CC v2 §2C: the recording layer under the Fleet tab. WORKER-OWNED, LOCAL ONLY.
// Fleet was dead because `agent_runs` had 0 rows: nothing ever wrote a run record. Every agent now wraps
// its work in recordRun(), so the floor renders what actually happened and nothing else. No synthetic
// heartbeats, no "idle" filler rows — if an agent never ran, it never appears.
//
// Status vocabulary is exactly three values: 'running' | 'ok' | 'fail'. finishRun() throws on anything
// else so a typo can never quietly poison ok_24h/fail_24h.
//
// `db` is always the node:sqlite DatabaseSync handle from openDb(); this module never opens one itself.

const DAY = 86400000;
const MIN_KEEP_DAYS = 7;        // pruneRuns() refuses below this: a bad call must never wipe recent history
const ERROR_MAX = 400;
const SUMMARY_MAX = 300;
const DETAIL_MAX = 4000;
const RUN_LIMIT = 200;          // snapshot payload cap — Fleet polls this every ≤15s
const LOG_LIMIT = 200;
const STATUSES = ['ok', 'fail'];

// Columns the Fleet contract needs that the original CREATE TABLE (axis-db.mjs) never had. Additive only.
const ADDITIVE_COLUMNS = [
  ['role', 'TEXT'], ['task', 'TEXT'], ['duration_ms', 'INTEGER'],
  ['detail', 'TEXT'], ['items_in', 'INTEGER'], ['items_out', 'INTEGER'], ['error', 'TEXT'],
];

// ── Secret scrubbing ────────────────────────────────────────────────────────────────────────────────
// Run text lands in Blobs and on an operator screen. An agent's thrown error routinely carries the thing
// that made it throw — an auth header, a query string, a config dump. Redact before it is ever persisted.
//
// ORDER MATTERS, and not the way you would guess. The shape rules (bearer/basic, PEM, URL credentials)
// run BEFORE the labelled key=value rule. Putting the label rule first is a leak: on
// `Authorization: Bearer <token>` the label rule consumes the word "Bearer" as the value and leaves the
// token itself in the clear. Shapes first, labels second.
const SECRET_PATTERNS = [
  // Whole-block shapes first — these span the separators the label rule would otherwise chop up.
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted]'],
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi, '$1[redacted]@'],   // user:pass@host in a URL
  [/\b(bearer|basic)\s+[A-Za-z0-9._\-+/=]{6,}/gi, '$1 [redacted]'],
  // Vendor key shapes.
  [/\b(sk|rk|pk)[_-][A-Za-z0-9_-]{8,}/g, '[redacted]'],   // Stripe uses `sk_live_…` (underscore), not `sk-`
  [/\bGOCSPX-[A-Za-z0-9_-]{6,}/g, '[redacted]'],          // Google OAuth client secret
  [/\b1\/\/[A-Za-z0-9_-]{10,}/g, '[redacted]'],           // Google refresh token (survives without a label)
  [/\bnfp_[A-Za-z0-9]{8,}/g, '[redacted]'],               // Netlify personal access token
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, '[redacted]'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, '[redacted]'],
  [/\bya29\.[A-Za-z0-9._-]{10,}/g, '[redacted]'],
  [/\bAIza[A-Za-z0-9_-]{20,}/g, '[redacted]'],
  [/\bAKIA[0-9A-Z]{12,}/g, '[redacted]'],
  [/\beyJ[A-Za-z0-9._-]{20,}/g, '[redacted]'],            // JWT
  // Labelled key=value LAST of the targeted rules. The name may carry an env-var prefix/suffix
  // (`STRIPE_SECRET_KEY`, `NETLIFY_API_TOKEN`) and may be JSON-quoted (`"client_secret": "…"`),
  // so a bare \b around the keyword is not enough — an underscore is a word character and kills it.
  // The affixes must be separated by _ . or - so the rule reads names, not prose: STRIPE_SECRET_KEY and
  // x-api-key match, "StripeAuthError: Invalid…" does not (matching there would eat the diagnosis).
  // The {0,4}/{1,40} bounds are load-bearing, not decoration: with unbounded `*` this pattern backtracks
  // quadratically and a 180 KB "ab_ab_ab…" error string costs ~7s of CPU inside the recorder.
  [/(?<![A-Za-z0-9])((?:[A-Za-z0-9]{1,40}[_.-]){0,4}(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|auth|token|secret|password|passwd|pwd|cookie)(?:[_.-][A-Za-z0-9]{1,40}){0,4})"?\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;)}\]]+)/gi, '$1=[redacted]'],
  // Catch-alls.
  [/\b[A-Fa-f0-9]{32,}\b/g, '[redacted]'],                // hashes / hex keys
  [/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]'],              // unknown opaque token formats
  [/\[redacted\]\]+/g, '[redacted]'],                     // tidy a marker that a later rule re-clipped
];

function scrub(s) {
  let out = String(s);
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return out;
}

// Total by construction. A value whose own toString() throws (a Proxy, a half-built error) must not be
// able to take down the recorder — bookkeeping that throws is how a run row gets stranded at 'running'.
function str(v) {
  try {
    if (v instanceof Error) return v.message === undefined ? String(v) : String(v.message);
    return typeof v === 'string' ? v : String(v);
  } catch { return '[unprintable value]'; }
}

function clean(v, max) {
  if (v === null || v === undefined || v === '') return null;
  const s = scrub(str(v));
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// Counts are facts. A boolean, an empty array or a blank string is NOT a count — coercing `true` to 1 or
// '  ' to 0 would invent a number, which is the one thing this dashboard may never do. Unknown stays null.
const intOrNull = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
};

// A timestamp that is not a finite number poisons ordering everywhere downstream (the activity log sort
// comparator returns NaN and V8 leaves the WHOLE array in arbitrary order, not just the bad entry).
const ts = (v) => (Number.isFinite(v) ? Math.trunc(v) : null);

// ── Schema migration (additive, idempotent, safe every tick) ────────────────────────────────────────
// Never DROP, never DELETE, never rewrite. Guarded by PRAGMA table_info so a second call is a no-op.
// Returns the column names it actually added (empty array = already current).
export function ensureAgentRunColumns(db) {
  const have = new Set(db.prepare('PRAGMA table_info(agent_runs)').all().map(c => c.name));
  if (!have.size) throw new Error('agent_runs table missing — open the DB through openDb() first');
  const added = [];
  for (const [name, type] of ADDITIVE_COLUMNS) {
    if (have.has(name)) continue;
    db.exec(`ALTER TABLE agent_runs ADD COLUMN ${name} ${type}`);
    added.push(name);
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_agent_runs_started ON agent_runs(started_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent)');
  return added;
}

// ── Write side ──────────────────────────────────────────────────────────────────────────────────────
// An unattributable run is worse than no run — the Fleet would grow a blank lane. Agent name is required.
export function startRun(db, meta, now = Date.now()) {
  const { agent, role, task } = meta && typeof meta === 'object' ? meta : {};
  const name = typeof agent === 'string' ? agent.trim() : '';
  if (!name) throw new Error('startRun requires an agent name');
  ensureAgentRunColumns(db);
  const at = ts(now) ?? Date.now();   // never persist a non-numeric started_at — see ts()
  const r = db.prepare('INSERT INTO agent_runs (agent,role,task,started_at,status) VALUES (?,?,?,?,?)')
    .run(name, clean(role, 80), clean(task, SUMMARY_MAX), at, 'running');
  return Number(r.lastInsertRowid);
}

// Closes an open run. Already-finished runs are left EXACTLY as they were (first outcome wins) rather than
// throwing, so a double-finish in a retry path can never crash an agent or rewrite history.
// Returns the stored run row.
export function finishRun(db, runId, opts, now = Date.now()) {
  const { status = 'ok', summary, detail, items_in, items_out, error } = opts && typeof opts === 'object' ? opts : {};
  if (!STATUSES.includes(status)) throw new Error(`finishRun status must be one of ${STATUSES.join('|')} — got ${str(status)}`);
  // Row ids are exact. 1.5 must not silently truncate to run 1 and close somebody else's row.
  const id = intOrNull(runId);
  if (id === null || Number(runId) !== id) throw new Error(`finishRun: not a run id — ${str(runId)}`);
  ensureAgentRunColumns(db);
  const row = db.prepare('SELECT * FROM agent_runs WHERE id=?').get(id);
  if (!row) throw new Error(`finishRun: no run ${id}`);
  if (row.status !== 'running') return row;
  const at = ts(now) ?? Date.now();
  const started = Number(row.started_at);
  db.prepare(`UPDATE agent_runs SET status=?, finished_at=?, duration_ms=?, summary=?, detail=?,
              items_in=?, items_out=?, error=? WHERE id=?`)
    .run(status, at, Number.isFinite(started) ? Math.max(0, at - started) : null,
      clean(summary, SUMMARY_MAX), clean(detail, DETAIL_MAX),
      intOrNull(items_in), intOrNull(items_out), clean(error, ERROR_MAX), id);
  return db.prepare('SELECT * FROM agent_runs WHERE id=?').get(id);
}

// If the wrapped fn resolves a plain object it may carry its own run facts; nothing is invented when it doesn't.
function harvest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const { summary, detail, items_in, items_out } = value;
  return { summary, detail, items_in, items_out };
}

// Closing the row is not optional. If the rich write fails for any reason (a hostile value in the payload,
// a transient DB error), retry with the bare outcome — a row stranded at 'running' is PERMANENT: pruneRuns()
// refuses to sweep open runs, so counts.running would over-report forever and the Fleet floor would keep
// claiming an agent is working when nothing is.
function closeRun(db, runId, payload) {
  try { return finishRun(db, runId, payload); }
  catch { try { return finishRun(db, runId, { status: payload.status }); } catch { return null; } }
}

// The wrapper every agent uses. Never swallows: a throw is recorded as 'fail' (scrubbed + truncated) and
// then RE-THROWN unchanged. Never leaves a run open — both paths go through closeRun().
export async function recordRun(db, meta, fn) {
  if (typeof fn !== 'function') throw new TypeError('recordRun requires a function to wrap');
  const runId = startRun(db, meta);
  let value;
  try {
    value = await fn({ runId });
  } catch (err) {
    // Bookkeeping must not mask the original failure, so a broken recorder is swallowed here and only here.
    closeRun(db, runId, { status: 'fail', summary: 'Run failed', error: err });
    throw err;
  }
  closeRun(db, runId, { status: 'ok', ...harvest(value) });
  return value;
}

// ── Read side — the exact `fleet` shape from docs/AXIS-CC-V2-CONTRACTS.md §2 ────────────────────────
// Reads never migrate: every column touched in SQL is from the base schema, and the additive columns are
// coalesced in JS. duration_ms falls back to finished-minus-started for rows written before the migration.
function normRun(r) {
  // intOrNull, not Number(): Number(null) is 0, which would turn "never finished" into "finished at epoch".
  const started = intOrNull(r.started_at);
  const finished = intOrNull(r.finished_at);
  const dur = intOrNull(r.duration_ms) ?? (finished !== null && started !== null ? finished - started : null);
  return {
    id: r.id, agent: r.agent, status: r.status, started_at: started, finished_at: finished,
    duration_ms: dur ?? null, summary: r.summary ?? null, detail: r.detail ?? null,
    items_in: r.items_in ?? null, items_out: r.items_out ?? null, error: r.error ?? null,
    task: r.task ?? null, role: r.role ?? null,
  };
}

// Consecutive finished runs sharing the newest run's outcome. Signed so one number carries both readings:
// +3 = three clean runs in a row, -3 = three failures in a row (what the Director watches for). 0 = nothing finished.
function streakOf(runs) {
  const finished = runs.filter(r => r.status === 'ok' || r.status === 'fail');
  if (!finished.length) return 0;
  const head = finished[0].status;
  let n = 0;
  for (const r of finished) { if (r.status !== head) break; n++; }
  return head === 'ok' ? n : -n;
}

export function fleetSnapshot(db, now = Date.now()) {
  const rows = db.prepare('SELECT * FROM agent_runs ORDER BY started_at DESC, id DESC').all().map(normRun);
  const since = now - DAY;
  const inWindow = (r) => (r.finished_at ?? r.started_at ?? 0) >= since;

  const byAgent = new Map();   // insertion order = most-recent-activity order, since rows are already sorted
  for (const r of rows) {
    if (!byAgent.has(r.agent)) byAgent.set(r.agent, []);
    byAgent.get(r.agent).push(r);
  }

  const agents = [...byAgent.entries()].map(([agent, list]) => {
    const latest = list[0];
    const win = list.filter(inWindow);
    return {
      agent,
      role: (list.find(r => r.role) || {}).role ?? null,
      status: latest.status,
      // Honest: a task is "current" only while the run is open. An idle agent is not working on anything.
      current_task: latest.status === 'running' ? latest.task : null,
      last_run_at: latest.finished_at ?? latest.started_at ?? null,
      duration_ms: latest.duration_ms,
      ok_24h: win.filter(r => r.status === 'ok').length,
      fail_24h: win.filter(r => r.status === 'fail').length,
      streak: streakOf(list),
      summary: latest.summary,
    };
  });

  // Activity log is derived from the runs themselves — there is no separate log table to drift out of sync.
  // A row whose status is neither 'ok' nor 'fail' (written directly by something other than finishRun, or
  // predating this module) has an UNKNOWN outcome. It is logged at 'info' and never captioned "failed" —
  // asserting a failure that was never recorded is fabrication, and it is exactly what would trip the
  // Director's self-heal duty into filing an issue against an agent that did nothing wrong.
  const log = [];
  for (const r of rows) {
    if (r.finished_at !== null) log.push({
      ts: r.finished_at, agent: r.agent,
      level: r.status === 'ok' ? 'ok' : r.status === 'fail' ? 'error' : 'info',
      msg: (r.status === 'fail' ? r.error || r.summary : r.summary) || (r.status === 'fail' ? 'failed' : 'finished'),
    });
    if (r.started_at !== null) log.push({ ts: r.started_at, agent: r.agent, level: 'info', msg: r.task ? `started · ${r.task}` : 'started' });
  }
  log.sort((a, b) => b.ts - a.ts);

  return {
    agents,
    runs: rows.slice(0, RUN_LIMIT),
    counts: {
      agents: agents.length,
      running: rows.filter(r => r.status === 'running').length,
      ok_24h: rows.filter(r => r.status === 'ok' && inWindow(r)).length,
      fail_24h: rows.filter(r => r.status === 'fail' && inWindow(r)).length,
    },
    log: log.slice(0, LOG_LIMIT),
  };
}

// ── Retention ───────────────────────────────────────────────────────────────────────────────────────
// Hard floor at MIN_KEEP_DAYS: a mis-typed or unit-confused call (pruneRuns(db, 0)) must throw, not erase
// the week the Fleet is rendering. Open runs and rows with no start time are never swept — deleting a
// 'running' row would leave the floor claiming work that has no record.
export function pruneRuns(db, keepDays, now = Date.now()) {
  // Deliberately NOT Number(): Number([7]) is 7 and Number(true) is 1. A retention call made with the wrong
  // kind of value is a bug, and this function deletes rows — it must refuse, not guess what was meant.
  const days = typeof keepDays === 'number' ? keepDays
    : (typeof keepDays === 'string' && keepDays.trim() !== '' ? Number(keepDays) : NaN);
  if (!Number.isFinite(days) || days < MIN_KEEP_DAYS) throw new Error(`pruneRuns refuses keepDays < ${MIN_KEEP_DAYS} (got ${str(keepDays)})`);
  const cutoff = now - days * DAY;
  const r = db.prepare("DELETE FROM agent_runs WHERE started_at IS NOT NULL AND started_at < ? AND COALESCE(status,'') <> 'running'").run(cutoff);
  return Number(r.changes);
}
