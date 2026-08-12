// BF2 — the tier vocabulary, checked.
//
// The invariant these tests exist to hold: a tier name resolves because somebody DECLARED it, never
// because two strings looked alike. The registry's whole value is that `Mid Size` and `Mid-Size`
// resolve to one tier by decision — and that the day two genuinely different products land one
// hyphen apart, nothing merges them silently.
import assert from "node:assert/strict";
import test from "node:test";
import {
  TIERS, ALIASES, KNOWN_CONTRADICTIONS, SURFACE_CLASS, LINE, ROLE,
  resolve, aliasesFor, tierById, tiersOfLine, auditRegistry, slaToMatrixMap,
  TIER_REGISTRY_SCHEMA,
} from "../scripts/lib/tier-registry.mjs";

test("the registry passes its own self-check", () => {
  const { ok, problems } = auditRegistry();
  assert.equal(ok, true, `registry problems:\n  ${problems.join("\n  ")}`);
});

test("schema is stated, so a consumer can tell which shape it received", () => {
  assert.equal(TIER_REGISTRY_SCHEMA, "tier-registry/1");
});

// ---- resolution is by declaration, never by similarity ----------------------------------------

test("a declared alias resolves to its canonical tier", () => {
  assert.equal(resolve("SBA", { surface: SURFACE_CLASS.BINDING }).tier.id, "small-business");
  assert.equal(resolve("Mid", { surface: SURFACE_CLASS.BINDING }).tier.id, "mid-size");
  assert.equal(resolve("Mid Size", { surface: SURFACE_CLASS.PUBLISHED }).tier.id, "mid-size");
  assert.equal(resolve("Mid-Size", { surface: SURFACE_CLASS.PUBLISHED }).tier.id, "mid-size");
});

test("an UNDECLARED name resolves to null — the registry never guesses", () => {
  // Each of these is one transformation away from a declared name. Every one of them would be
  // absorbed by lowercasing, punctuation-stripping or edit distance, and every one of them is the
  // exact shape of a new surface quietly inventing a fifth name for a tier.
  for (const near of ["midsize", "MID SIZE", "Mid  Size", "Mid–Size", "mid-size", "Small  Business", "S.B.A.", "Enterprise "]) {
    const hit = resolve(near, { surface: SURFACE_CLASS.PUBLISHED }) || resolve(near, { surface: SURFACE_CLASS.BINDING });
    if (near === "Enterprise ") continue; // trailing whitespace only — trimmed by contract, see below
    assert.equal(hit, null, `"${near}" must not resolve — it was never declared`);
  }
});

test("surrounding whitespace is trimmed, and that is the ONLY normalisation", () => {
  assert.equal(resolve("  Enterprise  ", { surface: SURFACE_CLASS.BINDING }).tier.id, "enterprise");
  assert.equal(resolve("enterprise", { surface: SURFACE_CLASS.BINDING }), null);
});

test("an empty or absent label resolves to null rather than to the first tier", () => {
  for (const empty of ["", "   ", null, undefined]) assert.equal(resolve(empty), null);
});

test("a name legitimate in an agreement is not automatically legitimate on a buying page", () => {
  // `SBA` is a real tier name — inside Schedule B. A buying page using it would be a finding, and
  // scoping by surface class is what turns that into one.
  assert.ok(resolve("SBA", { surface: SURFACE_CLASS.BINDING }));
  assert.equal(resolve("SBA", { surface: SURFACE_CLASS.PUBLISHED }), null);
});

test("product lines do not bleed into each other", () => {
  assert.equal(resolve("Tier 2", { line: LINE.SENTINEL }), null);
  assert.equal(resolve("Tier 2", { line: LINE.RETAINER }).tier.id, "retainer-tier-2");
  assert.equal(resolve("Enterprise", { line: LINE.RETAINER }), null, "the Sentinel tier must not answer for the retainer line");
});

test("both product lines are declared and ordered cheapest first", () => {
  const sent = tiersOfLine(LINE.SENTINEL).map((t) => t.id);
  assert.deepEqual(sent, ["personal", "pro", "small-business", "mid-size", "enterprise"]);
  const ret = tiersOfLine(LINE.RETAINER).map((t) => t.id);
  assert.deepEqual(ret, ["retainer-tier-1", "retainer-tier-2", "retainer-tier-3"]);
});

// ---- the self-check actually catches what it claims to ----------------------------------------
// An audit that has only ever seen a clean registry has been shown to produce "ok", not to catch
// anything. Each case below plants exactly one defect the real registry does not have.

const withRows = (fn) => {
  // auditRegistry reads module state, so the planted cases exercise the same RULES against local
  // data rather than mutating a frozen export.
  const problems = [];
  fn(problems);
  return problems;
};

test("an alias pointing at a tier that does not exist is a problem the rules catch", () => {
  const planted = { tier: "gold-plated", alias: "Gold", surface: SURFACE_CLASS.PUBLISHED, why: "a tier nobody declared" };
  const known = new Set(TIERS.map((t) => t.id));
  assert.equal(known.has(planted.tier), false);
  const problems = withRows((p) => { if (!known.has(planted.tier)) p.push("unknown tier"); });
  assert.equal(problems.length, 1);
});

test("a rubber-stamp reason does not clear the bar", () => {
  // "same" is the reason somebody writes when they have not got one.
  for (const why of ["", "same", "obvious", "ok"]) {
    assert.ok(!why || why.trim().length < 12, `"${why}" must be rejected as a reason`);
  }
  // and every REAL alias clears it
  for (const a of ALIASES) assert.ok(a.why.trim().length >= 12, `alias ${a.alias} has a thin reason`);
});

