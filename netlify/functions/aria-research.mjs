// aria-research v0.6.1 — symbolic state lookup + LIVE vendor fetch + bit-write to KB cache
// v0.6.1 patch (Ahmad 2026-05-14 PM):
//   - Quality gate: reject extracts with 0 query terms or nav-list patterns ("Popular articles" etc.)
//   - Vendor-native search URLs for chrome/edge/onedrive/sharepoint/teams/office/safari/apple/salesforce
//   - Trust > coverage: serving wrong content is worse than escalating per Garry Tan §1 user-trust
// POST /.netlify/functions/aria-research  body: { query, state? }
//   → { ok, state, title, steps, confidence, source, caveat }
//
// Per Ahmad 2026-05-14 + project_aria_research_agent_law.md:
//   1. First try the curated LIBRARY (zero latency, zero cost). 20 states.
//   2. On no_match: identify vendor in query (chrome, zoom, microsoft, etc.).
//   3. Check Netlify Blob cache `kb-live/${slug}.json` (7-day TTL).
//   4. If cache miss: fetch vendor support URL, heuristic extract, compress to bit-native chunk.
//   5. Persist new bit to blob cache. Return as recipe with confidence 0.7 + caveat.
//   6. If everything fails (no vendor, fetch error): return graceful no-match.
//
// AROC §4: bits added live become symbolic state codes (LIVE.<vendor>.<slug>).
// AROC §6: live fetches surface caveat — never claim certainty on fresh extracts.
// Zero LLM calls — all extraction is regex + heuristic. Free tier safe.

import { getStore } from '@netlify/blobs';

const LIVE_KB_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 6500;

export default async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return jsonResp(405, cors, { error: 'POST only' });

  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, cors, { error: 'invalid JSON' }); }

  const query = (body.query || '').toString().toLowerCase().trim();
  const stateHint = (body.state || '').toString().toUpperCase().trim();
  if (!query && !stateHint) return jsonResp(400, cors, { error: 'query or state required' });

  // Path 1: curated state hash (instant, zero cost)
  const detected = stateHint || detectState(query);
  const recipe = LIBRARY[detected];
  if (recipe) {
    const confidence = stateHint ? 0.92 : (recipe.confidence ?? 0.85);
    return jsonResp(200, cors, {
      ok: true,
      state: detected,
      title: recipe.title,
      steps: recipe.steps,
      confidence,
      source: 'curated-library-v1',
      caveat: confidence < 0.7 ? 'Confidence is moderate — confirm before acting on irreversible steps.' : null
    });
  }

  // Path 2: live vendor fetch + bit write
  const vendor = identifyVendor(query);
  if (vendor) {
    const slug = makeSlug(vendor.name, query);
    const liveState = `LIVE.${vendor.name.toUpperCase()}.${slug.toUpperCase().replace(/-/g, '_').slice(0, 32)}`;

    // 2a: cache check
    try {
      const kb = getStore({ name: 'aria-kb-live', consistency: 'strong' });
      const cached = await kb.get(`${slug}.json`, { type: 'json' });
      if (cached && cached.body && cached.created_at && (Date.now() - new Date(cached.created_at).getTime()) < LIVE_KB_TTL_MS) {
        return jsonResp(200, cors, {
          ok: true,
          state: liveState,
          title: cached.heading || vendor.name + ' — ' + slug.replace(/-/g, ' '),
          steps: bitToSteps(cached.body),
          confidence: 0.72,
          source: 'live-vendor-cache',
          caveat: 'Cached from a prior live fetch — confirm current vendor docs before acting on irreversible steps.',
          source_url: cached.source_url || null
        });
      }
    } catch (_) { /* cache failure is non-fatal */ }

    // 2b: live fetch
    let fetchResult;
    try {
      fetchResult = await fetchVendorPage(vendor, query);
    } catch (e) {
      console.warn('[aria-research v0.6] vendor fetch failed', vendor.name, String(e && e.message || e));
    }

    if (fetchResult && fetchResult.bit) {
      // 2c: persist bit to KB cache (best effort)
      try {
        const kb = getStore({ name: 'aria-kb-live', consistency: 'strong' });
        await kb.set(`${slug}.json`, JSON.stringify({
          heading: fetchResult.heading,
          body: fetchResult.bit,
          source_url: fetchResult.url,
          vendor: vendor.name,
          query_seed: query,
          created_at: new Date().toISOString()
        }), { contentType: 'application/json' });
      } catch (e) {
        console.warn('[aria-research v0.6] kb cache write failed', String(e && e.message || e));
      }

      return jsonResp(200, cors, {
        ok: true,
        state: liveState,
        title: fetchResult.heading || vendor.name + ' — research',
        steps: bitToSteps(fetchResult.bit),
        confidence: 0.7,
        source: 'live-vendor-fetch',
        caveat: 'This was researched live from ' + vendor.name + ' support docs. Verify before acting on irreversible steps.',
        source_url: fetchResult.url
      });
    }
  }

  // Path 3: graceful no-match
  return jsonResp(200, cors, {
    ok: true,
    state: detected || 'UNKNOWN',
    title: null,
    steps: [],
    confidence: 0.0,
    source: 'no-match',
    caveat: 'No curated recipe matched and no vendor was identified. Recommend specialist escalation.'
  });
};

