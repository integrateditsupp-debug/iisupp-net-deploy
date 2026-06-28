'use strict';
/* === 10,000+ ARIA SCENARIO GENERATOR ===
   Programmatically expands base templates by:
   - subject variations (it/this/that)
   - tense variations (is/was/has been)
   - verb variations (broke/broken/breaking)
   - politeness wrappers (please, can you, help me)
   - urgency wrappers (urgent, asap, now)
   - typo variations (common keyboard slips)
   - casing variations (lowercase, sentence, ALL CAPS)
*/

const baseCorpus = require('./scenario-corpus');  // 1896 hand-curated

const out = [...baseCorpus];

// Variation generators
function caseVariants(s) {
  return [s, s.toUpperCase(), s.charAt(0).toUpperCase() + s.slice(1)];
}

const PREFIX_POLITE = ['please ', 'can you help with ', 'i need help with ', 'help me with ', 'sorry but ', 'quick question — '];
const PREFIX_URGENT = ['urgent: ', 'asap ', 'urgent ', 'help now: ', 'critical: ', 'p1: '];
const SUFFIX = ['', ' please', ' thanks', ' asap', ' urgent', '?', '!', '!!', '...'];
const TYPOS = {
  'won\'t': ['wont', 'won t', "won'r"],
  'can\'t': ['cant', 'can t', "can;t"],
  'outlook': ['outlok', 'outlokk', 'outloook'],
  'password': ['pasword', 'passw0rd', 'pasworld'],
  'wifi': ['wifii', 'wfi', 'wifi-'],
  'email': ['emial', 'eamil', 'emial'],
  'teams': ['team\'s', 'teamz', 'teem'],
};

// Expand each base scenario with variations
baseCorpus.forEach((item, idx) => {
  // Skip edge cases — they should stay literal
  if (item.expect === 'edge' || item.expect === 'resolution' || item.expect === 'not-resolution') return;

  // Add polite prefix variants
  PREFIX_POLITE.forEach(p => {
    out.push({ q: p + item.q, expect: item.expect });
  });
  // Add urgent prefix variants
  PREFIX_URGENT.forEach(p => {
    out.push({ q: p + item.q, expect: item.expect });
  });
  // Add suffix variants (skip empty)
  SUFFIX.slice(1, 4).forEach(s => {
    out.push({ q: item.q + s, expect: item.expect });
  });
  // Add typo variants
  for (const [orig, typos] of Object.entries(TYPOS)) {
    if (item.q.includes(orig)) {
      typos.forEach(t => {
        out.push({ q: item.q.replace(orig, t), expect: item.expect });
      });
    }
  }
});

// Add more resolution variations (10+ phrasings)
const RESOLVE_BASE = ['solved', 'fixed', 'works now', 'all good', 'perfect', 'thank you', 'great', 'awesome', 'done', 'sorted', 'thanks a million'];
const RESOLVE_PREFIX = ['', 'yes ', 'yep ', 'ok ', 'great, ', 'cool, ', 'oh ', 'wow ', 'amazing ', 'perfect, '];
const RESOLVE_SUFFIX = ['', '!', '!!', '.', ' thanks', ' thank you', ' :)', ' 🎉', ' 👌', ' 💯'];
RESOLVE_BASE.forEach(b => {
  RESOLVE_PREFIX.forEach(p => {
    RESOLVE_SUFFIX.forEach(s => {
      out.push({ q: p + b + s, expect: 'resolution' });
    });
  });
});

// Negation expansions
const NEG_BASE = ['still not fixed', 'still broken', 'didn\'t help', 'not working', 'no luck', 'happening again', 'came back', 'broke again', 'worse now', 'nope'];
NEG_BASE.forEach(b => {
  caseVariants(b).forEach(c => {
    out.push({ q: c, expect: 'not-resolution' });
  });
});

/* ============================================================
   ADVERSARIAL LAYER - Sunday 2026-06-21 corpus growth (~5K)
   WHY: the 29,072 clean corpus held 100% pass for 6 consecutive
   runs (06-19 x3, 06-20 x3) = zero signal. Prior sessions flagged
   that the Sunday growth slot must add an ADVERSARIAL layer
   (typos, multi-intent precedence, code-switching, negation/
   sarcasm) NOT a clean industry layer, so pass rate regains signal.
   Expectations reflect what ARIA SHOULD route to. Genuine misses
   surface as regex-broaden suggestions for HUMAN review and are
   NEVER auto-applied to aria.html.
   ============================================================ */
const advStart = out.length;

// --- 1. Robustness wrappers around known-good phrases (should PASS) ---
const GOOD_BASE = [
  ['my outlook wont open', 'mail'],
  ['cant connect to the vpn', 'vpn'],
  ['i need a password reset', 'password'],
  ['the printer is jammed', 'printer'],
  ['wifi keeps dropping', 'wifi'],
  ['teams wont load my channels', 'kb:teams'],
  ['the mfa code never arrives', 'kb:mfa'],
  ['onedrive wont sync', 'kb:onedrive'],
  ['my laptop is really slow', 'kb:performance'],
  ['this pc is super laggy', 'kb:performance'],
  ['bluetooth headset keeps cutting out', 'kb:bluetooth'],
  ['i think i clicked a phishing link', 'kb:security'],
  ['someone has access to my account', 'kb:security'],
  ['my webcam isnt working on video calls', 'kb:webcam'],
  ['bitlocker is asking for a recovery key', 'kb:bitlocker'],
  ['my macbook wont boot', 'kb:macos'],
  ['usb drive not recognized', 'kb:usb'],
  ['chrome keeps crashing', 'kb:browser'],
  ['edge is so slow lately', 'kb:browser'],
  ['i cant open the shared folder', 'kb:permissions'],
  ['cant resolve hostname', 'kb:networking'],
  ['my account is locked out in active directory', 'kb:active-directory'],
  ['switch to voice mode', 'voice'],
  ['i want to talk to a human', 'escalation'],
  ['im stuck', 'escalation'],
  ['whats the weather today', 'weather'],
  ['show me the news headlines', 'news'],
  ['whats the bitcoin price', 'trade'],
  ['give me a motivational quote', 'quote'],
  ['i want to buy a laptop charger on amazon', 'shopping'],
  ['vpn keeps disconnecting every few minutes', 'vpn'],
  ['outlook is frozen and not responding', 'mail'],
  ['cant sign in to my account', 'password'],
  ['the wifi adapter disappeared', 'wifi'],
  ['teams call has no audio', 'kb:teams'],
  ['authenticator app isnt sending codes', 'kb:mfa'],
  ['files wont sync to onedrive', 'kb:onedrive'],
  ['my laptop keeps overheating', 'kb:performance'],
  ['my airpods wont pair', 'kb:bluetooth'],
  ['i got a ransomware warning', 'kb:security'],
];
const NOISE_PRE = ['so basically ', 'ok so ', 'hey quick one ', 'not sure who to ask but ', 'sorry to bug you ', 'long story short ', 'real quick ', 'morning! ', 'ugh ', 'heads up ', 'genuine question '];
const NOISE_POST = ['', ' anyway', ' lol', ' been like this all morning', ' driving me nuts', ' second time today', ' any ideas', ' pls help', ' when you get a sec', ' tia', ' so frustrating'];
GOOD_BASE.forEach(function (pair) {
  NOISE_PRE.forEach(function (pre) {
    NOISE_POST.forEach(function (post) {
      out.push({ q: pre + pair[0] + post, expect: pair[1], adv: true, cat: 'robustness' });
    });
  });
});

// --- 2. Multi-intent precedence (most-specific wins) ---
const PRECEDENCE = [
  ['network printer on the wifi wont print', 'printer'],
  ['wireless printer not printing over the wifi', 'printer'],
  ['outlook keeps crashing when i connect to the vpn', 'mail'],
  ['got a phishing email asking me to reset my password', 'kb:security'],
  ['suspicious sign-in and now my account is locked out', 'kb:security'],
  ['teams meeting wont start and my webcam is dead', 'kb:webcam'],
  ['out of office wont turn off in outlook', 'outlook_ooo'],
  ['mfa code never arrives so i cant reset my password', 'password'],
  ['onedrive wont sync and teams wont load', 'kb:teams'],
  ['vpn is up but i still cant reach the internal site', 'vpn'],
  ['macbook wont boot after the bluetooth update', 'kb:macos'],
  ['my password is fine but the wifi keeps dropping', 'wifi'],
];
PRECEDENCE.forEach(function (pair) {
  caseVariants(pair[0]).forEach(function (c) { out.push({ q: c, expect: pair[1], adv: true, cat: 'precedence' }); });
});

