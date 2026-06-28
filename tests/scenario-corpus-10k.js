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

console.error('Finance vertical layer added:', out.length - finStart, 'scenarios');
console.error('10K Corpus size:', out.length);
module.exports = out;
