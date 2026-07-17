#!/usr/bin/env node
// FORUMS — KNOWLEDGE COMMONS contract (2026-07-16). Ahmad chose "1 AND 2": the interactive Solutions
// MVP (forums/index.html) AND the Knowledge Commons (forums/commons.html) both ship. This suite is the
// build gate that protects the LIVE Commons page: WCAG 2.1 AA a11y landmarks + Rule-14 honesty (staged
// "Opening…" boards, never a fabricated member/solution count, no guarantee language) + the two-way
// cross-link so neither surface is a dead end. Static, no network — asserts only what is really shipped.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");

// 0 — both forum surfaces ship (nothing removed — Rule 15).
for (const p of ["forums/index.html", "forums/commons.html"]) {
  assert.ok(existsSync(path.join(root, p)), `${p} must exist (both surfaces kept)`);
}
const commons = read("forums/commons.html");
const mvp = read("forums/index.html");

// 1 — a11y contract (build-blocking): landmarks + labels + a live region + a decorative-graphic hide.
for (const marker of ['lang="en"', 'name="viewport"', '<main id="main"', "<h1", "<header", "<nav", "<footer", 'aria-live="polite"', "aria-hidden"]) {
  assert.ok(commons.includes(marker), `Commons a11y contract: ${marker}`);
}
assert.ok((commons.match(/aria-label=/g) || []).length >= 2, "Commons: navigational regions are labelled");

// 2 — two-way cross-link: neither surface is a dead end (funnel-link-guard also enforces resolution).
assert.ok(/href="\/forums\/commons"/.test(mvp), "MVP page links to the Knowledge Commons");
assert.ok(/href="\/forums\/?"/.test(commons), "Commons links back to the Solutions forum");
assert.ok(/href="\/aria(\.html)?"/.test(commons), "Commons offers the live-ARIA next step (no dead end)");

// 3 — Rule 14 honesty: boards are STAGED, never a fabricated live count.
assert.ok(commons.includes("Opening…"), "boards show the honest staged 'Opening…' state");
assert.ok(/data-count/.test(commons), "board count chips are data-bound, not hardcoded numbers");
// no fabricated community metric anywhere (members / solutions / discussions / experts …).
const fabCount = commons.match(/\b\d[\d,]*\s*\+?\s*(members?|solutions?|discussions?|posts?|threads?|answers?|experts?|users?|machines?)\b/gi) || [];
assert.deepEqual(fabCount, [], `Commons must not fabricate a community count (found: ${fabCount.join(", ")})`);
// no guarantee/risk-free marketing language (standing rule 7).
for (const banned of ["money-back", "risk-free", "guaranteed", "guarantee"]) {
  assert.ok(!new RegExp(banned, "i").test(commons), `Commons must not use "${banned}" language`);
}

// 4 — honest vision + real contact path (staged, not faked).
assert.ok(/Founding members/i.test(commons), "founding-member invite present (staged circles)");
assert.ok(/when profiles arrive/i.test(commons), "founding copy is honest future-tense (badge 'when profiles arrive')");
assert.ok(/mailto:ahmad\.wasee@iisupp\.net/.test(commons), "founding seat routes to the real IIS contact, not a fake signup");
assert.ok(/About this space/i.test(commons), "honest origin/about section present");

// 5 — the interactive MVP still ships its own live machinery (kept — Rule 15).
assert.ok(mvp.includes('role="dialog"') && mvp.includes('role="status"'), "MVP keeps its SSO dialog + status toasts");
assert.ok(mvp.includes("No community solutions yet") || read("assets/forums.js").includes("No community solutions yet"), "MVP keeps its honest empty state");

console.log("forums-commons test passed (both surfaces ship · Commons a11y landmarks + labels · two-way cross-link · staged boards, zero fabricated counts, no guarantee language · honest founding invite + real contact).");
