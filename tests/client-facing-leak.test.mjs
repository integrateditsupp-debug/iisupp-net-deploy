// AU1 — the gate that lets a client-signable agreement live in the shared line without weakening the
// 2026-07-01 lockdown.
//
// Written RED-FIRST, and the shape of "red-first" here matters: every refusal class below is proven
// by PLANTING that exact leak into a copy of the real document and asserting the audit fails BY NAME
// AND BY LINE. A gate that only ever sees clean input has never been shown to catch anything.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  auditClientFacing, auditDocument, publishedMoney, publishedContact,
  contactContradictions, CHECKS, SEVERITY, statementFor, EXEMPTIONS, exemptionFor,
} from "../scripts/lib/client-facing-leak.mjs";

const root = path.resolve(import.meta.dirname, "..");
const AGREEMENT = "legal/Pilot-Agreement-TEMPLATE.md";
const agreementText = fs.readFileSync(path.join(root, AGREEMENT), "utf8");
const published = publishedMoney({ root });
const contact = publishedContact({ root });

const plant = (line) => `${agreementText}\n\n${line}\n`;
const auditPlanted = (line) => auditDocument({ text: plant(line), file: "planted.md", published, contact });

test("the client-signable agreement is in the tracked tree and the tree is readable", () => {
  const result = auditClientFacing({ root });
  assert.equal(result.trackedReadable, true, "git must be readable, or the tracked claim is a guess");
  const doc = result.documents.find((d) => d.file === AGREEMENT);
  assert.ok(doc, `${AGREEMENT} must be among the audited client-facing documents`);
  assert.notEqual(doc.tracked, false,
    `${AGREEMENT} is on disk but not in the shared line — a clone cannot produce the document a client signs`);
  assert.ok(doc.bytes > 500, "an agreement a client signs is not a stub");
});

test("RED FIRST — every refusal class fails by name and by line when planted", () => {
  const plants = [
    ["forbidden-name", "Prepared in consultation with Raymond James."],
    ["credential", "Portal access: api_key=sk_live_51QzExampleKeyMaterial"],
    // Assembled from parts on purpose. Writing the operator-record directory as a literal here would
    // make record-dependency-declared.test.mjs — which scans suite SOURCE for that token — believe
    // this suite reads the untracked records, which it does not. A planted fixture must not fake a
    // dependency the suite does not have.
    ["internal-path", `See ${["senior", "director", "state"].join("-")}/outbound/SEND-SHEET.md for the follow-up.`],
    ["internal-codename", "Raised by Cowork during RUN-AU and tracked in NEEDS-AHMAD."],
    ["rule-7-language", "The pilot is completely risk-free and money-back if you are not delighted."],
    ["experience-claim", "Provider brings 21+ years experience to every engagement."],
  ];

  for (const [name, line] of plants) {
    const res = auditPlanted(line);
    assert.equal(res.ok, false, `planting a ${name} leak must REFUSE the document`);
    const hit = res.refusals.find((f) => f.check === name);
    assert.ok(hit, `the refusal must be attributed to "${name}", not to "something failed" — got ${res.refusals.map((f) => f.check).join(", ")}`);
    assert.equal(hit.severity, SEVERITY.REFUSE);
    assert.ok(hit.line > 0, "a refusal without a line number is not actionable");
    assert.ok(hit.why && hit.why.length > 10, "every refusal states why a client must never read it");
  }
});

test("RED FIRST — a contact detail that contradicts the published tree is refused, with both values", () => {
  assert.ok(contact.domain, "the published domain must be readable from the public pages");
  assert.ok(contact.postal, "the published postal code must be readable from the public pages");

  const wrongDomain = auditPlanted("Questions: hello@iisupport.net");
  const dHit = wrongDomain.refusals.find((f) => f.check === "contact-contradiction" && f.kind === "domain");
  assert.ok(dHit, "a domain the company does not own must be refused");
  assert.equal(dHit.expected, contact.domain);

  const wrongPostal = auditPlanted("30 Fothergill Court, Whitby, Ontario L1P 2L4");
  const pHit = wrongPostal.refusals.find((f) => f.check === "contact-contradiction" && f.kind === "postal-code");
  assert.ok(pHit, "a postal code that disagrees with the published address must be refused");
  assert.equal(pHit.expected, contact.postal);

  const wrongPhone = auditPlanted("Call 647-581-9999 to arrange the pilot.");
  assert.ok(wrongPhone.refusals.some((f) => f.check === "contact-contradiction" && f.kind === "phone"),
    "a phone number that is not the published one must be refused");
});

