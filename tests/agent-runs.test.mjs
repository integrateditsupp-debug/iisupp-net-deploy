// tests/agent-runs.test.mjs — §2C gate: the Fleet recording layer. Every assertion reconciles to SQLite.
// Fleet was dead because agent_runs had 0 rows; these tests pin the contract that keeps it honest —
// runs actually close, failures are recorded AND re-thrown, secrets never reach the row, an empty DB
// renders empty (not undefined), and retention can never eat recent history.
import { openDb } from '../scripts/lib/axis-db.mjs';
import { startRun, finishRun, recordRun, fleetSnapshot, pruneRuns, ensureAgentRunColumns } from '../scripts/lib/agent-runs.mjs';

const db = openDb(':memory:');
const now = Date.now();
const q = (sql, ...p) => db.prepare(sql).get(...p);
let pass = 0, fail = 0;
const t = (n, c) => { if (c) pass++; else { fail++; console.error('  FAIL', n); } };

// ── 1. EMPTY DB — fully-formed, all zeros, nothing invented ─────────────────────────────────────────
const empty = fleetSnapshot(db, now);
t('empty: agents is an array', Array.isArray(empty.agents) && empty.agents.length === 0);
t('empty: runs is an array', Array.isArray(empty.runs) && empty.runs.length === 0);
t('empty: log is an array', Array.isArray(empty.log) && empty.log.length === 0);
t('empty: counts fully formed', empty.counts && empty.counts.agents === 0 && empty.counts.running === 0
  && empty.counts.ok_24h === 0 && empty.counts.fail_24h === 0);
t('empty: nothing is undefined', Object.values(empty).every(v => v !== undefined));

// ── 2. Migration is additive + idempotent ───────────────────────────────────────────────────────────
const added1 = ensureAgentRunColumns(db);
const added2 = ensureAgentRunColumns(db);
const cols = db.prepare('PRAGMA table_info(agent_runs)').all().map(c => c.name);
t('migration adds nothing twice', Array.isArray(added2) && added2.length === 0);
t('migration kept base columns', ['id', 'agent', 'started_at', 'finished_at', 'status', 'summary', 'outputs_json'].every(c => cols.includes(c)));
t('migration added contract columns', ['role', 'task', 'duration_ms', 'detail', 'items_in', 'items_out', 'error'].every(c => cols.includes(c)));
t('migration reported what it added', added1.length === 0 || added1.every(c => cols.includes(c)));

// ── 3. start / finish round-trip ────────────────────────────────────────────────────────────────────
const id = startRun(db, { agent: 'cartographer', role: 'research', task: 'Enrich 3 GTA firms' });
const open = q('SELECT * FROM agent_runs WHERE id=?', id);
t('startRun returns a numeric id', Number.isInteger(id) && id > 0);
t('open run is status running', open.status === 'running');
t('open run has no finished_at', open.finished_at === null);
t('open run stored agent/role/task', open.agent === 'cartographer' && open.role === 'research' && open.task === 'Enrich 3 GTA firms');
const done = finishRun(db, id, { status: 'ok', summary: '3 enriched', detail: 'Lead-022, Lead-023, Lead-024', items_in: 3, items_out: 3 });
t('finishRun sets ok', done.status === 'ok');
t('finishRun sets finished_at', Number.isInteger(done.finished_at) && done.finished_at >= done.started_at);
t('finishRun computes duration_ms', Number.isInteger(done.duration_ms) && done.duration_ms >= 0);
t('finishRun stores items', done.items_in === 3 && done.items_out === 3);
t('finishRun stores summary + detail', done.summary === '3 enriched' && done.detail.includes('Lead-022'));
t('finishRun rejects an unknown status', (() => { try { finishRun(db, id, { status: 'maybe' }); return false; } catch { return true; } })());
const again = finishRun(db, id, { status: 'fail', summary: 'overwrite attempt' });
t('finished run is never rewritten', again.status === 'ok' && again.summary === '3 enriched');
t('no run left open after finish', q("SELECT COUNT(*) n FROM agent_runs WHERE status='running'").n === 0);

// ── 4. recordRun — success path ─────────────────────────────────────────────────────────────────────
const value = await recordRun(db, { agent: 'sentry', role: 'inbox', task: 'Classify inbox' },
  async () => ({ summary: 'classified 26', items_in: 26, items_out: 1, extra: true }));
const okRun = q("SELECT * FROM agent_runs WHERE agent='sentry' ORDER BY id DESC LIMIT 1");
t('recordRun returns the fn value untouched', value.extra === true && value.items_in === 26);
t('recordRun success writes ok', okRun.status === 'ok');
t('recordRun harvests summary + items', okRun.summary === 'classified 26' && okRun.items_in === 26 && okRun.items_out === 1);
t('recordRun closes the run', okRun.finished_at !== null && q("SELECT COUNT(*) n FROM agent_runs WHERE status='running'").n === 0);

// ── 5. recordRun — throw path: recorded as fail, re-thrown, nothing left open ────────────────────────
const boom = new Error('gmail refused: Authorization: Bearer ya29.aVeryLongOpaqueGoogleAccessTokenValue0123 password=hunter2 api_key=AKIAIOSFODNN7EXAMPLE');
let rethrown = null;
try { await recordRun(db, { agent: 'outreach', role: 'send', task: 'Send batch' }, async () => { throw boom; }); }
catch (e) { rethrown = e; }
const failRun = q("SELECT * FROM agent_runs WHERE agent='outreach' ORDER BY id DESC LIMIT 1");
t('recordRun re-throws the original error', rethrown === boom);
t('recordRun records status fail', failRun.status === 'fail');
t('recordRun leaves no open run', q("SELECT COUNT(*) n FROM agent_runs WHERE status='running'").n === 0);
t('failed run is closed with a duration', failRun.finished_at !== null && Number.isInteger(failRun.duration_ms));

