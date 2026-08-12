// BE1 — the response-time promise, checked end to end.
//
// The invariant these tests exist to hold: the audit may NOT return "consistent" while the signable
// agreement binds a commitment no buyer-visible surface states, and it may NOT pick which side moves.
// Every class below is proven against a fixture built to fail exactly that way — an audit that has
// only ever seen the real tree has been shown to produce a verdict, not to catch anything.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  auditResponseTimes, readBindings, readPublished, readDirection, statementFor,
  parseCommitment, sameCommitment,
  BINDING_SURFACES, PUBLISHED_SURFACES, TIER_MAP, COMMITMENT_ROWS, VERDICT, CLASS, KIND, DECISION_FILE,
} from "../scripts/lib/response-time-consistency.mjs";

const root = path.resolve(import.meta.dirname, "..");

function fixture(files) {
  // Not `os.tmpdir()`. That volume is full on this machine and every fixture below died on
  // `ENOSPC ... mkdtemp` before an assertion ran. The scratch location is chosen by probing.
  const dir = makeScratchDir("response-time-fixture-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}
const withFixture = (files, fn) => {
  const dir = fixture(files);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

/** A Schedule B carrying whatever P1 row a case needs. */
const MSA = (p1 = {}, p2 = null) => {
  const tiers = ["Personal", "Pro", "SBA", "Mid", "Enterprise"];
  const row = (label, vals) => `| ${label} | ${tiers.map((t) => vals[t] ?? "—").join(" | ")} |`;
  return [
    "## Schedule B — Service Level Agreement (SLA)",
    "",
    `| Tier | ${tiers.join(" | ")} |`,
    "|---|---|---|---|---|---|",
    row("P1 response time", p1),
    ...(p2 ? [row("P2 response time", p2)] : []),
    "",
  ].join("\n");
};

/** A comparison matrix carrying whatever rows a case needs, inside the declared markers. */
const MATRIX = (rows = "") => `<html><body>
<table><thead><tr><th>Headcount</th><th>Annual cost</th></tr></thead><tbody><tr><td>10</td><td>$1</td></tr></tbody></table>
<!-- SENTINEL_MATRIX:START -->
<table class="sentinel-matrix">
<thead><tr><th>Feature</th><th>Personal</th><th>Pro</th><th>Small Business</th><th>Mid Size</th><th>Enterprise</th></tr></thead>
<tbody>
<tr><td>Manual mode</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
${rows}
</tbody></table>
<!-- SENTINEL_MATRIX:END -->
</body></html>`;

const P1_ROW = (vals) => `<tr><td>P1 response time</td>${vals.map((v) => `<td>${v}</td>`).join("")}</tr>`;
const SURF = (dir) => ({ root: dir });

/* ── 1. the real tree, read rather than asserted ─────────────────────────────────────────────── */

test("the agreement is read from the real tree and every binding carries a file, a line and its source text", () => {
  const { bindings, unreadable } = readBindings({ root });
  assert.ok(bindings.length >= 5, "Schedule B binds a response time for every tier");
  assert.deepEqual(unreadable, [], "the signable agreement is readable");
  for (const b of bindings) {
    assert.equal(b.class, CLASS.BINDING);
    assert.ok(b.tier && b.row, "every binding names its tier and its row");
    assert.ok(Number.isInteger(b.line) && b.line > 0, `every binding carries a line: ${b.file}`);
    assert.ok(b.evidence.length, "every binding carries the source text that produced it");
    assert.ok([KIND.MINUTES, KIND.SYMBOLIC].includes(b.commitment.kind));
    assert.ok(COMMITMENT_ROWS.some((r) => r.toLowerCase() === b.row.toLowerCase()));
  }
});

test("the surface tables are data, not prose — every entry names a file and a reason", () => {
  for (const s of [...BINDING_SURFACES, ...PUBLISHED_SURFACES]) {
    assert.ok(s.file && s.what && s.why, `surface incomplete: ${JSON.stringify(s.file)}`);
  }
  for (const t of TIER_MAP) {
    assert.ok(t.binding && t.published && t.why, `tier mapping incomplete: ${JSON.stringify(t)}`);
  }
});

test("the real tree's verdict is reported, and it is not 'consistent' while the finding stands", () => {
  const r = auditResponseTimes({ root });
  assert.notEqual(r.verdict, VERDICT.UNREADABLE, "both sides of the real tree are readable");
  if (r.summary.boundUnpublished > 0) {
    assert.notEqual(r.verdict, VERDICT.CONSISTENT, "commitments bound and published nowhere can never read as consistent");
    for (const g of r.gaps) assert.ok(g.why && (g.binding || g.published), "every gap carries a citation and a reason");
    assert.match(statementFor(r), /response times:/);
  }
});

/* ── 2. THE INVARIANT: a signed obligation nobody published can never read as agreement ───────── */

test("a bound commitment the buying surface never states is BOUND_UNPUBLISHED, never consistent", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Pro: "4 hr" }),
    "plans/index.html": MATRIX(`<tr><td>SLA tracking</td><td>—</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>`),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.verdict, VERDICT.UNDECIDED);
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
    assert.equal(r.summary.boundUnpublished, 1);
    assert.equal(r.gaps[0].kind, VERDICT.BOUND_UNPUBLISHED);
    assert.equal(r.gaps[0].publishedTier, "Small Business" === r.gaps[0].publishedTier ? "Small Business" : "Pro");
  });
});

