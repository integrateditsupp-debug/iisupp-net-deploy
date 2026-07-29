import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import { connectLambda, getStore } from '@netlify/blobs';

export const CONTENT_ASSURANCE_STORE = 'content-assurance-ephemeral';
export const CONTENT_ASSURANCE_LEDGER = 'content-assurance-billing';
export const CONTENT_ASSURANCE_PURGE_LOG = 'content-assurance-purge-log';
export const SESSION_TTL_MS = 15 * 60 * 1000;
export const MAX_FILE_MB = 25;
export const MAX_WORDS = 15000;
export const MAX_PAGES = 20;

export const GOALS = ['Sales', 'Compliance', 'Hiring', 'Meeting-Content'];
export const MODULES = [
  { id: 'summary', label: 'Summary & key points' },
  { id: 'aiLikelihood', label: 'AI-likelihood signal' },
  { id: 'sensitiveData', label: 'Personal / sensitive-data scan' },
  { id: 'goalPlan', label: 'Goal-based action plan + 7 templates' },
  { id: 'experts', label: 'Expert suggestions' }
];

const STOP_WORDS = new Set([
  'the','and','for','that','with','this','from','your','have','will','into','about',
  'their','there','they','them','were','been','being','would','could','should','what',
  'when','where','which','while','than','then','into','over','under','between','after',
  'before','because','through','across','also','only','just','more','most','some','such',
  'each','other','very','much','many','make','made','does','doing','done','need','needs',
  'using','used','like','want','wants','real','work','team','teams','client','clients',
  'business','content','document','documents','meeting','meetings','report','reports'
]);

export const DISCLAIMER_COPY = {
  aiLikelihood: 'Estimated likelihood only. This signal is probabilistic, can be wrong, and is not proof or grounds for accusation.',
  sensitiveData: 'Flags data that may trigger privacy obligations under frameworks such as PIPEDA or GDPR. This is not certification, legal advice, or a compliance determination.',
  experts: "These are unverified, automatically-surfaced public search results — not endorsements, vetted referrals, or advice. IIS makes no representation as to accuracy, credentials, or suitability, and accepts no liability. Verify independently and do your own due diligence. Don't like the results? Regenerate.",
  global: 'All outputs are informational only and are not legal, forensic, employment, or compliance advice.'
};

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

// Netlify Functions running in Lambda-compatibility mode (named `handler` export) do NOT get
// the Blobs environment injected automatically the way v2 (`export default`) functions do — the
// credentials arrive on the Lambda `event`/`context` and must be handed to @netlify/blobs
// explicitly. Without this you get:
//   "The environment has not been configured to use Netlify Blobs ... supply siteID, token"
// Call this once at the top of every v1 handler that touches a store.
export function initBlobs(event) {
  if (shouldUseLocalStore()) return;
  try {
    connectLambda(event);
  } catch {
    // Already connected, or running in a context that configures Blobs itself. Non-fatal.
  }
}

export function getScopedStore(name) {
  if (shouldUseLocalStore()) return createLocalStore(name);
  return getStore({ name, consistency: 'strong' });
}

export function optionsResponse() {
  return { statusCode: 204, headers: corsHeaders(), body: '' };
}

export function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

