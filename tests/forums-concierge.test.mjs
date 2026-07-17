#!/usr/bin/env node
// FORUMS CONCIERGE — auto-answers genuine unanswered help posts from the REAL KB, $0, honest-abstain.
// It answers a real help post (shaped end-user-safe, honest tail, no internal leak), ABSTAINS on
// non-questions and low-confidence (never fabricates a #1), never double-answers, never answers a
// human-answered thread, marks the thread "Answered by ARIA", and queues strong Q&A for human curation
// (never auto-publishes to the KB). The full sweep is idempotent.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assessThread, botPost, humanAnswered, ariaAnswered, HONEST_TAIL, BOT_LABEL } from "../assets/forums-concierge.mjs";
import { isEndUserSafe } from "../assets/kb-answer-shape.mjs";
import { runConcierge } from "../netlify/functions/forums-concierge-cron.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => readFileSync(path.join(root, p), "utf8");
const kb = JSON.parse(rd("assets/aria-kb-chunks.json"));
const chunks = kb.chunks || [];

const helpThread = () => ({ id: "t-print", title: "Printer says offline and won't print", ts: 1,
  posts: [{ id: "p1", author: { id: "u1", name: "sam", verified: false }, body: "my printer shows offline in Windows and the job is stuck in the queue — how do I fix it?", ts: 1, voters: {} }] });

// 1 — a REAL help post is answerable with a shaped, safe, honest answer.
const a = assessThread(helpThread(), chunks);
assert.equal(a.eligible, true);
assert.equal(a.abstain, false, "a confident KB match must not abstain");
assert.ok(a.answer && a.answer.length > 40, "an answer is produced");
assert.ok(isEndUserSafe(a.answer), "auto-answer is end-user-safe (no internal notes / registry)");
assert.ok(a.answer.includes(HONEST_TAIL) || a.answer.includes("ARIA auto-answer"), "carries the honest tail");
assert.ok(/Source: IIS KB/.test(a.answer), "cites the real KB source");
assert.ok(a.articleSlug && kb.chunks.some((c) => c.slug === a.articleSlug), "answer traces to a real KB slug");
assert.ok(!/Internal Technician Notes|net stop spooler|HKLM\\/i.test(a.answer), "no internal/registry content in the answer");

// 2 — Rule 14 abstain: gibberish never fabricates an answer.
const gib = { id: "t-gib", title: "zzxqv flurbozzle", posts: [{ id: "p1", author: { name: "x" }, body: "quantum spaghetti wobble zzxqv nothing real here at all", ts: 1 }] };
const g = assessThread(gib, chunks);
assert.equal(g.abstain, true, "below the floor -> abstain");
assert.equal(g.answer, null, "no fabricated answer");

// 3 — non-question / greeting is not answered.
const greet = { id: "t-hi", title: "hi", posts: [{ id: "p1", author: { name: "x" }, body: "hello", ts: 1 }] };
const gr = assessThread(greet, chunks);
assert.ok(gr.answer == null, "greetings get no auto-answer");

// 4 — never double-answer: a thread ARIA already answered is skipped.
const answered = helpThread();
answered.posts.push(botPost("prior answer", 2));
answered.ariaAnswered = true;
assert.equal(ariaAnswered(answered), true);
const d = assessThread(answered, chunks);
assert.equal(d.answer, null, "no second answer");
assert.equal(d.skipReason, "aria-already-answered");

// 5 — never answer a HUMAN-answered thread.
const humanReplied = helpThread();
humanReplied.posts.push({ id: "p2", author: { id: "u2", name: "tech", verified: true }, body: "restart the spooler service", ts: 3 });
assert.equal(humanAnswered(humanReplied), true);
assert.equal(assessThread(humanReplied, chunks).skipReason, "human-answered");

// 6 — full sweep against an in-memory store: answers once, marks the thread, and is idempotent.
function memStore() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; }, async setJSON(k, v) { m.set(k, JSON.stringify(v)); } };
}
const s = memStore();
await s.setJSON("thread-t-print", helpThread());
await s.setJSON("threads-index-v1", { ids: ["t-print"] });
const sum1 = await runConcierge(s, chunks, { now: 1000, cfg: { conciergeEnabled: true } });
assert.equal(sum1.answered, 1, "the sweep answers the help post once");
const t1 = await s.get("thread-t-print");
assert.equal(t1.ariaAnswered, true, "thread marked answered by ARIA");
const bot = t1.posts.find((p) => p.bot);
assert.ok(bot && bot.author.name === "ARIA" && bot.botLabel === BOT_LABEL, "posted as a clearly-labelled bot");
assert.ok(isEndUserSafe(bot.body), "posted answer is end-user-safe");
const sum2 = await runConcierge(s, chunks, { now: 2000, cfg: { conciergeEnabled: true } });
assert.equal(sum2.answered, 0, "idempotent — never double-answers on re-run");

// 7 — concierge OFF toggle: no answers posted.
const s2 = memStore();
await s2.setJSON("thread-t2", helpThread());
await s2.setJSON("threads-index-v1", { ids: ["t2"] });
const sumOff = await runConcierge(s2, chunks, { now: 3000, cfg: { conciergeEnabled: false } });
assert.equal(sumOff.answered, 0, "disabled concierge posts nothing");

// 8 — curation queue receives strong Q&A but the KB is NOT auto-published.
const s3 = memStore();
await s3.setJSON("thread-t3", helpThread());
await s3.setJSON("threads-index-v1", { ids: ["t3"] });
await runConcierge(s3, chunks, { now: 4000, cfg: { conciergeEnabled: true } });
const curation = await s3.get("forums-curation-v1");
assert.ok(Array.isArray(curation) && curation.length >= 1 && curation[0].reviewed === false, "strong Q&A queued for human review (not auto-published)");

// 9 — $0: no paid LLM/API in the concierge path.
const src = rd("assets/forums-concierge.mjs");
assert.ok(!/\banthropic\b|\bopenai\b|api\.anthropic|fetch\s*\(/i.test(src), "concierge is KB + brain only ($0, no paid API call)");

console.log("forums-concierge test passed (real-KB answer · honest abstain · no double-answer · human-answered respected · sweep idempotent · toggle · curation-not-autopublished · $0).");
