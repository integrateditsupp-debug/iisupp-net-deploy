#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const OUT_DIR = path.join(STATE_DIR, 'content-product-community');
const JSON_FILE = path.join(OUT_DIR, 'content-system.json');
const MD_FILE = path.join(OUT_DIR, 'content-system.md');
const CSV_FILE = path.join(OUT_DIR, 'product-plans.csv');
const REVIEW_FILE = path.join(OUT_DIR, 'review-queue.json');
const AUDIT_FILE = path.join(OUT_DIR, 'audit-log.jsonl');
const nowIso = new Date().toISOString();

const toneRules = {
  tone: [
    'human',
    'clean',
    'wise',
    'confident',
    'direct',
    'premium',
    'strong but humble',
    'inspiring but practical'
  ],
  use: [
    'Here is what is really happening.',
    'Here is why people care.',
    'Here is the useful part.',
    'Here is the risk.',
    'Here is the better path.',
    'You can choose what fits you.',
    'If you want to build from this, start here.',
    'Turn attention into ability.',
    'Turn curiosity into skill.',
    'Turn a trend into an asset.'
  ],
  avoid: [
    'Guaranteed success',
    'Get rich quick',
    'Secret hack nobody knows',
    'This will change your life overnight',
    'You are behind if you do not buy this',
    'Limited time only, unless true',
    'Everyone is doing this, unless proven',
    'No-risk promise',
    'Pressure-based urgency'
  ]
};

const contentFlow = [
  'Attention Hook',
  'Emotional Mirror',
  'Truth Layer',
  'Practical Explanation',
  'Opportunity Layer',
  'Demo Invitation',
  'Choice-Based Offer',
  'Long-Term Growth Path'
];

const productPageTemplate = [
  'Product title',
  'One-line promise',
  'Who it is for',
  'Problem it solves',
  'What is included',
  'Preview/sample',
  'Skill level',
  'Time to complete',
  'Format',
  'Price',
  'FAQ',
  'Privacy note if needed',
  'Related products',
  'DIY path',
  'Done-for-you path',
  'ARIA support path',
  'IIS implementation path',
  'Community path'
];

const landingPageTemplate = [
  'Quiet premium hero',
  'Trend or pain-point context',
  'What is real',
  'What to avoid',
  'What you can build',
  'Preview block',
  'Product path',
  'ARIA support path',
  'IIS implementation path',
  'Community path',
  'Plain FAQ',
  'Choice-based CTA'
];

const demoPageTemplate = [
  'Strong title',
  'Clear promise',
  'What user enters',
  'What user gets',
  'What is limited',
  'What is locked',
  'Why upgrade',
  'Trust note',
  'Privacy note',
  'CTA'
];

const bridgeTemplate = [
  'What is trending?',
  'Why people want it.',
  'What emotion it speaks to.',
  'What value it actually gives.',
  'What is hype.',
  'What to consider before buying.',
  'Smarter alternatives.',
  'What the same money could build.',
  'IIS / ARIA / Growth Library related path.',
  'Clear disclosure of any service, referral, or concierge fee.',
  'Free user choice.'
];

const communityPrompts = [
  'What did you build from this?',
  'What did you learn today?',
  'What trend do you think is hype?',
  'What trend do you think will last?',
  'What skill are you trying to build?',
  'Share your before/after workflow.',
  'Share one useful tool, not one brag.',
  'Help someone solve one problem today.'
];

const communityRanking = [
  'helpfulness',
  'consistency',
  'useful answers',
  'completed learning paths',
  'shared builds',
  'kindness',
  'practical contribution'
];

const dashboardCopy = {
  labels: [
    'Your Growth Path',
    'Skills Started',
    'Skills Completed',
    'Demos Tried',
    'Tools Built',
    'Time Invested',
    'Knowledge Unlocked',
    'Next Best Step',
    'Your Builder Level',
    'Your Practical Wins',
    'Continue Your Path'
  ],
  levels: ['Beginner', 'Builder', 'Skilled', 'Advanced', 'Creator', 'Leader'],
  message: 'You are not just watching trends. You are learning how to use them.'
};