// --- 3. Typo-break (genuine regex gaps - expect human intent) ---
const TYPO_BREAK = [
  ['wirless wont conect', 'wifi'],
  ['cant find the wireles network', 'wifi'],
  ['no wirless signal at all', 'wifi'],
  ['vpm wont conect', 'vpn'],
  ['cant reach the vpm', 'vpn'],
  ['prnter jammed again', 'printer'],
  ['the priner is offline', 'printer'],
  ['bluetoth headset dead', 'kb:bluetooth'],
  ['blutooth wont pair', 'kb:bluetooth'],
  ['my wabcam is frozen on calls', 'kb:webcam'],
];
const TB_SUFFIX = ['', ' please', ' asap'];
TYPO_BREAK.forEach(function (pair) {
  caseVariants(pair[0]).forEach(function (c) {
    TB_SUFFIX.forEach(function (s) { out.push({ q: c + s, expect: pair[1], adv: true, cat: 'typo-break' }); });
  });
});

// --- 4. Code-switching ---
const CS_PASS = [
  ['mi wifi no funciona', 'wifi'],
  ['el wifi no conecta', 'wifi'],
  ['necesito password reset urgente', 'password'],
  ['mi outlook no abre', 'mail'],
  ['el vpn no funciona', 'vpn'],
  ['mon wifi ne marche pas', 'wifi'],
  ['mon outlook plante', 'mail'],
  ['mein outlook startet nicht', 'mail'],
  ['ich kann das wifi nicht verbinden', 'wifi'],
  ['reset password bitte', 'password'],
  ['mi teams no carga', 'kb:teams'],
  ['mon vpn est deconnecte', 'vpn'],
  ['el onedrive no sincroniza', 'kb:onedrive'],
  ['mein bluetooth headset geht nicht', 'kb:bluetooth'],
];
const CS_FAIL = [
  ['mi impresora esta atascada', 'printer'],
  ['no puedo iniciar sesion', 'password'],
  ['mi red inalambrica no funciona', 'wifi'],
  ['mon imprimante est en panne', 'printer'],
  ['je ne peux pas me connecter', 'password'],
  ['mein drucker druckt nicht', 'printer'],
  ['ma souris ne marche pas', 'default'],
  ['no tengo internet', 'wifi'],
  ['mein passwort ist abgelaufen', 'password'],
  ['mi correo no abre', 'mail'],
];
CS_PASS.forEach(function (p) { p.push('cs-pass'); });
CS_FAIL.forEach(function (p) { p.push('cs-fail'); });
CS_PASS.concat(CS_FAIL).forEach(function (pair) {
  [pair[0], pair[0].charAt(0).toUpperCase() + pair[0].slice(1), pair[0] + ' ?'].forEach(function (c) {
    out.push({ q: c, expect: pair[1], adv: true, cat: pair[2] });
  });
});

// --- 5. Negation / sarcasm resolution ---
const NOT_RES = [
  'oh great still broken', 'fantastic, didnt work', 'lovely, broke again',
  'wonderful, still not working', 'nice, came back', 'cool, still down',
  'perfect, no luck', 'amazing, worse now', 'awesome, still cant log in',
  'thanks but nope still broken', 'yeah no it didnt help', 'great, happening again',
];
const RES = [
  'yep that sorted it', 'perfect all good now', 'legend that fixed it',
  'cheers mate works now', '10/10 sorted', 'that did the trick thanks',
  'all set were good', 'works like a charm now', 'brilliant, problem solved',
  'youre a lifesaver, fixed', 'much better now thanks', 'sweet, back to normal',
];
const RES_PRE = ['', 'ok ', 'oh ', 'well '];
NOT_RES.forEach(function (b) { RES_PRE.forEach(function (p) { out.push({ q: p + b, expect: 'not-resolution', adv: true, cat: 'neg-res' }); }); });
RES.forEach(function (b) { RES_PRE.forEach(function (p) { out.push({ q: p + b, expect: 'resolution', adv: true, cat: 'pos-res' }); }); });


// --- 6. Genuine-gap singles (tracked regex gaps; expectation = correct human intent) ---
// Each is ONE instance (no wrapper inflation). Surfaces a specific aria.html regex
// rigidity for HUMAN review (logged to pending-fixes). NOT auto-applied.
const GAP_SINGLES = [
  ['my fan is spinning and the laptop is hot', 'kb:performance'],   // perf regex needs adjacency; "fan is spinning" / "laptop is hot" infix breaks it
  ['the laptop is running hot and loud', 'kb:performance'],
  ['cant sign in to my email', 'password'],                         // email keyword routes to mail before login; design review
];
GAP_SINGLES.forEach(function (pair) { out.push({ q: pair[0], expect: pair[1], adv: true, cat: 'gap-single' }); });
console.error('Adversarial layer added:', out.length - advStart, 'scenarios');
console.error('10K Corpus size:', out.length);

/* ============================================================
   HEALTHCARE VERTICAL LAYER — Sunday 2026-06-28 corpus growth (~5K)
   First industry vertical: Healthcare IT support scenarios.
   Scenarios map to EXISTING ARIA classifier intents (password,
   printer, wifi, vpn, mail, kb:performance, kb:hardware, etc.)
   framed with healthcare context, apps, and jargon.
   EMR/EHR: Epic, Cerner, MEDITECH, Allscripts, athenahealth, PointClickCare
   Devices: WOW carts, barcode scanners, label printers
   Personas: nurse, doctor, clinician, admin, pharmacist, radiologist
   Goal: verify ARIA routes correctly despite healthcare framing.
   Expectations reflect correct IT intent, not healthcare-domain intent.
   ============================================================ */
const hcStart = out.length;

// --- HC-1. Authentication / Password ---
const HC_AUTH_BASES = [
  'cant log into epic','epic login not working','epic password expired',
  'locked out of epic','cant access cerner','cerner login failed',
  'cerner keeps logging me out','meditech wont let me in','locked out of meditech',
  'allscripts login error','cant get into allscripts','athenahealth login broken',
  'ehr login not working','emr password reset needed','smartcard reader not working',
  'badge tap not logging me in','proximity card reader broken','cant sign in to ehr',
  'single sign on broken at workstation','sso not working on clinical machine',
  'staff portal login down','nursing station cant log in','clinical workstation login fails',
  'biometric login not working at station','fingerprint reader wont scan at desk',
  'pointclickcare login expired','pcc wont let me log in','cant access patient portal admin',
  'azure ad locked out at hospital','active directory password reset needed clinic',
];
const HC_AUTH_SFXS = ['', ' please', ' urgent', ' asap', ' help'];
const HC_AUTH_PFXS = ['', 'hi ', 'hey '];
HC_AUTH_BASES.forEach(function(b){
  HC_AUTH_PFXS.forEach(function(p){
    HC_AUTH_SFXS.forEach(function(s){ out.push({q:p+b+s,expect:'password',cat:'hc-auth'}); });
  });
});

// --- HC-2. Printer (label / wristband / prescription printers) ---
const HC_PRINT_BASES = [
  'patient wristband printer jammed','label printer not printing wristbands',
  'zebra printer not working','zebra label printer offline','zebra printer jammed',
  'dymo printer wont print','medication label printer down','pharmacy printer offline',
  'prescription printer not working','barcode label printer jammed','armband printer broken',
  'wristband printer offline at nursing station','patient label printer error',
  'lab requisition printer wont print','radiology report printer offline',
  'discharge paperwork printer jammed','consent form printer broken',
  'nurse station printer not responding','er printer down','icu printer jammed',
  'ward printer not working','floor printer offline','clinical printer error',
  'printers on ward wont connect','cant print from epic workstation',
  'cant print patient chart','printing from cerner not working',
  'print job stuck in queue clinical','patient record wont print',
  'test results wont print out','unable to print discharge summary',
];
const HC_PRINT_SFXS = ['', ' please', ' urgent', ' asap'];
HC_PRINT_BASES.forEach(function(b){
  HC_PRINT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'printer',cat:'hc-printer'}); });
});