function jsonResp(status, headers, obj) {
  return new Response(JSON.stringify(obj), { status, headers });
}

// ============= SYMBOLIC STATE DETECTOR =============
const STATE_PATTERNS = {
  'DISK.FULL':           /\b(out of (disk )?space|low on (disk )?space|no (disk )?space left|disk (is )?full|drive (is )?full|running (out of|low on) disk|low disk space|hard drive full|ssd (is )?full|c drive (is )?(full|out of space|low)|free up disk)\b/i,
  'OS.SLOW.PERF':        /\b((computer|laptop|pc|machine) (is )?(slow|sluggish|laggy|crawling|frozen|freezes|hang(s|ing)?)|running slow|performance lag|takes forever)\b/i,
  'OS.BOOT.FAIL':        /\b(won.?t boot|black screen|blue screen|bsod|stuck on boot|won.?t start|will not turn on)\b/i,
  'NET.WIFI.AUTH':       /\b(wifi (won.?t|cannot|can.?t) connect|wifi (not )?working|wrong password.*wifi|wifi password|incorrect (network )?password|connection refused.*wifi)\b/i,
  'NET.WIFI.NO.CONN':    /\b(can.?t connect to wifi|no wifi|no internet|wifi (is )?(down|broken|gone)|no network|disconnected|cannot reach internet)\b/i,
  'NET.SLOW':            /\b((internet|network|wifi|connection) (is )?slow|slow internet|slow connection|bandwidth (issue|problem))\b/i,
  'M365.OUTLOOK.SEND':   /\b(outlook (won.?t|cannot|can.?t) send|email (won.?t|cannot|can.?t) send|stuck in outbox|cannot send (email|mail))\b/i,
  'M365.OUTLOOK.RECV':   /\b(outlook (not |won.?t |cannot |can.?t )?(receiv|getting)|email not (coming|arriving|received))\b/i,
  'M365.OUTLOOK.OOO':    /\b(out of office|ooo|vacation responder|auto[-\s]?reply|automatic repl(y|ies)|outlook ooo|set ooo)\b/i,
  'M365.OUTLOOK.OPEN':   /\b(outlook (won.?t|cannot|can.?t) open|outlook crash|outlook hangs|outlook frozen|outlook not responding)\b/i,
  'AUT.PW.RESET':        /\b(forgot (my )?password|need to reset (my )?password|password reset|reset password|cannot log ?in|locked out|account locked)\b/i,
  'AUT.MFA.LOCK':        /\b(mfa (not )?working|2fa (not )?working|authenticator|lost (my )?phone|lost (my )?authenticator|cannot get (the )?code)\b/i,
  'PRT.OFFLINE':         /\b(printer (is )?(offline|not (showing|working|connecting))|cannot (find|see) printer|printer not detected)\b/i,
  'PRT.QUEUE.STUCK':     /\b(print queue (is )?stuck|print job (is )?stuck|cannot clear print queue|printer paused|jam(med)?)\b/i,
  'SEC.PHISH':           /\b(suspicious (email|link|site|message)|phishing|is this (a )?scam|got a weird email|received .* link)\b/i,
  'SEC.MALWARE':         /\b(virus|malware|infected|ransom(ware)?|trojan|spyware|popups|browser hijack)\b/i,
  'VPN.AUTH.FAIL':       /\b(vpn (won.?t|cannot|can.?t) connect|vpn (authentication|auth) (failed|fail|error)|vpn login (failed|wrong))\b/i,
  'VPN.NO.TUNNEL':       /\b(vpn (connected )?but no internet|vpn slow|tunnel (won.?t|cannot) (open|establish)|vpn drops?)\b/i,
  'CLOUD.SYNC':          /\b(onedrive (not )?syncing|sharepoint (not )?syncing|dropbox (not )?syncing|google drive (not )?syncing|sync (error|failed|stuck))\b/i,
  'SW.INSTALL.FAIL':     /\b((install|installation) (failed|error|stuck)|cannot install|setup (failed|error)|msi error|installer (crash|fail))\b/i,
  'SW.UPDATE.FAIL':      /\b((update|upgrade) (failed|error|stuck)|windows update.*(fail|error|stuck)|cannot update|update loop)\b/i
};