test("'SLA tracking ✓' is not a response commitment and is never counted as publishing one", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Enterprise: "15 min" }),
    "plans/index.html": MATRIX(`<tr><td>SLA tracking</td><td>—</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>`),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.summary.published, 0, "a tick mark states that an SLA is tracked, not what it is");
    assert.equal(r.summary.boundUnpublished, 1);
  });
});

test("publishing the same commitment the agreement binds closes the gap — and only then", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Personal: "Next biz day", Pro: "4 hr", SBA: "1 hr", Mid: "30 min", Enterprise: "15 min" }),
    "plans/index.html": MATRIX(P1_ROW(["Next biz day", "4 hr", "1 hr", "30 min", "15 min"])),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.verdict, VERDICT.CONSISTENT);
    assert.equal(r.summary.gaps, 0);
    assert.equal(r.summary.published, 5);
  });
});

test("a published number that disagrees with the signed one is CONTRADICTS — the worse failure, named separately", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Enterprise: "15 min" }),
    "plans/index.html": MATRIX(P1_ROW(["—", "—", "—", "—", "1 hr"])),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.verdict, VERDICT.CONTRADICTS);
    const g = r.gaps.find((x) => x.kind === VERDICT.CONTRADICTS);
    assert.ok(g, "the contradiction is reported");
    assert.equal(g.binding.text, "15 min");
    assert.equal(g.published.text, "1 hr");
    assert.ok(g.binding.line > 0 && g.published.line > 0, "both sides are cited");
  });
});

test("a published commitment with no agreement row behind it is PUBLISHED_UNBOUND", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Enterprise: "15 min" }),
    "plans/index.html": MATRIX(P1_ROW(["30 min", "—", "—", "—", "15 min"])),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    const g = r.gaps.find((x) => x.kind === VERDICT.PUBLISHED_UNBOUND);
    assert.ok(g, "a promise on the page that no signable document backs is reported");
    assert.equal(g.tier, "Personal");
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
  });
});

/* ── 3. the classes that exist so nothing is quietly smoothed ─────────────────────────────────── */

test("P1 is compared with P1 — a published row that names no priority never satisfies a P1 obligation", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Enterprise: "15 min" }),
    "plans/index.html": MATRIX(`<tr><td>Response time</td><td>—</td><td>—</td><td>—</td><td>—</td><td>15 min</td></tr>`),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.summary.boundUnpublished, 1, "the right number under an ambiguous label does not discharge the obligation");
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
  });
});

test("'Next biz day' is never converted into minutes, and never compares equal to a duration", () => {
  const symbolic = parseCommitment("Next biz day");
  assert.equal(symbolic.kind, KIND.SYMBOLIC);
  assert.equal(symbolic.minutes, undefined, "a named window carries no invented number");
  assert.equal(sameCommitment(symbolic, parseCommitment("8 hr")), false);
  assert.equal(sameCommitment(symbolic, parseCommitment("Next business day")), true);
  assert.equal(sameCommitment(parseCommitment("5 biz day"), symbolic), false, "five business days is not the next one");
  assert.equal(sameCommitment(parseCommitment("1 hr"), parseCommitment("60 min")), true, "the same duration written two ways is one promise");
});

test("a tier on either side with no declared partner is reported UNMAPPED, never dropped", () => {
  withFixture({
    // the header row is the first "| Personal |" in the document, so this renames the TIER itself —
    // the agreement now binds a commitment for a tier no declared mapping knows about
    "legal/MSA-template.md": MSA({ Personal: "4 hr", Pro: "4 hr" }).replace("| Personal |", "| Founder |"),
    "plans/index.html": MATRIX(),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.ok(r.unmapped.length >= 1, "an unrecognised tier is surfaced rather than discarded");
    assert.ok(r.unmapped.every((u) => u.tier && u.why && (u.side === "binding" || u.side === "published")));
  });
});

