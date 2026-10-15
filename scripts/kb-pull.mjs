#!/usr/bin/env node
// scripts/kb-pull.mjs — pull ARIA's LIVE learned bit-KB down to THIS machine.
//
// Rule 7 (Ahmad, 2026-05-25): the KB must live locally and be owned by Ahmad. Serverless
// can't push to your PC, so you (or a local Task Scheduler / cron job) RUN this. It calls
// the aria-kb-export endpoint, then writes every learned bit into ./aria_brain_pack/bits/
// plus a manifest. The curated base (assets/aria-kb-local-bundle-v2.json) is already in
// the repo, so it's already local — this fetches what the continuous loop has learned since.
//
// Usage (PowerShell):
//   $env:ARIA_AUDIT_SECRET="<the value from Netlify env>"
//   node scripts/kb-pull.mjs
// Optional: $env:ARIA_SITE="https://iisupp.net"   (default)
//
// Schedule it (Windows Task Scheduler, daily) to keep the local copy fresh.

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = (process.env.ARIA_SITE || 'https://iisupp.net').replace(/\/$/, '');
const SECRET = process.env.ARIA_AUDIT_SECRET || process.env.ARIA_EXPORT_SECRET || '';
// LIMIT LADDER, not a single number. Measured against production 2026-08-12:
//   limit=5000 -> 502   limit=2000 -> 502   limit=1600 -> 502   limit=1200 -> 502 (~41s)
//   limit=800  -> 200 (26s)   limit=500 -> 200   limit=50 -> 200
// aria-kb-export does one Blobs read PER BIT (`blobs.slice(0, limit)` then `kb.get` in a loop), so
// its runtime scales with the limit and it blows Netlify's ~26s synchronous ceiling somewhere
// between 800 and 1200 bits. The old hard-coded 5000 was therefore guaranteed to fail the moment
// the KB outgrew ~1000 bits, which it did: pull.log shows "Export failed: 502" on every run from
// 2026-07-21 to 2026-08-12 - 22 failing days, logged faithfully, alerting nobody.
//
// A single smaller number would rot the same way as the KB keeps growing. So: walk DOWN the ladder
// until one completes. Getting some of the KB is strictly better than getting none, which is what
// three weeks of 502s delivered.
//
// RUN-CV / CV5 (2026-10-09, missed request A6f) — PAGING, AND A LADDER THAT STARTS LOW.
// The ladder above started at 800, the very number the header records as taking 26 s — a coin-toss
// against the ceiling — and the Windows "ARIA KB Pull" task went on failing with 504 for 58 days. Now:
//   * the first page is 300 (ARIA_KB_LIMIT overrides), comfortably under the measured ceiling;
//   * every page is fetched with ?offset=, so the mirror is WHOLE, not the first N bits — the export
//     function answers `total` + `nextOffset` (aria-kb-export.mjs, additive). A server that does not
//     paginate yet (no `nextOffset` in the body, or a page that repeats keys already seen) stops after
//     one page and says PARTIAL, as before — it never loops;
//   * a 502/503/504/408/429, a timeout or a network error HALVES the page (floor 25) and retries with a
//     jittered backoff, at most ARIA_KB_TRIES (3) attempts per page position;
//   * a 401/403 (the secret) or 404 (the site) fails at once — no page size fixes those;
//   * when the retries are spent the run FAILS LOUDLY with the last status and body, exit 1 — the job
//     registry keys on `ERROR:` and on the one success line, `Done. Wrote N bits`, and both are kept.
// The output is what it always was: aria_brain_pack/bits/<key>.json per bit + manifest.json, written
// all-or-nothing at the end. ARIA_KB_OUT_ROOT redirects the output root (the test uses a scratch dir).
export const DEFAULT_START_LIMIT = 300;
export const MIN_LIMIT = 25;
export const DEFAULT_TRIES = 3;
export const RETRYABLE_STATUSES = Object.freeze([408, 429, 500, 502, 503, 504]);
export const FATAL_STATUSES = Object.freeze([400, 401, 403, 404, 405]);
export const MAX_PAGES = 500;

