#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const LOOP_DIR = path.join(STATE_DIR, 'loop-engineer');
const GOALS_FILE = path.join(LOOP_DIR, 'goals.json');
const LOOPS_FILE = path.join(LOOP_DIR, 'loops.json');
const BOARD_FILE = path.join(LOOP_DIR, 'loop-board.md');
const CLAUDE_PROMPT_FILE = path.join(LOOP_DIR, 'claude-next-prompt.md');
const CODEX_PROMPT_FILE = path.join(LOOP_DIR, 'codex-next-prompt.md');
const PACKETS_FILE = path.join(LOOP_DIR, 'loop-packets.jsonl');
const STATE_FILE = path.join(LOOP_DIR, 'supervisor-state.json');
const COLLAB_BRIEF = path.join(ROOT, 'docs', 'COLLAB_BRIEF.md');
const TOP_100 = path.join(ROOT, 'docs', 'TREND-RADAR-TOP-100-2026.md');
const TREND_SUMMARY = path.join(STATE_DIR, 'trend-radar', 'trend-radar-summary.md');
const CONTENT_SUMMARY = path.join(STATE_DIR, 'content-product-community', 'content-system.md');
const QUEUE_FILE = path.join(STATE_DIR, 'codex-claude-queue.md');
const nowIso = new Date().toISOString();

async function readText(file, fallback = '') {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return fallback;
  }
}

function includes(text, value) {
  return text.toLowerCase().includes(value.toLowerCase());
}

function firstLines(text, count = 12) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, count)
    .join('\n');
}

function buildGoals() {
  return {
    version: 1,
    updated_at: nowIso,
    active_goal: {
      id: 'iis-aria-market-ahead-system',
      title: 'IIS / ARIA market-ahead operating engine',
      objective: 'Keep IIS / ARIA several steps ahead by converting long-life demand into review-gated products, ARIA improvements, Growth Library assets, website conversion paths, and CEO final-action packets.',
      style: 'Ahmad x100: fast, practical, premium, revenue-focused, ethical, direct, and always moving safe work forward.',
      success_signals: [
        'top long-life trends are scored and review-gated',
        'products and demos are staged before competitors can copy the positioning',
        'ARIA gets better through phased, realistic, business-professional support behavior',
        'website and Growth Library assets move toward paid conversion',
        'Claude critiques strategy while Codex builds safe local slices',
        'Ahmad only sees final-action items and real blockers'
      ],
      approval_gates: [
        'send',
        'submit',
        'apply',
        'publish risky production changes',
        'create account',
        'pay or subscribe',
        'sign or certify',
        'delete or archive user work',
        'make public high-risk claims'
      ]
    }
  };
}

function buildLoop({ id, owner, priority, objective, evidence, nextSafeAction, nextPrompt, outputs, risks = [], prompts = [] }) {
  return {
    id,
    owner,
    priority,
    status: 'active',
    objective,
    evidence,
    next_safe_action: nextSafeAction,
    next_prompt: nextPrompt,
    outputs,
    risks,
    prompts_other_loops: prompts,
    approval_gates: [
      'No external send/submit/publish/payment/account/legal commitment without Ahmad.',
      'Keep outputs local, draft, or review-gated unless explicitly approved.'
    ],
    updated_at: nowIso
  };
}

