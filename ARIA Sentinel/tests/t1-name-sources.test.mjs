// t1-name-sources.test.mjs — RUN-T T1 exit criteria, test-locked.
// The source list renders from recorded facts only; every excluded source is named with its reason;
// no source implies scraping, payment or a rules violation; unknown yields render as `not established`;
// ranked by speed to a real conversation rather than by list size.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSourceList, sourceListMarkdown, sourceListIsMomentumSafe,
  NAME_SOURCES_SCHEMA, SOURCES, SOURCE_KEYS, EXCLUDED_SOURCES, EXCLUDED_KEYS,
  IS_NOT, RANKING_NOTE, PRIVACY_NOTE, WARMTH,
  SENT, HAS_TRANSPORT, PERSISTS, COSTS_MONEY, SCRAPES, HOLDS_REAL_NAMES, UNKNOWN,
} from "../src/shared/name-sources.mjs";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const SRC = "src/shared/name-sources.mjs";

test("T1: the list renders from recorded facts and states what it is NOT", () => {
  const list = buildSourceList({}, { now: NOW });
  assert.equal(list.schema, NAME_SOURCES_SCHEMA);
  assert.equal(list.sources.length, SOURCES.length);
  assert.ok(list.sources.length > 0, "there is at least one usable free source");

  // Every source carries all four recorded facts. A source missing one is a source nobody thought about.
  for (const s of list.sources) {
    for (const field of ["label", "canSupply", "cannotSupply", "firstMove"]) {
      assert.equal(typeof s[field], "string", `${s.key}.${field} is a string`);
      assert.ok(s[field].trim().length > 20, `${s.key}.${field} says something real`);
    }
  }

  // It says what it is not, by name, because that is what it will be mistaken for.
  const md = sourceListMarkdown(list);
  for (const phrase of ["not a lead database", "not a scraper", "not a purchased or rented list"]) {
    assert.ok(IS_NOT.some((n) => n.includes(phrase.replace("not a ", "").slice(0, 10))), `IS_NOT covers "${phrase}"`);
    assert.ok(md.toLowerCase().includes(phrase), `the rendered list says "${phrase}"`);
  }
});

test("T1: an unknown yield renders as `not established`, never as a number", () => {
  const list = buildSourceList({}, { now: NOW });
  assert.equal(list.workedCount, 0, "nothing has been worked yet - that is the honest state");

  for (const s of list.sources) {
    assert.equal(s.observedCandidates, null, `${s.key} has no invented yield`);
    assert.ok(s.yieldStatement.includes(UNKNOWN), `${s.key} says "${UNKNOWN}" out loud`);
    assert.ok(!/\b\d+ candidate/.test(s.yieldStatement), `${s.key} states no candidate number nobody measured`);
  }
  assert.ok(sourceListMarkdown(list).includes(UNKNOWN));
});

test("T1: a REAL observed yield renders as the number, and only where one was observed", () => {
  const list = buildSourceList({
    observed: { "people-already-known": { candidates: 3, hours: 1 } },
  }, { now: NOW });

  const worked = list.sources.find((s) => s.key === "people-already-known");
  assert.equal(worked.observedCandidates, 3);
  assert.equal(worked.observedHours, 1);
  assert.ok(worked.yieldStatement.includes("3 candidate(s)"));
  assert.ok(!worked.yieldStatement.includes(UNKNOWN), "a measured yield does not also claim to be unknown");

  // Every OTHER source is untouched and still unknown. One measurement does not colour the list.
  for (const s of list.sources.filter((x) => x.key !== "people-already-known")) {
    assert.equal(s.observedCandidates, null);
    assert.ok(s.yieldStatement.includes(UNKNOWN));
  }
  assert.equal(list.workedCount, 1);
  assert.ok(list.statement.includes("1 of"));

  // Garbage is not a measurement. A non-number never becomes a yield.
  const junk = buildSourceList({ observed: { introductions: { candidates: "lots" } } }, { now: NOW });
  assert.equal(junk.sources.find((s) => s.key === "introductions").observedCandidates, null);
});