const ctaLibrary = [
  'Try the 10-minute preview',
  'Start with the free sample',
  'Download the guide',
  'Use ARIA for help',
  'Join Growth Library',
  'Ask IIS to build it',
  'Book a consultation',
  'Continue your path',
  'Choose the lane that fits you'
];

const productPlans = [
  {
    id: 'l1-troubleshooting-bible',
    title: 'Level 1 IT Support Troubleshooting Bible',
    subtitle: 'A practical first-response system for common user issues.',
    target_customer: 'new support techs, small teams, and operators managing basic IT support',
    why_it_sells: 'L1 issues are frequent, urgent, and costly when handled without structure.',
    includes: ['triage flow', 'question bank', 'issue categories', 'safe first steps', 'handoff notes', 'ticket examples'],
    preview: 'Five common tickets with the exact first questions to ask.',
    demo: '10-minute ticket triage preview',
    price_range: '$39-$99',
    upsell_path: 'Help desk blueprint, ARIA support lane, or IIS support setup',
    iis_service: 'Help desk process setup',
    aria_feature: 'guided troubleshooting flow',
    community_challenge: 'Resolve one sample ticket using the triage tree.',
    seo: ['level 1 IT support guide', 'help desk troubleshooting', 'IT ticket triage']
  },
  {
    id: 'm365-helpdesk-kb-pack',
    title: 'Microsoft 365 Help Desk KB Pack',
    subtitle: 'Ready-to-review support knowledge for common Microsoft 365 problems.',
    target_customer: 'small businesses, MSPs, and internal support teams',
    why_it_sells: 'Microsoft 365 problems repeat daily and need consistent answers.',
    includes: ['Outlook fixes', 'Teams checks', 'OneDrive sync steps', 'SharePoint basics', 'escalation triggers'],
    preview: 'Outlook not opening quick triage article.',
    demo: '10-minute M365 issue classifier',
    price_range: '$49-$149',
    upsell_path: 'M365 tune-up, ARIA KB integration, or IIS managed support',
    iis_service: 'Microsoft 365 support tune-up',
    aria_feature: 'M365 issue routing',
    community_challenge: 'Submit one cleaned-up M365 fix article.',
    seo: ['Microsoft 365 help desk KB', 'M365 troubleshooting', 'Outlook Teams OneDrive fixes']
  },
  {
    id: 'ai-agent-starter-kit-small-business',
    title: 'AI Agent Starter Kit for Small Business',
    subtitle: 'A safe first map for using AI agents in real business workflows.',
    target_customer: 'small business owners and operations leads',
    why_it_sells: 'Businesses want AI agents but need clarity, safety, and practical workflow boundaries.',
    includes: ['agent use-case map', 'risk checklist', 'workflow worksheet', 'starter prompts', 'approval gates'],
    preview: 'AI agent fit checklist for one workflow.',
    demo: '10-minute AI agent use-case finder',
    price_range: '$49-$199',
    upsell_path: 'AI workflow audit, ARIA assistant setup, or IIS implementation',
    iis_service: 'AI workflow audit',
    aria_feature: 'workflow helper and action checklist',
    community_challenge: 'Map one repetitive task into an agent-safe workflow.',
    seo: ['AI agents for small business', 'AI workflow automation', 'small business AI starter kit']
  },
  {
    id: 'prompt-engineering-workflows',
    title: 'Prompt Engineering for Workflows',
    subtitle: 'Practical prompt systems for work that needs repeatable output.',
    target_customer: 'professionals, admins, support teams, and business owners',
    why_it_sells: 'People do not need random prompts. They need repeatable work systems.',
    includes: ['prompt patterns', 'workflow examples', 'quality checks', 'handoff prompts', 'revision prompts'],
    preview: 'One prompt chain for turning messy notes into a task plan.',
    demo: '10-minute prompt workflow builder',
    price_range: '$29-$99',
    upsell_path: 'Growth Library bundle or custom workflow build',
    iis_service: 'workflow automation setup',
    aria_feature: 'prompt coach and output reviewer',
    community_challenge: 'Share one prompt that improved a real workflow.',
    seo: ['prompt engineering workflows', 'AI prompts for work', 'prompt systems']
  },
  {
    id: 'windows-11-troubleshooting-kb',
    title: 'Windows 11 Troubleshooting KB',
    subtitle: 'Clear support steps for common Windows 11 user problems.',
    target_customer: 'support techs, small offices, and power users',
    why_it_sells: 'Windows issues are common and users need safe baby-step instructions.',
    includes: ['startup checks', 'update fixes', 'performance triage', 'printer checks', 'network checks'],
    preview: 'Windows slow-start checklist.',
    demo: '10-minute Windows issue sorter',
    price_range: '$29-$79',
    upsell_path: 'endpoint support pack, ARIA troubleshooting, or IIS remote support',
    iis_service: 'Windows endpoint support',
    aria_feature: 'Windows guided fix flow',
    community_challenge: 'Document one Windows fix in simple user language.',
    seo: ['Windows 11 troubleshooting', 'Windows 11 help desk KB', 'Windows support guide']
  },
  {
    id: 'outlook-fix-guide',
    title: 'Outlook Fix Guide',
    subtitle: 'Short, safe fixes for Outlook launch, sync, search, and mailbox issues.',
    target_customer: 'end users, admins, and support desks',
    why_it_sells: 'Outlook issues block work and need fast, non-technical guidance.',
    includes: ['launch triage', 'safe mode check', 'profile warning signs', 'sync checks', 'handoff brief'],
    preview: 'Outlook will not open first three checks.',
    demo: '10-minute Outlook issue guide',
    price_range: '$19-$59',
    upsell_path: 'M365 KB Pack, ARIA Outlook assistant, or IIS support call',
    iis_service: 'Outlook/M365 support',
    aria_feature: 'Outlook guided questions and brief builder',
    community_challenge: 'Rewrite one Outlook fix for a non-technical user.',
    seo: ['Outlook not opening fix', 'Outlook troubleshooting guide', 'Outlook help desk']
  },
  {
    id: 'ai-helpdesk-automation-blueprint',
    title: 'AI Help Desk Automation Blueprint',
    subtitle: 'A practical architecture for safer AI-assisted support.',
    target_customer: 'support leaders, MSPs, and small IT teams',
    why_it_sells: 'Teams want AI support automation but need escalation, review, and safety rules.',
    includes: ['triage architecture', 'KB intake rules', 'review gates', 'handoff model', 'quality checklist'],
    preview: 'AI help desk safety checklist.',
    demo: '10-minute help desk automation readiness score',
    price_range: '$99-$299',
    upsell_path: 'ARIA support deployment or IIS implementation project',
    iis_service: 'help desk automation build',
    aria_feature: 'support agent workflow and escalation',
    community_challenge: 'Design one safe automation rule for a real support issue.',
    seo: ['AI help desk automation', 'AI support blueprint', 'automated help desk workflow']
  },
  {
    id: 'cybersecurity-basics-employees',
    title: 'Cybersecurity Basics for Employees',
    subtitle: 'Simple security habits employees can actually remember and use.',
    target_customer: 'small businesses, managers, and non-technical employees',
    why_it_sells: 'Security training often fails because it is too abstract or too long.',
    includes: ['phishing basics', 'password habits', 'MFA explanation', 'safe reporting script', 'manager checklist'],
    preview: 'Phishing red flags one-page guide.',
    demo: '10-minute phishing decision practice',
    price_range: '$29-$99',
    upsell_path: 'security awareness pack, ARIA security coach, or IIS security tune-up',
    iis_service: 'security awareness setup',
    aria_feature: 'security question guide and escalation',
    community_challenge: 'Share one plain-language security habit that helped your team.',
    seo: ['cybersecurity basics for employees', 'security awareness small business', 'phishing training basics']
  },
  {
    id: 'no-code-automation-kit',
    title: 'No-Code Automation Kit',
    subtitle: 'A practical kit for turning repetitive work into simple automations.',
    target_customer: 'small business owners, admins, creators, and operations teams',
    why_it_sells: 'Repetitive work wastes time, but most people need a safe map before tools.',
    includes: ['automation finder', 'workflow map', 'tool selection checklist', 'risk checks', 'handoff prompts'],
    preview: 'Find one automation worth building this week.',
    demo: '10-minute automation opportunity finder',
    price_range: '$39-$129',
    upsell_path: 'workflow audit, Growth Library bundle, or IIS done-for-you build',
    iis_service: 'workflow automation implementation',
    aria_feature: 'automation idea coach',
    community_challenge: 'Share one before/after workflow that saved time.',
    seo: ['no-code automation kit', 'workflow automation guide', 'small business automation']
  }
];

