// job-registry.mjs - every unattended job, what proves it SUCCEEDED, and how stale is too stale.
//
// WHY THIS EXISTS (2026-08-12). Seven separate failures in one session, all the same shape: the job
// wrote its problem down somewhere and nothing asserted on it. "It's logged" was mistaken for
// "it's monitored", and a log nobody reads is worse than no log because it manufactures the feeling
// of oversight.
//
//   AXIS brain worker died          - no log at all, silent for an unknown period
//   ARIA KB Pull returned 502       - pull.log, every day, nobody read it
//   Windows task exited non-zero    - LastTaskResult=1, nobody read it
//   run-axis-brain-worker.ps1       - parse error swallowed by -WindowStyle Hidden
//   supervisor log                  - written as UTF-16, unreadable
//
// THE ONE RULE THAT MATTERS: assert on last SUCCESS, never on last RUN.
// ARIA KB Pull ran perfectly on schedule every morning for weeks. A run-based check would have
// reported it green every single day. Its last actual success was 2026-06-14 ("Done. Wrote 321
// bits"); everything after that was a punctual, well-logged failure. Only the success line carries
// the truth.
//
// SECOND RULE: never claim to watch what you cannot see. A job with no local evidence surface is
// reported `unobserved`, not `ok`. A watchdog that quietly downgrades unknown to healthy is the
// eighth instance of the bug it was built to prevent.

// ---------------------------------------------------------------------------
// Evidence kinds
// ---------------------------------------------------------------------------
// log      - a log file; last success = newest date on a line matching successRe
// artifact - a file or directory whose mtime is itself proof the job produced something
// winTask  - a Windows scheduled task; success requires LastTaskResult === 0
// stamp    - a JSON file carrying an explicit { t: <epoch ms> } written on success
// none     - deliberately unobservable from this machine (e.g. a Netlify cron)

const HOUR = 3600000;

/**
 * The registry. Adding an unattended job WITHOUT adding it here is how the next silent failure
 * happens, so treat this file as the definition of "we run this", not as documentation of it.
 *
 * expectHours - how often a success is expected.
 * graceFactor - how many expected intervals may pass before it is stale. Keep tight; the whole
 *               failure mode is tolerating silence.
 */
