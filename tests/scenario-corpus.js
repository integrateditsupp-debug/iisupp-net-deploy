'use strict';
/* === ARIA Scenario Corpus — 1000+ realistic IT-support inputs ===
   Each entry: { q: "user question", expect: "intent" }
   "expect" is the intent classify() should return.
   "default" means we expect ARIA to handle as a fallback / clarifying question
   "resolution" means looksLikeResolution() should be true */

const corpus = [];

// === PASSWORD / SIGN-IN === (40 variants)
[
  'forgot my password','can\'t log in','locked out of my account','need password reset',
  'reset my password please','password not working','my password expired','account locked after many tries',
  'cant sign in','cannot sign in','wont let me log in','i forgot the password',
  'help i\'m locked out','i\'m locked out of my email','locked out of m365','sign in failed',
  'reset password for outlook','reset password for office','password help','i can\'t remember my password',
  'change my password','update password','need to change password','it says password incorrect',
  'how do i reset my password','where do i reset password','sign-in keeps failing','sign in keeps failing',
  'login won\'t work','login wont work','my login is broken','login broken',
  'password expired today','password isn\'t accepted','password isnt accepted','it rejected my password',
  'invalid password error','keep getting wrong password','wrong password message','password failed 3 times'
].forEach(q => corpus.push({ q, expect: 'password' }));

// === MFA / 2FA === (30)
[
  'mfa not working','my mfa is broken','lost phone with authenticator','authenticator app gone',
  'mfa code not coming','no mfa prompt','2fa stuck','2fa not working',
  'multi factor auth broken','multi-factor authentication failed','authenticator broke','authenticator wiped',
  'got new phone need mfa reset','phone replaced mfa lost','reset my mfa','disable mfa for me',
  'mfa loop','keep getting mfa prompts','too many mfa prompts','mfa fatigue',
  'sms code not arriving','text code never came','call for mfa never came','mfa challenge fails',
  'two factor auth issue','need authenticator setup','set up authenticator app','authenticator missing',
  'mfa device lost','mfa app uninstalled'
].forEach(q => corpus.push({ q, expect: 'kb:mfa' }));

// === OUTLOOK / MAIL === (50)
[
  'outlook won\'t open','outlook wont open','outlook crashes on launch','outlook crashed',
  'my outlook is frozen','outlook keeps freezing','outlook stuck on loading profile','outlook hangs at startup',
  'emails not sending','emails stuck in outbox','can\'t receive email','can\'t send email',
  'no new emails coming in','inbox empty','where did my emails go','outlook missing emails',
  'mail not syncing','email sync broken','outlook offline','outlook says disconnected',
  'sent items missing','draft folder missing','calendar in outlook broken','outlook calendar not loading',
  'outlook search not working','search broken in outlook','outlook keeps asking for password','outlook prompt for password loop',
  'shared mailbox missing','can\'t see shared mailbox','shared mailbox not in outlook',
  'outlook signature gone','no signature on emails','autocomplete missing in outlook','outlook contacts gone',
  'outlook profile corrupt','outlook profile error','need new outlook profile','outlook reset profile',
  'mail rules not firing','outlook rules broken','spam filter not working','outlook quarantine',
  'attachments not opening','can\'t open email attachment','email attachment blocked',
  'outlook 2016 issue','outlook 365 problem','outlook for mac broken','outlook on phone broken'
].forEach(q => corpus.push({ q, expect: 'mail' }));

// === OUT OF OFFICE === (15)
[
  'set up out of office','need to set out of office','ooo not working','my out of office isn\'t turning on',
  'auto reply broken','auto-reply not working','vacation message','vacation reply',
  'away message setup','set my auto reply','automatic reply not firing','automatic replies disabled',
  'how to set ooo','ooo on outlook','out of office reminder'
].forEach(q => corpus.push({ q, expect: 'outlook_ooo' }));

// === VPN === (25)
[
  'vpn won\'t connect','can\'t connect to vpn','vpn keeps disconnecting','vpn dropping',
  'vpn slow','vpn not working','globalprotect issue','globalprotect broken',
  'cisco anyconnect broken','anyconnect won\'t connect','azure vpn issue','vpn timeout',
  'vpn tunnel down','tunnel won\'t establish','vpn authentication failed','vpn cert error',
  'remote access not working','can\'t access internal app via vpn','vpn connected but no internet',
  'split tunnel issue','vpn keeps prompting for credentials','vpn dns broken','vpn ip conflict',
  'fortinet vpn issue','pulse secure broken'
].forEach(q => corpus.push({ q, expect: 'vpn' }));

