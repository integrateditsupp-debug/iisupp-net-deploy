// tests/axis-vault-brain.test.mjs — brain #1 (the Obsidian vault) and the model router (2026-08-12).
//
// Ahmad: "ensure the Axis brain is saved as a vault in obsidian and Axis looks at both brains
// starting with obsidian. Future info and learning will be saved in obsidian axis vault… if its a
// simple question it uses kaiku 4.5 … complex ones sonnet 4.6 and so on … not to use too much token
// unless needed and there is no choice."
//
// What this protects:
//   · the vault is searched BEFORE any model call, and can answer with no model at all
//   · a weak match does NOT answer — a wrong vault hit pre-empts the plan and then gets banked
//   · learning is written back INTO the vault, and never writes a secret
//   · cheap questions start on haiku, hard ones do not, and escalation needs evidence
//   · the CLI call carries --model and the measured latency flags, and no path-valued flag
//     (Windows shell:true concatenates argv unescaped — a path with spaces would be shredded)
// Run: node tests/axis-vault-brain.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = () => { n++; };

// Build a throwaway vault so the test never depends on Ahmad's real notes.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-vault-test-'));
process.env.AXIS_VAULT = tmp;
for (const d of ['00_Index', '02_Hippocampus', '07_Cortex', '13_Learned']) {
  fs.mkdirSync(path.join(tmp, d), { recursive: true });
}
fs.writeFileSync(path.join(tmp, '02_Hippocampus', 'RULES.md'), `---
brain_region: hippocampus
---
# RULES

## R1 spend cap
No new operational or SaaS spend above the current baseline without an explicit ask. The monthly
spend cap is twenty to seventy Canadian dollars and it applies to every agent without exception.

## R7 no fake proof
No guarantee, money-back, risk-free or refund language anywhere on the site.
`);
fs.writeFileSync(path.join(tmp, '07_Cortex', 'Ahmad.md'), `---
brain_region: cortex
---
# Ahmad Wasee

Founder and sole operator of Integrated IT Support. Fifteen or more years in IT since 2011, and the
resume must never claim twenty-one years of experience under any circumstances.
`);
fs.writeFileSync(path.join(tmp, '00_Index', 'AXIS-SYSTEM.md'), `---
type: prompt
---
# AXIS — system prompt

> preamble that must not be part of the prompt

---

You are AXIS, Ahmad's operating partner. Address him as "Ahmad". Answer directly, lead with the
answer, and keep spoken replies under twelve words. Do not widen the scope of what was asked, and
never write a secret into the vault under any circumstances whatsoever at any time.
`);

// pathToFileURL, not a raw path: on Windows an absolute path is not a valid ESM specifier ("c:" is
// read as a URL scheme), and this repo's own path contains spaces and an em dash.
const vault = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'axis-vault-brain.mjs')).href);
const R = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'axis-model-router.mjs')).href);

// ---- 1. The vault is a real brain: it finds the right note ----
{
  const hits = vault.search('what is the monthly spend cap');
  assert.ok(hits.length > 0, 'vault search returned nothing');
  assert.equal(hits[0].name, 'RULES', `expected RULES, got ${hits[0].name}`);
  ok();

  const who = vault.search('how many years of IT experience does Ahmad have');
  assert.equal(who[0].name, 'Ahmad', `expected Ahmad, got ${who[0].name}`);
  ok();
}

// ---- 2. It answers with NO model call, and the excerpt is the relevant passage ----
{
  const hit = vault.vaultTier('what is the monthly spend cap');
  assert.ok(hit, 'vault declined a question it clearly knows');
  assert.equal(hit.tier, 'vault');
  assert.equal(hit.cost, 0);
  assert.match(hit.text, /twenty to seventy/i, 'excerpt missed the answering paragraph');
  assert.ok(!/money-back/i.test(hit.text), 'excerpt leaked an unrelated section of the note');
  ok();
}

