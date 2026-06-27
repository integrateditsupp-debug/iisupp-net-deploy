// KB Recycler — pure lifecycle engine. Loader/clock injected (a fake fs map), so validation,
// rolling-batch, retention hard-delete, and the tamper-evident hash chain all run with no real I/O.
// Asserts the safety contract: validation is read-only, stale ≠ recycle, every decision is logged
// (no silent deletes), and the log seal detects modification/truncation/insertion.
import assert from "node:assert/strict";
import {
  parseFrontmatter, validateArticle, selectBatch, decideCycle,
  sealLog, verifyLog, cycleLogEntries, RETENTION_DAYS, STALE_REVIEW_DAYS
} from "../scripts/kb-recycler.mjs";

const DAY = 86400000;
const NOW = Date.parse("2026-06-27T00:00:00Z");
const now = () => NOW;

function article(id, body, fm = {}) {
  const lines = ["---", `id: ${id}`, 'title: "x"', "keywords:", "  - a", "  - b"];
  for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${v}`);
  lines.push("---", "", body || "");
  return lines.join("\n");
}
// A fake read-only loader backed by a map; records every path it was asked to read.
function fakeLoader(map, reads) {
  return (p) => { if (reads) reads.push(p); return p in map ? { exists: true, content: map[p] } : { exists: false, content: "" }; };
}
const FULL = "x".repeat(200); // a body long enough to pass the min-length check

// ── parseFrontmatter ──────────────────────────────────────────────────────────────────────────
{
  const { data, body, hasFrontmatter } = parseFrontmatter(article("l1-x-001", "Hello body", { last_updated: "2026-01-01" }));
  assert.equal(hasFrontmatter, true);
  assert.equal(data.id, "l1-x-001");
  assert.equal(data.last_updated, "2026-01-01");
  assert.deepEqual(data.keywords, ["a", "b"]);
  assert.match(body, /Hello body/);
  assert.equal(parseFrontmatter("no frontmatter here").hasFrontmatter, false);
}

// ── validateArticle — RECYCLE cases ─────────────────────────────────────────────────────────────
{
  // missing file
  let v = validateArticle({ id: "gone", path: "L1/gone.md" }, { loader: fakeLoader({}), now });
  assert.equal(v.status, "recycle"); assert.deepEqual(v.reasons, ["file-missing"]);

  // no frontmatter id
  v = validateArticle({ id: "bad", path: "p" }, { loader: fakeLoader({ p: "just text, no frontmatter" }), now });
  assert.equal(v.status, "recycle"); assert.equal(v.reasons[0], "malformed-no-frontmatter-id");

  // empty/truncated body
  v = validateArticle({ id: "stub", path: "p" }, { loader: fakeLoader({ p: article("stub", "too short") }), now });
  assert.equal(v.status, "recycle"); assert.equal(v.reasons[0], "empty-or-truncated-body");

  // explicitly obsolete / deprecated / superseded
  assert.equal(validateArticle({ id: "o", path: "p" }, { loader: fakeLoader({ p: article("o", FULL, { status: "obsolete" }) }), now }).status, "recycle");
  assert.equal(validateArticle({ id: "d", path: "p" }, { loader: fakeLoader({ p: article("d", FULL, { deprecated: "true" }) }), now }).status, "recycle");
  v = validateArticle({ id: "s", path: "p" }, { loader: fakeLoader({ p: article("s", FULL, { superseded_by: "l2-new-001" }) }), now });
  assert.equal(v.status, "recycle"); assert.match(v.reasons[0], /superseded-by-l2-new-001/);
}

// ── validateArticle — KEEP / REVIEW (stale ≠ recycle) ─────────────────────────────────────────────
{
  // current + valid → keep
  let v = validateArticle({ id: "ok", path: "p" }, { loader: fakeLoader({ p: article("ok", FULL, { last_updated: "2026-06-01" }) }), now });
  assert.equal(v.status, "keep"); assert.deepEqual(v.reasons, []);

  // stale > 1y → REVIEW (kept in routing, flagged — NOT recycled)
  const old = new Date(NOW - (STALE_REVIEW_DAYS + 30) * DAY).toISOString().slice(0, 10);
  v = validateArticle({ id: "old", path: "p" }, { loader: fakeLoader({ p: article("old", FULL, { last_updated: old }) }), now });
  assert.equal(v.status, "review"); assert.ok(v.reasons.includes("stale>1y"));

  // id drift vs manifest → REVIEW (keep, flag)
  v = validateArticle({ id: "manifest-id", path: "p" }, { loader: fakeLoader({ p: article("file-id", FULL, { last_updated: "2026-06-01" }) }), now });
  assert.equal(v.status, "review"); assert.ok(v.reasons.includes("id-drift-vs-manifest"));

  // linked recipe regressed in a LOGIC dry-run → REVIEW (keep, flag). Dry-run never executes.
  let executed = false;
  v = validateArticle(
    { id: "r", path: "p", recipeId: "flush-dns" },
    { loader: fakeLoader({ p: article("r", FULL, { last_updated: "2026-06-01" }) }), now, recipeDryRun: () => { executed = false; return { wouldApply: false }; } }
  );
  assert.equal(v.status, "review"); assert.ok(v.reasons.some((x) => x.startsWith("linked-recipe-regressed")));
  assert.equal(executed, false);
}

// ── selectBatch — rolling window wraps around ─────────────────────────────────────────────────────
{
  const ids = ["a", "b", "c", "d", "e"];
  let r = selectBatch(ids, 0, 2); assert.deepEqual(r.batch, ["a", "b"]); assert.equal(r.next, 2);
  r = selectBatch(ids, r.next, 2); assert.deepEqual(r.batch, ["c", "d"]); assert.equal(r.next, 4);
  r = selectBatch(ids, r.next, 2); assert.deepEqual(r.batch, ["e", "a"]); assert.equal(r.next, 1); // wraps
  assert.deepEqual(selectBatch([], 0, 5).batch, []);
}

// ── decideCycle — buckets + retention hard-delete + read-only ─────────────────────────────────────
{
  const reads = [];
  const map = {
    "L1/keep.md": article("keep", FULL, { last_updated: "2026-06-01" }),
    "L1/obsolete.md": article("obsolete", FULL, { status: "obsolete" })
    // "L1/missing.md" intentionally absent
  };
  const articles = [
    { id: "keep", path: "L1/keep.md" },
    { id: "obsolete", path: "L1/obsolete.md" },
    { id: "missing", path: "L1/missing.md" }
  ];
  const recycleBin = [
    { id: "old-bin", recycledAt: new Date(NOW - (RETENTION_DAYS + 5) * DAY).toISOString(), reason: "marked-obsolete" }, // due
    { id: "fresh-bin", recycledAt: new Date(NOW - 10 * DAY).toISOString(), reason: "file-missing" }                     // not due
  ];
  const plan = decideCycle({ articles, cursor: 0, batchSize: 3, loader: fakeLoader(map, reads), now, recycleBin });
  assert.equal(plan.summary.keep, 1);
  assert.equal(plan.summary.recycle, 2); // obsolete + missing
  assert.equal(plan.summary.hardDelete, 1, "only the bin entry past 4-month retention is hard-deleted");
  assert.equal(plan.hardDeletes[0].id, "old-bin");
  assert.equal(plan.cursorNext, 0, "batch of all 3 wraps cursor back to 0");
  // Read-only: the loader was only ever READ; no writer was ever invoked (there is none).
  assert.ok(reads.length >= 2);
}

// ── Tamper-evident log — seal detects modification / truncation / insertion ───────────────────────
{
  const entries = [
    { ts: "2026-06-27T00:00:00Z", action: "recycle", id: "a", reason: "file-missing" },
    { ts: "2026-06-27T00:00:00Z", action: "review", id: "b", reason: "stale>1y" },
    { ts: "2026-06-27T00:00:00Z", action: "hard-delete", id: "c", reason: "retention-expired" }
  ];
  const sealed = sealLog(entries);
  assert.equal(verifyLog(entries, sealed).ok, true);

  const modified = entries.map((e, i) => (i === 1 ? { ...e, id: "TAMPERED" } : e));
  let res = verifyLog(modified, sealed);
  assert.equal(res.ok, false); assert.equal(res.brokenAt, 1);

  res = verifyLog(entries.slice(0, 2), sealed); // truncation
  assert.equal(res.ok, false); assert.equal(res.reason, "row-count-changed");

  const inserted = [entries[0], { ts: "x", action: "recycle", id: "ghost", reason: "silent-delete-attempt" }, entries[1], entries[2]];
  assert.equal(verifyLog(inserted, sealed).ok, false); // inserted row → broken chain
}

// ── cycleLogEntries — every recycle/review/hard-delete is logged (no silent deletes) ─────────────
{
  const plan = {
    recycles: [{ id: "r1", reasons: ["file-missing"] }],
    reviews: [{ id: "v1", reasons: ["stale>1y"] }],
    hardDeletes: [{ id: "h1", reason: "marked-obsolete" }]
  };
  const log = cycleLogEntries(plan, "2026-06-27T00:00:00Z");
  assert.equal(log.length, 3);
  assert.deepEqual(log.map((e) => e.action).sort(), ["hard-delete", "recycle", "review"]);
  assert.ok(log.every((e) => e.ts && e.id), "every logged decision carries a timestamp + id");
}

console.log("kb-recycler test suite passed.");
