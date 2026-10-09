// ceo-critical-items.mjs — RUN-CU / CU6 (2026-10-09). THE ONE LEDGER, READ BY MACHINES.
//
// Ahmad's standing instruction (2026-10-09): "always remind me here or any chat that these critical
// items are waiting and put them in red text", plus an email for every critical CEO action and a
// calendar reminder for anyone waiting on a signature, an interview or a critical conversation.
// The human-maintained source is `senior-director-state/CEO-CRITICAL-ITEMS.md` (policy:
// aria-vault/01_Frontal/Policies/CEO-Critical-Items-Policy.md). This module is the ONLY parser of
// that file, so every agent that wants to remind him reads the same rows the same way:
//
//   - the hourly CEO digest (`scripts/ceo-action-digest-agent.mjs`) puts the block at the TOP of
//     `ceo-now-action-digest.md`;
//   - any chat session runs `node scripts/ceo-critical-items.mjs` and pastes the block, red, first.
//
// What it does NOT do: it never sends, never writes the ledger, never invents a row. A passed deadline
// is reported as OVERDUE (the ledger rule: a passed deadline is never a removal). Red cannot be
// rendered in Markdown, so the block carries the 🔴 marker + bold; the email path (HTML) is where the
// colour itself lives (`renderCriticalHtml`).
//
// Row format (one table under `## Open`):
//   | # | what | who is waiting | deadline | category | source file | one-click | found by · on | status |
// Deadline cell: `**2026-10-13**`, `**2026-10-09T12:00-04:00**`, `none (…)`, `not recorded (…)`.
// A cell that starts with "none" or "not recorded" is undated even if a date appears in its brackets.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CEO_CRITICAL_ITEMS_FILE = path.join(ROOT, 'senior-director-state', 'CEO-CRITICAL-ITEMS.md');

export const DUE_SOON_DAYS = 14; // the policy's "14-day window"

const DATE_RE = /(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})?)?/;

function cellText(cell) {
  return cell.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

/** Parse the deadline cell. Returns { iso, dateOnly, at } or null for undated rows. */
export function parseDeadline(cell) {
  const text = cellText(cell);
  if (!text || /^(none|not recorded|n\/a|—|-)\b/i.test(text)) return null;
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const [, day, hm, offset] = m;
  if (!hm) {
    // date-only: the deadline is the END of that calendar day, read in the local zone of whoever runs this
    const at = new Date(`${day}T23:59:59`);
    return { iso: day, dateOnly: true, at };
  }
  const at = new Date(`${day}T${hm}:00${offset || ''}`);
  return { iso: `${day}T${hm}${offset || ''}`, dateOnly: false, at: Number.isNaN(at.getTime()) ? new Date(`${day}T23:59:59`) : at };
}

/** Split one Markdown table row into trimmed cells (outer pipes dropped). */
function splitRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

/**
 * Parse the ledger text. Only the table directly under `## Open` is read; `## Watch`, `## Parked`
 * and `## Closed` are returned as raw bullet lists so a renderer can show the watch list too.
 */
export function parseLedger(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const items = [];
  const watch = [];
  let section = null;
  let headerSeen = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+/.test(line)) {
      section = line.replace(/^##\s+/, '').toLowerCase();
      headerSeen = false;
      continue;
    }
    if (section && section.startsWith('open') && line.startsWith('|')) {
      const cells = splitRow(line);
      if (!headerSeen) { headerSeen = /^#$/.test(cells[0]); continue; }
      if (/^-{2,}$/.test(cells[0])) continue;
      if (cells.length < 9) continue;
      const [num, what, who, deadlineCell, category, source, oneClick, foundBy, status] = cells;
      const n = Number.parseInt(num, 10);
      if (!Number.isFinite(n)) continue;
      items.push({
        n,
        what: cellText(what),
        who: cellText(who),
        deadline: parseDeadline(deadlineCell),
        deadlineText: cellText(deadlineCell),
        category: cellText(category),
        source: cellText(source),
        oneClick: cellText(oneClick),
        foundBy: cellText(foundBy),
        status: cellText(status),
      });
    } else if (section && section.startsWith('watch') && line.startsWith('- ')) {
      watch.push(line.slice(2).trim());
    }
  }
  return { items, watch };
}

const startOfLocalDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Attach urgency to each row relative to `now`. `daysLeft` is calendar days (Oct 13 on Oct 9 → 4). */
export function classify(items, now = new Date()) {
  const soonMs = DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
  return items.map((item) => {
    let urgency = 'open';
    let daysLeft = null;
    if (item.deadline) {
      const diff = item.deadline.at.getTime() - now.getTime();
      daysLeft = Math.round((startOfLocalDay(item.deadline.at) - startOfLocalDay(now)) / (24 * 60 * 60 * 1000));
      if (diff < 0) urgency = 'overdue';
      else if (diff <= soonMs) urgency = 'due-soon';
      else urgency = 'dated';
    } else if (/person-waiting/i.test(item.category)) {
      urgency = 'person-waiting';
    }
    return { ...item, urgency, daysLeft };
  });
}

const ORDER = { overdue: 0, 'due-soon': 1, 'person-waiting': 2, open: 3, dated: 4 };

export function sortByUrgency(items) {
  return [...items].sort((a, b) => {
    const o = (ORDER[a.urgency] ?? 9) - (ORDER[b.urgency] ?? 9);
    if (o !== 0) return o;
    if (a.deadline && b.deadline) return a.deadline.at - b.deadline.at;
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.n - b.n;
  });
}

function label(item) {
  if (item.urgency === 'overdue') return `OVERDUE ${item.deadline.iso}`;
  if (item.urgency === 'due-soon') return item.daysLeft <= 0 ? `DUE TODAY ${item.deadline.iso}` : `due ${item.deadline.iso} (${item.daysLeft}d)`;
  if (item.urgency === 'dated') return `due ${item.deadline.iso}`;
  if (item.urgency === 'person-waiting') return 'someone is waiting on you';
  return 'open';
}

function shorten(text, max = 150) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Load + classify the ledger. Absent file → { items: [], watch: [], missing: true }. */
export function loadCriticalItems(file = CEO_CRITICAL_ITEMS_FILE, now = new Date()) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { items: [], watch: [], missing: true, file }; }
  const { items, watch } = parseLedger(text);
  return { items: sortByUrgency(classify(items, now)), watch, missing: false, file };
}