export function normalizeModules(raw) {
  const incoming = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim().startsWith('[')
      ? JSON.parse(raw)
      : String(raw || '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
  const allowed = new Set(MODULES.map((mod) => mod.id));
  return incoming.filter((item) => allowed.has(item));
}

export function normalizeGoal(raw) {
  const candidate = String(raw || '').trim();
  return GOALS.includes(candidate) ? candidate : 'Meeting-Content';
}

export function boolish(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

export function normalizeText(input) {
  return String(input || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

export function countWords(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

export function estimatePages(text) {
  return Math.max(1, Math.ceil(countWords(text) / 500));
}

export function createSessionId() {
  return 'ca_' + crypto.randomUUID().replace(/-/g, '');
}

export function createDeliveryToken() {
  return crypto.randomBytes(18).toString('hex');
}

export function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

export function maskValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) {
    const [name, domain] = raw.split('@');
    return (name[0] || '*') + '***@' + domain;
  }
  if (/^\+?[0-9()\-.\s]{7,}$/.test(raw)) {
    return raw.replace(/[0-9](?=[0-9]{2})/g, '*');
  }
  if (raw.length <= 4) return '*'.repeat(raw.length);
  return raw.slice(0, 1) + '*'.repeat(Math.max(2, raw.length - 2)) + raw.slice(-1);
}

export function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractKeywords(text, limit = 6) {
  const counts = new Map();
  normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function buildSummary(text) {
  const sentences = splitSentences(text);
  const executiveSummary = sentences.slice(0, 3).join(' ') || 'No summary available from the submitted content.';
  const keyPoints = sentences.slice(0, 5).map((sentence) => trimSentence(sentence));
  const riskSignals = sentences
    .filter((sentence) => /\b(risk|delay|issue|concern|miss|gap|blocked|late|urgent|compliance|privacy|security)\b/i.test(sentence))
    .slice(0, 3)
    .map((sentence) => trimSentence(sentence));
  const openQuestions = [
    'Which output is meant for external use versus internal use?',
    'Who is the approval owner for the next step described in the content?',
    'Does any personal or regulated data need to be minimized before reuse?'
  ];
  return {
    executiveSummary,
    keyPoints: keyPoints.length ? keyPoints : ['No clear key points were extracted.'],
    notableRisks: riskSignals.length ? riskSignals : ['No explicit risk language was detected in the visible text.'],
    openQuestions
  };
}

export function buildAiLikelihood(text) {
  const sentences = splitSentences(text);
  const totalWords = countWords(text);
  const markersFor = [];
  const markersAgainst = [];
  let score = 38;

  if (/\b(in conclusion|overall|furthermore|moreover|delve|landscape|underscores)\b/i.test(text)) {
    score += 8;
    markersFor.push('formal transition language appears repeatedly');
  } else {
    markersAgainst.push('transitions do not follow a strongly templated pattern');
  }

  const lengths = sentences.slice(0, 10).map((sentence) => sentence.split(/\s+/).length).filter(Boolean);
  if (lengths.length >= 4) {
    const average = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    const variance = lengths.reduce((sum, value) => sum + ((value - average) ** 2), 0) / lengths.length;
    if (variance < 18) {
      score += 9;
      markersFor.push('sentence lengths are unusually uniform');
    } else {
      markersAgainst.push('sentence lengths vary in a more human-like way');
    }
  }

  if (/\b(uh|um|yeah|okay|gonna|wanna|kinda)\b/i.test(text)) {
    score -= 10;
    markersAgainst.push('casual or spoken-language markers are present');
  }

  if (/\baction item|follow-up|owner|deadline|decision\b/i.test(text)) {
    score -= 5;
    markersAgainst.push('specific operational references often reflect human meeting content');
  }

  if (totalWords < 250) {
    score -= 6;
    markersAgainst.push('very short samples are weak evidence for any confident signal');
  }

  score = Math.min(86, Math.max(12, Math.round(score)));

  return {
    estimatedLikelihoodPercent: score,
    indicatorsFor: markersFor.length ? markersFor : ['some structure patterns may align with assisted drafting'],
    indicatorsAgainst: markersAgainst.length ? markersAgainst : ['the sample also contains cues consistent with ordinary human editing'],
    explanation: 'This indicator is derived from structural cues, repetition patterns, and phrasing consistency rather than any forensic proof.',
    disclaimer: DISCLAIMER_COPY.aiLikelihood
  };
}

export function scanSensitiveData(text) {
  const definitions = [
    { type: 'Email address', severity: 'medium', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, privacyContext: ['PIPEDA', 'GDPR'] },
    { type: 'Phone number', severity: 'medium', regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, privacyContext: ['PIPEDA', 'GDPR'] },
    { type: 'SIN/SSN-like number', severity: 'high', regex: /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b|\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, privacyContext: ['PIPEDA', 'GDPR'] },
    { type: 'Date of birth-like date', severity: 'medium', regex: /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g, privacyContext: ['PIPEDA', 'GDPR'] },
    { type: 'Address-like line', severity: 'medium', regex: /\b\d{1,5}\s+[A-Za-z0-9.'-]+\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct)\b/gi, privacyContext: ['PIPEDA', 'GDPR'] },
    { type: 'Banking / account-like number', severity: 'high', regex: /\b(?:account|acct|iban|routing|transit)[^\n]{0,24}\d{4,}\b/gi, privacyContext: ['PIPEDA', 'GDPR'] },
    { type: 'Health identifier language', severity: 'high', regex: /\b(patient id|health card|medical record|mrn|diagnosis|treatment plan)\b/gi, privacyContext: ['PIPEDA', 'GDPR'] }
  ];

  const findings = [];
  for (const definition of definitions) {
    const matches = Array.from(new Set((text.match(definition.regex) || []).map((value) => value.trim()))).slice(0, 3);
    if (!matches.length) continue;
    findings.push({
      type: definition.type,
      severity: definition.severity,
      count: matches.length,
      sample: maskValue(matches[0]),
      privacyContext: definition.privacyContext,
      note: 'May trigger notice, minimization, handling, or access-control obligations.'
    });
  }

  const summary = findings.length
    ? 'Potential personal or sensitive data markers were detected and should be reviewed before reuse, sharing, or downstream automation.'
    : 'No obvious personal or sensitive-data markers were detected in the processed text sample.';

  return {
    findings,
    summary,
    disclaimer: DISCLAIMER_COPY.sensitiveData
  };
}

export function buildGoalPlan(goal, summaryBlock, sensitiveBlock) {
  const keywordLine = summaryBlock.keyPoints.slice(0, 3).join(' | ');
  const privacyNote = sensitiveBlock.findings.length
    ? 'Review flagged personal or regulated data before reuse, forwarding, or publication.'
    : 'No strong privacy blockers were detected, but final human review is still required.';

  const plans = {
    Sales: {
      recommendedApproach: 'Turn the source into a buyer-safe summary, then package a short external narrative, next-step ask, and internal follow-up owner list.',
      next7Days: [
        'Condense the core promise into one customer-facing summary.',
        'Pull out 2-3 buyer-relevant proof points before outreach.',
        'Decide which sections stay internal versus client-safe.'
      ],
      next30Days: [
        'Convert the strongest repeated themes into reusable sales assets.',
        'Track which objections or risk notes need approval before external use.',
        'Use a single owner to keep follow-up and asset revision moving.'
      ],
      watchouts: [privacyNote, 'Do not send AI-likelihood findings externally as proof or accusation.'],
      signal: keywordLine
    },
    Compliance: {
      recommendedApproach: 'Use the source to build a review packet: what was found, where obligations may exist, and what needs policy or legal review next.',
      next7Days: [
        'Separate factual findings from interpretation.',
        'Assign one owner to validate each sensitive-data flag.',
        'Record what evidence exists and what still needs manual review.'
      ],
      next30Days: [
        'Translate repeated issues into a standing remediation checklist.',
        'Update retention, handling, and approval steps where gaps appear.',
        'Escalate unresolved risk items for formal review.'
      ],
      watchouts: [privacyNote, 'Frame every output as advisory rather than compliant or certified.'],
      signal: keywordLine
    },
    Hiring: {
      recommendedApproach: 'Turn the content into a structured candidate or role packet, then standardize what interviewers should ask and what they should not infer.',
      next7Days: [
        'Extract the core competencies, risks, and unknowns.',
        'Create one scoring rubric tied to observable evidence.',
        'Remove personal details that do not belong in the hiring flow.'
      ],
      next30Days: [
        'Standardize interview prompts and summary format.',
        'Tighten who gets access to any sensitive source content.',
        'Document escalation for ambiguous or high-risk items.'
      ],
      watchouts: [privacyNote, 'Do not use the AI-likelihood signal as a hiring verdict.'],
      signal: keywordLine
    },
    'Meeting-Content': {
      recommendedApproach: 'Convert the source into a meeting-safe recap with decisions, owners, follow-ups, and a reusable SOP-friendly structure.',
      next7Days: [
        'Pull out decisions, owners, and due dates first.',
        'Separate direct quotes from operational next steps.',
        'Mask or remove personal details before broader circulation.'
      ],
      next30Days: [
        'Turn repeated meeting themes into an SOP or handoff template.',
        'Use one shared follow-up format so actions stop getting lost.',
        'Review whether recurring notes should move into a governed knowledge base.'
      ],
      watchouts: [privacyNote, 'Do not treat generated templates as final records without review.'],
      signal: keywordLine
    }
  };

  return {
    goal,
    ...(plans[goal] || plans['Meeting-Content'])
  };
}

function deterministicTemplateSet(goal, report) {
  const summary = report.summary.executiveSummary;
  const keyLine = report.summary.keyPoints.slice(0, 3).join('; ');
  const riskLine = report.sensitiveData.findings.length
    ? 'Privacy review needed: ' + report.sensitiveData.findings.map((item) => item.type).join(', ')
    : 'No strong privacy markers were flagged in the preview.';

  const byGoal = {
    Sales: [
      ['outreach-email', 'Customer outreach email', 'email', `Subject: Quick next step on ${summary.slice(0, 48)}\n\nHi [Name],\n\nI pulled together the clearest points from the source material:\n- ${keyLine}\n- ${riskLine}\n\nIf useful, I can send a tighter version focused on your immediate next step.\n\nBest,\n[Sender]`],
      ['follow-up-email', 'Follow-up email', 'email', `Subject: Following up on the content review\n\nHi [Name],\n\nWanted to close the loop on the review. The strongest buyer-relevant points are:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}\n\nOpen question: ${report.summary.openQuestions[0]}\n\nBest,\n[Sender]`],
      ['proposal-outline', 'Proposal outline', 'document', `1. Current need\n2. Key facts from the source\n3. Immediate risks or constraints\n4. Recommended scope\n5. Approval and next-step path\n\nReference summary:\n${summary}`],
      ['discovery-agenda', 'Discovery call agenda', 'document', `Discovery agenda\n- Confirm the real problem behind the source material\n- Validate the highest-value points: ${keyLine}\n- Clarify owners, timing, and approval steps\n- Note privacy or regulatory constraints`],
      ['objection-response', 'Objection response note', 'document', `Likely objection: [Insert]\nResponse angle:\n- tie back to source facts\n- avoid overclaiming\n- keep privacy-safe framing\n\nSupporting note: ${riskLine}`],
      ['internal-handoff', 'Internal handoff note', 'document', `Internal handoff\nSummary: ${summary}\nNext owner: [Name]\nRisks: ${report.summary.notableRisks.join(' | ')}\nRequired review: ${riskLine}`],
      ['exec-memo', 'Executive summary memo', 'document', `Executive memo\n\nWhat matters:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}\n\nDecision question:\n${report.summary.openQuestions[0]}`]
    ],
    Compliance: [
      ['remediation-memo', 'Remediation memo', 'document', `Remediation memo\n\nSummary: ${summary}\nPotential obligations: ${riskLine}\nImmediate actions:\n${report.goalPlan.next7Days.map((step) => '- ' + step).join('\n')}`],
      ['findings-register', 'Findings register entry', 'document', `Finding\n- Summary: ${summary}\n- Signals: ${keyLine}\n- Risks: ${report.summary.notableRisks.join('; ')}\n- Owner: [Assign]\n- Due date: [Assign]`],
      ['stakeholder-notice', 'Stakeholder notice', 'email', `Subject: Content assurance review - stakeholder notice\n\nThe review identified the following themes:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}\n\nAdvisory note: ${riskLine}`],
      ['policy-update', 'Policy update draft', 'document', `Policy update draft\n- scope affected\n- data handling change needed\n- approval path\n- evidence or review still required\n\nReason for update: ${summary}`],
      ['risk-review-agenda', 'Risk review agenda', 'document', `Risk review agenda\n- Confirm source facts\n- Validate possible privacy obligations\n- Assign remediation owners\n- Decide what remains out of scope`],
      ['evidence-request', 'Evidence request checklist', 'document', `Evidence request checklist\n${report.summary.openQuestions.map((question) => '- ' + question).join('\n')}\n- Confirm storage and access controls\n- Confirm final approval owner`],
      ['management-summary', 'Management summary', 'document', `Management summary\n${summary}\n\nPriority watchouts:\n${report.goalPlan.watchouts.map((item) => '- ' + item).join('\n')}`]
    ],
    Hiring: [
      ['candidate-brief', 'Candidate brief', 'document', `Candidate brief\nSummary: ${summary}\nSignals to validate:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}`],
      ['interview-guide', 'Interview guide', 'document', `Interview guide\n- Ask for examples tied to the main themes\n- Confirm ownership and judgment in ambiguous situations\n- Avoid using probabilistic AI signals as a verdict`],
      ['scorecard', 'Interview scorecard', 'document', `Scorecard\n- Role fit\n- Communication clarity\n- Evidence from source material\n- Risk or ambiguity notes\n- Final reviewer comments`],
      ['recruiter-message', 'Recruiter message', 'email', `Subject: Follow-up on submitted material\n\nThanks for sending this through. We reviewed the material and want to explore:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}`],
      ['manager-summary', 'Hiring manager summary', 'document', `Hiring manager summary\n${summary}\nWatchouts:\n${report.goalPlan.watchouts.map((item) => '- ' + item).join('\n')}`],
      ['reference-check', 'Reference-check prompts', 'document', `Reference-check prompts\n${report.summary.openQuestions.map((question) => '- ' + question).join('\n')}`],
      ['onboarding-note', 'Onboarding note', 'document', `Onboarding note\nIf selected, first-week focus should cover:\n${report.goalPlan.next7Days.map((step) => '- ' + step).join('\n')}`]
    ],
    'Meeting-Content': [
      ['meeting-summary', 'Meeting summary', 'document', `Meeting summary\n${summary}\n\nKey points:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}`],
      ['action-register', 'Action register', 'document', `Action register\n${report.goalPlan.next7Days.map((step, index) => `${index + 1}. ${step}`).join('\n')}`],
      ['follow-up-email', 'Follow-up email', 'email', `Subject: Follow-up and next steps\n\nThanks everyone. Here is the concise recap:\n${report.summary.keyPoints.map((point) => '- ' + point).join('\n')}\n\nWatchout: ${riskLine}`],
      ['stakeholder-memo', 'Stakeholder memo', 'document', `Stakeholder memo\nSummary: ${summary}\nOwners to confirm: [Assign]\nOpen questions:\n${report.summary.openQuestions.map((question) => '- ' + question).join('\n')}`],
      ['decision-log', 'Decision log', 'document', `Decision log\n- Decision made: [Insert]\n- Source evidence: ${keyLine}\n- Constraints: ${riskLine}`],
      ['handoff-note', 'Task handoff note', 'document', `Task handoff\nContext: ${summary}\nImmediate next steps:\n${report.goalPlan.next7Days.map((step) => '- ' + step).join('\n')}`],
      ['sop-recap', 'SOP recap draft', 'document', `SOP recap draft\nPurpose\nInputs\nSteps\nExceptions\nApproval owner\n\nStarting point: ${summary}`]
    ]
  };

  const templates = byGoal[goal] || byGoal['Meeting-Content'];
  return templates.map(([slot, title, channel, body]) => ({ slot, title, channel, body }));
}

async function maybeAnthropicTemplates(goal, text, report) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const model = process.env.CONTENT_ASSURANCE_MODEL || 'claude-sonnet-4-6';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        temperature: 0.2,
        system: 'You create cautious business-ready action plans and seven editable templates. Return strict JSON only. Do not include markdown fences. Never claim legal or forensic certainty.',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                goal,
                summary: report.summary,
                sensitiveData: report.sensitiveData,
                aiLikelihood: report.aiLikelihood,
                excerpt: normalizeText(text).slice(0, 7000),
                schema: {
                  actionPlan: {
                    recommendedApproach: 'string',
                    next7Days: ['string'],
                    next30Days: ['string'],
                    watchouts: ['string']
                  },
                  templates: [{
                    slot: 'string',
                    title: 'string',
                    channel: 'email|document',
                    body: 'string'
                  }]
                }
              })
            }
          ]
        }]
      })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const textBlock = Array.isArray(payload.content) ? payload.content.map((block) => block.text || '').join('\n') : '';
    const parsed = JSON.parse(textBlock.replace(/^```json\s*|\s*```$/g, ''));
    if (!parsed || !Array.isArray(parsed.templates) || !parsed.actionPlan) return null;
    return {
      actionPlan: {
        goal,
        recommendedApproach: parsed.actionPlan.recommendedApproach,
        next7Days: parsed.actionPlan.next7Days || [],
        next30Days: parsed.actionPlan.next30Days || [],
        watchouts: parsed.actionPlan.watchouts || []
      },
      templates: parsed.templates.slice(0, 7)
    };
  } catch {
    return null;
  }
}