async function buildLoops() {
  const trendSummary = await readText(TREND_SUMMARY);
  const contentSummary = await readText(CONTENT_SUMMARY);
  const top100 = await readText(TOP_100);
  const queue = await readText(QUEUE_FILE);
  const collab = await readText(COLLAB_BRIEF);

  return [
    buildLoop({
      id: 'trend-radar-loop',
      owner: 'Codex',
      priority: 95,
      objective: 'Keep a long-life demand map current and turn trends into review-gated product, content, demo, and ARIA KB candidates.',
      evidence: [
        top100 ? 'Top-100 long-life trend research pack exists.' : 'Top-100 trend pack missing.',
        trendSummary ? firstLines(trendSummary, 8) : 'Trend Radar summary missing.'
      ],
      nextSafeAction: 'Build local Trend Radar admin dashboard from generated JSON and review queue.',
      nextPrompt: 'Codex: build a local dashboard page for Trend Radar outputs with filters, scores, risk flags, review status, and export links. Do not publish.',
      outputs: [
        'docs/TREND-RADAR-TOP-100-2026.md',
        'senior-director-state/trend-radar/trend-radar.json',
        'senior-director-state/trend-radar/review-queue.json'
      ],
      prompts: ['product-pack-loop', 'qa-safety-loop']
    }),
    buildLoop({
      id: 'product-pack-loop',
      owner: 'Codex',
      priority: 92,
      objective: 'Turn high-fit trends into Growth Library products, previews, demos, and pricing drafts.',
      evidence: [
        contentSummary ? firstLines(contentSummary, 10) : 'Content/product/community summary missing.'
      ],
      nextSafeAction: 'Create local draft product records and preview copy from the first 9 product plans.',
      nextPrompt: 'Codex: convert the first 9 review-gated product plans into draft Growth Library product records and preview-page copy. Do not create Stripe links or publish.',
      outputs: [
        'senior-director-state/content-product-community/content-system.json',
        'senior-director-state/content-product-community/product-plans.csv'
      ],
      prompts: ['website-conversion-loop', 'qa-safety-loop']
    }),
    buildLoop({
      id: 'aria-behavior-loop',
      owner: 'Codex',
      priority: 90,
      objective: 'Make ARIA behave like a professional support agent: phased, realistic, short, question-first, and non-overwhelming.',
      evidence: [
        includes(queue, 'ARIA') ? 'ARIA work is present in queue/context.' : 'No fresh ARIA behavior packet found in current queue sample.',
        'Prior screenshots showed answer-dumping, duplicate ARIA responses, premature solutions, and weak issue-specific questioning.'
      ],
      nextSafeAction: 'Create an ARIA response-behavior QA checklist and patch plan tied to current UI/runtime files.',
      nextPrompt: 'Codex: inspect ARIA response generation and UI rendering paths, then patch phased response behavior and duplicate-message prevention. Keep answers short and ask the next relevant question before dumping solutions.',
      outputs: [
        'aria.html',
        'assets/aria-core.js',
        'assets/aria-v04-ext.js',
        'senior-director-state/aria-response-behavior-qa.md'
      ],
      risks: ['Do not hard-code individual fixes; encode reasoning flow and response policy.'],
      prompts: ['qa-safety-loop']
    }),
    buildLoop({
      id: 'website-conversion-loop',
      owner: 'Codex',
      priority: 86,
      objective: 'Move website, AI Edge, Growth Library, and product pages toward clean paid conversion without visual regressions.',
      evidence: [
        'Recent homepage/nav fixes must not be regressed.',
        'Prompt 3 product plans are review-gated and not ready for checkout.'
      ],
      nextSafeAction: 'Draft local preview copy and route map before touching production-facing product pages.',
      nextPrompt: 'Codex: prepare local preview copy/routes for the first product plans. Do not publish or add checkout until Ahmad verifies Stripe and approves public page changes.',
      outputs: ['growth-library.html', 'product.html', 'docs/COLLAB_BRIEF.md'],
      risks: ['Header/nav visual regression', 'dead payment links', 'unapproved paid claims'],
      prompts: ['qa-safety-loop']
    }),
    buildLoop({
      id: 'revenue-opportunity-loop',
      owner: 'Codex',
      priority: 84,
      objective: 'Keep bids, suppliers, leads, and CEO final-action packets moving without risky external action.',
      evidence: [queue ? firstLines(queue, 12) : 'Queue missing.'],
      nextSafeAction: 'Continue grounding supplier/lead lanes to submit/send/hold checklists only.',
      nextPrompt: 'Codex: pick the highest-value existing revenue lane, verify live facts, prefill/stage safe fields if available, and stop at Ahmad final action.',
      outputs: [
        'senior-director-state/ceo-approval-required.md',
        'senior-director-state/ceo-now-action-digest.md'
      ],
      risks: ['No form submission, no outreach send, no account creation.'],
      prompts: ['qa-safety-loop']
    }),
    buildLoop({
      id: 'claude-strategy-loop',
      owner: 'Claude Cowork',
      priority: 82,
      objective: 'Critique strategy, positioning, product quality, pricing, and next prompts so Codex builds the right slice fast.',
      evidence: [collab ? 'docs/COLLAB_BRIEF.md exists and is primary shared source.' : 'Shared brief missing.'],
      nextSafeAction: 'Ask Claude to review Loop Engineer board and return compact task packets.',
      nextPrompt: 'Claude Cowork: read docs/COLLAB_BRIEF.md, docs/LOOP-ENGINEER.md, senior-director-state/loop-engineer/loop-board.md, and critique the active loops. Return the best next three Codex packets with risks and approval gates.',
      outputs: [
        'senior-director-state/loop-engineer/claude-next-prompt.md',
        'senior-director-state/codex-claude-queue.md'
      ],
      prompts: ['codex-build-loop', 'product-pack-loop', 'aria-behavior-loop']
    }),
    buildLoop({
      id: 'qa-safety-loop',
      owner: 'Codex',
      priority: 80,
      objective: 'Protect IIS / ARIA from fake claims, platform abuse, legal exposure, payment risk, privacy issues, and visual regressions.',
      evidence: [
        'All generated products, trend assets, ARIA bits, demos, and claims must remain review-gated.',
        'Exact volume claims and public performance claims require evidence.'
      ],
      nextSafeAction: 'Run before any public page, checkout, external send, or ARIA authoritative response update.',
      nextPrompt: 'Codex: review the active loop output for claims, payment, privacy, legal, security, platform, and publish risks. Create a concise approval checklist.',
      outputs: ['senior-director-state/ceo-approval-required.md'],
      prompts: []
    }),
    buildLoop({
      id: 'codex-build-loop',
      owner: 'Codex',
      priority: 78,
      objective: 'Turn safe loop packets into files, scripts, tests, dashboards, and handoff notes.',
      evidence: ['This script generated the first Loop Engineer board.'],
      nextSafeAction: 'Build Trend Radar dashboard or local loop supervisor bridge plan next.',
      nextPrompt: 'Codex: implement the next highest-priority safe local artifact from the loop board, verify it, update memory, and stop at any approval gate.',
      outputs: ['scripts/loop-engineer.mjs', 'senior-director-state/loop-engineer/loop-board.md'],
      prompts: ['claude-strategy-loop']
    })
  ].sort((a, b) => b.priority - a.priority);
}

