/* === ARIA Classifier Mirror — auto-test harness ===
   Mirrors the classify() function from aria.html so we can run thousands
   of scenarios in milliseconds without spinning up a browser. Keep in
   sync when aria.html's regex tree changes. */
'use strict';

const INDUSTRY_APP_HINTS = "epic|cerner|meditech|allscripts|athenahealth|nextgen|ecw|emr|ehr|patient portal|dragon medical|mychart|clinical workstation|bloomberg terminal|reuters eikon|factset|murex|calypso|front arena|sap|oracle financials|sas|tradeweb|marketaxess|fix gateway|reuters trading|bloomberg messenger|salesforce financial|imanage|netdocuments|worldox|clio|mylegalpractice|lexisnexis|westlaw|time matters|prolaw|tabs3|elite 3e|intapp|cac card|piv card|sipr|niprnet|sf86|dod cac reader|smartcard|ahce|vits|rms|tigris|sap mes|sap erp|siemens nx|autodesk inventor|solidworks|plm|dassault|mastercam|plc|scada|wonderware|ignition|rockwell|pos|shopify pos|square pos|clover|lightspeed|vend|toast|aloha pos|revel|heartland|catapult|opera pms|protel|mews|cloudbeds|hotelogix|quickbooks pos|silverware|oracle micros|yardi|appfolio|mri software|realpage|propertyware|rentmanager|dotloop|docusign|salesforce real estate|mls|procore|autodesk construction cloud|plangrid|bluebeam revu|primavera|revit|autocad|sage 300 cre|viewpoint vista|sketchup|osi pi|aveva pi|rockwell factorytalk|ge cimplicity|siemens wincc|schneider citect|sap pm|fleetmatics|geotab|samsara|verizon connect|mcleod loadmaster|tmw|dat|truckmate|wms|manhattan wms|veeva vault|oracle clinical|medidata rave|inform|cdms|lims|sample tracker|rave edc|spotfire|canvas|blackboard|moodle|d2l brightspace|schoology|google classroom|clever|classlink|powerschool|infinite campus|synergy|aspen|skyward|salesforce npsp|blackbaud raisers edge|blackbaud crm|donorperfect|bloomerang|little green light|quickbooks nonprofit|classy|givelively|networkforgood|climate fieldview|agleader sms|john deere operations center|trimble ag|farm logs|granular|agworld|conservis|guidewire|duck creek|vlocity|salesforce insurance|applied epic|aim|xanadu|sapiens|workday|ultipro|adp workforce|bamboohr|greenhouse|lever|linkedin recruiter|sap successfactors|peoplesoft|dayforce|cad system|aegis cad|tritech|intergraph|motorola cad|priority dispatch|pulsepoint|prodigy|mobile data terminal|jpas|difms|dts|jtims|mark logic|accumulo|palantir|distributed common ground|dcgs|catia|windchill|enovia|smarteam|ansys|simulia|star-ccm|dealersocket|reynolds and reynolds|cdk drive|autosoft|dominion dms|vinsolutions|xtime|cox automotive|surpac|vulcan|minesight|datamine|leapfrog geo|jigsaw|wenco|modular mining|aspen plus|chemcad|pro ii|hysys|aspen tech|sap process|simatic pcs7|delta v|plex erp|sage 100|aptean|sap food|infor m3|navision food|dynaway|hudl|dartfish|sportscode|synergy sports|statcast|garmin connect|strava for business|training peaks|firstbeat|artsystems|artwork archive|collectorsystems|tessitura|choice ticketing|spektrix|blackbaud altru|siriusware|planning center|breeze chms|elexio|servant keeper|realm|aplos|txt2give|easy tithe".split("|");
function industryIntentOverride(q) {
  if (!INDUSTRY_APP_HINTS.some(app => industryAppMatches(q, app))) return null;
  if (/\b(login failed|wont login|won't login|can'?t login|cant login|password|cac certificate|smart card|wont read smart card)\b/.test(q)) return 'password';
  if (/\b(print|printer)\b/.test(q)) return 'printer';
  return 'default';
}
function industryAppMatches(q, app) {
  const escaped = app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)').test(q);
}

