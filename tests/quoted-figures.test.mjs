// AV2 — every money figure a client can read, reconciled.
//
// The three states this suite exists to keep apart: PUBLISHED (a client can check it), DECLARED (a
// person consciously put it outside the plan table and wrote why), SILENT (nobody has ever accounted
// for it). Plus the one that is neither and is worse than all of them: a second price for a plan the
// company publishes.
//
// Every class is proven against a fixture built to fail exactly that way.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  reconcileQuotedFigures, collectFigures, readFigureDeclarations, statementFor, normalizeMoney,
  CLASS, CONTRADICTION, CLIENT_FACING_DIRS, DECLARATIONS_FILE,
} from "../scripts/lib/quoted-figures.mjs";

const root = path.resolve(import.meta.dirname, "..");

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quoted-figures-"));
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

/** A plan page carrying one published price, in the shape readPricingSources + publishedMoney read. */
const PLANS = (rows = [["Personal", "$899/mo"]]) =>
  `<html><body><table><thead><tr><th>Plan</th>${rows.map((r) => `<th>${r[0]}</th>`).join("")}</tr></thead>` +
  `<tr class="price-row"><td>Price</td>${rows.map((r) => `<td>${r[1]}</td>`).join("")}</tr></table></body></html>`;

const REGISTER = (rows) =>
  "# register\n\n| figure | where | why |\n|---|---|---|\n" +
  rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join("\n") + "\n";

/* ── 1. the failure the whole thing exists to catch ──────────────────────────────────────────── */

test("a figure that is neither published nor declared is SILENT, and silent fails", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "Implementation fee: $5,000 one-time.\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.silent, 1);
    assert.equal(r.summary.ok, false);
    assert.equal(r.silent[0].found, "$5,000");
    assert.equal(r.silent[0].file, "legal/MSA-template.md");
    assert.ok(r.silent[0].line > 0, "a silent figure carries its line, not just its file");
  });
});

test("the statement names the silent figures with file and line — a count is not actionable", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "Implementation fee: $5,000 one-time.\n",
  }, (dir) => {
    const line = statementFor(reconcileQuotedFigures({ root: dir, dirs: ["legal"] }));
    assert.match(line, /\$5,000/);
    assert.match(line, /legal\/MSA-template\.md:1/);
  });
});

test("a published figure needs no declaration", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "Personal is $899/mo.\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.published, 1);
    assert.equal(r.summary.silent, 0);
    assert.equal(r.summary.ok, true);
  });
});

test("a declared figure with a real reason clears, and the report says WHERE it was declared", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "Implementation fee: $5,000 one-time.\n",
    [DECLARATIONS_FILE]: REGISTER([["$5,000", "legal/MSA-template.md:1", "a one-time professional-services fee, not a plan price"]]),
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.silent, 0);
    assert.equal(r.summary.declared, 1);
    assert.equal(r.summary.ok, true);
    assert.match(r.figures[0].declaredBy, /QUOTED-FIGURES\.md:\d+/);
  });
});

/* ── 2. the register cannot be used as a rubber stamp ────────────────────────────────────────── */

for (const empty of ["", "n/a", "TBD", "todo", "-", "declared", "see above"]) {
  test(`a declaration whose reason is ${JSON.stringify(empty) || "blank"} is REFUSED, and the figure stays silent`, () => {
    withFixture({
      "plans/index.html": PLANS(),
      "legal/MSA-template.md": "Implementation fee: $5,000 one-time.\n",
      [DECLARATIONS_FILE]: REGISTER([["$5,000", "legal/MSA-template.md:1", empty]]),
    }, (dir) => {
      const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
      assert.equal(r.summary.silent, 1, "a refused declaration does not cover its figure");
      assert.equal(r.summary.ok, false);
      if (empty) assert.equal(r.summary.refusedDeclarations, 1);
    });
  });
}

test("a declaration whose reason merely restates the figure is refused", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "Implementation fee: $5,000 one-time.\n",
    [DECLARATIONS_FILE]: REGISTER([["$5,000", "legal/MSA-template.md:1", "$5,000"]]),
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.refusedDeclarations, 1);
    assert.equal(r.summary.silent, 1);
  });
});

test("a declaration matching nothing in the tree is STALE — the register cannot rot", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "no money here\n",
    [DECLARATIONS_FILE]: REGISTER([["$5,000", "legal/MSA-template.md:1", "a fee we stopped quoting last year"]]),
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.stale, 1);
    assert.equal(r.stale[0].figure, "$5,000");
  });
});

test("one row may account for several figures that share a reason, and covers only the ones it names", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "A hire costs $60K-$95K/yr. A contractor costs $3K.\n",
    [DECLARATIONS_FILE]: REGISTER([["$60K `$95K`", "legal/MSA-template.md:1", "the salary band a buyer is comparing us against"]]),
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.declared, 2, "both figures on the row are covered");
    assert.equal(r.summary.silent, 1, "the figure the row does not name is still silent");
    assert.equal(r.silent[0].found, "$3K");
  });
});

/* ── 3. a second price for a published plan is its own, louder finding ───────────────────────── */

test("a plan the company publishes, quoted at a different amount, is a CONTRADICTION with both citations", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/one-pager.md": "| **Personal** | **$599 / mo** | 1 user |\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.contradictions, 1);
    const c = r.contradictions[0];
    assert.equal(c.plan, "Personal");
    assert.equal(c.publishedAmount, 899);
    assert.equal(c.file, "legal/one-pager.md");
    assert.ok(c.line > 0 && c.publishedAt.includes("plans/index.html"), "both sides are citable");
    assert.match(statementFor(r), /Personal \$599 at legal\/one-pager\.md:\d+ vs \$899/);
  });
});

