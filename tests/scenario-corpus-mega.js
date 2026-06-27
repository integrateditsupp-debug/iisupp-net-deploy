'use strict';
/* === ARIA Mega Scenario Generator — target 150K+ ===
   Compositional explosion across:
     - 30 industries (vertical-specific apps + jargon)
     - 8 personas (vocabulary + tone)
     - 10 OS contexts
     - 4 severity tiers
     - 200+ commonly-supported apps
     - case + politeness + urgency + suffix + typo variants
*/

const base = require('./scenario-corpus');  // 1,896 hand-curated
const out = [];

// Helper to push a scenario
const push = (q, expect) => out.push({ q, expect });

// ============ TIER 1: All base scenarios + their case/prefix/suffix/typo explosion
// (already done by scenario-corpus-10k.js, but we want it here too)
const PREFIX_POLITE = ['please ', 'can you help with ', 'i need help with ', 'help me with ', 'sorry but ', 'quick question — ', 'hey ', 'urgent: ', 'fyi ', 'btw '];
const PREFIX_URGENT = ['urgent ', 'asap ', 'p1: ', 'critical: ', 'now: ', 'this is blocking me — ', 'losing time on '];
const SUFFIX = ['', ' please', ' thanks', ' asap', ' urgent', '?', '!', '!!', '...', ' :(', ' help', ' need help'];
const TYPOS = {
  "won't": ['wont', 'won t', "won'r", 'woont'],
  "can't": ['cant', 'can t', "can;t", "cantt"],
  'outlook': ['outlok', 'outlokk', 'outloook', 'outlook365', 'outluk'],
  'password': ['pasword', 'passw0rd', 'pasworld', 'passwrd'],
  'wifi': ['wifii', 'wfi', 'wifi-', 'wi fi'],
  'email': ['emial', 'eamil', 'email\'s', 'e-mail'],
  'teams': ["team's", 'teamz', 'teem', 'ms teams', 'msteams'],
  'sharepoint': ['share point', 'spo', 'share-point'],
  'onedrive': ['one drive', 'one-drive', 'on drive'],
};

base.forEach(item => {
  if (item.expect === 'edge') return;
  // case variants
  push(item.q, item.expect);
  push(item.q.toUpperCase(), item.expect);
  push(item.q.charAt(0).toUpperCase() + item.q.slice(1), item.expect);
  // prefix variants
  PREFIX_POLITE.forEach(p => push(p + item.q, item.expect));
  PREFIX_URGENT.forEach(p => push(p + item.q, item.expect));
  // suffix variants
  SUFFIX.slice(1, 6).forEach(s => push(item.q + s, item.expect));
  // typo variants
  for (const [orig, typos] of Object.entries(TYPOS)) {
    if (item.q.includes(orig)) {
      typos.forEach(t => push(item.q.replace(orig, t), item.expect));
    }
  }
});

