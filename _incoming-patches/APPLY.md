# Apply these 5 commits — they exist ONLY in the Cowork cloud container

They are not on GitHub and not on your disk. If the container is reclaimed they are gone.
Base commit is `ae32c12`, which is already on `origin/main`, so they apply cleanly.

Run this from your real terminal (PowerShell/Git Bash) in:
`C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy`

```
git fetch origin
git checkout -b merge-v2-to-main origin/main
git am /path/to/patches/*.patch
git push -u origin merge-v2-to-main
```

If `git am` stops on a conflict:
```
git status          # see the file
# fix it, then
git add -A && git am --continue
```
To bail out entirely: `git am --abort`.

## What is in them

1. `1fcd100` Support FAQ — removed from homepage, made bold gold under Forums (you asked for this)
2. `bca99ee` Site-wide legal fine print — disclaimer strip on every page + contextual risk notices (you asked for this)
3. `70a65c8` bid-radar-cron — daily CanadaBuys scan on the Netlify cron stack, emails only on new IT hits
4. `221fbb6` bid-sweep + listing copy pack — 42-portal Ontario municipal sweep, master NAP/copy source
5. `9e7f73d` listing venue list — ranked free venues + corrected co-op buying group analysis

## After pushing

`netlify/functions/bid-radar-cron.mjs` carries `export const config = { schedule: '0 11 * * 1-5' }`.
Netlify registers the schedule on deploy. Auto Publishing is locked on the site, so the
deploy will build but sit unpublished until you click Publish.
