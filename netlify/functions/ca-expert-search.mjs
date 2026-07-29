import {
  CONTENT_ASSURANCE_STORE,
  DISCLAIMER_COPY,
  getScopedStore,
  jsonResponse,
  normalizeText,
  optionsResponse,
  parseJsonBody,
  sanitizeEmail
} from './lib/content-assurance.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'POST only' });

  const body = parseJsonBody(event);
  if (!body) return jsonResponse(400, { error: 'Invalid JSON.' });

  const sessionId = String(body.sessionId || '').trim();
  const location = normalizeText(body.location || '').slice(0, 120);
  const regenerate = body.regenerate === true;
  if (!sessionId) return jsonResponse(400, { error: 'sessionId required.' });

  const store = getScopedStore(CONTENT_ASSURANCE_STORE);
  const session = await store.get('session-' + sessionId, { type: 'json' });
  if (!session) return jsonResponse(404, { error: 'Session not found.' });

  const payload = await searchExperts({
    goal: session.goal,
    keywords: session.report.expertBrief?.keywords || [],
    location,
    regenerate
  });

  session.report.experts = payload.results;
  session.report.expertBrief = {
    ...(session.report.expertBrief || {}),
    lastSearchAt: new Date().toISOString(),
    lastLocation: location
  };
  await store.setJSON('session-' + sessionId, session);

  return jsonResponse(200, {
    ok: true,
    provider: payload.provider,
    note: payload.note || '',
    disclaimer: DISCLAIMER_COPY.experts,
    results: payload.results
  });
};

async function searchExperts({ goal, keywords, location, regenerate }) {
  const provider = String(process.env.SEARCH_API_PROVIDER || '').trim().toLowerCase();
  if (provider === 'serper' && process.env.SEARCH_API_KEY) {
    return runSerperSearch({ goal, keywords, location, regenerate });
  }

  return {
    provider: provider || 'not-configured',
    note: 'Expert search is not configured in this environment yet. Add SEARCH_API_PROVIDER and SEARCH_API_KEY to enable live results.',
    results: []
  };
}

async function runSerperSearch({ goal, keywords, location, regenerate }) {
  const query = buildQuery(goal, keywords, location, regenerate);
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': process.env.SEARCH_API_KEY
    },
    body: JSON.stringify({ q: query, num: 8, gl: 'ca', hl: 'en' })
  });
  if (!response.ok) {
    return {
      provider: 'serper',
      note: 'Live search returned an error for this attempt.',
      results: []
    };
  }
  const payload = await response.json();
  const organic = Array.isArray(payload.organic) ? payload.organic : [];
  const results = organic.slice(0, 6).map((item) => normalizeSerperItem(item)).filter(Boolean);
  return {
    provider: 'serper',
    note: results.length ? '' : 'No directory-style expert results were returned for this attempt.',
    results
  };
}

function buildQuery(goal, keywords, location, regenerate) {
  const lane = {
    Sales: 'fractional sales consultant B2B',
    Compliance: 'privacy compliance consultant data protection',
    Hiring: 'recruiter talent acquisition consultant',
    'Meeting-Content': 'business process consultant communications facilitator'
  }[goal] || 'business consultant';
  const keywordSet = regenerate ? [...keywords].reverse() : keywords;
  return [lane, keywordSet.slice(0, 3).join(' '), location, 'directory OR profile OR consulting']
    .filter(Boolean)
    .join(' ');
}

function normalizeSerperItem(item) {
  if (!item || !item.link || !item.title) return null;
  const snippet = normalizeText(item.snippet || '');
  const phoneMatch = snippet.match(/\+?\d[\d().\-\s]{7,}\d/);
  const emailMatch = snippet.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const locationMatch = snippet.match(/\b(?:Toronto|Ontario|Canada|United States|Remote|Vancouver|Montreal|Calgary|Ottawa|Whitby)\b/i);
  return {
    name: item.title.slice(0, 120),
    role: snippet.slice(0, 140) || 'Public search result',
    organization: item.displayLink || '',
    location: locationMatch ? locationMatch[0] : '',
    contact: sanitizeEmail(emailMatch ? emailMatch[0] : '') || (phoneMatch ? phoneMatch[0] : ''),
    rating: '',
    sourceLabel: item.displayLink || 'Search result',
    sourceUrl: item.link
  };
}
