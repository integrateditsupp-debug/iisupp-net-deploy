/* === ARIA Classifier Mirror — auto-test harness ===
   Mirrors the classify() function from aria.html so we can run thousands
   of scenarios in milliseconds without spinning up a browser. Keep in
   sync when aria.html's regex tree changes. */
'use strict';

function classify(text) {
  let q = String(text || '').toLowerCase().replace(/\b([a-z])\.\s*([a-z])\.\s*([a-z])\.\s*/g, '$1$2$3 ');

  // most-specific first
  // MFA-specific catches BEFORE general security (so 'mfa fatigue' / 'too many mfa' route to MFA, not security)
  if (/\b(mfa fatigue|mfa bombing|too many mfa|too many mfa prompts|50 mfa|spam mfa|mfa loop)\b/.test(q)) return 'kb:mfa';
  if (/(scam|phishing|suspicious (email|link|file|attachment|sign-?in|activity)|malware|ransomware|trojan|virus warning|account (compromised|hacked|hijack)|impossible travel|sign[- ]in from (russia|china|north korea|iran)|clicked.* link|breached account|hibp|haveibeenpwned|files? (are )?encrypted|lockbit|wannacry|conti|ryuk|crypto.?locker|someone has access|unauthorized access|suspicious activity|account takeover)/.test(q)) return 'kb:security';
  if (/(camera|webcam|video call|logitech c\d+|logitech brio|brio webcam|razer kiyo|elgato facecam|opal c1)/.test(q)) return 'kb:webcam';
  if (/(bitlocker)/.test(q) || (/recovery key/.test(q) && !/^(help me find|i need help finding|i'?m stuck|find (the |my )?recovery key)/.test(q))) return 'kb:bitlocker';
  if (/(out of office|\booo\b|automatic repl|auto.?reply|auto.?responder|vacation|away message)/.test(q)) return 'outlook_ooo';
  if (/\boutlook\b/.test(q) && /\b((won'?t|wont|will not|cannot|can.?t|isn'?t|is not|not) (open|opening|launch|launching|start|starting|run|running)|crash|crashes|crashing|hang|hangs|hanging|freeze|freezes|freezing|frozen|not responding)\b/.test(q)) return 'mail';

  if (/(locked out of (my )?(e-?mail|emial|eamil|mailbox|outlook|account)|reset (my )?password for (outlook|email|mail)|password for (outlook|email))/.test(q)) return 'password';
  // core
  if (/(mail|email|emial|eamil|inbox|outlook|outlok|outloook|outlk|mi correo|correo no|secure messaging|sent items|drafts? folder|spam filter|junk folder|email attachment|attachments? not opening|email signature|autocomplete|exchange|mailbox|smtp|imap|pop3|exchange online)/.test(q)) return /out of office|\booo\b|auto.?reply/.test(q) ? 'outlook_ooo' : 'mail';
  if (/vpn|tunnel|globalprotect|anyconnect|cisco (vpn|anyconnect)|fortinet|pulse secure|pulsesecure|openvpn|wireguard|remote access|forticlient|\bvpm\b|citrix|\brdp\b|remote desktop|remote (review )?session|telework|working from home can.?t reach|offsite (provider|access|user)|remote monitoring connection|(pacs|records) remotely/.test(q) && !(/(\bmfa\b|two.?factor|2fa|authenticator|verification code|otp)/.test(q) && !/\bvpn\b/.test(q)) && !(/(performance (degraded|issue)|running slow|loading slow|slow)/.test(q) && !/\bvpn\b/.test(q))) return 'vpn';
  // Active Directory (on-prem) BEFORE password, so 'account locked in ad' / 'unlock ad account' route to AD,
  // not the generic password bucket. Requires AD context + an identity/account action (avoids 'saw an ad'),
  // and EXCLUDES azure/entra/aad/cloud (those are kb:m365).
  if ((/(active directory|domain controller|\bdc\b replication|kerberos|krb5|ad replication|ad authentication|domain account|on[- ]?prem(ises)? ad|local ad)/.test(q)
       || (/\b(ad|domain)\b/.test(q) && /(account|lockout|lock(ed)? out|locked|unlock|disabl|re-?enabl|\benabl|reset|password|login|log[- ]?in|sign[- ]?in|logon|group|membership|credential|user)/.test(q)))
      && !/(azure|entra|\baad\b|conditional access|intune|m365|microsoft 365|office 365|\bcloud\b|onboard|offboard|new hire|new starter|provision|deactivat|byod|employee leaving|departing|leaver|joiner)/.test(q)) return 'kb:active-directory';
  if (/(password|pasword|passwd|passw0rd|pasworld|locked out|sign[- ]in|sign[- ]on|log[- ]in|login|logon|reset.*(password|login)|can'?t (log|sign|get) in|wont? (let me )?(log|sign) in|wont? log in|cant log in|can'?t log on|invalid (login|sign[- ]?in)|account locked( (out|after))?|no puedo iniciar sesion|iniciar sesi[oó]n|contrase[nñ]a|cuenta bloqueada|je ne peux pas me connecter|mein passwort|passwort ist abgelaufen|cant access (cerner|meditech|epic|emr|ehr)|can.?t access (cerner|meditech|epic|emr|ehr)|(cerner|meditech|epic|emr|ehr) keeps logging me out|(cerner|meditech|epic) wont let me in|smartcard reader|badge tap|proximity card reader|\bsso\b not working)/.test(q) && !/\b(wifi|wi-fi|wireless|router|modem)\b/.test(q)) return 'password';
  // Bluetooth wireless audio before generic wifi (so 'wireless headset cutting out' hits bluetooth)
  // Printer-specific BEFORE wifi (so 'network printer' hits printer not wifi)
  if (/\b(network printer|wifi printer|wireless printer)\b/.test(q) || /print/.test(q)) return 'printer';
  if (/\b(wireless (headset|earbud|headphones?|mic)|bluetooth (headset|earbud|headphones?|mic))\b/.test(q)) return 'kb:bluetooth';
  if (/\b((hospital|ward|clinic|floor|building|site|campus|office|branch|plant|store|warehouse|department|unit|wing) network (down|outage|issue|problem)|network (outage|down) (on|in|at)|(ward|floor|site|building|campus|branch) (network )?outage)\b/.test(q)) return 'kb:networking';
  if (/(wifi|wi-fi|wireless|network|internet|limited connectivity|no internet|5\s*ghz|2\.4\s*ghz|router|modem|ssid|access point|wifi adapter|wifi card|wireless adapter)/.test(q)) return 'wifi';
  if (/print/.test(q)) return 'printer';
  // Printer trumps wifi (network printer)
  if (/\b(network printer|wifi printer|wireless printer)\b/.test(q)) return 'printer';

  // macOS BEFORE windows (so 'macbook won't boot' hits macOS not windows)
  if (/\b(macbook|imac|mac mini|mac pro|macos|kernel panic|beach ball)\b/.test(q)) return 'kb:macos';

  if (/\b(workstation on wheels|wow cart|mobile workstation|clinical cart computer|bedside (terminal|computer)|nursing station monitor|nurses station|barcode scanner|handheld scanner|medication scanner|wristband scanner|proximity reader|badge reader|rfid reader|docking station not (detecting|working (for|at))|video wall|ticker screen|turret phone|squawk box|large format plotter|kofax scanner|fujitsu scanner|scanning station|trading desk (monitor|pc|microphone)|trader workstation|market data terminal|bloomberg (keyboard|b-unit)|ups beeping|vital signs monitor|ecg workstation|ekg machine|bp machine not syncing|clinical keyboard|touchscreen not responding|touch monitor not working|hardware (fault|failure)|attorney workstation|trial presentation laptop|evidence scanning station|courtroom av)\b/.test(q)) return 'kb:hardware';
  // KB-only
  if (/(blue screen|bsod|stop error|wont boot|won'?t boot|spinning dots|stuck on boot|error 0x|0x000|bootloop|boot loop|keeps restarting|windows (won'?t|wont|will not) (start|boot|turn on)|windows update (broke|failed|failing|fails?)|cumulative update fail|feature update fail|servicing stack|startup repair loop|recovery mode loop|cannot activate windows|can'?t activate windows|windows activation (failed|issue))/.test(q)) return 'kb:windows';
  if (/(onedrive|sync(ing)? files?|files? wont sync|files? won'?t sync|file wont? sync|sync conflict|share with me|shared file wont sync|sync error|selective sync|files? on demand|onedrive (icon|prompt|password|stuck|paused|setup|over quota))/.test(q) || (/(shared (drive|server)|sharepoint|intranet files|folder (missing|gone|disappeared)|file (missing|disappeared) from shared|repository offline|files? not (syncing|accessible)|files? won ?.?t sync|files? won.r sync)/.test(q) && !/\b(edge|chrome|firefox|safari|brave|opera|browser)\b/.test(q) && !/(access denied|permission|acl|ntfs|denied)/.test(q) && !/(slow|slowly|lagging|taking (ages|forever|long))/.test(q))) return 'kb:onedrive';
  if (/(teams|team'?s not loading|teamz|teem(s)? (not|wont|won.t)|tems (not|wont)|microsoft teams|ms teams|teams meeting|teams chat|teams channel|teams call|cant see channels|can'?t see channels|teams cache|teams notifications|teams external guest|channels?\s+(missing|gone|empty)|cant join meeting|can'?t join meeting)/.test(q)) return 'kb:teams';
  if (/(mfa|multi[- ]factor|two.?factor|2fa|authenticator|sms code|text code|verification code|otp code|one[- ]time code|sms (not |never )?(arriving|coming|came)|text (not |never )?(arriving|coming|came)|six[- ]digit code|6[- ]digit code|verification not)/.test(q)) return 'kb:mfa';
  if (/(bluetooth|airpod|headphones?|headset|earbuds?|jabra|poly|plantronics|bose|sennheiser|sony wh|jbl|wireless headset|wireless earbud|headphone jack|headset jack|audio jack)/.test(q)) return 'kb:bluetooth';
  if (/(usb|external drive|flash drive|external ssd|external hard drive|seagate|sandisk|wd (my passport|elements)|usb-c (port|hub)|thunderbolt port|sd card|micro sd|memory card)/.test(q)) return 'kb:usb';
  if (/\b(edge|chrome|firefox|safari|brave|opera|browser)\b/.test(q) && !/\bopera pms\b/.test(q)) return 'kb:browser';
  if (/(slow|laggy|sluggish|performance|high cpu|cpu usage|ram usage|memory usage|memory leak|disk 100|disk at 100|antimalware service|svchost (high|using)|fans? (spin|spinning)|overheat(ing)?|laptop hot|laggy machine|slow (startup|shutdown|after)|takes forever to (boot|open|load|start)|task manager shows high|is lagging|lagging|hanging on|hangs on|hanging|unresponsive|timing out|times out constantly|response time (terrible|bad|slow)|taking (ages|forever|minutes|too long)|takes minutes|keeps buffering|pixelated and lagging|freezing on (batch|upload|large)|searches timing out|taking long to display|running hot|fan is spinning)/.test(q)) return 'kb:performance';
  if (/(kernel panic|beach ball|mac (won'?t|wont) (boot|start|shut|turn)|macbook (won'?t|wont)|spinning beach ball|mac freezes|macos slow|mac stuck on apple|imac (won'?t|wont)|macos update fail)/.test(q)) return 'kb:macos';
  if (/(dns|dhcp|ip address|ping (timeout|fail)|gateway unreachable|cannot resolve hostname|hostname not resolved|cant resolve hostname|can'?t resolve hostname|traceroute fail|tracert fail|route to host|arp issue|subnet mask|vlan|firewall (block|blocking)|port (closed|blocked)|can'?t reach internal|cannot reach internal|internal site (down|unreachable))/.test(q)) return 'kb:networking';
  if (/(file share|ntfs|shared folder|access denied|permission denied|denied permission|no access to (folder|file|share)|group missing permissions|permissions reset|acl issue|share permission|cant open folder|can'?t open folder|user can'?t open|cannot access folder|folder access)/.test(q)) return 'kb:permissions';
  if (/(active directory|\bad\b lockout|domain account locked|domain account|kerberos|krb5|ad authentication|ad replication|domain controller|dc replication)/.test(q)) return 'kb:active-directory';
  if (/(intune|conditional access|azure ad|m365 license|license activation|e3 license|e5 license|f3 license|business basic|business standard|business premium|enterprise mobility|emm|emt|tenant settings|m365 admin center|microsoft 365 admin|aad|entra(\s+id)?|user has no license|license (expired|assignment|missing|removed|added)|no license assigned|need to add.*license|deactivate user|provision user|new hire (account|license))/.test(q)) return 'kb:m365';
  // Onboarding BEFORE m365 (so 'deactivate user' routes here, not generic license)
  if (/(onboarding|offboarding|byod|new hire|employee leaving|bring your own device|deactivate (user|account)|provision user|new starter|departing employee|leaver process|joiner process|need to deactivate|new (nurse|clinician|doctor|physician|resident|staff|employee|user|hire|starter|technician|analyst|associate)( needs?| requires?| account| access| setup| set up)|onboarding new|needs? (epic|ehr|emr|cerner|meditech) access|set ?up (a |the )?new (user|account|staff))/.test(q)) return 'kb:onboarding';
  if (/\b(edge|chrome|firefox|safari|brave|opera|browser)\b/.test(q)) return 'kb:browser';

  if (/(ops|dashboard|operations|metrics)/.test(q)) return 'ops';
  if (/\b(talk to (it|live agent|agent|human|tech support|support|someone|a human|a person|a tech|a real person)|escalate|live agent|contact (it|support|tech)|i (want|need) (a |to talk to )?(human|person|real (person|human))|transfer me|connect me to|need a human|need to talk to (someone|a (person|human|tech)))\b/.test(q)) return 'escalation';
  if (/(help me find|i need help finding|i'?m stuck|im stuck|find (the |my )?recovery key)/.test(q)) return 'escalation';
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
  const NEG = /\b(not|n['’]?t|isn['’]?t|wasn['’]?t|aren['’]?t|don['’]?t|doesn['’]?t|didn['’]?t|cant|can['’]?t|won['’]?t|wouldn['’]?t|couldn['’]?t|never|nope|nah|negative|still\s+(broken|same|stuck|down|having|getting|happening|seeing|not|cant|can['’]?t)|broke\s+again|came\s+back|happening\s+again|back\s+to\s+(square|broken)|worse|worst)\b/;
  if (NEG.test(t)) {
    if (!/no (more|longer) (issues?|problems?|errors?|broken)|no\s+(issue|problem|error)\s+now|nothing\s+broken|not\s+broken\s+anymore/.test(t)) {
      return false;
    }
  }
  const POS_KEYWORDS = /\b(resolved?|solved?|solving|fixed|fixin|fixing|works?|worked|working|done|completed?|sorted|success(ful)?|perfect(ly)?|excellent|awesome|amazing|brilliant|fantastic|wonderful|cool|nice|sweet|sick|tight|smooth|clean|smashing|stellar|killer|lifesaver|slay|legit|fire|magic|magical|miracle|godsend|wizard|hero|legend|champ|champion|boss|guru|king|queen|mvp)\b/;
  const POS_PHRASES = /(all (good|set|sorted|done|fixed|right|cleared|clear|better|smooth|working)|that (did|fixed|worked|works|nailed|got|solved) it|that\s+was\s+it|problem (solved|fixed|gone|cleared|sorted)|issue (resolved|solved|fixed|gone|cleared|sorted)|good to go|back to normal|back (online|up|running)|up\s+and\s+running|fine now|ok(ay)? now|now (working|fine|good|fixed)|works (now|perfectly|great|fine|like a charm|like a champ)|fixed (now|it|the issue|the problem)|thanks?\s+(a\s+lot|so much|very much|alot|so|much)|much appreciated|appreciate (you|it|this|that|your help)|thank\s+you(\s+(very\s+much|so\s+much|kindly|sir|maam|ma['’]?am))?|got it (working|fixed|sorted)|10\s*\/\s*10|5\s*stars?|five\s*stars?|five\s*star|on\s+top|chefs?\s*kiss|chef['’]?s\s*kiss|gold\s*star|nailed it|crushed it|killed it|smashed it|cracked it|that\s+helped|this\s+helped|that\s+(was\s+)?perfect|much better|way better|good now|great now|cleared up|cleared it|sorted out|figured (it )?out|got\s+it|in\s+the\s+clear|squared\s+away|squared\s+up|wrapped\s+up|wrap\s+it\s+up|close\s+(this|it|the\s+ticket)|case\s+closed|ticket\s+(closed|done|resolved)|end\s+(of\s+)?call|im\s+good|i\s+am\s+good|we['’]?re\s+good|were\s+good|we\s+are\s+good|youre\s+(a\s+)?(star|legend|champ|lifesaver|the\s+best|amazing|incredible)|you\s+are\s+(a\s+)?(star|legend|champ|lifesaver|the\s+best|amazing|incredible)|that\s+took\s+care\s+of\s+it|did\s+the\s+trick|that['’]?s\s+(it|the\s+one|better|perfect|great)|easy|too\s+easy|piece\s+of\s+cake|cake\s+walk|painless|smooth\s+sailing)/;
  const SHORT_AFFIRMS = /^(\s*(yep|yup|yeah|yes|y|ya|ok|okay|k|kk|aye|aight|alright|nice|cool|sweet|sick|sure|cheers(\s+(mate|bro|man))?|cool|good|great|perfect|amazing|awesome|brilliant|done|fixed|solved|resolved|works|working|thx(\s+(a\s+lot|so\s+much|man|mate))?|thanks(\s+(a\s+lot|so\s+much|man|mate|bro))?|thanx|tysm|ty(\s+(so\s+much|a\s+lot|man|bro|mate|times))?|tia|tyvm|ily|appreciate(\s+it)?|grateful|gracias|merci|danke|salud|legend|legendary|kudos|w|win|gg|gjwp|gj|glhf|noted|copy|10\/10|5\/5|👌|👍|🙏|💯|🔥|✅|✔️|✓|🏆|🌟|⭐)+\s*[!.]*\s*)+$/;
  return POS_KEYWORDS.test(t) || POS_PHRASES.test(t) || SHORT_AFFIRMS.test(t);
}

module.exports = { classify, looksLikeResolution };
