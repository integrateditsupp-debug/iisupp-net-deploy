#!/usr/bin/env node
import fs from 'node:fs';

const PAGES = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/aria', changefreq: 'weekly', priority: 0.9 },
  { path: '/plans', changefreq: 'monthly', priority: 0.9 },
  { path: '/verticals/', changefreq: 'monthly', priority: 0.8 },
  { path: '/verticals/healthcare', changefreq: 'monthly', priority: 0.8 },
  { path: '/verticals/legal', changefreq: 'monthly', priority: 0.8 },
  { path: '/verticals/finance', changefreq: 'monthly', priority: 0.8 },
  { path: '/government', changefreq: 'monthly', priority: 0.8 },
  { path: '/enterprise', changefreq: 'monthly', priority: 0.8 },
  { path: '/health-check', changefreq: 'monthly', priority: 0.8 },
  { path: '/compliance-gap', changefreq: 'monthly', priority: 0.7 },
  { path: '/refer', changefreq: 'monthly', priority: 0.6 },
  { path: '/partners-prep', changefreq: 'monthly', priority: 0.5 },
  { path: '/sample-scenarios', changefreq: 'monthly', priority: 0.7 },
  { path: '/services.html', changefreq: 'monthly', priority: 0.7 },
  { path: '/product.html', changefreq: 'monthly', priority: 0.7 },
  { path: '/ai-edge.html', changefreq: 'monthly', priority: 0.7 },
  { path: '/growth-library.html', changefreq: 'weekly', priority: 0.7 },
  { path: '/marketplace.html', changefreq: 'weekly', priority: 0.6 },
  { path: '/start-here.html', changefreq: 'monthly', priority: 0.7 },
  { path: '/compare/', changefreq: 'monthly', priority: 0.6 },
  { path: '/compare/aria-vs-retell/', changefreq: 'monthly', priority: 0.5 },
  { path: '/compare/aria-vs-vapi/', changefreq: 'monthly', priority: 0.5 },
  { path: '/docs/api', changefreq: 'monthly', priority: 0.5 },
  { path: '/status', changefreq: 'daily', priority: 0.4 },
  { path: '/compliance/', changefreq: 'yearly', priority: 0.3 },
  { path: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { path: '/terms', changefreq: 'yearly', priority: 0.3 },
  { path: '/ai-governance', changefreq: 'yearly', priority: 0.3 },
  { path: '/security/disclosure', changefreq: 'yearly', priority: 0.3 }
];

const today = new Date().toISOString().slice(0, 10);
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
for (const p of PAGES) {
  xml += '  <url><loc>https://iisupp.net' + p.path + '</loc>';
  xml += '<lastmod>' + today + '</lastmod>';
  xml += '<changefreq>' + p.changefreq + '</changefreq>';
  xml += '<priority>' + p.priority.toFixed(1) + '</priority></url>\n';
}
xml += '</urlset>\n';

fs.writeFileSync('sitemap.xml', xml);
console.log('sitemap.xml regenerated with', PAGES.length, 'URLs');
