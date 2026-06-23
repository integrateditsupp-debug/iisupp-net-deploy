// RUN 35-2 — routing iter 7 for the live aria-kb-query surface (assets/aria-kb-retrieval.mjs).
// Proves the security + wifi + printer routing lifts, and that vertical-app "wont print" still falls through.
import assert from "node:assert/strict";
import { routeIds } from "../../assets/aria-kb-retrieval.mjs";

const has = (q, id) => routeIds(q).includes(id);
let n = 0; const t = () => { n++; };

// 1 — kb:security: ransomware families + malware popups → l2-malware-001.
for (const q of [
  "lockbit hit our file server", "wannacry style worm", "conti ransom note", "ryuk encrypted everything",
  "virus warning popup keeps appearing", "trojan detected on my screen", "malware on my laptop",
  "i got a phishing email and clicked the link", "encrypted all my files", "ransomware on my pc"
]) assert.ok(has(q, "l2-malware-001"), `security/malware: "${q}" → l2-malware-001`);
t();

// 2 — kb:security: account-takeover signals → l3-security-001.
for (const q of [
  "my account is compromised", "someone has access to my mailbox", "impossible travel alert on my account",
  "mfa bombing all night", "suspicious activity on my account", "sign-in from russia", "account takeover"
]) assert.ok(has(q, "l3-security-001"), `security/takeover: "${q}" → l3-security-001`);
t();

// 3 — wifi: connectivity phrasings WITHOUT the word "wifi" → l1-wifi-001.
for (const q of [
  "no internet access", "internet keeps going out", "internet is down", "connected but no internet",
  "network keeps timing out", "office wifi slow", "stuck on 2.4 ghz", "can't see 5g network",
  "wireless adapter not found", "wifi card missing"
]) assert.ok(has(q, "l1-wifi-001"), `wifi: "${q}" → l1-wifi-001`);
t();

// 4 — printer: real printer issues route; bare vertical "wont print" FALLS THROUGH (no printer routing).
for (const q of ["my printer is offline", "print queue stuck", "print spooler crashed", "add a printer", "printer jam"])
  assert.ok(has(q, "l1-printer-001"), `printer: "${q}" → l1-printer-001`);
for (const q of ["REUTERS TRADING WONT PRINT CONFIRM", "EHR wont print the chart", "the trade blotter wont print"])
  assert.ok(!has(q, "l1-printer-001") && !has(q, "l1-printer-002"), `vertical fallthrough: "${q}" must NOT route to printer`);
t();

// 5 — no regression: print server / printnightmare still route to the L2 printers article, not L1.
assert.ok(has("print server printnightmare 0x0000011b", "l2-printers-001"), "print server → l2-printers-001");
t();

// 6 — RUN 35-7: bare "authenticator" + phone-loss MFA phrasings (surfaced in the live sample) route to MFA.
for (const q of ["lost my authenticator phone", "authenticator app not working", "reset authenticator",
  "got a new phone and my mfa is