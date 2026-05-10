# ARIA Voice Agent — ElevenLabs Conversational AI Setup

Files in this folder are paste-ready for ElevenLabs Conversational AI.

## Order of operations
1. Sign up at https://elevenlabs.io → Creator plan or higher → enable Conversational AI.
2. Sign up at https://www.twilio.com → buy a 416 or 647 local number (~$1.15/mo, instant). DO NOT buy toll-free yet (5–10 day verification).
3. In ElevenLabs, create a new Agent. Voice = `Sarah` (or `Charlotte`). Latency profile = Low.
4. Paste `system-prompt.md` into Agent → System Prompt.
5. Upload all `kb-*.md` files via Agent → Knowledge Base.
6. In Agent → Tools, paste each entry from `tools-spec.json` (4 tools).
7. In Agent → Phone Numbers, connect your Twilio number.
8. Place a test call from your cell. Try Level-1, Level-2, Level-3 scenarios.
9. Once confirmed working, swap the placeholder in iisupp.net's announcement banner with the real number.

## Required Netlify env vars (added manually in Netlify UI):
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN          (mark secret)
- TWILIO_PHONE_NUMBER        (E.164 format, e.g. +14165551234)
- ELEVENLABS_WEBHOOK_SECRET  (mark secret — from Agent → Webhooks → reveal)
- SALES_NOTIFY_EMAIL         (default: integrateditsupp@gmail.com)
- RESEND_API_KEY             (already set)
- RESEND_FROM                (already set)

## Function endpoints (already deployed at iisupp.net):
- /.netlify/functions/aria-inquiry        → ticket creation + email
- /.netlify/functions/aria-sms            → outbound Twilio SMS
- /.netlify/functions/aria-call-summary   → ElevenLabs post-call webhook

## Test calls before going live
- "My Outlook keeps asking for password" → expect L1 fix on the call.
- "My wifi keeps dropping every few minutes" → expect L2 try-once then offer transfer.
- "I think we got hacked, our files are encrypted" → expect immediate transfer attempt.
- Interrupt ARIA mid-sentence → she should stop and listen.

## Cost estimate
~$80/mo at 100 calls × 5 min average. Scales linearly.
