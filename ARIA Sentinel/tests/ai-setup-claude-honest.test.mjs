// The Claude AI-setup flow must be HONEST end-to-end (Rule 14 + hard-stops): NO invented price (cost is always
// "check current pricing" + the vendor's OWN pricing page), the agent NEVER creates accounts / signs in / pays
// (every such action is an `open` the USER performs, said plainly on-card), and it includes the safety line.
import assert from "node:assert/strict";
import { getFlow, composeFirstPrompt } from "../src/shared/walkthrough-steps.mjs";

const flow = getFlow("claude-setup");
let n = 0; const t = () => { n++; };

// 1 — the flow exists and is a full interview → card → install → prompt → loop journey.
assert.ok(flow && flow.steps.length >= 8, "claude-setup flow is substantial");
const types = flow.steps.map((s) => s.type);
for (const need of ["input-text", "choice", "display", "open", "copy"]) assert.ok(types.includes(need), `flow includes a ${need} step`);
// interview collects the real inputs.
const keys = flow.steps.filter((s) => s.key).map((s) => s.key);
for (const k of ["name", "goal", "goalDetail", "comfort", "budget", "device"]) assert.ok(keys.includes(k), `interview collects ${k}`);
t();

// 2 — NO invented price anywhere in the flow. Not a single "$<number>" tool price.
const allText = JSON.stringify(flow.steps.map((s) => ({ title: s.title, body: s.body, note: s.note, options: s.options })));
assert.ok(!/\$\s?\d/.test(allText), "flow contains NO invented dollar price");
assert.ok(!/\b\d+\s?(\/mo|per month|a month|USD)\b/i.test(allText), "flow states no invented monthly figure");
t();

// 3 — cost is handled honestly: an explicit "never guess / check current pricing" line + an `open` to the
// vendor's OFFICIAL pricing page (so the user sees today's real numbers, not our guess).
assert.match(allText, /never guess|check current pricing|official pricing|real pricing|real (numbers|prices)/i, "cost is 'check current pricing', not a number");
const openUrls = flow.steps.filter((s) => s.type === "open").map((s) => s.url);
assert.ok(openUrls.some((u) => /anthropic\.com\/pricing/.test(u)), "opens Anthropic's official pricing page");
assert.ok(openUrls.some((u) => /^https:\/\/claude\.ai/.test(u)), "opens the official claude.ai for sign-up");
t();

// 4 — HARD STOP: the account / sign-in / payment steps are `open` actions the USER performs. NO step in the
// flow describes the agent creating an account, signing in, entering a password, or paying.
const accountStep = flow.steps.find((s) => /create your .*account/i.test(s.title || ""));
assert.ok(accountStep && accountStep.type === "open", "account creation is an `open` step (user's click)");
assert.match(accountStep.note || "", /you create the account|you (create|sign)|never types your password|never .*(signs in|pays)/i, "account step states the hard-stop on-card");
// no step ever claims the assistant itself does the credential/payment action.
assert.ok(!/\b(I|ARIA|the assistant|we) (will )?(sign you in|log you in|enter your password|create your account for you|pay for you|make the payment)\b/i.test(allText), "assistant never performs the credential/payment action");
t();

// 5 — the composed first prompt is REAL (built from the user's inputs) and carries a safety line.
const copyStep = flow.steps.find((s) => s.type === "copy");
assert.equal(typeof copyStep.compose, "function", "copy step composes from answers");
assert.match(copyStep.safety || "", /never share (your )?passwords|card numbers|one-time codes/i, "copy step carries the safety line");
const p = composeFirstPrompt({ name: "Dana", goalDetail: "organize my week", comfort: "3" });
assert.ok(p.includes("Dana") && p.includes("organize my week"), "composed prompt uses the real inputs");
t();

// 6 — honesty on limits (no over-claim): the card states real strengths AND honest limits.
assert.match(allText, /honest limit|isn't a search engine|over-careful|limits:/i, "flow states honest limits (no over-claim)");
// no fake "you're all set" completion claim.
assert.ok(!/you're all set|setup complete|fully configured|everything is done/i.test(allText), "no fabricated completion claim");
t();

assert.equal(n, 6, "6 ai-setup-claude-honest groups");
console.log(`ai-setup-claude-honest test passed (${n} groups · no invented price · official pricing link · account/sign-in/pay are user open-steps · safety line · real composed prompt · honest limits, no fake 'all set').`);
