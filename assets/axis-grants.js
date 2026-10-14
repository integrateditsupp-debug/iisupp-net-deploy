// axis-grants.js — IIS Grant Radar screen (AXIS ONE, 2026-10-13). Vanilla ESM, same el()/head()/toast()
// primitives as every other screen. Non-repayable grants only. One-click Apply → the 'grant_apply'
// intent through the SAME queue every other write uses (/api/axis/intent): the worker holds unknown
// intent types behind its rails and nothing is submitted from the page (approval-first). Progress is
// tracked per grant in localStorage ('iis_grant_status'); the catalogue itself is static and dated,
// and says so on screen (Rule 14 — real-or-empty).
import { el, head, toast, postIntent } from './axis-dom.js';

// The write path. SCREENS.grants hands in axis-app's postIntent so every intent travels the same queue.
let send = postIntent;

// Scan = a real research job on the worker (the researcher agent: live web, per-claim sources, findings
// to the vault's 15_Research/) plus the intent for the board trail. Nothing is fabricated on screen.
function grantScan() {
  const q = 'Non-repayable grants, tax credits and wage subsidies open now for a Canadian IT / cybersecurity / AI services SME in Ontario (Integrated IT Support Inc., Whitby ON): name, funder, amount, deadline, eligibility, portal URL — new or changed in the last 30 days';
  send('grant_scan', { source: 'manual', query: q });
  if (window.axisClaude) { window.axisClaude.send(q, 'research.web'); toast('Scanning — findings land in the Claude tab and the vault.'); }
  else toast('Scan queued on the board — start the Claude worker to run it.');
}