// --- HC-3. WiFi (hospital wireless for clinical devices) ---
const HC_WIFI_BASES = [
  'hospital wifi not connecting','ward wifi dropping','clinical wifi keeps disconnecting',
  'tablet wifi not working at bedside','ipad wifi dropping on ward','mobile cart wifi broken',
  'wow wifi connection lost','workstation on wheels wont connect to wifi',
  'portable workstation wifi failing','wifi keeps dropping in er','er wifi unstable',
  'icu wifi not working','operating room wifi down','ot wifi not connecting',
  'radiology room wifi out','ultrasound machine cant connect to wifi',
  'point of care device wifi dropping','handheld scanner wifi not working',
  'barcode scanner wont connect wirelessly','wireless barcode reader offline',
  'clinical wifi authentication failing','wifi cert error on hospital device',
  'medical device wont join hospital network','cannot connect to clinical ssid',
  'staff wifi not available on this floor','wifi dead in room 412',
  'no wifi signal in basement clinic','wireless network slow in surgery suite',
  'wifi latency high in icu','guest wifi and staff wifi both down',
];
const HC_WIFI_SFXS = ['', ' please', ' urgent', ' help'];
HC_WIFI_BASES.forEach(function(b){
  HC_WIFI_SFXS.forEach(function(s){ out.push({q:b+s,expect:'wifi',cat:'hc-wifi'}); });
});

// --- HC-4. VPN (remote clinicians, tele-health) ---
const HC_VPN_BASES = [
  'vpn wont connect at home cant access epic','remote access to hospital broken',
  'cant vpn in to access patient records','hospital vpn down working from home',
  'citrix not connecting to hospital','citrix receiver broken remote access',
  'remote desktop to clinical system not working','rdp to hospital server failing',
  'telehealth vpn dropping','telemedicine remote access not working',
  'cant connect to pacs remotely','radiology vpn connection failed',
  'anyconnect vpn error on home laptop','cisco vpn wont auth for hospital',
  'globalprotect vpn failing from clinic offsite','pulse secure broken remote clinician',
  'two factor not working with hospital vpn','mfa breaking vpn connection hospital',
  'vpn connects but cant reach epic','vpn up but emr unreachable',
  'remote nurse cant access ehr through vpn','home care nurse vpn down',
  'community health worker vpn broken','offsite provider cant access records',
  'locum doctor cant get vpn access','agency staff vpn not provisioned',
  'need vpn access for new remote role clinical','vpn certificate expired hospital',
];
const HC_VPN_SFXS = ['', ' please', ' urgent', ' asap'];
HC_VPN_BASES.forEach(function(b){
  HC_VPN_SFXS.forEach(function(s){ out.push({q:b+s,expect:'vpn',cat:'hc-vpn'}); });
});

// --- HC-5. Performance (slow EMR, lag on clinical workstations) ---
const HC_PERF_BASES = [
  'epic is running slow today','epic loading very slowly','epic takes forever to open',
  'cerner is lagging','cerner slow all morning','meditech response time terrible',
  'ehr is very slow on this ward','emr timing out constantly','clinical apps slow',
  'workstation on ward very slow','clinical pc taking ages to boot',
  'pacs viewer slow to load images','radiology images loading slowly',
  'dicom viewer hanging on large images','ultrasound workstation slow',
  'pharmacy system sluggish','dispensing system slow',
  'nursing station pc very laggy','computer in treatment room slow',
  'dragon medical dictation lagging','speech recognition software slow hospital',
  'telemedicine video call quality bad','video visit pixelated and lagging',
  'virtual visit keeps buffering','telehealth platform slow',
  'clinical decision support tool very slow','order entry sluggish',
];
const HC_PERF_SFXS = ['', ' please', ' urgent'];
HC_PERF_BASES.forEach(function(b){
  HC_PERF_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:performance',cat:'hc-perf'}); });
});

// --- HC-6. Hardware (clinical devices, WOW carts, scanners) ---
const HC_HW_BASES = [
  'workstation on wheels wont turn on','wow cart battery dead','mobile workstation not charging',
  'clinical cart computer wont start','bedside terminal frozen','bedside computer crashed',
  'nursing station monitor not turning on','dual monitor not working at nurses station',
  'barcode scanner not scanning','handheld scanner wont read barcodes',
  'medication scanner broken','wristband scanner not working',
  'clinical keyboard not working','keyboard broken at nursing station',
  'touchscreen not responding at workstation','touch monitor not working in clinic',
  'smart card reader broken','proximity reader wont read badge',
  'id badge reader at workstation broken','rfid reader offline at station',
  'portable device wont charge','tablet charger broken on ward',
  'usb hub at clinical workstation dead','docking station not working for clinical laptop',
  'ecg workstation hardware fault','ekg machine network issue',
  'vital signs monitor not connecting to network','bp machine not syncing',
];
const HC_HW_SFXS = ['', ' please', ' help'];
HC_HW_BASES.forEach(function(b){
  HC_HW_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:hardware',cat:'hc-hardware'}); });
});

// --- HC-7. Email (clinical communication) ---
const HC_MAIL_BASES = [
  'clinical email not loading','hospital email down','outlook not working at hospital workstation',
  'cant access hospital email','nhs mail not working','nhs email login failing',
  'secure messaging not working','clinical messaging app broken',
  'cant receive referral emails','fax to email not arriving','secure fax email broken',
  'encrypted email wont send clinical','shared clinical inbox broken',
  'distribution list not receiving emails at clinic','on call email alias broken',
  'doctor inbox not receiving messages','specialist referral email bouncing',
  'lab results email not arriving','pathology report email not coming through',
  'ward email group not working','team mailbox broken','shared inbox clinical not syncing',
  'epic in basket email integration broken','cerner message center not delivering',
  'ehr secure message not arriving as email','patient communication email failing',
];
const HC_MAIL_SFXS = ['', ' please', ' urgent'];
HC_MAIL_BASES.forEach(function(b){
  HC_MAIL_SFXS.forEach(function(s){ out.push({q:b+s,expect:'mail',cat:'hc-mail'}); });
});

// --- HC-8. Shared drives / OneDrive (clinical file access) ---
const HC_OD_BASES = [
  'cant access shared clinical drive','shared folder with patient protocols gone',
  'clinical policy documents folder missing','shared drive for ward offline',
  'cant open files on shared server hospital','network drive unmapped at workstation',
  'sharepoint clinical portal not loading','clinical sharepoint site down',
  'hospital intranet files not accessible','cant access policy manual on intranet',
  'shared folder for lab results not accessible','radiology shared folder offline',
  'onedrive not syncing on clinical laptop','clinical files not syncing to cloud',
  'cant find shared folder for discharge letters','discharge template folder missing',
];
const HC_OD_SFXS = ['', ' please'];
HC_OD_BASES.forEach(function(b){
  HC_OD_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onedrive',cat:'hc-onedrive'}); });
});

// --- HC-9. MFA / Security (clinical 2FA) ---
const HC_MFA_BASES = [
  'two factor not working on clinical device','mfa app broken at work',
  'authenticator app not generating codes hospital','duo mobile not working for epic',
  'duo push not arriving for hospital login','rsa token broken clinical',
  'rsa fob not generating right code','soft token not working ehr',
  'mfa enrollment broken for new staff','cant enroll in two factor at hospital',
  'security code not sending to work phone','verification sms not arriving',
  'smart card piv not working for mfa','cac card not working two factor',
];
const HC_MFA_SFXS = ['', ' please', ' urgent'];
HC_MFA_BASES.forEach(function(b){
  HC_MFA_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:mfa',cat:'hc-mfa'}); });
});

// --- HC-10. Networking ---
const HC_NET_BASES = [
  'hospital network down on floor 3','ward network outage','clinical network dropping',
  'network switch offline in icu','ethernet not working at nurse station',
  'hospital lan down','clinical vlan unreachable','pacs network unreachable',
  'network printer unreachable on ward','ip phone not connecting hospital network',
  'voip phones down on ward','nurse call system network issue',
  'network speed very slow clinical applications','hospital network congested',
  'cant reach hospital server from workstation','server unreachable clinical pc',
];
const HC_NET_SFXS = ['', ' please'];
HC_NET_BASES.forEach(function(b){
  HC_NET_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:networking',cat:'hc-network'}); });
});

// --- HC-11. Onboarding (new clinical staff) ---
const HC_ONBOARD_BASES = [
  'new nurse needs epic access set up','new doctor account not created',
  'onboarding new clinician need ehr login','new staff member needs clinical system access',
  'new hire training on epic not set up','resident needs emr access provisioned',
  'new pharmacist needs dispensing system login','new lab tech needs lis access',
  'new radiologist needs pacs access','new admin needs scheduling system login',
  'contractor needs temporary clinical access','locum doctor needs system access today',
  'new ward assistant needs workstation login','agency nurse needs email account',
  'new employee it setup needed hospital','clinical orientation it setup incomplete',
];
const HC_ONBOARD_SFXS = ['', ' please', ' urgent'];
HC_ONBOARD_BASES.forEach(function(b){
  HC_ONBOARD_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onboarding',cat:'hc-onboarding'}); });
});

