/**
 * _prompt-injection-guard — Best-effort detection of obvious jailbreak / off-topic / role-hijack attempts.
 *  Returns { safe: bool, reason: string, score: 0..1, redacted_text: string }
 *  Catches: ignore previous instructions, system prompt extraction, role override,
 *           DAN/jailbreak patterns, base64-encoded payloads, recursive prompt-in-prompt.
 *
 *  Cat 9 — Edge cases + adversarial.
 */
'use strict';

const SUSPICIOUS_PATTERNS = [
  { pat: /ignore (?:all )?(?:previous|prior|above|the) instructions?/i, why: 'ignore_previous' },
  { pat: /disregard (?:all )?(?:previous|prior|above|the) instructions?/i, why: 'disregard_previous' },
  { pat: /forget (?:all )?(?:previous|prior|above|your)/i, why: 'forget_previous' },
  { pat: /you are (?:now |going to be )?(?:dan|jailbreak|sudo|admin|root|developer mode)/i, why: 'role_hijack' },
  { pat: /pretend (?:that )?(?:you are|to be)/i, why: 'pretend_role' },
  { pat: /act as (?:if )?(?:you are|a) (?!an? (?:it|tech|support|sysadmin|user|technician))/i, why: 'act_as_other_role' },
  { pat: /reveal (?:your |the )?(?:system prompt|instructions|hidden)/i, why: 'system_prompt_extract' },
  { pat: /show me (?:your |the )?(?:system prompt|instructions|prompt|config)/i, why: 'system_prompt_extract' },
  { pat: /\b(?:print|output|repeat|echo) (?:your |the )?(?:system prompt|instructions)/i, why: 'system_prompt_extract' },
  { pat: /^\s*<\s*(?:system|admin|root|sudo)\s*>/i, why: 'fake_role_tag' },
  { pat: /\bDAN\s+(?:mode|prompt|jailbreak)/i, why: 'dan_jailbreak' },
  { pat: /base64[: ]+[a-zA-Z0-9+/=]{40,}/i, why: 'base64_payload' },
  { pat: /\benable\s+(?:developer|debug|admin|god)\s+mode\b/i, why: 'enable_priv_mode' },
  { pat: /\bbypass\s+(?:safety|filters?|guardrails?|content policy)/i, why: 'bypass_safety' },
  { pat: /how (?:do i|to) (?:hack|exploit|attack|crack|phish)/i, why: 'harm_request' },
  { pat: /(?:write|generate|create|build|make).{0,30}(?:malware|virus|ransomware|exploit|keylogger|rootkit|trojan|spyware)/i, why: 'malware_request' }
];

// Patterns that are LEGITIMATE IT work and should NOT trigger guard (negative lookahead helpers)
const OK_OVERRIDES = [
  /reset (?:my|the user(?:'s)?|the admin(?:'s)?) password/i,  // password reset is legit
  /how to (?:install|configure|update|fix|debug|troubleshoot)/i,
  /bypass (?:mfa|2fa) (?:on|for) (?:my|the) (?:lost|stolen|new) (?:device|phone|account)/i,
  /admin (?:mode|access|panel) (?:on|for) (?:my|the) (?:m365|microsoft|google|admin|tenant)/i
];

function isLegitOverride(text) {
  return OK_OVERRIDES.some(r => r.test(text));
}

function check(text) {
  const t = String(text || '');
  if (t.length === 0) return { safe: true, reason: 'empty', score: 0, redacted_text: t };
  if (t.length > 10000) return { safe: false, reason: 'oversized_input', score: 1, redacted_text: t.slice(0, 200) + '...[truncated]' };

  for (const { pat, why } of SUSPICIOUS_PATTERNS) {
    if (pat.test(t)) {
      // Allow legitimate IT phrasing
      if (isLegitOverride(t)) continue;
      return {
        safe: false,
        reason: why,
        score: 0.9,
        redacted_text: t.replace(pat, '[REDACTED]')
      };
    }
  }
  // Suspicious if too many special chars or non-printable
  const special = (t.match(/[\x00-\x1f]/g) || []).length;
  if (special > 5) return { safe: false, reason: 'control_chars', score: 0.7, redacted_text: t.replace(/[\x00-\x1f]/g, '?') };

  return { safe: true, reason: 'ok', score: 0, redacted_text: t };
}

module.exports = { check, SUSPICIOUS_PATTERNS };
