// BP3 — the card that offers a quote, and the two Schedules that price and serve it, must agree on ONE name.
//
// Why this suite exists. The purchase modal on index.html carried a button reading "Request a custom
// quote" and named nothing: not the plan, not the engagement, not a tier anyone could look up. Nothing
// downstream can price what has no name, and a buyer cannot tell what they are asking to be quoted.
// Meanwhile the MSA had already drifted against itself — Schedule A listed "Small Business" and
// "Mid-Size" while the Schedule B SLA table headed the same two columns "SBA" and "Mid", and Schedule B
// had no column at all for the "Custom" plan Schedule A offers.
//
// Drift like that is invisible until a customer reads both pages in one sitting. This suite reads the
// real files at test time — never a stored copy of the names — and fails the moment the three surfaces
// disagree.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const msa = fs.readFileSync(path.join(root, "legal/MSA-template.md"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

// --- 1. Schedule A: the plan-name list is the source of truth. -------------------------------------
const aRow = msa.match(/^\|\s*Plan name\s*\|\s*\[([^\]]+)\]\s*\|/m);
assert.ok(aRow, "Schedule A must carry a `| Plan name | [ ... ] |` row — the canonical plan-name list");
const scheduleA = aRow[1].split("/").map(s => s.trim()).filter(Boolean);
assert.ok(scheduleA.length >= 2, `Schedule A plan list looks empty: ${JSON.stringify(aRow[1])}`);

// --- 2. Schedule B: the SLA table header must name the same plans. ---------------------------------
// Bounded at the next `## ` heading — Schedule C has a table of its own and it is not an SLA table.
const bSection = (msa.split(/^## Schedule B[^\n]*$/m)[1] || "").split(/^## /m)[0];
assert.ok(bSection, "Schedule B (Service Level Agreement) section must exist");
const bHeader = bSection.match(/^\|\s*Tier\s*\|(.+)\|\s*$/m);
assert.ok(bHeader, "Schedule B must carry a `| Tier | ... |` header row naming each plan");
const scheduleB = bHeader[1].split("|").map(s => s.trim()).filter(Boolean);

const missingInB = scheduleA.filter(n => !scheduleB.includes(n));
const extraInB = scheduleB.filter(n => !scheduleA.includes(n));
assert.deepEqual(
  { missingInB, extraInB },
  { missingInB: [], extraInB: [] },
  `Schedule A and Schedule B name different plans.\n  Schedule A: ${scheduleA.join(" / ")}\n  Schedule B: ${scheduleB.join(" / ")}`
);

// Every plan named in the Schedule B header must actually have a cell in every row of that table —
// a header column with no values underneath is a name with no service level behind it.
const bRows = bSection
  .split("\n")
  .filter(l => /^\|/.test(l) && !/^\|\s*Tier\s*\|/.test(l) && !/^\|[-\s|]+\|$/.test(l));
assert.ok(bRows.length >= 3, "Schedule B SLA table must have service-level rows");
for (const row of bRows) {
  const cells = row.split("|").slice(1, -1).map(s => s.trim());
  assert.equal(
    cells.length,
    scheduleB.length + 1,
    `Schedule B row has ${cells.length} cells for ${scheduleB.length} plans + 1 label — a plan is named in the header with no value under it:\n  ${row}`
  );
  for (const c of cells) assert.ok(c.length > 0, `Schedule B row has an empty cell:\n  ${row}`);
}

// --- 3. The quote card must NAME the plan it is quoting, and that name must be a real plan. ---------
const card = index.match(/data-quote="1"[^>]*data-plan-name="([^"]+)"/);
assert.ok(
  card,
  'The purchase modal\'s quote button must declare data-plan-name="..." — a card that offers a quote and names nothing cannot be priced downstream (BP3)'
);
const cardPlan = card[1].trim();
assert.ok(
  scheduleA.includes(cardPlan),
  `The quote card names plan "${cardPlan}", which is not a plan in Schedule A (${scheduleA.join(" / ")})`
);
assert.ok(
  scheduleB.includes(cardPlan),
  `The quote card names plan "${cardPlan}", which has no column in the Schedule B SLA table (${scheduleB.join(" / ")})`
);

// The name must be visible to the human reading the card, not only to this test.
const cardBlock = index.slice(card.index, card.index + 1400);
assert.ok(
  new RegExp(`${cardPlan}\\b`).test(cardBlock.replace(/data-plan-name="[^"]+"/, "")),
  `The quote card carries data-plan-name="${cardPlan}" but never shows that name to the reader`
);

console.log(
  `plan-name-consistency passed (Schedule A ${scheduleA.length} plans · Schedule B header matches exactly · ` +
    `${bRows.length} SLA rows fully populated · quote card names "${cardPlan}").`
);
