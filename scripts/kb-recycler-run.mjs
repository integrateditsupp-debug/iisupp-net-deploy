#!/usr/bin/env node
// kb-recycler-run — driver for the continuous KB lifecycle engine (scripts/kb-recycler.mjs).
//
// Reads the KB manifest, re-validates the next ROLLING BATCH (read-only), and writes a recycle report
// to documents/audits/. State (rolling cursor + recycle-bin tombstones) persists in
// documents/audits/kb-recycle-state.json. Every decision is appended to a tamper-evident hash-chained
// log (kb-recycle-log.jsonl + kb-recycle-log.seal.json).
//
// SAFE BY DEFAULT — DRY RUN: it only writes the report (a proposal) + a verified state read. It does
// NOT move/delete any KB file or mutate routing. Pass --apply to actually soft-delete recycle
// candidates to the bin and hard-delete tombstones past the 4-month retention. Validation is always
// read-only; a linked recipe is never executed (logic dry-run only).
//
// Usage:  node scripts/kb-recycler-run.mjs [--apply] [--batch=N]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideCycle, cycleLogEntries, sealLog, verifyLog, RETENTION_DAYS } from "./kb-recycler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const KB = path.join(ROOT, "knowledge-base");
const MANIFEST = path.join(KB, "_meta", "manifest.json");
const BIN = path.join(KB, "_recycle-bin");
const AUDITS = path.join(ROOT, "documents", "audits");
const STATE = path.join(AUDITS, "kb-recycle-state.json");
const LOG = path.join(AUDITS, "kb-recycle-log.jsonl");
const SEAL = path.join(AUDITS, "kb-recycle-log.seal.json");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const batchArg = (args.find((a) => a.startsWith("--batch=")) || "").split("=")[1];
const BATCH = Number(batchArg) > 0 ? Number(batchArg) : 12;

const nowMs = Date.now();
const nowIso = new Date(nowMs).toISOString();
const dateStr = nowIso.slice(0, 10);

