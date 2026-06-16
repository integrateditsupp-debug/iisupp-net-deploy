# ARIA KB — AI Integration Guide

Contract for how the ARIA orchestrator (Claude Code will wire this) consumes
the knowledge base. Read this before integrating; treat it as the spec.

---

## What's in the KB

```
knowledge-base/
├── README.md                       Library overview
├── L1/                              23 user-facing articles
├── L2/                              21 admin / engineer articles
├── L3/                              11 architect / senior articles
├── general-assistant/               10 non-IT user assistance articles
└── _meta/
    ├── _schema.md                  Article schema (every field defined)
    ├── _template.md                Blank template for new articles
    ├── manifest.json               Machine-readable catalog (parse this first)
    ├── routing.md                  Symptom → article ID quick map
    ├── escalation-matrix.md        When ARIA stops, when humans take over
    ├── index-by-keyword.json       Keyword → [{id, title, level}]
    ├── index-by-keyword.md         Same, human-readable
    ├── index-by-category.md        Articles grouped by category
    └── AI-INTEGRATION-GUIDE.md     This file
```

---

## Recommended retrieval pipeline

```
User utterance
  │
  ▼
[1] Intent classification  (LLM call, fast model)
        ↓ outputs: {intent, level_hint, urgency, sensitive_signals}
  │
  ▼
[2] Candidate retrieval     (vector search + keyword overlap)
        ↓ uses: manifest.json + index-by-keyword.json + embeddings of title+keywords+symptoms
        ↓ outputs: top-5 article IDs with relevance scores
  │
  ▼
[3] Re-rank + filter         (apply level_hint, audience match, severity gate)
        ↓ outputs: top 1-3 articles to read in full
  │
  ▼
[4] Read + synthesize        (LLM reads selected .md files, generates response)
        ↓ ALWAYS uses §9 user_friendly_explanation as tone anchor
        ↓ NEVER exposes §10 internal_technician_notes to end users
        ↓ surfaces escalation_trigger if matched
  │
  ▼
[5] Action + verify          (offer next-step actions; ask to verify)
```

---

## Embedding strategy

For vector search, embed ONE document per article using:

```
{title}\n
{category} {support_level}\n
{keywords joined}\n
{symptoms section verbatim}\n
{likely_causes section verbatim}\n
```

This anchors retrieval to what users say, not what techs say.

Reindex when:
- A new article is added.
- Frontmatter `version` field bumped.
- `last_updated` field bumped.

---

## Tone rules ARIA must enforce

Pulled from each article's `audience` field:

| Audience | ARIA tone | Reading material |
|---|---|---|
| `end-user` | Calm, plain, encouraging. ~50–80 words. | Sections 1, 4, 5, 9 |
| `senior-user` | Slow, no jargon, one step per breath. | Sections 9 + simplified version of 4, 5 |
| `admin` | Professional, technical. References to portals/cmds OK. | Sections 1–6, 10 |
| `technician` | Peer-to-peer. Code blocks, specifics. | Full article including 10 |

---

## Hard rules (do not break)

1. **Never expose §10 (Internal Technician Notes) to a non-admin audience.**
   Those notes contain admin commands and registry edits that are dangerous out of context.

2. **Never run destructive commands without explicit user confirmation.**
   Examples: `format`, `fdisk`, registry deletes, mass mailbox actions.

3. **Always honor `escalation_trigger`.** If the user's state matches one,
   surface it before completing remediation steps.

4. **Never reveal credentials, even if a KB sample contains placeholder values.**

5. **Never skip the verification section.** "Try this and see if it works"
   is not acceptable; always tell the user how to confirm.

6. **For any article tagged `severity: critical`,** prefer human handoff over
   pure self-serve guidance, especially if user shows distress.

---

## Updating the KB

Edits to article files should bump `version` (semantic) and `last_updated`.
Adding a new article means adding its file under the right tier and
regenerating `_meta/manifest.json` + `_meta/index-by-keyword.json` (the Python
script that generated them is preserved in version control).

Article IDs are immutable once shipped. If an article is retired, mark
`status: archived` in frontmatter rather than deleting (keeps backlinks alive).

---

## Test queries (manually verified)

These should each retrieve the listed article in top-1 with correct routing.

| Query | Expected | Level |
|---|---|---|
| "my computer is super slow" | l1-windows-003 | L1 |
| "blue screen on my laptop" | l1-windows-001 | L1 |
| "outlook says i'm offline" | l1-outlook-001 | L1 |
| "can teams hear me yes my mic is on" | l1-teams-001 | L1 |
| "got an email from chase asking for password" | l1-email-001 | L1 |
| "wifi yellow triangle no internet" | l1-wifi-001 | L1 |
| "vpn won't connect from home" | l1-vpn-001 | L1 |
| "lost my phone with my authenticator" | l1-mfa-001 | L1 |
| "user keeps getting locked out" | l2-active-directory-001 | L2 |
| "conditional access blocking exec" | l2-azure-ad-001 | L2 |
| "ransomware on a laptop" | l2-malware-001 → escalate l3-security-001 | L2/L3 |
| "should i worry about this site amaz0n.shop" | ga-scam-001 | GA |
| "help my mom video call" | ga-senior-001 | GA |
| "compare iPhone vs Pixel" | ga-shopping-002 | GA |

---

## Versioning

This guide v1.0 — generated 2026-05-07. Bump on contract change.