// ============ TIER 2: INDUSTRY-SPECIFIC SCENARIOS ============
// For each industry, common app + scenario combinations
const INDUSTRY_SCENARIOS = {
  healthcare: {
    apps: ['epic','cerner','meditech','allscripts','athenahealth','nextgen','ecw','emr','ehr','patient portal','dragon medical','mychart','clinical workstation'],
    scenarios: [
      'wont open','crashes on launch','wont sync','frozen','license expired','wont print',
      'login failed','slow performance','wont save','wont load patient chart','missing patient data',
      'document missing','image wont upload','wont submit order','wont sign','wont send fax'
    ]
  },
  finance: {
    apps: ['bloomberg terminal','reuters eikon','factset','murex','calypso','front arena','sap','oracle financials','sas','tradeweb','marketaxess','fix gateway','reuters trading','bloomberg messenger','salesforce financial'],
    scenarios: ['wont connect','market data missing','feed broken','trade wont execute','order rejected','price not refreshing','wont login','license issue','frozen','slow','wont export','wont print confirm']
  },
  legal: {
    apps: ['imanage','netdocuments','worldox','clio','mylegalpractice','lexisnexis','westlaw','time matters','prolaw','tabs3','elite 3e','intapp'],
    scenarios: ['wont save document','version conflict','check-in failed','wont open','search broken','metadata stripped','privilege error','redaction broken','wont billed','time entry missing','client matter not found']
  },
  government: {
    apps: ['cac card','piv card','sipr','niprnet','sf86','dod cac reader','smartcard','ahce','vits','rms','tigris'],
    scenarios: ['card not recognized','wont read smart card','sipr down','niprnet slow','classified terminal locked','wont login with cac','clearance issue','cac certificate expired','vpn to sipr broken']
  },
  manufacturing: {
    apps: ['sap mes','sap erp','siemens nx','autodesk inventor','solidworks','plm','dassault','mastercam','plc','scada','wonderware','ignition','rockwell'],
    scenarios: ['wont open drawing','license server down','plm wont check in','plc wont communicate','scada lost connection','operator screen frozen','wont publish drawing','revision conflict']
  },
  retail: {
    apps: ['pos','shopify pos','square pos','clover','lightspeed','vend','toast','aloha pos','revel','heartland','catapult'],
    scenarios: ['pos wont open','card reader broken','register frozen','wont print receipt','inventory wrong','price not updating','wont sync','wont take payment','cash drawer stuck']
  },
  hospitality: {
    apps: ['opera pms','protel','mews','cloudbeds','hotelogix','quickbooks pos','revel','square','toast pos','aloha pos','silverware','oracle micros'],
    scenarios: ['pms wont load','reservation wont save','wont check in guest','wont print folio','rate code wrong','room status wrong','interface down','pms slow']
  },
  realestate: {
    apps: ['yardi','appfolio','mri software','realpage','propertyware','rentmanager','dotloop','docusign','salesforce real estate','mls'],
    scenarios: ['mls wont login','listing wont save','docusign wont send','tenant portal down','rent payment failed','accounting wont post','wont generate report']
  },
  construction: {
    apps: ['procore','autodesk construction cloud','plangrid','bluebeam revu','primavera','revit','autocad','sage 300 cre','viewpoint vista','sketchup'],
    scenarios: ['drawing wont open','revit crashes','plangrid wont sync','wont upload submittal','rfi wont save','daily log missing','wont publish schedule','bluebeam stamp missing']
  },
  energy: {
    apps: ['osi pi','aveva pi','wonderware','rockwell factorytalk','ge cimplicity','siemens wincc','schneider citect','sap pm'],
    scenarios: ['historian wont log','hmi frozen','plc disconnected','tag wont update','trend chart wont load','alarm not coming through','wont write to controller']
  },
  transport: {
    apps: ['fleetmatics','geotab','samsara','verizon connect','mcleod loadmaster','tmw','dat','truckmate','wms','manhattan wms'],
    scenarios: ['gps not updating','eld wont login','driver app wont sync','dispatch wont save load','wont scan barcode','wont upload pod','rate confirmation wont send']
  },
  pharma: {
    apps: ['veeva vault','sap','oracle clinical','medidata rave','inform','cdms','lims','sample tracker','rave edc','spotfire'],
    scenarios: ['vault wont load','edc wont save','crf wont submit','query wont resolve','data wont lock','wont sign for','audit trail missing','protocol amendment wont propagate']
  },
  media: {
    apps: ['adobe premiere','final cut','avid media composer','davinci resolve','after effects','protools','logic pro','cubase','wirecast','obs studio'],
    scenarios: ['premiere crashes','wont render','project wont open','media offline','transcode failed','wont export','audio out of sync','plugin missing','crash on launch','project corrupt']
  },
  tech: {
    apps: ['jira','confluence','bitbucket','github','gitlab','azure devops','jenkins','docker','kubernetes','aws console','gcp console','azure portal','vscode','intellij','pycharm','postman','swagger','datadog','newrelic','sentry'],
    scenarios: ['wont push to repo','build broke','pipeline failed','pod wont start','container crash','image wont pull','wont login to cloud console','iam policy denied','deploy failed','rollback needed']
  },
  professional: {
    apps: ['quickbooks','xero','sage 50','wave','freshbooks','salesforce','hubspot','asana','monday','trello','clickup','notion','airtable','dropbox','box'],
    scenarios: ['wont sync transactions','reconciliation wont save','invoice wont send','wont post journal entry','wont create task','attachment wont upload','board wont load']
  },
  education: {
    apps: ['canvas','blackboard','moodle','d2l brightspace','schoology','google classroom','clever','classlink','powerschool','infinite campus','synergy','aspen','skyward'],
    scenarios: ['student wont login','grade wont save','wont submit assignment','quiz wont load','sis wont sync','attendance wont post','transcript wont generate','parent portal down']
  },
  nonprofit: {
    apps: ['salesforce npsp','blackbaud raisers edge','blackbaud crm','donorperfect','bloomerang','little green light','quickbooks nonprofit','classy','givelively','networkforgood'],
    scenarios: ['donation wont post','donor record duplicate','wont generate receipt','export to quickbooks failed','wont segment list','campaign report missing','gift entry stuck']
  },
  agriculture: {
    apps: ['climate fieldview','agleader sms','john deere operations center','trimble ag','farm logs','granular','agworld','conservis'],
    scenarios: ['gps not connecting','field map wont load','planting data wont sync','wont upload yield','irrigation controller offline','sensor wont report']
  },
  insurance: {
    apps: ['guidewire','duck creek','vlocity','salesforce insurance','applied epic','aim','xanadu','sapiens'],
    scenarios: ['policy wont issue','claim wont submit','rating engine slow','wont calculate premium','underwriter queue stuck','wont generate quote']
  },
  hr: {
    apps: ['workday','ultipro','adp workforce','bamboohr','greenhouse','lever','linkedin recruiter','sap successfactors','peoplesoft','dayforce'],
    scenarios: ['payroll wont run','wont approve timesheet','expense wont submit','employee wont onboard','benefits wont enroll','offer letter wont send','performance review stuck']
  },
  emergency: {
    apps: ['cad system','rms','aegis cad','tritech','intergraph','motorola cad','priority dispatch','pulsepoint','prodigy','mobile data terminal'],
    scenarios: ['cad system down','mdt wont sync','priority not dispatching','license plate lookup failed','wont log into mobile','radio interface broken']
  },
  defense: {
    apps: ['jpas','difms','dts','jtims','mark logic','accumulo','palantir','distributed common ground','dcgs'],
    scenarios: ['jpas wont load','clearance verification stuck','classified terminal locked','wont access sipr from base','dts approval stuck','travel order wont sign']
  },
  aerospace: {
    apps: ['catia','siemens nx','plm','windchill','enovia','smarteam','solidworks','ansys','simulia','star-ccm'],
    scenarios: ['catia wont open','license server down','plm checkout failed','wont save assembly','simulation wont solve','mesh wont generate','wont publish to plm']
  },
  automotive: {
    apps: ['dealersocket','reynolds and reynolds','cdk drive','autosoft','dominion dms','vinsolutions','xtime','cox automotive'],
    scenarios: ['dms wont load','wont post deal','wont print finance contract','parts wont order','wont schedule service appointment']
  },
  mining: {
    apps: ['surpac','vulcan','minesight','datamine','leapfrog geo','jigsaw','wenco','modular mining'],
    scenarios: ['geological model wont open','dispatch system slow','haul truck wont report','license check failed','wont sync to fleet']
  },
  chemical: {
    apps: ['aspen plus','chemcad','pro ii','hysys','aspen tech','sap process','simatic pcs7','delta v'],
    scenarios: ['simulation wont converge','wont open flowsheet','license issue','batch recipe wont save','plant historian missing data','wont post mes order']
  },
  food: {
    apps: ['plex erp','sage 100','aptean','sap food','infor m3','navision food','dynaway','quickbooks pos','toast','aloha'],
    scenarios: ['wont post production','recipe wont save','lot trace missing','wont print label','allergens not flagged','inventory miscount','wont sync to register']
  },
  sports: {
    apps: ['hudl','dartfish','sportscode','synergy sports','statcast','catapult','garmin connect','strava for business','training peaks','firstbeat'],
    scenarios: ['hudl wont load video','wont upload film','tag wont save','wont sync to wearable','heart rate not coming through','wont export workout']
  },
  arts: {
    apps: ['artsystems','artwork archive','collectorsystems','tessitura','choice ticketing','spektrix','blackbaud altru','siriusware'],
    scenarios: ['artwork wont catalog','ticket wont print','seat wont release','wont scan barcode','membership wont renew','donor record duplicate']
  },
  religious: {
    apps: ['planning center','breeze chms','elexio','servant keeper','realm','aplos','txt2give','easy tithe'],
    scenarios: ['cant send giving statement','wont schedule volunteer','small group wont save','member wont merge','attendance wont log']
  },
};

