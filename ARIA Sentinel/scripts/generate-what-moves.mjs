// generate-what-moves.mjs — RUN-AB: run AB1/AB2/AB3 against the REAL records and write the artefact.
//
// Refuses to write if a leak or a fabricated number is detected. Run:
//   node "ARIA Sentinel/scripts/generate-what-moves.mjs"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { measureOutcomes, renderOutcomes, UNOBSERVED } from "../src/shared/passive-outcomes.mjs";
import { assessPassiveSurface, renderPassiveSurface } from "../src/shared/passive-surface.mjs";
import { splitItems, renderSplit } from "../src/shared/moves-without-us.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const outbound = path.join(repo, "senior-director-state", "outbound");
const now = new Date().toISOString();
const day = now.slice(0, 10);

const record = JSON.parse(fs.readFileSync(path.join(outbound, "outbound-record-2026-07-28.json"), "utf8"));
const measured = measureOutcomes(record);
const surface = assessPassiveSurface({ now });

// The real open items as at this cycle. Every mechanism claimed here is checked by AB3, not trusted.
const openItems = [
  { handle: "OPEN-01", label: "twelve follow-ups drafted and not sent", mechanism: null },
  { handle: "OPEN-02", label: "warm routes handed back by prospects, reachable now", mechanism: null },
  { handle: "OPEN-03", label: "two prospect-stated return dates already passed", mechanism: null },
  { handle: "OPEN-04", label: "the live site", mechanism: { name: "the site is up", observedAt: now, observable: true, observableVia: "a browser" } },
  { handle: "OPEN-05", label: "twenty-eight built sequences", mechanism: { name: "the suite is green", observedAt: now, observable: true, observableVia: "the test runner" } },
  { handle: "OPEN-06", label: "the axis-command-center-v2 line, merged into main locally and unpushed", mechanism: null },
  { handle: "OPEN-07", label: "the Netlify publish of iisupp.net", mechanism: null },
];
const split = splitItems(openItems, { now });

// ── refusal gates ───────────────────────────────────────────────────────────────────────────────────
const body = [
  `# WHAT MOVES WITHOUT US — ${day}`,
  "",
  "RUN-AB. Three questions, answered from records that already exist. No new data was purchased, fetched or invented.",
  "",
  "---",
  "",
  renderOutcomes(measured),
  "",
  "---",
  "",
  renderPassiveSurface(surface),
  "",
  "---",
  "",
  renderSplit(split),
  "",
  "---",
  "",
  "## THE FINDING",
  "",
  split.selfIsEmpty
    ? "Nothing in this program moves on its own. The entire remaining gap is one person writing to another. " +
      "The correct next action is not another sequence. It is the hour."
    : `${split.self.length} item(s) move without a human hour. That is the first compounding number this program has had; everything after this should be built on it.`,
  "",
].join("\n");

if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(body)) { console.error("REFUSED TO WRITE: an address reached the artefact."); process.exit(1); }
if (measured.delivered !== UNOBSERVED) { console.error("REFUSED TO WRITE: `delivered` became a value."); process.exit(1); }
if (!/unobserved/.test(body)) { console.error("REFUSED TO WRITE: the unobserved refusal is missing."); process.exit(1); }

const out = path.join(outbound, `WHAT-MOVES-${day}.md`);
fs.writeFileSync(out, body, "utf8");
console.log(`wrote ${out}`);
console.log(`sent ${measured.sent} · undeliverable ${measured.undeliverable} · auto-replied ${measured.autoReplied} · personally replied ${measured.personallyReplied} · silent ${measured.silent} (derived) · delivered ${measured.delivered}`);
console.log(`passive signals measurable: ${surface.measurableCount}/${surface.signalCount}`);
console.log(`moves on its own: ${split.self.length}/${split.total}`);
