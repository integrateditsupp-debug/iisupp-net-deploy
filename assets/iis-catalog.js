/* ============================================================================
   IIS PRODUCT CATALOG — single source of truth for Shop + Growth Library.
   ----------------------------------------------------------------------------
   Add a product = add ONE object to PRODUCTS below. It then appears on every
   page that renders from this catalog (Shop hub + Growth Library vault), with
   the right section/category, audience badge, price, and a working Stripe
   checkout button. This IS the scalable "product creation engine".

   Delivery model:
     - free:true            -> preview/download opens directly
     - paid                 -> Stripe Checkout (existing /stripe-checkout priceData)
                               on success Stripe redirects to /unlock.html
     - digital library item -> /library-download verifies the paid Stripe session
                               and serves the entitled content through a secure
                               personal access link.

   Prices are STARTING prices in USD cents — edit freely.
   ============================================================================ */
(function () {
  'use strict';

  var META = {
    brand: 'Integrated IT Support',
    email: 'ahmad.wasee@iisupp.net',
    phone: '+16475813182',
    phoneLabel: '(647) 581-3182',
    successUrl: '/unlock.html',
    affiliateNote: 'Affiliate links coming soon — meanwhile these are our genuine recommendations.'
  };

  // Growth Library categories (left-rail filter). 'all' shows everything.
  var GL_CATEGORIES = [
    'Featured', 'For Humans', 'For AI Systems', 'AI Skills', 'IT Support',
    'Hardware Troubleshooting', 'Software Troubleshooting', 'Cybersecurity Basics',
    'Cloud & Automation', 'Business Automation', 'AI Agents & Prompting',
    'Mini Scripts / Agents', 'Knowledge Base Packs', 'Mindset & Life', 'Premium Bundles'
  ];

  // Shop hub sections, in display order.
  var SHOP_SECTIONS = [
    { id: 'tech-support',    title: 'Tech Support & ARIA',          note: 'Service · subscription' },
    { id: 'recommended',     title: 'In-Stock Devices',             note: 'Physical · buy now' },
    { id: 'order-concierge', title: 'Order Through Us · Concierge',  note: 'Physical · we source & deliver' },
    { id: 'guides',          title: 'IT & AI How-To Guides',         note: 'Digital · KB-format PDFs' },
    { id: 'bundles',         title: 'Premium Bundles',              note: 'Digital · best value' },
    { id: 'growth-library',  title: 'The Growth Library',           note: 'Digital · learning vault' }
  ];

  // Audience badges
  var AUD = { human: 'For Humans', ai: 'For AI Systems', business: 'For Business', it: 'For IT Teams' };

  /* ---- THE PRODUCTS ----------------------------------------------------- */
  var PRODUCTS = [
    {
      id: 'gl-l1-it-bible',
      title: 'Level 1 IT Support Troubleshooting Bible',
      blurb: 'The field-tested first-response playbook every help-desk agent wishes they had on day one.',
      long: 'A complete, plain-English Level 1 playbook: how to triage, what to try, what is user-safe vs admin-only, and exactly when to escalate. Written from real support workflows — not theory. Ships as a polished PDF plus an AI-readable knowledge-base version your tools can ingest.',
      inside: ['Common L1 issues + triage mindset', 'Password reset & MFA recovery workflows', 'Outlook, Teams, printer, Wi-Fi & VPN fixes', 'Slow-computer & browser checklists', 'User-safe vs admin-only step separation', 'Escalation rules + ticket-note examples', 'AI-readable KB version included'],
      priceCents: 11700, category: 'IT Support', section: 'guides',
      audience: ['human', 'it', 'business'], format: 'PDF + AI-readable KB',
      tags: ['it support', 'help desk', 'troubleshooting', 'level 1', 'desktop support'],
      seo: ['level 1 IT support guide', 'help desk troubleshooting guide', 'desktop support troubleshooting'],
      free: false, password: true, featured: true, trendScore: 90,
      preview: '/downloads/library/l1-it-support-bible-preview.html', file: null,
      related: ['gl-service-desk-sop-pack', 'gl-win11-kb', 'gl-outlook-fix', 'gl-m365-kb'], bundle: 'bundle-it-mastery', upsell: 'service'
    },
    {
      id: 'gl-m365-kb',
      title: 'Microsoft 365 Help Desk KB Pack',
      blurb: 'Clean, structured M365 support documentation your team — and your AI — can actually use.',
      long: 'A done-for-you Microsoft 365 knowledge base in SOP format: every common Outlook, Teams, OneDrive, SharePoint, licensing and MFA issue, with admin-center checks and escalation paths. Delivered human-readable and as structured AI-readable files for help-desk agents and AI support systems alike.',
      inside: ['Outlook / Teams / OneDrive / SharePoint fixes', 'MFA, password reset & licensing issues', 'Mailbox & calendar troubleshooting', 'Admin-center checks + escalation paths', 'SOP format, ready to drop into your wiki', 'AI-readable KB files (JSON) included'],
      priceCents: 38700, category: 'Knowledge Base Packs', section: 'guides',
      audience: ['ai', 'business', 'it'], format: 'SOP PDF + AI-readable KB (JSON)',
      tags: ['microsoft 365', 'm365 support', 'help desk knowledge base', 'sop'],
      seo: ['microsoft 365 support guide', 'help desk knowledge base', 'm365 troubleshooting kb'],
      free: false, password: true, featured: true, trendScore: 88,
      preview: '/downloads/library/m365-help-desk-kb-preview.html', file: null,
      related: ['gl-outlook-fix', 'gl-l1-it-bible', 'gl-helpdesk-blueprint'], bundle: 'bundle-it-mastery', upsell: 'service'
    },
    {
      id: 'gl-ai-agent-starter',
      title: 'AI Agent Starter Kit for Small Business',
      blurb: 'Stop wondering where to start with AI agents. This is the safe, practical on-ramp.',
      long: 'A no-jargon roadmap for deploying your first AI agents: which use-cases are safe, what to automate first, the prompt templates to use, and the privacy/risk checklist to stay out of trouble. Built for owners and operators who want results without a data-science team.',
      inside: ['What AI agents are (and are not)', 'Safe first use-cases: support, intake, email, follow-up', 'Booking & internal knowledge-assistant patterns', 'Ready-to-use prompt templates', 'Tool recommendations + setup checklist', 'Risk & privacy checklist', 'Simple implementation roadmap'],
      priceCents: 40000, category: 'AI Agents & Prompting', section: 'guides',
      audience: ['business', 'human'], format: 'PDF + prompt templates',
      tags: ['ai agents for business', 'ai automation small business', 'ai agent templates'],
      seo: ['AI agents for business', 'AI automation for small business', 'AI agent templates'],
      free: false, password: true, featured: true, trendScore: 84,
      preview: '/downloads/library/ai-agent-starter-kit-preview.html', file: null,
      related: ['gl-prompt-workflows', 'gl-nocode-kit', 'gl-helpdesk-blueprint'], bundle: 'bundle-ai-automation', upsell: 'aria'
    },
    {
      id: 'gl-prompt-workflows',
      title: 'Prompt Engineering for Workflows',
      blurb: 'Most prompt guides are too general. This one is built around real work you actually do.',
      long: 'Practical, workflow-first prompt engineering: role, context and step prompting taught through business, IT-support, email, research and automation examples — with before/after rewrites and a reusable prompt library you keep. Inspired by publicly available AI education trends and practical workplace use cases.',
      inside: ['Prompt basics → role, context, step-by-step', 'Output formatting that’s actually usable', 'Business / IT / email / research / automation prompts', 'Before → after rewrites', 'Prompt-improvement checklist', 'A reusable prompt library you keep'],
      priceCents: 20000, category: 'AI Skills', section: 'guides',
      audience: ['human', 'business'], format: 'PDF + prompt library',
      tags: ['prompt engineering for beginners', 'claude ai course', 'chatgpt for work', 'ai tools for productivity'],
      seo: ['prompt engineering for beginners', 'Claude AI course', 'ChatGPT for work', 'AI tools for productivity'],
      free: false, password: true, featured: true, trendScore: 88,
      preview: '/downloads/library/prompt-engineering-preview.html', file: null,
      related: ['gl-ai-agent-starter', 'gl-nocode-kit'], bundle: 'bundle-ai-automation', upsell: 'aria'
    },
    {
      id: 'gl-win11-kb',
      title: 'Windows 11 Troubleshooting KB',
      blurb: 'The everyday Windows problems, solved — structured for people and for AI support tools.',
      long: 'Slow PCs, startup and update failures, driver issues, BSOD triage, storage, app crashes, network and login/profile problems — each with user-safe steps, admin steps and escalation logic. Human-readable guide plus an AI-readable troubleshooting structure for support automation.',
      inside: ['Slow PC, startup & update issues', 'Driver, storage & app-crash fixes', 'Blue-screen basic triage', 'Network, login & profile issues', 'Device Manager checks', 'User-safe vs admin steps + escalation', 'AI-readable troubleshooting structure'],
      priceCents: 14700, category: 'Software Troubleshooting', section: 'guides',
      audience: ['human', 'it', 'ai'], format: 'PDF + AI-readable KB',
      tags: ['windows troubleshooting checklist', 'windows 11 support', 'desktop support'],
      seo: ['Windows troubleshooting checklist', 'Windows 11 support guide', 'desktop support troubleshooting'],
      free: false, password: true, featured: false, trendScore: 78,
      preview: '/downloads/library/windows-11-troubleshooting-kb-preview.html', file: null,
      related: ['gl-l1-it-bible', 'gl-outlook-fix'], bundle: 'bundle-it-mastery', upsell: 'service'
    },
    {
      id: 'gl-outlook-fix',
      title: 'Outlook Fix Guide',
      blurb: 'Outlook breaks daily — at work and at home. This is the calm, step-by-step fix book.',
      long: 'From "Outlook won’t open" to sync, search, calendar, shared-mailbox, cached-mode, add-in and mobile/web issues — with profile-rebuild guidance, a plain PST/OST explanation, ticket-note templates and escalation rules. For end users and support agents both.',
      inside: ['Outlook not opening / not syncing', 'Search & calendar issues', 'Shared mailbox & cached-mode fixes', 'Profile rebuild guidance', 'PST/OST explained simply', 'Mobile & Outlook-web fallback steps', 'Ticket-note templates + escalation rules'],
      priceCents: 8700, category: 'Software Troubleshooting', section: 'guides',
      audience: ['human', 'it'], format: 'PDF + AI-readable KB',
      tags: ['outlook troubleshooting guide', 'outlook not opening', 'outlook fix'],
      seo: ['Outlook troubleshooting guide', 'Outlook not opening fix', 'Outlook help desk guide'],
      free: false, password: true, featured: false, trendScore: 74,
      preview: '/downloads/library/outlook-fix-guide-preview.html', file: null,
      related: ['gl-m365-kb', 'gl-win11-kb'], bundle: 'bundle-it-mastery', upsell: 'service'
    },
    {
      id: 'gl-helpdesk-blueprint',
      title: 'AI Help Desk Automation Blueprint',
      blurb: 'The architecture for an AI-assisted help desk — the exact thinking behind ARIA.',
      long: 'How AI monitors tickets, summarizes them, detects SLA risk, alerts teams, suggests fixes, writes knowledge articles and reduces Level-1 noise. A complete conceptual blueprint — patterns, escalation logic, KPI/SLA monitoring and a future roadmap — for businesses and MSPs building AI into support.',
      inside: ['AI ticket monitoring, summary & SLA-risk detection', 'Suggested-fix & auto-KB-article concepts', 'Teams / Outlook alert patterns', 'Ticket-pattern detection & triage logic', 'SLA / KPI monitoring concepts', 'Help-desk automation architecture', 'ARIA-style future roadmap'],
      priceCents: 44700, category: 'Cloud & Automation', section: 'guides',
      audience: ['business', 'ai', 'it'], format: 'PDF blueprint + diagrams',
      tags: ['help desk automation', 'ai knowledge base for support teams', 'technical support SOP'],
      seo: ['help desk automation', 'AI knowledge base for support teams', 'technical support SOP'],
      free: false, password: true, featured: true, trendScore: 86,
      preview: '/downloads/library/ai-help-desk-automation-blueprint-preview.html', file: null,
      related: ['gl-m365-kb', 'gl-ai-agent-starter'], bundle: 'bundle-ai-automation', upsell: 'aria'
    },
    {
      id: 'gl-cyber-basics',
      title: 'Cybersecurity Basics for Employees',
      blurb: 'Simple, memorable security training your whole team will actually finish.',
      long: 'A clear, non-technical security-awareness pack: phishing, passwords, MFA, suspicious links, safe downloads, device and public-Wi-Fi safety, and social engineering — with a quick quiz and a completion-style certificate concept for teams.',
      inside: ['Phishing & suspicious-link basics', 'Password safety + why MFA matters', 'Safe downloads & attachment hygiene', 'Device & public-Wi-Fi safety', 'Social-engineering awareness', 'Reporting process', 'Quick quiz + completion-certificate concept'],
      priceCents: 17700, category: 'Cybersecurity Basics', section: 'guides',
      audience: ['business', 'human'], format: 'PDF + quiz',
      tags: ['cybersecurity awareness training', 'security awareness', 'employee security training'],
      seo: ['cybersecurity awareness training', 'employee security awareness training'],
      free: false, password: true, featured: false, trendScore: 62,
      preview: '/downloads/library/cybersecurity-basics-preview.html', file: null,
      related: ['gl-l1-it-bible', 'gl-m365-kb'], bundle: 'bundle-ai-automation', upsell: 'service'
    },
    {
      id: 'gl-nocode-kit',
      title: 'No-Code Automation Kit',
      blurb: 'Automate the busywork — no coding, no developer, no excuses.',
      long: 'Practical no-code automation for non-technical teams: email, form, spreadsheet, CRM-follow-up, calendar, client-intake and quote-request workflows — with ready templates, prompt packs and an automation checklist to ship your first automation this week.',
      inside: ['What no-code automation is', 'Email / form / spreadsheet automations', 'CRM follow-up & calendar automation', 'AI-summary & client-intake automation', 'Quote-request automation', 'Workflow templates + prompt packs', 'Automation checklist'],
      priceCents: 14700, category: 'Business Automation', section: 'guides',
      audience: ['human', 'business'], format: 'PDF + templates + prompt packs',
      tags: ['no-code automation', 'ai workflow automation', 'business automation scripts'],
      seo: ['no-code automation', 'AI workflow automation', 'business automation scripts'],
      free: false, password: true, featured: false, trendScore: 83,
      preview: '/downloads/library/no-code-automation-kit-preview.html', file: null,
      related: ['gl-prompt-workflows', 'gl-ai-agent-starter'], bundle: 'bundle-ai-automation', upsell: 'aria'
    },
    {
      id: 'gl-service-desk-sop-pack',
      title: 'Service Desk SOP Pack',
      blurb: 'Support quality improves when intake, ownership, and escalation stop depending on memory.',
      long: 'A practical operating pack for MSPs and internal IT teams that need cleaner intake, more consistent triage, better escalation notes, and stronger closure discipline. It turns recurring support quality issues into reusable SOP structure that helps human agents now and prepares the desk for cleaner AI-assisted support later.',
      inside: ['Ticket intake and note-taking SOPs', 'Ownership, triage, and escalation checkpoints', 'Customer-safe and internal handoff templates', 'Closure and reopened-issue prevention patterns', 'Human-first operating layer for later AI support', 'Service-desk cleanup sprint pathway'],
      priceCents: 29700, category: 'Knowledge Base Packs', section: 'guides',
      audience: ['business', 'it', 'ai'], format: 'PDF + SOP templates + AI-readable schema',
      tags: ['service desk sop', 'help desk sop', 'ticket handling process', 'support escalation'],
      seo: ['service desk SOP pack', 'help desk SOP templates', 'support escalation process'],
      free: false, password: true, featured: true, trendScore: 85,
      preview: '/downloads/library/service-desk-sop-pack-preview.html', file: null,
      related: ['gl-helpdesk-blueprint', 'gl-m365-kb', 'gl-l1-it-bible'], bundle: null, upsell: 'service'
    },
    {
      id: 'gl-meeting-sop-pack',
      title: 'Meeting-to-SOP AI Pack',
      blurb: 'Turn scattered meeting notes, missed follow-up, and SOP drift into one cleaner operating rhythm.',
      long: 'A practical pack for teams that keep losing action items after meetings, juggling notes across tools, and rebuilding the same follow-up from scratch. It gives operators a clear note-to-action structure, meeting-summary prompts, SOP handoff patterns, approval-safe follow-up templates, and a simple path into a real implementation sprint when the team wants the workflow built for them.',
      inside: ['Meeting note capture and cleanup structure', 'Action-item extraction and owner-routing prompts', 'Follow-up summary and next-step templates', 'SOP handoff pattern for recurring meetings or client work', 'Approval-safe review checklist before anything is sent', 'Simple implementation ladder into a scoped IIS sprint'],
      priceCents: 9700, category: 'Business Automation', section: 'guides',
      audience: ['business', 'human'], format: 'PDF + templates + prompt pack',
      tags: ['meeting notes ai', 'follow-up automation', 'sop handoff', 'meeting summary workflow'],
      seo: ['AI meeting notes workflow', 'meeting follow-up automation', 'SOP handoff templates'],
      free: false, password: true, featured: true, trendScore: 80,
      preview: '/downloads/library/meeting-to-sop-ai-pack-preview.html', file: null,
      related: ['gl-prompt-workflows', 'gl-nocode-kit', 'gl-ai-agent-starter'], bundle: null, upsell: 'aria'
    },
    {
      id: 'gl-website-checklist',
      title: 'Small Business Website Improvement Checklist',
      blurb: 'A practical buyer-side checklist for weak websites, muddy offers, and intake paths that leak leads.',
      long: 'A concise website-conversion checklist for owners and operators who know the site is underperforming but do not need a vague agency process. Covers clarity, CTA paths, trust, lead capture, booking friction, mobile reality, and where an AI intake assistant can improve follow-up.',
      inside: ['Homepage clarity and above-the-fold offer check', 'CTA, quote, booking, and contact-path review', 'Trust, proof, and buyer-friction checklist', 'Mobile conversion and intake-form review', 'AI intake and follow-up opportunity prompts', 'Prioritization worksheet for what to fix first'],
      priceCents: 2900, category: 'Business Automation', section: 'guides',
      audience: ['business', 'human'], format: 'Checklist PDF + priority worksheet',
      tags: ['website improvement checklist', 'website conversion checklist', 'lead capture checklist', 'ai intake checklist'],
      seo: ['small business website checklist', 'website conversion checklist', 'lead capture improvement checklist'],
      free: false, password: true, featured: true, trendScore: 96,
      preview: '/downloads/library/small-business-website-improvement-checklist-preview.html', file: null,
      related: ['gl-ai-agent-starter', 'gl-nocode-kit', 'gl-prompt-workflows'], bundle: null, upsell: 'service'
    },
    {
      id: 'gl-ai-edge-starter',
      title: 'AI Edge Starter',
      blurb: 'Learn AI fast. Use it right. Get one real win first.',
      long: 'AI Edge Starter gives you the clean first step. It shows where AI fits, how to ask better, and how to get one useful result without chaos.',
      inside: ['See where AI fits first', 'Use better prompts for daily work', 'Follow safe-use rules', 'Try simple work examples', 'Pick one fast win', 'Get secure delivery access'],
      priceCents: 4900, category: 'AI Skills', section: 'guides',
      audience: ['business', 'human'], format: 'Guide + templates + worksheet',
      tags: ['ai starter', 'learn ai for business', 'ai basics for teams', 'practical ai guide'],
      seo: ['AI starter guide', 'learn AI for business teams', 'practical AI training'],
      free: false, password: true, featured: true, trendScore: 97,
      preview: null, file: null,
      related: ['gl-prompt-workflows', 'gl-ai-edge-pro-playbook', 'gl-ai-agent-starter'], bundle: null, upsell: 'aria'
    },
    {
      id: 'gl-ai-edge-pro-playbook',
      title: 'AI Edge Pro Playbook',
      blurb: 'Go deeper. Build cleaner systems. Move toward real rollout.',
      long: 'AI Edge Pro Playbook is for teams ready for the next step. Pick the right use case. Build better prompt systems. Set clean rollout rules.',
      inside: ['Score the best use case', 'Build team prompt systems', 'Use assistant templates', 'Set risk and approval rules', 'Prep for a real sprint', 'Get secure delivery access'],
      priceCents: 19900, category: 'AI Agents & Prompting', section: 'guides',
      audience: ['business', 'human', 'ai'], format: 'Playbook + templates + rollout map',
      tags: ['ai playbook', 'ai implementation guide', 'prompt systems for teams', 'ai workflow design'],
      seo: ['AI implementation playbook', 'prompt systems for teams', 'AI workflow design guide'],
      free: false, password: true, featured: true, trendScore: 93,
      preview: null, file: null,
      related: ['gl-ai-edge-starter', 'gl-helpdesk-blueprint', 'gl-nocode-kit'], bundle: null, upsell: 'aria'
    },
    {
      id: 'gl-ai-edge-family-studio',
      title: 'AI Edge Family Learning Studio',
      blurb: 'For parents, tutors, and kids. Learn AI safe. Ask better. Build more.',
      long: 'AI Edge Family Learning Studio helps adults guide kids with AI the right way. Better questions. Better writing. Better research. Better projects. Adult stays in charge.',
      inside: ['Parent and tutor setup', 'Kid question prompts', 'Safe-use rules', 'Lesson maps for core subjects', 'Short project ideas', 'Get secure delivery access'],
      priceCents: 7900, category: 'AI Skills', section: 'guides',
      audience: ['human'], format: 'Guide + lesson maps + parent/tutor prompts',
      tags: ['ai for kids learning', 'ai tutor guide', 'parents teaching kids ai', 'tutor ai lesson plans'],
      seo: ['AI learning for families', 'AI tutor guide for parents', 'how to teach kids AI safely'],
      free: false, password: true, featured: true, trendScore: 100, image: '/images/ai-edge-family-slides/family-slide-01.jpg',
      preview: null, file: null,
      related: ['gl-ai-edge-starter', 'gl-prompt-workflows', 'gl-ai-edge-adult-momentum'], bundle: null, upsell: 'service'
    },
    {
      id: 'gl-ai-edge-adult-momentum',
      title: 'AI Edge Adult Momentum Studio',
      blurb: 'For adults with real pressure. Plan better. Move faster. Stay calm.',
      long: 'AI Edge Adult Momentum Studio helps adults use AI for work, home, learning, and projects without noise. Sort the mess. Choose the next move. Keep momentum steady.',
      inside: ['Map roles and pressure points', 'Use AI planning prompts', 'Break projects into steps', 'Make cleaner decisions', 'Build a weekly rhythm', 'Get secure delivery access'],
      priceCents: 14900, category: 'AI Skills', section: 'guides',
      audience: ['human', 'business'], format: 'Guide + planning system + prompt pack',
      tags: ['ai for adults planning', 'ai life organization', 'ai project planning', 'ai responsibility system'],
      seo: ['AI planning system for adults', 'AI project organization guide', 'use AI for meaningful work'],
      free: false, password: true, featured: true, trendScore: 98, image: '/images/ai-edge-adult-slides/adult-slide-01.jpg',
      preview: null, file: null,
      related: ['gl-ai-edge-pro-playbook', 'gl-ai-edge-starter', 'gl-website-checklist'], bundle: null, upsell: 'service'
    },
    {
      id: 'gl-book-living-well',
      title: 'The Unstubborn Life — Balance, Mastery & the Natural Path',
      blurb: 'A field manual for living well: emotional control, balance over comfort, building yourself, and legacy.',
      long: 'An original IIS book on the principles of a well-lived life — emotional intelligence as controlled, purposeful action; discomfort with real upside over dopamine; balance over the two comfort traps; building yourself first; pain as a tool you choose to stop; and living with the grain of nature. Currently being written.',
      inside: ['The mindset that breaks "limited mode"', 'Emotional intelligence, earned through experience', 'Balance over the two comfort traps', 'Build yourself first', 'Pain as a tool for success', 'Legacy over chasing everything'],
      priceCents: 9700, category: 'Mindset & Life', section: 'guides',
      audience: ['human'], format: 'Book · 9 chapters · PDF',
      tags: ['mindset','self mastery','emotional intelligence','balance','life','discipline'],
      seo: ['emotional intelligence book','self mastery','how to live well','discipline and balance'],
      free: false, featured: false, comingSoon: true, trendScore: 28,
      preview: null, file: null, related: [], bundle: null, upsell: 'aria'
    }
  ];

  /* ---- BUNDLES ---------------------------------------------------------- */
  var BUNDLES = [
    {
      id: 'bundle-it-mastery', title: 'IT Support Mastery Bundle',
      blurb: 'Everything a help desk needs: L1 Bible, M365 & Windows KBs, and the Outlook Fix Guide.',
      items: ['gl-l1-it-bible', 'gl-m365-kb', 'gl-win11-kb', 'gl-outlook-fix'],
      priceCents: 59700, category: 'Premium Bundles', section: 'bundles',
      audience: ['it', 'business', 'human'], format: 'Bundle · PDFs + AI-readable KBs',
      tags: ['it support bundle', 'help desk bundle'], seo: ['IT support training bundle', 'help desk knowledge base pack'],
      featured: true, password: true
    },
    {
      id: 'bundle-ai-automation', title: 'AI & Automation Bundle',
      blurb: 'Go from curious to operating: agents, prompting, the help-desk blueprint and no-code kit.',
      items: ['gl-ai-agent-starter', 'gl-prompt-workflows', 'gl-helpdesk-blueprint', 'gl-nocode-kit'],
      priceCents: 74700, category: 'Premium Bundles', section: 'bundles',
      audience: ['business', 'human', 'ai'], format: 'Bundle · PDFs + templates',
      tags: ['ai automation bundle'], seo: ['AI automation for small business', 'AI agents for business'],
      featured: true, password: true
    },
    {
      id: 'bundle-allaccess', title: 'Growth Library — All-Access (12 months)',
      blurb: 'Every current product, plus everything we publish for a year. Built to compound.',
      items: PRODUCTS.filter(function (p) { return !p.comingSoon; }).map(function (p) { return p.id; }),
      priceCents: 200000, category: 'Premium Bundles', section: 'bundles',
      audience: ['business', 'human', 'ai', 'it'], format: 'All-access · 12 months',
      tags: ['all access', 'membership'], seo: ['IT and AI learning library'],
      featured: true, password: true, membership: true, trendScore: 89
    }
  ];

  // Bundle price = the combined value of its contents (transparent value math,
  // applied consistently across the site). All-Access is a fixed $2,000 membership.
  BUNDLES.forEach(function (b) {
    if (!b.membership && b.items) {
      b.priceCents = b.items.reduce(function (sum, id) {
        var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
        return sum + (p ? p.priceCents : 0);
      }, 0);
    }
  });

  /* ---- SHOP-BRIDGE CARDS (preserve & surface existing pages/flows) ------ */
  // These keep every existing flow reachable from the Shop hub. They link out
  // (no Stripe here) so nothing about the current pages changes.
  var BRIDGES = [
    {
      id: 'br-managed', section: 'tech-support', kind: 'service',
      title: 'Managed IT Support Plans', blurb: 'Proactive monitoring, helpdesk & security on a predictable monthly retainer.',
      audience: ['business'], cta: 'View plans', url: '/#solutions'
    },
    {
      id: 'br-services', section: 'tech-support', kind: 'service',
      title: 'Project & Out-of-Scope Services', blurb: 'Setup, migrations, hardening and one-off projects — fixed-price where possible.',
      audience: ['business', 'it'], cta: 'Browse services', url: '/services.html'
    },
    {
      id: 'br-overflow-pilot', section: 'tech-support', kind: 'service',
      title: 'Remote L1-L3 Overflow Support Pilot', blurb: 'A scoped support pilot for teams with queue pressure, M365/user-support backlog, or weak escalation hygiene.',
      audience: ['business', 'it'], cta: 'Stage pilot', url: '/?contact=1&subject=Request%20Overflow%20Support%20Pilot&desc=I%20want%20to%20stage%20a%20Remote%20L1-L3%20Overflow%20Support%20Pilot.%0A%0ACompany%3A%0ATeam%20size%3A%0ACurrent%20queue%20pressure%3A%0ATools%20used%20today%3A%0AWhat%20coverage%20is%20needed%3A%0AApproval%20boundaries%20or%20sensitive%20systems%3A'
    },
    {
      id: 'br-helpdesk-impl', section: 'tech-support', kind: 'service',
      title: 'AI Help Desk Blueprint Implementation', blurb: 'A practical service package for cleaner ticket intake, stronger escalation notes, and AI-ready knowledge reuse.',
      audience: ['business', 'it', 'ai'], cta: 'Stage implementation', url: '/?contact=1&subject=Request%20AI%20Help%20Desk%20Blueprint%20Implementation&desc=I%20want%20help%20implementing%20the%20AI%20Help%20Desk%20Blueprint.%0A%0ACompany%3A%0ATeam%20size%3A%0ACurrent%20ticket%20pain%3A%0ASystems%20used%20today%3A%0AWhat%20a%20better%20support%20flow%20would%20look%20like%3A'
    },
    {
      id: 'br-m365-tuneup', section: 'tech-support', kind: 'service',
      title: 'M365 Security & Productivity Tune-Up', blurb: 'A focused Microsoft 365 cleanup for identity, devices, Teams, SharePoint, onboarding, and everyday admin friction.',
      audience: ['business', 'it'], cta: 'Stage tune-up', url: '/?contact=1&subject=Request%20M365%20Security%20and%20Productivity%20Tune-Up&desc=I%20want%20to%20stage%20an%20M365%20Security%20and%20Productivity%20Tune-Up.%0A%0ACompany%3A%0ATeam%20size%3A%0ABiggest%20M365%20friction%20today%3A%0AAdmin%20areas%20that%20feel%20messy%3A%0AWhat%20needs%20to%20improve%20first%3A'
    },
    {
      id: 'br-workflow-audit', section: 'tech-support', kind: 'service',
      title: 'AI Workflow Audit', blurb: 'A discovery-first review for teams losing time to repeated handoffs, messy intake, and scattered process knowledge.',
      audience: ['business', 'ai'], cta: 'Stage audit', url: '/?contact=1&subject=Request%20AI%20Workflow%20Audit&desc=I%20want%20to%20request%20an%20AI%20Workflow%20Audit.%0A%0ACompany%3A%0ATeam%3A%0AMost%20repetitive%20process%3A%0AEstimated%20hours%20lost%20per%20week%3A%0ATools%20we%20use%20today%3A%0AWhat%20success%20would%20look%20like%3A'
    },
    {
      id: 'br-quick-win', section: 'tech-support', kind: 'service',
      title: 'AI Workflow Quick-Win Sprint', blurb: 'A scoped AI workflow sprint for one repetitive process that is wasting hours every week.',
      audience: ['business', 'ai'], cta: 'Stage sprint', url: '/?contact=1&subject=Request%20AI%20Workflow%20Quick-Win%20Sprint&desc=I%20want%20to%20stage%20an%20AI%20Workflow%20Quick-Win%20Sprint.%0A%0ACompany%3A%0ATeam%20size%3A%0AMost%20repetitive%20process%20today%3A%0AEstimated%20hours%20lost%20per%20week%3A%0ATools%20used%20today%3A%0AWhat%20success%20would%20look%20like%20first%3A'
    },
    {
      id: 'br-office-move', section: 'tech-support', kind: 'service',
      title: 'Office Move / Property IT Readiness', blurb: 'A scoped readiness path for office openings, expansions, workspace refreshes, and tenant move-in support pressure.',
      audience: ['business', 'human'], cta: 'Stage readiness', url: '/?contact=1&subject=Request%20Office%20Move%20%2F%20Property%20IT%20Readiness&desc=I%20want%20to%20stage%20Office%20Move%20%2F%20Property%20IT%20Readiness.%0A%0ACompany%3A%0ASite%20or%20project%20location%3A%0AMove%2C%20opening%2C%20refresh%2C%20or%20expansion%20timeline%3A%0ATeam%20size%20or%20users%20affected%3A%0AKey%20technology%20areas%20in%20scope%3A%0AExternal%20vendors%20or%20building%20dependencies%3A%0ABiggest%20day-one%20readiness%20risk%3A'
    },
    {
      id: 'br-website-intake-fix', section: 'tech-support', kind: 'service',
      title: 'Website + AI Intake Conversion Fix', blurb: 'A focused website cleanup for buyers whose offer, CTA path, or lead intake is leaking opportunities.',
      audience: ['business', 'human', 'ai'], cta: 'Stage fix', url: '/?contact=1&subject=Request%20Website%20%2B%20AI%20Intake%20Conversion%20Fix&desc=I%20want%20to%20stage%20a%20Website%20%2B%20AI%20Intake%20Conversion%20Fix.%0A%0ACompany%3A%0AWebsite%20URL%3A%0ABiggest%20conversion%20or%20intake%20friction%20today%3A%0ACurrent%20CTA%20or%20booking%20path%3A%0APages%20that%20need%20the%20most%20help%3A%0AWhat%20a%20better%20next%20step%20should%20look%20like%3A'
    },
    {
      id: 'br-purchase-tech', section: 'recommended', kind: 'physical',
      title: 'Concierge Device Sourcing', blurb: 'Tell us the need & budget — we recommend, source and (optionally) set it up. Personal or business.',
      audience: ['human', 'business'], cta: 'Open Purchase Tech', url: '/purchase-tech.html'
    },
    {
      id: 'br-instock', section: 'recommended', kind: 'physical',
      title: 'In-Stock Certified Hardware', blurb: 'Tested devices ready to buy now — inspected, with warranty.',
      audience: ['human', 'business'], cta: 'View inventory', url: '/services.html#inventory'
    },
    {
      id: 'br-aria', section: 'tech-support', kind: 'subscription',
      title: 'ARIA — AI IT Assistant', blurb: 'Always-on AI triage, fixes and escalation. Personal, Pro and Business tiers.',
      audience: ['human', 'business'], cta: 'See ARIA', url: '/aria.html'
    }
  ];

  /* ---- PHYSICAL INVENTORY (the pictured Purchase-Tech items, now in Shop) --
     Real, in-stock devices. Buy-now via the same Stripe priceData flow. Images
     live in /images/inventory/. Add/remove freely. */
  var INVENTORY = [
    { id: 'inv-notebook-ram-16gb', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Notebook 16GB RAM Kit', blurb: 'Crucial DDR3L SODIMM 16GB (2×8GB) — Mac/PC compatible. Inspected & ready.',
      priceCents: 6500, image: '/images/inventory/notebook-ram-16gb.jpg', audience: ['human','business'],
      format: 'In stock · 7 available', tags: ['ram','memory','crucial','sodimm','ddr3l','upgrade'], seo: ['16gb laptop ram','crucial sodimm 16gb'] },
    { id: 'inv-mac-mini-1', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Apple Mac Mini (A1347) — Unit 1', blurb: 'Compact Apple desktop, fully tested by IIS — ready for home or office.',
      priceCents: 26000, image: '/images/inventory/mac-mini-1.jpg', audience: ['human','business'],
      format: 'In stock · Apple', tags: ['mac mini','apple','desktop','a1347'], seo: ['used mac mini','apple desktop'] },
    { id: 'inv-mac-mini-2', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Apple Mac Mini (A1347) — Unit 2', blurb: 'Second tested Mac Mini, diagnosed & verified by IIS.',
      priceCents: 26000, image: '/images/inventory/mac-mini-2.jpg', audience: ['human','business'],
      format: 'In stock · Apple', tags: ['mac mini','apple','desktop','a1347'], seo: ['used mac mini'] },
    { id: 'inv-ipad-a1458', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Apple iPad (A1458, 4th Gen)', blurb: 'Apple tablet for reading, media & everyday productivity. Tested.',
      priceCents: 7200, image: '/images/inventory/ipad-a1458.jpg', audience: ['human'],
      format: 'In stock · Apple', tags: ['ipad','apple','tablet','a1458'], seo: ['used ipad','apple tablet'] },
    { id: 'inv-desktop-tower', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Custom Desktop Tower (Corsair)', blurb: 'Full desktop tower with internal components — workstation or gaming ready.',
      priceCents: 45500, image: '/images/inventory/desktop-tower.jpg', audience: ['human','business'],
      format: 'In stock · Custom build', tags: ['desktop','tower','gaming','workstation','corsair'], seo: ['custom desktop pc','gaming tower'] },
    { id: 'inv-dell-inspiron', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Dell Inspiron Laptop', blurb: 'Reliable everyday Dell notebook — home, students or office work. Tested.',
      priceCents: 20800, image: '/images/inventory/dell-laptop.jpg', audience: ['human','business'],
      format: 'In stock · Dell', tags: ['dell','laptop','inspiron','notebook'], seo: ['used dell laptop','dell inspiron'] },
    { id: 'inv-macbook-pro', kind: 'physical', section: 'recommended', category: 'Recommended Devices',
      title: 'Apple MacBook Pro (Apple Silicon class)', blurb: 'Premium MacBook Pro — creative, developer & executive workflows. Tested.',
      priceCents: 84500, image: '/images/inventory/macbook-pro.jpg', audience: ['human','business'],
      format: 'In stock · Apple', tags: ['macbook pro','apple','laptop','m-series','silicon'], seo: ['used macbook pro','apple silicon laptop'] }
  ];

  /* ---- CONCIERGE "ORDER THROUGH US" — premium hardware/software we source --
     No fixed price: the customer orders, we source the best (often rare) option,
     confirm a quote, and deliver it white-glove. We place the vendor order; the
     customer never sees the source. (Auto-placing third-party orders isn't a
     legitimate API capability — IIS finalises each order.) */
  var CONCIERGE = [
    { id: 'co-laptop-hp', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'High-Performance Laptop', blurb: 'Workstation-class portable power — sourced & configured to your spec. Creative, dev, executive.', audience: ['human','business'], format: 'Sourced to order', tags: ['laptop','workstation','high performance','dell','lenovo','razer'], seo: ['high performance laptop','workstation laptop'] },
    { id: 'co-desktop-ws', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Workstation Desktop', blurb: 'Serious compute for rendering, data & engineering — built and burned-in before it ships.', audience: ['business'], format: 'Sourced to order', tags: ['desktop','workstation','pc','gpu','rtx'], seo: ['workstation desktop','high performance pc'] },
    { id: 'co-mac', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Mac — Pro · Studio · MacBook Pro', blurb: 'Apple silicon at the top end, sourced and set up the way you work.', audience: ['human','business'], format: 'Sourced to order', tags: ['mac','apple','mac studio','mac pro','macbook pro'], seo: ['mac studio','macbook pro m-max'] },
    { id: 'co-ram-storage', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Premium RAM & SSD Storage', blurb: 'Genuine, matched memory and fast NVMe — the right part the first time.', audience: ['human','business','it'], format: 'Sourced to order', tags: ['ram','memory','ssd','nvme','ddr5','storage'], seo: ['ddr5 ram','nvme ssd'] },
    { id: 'co-usb-secure', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Encrypted USB & Accessories', blurb: 'Hardware-encrypted drives, docks, keyboards & webcams — vetted, business-grade.', audience: ['human','business'], format: 'Sourced to order', tags: ['usb','encrypted drive','dock','accessories','webcam','keyboard'], seo: ['encrypted usb drive','thunderbolt dock'] },
    { id: 'co-monitor', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: '4K / 5K Monitors & Docks', blurb: 'Colour-accurate displays and Thunderbolt docks for a flawless desk.', audience: ['human','business'], format: 'Sourced to order', tags: ['monitor','4k','5k','display','thunderbolt'], seo: ['4k monitor','5k display'] },
    { id: 'co-software', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Office Software & Licenses', blurb: 'Microsoft 365, Adobe & security suites — licensed correctly for your team.', audience: ['business'], format: 'Sourced to order', tags: ['software','microsoft 365','adobe','license','office'], seo: ['microsoft 365 business','adobe license'] },
    { id: 'co-network', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Business Networking Gear', blurb: 'UniFi & business-grade Wi-Fi, switching and firewalls — specced for your space.', audience: ['business'], format: 'Sourced to order', tags: ['network','unifi','wifi','firewall','switch'], seo: ['unifi','business wifi'] },
    { id: 'co-phone-case', kind: 'concierge', section: 'order-concierge', category: 'Order Through Us', title: 'Trending Phone Case', blurb: 'A standout, in-demand case — we order it in and deliver it to your door.', audience: ['human'], format: 'Sourced to order', tags: ['phone case','iphone','samsung','trending','accessory'], seo: ['trending phone case','iphone case'] }
  ];

  /* ---- TOP-SELLING BOOKS (concierge procurement) -----------------------
     Real best-sellers we source for the customer. We show the vendor list
     price; at checkout we add a flat supply fee + a % admin fee, plus an
     estimated delivery (reconciled after). Supplier is never shown. */
  var BOOK_SUPPLY_FEE_CENTS = 4000;   // flat per-order supply/sourcing fee
  var BOOK_ADMIN_RATE = 0.15;         // admin + processing + suggestion fee
  var BOOK_SERVICES = [
    { id: 'consult', label: '30-min consultation with IIS', note: 'Talk through how to apply it to your work or stack.', cents: 7900 },
    { id: 'setup',   label: 'Setup & configuration',        note: 'If your order includes a tool/device that needs installing.', cents: 9900 }
  ];
  var BOOKS = [
    { id: 'tsb-ai-genesis', kind: 'book', topic: 'Artificial Intelligence', theme: 'theme-cobalt',
      title: 'Genesis: Artificial Intelligence, Hope, and the Human Spirit', author: 'Kissinger, Schmidt & Mundie',
      blurb: 'Three of the sharpest minds on technology and statecraft on what machine intelligence means for how we know, decide, and stay human.',
      priceCents: 3200, estDeliveryCents: 599 },
    { id: 'tsb-future-nexus', kind: 'book', topic: 'The Future', theme: 'theme-navy',
      title: 'Nexus: A Brief History of Information Networks', author: 'Yuval Noah Harari',
      blurb: 'From the Stone Age to AI — how the stories and systems we use to share information have shaped power, and where they take us next.',
      priceCents: 3500, estDeliveryCents: 599 },
    { id: 'tsb-quantum-supremacy', kind: 'book', topic: 'Quantum Computing', theme: 'theme-plum',
      title: 'Quantum Supremacy', author: 'Michio Kaku',
      blurb: 'How quantum computers will crack problems classical machines never could — medicine, energy, AI — explained for the curious, not the PhD.',
      priceCents: 3000, estDeliveryCents: 599 },
    { id: 'tsb-psych-body', kind: 'book', topic: 'Psychology', theme: 'theme-wine',
      title: 'The Body Keeps the Score', author: 'Bessel van der Kolk, M.D.',
      blurb: 'The landmark work on trauma and the body — how stress reshapes us and the science of getting it back. One of the best-selling psychology books of the decade.',
      priceCents: 1900, estDeliveryCents: 599 },
    { id: 'tsb-fitness-outlive', kind: 'book', topic: 'Fitness & Longevity', theme: 'theme-emerald',
      title: 'Outlive: The Science and Art of Longevity', author: 'Peter Attia, M.D.',
      blurb: 'A practical playbook for adding healthy years — training, nutrition, sleep and the habits that decide how you actually age.',
      priceCents: 3200, estDeliveryCents: 599 },
    { id: 'tsb-finance-money', kind: 'book', topic: 'Finance', theme: 'theme-amber',
      title: 'The Psychology of Money', author: 'Morgan Housel',
      blurb: 'Nineteen short stories on why smart people do strange things with money — and the few quiet habits that actually build wealth.',
      priceCents: 2000, estDeliveryCents: 599 },
    { id: 'tsb-growth-atomic', kind: 'book', topic: 'Personal Growth', theme: 'theme-rust',
      title: 'Atomic Habits', author: 'James Clear',
      blurb: 'The #1 system for getting 1% better every day — tiny changes, remarkable results. The growth book people keep coming back to.',
      priceCents: 2700, estDeliveryCents: 599 },
    { id: 'tsb-happy-build', kind: 'book', topic: 'Happiness', theme: 'theme-slate',
      title: 'Build the Life You Want', author: 'Arthur C. Brooks & Oprah Winfrey',
      blurb: 'A science-backed guide to getting happier — not by changing your circumstances, but by managing how you respond to them.',
      priceCents: 2800, estDeliveryCents: 599 }
  ];

  /* ---- HELPERS ---------------------------------------------------------- */
  function money(cents) { return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function money2(cents) { return '$' + (Math.round(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // Fee math: (item + est delivery + $40 supply) x 1.15 admin; services added after (not marked up).
  function bookTotals(p, serviceIds) {
    var item = p.priceCents || 0, delivery = p.estDeliveryCents || 0;
    var procurement = item + delivery + BOOK_SUPPLY_FEE_CENTS;
    var admin = Math.round(procurement * BOOK_ADMIN_RATE);
    var services = (serviceIds || []).reduce(function (s, id) {
      var svc = BOOK_SERVICES.filter(function (x) { return x.id === id; })[0];
      return s + (svc ? svc.cents : 0);
    }, 0);
    return { item: item, delivery: delivery, supply: BOOK_SUPPLY_FEE_CENTS, admin: admin, services: services, total: procurement + admin + services };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function byId(id) { return PRODUCTS.concat(BUNDLES, INVENTORY, CONCIERGE, BOOKS).filter(function (p) { return p.id === id; })[0] || null; }
  function trendScoreOf(p) { return Number((p && p.trendScore) || 0); }
  function sortByTrend(list) {
    return (list || []).slice().sort(function (a, b) {
      if (!!a.comingSoon !== !!b.comingSoon) return a.comingSoon ? 1 : -1;
      if (trendScoreOf(a) !== trendScoreOf(b)) return trendScoreOf(b) - trendScoreOf(a);
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }
  function audienceBadges(arr) { return (arr || []).map(function (a) { return '<span class="aud aud-' + a + '">' + (AUD[a] || a) + '</span>'; }).join(''); }

  function previewCents(p) { return Math.max(100, Math.round((p.priceCents || 0) * 0.30)); }
  // Stripe checkout. mode 'full' (default) buys the product; 'peek' buys the paid
  // 30% preview — a teaser of what's inside, credited toward full access on request.
  async function buy(id, mode) {
    var p = byId(id); if (!p) return;
    mode = (mode === 'peek') ? 'peek' : 'full';
    var amount = (mode === 'peek') ? previewCents(p) : p.priceCents;
    var btn = document.querySelector('[data-buy="' + id + '-' + mode + '"]') || document.querySelector('[data-buy="' + id + '"]');
    var orig = btn ? btn.innerHTML : '';
    if (btn) { if (btn.disabled) return; btn.disabled = true; btn.innerHTML = 'Opening secure checkout…'; }
    try {
      var r = await fetch('/.netlify/functions/stripe-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successPath: META.successUrl, priceData: {
          amount_cents: amount, currency: 'usd',
          product_name: 'IIS · ' + p.title + (mode === 'peek' ? ' — Preview peek (30%)' : ''),
          description: (mode === 'peek'
            ? 'Paid preview of "' + p.title + '" — a teaser of what\'s inside. Credited toward full access; reply to your receipt to apply it.'
            : (p.blurb || '').slice(0, 165)) + ' [' + (p.format || 'digital') + ']',
          id: p.id + '-' + mode
        } })
      });
      var data = await r.json();
      if (data && data.url) { window.location = data.url; return; }
      throw new Error((data && data.error) || 'Checkout failed');
    } catch (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
      alert('Could not start checkout: ' + (e.message || e) + '\nEmail ' + META.email + ' to complete your purchase.');
    }
  }

  // Concierge order — opens a page-provided modal if present, else mailto.
  function order(id) {
    var p = byId(id); if (!p) return;
    if (typeof window.openConcierge === 'function') { window.openConcierge(p); return; }
    var subj = encodeURIComponent('Order request · ' + p.title);
    var body = encodeURIComponent('I would like to order: ' + p.title + '\n\nPlease send options & a quote.\n\nName:\nShipping address:\nSpecs / preferences:\nPhone:\n');
    window.location = 'mailto:' + META.email + '?subject=' + subj + '&body=' + body;
  }

  // Render a catalog card (used by Shop, Growth Library, product pages).
  function renderCard(p) {
    var media = p.image ? '<div class="c-media"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy"></div>' : '';
    var priceTag = p.comingSoon ? '<span class="price soon">Coming soon</span>'
      : (p.kind === 'concierge') ? '<span class="price quote">By quote</span>'
      : (p.priceCents != null ? '<span class="price">' + money(p.priceCents) + '</span>' : '');
    var fmt = p.format ? '<span class="fmt">' + esc(p.format) + '</span>' : '';
    var actions, titleHtml, lock = '';
    if (p.comingSoon) {
      actions = '<span class="c-btn" style="opacity:.5;cursor:not-allowed;pointer-events:none">In progress</span>';
      titleHtml = '<h4>' + esc(p.title) + '</h4>';
    } else if (p.url) {
      actions = '<a class="c-btn" href="' + esc(p.url) + '">' + esc(p.cta || 'Open') + ' →</a>';
      titleHtml = '<h4>' + esc(p.title) + '</h4>';
    } else if (p.kind === 'concierge') {
      actions = '<button class="c-btn solid" onclick="IIS_CATALOG.order(\'' + esc(p.id) + '\')">Order through us →</button>';
      titleHtml = '<h4>' + esc(p.title) + '</h4>';
    } else if (p.kind === 'physical') {
      actions = '<button class="c-btn solid" data-buy="' + esc(p.id) + '-full" onclick="IIS_CATALOG.buy(\'' + esc(p.id) + '\',\'full\')">Buy now · ' + money(p.priceCents) + '</button>';
      titleHtml = '<h4>' + esc(p.title) + '</h4>';
    } else {
      actions = '<button class="c-btn" data-buy="' + esc(p.id) + '-peek" onclick="IIS_CATALOG.buy(\'' + esc(p.id) + '\',\'peek\')" title="A teaser, credited toward full access">Peek · ' + money(previewCents(p)) + '</button>' +
        '<button class="c-btn solid" data-buy="' + esc(p.id) + '-full" onclick="IIS_CATALOG.buy(\'' + esc(p.id) + '\',\'full\')">Unlock · ' + money(p.priceCents) + '</button>';
      titleHtml = '<h4><a href="/product.html?id=' + esc(p.id) + '" style="color:inherit;text-decoration:none">' + esc(p.title) + '</a></h4>';
      lock = '<span class="lock" title="Premium · unlock to access">⚿</span>';
    }
    return '' +
      '<article class="cat-card' + (p.featured ? ' is-featured' : '') + (p.image ? ' has-media' : '') + (p.comingSoon ? ' is-soon' : '') + '" data-cat="' + esc(p.category || '') + '" data-aud="' + (p.audience || []).join(' ') + '">' +
        media + lock +
        '<div class="c-top">' + audienceBadges(p.audience) + fmt + '</div>' +
        titleHtml +
        '<p class="c-blurb">' + esc(p.blurb) + '</p>' +
        (p.inside ? '<ul class="c-inside">' + p.inside.slice(0, 4).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="c-foot">' + priceTag + '<span class="c-actions">' + actions + '</span></div>' +
      '</article>';
  }

  // ----- 3D BOOK RENDERER (Growth Library vault) ---------------------------
  // Each product becomes a physical "book": cover (front) + summary/commerce
  // (back, flips on hover/tap) + an audience caption beneath ("who it's for").
  var BOOK_THEMES = ['theme-navy', 'theme-emerald', 'theme-wine', 'theme-ink', 'theme-rust',
                     'theme-forest', 'theme-cobalt', 'theme-amber', 'theme-slate', 'theme-plum'];
  function bookTheme(p) {                       // stable djb2 hash of id → palette
    var s = String(p.id || ''), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return BOOK_THEMES[h % BOOK_THEMES.length];
  }
  function bookAudience(p) {
    var a = p.audience || [];
    if (a.indexOf('human') >= 0)    return { label: 'For Humans',     cls: 'humans' };
    if (a.indexOf('it') >= 0)       return { label: 'For IT Teams',   cls: 'it' };
    if (a.indexOf('business') >= 0) return { label: 'For Operators',  cls: 'business' };
    if (a.indexOf('ai') >= 0)       return { label: 'For AI Systems', cls: 'ai' };
    return { label: 'For Everyone', cls: 'everyone' };
  }
  function bookTitleClass(t) {
    var n = String(t || '').length;
    return n > 26 ? ' iis-book__title--xlong' : n > 15 ? ' iis-book__title--long' : '';
  }
  function renderBook(p) {
    var isBook = p.kind === 'book';                 // concierge top-selling book (vs digital vault product)
    var aud = bookAudience(p);
    var theme = isBook ? (p.theme || bookTheme(p)) : bookTheme(p);
    var capLabel = isBook ? p.topic : aud.label;    // caption + cover series + back pill
    var pillCls = isBook ? 'everyone' : aud.cls;
    var authorLine = isBook ? (p.author || META.brand) : META.brand;
    var letter = esc(String(p.title || '?').trim().charAt(0).toUpperCase());
    var href = isBook ? '#' : ('/product.html?id=' + esc(p.id));
    var frontOnclick = isBook ? (' onclick="IIS_CATALOG.orderBook(\'' + esc(p.id) + '\');return false;"') : '';
    var summary = esc(p.blurb || String(p.long || '').slice(0, 220));
    var locked = !!p.comingSoon;

    var priceHtml, actions, note = '';
    if (isBook) {
      priceHtml = '<span class="iis-book__price">' + money(p.priceCents) + '</span>';
      actions = '<button class="iis-book__open" onclick="IIS_CATALOG.orderBook(\'' + esc(p.id) + '\')">Order through us &rarr;</button>';
      note = '<div class="iis-book-note">Vendor price — sourcing fees shown at checkout</div>';
    } else if (p.comingSoon) {
      priceHtml = '<span class="iis-book__price" style="font-size:12px;letter-spacing:.08em">IN PROGRESS</span>';
      actions = '<a class="iis-book__open" href="' + href + '">Notify me &rarr;</a>';
    } else if (p.url) {
      priceHtml = '<span class="iis-book__price">' + (p.priceCents != null ? money(p.priceCents) : '') + '</span>';
      actions = '<a class="iis-book__open" href="' + esc(p.url) + '">' + esc(p.cta || 'Open') + ' &rarr;</a>';
    } else {
      priceHtml = '<span class="iis-book__price">' + money(p.priceCents) + '</span>';
      actions =
        '<span class="iis-book__actions">' +
          '<button class="iis-book__peek" data-buy="' + esc(p.id) + '-peek" onclick="IIS_CATALOG.buy(\'' + esc(p.id) + '\',\'peek\')" title="A teaser, credited toward full access">Peek ' + money(previewCents(p)) + '</button>' +
          '<button class="iis-book__open" data-buy="' + esc(p.id) + '-full" onclick="IIS_CATALOG.buy(\'' + esc(p.id) + '\',\'full\')">Unlock</button>' +
        '</span>';
    }

    return '' +
      '<div class="iis-book-cell" data-cat="' + esc(p.category || p.topic || '') + '" data-aud="' + (p.audience || []).join(' ') + '">' +
        '<div class="iis-book ' + theme + (locked ? ' is-locked' : '') + '" tabindex="0" role="group" aria-label="' + esc(p.title) + '">' +
          '<a class="iis-book__face iis-book__front" href="' + href + '"' + frontOnclick + ' aria-label="' + esc(p.title) + '">' +
            '<div class="iis-book__series">' + esc(capLabel) + '</div>' +
            '<h3 class="iis-book__title' + bookTitleClass(p.title) + '">' + esc(p.title) + '</h3>' +
            '<div class="iis-book__author">' + esc(authorLine) + '</div>' +
            '<div class="iis-book__crest" data-letter="' + letter + '">' + letter + '</div>' +
          '</a>' +
          '<div class="iis-book__face iis-book__back">' +
            '<span class="iis-book__audience iis-book__audience--' + pillCls + '">' + esc(capLabel) + '</span>' +
            '<h4 class="iis-book__back-title">' + esc(p.title) + '</h4>' +
            '<p class="iis-book__summary">' + summary + '</p>' +
            '<div class="iis-book__meta">' + priceHtml + '</div>' +   // price stays on the back; buttons live below the book
          '</div>' +
          '<div class="iis-book__spine" aria-hidden="true"><span class="iis-book__spine-text">' + esc(p.title) + '</span></div>' +
          '<div class="iis-book__pages" aria-hidden="true"></div>' +
          '<div class="iis-book__edge-top" aria-hidden="true"></div>' +
          '<div class="iis-book__edge-bottom" aria-hidden="true"></div>' +
        '</div>' +
        '<div class="iis-book-cap">' + esc(capLabel) + '</div>' +
        '<div class="iis-book-buy">' + priceHtml + actions + '</div>' + note +
      '</div>';
  }

  // ----- CONCIERGE BOOK ORDER (modal + Stripe checkout) --------------------
  function bookModalHtml(p) {
    var t = bookTotals(p, []);
    var svc = BOOK_SERVICES.map(function (s) {
      return '<label class="iis-bk-svc"><input type="checkbox" data-svc="' + s.id + '">' +
        '<span class="t">' + esc(s.label) + '<small>' + esc(s.note) + '</small></span>' +
        '<span class="pr">' + money2(s.cents) + '</span></label>';
    }).join('');
    return '<div class="iis-bk-card" role="dialog" aria-modal="true" aria-label="Order ' + esc(p.title) + '">' +
      '<button class="iis-bk-x" data-close aria-label="Close">&times;</button>' +
      '<div class="iis-bk-head"><span class="iis-bk-ey">Concierge order</span><h3>' + esc(p.title) + '</h3><p>' + esc(p.author || '') + '</p></div>' +
      '<div class="iis-bk-rows">' +
        '<div class="r"><span>Item — vendor price</span><span>' + money2(t.item) + '</span></div>' +
        '<div class="r"><span>Delivery — estimate (reconciled to actual)</span><span>' + money2(t.delivery) + '</span></div>' +
        '<div class="r"><span>Supply &amp; sourcing fee</span><span>' + money2(t.supply) + '</span></div>' +
        '<div class="r"><span>Admin · processing · suggestion (15%)</span><span id="iisbk-admin">' + money2(t.admin) + '</span></div>' +
      '</div>' +
      '<div class="iis-bk-svc-wrap"><div class="iis-bk-lbl">Want a hand? (optional — not part of the 15%)</div>' + svc +
        '<div class="r sub"><span>Selected services</span><span id="iisbk-services">' + money2(0) + '</span></div></div>' +
      '<div class="iis-bk-total"><span>Charged today</span><span id="iisbk-total">' + money2(t.total) + '</span></div>' +
      '<label class="iis-bk-tnc"><input type="checkbox" id="iisbk-tnc"><span>I agree to the <a href="/terms.html#procurement" target="_blank" rel="noopener">concierge procurement terms</a>: vendor price + $40 supply fee + 15% admin/processing, delivery estimated now &amp; reconciled, sourced &amp; delivered by IIS.</span></label>' +
      '<button class="iis-bk-go" id="iisbk-go" disabled>Proceed to secure checkout</button>' +
      '<p class="iis-bk-fine">You enter your shipping address at checkout. We place the order, then email your confirmation. Setup / consultation are separate from the 15% fee.</p>' +
    '</div>';
  }
  function orderBook(id) {
    var p = byId(id); if (!p || p.kind !== 'book') return;
    var overlay = document.createElement('div');
    overlay.className = 'iis-bk-modal';
    overlay.innerHTML = bookModalHtml(p);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    function close() { overlay.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (e) { if (e.target === overlay || (e.target.closest && e.target.closest('[data-close]'))) close(); });
    var svcInputs = [].slice.call(overlay.querySelectorAll('[data-svc]'));
    var tnc = overlay.querySelector('#iisbk-tnc');
    var go = overlay.querySelector('#iisbk-go');
    function selectedIds() { return svcInputs.filter(function (i) { return i.checked; }).map(function (i) { return i.getAttribute('data-svc'); }); }
    function recompute() {
      var t = bookTotals(p, selectedIds());
      overlay.querySelector('#iisbk-services').textContent = money2(t.services);
      overlay.querySelector('#iisbk-total').textContent = money2(t.total);
      go.disabled = !tnc.checked;
    }
    svcInputs.forEach(function (i) { i.addEventListener('change', recompute); });
    tnc.addEventListener('change', recompute);
    go.addEventListener('click', function () { if (tnc.checked) startBookCheckout(p, selectedIds(), go); });
    recompute();
  }
  async function startBookCheckout(p, serviceIds, btn) {
    var t = bookTotals(p, serviceIds);
    var svcLabels = (serviceIds || []).map(function (id) { var s = BOOK_SERVICES.filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; });
    var orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Opening secure checkout…'; }
    try {
      var r = await fetch('/.netlify/functions/stripe-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successPath: '/unlock.html',
          collectShipping: true,
          priceData: {
            amount_cents: t.total, currency: 'usd',
            product_name: 'IIS Concierge · ' + p.title,
            description: ('We source & deliver "' + p.title + '" to you — item + estimated delivery + $40 supply + 15% admin/processing.' + (svcLabels.length ? (' Add-ons: ' + svcLabels.join(', ') + '.') : '')).slice(0, 480),
            id: p.id
          },
          meta: {
            kind: 'book-order', book: p.title, author: p.author || '',
            item_cents: t.item, delivery_cents: t.delivery, supply_cents: t.supply,
            admin_cents: t.admin, services_cents: t.services, services: svcLabels.join(', ')
          }
        })
      });
      var data = await r.json();
      if (data && data.url) { window.location = data.url; return; }
      throw new Error((data && data.error) || 'Checkout failed');
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = orig || 'Proceed to secure checkout'; }
      alert('Could not start checkout: ' + (e.message || e) + '\nEmail ' + META.email + ' to complete your order.');
    }
  }

  window.IIS_CATALOG = {
    meta: META, glCategories: GL_CATEGORIES, shopSections: SHOP_SECTIONS, audience: AUD,
    products: PRODUCTS, bundles: BUNDLES, bridges: BRIDGES, inventory: INVENTORY, concierge: CONCIERGE, books: BOOKS,
    money: money, money2: money2, esc: esc, byId: byId, buy: buy, order: order, renderCard: renderCard, renderBook: renderBook, previewCents: previewCents,
    bookTotals: bookTotals, bookServices: BOOK_SERVICES, orderBook: orderBook,
    // convenience filters
    all: function () { return sortByTrend(PRODUCTS.concat(BUNDLES, INVENTORY, CONCIERGE)); },
    forSection: function (sid) { return sortByTrend(PRODUCTS.concat(BUNDLES, INVENTORY, CONCIERGE, BRIDGES).filter(function (p) { return p.section === sid; })); },
    forCategory: function (cat) {
      var list = PRODUCTS.concat(BUNDLES);
      if (!cat || cat === 'all') return sortByTrend(list);
      if (cat === 'Featured') return sortByTrend(list.filter(function (p) { return p.featured; }));
      if (cat === 'For Humans') return sortByTrend(list.filter(function (p) { return (p.audience || []).indexOf('human') >= 0; }));
      if (cat === 'For AI Systems') return sortByTrend(list.filter(function (p) { return (p.audience || []).indexOf('ai') >= 0; }));
      return sortByTrend(list.filter(function (p) { return p.category === cat; }));
    },
    // Unified keyword search across title/blurb/long/tags/seo/category/audience/format.
    // `opts.physical=false` to exclude devices (e.g. Growth Library = digital only).
    search: function (q, opts) {
      q = (q || '').trim().toLowerCase(); if (!q) return [];
      opts = opts || {};
      var terms = q.split(/\s+/);
      var list = PRODUCTS.concat(BUNDLES); if (opts.physical !== false) list = list.concat(INVENTORY, CONCIERGE);
      return list.map(function (p) {
        var title = (p.title || '').toLowerCase();
        var hay = [p.title, p.blurb, p.long, (p.tags || []).join(' '), (p.seo || []).join(' '), p.category, (p.audience || []).join(' '), p.format].join(' ').toLowerCase();
        var score = 0;
        terms.forEach(function (t) { if (hay.indexOf(t) >= 0) score += 1; if (title.indexOf(t) >= 0) score += 2; });
        return { p: p, score: score };
      }).filter(function (x) { return x.score > 0; }).sort(function (a, b) {
        if (!!a.p.comingSoon !== !!b.p.comingSoon) return a.p.comingSoon ? 1 : -1;
        if (b.score !== a.score) return b.score - a.score;
        if (trendScoreOf(a.p) !== trendScoreOf(b.p)) return trendScoreOf(b.p) - trendScoreOf(a.p);
        return String(a.p.title || '').localeCompare(String(b.p.title || ''));
      }).map(function (x) { return x.p; });
    }
  };

  // ----- PEEK -> FULL UPGRADE DEEP-LINK (Ahmad 2026-06-01) ------------------
  // A buyer who paid for the 30% preview lands here from the delivery page via
  // ?unlock=<id>. Show a one-click "finish unlocking" bar that opens full checkout —
  // converting a peek into a full sale with no email round-trip. No surprise charge:
  // the bar requires an explicit click.
  function handleUnlockDeepLink() {
    try {
      var uid = new URLSearchParams(location.search).get('unlock');
      if (!uid) return;
      var p = byId(uid);
      if (!p || !p.priceCents) return;
      if (document.getElementById('iis-unlock-bar')) return;
      var bar = document.createElement('div');
      bar.id = 'iis-unlock-bar';
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:linear-gradient(90deg,#0a0a0a,#1a1407);color:#f1dca7;padding:13px 18px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;box-shadow:0 -8px 30px rgba(0,0,0,.45);font-family:system-ui,-apple-system,sans-serif';
      var msg = document.createElement('span');
      msg.style.cssText = 'font-size:14px;line-height:1.4';
      msg.innerHTML = 'Finish unlocking <b>' + esc(p.title) + '</b> — your preview is credited toward full access.';
      var go = document.createElement('button');
      go.textContent = 'Unlock full access · ' + money(p.priceCents);
      go.style.cssText = 'background:#b8954f;color:#1a1407;border:none;padding:11px 22px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;letter-spacing:.04em';
      go.onclick = function () { buy(uid, 'full'); };
      var x = document.createElement('button');
      x.textContent = '✕'; x.title = 'Dismiss';
      x.style.cssText = 'background:transparent;color:#f1dca7;border:none;cursor:pointer;font-size:16px;opacity:.7;line-height:1';
      x.onclick = function () { bar.remove(); };
      bar.appendChild(msg); bar.appendChild(go); bar.appendChild(x);
      document.body.appendChild(bar);
      var card = document.querySelector('[data-buy="' + uid + '-full"]');
      if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  }
  if (document.readyState !== 'loading') setTimeout(handleUnlockDeepLink, 400);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(handleUnlockDeepLink, 400); });
})();