const PERSONAS = [
  { tag: '', tone: '' },                                       // default
  { tag: 'as an admin, ', tone: 'admin' },
  { tag: 'as a senior admin, ', tone: 'senior_admin' },
  { tag: 'i\'m a developer, ', tone: 'developer' },
  { tag: 'i\'m on the security team, ', tone: 'security' },
  { tag: 'i\'m a compliance officer, ', tone: 'compliance' },
  { tag: 'as a c-suite exec, ', tone: 'exec' },
];

const OS_CONTEXTS = ['on windows 11', 'on windows 10', 'on macos', 'on macbook', 'on ipad', 'on iphone', 'on android', 'on chromebook', 'on linux', 'on server 2022'];

const SEVERITY = ['', ' — urgent', ' — production down', ' — affects 50 users', ' — single user', ' — partial outage', ' — losing money'];

// Generate industry scenarios
let industryCount = 0;
for (const [industry, def] of Object.entries(INDUSTRY_SCENARIOS)) {
  def.apps.forEach(app => {
    def.scenarios.forEach(sc => {
      // Base: "app + scenario"
      const q = app + ' ' + sc;
      // Map to closest intent
      let intent = 'default';
      if (/(mail|outlook|email|inbox)/.test(app)) intent = 'mail';
      else if (/(teams)/.test(app)) intent = 'kb:teams';
      else if (/(onedrive|sharepoint)/.test(app)) intent = 'kb:onedrive';
      else if (/(vpn|anyconnect|globalprotect|fortinet)/.test(app)) intent = 'vpn';
      else if (/(license|m365|azure|entra|intune)/.test(app)) intent = 'kb:m365';
      else if (/(login|password|cac|smart card)/.test(sc)) intent = 'password';
      else if (/(print|printer)/.test(sc)) intent = 'printer';
      else if (/wont/.test(sc)) intent = 'default';
      push(q, intent);
      industryCount++;
      // persona variants
      PERSONAS.forEach(p => {
        if (p.tag) push(p.tag + q, intent);
      });
      // os variants
      OS_CONTEXTS.slice(0, 3).forEach(o => push(q + ' ' + o, intent));
      // severity variants
      SEVERITY.slice(1, 4).forEach(s => push(q + s, intent));
    });
  });
}

