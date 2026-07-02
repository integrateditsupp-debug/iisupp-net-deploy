// RUN-E E3 runner — builds THE revenue-now board from the real local pipeline file.
// Reads  <stateDir>/revenue-leads.json  (real leads — UNTRACKED, lives only on Ahmad's machine)
// Writes <stateDir>/REVENUE-BOARD.md    (the one board Ahmad opens)
// stateDir defaults to <repo>/senior-director-state/opportunity-engine and MUST contain
// "senior-director-state" — this runner refuses to write anywhere serveable/tracked (R11 +
// axis-state.json incident lesson). Rule 14: missing/empty data => an honestly EMPTY board.
// Nothing here sends, signs, pays, registers, or purchases — it renders staged one-clicks only.
import fs from "node:fs";
import path from "node:path";
import { buildRevenueBoard, boardMarkdown } from "../ARIA Sentinel/src/shared/revenue-board.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const stateDir = path.resolve(process.argv[2] || path.join(repoRoot, "senior-director-state", "opportunity-engine"));
if (!stateDir.includes("senior-director-state")) {
  console.error("REFUSED: stateDir must live under senior-director-state/ (untracked + force-404). Got: " + stateDir);
  process.exit(1);
}
let input = {};
const dataFile = path.join(stateDir, "revenue-leads.json");
try { input = JSON.parse(fs.readFileSync(dataFile, "utf8")); }
catch { console.log("no readable revenue-leads.json — rendering the honestly EMPTY board (real-or-empty)."); }

const board = buildRevenueBoard(input, { now: Date.now() });
const out = path.join(stateDir, "REVENUE-BOARD.md");
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(out, boardMarkdown(board));
console.log(`revenue board written: ${out} — ${board.rows.length} ranked, ${board.excluded.length} excluded, ${board.acquisitions.vetted.length} vetted acquisition(s). Nothing sent.`);
