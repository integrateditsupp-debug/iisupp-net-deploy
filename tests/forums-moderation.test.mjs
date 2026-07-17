#!/usr/bin/env node
// FORUMS MODERATOR — local, $0, REVERSIBLE content moderation. Tier-1 slurs/hate/spam soft-remove
// (original retained, placeholder shown); Tier-2 profanity/insults FLAG (post kept — a curse inside a
// real help post is venting, never nuked); Tier-3 doxxing redact. Leetspeak is normalized. NEVER
// hard-deletes. Admin toggles gate each tier. No external toxicity API in the path.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { moderate, applyVerdict, redactDoxxing, auditReason } from "../assets/forums-moderation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1 — Tier-1 slur -> soft_remove, and it is REVERSIBLE (original body retained; placeholder set).
const v1 = moderate("you are a f4gg0t, just kys");
assert.equal(v1.tier, 1);
assert.equal(v1.action, "soft_remove");
const post1 = { id: "p1", body: "you are a f4gg0t, just kys", ts: 1 };
const applied1 = applyVerdict(post1, v1, {});
assert.equal(applied1, "soft_remove");
assert.equal(post1.removed, true, "post is soft-removed");
assert.ok(post1.removedReason && /reversible/i.test(post1.removedReason), "placeholder explains it is reversible");
assert.equal(post1.body, "you are a f4gg0t, just kys", "ORIGINAL body retained (reversible — never hard-deleted)");

// 2 — mild profanity in a genuine help post -> NOT removed (packet acceptance).
const vMild = moderate("my damn printer won't print, can someone help?");
assert.notEqual(vMild.action, "soft_remove", "a legit help post with mild profanity is NEVER removed");
assert.notEqual(vMild.tier, 1, "mild venting is not tier-1");

// 3 — real profanity -> FLAG (human review), post KEPT intact.
const vProf = moderate("this fucking outlook keeps crashing every morning");
assert.equal(vProf.tier, 2);
assert.equal(vProf.action, "flag");
const post3 = { id: "p3", body: "this fucking outlook keeps crashing every morning", ts: 1 };
applyVerdict(post3, vProf, {});
assert.equal(post3.flagged, true, "flagged for human review");
assert.ok(!post3.removed, "flagged posts are NOT removed — the help content stays");
assert.equal(post3.body, "this fucking outlook keeps crashing every morning", "body untouched");

// 4 — insults / anger -> Tier-2 flag (queued for a human, not auto-nuked).
assert.equal(moderate("you are an idiot and clueless").action, "flag");

// 5 — doxxing -> Tier-3 redact, PII removed, post kept.
const vDox = moderate("reach me at bob.smith@example.com or 416-555-1234, i live at 30 Fothergill Court");
assert.equal(vDox.tier, 3);
assert.equal(vDox.action, "redact");
assert.ok(vDox.redactedText && /\[redacted\]/.test(vDox.redactedText), "PII masked");
assert.ok(!/example\.com|416-555-1234/.test(vDox.redactedText), "no raw email/phone survives redaction");
const rd = redactDoxxing("call 647-581-3182 now");
assert.ok(rd.labels.includes("phone") && /\[redacted\]/.test(rd.text));

// 6 — leetspeak / obfuscation is normalized (sh!t, b1tch, spaced + dotted letters).
assert.equal(moderate("what the sh!t is this").action, "flag", "leet ! -> i");
assert.equal(moderate("n1gg3r").tier, 1, "leet slur caught as tier-1");
assert.equal(moderate("b1tch please").action, "flag", "leet 1 -> i");
assert.equal(moderate("this is f u c k i n g broken").action, "flag", "spaced letters collapse");
assert.equal(moderate("f.u.c.k this").action, "flag", "dotted letters collapse");

// 7 — clean help text -> allow.
const clean = moderate("printer offline, how do I restart the print spooler?");
assert.equal(clean.action, "allow");
assert.equal(clean.tier, 0);

// 8 — admin toggle gates a tier: with tier1 disabled, a slur verdict is NOT applied (post stays up until reviewed).
const post8 = { id: "p8", body: "f4gg0t", ts: 1 };
const appliedOff = applyVerdict(post8, moderate("f4gg0t"), { tier1: false });
assert.equal(appliedOff, "allow", "disabled tier is skipped");
assert.ok(!post8.removed, "tier-1 disabled -> not removed");

// 9 — NEVER hard-deletes: the module has no destructive store op; applyVerdict only sets flags / masks.
const src = readFileSync(path.join(root, "assets/forums-moderation.mjs"), "utf8");
assert.ok(!/\.delete\(|\.splice\(|hardDelete/.test(src), "moderation never hard-deletes");
// $0 — no external toxicity/LLM API in the path.
assert.ok(!/\banthropic\b|\bopenai\b|perspectiveapi|fetch\s*\(/i.test(src), "moderation is local + $0 (no external API call)");
assert.ok(typeof auditReason(v1) === "string" && !/example\.com/.test(auditReason(vDox)), "audit reason is compact + PII-free");

console.log("forums-moderation test passed (reversible tiers · mild-profanity kept · doxxing redacted · leetspeak normalized · toggles gate · never hard-deletes · $0).");
