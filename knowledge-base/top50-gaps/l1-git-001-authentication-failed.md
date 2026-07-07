---
id: l1-git-001
title: "Git push/pull 'authentication failed' (VS Code / command line)"
category: git
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You have access to the repository", "Git is installed"]
keywords:
  - git authentication failed
  - remote invalid username or password
  - support for password authentication was removed
  - git push rejected auth
  - git credential manager
  - personal access token git
  - git 403 forbidden
  - vs code git authentication
  - could not read from remote repository
  - git permission denied
tags:
  - git
  - vs-code
  - developer
  - top-50
related: [l1-m365-001-cant-sign-in, l1-password-001-reset-and-sspr, l1-browser-001-pages-not-loading]
---

# Git push/pull "authentication failed" (VS Code / command line)

## Symptoms
- "remote: Support for password authentication was removed. Please use a personal access token."
- "fatal: Authentication failed for 'https://…'."
- "remote: Invalid username or password" or HTTP **403**.
- VS Code's Source Control shows "Git: authentication failed" when you sync.
- SSH: "Permission denied (publickey)" or "Could not read from remote repository."

## Likely causes
- The host (GitHub/GitLab/Azure DevOps/Bitbucket) no longer accepts your account password over HTTPS — it needs a **Personal Access Token (PAT)** or SSH key.
- Windows/macOS cached an old credential after a password or token change.
- You lack write access to that specific repository.
- An SSH key isn't loaded or isn't added to your account.

## Safe steps
- **Confirm who you are and where you're pushing (read-only checks):**
  - `git remote -v` — is the URL the repo you expect, and is it **https** or **ssh**?
  - `git config user.email` — is it your work identity?
- **HTTPS: clear the stale credential, then re-auth with a token:**
  - Windows: open **Credential Manager → Windows Credentials** → delete entries for `git:https://github.com` (or your host).
  - macOS: **Keychain Access** → search your host (e.g., `github.com`) → delete the stored internet password.
  - Create a **Personal Access Token** on the host's website (Developer settings → Tokens) with **repo** scope. Treat it like a password — don't paste it into chats or commit it.
  - Run any `git pull`/`git push` → when prompted for a password, **paste the PAT** (not your account password). Git Credential Manager saves it for next time.
- **VS Code specifically:**
  - When the sign-in popup appears, complete the browser sign-in it launches.
  - If it loops, **Command Palette → "Git: Sign out"** (or sign out of the GitHub account in the Accounts menu, bottom-left) and sign in again.
- **SSH instead of HTTPS (optional, avoids tokens):**
  - `ssh -T git@github.com` to test. If it fails, generate a key with `ssh-keygen -t ed25519`, add the **public** key to your account on the host's website, and ensure the agent is running (`ssh-add`).
- **Confirm you actually have access:**
  - Open the repo in the browser — can you see a **write**/push option? If it's read-only for you, request access from the repo owner.

## Verify
- `git pull` and `git push` complete without an auth prompt loop.
- VS Code Source Control syncs cleanly.

## When to escalate (to L2 / IT or the repo owner)
- You need to be **granted access** to the repository or an organization.
- SSO/SAML must authorize your token for the organization (common on GitHub org repos).
- Corporate proxy/firewall is blocking git over HTTPS/SSH and needs an admin change.

## Safety notes
- A PAT and SSH private key are secrets — never commit them, screenshot them, or paste them into messages.
- Clearing a cached credential is safe and just forces a fresh sign-in.

## What ARIA can help with
- ARIA can identify whether it's a **stale cached credential** (clear it), a **password-vs-token** mismatch (use a PAT), or a **missing access/SSO** grant (ask the owner), and walk you through the matching fix. It never asks for or stores your token.
