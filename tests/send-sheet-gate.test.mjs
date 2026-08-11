// AV3 — the twelve messages, made impossible to get wrong.
//
// The figure this suite drives is `judgementCallsLeft`: the number of checks the sender would
// otherwise have to perform by eye, twelve separate times. Every refusal class is proven against a
// fixture built to fail exactly that way, so the checks are real in a clone even though the sheet
// itself is not in the shared line.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  auditSendSheet, parseSendSheet, checkMessage, statementFor, isDeploySafetyExcluded,
  CHECKS, SEND_SHEET_FILE, SEVERITY, SENDS, UNTRACKED,
} from "../scripts/lib/send-sheet-gate.mjs";
import { publishedMoney } from "../scripts/lib/client-facing-leak.mjs";

const root = path.resolve(import.meta.dirname, "..");
const SHEET = "outbound/SHEET.md";

const sheetWith = (bodies, { claimed = bodies.length } = {}) =>
  `# SEND SHEET\n\nQueue state at render: **${claimed} live · ${claimed} reachable now**.\n\n---\n\n` +
  bodies.map((b, i) => `### ${i + 1} · WR-R00${i + 1} — a label\n\n${b.split("\n").map((l) => `> ${l}`).join("\n")}\n`).join("\n") +
  "\n---\n\n## AFTER YOU SEND\n\nSending stays your action.\n";

function fixture(bodies, extra = {}, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "send-sheet-"));
  fs.mkdirSync(path.join(dir, "outbound"), { recursive: true });
  fs.writeFileSync(path.join(dir, SHEET), sheetWith(bodies, opts));
  fs.mkdirSync(path.join(dir, "plans"), { recursive: true });
  fs.writeFileSync(path.join(dir, "plans/index.html"), "<html><body>Personal $899/mo</body></html>");
  for (const [rel, body] of Object.entries(extra)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}