export const JOBS = [
  {
    id: 'axis-brain-worker',
    label: 'AXIS brain worker',
    why: 'Answers AXIS on the Max plan. Dead = AXIS misreports "out of credit" and sends Ahmad to billing.',
    expectHours: 1,
    graceFactor: 3,
    evidence: {
      kind: 'log',
      path: 'logs/axis-brain-worker.log',
      // Booting counts as success: the worker is a poller, so being up IS the job.
      successRe: /(online .*answering AXIS|answered (on the Max plan|from the vault))/i,
      failRe: /(worker exited|launcher exception|failed:)/i,
    },
  },
  {
    id: 'aria-kb-pull',
    label: 'ARIA KB pull',
    why: 'Mirrors the live bit-KB locally. Stale = every local answer is served from an old brain.',
    expectHours: 24,
    graceFactor: 2,
    evidence: {
      kind: 'log',
      path: 'aria_brain_pack/pull.log',
      // The ONLY line that means success. "Pulling live bit-KB from ..." is printed before the
      // request and appears on failing runs too - keying on it would have reported green for weeks.
      successRe: /Done\.\s*Wrote\s+\d+\s+bits/i,
      failRe: /ERROR:/,
    },
  },
  {
    id: 'senior-director-worker',
    label: 'Senior director autonomy supervisor',
    why: 'Refreshes the approval queue and mission state the whole fleet reads.',
    expectHours: 1,
    graceFactor: 4,
    evidence: { kind: 'artifact', path: 'senior-director-state/autonomy/supervisor-state.json' },
  },
  {
    id: 'axis-queue-steward',
    label: 'AXIS queue steward',
    why: 'Surfaces a jammed approval queue. Dead = the jam goes back to being invisible.',
    expectHours: 1,
    graceFactor: 4,
    evidence: { kind: 'artifact', path: 'senior-director-state/autonomy/queue-steward.md' },
  },
  {
    id: 'job-watchdog',
    label: 'This watchdog',
    why: 'A watchdog that dies silently is the failure it exists to prevent. It watches itself first.',
    expectHours: 1,
    graceFactor: 4,
    evidence: { kind: 'stamp', path: 'senior-director-state/autonomy/job-watchdog-stamp.json' },
  },

  // Windows scheduled tasks. Evidence comes from the OS, and success REQUIRES exit code 0 -
  // "ARIA KB Pull" reported LastTaskResult=1 daily and nothing looked.
  // corroboratedBy: this task and `aria-kb-pull` are the SAME job seen two ways - the scheduler's
  // exit code, and the log the script writes. The scheduler's result only refreshes on its next
  // scheduled run, so after a mid-day manual fix the two disagree for up to 24h: the task still
  // reports exit 1 from this morning while the log shows a success minutes ago. Reporting that as
  // "FAILING, never succeeded" is the same stale-signal-as-current mistake this file exists to
  // kill, just one level up. See the reconciliation pass in evaluateAll().
  { id: 'win-kb-pull', label: 'Win: ARIA KB Pull', expectHours: 24, graceFactor: 2,
    corroboratedBy: 'aria-kb-pull',
    why: 'Drives aria-kb-pull.', evidence: { kind: 'winTask', task: 'ARIA KB Pull' } },
  { id: 'win-bizdev', label: 'Win: Business Development Agent Morning', expectHours: 24, graceFactor: 2,
    why: 'Morning outbound preparation.', evidence: { kind: 'winTask', task: 'IIS Business Development Agent Morning' } },
  { id: 'win-ceo-digest', label: 'Win: CEO Action Digest Hourly', expectHours: 1, graceFactor: 4,
    why: 'Ahmad-facing digest.', evidence: { kind: 'winTask', task: 'IIS CEO Action Digest Hourly' } },
  { id: 'win-interaction', label: 'Win: Interaction Avoidance Agent Hourly', expectHours: 1, graceFactor: 4,
    why: 'Keeps agents from double-contacting.', evidence: { kind: 'winTask', task: 'IIS Interaction Avoidance Agent Hourly' } },
  { id: 'win-opp-engine', label: 'Win: Opportunity Engine Hourly', expectHours: 1, graceFactor: 4,
    why: 'Revenue pipeline generation.', evidence: { kind: 'winTask', task: 'IIS Opportunity Engine Hourly' } },
  { id: 'win-opp-packets', label: 'Win: Opportunity Prep Packets Hourly', expectHours: 1, graceFactor: 4,
    why: 'Prepares bid/opportunity packets.', evidence: { kind: 'winTask', task: 'IIS Opportunity Prep Packets Hourly' } },
  { id: 'win-opp-gate', label: 'Win: Opportunity Quality Gate Hourly', expectHours: 1, graceFactor: 4,
    why: 'Filters low-quality opportunities.', evidence: { kind: 'winTask', task: 'IIS Opportunity Quality Gate Hourly' } },
  { id: 'win-cleanup', label: 'Win: Workspace Cleanup Agent Daily', expectHours: 24, graceFactor: 2,
    why: 'Vault and workspace tidy.', evidence: { kind: 'winTask', task: 'IIS Workspace Cleanup Agent Daily' } },
];

// Netlify crons run in the cloud and leave no local success trace. They are declared so the count
// is honest and so nobody believes this file covers them, but they are reported `unobserved`
// rather than `ok`. Wiring real evidence for these means having each cron stamp a Blob on success.
export const UNOBSERVED_NOTE =
  '23 Netlify scheduled functions are not covered: they run in the cloud and write no local '
  + 'success trace. To bring them in, have each one stamp a Blob on success and add a `stamp` entry.';

// ---------------------------------------------------------------------------
// Parsing evidence
// ---------------------------------------------------------------------------

// No trailing \b. It fails between the "1" of 2026-07-21 and the "T" of an ISO timestamp because
// both are word characters, which is precisely how a 22-day outage read as undated and invisible.
const DATE_RE_G = /20\d\d-\d\d-\d\d(?:[T ]\d\d:\d\d:\d\d)?/g;

/**
 * Newest timestamp on a line matching `re`, or null. Returns epoch ms.
 *
 * Timestamps CARRY FORWARD. Real logs here are multi-line entries: pull.log stamps the first line
 * ("[2026-06-14T09:55:23] Pulling live bit-KB from ...") and puts the outcome on the next one
 * ("Done. Wrote 321 bits"). A strict same-line match found the success text, found no date on that
 * line, and skipped it - reporting a job that last succeeded in June as having NEVER succeeded.
 * Under-reporting success is not a safe direction to be wrong in: it trains people to ignore the
 * watchdog, which is how the original failures survived.
 */
