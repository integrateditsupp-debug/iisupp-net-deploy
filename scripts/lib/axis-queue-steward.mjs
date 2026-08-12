// axis-queue-steward.mjs - the duty nobody had: notice when the queue is jammed.
//
// FOUND 2026-08-12. The autonomy supervisor was healthy and running every few minutes. It reported
// "Approval items still open: 31" and kept going. What no agent noticed:
//
//   * 25 of the 31 were category `publish`
//   * every one of those 25 was the SAME decision - "approve publish or hold local only"
//   * all 25 were generated in a three-day burst, 2026-06-11 to 2026-06-13
//   * median age 61 days, oldest 62, none touched
//
// So the fleet spent three days in June producing staged slices, filed 25 separate approval
// requests for one repeated decision, and then ran hourly for two months adding to a queue that
// was already 100% blocked. Nothing was wrong with any individual agent. The gap was that no one
// owned the QUEUE - its shape, its age, or the fact that producing more of a jammed category is
// waste rather than progress.
//
// Four duties, all read-only. This module decides nothing and sends nothing; it reports.
//   1. collapse    - group identical-shape items so 25 requests read as 1 decision
//   2. age         - say how old things are, out loud, instead of re-listing them
//   3. backpressure- tell producers to STOP making more of a category that is jammed
//   4. failure watch - catch a log that has been erroring daily for weeks with nobody alerted
//
// Ahmad's rules this serves: R3 ship-now (a two-month-old queue is the opposite),
// R4 revenue-first (25 publish slices outrank nothing if none of them ship),
// R9 limit the count (fewer surfaces, higher polish - 25 pending slices is the failure mode).

// A date, with NO trailing \b. `\b` fails between the "1" of 2026-07-21 and the "T" of an ISO
// timestamp, because both are word characters - so every line in aria_brain_pack/pull.log
// ("[2026-07-21T23:27:16] ERROR: Export failed: 502") went undated and the 22-day failure streak
// read as no failure at all. Two forms because the two callers need different things: the global
// one to collect every date in a blob, the capturing one to pull the date out of a single line.
const DATE_RE_G = /20\d\d-\d\d-\d\d/g;
const DATE_RE = /(20\d\d-\d\d-\d\d)/;

// ---------------------------------------------------------------------------
// 1. Collapse
// ---------------------------------------------------------------------------