test("T1: every excluded source is named WITH its reason, and never quietly dropped", () => {
  const list = buildSourceList({}, { now: NOW });
  assert.ok(EXCLUDED_SOURCES.length >= 5, "the excluded list is not a token gesture");

  const md = sourceListMarkdown(list);
  for (const e of EXCLUDED_SOURCES) {
    assert.ok(e.label && e.label.trim().length > 10, `${e.key} is named`);
    assert.ok(e.reason && e.reason.trim().length > 20, `${e.key} states WHY`);
    assert.ok(["cost", "rules", "cost-and-consent"].includes(e.violates), `${e.key} says what it violates`);
    assert.ok(md.includes(e.label), `${e.key} appears in the rendered list`);
    assert.ok(md.includes(e.reason), `${e.key}'s reason appears verbatim - not summarised away`);
  }

  // The three that will be proposed again next cycle are excluded BY NAME.
  for (const key of ["paid-lead-database", "paid-enrichment", "scraped-professional-network"]) {
    assert.ok(EXCLUDED_KEYS.includes(key), `${key} is excluded by name`);
  }
  // And none of them leaked into the usable list.
  for (const key of EXCLUDED_KEYS) {
    assert.ok(!SOURCE_KEYS.includes(key), `${key} is not also offered as usable`);
  }
});

test("T1: no usable source costs money, scrapes, or requires a rules violation", () => {
  const list = buildSourceList({}, { now: NOW });
  assert.equal(list.costsMoney, false);
  assert.equal(list.scrapes, false);
  assert.equal(COSTS_MONEY, false);
  assert.equal(SCRAPES, false);

  for (const s of list.sources) {
    assert.equal(s.costs, false, `${s.key} costs nothing`);
    assert.equal(s.scrapes, false, `${s.key} scrapes nothing`);
  }

  // No usable source's own words imply the excluded pattern.
  const usableText = list.sources
    .map((s) => `${s.label} ${s.canSupply} ${s.firstMove}`)
    .join(" ")
    .toLowerCase();
  for (const bad of ["scrape", "scraping", "purchase a list", "buy a list", "enrichment credit", "subscription"]) {
    assert.ok(!usableText.includes(bad), `no usable source implies "${bad}"`);
  }
});

test("T1: ranked by speed to a conversation - list size is not an input, and it says so", () => {
  const list = buildSourceList({}, { now: NOW });

  // Monotonic by warmth, never by anything else.
  const ranks = list.sources.map((s) => s.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "ordered by warmth rank");

  // The warmest source is someone already known - not the biggest pool.
  assert.equal(list.sources[0].key, "people-already-known");
  assert.equal(list.sources[0].warmth, "already-know-them");
  assert.equal(WARMTH["already-know-them"], 1);
  assert.ok(WARMTH["never-met"] > WARMTH["same-room-regularly"], "cold ranks worse than same-room");

  // And the ranking rule is stated, not left implied.
  assert.ok(RANKING_NOTE.includes("thousand"), "the ranking note makes the size argument explicitly");
  assert.ok(RANKING_NOTE.includes("List size is not an input"));
  assert.ok(sourceListMarkdown(list).includes(RANKING_NOTE));

  // A source with a huge observed yield still does not out-rank a warmer one.
  const skewed = buildSourceList({
    observed: { "community-and-trade-groups": { candidates: 1000, hours: 1 } },
  }, { now: NOW });
  assert.equal(skewed.sources[0].key, "people-already-known", "1000 recorded names did not reorder the list");
});

test("T1: it holds no real names, states its privacy rule, and wears no momentum language", () => {
  const list = buildSourceList({}, { now: NOW });
  assert.equal(list.holdsRealNames, false);
  assert.equal(HOLDS_REAL_NAMES, false);
  assert.ok(PRIVACY_NOTE.includes("Rule 11"));
  assert.ok(sourceListMarkdown(list).includes(PRIVACY_NOTE));
  assert.equal(sourceListIsMomentumSafe(list), true, "no momentum vocabulary over an unworked list");
  assert.equal(sourceListMarkdown(null), "_no source list_");
});

test("T1: the module sends nothing, persists nothing and reaches nothing", () => {
  const list = buildSourceList({}, { now: NOW });
  assert.equal(list.sent, false);
  assert.equal(list.signed, false);
  assert.equal(list.charged, false);
  assert.equal(list.nothingSent, true);
  assert.equal(SENT, false);
  assert.equal(HAS_TRANSPORT, false);
  assert.equal(PERSISTS, false);

  const src = readFileSync(new URL(`../${SRC}`, import.meta.url), "utf8");
  const body = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  for (const bad of [
    "node:fs", "writeFile", "readFile", "node:http", "fetch(", "XMLHttpRequest",
    "node:child_process", "spawn(", "execSync", "execFile", "process.env",
    "setInterval", "cron", "nodemailer", "sendMail", "smtp",
  ]) {
    assert.ok(!body.includes(bad), `no ${bad} in ${SRC}`);
  }
});
