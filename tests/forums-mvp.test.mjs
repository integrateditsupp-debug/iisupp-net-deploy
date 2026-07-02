#!/usr/bin/env node
// FORUMS MVP — build gates: the Solutions retriever runs on the REAL KB with the site's abstain
// threshold (never a fabricated #1); the discussions store core is validated pure (no fake
// counts, author-only accept, idempotent votes, HTML escaped); the page ships the a11y
// contract (build-blocking) and zero fabricated content; tokens are the only hex source.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import { toDoc, retrieve, scoreDoc, normalizeConfidence, confidenceBand, summarize, ABSTAIN_THRESHOLD, parseFrontmatter } from "../assets/forums-retriever.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");

// 0 — every shipped artifact exists.
for (const p of ["forums/index.html", "assets/forums-tokens.css", "assets/forums.css", "assets/forums.js", "assets/forums-retriever.mjs", "netlify/functions/forums-threads.js"]) {
  assert.ok(existsSync(path.join(root, p)), `${p} must exist`);
}

// 1 — retriever on the REAL KB (203 chunks): a real query matches confidently and honestly.
const rawJson = JSON.parse(read("assets/aria-kb-chunks.json"));
const raw = Array.isArray(rawJson) ? rawJson : rawJson.chunks || [];
const docs = raw.map(toDoc);
assert.ok(docs.length >= 150, `real KB expected (got ${docs.length} docs)`);
assert.ok(docs.every((d) => d.title && d.title.length > 3), "every doc gets a real title (frontmatter fallback)");

const hit = retrieve("bluetooth device won't pair and keeps disconnecting", docs);
assert.equal(hit.abstain, false, "a real KB topic must match");
assert.ok(hit.confidence.raw >= ABSTAIN_THRESHOLD);
assert.equal(hit.confidence.value, normalizeConfidence(hit.confidence.raw), "displayed confidence IS the documented normalization of the raw score");
assert.ok(hit.confidence.value > 0 && hit.confidence.value <= 100);
assert.ok(hit.results.length >= 1 && hit.results.every((r, i, a) => i === 0 || a[i - 1].score >= r.score), "results sorted by real score");
assert.ok(hit.confidence.sources >= 1, "sources count is the real number of above-threshold docs");

// 2 — Rule 14 abstain: gibberish never fabricates a #1.
const miss = retrieve("zzxqv flurbozzle quantum spaghetti", docs);
assert.equal(miss.abstain, true);
assert.equal(confidenceBand(miss.confidence.raw), "low");

// normalization is monotone and bounded (real, not decorative).
assert.equal(normalizeConfidence(0), 0);
let prev = -1;
for (const rawScore of [1, 4, 8, 12, 20, 30, 60]) {
  const v = normalizeConfidence(rawScore);
  assert.ok(v > prev && v <= 100, "monotone");
  prev = v;
}
// summarize returns real prose from a real doc.
assert.ok(summarize(hit.results[0].doc).length > 30);
// frontmatter parser reads the real chunk format.
const fm = parseFrontmatter(raw[0].content);
assert.ok(fm.title && fm.category, "frontmatter title+category parse");
// community docs join ranked results with a deep link.
const grad = [{ slug: "t-1", title: "bluetooth pairing fails only on RSA laptops", category: "community", keywords: ["bluetooth"], body: "accepted community fix for bluetooth pairing disconnect", sourceType: "discussion", deepLink: "#thread/t-1?post=p-2" }];
const mixed = retrieve("bluetooth pairing", docs, { topK: 6, communityDocs: grad });
assert.ok(mixed.results.some((r) => r.doc.sourceType === "discussion" && r.doc.deepLink.includes("?post=")), "discussion-sourced results carry the exact-post deep link");

// 3 — discussions store pure core (no I/O).
const require_ = createRequire(import.meta.url);
const { _core } = require_(path.join(root, "netlify/functions/forums-threads.js"));
const NOW = 1_760_000_000_000;
let r = _core.newThread({ title: "Outlook profile re-locks after VPN reconnect", body: "Since the update it hangs on <script>alert(1)</script> loading profile", tags: ["outlook", "vpn"], email: "dana@company.com" }, NOW);
assert.equal(r.ok, true, (r.errors || []).join("; "));
assert.ok(!r.thread.posts[0].body.includes("<script>"), "HTML is escaped at the store boundary");
assert.equal(r.thread.posts[0].author.name, "dana", "author = email local-part, never invented");
assert.equal(r.thread.acceptedPostId, null);
assert.equal(r.thread.graduated, false);
assert.equal(_core.newThread({ title: "short", body: "x", email: "nope" }, NOW).ok, false, "bad input rejected");

