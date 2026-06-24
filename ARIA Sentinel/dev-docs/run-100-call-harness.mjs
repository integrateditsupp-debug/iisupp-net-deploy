// DoD criterion 5 — re-runnable 100-call matcher harness. Imports the REAL matcher (matchRecipes from
// src/shared/recipes.mjs) and the REAL KB keyword index, runs the exact 102 call phrasings from
// 100-common-call-test-2026-06-24.md, and reports PASS/PARTIAL/FAIL with the same thresholds as the baseline:
//   PASS    = top recipe score >= 8  OR a KB article keyword covers the call
//   PARTIAL = top recipe score 1..7  and no KB cover (fragile/title-token-only)
//   FAIL    = no recipe match AND no KB cover
// Usage: INDEX_PATH=<index-by-keyword.json> node dev-docs/run-100-call-harness.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchRecipes } from "../src/shared/recipes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = process.env.DOC_PATH || path.join(__dirname, "100-common-call-test-2026-06-24.md");
const indexPath = process.env.INDEX_PATH || path.resolve(__dirname, "../../knowledge-base/_meta/index-by-keyword.json");

// Parse the 102 calls out of the report table (column 2 of rows like "| 7 | <call> | RESULT | ...").
const doc = fs.readFileSync(docPath, "utf8");
const calls = [];
for (const line of doc.split("\n")) {
  const m = line.match(/^\|\s*(\d{1,3})\s*\|\s*(.+?)\s*\|\s*(PASS|PARTIAL|FAIL)\s*\|/);
  if (m) calls.push({ n: Number(m[1]), text: m[2], baseline: m[3] });
}

// KB cover: any indexed keyword appears as a substring of the (normalized) call.
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const kbKeywords = Object.keys(index).map((k) => k.toLowerCase());
function kbCover(call) {
  const q = " " + call.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ") + " ";
  for (const kw of kbKeywords) {
    if (kw.length < 3) continue;                       // ignore 1-2 char keys
    // short keys (3-4 chars like vpn/dns/usb) require a word boundary; longer keys allow substring.
    const hit = kw.length <= 4 ? q.includes(" " + kw + " ") : (q.includes(" " + kw + " ") || q.includes(kw));
    if (hit) { const art = index[kw][0]; return art ? `${art.id}` : kw; }
  }
  return null;
}

let pass = 0, partial = 0, fail = 0;
const fails = [], partials = [];
for (const c of calls) {
  const matches = matchRecipes(c.text, { limit: 5 });
  const top = matches[0];
  const topScore = top ? top.score : 0;
  const kb = kbCover(c.text);
  let result;
  if (topScore >= 8 || kb) result = "PASS";
  else if (topScore >= 1) result = "PARTIAL";
  else if (kb) result = "PASS";
  else result = "FAIL";
  if (result === "PASS") pass++;
  else if (result === "PARTIAL") { partial++; partials.push(`#${c.n} "${c.text}" — top=${top?top.recipe.id:"(none)"} score=${topScore}`); }
  else { fail++; fails.push(`#${c.n} "${c.text}"`); }
}

const total = calls.length;
const pct = (n) => ((n / total) * 100).toFixed(1);
console.log(`\n100-call matcher harness — ${total} calls · index=${path.basename(indexPath)} (${kbKeywords.length} keys)`);
console.log(`PASS ${pass} (${pct(pass)}%) · PARTIAL ${partial} (${pct(partial)}%) · FAIL ${fail} (${pct(fail)}%)`);
console.log(`\nFAILs (${fail}):`);
for (const f of fails) console.log("  " + f);
console.log(`\nPARTIALs (${partial}):`);
for (const p of partials) console.log("  " + p);
const target = 95;
console.log(`\nDoD criterion 5: ${Number(pct(pass)) >= target ? "PASS" : "NOT MET"} (target >=${target}% PASS, got ${pct(pass)}%)`);
process.exitCode = Number(pct(pass)) >= target ? 0 : 1;