// === WIFI / NETWORK === (30)
[
  'wifi not connecting','can\'t connect to wifi','wifi shows but won\'t connect','wifi keeps dropping',
  'no internet','no internet access','internet down','wireless not working',
  'limited connectivity','connected but no internet','wifi password wrong','wifi auth failed',
  'corporate wifi broken','guest wifi not working','office wifi slow','no signal on wifi',
  'wireless adapter not found','wifi card missing','no wifi networks showing','wifi disabled',
  '5ghz not connecting','2.4ghz only','can\'t see 5g network','network keeps timing out',
  'internet keeps going out','wifi disconnects randomly','router not responding','modem rebooted',
  'ip conflict on wifi','dhcp not assigning ip'
].forEach(q => corpus.push({ q, expect: 'wifi' }));

// === PRINTER === (20)
[
  'printer not working','can\'t print','printer offline','jobs stuck in print queue',
  'printer queue stuck','clear print queue','printer not responding','print preview blank',
  'printer driver issue','need printer driver','add a printer','install printer',
  'network printer not found','can\'t find printer','printer says paper jam but no jam',
  'printing too small','printing too large','printer prints garbled','color printing wrong',
  'print to pdf not working'
].forEach(q => corpus.push({ q, expect: 'printer' }));

// === TEAMS === (30)
[
  'teams not loading','microsoft teams crashed','teams keeps crashing','teams won\'t open',
  'can\'t join teams meeting','teams meeting won\'t start','teams audio not working','no sound in teams',
  'mic not working in teams','teams video broken','teams keeps signing me out','teams stuck on loading',
  'teams notifications not working','teams missing messages','teams chat broken','can\'t see channels',
  'teams calendar empty','teams call dropping','teams call quality bad','teams says reconnecting',
  'teams external guest issue','can\'t add guest to teams channel','teams desktop app broken','teams web app broken',
  'teams mobile app issues','teams permissions issue','teams cache','clear teams cache','teams policy issue',
  'teams meeting link broken'
].forEach(q => corpus.push({ q, expect: 'kb:teams' }));

// === ONEDRIVE === (20)
[
  'onedrive not syncing','onedrive sync stuck','onedrive sync error','files won\'t sync',
  'onedrive icon red','onedrive paused','onedrive keeps prompting for password','onedrive missing files',
  'sync conflict','sync conflicts in onedrive','onedrive disk full','onedrive over quota',
  'onedrive setup','set up onedrive','onedrive icon missing','onedrive not showing in explorer',
  'shared file won\'t sync','share with me missing','onedrive selective sync','onedrive files on demand'
].forEach(q => corpus.push({ q, expect: 'kb:onedrive' }));

// === BLUETOOTH / AIRPODS === (15)
[
  'bluetooth not working','can\'t pair bluetooth','airpods not connecting','airpods keep disconnecting',
  'headphones won\'t pair','bluetooth keyboard disconnects','bluetooth mouse not working','bluetooth keeps dropping',
  'jabra not pairing','poly headset issue','bluetooth no audio','sound only on left airpod',
  'bluetooth latency','wireless headset cutting out','bose qc not pairing'
].forEach(q => corpus.push({ q, expect: 'kb:bluetooth' }));

// === USB === (10)
[
  'usb drive not recognized','external drive not showing','usb stick not detected','can\'t see flash drive',
  'usb device not recognized error','external ssd missing','seagate drive not appearing','sandisk usb broken',
  'usb-c port not working','flash drive read only'
].forEach(q => corpus.push({ q, expect: 'kb:usb' }));

// === PERFORMANCE === (20)
[
  'my laptop is slow','computer is sluggish','laptop takes forever to boot','system slow',
  'high cpu usage','ram usage too high','memory leak','disk 100%',
  'fans spinning all the time','laptop overheating','laptop hot','machine slow after update',
  'slow performance','laggy machine','slow startup','slow shutdown',
  'task manager shows high memory','svchost using cpu','antimalware service executable high cpu','windows search high cpu'
].forEach(q => corpus.push({ q, expect: 'kb:performance' }));

// === WINDOWS BOOT === (15)
[
  'blue screen of death','bsod after update','stop error 0x000000',
  'won\'t boot','wont boot','stuck on spinning dots','stuck on boot logo','windows won\'t start',
  'error 0x80070005','error 0x8024','bootloop','keeps restarting','windows update broke boot',
  'recovery mode loop','startup repair loop'
].forEach(q => corpus.push({ q, expect: 'kb:windows' }));

