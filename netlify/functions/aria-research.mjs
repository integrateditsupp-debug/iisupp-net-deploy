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
  return diagnosticFirst(query, cors);
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
  'SW.UPDATE.FAIL':      /\b((update|upgrade) (failed|error|stuck)|windows update.*(fail|error|stuck)|cannot update|update loop)\b/i,
  'TEAMS.AUDIO':           /\b(teams (audio|sound|mic|hear)|cant hear (anyone )?in teams|teams (no )?audio)\b/i,
  'TEAMS.VIDEO':           /\b(teams (video|camera|webcam)|teams (cant|cannot) (turn on|show) (video|camera))\b/i,
  'TEAMS.MEETING.JOIN':           /\b(teams (meeting|cant join)|cant join teams|teams (stuck|loop) (in )?(lobby|connecting))\b/i,
  'TEAMS.SCREEN.SHARE':           /\b(teams (screen|window) share|share (screen|desktop|window) in teams|cant share screen)\b/i,
  'TEAMS.CACHE.STUCK':           /\b(teams (stuck|hang|spinning|white screen|splash)|teams wont (load|open|sign in))\b/i,
  'ZOOM.AUDIO':           /\b(zoom (audio|sound|mic|hear)|cant hear (anyone|people) (in|on) zoom|zoom no audio)\b/i,
  'ZOOM.VIDEO':           /\b(zoom (video|camera|webcam)|zoom (cant|cannot) (turn on|show) (video|camera))\b/i,
  'ZOOM.JOIN':           /\b(zoom (meeting|cant join|wont let me join)|zoom invalid|zoom (stuck|connecting))\b/i,
  'ZOOM.SCREEN':           /\b(zoom (screen|window) share|share (screen|window) in zoom|zoom (cant share|share blocked))\b/i,
  'ZOOM.BACKGROUND':           /\b(zoom (virtual )?background|zoom (greenscreen|filter|blur))\b/i,
  'ZOOM.CHAT':           /\b(zoom chat (not (loading|working)|broken|missing))\b/i,
  'SLACK.WONT.LOAD':           /\b(slack (wont|cant|fail).{0,15}(load|open|connect|start)|slack (stuck|hang|spinning))\b/i,
  'SLACK.NOTIF':           /\b(slack (notif|push|alert).{0,20}(not|broken|missing|silent))\b/i,
  'SLACK.HUDDLE':           /\b(slack huddle (audio|mic|video|cant join))\b/i,
  'SLACK.FILE':           /\b(slack (file|upload|attach).{0,15}(fail|error|stuck|cant))\b/i,
  'CHROME.UPDATE':           /\b(chrome (wont|cant|fail).{0,15}update|chrome (version|out of date))\b/i,
  'CHROME.CRASH':           /\b(chrome (crash|freeze|hang|stop working)|chrome wont open)\b/i,
  'CHROME.RESET':           /\b(reset chrome|chrome (reset|restore) settings|chrome restore)\b/i,
  'CHROME.EXT':           /\b(chrome (extension|addon|plugin).{0,20}(break|broken|issue|problem|cant))\b/i,
  'CHROME.BOOKMARKS':           /\b(chrome bookmarks (gone|missing|disappeared|lost))\b/i,
  'EDGE.CRASH':           /\b(edge (crash|freeze|hang|stop working|wont open))\b/i,
  'EDGE.SYNC':           /\b(edge sync (not working|broken|fail)|edge sync (across|between))\b/i,
  'EDGE.IEMODE':           /\b(edge (ie mode|internet explorer mode)|legacy site (in edge|ie mode))\b/i,
  'FIREFOX.CRASH':           /\b(firefox (crash|freeze|hang|wont open))\b/i,
  'SAFARI.MAC':           /\b(safari (mac|on mac)|safari (wont load|page|website))\b/i,
  'BROWSER.HIJACK':           /\b(browser (hijack|hijacked|adware|popup|redirect|unwanted toolbar))\b/i,
  'BROWSER.CACHE':           /\b(clear (browser|chrome|edge|firefox|safari) (cache|cookies|data))\b/i,
  'ADOBE.READER':           /\b(adobe (reader|acrobat).{0,30}(wont open|crash|error|wont print))\b/i,
  'ADOBE.LICENSE':           /\b(adobe.{0,15}(license|activation|sign in|no license))\b/i,
  'OFFICE.QUICK.REPAIR':           /\b((word|excel|powerpoint|office).{0,30}(crash|wont open|broken|repair))\b/i,
  'OFFICE.LICENSE':           /\b(office (showing |saying )?(reduced functionality|unlicensed|expired|activation)|office license)\b/i,
  'OFFICE.SIGNIN.LOOP':           /\b(m365 (sign|signin|prompt)|keep getting (m365|microsoft 365|office) password prompt)\b/i,
  'ONENOTE.SYNC':           /\b(onenote (sync|notebook|section).{0,15}(not working|fail|stuck))\b/i,
  'POWERPOINT.FREEZE':           /\b(powerpoint (freeze|crash|hang|stop working|cant save))\b/i,
  'EXCEL.FORMULA':           /\b(excel (formula|calculation).{0,20}(not (working|calculating)|broken|wrong))\b/i,
  'WORD.CORRUPT':           /\b(word (doc|document).{0,15}(wont open|corrupt|broken|error))\b/i,
  'ONEDRIVE.SYNC':           /\b(onedrive (sync|paused|stuck|not syncing|icon red))\b/i,
  'SHAREPOINT.ACCESS':           /\b(sharepoint (access|permission|denied|cant)|cant (access|edit|open) sharepoint)\b/i,
  'OUTLOOK.SEARCH':           /\b(outlook search.{0,15}(not (working|finding)|broken|empty|results))\b/i,
  'OUTLOOK.AUTODISC':           /\b(outlook (autodiscover|server settings|cant find server|account setup loop))\b/i,
  'OUTLOOK.ATTACH':           /\b(outlook attach(ment)?.{0,15}(error|cant|wont|blocked))\b/i,
  'OUTLOOK.RULES':           /\b(outlook rules (not (firing|running|working|moving)|stopped|broken))\b/i,
  'OUTLOOK.CAL.SHARE':           /\b(outlook calendar (share|sharing|permission|cant see))\b/i,
  'OUTLOOK.SIGNATURE':           /\b(outlook signature (set|setup|edit|change|update))\b/i,
  'OUTLOOK.OOO':           /\b((set|enable|turn on) (out of office|auto[ -]?reply|vacation)|outlook out of office)\b/i,
  'OUTLOOK.NO.RECV':           /\b(outlook (not (receiving|getting)|missing|where are my) (new )?(email|emails|mail))\b/i,
  'NET.WIFI.NO.NET':           /\b((wifi|wi-?fi|wireless) (connected|works).{0,15}no internet|connected but no internet|no internet but wifi)\b/i,
  'NET.WIFI.DROPS':           /\b(wifi (keeps|frequently|always).{0,15}(disconnect|drop|cuts))\b/i,
  'NET.DNS.FLUSH':           /\b(flush dns|dns cache (stale|clear|flush)|cant (load|resolve) (website|site|domain))\b/i,
  'NET.SPEED':           /\b((internet|connection) (speed )?(slow|very slow)|slow internet|bandwidth)\b/i,
  'NET.ETHERNET':           /\b(ethernet (no link|not (working|connecting|detected))|wired connection (no|not))\b/i,
  'NET.BLUETOOTH':           /\b(bluetooth (not (pairing|working|connecting)|cant (pair|find)))\b/i,
  'VPN.WONT.CONNECT':           /\b(vpn (wont|cant|fail).{0,15}connect|cant connect to vpn|vpn (timeout|connection refused))\b/i,
  'VPN.DROPS':           /\b(vpn (keeps|frequently).{0,15}(disconnect|drop)|vpn (unstable|reconnects))\b/i,
  'VPN.SLOW':           /\b(vpn (very )?slow|vpn (connection|speed) slow)\b/i,
  'VPN.INSTALL':           /\b(install vpn|vpn (setup|installation|new) (client|laptop))\b/i,
  'PRT.DRIVER':           /\b(printer driver (install|missing|setup)|install printer|add (network )?printer)\b/i,
  'PRT.DEFAULT':           /\b(default printer (keeps changing|wrong|reverts|switches))\b/i,
  'PRT.QUALITY':           /\b(print(s|er)? (quality|blurry|streaks|faint|blank|ghosting|wrong colors))\b/i,
  'PRT.NETWORK':           /\b(network printer add|add printer (by )?ip|tcp\/ip printer|lpd lpr printer)\b/i,
  'PRT.PDF':           /\b(pdf (wont|cant) print|pdf print (issue|error|fail))\b/i,
  'AUT.AUTHENTICATOR.SETUP':           /\b(setup (microsoft )?authenticator|new phone (mfa|authenticator)|authenticator (app )?(new|setup))\b/i,
  'AUT.MFA.LOST':           /\b(lost.{0,15}(phone|device).{0,15}(mfa|authenticator|2fa)|mfa (reset|recovery|cant get))\b/i,
  'AUT.SSO.LOOP':           /\b(sso (loop|redirect|stuck|wont log in)|cant sign in via sso)\b/i,
  'AUT.PW.EXPIRED':           /\b(password (expired|expires)|change password (corporate|work))\b/i,
  'OS.CPU.HIGH':           /\b((cpu|processor) (at )?100%|high cpu usage|cpu pegged|cpu (very )?high)\b/i,
  'OS.MEM.HIGH':           /\b((memory|ram) (at )?100%|high (memory|ram)|ram (full|maxed)|out of memory)\b/i,
  'OS.WIN.UPDATE':           /\b(windows update (stuck|fail|error)|wuauserv|windows update.{0,15}0%)\b/i,
  'OS.ACTIVATE':           /\b(windows (not (activated|activate)|activation (error|fail))|activate windows)\b/i,
  'OS.CLOCK':           /\b((windows|pc) (clock|time) (wrong|incorrect|off|drift)|sync time|ntp)\b/i,
  'OS.SLEEP':           /\b((laptop|pc) wont wake|sleep mode (issue|problem|wont wake)|wont resume from sleep)\b/i,
  'OS.DARK.MODE':           /\b(dark mode (not (switching|working)|stuck|wont change)|switch to dark mode)\b/i,
  'OS.LANG.KB':           /\b(keyboard (typing|outputs) wrong (chars|characters|language)|language|locale (change|wrong))\b/i,
  'HW.MONITOR':           /\b((second |external )?monitor (no signal|not detected|black)|hdmi (no signal|not working)|displayport (no signal))\b/i,
  'HW.FLICKER':           /\b(monitor (flicker|flickering|screen flicker)|screen (flicker|going black briefly))\b/i,
  'HW.MOUSE':           /\b((mouse|wireless mouse) (not working|frozen|jumpy|laggy))\b/i,
  'HW.KB':           /\b(keyboard (not (responding|working|typing))|keys not (working|registering))\b/i,
  'HW.AUDIO':           /\b(no sound (on (my )?pc|on computer|on laptop)|audio not working|speakers not working)\b/i,
  'HW.HEADSET':           /\b((usb )?headset (not detected|not working)|headphones not detected)\b/i,
  'HW.WEBCAM':           /\b(webcam (not detected|not working)|camera (not detected|missing))\b/i,
  'HW.USB':           /\b(usb (device )?not recognized|unknown usb device|usb (error|not working))\b/i,
  'HW.BATTERY':           /\b((laptop|notebook) battery (not charging|wont charge|drain))\b/i,
  'HW.OVERHEAT':           /\b((laptop|pc) (hot|overheating|running hot)|cpu temp high)\b/i,
  'HW.HDMI':           /\b(hdmi (not (working|displaying)|no signal)|hdmi cable)\b/i,
  'SW.INSTALL.ADMIN':           /\b((cant|need admin) install|install (requires|needs) admin|admin (required|rights) install)\b/i,
  'SW.AV.BLOCK':           /\b(antivirus block(ing|ed)|defender block(ing|ed)|smartscreen block(ing|ed))\b/i,
  'SW.DEF.OFF':           /\b(defender (real ?time|realtime).{0,20}(off|disabled|protection))\b/i,
  'SW.APP.CRASH':           /\b((my )?app (keeps |always )?crash(ing|es)|application (keeps crashing|hang|stop responding))\b/i,
  'SW.SMARTSCREEN':           /\b(smartscreen (block|prevent) (install|app))\b/i,
  'MOB.EMAIL.SETUP':           /\b(setup (work )?email on (iphone|android|mobile)|email (mobile|phone) setup)\b/i,
  'MOB.MFA.SETUP':           /\b((setup|add) (work )?mfa on (phone|android|iphone))\b/i,
  'MOB.VPN':           /\b(install vpn on (iphone|android|phone|mobile)|mobile vpn (client|setup))\b/i,
  'MOB.INTUNE':           /\b(enroll (phone|mobile) (in )?intune|intune mobile)\b/i,
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
// === ARIA First-Principles Reasoner v1 (Ahmad 2026-05-16) ===
// Hard-coded CS fundamentals + 5W framework. Fires when KB + vendor-fetch miss.
const PRIMITIVES = {
  layers: {
    APP:     /\b(outlook|word|excel|powerpoint|teams|zoom|slack|chrome|edge|firefox|safari|adobe|onedrive|sharepoint|app|application|software|program)\b/i,
    OS:      /\b(windows|mac|macos|linux|os|operating system|boot|startup|shutdown|crash|blue screen|bsod|update|driver|registry)\b/i,
    NETWORK: /\b(network|internet|wifi|wi-?fi|ethernet|vpn|dns|dhcp|ip|tcp|udp|port|firewall|router|gateway|subnet|connection)\b/i,
    AUTH:    /\b(password|login|sign[ -]?in|sso|mfa|2fa|authenticator|account|session|token|expired|locked|permission|access denied)\b/i,
    HW:      /\b(monitor|screen|display|keyboard|mouse|webcam|camera|usb|hdmi|battery|laptop|pc|computer|hardware|device|cable)\b/i,
    SAAS:    /\b(m365|microsoft 365|office 365|google|workspace|saas|cloud|tenant|license|subscription|seat|admin|console)\b/i
  },
  lifecycle: ['installed','configured','launched','authenticated','used','updated','failed','repaired','uninstalled'],
  generic_fns: ['start/stop','restart','logs','config','cache','auth-token','network-io','file-io','permissions'],
  hypotheses: {
    APP: ['Restart the application (fully quit and reopen).','Sign out and back in to refresh auth tokens.','Clear the app cache (Teams/Slack/Chrome each have a cache folder under %APPDATA% or %LOCALAPPDATA%).','Repair or reinstall (Settings > Apps > app > Modify > Quick Repair if available).','Try the web version of the app to isolate desktop-client issues.'],
    OS: ['Reboot first - clears stuck processes, locks, and services.','Settings > Windows Update > install pending updates.','Event Viewer (eventvwr.msc) > Windows Logs > Application + System > find Error events around when it broke.','Device Manager > look for yellow warning icons > update those drivers.','Elevated cmd: sfc /scannow and DISM /Online /Cleanup-Image /RestoreHealth (repairs system files).'],
    NETWORK: ['ipconfig /flushdns then /release then /renew (resets DNS and DHCP lease).','Try a different network (phone hotspot). If it works there, your current network is the problem.','Ping the gateway > ping 1.1.1.1 > ping google.com. The first step that fails tells you the layer (gateway / ISP / DNS).','Disable VPN or firewall temporarily to rule out.','speedtest.net to confirm bandwidth is actually what you pay for.'],
    AUTH: ['Sign out everywhere then back in (portal.office.com > top-right > Sign out everywhere).','Verify your MFA method works - open Authenticator, confirm you can read the code.','Check password expiry: account.activedirectory.windowsazure.com/changepassword.aspx','Clear cached credentials: Control Panel > Credential Manager > remove entries for the affected service.','Try incognito/private browser to bypass cached cookies and sessions.'],
    HW: ['Swap the cable. Cables fail more often than people think.','Try a different port on the PC.','Test the device on another machine to isolate hardware vs PC issue.','Device Manager > find the device > Update Driver or Uninstall + reboot.','Check power/battery health (Task Manager > Performance, or powercfg /batteryreport for laptops).'],
    SAAS: ['Check the service status page (admin.microsoft.com > Health > Service Health, or status.zoom.us, status.slack.com).','Confirm your license is assigned (portal.office.com > Subscriptions; admins use Admin Center).','Sign out + back in via incognito to refresh tenant context.','Conditional Access: a recent CA policy may be blocking sign-in. Admin can check Entra sign-in logs.','Verify you are signed in with the right account (work M365 vs personal MSA).']
  }
};
function applyFiveW(q) {
  const lower = (q || '').toLowerCase();
  const whoMulti = /\b(everyone|everybody|all users|whole team|company[- ]wide)\b/i.test(lower);
  const trigger = (/\bafter (?:update|reboot|install|password change|migration|wifi|signin)\w*/i.exec(lower) || [])[0] || (/\b(suddenly|today|just now|always|randomly|since (?:yesterday|last week|today))\b/i.exec(lower) || [])[0] || 'unknown trigger (ask: when did this start?)';
  let layer = 'APP', score = 0;
  for (const [name, rx] of Object.entries(PRIMITIVES.layers)) {
    const m = lower.match(new RegExp(rx.source, 'gi'));
    if (m && m.length > score) { score = m.length; layer = name; }
  }
  return {
    who: whoMulti ? 'multiple users (scope: company / service-side)' : 'single user (scope: local device)',
    what: (q || '').slice(0, 120),
    where: layer,
    when: trigger,
    why: 'Hypotheses generated from CS primitives at the ' + layer + ' layer.'
  };
}
function firstPrinciplesReason(q, cors) {
  const fw = applyFiveW(q || '');
  const hyps = PRIMITIVES.hypotheses[fw.where] || PRIMITIVES.hypotheses.OS;
  const clarify = {
    APP: 'Did this start after the app was updated, after you signed in fresh, or out of nowhere?',
    OS: 'Did anything change recently - Windows Update, new install, driver update?',
    NETWORK: 'Are you on Wi-Fi, Ethernet, or VPN? Does it work from a phone hotspot?',
    AUTH: 'Did your password expire, did you switch phones for MFA, or change devices recently?',
    HW: 'Does the issue follow the device when you move it to another PC, or stay on this PC?',
    SAAS: 'Does it affect just you, or everyone in your org? Did a recent admin change happen?'
  }[fw.where];
  const steps = [
    'Scope: ' + fw.who + '. ' + (fw.who.indexOf('multiple') >= 0 ? 'If broad, likely service-side or company network - check status pages first.' : 'Isolate by trying the same action on a second device or account.'),
    'Trigger: ' + fw.when + '. The #1 clue in any IT issue is what changed right before it broke.',
    ...hyps.slice(0, 4),
    'CLARIFYING QUESTION: ' + clarify + ' Reply with that detail and ARIA will narrow it further.',
    'If none of these resolve it, this is L2 - call (647) 581-3182 or email integrateditsupp@iisupp.net.'
  ];
  return jsonResp(200, cors, {
    ok: true,
    state: 'REASONED_' + fw.where,
    title: 'No exact KB match - reasoning from first principles (' + fw.where.toLowerCase() + ' layer)',
    steps: steps,
    confidence: 0.55,
    source: 'first-principles-reasoner-v1',
    caveat: "Structured guess using ARIA's CS-fundamentals blueprint, not a vetted recipe. Try each step in order.",
    fiveW: fw
  });
}

