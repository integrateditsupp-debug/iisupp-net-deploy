// RUN 33-A — KB freshness surfaced from aria-kb-query's `meta` block into the top bar ("KB v203 · synced 3h
// ago"). Proves the formatter, that askAria returns kb_meta on a KB hit, and that the renderer/top-bar wiring
// exists. 🔒 only the two freshness numbers are kept — never anything content-bearing.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { askAria, normalizeKbMeta, formatKbFreshness } from "../src/shared/aria-brain-client.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const NOW = Date.parse("2026-06-23T12:00:00Z");
let n = 0; const t = () => { n++; };

// 1 — formatter: version + relative sync age; graceful with partial/empty meta.
assert.equal(formatKbFreshness({ total_chunks: 203, kb_generated_at: "2026-06-23T09:00:00Z" }, NOW), "KB v203 · synced 3h ago");
assert.equal(formatKbFreshness({ total_chunks: 203, kb_generated_at: "2026-06-23T11:30:00Z" }, NOW), "KB v203 · synced 30m ago");
assert.equal(formatKbFreshness({ total_chunks: 203, kb_generated_at: "2026-06-21T12:00:00Z" }, NOW), "KB v203 · synced 2d ago");
assert.equal(formatKbFreshness({ total_chunks: 203, kb_generated_at: "2026-06-23T11:59:30Z" }, NOW), "KB v203 · synced just now");
assert.equal(formatKbFreshness({ total_chunks: 203 }, NOW), "KB v203", "no timestamp → version only");
assert.equal(formatKbFreshness(null, NOW), "", "no meta → empty (chip hides)");
assert.equal(formatKbFreshness({}, NOW), "", "empty meta → empty");
t();

// 2 — normalizeKbMeta keeps ONLY the freshness fields (no content leaks).
const norm = normalizeKbMeta({ total_chunks: "203", kb_generated_at: "2026-06-23T09:00:00Z", recent_learnings: ["secret"], extra: "x" });
assert.deepEqual(Object.keys(norm).sort(), ["kb_generated_at", "total_chunks"], "only freshness fields kept");
assert.equal(norm.total_chunks, 203, "coerced to number");
assert.equal(normalizeKbMeta(null), null);
t();

// 3 — askAria returns kb_meta on a confident KB hit (mocked aria-kb-query, never calls aria-chat).
const kb = { match: true, confidence: 27, article: { slug: "fix-dns", title: "Fix DNS" }, content_excerpt: "Flush the resolver cache.", meta: { total_chunks: 203, kb_generated_at: "2026-06-23T09:00:00Z" } };
let calledChat = false;
const fetchImpl = async (url) => {
  if (String(url).includes("aria-kb-query")) return { ok: true, json: async () => kb };
  calledChat = true; return { ok: true, json: async () => ({ text: "llm" }) };
};
const r = await askAria("dns broken", { fetchImpl });
assert.equal(r.action, "kb-match");
assert.deepEqual(r.kb_meta, { total_chunks: 203, kb_generated_at: "2026-06-23T09:00:00Z" }, "kb_meta surfaced");
assert.equal(calledChat, false, "KB hit never calls Anthropic");
t();

// 4 — wiring: main forwards+stores kbMeta and getState exposes it; renderer + top bar render it.
const main = read("src", "main", "main.mjs");
assert.match(main, /store\.set\("kbMeta", brain\.kb_meta\)/, "main stores kbMeta from the brain");
assert.match(main, /kbMeta: store\.get\("kbMeta"\)/, "getState exposes kbMeta");
assert.match(read("src", "renderer", "renderer.js"), /function renderKbFreshness/, "renderer renders the freshness chip");
assert.match(read("src", "renderer", "index.html"), /id="kbFreshness"/, "top-bar freshness chip present");
t();

assert.equal(n, 4, "4 kb-freshness test groups");
console.log(`kb-freshness test passed (${n} groups · formatter (h/m/d/just-now) · normalize keeps only freshness · askAria surfaces kb_meta on a KB hit · main+renderer+top-bar wiring).`);
