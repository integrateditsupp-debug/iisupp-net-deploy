/**
 * _pii-redact — Shared utility to mask common PII in logged text.
 * Use: const { redact } = require('./_pii-redact');
 *      console.log(redact(userText));
 *
 * Patterns covered: email, SSN, credit card, phone, Canadian SIN.
 * Always returns a string. Never throws.
 */
function redact(s) {
  if (s == null) return '';
  var t = String(s);
  // Email
  t = t.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]');
  // SSN (US): NNN-NN-NNNN
  t = t.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]');
  // SIN (Canada): NNN-NNN-NNN or NNN NNN NNN or 9 digits with separators
  t = t.replace(/\b\d{3}[- ]?\d{3}[- ]?\d{3}\b/g, function(m){
    // Don't redact phone numbers (10 digits) — only 9-digit SIN
    var digits = m.replace(/\D/g, '');
    if (digits.length === 9) return '[sin]';
    return m;
  });
  // Credit cards (13-16 digit runs with optional separators)
  t = t.replace(/\b(?:\d[ -]*?){13,16}\b/g, function(m){
    var digits = m.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 16 && luhnValid(digits)) return '[card]';
    return m;
  });
  // Phone (international or North American format)
  t = t.replace(/\+?\d{1,3}[ -]?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g, '[phone]');
  // Generic 10-digit phone fallback
  t = t.replace(/\b\d{10}\b/g, '[phone]');
  return t;
}
function luhnValid(digits) {
  var sum = 0; var alt = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
module.exports = { redact };