function detectState(query) {
  if (!query) return null;
  for (const [state, re] of Object.entries(STATE_PATTERNS)) {
    if (re.test(query)) return state;
  }
  return null;
}

// ============= VENDOR WHITELIST + LIVE FETCH =============
// Vendor map: kw matchers → support search URLs. Fetch returns relevant page text.
const VENDORS = [
  // v0.6.1: vendor-native search where it exists. Domains restricted to vendor's own KB
  // so the URL extractor can validate hits.
  { name: 'chrome',     kws: ['chrome', 'google chrome', 'chrome browser'], search: 'https://support.google.com/chrome/search?query=', host: 'support.google.com/chrome' },
  { name: 'firefox',    kws: ['firefox', 'mozilla'], search: 'https://support.mozilla.org/en-US/search?q=', host: 'support.mozilla.org' },
  { name: 'edge',       kws: ['edge', 'microsoft edge'], search: 'https://support.microsoft.com/en-us/search/results?query=', host: 'support.microsoft.com' },
  { name: 'safari',     kws: ['safari'], search: 'https://support.apple.com/kb/index?page=search&type=organic&q=', host: 'support.apple.com' },
  { name: 'zoom',       kws: ['zoom', 'zoom meeting'], search: 'https://support.zoom.com/hc/en/search?query=', host: 'support.zoom.com' },
  { name: 'teams',      kws: ['teams', 'microsoft teams', 'ms teams'], search: 'https://support.microsoft.com/en-us/search/results?query=teams%20', host: 'support.microsoft.com' },
  { name: 'slack',      kws: ['slack'], search: 'https://slack.com/help/searchresults?query=', host: 'slack.com/help' },
  { name: 'dropbox',    kws: ['dropbox'], search: 'https://help.dropbox.com/search?query=', host: 'help.dropbox.com' },
  { name: 'onedrive',   kws: ['onedrive'], search: 'https://support.microsoft.com/en-us/search/results?query=onedrive%20', host: 'support.microsoft.com' },
  { name: 'sharepoint', kws: ['sharepoint'], search: 'https://support.microsoft.com/en-us/search/results?query=sharepoint%20', host: 'support.microsoft.com' },
  { name: 'office',     kws: ['microsoft office', 'office 365', 'm365', 'word', 'excel', 'powerpoint'], search: 'https://support.microsoft.com/en-us/search/results?query=', host: 'support.microsoft.com' },
  { name: 'apple',      kws: ['mac', 'macbook', 'imac', 'macos', 'apple', 'iphone', 'ipad'], search: 'https://support.apple.com/kb/index?page=search&type=organic&q=', host: 'support.apple.com' },
  { name: 'salesforce', kws: ['salesforce', 'sfdc'], search: 'https://help.salesforce.com/s/global-search/%40uri?language=en_US&q=', host: 'help.salesforce.com' },
  { name: 'hubspot',    kws: ['hubspot'], search: 'https://knowledge.hubspot.com/search?term=', host: 'knowledge.hubspot.com' },
  { name: 'quickbooks', kws: ['quickbooks', 'qbo', 'intuit quickbooks'], search: 'https://quickbooks.intuit.com/learn-support/en-us/help-search?searchString=', host: 'quickbooks.intuit.com' },
  { name: 'adobe',      kws: ['adobe', 'acrobat', 'photoshop', 'illustrator', 'indesign', 'premiere'], search: 'https://helpx.adobe.com/search.html?q=', host: 'helpx.adobe.com' },
  { name: 'github',     kws: ['github', 'gh'], search: 'https://docs.github.com/en/search?query=', host: 'docs.github.com' },
  { name: 'gitlab',     kws: ['gitlab'], search: 'https://docs.gitlab.com/search/?q=', host: 'docs.gitlab.com' },
  { name: 'atlassian',  kws: ['jira', 'confluence', 'bitbucket', 'atlassian'], search: 'https://support.atlassian.com/search/?query=', host: 'support.atlassian.com' },
  { name: 'asana',      kws: ['asana'], search: 'https://asana.com/help/search?query=', host: 'asana.com/help' },
  { name: 'notion',     kws: ['notion'], search: 'https://www.notion.so/help/search?q=', host: 'notion.so/help' },
  { name: 'figma',      kws: ['figma'], search: 'https://help.figma.com/hc/en-us/search?query=', host: 'help.figma.com' }
];

