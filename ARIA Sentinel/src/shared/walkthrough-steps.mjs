// Walk-through step source — ONE shared, node-free definition the desktop Walk-through tab renders and that
// mirrors the web aria.html KB `walk:[{title, sub, screenshot}]` shape (same step model, same field names).
//
// REAL-OR-EMPTY (Rule 14): only issues with genuinely authored manual steps appear here. Every step below is
// the real, verifiable manual equivalent of what the gated fix does — nothing invented. A recipe with no
// authored steps returns [] so the UI shows an HONEST fallback (verified KB article + gated-resolve option),
// never a fabricated or blank walk. Screenshots are intentionally omitted (real-or-empty — we do not ship
// fake device captures); the renderer degrades to title + sub cleanly where `screenshot` is absent.
//
// GUIDE MODE IS PURE DISPLAY: following these steps changes NOTHING on the machine. The only thing that ever
// changes a PC is the separately-gated "Resolve it for me" apply flow (supervisor + countdown + tier-0 +
// kill-switch + rollback). This module has no side effects and touches nothing on disk.

// Canonical step lists keyed by executor id (the 5 vetted Tier-0 bindings) + the registry recipe ids the web
// handoff maps. Each `sub` is the concrete manual action; a user could do it by hand with no automation.
export const WALK_STEPS = Object.freeze({
  // ── Vetted Tier-0 executor bindings (these have a safe, reversible auto-apply) ──────────────────────────
  "restart-print-spooler": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Print Spooler”", sub: "Scroll the alphabetical list down to the P section." },
    { title: "Restart the service", sub: "Right-click Print Spooler → Restart. Stuck jobs clear and the queue resets." },
    { title: "Try printing again", sub: "Send a test page — pending jobs resume on the restarted spooler." }
  ],
  "restart-windows-update": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Windows Update”", sub: "It sits near the bottom of the list (service name wuauserv)." },
    { title: "Restart the service", sub: "Right-click Windows Update → Restart to clear a stuck update agent." },
    { title: "Re-check for updates", sub: "Settings → Windows Update → Check for updates." }
  ],
  "flush-dns-cache": [
    { title: "Open Command Prompt", sub: "Press Win+R, type cmd, and press Enter." },
    { title: "Flush the resolver cache", sub: "Type  ipconfig /flushdns  and press Enter." },
    { title: "Confirm the flush", sub: "You should see “Successfully flushed the DNS Resolver Cache.”" },
    { title: "Reload the page", sub: "Try the site again — stale DNS entries are gone." }
  ],
  "restart-bluetooth": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Bluetooth Support Service”", sub: "Service name bthserv." },
    { title: "Restart the service", sub: "Right-click → Restart to reset the Bluetooth stack." },
    { title: "Re-pair if needed", sub: "Settings → Bluetooth & devices — reconnect your device." }
  ],
  "restart-audio": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Find “Windows Audio”", sub: "Service name Audiosrv." },
    { title: "Restart the service", sub: "Right-click → Restart to recover a hung audio engine." },
    { title: "Test sound", sub: "Play any audio to confirm output is back." }
  ],
  // ── Registry recipes the web handoff maps (guidance mirrors the recipe summary; not all auto-apply yet) ──
  "printer-spooler-v1": [
    { title: "Open the Services console", sub: "Press Win+R, type services.msc, and press Enter." },
    { title: "Restart Print Spooler", sub: "Right-click Print Spooler → Restart to clear the stuck queue." },
    { title: "Re-add the printer if it stays offline", sub: "Settings → Bluetooth & devices → Printers & scanners." },
    { title: "Print a test page", sub: "Confirm the job completes end-to-end." }
  ],
  "wifi-no-internet-v1": [
    { title: "Open Network & internet settings", sub: "Right-click the network icon in the tray → Network & internet settings." },
    { title: "Toggle the adapter off, then on", sub: "Disable Wi-Fi, wait 5 seconds, re-enable it to force a fresh handshake." },
    { title: "Renew the connection", sub: "Reconnect to your network; Windows requests a new IP address." },
    { title: "Verify you're online", sub: "Open a website — if it loads, the connection is restored." }
  ],
  "disk-low-space-v1": [
    { title: "Open Storage settings", sub: "Settings → System → Storage." },
    { title: "Run Cleanup recommendations", sub: "Review temporary files and old downloads Windows flags as safe to remove." },
    { title: "Clear browser cache", sub: "In your browser: Settings → Privacy → Clear cached images and files." },
    { title: "Re-check free space", sub: "Confirm the drive now has headroom before installing or updating." }
  ],
  "browser-password-loop-v1": [
    { title: "Confirm the exact sign-in behavior", sub: "Wrong-password error, an endless redirect, or an MFA prompt that never completes?" },
    { title: "Clear the site's saved sign-in", sub: "Browser Settings → Privacy → clear cookies for that one site (credentials are not touched)." },
    { title: "Retry the sign-in", sub: "Open the site fresh and sign in again." },
    { title: "Reset the password if it still fails", sub: "Use the provider's official “Forgot password” flow — never share it with anyone." }
  ]
});