export async function buildReport({ text, modules, goal, sourceMeta }) {
  const summary = buildSummary(text);
  const aiLikelihood = buildAiLikelihood(text);
  const sensitiveData = scanSensitiveData(text);
  let goalPlan = buildGoalPlan(goal, summary, sensitiveData);
  let templates = deterministicTemplateSet(goal, { summary, sensitiveData, goalPlan });

  if (modules.includes('goalPlan')) {
    const enhanced = await maybeAnthropicTemplates(goal, text, { summary, sensitiveData, aiLikelihood });
    if (enhanced) {
      goalPlan = { goal, ...enhanced.actionPlan };
      templates = enhanced.templates;
    }
  }

  return {
    sessionId: createSessionId(),
    sourceMeta,
    summary,
    aiLikelihood,
    sensitiveData,
    goalPlan,
    templates,
    experts: [],
    expertBrief: {
      keywords: extractKeywords(text, 6),
      locationHint: sourceMeta.location || ''
    },
    disclaimers: DISCLAIMER_COPY
  };
}

export function isExpired(session) {
  return !session || !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now();
}

export function sanitizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function shortDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export async function buildPdfBuffer(session) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 44 });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Content Assurance Report');
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#666666').text(`Session: ${session.sessionId}`);
    doc.text(`Created: ${shortDate(session.createdAt)}`);
    doc.text(`Expires: ${shortDate(session.expiresAt)}`);

    doc.moveDown().fillColor('#000000').fontSize(15).text('Executive Summary');
    doc.fontSize(11).text(session.report.summary.executiveSummary);

    doc.moveDown().fontSize(15).text('Key Points');
    session.report.summary.keyPoints.forEach((point) => doc.fontSize(11).text('• ' + point));

    doc.moveDown().fontSize(15).text('AI-Likelihood Signal');
    doc.fontSize(11).text(`Estimated likelihood of AI generation: ${session.report.aiLikelihood.estimatedLikelihoodPercent}%`);
    doc.text(session.report.aiLikelihood.explanation);
    doc.fillColor('#666666').fontSize(9).text(session.report.aiLikelihood.disclaimer);

    doc.moveDown().fillColor('#000000').fontSize(15).text('Sensitive-Data Scan');
    doc.fontSize(11).text(session.report.sensitiveData.summary);
    if (session.report.sensitiveData.findings.length) {
      session.report.sensitiveData.findings.forEach((item) => {
        doc.text(`• ${item.type} (${item.severity}) — sample ${item.sample}`);
      });
    } else {
      doc.text('• No obvious markers were detected in the processed sample.');
    }
    doc.fillColor('#666666').fontSize(9).text(session.report.sensitiveData.disclaimer);

    doc.moveDown().fillColor('#000000').fontSize(15).text(`${session.report.goalPlan.goal} Action Plan`);
    doc.fontSize(11).text(session.report.goalPlan.recommendedApproach);
    doc.moveDown(0.4).fontSize(12).text('Next 7 Days');
    session.report.goalPlan.next7Days.forEach((step) => doc.fontSize(11).text('• ' + step));
    doc.moveDown(0.4).fontSize(12).text('Next 30 Days');
    session.report.goalPlan.next30Days.forEach((step) => doc.fontSize(11).text('• ' + step));

    doc.moveDown().fontSize(15).text('Templates Included');
    session.report.templates.forEach((template, index) => doc.fontSize(11).text(`${index + 1}. ${template.title}`));
    doc.moveDown().fillColor('#666666').fontSize(9).text(DISCLAIMER_COPY.global);

    doc.end();
  });
}