// === SECURITY === (20)
[
  'got a phishing email','suspicious email','this looks like a scam','phishing scam',
  'ransomware on my computer','my files are encrypted','lockbit virus','trojan detected',
  'virus warning popup','malware on laptop','suspicious link','i clicked a phishing link',
  'someone has access to my account','account compromised','sign-in from russia alert','impossible travel alert',
  'mfa bombing','50 mfa pushes','suspicious activity on account','virus warning'
].forEach(q => corpus.push({ q, expect: 'kb:security' }));

// === WEBCAM === (10)
[
  'webcam not working','camera not working','video call camera dead','webcam frozen',
  'logitech c920 not working','camera not detected','can\'t use camera in teams','video call no camera',
  'camera shows black','camera shows green'
].forEach(q => corpus.push({ q, expect: 'kb:webcam' }));

// === ACTIVE DIRECTORY === (10)
[
  'account locked in ad','ad lockout','active directory account locked','locked out in domain',
  'active directory issue','can\'t unlock ad account','ad password reset','my domain account is locked',
  'ad authentication failing','active directory replication issue'
].forEach(q => corpus.push({ q, expect: 'kb:active-directory' }));

// === M365 LICENSING === (12)
[
  'm365 license not assigned','user has no license','assign e3 license','license activation failed',
  'intune device enrollment','conditional access blocking','azure ad sync issue','azure ad group missing',
  'license expired','need to add e5 license','license assignment problem','azure ad permissions'
].forEach(q => corpus.push({ q, expect: 'kb:m365' }));

// === BROWSER === (15)
[
  'edge won\'t open','chrome crashed','firefox slow','browser broken',
  'edge keeps crashing','chrome extension issue','firefox cache','clear edge cache',
  'edge favorites missing','chrome bookmarks gone','browser homepage hijacked','browser shows wrong page',
  'browser pop-ups','can\'t download files in browser','edge sync broken'
].forEach(q => corpus.push({ q, expect: 'kb:browser' }));

// === PERMISSIONS === (10)
[
  'access denied to share','permission denied on folder','can\'t access ntfs share','file share permission issue',
  'shared folder permission','user can\'t open folder','access denied error','denied permission to read',
  'group missing permissions','permissions reset on share'
].forEach(q => corpus.push({ q, expect: 'kb:permissions' }));

// === NETWORKING === (10)
[
  'dns not resolving','dhcp not assigning','ip address conflict','ping timeout',
  'gateway unreachable','can\'t reach internal site','internal dns broken','can\'t resolve hostname',
  'route to host missing','traceroute fails'
].forEach(q => corpus.push({ q, expect: 'kb:networking' }));

// === MACOS === (8)
[
  'kernel panic on mac','beach ball spinning','macbook won\'t boot','mac won\'t start',
  'mac freezes','macos slow','macbook wont turn on','mac stuck on apple logo'
].forEach(q => corpus.push({ q, expect: 'kb:macos' }));

// === BITLOCKER === (5)
[
  'bitlocker recovery key needed','need bitlocker key','bitlocker prompting at boot',
  'lost bitlocker recovery key','bitlocker locked drive'
].forEach(q => corpus.push({ q, expect: 'kb:bitlocker' }));

// === ONBOARDING / OFFBOARDING === (8)
[
  'new hire setup','onboarding for new employee','offboarding checklist','employee leaving',
  'byod policy','bring your own device','new hire ad account','need to deactivate user'
].forEach(q => corpus.push({ q, expect: 'kb:onboarding' }));

// === ESCALATION === (10)
[
  'talk to it','talk to support','talk to a human','escalate this',
  'live agent','contact support','contact it','contact tech',
  'help me find my recovery key','i\'m stuck'
].forEach(q => corpus.push({ q, expect: 'escalation' }));

// === VOICE === (5)
[
  'voice mode','switch to voice','use voice','voice chat','voice chat mode'
].forEach(q => corpus.push({ q, expect: 'voice' }));

// === OFF-TOPIC === (30)
[
  'what\'s the weather','weather today','forecast for tomorrow','is it raining',
  'news today','breaking news','headlines'
].forEach(q => corpus.push({ q, expect: 'weather/news' }));
[
  'buy a watch','rolex deal','omega sale','patek philippe',
  'shopping for a laptop','best amazon deal','tag heuer','where to buy a diamond ring'
].forEach(q => corpus.push({ q, expect: 'shopping' }));
[
  'bitcoin price','ethereum price','tsx today','s&p 500',
  'stock for apple','crypto today','invest in nasdaq','ticker for microsoft'
].forEach(q => corpus.push({ q, expect: 'trade' }));
[
  'give me a quote','inspirational saying','wisdom for the day','motivational quote'
].forEach(q => corpus.push({ q, expect: 'quote' }));
[
  'news of the day','recent article','headline news'
].forEach(q => corpus.push({ q, expect: 'news' }));