// Intent / alias id → canonical step key, so a web intent (e.g. "printer", "wifi") or an executor alias
// (e.g. "flush-dns") resolves to the same authored steps as its canonical recipe. Kept lowercase.
export const WALK_ALIASES = Object.freeze({
  "printer": "printer-spooler-v1",
  "wifi": "wifi-no-internet-v1",
  "disk": "disk-low-space-v1",
  "password": "browser-password-loop-v1",
  "flush-dns": "flush-dns-cache",
  "restart-audio-service": "restart-audio"
});

/** Real steps for a recipe/executor/intent id, or [] when none are authored (caller shows the honest fallback). */
export function walkStepsFor(recipeId) {
  const id = String(recipeId || "").trim();
  if (!id) return [];
  if (WALK_STEPS[id]) return WALK_STEPS[id];
  const alias = WALK_ALIASES[id.toLowerCase()];
  return (alias && WALK_STEPS[alias]) ? WALK_STEPS[alias] : [];
}

/** True only when a recipe has genuinely authored steps (drives real-or-empty in the Walk-through tab). */
export function hasWalkSteps(recipeId) {
  return walkStepsFor(recipeId).length > 0;
}

// ============================================================================================================
// ARIA COMPANION — the interactive, input-collecting assistant that lives on the floating globe. ONE content
// source powers both the globe companion AND the Walk-through tab (full-screen library). A flow is an ordered
// list of TYPED steps; the UI renders one card at a time and carries the user's answers forward in an
// in-memory `answers` object (never persisted off-device).
//
// HONESTY (Rule 14) — encoded as an invariant these flows must uphold, proven by tests:
//   · NO invented prices. Tool cost is ALWAYS "check current pricing" + an `open` step to the vendor's OWN
//     pricing page. There is no `$<number>` tool price anywhere in the AI-setup flows.
//   · The assistant NEVER creates accounts, signs in, enters credentials, or pays — every such action is an
//     `open`/instruction the USER performs (HARD-STOP, stated on-card).
//   · Composed prompts are REAL and built from the user's own answers; a missing answer re-asks (composeX
//     returns null), never fabricates. Guide/learn changes NOTHING on the machine.
// ============================================================================================================

// The six interactive step types. `display` = read-only card; the rest collect/act.
export const STEP_TYPES = Object.freeze(["display", "input-text", "choice", "copy", "open", "confirm"]);

// The greeting menu shown when the globe is clicked: "What would you like to do?"
export const COMPANION_MENU = Object.freeze([
  { id: "fix",   label: "Fix a problem",   sub: "Describe it or pick a detected issue", action: "fix" },
  { id: "setup", label: "Set up an AI tool", sub: "Claude · ChatGPT · Gemini",           action: "flow-picker", group: "setup" },
  { id: "learn", label: "Learn",           sub: "Write prompts · How AI loops work",    action: "flow-picker", group: "learn" },
  { id: "ask",   label: "Ask ARIA",        sub: "Ask the knowledge base",               action: "ask" }
]);

// Plain-English goal → a concrete task phrase used when composing the user's first prompt.
const GOAL_PHRASE = Object.freeze({
  write: "write and edit text (emails, docs, content)",
  code: "write and debug code",
  site: "build a simple website",
  automate: "automate a repetitive task",
  research: "research a topic and summarize what matters"
});

