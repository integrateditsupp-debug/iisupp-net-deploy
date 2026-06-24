// RUN 22 §5 — generated reports strip PII (usernames, machine names, emails) + 🔒 R11 private folder.
import assert from "node:assert/strict";
import { buildQuarterlyReport, reportIsClean } from "../src/main/report-generator.mjs";

// A clean report passes the gate.
const clean = buildQuarterlyReport({ company: "Acme Corp", kpis: { incidents: 10 } });
assert.equal(reportIsClean(clean.html), true);

// PII fed into the report is REDACTED — the gate still passes (no real PII remains) and the raw values are gone.
const piiData = {
  company: "Acme",
  // PII only inside redactable patterns (Windows user path · UNC machine · email · R11 folder).
  topIncidents: [{ title: "slow logon at C:\\Users\\jsmith\\Desktop", outcome: "seen on \\\\DESK-07, contact bob@acme.com" }],
  recurring: [{ issue: "path D:\\Private pics and Vids\\v.mp4", fix: "ignored" }]
};
const rep = buildQuarterlyReport(piiData);
assert.equal(reportIsClean(rep.html), true, "redacted report passes the PII gate");
assert.doesNotMatch(rep.html, /jsmith/, "username stripped");
assert.doesNotMatch(rep.html, /DESK-07/, "machine name stripped");
assert.doesNotMatch(rep.html, /bob@acme\.com/, "email stripped");
assert.doesNotMatch(rep.html, /private pics and vids/i, "🔒 R11 private folder never appears");
// And the redaction markers ARE present (proof the sanitizer ran).
assert.match(rep.html, /&lt;user&gt;|&lt;email&gt;|&lt;machine&gt;|private-folder/);

// reportIsClean catches an UN-redacted leak (defense-in-depth, e.g., a future bug bypassing esc()).
assert.equal(reportIsClean("<p>C:\\Users\\realname\\x</p>"), false);
assert.equal(reportIsClean("<p>mail leak@corp.com</p>"), false);

console.log("Report-pdf-no-pii test passed (usernames/machines/emails + R11 stripped; gate catches raw leaks).");
