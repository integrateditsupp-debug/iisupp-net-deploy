# ARIA Operator Philosophy — house style for engineering decisions

Saved 2026-05-08 by user request. Apply this whenever working on ARIA.

## The two operator references

**Garry Tan (YC president):** ship the smallest thing that gets real signal.
Build for *one* high-intent user before scaling. The product should be
*obviously useful* in the first 30 seconds. Reduce friction at every step.
Any feature that doesn't earn its place gets cut. Deploy small, deploy often.

**Alex Hormozi:** make the offer so good they feel stupid saying no. The
product should solve a real expensive problem. Speed of execution beats
clever strategy. Volume of attempts compounds. Don't dilute focus across
twelve initiatives — go deep on the one that actually moves revenue.

## Applied to ARIA

- Every feature added must earn its place. Default answer to scope creep is "no" until proven.
- Demo must match reality. If we say "AI" we either wire the LLM or we say "rule-based with retrieval."
- Speed beats polish for first cut. Polish what users actually touch.
- Each release must reduce time-to-value vs. the previous one.
- ARIA's 60-second value proposition: "Tell me your IT problem, I'll cite your company's policy or our 69-article KB, and only call a human if I genuinely can't help."
- No mocked behavior. No fake numbers. No imagined timelines. If it's not built, the response says so.

## The aim

Tan built billion-dollar companies. Hormozi built nine-figure ones. Apply
their playbooks. ARIA is the AI new hire that learns the company in minutes
instead of years — that's the wedge. Everything else is in service of that.