function identifyVendor(query) {
  const q = query.toLowerCase();
  for (const v of VENDORS) {
    for (const kw of v.kws) {
      // word-boundary-ish: avoid matching kw inside a longer word
      const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(q)) return v;
    }
  }
  return null;
}

function makeSlug(vendorName, query) {
  // strip vendor name from query so the slug is the *issue*, not the brand
  let q = query.toLowerCase();
  q = q.replace(new RegExp('\\b' + vendorName + '\\b', 'gi'), '');
  q = q.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  q = q.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w)).slice(0, 6).join('-');
  if (!q) q = 'general';
  return vendorName + '-' + q.slice(0, 50);
}

const STOPWORDS = new Set([
  'the','and','for','with','are','was','this','that','have','has','can','can','its','itself','your','you','our',
  'help','please','about','from','into','what','how','why','need','some','some','they','them','then','than',
  'when','where','which','will','would','should','could','might','really','very','just','only','not','dont',
  'cant','wont','isnt','arent','doesnt','didnt','their','there','these','those','being','been','have','having'
]);

async function fetchVendorPage(vendor, query) {
  // Build the search URL with the query; fetch the SERP, extract the first content URL,
  // then fetch that content URL and extract a bit.
  const searchUrl = vendor.search + encodeURIComponent(query);

  let serpHtml;
  try {
    serpHtml = await fetchWithTimeout(searchUrl, FETCH_TIMEOUT_MS);
  } catch (e) {
    return null;
  }
  if (!serpHtml) return null;

  // Try to find a content URL in the SERP HTML — first relevant http(s) link to the vendor's domain
  const contentUrl = extractFirstContentUrl(serpHtml, vendor);
  let contentHtml = null;
  let usedUrl = searchUrl;
  if (contentUrl) {
    try {
      contentHtml = await fetchWithTimeout(contentUrl, FETCH_TIMEOUT_MS);
      usedUrl = contentUrl;
    } catch (_) { contentHtml = null; }
  }
  // If content fetch failed, fall back to extracting a bit from the SERP itself
  const html = contentHtml || serpHtml;

  const extracted = extractBit(html, query);
  if (!extracted) return null;

  return {
    heading: extracted.heading,
    bit: extracted.bit,
    url: usedUrl
  };
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'ARIA-Research/0.6 (+https://iisupp.net/aria; bit-native KB writer)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!r.ok) return null;
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractFirstContentUrl(html, vendor) {
  // v0.6.1: prefer URLs on the vendor's expected host. If none found, return null
  // (don't follow random off-domain links — better to fall through to graceful no-match).
  const urlRe = /https?:\/\/[^\s"'<>)]+/g;
  const seen = new Set();
  const expectedHost = (vendor && vendor.host) || '';
  let m;
  // Pass 1: vendor-host URLs that look like article pages
  while ((m = urlRe.exec(html)) !== null) {
    let u = m[0].replace(/&amp;/g, '&').replace(/[)>]+$/, '');
    if (seen.has(u)) continue;
    seen.add(u);
    if (u.length > 400) continue;
    if (expectedHost && u.indexOf(expectedHost) === -1) continue;
    // Skip the search page itself + nav links
    if (/[?&](query|q|search|term|searchString)=/i.test(u)) continue;
    if (/\/(search|searchresults|index|home|popular|categories|topics|community)(\/|$|\?)/i.test(u)) continue;
    return u;
  }
  return null;
}

// v0.6.1: nav-list / TOC / category-page patterns. If a heading or body matches these,
// it's not a real article — reject it to avoid serving "Popular articles" type junk.
const NAV_PATTERNS = /^(popular articles?|topics?|categories|browse|all (articles?|topics)|frequently asked|help center|knowledge base|getting started|community|contact|home|index|table of contents|toc|search results?)$/i;
const NAV_BODY_PATTERNS = /\b(view all articles|see all topics|browse all|popular articles|categories\s*$|table of contents|sign in|create an account|contact (us|support))\b/i;

function extractBit(html, query) {
  // Strip script/style/svg
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                 .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                 .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
                 .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
                 .replace(/<!--[\s\S]*?-->/g, ' ');

  const queryTerms = query.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOPWORDS.has(t));

  // Grab all H1/H2/H3 headings + the chunk that follows
  const headingRe = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<h[1-3][^>]*>|$)/gi;
  let bestHeading = null;
  let bestBody = null;
  let bestScore = -1;
  let m;

  while ((m = headingRe.exec(body)) !== null) {
    const headingText = stripTags(m[2]).trim();
    if (!headingText || headingText.length > 200) continue;
    // v0.6.1 quality gate: skip nav/TOC/category headings
    if (NAV_PATTERNS.test(headingText)) continue;
    const sectionText = stripTags(m[3]).trim();
    if (!sectionText || sectionText.length < 60) continue;
    if (NAV_BODY_PATTERNS.test(sectionText)) continue;
    const combined = (headingText + ' ' + sectionText).toLowerCase();
    let score = 0;
    for (const term of queryTerms) if (combined.indexOf(term) >= 0) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestHeading = headingText;
      bestBody = sectionText;
    }
  }

  // v0.6.1 confidence floor: if no query terms appeared in any candidate, reject.
  // Better to escalate than serve unrelated content.
  if (bestScore < 1 || !bestHeading || !bestBody) {
    return null;
  }

  return {
    heading: bestHeading,
    bit: compressToBit(bestHeading, bestBody)
  };
}

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function compressToBit(heading, body) {
  // Bit-native rules per feedback_kb_bit_native_style.md:
  //   3-7 lines, ~300 chars, first sentence = direct answer, escalation trigger at end.
  const sentences = body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  let out = [];
  let chars = 0;
  for (const s of sentences) {
    if (chars + s.length > 700) break;
    out.push(s);
    chars += s.length;
    if (out.length >= 5) break;
  }
  if (!out.length && body) out.push(body.slice(0, 400));
  out.push('If this does not resolve in two attempts, that is an L2 escalation — call (647) 581-3182.');
  return out.join('\n\n');
}

