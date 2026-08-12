// quote-intake.test.mjs — RUN-BM / BM1. THE INTAKE NOBODY KEEPS, PROVEN RED FIRST.
//
// The invariants these cases exist to hold:
//
//   · the fields come from the PAGE, so a field the page adds later appears without this file
//     being edited, and a reply written before it existed reports it ABSENT rather than answered;
//   · an answer the buyer did not give is ABSENT — never defaulted, never zero, never "unknown";
//   · a field named-and-left-blank and a field never mentioned stay different facts;
//   · an unreadable surface REFUSES instead of falling back to a field list of its own;
//   · nothing is sent and no mailbox is read.
//
// Every class is proven against a fixture built to fail exactly that way. A parser that has only
// ever seen a well-formed reply produces a verdict; it does not catch anything.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";
import {
  intakeSchema, receiveIntake, statementFor,
  STATE, ABSENCE, VERDICT, REFUSAL, INTAKE_SCHEMA, SENDS, READS_MAILBOX,
} from "../scripts/lib/quote-intake.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function withFixture(files, fn) {
  const dir = makeScratchDir("bm1-intake-");
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  try { return fn(dir); } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* mount refuses unlink */ } }
}

// The page shape is copied from the surface the real buttons live on, so what is parsed here is
// what a buyer is actually served.
const MAILTO = (fields) => `
<script>
  window.location.href = 'mailto:ahmad.wasee@iisupp.net?subject=' + encodeURIComponent('Custom Quote Request — ' + data.title) + '&body=' + encodeURIComponent('Please provide a custom quote for ' + data.title + '.\\n\\nEnvironment details:\\n${fields.map((f) => `- ${f}:\\n`).join("")}\\nThank you.');
</script>`;

const DEFAULT_FIELDS = ["Users / devices", "Locations", "Current stack", "Timeline"];
const PAGE = (fields = DEFAULT_FIELDS) => `<html><body>${MAILTO(fields)}</body></html>`;

const byId = (record, id) => record.fields.find((f) => f.id === id);

// ── the schema is discovered, not typed ──────────────────────────────────────

test("BM1 — the fields come off the page, and this module declares none of its own", () => {
  withFixture({ "index.html": PAGE() }, (dir) => {
    const shape = intakeSchema({ root: dir });
    assert.equal(shape.ok, true, shape.reason || "");
    assert.deepEqual(shape.fields.map((f) => f.id), ["users-devices", "locations", "current-stack", "timeline"]);
    for (const f of shape.fields) {
      assert.equal(f.file, "index.html");
      assert.ok(f.line > 0, "every field carries the line it was read from");
    }
  });

  // RED FIRST: a page that asks for a fifth fact must produce a fifth field with no edit here.
  withFixture({ "index.html": PAGE([...DEFAULT_FIELDS, "Compliance obligations"]) }, (dir) => {
    const shape = intakeSchema({ root: dir });
    assert.equal(shape.fields.length, 5);
    assert.ok(shape.fields.some((f) => f.id === "compliance-obligations"),
      "a field added to the mailto must appear here without this file being edited");
  });

  // And the field list is genuinely absent from this source — not a copy that happens to agree.
  const src = fs.readFileSync(path.join(ROOT, "scripts/lib/quote-intake.mjs"), "utf8");
  for (const label of DEFAULT_FIELDS) {
    assert.ok(!src.includes(label), `"${label}" is typed into the module — the list must come from the page`);
  }
});

test("BM1 — a surface with no readable ask REFUSES; it never falls back to a list of its own", () => {
  withFixture({ "index.html": "<html><body>no quote button here</body></html>" }, (dir) => {
    const shape = intakeSchema({ root: dir });
    assert.equal(shape.ok, false);
    assert.equal(shape.refusal, REFUSAL.NO_ASK);
    assert.deepEqual(shape.fields, [], "a refusal invents no fields");
    assert.ok(shape.reason && shape.reason.length > 0, "the refusal says which fact it is reporting");

    const record = receiveIntake("Users / devices: 40", { root: dir });
    assert.equal(record.ok, false);
    assert.equal(record.verdict, VERDICT.UNREADABLE, "no verdict about a reply is honest without the ask");
    assert.equal(record.answered, 0);
  });

  // A checkout with no surface at all is a different sentence from one whose surface is unparseable.
  withFixture({ "README.md": "#" }, (dir) => {
    const shape = intakeSchema({ root: dir });
    assert.equal(shape.ok, false);
    assert.match(shape.reason, /no declared quote surface/i);
  });
});