// ---- 3. A weak match must NOT answer ----
// This is the guard that matters most: a confident-but-wrong vault answer pre-empts the Max plan
// and is then written back, so the brain learns its own mistake. Same reasoning as
// KB_MIN_CONFIDENCE=15 in axis-brain.cjs.
{
  assert.equal(vault.vaultTier('what is the reseller margin on Synology NAS hardware'), null,
    'vault answered a question it has no note for');
  ok();
  assert.equal(vault.vaultTier('spend'), null, 'a single bare term should not clear the bar');
  ok();
}

// ---- 4. Partial knowledge still becomes context for the model ----
{
  const ctx = vault.vaultContext('what should I tell a customer about refunds and the spend cap');
  assert.ok(ctx.includes('RULES'), 'vault context omitted the relevant note');
  assert.ok(ctx.length < 2500, 'vault context is unbounded');
  ok();
}

// ---- 5. Learning is written back INTO the vault ----
{
  const res = vault.learn({
    question: 'what is the reseller margin on Microsoft 365 Business Premium',
    answer: 'The reseller margin on Microsoft 365 Business Premium through the CSP programme is '
      + 'typically in the region of fifteen percent on annual commitments, and it is paid monthly in arrears.',
    source: 'claude-max', model: 'claude-sonnet-4-6',
  });
  assert.ok(res.written, `learn() refused: ${res.reason}`);
  assert.ok(fs.existsSync(res.file), 'learn() reported success but wrote no file');
  const body = fs.readFileSync(res.file, 'utf8');
  assert.match(body, /^---\r?\n/, 'learned note has no frontmatter');
  assert.match(body, /type: learned/);
  assert.match(body, /model: claude-sonnet-4-6/);
  ok();

  // …and the vault can immediately answer it, with no model. That is the whole point of banking.
  const recall = vault.vaultTier('what is the reseller margin on Microsoft 365 Business Premium');
  assert.ok(recall, 'a freshly learned fact was not findable');
  assert.equal(recall.tier, 'vault');
  ok();

  // Re-learning the same question updates in place rather than littering the vault.
  const again = vault.learn({
    question: 'what is the reseller margin on Microsoft 365 Business Premium',
    answer: 'Corrected: the margin is approximately twenty percent on annual commitments paid monthly in arrears, per the 2026 CSP terms.',
    source: 'claude-max',
  });
  assert.equal(again.file, res.file, 're-learning created a duplicate note');
  const learnedDir = fs.readdirSync(path.join(tmp, '13_Learned')).filter(f => f.endsWith('.md'));
  assert.equal(learnedDir.length, 1, `expected 1 learned note, found ${learnedDir.length}`);
  ok();
}

// ---- 6. A secret is never written to the vault ----
// The vault opens in Obsidian, appears in screenshots and demos, and may sync. A leaked key here is
// a leaked key everywhere.
{
  const bad = vault.learn({
    question: 'what is the anthropic key we use for the metered account',
    answer: 'The key currently in use is sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFF and it is set as a user environment variable on the machine.',
  });
  assert.equal(bad.written, false, 'a secret was written into the vault');
  assert.equal(bad.reason, 'contains-secret');
  ok();
}

// ---- 7. The system prompt is loaded from the vault, without its editorial preamble ----
{
  const p = vault.loadSystemPrompt();
  assert.ok(p, 'system prompt did not load from the vault');
  assert.match(p, /You are AXIS/);
  assert.ok(!/preamble that must not be part/.test(p), 'the note\'s own commentary leaked into the prompt');
  assert.ok(!/^---/.test(p), 'frontmatter leaked into the prompt');
  ok();
}

// ---- 8. Routing: cheap questions start cheap, hard ones do not ----
{
  for (const q of ['how many videos are staged?', 'what is the spend cap', 'is the site up']) {
    assert.equal(R.classify(q).tier, 'fast', `"${q}" should start on haiku`);
  }
  ok();
  for (const q of ['why is the paywall firing twice for trial users',
                   'compare Sourcewell and MERX for our next bid',
                   'draft a rate card for the overflow support pilot']) {
    assert.equal(R.classify(q).tier, 'standard', `"${q}" should start on sonnet`);
  }
  ok();
  for (const q of ['design the migration plan for moving all three tenants end-to-end with trade-offs',
                   'architect a multi-tenant billing pipeline that scales to 500 customers']) {
    assert.equal(R.classify(q).tier, 'deep', `"${q}" should start on opus`);
  }
  ok();

  assert.equal(R.TIER_BY_NAME.fast.model, 'claude-haiku-4-5');
  assert.equal(R.TIER_BY_NAME.standard.model, 'claude-sonnet-4-6');
  ok();
}