function buildMarkdownReport(session) {
  const report = session.report;
  return [
    '# Content Assurance Report',
    '',
    `- Session: ${session.sessionId}`,
    `- Created: ${session.createdAt}`,
    `- Expires: ${session.expiresAt}`,
    `- File type: ${report.sourceMeta.fileType}`,
    `- Word count: ${report.sourceMeta.wordCount}`,
    '',
    '## Executive Summary',
    report.summary.executiveSummary,
    '',
    '## Key Points',
    ...report.summary.keyPoints.map((point) => `- ${point}`),
    '',
    '## AI-Likelihood Signal',
    `Estimated likelihood of AI generation: ${report.aiLikelihood.estimatedLikelihoodPercent}%`,
    report.aiLikelihood.explanation,
    report.aiLikelihood.disclaimer,
    '',
    '## Sensitive-Data Scan',
    report.sensitiveData.summary,
    ...report.sensitiveData.findings.map((item) => `- ${item.type} (${item.severity}) sample ${item.sample}`),
    report.sensitiveData.disclaimer,
    '',
    `## ${report.goalPlan.goal} Action Plan`,
    report.goalPlan.recommendedApproach,
    '',
    '### Next 7 Days',
    ...report.goalPlan.next7Days.map((step) => `- ${step}`),
    '',
    '### Next 30 Days',
    ...report.goalPlan.next30Days.map((step) => `- ${step}`),
    '',
    '### Watchouts',
    ...report.goalPlan.watchouts.map((item) => `- ${item}`),
    '',
    '## Global Disclaimer',
    DISCLAIMER_COPY.global
  ].join('\n');
}