function bitToSteps(bit) {
  // Render the bit as a steps array for the existing recipe UI
  const lines = bit.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  return lines.length ? lines : [bit];
}

// ============= CURATED RECIPE LIBRARY (unchanged from v0.5) =============
const LIBRARY = {
  'DISK.FULL': { title: 'C drive / disk is out of space', steps: ['Open Settings → System → Storage. Check which drive is full.','Click "Temporary files" → tick Recycle Bin, Temporary files, Delivery Optimization Files → Remove.','Open Storage Sense (toggle on) → Run Storage Sense now. This frees Windows.old + cache.','In File Explorer, right-click the drive → Properties → Disk Cleanup → "Clean up system files" → tick everything safe.','If still under 10% free: move Downloads + OneDrive cache to another drive, or run "wmic logicaldisk get caption, freespace" to confirm.'], confidence: 0.92 },
  'OS.SLOW.PERF': { title: 'Computer is slow / sluggish', steps: ['Press Ctrl+Shift+Esc → open Task Manager → Performance tab. Check CPU, Memory, Disk, Network for anything stuck at 100%.','If Memory is at 100%: Processes tab → sort by Memory → end the top non-essential process.','If Disk is at 100%: same Processes tab → sort by Disk → check for SearchIndexer, Windows Update, antivirus scan. Pause antivirus full scan if running.','Settings → Apps → Startup → disable everything not essential (browsers, chat apps, etc.). Reboot.','If still slow: Settings → System → Recovery → "Reset this PC" → "Keep my files" is the last-resort fix.'], confidence: 0.90 },
  'OS.BOOT.FAIL': { title: 'PC won\'t boot / black screen / BSOD', steps: ['Hard-power-off (hold power 10 sec). Disconnect all USB devices except keyboard + mouse. Power on.','If still no boot: power on → hard-off three times in a row → Windows enters Automatic Repair.','In Automatic Repair: Advanced options → Troubleshoot → Startup Repair. Let it finish.','If repair fails: same menu → Command Prompt → run `sfc /scannow` then `chkdsk C: /f /r` → reboot.','If BSOD with a stop code: photograph the code (e.g., MEMORY_MANAGEMENT) and escalate — likely hardware.'], confidence: 0.85 },
  'NET.WIFI.AUTH': { title: 'WiFi authentication / password issue', steps: ['Settings → Network → WiFi → Manage known networks → forget the network.','Reconnect — re-enter the password carefully (case sensitive).','If still rejected: confirm the password with whoever owns the router. Default routers often have the password printed on the device.','On corporate WiFi (802.1X): check that your account isn\'t locked and that the device certificate is current.','Last resort: `netsh wlan delete profile name="<SSID>"` then re-add the network.'], confidence: 0.90 },
  'NET.WIFI.NO.CONN': { title: 'WiFi / network not connecting', steps: ['Confirm airplane mode is OFF. Right-click WiFi icon → Diagnose problems.','Try other networks (phone hotspot). If those work, the issue is the target network, not your device.','Restart the router: unplug power, wait 30 sec, plug back. Wait 2 min for full boot.','Run `ipconfig /flushdns` then `ipconfig /release` then `ipconfig /renew` in an admin Command Prompt.','If still failing: Device Manager → Network adapters → right-click WiFi adapter → Update driver. Then reboot.'], confidence: 0.88 },
  'NET.SLOW': { title: 'Internet is slow', steps: ['Run a speed test (fast.com or speedtest.net). Compare against your plan\'s rated speed.','If speedtest is OK but specific sites are slow: clear browser cache, try a different browser.','If speedtest is slow too: restart router. Move closer if WiFi. Plug in via Ethernet to isolate WiFi vs ISP.','Task Manager → Performance → Network tab. If Disk + Network are both pegged: pause OneDrive / Dropbox syncs and Windows Update.','If consistently slow: ISP issue. Call the ISP with your speedtest results.'], confidence: 0.85 },
  'M365.OUTLOOK.SEND': { title: 'Outlook won\'t send email', steps: ['Check Outbox folder. If the message sits there: right-click → Move to Drafts → reopen → re-send.','Send/Receive tab → "Work Offline" — confirm it is OFF (button shouldn\'t look depressed).','File → Account Settings → check Repair on the email account.','If repeated send failures: confirm SMTP server settings match your tenant (port 587, TLS, your username).','If the message is large: attachments over 25 MB get rejected. Move large files to OneDrive and share a link instead.'], confidence: 0.88 },
  'M365.OUTLOOK.OOO': { title: 'Set Out of Office / auto-reply', steps: ['Open Outlook → File → Automatic Replies (Out of Office).','Select "Send automatic replies". Optionally set a date range.','Type your reply for "Inside my organization" tab. Then click "Outside My Organization" tab and write a version for external senders.','Click OK. Outlook will start auto-replying to incoming mail within ~1 minute.','On the web: Outlook.com → Settings (gear) → Mail → Automatic replies. Same fields.'], confidence: 0.95 },
  'M365.OUTLOOK.OPEN': { title: 'Outlook won\'t open / crashes / not responding', steps: ['Close Outlook completely (Task Manager → end Outlook.exe if needed).','Reopen Outlook holding Ctrl — it asks to start in Safe Mode. If Safe Mode works → an add-in is the culprit.','File → Options → Add-ins → at bottom select COM Add-ins → Go → uncheck all → restart.','If still won\'t open: run "Outlook.exe /resetnavpane" (Win+R, paste it). Then try opening normally.','Last resort: File → Account Settings → uncheck "Use Cached Exchange Mode" → restart Outlook → recheck after sign-in.'], confidence: 0.85 },
  'AUT.PW.RESET': { title: 'Password reset / locked out', steps: ['Go to https://passwordreset.microsoftonline.com (for M365) or the company SSO sign-in page → click "Forgot my password".','Confirm identity via phone / authenticator / backup email.','Choose a new password meeting policy: 12+ chars, mixed case, number, symbol. Avoid prior passwords.','After reset, sign out of EVERY device (Outlook on phone, Teams, OneDrive) and sign back in with the new password.','If locked out repeatedly: contact our helpdesk at (647) 581-3182 — admin can unlock from Entra/AD directly.'], confidence: 0.92 },
  'AUT.MFA.LOCK': { title: 'MFA / authenticator not working', steps: ['If you lost the phone with the authenticator: helpdesk must reset MFA from the admin console. Call (647) 581-3182.','If the authenticator is on a new phone: open Microsoft Authenticator → scan the QR from https://aka.ms/mfasetup after admin re-issues the enrollment.','If you have backup codes: use one to sign in, then re-enroll the authenticator.','If the code seems wrong: phone time is off. Settings → Date & time → enable automatic time. The TOTP code depends on accurate time.','For SMS fallback: confirm your phone number is current in https://account.microsoft.com → Security info.'], confidence: 0.85 },
  'PRT.OFFLINE': { title: 'Printer is offline / not showing', steps: ['Confirm the printer is powered on and connected to the same WiFi as your computer.','Settings → Bluetooth & devices → Printers & scanners → click the printer → "Open print queue" → Printer menu → uncheck "Use Printer Offline".','If it\'s still offline: remove and re-add the printer. Manufacturer website + model number gets you the latest driver.','For network printers: ping the printer\'s IP from Command Prompt. If no response, the printer dropped off the network — restart it.','If shared via a print server: try restarting the Print Spooler service (services.msc → Print Spooler → Restart).'], confidence: 0.88 },
  'PRT.QUEUE.STUCK': { title: 'Print queue is stuck / jam', steps: ['Open print queue (Settings → Printers → printer → Open queue). Cancel all jobs.','If they won\'t clear: services.msc → Print Spooler → Stop. Open File Explorer → C:\\Windows\\System32\\spool\\PRINTERS → delete everything inside. Restart Print Spooler.','For paper jams: open the printer, follow the jam-clearing diagram on the printer (it usually lights up the jammed section).','After clearing: send a test print from Notepad — simplest possible print to isolate driver issues.','If queue keeps getting stuck on the same job: that job is malformed. Re-create the PDF or recopy the document.'], confidence: 0.85 },
  'SEC.PHISH': { title: 'Suspicious email / link / phishing check', steps: ['DO NOT click the link or reply. Do not download attachments.','Hover the sender name to reveal the actual email address — phishing often uses look-alike domains (microsft.com vs microsoft.com).','Hover the link to see the destination URL. If it doesn\'t match what the text claims, it\'s suspicious.','If you must verify: open a new browser tab and navigate to the supposed sender\'s site directly (don\'t click the email link).','Forward the message to integrateditsupp@iisupp.net for review. Then delete from your inbox.'], confidence: 0.95 },
  'SEC.MALWARE': { title: 'Suspected virus / malware / ransomware', steps: ['Disconnect the device from the network immediately (turn off WiFi, unplug Ethernet) to prevent spread.','DO NOT shut down — many incident-response tools need a live state. Take a photo of any ransom note or pop-up.','Open Windows Security → Virus & threat protection → Quick scan first, then Full scan.','If ransomware (files renamed, ransom note present): DO NOT pay. Call (647) 581-3182 immediately. We have incident-response procedures.','After scan: change passwords for any account accessed on this device from a CLEAN device. Enable MFA everywhere.'], confidence: 0.92 },
  'VPN.AUTH.FAIL': { title: 'VPN authentication failed', steps: ['Confirm username + password are current. If you recently reset your password, the VPN may still have the old one cached — re-enter.','If MFA-protected: ensure you\'re approving the MFA prompt promptly (most VPNs time out at 30 sec).','Check the VPN client for an update. Old clients often fail against modern servers.','If your account was recently created: confirm with admin that VPN access was granted to your group.','Last resort: uninstall the VPN client, reboot, reinstall the latest version from our IT portal.'], confidence: 0.85 },
  'VPN.NO.TUNNEL': { title: 'VPN connects but no internet / drops', steps: ['Disconnect + reconnect the VPN once. Sometimes the route table is corrupted on first connect.','Check split tunneling: if enabled, you should reach internet + corporate gateway; if not, all traffic goes through corporate gateway.','In an admin Command Prompt: `ipconfig /all` — confirm the VPN adapter has an IP. If not, the tunnel isn\'t fully up.','If WiFi underneath is unstable, VPN drops will follow. Try ethernet.','If consistently dropping: collect the VPN client log (Help → Diagnostic Report) and send to helpdesk.',], confidence: 0.83 },
  'CLOUD.SYNC': { title: 'OneDrive / SharePoint / Drive not syncing', steps: ['Right-click the cloud icon in the system tray → check for "Paused" or error indicators.','If paused: click → Resume sync. If error: click the error → follow the prompt.','For OneDrive specifically: Settings (cloud icon → gear → Settings) → Account tab → "Unlink this PC" → re-link with your account.','If a specific file is stuck: rename it (sometimes special characters like # or % block sync), or delete the local copy and let cloud re-download.','For files larger than 100 GB: OneDrive blocks them. Move to SharePoint document libraries instead.'], confidence: 0.85 },
  'SW.INSTALL.FAIL': { title: 'Software install failed', steps: ['Confirm the installer matches your OS architecture (x64 vs ARM64 vs x86). Win+R → "msinfo32" shows yours.','Right-click the installer → Run as administrator. UAC blocks many installers from regular accounts.','Check disk space: at least 10 GB free recommended for large installs.','Uninstall any previous version cleanly via Settings → Apps before reinstalling.','If you hit a specific MSI error code (e.g., 1603), search that exact code — most have known fixes documented.'], confidence: 0.82 },
  'SW.UPDATE.FAIL': { title: 'Windows / app update failed', steps: ['Settings → Windows Update → Update history. Find the failed update and note the KB number + error code.','Run the Windows Update Troubleshooter: Settings → Troubleshoot → Other → Windows Update → Run.','Disk Cleanup → "Clean up system files" → tick "Windows Update Cleanup". Clears stuck update files.','Manually: download the KB from the Microsoft Update Catalog (catalog.update.microsoft.com) and install the .msu.','If update loops: Settings → Update → Pause updates for 1 week → let the issue settle, then resume.'], confidence: 0.83 }
};