// ============ TIER 3: HARDWARE VENDOR SCENARIOS ============
const HARDWARE_VENDORS = ['dell','hp','lenovo','apple','microsoft surface','asus','acer','razer','framework','lg','samsung','panasonic','toshiba','msi','cyberpower','origin','alienware'];
const HARDWARE_PROBLEMS = ['wont turn on','wont charge','battery dying','fan loud','screen black','screen flicker','keyboard not working','touchpad dead','speakers dead','overheating','hard drive crash','ssd failed','bios stuck','no display','random shutdown','blue screen','frozen','wifi card dead','bluetooth dead','webcam dead','docking station issue','thunderbolt port broken','usb-c not working','hdmi port broken'];

// Each hardware problem now routes to its TRUE intent (2026-06-27 — kb:hardware triage added to classify();
// the old blanket 'default' meant "no route existed"). Physical faults → kb:hardware; the rest to their topic.
const HW_INTENT = {
  'wont turn on':'kb:hardware','wont charge':'kb:hardware','battery dying':'kb:hardware','fan loud':'kb:hardware',
  'screen black':'kb:hardware','screen flicker':'kb:hardware','keyboard not working':'kb:hardware','touchpad dead':'kb:hardware',
  'speakers dead':'kb:hardware','overheating':'kb:performance','hard drive crash':'kb:hardware','ssd failed':'kb:hardware',
  'bios stuck':'kb:hardware','no display':'kb:hardware','random shutdown':'kb:hardware','blue screen':'kb:windows',
  'frozen':'default','wifi card dead':'wifi','bluetooth dead':'kb:bluetooth','webcam dead':'kb:webcam',
  'docking station issue':'kb:hardware','thunderbolt port broken':'kb:usb','usb-c not working':'kb:usb','hdmi port broken':'kb:hardware',
};
HARDWARE_VENDORS.forEach(vendor => {
  HARDWARE_PROBLEMS.forEach(prob => {
    const it = HW_INTENT[prob] || 'default';
    push(vendor + ' laptop ' + prob, it);
    push(vendor + ' desktop ' + prob, it);
    PERSONAS.slice(0, 3).forEach(p => p.tag && push(p.tag + vendor + ' laptop ' + prob, it));
  });
});