// --- HC-12. Default / out-of-scope clinical questions ---
const HC_DEFAULT_BASES = [
  'what is the dosage for amoxicillin','can you check patient bed availability',
  'what are visiting hours','how do i request patient leave',
  'what is the on call schedule this week','where is the pharmacy',
  'can you book a patient transport','who is the charge nurse today',
  'what is the hospital drug formulary','how do i request medical records',
  'patient needs social work referral','how to apply for clinical privileges',
  'when is grand rounds this week','how to submit an incident report',
  'what is the infection control policy','how to report a sharps injury',
  'order a diagnostic test for patient','how do i prescribe controlled substances',
  'patient information request hipaa','discharge planning assistance needed',
];
const HC_DEFAULT_SFXS = ['', ' please', '?'];
HC_DEFAULT_BASES.forEach(function(b){
  HC_DEFAULT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'default',cat:'hc-default'}); });
});

console.error('Healthcare vertical layer added:', out.length - hcStart, 'scenarios');
console.error('10K Corpus size:', out.length);

// ==================
// =====================================================
// FINANCE VERTICAL LAYER (Sunday 2026-06-28)
// Financial services IT support scenarios.
// Bloomberg terminals, trading platforms, compliance
// systems, banking apps — all with financial context.
// Expectations reflect correct IT intent, not finance-domain intent.
// =====================================================
const finStart = out.length;

// --- FIN-1. Authentication / Password (Bloomberg, trading systems) ---
const FIN_AUTH_BASES = [
  'bloomberg terminal login not working','cannot log into trading platform',
  'market data system password expired','my bloomberg password needs reset',
  'trading terminal locked out after wrong pin','brokerage system login failed',
  'equity research platform authentication error','oms login not accepting credentials',
  'can t access order management system','trading app two factor not working',
  'core banking login rejected','digital banking portal account locked',
  'treasury system password reset needed','swift system credentials expired',
  'murex login failed for trader','fidessa authentication issue on desk',
  'advent portfolio manager login error','charles river ims password locked out',
  'refinitiv eikon access denied','factset login credentials not working',
];
const FIN_AUTH_SFXS = ['', ' please', ' urgent', ' asap'];
FIN_AUTH_BASES.forEach(function(b){
  FIN_AUTH_SFXS.forEach(function(s){ out.push({q:b+s,expect:'password',cat:'fin-auth'}); });
});

// --- FIN-2. Hardware (trading desks, multi-monitor setups, Bloomberg keyboards) ---
const FIN_HW_BASES = [
  'trading desk monitor not displaying','second screen blank on trading workstation',
  'bloomberg keyboard f8 key not working','market data terminal screen flickering',
  'multi-monitor setup broken on trading floor','trader workstation keyboard frozen',
  'ups beeping at trading desk','trading desk pc won t boot',
  'bloomberg b-unit not recognized','trading terminal hardware failure',
  'printer at compliance desk jammed','risk management workstation crashed',
  'dealing desk microphone not working','headset not working at trading desk',
  'turret phone no audio on trading floor','squawk box not connecting to desk',
  'video wall showing no feed in trading room','ticker screen gone blank',
];
const FIN_HW_SFXS = ['', ' please', ' urgent'];
FIN_HW_BASES.forEach(function(b){
  FIN_HW_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:hardware',cat:'fin-hardware'}); });
});

// --- FIN-3. VPN / Remote Trading ---
const FIN_VPN_BASES = [
  'can t connect vpn to trading floor remotely','remote trading vpn not connecting',
  'working from home can t reach trading systems','vpn drops when accessing bloomberg',
  'remote access to order management system down','citrix session keeps disconnecting for trader',
  'vpn certificate expired for remote trader','split tunnel blocking market data feed',
  'trader vpn timeout on live orders','remote brokerage system access through vpn broken',
];
const FIN_VPN_SFXS = ['', ' please', ' urgent', ' asap'];
FIN_VPN_BASES.forEach(function(b){
  FIN_VPN_SFXS.forEach(function(s){ out.push({q:b+s,expect:'vpn',cat:'fin-vpn'}); });
});

// --- FIN-4. Performance (slow trading systems, lag on market data) ---
const FIN_PERF_BASES = [
  'bloomberg is lagging during market hours','order management system running slow',
  'market data feed delayed on workstation','trading platform freezing mid-trade',
  'equity screening tool extremely slow today','risk system taking forever to load positions',
  'portfolio analytics running slow','murex processing trades very slowly',
  'excel add-in for market data hanging','factset reports taking minutes to generate',
  'citrix session performance degraded for traders','trading terminal high cpu usage',
  'slow price feed on multi-asset terminal','compliance surveillance system unresponsive',
];
const FIN_PERF_SFXS = ['', ' please', ' urgent'];
FIN_PERF_BASES.forEach(function(b){
  FIN_PERF_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:performance',cat:'fin-performance'}); });
});

// --- FIN-5. Networking (trading floor network, market data feeds) ---
const FIN_NET_BASES = [
  'market data feed not arriving at desk','trading floor network switch down',
  'co-location network link degraded','low latency network issue on trading floor',
  'market data multicast not reaching workstation','dark fiber connection to exchange dropped',
  'cross-connect at data center down','fibre channel to storage array disconnected',
  'lan in treasury department down','backbone switch failure in trading wing',
  'network packet loss affecting trade execution','udp feed dropping packets for price data',
];
const FIN_NET_SFXS = ['', ' please', ' urgent'];
FIN_NET_BASES.forEach(function(b){
  FIN_NET_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:networking',cat:'fin-networking'}); });
});

// --- FIN-6. Email / Compliance Communications ---
const FIN_EMAIL_BASES = [
  'compliance email not delivering to regulator','email to client flagged by dlp system',
  'encrypted email to counterparty not working','exchange blocking large attachment to auditor',
  'trade confirmation email not arriving','outlook not syncing with bloomberg mail',
  'email archiving system not capturing messages','finra email surveillance alert going to spam',
  'secure email portal to broker offline','regulatory email notification failed to send',
];
const FIN_EMAIL_SFXS = ['', ' please', ' urgent'];
FIN_EMAIL_BASES.forEach(function(b){
  FIN_EMAIL_SFXS.forEach(function(s){ out.push({q:b+s,expect:'mail',cat:'fin-email'}); });
});

// --- FIN-7. MFA / Security (2FA on trading platforms, tokens) ---
const FIN_MFA_BASES = [
  'rsa securid token not generating code for trading system','google authenticator lost for bloomberg',
  'duo mobile not working for brokerage login','trading platform mfa push not arriving',
  'soft token app not generating otp for oms','two factor authentication app broken for citrix',
  'authy not syncing for financial application','mfa bypass not allowed for compliance portal',
  'hardware token fob dead for treasury system','authenticator reset needed for trading access',
];
const FIN_MFA_SFXS = ['', ' please', ' urgent'];
FIN_MFA_BASES.forEach(function(b){
  FIN_MFA_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:mfa',cat:'fin-mfa'}); });
});

// --- FIN-8. Onboarding (new traders, analysts, compliance staff) ---
const FIN_ONBOARD_BASES = [
  'new trader needs bloomberg terminal access','junior analyst needs factset provisioned',
  'new hire on trading desk needs oms account','graduate associate needs all trading tools set up',
  'compliance officer new start needs finra system access','new portfolio manager it onboarding incomplete',
  'new quant needs python environment on trading server','new risk analyst needs murex read access',
  'new broker needs market data subscriptions','intern needs view-only bloomberg access set up',
  'new relationship manager needs crm and email','junior trader joining monday needs full workstation',
];
const FIN_ONBOARD_SFXS = ['', ' please', ' urgent'];
FIN_ONBOARD_BASES.forEach(function(b){
  FIN_ONBOARD_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onboarding',cat:'fin-onboarding'}); });
});

// --- FIN-9. WiFi / Connectivity on trading floor ---
const FIN_WIFI_BASES = [
  'wifi not connecting at trading desk','wireless drops when moving to trading floor',
  'roaming between floors drops market data connection','trading floor wireless signal weak',
  'guest wifi for client presentation not working','wireless printer on trading floor offline',
  'access point down near dealer desks','wifi calling not working for compliance team',
];
const FIN_WIFI_SFXS = ['', ' please', ' urgent'];
FIN_WIFI_BASES.forEach(function(b){
  FIN_WIFI_SFXS.forEach(function(s){ out.push({q:b+s,expect:'wifi',cat:'fin-wifi'}); });
});

