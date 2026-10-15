# Importing the 3X-UI Core into EL-UI

## Why this is a manual step

The GitHub integration can create and update individual files, but it cannot safely transplant the
full upstream Git history and source tree into this repository as a single authenticated local Git
operation. A local Git merge is needed to preserve upstream history and the existing EL-UI bootstrap
commits.

## Before you start

-  Use a local working folder, not a production server. - Install Git for Windows if `git --version`
  is not recognized. - Make sure you have push access to
  [ArmanEleven/EL-UI](https://github.com/ArmanEleven/EL-UI). - This procedure creates a new
  integration branch and does not force-push or overwrite the remote `main` branch.

## PowerShell steps

Run these commands in a PowerShell window:

```powershell
git clone https://github.com/MHSanaei/3x-ui.git EL-UI-work
Set-Location EL-UI-work

# Preserve the original upstream remote and add your EL-UI repository.
git remote rename origin upstream
git remote add elui https://github.com/ArmanEleven/EL-UI.git
git fetch elui

# Create a work branch based on the upstream core.
git checkout -b integration/el-ui-core upstream/main

# Merge the existing EL-UI bootstrap history without force-pushing.
git merge elui/main --allow-unrelated-histories --no-commit
```

Git may report conflicts in `README.md` and possibly `.gitignore`. Do not blindly choose one side: -
Keep the upstream README's technical/build instructions and license attribution. - Preserve the
EL-UI project direction, feature matrix, source audit, architecture and decision log. The project
notes can be copied/merged into the upstream README after resolving the conflict. - Keep both sets
of ignore rules where they do not conflict. - Never remove the upstream LICENSE or copyright
notices.

After resolving the conflicts, run:

```powershell
git add -A
git commit -m "chore: import Sanaei 3X-UI core for EL-UI"
git push -u elui integration/el-ui-core
```

Then open a pull request from `integration/el-ui-core` into `main` in GitHub. Do not merge it until
the resulting tree has been reviewed.

## Validation after import

Before merging: 1. Check `git status` and inspect `git diff --stat`. 2. Confirm upstream `LICENSE`,
source notices, and build files remain present. 3. Confirm all EL-UI docs remain present under
`docs/`. 4. Confirm no secrets, production databases, private keys or local `.env` files were added.
5. Do not run the installer on a production machine.

If Git reports a conflict or an error, stop and share the exact terminal output; do not use `git
push --force`.
