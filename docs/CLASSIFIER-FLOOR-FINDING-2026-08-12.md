# The classifier floor breach of 2026-08-12, measured rather than attributed

**Status:** open, and open in somebody else's hands. Nothing in this document was edited into
`tests/aria-classifier-mirror.js`; the tuning in the working tree belongs to a concurrent writer and
Rule 15 says it stays theirs. This records what it measures to, so the next person to touch it does
not spend a cycle finding out.

## What is red, and what is not

`ARIA Sentinel` registry, read this cycle: **1074 pass / 0 fail**, and `exit 1` — the exit code
carrying a fact the counts do not, exactly as RUN-BG recorded. One suite fails to LOAD:

```
✗ ./classifier-accuracy.test.mjs — intent "default" = 85.5% dropped below its regression floor 86%
```

**This is not on main.** The suite reads `tests/aria-classifier-mirror.js` from the working tree, and
the working tree carries six uncommitted hunks. Both versions were evaluated against the same corpus
(`tests/scenario-corpus-mega.js`, 332,163 cases) through the same `tests/mega-eval.js` the gate
itself uses, in a process that touched nothing:

| mirror | overall | `default` | `kb:active-directory` | floor breaches |
|---|---|---|---|---|
| **HEAD — what is committed on main** | 93.55% | **86.13%** | 100.0% | **none** |
| working copy, all six hunks | 93.29% | **85.49%** | 100.0% | `default` 85.49% < 86% |
| working copy **minus h05** | 93.51% | **86.13%** | 100.0% | **none** |

So main is green on this gate and the tuning in flight is what crosses the floor.

## Which hunk, measured one at a time

Each of the six hunks was applied to HEAD's mirror **alone** and evaluated. Five are neutral or
positive on the floor; one carries the whole breach.

| hunk | `default` | vs HEAD | overall | vs HEAD |
|---|---|---|---|---|
| h01 | 86.13% | +0.00pp | 93.56% | +0.01pp |
| h02 | 86.13% | +0.00pp | 93.55% | +0.00pp |
| h03 | 86.13% | +0.00pp | 93.40% | **−0.15pp** |
| h04 | 86.13% | +0.00pp | 93.56% | +0.02pp |
| **h05** | **85.49%** | **−0.63pp** | 93.33% | **−0.22pp** |
| h06 | 86.13% | +0.00pp | 93.63% | +0.08pp |

**h05** is the pair of hardware/shopping rules — the `buy|shop|purchase|amazon|…` line gaining a
negative lookahead for damage and power symptoms, and the device line beneath it widening to match.
It is the only edit in the set that moves `default` at all, and it moves it through the floor.

h03 is worth a second look for a different reason: it breaches nothing, but it is the only other
hunk that costs overall accuracy, and it costs more than h06 gains.

## The narrowest change that clears the gate

Drop h05, keep the other five: `default` returns to 86.13% and every floor is clear. That was
measured, not inferred — the five-hunk composite was built, parsed, and evaluated as its own row in
the first table above.

## How to reproduce

The measurement needs no repository write. Evaluate any candidate mirror against the real corpus:

```js
const corpus = require("<repo>/tests/scenario-corpus-mega.js");
const { evaluate } = require("<repo>/tests/mega-eval.js");
const { classify, looksLikeResolution } = require("<candidate mirror>.js");
const ev = evaluate(corpus, classify, looksLikeResolution);
// ev.by_intent.default.pass / ev.by_intent.default.total  →  compare against 0.86
```

The floors the gate enforces live in `ARIA Sentinel/tests/classifier-accuracy.test.mjs`;
`default: 0.86` is the one in question. Nothing here proposes moving a floor — a floor lowered to
admit the change it was written to catch is not a floor.

## A note on why this was worth measuring rather than reporting

"The classifier suite is red" and "one of six hunks costs 0.63 points on one intent and the other
five are free" are the same red and very different facts. The first hands the next person a search;
the second hands them a decision.