// Reduce an item to the SHAPE of the decision it asks for, discarding what makes each instance
// unique. Two items with the same fingerprint are the same question asked twice, and should reach
// Ahmad as one. Order matters here: strip the volatile parts before collapsing whitespace, or the
// leftovers glue together and two different shapes can land on one fingerprint.
export function fingerprint(item) {
  // Prefer the item's own statement of the decision it wants. The supervisor already records that
  // as `ownerAction` ("Approve publish or hold local only"), and it is byte-identical across all 25
  // staged-slice items - which is the whole point: they are one decision. Deriving the shape from
  // the free-text title instead was guesswork, and it failed, because the subject ("Start Here
  // route-guide", "overflow conversion") is short enough to survive any tail heuristic.
  const action = item && (item.ownerAction || item.owner_action || item.action);
  if (action) {
    return `${(item.category || 'uncategorised')}::${String(action).toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()}`;
  }
  const text = [item && item.title, item && item.summary, item && item.text, item && item.detail]
    .filter(Boolean).join(' ');
  return String(text)
    .toLowerCase()
    .replace(/`[^`]*`/g, ' ')                      // file paths in backticks - the unique part
    .replace(DATE_RE_G, ' ')                        // dates
    .replace(/[a-z0-9_-]+\.(md|json|html|mjs|js)\b/g, ' ') // bare filenames
    .replace(/\bnew local-only\b/g, ' ')            // boilerplate prefix the generator adds
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Keep the decision verbs and drop the subject noun-phrase: what varies between these 25 items
    // is WHICH slice, and that is exactly what must not distinguish them.
    .split(' ').filter((w) => w.length > 2).slice(-14).join(' ');
}

/**
 * Group items by decision shape.
 * @returns {Array<{fingerprint, category, count, items, oldestDays, newestDays}>} biggest first
 */
export function collapse(items, { now = Date.now() } = {}) {
  const groups = new Map();
  for (const it of items || []) {
    const fp = fingerprint(it);
    if (!groups.has(fp)) groups.set(fp, { fingerprint: fp, category: it.category || 'uncategorised', items: [] });
    groups.get(fp).items.push(it);
  }
  const out = [...groups.values()].map((g) => {
    const ages = g.items.map((i) => ageDays(i, now)).filter((a) => a !== null);
    return {
      ...g,
      count: g.items.length,
      oldestDays: ages.length ? Math.max(...ages) : null,
      newestDays: ages.length ? Math.min(...ages) : null,
    };
  });
  out.sort((a, b) => b.count - a.count || (b.oldestDays || 0) - (a.oldestDays || 0));
  return out;
}

// ---------------------------------------------------------------------------
// 2. Age
// ---------------------------------------------------------------------------

// Age comes from an explicit timestamp when there is one, and otherwise from the newest date
// mentioned anywhere in the item - the staged-slice items carry their date only inside a filename.
export function ageDays(item, now = Date.now()) {
  const explicit = item && (item.createdAt || item.created_at || item.ts || item.date);
  if (explicit) {
    const d = new Date(explicit);
    if (!isNaN(d)) return Math.max(0, Math.round((now - d.getTime()) / 86400000));
  }
  const found = (JSON.stringify(item || {}).match(DATE_RE_G) || [])
    .map((s) => new Date(s)).filter((d) => !isNaN(d));
  if (!found.length) return null;
  const newest = new Date(Math.max(...found.map((d) => d.getTime())));
  return Math.max(0, Math.round((now - newest.getTime()) / 86400000));
}

export const STALE_DAYS = 14;   // worth mentioning out loud
export const PARK_DAYS = 45;    // worth recommending it leaves the live queue

// ---------------------------------------------------------------------------
// 3. Backpressure
// ---------------------------------------------------------------------------

// The actual fix for what happened in June. A category with this many unresolved items is jammed,
// and the right response is for producers to STOP adding to it - not to keep working, because
// working looks like progress and is not. Deliberately low: the point is to catch the jam at 6,
// not to confirm it at 25.
export const JAM_THRESHOLD = 6;

/**
 * @returns {Array<{category, count, oldestDays, verdict:'jammed'|'watch', advice:string}>}
 */
export function backpressure(items, { now = Date.now(), threshold = JAM_THRESHOLD } = {}) {
  const byCat = new Map();
  for (const it of items || []) {
    const c = (it.category || 'uncategorised').toLowerCase().replace(/\s+/g, '_');
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(it);
  }
  const out = [];
  for (const [category, list] of byCat) {
    const ages = list.map((i) => ageDays(i, now)).filter((a) => a !== null);
    const oldestDays = ages.length ? Math.max(...ages) : null;
    if (list.length < Math.ceil(threshold / 2)) continue;
    const jammed = list.length >= threshold;
    out.push({
      category,
      count: list.length,
      oldestDays,
      verdict: jammed ? 'jammed' : 'watch',
      advice: jammed
        ? `Stop producing new "${category}" work until this clears. ${list.length} are already waiting`
          + (oldestDays !== null ? `, the oldest ${oldestDays} days` : '') + '.'
        : `"${category}" is filling up (${list.length}). One more round and it is jammed.`,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// ---------------------------------------------------------------------------
// 4. Silent-failure watch
// ---------------------------------------------------------------------------

// A log that records the same failure every day and alerts nobody is worse than no log: it creates
// the impression the thing is monitored. Found 2026-08-12: aria_brain_pack/pull.log had recorded
// "Export failed: 502" on every run since 2026-07-21 - 22 consecutive days, unnoticed, while the
// Windows task reported itself healthy enough that only its non-zero exit code gave it away.
//
// Takes log TEXT rather than a path so it stays pure and testable; the runner does the reading.
/**
 * @returns {{failing:boolean, streakDays:number, firstSeen:string|null, lastSeen:string|null, sample:string|null, distinctDays:number}}
 */
export function failureStreak(logText, { pattern = /\b(error|failed|exception|refused|timeout)\b/i, now = Date.now() } = {}) {
  const lines = String(logText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hits = [];
  let lastErrorIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!pattern.test(lines[i])) continue;
    lastErrorIdx = i;
    const m = lines[i].match(DATE_RE);
    if (m) hits.push({ day: m[1], line: lines[i] });
  }
  // RECOVERED? Judge by position, not by date. A log whose last error is today still reads as
  // "failing today" even after the job has been fixed and run successfully — so the steward would
  // cry wolf about a healthy job for two more days. Anything logged AFTER the final error means a
  // later run got further than that error did. Positional because success wording varies per job,
  // and the success line here ("Done. Wrote 800 bits") carries no timestamp to compare against.
  const recovered = lastErrorIdx >= 0 && lastErrorIdx < lines.length - 1;
  if (recovered) {
    return { failing: false, recovered: true, streakDays: 0, distinctDays: 0,
      firstSeen: null, earliest: null, lastSeen: null, sample: null };
  }
  if (!hits.length) return { failing: false, streakDays: 0, firstSeen: null, lastSeen: null, sample: null, distinctDays: 0 };

  const days = [...new Set(hits.map((h) => h.day))].sort();
  const last = days[days.length - 1];
  // Only call it a live failure if it is still happening. A log full of errors from March that
  // stopped in April is history, not an incident.
  const daysSinceLast = Math.round((now - new Date(last).getTime()) / 86400000);
  const live = daysSinceLast <= 2;

  // Walk back from the newest day while the gap stays within a day or two, so a task that skips a
  // weekend still reads as one continuous streak rather than three separate ones.
  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    const gap = Math.round((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
    if (gap <= 3) streak++; else break;
  }

  return {
    failing: live,
    streakDays: streak,
    distinctDays: days.length,
    firstSeen: days[days.length - streak],   // start of the CURRENT unbroken streak
    // The first failure in the log at all. Reported separately because the streak walk stops at a
    // gap, and "failing 8 days running" badly understates a job that has not succeeded since July.
    earliest: days[0],
    lastSeen: last,
    sample: hits[hits.length - 1].line.slice(0, 200),
  };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/**
 * Build the whole picture. Pure: hand it items and named log texts, get a report back.
 */
export function steward({ items = [], logs = {}, now = Date.now() } = {}) {
  const groups = collapse(items, { now });
  const duplicated = groups.filter((g) => g.count > 1);
  const pressure = backpressure(items, { now });
  const ages = items.map((i) => ageDays(i, now)).filter((a) => a !== null);

  const failures = [];
  for (const [name, text] of Object.entries(logs)) {
    const f = failureStreak(text, { now });
    if (f.failing && f.streakDays >= 3) failures.push({ source: name, ...f });
  }
  failures.sort((a, b) => b.streakDays - a.streakDays);

  return {
    total: items.length,
    distinctDecisions: groups.length,
    // The headline number: how many separate asks collapse into how many real decisions.
    collapsedFrom: items.length,
    collapsedTo: groups.length,
    duplicated,
    stale: items.filter((i) => (ageDays(i, now) || 0) >= STALE_DAYS).length,
    parkable: items.filter((i) => (ageDays(i, now) || 0) >= PARK_DAYS).length,
    oldestDays: ages.length ? Math.max(...ages) : null,
    medianDays: ages.length ? ages.slice().sort((a, b) => a - b)[Math.floor(ages.length / 2)] : null,
    pressure,
    jammed: pressure.filter((p) => p.verdict === 'jammed'),
    failures,
  };
}

// One or two sentences, for the speaker. Spoken replies stay short (see AXIS-SYSTEM.md); the detail
// belongs on screen and in the vault, not read aloud.
export function spokenSummary(rep) {
  const bits = [];
  if (rep.jammed.length) {
    const j = rep.jammed[0];
    bits.push(`${j.count} ${j.category} approvals are jammed`
      + (j.oldestDays !== null ? `, oldest ${j.oldestDays} days` : '') + '.');
  }
  const big = rep.duplicated[0];
  if (big && big.count > 2) bits.push(`${big.count} of them are one decision.`);
  if (rep.failures.length) {
    const f = rep.failures[0];
    bits.push(`${f.source} has failed ${f.streakDays} days running.`);
  }
  if (!bits.length) return 'Queue is clear.';
  return bits.join(' ');
}