const withSheet = (bodies, fn, extra = {}, opts = {}) => {
  const dir = fixture(bodies, extra, opts);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const audit = (dir) => auditSendSheet({ root: dir, file: SHEET });

const CLEAN = "Following up as you'd asked. Nothing's changed on my end — happy to walk you through what IIS would cover. 15 minutes whenever suits.";

/* ── 1. it does not send, and says so in code ───────────────────────────────────────────────── */

test("the gate declares in code that it sends nothing, and carries no transport", () => {
  assert.equal(SENDS, false);
  const src = fs.readFileSync(path.join(root, "scripts/lib/send-sheet-gate.mjs"), "utf8");
  for (const forbidden of ["nodemailer", "sendMail", "fetch(", "https.request", "googleapis"]) {
    assert.ok(!src.includes(forbidden), `the gate must carry no transport: found ${forbidden}`);
  }
});

/* ── 2. the parse is a parse, not a guess ───────────────────────────────────────────────────── */

test("each message is split out with its number, handle, label and body", () => {
  withSheet([CLEAN, CLEAN], (dir) => {
    const p = parseSendSheet({ root: dir, file: SHEET });
    assert.equal(p.messages.length, 2);
    assert.equal(p.messages[0].index, 1);
    assert.equal(p.messages[0].handle, "WR-R001");
    assert.equal(p.messages[0].label, "a label");
    assert.match(p.messages[0].body, /Following up/);
  });
});

test("prose between messages is not mistaken for a message", () => {
  withSheet([CLEAN], (dir) => {
    const p = parseSendSheet({ root: dir, file: SHEET });
    assert.equal(p.messages.length, 1, "the AFTER YOU SEND section is not a thirteenth message");
  });
});

test("every finding carries the line IN THE SHEET, so the operator can go straight to it", () => {
  withSheet([`${CLEAN}\nWe guarantee results.`], (dir) => {
    const r = audit(dir);
    const f = r.messages[0].refusals[0];
    assert.ok(f.line > 1, "a finding on the second body line does not report the heading line");
    const text = fs.readFileSync(path.join(dir, SHEET), "utf8").split("\n");
    assert.match(text[f.line - 1], /guarantee/);
  });
});

/* ── 3. every refusal class, red against a fixture built to fail it ─────────────────────────── */

const RED = [
  ["forbidden-name", "I previously worked at Raymond James."],
  ["rule-7-language", "This is a risk-free trial with a money-back guarantee."],
  ["experience-overclaim", "IIS is founder-led with 21+ years hands-on."],
  ["contact-detail", "Reach me at someone@example.com any time."],
  ["contact-detail", "My direct line is 416-555-0134."],
  ["fabricated-proof", "We saved our clients $40,000 last quarter."],
  ["unpublished-figure", "Managed IT from $349/mo."],
];

for (const [name, bad] of RED) {
  test(`${name}: planted in a message, the gate refuses it BY NAME and the message is not clean`, () => {
    withSheet([`${CLEAN}\n${bad}`], (dir) => {
      const r = audit(dir);
      assert.equal(r.summary.refused, 1);
      assert.ok(r.messages[0].refusals.some((f) => f.check === name),
        `expected ${name}, got ${r.messages[0].refusals.map((f) => f.check).join(",")}`);
      assert.equal(r.summary.ok, false);
      assert.ok(r.summary.judgementCallsLeft > 0);
    });
  });
}

test("a dead same-site link is a refusal and names the href", () => {
  withSheet([`${CLEAN}\nDetails: https://iisupp.net/nothing-here`], (dir) => {
    const r = audit(dir);
    const f = r.messages[0].refusals.find((x) => x.check === "dead-link");
    assert.ok(f, "the dead link is refused");
    assert.match(f.found, /nothing-here/);
  });
});

test("a same-site link that resolves on disk is not a refusal, and records what it resolved to", () => {
  withSheet([`${CLEAN}\nDetails: https://iisupp.net/pricing`], (dir) => {
    const r = audit(dir);
    assert.equal(r.summary.refusals, 0);
    assert.equal(r.messages[0].links[0].verdict, "resolves");
    assert.match(r.messages[0].links[0].to, /pricing\.html/);
  }, { "pricing.html": "<html>prices</html>" });
});

test("an external link is UNCHECKED with a reason — never counted as a pass, never as a failure", () => {
  withSheet([`${CLEAN}\nSee https://example.com/whitepaper`], (dir) => {
    const r = audit(dir);
    assert.equal(r.summary.refusals, 0);
    assert.equal(r.summary.unchecked, 1);
    assert.equal(r.messages[0].unchecked[0].check, "external-link");
    assert.equal(r.summary.ok, true, "unchecked is not a failure");
    assert.equal(r.summary.judgementCallsLeft, 1, "but it IS still a judgement call the sender has to make");
  });
});

test("a published figure is fine; the check is against the page the recipient will actually look at", () => {
  withSheet([`${CLEAN}\nPersonal is $899/mo.`], (dir) => {
    assert.equal(audit(dir).summary.refusals, 0);
  });
});

test("an empty message body is refused — a sheet that lists one is not ready to send", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "send-sheet-empty-"));
  try {
    fs.mkdirSync(path.join(dir, "outbound"), { recursive: true });
    fs.writeFileSync(path.join(dir, SHEET), "# S\n\n**1 live**\n\n### 1 · WR-R001 — a label\n\n### 2 · WR-R002 — b\n\n> real body\n");
    const r = audit(dir);
    assert.ok(r.messages[0].refusals.some((f) => f.check === "empty-body"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/* ── 4. the sheet cannot lie about its own size ─────────────────────────────────────────────── */

test("a sheet claiming more messages than it carries fails — the operator works from the claim", () => {
  withSheet([CLEAN, CLEAN], (dir) => {
    const r = audit(dir);
    assert.equal(r.claimedCount, 12);
    assert.equal(r.countAgrees, false);
    assert.equal(r.summary.ok, false);
  }, {}, { claimed: 12 });
});

test("a sheet whose claim matches its contents agrees", () => {
  withSheet([CLEAN, CLEAN], (dir) => {
    const r = audit(dir);
    assert.equal(r.countAgrees, true);
    assert.equal(r.summary.ok, true);
  });
});

/* ── 5. zero judgement calls is the exit, and it is a computed figure ───────────────────────── */

test("a wholly clean sheet reports ZERO judgement calls left, and says nothing here sends", () => {
  withSheet([CLEAN, CLEAN, CLEAN], (dir) => {
    const r = audit(dir);
    assert.equal(r.summary.judgementCallsLeft, 0);
    assert.equal(r.summary.clean, 3);
    const line = statementFor(r);
    assert.match(line, /0 judgement calls left/);
    assert.match(line, /Nothing here sends/);
  });
});

test("judgementCallsLeft counts refusals AND uncheckables — an unresolvable link is still work for a person", () => {
  withSheet([`${CLEAN}\nWe guarantee it.\nSee https://example.com/x`], (dir) => {
    const r = audit(dir);
    assert.equal(r.summary.judgementCallsLeft, r.summary.refusals + r.summary.unchecked);
    assert.ok(r.summary.judgementCallsLeft >= 2);
  });
});

/* ── 6. the check table is data, and complete ───────────────────────────────────────────────── */

test("every check names itself, its severity and why a stranger must not read it", () => {
  for (const c of CHECKS) {
    assert.ok(c.name && c.why && c.re instanceof RegExp);
    assert.ok(Object.values(SEVERITY).includes(c.severity));
  }
  const names = CHECKS.map((c) => c.name);
  for (const required of ["forbidden-name", "rule-7-language", "experience-overclaim", "contact-detail"]) {
    assert.ok(names.includes(required), `the gate must check ${required}`);
  }
});

test("15+ years is allowed and 16+ is not — the ceiling is enforced at the boundary", () => {
  withSheet([`${CLEAN}\nFounder-led, 15+ years hands-on.`], (dir) => {
    assert.equal(audit(dir).summary.refusals, 0);
  });
  withSheet([`${CLEAN}\nFounder-led, 16+ years hands-on.`], (dir) => {
    assert.equal(audit(dir).summary.refusals, 1);
  });
});

/* ── 7. the sheet's absence from the shared line is a class, not a pass and not a crash ─────── */

test("a sheet excluded from the tracked tree is reported UNTRACKED with its reason", () => {
  const r = auditSendSheet({ root, file: SEND_SHEET_FILE });
  if (r.readable) {
    // On the operator machine the file is present: then it must be genuinely checked.
    assert.ok(r.summary.messages > 0);
    assert.equal(typeof r.summary.judgementCallsLeft, "number");
  } else {
    assert.equal(r.untracked, UNTRACKED);
    assert.match(statementFor(r), /NOT IN THE SHARED LINE/);
    assert.match(statementFor(r), /not moved into served URL space/);
  }
});

test("deliberate exclusion and mere absence are different facts", () => {
  assert.equal(isDeploySafetyExcluded({ root, file: SEND_SHEET_FILE }), true,
    "senior-director-state/ is excluded on purpose because the repository root is served");
  assert.equal(isDeploySafetyExcluded({ root, file: "legal/Pilot-Agreement-TEMPLATE.md" }), false);
});

test("an unreadable sheet never reports ok, and never reports a judgement-call count it did not compute", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "send-sheet-none-"));
  try {
    const r = auditSendSheet({ root: dir, file: SHEET });
    assert.equal(r.summary.ok, false);
    assert.equal(r.summary.judgementCallsLeft, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/* ── 8. checkMessage is usable on its own, so the checks outlive this one sheet ─────────────── */

test("checkMessage runs standalone against any message body", () => {
  const published = publishedMoney({ root });
  const m = checkMessage(
    { index: 1, handle: "WR-X", headingLine: 1, bodyLines: [{ line: 2, text: "We guarantee it." }], body: "We guarantee it.", firstBodyLine: 2 },
    { published, root, file: "anywhere.md" });
  assert.equal(m.ok, false);
  assert.equal(m.refusals[0].check, "rule-7-language");
  assert.equal(m.refusals[0].line, 2);
});
