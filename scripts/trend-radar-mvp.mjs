#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const RADAR_DIR = path.join(STATE_DIR, 'trend-radar');
const INPUT_FILE = path.join(RADAR_DIR, 'keywords.csv');
const JSON_FILE = path.join(RADAR_DIR, 'trend-radar.json');
const CSV_FILE = path.join(RADAR_DIR, 'trend-radar.csv');
const REVIEW_FILE = path.join(RADAR_DIR, 'review-queue.json');
const MD_FILE = path.join(RADAR_DIR, 'trend-radar-summary.md');
const AUDIT_FILE = path.join(RADAR_DIR, 'audit-log.jsonl');

const nowIso = new Date().toISOString();

const seedKeywords = [
  {
    keyword: 'AI tutor for kids',
    category: 'education',
    region: 'US-CA',
    time_range: '90d',
    source: 'manual',
    notes: 'Family learning track candidate'
  },
  {
    keyword: 'AI productivity for adults',
    category: 'ai-edge',
    region: 'US-CA',
    time_range: '90d',
    source: 'manual',
    notes: 'Adult momentum studio candidate'
  },
  {
    keyword: 'AI agents for small business',
    category: 'business',
    region: 'US-CA',
    time_range: '90d',
    source: 'manual',
    notes: 'IIS service and Growth Library candidate'
  },
  {
    keyword: 'Microsoft 365 automation',
    category: 'it-support',
    region: 'CA',
    time_range: '90d',
    source: 'manual',
    notes: 'Managed service and guide candidate'
  },
  {
    keyword: 'cybersecurity awareness for small business',
    category: 'security',
    region: 'CA',
    time_range: '90d',
    source: 'manual',
    notes: 'Support product and service candidate'
  }
];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'trend';
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...data] = rows.filter((item) => item.some((cellValue) => cellValue.trim()));
  return data.map((item) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header.trim()] = (item[index] || '').trim();
    });
    return record;
  });
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function ensureInput() {
  await fs.mkdir(RADAR_DIR, { recursive: true });
  if (await fileExists(INPUT_FILE)) return;

  const headers = ['keyword', 'category', 'region', 'time_range', 'source', 'notes'];
  const body = seedKeywords
    .map((item) => headers.map((header) => escapeCsv(item[header])).join(','))
    .join('\n');
  await fs.writeFile(INPUT_FILE, `${headers.join(',')}\n${body}\n`);
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function scoreBand(text, bands) {
  for (const [patterns, score] of bands) {
    if (hasAny(text, patterns)) return score;
  }
  return 5;
}

function classifyLongevity(keyword, category) {
  const text = `${keyword} ${category}`.toLowerCase();
  if (hasAny(text, [/cyber/i, /security/i, /microsoft 365/i, /\bm365\b/i, /automation/i, /small business/i, /education/i, /kids/i])) {
    return 'Long';
  }
  if (hasAny(text, [/agent/i, /workflow/i, /productivity/i, /ai tutor/i])) {
    return 'Structural-Shift';
  }
  if (hasAny(text, [/holiday/i, /tax/i, /back to school/i, /summer/i, /season/i])) {
    return 'Seasonal';
  }
  if (hasAny(text, [/viral/i, /meme/i, /challenge/i, /trend/i])) {
    return 'Flash';
  }
  return 'Medium';
}

function scoreTrend(input) {
  const keyword = input.keyword || input.Keyword || '';
  const category = input.category || input.Category || 'uncategorized';
  const text = `${keyword} ${category} ${input.notes || ''}`.toLowerCase();

  const attention = scoreBand(text, [
    [[/\bai\b/i, /chatgpt/i, /agent/i, /automation/i], 9],
    [[/cyber/i, /security/i, /microsoft 365/i, /\bm365\b/i], 8],
    [[/business/i, /productivity/i, /kids/i, /education/i], 7]
  ]);
  const velocity = scoreBand(text, [
    [[/agent/i, /ai tutor/i, /creator/i, /automation/i], 9],
    [[/\bai\b/i, /workflow/i, /productivity/i], 8],
    [[/microsoft 365/i, /\bm365\b/i, /security/i], 6]
  ]);
  const longevity = scoreBand(text, [
    [[/cyber/i, /security/i, /automation/i, /small business/i, /education/i, /microsoft 365/i, /\bm365\b/i], 9],
    [[/productivity/i, /agent/i, /kids/i], 8],
    [[/viral/i, /meme/i], 3]
  ]);
  const revenuePotential = scoreBand(text, [
    [[/small business/i, /microsoft 365/i, /\bm365\b/i, /cyber/i, /security/i, /automation/i], 9],
    [[/adult/i, /productivity/i, /kids/i, /education/i, /tutor/i], 8],
    [[/\bai\b/i, /agent/i], 7]
  ]);
  const iisFit = scoreBand(text, [
    [[/microsoft 365/i, /\bm365\b/i, /cyber/i, /security/i, /small business/i, /automation/i], 9],
    [[/productivity/i, /workflow/i], 7],
    [[/kids/i, /education/i], 5]
  ]);
  const ariaFit = scoreBand(text, [
    [[/\bai\b/i, /agent/i, /tutor/i, /support/i, /workflow/i, /productivity/i], 9],
    [[/microsoft 365/i, /\bm365\b/i, /cyber/i, /security/i], 8],
    [[/small business/i], 7]
  ]);
  const growthLibraryFit = scoreBand(text, [
    [[/education/i, /kids/i, /adult/i, /productivity/i, /guide/i, /template/i], 9],
    [[/\bai\b/i, /automation/i, /microsoft 365/i, /\bm365\b/i], 8],
    [[/cyber/i, /security/i], 7]
  ]);
  const demoPotential = scoreBand(text, [
    [[/\bai\b/i, /agent/i, /automation/i, /tutor/i, /productivity/i], 9],
    [[/microsoft 365/i, /\bm365\b/i, /security/i], 7]
  ]);
  const competitionLevel = scoreBand(text, [
    [[/chatgpt/i, /\bai\b/i, /course/i], 8],
    [[/automation/i, /productivity/i], 6]
  ]);
  const ethicalFit = scoreBand(text, [
    [[/kids/i, /health/i, /finance/i, /investment/i, /legal/i], 6],
    [[/education/i, /security/i, /small business/i], 8],
    [[/\bai\b/i, /automation/i], 7]
  ]);
  const legalRisk = scoreBand(text, [
    [[/health/i, /medical/i, /investment/i, /tax/i, /legal/i], 8],
    [[/kids/i, /child/i, /student/i], 6],
    [[/cyber/i, /security/i], 5]
  ]);
  const buildDifficulty = scoreBand(text, [
    [[/agent/i, /enterprise/i, /security/i], 7],
    [[/microsoft 365/i, /\bm365\b/i, /automation/i], 6],
    [[/guide/i, /template/i, /education/i], 4]
  ]);

  const fitScore = (iisFit + ariaFit + growthLibraryFit + demoPotential) / 4;
  const riskScore = (legalRisk + competitionLevel + buildDifficulty + Math.max(0, 10 - ethicalFit)) / 4;
  const total = Math.round(Math.max(0, Math.min(100, (
    attention * 0.20 +
    velocity * 0.15 +
    longevity * 0.20 +
    fitScore * 0.20 +
    revenuePotential * 0.15 -
    riskScore * 0.10
  ) * 10)));

  return {
    attention,
    velocity,
    longevity,
    revenue_potential: revenuePotential,
    iis_fit: iisFit,
    aria_fit: ariaFit,
    growth_library_fit: growthLibraryFit,
    demo_potential: demoPotential,
    competition_level: competitionLevel,
    ethical_fit: ethicalFit,
    legal_risk: legalRisk,
    build_difficulty: buildDifficulty,
    fit_score: Number(fitScore.toFixed(2)),
    risk_score: Number(riskScore.toFixed(2)),
    total
  };
}

function riskFlags(keyword, category) {
  const text = `${keyword} ${category}`.toLowerCase();
  const flags = [];
  if (hasAny(text, [/money/i, /finance/i, /investment/i, /tax/i])) flags.push('money_or_finance_claim_review');
  if (hasAny(text, [/health/i, /medical/i, /wellness/i])) flags.push('health_claim_review');
  if (hasAny(text, [/legal/i, /contract/i])) flags.push('legal_claim_review');
  if (hasAny(text, [/kids/i, /child/i, /student/i])) flags.push('child_privacy_and_safety_review');
  if (hasAny(text, [/cyber/i, /security/i])) flags.push('security_accuracy_review');
  if (hasAny(text, [/affiliate/i, /referral/i])) flags.push('affiliate_disclosure_review');
  return flags;
}

function priceRange(score, category) {
  const text = category.toLowerCase();
  if (score >= 80 && hasAny(text, [/business/i, /security/i, /it-support/i])) return '$149-$499 starter pack; service upsell after review';
  if (score >= 75) return '$29-$99 digital product; $199+ guided implementation';
  return '$9-$49 intro product; validate before premium packaging';
}

function generateIdeas(input, score, longevityClass) {
  const keyword = input.keyword || input.Keyword || '';
  const category = input.category || input.Category || 'uncategorized';
  const title = keyword.replace(/\s+/g, ' ').trim();
  const audience = hasAny(`${keyword} ${category}`.toLowerCase(), [/kids/i, /child/i, /student/i])
    ? 'parents, tutors, and youth learners'
    : hasAny(`${keyword} ${category}`.toLowerCase(), [/business/i, /microsoft 365/i, /\bm365\b/i, /cyber/i, /security/i])
      ? 'small business owners and operators'
      : 'ambitious adults and practical AI learners';

  return {
    product: {
      title: `${title}: Practical Starter System`,
      target_customer: audience,
      problem_solved: `Helps ${audience} understand and apply ${title} without overwhelm.`,
      why_it_may_sell: `High practical fit with a ${score.total}/100 trend score and ${longevityClass} longevity.`,
      suggested_price_range: priceRange(score.total, category),
      format: 'guide + checklist + short demo + implementation worksheet',
      demo_idea: `10-minute ${title} readiness demo`,
      upsell_path: 'paid Growth Library pack -> guided setup -> IIS service or ARIA support lane',
      growth_library_fit: score.growth_library_fit,
      shop_fit: score.total >= 70 ? 'candidate' : 'validate first',
      iis_service_fit: score.iis_fit,
      aria_fit: score.aria_fit
    },
    content: {
      hook: `Most people are hearing about ${title}. Few know how to use it safely and practically.`,
      truth_layer: 'The tool is not the outcome. The system, habit, and decision quality create the outcome.',
      practical_value: `Show one clear use case, one safe first step, and one mistake to avoid for ${title}.`,
      personal_relevance: `Explain what this changes for ${audience}.`,
      empowerment: 'Start small, learn the pattern, keep control, and build confidence through action.',
      offer: 'Try the short demo, then choose the full guide or service path if it fits.',
      long_term_path: 'Learn -> practice -> build a repeatable system -> ask ARIA or IIS for help when stuck.',
      seo_keywords: [title, `${title} guide`, `${title} for beginners`, `${title} practical use`],
      social_post_idea: `A short post showing one real before/after workflow for ${title}.`,
      blog_outline: ['what it is', 'why it matters', 'safe first step', 'common mistake', 'how IIS/ARIA can help'],
      short_video_script_idea: `Open with the confusion around ${title}, show one simple workflow, end with a clear next step.`,
      faq: [`Is ${title} beginner-friendly?`, 'What should I avoid?', 'When should I ask for help?']
    },
    demo: {
      title: `10-minute ${title} preview`,
      value_shown: 'A clear recommendation, starter checklist, and next best action.',
      input_required: 'Goal, current skill level, main blocker, and preferred outcome.',
      output_preview: 'Short plan, risk note, starter step, and recommended product/service path.',
      time_limit: '10 minutes',
      free_vs_paid_boundary: 'Free preview gives direction; paid product gives full worksheets, examples, and implementation support.',
      upgrade_path: 'AI Edge / Growth Library product or IIS service consultation.',
      cost_estimate: '$0 platform cost for local MVP; future LLM/API cost requires approval.',
      conversion_goal: 'Move qualified users from curiosity to paid practical help.',
      privacy_note: 'Do not enter sensitive personal, health, financial, legal, or private business data.'
    }
  };
}

function toReviewQueue(item) {
  return [
    {
      id: `${item.id}-product`,
      trend_id: item.id,
      type: 'generated_product',
      title: item.generated.product.title,
      review_status: 'Needs review',
      risk_flags: item.risk_flags,
      approval_gate: 'Ahmad review before website, Shop, Stripe, or public claims'
    },
    {
      id: `${item.id}-content`,
      trend_id: item.id,
      type: 'generated_content',
      title: item.generated.content.hook,
      review_status: 'Needs review',
      risk_flags: item.risk_flags,
      approval_gate: 'Human review before publish'
    },
    {
      id: `${item.id}-demo`,
      trend_id: item.id,
      type: 'generated_demo',
      title: item.generated.demo.title,
      review_status: 'Needs review',
      risk_flags: item.risk_flags,
      approval_gate: 'Human review before public demo'
    },
    {
      id: `${item.id}-aria-bit`,
      trend_id: item.id,
      type: 'aria_kb_pending_bit',
      title: item.generated.product.title,
      review_status: 'pending',
      risk_flags: item.risk_flags,
      approval_gate: 'ARIA must not serve as authoritative until approved'
    }
  ];
}

function buildRecord(input, index) {
  const keyword = input.keyword || input.Keyword || `Untitled trend ${index + 1}`;
  const category = input.category || input.Category || 'uncategorized';
  const score = scoreTrend({ ...input, keyword, category });
  const longevityClass = classifyLongevity(keyword, category);
  const generated = generateIdeas({ ...input, keyword, category }, score, longevityClass);
  const flags = riskFlags(keyword, category);

  return {
    id: `${slugify(keyword)}-${index + 1}`,
    keyword,
    category,
    region: input.region || input.Region || 'unspecified',
    time_range: input.time_range || input.timeRange || input.TimeRange || 'unspecified',
    source: input.source || input.Source || 'manual',
    notes: input.notes || input.Notes || '',
    created_at: nowIso,
    updated_at: nowIso,
    status: 'Draft',
    confidence_score: input.source ? 0.65 : 0.55,
    review_status: 'Needs review',
    score,
    longevity: longevityClass,
    risk_flags: flags,
    generated
  };
}

function csvExport(records) {
  const headers = [
    'id',
    'keyword',
    'category',
    'region',
    'time_range',
    'source',
    'total_score',
    'longevity',
    'review_status',
    'risk_flags',
    'product_title',
    'suggested_price_range'
  ];
  const rows = records.map((record) => [
    record.id,
    record.keyword,
    record.category,
    record.region,
    record.time_range,
    record.source,
    record.score.total,
    record.longevity,
    record.review_status,
    record.risk_flags.join('|'),
    record.generated.product.title,
    record.generated.product.suggested_price_range
  ]);
  return `${headers.join(',')}\n${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}\n`;
}

function markdownExport(records) {
  const lines = [
    '# Trend Radar MVP Summary',
    '',
    `Generated: ${nowIso}`,
    '',
    'No external APIs, scraping, publishing, payment, or LLM calls were used.',
    ''
  ];

  for (const record of records) {
    lines.push(`## ${record.keyword}`);
    lines.push(`- Score: ${record.score.total}/100`);
    lines.push(`- Longevity: ${record.longevity}`);
    lines.push(`- Review status: ${record.review_status}`);
    lines.push(`- Risk flags: ${record.risk_flags.length ? record.risk_flags.join(', ') : 'none'}`);
    lines.push(`- Product: ${record.generated.product.title}`);
    lines.push(`- Price range: ${record.generated.product.suggested_price_range}`);
    lines.push(`- Demo: ${record.generated.demo.title}`);
    lines.push(`- Next gate: human review before public use`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  await ensureInput();
  const inputText = await fs.readFile(INPUT_FILE, 'utf8');
  const inputs = parseCsv(inputText).filter((item) => item.keyword || item.Keyword);
  const records = inputs.map(buildRecord).sort((a, b) => b.score.total - a.score.total);
  const reviewQueue = records.flatMap(toReviewQueue);

  await fs.writeFile(JSON_FILE, `${JSON.stringify({ version: 1, updated_at: nowIso, records }, null, 2)}\n`);
  await fs.writeFile(CSV_FILE, csvExport(records));
  await fs.writeFile(REVIEW_FILE, `${JSON.stringify({ version: 1, updated_at: nowIso, items: reviewQueue }, null, 2)}\n`);
  await fs.writeFile(MD_FILE, markdownExport(records));
  await fs.appendFile(AUDIT_FILE, `${JSON.stringify({ at: nowIso, event: 'trend_radar_mvp_run', input_count: inputs.length, output_count: records.length })}\n`);

  console.log(`Trend Radar MVP processed ${records.length} keywords.`);
  console.log(`Input: ${path.relative(ROOT, INPUT_FILE)}`);
  console.log(`JSON: ${path.relative(ROOT, JSON_FILE)}`);
  console.log(`CSV: ${path.relative(ROOT, CSV_FILE)}`);
  console.log(`Review: ${path.relative(ROOT, REVIEW_FILE)}`);
  console.log(`Markdown: ${path.relative(ROOT, MD_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
