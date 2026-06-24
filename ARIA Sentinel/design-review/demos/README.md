# ARIA Sentinel demo reels

5 self-running, loopable HTML demos (real gold-globe SVG + fix-card UI). Regenerate with:

```
node scripts/capture-demo.mjs
```

Each plays detection → fix card → done on a 9s loop. **Zero dependencies, no install.**

## To produce an mp4 / GIF (no ffmpeg bundled — Rule 10)
1. Open `<scenario>.html` (or `index.html` for the gallery) in a browser.
2. Screen-record the stage (Win+G Game Bar, or any recorder) for ~9s = one full loop.
3. Save under `design-review/demos/` as `<scenario>.mp4`.

## Embed in a landing page
`<iframe src="/aria-sentinel/demos/disk-low.html" width="380" height="420"></iframe>`

Scenarios: disk-low · printer-stuck · cache-stale · bsod-resume · escalation
