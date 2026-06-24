---
id: t4-aithreat-002
title: "AI Voice Phishing (Vishing) & Deepfake Audio"
category: ai-security
support_level: L3
tech_generation: tier-4
tier4_pack: ai-threat
severity: critical
estimated_time_minutes: 60
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["ai vishing","voice cloning","deepfake audio","wire transfer fraud","ceo fraud","credential theft","caller verification","out of band verification","social engineering","synthetic voice","phone fraud","callback protocol"]
related_articles: ["t4-aithreat-001","t4-aithreat-003","t4-aigov-006"]
escalation_trigger: "A caller using a recognized voice requests an urgent wire transfer, credential reset, or MFA bypass that cannot be verified out-of-band."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- A phone call or voicemail uses the recognizable voice of an executive, colleague, vendor, or family member to push an urgent request.
- The request is high-stakes and time-pressured: wire a payment, change banking details, reset a password, read out an MFA code, or grant access.
- The voice is convincing but the *channel* is unusual (unexpected number, "I'm in a meeting, can't video").
- The caller resists verification, discourages callbacks, and stresses secrecy/urgency.
- Finance or helpdesk reports a "the CEO called and told me to..." situation.

## 2. Likely Causes
- **Voice cloning:** attackers synthesize a target's voice from short public audio (calls, videos, social media) to impersonate them.
- **Social engineering:** urgency + authority + secrecy short-circuits normal checks.
- **Targeted intelligence:** attackers research org structure, vendors, and pending payments to make the pretext believable.
- **Helpdesk/MFA targeting:** vishing aimed at resetting credentials or bypassing MFA to gain access.

## 3. Questions To Ask User
- What exactly was requested, and how urgent/secret did the caller insist it be?
- What number did the call come from, and was it the expected channel for this person?
- Did the caller avoid or resist a callback to a known number, or avoid video?
- Has any action been taken yet (payment sent, credentials reset, code shared)?
- Are there pending payments or vendor changes an attacker could have known about?

## 4. Troubleshooting Steps
1. **Do not act on the call's instructions** until identity is verified out-of-band.
2. **Note red flags:** urgency, secrecy, unusual channel, pressure against verification, request type (money/credentials/access).
3. **Check whether action already occurred.** If a payment was sent or credentials/MFA shared, pivot to incident response immediately.
4. **Verify out-of-band:** independently reach the supposed caller via a *known* number/channel — not one the caller provided.

## 5. Resolution Steps
1. **If nothing has happened yet:** halt the request, verify out-of-band, and only proceed once identity is independently confirmed.
2. **Callback verification:** hang up and call back on a number from your own directory/records, never a number the caller supplied.
3. **Use a verification challenge:** a pre-agreed code word/passphrase or a question only the real person can answer (and that is not findable online).
4. **Enforce dual-control for money/credentials:** any wire, banking-detail change, credential reset, or MFA bypass requires a second approver and out-of-band confirmation — no single-call authorization.
5. **If action already taken (fraud in progress):**
   - For wires: contact the bank immediately to recall/freeze; time is critical.
   - For credentials/MFA: treat as account compromise — reset, revoke sessions/tokens, investigate access.
   - Engage security IR and management.
6. **Report:** preserve the voicemail/call details and report internally (and to relevant authorities/bank as appropriate).

## 6. Verification Steps
- The request was independently confirmed via a known, attacker-independent channel before any action.
- Dual-control was applied to any financial/credential request.
- If fraud occurred, the bank/account-recovery and IR processes were engaged without delay.
- Staff can describe the callback protocol and the code-word challenge.
- The incident is documented and reported per policy.

## 7. Escalation Trigger
Escalate to L3 / security and finance leadership immediately if a caller using a recognized voice requests an urgent wire transfer, banking change, credential reset, or MFA bypass that cannot be verified out-of-band — and treat any completed action as active fraud/account compromise.

## 8. Prevention Tips
- Train staff that a familiar voice is **not** proof of identity — voices can be cloned.
- Mandate out-of-band callback verification and dual-control for all money/credential/access requests.
- Establish family/exec/vendor **code words** for high-risk verbal requests.
- Limit what executives' voices and details are exposed publicly where feasible.
- Harden helpdesk identity-verification so vishing cannot drive credential/MFA resets.
- Run simulated vishing drills.

## 9. User-Friendly Explanation
Criminals can now copy someone's voice from a few seconds of audio and call you sounding exactly like your boss or a vendor, demanding an urgent payment or password. The voice is fake even though it sounds real. The defense is simple: never act on an urgent voice request without checking through a separate channel you trust — hang up and call the person back on their known number, or use a pre-agreed code word. Real, legitimate requests will survive a quick verification; scams fall apart under it.

## 10. Internal Technician Notes
- The core control is procedural, not technical: out-of-band callback + dual-control beats any "does it sound real?" judgment.
- Code-word/passphrase challenges are highly effective and cheap; push clients to adopt them for finance and exec comms.
- Caller ID can be spoofed; the callback must use a number *you* hold, never one offered on the call.
- Detection tools for synthetic audio exist but are not reliable enough to be the primary control — rely on process.
- Completed wire fraud is time-critical: bank recall windows are short. For credential/MFA compromise, coordinate with t4-aithreat-001 (access abuse) and IR.

## 11. Related KB Articles
- t4-aithreat-001 — Prompt Injection & RAG/Data Leakage
- t4-aithreat-003 — Deepfake Video / Executive Impersonation
- t4-aigov-006 — Shadow-AI Discovery

## 12. Keywords / Search Tags
ai vishing, voice cloning, deepfake audio, wire transfer fraud, ceo fraud, credential theft, caller verification, out-of-band verification, social engineering, synthetic voice, callback protocol, code word challenge
