# KB Article Schema

Every article in this KB follows this exact structure.
Frontmatter is YAML for machine retrieval. Body is Markdown for humans.

## Frontmatter (REQUIRED)

```yaml
---
id: l1-windows-001                    # unique kebab-case ID
title: "Blue screen of death (BSOD) on Windows 10/11"
category: windows                      # lowercased single category
support_level: L1                      # L1 | L2 | L3 | GA
severity: medium                       # low | medium | high | critical
estimated_time_minutes: 15
audience: end-user                     # end-user | admin | technician | senior-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []                      # list of admin rights or tools required
keywords:                              # search tags — be generous, not redundant
  - bsod
  - blue screen
  - stop error
  - kernel panic
  - system crash
related_articles:                      # other article IDs
  - l1-windows-002
  - l2-drivers-003
escalation_trigger: "Repeats >3x in 24h, or appears during boot before login"
last_updated: 2026-05-07
version: 1.0
---
```

## Body sections (REQUIRED, in this order)

```markdown
# {Title}

## 1. Symptoms
What the user sees, hears, or experiences. First-person plain language.

## 2. Likely Causes
Ranked from most → least common. Brief.

## 3. Questions To Ask User
Triage questions ARIA must ask before suggesting fixes.
Ordered, with branching logic noted.

## 4. Troubleshooting Steps
Numbered, safe-to-do-first ordering. No destructive actions without L2/L3 gate.

## 5. Resolution Steps
The fix(es). Step-by-step. Include exact menu paths, command syntax,
and "what success looks like" indicators.

## 6. Verification Steps
How to objectively confirm the issue is resolved.

## 7. Escalation Trigger
Specific, observable conditions where this stops being a self-serve fix
and a human technician is required.

## 8. Prevention Tips
What the user can do going forward to avoid recurrence.

## 9. User-Friendly Explanation
The plain-English version ARIA speaks aloud. ~50–80 words.
No jargon. Senior-friendly.

## 10. Internal Technician Notes
Deeper context for L2/L3 engineers — registry keys, log paths, known bugs,
KB references, architectural caveats. Hidden from end users.

## 11. Related KB Articles
Cross-references — by ID and title.

## 12. Keywords / Search Tags
Same list as frontmatter, repeated here for human reference.
```

## Field rules

| Field | Rule |
|---|---|
| `id` | Must match filename (minus `.md`). Kebab-case. |
| `support_level` | L1=end-user, L2=admin/tenant, L3=senior/architect, GA=general assistant |
| `severity` | low=cosmetic, medium=annoying, high=blocks work, critical=outage/security |
| `escalation_trigger` | Always specific. "Call IT" is not acceptable. |
| `audience` | Drives ARIA's tone. `senior-user` triggers ELI5 mode. |
| `keywords` | Min 5, max 20. Include misspellings/colloquialisms. |
| `prerequisites` | If empty, end-user can self-serve. If non-empty, gate behind audience match. |

## Forbidden in articles

- Hardcoded user passwords / tokens / customer-specific data.
- `format C:` style destructive commands without explicit L3 gating.
- "Try this and see what happens" — every step must have an expected outcome.
- Marketing copy. This is technical documentation.