/**
 * Markdown block for chat replies and the hourly digest. 🔴 + bold is the Markdown stand-in for red
 * (Markdown has no colour); every line names what, who is waiting, the deadline state and the click.
 */
export function renderCriticalBlock(loaded, { now = new Date(), limit = 20 } = {}) {
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  if (loaded.missing) {
    return `## 🔴 CEO-CRITICAL — ledger not found\n\n🔴 **\`CEO-CRITICAL-ITEMS.md\` is missing from the operator record root** (expected at \`${path.relative(ROOT, loaded.file)}\`). Nothing can be reminded until it is restored from the vault. (checked ${stamp})\n`;
  }
  const items = loaded.items.slice(0, limit);
  const overdue = loaded.items.filter((i) => i.urgency === 'overdue').length;
  const soon = loaded.items.filter((i) => i.urgency === 'due-soon').length;
  const waiting = loaded.items.filter((i) => i.urgency === 'person-waiting').length;
  const head = `## 🔴 CEO-CRITICAL — ${loaded.items.length} open · ${overdue} overdue · ${soon} due within ${DUE_SOON_DAYS} days · ${waiting} with a person waiting (checked ${stamp})\n`;
  if (!items.length) return `${head}\n- Nothing open. (An item leaves the ledger only when Ahmad acts or parks it.)\n`;
  const rows = items.map((item) => {
    const click = item.oneClick && !/^none\b/i.test(item.oneClick) ? ` · click: ${shorten(item.oneClick, 80)}` : '';
    return `- 🔴 **[${label(item)}] #${item.n} ${shorten(item.what)}** — waiting: ${shorten(item.who, 90)}${click}`;
  });
  const more = loaded.items.length > items.length ? `\n- … ${loaded.items.length - items.length} more in the ledger.` : '';
  const watch = loaded.watch.length ? `\nWatch (not yet critical): ${loaded.watch.slice(0, 6).map((w) => shorten(w, 110)).join(' · ')}\n` : '';
  return `${head}\n${rows.join('\n')}${more}\n${watch}`;
}

/** HTML block for the email channel — the one place the red is literal. */
export function renderCriticalHtml(loaded, { now = new Date(), limit = 20 } = {}) {
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (loaded.missing) return `<p style="color:#c00000;font-weight:700">CEO-CRITICAL ledger not found — restore CEO-CRITICAL-ITEMS.md from the vault.</p>`;
  const items = loaded.items.slice(0, limit);
  const li = items.map((item) => `<li style="color:#c00000;font-weight:700;margin-bottom:6px">[${esc(label(item))}] #${item.n} ${esc(shorten(item.what))}<div style="color:#222;font-weight:400">waiting: ${esc(shorten(item.who, 120))}${item.oneClick && !/^none\b/i.test(item.oneClick) ? ` · click: ${esc(shorten(item.oneClick, 100))}` : ''}</div></li>`);
  return `<h2 style="color:#c00000;margin:0 0 6px">🔴 CEO-CRITICAL — ${items.length} open (${esc(now.toISOString().slice(0, 16).replace('T', ' '))}Z)</h2><ol style="padding-left:22px">${li.join('')}</ol>`;
}