/**
 * Compose the user's REAL first prompt from their interview answers (role · task · context · format).
 * REAL-OR-EMPTY: returns null when there's no goal to build on, so the UI re-asks instead of fabricating.
 */
export function composeFirstPrompt(answers = {}) {
  const name = String(answers.name || "").trim();
  const goalText = String(answers.goalDetail || "").trim() || GOAL_PHRASE[answers.goal] || "";
  if (!goalText) return null; // missing the one thing we can't invent — ask again
  const comfort = String(answers.comfort || "").trim();
  const lines = [
    "Role: You are my patient, plain-English AI assistant. I'm getting started, so avoid jargon and explain as you go.",
    `Task: Help me ${goalText}.`,
    `Context: ${name ? `My name is ${name}. ` : ""}${comfort ? `On a 1-5 comfort scale I'm about a ${comfort}. ` : ""}Ask me one question at a time if you need more detail.`,
    "Format: Give me clear, numbered steps I can follow, then ask what I'd like to do next."
  ];
  return lines.join("\n");
}

/** Compose a reusable prompt from a single free-typed goal (the "how to write prompts" lesson payoff). */
export function composeLearnPrompt(goal) {
  const g = String(goal || "").trim();
  if (!g) return null; // real-or-empty — no goal, no fabricated prompt
  return [
    "Role: You are a helpful, plain-English assistant.",
    `Task: ${g}.`,
    "Context: I'm new to this — keep it simple and check any assumptions with me.",
    "Format: Reply with short numbered steps, then ask me one clarifying question."
  ].join("\n");
}

// The shared interview (input-collection Ahmad asked for). Reused by every AI-setup flow.
function interviewSteps() {
  return [
    { type: "input-text", key: "name", title: "What's your first name?", placeholder: "e.g. Alex", body: "So I can talk to you like a person. This stays on your device." },
    { type: "choice", key: "goal", title: "What do you most want AI to help you with?", options: [
      { value: "write", label: "Write", sub: "emails, docs, content" },
      { value: "code", label: "Code", sub: "scripts, small apps" },
      { value: "site", label: "Build a website", sub: "a real site online" },
      { value: "automate", label: "Automate tasks", sub: "repetitive work" },
      { value: "research", label: "Research", sub: "find + summarize" }
    ] },
    { type: "input-text", key: "goalDetail", title: "In your own words, what's the first thing you'd want it to do?", placeholder: "e.g. draft replies to customer emails", body: "One sentence is enough — I'll turn it into a real prompt for you." },
    { type: "choice", key: "comfort", title: "How comfortable are you with tech and AI?", options: [
      { value: "1", label: "1 — Brand new" }, { value: "2", label: "2" }, { value: "3", label: "3 — Some" }, { value: "4", label: "4" }, { value: "5", label: "5 — Very" }
    ] },
    { type: "choice", key: "budget", title: "What's your budget for tools?", options: [
      { value: "free", label: "Free only" },
      { value: "small", label: "Small monthly (a few dollars)" },
      { value: "moderate", label: "Moderate monthly" },
      { value: "worth", label: "Whatever delivers value" }
    ] },
    { type: "choice", key: "device", title: "What device are you on?", options: [
      { value: "windows", label: "Windows" }, { value: "mac", label: "Mac" }, { value: "both", label: "Both" }
    ] }
  ];
}

// Shared closing steps for every AI-setup flow: the real composed prompt + the loop lesson.
function composeAndLoopSteps(tool) {
  return [
    { type: "copy", title: "Your first prompt — ready to paste", body: `Paste this into ${tool} and tell me what happened. It's built from your answers.`,
      compose: composeFirstPrompt, safety: "Never share passwords, card numbers, or one-time codes with any AI — including this one." },
    { type: "display", title: "How the loop works", body: "AI gets better in a loop: Ask → Read the answer → Refine your ask → Repeat. Your first prompt is the 'Ask'. Read what comes back, then tell it what to change. Two or three passes usually gets you there." },
    { type: "confirm", key: "setupDone", title: "Did you get a useful reply?", yes: { label: "Yes — I'm set up" }, no: { label: "Not yet", help: "Tell the tool exactly what was off ('too long', 'wrong topic') and send again — that's the Refine step. You can also come back to Fix a problem or Ask ARIA any time." } }
  ];
}