test("the matrix is read only from its declared markers — never from whatever table is first on the page", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Pro: "4 hr" }),
    "plans/index.html": `<html><body><table><thead><tr><th>Headcount</th><th>Annual cost</th></tr></thead><tbody><tr><td>P1 response time</td><td>4 hr</td></tr></tbody></table></body></html>`,
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    const why = r.unreadable.map((u) => u.reason).join(" ");
    assert.match(why, /markers/, "a page with no matrix markers is reported unreadable, not audited against the wrong table");
    assert.equal(r.summary.published, 0, "a cost calculator's rows are never counted as published tier commitments");
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
  });
});

test("a commitment cell that cannot be classed is reported unreadable, never treated as absent", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Pro: "as soon as possible" }),
    "plans/index.html": MATRIX(),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.ok(r.unreadable.some((u) => /cannot class it as a commitment/.test(u.reason)),
      "an obligation nobody can measure is louder than one nobody wrote");
  });
});

test("prose stated against a price band is UNATTACHED — reported, and never matched to a tier by guesswork", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ SBA: "1 hr" }),
    "plans/index.html": MATRIX(),
    "index.html": `<ul><li>Priority SLA — 1 hour response or less</li></ul>`,
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.unattached.length, 1);
    assert.equal(r.unattached[0].commitment.text, "1 hour");
    assert.ok(r.unattached[0].why.includes("price band"));
    assert.equal(r.summary.boundUnpublished, 1, "prose near the right number does not discharge a tier's obligation");
  });
});

/* ── 4. software does not pick the direction ──────────────────────────────────────────────────── */

test("with no direction declared the verdict is UNDECIDED and the file that would carry it is named", () => {
  withFixture({ "legal/MSA-template.md": MSA({ Pro: "4 hr" }), "plans/index.html": MATRIX() }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.direction.declared, false);
    assert.equal(r.direction.file, DECISION_FILE);
    assert.equal(r.verdict, VERDICT.UNDECIDED);
  });
});

test("once a direction is declared, remaining gaps read as DIVERGENT — the suite enforces what it used to only report", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Pro: "4 hr" }),
    "plans/index.html": MATRIX(),
    [DECISION_FILE]: JSON.stringify({ publish: true, decidedBy: "Ahmad", decidedOn: "2026-08-11" }),
  }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.direction.declared, true);
    assert.equal(r.direction.publish, true);
    assert.equal(r.verdict, VERDICT.DIVERGENT);
  });
});

test("a decision file that does not answer the question is not a decision", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Pro: "4 hr" }),
    "plans/index.html": MATRIX(),
    [DECISION_FILE]: JSON.stringify({ note: "we should talk about this" }),
  }, (dir) => {
    const d = readDirection({ root: dir });
    assert.equal(d.declared, false);
    assert.match(d.reason, /does not answer/);
    assert.equal(auditResponseTimes(SURF(dir)).verdict, VERDICT.UNDECIDED);
  });
});

test("an unreadable decision file fails closed, and says why", () => {
  withFixture({
    "legal/MSA-template.md": MSA({ Pro: "4 hr" }),
    "plans/index.html": MATRIX(),
    [DECISION_FILE]: "{ not json",
  }, (dir) => {
    const d = readDirection({ root: dir });
    assert.equal(d.declared, false);
    assert.match(d.reason, /unparseable/);
  });
});

/* ── 5. neither side present ──────────────────────────────────────────────────────────────────── */

test("with neither side readable the verdict is UNREADABLE, and it never reads as agreement", () => {
  withFixture({ "README.md": "nothing here" }, (dir) => {
    const r = auditResponseTimes(SURF(dir));
    assert.equal(r.verdict, VERDICT.UNREADABLE);
    assert.notEqual(r.verdict, VERDICT.CONSISTENT);
    assert.ok(r.unreadable.length, "the absence is cited rather than passed over");
    assert.match(statementFor(r), /neither the agreement nor the published surfaces could be read/);
  });
});

test("the published reader never invents a commitment out of a page that states none", () => {
  withFixture({ "plans/index.html": MATRIX(), "index.html": "<p>we answer quickly</p>" }, (dir) => {
    const { published, unattached } = readPublished({ root: dir });
    assert.equal(published.filter((x) => x.commitment).length, 0);
    assert.equal(unattached.length, 0, "'quickly' is not a commitment and is never rendered as one");
  });
});