function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }
function readJsonl(p) { try { return fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

const manifest = readJson(MANIFEST, { articles: [] });
const articles = Array.isArray(manifest.articles) ? manifest.articles : [];
const state = readJson(STATE, { cursor: 0, recycleBin: [], cycles: 0 });

// Read-only loader over the real KB tree.
const loader = (rel) => {
  const abs = path.join(KB, String(rel || ""));
  try { return { exists: fs.existsSync(abs), content: fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "" }; }
  catch { return { exists: false, content: "" }; }
};

const plan = decideCycle({
  articles, cursor: state.cursor || 0, batchSize: BATCH, loader,
  now: () => nowMs, recycleBin: state.recycleBin || [], retentionDays: RETENTION_DAYS
});

// ── Verify the existing log seal before appending (tamper detection) ──────────────────────────────
const existingLog = readJsonl(LOG);
const existingSeal = readJson(SEAL, null);
let logIntegrity = "baseline (no prior log)";
if (existingSeal) {
  const v = verifyLog(existingLog, existingSeal);
  logIntegrity = v.ok ? "intact" : `TAMPERED (${v.reason} @ ${v.brokenAt})`;
}

const newEntries = cycleLogEntries(plan, nowIso);

// ── Report (always written — this is the evidence artifact) ───────────────────────────────────────
function reportMarkdown() {
  const L = [];
  L.push(`# KB Recycle Report — ${dateStr}`);
  L.push("");
  L.push(`- Mode: **${APPLY ? "APPLY" : "DRY-RUN (report only — no files moved/deleted)"}**`);
  L.push(`- Cycle: #${(state.cycles || 0) + 1} · rolling batch size ${BATCH} · cursor ${state.cursor || 0} → ${plan.cursorNext}`);
  L.push(`- Articles in manifest: ${articles.length}`);
  L.push(`- Recycle-bin size (before): ${(state.recycleBin || []).length} · retention ${RETENTION_DAYS} days (~4 months)`);
  L.push(`- Prior log integrity: **${logIntegrity}**`);
  L.push("");
  L.push(`## This cycle`);
  L.push(`| outcome | count |`);
  L.push(`|---|---|`);
  L.push(`| KEEP | ${plan.summary.keep} |`);
  L.push(`| REVIEW (kept, flagged) | ${plan.summary.review} |`);
  L.push(`| RECYCLE (soft-delete → bin) | ${plan.summary.recycle} |`);
  L.push(`| HARD-DELETE (retention expired) | ${plan.summary.hardDelete} |`);
  L.push("");
  if (plan.recycles.length) {
    L.push(`### Recycle candidates`);
    for (const r of plan.recycles) L.push(`- \`${r.id}\` (${r.path}) — ${r.reasons.join(", ")}`);
    L.push("");
  }
  if (plan.reviews.length) {
    L.push(`### Review (stayed in routing — human to confirm)`);
    for (const r of plan.reviews) L.push(`- \`${r.id}\` — ${r.reasons.join(", ")}`);
    L.push("");
  }
  if (plan.hardDeletes.length) {
    L.push(`### Hard-delete (past 4-month retention)`);
    for (const h of plan.hardDeletes) L.push(`- \`${h.id}\` — recycled ${h.recycledAt} — ${h.reason || ""}`);
    L.push("");
  }
  L.push(`Batch this cycle: ${plan.batchIds.join(", ")}`);
  L.push("");
  L.push(`> Tamper-evident log: \`documents/audits/kb-recycle-log.jsonl\` (sealed by \`kb-recycle-log.seal.json\`). No silent deletes — every decision above is one logged, hash-chained entry when applied.`);
  return L.join("\n");
}

fs.mkdirSync(AUDITS, { recursive: true });
const reportPath = path.join(AUDITS, `kb-recycle-report-${dateStr}.md`);
fs.writeFileSync(reportPath, reportMarkdown());

// ── Apply (gated) — soft-delete recycle candidates, hard-delete expired tombstones, seal the log ──
if (APPLY) {
  fs.mkdirSync(BIN, { recursive: true });
  const bin = Array.isArray(state.recycleBin) ? state.recycleBin.slice() : [];

  // Soft-delete: MOVE the file to the bin + write a tombstone. Reversible.
  for (const r of plan.recycles) {
    const src = path.join(KB, r.path);
    const destName = `${r.id}__${dateStr}.md`;
    const dest = path.join(BIN, destName);
    try {
      if (fs.existsSync(src)) { fs.renameSync(src, dest); }
      bin.push({ id: r.id, path: r.path, binPath: path.join("_recycle-bin", destName), recycledAt: nowIso, reason: r.reasons.join(",") });
    } catch (e) { console.error(`soft-delete failed for ${r.id}: ${e.message}`); }
  }

  // Hard-delete: remove bin files whose tombstone passed retention.
  const expiredIds = new Set(plan.hardDeletes.map((h) => h.id));
  const keptBin = [];
  for (const b of bin) {
    if (expiredIds.has(b.id)) {
      try { const bp = path.join(KB, b.binPath || ""); if (b.binPath && fs.existsSync(bp)) fs.unlinkSync(bp); } catch { /* best-effort */ }
    } else keptBin.push(b);
  }

  // Append decisions to the tamper-evident log + re-seal.
  if (newEntries.length) {
    fs.appendFileSync(LOG, newEntries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }
  const allLog = readJsonl(LOG);
  fs.writeFileSync(SEAL, JSON.stringify(sealLog(allLog), null, 2));

  fs.writeFileSync(STATE, JSON.stringify({ cursor: plan.cursorNext, recycleBin: keptBin, cycles: (state.cycles || 0) + 1, lastRun: nowIso }, null, 2));
}

console.log(`KB recycle ${APPLY ? "APPLY" : "DRY-RUN"} — keep ${plan.summary.keep} · review ${plan.summary.review} · recycle ${plan.summary.recycle} · hard-delete ${plan.summary.hardDelete}`);
console.log(`Report → ${path.relative(ROOT, reportPath)}`);
console.log(`Prior log integrity: ${logIntegrity}`);
if (!APPLY) console.log(`(dry-run: no KB files moved/deleted, routing untouched. Re-run with --apply to enact.)`);
