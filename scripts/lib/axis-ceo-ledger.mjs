// axis-ceo-ledger.mjs — read senior-director-state/CEO-CRITICAL-ITEMS.md (the one ledger, policy:
// aria-vault/01_Frontal/Policies/CEO-Critical-Items-Policy.md) into rows the board can carry. WORKER-OWNED.
//
// The ledger lives ONLY on Ahmad's machine (senior-director-state/ is gitignored), so the cloud brains
// never saw it — AXIS could not name the HEC RFP deadline or the Apollo card while his own ledger had
// both. The worker that already computes the board (scripts/lib/axis-snapshots.mjs) now reads the
// ledger's "## Open" and "## Watch" tables and ships them as overview.ceo_critical (a field inside an
// existing module — the 15-module push allow-list is untouched). Parked and Closed rows stay home.
//
// Table shape (one header, pipes, nine columns; a tenth cell sometimes carries a later status note):
//   | # | what | who is waiting | deadline | category | source file | one-click | found by · on | status |
// Only the row text is shipped — never a secret, never a credential — and the result is behind the
// same Aperture login as the rest of the board.
//
// RUN-AX3 (2026-10-15): the live task overlay. When Ahmad (or AXIS on his word) acknowledges, finishes,
// archives or snoozes a ledger row in the live task view, the cloud records it in Blobs 'axis-task-overlay'
// keyed by the row id ("ledger:#5") — this file is NEVER edited. Every consumer that ranks or recites the
// open rows applies that overlay (applyLedgerOverlay / ceoLedgerBlock({ overlay })): the situation model in
// the cloud does the same through the same ids and rules (netlify/functions/lib/axis-task-ids.cjs). The
// producer, computeSnapshots(), still ships every row, so a row can always be found and reopened.
import fs from 'node:fs';
import path from 'node:path';
import IDS from '../../netlify/functions/lib/axis-task-ids.cjs';

export const LEDGER_RELPATH = path.join('senior-director-state', 'CEO-CRITICAL-ITEMS.md');

/** The id the live task list and the situation give this row: "ledger:#5", or "ledger:watch-<hash>". */
export function ledgerRowId(r) { return IDS.makeId('ledger', IDS.ledgerKey(r)); }

/** Rows the overlay does NOT take out of the ranking right now (snoozes end; acknowledgements lapse on change). */
export function applyLedgerOverlay(rows, overlay, now = new Date()) {
  if (!overlay || typeof overlay !== 'object') return rows || [];
  return (rows || []).filter((r) => !IDS.overlayHides(overlay[ledgerRowId(r)], { sig: IDS.SIG.ledger(r), now }));
}

const strip = (s) => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?)?\b/;