let t = r.thread;
t = _core.addReply(t, { body: "Exclude outlook.exe from the client scan.", email: "sam@corp.io" }, NOW + 1000).thread;
assert.equal(_core.listRow(t).replies, 1, "reply count = real posts - 1");
// votes: one per voter, revote overwrites (never inflates).
const pid = t.posts[1].id;
t = _core.applyVote(t, { postId: pid, dir: "up", email: "v1@x.io" }).thread;
t = _core.applyVote(t, { postId: pid, dir: "up", email: "v1@x.io" }).thread;
t = _core.applyVote(t, { postId: pid, dir: "up", email: "v2@x.io" }).thread;
assert.equal(_core.voteCount(t.posts[1]), 2, "same voter can never double-count");
t = _core.applyVote(t, { postId: pid, dir: "down", email: "v2@x.io" }).thread;
assert.equal(_core.voteCount(t.posts[1]), 0, "revote overwrites");
// accept: author-only; accepting graduates (two-way Solutions backlink).
assert.equal(_core.acceptPost(t, { postId: pid, email: "sam@corp.io" }).ok, false, "only the OP accepts");
const acc = _core.acceptPost(t, { postId: pid, email: "dana@company.com" });
assert.equal(acc.ok, true);
assert.equal(acc.thread.graduated, true);
assert.equal(acc.thread.acceptedPostId, pid);
const pub = _core.publicThread(acc.thread);
assert.ok(pub.posts.find((p) => p.id === pid).accepted);
assert.ok(!JSON.stringify(pub).includes("@company.com"), "raw emails never leave the store");

// 4 — a11y contract (WCAG 2.1 AA — build-blocking) + honest UI.
const html = read("forums/index.html");
for (const marker of ['lang="en"', 'name="viewport"', 'aria-live="polite"', 'role="status"', 'role="dialog"', 'aria-modal="true"', "data-nav", 'aria-label="Sections (mobile)"', "prefers-reduced-motion"]) {
  const hay = marker === "prefers-reduced-motion" ? read("assets/forums-tokens.css") : html;
  assert.ok(hay.includes(marker), `a11y contract: ${marker}`);
}
assert.ok((html.match(/aria-label=/g) || []).length >= 8, "inputs/regions labelled");
// honest empty states + honest vision state present; no mockup sample data, no fabricated metrics.
for (const copy of ["No community solutions yet", "No discussions yet", "we won't guess", "Visual diagnosis coming online", "never invented"]) {
  const inHtml = html.includes(copy) || read("assets/forums.js").includes(copy);
  assert.ok(inHtml, `honest copy present: "${copy}"`);
}
const js = read("assets/forums.js");
for (const forbidden of ["@dan", "@maria", "sample-tag", "Confirmed on 14 machines", "DPC_WATCHDOG"]) {
  assert.ok(!html.includes(forbidden) && !js.includes(forbidden), `mockup sample content must not ship: ${forbidden}`);
}
for (const fabricated of ["100%", "$0"]) {
  assert.ok(!html.includes(fabricated) && !js.includes(fabricated), `fabricated-metric guard: ${fabricated}`);
}
assert.ok(html.includes('id="kbCount">--<'), "KB count renders -- until the real KB loads");

// 5 — one token file: no hex literals outside forums-tokens.css.
for (const p of ["forums/index.html", "assets/forums.css", "assets/forums.js", "assets/forums-retriever.mjs"]) {
  const hex = read(p).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], `${p} must not hardcode hex (found ${hex.join(",")})`);
}

// 6 — routing shipped: /forums serves the page; store function reachable path in JS.
const toml = read("netlify.toml");
assert.ok(toml.includes('from = "/forums"'), "netlify.toml /forums route");
assert.ok(js.includes("/.netlify/functions/forums-threads"));
assert.ok(js.includes("aria_session_email"), "reuses the existing IIS session key");
assert.ok(js.includes("aria-magic-link"), "reuses the existing sign-in flow");

console.log(`forums-mvp test passed (real-KB retrieval ${docs.length} docs · abstain honest · store core sound · a11y contract · zero fabricated content · tokens-only hex).`);