// --- FIN-10. OneDrive / File Access (research documents, models) ---
const FIN_ONEDRIVE_BASES = [
  'shared research folder not accessible for analyst','equity model file missing from shared drive',
  'cannot access compliance documents on onedrive','pitch deck folder gone for m&a team',
  'investment committee presentation folder missing','onedrive sync not working for portfolio models',
  'research repository offline for analysts','deal room documents not syncing',
  'financial model template folder permissions denied','shared p&l tracking file disappeared',
];
const FIN_ONEDRIVE_SFXS = ['', ' please', ' urgent'];
FIN_ONEDRIVE_BASES.forEach(function(b){
  FIN_ONEDRIVE_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onedrive',cat:'fin-onedrive'}); });
});

// --- FIN-11. Printer (trade confirmations, reports, statements) ---
const FIN_PRINT_BASES = [
  'printer jammed on trade confirmation batch','compliance report not printing at end of day',
  'client statement print job stuck in queue','trade tickets not printing on floor',
  'clearing house confirmation not printing','audit report printer offline in compliance dept',
  'regulatory filing print failed','settlement statement printer error at back office',
];
const FIN_PRINT_SFXS = ['', ' please', ' urgent'];
FIN_PRINT_BASES.forEach(function(b){
  FIN_PRINT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'printer',cat:'fin-printer'}); });
});

// --- FIN-12. Out-of-scope (compliance/regulatory questions, not IT) ---
const FIN_DEFAULT_BASES = [
  'what is the finra reporting deadline','how do i file a sar report',
  'what is the best execution policy','how to submit a trade error report',
  'what are our aml thresholds','how do i request a trade rollback',
  'what is the market hours schedule today','how to escalate a failed settlement',
  'what is our kyc onboarding process','how to apply for series 7 license',
  'when is the next earnings blackout period','how to get a repo rate quote',
  'what is the prime brokerage contact','how to report a suspicious transaction',
];
const FIN_DEFAULT_SFXS = ['', ' please', '?'];
FIN_DEFAULT_BASES.forEach(function(b){
  FIN_DEFAULT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'default',cat:'fin-default'}); });
});


// ============================================================
// LEGAL VERTICAL LAYER — Law firms, in-house counsel, courts, e-discovery
// Apps: iManage / NetDocs / Clio / Relativity / Westlaw / LexisNexis /
//       ProLaw / PracticePanther / MyCase / PACER / Kofax / Nuance Power PDF
// ============================================================
const legalStart = out.length;

// --- LEG-1. Password / Authentication (DMS login, matter system) ---
const LEG_AUTH_BASES = [
  'cannot log into imanage document management','imanage password reset needed at firm',
  'netdocs login not working for attorney','clio login failed for paralegal',
  'relativity password expired for ediscovery review','westlaw login not working for associate',
  'lexisnexis authentication failed for researcher','practicemanager login locked out',
  'pacer login not accepted for court filing','time entry system login broken for billing',
  'document review platform locked out','matter management system login failed',
  'e-billing portal credentials rejected','legal billing software access denied',
  'case management system password reset','ediscovery review account locked',
  'dms single sign on broken at firm','law firm vpn not accepting credentials',
];
const LEG_AUTH_SFXS = ['', ' please', ' urgent'];
LEG_AUTH_BASES.forEach(function(b){
  LEG_AUTH_SFXS.forEach(function(s){ out.push({q:b+s,expect:'password',cat:'leg-auth'}); });
});

// --- LEG-2. Hardware (scanners, high-vol printers, large-format exhibits) ---
const LEG_HW_BASES = [
  'high speed scanner not feeding documents for discovery','kofax scanner jammed on case files',
  'large format plotter not printing exhibit boards','fujitsu scanner not detected for document intake',
  'nuance power pdf crashing on scan import','workstation freezing during document review',
  'laptop overheating in trial prep room','second monitor not working at attorney workstation',
  'docking station not detecting displays at desk','external hard drive not recognized for evidence copy',
  'trial presentation laptop not booting','usb dvd drive for court not reading disk',
  'courtroom av equipment not displaying','evidence scanning station locked up',
  'document camera not connecting for deposition','attorney ipad not pairing with keyboard',
];
const LEG_HW_SFXS = ['', ' please', ' urgent'];
LEG_HW_BASES.forEach(function(b){
  LEG_HW_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:hardware',cat:'leg-hardware'}); });
});

// --- LEG-3. VPN / Remote (attorneys working remote, court access) ---
const LEG_VPN_BASES = [
  'vpn not connecting for remote attorney','law firm vpn drops during document review',
  'citrix not loading for remote case access','remote desktop to firm not working for partner',
  'vpn slow when accessing imanage from home','cisco anyconnect failing for outside counsel',
  'remote access to relativity review platform down','vpn token not syncing for mobile attorney',
  'firm vpn blocked at hotel for traveling lawyer','secure remote access to court systems broken',
  'pulse secure vpn error for home office attorney','remote review session dropped for paralegal',
];
const LEG_VPN_SFXS = ['', ' please', ' urgent'];
LEG_VPN_BASES.forEach(function(b){
  LEG_VPN_SFXS.forEach(function(s){ out.push({q:b+s,expect:'vpn',cat:'leg-vpn'}); });
});

// --- LEG-4. Performance / Slow systems (review platform, doc search) ---
const LEG_PERF_BASES = [
  'relativity review platform extremely slow for attorneys','imanage document search taking too long',
  'westlaw searches timing out on large queries','clio loading slowly for billing entry',
  'document management system sluggish on large matter','ediscovery review tool freezing on batch',
  'legal research database slow on concurrent users','time billing software hanging on save',
  'netdocs preview loading very slow','case management system slow at end of day',
  'contract review ai tool freezing on upload','imanage workspace loading slow on shared matter',
  'lexisnexis results taking long to display','matter management very slow for large cases',
];
const LEG_PERF_SFXS = ['', ' please', ' urgent'];
LEG_PERF_BASES.forEach(function(b){
  LEG_PERF_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:performance',cat:'leg-performance'}); });
});

// --- LEG-5. OneDrive / File Access (matter files, shared drives) ---
const LEG_ONEDRIVE_BASES = [
  'matter folder missing from shared drive for attorney','case documents not syncing in onedrive',
  'client folder permissions denied on file server','shared deal room documents disappeared',
  'contract drafts not accessible on onedrive','discovery production folder missing',
  'deal file room access removed for associate','legal pad templates missing from shared drive',
  'transaction folder not syncing for deal team','deposition exhibit folder gone from sharepoint',
  'client database not accessible on network drive','imanage workspace sync not working to desktop',
  'shared pleadings folder permissions error','settlement documents folder not accessible',
];
const LEG_ONEDRIVE_SFXS = ['', ' please', ' urgent'];
LEG_ONEDRIVE_BASES.forEach(function(b){
  LEG_ONEDRIVE_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onedrive',cat:'leg-onedrive'}); });
});

// --- LEG-6. Email (client comms, privilege tags, court notifications) ---
const LEG_EMAIL_BASES = [
  'client email flagged as spam from attorney account','outlook not syncing on attorney laptop',
  'email archiving not capturing privileged communications','court notification emails not arriving',
  'encrypted email to client failing at firm','exchange blocking large discovery attachment',
  'email thread for deal not accessible in archive','opposing counsel email bouncing back',
  'court electronic filing confirmation not arriving','barristers chambers email thread missing',
  'email dlp blocking contract attachment to client','retainer agreement email not delivered',
  'client intake email form not sending confirmations','legal aid email portal down',
];
const LEG_EMAIL_SFXS = ['', ' please', ' urgent'];
LEG_EMAIL_BASES.forEach(function(b){
  LEG_EMAIL_SFXS.forEach(function(s){ out.push({q:b+s,expect:'mail',cat:'leg-email'}); });
});

// --- LEG-7. MFA / Security (bar compliance, privileged system 2FA) ---
const LEG_MFA_BASES = [
  'duo mobile not working for imanage login','mfa token expired for court filing system',
  'authenticator app lost for relativity access','two factor authentication broken for clio',
  'rsa token dead for privileged document system','google authenticator not generating code for firm vpn',
  'mfa push not arriving for legal billing portal','soft token broken for matter management system',
  'hardware token fob not working for secure document vault','authentication app reset needed for westlaw',
  'two step verification broken for firm email','mfa not working for ediscovery platform login',
];
const LEG_MFA_SFXS = ['', ' please', ' urgent'];
LEG_MFA_BASES.forEach(function(b){
  LEG_MFA_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:mfa',cat:'leg-mfa'}); });
});

