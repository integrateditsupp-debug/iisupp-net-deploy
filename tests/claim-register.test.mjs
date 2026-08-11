// AW2 — the claim register. Written RED-FIRST: every state below is proven by constructing a
// document that must land in it, and by constructing a register entry that must be refused.
//
// The rule this suite exists to defend: the register must be capable of going red. A reconciliation
// that can only ever report "fine" is a rubber stamp with a test suite attached.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  reconcileClaims, collectClaims, readClaimDeclarations, readPublished, publishedCitation,
  statementFor, hasCondition, hasEvidence, isForwardLooking, isDisclaimed,
  CLAIM_CLASSES, STATE, REGISTER_FILE, CLIENT_FACING_DIRS,
} from "../scripts/lib/claim-register.mjs";

const root = path.resolve(import.meta.dirname, "..");

/** A throwaway tree: documents to read, a register to read them against. Nothing in-repo is written. */
function sandbox({ docs = {}, register = null, pages = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claim-register-"));
  for (const [rel, text] of Object.entries(docs)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  for (const [rel, text] of Object.entries(pages)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  if (register !== null) {
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, REGISTER_FILE), register);
  }
  return dir;
}

const HEADER = "| claim | where | condition or evidence | why |\n|---|---|---|---|\n";

test("AW2 RED FIRST — an unevidenced claim is REFUSED, by class, by file and by line", () => {
  const dir = sandbox({ docs: { "compliance/x.md": "line one\n| L.9 | ISO 27001 certified? | Yes. |\n" } });
  const r = reconcileClaims({ root: dir, dirs: ["compliance"] });
  assert.equal(r.summary.refused, 1, "a certification claim nobody publishes and nobody declared is silent");
  const [c] = r.refused;
  assert.equal(c.class, "certification");
  assert.equal(c.file, "compliance/x.md");
  assert.equal(c.line, 2, "a reviewer's objection arrives as 'line 2 says X'; the report must answer in the same terms");
  assert.equal(r.summary.ok, false);
  assert.match(statementFor(r), /silent claim/);
});

test("AW2 — a claim consistent with a published page is PUBLISHED, carrying both citations", () => {
  const dir = sandbox({
    docs: { "compliance/x.md": "Conversation records are retained 30 days.\n" },
    pages: { "privacy.html": "<p>Conversation records are <b>retained 30 days</b> unless you ask otherwise.</p>" },
  });
  const r = reconcileClaims({ root: dir, dirs: ["compliance"], pages: ["privacy.html"] });
  assert.equal(r.summary.published, 1);
  assert.equal(r.summary.refused, 0);
  const c = r.claims[0];
  assert.equal(c.state, STATE.PUBLISHED);
  assert.equal(c.citation.page, "privacy.html", "the published side of the reconciliation is cited, never asserted");
  assert.ok(c.citation.excerpt.length > 10);
  // Tags may not hide a claim from the search — the page text is stripped before matching.
  const split = sandbox({
    docs: { "compliance/x.md": "Conversation records are retained 30 days.\n" },
    pages: { "privacy.html": "<p>Conversation records are <b>retained 30</b> <i>days</i>.</p>" },
  });
  assert.equal(reconcileClaims({ root: split, dirs: ["compliance"], pages: ["privacy.html"] }).summary.published, 1);
});

test("AW2 — a forward-looking claim is DECLARED only with a condition, never with a hedge", () => {
  const claim = "| L.2 | ISO 27001 certified? | Planned 2027. |\n";
  const withCondition = sandbox({
    docs: { "compliance/x.md": claim },
    register: `${HEADER}| ISO 27001 certified | compliance/x.md:1 | by 2027, after an accredited body completes a formal audit | a target date, not a status |\n`,
  });
  const okResult = reconcileClaims({ root: withCondition, dirs: ["compliance"] });
  assert.equal(okResult.summary.declared, 1);
  assert.equal(okResult.summary.ok, true);

  // The exit criterion, red: a forward-looking statement that has lost its condition is a REFUSAL.
  for (const hedge of ["planned", "on the roadmap", "a target", "in progress"]) {
    const bare = sandbox({
      docs: { "compliance/x.md": claim },
      register: `${HEADER}| ISO 27001 certified | compliance/x.md:1 | ${hedge} | a target date, not a status |\n`,
    });
    const r = reconcileClaims({ root: bare, dirs: ["compliance"] });
    assert.equal(r.summary.malformed, 1, `"${hedge}" names no event and no date and must not pass as a condition`);
    assert.match(r.malformed[0].refused, /condition/);
    assert.equal(r.summary.ok, false);
    // And the claim it was supposed to cover falls straight back to silent — never quietly covered
    // by a declaration that was itself refused.
    assert.equal(r.summary.refused, 1);
  }
});

test("AW2 — a declaration with an empty or self-restating reason is refused", () => {
  for (const why of ["", "n/a", "TBD", "ISO 27001 certified"]) {
    const dir = sandbox({
      docs: { "compliance/x.md": "| L.2 | ISO 27001 certified? | Planned 2027. |\n" },
      register: `${HEADER}| ISO 27001 certified | compliance/x.md:1 | by 2027, after an accredited audit | ${why} |\n`,
    });
    const r = reconcileClaims({ root: dir, dirs: ["compliance"] });
    assert.equal(r.summary.malformed, 1, `a reason of "${why}" states nothing and must not stand`);
    assert.equal(r.summary.ok, false);
  }
});

test("AW2 — a declaration that matches nothing any document says is STALE", () => {
  const dir = sandbox({
    docs: { "compliance/x.md": "Backup retention: 90 days rolling.\n" },
    register:
      `${HEADER}` +
      "| retention: 90 days | compliance/x.md:1 | evidence: the data classification policy defines it | the live one |\n" +
      "| HITRUST certified | compliance/x.md:1 | by 2029, after a formal assessment | a claim that was removed from the pack |\n",
  });
  const r = reconcileClaims({ root: dir, dirs: ["compliance"] });
  assert.equal(r.summary.stale, 1, "a register that keeps entries nobody says any more rots into fiction");
  assert.equal(r.summary.ok, false);
  assert.match(statementFor(r), /match nothing/);
});

test("AW2 — a present-tense fact needs evidence, not an invented condition", () => {
  const doc = { "compliance/x.md": "Backup retention: 90 days rolling.\n" };
  const withEvidence = sandbox({
    docs: doc,
    register: `${HEADER}| retention: 90 days | compliance/x.md:1 | evidence: the data classification policy defines it | the number a DPO copies into their own record |\n`,
  });
  assert.equal(reconcileClaims({ root: withEvidence, dirs: ["compliance"] }).summary.ok, true);

  const withNothing = sandbox({
    docs: doc,
    register: `${HEADER}| retention: 90 days | compliance/x.md:1 | it is correct | the number a DPO copies into their own record |\n`,
  });
  const r = reconcileClaims({ root: withNothing, dirs: ["compliance"] });
  assert.equal(r.summary.malformed, 1, "a cell that names no place a reader can go is a restatement, not evidence");
  assert.match(r.malformed[0].refused, /evidence|restatement/);
  // Demanding a CONDITION of a present-tense fact would make somebody invent one, so it is not asked.
  assert.equal(isForwardLooking("Backup retention: 90 days rolling."), false);
  assert.equal(isForwardLooking("Cyber liability in procurement."), true);
});

test("AW2 RED FIRST — a disclaimer is not an assertion, and is not a gap either", () => {
  // The defect this state exists for, reproduced: the ISO SoA's own disclaimer, read as a claim.
  const dir = sandbox({
    docs: {
      "compliance/x.md":
        "This is NOT an ISO/IEC 27001 certification and it does not state or imply that IIS is \"ISO 27001 certified\".\n",
    },
  });
  const r = reconcileClaims({ root: dir, dirs: ["compliance"] });
  assert.ok(r.summary.disclaimed >= 1, "a sentence that denies the claim must not be counted as making it");
  assert.equal(r.summary.refused, 0, "and it must not be counted as a gap in the evidence either");
  assert.equal(r.summary.ok, true);
  assert.equal(r.claims[0].state, STATE.DISCLAIMED);
  // The negation has to come BEFORE the claim. A "not" later in the line is about something else,
  // and reading it as a disclaimer would launder an assertion into a denial — the direction of
  // error that matters most here.
  const late = "We are ISO 27001 certified, though the report is not attached.";
  assert.equal(isDisclaimed(late, late.indexOf("ISO")), false);
  const early = "This is not an ISO 27001 certification.";
  assert.equal(isDisclaimed(early, early.indexOf("ISO")), true);
  // And the same line, read whole with no position, stays conservative.
  assert.equal(isDisclaimed(early), true);
  const lateClaim = reconcileClaims({
    root: sandbox({ docs: { "compliance/x.md": `${late}\n` } }), dirs: ["compliance"],
  });
  assert.equal(lateClaim.summary.disclaimed, 0, "a trailing negation may not launder a certification claim");
  assert.equal(lateClaim.summary.refused, 1);
});

test("AW2 — the most specific declaration wins, so a claim is never covered by the wrong argument", () => {
  // The real defect: "SOC 2 + ISO 27001 certified" is about Netlify and DigitalOcean. First-match
  // handed it to the entry about THIS company's 2027 ISO target, and reported the correct
  // sub-processor entry as stale — accounted for by the wrong argument, right argument looking dead.
  const dir = sandbox({
    docs: {
      "compliance/a.md": "| L.2 | ISO 27001 certified? | Planned 2027. |\n",
      "compliance/b.md": "Master keys are provider-managed (SOC 2 + ISO 27001 certified).\n",
    },
    register:
      `${HEADER}` +
      "| ISO 27001 certified | compliance/a.md:1 | by 2027, after an accredited body audits | this company's own target |\n" +
      "| SOC 2 + ISO 27001 certified | compliance/b.md:1 | evidence: certificates held by the sub-processors, on their own trust pages | a claim about somebody else's certificate |\n",
  });
  const r = reconcileClaims({ root: dir, dirs: ["compliance"] });
  assert.equal(r.summary.stale, 0, "both declarations must match the claim each was written for");
  assert.equal(r.summary.refused, 0);
  const sub = r.claims.find((c) => c.file === "compliance/b.md");
  assert.match(sub.declaration.why, /somebody else/, "the sub-processor claim must carry the sub-processor argument");
  const own = r.claims.find((c) => c.file === "compliance/a.md");
  assert.match(own.declaration.why, /own target/);
});

test("AW2 — the class table is data, so a new claim class cannot be added without saying why it matters", () => {
  assert.ok(CLAIM_CLASSES.length >= 7);
  for (const c of CLAIM_CLASSES) {
    assert.ok(c.name && c.re instanceof RegExp, `${c.name}: a class is a name and a matcher`);
    assert.ok(c.why && c.why.length > 30, `${c.name}: a class without a stated reason is a rule nobody can argue with`);
    assert.ok(c.re.flags.includes("g"), `${c.name}: must find every occurrence, not the first`);
  }
});

test("AW2 — zero documents is never a pass", () => {
  const dir = sandbox({ docs: {} });
  const r = reconcileClaims({ root: dir, dirs: ["no-such-directory"] });
  assert.equal(r.summary.claims, 0);
  assert.equal(r.summary.ok, false, "finding nothing to check is not the same as checking and finding nothing");
  assert.match(statementFor(r), /no factual claim/);
});

test("AW2 — the real tree: every claim in every client-facing document is accounted for", () => {
  const r = reconcileClaims({ root });
  assert.equal(r.registerReadable, true, `${REGISTER_FILE} must exist, or the reconciliation is a guess`);
  assert.equal(r.publishedReadable, true);
  assert.ok(r.summary.documents >= 27, `expected all twenty-seven receivable documents (got ${r.summary.documents})`);
  assert.ok(r.summary.claims >= 30, `expected the pack's factual claims (got ${r.summary.claims})`);
  assert.equal(r.summary.refused, 0,
    `silent: ${r.refused.map((c) => `${c.file}:${c.line} ${c.class} "${c.found}"`).join(" · ")}`);
  assert.equal(r.summary.malformed, 0,
    `refused declarations: ${r.malformed.map((m) => `${m.file}:${m.line} ${m.claim}`).join(" · ")}`);
  assert.equal(r.summary.stale, 0,
    `stale: ${r.stale.map((s) => `${s.file}:${s.line} ${s.claim}`).join(" · ")}`);
  assert.equal(r.summary.ok, true);
});

test("AW2 — the honest ceiling is stated identically wherever experience is claimed", () => {
  const { claims } = collectClaims({ root });
  const experience = claims.filter((c) => c.class === "experience");
  assert.ok(experience.length >= 2, "the compliance pack states years of experience in more than one place");
  for (const c of experience) {
    const years = Number(String(c.found).match(/(\d{1,2})/)[1]);
    assert.ok(years <= 15,
      `${c.file}:${c.line} claims ${years} years to a reviewer; the honest ceiling is 15+ (Rule 14) — "${c.found}"`);
  }
  const distinct = new Set(experience.map((c) => String(c.found).toLowerCase().replace(/\s+/g, " ")));
  assert.equal(distinct.size, 1,
    `two documents state the same fact differently: ${[...distinct].join(" · ")}`);
});

test("AW2 — the register is a table a person edits, and it parses as one", () => {
  const declarations = readClaimDeclarations({ root });
  assert.equal(declarations.readable, true);
  assert.ok(declarations.entries.length >= 20, `the register must carry the pack's claims (got ${declarations.entries.length})`);
  for (const e of declarations.entries) {
    assert.ok(e.claim && e.where && e.condition && e.why);
    assert.ok(e.why.length > 30, `${e.claim}: a reason a person cannot argue with is not a reason`);
    if (e.forward) {
      assert.ok(hasCondition(e.condition), `${e.claim}: forward-looking and unconditioned`);
    } else {
      assert.ok(hasCondition(e.condition) || hasEvidence(e.condition), `${e.claim}: present-tense and unevidenced`);
    }
  }
});
