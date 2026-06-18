#!/usr/bin/env node
/**
 * inject-seo.mjs — Idempotent injection of JSON-LD + Open Graph + Twitter Card into NEW standalone pages.
 *  Safe: only touches pages with <!-- IIS_SEO_BLOCK --> placeholder OR new pages we explicitly list.
 *  Does NOT touch banned existing pages (index.html, aria.html, plans.html, etc.).
 *  Cat 14 — SEO + JSON-LD.
 */
import fs from 'node:fs';
import path from 'node:path';

const BANNED = new Set([
  'index.html', 'aria.html', 'plans.html', 'sample-scenarios.html',
  'services.html', 'start-here.html', 'growth-library.html', 'marketplace.html',
  'product.html', 'ai-edge.html'
]);

const PAGE_META = {
  'scorecard.html': { type: 'WebApplication', name: 'AI Readiness Scorecard', desc: 'Free 12-Q AI readiness self-assessment.', priority: 0.8 },
  'health-check.html': { type: 'WebApplication', name: 'IT Health Check', desc: '60-second IT health quiz.', priority: 0.8 },
  'compliance-gap.html': { type: 'WebApplication', name: 'Compliance Gap Quiz', desc: '90-sec vertical-tailored compliance gap quiz.', priority: 0.7 },
  'cost-calculator.html': { type: 'WebApplication', name: 'IT Cost Calculator', desc: 'Compare MSP spend vs ARIA + lean MSP.', priority: 0.7 },
  'webinar.html': { type: 'Event', name: 'AI for IT Support — Monthly Webinar', desc: 'Free monthly live walk-through.', priority: 0.7 },
  'insiders.html': { type: 'WebPage', name: 'ARIA Insiders Newsletter', desc: 'Monthly founder notes.', priority: 0.6 },
  'refer.html': { type: 'WebPage', name: 'Refer a Business — IIS Partner Program', desc: '10% recurring MRR for 12 months.', priority: 0.6 },
  'partners-prep.html': { type: 'WebPage', name: 'Partner Center Prep', desc: 'D-U-N-S + MS Cloud Partner + AWS Partner checklist.', priority: 0.5 },
  'government.html': { type: 'WebPage', name: 'ARIA for Government', desc: 'Canada-domiciled AI IT support for federal/provincial/municipal.', priority: 0.8 },
  'enterprise.html': { type: 'WebPage', name: 'ARIA for Enterprise', desc: 'Procurement-ready AI IT support.', priority: 0.8 },
  'soc2-readiness.html': { type: 'WebPage', name: 'SOC 2 Readiness Self-Assessment', desc: 'AICPA Common Criteria readiness.', priority: 0.5 },
  'status.html': { type: 'WebPage', name: 'IIS / ARIA System Status', desc: 'Live uptime + component health.', priority: 0.4 },
  'verticals/index.html': { type: 'WebPage', name: 'ARIA by Vertical', desc: 'Healthcare, Legal, Finance.', priority: 0.7 },
  'verticals/healthcare.html': { type: 'WebPage', name: 'ARIA for Healthcare', desc: 'HIPAA-aware AI IT support.', priority: 0.8 },
  'verticals/legal.html': { type: 'WebPage', name: 'ARIA for Legal', desc: 'Privilege-aware AI IT support.', priority: 0.8 },
  'verticals/finance.html': { type: 'WebPage', name: 'ARIA for Finance', desc: 'SOX/PCI-aware AI IT support.', priority: 0.8 },
  'compliance/automated-decisions.html': { type: 'WebPage', name: 'AI Automated Decisions Notice', desc: 'GDPR Art.22 + PIPEDA Principle 9.', priority: 0.4 },
  'compliance/iso-27001-readiness.html': { type: 'WebPage', name: 'ISO 27001 Readiness', desc: 'ISO 27001:2022 Annex A self-assessment.', priority: 0.4 },
  'compliance/pipeda-readiness.html': { type: 'WebPage', name: 'PIPEDA Readiness', desc: 'Canada PIPEDA 10 Fair Information Principles.', priority: 0.4 },
  'security/disclosure.html': { type: 'WebPage', name: 'Vulnerability Disclosure Policy', desc: 'ISO 29147 coordinated disclosure.', priority: 0.3 },
  'admin-console.html': { type: 'WebPage', name: 'ARIA Admin Console', desc: 'Owner-only system metrics.', priority: 0.1 },
  'leads-admin.html': { type: 'WebPage', name: 'Leads Inbox', desc: 'Admin-only lead inbox.', priority: 0.1 }
};

function generateJsonLd(filename, meta) {
  const url = 'https://iisupp.net/' + filename.replace(/\.html$/, '').replace(/\/index$/, '/');
  const base = {
    '@context': 'https://schema.org',
    '@type': meta.type,
    name: meta.name,
    description: meta.desc,
    url: url,
    provider: {
      '@type': 'Organization',
      name: 'Integrated IT Support Inc.',
      url: 'https://iisupp.net',
      sameAs: ['https://iisupp.net'],
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Whitby',
        addressRegion: 'ON',
        addressCountry: 'CA'
      }
    }
  };
  if (meta.type === 'Event') {
    base['@type'] = 'Event';
    base.eventStatus = 'https://schema.org/EventScheduled';
    base.eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode';
    base.organizer = base.provider; delete base.provider;
  }
  return base;
}

function generateOG(filename, meta) {
  const url = 'https://iisupp.net/' + filename.replace(/\.html$/, '').replace(/\/index$/, '/');
  return `
<meta property="og:title" content="${meta.name} — IIS">
<meta property="og:description" content="${meta.desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://iisupp.net/assets/aria-og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${meta.name} — IIS">
<meta name="twitter:description" content="${meta.desc}">
`.trim();
}

let injected = 0, skipped = 0;
for (const [file, meta] of Object.entries(PAGE_META)) {
  if (BANNED.has(file)) { skipped++; continue; }
  if (!fs.existsSync(file)) { console.log('SKIP missing:', file); continue; }
  let s = fs.readFileSync(file, 'utf8');
  // Skip if already injected
  if (s.includes('"@context": "https://schema.org"') || s.includes("'@context': 'https://schema.org'")) {
    console.log('SKIP already-has-jsonld:', file);
    skipped++;
    continue;
  }
  // Find </head>
  if (!s.includes('</head>')) { console.log('SKIP no </head>:', file); continue; }

  const jsonLd = generateJsonLd(file, meta);
  const og = generateOG(file, meta);
  const block = '\n' + og + '\n<script type="application/ld+json">\n' + JSON.stringify(jsonLd, null, 2) + '\n</script>\n';

  s = s.replace('</head>', block + '</head>');
  fs.writeFileSync(file, s);
  console.log('INJECTED:', file);
  injected++;
}
console.log('\nDone. Injected:', injected, '· Skipped:', skipped);
