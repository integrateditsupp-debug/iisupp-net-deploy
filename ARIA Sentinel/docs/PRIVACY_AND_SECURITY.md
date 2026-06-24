# Privacy And Security

## Principle

ARIA Sentinel is engineered as an on-device support agent. Device signals are processed locally. The public iisupp.net endpoints are pull-only knowledge feeds.

## Default outbound paths

- `GET https://iisupp.net/.netlify/functions/aria-recipes`
- `GET https://iisupp.net/.netlify/functions/aria-stop-codes`
- `GET https://iisupp.net/.netlify/functions/aria-kb-bundle`
- `POST https://{customer-instance}.service-now.com/api/now/table/incident` only after customer configuration and confirmation.
- `POST https://iisupp.net/.netlify/functions/aria-recipe-feedback` only for opt-in `{ recipe_id, outcome, ts }`.

## Chrome extension data boundary

The extension sends/stores only:

- Symbolic signal id, such as `BROWSER.CACHE.STALE`.
- Origin category, such as `public`, `sso`, `saas`, `internal`, or `localhost`.
- Raw origin is used only in memory for browser APIs such as current-origin cache clearing.
- No page body, form fields, cookies, passwords, local storage values, screenshots or files.

## Command execution boundary

The Windows app:

- Runs in dry-run mode by default.
- Allows only recipe-defined actions.
- Blocks known destructive command families.
- Never converts arbitrary user text into a shell command.
- Logs local transparency events.

## Enterprise controls to add before production

- Code signing.
- Encrypted SQLite knowledge store.
- Customer-managed recipe policy file.
- Tenant/customer ServiceNow OAuth setup.
- External security assessment.
- Formal third-party SBOM or signed software supply-chain attestation.