// ============ TIER 4: PRINTER VENDORS ============
const PRINTER_VENDORS = ['hp','canon','brother','epson','lexmark','xerox','ricoh','konica minolta','sharp','kyocera','oki','dell'];
const PRINTER_ISSUES = ['wont print','prints blank pages','prints garbled','paper jam','toner out','drum error','out of paper','color wrong','prints too small','prints too big','wont scan','duplex broken','wont connect over wifi','wont print over network','offline','queue stuck'];
PRINTER_VENDORS.forEach(v => PRINTER_ISSUES.forEach(i => push(v + ' printer ' + i, 'printer')));

// ============ TIER 5: NETWORKING GEAR ============
const NETWORK_VENDORS = ['cisco','juniper','aruba','meraki','ubiquiti','netgear','tp-link','fortinet','sonicwall','palo alto'];
const NETWORK_ISSUES = ['switch port down','vlan not tagged','routing loop','spanning tree blocking','poe not delivering','firmware stuck','access point offline','ssid not broadcasting','client cant associate','wifi 6 wont negotiate'];
NETWORK_VENDORS.forEach(v => NETWORK_ISSUES.forEach(i => push(v + ' ' + i, 'kb:networking')));

// ============ TIER 6: LANGUAGE VARIANTS (top scenarios, EN→FR/AR/ES quick gloss) ============
// We don't have actual translation but we add a "in french:" prefix so the classifier
// at least sees that the user has switched language context.
['can you respond in french','responde en español','translate this','en français svp','en arabe svp'].forEach(p => {
  base.slice(0, 50).forEach(item => push(p + ' — ' + item.q, item.expect));
});

console.error('MEGA Corpus size:', out.length);

// ============ TIER 7: MEGA EXPLOSION — case/prefix on entire current corpus ============
const snapshot = out.slice();
snapshot.forEach(item => {
  if (item.expect === 'edge') return;
  push(item.q.toUpperCase(), item.expect);
  if (item.q.length > 1) push(item.q.charAt(0).toUpperCase() + item.q.slice(1), item.expect);
});
snapshot.slice(0, Math.floor(snapshot.length / 2)).forEach(item => {
  if (item.expect === 'edge') return;
  push('please ' + item.q, item.expect);
  push('quick one — ' + item.q, item.expect);
});

console.error('MEGA Corpus size (post-tier-7):', out.length);

// ============ TIER 8: NEWLY-COVERED CATEGORIES (2026-06-27 breadth-gap close) ============
// Regression scenarios for the routes added to aria.html classify(): RSA, hardware, mobile, Office,
// Ivanti→vpn, and the B6–B9 phrasing fixes. With case + politeness/urgency variants.
const TIER8 = [
  // RSA SecurID
  ['set up my rsa token','kb:rsa'],['rsa securid not working','kb:rsa'],['my rsa token is out of sync','kb:rsa'],
  ['import my rsa soft token','kb:rsa'],['rsa securid app setup','kb:rsa'],['need a new rsa token issued','kb:rsa'],
  ['securid code keeps getting rejected','kb:rsa'],['rsa token resync','kb:rsa'],
  // Ivanti Secure Access → vpn
  ['ivanti secure access wont connect','vpn'],['set up ivanti vpn','vpn'],['ivanti pulse vpn error','vpn'],
  ['cant connect with ivanti secure','vpn'],['ivanti secure access keeps disconnecting','vpn'],['install ivanti secure access','vpn'],
  // Mobile (iOS/Android) setup + enrollment
  ['set up email on my iphone','kb:mobile'],['configure outlook on my android','kb:mobile'],['set up my work phone','kb:mobile'],
  ['add my work account to my ipad','kb:mobile'],['enroll my android phone for work','kb:mobile'],['set up company email on my personal phone','kb:mobile'],
  // Office app repair / reinstall
  ['repair my office installation','kb:office'],['reinstall office','kb:office'],['my office apps wont launch','kb:office'],
  ['word keeps freezing','kb:office'],['excel wont open','kb:office'],['repair microsoft office','kb:office'],['powerpoint crashes on launch','kb:office'],
  // Hardware break/fix triage
  ['my laptop wont turn on','kb:hardware'],['screen is black','kb:hardware'],['keyboard stopped working','kb:hardware'],
  ['laptop wont charge','kb:hardware'],['docking station not working','kb:hardware'],['no display on my monitor','kb:hardware'],['battery wont hold charge','kb:hardware'],
  // B6 permissions phrasing
  ['permission denied on the network drive','kb:permissions'],['i lost access to a folder','kb:permissions'],['cant open the shared drive','kb:permissions'],
  // B7 account-locked phrasing
  ['my account is locked','password'],['please unlock my account','password'],['locked out of my account','password'],
  // B8 onboarding phrasing
  ['deactivate a user account','kb:onboarding'],['provision a new employee','kb:onboarding'],['disable access for a departing employee','kb:onboarding'],
  // B9 Intune Company Portal
  ['company portal wont enroll my device','kb:m365'],['company portal setup','kb:m365'],
];
TIER8.forEach(([q, expect]) => {
  push(q, expect);
  push(q.toUpperCase(), expect);
  push(q.charAt(0).toUpperCase() + q.slice(1), expect);
  ['please ', 'urgent: ', 'can you help with '].forEach((p) => push(p + q, expect));
});
console.error('MEGA Corpus size (post-tier-8):', out.length);

