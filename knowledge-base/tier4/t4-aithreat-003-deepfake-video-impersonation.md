---
id: t4-aithreat-003
title: "Deepfake Video / Executive Impersonation (BEC 2.0)"
category: ai-security
support_level: L3
tech_generation: tier-4
tier4_pack: ai-threat
severity: critical
estimated_time_minutes: 60
audience: it-technician
os_scope: ["Windows 11","macOS","cross-platform"]
prerequisites: []
keywords: ["deepfake video","executive impersonation","fake video call","bec 2.0","business email compromise","callback verification protocol","out of band verification","synthetic media","video conference fraud","liveness check","ceo deepfake","high risk request verification"]
related_articles: ["t4-aithreat-001","t4-aithreat-002","t4-aigov-006"]
escalation_trigger: "A video call or recording of an executive directs an urgent payment, sensitive disclosure, or access change that cannot be verified out-of-band."
last_updated: 2026-06-24
version: 1.0
---

## 1. Symptoms
- A live video call or recorded clip appears to show an executive/colleague directing an urgent, sensitive action (payment, data disclosure, access grant).
- The "executive" on a video meeting pressures staff to act now and discourages independent verification.
- Subtle visual oddities: unnatural blinking, lip-sync mismatch, lighting/edge artifacts around the face, stiff or looping movement, audio that does not quite match mouth movements.
- The meeting was set up through an unusual channel or invites participants who would not normally be together.
- Finance/staff report "I was on a video call with the CEO and they told me to..." — a BEC-style scenario with video added.

## 2. Likely Causes
- **Deepfake video synthesis:** attackers generate or real-time-render a convincing video likeness of a trusted person.
- **BEC 2.0:** classic business email compromise upgraded with synthetic voice/video to defeat "but I saw/heard them" skepticism.
- **Authority + urgency + secrecy:** social-engineering pressure that suppresses verification.
- **Reconnaissance:** attackers use public video/audio and org knowledge to build a believable impersonation and pretext.

## 3. Questions To Ask User
- What was requested on the call, and how urgent/confidential was it framed?
- How was the meeting initiated, and through what platform/invite?
- Did you notice visual/audio anomalies (lip-sync, blinking, artifacts, lag)?
- Did the "executive" resist any verification, callback, or simple liveness check?
- Has any action been taken yet (payment, disclosure, access change)?

## 4. Troubleshooting Steps
1. **Do not act on the video's instructions** until identity is confirmed out-of-band.
2. **Look for detection cues:** lip-sync drift, irregular blinking, facial-edge/lighting artifacts, unnatural head/body motion, audio-video desync, evasive responses to spontaneous questions.
3. **Attempt a live liveness check** (see protocol below) — deepfakes often fail real-time, unscripted interaction.
4. **Check whether action already occurred;** if so, pivot to incident response/fraud handling immediately.

## 5. Resolution Steps

### Callback-Verification Protocol (out-of-band identity verification for high-risk requests)
Use this step-by-step procedure whenever a video/voice/message request involves money, credentials, access, or sensitive data:

1. **Pause and decline to act on the spot.** State that policy requires verification for this type of request; a legitimate requester will accept this.
2. **Do not use any contact details from the call/invite.** Treat caller ID, chat handles, and meeting links as untrusted.
3. **Independently look up the person** in your own trusted directory (HR/IT system), not from the message.
4. **Initiate contact yourself** on a *known* channel — call the person's known number or message them through an established internal channel.
5. **Confirm the request** in that separate channel: "Did you just ask me on video to wire $X / reset Y / share Z?"
6. **Apply a verification challenge:** a pre-agreed code word/passphrase, or a question only the real person can answer that is not discoverable online.
7. **For high-value/irreversible actions, require dual-control:** a second authorized approver must independently confirm via their own out-of-band check before execution.
8. **If you cannot reach the person or verification fails:** do not proceed. Escalate to security/management.
9. **Document** the request, the cues observed, and the verification outcome.

### If action was already taken (fraud in progress)
- For payments/wires: contact the bank immediately to recall/freeze — recovery windows are short.
- For data/access: treat as a breach — revoke access, reset credentials, investigate scope, engage IR.
- Notify security leadership and follow incident reporting (and authorities/bank as appropriate).

## 6. Verification Steps
- The request was confirmed (or refused) via an attacker-independent channel before any action.
- The callback-verification protocol and dual-control were applied to the high-risk request.
- Staff can recite the protocol steps and the code-word challenge from memory.
- If fraud occurred, bank recall and IR were engaged without delay and the event is documented.

## 7. Escalation Trigger
Escalate to L3 / security and the relevant business/finance owner immediately if a video call or recording of an executive directs an urgent payment, sensitive disclosure, or access change that cannot be verified out-of-band — and treat any completed action as active fraud/breach.

## 8. Prevention Tips
- Train staff that seeing/hearing a familiar face or voice on video is **not** proof of identity — video can be faked.
- Make the callback-verification protocol and dual-control mandatory for all money/credential/access/data requests, regardless of who appears to ask.
- Establish executive/finance **code words** for verbal/video authorization.
- Encourage spontaneous liveness checks on suspicious calls (ask the person to do something unscripted).
- Reduce unnecessary public exposure of executive video/audio where feasible.
- Run BEC 2.0 / deepfake simulation drills so the protocol is reflexive under pressure.

## 9. User-Friendly Explanation
Attackers can now fake a video of your boss on a call, telling you to send money or hand over access — and it can look real. Because your eyes and ears can be fooled, the rule is the same as for any high-stakes request: stop, and verify through a separate, trusted channel before you act. Hang up or step away, look the person up yourself, call them on a number you already have, and use a code word. Real requests survive that check; fakes do not.

## 10. Internal Technician Notes
- The decisive control is the **callback-verification protocol** (section 5) plus dual-control — process beats trying to visually spot a deepfake, since quality keeps improving.
- Visual cues (lip-sync, blinking, artifacts) are useful early warnings, not reliable proof; never rely on "it looked fake/real" as the gate.
- "BEC 2.0" = traditional business email compromise enhanced with synthetic voice/video; the money-movement controls from anti-BEC programs still apply.
- Pairs directly with t4-aithreat-002 (voice) — same out-of-band/dual-control playbook across channels.
- Meeting links and invites are untrusted contact paths; verification must originate from the recipient using known directory data.

## 11. Related KB Articles
- t4-aithreat-001 — Prompt Injection & RAG/Data Leakage
- t4-aithreat-002 — AI Voice Phishing (Vishing) & Deepfake Audio
- t4-aigov-006 — Shadow-AI Discovery

## 12. Keywords / Search Tags
deepfake video, executive impersonation, fake video call, BEC 2.0, business email compromise, callback-verification protocol, out-of-band verification, synthetic media, video conference fraud, liveness check, ceo deepfake, dual control