// Split one markdown table row into cells. Pipes inside backticks are kept as text.
export function splitRow(line) {
  const cells = [];
  let cur = '', tick = false;
  const s = String(line).trim().replace(/^\|/, '').replace(/\|$/, '');
  for (const ch of s) {
    if (ch === '`') tick = !tick;
    if (ch === '|' && !tick) { cells.push(cur); cur = ''; } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// Deadline cell → { deadline: ISO string | null, deadline_note }. "none (CDIC 2026-10-29)" keeps the
// note but has no hard deadline — a soft date is still surfaced via `soft_date` so AXIS can mention it.
export function parseDeadline(cell) {
  const raw = strip(cell);
  if (!raw) return { deadline: null, deadline_note: '', soft_date: null };
  const m = raw.match(ISO_DATE);
  if (/^none\b/i.test(raw) || /^n\/a\b/i.test(raw) || /^—$|^-$/.test(raw)) {
    // "none (CDIC 2026-10-29)" → a soft date worth mentioning; "none (… was 58 days on 2026-10-08)" → a
    // past date that explains nothing about what is coming. Only a date still ahead is a soft date.
    const soft = m && m[1] >= new Date().toISOString().slice(0, 10) ? m[1] : null;
    return { deadline: null, deadline_note: raw, soft_date: soft };
  }
  if (!m) return { deadline: null, deadline_note: raw, soft_date: null };
  const iso = m[2] ? m[1] + m[2] : m[1];
  const d = new Date(m[2] ? iso : iso + 'T23:59:00-04:00'); // a bare date means "by end of that day, Toronto"
  return { deadline: Number.isNaN(d.getTime()) ? null : d.toISOString(), deadline_note: raw, soft_date: null };
}

// Parse the markdown into rows. Section-aware: "## Open" → open, "## Watch" → watch; everything else skipped.
export function parseCeoLedger(md) {
  const rows = [];
  let section = null, header = null;
  for (const line of String(md || '').split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)/);
    if (h) {
      const t = h[1].toLowerCase();
      section = /^open\b/.test(t) ? 'open' : /^watch\b/.test(t) ? 'watch' : null;
      header = null;
      continue;
    }
    if (!section) continue;
    // "## Watch" is a bullet list, not a table: "- 2026-10-15 → CDIC RFSA closes **2026-10-29**; …".
    // The bold date is the close; the leading date is when it enters the 14-day window.
    if (section === 'watch' && /^\s*-\s+/.test(line)) {
      const text = strip(line.replace(/^\s*-\s+/, ''));
      const bold = String(line).match(/\*\*(\d{4}-\d{2}-\d{2})\*\*/);
      const enters = text.match(/^(\d{4}-\d{2}-\d{2})\s*→\s*/);
      const { deadline } = parseDeadline(bold ? bold[1] : '');
      rows.push({
        ref: `watch`, n: rows.filter((r) => r.section === 'watch').length + 1, section: 'watch',
        what: text.replace(/^(\d{4}-\d{2}-\d{2})\s*→\s*/, '').slice(0, 400),
        who: '', deadline, deadline_note: bold ? bold[1] : '', soft_date: enters ? enters[1] : null,
        category: 'watch', source: '', one_click: null, found_by: '', status: 'watch', overdue: false, closed: false, cleared: false,
      });
      continue;
    }
    if (!/^\|/.test(line)) continue;
    const cells = splitRow(line);
    if (!header) {
      if (/^#$/.test(cells[0] || '') || /^what$/i.test(cells[1] || '')) { header = cells.map((c) => c.toLowerCase()); continue; }
    }
    if (/^:?-{2,}:?$/.test(cells[0] || '') || !header) continue; // the |---| rule, or a stray row before a header
    const n = Number(strip(cells[0]));
    if (!Number.isFinite(n)) continue;
    const [, what, who, deadlineCell, category, source, oneClick, foundBy, ...statusCells] = cells;
    const status = strip(statusCells.join(' · '));
    const { deadline, deadline_note, soft_date } = parseDeadline(deadlineCell);
    const oc = strip(oneClick);
    rows.push({
      ref: `#${n}`, n, section,
      what: strip(what).slice(0, 400),
      who: strip(who).slice(0, 240),
      deadline, deadline_note, soft_date,
      category: strip(category).slice(0, 80),
      source: strip(source).slice(0, 240),
      one_click: /^none\b/i.test(oc) || !oc ? null : oc.slice(0, 200), // "none — his send" is still none
      found_by: strip(foundBy).slice(0, 120),
      status: status.slice(0, 400),
      overdue: /\boverdue\b/i.test(status) || /\boverdue\b/i.test(strip(deadlineCell)),
      // A later status cell supersedes the first ("open | CLOSED 2026-10-09 …" is closed).
      closed: /^closed\b/i.test(status) || statusCells.slice(1).some((c) => /^closed\b/i.test(strip(c))),
      // "cleared … by RUN-BX … Nothing left for Ahmad; moves to Closed on his next review": still an
      // Open row by the ledger's own rule (only Ahmad closes), but no longer something that needs him.
      cleared: /^cleared\b/i.test(status),
    });
  }
  return rows;
}

// Read + parse from the repo root. Missing file (any machine but Ahmad's) → []. Never throws.
export function readCeoLedger(repoRoot) {
  try {
    const file = path.join(repoRoot, LEDGER_RELPATH);
    if (!fs.existsSync(file)) return [];
    return parseCeoLedger(fs.readFileSync(file, 'utf8')).filter((r) => !r.closed);
  } catch { return []; }
}

// A compact text block for prompts that run on Ahmad's machine (cowork.ask / plan): the open rows,
// deadline first, one line each. Bounded so it rides inside the board slot.
export function ceoLedgerBlock(rows, { max = 12, overlay = null, now = new Date() } = {}) {
  const open = applyLedgerOverlay(rows, overlay, now).filter((r) => r.section === 'open' && !r.closed && !r.cleared);
  if (!open.length) return '';
  const sorted = [...open].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.n - b.n);
  const lines = sorted.slice(0, max).map((r) => `${r.ref} ${r.what}${r.deadline ? ` — deadline ${r.deadline.slice(0, 10)}` : r.soft_date ? ` — watch ${r.soft_date}` : ''}${r.overdue ? ' — OVERDUE' : ''}${r.one_click ? ` — one-click: ${r.one_click}` : ''}`);
  return `CEO-CRITICAL LEDGER (Ahmad's own list, ${open.length} open):\n${lines.join('\n')}${open.length > max ? `\n…and ${open.length - max} more.` : ''}`;
}
