// conversation-path.test.mjs — RUN-AO / AO2. The route from the first screen to a conversation.
//
// The proof this suite is required to show, and shows below with both halves:
//   RED   — an entry point with no route to a conversation at all; a conversation that sits three
//           clicks away when two is the limit; and the failure this task exists for — a path that
//           terminates in a form that accepts a prospect's typing and delivers it nowhere.
//   GREEN — a one-click and a two-click path, each ending somewhere a human can be reached, plus the
//           real declared entry points walked from disk.
//
// And the honesty half: an entry point that is not on disk is UNCHECKED with a reason and is
// asserted NEVER to be folded into `reachable`.
//
// Run: node tests/conversation-path.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  walkToConversation, walkAllConversationPaths, isConversationHref,
  directChannelReachable, hasDeliveryTarget,
  VERDICT, CLASSES, MAX_CLICKS, CONVERSATION_PATH_SCHEMA, SENDS, WRITES,
} = await import(new URL("../scripts/lib/conversation-path.mjs", import.meta.url).href);

const { CUSTOMER_ENTRY_POINTS } =
  await import(new URL("../scripts/lib/customer-link-graph.mjs", import.meta.url).href);

function fixture(files) {
  const dir = makeScratchDir("ao2-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

const html = (body) => `<!doctype html><html><body>${body}</body></html>`;

test("AO2 — the module is pure and declares its click budget", () => {
  assert.equal(SENDS, false);
  assert.equal(WRITES, false);
  assert.equal(MAX_CLICKS, 2);
  assert.equal(CONVERSATION_PATH_SCHEMA, "conversation-path.v1");
});

test("AO2 RED — an entry point with no route to a conversation fails as no-path", () => {
  const dir = fixture({
    "index.html": html(`<a href="/about.html">About</a><a href="/terms.html">Terms</a>`),
    "about.html": html(`<p>About us.</p>`),
    "terms.html": html(`<p>Terms.</p>`),
  });
  const r = walkToConversation("index.html", { root: dir });
  assert.equal(r.verdict, VERDICT.BROKEN);
  assert.equal(r.class, CLASSES.NO_PATH);
  assert.match(r.detail, /within 2 clicks/);
});

test("AO2 RED — a conversation three clicks away fails; the same site passes at a budget of three", () => {
  const dir = fixture({
    "index.html": html(`<a href="/one.html">One</a>`),
    "one.html": html(`<a href="/two.html">Two</a>`),
    "two.html": html(`<a href="/contact.html">Contact</a>`),
    "contact.html": html(`<form action="/api/contact"><input name="email"></form>`),
  });
  const tooFar = walkToConversation("index.html", { root: dir });
  assert.equal(tooFar.verdict, VERDICT.BROKEN);
  assert.equal(tooFar.class, CLASSES.NO_PATH);

  const withBudget = walkToConversation("index.html", { root: dir, maxClicks: 3 });
  assert.equal(withBudget.verdict, VERDICT.OK, JSON.stringify(withBudget));
  assert.equal(withBudget.clicks, 3);
});

test("AO2 RED — a path terminating in a form with no delivery target is a dead end, not a pass", () => {
  const dir = fixture({
    "index.html": html(`<a href="/contact.html">Talk to us</a>`),
    "contact.html": html(`<h1>Contact</h1><form><input name="email"><button>Send</button></form>`),
  });
  const r = walkToConversation("index.html", { root: dir });
  assert.equal(r.verdict, VERDICT.BROKEN);
  assert.equal(r.class, CLASSES.DEAD_END_FORM);
  assert.match(r.detail, /no delivery target/);
  assert.ok(Array.isArray(r.deadEnds) && r.deadEnds.length >= 1);
});

test("AO2 RED — a channel scheme with nothing behind it is a dead end", () => {
  const dir = fixture({ "index.html": html(`<a href="mailto:">Email us</a><a href="tel:">Call</a>`) });
  const r = walkToConversation("index.html", { root: dir });
  assert.equal(r.verdict, VERDICT.BROKEN);
  assert.equal(r.class, CLASSES.DEAD_END_FORM);
  assert.equal(directChannelReachable("mailto:"), false);
  assert.equal(directChannelReachable("tel:"), false);
  assert.equal(directChannelReachable("mailto:ahmad.wasee@iisupp.net"), true);
  assert.equal(directChannelReachable("tel:+16475813182"), true);
});

test("AO2 GREEN — a direct channel one click from the first screen passes and names the click count", () => {
  const dir = fixture({ "index.html": html(`<a href="mailto:ahmad.wasee@iisupp.net">Direct email access</a>`) });
  const r = walkToConversation("index.html", { root: dir });
  assert.equal(r.verdict, VERDICT.OK);
  assert.equal(r.class, CLASSES.REACHABLE);
  assert.equal(r.clicks, 1);
});

test("AO2 GREEN — a two-click path ending in a form that declares delivery passes", () => {
  const dir = fixture({
    "index.html": html(`<a href="/services.html">Services</a>`),
    "services.html": html(`<a href="/book.html">Book a consultation</a>`),
    "book.html": html(`<form data-netlify="true"><input name="email"></form>`),
  });
  const r = walkToConversation("index.html", { root: dir });
  assert.equal(r.verdict, VERDICT.OK, JSON.stringify(r));
  assert.equal(r.clicks, 2);
  assert.deepEqual(r.path, ["index.html", "/services.html", "/book.html"]);
});

test("AO2 — delivery evidence is read from disk, not assumed from the presence of a form", () => {
  assert.equal(hasDeliveryTarget(`<form><input name="a"></form>`), false);
  assert.equal(hasDeliveryTarget(`<form action="#"><input name="a"></form>`), false);
  assert.equal(hasDeliveryTarget(`<form action="/api/contact"><input name="a"></form>`), true);
  assert.equal(hasDeliveryTarget(`<form data-netlify="true"><input name="a"></form>`), true);
  assert.equal(hasDeliveryTarget(`<p>Email <a href="mailto:ahmad.wasee@iisupp.net">us</a></p>`), true);
  assert.equal(hasDeliveryTarget(`<p>Nothing here.</p>`), false);
});

test("AO2 — what counts as a conversation route is a declared list, not a guess", () => {
  for (const h of ["mailto:a@b.co", "tel:+16475813182", "/contact.html", "/book.html", "/start-here.html", "/health-check.html"]) {
    assert.ok(isConversationHref(h), `${h} should count as a conversation route`);
  }
  for (const h of ["/terms.html", "/about.html", "/shop.html"]) {
    assert.ok(!isConversationHref(h), `${h} should not count as a conversation route`);
  }
});

test("AO2 HONESTY — an entry point not on disk is UNCHECKED and never counted as reachable", () => {
  const dir = fixture({ "index.html": html(`<a href="mailto:a@b.co">Email</a>`) });
  const out = walkAllConversationPaths({ root: dir, entryPoints: ["index.html", "gone.html"] });
  assert.equal(out.summary.entryPoints, 2);
  assert.equal(out.summary.reachable, 1);
  assert.equal(out.summary.unchecked, 1);
  assert.equal(out.unchecked[0].class, CLASSES.NO_FILE);
  assert.notEqual(out.summary.reachable, out.summary.entryPoints);
  assert.match(out.summary.note, /never folded/i);
});

test("AO2 GREEN — the real declared entry points are walked, each landing in exactly one bucket", () => {
  const out = walkAllConversationPaths({ root: ROOT, entryPoints: CUSTOMER_ENTRY_POINTS });
  assert.equal(out.schema, CONVERSATION_PATH_SCHEMA);
  assert.equal(
    out.summary.reachable + out.summary.broken + out.summary.unchecked,
    out.summary.entryPoints,
  );
  for (const r of out.results) {
    assert.ok(typeof r.class === "string" && r.class.length > 0, `${r.file} produced no class`);
    assert.ok(typeof r.detail === "string" && r.detail.length > 0, `${r.file} produced no detail`);
    if (r.verdict === VERDICT.OK) assert.ok(r.clicks >= 1 && r.clicks <= MAX_CLICKS);
  }
  console.log(`AO2 conversation paths — ${out.summary.reachable} reachable within ${MAX_CLICKS} clicks · ${out.summary.broken} with no reachable path · ${out.summary.unchecked} unchecked (never counted as reachable)`);
  for (const r of out.broken) console.log(`  ${r.file} — ${r.class}: ${r.detail}`);
});

test("AO2 — the homepage can reach a human within two clicks", () => {
  const r = walkToConversation("index.html", { root: ROOT });
  assert.notEqual(r.verdict, VERDICT.BROKEN,
    `the homepage has no reachable conversation: ${r.class} — ${r.detail}`);
});