export function lastMatchingLine(logText, re) {
  let newest = null, sample = null, carried = null;
  for (const line of String(logText || '').split(/\r?\n/)) {
    const dates = line.match(DATE_RE_G);
    if (dates) {
      const t = new Date(dates[dates.length - 1].replace(' ', 'T')).getTime();
      if (!isNaN(t)) carried = t;
    }
    if (!re.test(line)) continue;
    if (carried === null) continue;              // nothing dated yet in this file
    if (newest === null || carried > newest) { newest = carried; sample = line.trim().slice(0, 200); }
  }
  return newest === null ? null : { t: newest, sample };
}

/**
 * Evaluate one job against gathered evidence.
 * @param evidence {{ logText?, mtimeMs?, stamp?, task?: {lastRun, lastResult}, present?:boolean }}
 * @returns {{id,label,status,lastSuccessMs,ageHours,limitHours,detail,why}}
 */
export function evaluate(job, evidence = {}, now = Date.now()) {
  const limitHours = job.expectHours * (job.graceFactor || 2);
  const base = { id: job.id, label: job.label, why: job.why, limitHours, expectHours: job.expectHours };
  const kind = job.evidence && job.evidence.kind;

  let lastSuccessMs = null;
  let detail = '';

  if (kind === 'none') return { ...base, status: 'unobserved', lastSuccessMs: null, ageHours: null, detail: 'no local evidence surface' };

  if (kind === 'log') {
    if (evidence.present === false) return { ...base, status: 'never', lastSuccessMs: null, ageHours: null, detail: 'log file does not exist - has this ever run?' };
    const succ = lastMatchingLine(evidence.logText, job.evidence.successRe);
    const fail = job.evidence.failRe ? lastMatchingLine(evidence.logText, job.evidence.failRe) : null;
    if (!succ) {
      return { ...base, status: 'never', lastSuccessMs: null, ageHours: null,
        detail: fail ? `no success line ever; newest failure: ${fail.sample}` : 'no success line found in log' };
    }
    lastSuccessMs = succ.t;
    detail = succ.sample;
    // A job whose newest FAILURE is more recent than its newest success is actively broken, whether
    // or not the success is still inside its grace window.
    if (fail && fail.t > succ.t) {
      const ageHours = (now - lastSuccessMs) / HOUR;
      return { ...base, status: 'failing', lastSuccessMs, ageHours,
        detail: `last success ${new Date(lastSuccessMs).toISOString().slice(0, 10)}; failing since: ${fail.sample}` };
    }
  } else if (kind === 'artifact') {
    if (!evidence.mtimeMs) return { ...base, status: 'never', lastSuccessMs: null, ageHours: null, detail: 'artifact missing - job has produced nothing' };
    lastSuccessMs = evidence.mtimeMs;
    detail = job.evidence.path;
  } else if (kind === 'stamp') {
    if (!evidence.stamp || !evidence.stamp.t) return { ...base, status: 'never', lastSuccessMs: null, ageHours: null, detail: 'no stamp written yet' };
    lastSuccessMs = evidence.stamp.t;
    detail = job.evidence.path;
  } else if (kind === 'winTask') {
    const t = evidence.task;
    if (!t) return { ...base, status: 'unobserved', lastSuccessMs: null, ageHours: null, detail: 'task not found on this machine' };
    // THE POINT: a run is not a success. ARIA KB Pull ran on time, daily, returning 1.
    if (t.lastResult !== 0) {
      // ageHours stays NULL on a failure. It is the age of the last SUCCESS, and there isn't one -
      // populating it from lastRun made the report say "last success 2.8h ago" about a task that
      // has never succeeded, which is the precise conflation this whole file exists to kill.
      // lastRanHours carries the run time separately, clearly labelled.
      return { ...base, status: 'failing', lastSuccessMs: null, ageHours: null,
        lastRanHours: t.lastRun ? (now - t.lastRun) / HOUR : null,
        detail: `ran ${t.lastRun ? new Date(t.lastRun).toISOString().slice(0, 16) : 'never'} and exited ${t.lastResult}` };
    }
    lastSuccessMs = t.lastRun || null;
    detail = `exit 0 at ${t.lastRun ? new Date(t.lastRun).toISOString().slice(0, 16) : '?'}`;
  } else {
    return { ...base, status: 'unobserved', lastSuccessMs: null, ageHours: null, detail: 'unknown evidence kind' };
  }

  const ageHours = lastSuccessMs === null ? null : (now - lastSuccessMs) / HOUR;
  const status = ageHours === null ? 'unobserved' : (ageHours > limitHours ? 'stale' : 'ok');
  return { ...base, status, lastSuccessMs, ageHours, detail };
}