// ---- 9. Escalation needs evidence, and stops at the top ----
{
  assert.equal(R.answerUsable('').ok, false);
  assert.equal(R.answerUsable("I don't know, I'm not sure what you mean by that at all here.").ok, false);
  assert.equal(R.answerUsable('Could you tell me which tenant you mean?').ok, false);
  assert.equal(R.answerUsable('The spend cap is twenty to seventy Canadian dollars a month and it covers every agent.').ok, true);
  ok();

  assert.equal(R.escalate('fast').name, 'standard');
  assert.equal(R.escalate('standard').name, 'deep');
  assert.equal(R.escalate('deep'), null, 'escalated past the top of the ladder');
  ok();
}

// ---- 10. The worker actually uses all of it ----
{
  const w = fs.readFileSync(path.join(root, 'scripts', 'axis-brain-worker.mjs'), 'utf8');
  assert.ok(w.includes("from './lib/axis-vault-brain.mjs'"), 'worker does not load the vault brain');
  assert.ok(w.includes("from './lib/axis-model-router.mjs'"), 'worker does not load the model router');
  assert.ok(/vault\.vaultTier\(/.test(w), 'worker never tries the vault before the model');
  assert.ok(/vault\.learn\(/.test(w), 'worker never writes learning back to the vault');
  assert.ok(/args\.push\('--model', tier\.model\)|args\.push\('--model', model\)/.test(w),
    'worker still calls the CLI without --model — every question runs on the default model');
  ok();

  // The vault must be consulted before the CLI is ever spawned, not after.
  const iVault = w.indexOf('vault.vaultTier(');
  const iAsk = w.indexOf('await askClaude(prompt', iVault);
  assert.ok(iVault > 0 && iAsk > iVault, 'the model is called before the vault is searched');
  ok();

  // Latency flags, measured 2026-08-12: 4355ms → 2609ms per answer.
  for (const f of ['--strict-mcp-config', '--no-session-persistence', '--exclude-dynamic-system-prompt-sections']) {
    assert.ok(w.includes(f), `worker lost the ${f} latency flag`);
  }
  ok();

  // No flag may carry a path. With shell:true on Windows, argv is concatenated unescaped, and this
  // repo lives under "ARIA — Real-Time AI Assistant" — a path argument would be shredded exactly
  // like the prompt was before it moved to stdin.
  // Inspect argv construction only: comments legitimately name these flags while explaining why
  // they are absent, and matching those would make the guard unfixable.
  const argvLines = w.split(/\r?\n/)
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .filter(l => /args\.push\(|FAST_FLAGS\s*=|spawn\(CLAUDE_BIN/.test(l))
    .join('\n');
  for (const bad of ['--mcp-config', '--system-prompt-file', '--settings', '--add-dir', '--agents']) {
    assert.ok(!argvLines.includes(bad),
      `path-valued flag ${bad} reached argv — the Windows shell will shred it`);
  }
  ok();

  // The prompt still rides stdin, never argv.
  assert.ok(/child\.stdin\.write\(/.test(w), 'the prompt no longer goes over stdin');
  ok();
}

fs.rmSync(tmp, { recursive: true, force: true });
// ---- 11. Claude Code executes on Opus 5; Cowork picks per request ----
// Ahmad, 2026-08-12: "ensure claude code uses opus 5 to execute unless I specify to use fable 5 or
// any other model. and claude cowork should use which ever model relevant based on what I ask. End
// goal is quality work."
//
// askClaudeIn() passed NO --model, so self.fix, machine.run and cowork.ask each ran on whatever the
// CLI session defaulted to - the same omission the router fixed for answering, one function over.
{
  // Execution has a flat quality floor. A wrong code edit costs far more than the tokens saved, so
  // it does NOT ride the cost ladder that answering uses.
  assert.equal(R.EXECUTE_MODEL, 'claude-opus-5');
  assert.equal(R.modelForRequest('fix the paywall firing twice', 'execute').model, 'claude-opus-5');
  assert.equal(R.modelForRequest('do something trivial', 'execute').model, 'claude-opus-5',
    'execution must not be routed down for being short');
  ok();

  // …unless Ahmad names a model.
  assert.equal(R.modelForRequest('use fable 5 to refactor billing', 'execute').model, 'claude-fable-5');
  assert.equal(R.modelForRequest('refactor it with opus 4.8', 'execute').model, 'claude-opus-4-8');
  assert.equal(R.modelForRequest('run that on haiku', 'execute').model, 'claude-haiku-4-5');
  assert.ok(R.modelForRequest('use fable 5 for this', 'execute').overridden, 'override must be flagged');
  ok();

  // A passing mention is not an instruction - otherwise asking about a model silently re-routes.
  assert.equal(R.modelOverride('why is opus so expensive these days'), null);
  assert.equal(R.modelOverride('the sonnet tier answered that one'), null);
  // A full model id is unambiguous by construction and always wins.
  assert.equal(R.modelOverride('please run claude-opus-4-7 on this'), 'claude-opus-4-7');
  ok();

  // Cowork matches the request, but never drops below `standard`: a planning conversation answered
  // on the fast tier is precisely the quality loss being guarded against.
  assert.equal(R.classify('what is the spend cap').tier, 'fast', 'baseline: this is a fast question');
  assert.equal(R.modelForRequest('what is the spend cap', 'cowork').model, R.TIER_BY_NAME.standard.model,
    'Cowork must be floored at standard, not routed down to haiku');
  assert.equal(R.modelForRequest('plan the migration end-to-end with trade-offs', 'cowork').model,
    R.TIER_BY_NAME.deep.model, 'a real planning ask still reaches the deep tier');
  ok();

  // The worker actually passes a model on all three Claude Code / Cowork paths.
  const w = fs.readFileSync(path.join(root, 'scripts', 'axis-brain-worker.mjs'), 'utf8');
  assert.ok(/function askClaudeIn\([^)]*model/.test(w), 'askClaudeIn still takes no model');
  assert.ok(w.includes("modelForRequest(arg, 'execute')"), 'execution paths do not resolve a model');
  assert.ok(w.includes("modelForRequest(arg, 'cowork')"), 'cowork does not resolve a model');
  // Every kind that RUNS something must resolve a model, and every kind that PLANS or ASKS must too.
  // Asserted per-kind rather than as a total count: the old `=== 2` failed the moment code.build was
  // added, which is a new execution path resolving a model correctly — the guard punished the fix.
  for (const [kind, purpose] of [['self.fix', 'execute'], ['code.build', 'execute'],
                                 ['machine.run', 'execute'], ['cowork.ask', 'cowork'],
                                 ['cowork.plan', 'cowork']]) {
    const start = w.indexOf(`kind === '${kind}'`);
    assert.ok(start > 0, `worker has no handler for ${kind}`);
    const body = w.slice(start, start + 2600);
    assert.ok(body.includes(`modelForRequest(arg, '${purpose}')`),
      `${kind} does not resolve a '${purpose}' model — it would run on the CLI session default`);
  }
  ok();

  // askClaudeIn must NOT inherit FAST_FLAGS: those strip MCP servers and dynamic system-prompt
  // sections, and cowork.ask / self.fix are meant to operate in the repo under CLAUDE.md.
  const inFn = w.slice(w.indexOf('function askClaudeIn'), w.indexOf('function askClaudeIn') + 700);
  assert.ok(!inFn.includes('FAST_FLAGS'), 'askClaudeIn must not strip MCP/CLAUDE.md context');
  ok();
}

console.log(`axis-vault-brain: ${n} checks passed`);
