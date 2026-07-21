# vendor/

`aria-vision-diagnose.js` is a **byte-identical copy** of `/assets/aria-vision-diagnose.js` from the
website repo root. Sentinel is an offline-capable desktop app, so it cannot `<script src>` the live
site — but the whole point of Stage 2 is that ARIA web, Forums Ask-AI, and Sentinel run the *same*
engine and the *same* consent/abstain contract.

`tests/vision-surfaces.test.mjs` asserts the two files are identical. If you change one, copy it
across; the test fails loudly on drift rather than letting the surfaces quietly diverge.
