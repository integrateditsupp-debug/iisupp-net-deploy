# Ahmad — when you get back (2026-06-18)

The 2h autonomous window is closing. Here is the exact list of things only you can finish.

## Browser tabs ready for your sign-in (8)

Each tab is pre-filled with D-U-N-S 241726397, address 30 Fothergill Crt Whitby ON L1P 1L4, ahmad.wasee@iisupp.net, +1-647-581-3182. You click submit.

1. **Microsoft Cloud Partner Program** — partner.microsoft.com signup
2. **Microsoft for Founders Hub** — foundershub.microsoft.com (free Azure credits)
3. **AWS Activate** — aws.amazon.com/activate (free AWS credits)
4. **AWS Partner Network — Registered tier** — partnercentral.aws.amazon.com
5. **Google Search Console** — verify iisupp.net property
6. **SAM.gov UEI request** — sam.gov (US fed sub-prime path)
7. **Bing Webmaster** — bing.com/webmasters
8. **Google Business Profile** — google.com/business

## One-time CLI you need to run (5 min)

```bash
# 1. Generate PGP key for security@iisupp.net (cmds at /.well-known/pgp-key.txt)
gpg --quick-generate-key 'security@iisupp.net' rsa4096 sign,encrypt 1y
gpg --armor --export security@iisupp.net > security-pubkey.asc
# Then paste into the iisupp.net file at .well-known/pgp-key.txt and push

# 2. Sync coupons to Stripe (only after setting ARIA_COUPONS_JSON env var)
STRIPE_SECRET_KEY=sk_live_... \
ARIA_COUPONS_JSON='[{"code":"BUILD25","pct":25,"duration":"once","max_uses":50}]' \
node scripts/stripe-coupon-mirror.mjs

# 3. (Optional) Add `workflow` scope to your GitHub PAT and re-push to install
# .github/workflows/smoke.yml — paste from outputs/github-workflow-smoke-paste-2026-06-18.md
```

## What runs without you

Everything else. 18 crons, 143 functions, 32+ pages. See `outputs/2h-autonomous-run-FINAL-2026-06-18.md` for full inventory.

## Revenue blockers still open (not in 2h scope)

- STRIPE_SECRET_KEY in Netlify prod env vars — without this no real payments
- First pilot signup → first invoice paid → first MRR
- Codex's FINISH-100 packet remainder (a11y label sweep, scenario universe v4, /pricing visual diff)

## Standing rules I respected during the run

- No spend
- No homepage visual changes
- No Raymond James mentions anywhere
- No money-back / guarantee / refund language
- ARIA + Aperture not touched
- 15+ years IT (not 21+)
- Browser-prefill rule applied to all 8 partner tabs

— Cowork