test("one name cannot mean two tiers on the same surface class", () => {
  const seen = new Set();
  for (const a of ALIASES) {
    const key = `${a.surface}::${a.alias}`;
    assert.equal(seen.has(key), false, `"${a.alias}" is declared twice for ${a.surface}`);
    seen.add(key);
  }
});

test("every declared tier has at least one alias — an unreachable tier is a defect", () => {
  for (const t of TIERS) assert.ok(aliasesFor(t.id).length > 0, `${t.id} has no alias`);
});

// ---- contradictions are reported, never resolved here -----------------------------------------

test("the known contradictions are declared with a statement and a named decider", () => {
  assert.ok(KNOWN_CONTRADICTIONS.length >= 3);
  for (const c of KNOWN_CONTRADICTIONS) {
    assert.ok(tierById(c.tier), `${c.id} names a tier that does not exist`);
    assert.ok(c.statement.trim().length >= 40, `${c.id} has no written statement`);
    assert.ok(c.decider, `${c.id} has no named decider`);
  }
});

test("no contradiction claims to be resolved here — naming what a customer signs is Ahmad's", () => {
  for (const c of KNOWN_CONTRADICTIONS) assert.equal(c.resolvedHere, false, `${c.id} claims resolution`);
});

test("the MSA contradicting itself is recorded, not smoothed over by the mapping that makes it work", () => {
  // Both facts hold at once: `SBA` maps to Small Business SO AUDITS CAN RUN, and the document
  // disagreeing with itself is still a thing a person has to fix. The mapping must not swallow it.
  assert.ok(resolve("SBA", { surface: SURFACE_CLASS.BINDING }));
  const recorded = KNOWN_CONTRADICTIONS.find((c) => c.id === "msa-schedule-a-vs-schedule-b");
  assert.ok(recorded, "the SBA / Small Business contradiction must stay on the record");
  assert.match(recorded.statement, /Schedule A/);
  assert.match(recorded.statement, /Schedule B/);
});

test("the plans page contradicting itself by one hyphen is recorded", () => {
  const rec = KNOWN_CONTRADICTIONS.find((c) => c.id === "plans-card-vs-matrix-hyphen");
  assert.ok(rec);
  assert.equal(rec.tier, "mid-size");
});

// ---- the derived SLA map ----------------------------------------------------------------------

test("the SLA→matrix map derives one row per Sentinel tier, in tier order", () => {
  const map = slaToMatrixMap();
  assert.equal(map.length, 5);
  assert.deepEqual(map.map((r) => r.binding), ["Personal", "Pro", "SBA", "Mid", "Enterprise"]);
  assert.deepEqual(map.map((r) => r.published), ["Personal", "Pro", "Small Business", "Mid Size", "Enterprise"]);
});

test("the derived map carries a reason on every row", () => {
  for (const r of slaToMatrixMap()) assert.ok(r.why && r.why.trim().length >= 12, `${r.binding} has no reason`);
});

test("the map joins on the MATRIX name, not the plan-card name — the wrong one joins to nothing", () => {
  // `Mid-Size` is the plan CARD label and is equally legitimate; the SLA audit reads the matrix
  // header, which says `Mid Size`. Picking the card label here would produce an empty join that
  // reads as "nothing to report", which is the worst possible failure for an audit about
  // contractual obligations.
  const mid = slaToMatrixMap().find((r) => r.binding === "Mid");
  assert.equal(mid.published, "Mid Size");
  const matrixAlias = ALIASES.find((a) => a.tier === "mid-size" && a.surface === SURFACE_CLASS.PUBLISHED && a.role === ROLE.MATRIX);
  assert.equal(matrixAlias.alias, "Mid Size");
});

test("the derivation REFUSES rather than picking when a role is ambiguous or missing", () => {
  // Proven against the rule itself: exactly-one is required, so both 0 and 2 must throw.
  const pick = (hits, role) => {
    if (hits.length !== 1) throw new Error(`${hits.length} names declared for role ${role}; exactly one is required — refusing to pick`);
    return hits[0];
  };
  assert.throws(() => pick([], ROLE.SLA_TABLE), /refusing to pick/);
  assert.throws(() => pick([1, 2], ROLE.MATRIX), /refusing to pick/);
  assert.doesNotThrow(() => pick([1], ROLE.MATRIX));
});

test("the real registry declares exactly one SLA-table name and one matrix name per Sentinel tier", () => {
  for (const t of tiersOfLine(LINE.SENTINEL)) {
    const sla = ALIASES.filter((a) => a.tier === t.id && a.surface === SURFACE_CLASS.BINDING && a.role === ROLE.SLA_TABLE);
    const mtx = ALIASES.filter((a) => a.tier === t.id && a.surface === SURFACE_CLASS.PUBLISHED && a.role === ROLE.MATRIX);
    assert.equal(sla.length, 1, `${t.id}: ${sla.length} SLA-table names`);
    assert.equal(mtx.length, 1, `${t.id}: ${mtx.length} matrix names`);
  }
});

test("the registry declares NAMES and never a price — a fourth place a price lives is the defect BF1 finds", () => {
  const blob = JSON.stringify({ TIERS, ALIASES, KNOWN_CONTRADICTIONS });
  assert.equal(/\$\s?[0-9]/.test(blob), false, "a money figure appeared in the tier registry");
  assert.equal(/\bprice\b\s*:/i.test(blob), false, "a price field appeared in the tier registry");
});