// The flows, as data. Fix-a-problem is handled by the companion UI (reuses the gated/guided path already built);
// the AI-setup + learn flows are fully authored here. COST steps NEVER state a tool price — they open the
// vendor's own pricing page. Every account/sign-in/payment step is an `open` the USER performs (hard-stop noted).
export const FLOWS = Object.freeze({
  "claude-setup": {
    id: "claude-setup", group: "setup", title: "Set up Claude", tool: "Claude",
    blurb: "Best all-round assistant — and with Claude Code it can build software and automate files on your PC.",
    steps: [
      { type: "display", title: "Let's set up Claude", body: "Claude is a great all-round assistant. As Cowork + Claude Code it can also build software and automate files on your computer — the same way this app was built. First a few quick questions so I can tailor it to you." },
      ...interviewSteps(),
      { type: "display", title: "Why Claude fits you", body: "Great at: writing, thinking through problems, and — with Claude Code — building and automating on your machine. Honest limits: it can be over-careful, and it isn't a search engine (bring your own sources). Cost: Claude has a free tier and paid plans — I never guess a number. The next step opens Anthropic's official pricing so you see today's real prices. IIS setup fee: we'll quote you — nothing is charged here." },
      { type: "open", title: "See Claude's real pricing", body: "Opens Anthropic's official pricing page so you see current, accurate numbers — not a guess.", url: "https://www.anthropic.com/pricing", note: "Opens your browser. You decide if and what to pay — ARIA never pays for you." },
      { type: "open", title: "Create your Claude account", body: "Opens claude.ai. Sign up with your email and pick a plan if you want the paid tier.", url: "https://claude.ai", note: "HARD STOP: you create the account, sign in, and pay yourself. ARIA never types your password, signs in, or pays." },
      ...composeAndLoopSteps("Claude")
    ]
  },
  "chatgpt-setup": {
    id: "chatgpt-setup", group: "setup", title: "Set up ChatGPT (+ Codex)", tool: "ChatGPT",
    blurb: "Most popular chat assistant; pairs with Codex for stronger coding.",
    steps: [
      { type: "display", title: "Let's set up ChatGPT", body: "ChatGPT is the most popular chat assistant, and it pairs with Codex for stronger coding. A few quick questions first." },
      ...interviewSteps(),
      { type: "display", title: "Why ChatGPT fits you", body: "Great at: everyday chat, drafting, and — with Codex — coding help. Honest limits: answers can sound confident even when wrong, so verify anything important. Cost: it has a free tier and paid plans — I never guess a number. The next step opens OpenAI's official pricing. IIS setup fee: we'll quote you — nothing charged here." },
      { type: "open", title: "See ChatGPT's real pricing", body: "Opens OpenAI's official pricing page so you see current numbers.", url: "https://openai.com/pricing", note: "Opens your browser. You decide if and what to pay — ARIA never pays for you." },
      { type: "open", title: "Create your ChatGPT account", body: "Opens chatgpt.com. Sign up with your email.", url: "https://chatgpt.com", note: "HARD STOP: you create the account, sign in, and pay yourself. ARIA never types your password, signs in, or pays." },
      ...composeAndLoopSteps("ChatGPT")
    ]
  },
  "gemini-setup": {
    id: "gemini-setup", group: "setup", title: "Set up Gemini (+ Codex)", tool: "Gemini",
    blurb: "Great for research and the Google stack; no native app-builder, so we pair it with Codex for building.",
    steps: [
      { type: "display", title: "Let's set up Gemini", body: "Gemini is great for research and anything in the Google world. Honest note: it has no native app-builder, so for building things we pair it with Codex. A few quick questions first." },
      ...interviewSteps(),
      { type: "display", title: "Why Gemini fits you", body: "Great at: research, summarizing, and Google-stack tasks. Honest limit: no native app-builder — pair it with Codex to build. Cost: it has a free tier and paid plans — I never guess a number. The next step opens Google's official pricing. IIS setup fee: we'll quote you — nothing charged here." },
      { type: "open", title: "See Gemini's real pricing", body: "Opens Google's official Gemini pricing page so you see current numbers.", url: "https://gemini.google.com", note: "Opens your browser. You decide if and what to pay — ARIA never pays for you." },
      { type: "open", title: "Create your Gemini account", body: "Opens gemini.google.com. Sign in with your Google account.", url: "https://gemini.google.com", note: "HARD STOP: you create the account, sign in, and pay yourself. ARIA never types your password, signs in, or pays." },
      ...composeAndLoopSteps("Gemini")
    ]
  },
  "learn-prompts": {
    id: "learn-prompts", group: "learn", title: "How to write prompts",
    blurb: "The 4-part shape of a good prompt — then compose one from your own goal.",
    steps: [
      { type: "display", title: "A good prompt has 4 parts", body: "Role (who the AI should be) · Task (what you want) · Context (what it should know) · Format (how the answer should look). Get those four in and you'll get far better results." },
      { type: "input-text", key: "goal", title: "What do you want the AI to do?", placeholder: "e.g. summarize this contract in plain English", body: "Type your real goal — I'll turn it into a proper prompt you can reuse." },
      { type: "copy", title: "Your prompt — built the right way", body: "Copy this and paste it into any AI. Notice the four parts.",
        compose: (a) => composeLearnPrompt(a.goal), safety: "Never paste passwords, card numbers, or one-time codes into an AI." },
      { type: "display", title: "Reuse the shape", body: "Any time you want something from an AI, fill in the same four blanks: Role, Task, Context, Format. That's the whole trick." }
    ]
  },
  "learn-loops": {
    id: "learn-loops", group: "learn", title: "How AI loops work",
    blurb: "Ask → Read → Refine → Repeat — try it on a real task.",
    steps: [
      { type: "display", title: "AI works in a loop", body: "Ask → Read the answer → Refine your ask → Repeat. You rarely get it perfect on the first try — and that's fine. Each pass gets closer." },
      { type: "input-text", key: "loopTask", title: "Pick one small task to try the loop on", placeholder: "e.g. write a friendly out-of-office message", body: "Something real and small. We'll run one loop on it." },
      { type: "display", title: "Your worked example", compose: (a) => {
        const task = String(a.loopTask || "").trim();
        if (!task) return null; // real-or-empty — no task, no fabricated example
        return `1. ASK: "Help me ${task}."\n2. READ: see what it gives you.\n3. REFINE: "Make it shorter and warmer" (or whatever's off).\n4. REPEAT: send again. Two or three passes usually nails it.`;
      }, body: "Type a task above and I'll turn it into a real loop you can follow." },
      { type: "confirm", key: "loopTry", title: "Want to try this in Ask ARIA now?", yes: { label: "Yes, open Ask ARIA" }, no: { label: "Maybe later", help: "The loop works with any AI — keep Ask → Read → Refine → Repeat in your back pocket." } }
    ]
  }
});