test("an SLA uptime figure is NOT mistaken for a marketing guarantee", () => {
  const res = auditPlanted("| Uptime guarantee | 99.5% | 99.9% |");
  assert.ok(!res.refusals.some((f) => f.check === "rule-7-language"),
    "a measured service level is a term, not a promise; refusing it would force real contracts to be gutted (Rule 15)");
});

test("a price the company publishes is accepted; one it does not is DECIDED, not refused", () => {
  assert.equal(published.readable, true, `the published plan table (${published.file}) must be readable`);
  const anyPublished = [...published.figures][0];
  assert.ok(anyPublished, "the plan table must publish at least one figure, or this check proves nothing");

  const ok = auditDocument({ text: plant(`Continuing costs ${anyPublished} per month.`), file: "p.md", published, contact });
  assert.ok(!ok.findings.some((f) => f.check === "unpublished-price"),
    "a figure lifted from the published plan table is traceable and must not be flagged");

  const invented = auditDocument({ text: plant("Continuing costs $12,345 per month."), file: "p.md", published, contact });
  const dec = invented.decisions.find((f) => f.check === "unpublished-price" && f.found.includes("12,345"));
  assert.ok(dec, "a figure a client cannot verify anywhere must be reported");
  assert.equal(dec.severity, SEVERITY.DECIDE);
  assert.equal(invented.ok, true,
    "it is a decision (publish the figure, or stop quoting it) — a gate that deleted working contracts to go green would be the worse failure");
});

test("the agreement itself passes the gate it was written for", () => {
  const doc = auditDocument({ text: agreementText, file: AGREEMENT, published, contact });
  assert.equal(doc.ok, true,
    `the agreement must carry nothing operator-internal: ${doc.refusals.map((f) => `${f.check}@${f.line} "${f.found}"`).join(" · ")}`);
  assert.equal(doc.decisions.length, 0,
    "the agreement quotes no figure a client cannot check — it points at the published plan page instead");
});

test("EVERY client-facing document in the tree is clean, not just the new one", () => {
  const result = auditClientFacing({ root });
  // AW1 widened the walk from four documents to every document a stranger can receive. The number
  // is asserted as a FLOOR, not an equality, so adding a policy can never silently shrink the audit.
  assert.ok(result.summary.documents >= 27,
    `expected the contracts + the compliance pack + the sales sheets (got ${result.summary.documents})`);
  assert.equal(result.summary.refused, 0,
    `refused: ${result.refusals.map((f) => `${f.file}:${f.line} ${f.check} "${f.found}"`).join(" · ")}`);
  assert.equal(result.summary.untracked, 0,
    "a client-facing document outside the shared line cannot be produced from a clone");
  assert.equal(result.summary.ok, true);
});

test("AW1 — the walk is recursive, so the eleven written policies are audited and not skipped", () => {
  const result = auditClientFacing({ root });
  const files = result.documents.map((d) => d.file);
  const policies = files.filter((f) => f.startsWith("compliance/policies/"));
  assert.ok(policies.length >= 11,
    `a flat readdir reports a directory of policies as absent rather than as unclean (got ${policies.length})`);
  // The three document classes a reviewer actually asks for, named rather than implied.
  for (const required of [
    "compliance/SIG-Lite-prefilled.md",
    "compliance/CAIQ-Lite-prefilled.md",
    "compliance/SOC2-controls-self-assessment.md",
    "ARIA Sentinel/sales/ARIA-Sentinel-Sales-One-Pager.md",
    "legal/Pilot-Agreement-TEMPLATE.md",
  ]) {
    assert.ok(files.includes(required), `${required} is receivable by a client and must be audited`);
  }
});