export async function buildZipBundle(session) {
  const zip = new JSZip();
  const reportJson = JSON.stringify(session.report, null, 2);
  const pdfBuffer = await buildPdfBuffer(session);

  zip.file('assurance-report.pdf', pdfBuffer);
  zip.file('assurance-report.md', buildMarkdownReport(session));
  zip.file('report.json', reportJson);
  zip.file('README.txt', [
    'Content Assurance bundle',
    '',
    'This package is informational only.',
    DISCLAIMER_COPY.global,
    '',
    `Session: ${session.sessionId}`,
    `Expires: ${session.expiresAt}`,
    '',
    'Files included:',
    '- assurance-report.pdf',
    '- assurance-report.md',
    '- report.json',
    '- templates/*.txt'
  ].join('\n'));

  session.report.templates.forEach((template, index) => {
    const fileName = String(index + 1).padStart(2, '0') + '-' + template.slot.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '.txt';
    zip.file('templates/' + fileName, `${template.title}\nChannel: ${template.channel}\n\n${template.body}`);
  });

  if (Array.isArray(session.report.experts) && session.report.experts.length) {
    zip.file('experts.json', JSON.stringify(session.report.experts, null, 2));
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function trimSentence(sentence) {
  return String(sentence || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function shouldUseLocalStore() {
  return !process.env.NETLIFY && !process.env.NETLIFY_LOCAL && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.NETLIFY_SITE_ID;
}

function createLocalStore(name) {
  const dir = path.join(process.cwd(), '.netlify', 'content-assurance-dev', name);
  const filePathFor = (key) => path.join(dir, encodeURIComponent(key) + '.json');
  return {
    async get(key, options = {}) {
      try {
        const raw = await fs.readFile(filePathFor(key), 'utf8');
        return options.type === 'json' ? JSON.parse(raw) : raw;
      } catch {
        return null;
      }
    },
    async setJSON(key, value) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePathFor(key), JSON.stringify(value, null, 2), 'utf8');
    },
    async delete(key) {
      try { await fs.unlink(filePathFor(key)); } catch {}
    },
    async list() {
      try {
        const files = await fs.readdir(dir);
        return {
          blobs: files
            .filter((file) => file.endsWith('.json'))
            .map((file) => ({ key: decodeURIComponent(file.replace(/\.json$/i, '')) }))
        };
      } catch {
        return { blobs: [] };
      }
    }
  };
}