/** A flow by id (or null). */
export function getFlow(id) { return FLOWS[String(id || "")] || null; }

/** Flows in a menu group ("setup" | "learn"), for the picker + the Walk-through library. */
export function listFlows(group) {
  return Object.values(FLOWS).filter((f) => !group || f.group === group).map((f) => ({ id: f.id, title: f.title, group: f.group, blurb: f.blurb }));
}

/** The step at an index of a flow (or null past the end). */
export function flowStep(flowId, index) {
  const f = getFlow(flowId);
  if (!f || index < 0 || index >= f.steps.length) return null;
  return f.steps[index];
}

/** The answer key a step collects, or null for steps that collect nothing. */
export function stepKey(step) {
  return step && (step.type === "input-text" || step.type === "choice" || step.type === "confirm") ? step.key : null;
}

/** Whether a step's required answer is present (drives "re-ask on missing" — never fabricate a value). */
export function isStepAnswered(step, answers = {}) {
  const key = stepKey(step);
  if (!key) return true; // display / open / copy collect nothing
  return String((answers || {})[key] ?? "").trim().length > 0;
}

/**
 * Resolve a step for rendering against the current answers: copy/display steps with a `compose(answers)`
 * function get their live text; `ready:false` means a required input is still missing (the UI re-asks).
 */
export function resolveStep(step, answers = {}) {
  if (!step) return null;
  const out = { ...step };
  if (typeof step.compose === "function") {
    const text = step.compose(answers);
    out.text = text;              // null when an input is missing → UI shows the re-ask body, never a fake value
    out.ready = text != null;
  } else {
    out.ready = isStepAnswered(step, answers);
  }
  return out;
}
