---
brain_region: cortex-association
---

# Claude Code — Auto-Capture Agent (Obsidian) · ONE-SHOT PACKET

**For:** Claude Code, run inside the aria-vault folder.
**Owner:** [[Ahmad]] Wasee · IIS · ARIA · ARIA Sentinel
**Pattern:** Jared's TikTok — "one agent · consolidated memory · daily-note Index+Detail · everything wiki-linked"
**Mandate:** [[Ahmad]] talks/types ideas → captured automatically → routed to the RIGHT vault note → cross-linked with `wikilinks` → important points flagged. He never types a daily note by hand again.

## §0 Read first

1. `CLAUDE.md` (vault root) — voice, 10 rules, folder map, daily-note convention.
2. `02_Memory/RULES.md` — the 10 locked rules.
3. `02_Memory/VOICE.md` — tone rules.
4. `README.md` (vault root) — how to open + recommended plugins.
5. Existing folder structure — DON'T sprawl. Consolidate (Jared cut from 107 → far fewer).

## §1 What you're building

A local-only auto-capture loop that:

1. **Captures**: takes free-form Ahmad-talk (text passed in via `/capture` slash command OR a watcher reading `05_Inbox/_capture.md`)
2. **Classifies**: routes each chunk to the right note type:
   - `daily` → bullet in today's `04_Daily/YYYY-MM-DD.md` Index section
   - `decision` → new `09_Decisions/D-YYYYMMDD-slug.md` from template
   - `campaign` → update or create note under `03_Campaigns/`
   - `customer` → update or create note under `01_Business/IIS/Customers/` or `01_Business/ARIA/Customers/`
   - `person` → update note under `07_People/`
   - `recipe` (ARIA Sentinel fix recipe) → update note under `01_Business/Sentinel/Recipes/`
   - `KB-fact` (permanent knowledge) → CONSOLIDATE into existing `02_Memory/*.md` (never create new memory file)
   - `inbox` (don't know yet) → append to `05_Inbox/_Inbox.md` for later triage
3. **Wiki-links**: after writing, finds related existing notes and adds ``wikilinks`` both ways
4. **Flags important points**: lines that match locked rules (revenue · decision · deadline · money · risk) get bolded and tagged `#important` so the graph view surfaces them

## §2 Files to create (zero new dependencies)

```
aria-vault/
├── .claude/
│   └── commands/
│       └── capture.md         ← Claude Code slash command
├── scripts/
│   ├── route.mjs              ← classify + write to vault
│   ├── link.mjs               ← scan vault, propose + insert wikilinks
│   ├── consolidate.mjs        ← end-of-day pass: dedupe + tighten Index
│   ├── watch-inbox.mjs        ← background watcher on 05_Inbox/_capture.md
│   └── _vault.mjs             ← shared: list notes, parse frontmatter, write safely
├── 05_Inbox/
│   └── _capture.md            ← append-only queue for watcher mode
└── docs/
    └── CLAUDE_CODE_AUTOCAPTURE_PACKET.md  ← this file
```

## §3 The slash command (Ahmad's primary path)

`.claude/commands/capture.md`:

```markdown
---
description: Capture Ahmad's idea/note/decision and route it into the vault with auto-links.
argument-hint: <free-form text — what Ahmad just said or typed>
---

You are the AUTO-CAPTURE AGENT for the IIS/ARIA/Sentinel vault.

Input: `$ARGUMENTS` (Ahmad's raw text, may be one idea or several).

Your job — execute IN ORDER:

1. Read `CLAUDE.md` + `02_Memory/RULES.md` + `02_Memory/VOICE.md` + today's `04_Daily/YYYY-MM-DD.md`.
2. Split `$ARGUMENTS` into atomic chunks (one idea per chunk).
3. For each chunk:
   a. Classify: daily / decision / campaign / customer / person / recipe / KB-fact / inbox.
   b. Decide the target file path:
      - daily      → today's daily note `04_Daily/YYYY-MM-DD.md` Index section
      - decision   → new `09_Decisions/D-YYYYMMDD-{slug}.md` from `06_Templates/Decision.md`
      - campaign   → existing match in `03_Campaigns/` OR new from `06_Templates/Campaign.md`
      - customer   → existing match OR new from `06_Templates/Customer.md`
      - person     → existing match in `07_People/` OR new `07_People/{Name}.md`
      - recipe     → existing `01_Business/Sentinel/Recipes/{ID}.md` OR new
      - KB-fact    → CONSOLIDATE into the most-relevant existing `02_Memory/*.md` (RULES, VOICE, STACK). NEVER create a new memory file.
      - inbox      → append to `05_Inbox/_Inbox.md`
   c. Write the chunk in CEO voice per `02_Memory/VOICE.md` (bullets, no paragraphs).
   d. If the chunk matches an "important" marker (revenue, deadline, money, decision, risk, locked rule), wrap key phrases in **bold** and add inline tag `#important`.
   e. Find 1-3 related existing notes by keyword match → add ``wikilinks`` in BOTH the new content AND the related notes' Detail sections.
   f. ALWAYS add a bullet to today's daily note Index pointing at what you wrote: `- {one-line summary} → `target-note-name``.

4. After all chunks written:
   - Run `node scripts/link.mjs` to fix any orphan wikilinks
   - Output a 3-line summary to chat: count of chunks · count of files touched · count of new wikilinks created

5. NEVER:
   - Create a new file under `02_Memory/` — consolidate into RULES / VOICE / STACK
   - Violate the 10 standing rules in `02_Memory/RULES.md`
   - Use words from `02_Memory/VOICE.md` "Words to avoid" list
   - Write paragraphs — bullets only

## Example invocations

`/capture I want to add SOC 2 readiness page to iisupp.net by end of week, also Lead-001 finally replied yes to the demo Friday 2pm`

→ Splits into 2 chunks:
1. "SOC 2 readiness page by end of week" → daily note Index bullet + maybe a `09_Decisions/D-YYYYMMDD-soc2-page.md` if it's a commitment
2. "Lead-001 replied yes, demo Friday 2pm" → updates `07_People/Leads.md` (creates if missing) + daily note Index bullet + adds [[Leads]] wikilink in today's note

`/capture decision — we'll bake all Stripe price IDs in code per Rule 10`

→ Single chunk, type=decision → creates `09_Decisions/D-YYYYMMDD-stripe-price-ids-in-code.md` from template with #important tag + wikilinks to [[RULES]] and [[Stripe-Products]]
```

## §4 The router (`scripts/route.mjs`)

```js
#!/usr/bin/env node
// route.mjs — classify a chunk + return target file path + content.
// Pure logic; no Claude API call (the slash command does the LLM work).
// Used by the watcher OR called directly by Claude Code as a sanity helper.

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

const VAULT = process.cwd().includes("aria-vault") ? process.cwd() : join(process.cwd(), "aria-vault");

const FOLDERS = {
  daily:    "04_Daily",
  decision: "09_Decisions",
  campaign: "03_Campaigns",
  person:   "07_People",
  inbox:    "05_Inbox",
};

const IMPORTANT_PATTERNS = [
  /\b(decision|locked|hard rule|deadline|revenue|MRR|ARR|customer|sign|contract|pilot)\b/i,
  /\$[\d,]+/,
  /\d+%\s*(month|year|growth|conversion)/i,
];

export function isImportant(text) {
  return IMPORTANT_PATTERNS.some(p => p.test(text));
}

export function todayPath() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10);
  return join(VAULT, FOLDERS.daily, `${ymd}.md`);
}

export function decisionPath(slug) {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
  return join(VAULT, FOLDERS.decision, `D-${ymd}-${safeSlug}.md`);
}

export async function listExistingNotes() {
  const out = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith(".md")) {
        out.push({ path: p, name: basename(entry.name, ".md"), rel: p.replace(VAULT + "/", "") });
      }
    }
  }
  await walk(VAULT);
  return out;
}

export async function appendToDailyIndex(line) {
  const path = todayPath();
  try { await stat(path); }
  catch { await ensureDailyNote(path); }
  let text = await readFile(path, "utf8");
  // Insert under "## Index" section
  text = text.replace(/(## Index\n(?:- .*\n)*)/, `$1- ${line}\n`);
  await writeFile(path, text);
}

async function ensureDailyNote(path) {
  await mkdir(dirname(path), { recursive: true });
  const d = new Date();
  const human = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const ymd = d.toISOString().slice(0, 10);
  await writeFile(path, `---\ndate: ${ymd}\ntype: daily\n---\n\n# ${human}\n\n## Index\n\n## Detail\n\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // CLI: node scripts/route.mjs "free text here"
  const text = process.argv.slice(2).join(" ");
  console.log({ important: isImportant(text), today: todayPath() });
}
```

## §5 The linker (`scripts/link.mjs`)

```js
#!/usr/bin/env node
// link.mjs — scan vault, build name→path index, propose + insert `wikilinks`
// where note text mentions another note's title.

import { readFile, writeFile } from "node:fs/promises";
import { listExistingNotes } from "./_vault.mjs";

const notes = await listExistingNotes();
const names = notes.map(n => n.name).filter(n => n.length > 3 && !n.startsWith("_"));

let totalInserted = 0;

for (const note of notes) {
  let text = await readFile(note.path, "utf8");
  let changed = false;
  for (const target of names) {
    if (target === note.name) continue;
    // Only match the bare name appearing in plain text (not already wikilinked + not in a heading)
    const safe = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!\\[\\[)\\b${safe}\\b(?!\\]\\])`, "g");
    const before = text;
    text = text.replace(re, ````);
    if (text !== before) { changed = true; totalInserted += (text.match(/\[\[/g) || []).length - (before.match(/\[\[/g) || []).length; }
  }
  if (changed) await writeFile(note.path, text);
}

console.log(`link.mjs · inserted ${totalInserted} wikilinks across ${notes.length} notes`);
```

## §6 The consolidator (`scripts/consolidate.mjs`)

```js
#!/usr/bin/env node
// consolidate.mjs — end-of-day pass.
// 1. Dedup bullets in today's Index (same text → keep first).
// 2. Move any 05_Inbox/_Inbox.md bullets that are >3 days old to today's daily Detail under "## Inbox triage".
// 3. Print stats.

import { readFile, writeFile, stat } from "node:fs/promises";
import { todayPath } from "./route.mjs";

const today = todayPath();
let text = await readFile(today, "utf8");

// Dedup Index bullets
const idx = text.match(/## Index\n((?:- .*\n)*)/);
if (idx) {
  const lines = idx[1].split("\n").filter(Boolean);
  const seen = new Set();
  const unique = lines.filter(l => { const k = l.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  text = text.replace(idx[0], `## Index\n${unique.join("\n")}\n`);
}

await writeFile(today, text);
console.log("consolidate.mjs · today's Index deduped");
```

## §7 The watcher (`scripts/watch-inbox.mjs`)

```js
#!/usr/bin/env node
// watch-inbox.mjs — runs in background. Watches 05_Inbox/_capture.md.
// When the file grows: invoke Claude Code's /capture slash command with the appended text.

import { watch, readFile, writeFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";

const CAPTURE = "05_Inbox/_capture.md";
let lastSize = (await stat(CAPTURE).catch(() => ({ size: 0 }))).size;

for await (const event of watch(CAPTURE)) {
  if (event.eventType !== "change") continue;
  const cur = await stat(CAPTURE).catch(() => null);
  if (!cur || cur.size <= lastSize) continue;
  const text = await readFile(CAPTURE, "utf8");
  const fresh = text.slice(lastSize).trim();
  lastSize = cur.size;
  if (!fresh) continue;
  console.log(`watch-inbox · new text (${fresh.length} chars). Invoking /capture...`);
  // Non-blocking call to Claude Code
  spawn("claude", ["--print", `/capture ${fresh}`], { stdio: "inherit", shell: true });
}
```

## §8 Run modes (3 paths — Ahmad picks)

### Mode A · Slash command (lowest friction)
- [[Ahmad]] in any chat: `/capture <free text>` → vault updated in seconds.
- Best for desk sessions.

### Mode B · Watcher (set-and-forget)
- Run once: `node scripts/watch-inbox.mjs &`
- [[Ahmad]] pastes ideas into `05_Inbox/_capture.md` (any time, any tool — phone, scratchpad, Slack quick paste).
- Watcher invokes `/capture` automatically. Vault stays current.

### Mode C · Voice (later)
- Hook a voice transcription (Whisper local OR system dictation) → appends to `_capture.md` → Watcher picks it up.
- Add `scripts/voice-capture.mjs` once [[Ahmad]] approves a transcription tool.

## §9 Acceptance criteria

- [ ] `/capture "test"` writes a bullet to today's daily-note Index within 5s
- [ ] `/capture "decision — we'll do X because Y"` creates a new note under `09_Decisions/` from the [[Decision]] template
- [ ] `/capture "John Smith CEO of Acme replied yes"` creates/updates `07_People/John-Smith.md`
- [ ] Cross-note wikilinks: at least 1 ``wikilink`` added per chunk where there's a related existing note
- [ ] Important markers (revenue, decision, deadline, money) → wrapped in `**bold**` + tagged `#important`
- [ ] Memory files (`02_Memory/*.md`) NEVER multiply — KB-facts are merged into existing files
- [ ] Watcher mode: drop a line into `05_Inbox/_capture.md`, see it routed in <10s
- [ ] [[Daily-note]] Index has a bullet per chunk pointing at the file written: `- summary → `note-name``
- [ ] No paragraphs anywhere. Bullets only.
- [ ] No words from VOICE.md "avoid" list ever written.
- [ ] No new package.json dependencies (Node 20+ has all we need).

## §10 What NOT to do

- DO NOT add cloud sync, paid services, or new dependencies.
- DO NOT create a new `02_Memory/*.md` file. Consolidate (Jared's rule, 107 → fewer).
- DO NOT touch `iisupp-net-deploy/` files outside `aria-vault/`.
- DO NOT call any external API except local Anthropic via Claude Code's existing config.
- DO NOT write paragraphs.
- DO NOT use emojis in vault notes.
- DO NOT bypass the [[RULES]] for any reason. The capture agent is also bound by the 10 rules.

## §11 Hand-off report shape

When you're done, output:

```
AUTO-CAPTURE AGENT — LIVE
Files created:
  .claude/commands/capture.md
  scripts/route.mjs
  scripts/link.mjs
  scripts/consolidate.mjs
  scripts/watch-inbox.mjs
  scripts/_vault.mjs
  05_Inbox/_capture.md (empty file as the queue)

Tests run:
  /capture "test — adding SOC2 readiness page by Friday"
    → wrote to 04_Daily/2026-06-19.md Index
    → wikilinked to [[Operations]]
    → flagged #important (deadline)
  /capture "decision: bake Stripe price IDs in code per Rule 10"
    → created 09_Decisions/D-20260619-stripe-price-ids-in-code.md
    → linked to [[RULES]] + [[Stripe-Products]]

How to use:
  Slash command:  /capture <text>
  Watcher:        node scripts/watch-inbox.mjs (then append to 05_Inbox/_capture.md)
  End-of-day:     node scripts/consolidate.mjs

Notes:
  - No new deps added
  - No memory files multiplied
  - All 10 rules honored
```

---

*End of packet. Read top to bottom, build all 6 files

## Related

<!-- LINK-WEB:auto -->
- [[_HOME]]
- [[Brain-Map]]
- [[_Amygdala]]
- [[_ARIA]]
- [[_Brainstem]]
- [[_Campaigns]]
- [[_capture]]
- [[_CorpusCallosum]]
- [[_Decisions]]
- [[_Glia]]
- [[_IIS]]
- [[_Inbox]]
- [[_Sentinel]]
- [[Ahmad]]
- [[AXIS]]
- [[Backup-agent]]
- [[Claude-Code]]
- [[Cleaning-agent]]
- [[Codex]]
- [[Cowork]]
- [[Daily-note]]
- [[Decision]]
- [[DIRECTOR_AUTONOMY]]
- [[KB-agent]]
- [[Leads]]
- [[Leads-agent]]
- [[Operations]]
- [[OPS-agent]]
- [[RULES]]
- [[STACK]]
- [[Stripe-Products]]
- [[VOICE]]
<!-- /LINK-WEB:auto -->