// ── Grant catalogue ──────────────────────────────────────────────────────────
// Non-repayable only. Each entry mirrors the IIS Grant Tracker artifact.
const GRANTS = [
  {
    id: 'nrc-irap-core',
    name: 'NRC IRAP Core',
    body: 'National Research Council of Canada',
    amount: 50000,
    amountLabel: 'Up to $50K',
    type: 'Cash',
    status_label: 'Open',
    url: 'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap-industrial-research-assistance-program',
    deadline: 'Rolling',
    fit: 5,
    description: 'Cash grants for Canadian SMEs developing innovative tech products or processes. Strong fit for managed IT + AI automation work.',
    checklist: ['CRA Business Number', 'Fewer than 500 employees', 'Tech innovation project scope', 'Project plan with milestones', 'Budget breakdown'],
    tips: 'Emphasize AI-powered IT automation and measurable productivity gains. Assign an ITA (Industrial Technology Advisor) early.',
  },
  {
    id: 'nrc-irap-ai',
    name: 'NRC IRAP AI Assist',
    body: 'NRC IRAP',
    amount: 25000,
    amountLabel: 'Up to $25K',
    type: 'Cash',
    status_label: 'Open',
    url: 'https://nrc.canada.ca/en/support-technology-innovation/nrc-irap-industrial-research-assistance-program',
    deadline: 'Rolling',
    fit: 5,
    description: 'Targeted AI adoption sub-stream. Direct match for IIS automation stack — AI agents, n8n workflows, LLM-powered tools.',
    checklist: ['Active IRAP account', 'AI-specific project scope', 'Demo or prototype of AI feature', 'Clear business impact metrics'],
    tips: 'Frame around specific AI tools (Claude, HubSpot AI, n8n). Quantify time saved per week and revenue impact.',
  },
  {
    id: 'sred',
    name: 'SR&ED Tax Credit',
    body: 'Canada Revenue Agency',
    amount: 75000,
    amountLabel: 'Avg $75K refund',
    type: 'Tax Credit',
    status_label: 'Annual — File with T2',
    url: 'https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program.html',
    deadline: 'Annual (18 months after fiscal year-end)',
    fit: 5,
    description: '35% refundable tax credit on qualifying R&D expenditures. Applies to any experimental development work — custom software, AI systems, new methodologies.',
    checklist: ['CRA T2 return', 'T661 technical narrative', 'Form T2038', 'Time tracking records', 'SR&ED consultant (recommended)'],
    tips: 'Document every hour of experimental work. IT workflow automation, custom AI integrations, and novel orchestration layers all qualify.',
  },
  {
    id: 'oitc',
    name: 'Ontario Innovation Tax Credit',
    body: 'Ontario Ministry of Finance',
    amount: 30000,
    amountLabel: 'Up to $30K',
    type: 'Tax Credit',
    status_label: 'Open',
    url: 'https://www.ontario.ca/page/ontario-innovation-tax-credit',
    deadline: 'Annual (tax year)',
    fit: 4,
    description: '8% refundable corporate tax credit on Ontario SR&ED expenditures. Stacks on top of federal SR&ED for a combined ~43% effective rate.',
    checklist: ['Ontario corporation', 'Federal SR&ED claim filed', 'CT23 return', 'Ontario R&D activity documentation'],
    tips: 'File in parallel with SR&ED — same documentation feeds both. Stacking with IRAP is restricted, but OITC + SR&ED stacks cleanly.',
  },
  {
    id: 'oci-future-ready',
    name: 'OCI Future Ready',
    body: 'Ontario Centre of Innovation',
    amount: 50000,
    amountLabel: 'Up to $50K',
    type: 'Cash',
    status_label: 'Open',
    url: 'https://www.oc-innovation.ca/en/programs/future-ready/',
    deadline: 'Rolling',
    fit: 4,
    description: 'Workforce digital upskilling grants. Reimburse cost of training Ontario employees in cloud, cybersecurity, AI, and digital tools.',
    checklist: ['Ontario-based SME', 'Training plan with certified providers', 'Minimum 3 employees', 'Pre-approval before training starts'],
    tips: 'Apply BEFORE booking training. Use for CompTIA certs, Azure/GCP, AI tool courses. IIS team upskilling = direct eligibility.',
  },
  {
    id: 'oci-digital',
    name: 'OCI Digital Modernization',
    body: 'Ontario Centre of Innovation',
    amount: 100000,
    amountLabel: 'Up to $100K',
    type: 'Cash',
    status_label: 'Open',
    url: 'https://www.oc-innovation.ca/',
    deadline: 'Rolling',
    fit: 4,
    description: 'Grants for Ontario SMEs adopting digital technologies — cloud migration, automation platforms, cybersecurity tools, AI integration.',
    checklist: ['Ontario-based company', 'Digital transformation project plan', 'Cost-sharing (typically 50%)', 'Third-party vendor quotes', 'Post-project outcomes report'],
    tips: 'IIS can apply as vendor AND help clients apply. Frame Netlify/HubSpot/AI stack deployment as digital modernization. $100K ceiling.',
  },
  {
    id: 'canexport-smes',
    name: 'CanExport SMEs',
    body: 'Trade Commissioner Service',
    amount: 50000,
    amountLabel: 'Up to $50K',
    type: 'Cash',
    status_label: 'Watch — Monitor for US market work',
    url: 'https://www.tradecommissioner.gc.ca/funding-financement/canexport/sme-pme/index.aspx?lang=eng',
    deadline: 'Rolling',
    fit: 3,
    description: 'Reimbursement for export development activities — market research, trade shows, regulatory compliance for new markets. Activates when IIS targets US clients.',
    checklist: ['Export development plan', 'Non-Canadian target market', 'Eligible activity receipts', 'Net sales $100K–$100M'],
    tips: 'Start tracking US client prospecting costs now. Once US revenue begins, this becomes a strong reimbursement source.',
  },
  {
    id: 'isc',
    name: 'ISC – Indigenous Procurement',
    body: 'Indigenous Services Canada',
    amount: 0,
    amountLabel: 'Contract set-asides',
    type: 'Contract',
    status_label: 'Watch — Assess eligibility',
    url: 'https://www.sac-isc.gc.ca/',
    deadline: 'Ongoing',
    fit: 3,
    description: 'Federal procurement preference for Indigenous-owned businesses. Set-aside contracts across IT services. Assess IIS ownership structure for potential eligibility.',
    checklist: ['Indigenous ownership verification (51%+)', 'PSAB Indigenous business registration', 'PSPC vendor registration', 'Capability statement'],
    tips: 'If eligibility criteria are met, this unlocks set-aside federal IT contracts with no open competition. Very high ROI if eligible.',
  },
  {
    id: 'mitacs-accelerate',
    name: 'Mitacs Accelerate',
    body: 'Mitacs',
    amount: 7500,
    amountLabel: '$7,500 per intern unit',
    type: 'Wage Subsidy',
    status_label: 'Open',
    url: 'https://www.mitacs.ca/our-programs/accelerate-industry-academia-research-grants/',
    deadline: 'Rolling',
    fit: 4,
    description: 'Partners IIS with a university researcher or student on an R&D project. Mitacs funds 50% of intern cost — great for AI/cybersecurity research projects.',
    checklist: ['University partner identified', 'R&D project scope (4-month units)', 'Project supervisor named', 'Research institution agreement'],
    tips: 'Find a Waterloo, McMaster, or Ryerson partner for AI tooling or security research. Each unit: ~$15K total, you pay $7,500 — rest is Mitacs.',
  },
  {
    id: 'ictc-wil',
    name: 'ICTC WIL Digital',
    body: 'Information and Communications Technology Council',
    amount: 5000,
    amountLabel: 'Up to $5K per student',
    type: 'Wage Subsidy',
    status_label: 'Open',
    url: 'https://www.ictc-ctic.ca/programs/wil-digital/',
    deadline: 'Rolling',
    fit: 4,
    description: 'Wage subsidies for hiring digital tech co-op students — cybersecurity, cloud, data, AI. Subsidy covers up to 50% of wages.',
    checklist: ['Internship position description', 'Post-secondary partner or direct application', 'Minimum 8-week placement', 'Mentorship plan'],
    tips: 'Hire a co-op for IT operations, SOC work, or automation builds. Repeat each semester — this compounds over time.',
  },
];

