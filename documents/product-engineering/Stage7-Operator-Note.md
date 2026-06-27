# Stage-7 sandbox-validated auto-fix

**Operator note — ARIA Sentinel · prove-before-prod for any auto-fix**

ARIA Sentinel never "tries a fix and sees what happens" on a real machine. Every
auto-fix is proven before it is allowed to touch the system, and the whole
sequence is **silent** — the user only ever sees the *outcome* (fixed, or escalated),
never the dry-runs, scans, snapshots, or rollbacks behind it.

A fix that fails validation **never reaches the real machine.** It is held at
dry-run and the issue is escalated instead of applied.

## The pipeline (per fix)

1. **Preflight dry-run = logic-validate.** The action is reasoned through and the
   runner returns a dry-run result *unless* the specific recipe is on the cleared
   allow-list. `isActionExecutable()` defaults everything to dry-run; only
   reversible, low-blast-radius recipes (cache flushes, service restarts) can pass.
   (`src/shared/recipe-runner.mjs`, `runAction` in `src/main/main.mjs`)
2. **Side-effect scan.** The command is checked against a hard denylist
   (`format-volume`, `remove-partition`, `clear-disk`, `delete shadow`, `bcdedit`,
   `reg delete`, `cipher /w`, `diskpart`, `format`) and an allow-list of safe verb
   prefixes (`isAllowedCommand`). A destructive verb means the action never runs,
   allow-list or not.
3. **Optional disposable-VM sandbox (frontier).** When available, the fix is run to
   green inside a throwaway VM that mirrors the target before it is ever applied to
   the real machine. This is the *only* tier permitted to claim "sandbox-validated."
   It is a frontier capability and is **not** the shipping default today — the
   default proof tier is logic-validated.
4. **Restore-point snapshot.** Before any PowerShell action touches the machine a
   System Restore point is recorded (`recordRestorePoint`). Yellow-tier recipes
   *require* the snapshot to exist before their actions are even allowed to execute.
5. **Apply.** The cleared command is spawned with positional argv (no shell-string
   interpolation) under `-ExecutionPolicy Restricted`, `-NonInteractive`,
   `-NoProfile`, with a timeout, and is tracked so the Ctrl+Alt+K kill-switch can
   terminate it (`buildExecution`, `runAction`).
6. **Read-back verify.** After a real run of a cleared recipe, a **read-only** probe
   confirms the fix landed (`verifyRecipe` / `VERIFY_COMMANDS`). The probe surfaces
   only `ok` / `not-ok` — raw output is never shown.
7. **Auto-rollback on damage.** If something goes wrong (including a kill-switch
   panic), the restore point is rolled back best-effort (`rollbackRestorePoint`),
   and updates within the rollback window are reverted.

## Honest labels — never overclaim

- **logic-validated** — reasoned and/or dry-run only. The fix was logic-checked and,
  for cleared recipes, read-back verified on the real machine — but it was **not**
  executed in a disposable VM first. This is the truthful label for the shipping
  default.
- **sandbox-validated** — the fix actually ran *green* inside a disposable VM before
  being applied. Reserve this label strictly for tier (3) above.

> **Never claim "sandbox-validated" for a reasoned-only fix.** If the disposable-VM
> tier did not run, the honest label is "logic-validated." Conflating the two is a
> RULE-14 violation.

## Why this matters

The user gets a clean outcome with no exposure to the machinery. The blast radius
is bounded by the allow-list and denylist, every change is undoable via the restore
point, and the proof tier is reported honestly so an operator always knows whether a
fix was *reasoned* safe or *demonstrated* safe.