// === ARIA Diagnostic-First v2 (Ahmad 2026-05-16) ===
// Frameworks ARIA is certified in. Reasoner references these as guardrails.
const FRAMEWORKS = {
  FIVE_W_PLUS_H: {
    use: "Start every diagnostic with these. Ask for any W that is missing before troubleshooting.",
    questions: [
      "WHAT app/system is affected?",
      "WHO is affected (just you or everyone)?",
      "WHERE in the stack (app, OS, network, auth, hardware, SaaS)?",
      "WHEN did it start (and what changed right before)?",
      "WHY do you suspect a cause (recent install, update, password reset)?",
      "HOW often (always, intermittent, once)?"
    ]
  },
  OSI_7_LAYER: {
    use: "Isolate where in the network stack an issue lives. Test bottom-up.",
    layers: [
      "L1 Physical: cable, NIC port, link light",
      "L2 Data-link: MAC, VLAN, switch port",
      "L3 Network: IP, gateway, ARP, NAT, routing",
      "L4 Transport: TCP/UDP ports, firewall rules",
      "L5-7 Session/Presentation/App: TLS, DNS, HTTP, app protocol"
    ]
  },
  ITIL_REQUEST_TYPE: {
    use: "Classify the ask BEFORE troubleshooting. Each type has a different workflow.",
    types: [
      "INCIDENT: unplanned interruption - restore service ASAP",
      "SERVICE REQUEST: standard ask (new account, password reset, new device)",
      "PROBLEM: root cause behind repeated incidents",
      "CHANGE: planned modification with approval"
    ]
  },
  SOFTWARE_LIFECYCLE: {
    use: "Identify which stage of the app lifecycle failed. Most fixes target the failed stage.",
    stages: ["Install/setup", "Configuration", "Authentication/sign-in", "In-use operation", "Update", "Failure", "Repair/reset", "Uninstall"]
  },
  RCA_5_WHYS: {
    use: "Drill from symptom to root cause by asking why iteratively.",
    template: ["Why does X happen?", "Why does that cause happen?", "Why does THAT cause happen?", "...up to 5 times.", "Stop when answer is a process, policy, or system root cause."]
  },
  FAULT_DOMAIN: {
    use: "Choose the first place to look. Same as PRIMITIVES.layers.",
    domains: ["APP - one app misbehaving", "OS - everything weird", "NETWORK - anything that touches network", "AUTH - sign-in or permission", "HW - device-specific", "SAAS - cloud service"]
  },
  GARRY_TAN_SHIP: {
    use: "Filter every change before shipping to production.",
    questions: ["What creates the most user trust?", "What makes the product clearer in 5 seconds?", "What reduces friction to payment or signup?", "What improves the demo/trial experience?", "What can ship safely today without breaking the site?"]
  },
  BIT_NATIVE_KB: {
    use: "Every KB chunk stands alone. ARIA retrieves one bit and answers. No cross-chunk dependencies.",
    rule: "Each chunk = title + 3-7 lines + own escalation trigger. No cross-chunk references."
  }
};
function detectGaps(query) {
  const q = (query || "").toLowerCase().trim();
  const hasApp = Object.values(PRIMITIVES.layers).some(rx => rx.test(q));
  const hasWhen = /\b(after|since|today|yesterday|last (?:week|month|day)|just now|always|suddenly|started|began|recently)\b/i.test(q);
  const hasWho = /\b(everyone|all (?:users|of us)|whole (?:team|office)|just me|my)\b/i.test(q);
  const hasSymptom = /\b(error|broken|wont|cant|fail|crash|slow|stuck|frozen|hang|down|gone|missing|not working)\b/i.test(q);
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  return {
    hasApp, hasWhen, hasWho, hasSymptom, wordCount,
    missing: [
      !hasApp && { w: "WHAT", q: "Which app or system is this about? (Outlook, Chrome, Wi-Fi, login, printer, etc.)" },
      !hasWhen && { w: "WHEN", q: "When did this start? Did anything change right before - a Windows update, a new install, a password change, a new device?" },
      !hasWho && { w: "WHO", q: "Is this just you, or is everyone in your office hitting the same thing?" },
      !hasSymptom && { w: "WHAT-SYMPTOM", q: "What exactly is the symptom? (Error message, frozen screen, slow response, no connection...)" }
    ].filter(Boolean),
    layerHint: (() => { for (const [name, rx] of Object.entries(PRIMITIVES.layers)) if (rx.test(q)) return name; return "UNKNOWN"; })()
  };
}
function diagnosticFirst(query, cors) {
  const gaps = detectGaps(query);
  const tooVague = gaps.wordCount < 8 && gaps.missing.length >= 2;
  const noApp = !gaps.hasApp && !gaps.hasSymptom;
  if (tooVague || noApp) {
    const ask = gaps.missing[0];
    const askWhich = ask ? ask.w : "WHAT";
    const askQuestion = ask ? ask.q : "Which app or system is this about?";
    return jsonResp(200, cors, {
      ok: true,
      state: "DIAGNOSING_" + askWhich,
      title: "Diagnostic question first (5W framework)",
      steps: [
        "Before troubleshooting, ARIA needs one detail to point you at the right fix.",
        askQuestion,
        "Examples: 'Outlook wont open after the latest update' or 'Wi-Fi connected but no internet, started this morning' or 'the team server is down for everyone'.",
        "Tip: the more specific (app name, exact error, what you were doing), the faster ARIA can fix it."
      ],
      confidence: 1.0,
      source: "diagnostic-interview-v1",
      framework: "5W_PLUS_H",
      askNext: askQuestion,
      gaps: gaps.missing.map(m => m.w),
      layerHint: gaps.layerHint
    });
  }
  return firstPrinciplesReason(query, cors);
}

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
  'SW.UPDATE.FAIL': { title: 'Windows / app update failed', steps: ['Settings → Windows Update → Update history. Find the failed update and note the KB number + error code.','Run the Windows Update Troubleshooter: Settings → Troubleshoot → Other → Windows Update → Run.','Disk Cleanup → "Clean up system files" → tick "Windows Update Cleanup". Clears stuck update files.','Manually: download the KB from the Microsoft Update Catalog (catalog.update.microsoft.com) and install the .msu.','If update loops: Settings → Update → Pause updates for 1 week → let the issue settle, then resume.'], confidence: 0.83 },
  'TEAMS.AUDIO': { title: 'Teams audio not working', steps: ['Teams → Settings (top-right) → Devices → confirm Speaker + Microphone show the correct hardware (not \'default\').', 'Make a test call: Settings → Devices → Make a test call. You\'ll hear playback + record.', 'Windows: right-click speaker icon → Sound settings → confirm correct Output and Input device.', 'Privacy: Settings → Privacy & security → Microphone → confirm \'Allow desktop apps\' is ON and Teams listed.', 'If still failing: Sign out of Teams → right-click tray icon → Quit → relaunch.', 'Last resort: Clear Teams cache (close Teams, delete %APPDATA%\\Microsoft\\Teams folder, relaunch) — chats are in cloud, not lost.'] },
  'TEAMS.VIDEO': { title: 'Teams video / camera not working', steps: ['Teams → Settings → Devices → Camera dropdown → select correct camera. Preview shows live feed.', 'Windows: Settings → Privacy & security → Camera → ensure ON for desktop apps + Teams listed.', 'If another app (Zoom/OBS) has the camera locked, close it. Only one app can use camera at a time.', 'Device Manager → Imaging devices / Cameras → if camera shows yellow bang, right-click → Update driver.', 'Restart Teams. If still no video, try teams.microsoft.com web client to isolate desktop-app issue.'] },
  'TEAMS.MEETING.JOIN': { title: 'Can\'t join Teams meeting', steps: ['Confirm the meeting link is current (forwarded chains sometimes have expired IDs).', 'Try teams.microsoft.com/meet (web) — bypasses desktop client bugs.', 'If \'lobby\' stuck: organizer must admit you. Message them.', 'If \'access denied\': org policy blocks external attendees — ask host to enable external access for this meeting.', 'Network: Teams needs UDP 3478-3481 outbound + media subnets. Corporate firewall may block — check with IT.', 'Clear Teams cache (close Teams + delete %APPDATA%\\Microsoft\\Teams) → relaunch.'] },
  'TEAMS.SCREEN.SHARE': { title: 'Teams screen share not working', steps: ['Settings → Privacy & security → Screen recording → ensure Teams allowed (macOS especially).', 'In meeting: click Share → if grayed out, your role may be Attendee — host must make you Presenter.', 'On Windows: Display drivers — open Device Manager → Display adapters → update driver. Outdated drivers break GPU-accelerated share.', 'If sharing only specific window: try \'Share screen\' (whole desktop) instead — works around app-specific quirks.', 'Last resort: Use teams.microsoft.com web client → share works through browser instead.'] },
  'TEAMS.CACHE.STUCK': { title: 'Teams stuck on splash / cache reset', steps: ['Right-click Teams tray icon → Quit (must fully exit, not just close window).', 'Press Win+R → paste: %APPDATA%\\Microsoft\\Teams → Enter.', 'Delete the Cache, blob_storage, Code Cache, databases, GPUCache, IndexedDB, Local Storage, tmp folders.', 'For new Teams (Teams 2.1): %LOCALAPPDATA%\\Packages\\MSTeams_8wekyb3d8bbwe\\LocalCache → delete contents.', 'Relaunch Teams. First launch is slower (5-10 min) as it re-downloads cache. No chats lost — they\'re cloud-backed.', 'If still stuck: sign out from teams.microsoft.com → sign back in → reauthorize desktop app.'] },
  'ZOOM.AUDIO': { title: 'Zoom audio not working', steps: ['Zoom → Settings → Audio → Speaker / Microphone dropdowns → select correct device + click \'Test\'.', 'In meeting: bottom-left → click ^ next to mute → \'Switch to Phone Audio\' or pick different device.', 'Windows: right-click speaker icon → Open Sound settings → confirm Output + Input devices match what Zoom is using.', 'Privacy & security: Settings → Privacy → Microphone → \'Allow desktop apps\' ON, Zoom enabled.', 'If still no audio: leave + rejoin meeting OR call in via phone (dial-in number is in the invite).'] },
  'ZOOM.VIDEO': { title: 'Zoom video / camera not working', steps: ['Zoom → Settings → Video → \'Camera\' dropdown → select correct camera.', 'Confirm no other app (Teams/Skype/OBS) is using camera. Close all other apps using it.', 'Privacy: Windows Settings → Privacy → Camera → \'Allow desktop apps\' ON, Zoom listed.', 'Update Zoom: Zoom → Profile (avatar) → Check for Updates.', 'Device Manager → Imaging devices → camera → Update driver. Try external webcam if internal fails.'] },
  'ZOOM.JOIN': { title: 'Can\'t join Zoom meeting', steps: ['Verify Meeting ID + passcode are correct (case sensitive). Many invites have both.', 'Try joining via zoom.us/join → enter Meeting ID manually instead of clicking link.', 'If \'waiting for host\': host hasn\'t started — wait or message them.', 'If \'this meeting is for authorized attendees only\': sign in to Zoom with the email that was invited.', 'Update Zoom client (out-of-date versions often blocked by host security settings).', 'Network: Zoom needs UDP 8801-8810 outbound. Corporate firewall — check with IT.', 'Fallback: dial-in audio number from invite.'] },
  'ZOOM.SCREEN': { title: 'Zoom screen share not working', steps: ['Settings → Screen Share → ensure \'Share computer sound\' option visible. If missing, update Zoom.', 'macOS: System Settings → Privacy & Security → Screen Recording → toggle ON for Zoom.', 'As attendee: host may have restricted who can share — host clicks \'Security\' → \'Allow participants to share\'.', 'Multi-monitor: when sharing, select correct monitor. \'Share Desktop\' shows the active monitor only.', 'If sharing single window: the window must be open + not minimized. Try \'Entire Screen\' if specific window fails.'] },
  'ZOOM.BACKGROUND': { title: 'Zoom virtual background not working', steps: ['Settings → Background & Effects → confirm GPU meets requirements (Zoom\'s check is here).', 'If \'requires green screen\': enable that option only if you have a real green screen behind you.', 'CPU/GPU: virtual background is GPU-intensive. Close other apps. Update graphics driver.', 'Try a different background image (smaller, lower-res). Some images cause render failures.', 'Last resort: use \'Blur background\' instead of an image — uses less GPU.'] },
  'ZOOM.CHAT': { title: 'Zoom chat not loading', steps: ['In meeting: bottom toolbar → click \'Chat\'. If panel doesn\'t open, click View → Chat.', 'If chat is disabled by host: host must enable chat in Security → \'Chat\'.', 'Update Zoom client. Old versions had chat-rendering bugs fixed in newer builds.', 'Sign out + back in to Zoom (Profile → Sign Out). Forces resync.'] },
  'SLACK.WONT.LOAD': { title: 'Slack won\'t load / cant connect', steps: ['Force-quit Slack from system tray. Relaunch.', 'slack.com/help/clear-cache: Slack desktop → Help → Troubleshooting → Clear Cache & Restart.', 'Try slack.com in browser (web client) — if web works, desktop install is the issue.', 'If web also fails: check status.slack.com for outage.', 'Reinstall Slack: uninstall + delete %APPDATA%\\Slack → reinstall from slack.com/downloads.', 'Corporate firewall: Slack needs ports 443 + specific subnets. Check with IT if behind strict proxy.'] },
  'SLACK.NOTIF': { title: 'Slack notifications not showing', steps: ['Slack → Preferences → Notifications → ensure \'All new messages\' or \'Direct messages, mentions\' selected.', 'Set Do Not Disturb schedule: Preferences → Notifications → Disturb → confirm not active.', 'Windows: Settings → Notifications → Slack → enable Banners + Sounds.', 'Per-channel: right-click channel → Notification preferences → ensure not muted.', 'Sign out + back in to Slack. Forces notification subscription refresh.', 'Browser tab: web Slack uses browser push — confirm browser notifications allowed for slack.com.'] },
  'SLACK.HUDDLE': { title: 'Slack huddle audio not working', steps: ['Same as Zoom audio: Settings → Audio & Video → confirm correct microphone + speaker.', 'Privacy: Settings → Privacy → Microphone → allow Slack.', 'Reconnect: leave huddle → rejoin.', 'If join button greyed: huddle host may have made it audio-only / restricted. Ask host.'] },
  'SLACK.FILE': { title: 'Slack file upload failing', steps: ['File size: Slack free has 1 GB org-wide cap; per-file limit 1 GB.', 'Try a smaller file or different file type to isolate.', 'Network: huge files fail on slow connections. Test on faster wifi.', 'Try web client (slack.com) instead of desktop. Sometimes desktop file picker has driver issues.', 'If only certain files fail: corporate DLP may block — contact IT.'] },
  'CHROME.UPDATE': { title: 'Chrome won\'t update', steps: ['Open Chrome → Settings → About Chrome → Chrome checks for updates automatically.', 'If \'Update failed\': close Chrome completely → relaunch as Administrator → retry.', 'Cause: corporate GPO may block Chrome auto-update. Check with IT.', 'Manual: download latest from google.com/chrome → run installer (preserves bookmarks).', 'Last resort: uninstall Chrome (Control Panel → Programs) → reinstall. Bookmarks/passwords sync if signed in.'] },
  'CHROME.CRASH': { title: 'Chrome keeps crashing', steps: ['Update Chrome: Settings → About Chrome → install pending updates.', 'Disable extensions to isolate: Settings → Extensions → toggle all OFF → restart Chrome → test.', 'Reset Chrome: Settings → Reset settings → \'Restore settings to original defaults\'.', 'Create new profile: chrome://settings/manageProfile → Add → test in new profile. Old profile may be corrupt.', 'Hardware acceleration: Settings → System → toggle \'Use hardware acceleration when available\' OFF if GPU issues.', 'Reinstall Chrome (uninstall → reinstall from google.com/chrome). Sign in to restore bookmarks.'] },
  'CHROME.RESET': { title: 'Reset Chrome settings', steps: ['Settings → Reset settings → \'Restore settings to their original defaults\' → confirm.', 'This: resets homepage + search engine + tabs, disables extensions, clears temp data. Bookmarks + passwords + history kept.', 'Alternatively, completely fresh start: Settings → You and Google → Sync and Google services → Turn off sync → close Chrome → delete %LOCALAPPDATA%\\Google\\Chrome\\User Data → relaunch.'] },
  'CHROME.EXT': { title: 'Chrome extension breaking a site', steps: ['Test in Incognito mode (Ctrl+Shift+N) — extensions disabled by default. If site works → extension is the cause.', 'Settings → Extensions → toggle OFF one at a time, refresh site each time, find the culprit.', 'Common culprits: adblockers, password managers, antivirus browser plugins, dark-mode forcers.', 'Once found: keep extension off for the affected site (some extensions let you exclude sites in their settings), OR remove the extension.'] },
  'CHROME.BOOKMARKS': { title: 'Chrome bookmarks disappeared', steps: ['Check sync: Settings → You and Google → Sync → \'Bookmarks\' must be enabled.', 'Sign in if not: chrome://settings/people → Sign in.', 'Restore from backup: Press Win+R → %LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default → find \'Bookmarks.bak\' → rename to \'Bookmarks\' (overwrite current) → restart Chrome.', 'From another device: if you have Chrome signed in elsewhere, bookmarks should reappear after sync.', 'Last resort: check chrome.google.com/bookmarks for sync state.'] },
  'EDGE.CRASH': { title: 'Edge keeps crashing', steps: ['Update Edge: Settings → About Microsoft Edge.', 'Disable extensions: Settings → Extensions → toggle all off.', 'Reset Edge: Settings → Reset settings → \'Restore settings to default values\'.', 'Repair via Apps & Features: Settings → Apps → Microsoft Edge → Modify → Repair.', 'Last: uninstall + reinstall via Windows Settings → Apps.'] },
  'EDGE.SYNC': { title: 'Edge sync not working', steps: ['Settings → Profiles → Sync → confirm signed in + sync toggle ON.', 'Specific items: turn each toggle ON (favorites, passwords, history, tabs, etc.).', 'Sign out + back in to your Microsoft account at Profile → Manage account.', 'If org account: corporate policy may restrict sync — check with IT (Microsoft 365 admin can enable/disable Edge sync).', 'Reset sync: Settings → Profiles → Sync → Reset sync. Forces clean upload from current device.'] },
  'EDGE.IEMODE': { title: 'Edge IE Mode for legacy sites', steps: ['Settings → Default browser → \'Allow sites to be reloaded in Internet Explorer mode\' → ON.', 'Restart Edge.', 'For specific site: open site → click three-dots menu → \'Reload in Internet Explorer mode\'.', 'For org-wide deployment: admin pushes Site List via GPO (Microsoft Edge → Internet Explorer integration policies).', 'If \'Site can\'t be reached\': site may use ActiveX or old plugins. IE Mode supports these — confirm site loaded with IE icon in address bar.'] },
  'FIREFOX.CRASH': { title: 'Firefox crashing', steps: ['Help → Restart with Add-ons Disabled (safe mode).', 'If safe mode works → an extension causes it. Settings → Add-ons → disable each, restart, find culprit.', 'Refresh Firefox: Help → More troubleshooting information → Refresh Firefox. Keeps bookmarks/passwords, resets extensions + settings.', 'Profile corruption: about:profiles → Create new profile → switch.', 'Last: uninstall + reinstall from mozilla.org.'] },
  'SAFARI.MAC': { title: 'Safari on Mac — site won\'t load', steps: ['Develop menu (if visible) → Empty Caches.', 'Safari → Preferences → Privacy → Manage Website Data → Remove the affected site.', 'Try Private Window (Cmd+Shift+N) — bypasses cookies + cache. If site loads → cleanup needed.', 'Privacy → uncheck \'Prevent cross-site tracking\' temporarily if site needs it.', 'Last: System Settings → General → Software Update — outdated Safari version sometimes can\'t render newer sites.'] },
  'BROWSER.HIJACK': { title: 'Browser hijacked / unwanted toolbar', steps: ['Settings → Extensions → remove anything you don\'t recognize.', 'Reset browser to defaults (see Chrome reset steps).', 'Run Windows Defender full scan: Windows Security → Virus & threat protection → Scan options → Full scan.', 'Run Malwarebytes free scan: malwarebytes.com — catches PUPs Defender often misses.', 'Check Add/Remove Programs for recently-installed apps you didn\'t intend — uninstall.', 'If browser homepage / search engine forced: reset (and remove any policy-enforced settings, may need IT).'] },
  'BROWSER.CACHE': { title: 'Clear browser cache / cookies', steps: ['Chrome: Settings → Privacy and Security → Clear browsing data → All time → Cached images and files + Cookies → Clear.', 'Edge: Settings → Privacy → Clear browsing data → similar.', 'Firefox: Settings → Privacy & Security → Cookies and Site Data → Clear Data.', 'Safari: Develop menu → Empty Caches. Preferences → Privacy → Manage Website Data → Remove All.', 'Hard refresh single page: Ctrl+F5 (Windows) / Cmd+Shift+R (Mac).'] },
  'ADOBE.READER': { title: 'Adobe Reader / Acrobat issue', steps: ['Repair: Control Panel → Programs → Adobe Acrobat → Modify → Repair installation.', 'Update Adobe: Help → Check for Updates.', 'Reset Acrobat: Edit → Preferences → confirm settings, or use Reset tool from Adobe support.', 'If PDFs open in browser instead: Control Panel → Default Programs → set Adobe as default for .pdf.', 'Last: uninstall + reinstall from get.adobe.com/reader.'] },
  'ADOBE.LICENSE': { title: 'Adobe license / activation issue', steps: ['Sign out of all Adobe apps: any Adobe app → Help → Sign Out.', 'Sign back in with the licensed email (the email assigned the seat in Admin Console).', 'If \'No subscription found\': contact your Adobe admin — license may have been reassigned.', 'Reset Adobe ID: account.adobe.com → Sign in → confirm subscription active.', 'For enterprise: admin must reissue license at adminconsole.adobe.com.'] },
  'OFFICE.QUICK.REPAIR': { title: 'Office Quick Repair (Word/Excel/PowerPoint)', steps: ['Close all Office apps.', 'Settings → Apps → Apps & features → Microsoft 365 (or Office) → Modify → Quick Repair → Repair.', 'Wait 2-5 min. Repair finishes, prompts to relaunch Office.', 'If still crashing: same path → choose \'Online Repair\' (takes 15-30 min, full reinstall).', 'As a last resort: uninstall Office → reinstall from portal.office.com → \'Install Office\'.'] },
  'OFFICE.LICENSE': { title: 'Office license / activation error', steps: ['Open Word → File → Account → confirm signed in with the licensed email.', 'If signed in but still \'unlicensed\': Sign out → close all Office apps → sign back in.', 'Check portal.office.com → confirm subscription is active.', 'For Office 2019/2021 (perpetual): re-enter product key — File → Account → Change License.', 'If using KMS / volume license: contact IT — KMS host server may be unreachable.'] },
  'OFFICE.SIGNIN.LOOP': { title: 'M365 repeated password prompts', steps: ['Sign out everywhere: portal.office.com → top-right account → \'Sign out everywhere\'.', 'Clear Office cached credentials: Control Panel → User Accounts → Credential Manager → Windows Credentials → remove MicrosoftOffice* entries.', 'Modern auth: confirm registry key HKCU\\SOFTWARE\\Microsoft\\Office\\16.0\\Common\\Identity → \'EnableADAL\' = 1.', 'Conditional Access policy may be requiring step-up — check Entra sign-in logs.', 'Last: restart Office apps, sign in fresh.'] },
  'ONENOTE.SYNC': { title: 'OneNote sync issue', steps: ['File → Info → confirm Notebook Sync Status → \'Sync All\' button.', 'If error on specific section: right-click section tab → Sync Status → review error.', 'Misplaced sections folder: File → Info → \'View Sync Status\' → Sections Without a Home → resolve.', 'Sign out + back in to OneNote (File → Account).', 'For OneDrive-stored notebooks: confirm OneDrive itself is syncing first.'] },
  'POWERPOINT.FREEZE': { title: 'PowerPoint freezing / crashing', steps: ['Office Quick Repair (see OFFICE.QUICK.REPAIR steps).', 'Disable add-ins: File → Options → Add-ins → Manage → COM Add-ins → uncheck all → restart PowerPoint.', 'Large file >100MB: optimize images via File → Info → Compress Pictures.', 'Disable hardware graphics acceleration: File → Options → Advanced → Display → check \'Disable hardware graphics acceleration\'.', 'Try opening file in PowerPoint Online (office.com) to confirm file isn\'t corrupted.'] },
  'EXCEL.FORMULA': { title: 'Excel formula not calculating', steps: ['Formulas → Calculation Options → set to \'Automatic\'. Manual mode causes formulas to display result of last manual recalc only.', 'If cell shows formula text instead of result: cell is formatted as Text. Right-click cell → Format Cells → Number → re-enter formula.', 'Iterative calculation: File → Options → Formulas → \'Enable iterative calculation\' if you have circular references intentionally.', 'Press F9 to force recalc of the active sheet (Shift+F9 = recalc whole workbook).', '#REF! / #VALUE! / #NAME? errors: check formula references — broken link or typo.'] },
  'WORD.CORRUPT': { title: 'Word document corruption', steps: ['Open and Repair: Word → File → Open → select the file → click arrow on Open button → \'Open and Repair\'.', 'Open from a different location: copy file to Desktop first; some network/OneDrive paths cause open errors.', 'Try opening in WordPad or LibreOffice — sometimes recovers text even if Word fails.', 'From .docx structure: rename file extension .docx → .zip → extract → look in word/document.xml for content.', 'Last: restore from OneDrive/SharePoint version history. Right-click file → Version history → restore earlier version.'] },
  'ONEDRIVE.SYNC': { title: 'OneDrive sync paused / stuck', steps: ['Right-click OneDrive cloud icon → Pause syncing → Resume syncing.', 'Exit OneDrive completely (right-click tray icon → Quit OneDrive).', 'Press Win+R → %localappdata%\\Microsoft\\OneDrive\\onedrive.exe /reset → Enter. Wait 2 min for reset.', 'If onedrive.exe not found, try: %programfiles%\\Microsoft OneDrive\\onedrive.exe /reset', 'Sign back in. Files re-sync from cloud (existing local files matched, not re-downloaded).', 'Free disk space: OneDrive needs ~10% free. Check C: drive space.'] },
  'SHAREPOINT.ACCESS': { title: 'SharePoint access denied', steps: ['Open the SharePoint site in browser (sharepoint.com). Sign in with work account.', 'If \'access denied\': site owner must grant you permissions. Click \'Request access\' button.', 'If you previously had access but lost it: your AAD group membership may have changed. Contact IT.', 'For specific document: right-click in OneDrive sync folder → Share → confirm who has access.', 'Clear credentials: Control Panel → Credential Manager → Windows Credentials → remove MicrosoftOffice* entries.'] },
  'OUTLOOK.SEARCH': { title: 'Outlook search broken', steps: ['File → Options → Search → \'Indexing options\' → confirm Outlook is in \'Indexed locations\'.', '\'Modify\' → tick \'Microsoft Outlook\' → OK. Wait for index to rebuild (can take hours for large mailbox).', 'Rebuild index: Control Panel → Indexing Options → Advanced → Rebuild.', 'If still broken: close Outlook → delete the search index file at %LOCALAPPDATA%\\Microsoft\\Outlook → restart Outlook → reindex.', 'Online only: search the Web (Outlook on the Web) at outlook.office.com — uses server-side index, always works.'] },
  'OUTLOOK.AUTODISC': { title: 'Outlook autodiscover failed', steps: ['Test connectivity: testconnectivity.microsoft.com → \'Outlook Autodiscover\' → enter your email → run test.', 'If hybrid: confirm autodiscover.yourdomain.com DNS record points to on-prem Exchange.', 'Outlook profile: Control Panel → Mail → Show Profiles → New → setup fresh.', 'Cached credentials: Credential Manager → remove all Outlook/Office entries.', 'For Exchange Online: ensure \'Office 365\' option is selected, not Exchange Server.'] },
  'OUTLOOK.ATTACH': { title: 'Outlook attachment error', steps: ['Size limit: default Outlook limit 20MB, Exchange Online 150MB. For larger, upload to OneDrive + share link.', 'Blocked file types: .exe, .bat, .vbs, .js — Outlook blocks for security. Zip the file or rename extension.', 'Reduced attachment grayed: confirm you\'re in \'New email\' (not Reply with restrictions).', 'Cached profile: Profile may be corrupt. File → Account Settings → recreate profile.', 'Check Group Policy: if managed device, admin may have restricted attachment types.'] },
  'OUTLOOK.RULES': { title: 'Outlook rules not firing', steps: ['File → Manage Rules & Alerts → confirm rules listed and checkboxes ticked.', 'Rules size limit: total ~256KB. If too many rules, some won\'t fire. Delete unused.', 'Run rule manually: in dialog → \'Run rules now\' → select rule → Run.', 'Client-only vs server-side: some rules only run when Outlook is open. Check column \'Server\' vs \'Client\'.', 'Reset rules: outlook.exe /cleanrules (from Win+R) — DELETES all rules, requires recreate.'] },
  'OUTLOOK.CAL.SHARE': { title: 'Outlook calendar sharing', steps: ['Open Outlook → Calendar → right-click your calendar → Share → Calendar Permissions.', 'Add user → set permission level (Reviewer, Editor, etc.) → OK.', 'Recipient: Outlook → File → Open & Export → Other User\'s Folder → enter their name → Calendar.', 'If they say \'can\'t see\': you may have shared via \'Email calendar\' (snapshot, not live). Re-share via Share button.', 'Free/Busy only: confirm sender has at least \'Free/Busy time\' permission.'] },
  'OUTLOOK.SIGNATURE': { title: 'Outlook signature setup', steps: ['New Outlook (Windows 11): Settings → Mail → Compose and reply → Signatures.', 'Classic Outlook: File → Options → Mail → Signatures → New.', 'Create signature → format with logo/links → set defaults for \'New messages\' and \'Replies/forwards\'.', 'For HTML signature with images: insert image via Insert Picture (icon in signature editor), not paste.', 'Sync across devices: signatures on outlook.office.com sync to new Outlook for Windows; classic Outlook stores locally.'] },
  'OUTLOOK.OOO': { title: 'Outlook Out of Office / auto-reply', steps: ['File → Automatic Replies (Out of Office).', 'Toggle \'Send automatic replies\' → set start + end date.', 'Inside my organization tab: write the internal reply.', 'Outside my organization tab: write external reply (be more generic).', 'Outlook Web: outlook.office.com → Settings → Mail → Automatic replies.', 'Mobile: same path in Outlook mobile app → Settings → Account → Automatic replies.'] },
  'OUTLOOK.NO.RECV': { title: 'Outlook not receiving new mail', steps: ['Send/Receive tab → \'Send/Receive All Folders\'.', 'Check Junk folder. Right-click message → \'Not Junk\' → \'Add Sender to Safe Senders\'.', 'File → Account Settings → confirm account isn\'t disabled.', 'Cached Exchange Mode: File → Account Settings → Change → toggle Cached Exchange Mode off → restart → on. Forces resync.', 'Check Outlook.com (outlook.office.com) — if mail arrives there, Outlook desktop has a sync issue (profile or OST).', 'Last: rebuild profile via Control Panel → Mail → Show Profiles → New.'] },
  'NET.WIFI.NO.NET': { title: 'Wi-Fi connected, no internet', steps: ['Open elevated cmd: ipconfig /flushdns && ipconfig /release && ipconfig /renew.', 'Try a different DNS: Settings → Network → Properties → DNS server → 1.1.1.1 / 8.8.8.8.', 'Forget + reconnect network: Settings → Wi-Fi → Manage known networks → Forget → reconnect.', 'Network Reset: Settings → Network → Status → Network reset (LAST option — removes all adapters\' configs).', 'If only specific sites fail → DNS issue. If all sites fail but you can ping 1.1.1.1 → DNS only. If no ping → gateway issue.', 'On corporate Wi-Fi: confirm you haven\'t been auto-disconnected by 802.1X policy.'] },
  'NET.WIFI.DROPS': { title: 'Wi-Fi keeps disconnecting', steps: ['Device Manager → Network adapters → right-click your Wi-Fi adapter → Properties → Power Management → uncheck \'Allow the computer to turn off this device to save power\'.', 'Update Wi-Fi driver: Device Manager → adapter → Update driver → Search automatically. Or download from laptop manufacturer.', 'Adapter settings: roaming aggressiveness → set to 1 (Lowest) for stability.', 'Test with a different router (hotspot from phone) — isolates whether issue is laptop or router.', 'Drivers from manufacturer site, NOT Windows Update — manufacturer drivers are usually more stable for Wi-Fi.'] },
  'NET.DNS.FLUSH': { title: 'DNS cache flush / stale resolver', steps: ['Elevated cmd: ipconfig /flushdns', 'Also: ipconfig /registerdns', 'Restart browser. If problem persists for specific site, try 8.8.8.8 or 1.1.1.1 DNS to bypass corporate DNS.', 'Test resolution: nslookup target-site.com — should return IP. If timeout, your DNS server is unreachable.', 'On corporate DNS: contact IT — internal DNS may have stale records or be down.'] },
  'NET.SPEED': { title: 'Internet speed slow', steps: ['Test at speedtest.net or fast.com — confirm actual vs expected.', 'Try different device on same network — if also slow → ISP/router issue. If only this device → device issue.', 'Restart router: unplug 30 seconds → plug back → wait 2 min for full boot.', 'Check what\'s using bandwidth: Task Manager → Performance → click \'Open Resource Monitor\' → Network tab.', 'Disable bandwidth-hogs: Steam, cloud backups, OneDrive sync (right-click tray → Settings → Throttle uploads).', 'Wi-Fi specifically: try 5GHz band instead of 2.4GHz (faster, less interference, shorter range).'] },
  'NET.ETHERNET': { title: 'Ethernet shows no link', steps: ['Swap the ethernet cable (test with known-good cable).', 'Try different port on switch/router.', 'Device Manager → Network adapters → confirm no yellow bang on Ethernet adapter.', 'Disable + re-enable adapter: Settings → Network → Properties → Disable → Enable.', 'Check link light at the NIC (orange/green = link present). No light → cable or NIC dead.', 'In elevated cmd: ipconfig /release && ipconfig /renew once link is established.'] },
  'NET.BLUETOOTH': { title: 'Bluetooth not pairing', steps: ['Settings → Bluetooth → toggle OFF → wait 5 sec → toggle ON.', 'Put device in pairing mode (most have a button — see device manual).', 'Remove old pairings: Settings → Bluetooth → click existing device → Remove → re-pair fresh.', 'Device Manager → Bluetooth → driver yellow bang? Update driver.', 'Windows services: services.msc → \'Bluetooth Support Service\' → confirm Started + Automatic.', 'Last: Settings → Update & Security → Troubleshoot → Bluetooth → run.'] },
  'VPN.WONT.CONNECT': { title: 'VPN won\'t connect', steps: ['Restart VPN client (right-click tray → Quit → relaunch).', 'Confirm credentials correct (case sensitive). Verify against IT-provided ones.', 'Switch network: try mobile hotspot — if VPN works on hotspot, your current network blocks VPN (port 443/UDP 4500 often blocked).', 'Check VPN gateway URL: confirm it\'s the current one (URLs sometimes change after IT migration).', 'Reinstall VPN client: uninstall → reinstall.', 'For Always-On VPN / NetMotion / etc.: contact IT — these need org-side provisioning.'] },
  'VPN.DROPS': { title: 'VPN keeps disconnecting', steps: ['Try wired ethernet instead of Wi-Fi (more stable).', 'VPN client → Preferences → MTU → reduce to 1400 (some networks need lower MTU).', 'Disable IPv6 on VPN adapter: Network Properties → uncheck \'Internet Protocol Version 6\'.', 'Update VPN client to latest version.', 'Check for VPN policy that disconnects after inactivity — confirm with IT and adjust \'keepalive\' setting in client.'] },
  'VPN.SLOW': { title: 'VPN connection very slow', steps: ['Test speedtest.net WITHOUT VPN first. Note speed.', 'Test WITH VPN. VPN typically loses 10-30% speed.', 'If VPN is much slower: try a different VPN server location (closer to you).', 'Try TCP vs UDP: some VPN clients let you switch (UDP is faster but blocked more often).', 'Split tunnel: only route corporate traffic via VPN. Internet traffic stays direct = much faster (if your IT allows).'] },
  'VPN.INSTALL': { title: 'Install VPN client on new laptop', steps: ['Download installer from IT-provided source (Microsoft 365 portal Software section, or company onboarding email).', 'Run as Administrator (right-click → Run as administrator).', 'Allow Windows Firewall prompt (allow on Private + Public networks).', 'Configure: import .ovpn / .conf file IT provided, OR enter gateway URL + credentials.', 'Test connection. If \'auth failed\': verify credentials exactly. If \'cant reach gateway\': check internet works first.', 'If first VPN connection asks for MFA: have your authenticator app ready.'] },
  'PRT.DRIVER': { title: 'Add printer / driver install', steps: ['Settings → Bluetooth & devices → Printers & scanners → Add device.', 'If detected: click → Add. Driver auto-installs.', 'If not detected: \'Add manually\' → \'Add a printer using IP address or hostname\' → enter printer IP → Next.', 'Driver not bundled: download from manufacturer site by model number (HP, Brother, Canon, Epson, etc.).', 'For corporate shared printer: \\\\printserver\\printer-name → confirm + add. Driver auto-installs from print server.', 'Test page: right-click printer → Printer properties → Print Test Page.'] },
  'PRT.DEFAULT': { title: 'Default printer keeps changing', steps: ['Settings → Bluetooth & devices → Printers & scanners → scroll down → \'Let Windows manage my default printer\' → toggle OFF.', 'Now set your default manually: click your preferred printer → \'Set as default\'.', 'Default printer persists across reboots/network changes when Windows-manage is OFF.', 'For corporate GPO-deployed printers: admin may push default via GPO — confirm with IT.', 'If running app forces a default change (some accounting/POS apps do this): contact app vendor.'] },
  'PRT.QUALITY': { title: 'Print quality bad / streaks', steps: ['Run printer\'s built-in clean cycle: Printer Properties → Maintenance → Clean Print Head / Cartridge.', 'Check toner/ink levels via printer display. Replace if low.', 'Align print head (option in Maintenance menu).', 'Verify correct paper type in printer settings (matte vs glossy makes a difference).', 'For laser printer drum: drum unit may need replacement (>20k pages typical life).', 'If color shifts: replace specific color cartridge that\'s empty/low.'] },
  'PRT.NETWORK': { title: 'Add network printer by IP', steps: ['Settings → Bluetooth & devices → Printers & scanners → Add device → \'Add manually\'.', 'Choose \'Add a printer using a TCP/IP address or hostname\'.', 'Device type: Auto-detect (or TCP/IP Device).', 'Hostname or IP: enter the printer\'s IP (find via printer\'s network info page).', 'Port name: defaults to IP_ — leave default.', 'Driver: select from list or \'Have Disk\' if downloaded from manufacturer.'] },
  'PRT.PDF': { title: 'PDF won\'t print', steps: ['Try a different PDF reader: open in Edge (default in Windows 11) or Acrobat.', 'Print as image: Acrobat → File → Print → Advanced → \'Print as Image\'. Solves corrupt PDF print streams.', 'If specific PDF fails: re-download or ask sender to re-export.', 'Try saving the PDF locally first (some browser PDFs cant print directly).', 'Adobe Reader repair: Control Panel → Programs → Adobe → Modify → Repair.'] },
  'AUT.AUTHENTICATOR.SETUP': { title: 'Setup Microsoft Authenticator on new phone', steps: ['Install Microsoft Authenticator from App Store / Play Store on new phone.', 'On old phone (if available): open Authenticator → tap account → settings → \'Add to new phone\'.', 'Without old phone: mysignins.microsoft.com → Security info → \'Add sign-in method\' → Authenticator app.', 'Scan QR code shown on screen with new phone\'s Authenticator app.', 'Test by signing in to Microsoft 365 — you\'ll get push notification on new phone.', 'Once working: remove old phone from mysignins.microsoft.com (security).'] },
  'AUT.MFA.LOST': { title: 'MFA lost device / reset', steps: ['If you have a backup method (SMS, alt email): use that to sign in then re-enroll Authenticator.', 'If no backup: call (647) 581-3182 — we verify your identity then reset MFA.', 'Email integrateditsupp@iisupp.net with: full name, employee ID, and the new phone number you\'ll re-enroll.', 'Identity verification required: government photo ID + employee badge or manager confirmation.', 'After reset: at next sign-in you\'ll be prompted to set up MFA fresh.'] },
  'AUT.SSO.LOOP': { title: 'SSO redirect loop', steps: ['Clear browser cookies for the affected SSO domain: in Chrome → Settings → Privacy → Cookies → See all → search for the company SSO URL → delete.', 'Try incognito/private window (Ctrl+Shift+N) — bypasses cookies.', 'Try different browser to rule out browser issue.', 'Check time: SSO is sensitive to clock skew >5 min. Sync time (Settings → Time).', 'Specific app vs all apps: if only one app loops → app-specific config. If all apps loop → identity provider issue (check Entra/Okta status).', 'Last: clear all browser data (history, cookies, cache) for the day — forces fresh SSO flow.'] },
  'AUT.PW.EXPIRED': { title: 'Password expired', steps: ['Sign in to your work account at portal.office.com — you\'ll be prompted to set new password.', 'Or change at: account.activedirectory.windowsazure.com/changepassword.aspx', 'Password requirements: usually 12+ chars, mix of upper/lower/digit/symbol, can\'t reuse last 24.', 'After change: update password in your phone\'s mail app, mobile MFA, VPN client, and any cached credentials.', 'Sign out + back in to Windows (Ctrl+Alt+Del → Sign out) to refresh cached credentials.', 'If you can\'t sign in to change: contact (647) 581-3182.'] },
  'OS.CPU.HIGH': { title: 'High CPU usage', steps: ['Task Manager (Ctrl+Shift+Esc) → Performance tab → CPU graph.', 'Processes tab → sort by CPU descending → identify top consumer.', 'Common culprits: Windows Defender scan, Windows Update, Search Indexer, Chrome (open tabs), antivirus full scan.', 'For Defender: usually settles after scheduled scan completes (~30 min).', 'If unknown process: Google the name. Right-click → \'Open file location\' to see what app it belongs to.', 'Power plan: Settings → Power → ensure Balanced or High Performance (not \'Power saver\').'] },
  'OS.MEM.HIGH': { title: 'High memory / RAM full', steps: ['Task Manager → Performance → Memory tab → confirm % used + total installed.', 'Processes tab → sort by Memory → find heavy apps.', 'Browser tabs are top offender: each Chrome/Edge tab can use 100MB-1GB. Close tabs.', 'Disable startup apps: Task Manager → Startup → disable high-impact non-essential items.', 'Memory leak: if memory keeps climbing on idle PC → restart to reset.', 'If consistently maxed: time to add RAM. 16GB → 32GB upgrade is the most common win.', 'Increase pagefile: Settings → System → About → Advanced system → Performance Settings → Advanced → Virtual memory.'] },
  'OS.WIN.UPDATE': { title: 'Windows update stuck / failing', steps: ['Stop Windows Update service: open elevated cmd → net stop wuauserv && net stop bits && net stop cryptsvc.', 'Delete temp WU folder: ren C:\\Windows\\SoftwareDistribution SoftwareDistribution.old.', 'Restart services: net start wuauserv && net start bits && net start cryptsvc.', 'Settings → Windows Update → Check for updates.', 'If specific KB fails: download standalone from catalog.update.microsoft.com → install manually.', 'Run troubleshooter: Settings → Update & Security → Troubleshoot → Windows Update.'] },
  'OS.ACTIVATE': { title: 'Windows activation issue', steps: ['Settings → System → Activation → check status.', 'If \'cant activate\': run troubleshooter → Activation troubleshooter.', 'For digital license (linked to Microsoft account): sign in with the MS account that has the license.', 'For product key (boxed copy): re-enter via Activation → \'Change product key\'.', 'For corporate KMS: confirm you\'re on company network — KMS only works on-network unless using Azure AD-based activation.', 'Persistent error: contact (647) 581-3182 — may need MAK key from IT.'] },
  'OS.CLOCK': { title: 'Windows clock wrong', steps: ['Right-click clock → Adjust date/time → confirm \'Set time automatically\' is ON.', 'Click \'Sync now\' button.', 'If sync fails: open elevated PowerShell → w32tm /resync /force.', 'Change time server: w32tm /config /manualpeerlist:time.windows.com /syncfromflags:manual /reliable:yes /update → then net stop w32time && net start w32time.', 'For domain-joined: clock should sync from PDC. Verify with w32tm /query /source.', 'Check CMOS battery if time keeps drifting after reboots (laptop service required).'] },
  'OS.SLEEP': { title: 'Sleep mode won\'t wake', steps: ['Try moving mouse + pressing any key. Wait 10 seconds.', 'Try power button (short press — full press shuts down).', 'If still black: hold power button 10 seconds for hard shutdown. Boot fresh.', 'Update graphics driver: Device Manager → Display adapters → Update driver. Sleep-wake issues often graphics-related.', 'Power plan: Settings → Power → Additional power settings → \'Change plan settings\' → \'Change advanced power settings\' → \'PCI Express\' → Link State Power Management → Off.', 'Disable hybrid sleep: Same dialog → \'Sleep\' → \'Allow hybrid sleep\' → Off.', 'If persistent: BIOS update from manufacturer may have sleep-wake fixes.'] },
  'OS.DARK.MODE': { title: 'Dark mode setting', steps: ['Settings → Personalization → Colors → \'Choose your mode\' → Dark.', 'For app-specific dark mode (single app stuck in light): open that app\'s own settings (most apps have their own theme toggle).', 'Office apps: File → Options → General → Office Theme → Dark Gray or Black.', 'Browsers: Chrome → Settings → Appearance → Theme → Dark. Edge → Appearance → Dark.', 'If toggle not working: Settings → Update — Windows feature update may have a bug; restart after toggling.'] },
  'OS.LANG.KB': { title: 'Keyboard typing wrong characters', steps: ['Quickly: Win+Space — cycles input methods. Often you accidentally switched layouts.', 'Confirm layout: Settings → Time & Language → Language → Preferred languages → click your language → Options → confirm correct keyboard.', 'Remove extra layouts you don\'t use: prevents accidental switching.', 'Disable Win+Space shortcut: Settings → Time & Language → Typing → Advanced keyboard settings → \'Input language hot keys\' → adjust.', 'Numlock issue (numbers typing as navigation): press NumLock toggle.'] },
  'HW.MONITOR': { title: 'Monitor no signal / not detected', steps: ['Confirm monitor is ON + correct input source selected (HDMI 1, DisplayPort, etc.) via monitor\'s physical buttons.', 'Swap cable. HDMI 1.4 vs 2.0 vs DP cables matter for 4K@60Hz.', 'Try different port on PC.', 'Press Win+P → choose Extend / Duplicate. Sometimes display is set to PC-only.', 'Update GPU driver: NVIDIA / AMD / Intel manufacturer site. Outdated drivers break multi-monitor.', 'Check Device Manager → Display adapters — confirm GPU detected.', 'BIOS-level: confirm primary display set to PCIe (not integrated) if dedicated GPU.'] },
  'HW.FLICKER': { title: 'Screen flickering', steps: ['Most common cause: cable. Try a different HDMI/DisplayPort cable.', 'Refresh rate mismatch: Settings → Display → Advanced display → Refresh rate → set to monitor\'s native (60/75/144/etc.)', 'GPU driver: Device Manager → Display adapters → Update driver. Roll back if recent update caused it.', 'Loose connection: re-seat cable on both ends.', 'For laptops: external monitor flicker often = bad cable or USB-C dock issue. Try direct connection.'] },
  'HW.MOUSE': { title: 'Mouse not working / jumpy', steps: ['Replace battery (wireless). Check USB dongle is plugged in.', 'Try different USB port. Avoid USB 3 ports for some Bluetooth dongles (interference).', 'Re-pair Bluetooth mouse: Settings → Bluetooth → remove → add fresh.', 'Surface: mouse needs a non-glossy non-reflective surface. Glass tables = jumpy cursor.', 'Update driver: Device Manager → Mice → right-click → Update driver.', 'Last: try mouse on another computer to isolate.'] },
  'HW.KB': { title: 'Keyboard not responding', steps: ['Try different USB port. Unplug + replug.', 'Bluetooth: re-pair (Settings → Bluetooth → remove → add).', 'Test in BIOS (boot, press Del/F2): if keyboard works in BIOS but not Windows → driver/software issue.', 'Device Manager → Keyboards → right-click → Uninstall device → reboot (Windows reinstalls).', 'If specific keys broken: physical damage or stuck key. Try compressed air to dislodge debris.', 'Last: try keyboard on another computer.'] },
  'HW.AUDIO': { title: 'No sound on PC', steps: ['Click speaker icon (taskbar) → confirm correct output device + not muted + volume > 0.', 'Right-click speaker icon → Open Sound settings → confirm correct Output device.', 'Try different speakers/headphones to isolate hardware vs software.', 'Services: services.msc → Windows Audio → restart.', 'Update audio driver: Device Manager → Sound → right-click → Update driver. Or \'Roll back\' if recent update caused it.', 'Reinstall driver: Device Manager → Sound → Uninstall device → reboot (Windows reinstalls).', 'Specifically for Realtek: download Realtek HD Audio driver from PC manufacturer (Dell/Lenovo/etc.).'] },
  'HW.HEADSET': { title: 'USB headset not detected', steps: ['Try different USB port. USB 3 vs USB 2 sometimes matters.', 'Device Manager → Sound — confirm headset shows.', 'Settings → Sound → Output → manually select headset.', 'Update USB driver: Device Manager → Universal Serial Bus controllers → Update.', 'Some headsets need manufacturer software (Razer Synapse, Logitech G Hub) for full features.', 'Try headset on another PC to isolate.'] },
  'HW.WEBCAM': { title: 'Webcam not detected', steps: ['Settings → Privacy & security → Camera → \'Camera access\' ON + \'Let apps access your camera\' ON.', 'Device Manager → Cameras / Imaging devices → confirm webcam listed. If yellow bang: update driver.', 'For laptops: function key (Fn+F8 or similar) may toggle camera. Press it.', 'Privacy shutter: many modern laptops have a physical camera cover — check.', 'Test in Camera app (Start → Camera). If Camera app works but specific app doesn\'t → that app\'s permission issue.', 'Reinstall driver: Device Manager → right-click webcam → Uninstall → reboot.'] },
  'HW.USB': { title: 'USB device not recognized', steps: ['Try different USB port (USB 2 vs USB 3 can matter).', 'Try device on another computer to isolate hardware vs PC.', 'Device Manager → look for \'Unknown Device\' under USB → right-click → Update driver.', 'Disable + re-enable USB Root Hubs: Device Manager → Universal Serial Bus controllers → right-click each → Disable → Enable.', 'Power Management: Device Manager → USB Root Hub → Properties → Power Management → uncheck \'Allow computer to turn off\'.', 'BIOS: confirm USB ports enabled. Some corporate machines disable USB.'] },
  'HW.BATTERY': { title: 'Laptop battery not charging', steps: ['Confirm charger plugged in firmly + outlet works.', 'Try different outlet + different charger (if you have one).', 'Battery icon: hover — what does it say? \'Plugged in, not charging\' is different from \'Not detected\'.', 'Battery report: powercfg /batteryreport in elevated cmd → opens HTML showing battery health (look for \'Design Capacity\' vs \'Full Charge Capacity\'). If FCC <60% of design → battery worn out.', 'Update battery driver: Device Manager → Batteries → Microsoft AC Adapter + Battery → Update.', 'Power plan: ensure not in \'Power Saver\' which caps charging at 80%.', 'If physical: contact manufacturer for battery replacement.'] },
  'HW.OVERHEAT': { title: 'Laptop overheating', steps: ['Move to flat hard surface (beds/laps block vents).', 'Compressed air through vents → clear dust buildup.', 'Task Manager → see what\'s using CPU. High CPU = high heat.', 'BIOS/manufacturer software: enable \'Quiet\' or \'Balanced\' thermal profile.', 'Old thermal paste: 4+ year old laptops often need thermal paste replacement (~$100 at IT shop).', 'Last: manufacturer service if temp consistently >85°C at idle.'] },
  'HW.HDMI': { title: 'HDMI not working', steps: ['Confirm cable plugged firmly both ends.', 'Try different HDMI cable. Cheap cables fail. Recommend Certified Premium HDMI for 4K.', 'Try different port on PC + monitor.', 'Display set to extend/duplicate: press Win+P.', 'Update graphics driver.', 'If audio works but no video: monitor\'s input source set wrong.', 'BIOS: ensure integrated graphics enabled if using motherboard HDMI.'] },
  'SW.INSTALL.ADMIN': { title: 'Can\'t install software / need admin', steps: ['Right-click installer → \'Run as administrator\'.', 'If you don\'t have admin password: contact (647) 581-3182 — we provision temporary admin or push install via Intune.', 'For specific allowed apps: ask IT for self-service portal access — many orgs have Company Portal / Software Center.', 'For org-managed devices: GPO often blocks user install entirely. Self-service is the right path.', 'Browser-based alternative: see if app has web version (Slack, Zoom, Teams all have web).'] },
  'SW.AV.BLOCK': { title: 'Antivirus / SmartScreen blocking app', steps: ['SmartScreen: \'More info\' → \'Run anyway\' (if you\'re sure the file is safe).', 'Defender exclusion: Windows Security → Virus & threat protection → Manage settings → \'Real-time protection\' → toggle ON.', 'If toggle greyed out: third-party AV may have disabled Defender (intentional — only one AV runs at a time).', 'Group Policy may force off: gpedit.msc → Computer Configuration → Administrative Templates → Windows Components → Microsoft Defender Antivirus → \'Turn off Microsoft Defender Antivirus\' → Not configured.', 'For Intune-managed: contact IT — Endpoint Protection policy may enforce Defender state.', 'Confirm Defender service running: services.msc → \'Microsoft Defender Antivirus Service\' → Running + Auto.'] },
  'SW.APP.CRASH': { title: 'Application keeps crashing', steps: ['Update app to latest version.', 'Restart PC (clears cached state).', 'Run as Administrator (right-click → Run as administrator).', 'Reset/Repair: Settings → Apps → app → Advanced options → Reset or Repair.', 'Check Event Viewer: Applications log → find Error events matching app crash time. Note Faulting Module — often a DLL you can update.', 'Reinstall the app.', 'If recently after Windows update: roll back update via Settings → Recovery.'] },
  'SW.SMARTSCREEN': { title: 'SmartScreen blocking software install', steps: ['\'More info\' link in SmartScreen prompt → \'Run anyway\' button (only if file is trusted).', 'Disable SmartScreen for download: Windows Security → App & browser control → Reputation-based protection → \'Check apps and files\' → Off (TEMPORARY).', 'For trusted vendor app: contact IT to allowlist via Defender SmartScreen exception.', 'Confirm publisher: file Properties → App & browser control → Reputation-based protection → Off.'] },
  'MOB.EMAIL.SETUP': { title: 'Setup work email on phone', steps: ['iOS: Settings → Mail → Accounts → Add Account → Microsoft Exchange. Enter work email → Sign In → enter password + MFA.', 'Android: Outlook app from Play Store → Add account → work email → password + MFA.', 'For Intune-managed: install Microsoft Authenticator + Microsoft Intune Company Portal first.', 'After: device enrolls in Intune if your org requires (you\'ll see compliance prompts).', 'If conditional access blocks: ensure device meets compliance (passcode, encryption, OS version).'] },
  'MOB.MFA.SETUP': { title: 'Setup MFA on phone', steps: ['Install Microsoft Authenticator from App Store / Play Store.', 'On your computer: mysignins.microsoft.com → Security info → Add sign-in method → Authenticator app.', 'Follow prompts to scan QR code with phone\'s Authenticator.', 'Test by signing out + back in to portal.office.com — push notification arrives on phone.', 'Backup method recommended: add SMS or alt email as backup for if you lose phone.'] },
  'MOB.VPN': { title: 'Install VPN on phone', steps: ['Get IT-provided VPN client from App Store (Microsoft Tunnel, Cisco AnyConnect, Palo Alto GlobalProtect, etc.).', 'Open client → enter gateway URL from IT.', 'Authenticate: same credentials as desktop VPN.', 'On iOS: Settings → VPN → enable when needed.', 'On Android: notification panel → tap VPN to toggle.', 'Always-On VPN: corporate-deployed via Intune (you\'ll see VPN profile auto-configured).'] },
  'MOB.INTUNE': { title: 'Enroll phone in Intune', steps: ['Install Microsoft Intune Company Portal app from App Store / Play Store.', 'Open app → Sign in with work email.', 'Follow prompts to enroll device. iOS asks you to install profile in Settings.', 'Set passcode if not already (Intune typically requires 6-digit).', 'Verify compliance: Company Portal → My Devices → confirm \'Compliant\'.', 'If non-compliant: app shows specific reason (no passcode, jailbroken, OS too old) — fix and re-check.'] },
};