// `recovering` sits below the genuinely-bad states and is deliberately NOT in `bad`: the job works,
// only the scheduler's record of it is stale. Leaving it in `bad` would keep it as the spoken
// headline for up to 24h after a fix, which is crying wolf about something already resolved.
export const SEVERITY = { failing: 0, never: 1, stale: 2, recovering: 3, unobserved: 4, ok: 5 };

/**
 * Where a failing job has a corroborating job that has succeeded MORE RECENTLY than the failing
 * job last ran, the failure is history. Downgrade it to `recovering` and say why, rather than
 * reporting a fixed job as broken until its scheduler catches up.
 */
function reconcileCorroborated(results, jobs, now) {
  const byId = new Map(results.map((r) => [r.id, r]));
  for (const job of jobs) {
    if (!job.corroboratedBy) continue;
    const self = byId.get(job.id);
    const other = byId.get(job.corroboratedBy);
    if (!self || !other || self.status !== 'failing') continue;
    if (!other.lastSuccessMs) continue;
    // The failing entry carries only the AGE of its last run, so rebuild the timestamp to compare.
    const selfRanMs = self.lastRanHours != null ? now - self.lastRanHours * HOUR : null;
    if (selfRanMs === null || other.lastSuccessMs <= selfRanMs) continue;
    self.status = 'recovering';
    self.lastSuccessMs = other.lastSuccessMs;
    self.ageHours = (now - other.lastSuccessMs) / HOUR;
    self.detail = `${self.detail}, but ${other.label} succeeded ${hrs(self.ageHours)} ago`
      + ' - the scheduler clears on its next run';
  }
}

/** Evaluate everything. `evidenceById` maps job id -> evidence object. */
export function evaluateAll(evidenceById = {}, { now = Date.now(), jobs = JOBS } = {}) {
  const results = jobs.map((j) => evaluate(j, evidenceById[j.id] || {}, now));
  reconcileCorroborated(results, jobs, now);
  results.sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || (b.ageHours || 0) - (a.ageHours || 0));
  const counts = results.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {});
  return { results, counts, bad: results.filter((r) => r.status === 'failing' || r.status === 'never' || r.status === 'stale') };
}

const hrs = (h) => (h === null ? '?' : h < 48 ? `${h.toFixed(1)}h` : `${Math.round(h / 24)}d`);

/** Short enough to say out loud. Leads with the worst thing, per AXIS-SYSTEM.md. */
export function spokenSummary({ results, counts, bad }) {
  // The watchdog reports its OWN staleness first: everything else it says is worthless if it is
  // itself not running.
  const self = results.find((r) => r.id === 'job-watchdog');
  if (self && (self.status === 'stale' || self.status === 'never')) {
    return `Watchdog itself last ran ${hrs(self.ageHours)} ago. Treat everything below as unverified.`;
  }
  if (!bad.length) {
    // Don't say "all N healthy" while silently omitting the recovering ones — that is the same
    // partial truth the watchdog exists to stop. Name them; they clear on their next run.
    const rec = counts.recovering || 0;
    return rec
      ? `All ${counts.ok || 0} watched jobs healthy; ${rec} recovering (fixed, scheduler not caught up).`
      : `All ${counts.ok || 0} watched jobs healthy.`;
  }
  const w = bad[0];
  const rest = bad.length > 1 ? ` Plus ${bad.length - 1} more.` : '';
  // A failing job has no success to date, so say what is actually known rather than "? ago".
  const when = w.ageHours !== null ? `last success ${hrs(w.ageHours)} ago`
    : (w.lastRanHours != null ? `never succeeded, last ran ${hrs(w.lastRanHours)} ago` : 'never succeeded');
  return `${w.label}: ${w.status}, ${when}.${rest}`;
}

export { hrs as formatHours };