const envInt = (name, fallback) => {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export class ExportFailed extends Error {
  constructor(message, { status = null, body = '', attempts = 0, offset = 0, limit = null } = {}) {
    super(message);
    this.name = 'ExportFailed';
    this.status = status;
    this.body = String(body || '').slice(0, 200);
    this.attempts = attempts;
    this.offset = offset;
    this.limit = limit;
  }
}

/** Jittered exponential backoff: base * 2^(attempt-1) plus up to 50% jitter. Pure given `random`. */
export function backoffMs(attempt, baseMs = 1500, random = Math.random) {
  const exp = baseMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.round(exp + exp * 0.5 * Math.min(Math.max(random(), 0), 1));
}

/** The next page size after a size-related failure: halve, never below the floor. */
export function halve(limit) {
  return Math.max(MIN_LIMIT, Math.floor(limit / 2));
}

/**
 * Pull every learned bit, page by page. Pure apart from the injected `fetchImpl` / `log` / `sleep`.
 * Resolves { bits, pages, total, complete, usedLimits, exportedAt }; throws ExportFailed.
 */
export async function pullBits({
  site = SITE,
  secret = SECRET,
  startLimit = DEFAULT_START_LIMIT,
  tries = DEFAULT_TRIES,
  timeoutMs = 50000,
  retryBaseMs = 1500,
  fetchImpl = globalThis.fetch,
  log = console.log,
  warn = console.error,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  random = Math.random,
  maxPages = MAX_PAGES
} = {}) {
  if (!secret) throw new ExportFailed('ERROR: set ARIA_AUDIT_SECRET (the value from your Netlify env) before running.', { status: 'no-secret' });
  const base = String(site || '').replace(/\/$/, '');
  const bits = [];
  const seen = new Set();
  const usedLimits = [];
  let limit = Math.max(MIN_LIMIT, Math.floor(Number(startLimit) || DEFAULT_START_LIMIT));
  let offset = 0;
  let pages = 0;
  let total = null;
  let complete = false;
  let exportedAt = null;

  while (pages < maxPages) {
    let data = null;
    let lastStatus = null;
    let lastBody = '';
    const maxTries = Math.max(1, Number(tries) || DEFAULT_TRIES);
    for (let attempt = 1; attempt <= maxTries; attempt++) {
      const url = `${base}/.netlify/functions/aria-kb-export?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
      log(`Pulling live bit-KB from ${url}`);
      let res;
      try {
        // Below the 26s server ceiling, so a hang is a real failure rather than us giving up early.
        res = await fetchImpl(url, { headers: { 'x-aria-export-secret': secret }, signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        lastStatus = /timeout|abort/i.test(String(e && (e.name || e.message))) ? 'timeout' : 'network';
        lastBody = (e && e.message) || String(e);
      }
      if (res) {
        if (res.ok) {
          try { data = await res.json(); } catch (e) { lastStatus = 'bad-json'; lastBody = (e && e.message) || String(e); }
          if (data) break;
        } else {
          lastStatus = res.status;
          lastBody = await res.text().catch(() => '');
          // 401/403 is the secret, 404 the site — no smaller page will fix those.
          if (FATAL_STATUSES.includes(res.status)) {
            throw new ExportFailed(`Export failed: ${lastStatus} ${String(lastBody).slice(0, 200)}`, { status: lastStatus, body: lastBody, attempts: attempt, offset, limit });
          }
        }
      }
      // Retryable: 5xx/408/429, timeout, network, unparseable body. Halve the page, back off, try again.
      const next = halve(limit);
      const wait = backoffMs(attempt, retryBaseMs, random);
      if (attempt < maxTries) {
        warn(`  limit=${limit} offset=${offset} -> ${lastStatus} (attempt ${attempt}/${maxTries}) — retrying with limit=${next} in ${wait}ms`);
        limit = next;
        await sleep(wait);
      } else {
        warn(`  limit=${limit} offset=${offset} -> ${lastStatus} (attempt ${attempt}/${maxTries}) — giving up`);
      }
    }
    if (!data) {
      throw new ExportFailed(`Export failed: ${lastStatus} ${String(lastBody).slice(0, 200)}`, { status: lastStatus, body: lastBody, attempts: maxTries, offset, limit });
    }

    pages += 1;
    usedLimits.push(limit);
    exportedAt = data.exportedAt || exportedAt;
    const page = Array.isArray(data.bits) ? data.bits : [];
    let fresh = 0;
    for (const bit of page) {
      const key = bit && bit.key != null ? String(bit.key) : `bit-${bits.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bits.push(bit);
      fresh += 1;
    }
    if (typeof data.total === 'number') total = data.total;

    const paginates = Object.prototype.hasOwnProperty.call(data, 'nextOffset');
    if (!paginates) {
      // The deployed export has no cursor yet: one page is all it can give. Say so, as before.
      complete = false;
      warn(`NOTE: the export did not answer with nextOffset/total — no pagination on the server. This is a PARTIAL mirror of ${bits.length} bits (limit=${limit}).`);
      break;
    }
    if (data.nextOffset === null || data.nextOffset === undefined) { complete = true; break; }
    const nextOffset = Number(data.nextOffset);
    if (!Number.isFinite(nextOffset) || nextOffset <= offset || fresh === 0 || page.length === 0) {
      // A cursor that does not advance, or a page with nothing new, would loop forever. Stop and say so.
      complete = false;
      warn(`NOTE: stopping — the export's cursor did not advance (offset ${offset} -> ${data.nextOffset}, ${fresh} new of ${page.length}). PARTIAL mirror of ${bits.length} bits.`);
      break;
    }
    offset = nextOffset;
  }
  if (pages >= maxPages && !complete) warn(`NOTE: stopped at the ${maxPages}-page cap — PARTIAL mirror of ${bits.length} bits.`);

  return { bits, pages, total, complete, usedLimits, exportedAt };
}

/** Write the bits + manifest exactly where the puller always has: <outRoot>/aria_brain_pack/{bits,manifest.json}. */
export async function writeMirror({ bits, exportedAt, pages, total, complete, usedLimits }, { outRoot = root, site = SITE } = {}) {
  const outDir = join(outRoot, 'aria_brain_pack', 'bits');
  await mkdir(outDir, { recursive: true });

  let written = 0;
  for (const bit of bits) {
    const safe = String(bit.key || `bit-${written}`).replace(/[^a-z0-9._-]/gi, '_');
    await writeFile(join(outDir, safe.endsWith('.json') ? safe : safe + '.json'), JSON.stringify(bit, null, 2), 'utf8');
    written++;
  }
  const manifest = {
    pulledAt: new Date().toISOString(),
    site,
    exportedAt,
    count: bits.length,
    written,
    note: 'Local owned copy of ARIA live bit-KB. Curated base is assets/aria-kb-local-bundle-v2.json.',
    // RUN-CV / CV5 — additive: how the pull went, so a partial mirror can never pass for a whole one.
    pages,
    total,
    complete,
    pageSizes: usedLimits
  };
  await writeFile(join(outRoot, 'aria_brain_pack', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { written, outDir, manifest };
}

async function main() {
  if (!SECRET) {
    console.error('ERROR: set ARIA_AUDIT_SECRET (the value from your Netlify env) before running.');
    process.exit(1);
  }
  const outRoot = process.env.ARIA_KB_OUT_ROOT ? resolve(process.env.ARIA_KB_OUT_ROOT) : root;
  let result;
  try {
    result = await pullBits({
      site: SITE,
      secret: SECRET,
      startLimit: envInt('ARIA_KB_LIMIT', DEFAULT_START_LIMIT),
      tries: envInt('ARIA_KB_TRIES', DEFAULT_TRIES),
      timeoutMs: envInt('ARIA_KB_TIMEOUT_MS', 50000),
      retryBaseMs: envInt('ARIA_KB_RETRY_BASE_MS', 1500)
    });
  } catch (e) {
    if (e instanceof ExportFailed) {
      console.error(`ERROR: ${e.message.replace(/^ERROR:\s*/, '')} (offset ${e.offset}, limit ${e.limit}, ${e.attempts} attempt(s))`);
      // ON-DEVICE 2026-10-15: on Windows (Node 24) process.exit(1) here crashed the process with
      // STATUS_STACK_BUFFER_OVERRUN (0xC0000409) while the last aborted fetch was still winding down —
      // the exit code came out as 3221226505, not 1. Set the code and let the loop drain instead.
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  if (!result.complete) {
    console.warn(`NOTE: PARTIAL mirror — ${result.bits.length} bits over ${result.pages} page(s)` + (result.total != null ? ` of ${result.total} listed` : '') + '.');
  }
  const { written } = await writeMirror(result, { outRoot, site: SITE });
  console.log(`Done. Wrote ${written} bits to aria_brain_pack/bits/ (manifest updated). Pages: ${result.pages}, page sizes: ${result.usedLimits.join('>')}${result.total != null ? `, listed: ${result.total}` : ''}${result.complete ? '' : ' — PARTIAL'}.`);
}

// Entry guard: importing this module (tests/kb-pull-paging.test.mjs) runs nothing. Basename fallback
// for the Windows task, where argv[1] and the module URL can differ in drive-letter case.
const isMain = Boolean(process.argv[1]) && (() => {
  try {
    const self = fileURLToPath(import.meta.url);
    const entry = resolve(process.argv[1]);
    return entry === self || basename(entry) === basename(self);
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