// ── Persist applied/pending/awarded/declined state ──────────────────────────
const STORAGE_KEY = 'iis_grant_status';
function loadStatus() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveStatus(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}
function grantStatus(id) { return loadStatus()[id] || 'open'; }
function setGrantStatus(id, s) { const m = loadStatus(); m[id] = s; saveStatus(m); }

// ── Status display helpers ───────────────────────────────────────────────────
const STATUS_LABELS = { open: 'Ready', applied: 'Packet in progress', pending: 'Submitted · awaiting decision', awarded: 'Awarded ✓', declined: 'Declined' };
const STATUS_COLORS = {
  open:    'color:var(--txt-2)',
  applied: 'color:var(--gold)',
  pending: 'color:#5b9cf6',
  awarded: 'color:var(--ok,#4ade80)',
  declined:'color:var(--crit,#f87171)',
};
const FIT_LABEL = ['', '●○○○○', '●●○○○', '●●●○○', '●●●●○', '●●●●●'];
const FIT_COLOR = ['', '#777', '#777', 'var(--gold)', 'var(--gold)', 'var(--gold)'];

// ── Summary bar ─────────────────────────────────────────────────────────────
function renderSummary(c) {
  const map = loadStatus();
  const counts = { open: 0, applied: 0, pending: 0, awarded: 0, declined: 0 };
  for (const g of GRANTS) { const s = map[g.id] || 'open'; counts[s] = (counts[s] || 0) + 1; }
  const totalPotential = GRANTS.filter(g => ['open','applied','pending','awarded'].includes(map[g.id] || 'open'))
                               .reduce((a, g) => a + g.amount, 0);

  c.append(el('div', { class: 'card', style: 'display:flex;gap:24px;flex-wrap:wrap;align-items:center;padding:14px 20px;margin-bottom:16px' }, [
    el('div', { style: 'flex:1;min-width:160px' }, [
      el('div', { class: 'eyebrow', style: 'margin-bottom:4px' }, 'Grant Radar · IIS'),
      el('div', { style: 'font-size:22px;font-weight:600;color:var(--gold)' },
        '$' + totalPotential.toLocaleString() + '+'),
      el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:2px' }, 'Non-repayable potential'),
    ]),
    ...Object.entries(counts).filter(([, n]) => n > 0).map(([s, n]) =>
      el('div', { style: 'text-align:center' }, [
        el('div', { style: `font-size:18px;font-weight:600;${STATUS_COLORS[s]}` }, n),
        el('div', { style: 'font-size:11px;color:var(--txt-3)' }, STATUS_LABELS[s]),
      ])
    ),
    el('button', { class: 'chip', style: 'margin-left:auto', onclick: () => grantScan() }, '↺ Scan for New Grants'),
  ]));
}