test("BM1 — two asked fields that reduce to one id refuse rather than silently drop an answer", () => {
  withFixture({ "index.html": PAGE(["Locations", "Locations"]) }, (dir) => {
    const shape = intakeSchema({ root: dir });
    // readQuoteAsk de-duplicates identical labels, so the collision that matters is a distinct
    // label reducing to the same id.
    assert.equal(shape.ok, true);
  });
  withFixture({ "index.html": PAGE(["Current stack", "Current  stack"]) }, (dir) => {
    const shape = intakeSchema({ root: dir });
    assert.equal(shape.ok, false);
    assert.equal(shape.refusal, REFUSAL.FIELD_COLLISION);
    assert.match(shape.reason, /current-stack/);
  });
});

// ── the reply ────────────────────────────────────────────────────────────────

test("BM1 — a reply answering two of four reports two answers and two absences, and no defaults", () => {
  withFixture({ "index.html": PAGE() }, (dir) => {
    const record = receiveIntake([
      "Hi Ahmad,",
      "",
      "Environment details:",
      "- Users / devices: 42 staff, about 60 endpoints",
      "- Locations:",
      "- Current stack: Microsoft 365 E3, on-prem file server",
      "- Timeline:",
      "",
      "Thanks.",
    ].join("\n"), { root: dir });

    assert.equal(record.ok, true);
    assert.equal(record.verdict, VERDICT.PARTIAL);
    assert.equal(record.answered, 2);
    assert.equal(record.asked, 4);

    assert.equal(byId(record, "users-devices").state, STATE.ANSWERED);
    assert.equal(byId(record, "users-devices").value, "42 staff, about 60 endpoints");
    assert.equal(byId(record, "current-stack").value, "Microsoft 365 E3, on-prem file server");

    for (const id of ["locations", "timeline"]) {
      const f = byId(record, id);
      assert.equal(f.state, STATE.ABSENT);
      assert.equal(f.value, null, "an unanswered field carries NO value — not 0, not \"\", not \"unknown\"");
      assert.equal(f.absence, ABSENCE.LEFT_BLANK, "named and left blank is its own fact");
    }
  });
});

test("BM1 — a reply that answers none is EMPTY, and mentions-nothing differs from left-blank", () => {
  withFixture({ "index.html": PAGE() }, (dir) => {
    const templateBack = receiveIntake("- Users / devices:\n- Locations:\n- Current stack:\n- Timeline:", { root: dir });
    assert.equal(templateBack.verdict, VERDICT.EMPTY);
    assert.equal(templateBack.answered, 0);
    for (const f of templateBack.fields) assert.equal(f.absence, ABSENCE.LEFT_BLANK);

    const prose = receiveIntake("Can you send me a price?", { root: dir });
    assert.equal(prose.verdict, VERDICT.EMPTY);
    for (const f of prose.fields) {
      assert.equal(f.state, STATE.ABSENT);
      assert.equal(f.absence, ABSENCE.NOT_MENTIONED, "a reply that never names the field is a different fact");
    }
    assert.deepEqual(prose.unclaimed.map((u) => u.text), ["Can you send me a price?"],
      "what the buyer wrote is carried, never parsed away");

    const nothing = receiveIntake("", { root: dir });
    assert.equal(nothing.verdict, VERDICT.EMPTY);
    assert.equal(nothing.fields.length, 4);
  });
});