// ── 6. Secret stripping — the error text is persisted, so it must never carry credentials ───────────
t('error text is stored', typeof failRun.error === 'string' && failRun.error.length > 0);
t('bearer token stripped', !failRun.error.includes('ya29.aVeryLongOpaqueGoogleAccessTokenValue0123'));
t('password value stripped', !failRun.error.includes('hunter2'));
t('aws-style key stripped', !failRun.error.includes('AKIAIOSFODNN7EXAMPLE'));
t('redaction marker present', failRun.error.includes('[redacted]'));
t('non-secret context survives', failRun.error.includes('gmail refused'));
let longErr = null;
try { await recordRun(db, { agent: 'noisy' }, async () => { throw new Error('x'.repeat(9000)); }); } catch (e) { longErr = e; }
const longRun = q("SELECT * FROM agent_runs WHERE agent='noisy' ORDER BY id DESC LIMIT 1");
t('long error is truncated', longErr !== null && longRun.error.length <= 400);

// ── 7. fleetSnapshot shape against real rows ────────────────────────────────────────────────────────
const snap = fleetSnapshot(db, now + 1000);
const agentNames = snap.agents.map(a => a.agent).sort();
t('snapshot agents == distinct agents in SQLite', snap.counts.agents === q('SELECT COUNT(DISTINCT agent) n FROM agent_runs').n);
t('snapshot lists every agent', ['cartographer', 'noisy', 'outreach', 'sentry'].every(a => agentNames.includes(a)));
t('snapshot runs == rows in SQLite', snap.runs.length === q('SELECT COUNT(*) n FROM agent_runs').n);
t('snapshot ok_24h exact', snap.counts.ok_24h === q("SELECT COUNT(*) n FROM agent_runs WHERE status='ok'").n);
t('snapshot fail_24h exact', snap.counts.fail_24h === q("SELECT COUNT(*) n FROM agent_runs WHERE status='fail'").n);
t('snapshot running == 0', snap.counts.running === 0);
const carto = snap.agents.find(a => a.agent === 'cartographer');
t('agent row carries role', carto.role === 'research');
t('idle agent has no current_task', carto.current_task === null);
t('agent ok streak is positive', carto.streak === 1);
const outreachAgent = snap.agents.find(a => a.agent === 'outreach');
t('failing agent streak is negative', outreachAgent.streak === -1);
t('log has one entry per start + per finish', snap.log.length === q('SELECT COUNT(*) n FROM agent_runs').n * 2);
t('log is newest first', snap.log.every((e, i) => i === 0 || snap.log[i - 1].ts >= e.ts));
t('log levels are from the fixed set', snap.log.every(e => ['info', 'ok', 'error'].includes(e.level)));
t('log never leaks the raw secret', snap.log.every(e => !String(e.msg).includes('hunter2')));

// ── 8. An open run reads as running ─────────────────────────────────────────────────────────────────
const openId = startRun(db, { agent: 'miner', role: 'discovery', task: 'Score 5 product ideas' });
const live = fleetSnapshot(db, now + 2000);
const miner = live.agents.find(a => a.agent === 'miner');
t('running agent reports its current task', miner.status === 'running' && miner.current_task === 'Score 5 product ideas');
t('counts.running reflects the open run', live.counts.running === 1);
t('open run has no streak yet', miner.streak === 0);
finishRun(db, openId, { status: 'ok', summary: '5 scored' });

// ── 9. pruneRuns — refuses to eat recent history ────────────────────────────────────────────────────
const bad = (n) => { try { pruneRuns(db, n); return false; } catch { return true; } };
t('pruneRuns refuses 0 days', bad(0));
t('pruneRuns refuses 6 days', bad(6));
t('pruneRuns refuses -1 days', bad(-1));
t('pruneRuns refuses a non-number', bad('all'));
const before = q('SELECT COUNT(*) n FROM agent_runs').n;
t('refused prune deleted nothing', q('SELECT COUNT(*) n FROM agent_runs').n === before);
t('7 days is allowed and deletes nothing recent', pruneRuns(db, 7, now) === 0 && q('SELECT COUNT(*) n FROM agent_runs').n === before);
// Plant one genuinely old finished run and one old OPEN run: only the finished one may be swept.
const oldTs = now - 40 * 86400000;
db.prepare("INSERT INTO agent_runs (agent,started_at,finished_at,status,summary) VALUES ('ghost',?,?,'ok','ancient')").run(oldTs, oldTs + 5);
db.prepare("INSERT INTO agent_runs (agent,started_at,status) VALUES ('zombie',?,'running')").run(oldTs);
t('pruneRuns deletes only the old finished run', pruneRuns(db, 30, now) === 1);
t('pruneRuns never sweeps an open run', q("SELECT COUNT(*) n FROM agent_runs WHERE agent='zombie'").n === 1);
t('pruneRuns kept recent runs', q('SELECT COUNT(*) n FROM agent_runs').n === before + 1);

db.close();
console.log(`[agent-runs] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