// --- LEG-8. Onboarding (new associates, paralegals, summer clerks) ---
const LEG_ONBOARD_BASES = [
  'new associate needs imanage access set up','summer associate it onboarding incomplete',
  'new paralegal needs clio provisioned','lateral hire needs all firm systems access',
  'new partner joining needs full workstation configured','new legal assistant needs document management access',
  'contract attorney starting needs relativity account','new law clerk needs court system credentials',
  'incoming articling student needs dms onboarding','new associate needs westlaw and lexisnexis set up',
  'new securities associate needs bloomberg access','new discovery paralegal needs relativity training account',
  'junior associate needs court efiling account','new counsel needs time entry system configured',
];
const LEG_ONBOARD_SFXS = ['', ' please', ' urgent'];
LEG_ONBOARD_BASES.forEach(function(b){
  LEG_ONBOARD_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onboarding',cat:'leg-onboarding'}); });
});

// --- LEG-9. WiFi (firm offices, courtrooms, client sites) ---
const LEG_WIFI_BASES = [
  'wifi not connecting at attorney workstation','wireless drops during video deposition',
  'courthouse wifi not available for attorney laptop','client boardroom wifi not working for deal signing',
  'conference room wifi cuts out during trial prep','law library wireless keeps dropping',
  'guest wifi for client meeting not working at firm','wireless issue at satellite office for attorneys',
  'wifi drops during zoom mediation session','access point down in litigation floor at firm',
];
const LEG_WIFI_SFXS = ['', ' please', ' urgent'];
LEG_WIFI_BASES.forEach(function(b){
  LEG_WIFI_SFXS.forEach(function(s){ out.push({q:b+s,expect:'wifi',cat:'leg-wifi'}); });
});

// --- LEG-10. Printer (court filings, exhibits, client docs) ---
const LEG_PRINT_BASES = [
  'printer jammed on court filing batch','exhibit copies not printing before trial',
  'high volume copier offline in litigation support','large format printer not printing exhibit boards',
  'print job stuck in queue for client documents','scanning to email not working on copier',
  'printer driver not installing for court computer','color printer offline for presentation materials',
  'pleadings batch print failed','labels not printing on file folders',
  'duplex printing broken for discovery documents','printer toner alert on main copier in filing room',
];
const LEG_PRINT_SFXS = ['', ' please', ' urgent'];
LEG_PRINT_BASES.forEach(function(b){
  LEG_PRINT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'printer',cat:'leg-printer'}); });
});

// --- LEG-11. Networking (firm network, client data rooms) ---
const LEG_NET_BASES = [
  'ethernet not working at attorney workstation','firm network down on litigation floor',
  'virtual data room connection issues for m&a deal','network slow in conference room during closing',
  'internet down at satellite office for firm','network drive not accessible for deal team',
  'lan port not working at new attorney desk','network outage at branch office of firm',
  'voip calls dropping at reception for firm','network switch issue on paralegal floor',
];
const LEG_NET_SFXS = ['', ' please', ' urgent'];
LEG_NET_BASES.forEach(function(b){
  LEG_NET_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:networking',cat:'leg-networking'}); });
});

// --- LEG-12. Out-of-scope (legal questions, billing disputes, bar matters) ---
const LEG_DEFAULT_BASES = [
  'what is the statute of limitations for this claim','how do i file a motion to dismiss',
  'what is our retainer agreement policy','how to calculate contingency fee',
  'when is the discovery cutoff for this case','what is billable hours target for associates',
  'how do i submit pro bono hours','what is our conflict check process',
  'how to request a court date extension','what is the privilege log format required',
  'what are our client intake procedures','how to submit a docketing entry',
];
const LEG_DEFAULT_SFXS = ['', ' please', '?'];
LEG_DEFAULT_BASES.forEach(function(b){
  LEG_DEFAULT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'default',cat:'leg-default'}); });
});

// --- LEG-13. Bluetooth (wireless mics, AirPods for depositions/mediations) ---
const LEG_BT_BASES = [
  'bluetooth headset not pairing for video deposition','airpods not connecting for zoom mediation',
  'wireless mouse not pairing at attorney desk','bluetooth not working on courtroom laptop',
  'airpods dropping audio on client call','wireless keyboard not pairing at partner office',
  'bluetooth speaker not pairing for conference room','jabra headset not connecting via bluetooth',
];
const LEG_BT_SFXS = ['', ' please', ' urgent'];
LEG_BT_BASES.forEach(function(b){
  LEG_BT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:bluetooth',cat:'leg-bluetooth'}); });
});

// --- LEG-14. Webcam / Video (depositions, mediations, remote hearings) ---
const LEG_CAM_BASES = [
  'webcam not working for remote deposition','video not connecting for zoom court hearing',
  'camera frozen during video mediation session','remote hearing camera not detected on laptop',
  'zoom video blurry for client meeting','teams video not working for attorney conference',
  'deposition platform camera not activating','virtual hearing webcam needs restart',
  'webex camera grainy for arbitration session','camera not turning on for client intake call',
];
const LEG_CAM_SFXS = ['', ' please', ' urgent'];
LEG_CAM_BASES.forEach(function(b){
  LEG_CAM_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:webcam',cat:'leg-webcam'}); });
});

// --- LEG-15. Permissions / Access Control (matter access, need-to-know) ---
const LEG_PERM_BASES = [
  'cannot access matter workspace on imanage','access denied to client folder on dms',
  'attorney ethics wall blocking file access','need permission to view sealed matter documents',
  'associate cannot open restricted deal room','permission error on confidential client sharepoint',
  'document vault access denied for paralegal','read-only access on matter when edit needed',
  'co-counsel access request for shared matter','external expert access to document review platform',
];
const LEG_PERM_SFXS = ['', ' please', ' urgent'];
LEG_PERM_BASES.forEach(function(b){
  LEG_PERM_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:permissions',cat:'leg-permissions'}); });
});


// ============================================================
// GOVERNMENT VERTICAL LAYER — Federal/provincial agencies, municipalities
// Apps: GCdocs / SharePoint GC / GCKey / MyKey / Phoenix / PeopleSoft /
//       SAP GC / Cisco WebEx Gov / MS365 GC / Teams GC / Adobe Acrobat Sign
// ============================================================
const govStart = out.length;

// --- GOV-1. Password / Authentication ---
const GOV_AUTH_BASES = [
  'gcdocs password reset needed at federal office','gckey login not working for employee',
  'phoenix pay system login failed','peopleSoft hr portal login locked out',
  'sap gc login credentials expired','government sharepoint login not working',
  'ms365 gc account locked for federal employee','mykey authentication broken for gc portal',
  'secure remote access credentials expired for public servant','psg portal login not accepted',
  'gc digital services account locked out','government email password expired on outlook gc',
  'esdc portal login not working for officer','cra business account login failed',
  'esss login not working for department','goc vpn credentials rejected for telework',
  'phoenix self serve login not working','compensation web application login broken',
  'service canada employee portal access denied','service now gc account locked out',
  'government lan account expired','idp login failing for gc collaboration tool',
  'teams gc authentication not working','government moodle account locked',
  'goc workplace technology login broken','ms gov cloud login failed for employee',
  'gc notify portal credentials rejected','sso broken for goc shared services',
];
const GOV_AUTH_SFXS = ['', ' please', ' urgent'];
GOV_AUTH_BASES.forEach(function(b){
  GOV_AUTH_SFXS.forEach(function(s){ out.push({q:b+s,expect:'password',cat:'gov-auth'}); });
});

// --- GOV-2. Hardware ---
const GOV_HW_BASES = [
  'government laptop not turning on for public servant','gc workstation frozen at desk',
  'government issued laptop battery dead','docking station not working at government office',
  'second monitor not detected at federal desk','gc tablet not powering on',
  'government usb security key not recognized','smart card reader not reading cac card',
  'piv card reader not working for federal employee','federal employee laptop overheating',
  'barcode scanner for asset tracking not working','government desktop computer frozen',
  'government issued phone not charging','projector not working in government meeting room',
  'hardened laptop not booting at classified desk','fingerprint reader not scanning for gov device',
  'gc laptop screen flickering on mobile worker','government desktop no display on monitor',
  'shared workstation login slow at service canada counter','government video conferencing unit offline',
];
const GOV_HW_SFXS = ['', ' please', ' urgent'];
GOV_HW_BASES.forEach(function(b){
  GOV_HW_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:hardware',cat:'gov-hardware'}); });
});

// --- GOV-3. VPN / Remote (telework, GC Secure Remote Access) ---
const GOV_VPN_BASES = [
  'goc vpn not connecting for telework employee','gc secure remote access not working',
  'cisco anyconnect failing on government laptop','remote desktop to office not connecting',
  'gc vpn drops when accessing gcdocs from home','telework vpn certificate error on laptop',
  'secure government vpn blocked at location','gc vpn token not syncing for mobile worker',
  'pulse secure not connecting for gc employee','anyconnect error on government issued device',
  'goc telework connection dropping regularly','remote access to gc sharepoint broken',
  'government vpn slow when accessing phoenix','gc vpn not reconnecting after sleep',
  'secure connection to classified network broken','remote work vpn authentication timing out',
];
const GOV_VPN_SFXS = ['', ' please', ' urgent'];
GOV_VPN_BASES.forEach(function(b){
  GOV_VPN_SFXS.forEach(function(s){ out.push({q:b+s,expect:'vpn',cat:'gov-vpn'}); });
});

