# ARIA Sentinel Security Disclosure Addendum

This addendum supplements the public Integrated IT Support disclosure policy at `/.well-known/security.txt` and `/security/disclosure`.

## Sentinel-Specific Scope

Please report issues involving:

- Raw screen, page, document, path, URL, credential or command-output content reaching disk, logs, tickets, telemetry or network calls.
- Extension storage of raw origin, page text, form fields, cookies, local storage values or passwords.
- A recipe, KB overlay or policy file granting actions beyond the deny-by-default allowlist.
- A command injection path from user text, browser events or endpoint telemetry into shell execution.
- Audit log tampering that does not break the hash chain.
- Unsafe escalation from Manual mode to Confirmed or Autonomous mode.
- Public serving of Sentinel source/build folders from the Netlify static root.

## Evidence To Include

- Product version.
- Operating system and browser version.
- Exact symbolic code or recipe ID if known.
- Minimal reproduction steps.
- Whether the issue happened in dry-run mode or with system fixes enabled.
- Sanitized proof. Do not send customer secrets, documents, screenshots or private page content.

## Current Security Limits

- Version 0.1.0 is unsigned and intended for internal pilot use.
- OS-changing fixes are dry-run by default.
- Live ServiceNow OAuth is not configured.
- The local KB store is not yet encrypted SQLite.
- External penetration testing has not yet been completed.

## Contact

Use `security@iisupp.net` or the public policy links above.