// ── Per-grant card ───────────────────────────────────────────────────────────
function renderGrantCard(c, g, onStatusChange) {
  const st = grantStatus(g.id);
  const isApplied = ['applied', 'pending', 'awarded'].includes(st);
  const card = el('div', {
    class: 'card',
    style: 'margin-bottom:12px;border-left:3px solid ' + (isApplied ? 'var(--gold)' : 'var(--surface-3)'),
  });

  // ── Header row ──
  const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap' });
  header.append(el('div', { style: 'flex:1;min-width:160px' }, [
    el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap' }, [
      el('span', { style: 'font-weight:600;font-size:15px' }, g.name),
      el('span', { class: 'stage-tag' }, g.type),
      el('span', { style: `font-size:11px;${STATUS_COLORS[st]}` }, STATUS_LABELS[st]),
    ]),
    el('div', { style: 'font-size:12px;color:var(--txt-3);margin-top:2px' }, g.body),
  ]));
  header.append(el('div', { style: 'text-align:right;flex-shrink:0' }, [
    el('div', { style: 'font-size:20px;font-weight:600;color:var(--gold)' }, g.amountLabel),
    el('div', { style: `font-size:11px;${FIT_COLOR[g.fit] ? 'color:' + FIT_COLOR[g.fit] : ''}` },
      'Fit: ' + FIT_LABEL[g.fit]),
    el('div', { style: 'font-size:11px;color:var(--txt-3);margin-top:1px' }, 'Deadline: ' + g.deadline),
  ]));
  card.append(header);

  // ── Description ──
  card.append(el('div', { style: 'font-size:13px;color:var(--txt-2);margin:10px 0 8px;line-height:1.5' }, g.description));

  // ── Checklist + tips (collapsed by default) ──
  const detailId = 'grant-detail-' + g.id;
  const toggleBtn = el('button', { class: 'chip', style: 'font-size:11px', 'aria-expanded': 'false',
    onclick: function() {
      const d = document.getElementById(detailId);
      const open = d.hidden;
      d.hidden = !open;
      this.textContent = open ? 'Hide checklist ▲' : 'Checklist & tips ▼';
      this.setAttribute('aria-expanded', String(open));
    }
  }, 'Checklist & tips ▼');
  card.append(toggleBtn);

  const detail = el('div', { id: detailId, hidden: true, style: 'margin-top:10px' });
  detail.append(el('div', { style: 'font-size:11px;font-weight:600;color:var(--txt-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px' }, 'Application Checklist'));
  const cl = el('ul', { style: 'margin:0 0 10px 16px;padding:0;font-size:12px;color:var(--txt-2);line-height:1.7' });
  g.checklist.forEach(item => cl.append(el('li', {}, item)));
  detail.append(cl);
  detail.append(el('div', { style: 'font-size:11px;font-weight:600;color:var(--txt-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px' }, 'AXIS Tip'));
  detail.append(el('div', { style: 'font-size:12px;color:var(--txt-2);line-height:1.5;padding-left:4px;border-left:2px solid var(--gold)' }, g.tips));
  card.append(detail);

  // ── Action bar ──
  const actions = el('div', { class: 'appr-actions', style: 'margin-top:12px;flex-wrap:wrap;gap:8px' });

  if (st === 'open') {
    const applyBtn = el('button', {
      class: 'chip',
      style: 'border-color:var(--gold);color:var(--gold);font-weight:600',
      onclick: () => {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Sending to AXIS…';
        // Two rails, one click. The intent puts the grant on the board (worker-held, approval-first);
        // the brain-queue job is the actual work: Claude on Ahmad's machine builds the packet into the
        // vault and stops at the portal. Submission and sign-in stay his — agents never type credentials.
        send('grant_apply', {
          grant_id: g.id, grant_name: g.name, grant_url: g.url, amount: g.amount,
          checklist: g.checklist, tips: g.tips, body: g.body, deadline: g.deadline,
        });
        const brief = `${g.name} (${g.body}) — ${g.amountLabel}, ${g.type}, deadline ${g.deadline}. Portal: ${g.url}. ` +
          `Checklist: ${g.checklist.join('; ')}. Angle: ${g.tips}`;
        const queued = window.axisClaude ? window.axisClaude.send(brief, 'grant.prepare') : null;
        setGrantStatus(g.id, 'applied');
        toast(queued ? 'AXIS is building the ' + g.name + ' packet — the portal submit stays your click.' : 'Queued on the board — start the Claude worker to build the packet.');
        onStatusChange();
      },
    }, '⚡ Apply — AXIS prepares, you submit');
    actions.append(applyBtn);
  } else if (st === 'applied' || st === 'pending') {
    actions.append(el('span', { style: `font-size:12px;${STATUS_COLORS[st]}` }, st === 'applied' ? 'Packet in progress — see the Claude tab; submit from the portal when it is ready' : STATUS_LABELS[st]));
    if (st === 'applied') actions.append(el('button', { class: 'chip', onclick: () => { setGrantStatus(g.id, 'pending'); toast('Marked submitted'); onStatusChange(); } }, 'I submitted it'));
    actions.append(el('button', { class: 'chip', onclick: () => {
      setGrantStatus(g.id, 'open');
      toast('Reset to open');
      onStatusChange();
    }}, 'Reset'));
  } else if (st === 'awarded') {
    actions.append(el('span', { style: 'font-size:13px;color:var(--ok,#4ade80);font-weight:600' }, '🏆 Awarded'));
    actions.append(el('button', { class: 'chip', onclick: () => {
      send('grant_report', { grant_id: g.id, status: 'awarded' });
      toast('Award reported to AXIS');
    }}, 'Log Award Details'));
  } else if (st === 'declined') {
    actions.append(el('span', { style: 'font-size:12px;color:var(--crit,#f87171)' }, 'Declined — Review tips and reapply next cycle'));
    actions.append(el('button', { class: 'chip', onclick: () => {
      setGrantStatus(g.id, 'open');
      onStatusChange();
    }}, 'Reopen'));
  }

  // Status override buttons (always available for manual tracking)
  const overrideMenu = el('button', { class: 'chip', style: 'font-size:11px;color:var(--txt-3)', onclick: () => {
    const s = prompt('Set status: open / applied / pending / awarded / declined');
    if (s && STATUS_LABELS[s]) { setGrantStatus(g.id, s); toast('Status updated'); onStatusChange(); }
  }}, 'Override Status');
  actions.append(overrideMenu);
  actions.append(el('a', { href: g.url, target: '_blank', rel: 'noopener', class: 'chip', style: 'font-size:11px;color:var(--txt-3)' }, 'Open Portal ↗'));

  card.append(actions);
  c.append(card);
}