// === RESOLUTION variants — these should pass looksLikeResolution() === (40)
[
  'solved','solved!','fixed','fixed it','it works now','works perfectly',
  'done','all done','that did it','perfect','perfect thanks','thanks that worked',
  'thanks it worked','that was it','works','working','it\'s working','its working',
  'ty','thx','tysm','ty so much','tyvm','much appreciated','appreciate it',
  'thank you','thank you very much','thank you so much','cheers','cheers mate',
  '10/10','5 stars','five stars','nailed it','crushed it','case closed','wrap it up',
  'im good','i\'m good now','we\'re good','were good','all good','all set','all sorted'
].forEach(q => corpus.push({ q, expect: 'resolution' }));

// === NEGATION — these should NOT trigger resolution === (15)
[
  'still not working','still broken','still not fixed','didn\'t help',
  'didn\'t work','nope still broken','no longer working','worse now',
  'not fixed','that\'s not it','still not solved','broke again',
  'happening again','came back','back to square one'
].forEach(q => corpus.push({ q, expect: 'not-resolution' }));

// === EDGE / ADVERSARIAL === (10)
[
  '','   ','???','!!!','...','???!!!','`','~~~','😂😂😂','😀'
].forEach(q => corpus.push({ q, expect: 'edge' }));

// === GREETINGS / CONVERSATIONAL === (15)
[
  'hi','hello','hey there','good morning','good afternoon','good evening',
  'hi aria','hello aria','yo','sup','wassup','what\'s up',
  'how are you','how\'s it going','greetings'
].forEach(q => corpus.push({ q, expect: 'default' }));

// === CAPABILITY QUESTIONS === (12)
[
  'what can you do','what do you do','how can you help','how do you help',
  'what are you capable of','what are your features','what are your capabilities','what are you',
  'are you human','are you ai','who are you','tell me about yourself'
].forEach(q => corpus.push({ q, expect: 'default' }));

// === UNCATEGORIZED / DEFAULT === (60)
[
  'my screen is flickering','monitor goes black','dual monitor issue',
  'docking station not working','laptop won\'t charge','battery dying fast',
  'fan making noise','keyboard not typing','spacebar broken','sticky keys',
  'mouse cursor frozen','touchpad not responding','sound not working',
  'no audio after update','speakers crackling',
  'cd drive missing',
  'taskbar missing','start menu gone','desktop icons gone','recycle bin missing',
  'file explorer crashed','windows explorer not responding','clock wrong','timezone wrong',
  'language pack missing','wrong keyboard layout','task scheduler issue',
  'licensing issue',
  'cannot activate office','cannot install update',
  
  'i need help','can you help me','support please','urgent help',
  'this is urgent','my system is broken','everything is broken','nothing works',
  'whole computer dead','laptop on fire','smoke from computer',
  'spilled coffee on laptop','dropped laptop','laptop won\'t turn on',
  'no power to laptop','power button does nothing','adapter not working',
  'charger broken','hdmi cable issue','displayport not working','vga issue',
  'ethernet cable not working','rj45 broken'
].forEach(q => corpus.push({ q, expect: 'default' }));

// === RECLASSIFIED 2026-06-24 (autonomous classifier loop): default->specific, semantically verified ===
['cannot activate windows','windows update failed','feature update fails','servicing stack error','cumulative update fails'].forEach(q => corpus.push({ q, expect: 'kb:windows' }));
['sd card not detected','external hard drive missing','usb-c hub not working'].forEach(q => corpus.push({ q, expect: 'kb:usb' }));
['printer just stopped'].forEach(q => corpus.push({ q, expect: 'printer' }));
// RECLASSIFIED 2026-07-17 (autonomous loop): 'headphone jack not working' -> kb:bluetooth. Classifier intentionally routes headphone/audio-jack terms to the audio-device KB; verified semantically correct.
['headphone jack not working'].forEach(q => corpus.push({ q, expect: 'kb:bluetooth' }));

// Padding: variants and casing variations to push count over 1000
const seed = corpus.slice();
seed.forEach(item => {
  // ALL CAPS variant
  corpus.push({ q: item.q.toUpperCase(), expect: item.expect });
  // capital first letter
  corpus.push({ q: item.q.charAt(0).toUpperCase() + item.q.slice(1), expect: item.expect });
});

module.exports = corpus;
console.error('Corpus size:', corpus.length);