test("BM1 — a complete reply is COMPLETE, in the shapes buyers actually write", () => {
  withFixture({ "index.html": PAGE() }, (dir) => {
    const record = receiveIntake([
      "users / devices — 12 users / 15 devices",
      "Locations: Whitby and Oshawa",
      "Current stack:",
      "  Microsoft 365 Business Premium",
      "  Synology NAS",
      "* Timeline: start in September",
    ].join("\n"), { root: dir });

    assert.equal(record.verdict, VERDICT.COMPLETE);
    assert.equal(record.answered, 4);
    assert.equal(byId(record, "users-devices").value, "12 users / 15 devices", "an em-dash separator is still an answer");
    assert.equal(byId(record, "current-stack").value, "Microsoft 365 Business Premium Synology NAS",
      "an answer written under the question is still that buyer's answer");
    assert.equal(byId(record, "timeline").value, "start in September");
    assert.deepEqual(record.unclaimed, [], "every line was claimed by the field it belongs to");
  });
});

test("BM1 — a field the page adds later is ABSENT in a reply written before it existed", () => {
  const older = [
    "- Users / devices: 40",
    "- Locations: one office",
    "- Current stack: M365",
    "- Timeline: Q4",
  ].join("\n");

  withFixture({ "index.html": PAGE() }, (dir) => {
    assert.equal(receiveIntake(older, { root: dir }).verdict, VERDICT.COMPLETE);
  });

  // RED FIRST: the same reply against a page that now asks a fifth question must NOT stay complete.
  withFixture({ "index.html": PAGE([...DEFAULT_FIELDS, "Compliance obligations"]) }, (dir) => {
    const record = receiveIntake(older, { root: dir });
    assert.equal(record.verdict, VERDICT.PARTIAL);
    assert.equal(record.asked, 5);
    const added = byId(record, "compliance-obligations");
    assert.equal(added.state, STATE.ABSENT);
    assert.equal(added.absence, ABSENCE.NOT_MENTIONED);
    assert.equal(added.value, null);
  });
});

test("BM1 — a continuation stops at the next asked field, so one answer never eats the next", () => {
  withFixture({ "index.html": PAGE() }, (dir) => {
    const record = receiveIntake([
      "- Current stack:",
      "- Timeline: two weeks",
    ].join("\n"), { root: dir });
    assert.equal(byId(record, "current-stack").absence, ABSENCE.LEFT_BLANK,
      "the next question is not an answer to the previous one");
    assert.equal(byId(record, "timeline").value, "two weeks");
  });
});

test("BM1 — anything that is not a reply body is refused, not coerced", () => {
  withFixture({ "index.html": PAGE() }, (dir) => {
    for (const bad of [null, undefined, 42, {}, ["Users / devices: 5"]]) {
      const record = receiveIntake(bad, { root: dir });
      assert.equal(record.ok, false, `${String(bad)} must be refused`);
      assert.equal(record.refusal, REFUSAL.NOT_TEXT);
      assert.equal(record.verdict, VERDICT.UNREADABLE);
      assert.deepEqual(record.fields, []);
    }
  });
});

// ── it reads the real surface, and it touches nothing ────────────────────────

test("BM1 — against this tree the ask is readable and every field is traced to the live page", () => {
  const shape = intakeSchema({ root: ROOT });
  assert.equal(shape.ok, true, shape.reason || "");
  assert.ok(shape.fields.length >= 4, "the live surface asks a buyer for at least the four facts BL read");
  assert.ok(shape.buttons > 0, "and at least one quote button leads to it");
  for (const f of shape.fields) {
    assert.ok(fs.existsSync(path.join(ROOT, f.file)), `${f.file} is a file in this tree`);
  }
  // The statement is for a reader, so it names each field rather than printing a score.
  const said = statementFor(receiveIntake("Locations: Whitby", { root: ROOT, schema: shape }));
  assert.match(said, /PARTIAL/);
  assert.match(said, /Locations/);
});

test("BM1 — it sends nothing, opens nothing, and writes nothing", () => {
  assert.equal(SENDS, false);
  assert.equal(READS_MAILBOX, false);
  assert.equal(INTAKE_SCHEMA, "quote-intake/1");

  const src = fs.readFileSync(path.join(ROOT, "scripts/lib/quote-intake.mjs"), "utf8");
  for (const forbidden of ["node:net", "node:http", "nodemailer", "imap", "writeFile", "fetch("]) {
    assert.ok(!src.includes(forbidden), `the intake must not reference ${forbidden}`);
  }
  // A mail address in this file would mean it had an opinion about where replies come from.
  assert.ok(!/@iisupp\.net/.test(src), "the module holds no address");
});