// ── Main render export ───────────────────────────────────────────────────────
export function renderGrants(c, opts = {}) {
  send = typeof opts.onIntent === 'function' ? opts.onIntent : postIntent;
  c.append(head('Grant Radar', '10 non-repayable grants · one click → AXIS builds the packet · the portal submit stays yours'));

  // Summary bar
  renderSummary(c);

  // Filter bar
  const filters = [['all', 'All'], ['open', 'Ready'], ['applied', 'In Progress'], ['awarded', 'Awarded'], ['tax_credit', 'Tax Credits'], ['wage', 'Wage Subsidies']];
  let activeFilter = 'all';

  const filterBar = el('div', { class: 'thread-bar', style: 'margin-bottom:16px' });
  const grantList = el('div', {});

  const rebuild = () => {
    grantList.innerHTML = '';
    filterBar.innerHTML = '';

    filterBar.append(...filters.map(([id, lbl]) => el('button', {
      class: 'chip',
      'aria-selected': activeFilter === id,
      onclick: () => { activeFilter = id; rebuild(); },
    }, lbl)));

    const map = loadStatus();
    let shown = GRANTS;
    if (activeFilter === 'open')       shown = GRANTS.filter(g => (map[g.id] || 'open') === 'open');
    if (activeFilter === 'applied')    shown = GRANTS.filter(g => ['applied','pending'].includes(map[g.id] || 'open'));
    if (activeFilter === 'awarded')    shown = GRANTS.filter(g => (map[g.id] || 'open') === 'awarded');
    if (activeFilter === 'tax_credit') shown = GRANTS.filter(g => g.type === 'Tax Credit');
    if (activeFilter === 'wage')       shown = GRANTS.filter(g => g.type === 'Wage Subsidy');

    if (!shown.length) {
      grantList.append(el('div', { class: 'empty', style: 'padding:32px' }, 'No grants match this filter.'));
    } else {
      shown.forEach(g => renderGrantCard(grantList, g, rebuild));
    }
  };

  c.append(filterBar);
  c.append(grantList);
  rebuild();

  // Footer note — Rule 14: the catalogue is a dated snapshot; the scan is on demand until the weekly
  // scheduled scan is approved.
  c.append(el('div', { class: 'footnote', style: 'margin-top:20px;text-align:center;padding-bottom:24px' }, [
    'Catalogue reviewed 2026-10-13 · status is tracked on this device · weekly Monday scan awaits your OK · ',
    el('button', { class: 'chip', style: 'font-size:11px;vertical-align:middle', onclick: () => grantScan() }, 'Scan now'),
  ]));
}