const emailTemplates = [
  {
    name: 'Free preview follow-up',
    subject: 'Your next practical step',
    body: 'You tried the preview. The useful next step is to pick one workflow, one issue, or one skill and build from there. If you want the full guide, ARIA help, or IIS implementation, choose the lane that fits.'
  },
  {
    name: 'Product purchase follow-up',
    subject: 'Start here first',
    body: 'Start with the first checklist. Do not try to finish everything at once. Complete one useful step, then come back for the next one.'
  },
  {
    name: 'Community invitation',
    subject: 'Build with people learning the same thing',
    body: 'If you want to keep going, join the community path. Share what you built, what confused you, and one useful thing you learned.'
  }
];

const socialTemplates = [
  'A trend is only useful if it becomes a skill, a better decision, or a system you can use.',
  'The tool is not the outcome. The workflow, habit, and judgment around it matter.',
  'Turn attention into ability. Start with one practical use case.',
  'Do not chase every trend. Learn which ones can become assets.'
];

const journeys = {
  trend_to_purchase: [
    'notice trend',
    'read truth layer',
    'try 10-minute preview',
    'compare DIY, ARIA, IIS, and Growth Library paths',
    'choose product if it fits',
    'continue through checklist'
  ],
  trend_to_community: [
    'notice trend',
    'learn useful part',
    'try one small build',
    'share before/after workflow',
    'help another member',
    'continue learning path'
  ],
  trend_to_iis_service: [
    'notice business need',
    'complete preview or audit',
    'receive risk and value summary',
    'book consultation',
    'approve scope',
    'IIS builds or supports implementation'
  ],
  trend_to_aria: [
    'notice problem',
    'ask ARIA',
    'ARIA asks relevant questions',
    'ARIA gives baby-step guidance',
    'ARIA creates handoff brief if needed',
    'user chooses guide, support, or service path'
  ]
};

