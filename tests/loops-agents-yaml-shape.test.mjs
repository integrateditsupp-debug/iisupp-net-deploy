// loops-agents-yaml-shape.test.mjs — RUN-CU 2026-10-09 (small-tasks close-out, task 7).
//
// All 27 loops/agents/*.yaml had the BODIES of `kpis:` and `tools_allowed:` swapped since they were
// written (2026-06-25): the tool allow-list read as a prose KPI sentence and the KPI block carried the
// tool list — with an indent that made every file fail to parse as YAML at all. Nothing wired these files
// to a live loop (and nothing does now — Rule 15: this fixes the shape, it enables nothing), but a
// contract file that says the SDR may use "reply rate" and must be measured on "apollo" is a defect
// waiting for the first consumer.
//
// This suite is deliberately LINE-BASED: the root package has no YAML parser, and a shape check that only
// runs where a dependency happens to be installed is a check nobody runs. When js-yaml is reachable
// (it ships with ARIA Sentinel) the files are parsed with it as well and the result is cross-checked;
// when it is not, that is reported, not hidden.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "loops", "agents");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".yaml")).sort();

// The contract every agent file carries. Every key must stay (Rule 15); order is kpis-before-tools_allowed.
const REQUIRED_KEYS = ["id", "title", "reports_to", "class", "cadence", "serves", "mandate", "duties", "kpis", "tools_allowed", "constraints", "on_failure", "verification", "metadata"];
const TOOL_ID = /^[a-z][a-z0-9.-]*(?:\s.*)?$/; // `filesystem.write (docs/x.md)`, `loops-cli (pause/kill power)`, `bash (git diff)`, `fetch`

/** Minimal reader for this file shape: top-level `key:` lines and the indented body under each. */
function topLevelBlocks(src) {
  const lines = src.split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/.exec(lines[i]);
    if (!m) continue;
    const body = [];
    for (let j = i + 1; j < lines.length && !/^[A-Za-z_][A-Za-z0-9_]*:/.test(lines[j]); j++) body.push(lines[j]);
    blocks.push({ key: m[1], inline: m[2].trim(), body, line: i + 1 });
  }
  return blocks;
}

test("there are 27 agent contracts and every one carries every key, in order, kpis before tools_allowed", () => {
  assert.equal(FILES.length, 27, `expected 27 agent files, found ${FILES.length}`);
  for (const f of FILES) {
    const keys = topLevelBlocks(readFileSync(join(DIR, f), "utf8")).map((b) => b.key);
    for (const k of REQUIRED_KEYS) assert.ok(keys.includes(k), `${f}: missing key ${k} (Rule 15 — keys are never removed)`);
    assert.ok(keys.indexOf("kpis") < keys.indexOf("tools_allowed"), `${f}: kpis must precede tools_allowed`);
    assert.equal(new Set(keys).size, keys.length, `${f}: a top-level key is duplicated`);
  }
});

test("kpis is a block of KPI prose and tools_allowed is a list of tool identifiers — never the other way round", () => {
  for (const f of FILES) {
    const src = readFileSync(join(DIR, f), "utf8");
    const blocks = Object.fromEntries(topLevelBlocks(src).map((b) => [b.key, b]));

    const kpis = blocks.kpis;
    assert.equal(kpis.inline, "|", `${f}: kpis must be a literal block scalar (kpis: |)`);
    const kpiLines = kpis.body.filter((l) => l.trim());
    assert.ok(kpiLines.length >= 1, `${f}: kpis body is empty`);
    for (const l of kpiLines) {
      assert.match(l, /^  \S/, `${f}: kpis line must be indented exactly two spaces: ${JSON.stringify(l)}`);
      assert.ok(!/^\s*-\s/.test(l), `${f}: kpis still carries a list item — the bodies are swapped: ${l.trim()}`);
      assert.ok(!TOOL_ID.test(l.trim()) || /·/.test(l), `${f}: kpis line reads like a tool identifier, not a KPI: ${l.trim()}`);
    }
    assert.ok(kpiLines.some((l) => /·/.test(l) || l.trim().split(/\s+/).length >= 3), `${f}: kpis must read as KPI prose`);

    const tools = blocks.tools_allowed;
    assert.equal(tools.inline, "", `${f}: tools_allowed must be a key with a list body, not an inline value`);
    const toolLines = tools.body.filter((l) => l.trim());
    assert.ok(toolLines.length >= 1, `${f}: tools_allowed is empty`);
    for (const l of toolLines) {
      assert.match(l, /^  - \S/, `${f}: tools_allowed entry must be a two-space-indented list item: ${JSON.stringify(l)}`);
      const id = l.trim().slice(2);
      assert.match(id, TOOL_ID, `${f}: not a tool identifier: ${id}`);
      assert.ok(!/·/.test(id), `${f}: tools_allowed carries KPI prose — the bodies are swapped: ${id}`);
    }
  }
});

test("the full swapped shape can never come back (the exact defect, as a fixture, is red)", () => {
  const swapped = `id: x\nkpis: |\n    - filesystem.read\n  - bash\ntools_allowed:\n  Win rate · ACV\nconstraints:\n  - "x"\n`;
  const blocks = Object.fromEntries(topLevelBlocks(swapped).map((b) => [b.key, b]));
  assert.ok(blocks.kpis.body.some((l) => /^\s*-\s/.test(l)), "fixture: kpis carries list items");
  assert.ok(blocks.tools_allowed.body.some((l) => /·/.test(l)), "fixture: tools_allowed carries prose");
});

test("cross-check with a real YAML parser when one is reachable (ARIA Sentinel ships js-yaml)", () => {
  const candidate = join(ROOT, "ARIA Sentinel", "node_modules", "js-yaml", "package.json");
  if (!existsSync(candidate)) {
    console.log("  (js-yaml not installed on this clone — line-based check above is the whole verdict)");
    return;
  }
  const yaml = createRequire(candidate)("js-yaml");
  for (const f of FILES) {
    const doc = yaml.load(readFileSync(join(DIR, f), "utf8"));
    assert.equal(typeof doc.kpis, "string", `${f}: kpis parses as a string`);
    assert.ok(Array.isArray(doc.tools_allowed) && doc.tools_allowed.every((t) => typeof t === "string"), `${f}: tools_allowed parses as a list of strings`);
    assert.ok(doc.tools_allowed.every((t) => TOOL_ID.test(t)), `${f}: every parsed tool is an identifier`);
    assert.ok(/·/.test(doc.kpis) || doc.kpis.trim().split(/\s+/).length >= 3, `${f}: parsed kpis reads as prose`);
    for (const k of REQUIRED_KEYS) assert.ok(k in doc, `${f}: parsed document lacks ${k}`);
  }
});
