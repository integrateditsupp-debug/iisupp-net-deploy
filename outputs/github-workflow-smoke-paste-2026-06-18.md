# GitHub Actions smoke workflow — paste manually

The PAT lacks `workflow` scope so this cannot be pushed automatically.

**To install:**
1. Open https://github.com/integrateditsupp-debug/iisupp-net-deploy
2. Create file `.github/workflows/smoke.yml`
3. Paste the YAML below
4. Commit on main

```yaml
name: smoke
on:
  push:
    branches: [main]
  pull_request:
permissions: { contents: read }
jobs:
  syntax-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Check all .js + .mjs files in netlify/functions/ parse
        run: |
          set -e
          for f in netlify/functions/*.js netlify/functions/*.mjs; do
            [ -f "$f" ] || continue
            node --check "$f" || { echo "SYNTAX FAIL: $f"; exit 1; }
          done
          echo "All functions parsed OK."
      - name: Check all scripts/*.mjs parse
        run: |
          for f in scripts/*.mjs; do
            [ -f "$f" ] || continue
            node --check "$f" || { echo "SYNTAX FAIL: $f"; exit 1; }
          done
      - name: Check sitemap is valid XML
        run: |
          if [ -f sitemap.xml ]; then
            python3 -c "import xml.etree.ElementTree as E; E.parse('sitemap.xml')"
          fi
      - name: Check robots.txt parses
        run: |
          if [ -f robots.txt ]; then
            grep -c '^User-agent' robots.txt > /dev/null || (echo "robots.txt malformed" && exit 1)
          fi
      - name: Check index.html has closing tags
        run: |
          if [ -f index.html ]; then
            grep -c '</body>' index.html > /dev/null
            grep -c '</html>' index.html > /dev/null
          fi
```

This catches the kind of bug that broke us last week (single-quote in aria-testimonial-request.js) before it hits Netlify build.

Alternative: grant the existing PAT `workflow` scope at https://github.com/settings/tokens — then I can push workflows directly.