function escapeCsv(value) {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function productCsv(products) {
  const headers = [
    'id',
    'title',
    'target_customer',
    'price_range',
    'iis_service',
    'aria_feature',
    'review_status',
    'seo'
  ];
  const rows = products.map((product) => [
    product.id,
    product.title,
    product.target_customer,
    product.price_range,
    product.iis_service,
    product.aria_feature,
    'Needs review',
    product.seo
  ]);
  return `${headers.join(',')}\n${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}\n`;
}

function reviewItems(products) {
  return products.flatMap((product) => [
    {
      id: `${product.id}-product-page`,
      type: 'product_page_plan',
      title: product.title,
      review_status: 'Needs review',
      approval_gate: 'Ahmad review before public page, checkout, Stripe link, or claims',
      risk_flags: []
    },
    {
      id: `${product.id}-demo`,
      type: 'demo_plan',
      title: product.demo,
      review_status: 'Needs review',
      approval_gate: 'Human review before public demo',
      risk_flags: []
    },
    {
      id: `${product.id}-community`,
      type: 'community_challenge',
      title: product.community_challenge,
      review_status: 'Needs review',
      approval_gate: 'Human review before public community launch',
      risk_flags: []
    }
  ]);
}

function markdown(system) {
  const lines = [
    '# Content Product Community MVP',
    '',
    `Generated: ${nowIso}`,
    '',
    'No public publish, checkout, email send, community launch, donation collection, paid API, or LLM call was performed.',
    '',
    '## Content Strategy',
    '',
    'Every trend should turn attention into awareness, trust, skill, transformation, community, and long-term value.',
    '',
    'Flow:',
    ...system.content_flow.map((item) => `- ${item}`),
    '',
    '## Growth Library Positioning',
    '',
    system.growth_library.positioning,
    '',
    '## First Product Plans',
    ''
  ];

  for (const product of system.product_plans) {
    lines.push(`### ${product.title}`);
    lines.push(`- Subtitle: ${product.subtitle}`);
    lines.push(`- Target customer: ${product.target_customer}`);
    lines.push(`- Why it sells: ${product.why_it_sells}`);
    lines.push(`- Free preview: ${product.preview}`);
    lines.push(`- Demo: ${product.demo}`);
    lines.push(`- Price range: ${product.price_range}`);
    lines.push(`- Upsell path: ${product.upsell_path}`);
    lines.push(`- IIS service: ${product.iis_service}`);
    lines.push(`- ARIA feature: ${product.aria_feature}`);
    lines.push(`- Community challenge: ${product.community_challenge}`);
    lines.push(`- Review status: Needs review`);
    lines.push('');
  }

  lines.push('## Ethical Conversion Rules');
  lines.push('- Users must feel informed, respected, free to choose, and more capable.');
  lines.push('- No fake urgency, fake proof, shame, guaranteed results, or hidden fees.');
  lines.push('- Public pages, checkout, email sends, community launch, and donation copy require review.');
  lines.push('');
  lines.push('## Next Build Step');
  lines.push('- Turn these reviewed plans into draft Growth Library product records and preview pages.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const system = {
    version: 1,
    generated_at: nowIso,
    content_flow: contentFlow,
    tone_rules: toneRules,
    product_page_template: productPageTemplate,
    landing_page_template: landingPageTemplate,
    demo_page_template: demoPageTemplate,
    external_product_bridge_template: bridgeTemplate,
    required_bridge_message: 'If you still want the product, that is your choice. Our role is to help you see the full picture before you spend.',
    growth_library: {
      positioning: 'Practical intelligence packs for people, businesses, and AI systems.',
      human_tracks: [
        'Learn AI',
        'Learn automation',
        'Learn IT support',
        'Learn troubleshooting',
        'Learn prompt engineering',
        'Learn Microsoft 365 support',
        'Learn cybersecurity basics',
        'Learn workflow design',
        'Learn business systems'
      ],
      ai_system_tracks: [
        'AI-readable KB packs',
        'SOPs',
        'Escalation flows',
        'Troubleshooting trees',
        'Ticket triage packs',
        'Help desk automation knowledge',
        'Support agent training materials'
      ]
    },
    community: {
      prompts: communityPrompts,
      ranking_rewards: communityRanking,
      avoid: ['ego-based ranking', 'brag-first prompts', 'shame', 'pressure']
    },
    dashboard_copy: dashboardCopy,
    donation_copy: 'Optional contribution: Support digital literacy, AI education, and practical learning resources. We will only claim impact that we can actually track and verify.',
    cta_library: ctaLibrary,
    email_templates: emailTemplates,
    social_templates: socialTemplates,
    journeys,
    product_plans: productPlans.map((product) => ({ ...product, review_status: 'Needs review' }))
  };

  const review = {
    version: 1,
    generated_at: nowIso,
    items: [
      ...reviewItems(productPlans),
      {
        id: 'donation-copy',
        type: 'donation_messaging',
        title: 'Donation layer copy',
        review_status: 'Needs review',
        approval_gate: 'Ahmad review before public donation or contribution feature',
        risk_flags: ['impact_claim_review']
      },
      {
        id: 'external-product-bridge-template',
        type: 'external_product_bridge',
        title: 'External product bridge template',
        review_status: 'Needs review',
        approval_gate: 'Human review before referral, concierge, affiliate, or product-fee language',
        risk_flags: ['fee_disclosure_review']
      }
    ]
  };

  await fs.writeFile(JSON_FILE, `${JSON.stringify(system, null, 2)}\n`);
  await fs.writeFile(MD_FILE, markdown(system));
  await fs.writeFile(CSV_FILE, productCsv(system.product_plans));
  await fs.writeFile(REVIEW_FILE, `${JSON.stringify(review, null, 2)}\n`);
  await fs.appendFile(AUDIT_FILE, `${JSON.stringify({ at: nowIso, event: 'content_product_community_mvp_run', product_count: productPlans.length, review_count: review.items.length })}\n`);

  console.log(`Content/Product/Community MVP generated ${productPlans.length} product plans.`);
  console.log(`JSON: ${path.relative(ROOT, JSON_FILE)}`);
  console.log(`Markdown: ${path.relative(ROOT, MD_FILE)}`);
  console.log(`CSV: ${path.relative(ROOT, CSV_FILE)}`);
  console.log(`Review: ${path.relative(ROOT, REVIEW_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
