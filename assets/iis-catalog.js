/* ============================================================================
   IIS PRODUCT CATALOG — single source of truth for Shop + Growth Library.
   ----------------------------------------------------------------------------
   Add a product = add ONE object to PRODUCTS below. It then appears on every
   page that renders from this catalog (Shop hub + Growth Library vault), with
   the right section/category, audience badge, price, and a working Stripe
   checkout button. This IS the scalable "product creation engine".

   Delivery model (MVP, no-new-backend):
     - free:true            -> preview/download opens directly
     - paid                 -> Stripe Checkout (existing /stripe-checkout priceData)
                               on success Stripe redirects to /unlock.html
     - password:true        -> after purchase, buyers use the access code IIS
                               sends them to unlock member/bundle downloads on
                               /unlock.html (client gate today; harden to a
                               purchase-verified backend in Phase 2).

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
      free: false, password: true, featured: true,
      preview: '/downloads/library/l1-it-support-bible-preview.html', file: null,
      related: ['gl-win11-kb', 'gl-outlook-fix', 'gl-m365-kb'], bundle: 'bundle-it-mastery', upsell: 'service'
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
      free: false, password: true, featured: true,
      preview: null, file: null,
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
      free: false, password: true, featured: true,
      preview: null, file: null,
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
      free: false, password: true, featured: true,
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
      free: false, password: true, featured: false,
      preview: null, file: null,
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
      free: false, password: true, featured: false,
      preview: null, file: null,
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
      free: false, password: true, featured: true,
      preview: null, file: null,
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
      free: false, password: true, featured: false,
      preview: null, file: null,
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
      free: false, password: true, featured: false,
      preview: null, file: null,
      related: ['gl-prompt-workflows', 'gl-ai-agent-starter'], bundle: 'bundle-ai-automation', upsell: 'aria'
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
      free: false, featured: true,
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
      items: PRODUCTS.map(function (p) { return p.id; }),
      priceCents: 200000, category: 'Premium Bundles', section: 'bundles',
      audience: ['business', 'human', 'ai', 'it'], format: 'All-access · 12 months',
      tags: ['all access', 'membership'], seo: ['IT and AI learning library'],
      featured: true, password: true, membership: true
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

  /* ---- HELPERS ---------------------------------------------------------- */
  function money(cents) { return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function byId(id) { return PRODUCTS.concat(BUNDLES, INVENTORY, CONCIERGE).filter(function (p) { return p.id === id; })[0] || null; }
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

  window.IIS_CATALOG = {
    meta: META, glCategories: GL_CATEGORIES, shopSections: SHOP_SECTIONS, audience: AUD,
    products: PRODUCTS, bundles: BUNDLES, bridges: BRIDGES, inventory: INVENTORY, concierge: CONCIERGE,
    money: money, esc: esc, byId: byId, buy: buy, order: order, renderCard: renderCard, previewCents: previewCents,
    // convenience filters
    all: function () { return PRODUCTS.concat(BUNDLES, INVENTORY, CONCIERGE); },
    forSection: function (sid) { return PRODUCTS.concat(BUNDLES, INVENTORY, CONCIERGE, BRIDGES).filter(function (p) { return p.section === sid; }); },
    forCategory: function (cat) {
      var list = PRODUCTS.concat(BUNDLES);
      if (!cat || cat === 'all') return list;
      if (cat === 'Featured') return list.filter(function (p) { return p.featured; });
      if (cat === 'For Humans') return list.filter(function (p) { return (p.audience || []).indexOf('human') >= 0; });
      if (cat === 'For AI Systems') return list.filter(function (p) { return (p.audience || []).indexOf('ai') >= 0; });
      return list.filter(function (p) { return p.category === cat; });
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
      }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.p; });
    }
  };
})();