function classify(text) {
  let q = String(text || '').toLowerCase().replace(/\b([a-z])\.\s*([a-z])\.\s*([a-z])\.\s*/g, '$1$2$3 ');
  q = q.replace(/\bwi\s+fi\b/g, 'wifi').replace(/\bone[-\s]+drive\b/g, 'onedrive').replace(/\bon drive\b/g, 'onedrive').replace(/\bcantt\b/g, 'cant');

  // most-specific first
  if (/\b(mfa bombing|50 mfa pushes?|mfa push bombing|mfa bombed)\b/.test(q)) return 'kb:security';
  // MFA usability issues stay in MFA. Active push-abuse language routes to security above.
  if (/\b(mfa fatigue|too many mfa|too many mfa prompts|spam mfa|mfa loop)\b/.test(q)) return 'kb:mfa';
  if (/(scam|phishing|suspicious (email|emial|eamil|link|file|attachment|sign-?in|activity)|\bmalware\b|ransomware|trojan|virus warning|account (compromised|hacked|hijack)|impossible travel|sign[- ]in from (russia|china|north korea|iran)|clicked.* link|breached account|hibp|haveibeenpwned|files? (are )?encrypted|lockbit|wannacry|conti|ryuk|crypto.?locker|someone has access|unauthorized access|suspicious activity|account takeover)/.test(q)) return 'kb:security';
  if (/(camera|webcam|video call|logitech c\d+|logitech brio|brio webcam|razer kiyo|elgato facecam|opal c1)/.test(q)) return 'kb:webcam';
  if (/\b(help me find|find (the |my )?recovery key|stuck.*recovery key)\b/.test(q)) return 'escalation';
  if (/(bitlocker)/.test(q) || (/recovery key/.test(q) && !/^(help me find|i need help finding|i'?m stuck|find (the |my )?recovery key)/.test(q))) return 'kb:bitlocker';
  if (/(out of office|\booo\b|automatic repl|auto.?reply|auto.?responder|vacation|away message)/.test(q)) return 'outlook_ooo';
  if (/\b(outlook|outlo+o?k|outlok|outlokk|outluk|outlk)\b/.test(q) && /\b((won'?t|won ?t|wont|will not|cannot|can.?t|can ?t|isn'?t|is not|not) (open|opening|launch|launching|start|starting|run|running)|crash|crashes|crashing|hang|hangs|hanging|freeze|freezes|freezing|frozen|not responding)\b/.test(q)) return 'mail';
  if (/\b(team'?s|teamz|teems?|teams|microsoft teams|ms teams)\b/.test(q)) return 'kb:teams';
  if (/\b(wfi|wifii)\b/.test(q)) return 'wifi';
  if (/\b(locked out of (my )?(email|e-mail|emial|eamil|outlook|outlo+o?k|outlok|outlokk|outluk)|reset (my )?(password|passwrd|pasword|passwd|passw0rd|pasworld) for (outlook|outlo+o?k|outlok|outlokk|outluk|office|email|e-mail|emial|eamil)|(email|e-mail|emial|eamil) password reset|(outlook|outlo+o?k|outlok|outlokk|outluk) password reset)\b/.test(q)) return 'password';
  if (/onedrive/.test(q)) return 'kb:onedrive';
  if (/(onboarding|offboarding|byod|new hire|employee leaving|bring your own device|deactivate (user|account)|provision user|new starter|departing employee|leaver process|joiner process|need to deactivate)/.test(q)) return 'kb:onboarding';
  if (/\bazure ad\b/.test(q)) return 'kb:m365';
  if (/\b(active directory|ad lockout|domain account|domain controller|kerberos|krb5)\b/.test(q) || /\bad\b\s+(account|password|passwrd|pasword|passw0rd|pasworld|passwd|user|lockout|sync|replication|reset|unlock)/.test(q) || /\b(account|user|password) (locked|unlock|reset)\s+(in (ad|active directory)|in domain|domain side)\b/.test(q) || /\block(ed)? out in domain\b/.test(q) || /\bcan'?t unlock (ad|domain) account\b/.test(q)) return 'kb:active-directory';
  if (/\bdhcp not assigning ip\b/.test(q)) return 'wifi';
  const industryOverride = industryIntentOverride(q);
  if (industryOverride) return industryOverride;

  // core
  if (/(mail|email|e-mail|emial|eamil|inbox|outlook|outlok|outloook|outlokk|outluk|outlk|sent items|drafts? folder|spam filter|junk folder|email attachment|attachments? not opening|email signature|autocomplete|exchange|mailbox|smtp|imap|pop3|exchange online)/.test(q)) return /out of office|\booo\b|auto.?reply/.test(q) ? 'outlook_ooo' : 'mail';
  if (/vpn|tunnel|globalprotect|anyconnect|cisco (vpn|anyconnect)|fortinet|pulse secure|pulsesecure|openvpn|wireguard|remote access|forticlient/.test(q)) return 'vpn';
  if (/(password|passwrd|pasword|passwd|passw0rd|pasworld|locked out|sign[- ]in|sign[- ]on|log[- ]in|login|logon|reset.*(password|passwrd|login)|can'?t (log|sign|get) in|wont? (let me )?(log|sign) in|wont? log in|cant log in|can'?t log on|invalid (login|sign[- ]?in)|account locked( (out|after))?)/.test(q) && !/\b(wifi|wi-fi|wireless|router|modem)\b/.test(q)) return 'password';
  // Bluetooth wireless audio before generic wifi (so 'wireless headset cutting out' hits bluetooth)
  // Printer-specific BEFORE wifi (so 'network printer' hits printer not wifi)
  if (/\b(network printer|wifi printer|wireless printer)\b/.test(q) || /print/.test(q)) return 'printer';
  if (/\b(wireless (headset|earbud|headphones?|mic)|bluetooth (headset|earbud|headphones?|mic))\b/.test(q)) return 'kb:bluetooth';
  if (/(wifi|wi-fi|wireless|network|internet|limited connectivity|no internet|5\s*ghz|2\.4\s*ghz|router|modem|ssid|access point|wifi adapter|wifi card|wireless adapter)/.test(q)) return 'wifi';
  if (/print/.test(q)) return 'printer';
  // Printer trumps wifi (network printer)
  if (/\b(network printer|wifi printer|wireless printer)\b/.test(q)) return 'printer';

  // macOS BEFORE windows (so 'macbook won't boot' hits macOS not windows)
  if (/\b(macbook|imac|mac mini|mac pro|macos|kernel panic|beach ball)\b/.test(q)) return 'kb:macos';

  // KB-only
  if (/(blue screen|bsod|stop error|wont boot|won'?t boot|won ?t boot|won'?r boot|spinning dots|stuck on boot|error 0x|0x000|bootloop|boot loop|keeps restarting|windows (won'?t|won ?t|won'?r|wont|will not) (start|boot|turn on)|windows update (broke|failed|failing|fails?)|cumulative update fail|feature update fail|servicing stack|startup repair loop|recovery mode loop|cannot activate windows|can'?t activate windows|windows activation (failed|issue))/.test(q)) return 'kb:windows';
  if (/(onedrive|sync(ing)? files?|files? wont sync|files? won'?t sync|files? won ?t sync|files? won'?r sync|file wont? sync|shared file won ?t sync|shared file won'?r sync|sync conflict|share with me|shared file wont sync|sync error|selective sync|files? on demand|onedrive (icon|prompt|password|stuck|paused|setup|over quota))/.test(q)) return 'kb:onedrive';
  if (/(teams|microsoft teams|ms teams|teams meeting|teams chat|teams channel|teams call|cant see channels|can'?t see channels|can ?t see channels|can;t see channels|teams cache|teams notifications|teams external guest|channels?\s+(missing|gone|empty)|cant join meeting|can'?t join meeting)/.test(q)) return 'kb:teams';
  if (/(mfa|multi[- ]factor|two.?factor|2fa|authenticator|sms code|text code|verification code|otp code|one[- ]time code|sms (not |never )?(arriving|coming|came)|text (not |never )?(arriving|coming|came)|six[- ]digit code|6[- ]digit code|verification not)/.test(q)) return 'kb:mfa';
  if (/\b(headphone jack|headset jack|audio jack|wired headphones?)\b/.test(q)) return 'default';
  if (/(bluetooth|airpod|headphones?|headset|earbuds?|jabra|poly|plantronics|bose|sennheiser|sony wh|jbl|wireless headset|wireless earbud)/.test(q)) return 'kb:bluetooth';
  if (/(usb|external drive|flash drive|external ssd|external hard drive|seagate|sandisk|wd (my passport|elements)|usb-c (port|hub)|thunderbolt port|sd card|micro sd|memory card)/.test(q)) return 'kb:usb';
  if (/\b(edge|chrome|firefox|safari|brave|opera|browser)\b.*\b(slow|laggy|crash|crashed|crashing|cache|bookmarks?|favorites?|homepage|pop-ups?|download|sync|extension|won'?t open|broken)\b/.test(q)) return 'kb:browser';
  if (/(slow|laggy|sluggish|performance|high cpu|cpu usage|ram usage|memory usage|memory leak|disk 100|disk at 100|antimalware service|svchost (high|using)|fans? (spin|spinning)|overheat(ing)?|laptop hot|laggy machine|slow (startup|shutdown|after)|takes forever to (boot|open|load|start)|task manager shows high)/.test(q)) return 'kb:performance';
  if (/(kernel panic|beach ball|mac (won'?t|won ?t|won'?r|wont) (boot|start|shut|turn)|macbook (won'?t|won ?t|won'?r|wont)|spinning beach ball|mac freezes|macos slow|mac stuck on apple|imac (won'?t|won ?t|won'?r|wont)|macos update fail)/.test(q)) return 'kb:macos';
  if (/(dns|dhcp|ip address|ping (timeout|fail)|gateway unreachable|cannot resolve hostname|hostname not resolved|cant resolve hostname|can'?t resolve hostname|can ?t resolve hostname|can;t resolve hostname|traceroute fail|tracert fail|route to host|arp issue|subnet mask|vlan|firewall (block|blocking)|port (closed|blocked)|can'?t reach internal|can ?t reach internal|can;t reach internal|cannot reach internal|internal site (down|unreachable))/.test(q)) return 'kb:networking';
  if (/(file share|ntfs|shared folder|access denied|permission denied|denied permission|no access to (folder|file|share)|group missing permissions|permissions reset|acl issue|share permission|cant open folder|can'?t open folder|can ?t open folder|can;t open folder|user can'?t open|user can ?t open|user can;t open|cannot access folder|folder access)/.test(q)) return 'kb:permissions';
  if (/(active directory|\bad\b lockout|domain account locked|domain account|kerberos|krb5|ad authentication|ad replication|domain controller|dc replication|\bad\b\s+(pasword|passw0rd|pasworld|passwd)\s+reset)/.test(q)) return 'kb:active-directory';
  if (/(onboarding|offboarding|byod|new hire|employee leaving|bring your own device|deactivate (user|account)|provision user|new starter|departing employee|leaver process|joiner process|need to deactivate)/.test(q)) return 'kb:onboarding';
  if (/(intune|conditional access|azure ad|m365 license|license activation|e3 license|e5 license|f3 license|business basic|business standard|business premium|enterprise mobility|emm|emt|tenant settings|m365 admin center|microsoft 365 admin|aad|entra(\s+id)?|user has no license|license (expired|assignment|missing|removed|added)|no license assigned|need to add.*license|new hire (account|license))/.test(q)) return 'kb:m365';
  if (/\b(edge|chrome|firefox|safari|brave|opera|browser)\b/.test(q)) return 'kb:browser';

  if (/(ops|dashboard|operations|metrics)/.test(q)) return 'ops';
  if (/\b(i'?m stuck|im stuck)\b/.test(q)) return 'escalation';
  if (/\b(talk to (it|live agent|agent|human|tech support|support|someone|a human|a person|a tech|a real person)|escalate|live agent|contact (it|support|tech)|i (want|need) (a |to talk to )?(human|person|real (person|human))|transfer me|connect me to|need a human|need to talk to (someone|a (person|human|tech)))\b/.test(q)) return 'escalation';
  if (/^(help me find|i need help finding|i'?m stuck|find (the |my )?recovery key)/.test(q)) return 'escalation';
  if (/\b(voice mode|switch to voice|use voice|voice chat)\b/.test(q)) return 'voice';

  if (/\b(rolex|omega|patek|tag.?heuer|hublot|seiko|cartier|breitling|audemars|iwc)\b/.test(q)) return 'shopping';
  if (/\bwatch(?:es)?\b(?!list)|\b(jewel(?:ry|lery)?|diamond|necklace|earring|handbag|sneakers?|shoes?)\b/.test(q)) return 'shopping';
  if (/\b(buy|shop|shopping|purchase|amazon|product|store|retail|deal)\b/.test(q)) return 'shopping';
  if (/\b(news|headlines?|breaking|article|top stories)\b/.test(q)) return 'news';
  if (/\b(weather|temperature|forecast|raining|snow)\b/.test(q)) return 'weather';
  if (/\b(stock|share price|crypto|bitcoin|ethereum|nasdaq|s&p|dow|tsx|ticker|trade|invest)\b/.test(q)) return 'trade';
  if (/\b(quote|saying|wisdom|inspiration|motivat)/.test(q)) return 'quote';

  return 'default';
}

/* === Resolution classifier mirror (just shipped today) === */
function looksLikeResolution(q) {
  const t = String(q || '').toLowerCase().trim();
  if (!t) return false;
  const NEG = /\b(not|n['’]?t|isn['’]?t|wasn['’]?t|aren['’]?t|don['’]?t|doesn['’]?t|didn['’]?t|cant|can['’]?t|won['’]?t|wouldn['’]?t|couldn['’]?t|never|nope|nah|negative|no\s+longer\s+working|still\s+(broken|same|stuck|down|having|getting|happening|seeing|not|cant|can['’]?t)|broke\s+again|came\s+back|happening\s+again|back\s+to\s+(square|broken)|worse|worst)\b/;
  if (NEG.test(t)) {
    if (!/no (more|longer) (issues?|problems?|errors?|broken)|no\s+(issue|problem|error)\s+now|nothing\s+broken|not\s+broken\s+anymore/.test(t)) {
      return false;
    }
  }
  const POS_KEYWORDS = /\b(resolved?|solved?|solving|fixed|fixin|fixing|works?|worked|working|done|completed?|sorted|success(ful)?|perfect(ly)?|excellent|awesome|amazing|great|brilliant|fantastic|wonderful|cool|nice|sweet|sick|tight|smooth|clean|smashing|stellar|killer|lifesaver|slay|legit|fire|magic|magical|miracle|godsend|wizard|hero|legend|champ|champion|boss|guru|king|queen|mvp)\b/;
  const POS_PHRASES = /(all (good|set|sorted|done|fixed|right|cleared|clear|better|smooth|working)|that (did|fixed|worked|works|nailed|got|solved) it|that\s+was\s+it|problem (solved|fixed|gone|cleared|sorted)|issue (resolved|solved|fixed|gone|cleared|sorted)|good to go|back to normal|back (online|up|running)|up\s+and\s+running|fine now|ok(ay)? now|now (working|fine|good|fixed)|works (now|perfectly|great|fine|like a charm|like a champ)|fixed (now|it|the issue|the problem)|thanks?\s+(a\s+lot|so much|very much|alot|so|much|a million|million)|much appreciated|appreciate (you|it|this|that|your help)|thank\s+you(\s+(very\s+much|so\s+much|kindly|sir|maam|ma['’]?am))?|got it (working|fixed|sorted)|10\s*\/\s*10|5\s*stars?|five\s*stars?|five\s*star|on\s+top|chefs?\s*kiss|chef['’]?s\s*kiss|gold\s*star|nailed it|crushed it|killed it|smashed it|cracked it|that\s+helped|this\s+helped|that\s+(was\s+)?perfect|much better|way better|good now|great now|cleared up|cleared it|sorted out|figured (it )?out|got\s+it|in\s+the\s+clear|squared\s+away|squared\s+up|wrapped\s+up|wrap\s+it\s+up|close\s+(this|it|the\s+ticket)|case\s+closed|ticket\s+(closed|done|resolved)|end\s+(of\s+)?call|im\s+good|i\s+am\s+good|we['’]?re\s+good|were\s+good|we\s+are\s+good|youre\s+(a\s+)?(star|legend|champ|lifesaver|the\s+best|amazing|incredible)|you\s+are\s+(a\s+)?(star|legend|champ|lifesaver|the\s+best|amazing|incredible)|that\s+took\s+care\s+of\s+it|did\s+the\s+trick|that['’]?s\s+(it|the\s+one|better|perfect|great)|easy|too\s+easy|piece\s+of\s+cake|cake\s+walk|painless|smooth\s+sailing)/;
  const SHORT_AFFIRMS = /^(\s*(yep|yup|yeah|yes|y|ya|ok|okay|k|kk|aye|aight|alright|nice|cool|sweet|sick|sure|cheers(\s+(mate|bro|man))?|cool|good|great|perfect|amazing|awesome|brilliant|done|fixed|solved|resolved|works|working|thx(\s+(a\s+lot|so\s+much|man|mate))?|thanks(\s+(a\s+lot|so\s+much|man|mate|bro))?|thanx|tysm|ty(\s+(so\s+much|a\s+lot|man|bro|mate|times))?|tia|tyvm|ily|appreciate(\s+it)?|grateful|gracias|merci|danke|salud|legend|legendary|kudos|w|win|gg|gjwp|gj|glhf|noted|copy|10\/10|5\/5|👌|👍|🙏|💯|🔥|✅|✔️|✓|🏆|🌟|⭐)+\s*[!.]*\s*)+$/;
  const COURTESY_CORE = t
    .replace(/^(please|can you help with|i need help with|help me with|sorry but|quick question\s*[—-]?|hey|urgent:|fyi|btw|urgent|asap|p1:|critical:|now:|this is blocking me\s*[—-]?|losing time on)\s+/i, '')
    .replace(/\s+(please|asap|urgent)\??$/i, '')
    .trim();
  return POS_KEYWORDS.test(t) || POS_PHRASES.test(t) || SHORT_AFFIRMS.test(t) || (COURTESY_CORE !== t && SHORT_AFFIRMS.test(COURTESY_CORE));
}

module.exports = { classify, looksLikeResolution };
