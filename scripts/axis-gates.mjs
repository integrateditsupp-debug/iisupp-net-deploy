// axis-gates — the SINGLE SOURCE OF TRUTH for "is this job/branch safe to auto-run?".
//
// Both the AXIS runner (scripts/axis-runner.mjs, the executor) and the Infinity Wisdom engine
// (scripts/infinity-wisdom.mjs, the planner) import this. They CANNOT drift: the planner will never
// mark something safe that the runner would reject, because both ask the same function. The runner is
// still the final backstop (it re-gates every job at execution time) — defense in depth.

// Only these job kinds may ever auto-run. Anything else → approvals inbox.
export const SAFE_KINDS = new Set(['kb-article', 'kb-stub', 'doc', 'classifier-keyword', 'scenario', 'test', 'note', 'research-note']);

// Defense-in-depth: if a job's text smells risky, it is rejected even if marked safe of a safe kind.
export const RISKY_PATTERNS = [
  { re: /push[^.]{0,30}\bmain\b|to main\b|merge[^.]{0,30}\bmain\b|origin\/main/i, why: 'push/merge to main' },
  { re: /\bnetlify\b|\bdeploy\b|publish (live|to ?prod|production)|go ?live|ota (publish|release)/i, why: 'deploy/publish' },
  { re: /send (an? )?(email|outreach|message|sms|whatsapp|dm|text)|outreach|email[^.]{0,20}(client|lead|prospect|customer)|mailto:|resend|smtp send/i, why: 'send email/outreach' },
  { re: /\brm -rf\b|del \/[a-z]|format [a-z]:|reg delete|drop table|truncate table|shutdown|reboot|diskpart|mkfs/i, why: 'destructive system action' },
  { re: /\b(payment|stripe|invoice|refund|charge card|financial|payout|bank|wire transfer|purchase|spend)\b/i, why: 'financial action' },
  { re: /\b(password|credential|api.?key|client.?secret|secret|token)\b[^.]{0,20}(change|rotate|reset|set|update|provision|issue)|set[^.]{0,15}(secret|api.?key)/i, why: 'credential/secret change' },
  { re: /\bgit push\b|--force|force.?push/i, why: 'unscoped git push / force-push' },
  // Infinity-Wisdom additions: the engine must never spend, nor command unbounded self-replication.
  { re: /\b(buy|subscribe|upgrade plan|paid (api|tier|plan)|openai|anthropic api key|gpt-4|per-token)\b/i, why: 'paid API / spend' },
  { re: /\b(spawn|create|launch)[^.]{0,30}(unlimited|infinite|many|hundreds|thousands|army of) (agents?|workers?|bots?)\b/i, why: 'uncontrolled agent spawn' },
];

/**
 * Classify whether a job/branch may auto-run. PURE. Returns { safe:true } only if ALL checks pass.
 * Accepts an AXIS job ({kind,safe,title,prompt,files,requiresApproval}) or an Infinity-Wisdom branch
 * (mapped to the same shape by the engine).
 */
export function classifyJobSafety(job) {
  if (!job || typeof job !== 'object') return { safe: false, reason: 'no job' };
  if (job._badLine != null) return { safe: false, reason: 'unparseable job line' };
  if (job.safe !== true) return { safe: false, reason: 'job not marked safe:true' };
  if (!SAFE_KINDS.has(job.kind)) return { safe: false, reason: `kind '${job.kind}' not in the safe allowlist` };
  const blob = `${job.title || ''}\n${job.prompt || ''}\n${(job.files || []).join(' ')}`;
  for (const p of RISKY_PATTERNS) if (p.re.test(blob)) return { safe: false, reason: `risky marker: ${p.why}` };
  if (job.requiresApproval === true) return { safe: false, reason: 'job explicitly requires approval' };
  return { safe: true };
}