function boardMarkdown(goals, loops) {
  const lines = [
    '# Loop Engineer Board',
    '',
    `Updated: ${nowIso}`,
    '',
    '## Active Goal',
    '',
    `**${goals.active_goal.title}**`,
    '',
    goals.active_goal.objective,
    '',
    '## Active Loops',
    ''
  ];

  for (const loop of loops) {
    lines.push(`### ${loop.id}`);
    lines.push(`- Owner: ${loop.owner}`);
    lines.push(`- Priority: ${loop.priority}`);
    lines.push(`- Objective: ${loop.objective}`);
    lines.push(`- Next safe action: ${loop.next_safe_action}`);
    lines.push(`- Prompts other loops: ${loop.prompts_other_loops.length ? loop.prompts_other_loops.join(', ') : 'none'}`);
    lines.push(`- Main prompt: ${loop.next_prompt}`);
    lines.push(`- Approval gates: ${loop.approval_gates.join(' | ')}`);
    if (loop.risks.length) lines.push(`- Risks: ${loop.risks.join(' | ')}`);
    lines.push('');
  }

  lines.push('## Next Recommended Order');
  lines.push('');
  lines.push('1. Trend Radar dashboard');
  lines.push('2. Growth Library draft product records');
  lines.push('3. ARIA phased response patch');
  lines.push('4. Claude strategy critique');
  lines.push('5. Safe local loop supervisor bridge');
  lines.push('');
  lines.push('## Stop Rule');
  lines.push('');
  lines.push('Stop at send, submit, publish, pay, create account, sign, certify, delete, high-risk claim, or external commitment.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function claudePrompt(goals, loops) {
  const top = loops.slice(0, 5);
  return `# Claude Cowork Next Prompt

Read first:
- docs/COLLAB_BRIEF.md
- docs/LOOP-ENGINEER.md
- senior-director-state/loop-engineer/loop-board.md
- senior-director-state/codex-claude-queue.md

Goal:
${goals.active_goal.objective}

Task:
Critique the active loops below and return the best next three Codex packets. Keep it concise. Do not suggest external sends, paid tools, risky publish, fake volume claims, account creation, or legal/financial/medical/public-risk claims.

Active loops:
${top.map((loop) => `- ${loop.id}: ${loop.next_safe_action}`).join('\n')}

Return format:
- best next Codex packet
- why it matters now
- files to touch
- risks
- approval gates
- next prompt for Codex
`;
}

function codexPrompt(goals, loops) {
  const top = loops[0];
  return `# Codex Next Prompt

Read first:
- docs/COLLAB_BRIEF.md
- docs/LOOP-ENGINEER.md
- senior-director-state/loop-engineer/loop-board.md
- senior-director-state/codex-claude-queue.md

Goal:
${goals.active_goal.objective}

Next safe loop:
${top.id}

Task:
${top.next_prompt}

Rules:
- Work locally and review-gated.
- Do not send, submit, publish risky production changes, pay, create accounts, sign, certify, delete, or make high-risk public claims.
- Update AGENT_EXECUTION_NOTES.md, the automation memory, and the loop board after work.
`;
}

async function main() {
  await fs.mkdir(LOOP_DIR, { recursive: true });
  const goals = buildGoals();
  const loops = await buildLoops();
  const state = {
    version: 1,
    updated_at: nowIso,
    command_surface: ['/goal', '/loops', '/loop <id>', '/loop-prompt claude', '/loop-prompt codex'],
    active_goal_id: goals.active_goal.id,
    active_loop_id: loops[0]?.id || null,
    loop_count: loops.length,
    bridge_status: 'protocol-ready; authenticated always-on agent bridge not installed',
    external_actions_allowed: false
  };

  await fs.writeFile(GOALS_FILE, `${JSON.stringify(goals, null, 2)}\n`);
  await fs.writeFile(LOOPS_FILE, `${JSON.stringify({ version: 1, updated_at: nowIso, loops }, null, 2)}\n`);
  await fs.writeFile(BOARD_FILE, boardMarkdown(goals, loops));
  await fs.writeFile(CLAUDE_PROMPT_FILE, claudePrompt(goals, loops));
  await fs.writeFile(CODEX_PROMPT_FILE, codexPrompt(goals, loops));
  await fs.writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  await fs.appendFile(PACKETS_FILE, `${JSON.stringify({ at: nowIso, type: 'loop_engineer_run', active_goal: goals.active_goal.id, active_loop: state.active_loop_id, loop_count: loops.length })}\n`);

  console.log(`Loop Engineer generated ${loops.length} loops.`);
  console.log(`Board: ${path.relative(ROOT, BOARD_FILE)}`);
  console.log(`Claude prompt: ${path.relative(ROOT, CLAUDE_PROMPT_FILE)}`);
  console.log(`Codex prompt: ${path.relative(ROOT, CODEX_PROMPT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
