// netlify/functions/aria-pattern-router.mjs
// ARIA Pattern-First Router - AROC operating law §4/§5 ("pattern match BEFORE retrieval").
// POST /.netlify/functions/aria-pattern-router
//   body: { query, context?, _trace? }
//   -> { answer, state, shortCode?, recipe?, confidence, source, fallthrough, ts }
//
// Pure deterministic. NO external API, NO secrets, NO LLM, NO blobs -> $0, testable.
// First move on a message: extract operational signals, hash to a compressed symbolic
// operational state (AROC §4 encoding: DOMAIN.CHAIN), score against a seeded hot-pattern
// dictionary; >= threshold returns the symbolic state + a curated recipe with O(1)
// latency and zero cost. Below threshold returns fallthrough:true so the mesh-router
// cascades to aria-research / RAG / LLM. This is the wedge that cuts latency, cost and
// hallucination surface (AROC §5/§11).
//
// Registered in mesh-registry.json as status:"planned" until reviewed + flipped to "active".

// AROC §4 domain prefixes
const DOMAINS = [
  ['VPN',  /\bvpn\b/i],
  ['EML',  /\b(email|outlook|mail|smtp|imap|exchange|m365 mail)\b/i],
  ['PRT',  /\b(print|printer|spooler|scan)\b/i],
  ['NET',  /\b(wi-?fi|network|internet|dns|dhcp|ethernet|router|no connection|offline)\b/i],
  ['AUT',  /\b(password|login|sign ?in|mfa|2fa|locked out|credential|sso|authenticat)\b/i],
  ['OS',   /\b(windows|mac|boot|bsod|blue screen|update|slow|freeze|crash|startup)\b/i],
  ['M365', /\b(teams|onedrive|sharepoint|m365|office 365|excel|word|outlook)\b/i],
  ['SEC',  /\b(phishing|malware|virus|ransomware|breach|suspicious|spam|hacked)\b/i],
  ['HW',   /\b(screen|monitor|keyboard|mouse|battery|charging|won'?t turn on|hardware|dead)\b/i]
];

// Seeded hot-pattern dictionary: symbolic state -> {short, recipe[], baseConf}
// (AROC §4: same long-form firing >=3x earns a deterministic short code.)
const PATTERNS = [
  { match: /vpn.*(drop|disconnect|keeps)/i, state: 'VPN.CONN.DROP', short: 'V-CD-01', conf: 0.82,
    recipe: ['Confirm ISP link is stable (run a ping to 8.8.8.8 for 60s).', 'Switch VPN protocol (UDP↔TCP) in the client.', 'Raise the idle-timeout on the client profile.', 'If drops persist, open an ISP ticket and hand to L2.'] },
  { match: /vpn.*(token|expired|auth|password)/i, state: 'VPN.AUTH.TOKEN', short: 'V-ATR-01', conf: 0.8,
    recipe: ['Sign out of the VPN client fully.', 'Clear the cached credential / token.', 'Re-authenticate; if MFA, re-enrol the device.', 'Verify the cert has not expired.'] },
  { match: /(outlook|email).*(won'?t send|stuck|spinning|not sending)/i, state: 'EML.SEND.STALL', short: 'E-SS-01', conf: 0.8,
    recipe: ['Restart Outlook.', 'Clear the cached credential in Credential Manager.', 'Re-add the account (re-pins the corporate cert).', 'Send/Receive → test a message.'] },
  { match: /(outlook|search).*(slow|crawl).*(update|windows)/i, state: 'EML.IDX.CORRUPT', short: 'E-IC-01', conf: 0.78,
    recipe: ['Confirm a recent Windows update installed.', 'Rebuild the Outlook/Windows search index.', 'Wait for re-index (~90s).', 'Verify search responsiveness.'] },
  { match: /print.*(nothing|won'?t print|queue|stuck|offline)/i, state: 'PRT.SPOOL.STUCK', short: 'P-SS-01', conf: 0.78,
    recipe: ['Stop the Print Spooler service.', 'Clear %systemroot%\\System32\\spool\\PRINTERS.', 'Start the Print Spooler service.', 'Reprint a test page.'] },
  { match: /(wi-?fi|internet|network).*(slow|drop|no connection|offline)/i, state: 'NET.WIFI.DEGRADE', short: 'N-WD-01', conf: 0.74,
    recipe: ['Forget + rejoin the SSID.', 'Renew the IP (ipconfig /release && /renew).', 'Flush DNS (ipconfig /flushdns).', 'Test on another device to isolate AP vs client.'] },
  { match: /(locked out|can'?t (log ?in|sign ?in)|password.*(reset|forgot))/i, state: 'AUT.PWD.LOCKOUT', short: 'A-PL-01', conf: 0.76,
    recipe: ['Verify identity per policy.', 'Check the account is not disabled/locked in AD/M365.', 'Trigger a secure self-service reset or admin reset.', 'Confirm MFA still enrolled.'] },
  { match: /(blue screen|bsod|crash|freeze).*(boot|start|random)?/i, state: 'OS.STABILITY.CRASH', short: 'O-SC-01', conf: 0.7,
    recipe: ['Note the BSOD stop code.', 'Boot to Safe Mode.', 'Roll back the most recent driver/update.', 'Run sfc /scannow + memory diagnostic; escalate hardware if it recurs.'] },
  { match: /(phishing|suspicious (email|link)|is this (a )?scam)/i, state: 'SEC.PHISH.CHECK', short: 'S-PC-01', conf: 0.8,
    recipe: ['Do NOT click links or open attachments.', 'Check sender address vs display name.', 'Hover links to inspect the true domain.', 'Report to IT and delete; reset password if anything was entered.'] },
  { match: /(teams|zoom).*(no (audio|sound|mic)|can'?t hear|mic not working|microphone)/i, state: 'M365.TEAMS.AUDIO', short: 'M-TA-01', conf: 0.76,
    recipe: ['Check the OS sound settings — correct input/output device selected.', 'In the app device settings, pick the right mic/speaker and send a test.', 'Confirm OS mic privacy permission allows the app.', 'Restart the app; if USB headset, reseat it.'] },
  { match: /onedrive.*(sync|stuck|not updating|won'?t sync|pending)/i, state: 'M365.ONEDRIVE.SYNC', short: 'M-OS-01', conf: 0.76,
    recipe: ['Check the OneDrive tray icon for the specific error.', 'Pause and resume sync.', 'Confirm free disk space and that the file path is under the length limit.', 'If stuck, unlink and relink the account (no data loss).'] },
  { match: /(mfa|2fa|authenticator).*(no code|not receiving|didn'?t get|not working|locked)/i, state: 'AUT.MFA.CODE', short: 'A-MC-01', conf: 0.76,
    recipe: ['Confirm device time is set to automatic (TOTP needs accurate clock).', 'Try the push or a backup method.', 'Check signal/Wi-Fi for SMS or push delivery.', 'If device lost, verify identity and re-enrol MFA per policy.'] },
  { match: /password.*(expired|expir)/i, state: 'AUT.PWD.EXPIRED', short: 'A-PE-01', conf: 0.78,
    recipe: ['Change the password at the OS/M365 prompt meeting complexity rules.', 'Update saved credentials on phone/Outlook/VPN to stop lockouts.', 'Clear cached creds in Credential Manager if prompts persist.'] },
  { match: /(computer|pc|laptop|machine).*(very slow|so slow|running slow|sluggish)/i, state: 'OS.PERF.SLOW', short: 'O-PS-01', conf: 0.72,
    recipe: ['Open Task Manager → sort by CPU/Memory/Disk to find the hog.', 'Close/uninstall the offending startup app.', 'Confirm free disk space (>10%).', 'Reboot to apply pending updates; if disk at 100%, check for failing drive.'] },
  { match: /(disk|drive|storage|c drive).*(full|out of space|no space|low space)/i, state: 'OS.DISK.FULL', short: 'O-DF-01', conf: 0.78,
    recipe: ['Run Disk Cleanup / Storage Sense.', 'Empty Recycle Bin and clear %temp%.', 'Move large files to OneDrive/network and use Files On-Demand.', 'Uninstall unused apps; clear old Windows.old if present.'] },
  { match: /(can'?t access|access denied|permission).*(shared (drive|folder)|sharepoint|network drive)/i, state: 'M365.SP.ACCESS', short: 'M-SA-01', conf: 0.74,
    recipe: ['Confirm the user is in the correct security group.', 'Re-map the drive / re-open the SharePoint link after sign-out.', 'Check the resource was not moved or permissions changed.', 'If still denied, request access grant via the owner + log a ticket.'] },
  { match: /(certificate|cert).*(expired|invalid|warning|not trusted|error)/i, state: 'SEC.CERT.EXPIRED', short: 'S-CE-01', conf: 0.74,
    recipe: ['Confirm device date/time is correct.', 'Identify the service and whether its cert truly expired.', 'Re-pull the updated cert / re-enrol the device profile.', 'If internal CA, push the renewed root via policy; escalate to L2 if systemic.'] }
];

function symbolicState(q) {
  // domain prefix
  let domain = 'GEN';
  for (const [d, re] of DOMAINS) if (re.test(q)) { domain = d; break; }
  // chain tokens: a few salient operational words
  const tokens = (q.toLowerCase().match(/\b(drop|disconnect|token|expired|auth|send|stuck|slow|index|spool|queue|offline|lockout|reset|crash|boot|phish|scam|update|password|cert)\b/g) || []);
  const chain = Array.from(new Set(tokens)).slice(0, 4).map((t) => t.toUpperCase());
  return chain.length ? `${domain}.${chain.join('.')}` : domain;
}

function patternFirst(query) {
  const q = String(query || '');
  const state = symbolicState(q);
  let best = null;
  for (const p of PATTERNS) {
    if (p.match.test(q)) { if (!best || p.conf > best.conf) best = p; }
  }
  if (best && best.conf >= 0.7) {
    return {
      answer: best.recipe.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      state: best.state, shortCode: best.short, recipe: best.recipe,
      confidence: best.conf, source: 'pattern-first', fallthrough: false
    };
  }
  // no high-confidence pattern -> let the mesh fall through to research/RAG/LLM
  return {
    answer: `No high-confidence operational pattern matched (state ${state}). Falling through to research/retrieval.`,
    state, confidence: 0.4, source: 'pattern-first', fallthrough: true
  };
}

export default async (req) => {
  const cors = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, service: 'aria-pattern-router', law: 'AROC §4/§5', patterns: PATTERNS.length }), { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: cors });

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const out = patternFirst(body.query);
  out.ts = Date.now();
  return new Response(JSON.stringify(out), { status: 200, headers: cors });
};

export { patternFirst, symbolicState };