// ============ TIER 9: P2 — natural-phrasing HARDENING of previously-weak categories (2026-06-27) ============
const TIER9 = [
  // Ivanti (vpn)
  ['ivanti connect secure wont launch','vpn'],['cant get on ivanti','vpn'],['ivanti vpn keeps asking for credentials','vpn'],
  ['my ivanti client crashed','vpn'],['ivanti wont authenticate','vpn'],['update ivanti secure access','vpn'],['ivanti pulse not connecting','vpn'],['reinstall ivanti','vpn'],
  // Intune (kb:m365)
  ['my device shows not compliant in intune','kb:m365'],['intune wont push my apps','kb:m365'],['retire my device from intune','kb:m365'],
  ['intune policy not applying','kb:m365'],['cant enroll in intune','kb:m365'],['intune sync failed','kb:m365'],['device management enrollment error','kb:m365'],['mdm enrollment stuck','kb:m365'],
  // account unlock (password)
  ['account locked','password'],['im locked out','password'],['my login is locked','password'],['locked out after password change','password'],
  ['my profile is locked','password'],['unlock me please','password'],['i got locked out this morning','password'],['account disabled after too many tries','password'],
  // onboarding/offboarding (kb:onboarding)
  ['new employee starting monday','kb:onboarding'],['set up accounts for a new hire','kb:onboarding'],['disable a terminated employee','kb:onboarding'],
  ['offboard someone who quit','kb:onboarding'],['remove access for ex employee','kb:onboarding'],['onboard a contractor','kb:onboarding'],
  ['decommission a leaver','kb:onboarding'],['grant a new joiner their apps','kb:onboarding'],['employee transferred departments access','kb:onboarding'],
  // permissions (kb:permissions)
  ['i dont have permission to this folder','kb:permissions'],['getting access denied opening the share','kb:permissions'],['cant get into the department folder','kb:permissions'],
  ['my permissions to the drive disappeared','kb:permissions'],['folder says you dont have access','kb:permissions'],['need access to a network share','kb:permissions'],
  ['cant write to the shared folder','kb:permissions'],['permission error on the file server','kb:permissions'],['lost my rights to the team drive','kb:permissions'],['access to the share was removed','kb:permissions'],
];
TIER9.forEach(([q, expect]) => { push(q, expect); push(q.toUpperCase(), expect); push('please ' + q, expect); });
console.error('MEGA Corpus size (post-tier-9):', out.length);

// ============ TIER 10: P3 — NEW call types (2026-06-27): software install, display/monitor, certificates, scanner ============
const TIER10 = [
  ['i need photoshop installed','kb:software'],['please install zoom for me','kb:software'],['can you install slack','kb:software'],
  ['request software install','kb:software'],['need an app installed','kb:software'],['install adobe acrobat','kb:software'],['software request for visio','kb:software'],
  ['my second monitor isnt working','kb:hardware'],['dual monitor not detected','kb:hardware'],['external monitor not showing','kb:hardware'],['extend my display to two screens','kb:hardware'],
  ['certificate error on the website','kb:certificates'],['ssl certificate expired','kb:certificates'],['your connection is not private','kb:certificates'],['untrusted certificate warning','kb:certificates'],
  ['scanner wont scan','printer'],['scan to folder not working','printer'],['cant scan a document','printer'],['document scanner not working','printer'],
];
TIER10.forEach(([q, expect]) => { push(q, expect); push(q.toUpperCase(), expect); push('please ' + q, expect); });
console.error('MEGA Corpus size (post-tier-10):', out.length);

module.exports = out;