// --- GOV-4. Performance ---
const GOV_PERF_BASES = [
  'phoenix pay system running very slow today','gcdocs extremely slow on large file upload',
  'gc sharepoint loading slowly for department','government laptop very slow on startup',
  'peopleSoft taking too long to load for hr','sap gc running slow at month end',
  'government pc slow when opening large spreadsheets','gc mail very slow for employee',
  'gc network sluggish in regional office','goc corporate wifi slow during all hands',
  'government issued device freezing on updates','eats system slow at peak hours',
  'gc collaboration platform lagging during meeting','government intranet very slow today',
  'goc teams calls laggy in regional office','government device sluggish on gc desktop',
  'federal employee laptop slow after update','service now gc ticket system very slow',
];
const GOV_PERF_SFXS = ['', ' please', ' urgent'];
GOV_PERF_BASES.forEach(function(b){
  GOV_PERF_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:performance',cat:'gov-performance'}); });
});

// --- GOV-5. OneDrive / File Access ---
const GOV_ONEDRIVE_BASES = [
  'gc sharepoint document library not accessible','gcdocs folder missing for department',
  'government shared drive not accessible from telework','policy documents folder missing on gc network',
  'gc onedrive sync not working on laptop','interdepartmental shared folder permissions denied',
  'classified document share not accessible','gc teams channel files not loading',
  'government repository not syncing to device','shared briefing folder disappeared on sharepoint gc',
  'government project folder permissions error','gc file share not accessible for officer',
  'ministerial briefing folder not accessible','gc records management system folder missing',
  'edrms folder not accessible for employee','government collaboration space files gone',
];
const GOV_ONEDRIVE_SFXS = ['', ' please', ' urgent'];
GOV_ONEDRIVE_BASES.forEach(function(b){
  GOV_ONEDRIVE_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onedrive',cat:'gov-onedrive'}); });
});

// --- GOV-6. Email ---
const GOV_EMAIL_BASES = [
  'gc email not delivering interdepartmental messages','outlook gc not syncing on government device',
  'government email blocked by spam filter','classified email not arriving for officer',
  'gc notify email not sending to citizen','protected b email encryption not working',
  'government email archiving not capturing messages','gc mail large attachment blocked',
  'public servant email not accessible on mobile','gc calendar invites not arriving from other dept',
  'outlook web access not loading for employee','goc email retention policy blocking send',
  'secure email to partner department failing','automated government notification email not arriving',
];
const GOV_EMAIL_SFXS = ['', ' please', ' urgent'];
GOV_EMAIL_BASES.forEach(function(b){
  GOV_EMAIL_SFXS.forEach(function(s){ out.push({q:b+s,expect:'mail',cat:'gov-email'}); });
});

// --- GOV-7. MFA ---
const GOV_MFA_BASES = [
  'government mfa app not generating code','gc two factor authentication broken for portal',
  'smart card authentication failing for federal employee','piv token not working for gc system',
  'duo mobile not working for goc login','rsa token dead for government system',
  'gc authenticator app lost on phone','hardware token not generating otp for gc portal',
  'mfa push not arriving for telework access','two step verification broken for gc email',
  'government security token expired','google authenticator broken for gc cloud',
];
const GOV_MFA_SFXS = ['', ' please', ' urgent'];
GOV_MFA_BASES.forEach(function(b){
  GOV_MFA_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:mfa',cat:'gov-mfa'}); });
});

// --- GOV-8. Onboarding ---
const GOV_ONBOARD_BASES = [
  'new public servant needs gc device provisioned','new hire at federal department it onboarding incomplete',
  'new officer needs gcdocs access set up','student placement needs government laptop configured',
  'new director needs full gc tenant access','new analyst needs sharepoint gc provisioned',
  'contract worker needs temporary gc network access','new employee needs phoenix self-serve set up',
  'incoming executive needs classified workstation','seconded officer needs it access at host department',
  'new administrative assistant needs full office setup','new graduate intake needs gc email and teams',
  'new indeterminate employee needs id and swipe access','new term position needs gc device and accounts',
];
const GOV_ONBOARD_SFXS = ['', ' please', ' urgent'];
GOV_ONBOARD_BASES.forEach(function(b){
  GOV_ONBOARD_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onboarding',cat:'gov-onboarding'}); });
});

// --- GOV-9. WiFi ---
const GOV_WIFI_BASES = [
  'government wifi not connecting at federal office','gc wireless drops during teams meeting',
  'wifi not working at regional service canada office','government guest wifi not accessible for visitor',
  'wireless dropping in government building','gc office wifi kicks off employee device',
  'wifi not available in meeting room at federal building','government wifi authentication failing on phone',
  'wireless signal weak in new wing of government office','employee wifi not reconnecting after break',
];
const GOV_WIFI_SFXS = ['', ' please', ' urgent'];
GOV_WIFI_BASES.forEach(function(b){
  GOV_WIFI_SFXS.forEach(function(s){ out.push({q:b+s,expect:'wifi',cat:'gov-wifi'}); });
});

// --- GOV-10. Printer ---
const GOV_PRINT_BASES = [
  'government printer jammed on policy batch','protected b document not printing at secure printer',
  'gc print job stuck in queue','multifunction printer offline at regional office',
  'government copier offline for department','large batch print failed for briefing notes',
  'gc secure print job expired before pickup','scanner not working on government mfp',
  'printer driver not installing on gc device','government printer not responding on network',
  'classified document printer offline','cabinet submission batch print failed',
];
const GOV_PRINT_SFXS = ['', ' please', ' urgent'];
GOV_PRINT_BASES.forEach(function(b){
  GOV_PRINT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'printer',cat:'gov-printer'}); });
});

// --- GOV-11. Networking ---
const GOV_NET_BASES = [
  'government lan down at regional office','ethernet not working at federal desk',
  'gc network switch down on floor','network not accessible in government building wing',
  'gc trusted network not routing correctly','network drops when connecting classified device',
  'internet not accessible at government office','lan port dead at federal employee desk',
  'gc network outage at department headquarters','voip not working on gc network for employees',
];
const GOV_NET_SFXS = ['', ' please', ' urgent'];
GOV_NET_BASES.forEach(function(b){
  GOV_NET_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:networking',cat:'gov-networking'}); });
});

// --- GOV-12. Out-of-scope ---
const GOV_DEFAULT_BASES = [
  'what is the policy on overtime for federal employees','how do i submit a grievance',
  'when is the next public service performance review','what are the values and ethics guidelines',
  'how do i apply for a language training course','what is the collective agreement for my group',
  'how to request maternity leave as public servant','what is the pay increment schedule for ec group',
  'how to file a harassment complaint','when is the next interdepartmental transfer posting',
];
const GOV_DEFAULT_SFXS = ['', ' please', '?'];
GOV_DEFAULT_BASES.forEach(function(b){
  GOV_DEFAULT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'default',cat:'gov-default'}); });
});

console.error('Government vertical layer added:', out.length - govStart, 'scenarios');
console.error('10K Corpus size:', out.length);

// ============================================================
// MANUFACTURING VERTICAL LAYER — Factories, plants, warehouses, MES
// Apps: SAP PM / Maximo / Infor EAM / Plex / Epicor / Ignition SCADA /
//       FactoryTalk / OSIsoft PI / Rockwell Studio 5000 / JD Edwards
// ============================================================
const mfgStart = out.length;

// --- MFG-1. Password / Authentication ---
const MFG_AUTH_BASES = [
  'sap pm login not working on shop floor','maximo workorder login locked out for technician',
  'mes system login expired for operator','epicor login not working at manufacturing site',
  'plex erp authentication failed for planner','scada hmi login not accepting credentials',
  'factorytalk login credentials rejected for maintenance','jd edwards login locked for purchasing',
  'infor eam locked out for asset manager','plant network account expired for line worker',
  'shift supervisor login not working on floor terminal','production tracking system password expired',
  'quality management system login broken for inspector','inventory system login not working at warehouse',
  'time and attendance kiosk not accepting pin','forklift terminal login not working in warehouse',
];
const MFG_AUTH_SFXS = ['', ' please', ' urgent'];
MFG_AUTH_BASES.forEach(function(b){
  MFG_AUTH_SFXS.forEach(function(s){ out.push({q:b+s,expect:'password',cat:'mfg-auth'}); });
});

