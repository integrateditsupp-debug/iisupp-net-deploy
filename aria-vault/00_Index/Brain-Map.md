---
type: index
role: anatomical-guide
created: 2026-06-20
brain_region: cortex-association
---

# Brain-Map — anatomical layout of the vault

> The vault is organized like a human brain. Each region has a function. AXIS routes queries to the right region the same way a brain routes inputs.

## Macro layout

```
                ┌─────────────────────────────────────────┐
                │           00_Index (Sulcus map)          │
                │     _HOME · Brain-Map · entry points     │
                └─────────────────────────────────────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
┌──────▼──────┐         ┌─────────▼─────────┐       ┌────────▼────────┐
│  01_Frontal │         │  07_Cortex (think)│       │   09_Decisions  │
│  IIS · ARIA │◄────────┤  Ahmad · Cowork   │──────►│  Frontal output │
│  Sentinel   │         │  AXIS · all agents│       │  D-YYYYMMDD-*   │
└──────┬──────┘         └─────────┬─────────┘       └─────────────────┘
       │                          │
       │  ┌───────────────────────┼───────────────────────┐
       │  │                       │                       │
       │ ┌▼──────────┐  ┌─────────▼─────────┐  ┌──────────▼─────────┐
       │ │02_Hippo-  │  │   05_Thalamus     │  │   10_Brainstem      │
       │ │ campus    │  │   (relay/inbox)   │  │   (vital signs)     │
       │ │ RULES     │  │  _capture·_Inbox  │  │  Netlify·Stripe·DO  │
       │ │ STACK     │  └─────────┬─────────┘  └─────────────────────┘
       │ │ VOICE     │            │
       │ │ DIRECTOR  │  ┌─────────▼─────────┐
       │ └───────────┘  │  04_ShortTerm     │
       │                │  (peri-hippocampal)│
       │                │  daily notes      │
       │                └───────────────────┘
       │
       │  ┌─────────────────┐    ┌─────────────────┐
       └──┤ 03_BasalGanglia │    │  06_Cerebellum  │
          │  (habits)       │    │  (motor skel)   │
          │  Templates·     │    │  patterns·      │
          │  Campaigns      │    │  recipes        │
          └─────────────────┘    └─────────────────┘
                                            
       ┌─────────────────┐    ┌───────────────────────┐
       │  08_Amygdala    │    │  11_CorpusCallosum    │
       │  (alerts)       │    │  (cross-agent bridge) │
       │  security ·     │    │  Cowork ↔ ClaudeCode  │
       │  anomalies      │    │  handoff packets      │
       └─────────────────┘    └───────────────────────┘
                                            
                            ┌───────────────────┐
                            │     12_Glia       │
                            │   (maintenance)   │
                            │ Cleaning · Backup │
                            └───────────────────┘
```

## Region purpose + when AXIS reads it

| # | Region | When AXIS / Ahmad pulls from it |
|---|---|---|
| 00 | Index | wayfinding, entry points |
| 01 | Frontal | "what should I do about [product/strategy]" |
| 02 | Hippocampus | "what's the rule on…" / persistent facts |
| 03 | Basal ganglia | "how do I usually do…" / recurring patterns |
| 04 | Short-term | "what happened today/yesterday" |
| 05 | Thalamus | new input → routed to correct region |
| 06 | Cerebellum | "give me the template for…" / motor skeleton |
| 07 | Cortex | "who is [agent/person]" / agent profiles |
| 08 | Amygdala | "any alerts" / threat scan |
| 09 | Decisions | "why did we decide…" / history |
| 10 | Brainstem | "is everything healthy" / vitals |
| 11 | Corpus callosum | inter-agent handoffs in flight |
| 12 | Glia | maintenance logs (Cleaning, Backup) |

## Visual: how the graph looks brain-like

When [[link-web]] runs with region-aware clustering enabled:
- Notes in same region cluster tightly (dense local connections)
- Hippocampus + Frontal are central hubs (highest backlink count)
- Thalamus is a relay node (in-degree from many regions)
- Brainstem + Amygdala are sparse (small, critical)
- Glia sits at the periphery (maintenance, low traffic)

Result: graph view in Obsidian visibly clusters into anatomical regions — looks like a cross-section of a brain when rendered.

## Authoring rules

- Every new note carries `brain_region:` frontmatter
- Region values: `frontal`, `hippocampus`, `basal-ganglia`, `short-term`, `thalamus`, `cerebellum`, `cortex`, `amygdala`, `decisions`, `brainstem`, `corpus-callosum`, `glia`
- Sub-regions allowed: `cortex-frontal`, `cortex-association`, `frontal-iis`, `frontal-aria`, `frontal-sentinel`

## Related

<!-- LINK-WEB:auto -->
- [[2026-06-20]]
- [[AXIS]]
- [[Ahmad]]
- [[Backup-agent]]
- [[CLAUDE]]
- [[CLAUDE_CODE_AUTOCAPTURE_PACKET]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[OPS-agent]]
- [[README]]
- [[RULES]]
- [[STACK]]
- [[VOICE]]
- [[_ARIA]]
- [[_Amygdala]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_HOME]]
- [[_IIS]]
- [[_Inbox]]
- [[_Se