test("a contradiction is not silent — it is accounted for in its own class, never smoothed away", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/one-pager.md": "| **Personal** | **$599 / mo** | 1 user |\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.silent, 0);
    assert.equal(r.summary.contradictory, 1);
    assert.equal(r.figures.find((f) => f.found === "$599").class, CONTRADICTION);
  });
});

test("the same monthly price stated annually is arithmetic, not a second price", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/one-pager.md": "| **Personal** | **$10,788 / yr** | 1 user |\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.contradictions, 0, "899 x 12 is the same price");
  });
});

test("a plan name used as an adjective beside an unrelated figure is NOT a contradiction", () => {
  withFixture({
    "plans/index.html": PLANS([["Enterprise", "$78,125/mo"]]),
    "legal/dpa.md": "- SOC 2 Type II audit planned upon first $625K+ enterprise contract execution.\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.contradictions, 0,
      "a threshold sentence containing the word enterprise is not a price for the Enterprise plan");
  });
});

test("a competitor comparison on the same line as our price is not a contradiction", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/one-pager.md": "- **Personal $899/mo** vs. a call-out ($150-$300) twice a month.\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.contradictions, 0);
  });
});

test("plan names are matched with punctuation collapsed — a hyphen does not hide a second price", () => {
  withFixture({
    "plans/index.html": PLANS([["Mid Size", "$39,000/mo"]]),
    "legal/one-pager.md": "| **Mid-Size** | **$312K / yr** | fleet |\n",
  }, (dir) => {
    const r = reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.equal(r.summary.contradictions, 1);
    assert.equal(r.contradictions[0].plan, "Mid Size");
  });
});

/* ── 4. the collector reads the figure it reports ────────────────────────────────────────────── */

test("a decimal-and-suffix figure is collected whole — $937.5K is never read as $937", () => {
  withFixture({ "plans/index.html": PLANS(), "legal/x.md": "billed annually — $937.5K per year, and $73.5 per seat.\n" }, (dir) => {
    const { figures } = collectFigures({ root: dir, dirs: ["legal"] });
    const found = figures.map((f) => f.found);
    assert.ok(found.includes("$937.5K"), `collected: ${found.join(", ")}`);
    assert.ok(found.includes("$73.5"));
    assert.ok(!found.includes("$937"), "the truncated reading is gone");
  });
});

test("every collected figure carries its file, its line and the line it was read from", () => {
  const { figures } = collectFigures({ root });
  assert.ok(figures.length > 0);
  for (const f of figures) {
    assert.match(f.found, /^\$/);
    assert.ok(f.file && f.line > 0 && typeof f.context === "string");
  }
});

test("normalizeMoney makes the same amount comparable however it is written", () => {
  assert.equal(normalizeMoney("$ 5,000"), normalizeMoney("$5000"));
  assert.equal(normalizeMoney("$625k"), "$625K");
});

/* ── 5. nothing here edits a client-facing document ──────────────────────────────────────────── */

test("reconciliation is read-only: the documents it audits are byte-identical afterwards", () => {
  withFixture({
    "plans/index.html": PLANS(),
    "legal/MSA-template.md": "Implementation fee: $5,000 one-time.\n",
  }, (dir) => {
    const before = fs.readFileSync(path.join(dir, "legal/MSA-template.md"));
    reconcileQuotedFigures({ root: dir, dirs: ["legal"] });
    assert.deepEqual(fs.readFileSync(path.join(dir, "legal/MSA-template.md")), before);
    assert.ok(!fs.existsSync(path.join(dir, DECLARATIONS_FILE)), "it does not write itself a register either");
  });
});

/* ── 6. the real tree ────────────────────────────────────────────────────────────────────────── */

test("the real client-facing tree carries ZERO silent figures and ZERO stale declarations", () => {
  const r = reconcileQuotedFigures({ root });
  assert.equal(r.summary.silent, 0,
    `silent: ${r.silent.map((f) => `${f.found} ${f.file}:${f.line}`).join(", ")}`);
  assert.equal(r.summary.stale, 0, `stale: ${r.stale.map((e) => e.figure).join(", ")}`);
  assert.equal(r.summary.refusedDeclarations, 0);
  assert.equal(r.summary.ok, true);
});

test("the register itself exists, is readable, and covers more than one document", () => {
  const d = readFigureDeclarations({ root });
  assert.equal(d.readable, true);
  assert.ok(d.entries.length >= 10, "the register accounts for a real number of figures");
  assert.ok(new Set(d.entries.map((e) => e.where)).size > 1);
  for (const e of d.entries) assert.ok(e.why.length > 20, `a real reason, not a word: ${e.figure}`);
});

test("the real tree's contradictions are reported rather than declared away", () => {
  const r = reconcileQuotedFigures({ root });
  // The register deliberately does NOT declare these. If a future edit tries to declare a
  // contradiction to make this go quiet, the figure stays in the contradiction list and this holds.
  for (const c of r.contradictions) {
    assert.ok(c.file && c.line && c.publishedAt, "every contradiction carries both citations");
    assert.notEqual(c.found, undefined);
    const asFigure = r.figures.find((f) => f.file === c.file && f.line === c.line && f.found === c.found);
    assert.equal(asFigure.class, CONTRADICTION, "a contradiction can never read as merely declared");
  }
});

test("the client-facing set is the contracts, the security documents and the sales sheet — not a hand-picked subset", () => {
  assert.deepEqual(CLIENT_FACING_DIRS, ["legal", "compliance", "ARIA Sentinel/sales"]);
  const { documents } = collectFigures({ root });
  assert.ok(documents.some((d) => d.startsWith("legal/")));
  assert.ok(documents.some((d) => d.startsWith("compliance/")));
  assert.ok(documents.some((d) => d.startsWith("ARIA Sentinel/sales/")));
});