// --- MFG-2. Hardware ---
const MFG_HW_BASES = [
  'shop floor terminal frozen on production line','ruggedized laptop not turning on in plant',
  'barcode scanner not reading labels at receiving','handheld rf terminal not booting in warehouse',
  'production screen frozen at line station','forklift mounted computer not starting',
  'panel pc locked up at assembly station','thermal label printer not working at shipping',
  'tablet not charging on plant floor','industrial touchscreen not responding at hmi',
  'warehouse scanner gun not detected on charger','weigh scale display not connecting to system',
  'camera on quality inspection station offline','rugged tablet screen cracked and unresponsive',
  'time clock kiosk frozen in breakroom','workorder terminal locked at maintenance bay',
  'cnc machine control monitor not displaying','desktop frozen in engineering office at plant',
];
const MFG_HW_SFXS = ['', ' please', ' urgent'];
MFG_HW_BASES.forEach(function(b){
  MFG_HW_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:hardware',cat:'mfg-hardware'}); });
});

// --- MFG-3. VPN / Remote ---
const MFG_VPN_BASES = [
  'vpn not connecting to plant systems from office','remote access to scada not working for engineer',
  'anyconnect failing on plant maintenance laptop','remote desktop to mes server not connecting',
  'vpn drops when accessing plant historian','contractor vpn not working at facility',
  'secure remote access to plc programming software broken','vpn certificate error on plant engineer laptop',
  'remote monitoring connection to plant floor lost','vpn slow when accessing manufacturing erp from home',
  'industrial vpn gateway not routing correctly','remote session to factorytalk dropping',
];
const MFG_VPN_SFXS = ['', ' please', ' urgent'];
MFG_VPN_BASES.forEach(function(b){
  MFG_VPN_SFXS.forEach(function(s){ out.push({q:b+s,expect:'vpn',cat:'mfg-vpn'}); });
});

// --- MFG-4. Performance ---
const MFG_PERF_BASES = [
  'sap pm very slow at start of shift','mes system slow during peak production',
  'epicor taking too long to load workorders','plant floor terminal slow on shift change',
  'plex erp running slow for planner','warehouse management system sluggish at receiving',
  'quality system slow during audit batch','production tracking slow at end of shift',
  'shop floor terminal lagging on barcode scan','infor eam slow when generating work orders',
  'engineering laptop slow running cad software','plant historian data loading very slowly',
  'scada trending slow when multiple engineers connected','maximo report taking too long to generate',
];
const MFG_PERF_SFXS = ['', ' please', ' urgent'];
MFG_PERF_BASES.forEach(function(b){
  MFG_PERF_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:performance',cat:'mfg-performance'}); });
});

// --- MFG-5. OneDrive / File Access ---
const MFG_ONEDRIVE_BASES = [
  'sop documents folder not accessible on plant network','engineering drawing folder missing on sharepoint',
  'quality records shared drive not accessible','production schedule file not syncing on onedrive',
  'maintenance procedure folder permissions denied','work instruction documents folder gone',
  'plant shared drive not accessible from floor terminal','technical drawing folder missing for engineer',
  'npi documents not accessible in shared drive','supplier quality docs folder permissions error',
  'calibration records folder not accessible','equipment manual folder missing from network drive',
];
const MFG_ONEDRIVE_SFXS = ['', ' please', ' urgent'];
MFG_ONEDRIVE_BASES.forEach(function(b){
  MFG_ONEDRIVE_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onedrive',cat:'mfg-onedrive'}); });
});

// --- MFG-6. Email ---
const MFG_EMAIL_BASES = [
  'plant manager email not delivering to corporate','supplier email not arriving for buyer',
  'outlook not working on plant floor pc','automated workorder email not sending',
  'quality alert email not arriving for team','shift report email not delivering',
  'email to vendor blocked at plant','maintenance alert email not sending from mes',
  'customer delivery email bouncing back','production schedule email not sending',
  'plant email not syncing on rugged tablet','po approval email not arriving for manager',
];
const MFG_EMAIL_SFXS = ['', ' please', ' urgent'];
MFG_EMAIL_BASES.forEach(function(b){
  MFG_EMAIL_SFXS.forEach(function(s){ out.push({q:b+s,expect:'mail',cat:'mfg-email'}); });
});

// --- MFG-7. MFA ---
const MFG_MFA_BASES = [
  'two factor authentication not working for mes login','mfa token expired for plant erp',
  'duo push not arriving for plant vpn','authenticator app lost for manufacturing system',
  'rsa token broken for scada access','hardware token not working for remote plant access',
  'mfa push not arriving for epicor login','google authenticator broken for sap at plant',
];
const MFG_MFA_SFXS = ['', ' please', ' urgent'];
MFG_MFA_BASES.forEach(function(b){
  MFG_MFA_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:mfa',cat:'mfg-mfa'}); });
});

// --- MFG-8. Onboarding ---
const MFG_ONBOARD_BASES = [
  'new operator needs mes system access','new technician it onboarding not complete at plant',
  'new maintenance tech needs maximo account','new production supervisor needs all systems set up',
  'new quality inspector needs qms access','new engineer needs cad software and vpn configured',
  'contract worker needs temporary plant network access','new shift lead needs scada view access',
  'new warehouse picker needs rf terminal account','new plant manager needs full system access',
  'new buyer needs epicor and email configured','summer student needs read-only plant access set up',
];
const MFG_ONBOARD_SFXS = ['', ' please', ' urgent'];
MFG_ONBOARD_BASES.forEach(function(b){
  MFG_ONBOARD_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:onboarding',cat:'mfg-onboarding'}); });
});

// --- MFG-9. WiFi ---
const MFG_WIFI_BASES = [
  'wifi not connecting on plant floor','wireless drops during production run',
  'rf scanners dropping wifi in warehouse','wifi not available in new section of plant',
  'wireless signal weak at shipping dock','forklift terminal losing wifi in warehouse',
  'plant wifi authentication failing on tablet','wifi drops during shift in assembly area',
  'access point down in warehouse section','wireless coverage poor in manufacturing cell',
];
const MFG_WIFI_SFXS = ['', ' please', ' urgent'];
MFG_WIFI_BASES.forEach(function(b){
  MFG_WIFI_SFXS.forEach(function(s){ out.push({q:b+s,expect:'wifi',cat:'mfg-wifi'}); });
});

// --- MFG-10. Printer ---
const MFG_PRINT_BASES = [
  'label printer jammed on production line','thermal printer not printing shipping labels',
  'workorder print job stuck in queue at plant','barcode label printer not detected on network',
  'production report printer offline in manager office','zebra printer not printing at receiving dock',
  'quality inspection label printer offline','shipping label printer driver not installing',
  'parts traveler print failed on shop floor','batch print for packing slips stuck in queue',
  'plant network printer offline for maintenance team','thermal receipt printer not printing at kiosk',
];
const MFG_PRINT_SFXS = ['', ' please', ' urgent'];
MFG_PRINT_BASES.forEach(function(b){
  MFG_PRINT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'printer',cat:'mfg-printer'}); });
});

// --- MFG-11. Networking ---
const MFG_NET_BASES = [
  'plant floor network down on production line','ethernet not working at assembly station',
  'industrial network switch down in plant','lan down in warehouse section',
  'plant ops network not routing to corporate','network drops on cnc machine control',
  'industrial ethernet port dead at hmi','plant network outage at receiving dock',
  'scada network communication lost to plc','production cell network not connecting to mes',
];
const MFG_NET_SFXS = ['', ' please', ' urgent'];
MFG_NET_BASES.forEach(function(b){
  MFG_NET_SFXS.forEach(function(s){ out.push({q:b+s,expect:'kb:networking',cat:'mfg-networking'}); });
});

// --- MFG-12. Out-of-scope ---
const MFG_DEFAULT_BASES = [
  'what is the current production schedule for line 3','how do i submit a safety incident report',
  'what is the changeover time for product x','how do i request raw material reorder',
  'what is our oee target for the quarter','how to escalate a machine breakdown to maintenance',
  'what is the takt time for current order','how do i file a workers compensation claim',
  'what are the quality hold procedures','when is the next preventive maintenance due',
];
const MFG_DEFAULT_SFXS = ['', ' please', '?'];
MFG_DEFAULT_BASES.forEach(function(b){
  MFG_DEFAULT_SFXS.forEach(function(s){ out.push({q:b+s,expect:'default',cat:'mfg-default'}); });
});

console.error('Manufacturing vertical layer added:', out.length - mfgStart, 'scenarios');
console.error('10K Corpus size:', out.length);
module.exports = out;


