// suite-census.test.mjs — RUN-BV / BV1.
//
// The defect this guards produced no red. On a clean clone of the shared line the harness printed
// `# fail 0` beside a total of 1086, and the same tree after installing one package the root
// manifest already declares printed `# fail 0` beside a total of 1103. Seventeen assertions were
// never attempted and nothing in the summary said so; `374/374 suites green` could not have said
// so, because a count of "however many we got to" over itself is always N/N.
//
// These assertions hold the shape of the honest answer: the denominator is what we were ASKED to
// run, an absent declared package is unjudged rather than failed, an absent UNDECLARED package is a
// real defect, the word "green" never appears next to an incomplete run, and a harness that
// registered nothing is never green.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  packageNameOf, missingSpecifierOf, classifyLoadFailure, takeCensus, censusReport,
  LOAD_FAILURE_CLASSES, VERDICTS, SUITE_CENSUS_SCHEMA, SENDS,
} from "../scripts/lib/suite-census.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DECLARED = { "@netlify/blobs": "package.json", exceljs: "package.json" };

const notFound = (specifier) => Object.assign(
  new Error(`Cannot find package '${specifier}' imported from /repo/netlify/functions/x.mjs`),
  { code: "ERR_MODULE_NOT_FOUND" },
);

test("this module reaches nothing and sends nothing", () => {
  assert.equal(SENDS, false);
  assert.equal(SUITE_CENSUS_SCHEMA, "suite-census.v1");
  const src = fs.readFileSync(path.join(root, "scripts/lib/suite-census.mjs"), "utf8");
  for (const forbidden of ["node:fs", "node:child_process", "node:http", "fetch("]) {
    assert.ok(!src.includes(forbidden), `the decider must stay pure — found ${forbidden}`);
  }
  assert.ok(!/Date\.now\(\)|new Date\(/.test(src), "the decider must take no clock of its own");
});

test("a package name is read off a specifier, and a path is not a package", () => {
  assert.equal(packageNameOf("@netlify/blobs"), "@netlify/blobs");
  assert.equal(packageNameOf("@netlify/blobs/dist/main.js"), "@netlify/blobs");
  assert.equal(packageNameOf("exceljs"), "exceljs");
  assert.equal(packageNameOf("exceljs/lib/x.js"), "exceljs");
  assert.equal(packageNameOf("./relative.mjs"), null, "a relative path is not a package");
  assert.equal(packageNameOf("../../tests/x.test.mjs"), null);
  assert.equal(packageNameOf("/abs/path.mjs"), null);
  assert.equal(packageNameOf("node:fs"), null, "a builtin is not a dependency");
  assert.equal(packageNameOf("file:///x.mjs"), null);
  assert.equal(packageNameOf("#internal"), null);
  assert.equal(packageNameOf("@scopeonly"), null, "a bare scope names no package");
  assert.equal(packageNameOf(""), null);
  assert.equal(packageNameOf(undefined), null);
});

test("only a resolution error yields a missing specifier", () => {
  assert.equal(missingSpecifierOf(notFound("@netlify/blobs")), "@netlify/blobs");
  assert.equal(
    missingSpecifierOf(Object.assign(new Error("Cannot find module './gone.mjs'"), { code: "MODULE_NOT_FOUND" })),
    "./gone.mjs",
  );
  assert.equal(missingSpecifierOf(new TypeError("x is not a function")), null,
    "a real throw during evaluation is not a missing dependency");
  assert.equal(missingSpecifierOf(new Error("assertion failed")), null);
  assert.equal(missingSpecifierOf(undefined), null);
  assert.equal(missingSpecifierOf("Cannot find package 'exceljs' imported from /x"), "exceljs",
    "a string error is still read, not crashed on");
});

test("an absent DECLARED package is unjudged; an absent UNDECLARED one is a defect", () => {
  const declaredCase = classifyLoadFailure({ spec: "./a.test.mjs", err: notFound("@netlify/blobs") }, DECLARED);
  assert.equal(declaredCase.class, LOAD_FAILURE_CLASSES.DEPENDENCY_ABSENT);
  assert.equal(declaredCase.judged, false, "we did not judge this suite — it never ran");
  assert.equal(declaredCase.package, "@netlify/blobs");
  assert.equal(declaredCase.manifest, "package.json", "the manifest that declares it must be named");
  assert.equal(declaredCase.remedy, "npm install @netlify/blobs", "an operator is told the fix, not left guessing");

  const undeclared = classifyLoadFailure({ spec: "./b.test.mjs", err: notFound("left-pad") }, DECLARED);
  assert.equal(undeclared.class, LOAD_FAILURE_CLASSES.UNRESOLVED_IMPORT,
    "something importing what nothing installs is a real defect, not an environment gap");
  assert.equal(undeclared.judged, true);
  assert.equal(undeclared.remedy, null, "there is no remedy to offer for a defect");

  const threw = classifyLoadFailure({ spec: "./c.test.mjs", err: new TypeError("boom") }, DECLARED);
  assert.equal(threw.class, LOAD_FAILURE_CLASSES.LOAD_ERROR);
  assert.equal(threw.judged, true);

  const garbage = classifyLoadFailure(null, DECLARED);
  assert.equal(garbage.class, LOAD_FAILURE_CLASSES.LOAD_ERROR, "garbage in is a defect, never a pass");
  assert.equal(garbage.spec, "(unnamed suite)");
});

test("the denominator is what we were ASKED to run, and it never shrinks silently", () => {
  const c = takeCensus({
    registered: 374,
    loadFailures: [
      { spec: "../../tests/forums-concierge.test.mjs", err: notFound("@netlify/blobs") },
      { spec: "./ac1-visit-log.test.mjs", err: notFound("@netlify/blobs") },
    ],
    declaredPackages: DECLARED,
  });
  assert.equal(c.registered, 374, "the count asked for is kept, not overwritten by the count achieved");
  assert.equal(c.taken, 372);
  assert.equal(c.notTaken, 2);
  assert.equal(c.complete, false);
  assert.equal(c.verdict, VERDICTS.INCOMPLETE, "nothing failed, and that is not green");
  assert.equal(c.exitCode, 1, "an incomplete run must not exit 0");
  assert.equal(c.assertionsFailed, false);
});

test("a complete clean run is green, and only then", () => {
  const c = takeCensus({ registered: 374, declaredPackages: DECLARED });
  assert.equal(c.verdict, VERDICTS.GREEN);
  assert.equal(c.taken, 374);
  assert.equal(c.notTaken, 0);
  assert.equal(c.complete, true);
  assert.equal(c.exitCode, 0);
  assert.ok(censusReport(c).join("\n").includes("374 of 374 suites taken — all green."));
});

test("a failed assertion is RED and outranks every environment excuse", () => {
  const c = takeCensus({
    registered: 374,
    assertionsFailed: true,
    loadFailures: [{ spec: "./a.test.mjs", err: notFound("@netlify/blobs") }],
    declaredPackages: DECLARED,
  });
  assert.equal(c.verdict, VERDICTS.RED, "a real failure is never downgraded to 'incomplete'");
  assert.equal(c.exitCode, 1);
  const text = censusReport(c).join("\n");
  assert.ok(!/green/i.test(text), "the word green must never appear beside a failure");
  assert.ok(text.includes("SUITE RED"));
});

test("an undeclared missing package is RED, not an environment gap", () => {
  const c = takeCensus({
    registered: 10,
    loadFailures: [{ spec: "./a.test.mjs", err: notFound("some-package-nobody-installs") }],
    declaredPackages: DECLARED,
  });
  assert.equal(c.verdict, VERDICTS.RED);
  assert.equal(c.notTaken, 0, "it is not unjudged — it is wrong");
  assert.equal(c.taken, 10);
  assert.ok(censusReport(c).join("\n").includes("defect in the source"));
});

test("a harness that registered nothing is never green", () => {
  for (const registered of [0, -1, undefined, null, 1.5, "374"]) {
    const c = takeCensus({ registered, declaredPackages: DECLARED });
    assert.equal(c.registered, 0, `a non-count must read as 0 registered, got ${c.registered}`);
    assert.equal(c.verdict, VERDICTS.INCOMPLETE, "0/0 green is the emptiest form of the lie");
    assert.equal(c.exitCode, 1);
  }
  assert.ok(censusReport(takeCensus({})).join("\n").includes("proved nothing"));
  assert.equal(takeCensus().verdict, VERDICTS.INCOMPLETE, "called with nothing at all, still not green");
});

test("the report never passes an unjudged suite off as a pass", () => {
  const text = censusReport(takeCensus({
    registered: 3,
    loadFailures: [{ spec: "./a.test.mjs", err: notFound("exceljs") }],
    declaredPackages: DECLARED,
  })).join("\n");
  assert.ok(text.includes("NOT TAKEN"));
  assert.ok(text.includes("unjudged, not passed"));
  assert.ok(text.includes("2 of 3 suites taken"));
  assert.ok(!/all green/.test(text));
  assert.ok(censusReport("not a census").join("\n").includes("nothing was measured"));
});

test("the live runner actually uses this decider — not a copy of the old tautology", () => {
  const runner = fs.readFileSync(path.join(root, "ARIA Sentinel/tests/run-all.mjs"), "utf8");
  assert.ok(runner.includes("suite-census.mjs"), "run-all.mjs must take its verdict from this module");
  // Comments are stripped first: the file is allowed — encouraged — to NARRATE the old lie. What it
  // may not do is still execute it.
  const code = runner.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  assert.ok(!/\$\{total\}\/\$\{total\} suites green/.test(code),
    "the tautological N/N green line must be gone from the runner's CODE, not merely shadowed");
  assert.ok(!/const total = results\.length/.test(code),
    "the verdict must not be recomputed from the suites we got to; registered is TESTS.length");
  assert.ok(runner.includes("declaredPackages") || runner.includes("declaredPackagesFrom"),
    "the runner must supply the manifests, or every absent package reads as a defect");
});

test("every package the manifests declare can be mapped, on this real tree", () => {
  const manifests = ["package.json", "ARIA Sentinel/package.json"];
  const declared = {};
  for (const rel of manifests) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const name of Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) })) {
      if (!(name in declared)) declared[name] = rel;
    }
  }
  assert.ok(Object.keys(declared).length > 0, "this tree declares dependencies; the reader found none");
  assert.equal(declared["@netlify/blobs"], "package.json",
    "the package whose absence caused this cycle's incomplete reading must be found in the root manifest");
  for (const [name, rel] of Object.entries(declared)) {
    assert.equal(packageNameOf(name), name, `${name} (declared in ${rel}) does not round-trip as a package name`);
  }
});