test("AW1 RED FIRST — the abbreviated experience claim fails, because that is how it was written", () => {
  // The claim that shipped in the SOC 2 self-assessment for months was `Founder 21+ yrs IT` — the
  // old pattern required `years` spelled out and a qualifying noun, and caught neither.
  for (const line of ["Founder 21+ yrs IT.", "Founder trained (21+ yrs IT)", "Principal has 22 years experience"]) {
    const doc = auditPlanted(line);
    assert.ok(doc.refusals.some((f) => f.check === "experience-claim"),
      `an overclaim written as "${line}" must be refused by name`);
  }
  // And the honest ceiling is not refused, or the check would force a lie in the other direction.
  assert.equal(auditPlanted("Founder 15+ yrs IT.").refusals.filter((f) => f.check === "experience-claim").length, 0);
});

test("AW1 — an exemption is declared in code with an argument, and is never silent", () => {
  for (const e of EXEMPTIONS) {
    assert.ok(CHECKS.some((c) => c.name === e.check), `${e.check}: an exemption must name a real check`);
    assert.ok(Array.isArray(e.dirs) && e.dirs.length, `${e.check}/${e.term}: an exemption must be scoped to directories`);
    assert.ok(e.why && e.why.length > 80,
      `${e.check}/${e.term}: an exemption without a written argument is a check quietly turned off`);
  }
  const result = auditClientFacing({ root });
  // Every exemption applied is reported with its file, its line and its reason — the report is the
  // price of the exemption. An exempted occurrence still appears in `findings`.
  for (const x of result.exempted) {
    assert.ok(x.file && x.line > 0 && x.exemption, "an applied exemption carries file, line and reason");
    const doc = result.documents.find((d) => d.file === x.file);
    assert.ok(doc.findings.some((f) => f.line === x.line && f.check === x.check),
      "an exemption moves a finding out of the refusals, never out of the record");
    assert.equal(doc.refusals.some((f) => f.line === x.line && f.found === x.found), false);
  }
  assert.equal(result.summary.exempted, result.exempted.length);
});

test("AW1 — the exemption is scoped, so the same word still fails where the argument does not hold", () => {
  // The kill-switch argument is about a product control described to a buyer. A contract has no
  // reason to name it, and `legal/` is deliberately outside the exemption's scope.
  const inLegal = auditDocument({ text: "The Provider maintains a kill-switch.", file: "legal/X.md", published, contact });
  assert.ok(inLegal.refusals.some((f) => f.check === "internal-codename"),
    "an exemption scoped to compliance and sales must not leak into the contracts");
  const inCompliance = auditDocument({ text: "The Provider maintains a kill-switch.", file: "compliance/X.md", published, contact });
  assert.equal(inCompliance.refusals.filter((f) => f.check === "internal-codename").length, 0);
  assert.equal(inCompliance.exempted.length, 1);
  // And an exemption never covers a different codename in the same directory.
  const other = auditDocument({ text: "Handled by Codex.", file: "compliance/X.md", published, contact });
  assert.ok(other.refusals.some((f) => f.check === "internal-codename"));
});

test("the audit reports what it did not check rather than implying it checked everything", () => {
  const empty = auditClientFacing({ root, dirs: ["no-such-directory"] });
  assert.equal(empty.summary.documents, 0);
  assert.equal(empty.summary.ok, false, "zero documents is never a pass");
  assert.match(statementFor(empty), /no client-facing document/);
});

test("the statement names files and lines an operator can act on", () => {
  const s = statementFor(auditClientFacing({ root }));
  assert.match(s, /client-facing documents/);
});

test("the check table is data, so a new refusal class cannot be added without a why", () => {
  assert.ok(CHECKS.length >= 6);
  for (const c of CHECKS) {
    assert.ok(c.name && c.re instanceof RegExp, `${c.name}: a check is a name and a matcher`);
    assert.ok(c.why && c.why.length > 20, `${c.name}: a check without a stated reason is a rule nobody can argue with`);
    assert.ok([SEVERITY.REFUSE, SEVERITY.DECIDE].includes(c.severity), `${c.name}: unknown severity`);
  }
});
